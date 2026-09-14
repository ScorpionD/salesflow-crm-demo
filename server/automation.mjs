import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { parse, assert } from './domain.mjs';
import { transaction } from './db.mjs';
const eventSchema = z
  .object({ eventId: z.string().uuid(), workspaceId: z.string().uuid() })
  .strict();
const escape = (s) =>
  String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
export function notificationText(p) {
  return `<b>SalesFlow CRM · Deal won</b>\nDeal: ${escape(p.title)}\nCompany: ${escape(p.company)}\nValue: ${Number(p.value).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}\nOwner: ${escape(p.owner)}\nClosed: ${escape(p.timestamp)}\nFictional portfolio demo data`;
}
export function mountAutomation(app, pool, push) {
  app.post('/internal/automation/claim', async (req, res) => {
    const x = parse(eventSchema, req.body);
    res.json(
      await transaction(
        pool,
        x.workspaceId,
        async (c) => {
          const claim = randomBytes(24).toString('hex');
          const q = await c.query(
            "UPDATE automation_events SET status='processing',claimed_at=now(),claim_token=$3 WHERE id=$1 AND workspace_id=$2 AND status='queued' RETURNING *",
            [x.eventId, x.workspaceId, claim],
          );
          if (!q.rowCount) return { claimed: false };
          const e = q.rows[0];
          return {
            claimed: true,
            eventId: e.id,
            workspaceId: e.workspace_id,
            claim,
            text: notificationText(e.payload),
          };
        },
        { write: true },
      ),
    );
  });
  app.post('/internal/automation/complete', async (req, res) => {
    const x = parse(
      eventSchema
        .extend({
          claim: z.string().length(48),
          delivered: z.boolean(),
          receipt: z.string().max(100).default(''),
        })
        .strict(),
      req.body,
    );
    const result = await transaction(
      pool,
      x.workspaceId,
      async (c) => {
        const e = (
          await c.query(
            'SELECT * FROM automation_events WHERE id=$1 AND workspace_id=$2 FOR UPDATE',
            [x.eventId, x.workspaceId],
          )
        ).rows[0];
        assert(e && e.claim_token === x.claim, 403, 'DENIED', 'Access denied.');
        if (e.status === 'delivered' || e.status === 'uncertain')
          return { ok: true, duplicate: true };
        assert(e.status === 'processing', 409, 'INVALID_STATE', 'Event has not been claimed.');
        await c.query(
          "UPDATE automation_events SET status=$3,delivered_at=CASE WHEN $4 THEN now() ELSE NULL END,receipt=$5,error_code=CASE WHEN $4 THEN NULL ELSE 'DELIVERY_UNCONFIRMED' END WHERE id=$1 AND workspace_id=$2",
          [
            x.eventId,
            x.workspaceId,
            x.delivered ? 'delivered' : 'uncertain',
            x.delivered,
            x.receipt,
          ],
        );
        return { ok: true };
      },
      { write: true },
    );
    push(x.workspaceId, 'automation');
    res.json(result);
  });
}
export async function dispatchOutbox(pool, { webhook, secret, fetcher = fetch, push = () => {} }) {
  if (!webhook) return;
  const ws = (
    await pool.query(
      'SELECT id FROM workspaces WHERE expires_at>now() ORDER BY created_at DESC LIMIT 500',
    )
  ).rows;
  for (const w of ws) {
    const events = await transaction(
      pool,
      w.id,
      async (c) => {
        await c.query(
          "UPDATE automation_events SET status='uncertain',error_code='DELIVERY_UNCONFIRMED' WHERE workspace_id=$1 AND status='processing' AND claimed_at<now()-interval '2 minutes'",
          [w.id],
        );
        await c.query(
          "UPDATE automation_events SET status='failed',error_code='AUTOMATION_UNAVAILABLE' WHERE workspace_id=$1 AND status='queued' AND attempts>=3 AND next_attempt_at<now()",
          [w.id],
        );
        return (
          await c.query(
            "UPDATE automation_events SET attempts=attempts+1,next_attempt_at=now()+interval '15 seconds' * power(2,attempts) WHERE id IN (SELECT id FROM automation_events WHERE workspace_id=$1 AND status='queued' AND attempts<3 AND next_attempt_at<=now() ORDER BY created_at LIMIT 5 FOR UPDATE SKIP LOCKED) RETURNING id",
            [w.id],
          )
        ).rows;
      },
      { write: true },
    );
    for (const e of events) {
      try {
        await fetcher(webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Automation-Secret': secret },
          body: JSON.stringify({ workspaceId: w.id, eventId: e.id }),
          signal: AbortSignal.timeout(5000),
        });
      } catch {
        /* Retry only before a claim; delivery ambiguity never resends a message. */
      }
      push(w.id, 'automation');
    }
  }
}
