import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createServer, type Server } from 'node:http';
import { createApp } from '../server/app.mjs';
import { makePool, transaction } from '../server/db.mjs';
import { dispatchOutbox } from '../server/automation.mjs';
const origin = 'http://localhost:5173',
  secret = 'automation-integration-test-only';
describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'PostgreSQL integration — real RLS app role',
  () => {
    const pool = makePool(process.env.TEST_DATABASE_URL),
      app = createApp({ pool, origin, automationSecret: secret, test: true }),
      workspaces: string[] = [];
    let server: Server, base: string, listener: any;
    beforeAll(async () => {
      const check = (
        await pool.query(
          'SELECT current_database() AS db,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user',
        )
      ).rows[0];
      expect(check.db).toMatch(/_test$/);
      expect(check.rolsuper).toBe(false);
      expect(check.rolbypassrls).toBe(false);
      server = createServer(app);
      await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
      base = 'http://127.0.0.1:' + (server.address() as any).port;
      listener = await pool.connect();
      await listener.query('LISTEN salesflow_changes');
      listener.on('notification', (m: any) => {
        const e = JSON.parse(m.payload);
        app.locals.push(e.workspace, e.id);
      });
    });
    afterAll(async () => {
      app.locals.closeStreams();
      if (listener) {
        await listener.query('UNLISTEN *');
        listener.release();
      }
      for (const id of workspaces) await pool.query('DELETE FROM workspaces WHERE id=$1', [id]);
      await new Promise<void>((r) => server.close(() => r()));
      await pool.end();
    });
    async function fixture(role = 'manager') {
      const agent = request.agent(app),
        start = await agent.post('/api/session').set('Origin', origin).send({ role });
      expect(start.status, start.text).toBe(201);
      const s = start.body.session;
      workspaces.push(s.workspace_id);
      const b = await agent.get('/api/bootstrap');
      expect(b.status, b.text).toBe(200);
      const send = (method: string, path: string, body: any) => {
        const r = (agent as any)[method](path);
        return r.set('Origin', origin).set('X-CSRF-Token', s.csrf).send(body);
      };
      return {
        agent,
        s,
        data: b.body,
        send,
        cookie: (start.headers['set-cookie'] as unknown as string[])[0].split(';')[0],
      };
    }
    async function deal(f: any) {
      const r = await f.send('post', '/api/deals', {
        title: 'Integration opportunity',
        company_id: f.data.companies[0].id,
        owner_id: f.s.member_id,
        value: 12500,
        expected_close: '2026-12-01',
      });
      expect(r.status, r.text).toBe(201);
      return r.body.record;
    }
    it('unauthenticated reads are denied', async () =>
      expect((await request(app).get('/api/contacts')).status).toBe(401));
    it('creates private session and restores seeded CRM/report data', async () => {
      const f = await fixture();
      expect(f.data.reports).toMatchObject({
        open_deals: 12,
        pipeline_value: 84500,
        won_deals: 4,
        conversion: 67,
        overdue_tasks: 3,
      });
      const r = await f.agent.get('/api/session');
      expect(r.body.session.workspace_id).toBe(f.s.workspace_id);
      expect(r.body.session.token_hash).toBeUndefined();
      expect(f.cookie).toMatch(/^salesflow_session=/);
    });
    it('foreign workspace reads and writes are blocked', async () => {
      const a = await fixture(),
        b = await fixture();
      expect((await a.agent.get('/api/contacts/' + b.data.contacts[0].id)).status).toBe(404);
      expect(
        (
          await a.send('patch', '/api/contacts/' + b.data.contacts[0].id, {
            version: 1,
            name: 'No access',
          })
        ).status,
      ).toBe(404);
    });
    it('RLS prevents accidental unscoped database reads', async () => {
      await fixture();
      expect((await pool.query('SELECT id FROM contacts')).rows).toEqual([]);
    });
    it('cross-workspace relation cannot create a deal', async () => {
      const a = await fixture(),
        b = await fixture();
      const r = await a.send('post', '/api/deals', {
        title: 'Wrong tenant',
        company_id: b.data.companies[0].id,
        owner_id: a.s.member_id,
        value: 5,
        expected_close: '2026-12-01',
      });
      expect(r.status).toBe(404);
    });
    it('contact CRUD persists and archives safely', async () => {
      const f = await fixture();
      const created = await f.send('post', '/api/contacts', {
        name: 'Test Person',
        email: 'new@example.com',
        owner_id: f.s.member_id,
      });
      expect(created.status, created.text).toBe(201);
      const id = created.body.record.id,
        edited = await f.send('patch', '/api/contacts/' + id, {
          version: 1,
          job_title: 'Sales Director',
        });
      expect(edited.status, edited.text).toBe(200);
      expect(edited.body.record.job_title).toBe('Sales Director');
      const archived = await f.send('post', '/api/contacts/' + id + '/archive', { version: 2 });
      expect(archived.status, archived.text).toBe(200);
      const list = await f.agent.get('/api/contacts?archived=true');
      expect(list.body.items.map((x: any) => x.id)).toContain(id);
    });
    it('company CRUD and company.created audit are real', async () => {
      const f = await fixture();
      const c = await f.send('post', '/api/companies', {
        name: 'Fictional Labs',
        owner_id: f.s.member_id,
      });
      expect(c.status, c.text).toBe(201);
      const u = await f.send('patch', '/api/companies/' + c.body.record.id, {
        version: 1,
        industry: 'Software',
      });
      expect(u.status, u.text).toBe(200);
      const a = await f.agent.get('/api/companies/' + c.body.record.id);
      expect(a.body.activities.some((x: any) => x.kind === 'company.created')).toBe(true);
      expect(
        (await f.send('post', '/api/companies/' + c.body.record.id + '/archive', { version: 2 }))
          .status,
      ).toBe(200);
    });
    it('active duplicate contact emails are rejected case-insensitively', async () => {
      const f = await fixture();
      const r = await f.send('post', '/api/contacts', {
        name: 'Duplicate',
        email: f.data.contacts[0].email.toUpperCase(),
        owner_id: f.s.member_id,
      });
      expect(r.status).toBe(409);
    });
    it('search, filtering and pagination happen before slicing', async () => {
      const f = await fixture();
      const q = await f.agent.get('/api/contacts?search=Riley&pageSize=1');
      expect(q.body.total).toBe(1);
      expect(q.body.items[0].name).toBe('Riley Park');
      const p = await f.agent.get('/api/contacts?page=2&pageSize=2');
      expect(p.body.total).toBe(6);
      expect(p.body.items.length).toBe(2);
      const o = await f.agent.get('/api/tasks?overdue=true&pageSize=1');
      expect(o.body.total).toBe(3);
      expect(o.body.items.length).toBe(1);
    });
    it('viewer cannot create, edit, move, add note or manage team', async () => {
      const f = await fixture('viewer');
      expect(
        (await f.send('post', '/api/companies', { name: 'No', owner_id: f.s.member_id })).status,
      ).toBe(403);
      expect(
        (
          await f.send('patch', '/api/contacts/' + f.data.contacts[0].id, {
            version: 1,
            name: 'No',
          })
        ).status,
      ).toBe(403);
      expect(
        (
          await f.send('post', '/api/deals/' + f.data.deals[0].id + '/stage', {
            stage: 'won',
            version: 1,
          })
        ).status,
      ).toBe(403);
      expect(
        (await f.send('post', '/api/contacts/' + f.data.contacts[0].id + '/notes', { body: 'No' }))
          .status,
      ).toBe(403);
      expect(
        (
          await f.send('patch', '/api/team/' + f.data.members[0].id, {
            name: 'No',
            active: true,
            version: 1,
          })
        ).status,
      ).toBe(403);
    });
    it('representative edits own records but cannot assign another owner', async () => {
      const f = await fixture('representative'),
        own = f.data.contacts.find((c: any) => c.owner_id === f.s.member_id),
        other = f.data.contacts.find((c: any) => c.owner_id !== f.s.member_id);
      expect(
        (await f.send('patch', '/api/contacts/' + own.id, { version: 1, phone: '+1 202 555 0199' }))
          .status,
      ).toBe(200);
      expect(
        (await f.send('patch', '/api/contacts/' + other.id, { version: 1, name: 'Forbidden' }))
          .status,
      ).toBe(403);
      expect(
        (await f.send('patch', '/api/contacts/' + own.id, { version: 2, owner_id: other.owner_id }))
          .status,
      ).toBe(403);
    });
    it('invalid/negative deal data is rejected', async () => {
      const f = await fixture();
      const d = await deal(f);
      expect(
        (await f.send('post', '/api/deals/' + d.id + '/stage', { stage: 'banana', version: 1 }))
          .status,
      ).toBe(422);
      expect((await f.send('patch', '/api/deals/' + d.id, { version: 1, value: -1 })).status).toBe(
        422,
      );
      expect(
        (await f.send('patch', '/api/deals/' + d.id, { version: 1, expected_close: '2026-02-30' }))
          .status,
      ).toBe(422);
    });
    it('deal contact must belong to its company', async () => {
      const f = await fixture(),
        contact = f.data.contacts[0],
        company = f.data.companies.find((c: any) => c.id !== contact.company_id);
      const r = await f.send('post', '/api/deals', {
        title: 'Mismatched contact',
        company_id: company.id,
        contact_id: contact.id,
        owner_id: f.s.member_id,
        value: 100,
        expected_close: '2026-12-01',
      });
      expect(r.status).toBe(422);
      expect(r.body.error.code).toBe('CONTACT_COMPANY');
    });
    it('stage update, audit, closed date and outbox commit together', async () => {
      const f = await fixture(),
        d = await deal(f);
      const won = await f.send('post', '/api/deals/' + d.id + '/stage', {
        stage: 'won',
        version: 1,
      });
      expect(won.status, won.text).toBe(200);
      expect(won.body.record.closed_at).toBeTruthy();
      const b = (await f.agent.get('/api/bootstrap')).body;
      expect(b.reports.won_deals).toBe(5);
      expect(b.reports.won_value).toBe(35000);
      expect(b.automation.filter((e: any) => e.deal_id === d.id)).toHaveLength(1);
      expect(b.activities.some((e: any) => e.kind === 'deal.won' && e.deal_id === d.id)).toBe(true);
      expect(
        (await f.send('post', '/api/deals/' + d.id + '/stage', { stage: 'won', version: 2 })).body
          .unchanged,
      ).toBe(true);
    });
    it('lost requires reason and manager reopening clears closed date', async () => {
      const f = await fixture(),
        d = await deal(f);
      expect(
        (await f.send('post', '/api/deals/' + d.id + '/stage', { stage: 'lost', version: 1 }))
          .status,
      ).toBe(422);
      expect(
        (
          await f.send('post', '/api/deals/' + d.id + '/stage', {
            stage: 'lost',
            version: 1,
            lost_reason: 'Timing mismatch',
          })
        ).body.record.lost_reason,
      ).toBe('Timing mismatch');
      const r = await f.send('post', '/api/deals/' + d.id + '/stage', {
        stage: 'qualified',
        version: 2,
      });
      expect(r.body.record.closed_at).toBeNull();
    });
    it('concurrent edits have exactly one winner and one conflict', async () => {
      const f = await fixture(),
        d = await deal(f);
      const rs = await Promise.all([
        f.send('patch', '/api/deals/' + d.id, { version: 1, next_action: 'Action A' }),
        f.send('patch', '/api/deals/' + d.id, { version: 1, next_action: 'Action B' }),
      ]);
      expect(rs.map((x) => x.status).sort()).toEqual([200, 409]);
      expect((await f.agent.get('/api/deals/' + d.id)).body.record.version).toBe(2);
    });
    it('task lifecycle records completion and removes overdue count', async () => {
      const f = await fixture();
      const c = await f.send('post', '/api/tasks', {
        title: 'Overdue integration task',
        due_at: '2020-01-01T00:00:00Z',
        owner_id: f.s.member_id,
      });
      expect(c.status, c.text).toBe(201);
      const id = c.body.record.id;
      expect(
        (await f.send('patch', '/api/tasks/' + id, { version: 1, status: 'in_progress' })).status,
      ).toBe(200);
      const r = await f.send('patch', '/api/tasks/' + id, { version: 2, status: 'completed' });
      expect(r.status, r.text).toBe(200);
      expect(r.body.record.completed_at).toBeTruthy();
      const b = (await f.agent.get('/api/bootstrap')).body;
      expect(b.reports.overdue_tasks).toBe(3);
      expect(b.activities.some((a: any) => a.kind === 'task.completed' && a.entity_id === id)).toBe(
        true,
      );
    });
    it('archives protect active relations and incomplete tasks', async () => {
      const f = await fixture();
      expect(
        (
          await f.send('post', '/api/companies/' + f.data.companies[0].id + '/archive', {
            version: 1,
          })
        ).status,
      ).toBe(409);
      const d = await deal(f);
      expect((await f.send('post', '/api/deals/' + d.id + '/archive', { version: 1 })).status).toBe(
        409,
      );
    });
    it('notes persist and appear on linked deal timeline', async () => {
      const f = await fixture(),
        d = await deal(f);
      expect(
        (
          await f.send('post', '/api/deals/' + d.id + '/notes', {
            body: 'Confirmed fictional scope.',
          })
        ).status,
      ).toBe(201);
      const r = (await f.agent.get('/api/deals/' + d.id)).body;
      expect(r.notes[0].body).toBe('Confirmed fictional scope.');
      expect(r.activities[0].kind).toBe('note.added');
    });
    it('manager changes team, but cannot deactivate the manager', async () => {
      const f = await fixture(),
        m = f.data.members.find((x: any) => x.role === 'viewer');
      expect(
        (
          await f.send('patch', '/api/team/' + m.id, {
            name: 'Jordan Demo',
            active: false,
            version: 1,
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await f.send('patch', '/api/team/' + f.s.member_id, {
            name: 'Maya',
            active: false,
            version: 1,
          })
        ).status,
      ).toBe(422);
    });
    it('CSRF, Origin, JSON and request-size protections fail closed', async () => {
      const f = await fixture();
      expect((await f.agent.post('/api/companies').set('Origin', origin).send({})).status).toBe(
        403,
      );
      expect(
        (
          await f.agent
            .post('/api/companies')
            .set('Origin', 'https://evil.example')
            .set('X-CSRF-Token', f.s.csrf)
            .send({})
        ).status,
      ).toBe(403);
      expect((await f.send('post', '/api/companies', { notes: 'a'.repeat(40000) })).status).toBe(
        413,
      );
      const bad = await f.agent
        .post('/api/companies')
        .set('Origin', origin)
        .set('Content-Type', 'application/json')
        .send('{invalid');
      expect(bad.status).toBe(400);
    });
    it('n8n claim and receipt are idempotent', async () => {
      const f = await fixture(),
        d = await deal(f);
      await f.send('post', '/api/deals/' + d.id + '/stage', { stage: 'won', version: 1 });
      const e = (await f.agent.get('/api/bootstrap')).body.automation[0],
        body = { eventId: e.id, workspaceId: f.s.workspace_id },
        internal = (path: string, payload: any) =>
          request(app)
            .post('/internal/automation/' + path)
            .set('X-Automation-Secret', secret)
            .send(payload);
      const claims = await Promise.all([internal('claim', body), internal('claim', body)]);
      expect(claims.filter((r) => r.body.claimed)).toHaveLength(1);
      const claim = claims.find((r) => r.body.claimed)!.body;
      expect(claim.text).toContain('Integration opportunity');
      const receipt = { ...body, claim: claim.claim, delivered: true, receipt: 'test-receipt' };
      expect((await internal('complete', receipt)).status).toBe(200);
      expect((await internal('complete', receipt)).body.duplicate).toBe(true);
      const b = (await f.agent.get('/api/bootstrap')).body;
      expect(b.automation[0].status).toBe('delivered');
      expect(b.automation[0].claim_token).toBeUndefined();
    });
    it('expired in-flight delivery becomes uncertain and is not resent', async () => {
      const f = await fixture(),
        d = await deal(f);
      await f.send('post', '/api/deals/' + d.id + '/stage', { stage: 'won', version: 1 });
      const id = (await f.agent.get('/api/bootstrap')).body.automation[0].id;
      await transaction(pool, f.s.workspace_id, async (c: any) =>
        c.query(
          "UPDATE automation_events SET status='processing',claimed_at=now()-interval '3 minutes' WHERE id=$1",
          [id],
        ),
      );
      let ownCalls = 0;
      await dispatchOutbox(pool, {
        webhook: 'http://n8n.test',
        secret,
        fetcher: async (_url: any, init: any) => {
          if (JSON.parse(init.body).workspaceId === f.s.workspace_id) ownCalls++;
          return new Response('{}');
        },
      });
      expect(ownCalls).toBe(0);
      expect((await f.agent.get('/api/bootstrap')).body.automation[0].status).toBe('uncertain');
    });
    it('SSE receives a committed database event without reload', async () => {
      const f = await fixture(),
        abort = new AbortController();
      const stream = await fetch(base + '/api/events', {
        headers: { Cookie: f.cookie },
        signal: abort.signal,
      });
      expect(stream.headers.get('content-type')).toContain('text/event-stream');
      const reader = stream.body!.getReader();
      await reader.read();
      const d = await deal(f);
      const a = (await f.agent.get('/api/bootstrap')).body.activities.find(
        (a: any) => a.entity_id === d.id,
      );
      let received = '';
      const timeout = setTimeout(() => abort.abort(), 3000);
      try {
        while (!received.includes('id: ' + a.id + '\n')) {
          const got = await reader.read();
          if (got.done) break;
          received += new TextDecoder().decode(got.value);
        }
        expect(received).toContain('id: ' + a.id + '\n');
        expect(received).toContain('event: sync');
      } finally {
        clearTimeout(timeout);
      }
      abort.abort();
      await reader.cancel().catch(() => {});
    });
    it('logout invalidates the session', async () => {
      const f = await fixture();
      expect((await f.send('post', '/api/session/logout', {})).status).toBe(200);
      expect((await f.agent.get('/api/session')).status).toBe(401);
    });
  },
);
