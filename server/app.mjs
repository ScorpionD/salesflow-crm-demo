import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { randomBytes, createHash, timingSafeEqual, randomUUID } from 'node:crypto';
import { z } from 'zod';
import pino from 'pino';
import {
  AppError,
  assert,
  checkWrite,
  checkVersion,
  parse,
  schemas,
  stages,
  roles,
  stageSchema,
  stageChange,
  reports,
} from './domain.mjs';
import { transaction, insert, update, createWorkspace } from './db.mjs';
import { mountAutomation } from './automation.mjs';

const hash = (s) => createHash('sha256').update(s).digest('hex');
const token = () => randomBytes(32).toString('hex');
const equal = (a, b) =>
  typeof a === 'string' &&
  typeof b === 'string' &&
  a.length === b.length &&
  timingSafeEqual(Buffer.from(a), Buffer.from(b));
const uuid = z.string().uuid();
const limits = { companies: 50, contacts: 100, deals: 80, tasks: 120 };
const types = Object.keys(limits);
const recordLabel = (r) => r.title || r.name;
const singular = { companies: 'company', contacts: 'contact', deals: 'deal', tasks: 'task' };
export function createApp({
  pool,
  origin = 'http://localhost:5173',
  originSecret = '',
  automationSecret = '',
  production = false,
  test = false,
  logger = pino({ level: test ? 'silent' : 'info' }),
}) {
  if (production && (!originSecret || !automationSecret))
    throw new Error('Production secrets are required.');
  const app = express(),
    streams = new Map();
  app.disable('x-powered-by');
  if (production) app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false }), cookieParser());
  app.use((req, res, next) => {
    req.requestId = randomUUID();
    res.set({ 'X-Request-Id': req.requestId, 'Cache-Control': 'no-store' });
    const started = Date.now();
    res.on('finish', () =>
      logger.info(
        {
          id: req.requestId,
          method: req.method,
          path: req.path,
          status: res.statusCode,
          ms: Date.now() - started,
        },
        'request',
      ),
    );
    next();
  });
  app.use((req, res, next) => {
    if (req.path.startsWith('/internal/automation/')) {
      if (!equal(req.get('X-Automation-Secret'), automationSecret) || !automationSecret)
        return next(new AppError(403, 'DENIED', 'Access denied.'));
      return next();
    }
    if (production && !equal(req.get('X-Origin-Secret'), originSecret))
      return next(new AppError(403, 'DENIED', 'Access denied.'));
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('Origin') !== origin)
      return next(new AppError(403, 'ORIGIN', 'Request origin is not allowed.'));
    next();
  });
  app.use(express.json({ limit: '32kb' }));
  app.use((req, res, next) => {
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      (!req.body || typeof req.body !== 'object' || Array.isArray(req.body))
    )
      return next(new AppError(422, 'VALIDATION', 'Send a JSON object.'));
    next();
  });
  if (!test)
    app.use(
      '/api',
      rateLimit({
        windowMs: 60000,
        limit: 180,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        message: {
          error: { code: 'RATE_LIMITED', message: 'Please wait a minute before trying again.' },
        },
      }),
    );
  const entryLimit = test
    ? (req, res, next) => next()
    : rateLimit({
        windowMs: 3600000,
        limit: 6,
        skip: (req) => Boolean(req.existingSession),
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        message: {
          error: {
            code: 'DEMO_LIMIT',
            message: 'Too many new demo workspaces. Return to your existing session or try later.',
          },
        },
      });
  const cookie = {
    httpOnly: true,
    secure: production,
    sameSite: 'lax',
    path: '/api',
    maxAge: 86400000,
  };
  const cookieName = 'salesflow_session';
  async function findSession(req) {
    const t = req.cookies[cookieName];
    if (!t || !/^\w{64}$/.test(t)) return null;
    return (
      (
        await pool.query(
          'SELECT s.* FROM sessions s JOIN workspaces w ON w.id=s.workspace_id WHERE s.token_hash=$1 AND s.expires_at>now() AND w.expires_at>now()',
          [hash(t)],
        )
      ).rows[0] || null
    );
  }
  async function actorFor(s) {
    return transaction(pool, s.workspace_id, async (c) => {
      const r = await c.query(
        'SELECT m.id AS member_id,m.role,m.active,u.name FROM workspace_members m JOIN users u ON u.id=m.user_id AND u.workspace_id=m.workspace_id WHERE m.workspace_id=$1 AND m.id=$2',
        [s.workspace_id, s.member_id],
      );
      assert(
        r.rows[0]?.active,
        403,
        'INACTIVE_MEMBER',
        'This demo team member is inactive. Switch to the manager role.',
      );
      return {
        ...r.rows[0],
        workspace_id: s.workspace_id,
        csrf: s.csrf_token,
        expires_at: s.expires_at,
        token_hash: s.token_hash,
      };
    });
  }
  async function requireSession(req, res, next) {
    try {
      const s = await findSession(req);
      assert(s, 401, 'SESSION_REQUIRED', 'Start a private demo workspace to continue.');
      req.actor = await actorFor(s);
      if (!['GET', 'HEAD'].includes(req.method))
        assert(
          equal(req.get('X-CSRF-Token'), s.csrf_token),
          403,
          'CSRF',
          'Refresh the page before making changes.',
        );
      next();
    } catch (e) {
      next(e);
    }
  }
  const tx = (actor, fn, write = false) =>
    transaction(pool, actor.workspace_id, (c) => fn(c, actor), { write });
  async function members(c, w) {
    return (
      await c.query(
        "SELECT m.*,u.name,u.email FROM workspace_members m JOIN users u ON u.id=m.user_id AND u.workspace_id=m.workspace_id WHERE m.workspace_id=$1 ORDER BY CASE m.role WHEN 'manager' THEN 1 WHEN 'representative' THEN 2 ELSE 3 END",
        [w],
      )
    ).rows;
  }
  async function record(c, kind, id, w) {
    assert(types.includes(kind), 404, 'NOT_FOUND', 'Record not found.');
    parse(uuid, id);
    const r = (await c.query(`SELECT * FROM ${kind} WHERE workspace_id=$1 AND id=$2`, [w, id]))
      .rows[0];
    assert(r, 404, 'NOT_FOUND', 'Record not found.');
    return r;
  }
  async function relation(c, kind, id, w) {
    if (!id) return null;
    const r = await record(c, kind, id, w);
    assert(!r.archived, 422, 'ARCHIVED_RELATION', 'Select an active related record.');
    return r;
  }
  async function validateRelations(c, kind, data, a) {
    if (a.role === 'representative')
      assert(
        data.owner_id === a.member_id,
        403,
        'ASSIGNMENT',
        'Representatives can assign records only to themselves.',
      );
    const m = (
      await c.query(
        "SELECT * FROM workspace_members WHERE workspace_id=$1 AND id=$2 AND active AND role<>'viewer'",
        [a.workspace_id, data.owner_id],
      )
    ).rows[0];
    assert(
      m,
      422,
      'INVALID_OWNER',
      'Choose an active manager or representative in this workspace.',
    );
    const company = await relation(c, 'companies', data.company_id, a.workspace_id),
      contact = await relation(c, 'contacts', data.contact_id, a.workspace_id);
    await relation(c, 'deals', data.deal_id, a.workspace_id);
    if (kind === 'deals' && contact)
      assert(
        contact.company_id === company.id,
        422,
        'CONTACT_COMPANY',
        'The selected contact must belong to the deal company.',
      );
  }
  async function activity(c, a, kind, type, r, summary, detail = {}) {
    const ctx = {
      company_id: type === 'companies' ? r.id : r.company_id || null,
      contact_id: type === 'contacts' ? r.id : r.contact_id || null,
      deal_id: type === 'deals' ? r.id : r.deal_id || null,
    };
    if (type === 'tasks' && r.deal_id) {
      const d = await record(c, 'deals', r.deal_id, a.workspace_id);
      ctx.company_id = d.company_id;
      ctx.contact_id = d.contact_id;
    }
    const e = await insert(c, 'activities', {
      workspace_id: a.workspace_id,
      member_id: a.member_id,
      kind,
      entity_type: type,
      entity_id: r.id,
      ...ctx,
      summary,
      detail,
    });
    await c.query('SELECT pg_notify($1,$2)', [
      'salesflow_changes',
      JSON.stringify({ workspace: a.workspace_id, id: String(e.id) }),
    ]);
    return e;
  }
  async function data(c, a) {
    const w = a.workspace_id,
      ms = await members(c, w),
      out = {};
    for (const kind of types)
      out[kind] = (
        await c.query(
          `SELECT * FROM ${kind} WHERE workspace_id=$1 ORDER BY created_at DESC,id LIMIT 200`,
          [w],
        )
      ).rows;
    out.activities = (
      await c.query(
        'SELECT a.*,u.name AS actor_name FROM activities a LEFT JOIN workspace_members m ON m.id=a.member_id AND m.workspace_id=a.workspace_id LEFT JOIN users u ON u.id=m.user_id AND u.workspace_id=m.workspace_id WHERE a.workspace_id=$1 ORDER BY a.id DESC LIMIT 100',
        [w],
      )
    ).rows;
    out.automation = (
      await c.query(
        'SELECT id,deal_id,status,attempts,error_code,created_at,delivered_at FROM automation_events WHERE workspace_id=$1 ORDER BY created_at DESC LIMIT 50',
        [w],
      )
    ).rows;
    return { ...out, members: ms, stages, reports: reports(out.deals, out.tasks, ms) };
  }
  app.get('/api/health', (req, res) =>
    res.json({ status: 'ok', service: 'salesflow-crm', realtime: 'SSE' }),
  );
  app.post(
    '/api/session',
    async (req, res, next) => {
      try {
        req.existingSession = await findSession(req);
        next();
      } catch (e) {
        next(e);
      }
    },
    entryLimit,
    async (req, res) => {
      const { role } = parse(z.object({ role: z.enum(roles) }).strict(), req.body);
      if (req.existingSession) {
        assert(
          equal(req.get('X-CSRF-Token'), req.existingSession.csrf_token),
          403,
          'CSRF',
          'Refresh the page before switching roles.',
        );
        const session = await actorFor(req.existingSession);
        delete session.token_hash;
        return res.json({ session });
      }
      const result = await createWorkspace(pool),
        raw = token(),
        csrf = token();
      const member = result.members.find((m) => m.role === role);
      await pool.query(
        'INSERT INTO sessions(token_hash,workspace_id,member_id,csrf_token,expires_at) VALUES($1,$2,$3,$4,$5)',
        [hash(raw), result.workspace.id, member.id, csrf, result.workspace.expires_at],
      );
      res.cookie(cookieName, raw, cookie);
      res
        .status(201)
        .json({
          session: await actorFor({
            workspace_id: result.workspace.id,
            member_id: member.id,
            csrf_token: csrf,
            expires_at: result.workspace.expires_at,
          }),
        });
    },
  );
  app.get('/api/session', requireSession, (req, res) => {
    const { token_hash, ...session } = req.actor;
    res.json({ session });
  });
  // Role switching is an explicit public-demo persona switch, confined to the same private dataset.
  app.post('/api/session/role', async (req, res) => {
    const s = await findSession(req);
    assert(s, 401, 'SESSION_REQUIRED', 'Start a demo first.');
    assert(
      equal(req.get('X-CSRF-Token'), s.csrf_token),
      403,
      'CSRF',
      'Refresh before switching roles.',
    );
    const { role } = parse(z.object({ role: z.enum(roles) }).strict(), req.body);
    const member = await transaction(
      pool,
      s.workspace_id,
      async (c) =>
        (
          await c.query(
            'SELECT id FROM workspace_members WHERE workspace_id=$1 AND role=$2 AND active',
            [s.workspace_id, role],
          )
        ).rows[0],
    );
    assert(
      member,
      403,
      'INACTIVE_MEMBER',
      'This demo role is inactive. The manager can reactivate it.',
    );
    await pool.query('UPDATE sessions SET member_id=$1 WHERE token_hash=$2', [
      member.id,
      s.token_hash,
    ]);
    const a = await actorFor({ ...s, member_id: member.id });
    delete a.token_hash;
    res.json({ session: a });
    push(s.workspace_id, 'role');
  });
  app.post('/api/session/logout', requireSession, async (req, res) => {
    await pool.query('DELETE FROM sessions WHERE token_hash=$1', [req.actor.token_hash]);
    res.clearCookie(cookieName, cookie);
    res.json({ ok: true });
    push(req.actor.workspace_id, 'session');
  });
  app.get('/api/bootstrap', requireSession, async (req, res) => {
    const { token_hash, ...session } = req.actor;
    res.json({ session, ...(await tx(req.actor, data)) });
  });
  app.get('/api/reports', requireSession, async (req, res) =>
    res.json(await tx(req.actor, async (c, a) => (await data(c, a)).reports)),
  );
  app.get('/api/activity', requireSession, async (req, res) =>
    res.json({ items: await tx(req.actor, async (c, a) => (await data(c, a)).activities) }),
  );
  app.get('/api/events', requireSession, async (req, res) => {
    const a = req.actor,
      key = a.workspace_id,
      set = streams.get(key) || new Set();
    assert(
      set.size < 8 && [...streams.values()].reduce((n, x) => n + x.size, 0) < 150,
      429,
      'STREAM_LIMIT',
      'Close an extra CRM tab to reconnect.',
    );
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    res.write('retry: 2000\n\n');
    const last = await tx(
      a,
      async (c) =>
        (await c.query('SELECT max(id) AS id FROM activities WHERE workspace_id=$1', [key])).rows[0]
          .id || 0,
    );
    res.write(
      `id: ${last}\nevent: sync\ndata: ${JSON.stringify({ reason: 'connected', lastEventId: req.get('Last-Event-ID') || null })}\n\n`,
    );
    set.add(res);
    streams.set(key, set);
    const timer = setInterval(() => {
      if (Date.now() >= new Date(a.expires_at).getTime()) return res.end();
      res.write(': heartbeat\n\n');
    }, 15000);
    timer.unref?.();
    res.on('close', () => {
      clearInterval(timer);
      set.delete(res);
      if (!set.size) streams.delete(key);
    });
  });
  function push(workspace, id) {
    for (const res of streams.get(workspace) || []) {
      if (res.writableLength > 65536) {
        res.end();
        continue;
      }
      res.write(`id: ${id}\nevent: sync\ndata: {"reason":"changed"}\n\n`);
    }
  }
  app.locals.push = push;
  app.locals.closeStreams = () => {
    for (const set of streams.values()) for (const res of set) res.end();
    streams.clear();
  };
  for (const kind of types) {
    app.get('/api/' + kind, requireSession, async (req, res) => {
      const q = parse(
        z
          .object({
            search: z.string().max(100).default(''),
            page: z.coerce.number().int().min(1).max(1000).default(1),
            pageSize: z.coerce.number().int().min(1).max(50).default(10),
            status: z.string().max(30).default(''),
            owner: z.union([uuid, z.literal('')]).default(''),
            archived: z.enum(['true', 'false']).default('false'),
            overdue: z.enum(['true', 'false']).default('false'),
          })
          .strict(),
        req.query,
      );
      res.json(
        await tx(req.actor, async (c, a) => {
          const vals = [a.workspace_id],
            parts = ['workspace_id=$1'];
          if (kind !== 'tasks') {
            vals.push(q.archived === 'true');
            parts.push('archived=$' + vals.length);
          }
          if (q.search) {
            vals.push('%' + q.search.replace(/[\\%_]/g, '\\$&') + '%');
            parts.push(
              (kind === 'companies' || kind === 'contacts' ? 'name' : 'title') +
                ' ILIKE $' +
                vals.length,
            );
          }
          if (q.owner) {
            vals.push(q.owner);
            parts.push('owner_id=$' + vals.length);
          }
          if (q.status && kind !== 'companies') {
            vals.push(q.status);
            parts.push((kind === 'deals' ? 'stage' : 'status') + '=$' + vals.length);
          }
          if (kind === 'tasks' && q.overdue === 'true')
            parts.push("status<>'completed' AND due_at<now()");
          const where = parts.join(' AND '),
            count = Number(
              (await c.query(`SELECT count(*) FROM ${kind} WHERE ${where}`, vals)).rows[0].count,
            );
          vals.push(q.pageSize, (q.page - 1) * q.pageSize);
          return {
            items: (
              await c.query(
                `SELECT * FROM ${kind} WHERE ${where} ORDER BY created_at DESC,id LIMIT $${vals.length - 1} OFFSET $${vals.length}`,
                vals,
              )
            ).rows,
            total: count,
            page: q.page,
            pageSize: q.pageSize,
          };
        }),
      );
    });
    app.get('/api/' + kind + '/:id', requireSession, async (req, res) =>
      res.json(
        await tx(req.actor, async (c, a) => {
          const r = await record(c, kind, req.params.id, a.workspace_id),
            column = {
              companies: 'company_id',
              contacts: 'contact_id',
              deals: 'deal_id',
              tasks: 'entity_id',
            }[kind];
          return {
            record: r,
            activities: (
              await c.query(
                `SELECT * FROM activities WHERE workspace_id=$1 AND (${column}=$2 OR (entity_type=$3 AND entity_id=$2)) ORDER BY id DESC LIMIT 100`,
                [a.workspace_id, r.id, kind],
              )
            ).rows,
            notes:
              kind === 'tasks'
                ? []
                : (
                    await c.query(
                      `SELECT n.*,u.name AS author FROM notes n JOIN workspace_members m ON m.id=n.member_id AND m.workspace_id=n.workspace_id JOIN users u ON u.id=m.user_id AND u.workspace_id=m.workspace_id WHERE n.workspace_id=$1 AND n.${column}=$2 ORDER BY n.created_at DESC`,
                      [a.workspace_id, r.id],
                    )
                  ).rows,
          };
        }),
      ),
    );
    app.post('/api/' + kind, requireSession, async (req, res) =>
      res.status(201).json(
        await tx(
          req.actor,
          async (c, a) => {
            checkWrite(a);
            const input = parse(schemas[kind], req.body);
            await validateRelations(c, kind, input, a);
            const count = Number(
              (
                await c.query(`SELECT count(*) FROM ${kind} WHERE workspace_id=$1`, [
                  a.workspace_id,
                ])
              ).rows[0].count,
            );
            assert(
              count < limits[kind],
              422,
              'WORKSPACE_LIMIT',
              `This temporary demo allows ${limits[kind]} ${kind}.`,
            );
            const r = await insert(c, kind, {
              workspace_id: a.workspace_id,
              ...input,
              ...(kind === 'tasks'
                ? { completed_at: input.status === 'completed' ? new Date() : null }
                : {}),
            });
            await activity(
              c,
              a,
              singular[kind] + '.created',
              kind,
              r,
              `${recordLabel(r)} created.`,
            );
            return { record: r };
          },
          true,
        ),
      ),
    );
    app.patch('/api/' + kind + '/:id', requireSession, async (req, res) =>
      res.json(
        await tx(
          req.actor,
          async (c, a) => {
            const r = await record(c, kind, req.params.id, a.workspace_id);
            checkWrite(a, r);
            assert(!r.archived, 409, 'ARCHIVED', 'Restore or use an active record before editing.');
            checkVersion(r, req.body.version);
            const { version, ...body } = req.body;
            const merged = Object.fromEntries(
              Object.keys(schemas[kind].shape || schemas[kind].def?.shape || {}).map((k) => [
                k,
                r[k],
              ]),
            );
            // Task schema has a refinement: its public field list remains explicit.
            if (kind === 'tasks')
              for (const k of [
                'title',
                'due_at',
                'owner_id',
                'company_id',
                'contact_id',
                'deal_id',
                'priority',
                'status',
              ])
                merged[k] = r[k] instanceof Date ? r[k].toISOString() : r[k];
            if (kind === 'deals') merged.value = Number(r.value);
            const input = parse(schemas[kind], { ...merged, ...body });
            await validateRelations(c, kind, input, a);
            if (kind === 'deals' && ['won', 'lost'].includes(r.stage))
              throw new AppError(
                409,
                'CLOSED_DEAL',
                'Reopen this deal before changing its business data.',
              );
            if (kind === 'contacts' && input.company_id !== r.company_id) {
              const linked = await c.query(
                'SELECT id FROM deals WHERE workspace_id=$1 AND contact_id=$2 LIMIT 1',
                [a.workspace_id, r.id],
              );
              assert(
                !linked.rowCount,
                409,
                'LINKED_CONTACT',
                'This contact belongs to existing deals; update the deal links before changing its company.',
              );
            }
            const changed = await update(c, kind, r.id, a.workspace_id, {
              ...input,
              ...(kind === 'tasks'
                ? {
                    completed_at:
                      input.status === 'completed' ? r.completed_at || new Date() : null,
                  }
                : {}),
            });
            const eventKind =
              kind === 'tasks' && input.status === 'completed' && r.status !== 'completed'
                ? 'task.completed'
                : singular[kind] + '.updated';
            await activity(
              c,
              a,
              eventKind,
              kind,
              changed,
              `${recordLabel(changed)} ${eventKind === 'task.completed' ? 'completed' : 'updated'}.`,
              { fields: Object.keys(body) },
            );
            if (r.owner_id !== input.owner_id)
              await activity(
                c,
                a,
                'assignment.changed',
                kind,
                changed,
                `${recordLabel(changed)} reassigned.`,
                { from: r.owner_id, to: input.owner_id },
              );
            return { record: changed };
          },
          true,
        ),
      ),
    );
    if (kind !== 'tasks')
      app.post('/api/' + kind + '/:id/archive', requireSession, async (req, res) =>
        res.json(
          await tx(
            req.actor,
            async (c, a) => {
              const input = parse(
                  z.object({ version: z.number().int().positive() }).strict(),
                  req.body,
                ),
                r = await record(c, kind, req.params.id, a.workspace_id);
              checkWrite(a, r);
              checkVersion(r, input.version);
              assert(!r.archived, 409, 'ARCHIVED', 'Record is already archived.');
              if (kind === 'deals')
                assert(
                  ['won', 'lost'].includes(r.stage),
                  409,
                  'OPEN_DEAL',
                  'Close the deal before archiving it.',
                );
              else {
                const col = kind === 'companies' ? 'company_id' : 'contact_id';
                const d = await c.query(
                  `SELECT id FROM deals WHERE workspace_id=$1 AND ${col}=$2 AND NOT archived AND stage NOT IN ('won','lost') LIMIT 1`,
                  [a.workspace_id, r.id],
                );
                assert(
                  !d.rowCount,
                  409,
                  'OPEN_DEALS',
                  'Close or reassign linked open deals before archiving.',
                );
                if (kind === 'companies') {
                  const ct = await c.query(
                    'SELECT id FROM contacts WHERE workspace_id=$1 AND company_id=$2 AND NOT archived LIMIT 1',
                    [a.workspace_id, r.id],
                  );
                  assert(
                    !ct.rowCount,
                    409,
                    'ACTIVE_CONTACTS',
                    'Archive or reassign linked contacts before archiving this company.',
                  );
                }
              }
              const taskColumn = {
                companies: 'company_id',
                contacts: 'contact_id',
                deals: 'deal_id',
              }[kind];
              const unfinished = await c.query(
                `SELECT id FROM tasks WHERE workspace_id=$1 AND ${taskColumn}=$2 AND status<>'completed' LIMIT 1`,
                [a.workspace_id, r.id],
              );
              assert(
                !unfinished.rowCount,
                409,
                'OPEN_TASKS',
                'Complete or reassign linked tasks before archiving.',
              );
              const changed = await update(c, kind, r.id, a.workspace_id, { archived: true });
              await activity(
                c,
                a,
                'record.archived',
                kind,
                changed,
                `${recordLabel(changed)} archived.`,
              );
              return { record: changed };
            },
            true,
          ),
        ),
      );
  }
  app.post('/api/deals/:id/stage', requireSession, async (req, res) =>
    res.json(
      await tx(
        req.actor,
        async (c, a) => {
          const input = parse(stageSchema, req.body),
            r = await record(c, 'deals', req.params.id, a.workspace_id);
          assert(!r.archived, 409, 'ARCHIVED', 'Archived deals cannot move stages.');
          const change = stageChange(a, r, input);
          if (!change) return { record: r, unchanged: true };
          await validateRelations(c, 'deals', r, a);
          const moved = await update(c, 'deals', r.id, a.workspace_id, change);
          const e = await activity(
            c,
            a,
            ['won', 'lost'].includes(input.stage) ? 'deal.' + input.stage : 'deal.stage_changed',
            'deals',
            moved,
            `${r.title} moved from ${r.stage} to ${input.stage}.`,
            { from: r.stage, to: input.stage, lost_reason: change.lost_reason },
          );
          if (input.stage === 'won') {
            const co = await record(c, 'companies', r.company_id, a.workspace_id),
              owner = (await members(c, a.workspace_id)).find((m) => m.id === r.owner_id);
            await insert(c, 'automation_events', {
              workspace_id: a.workspace_id,
              activity_id: e.id,
              deal_id: r.id,
              payload: {
                title: r.title,
                company: co.name,
                value: Number(r.value),
                currency: 'USD',
                owner: owner.name,
                timestamp: change.closed_at,
              },
            });
          }
          return { record: moved };
        },
        true,
      ),
    ),
  );
  app.post('/api/:kind/:id/notes', requireSession, async (req, res) =>
    res.status(201).json(
      await tx(
        req.actor,
        async (c, a) => {
          const kind = req.params.kind;
          assert(
            ['contacts', 'companies', 'deals'].includes(kind),
            404,
            'NOT_FOUND',
            'Record not found.',
          );
          const r = await record(c, kind, req.params.id, a.workspace_id);
          checkWrite(a, r);
          assert(!r.archived, 409, 'ARCHIVED', 'Notes cannot be added to archived records.');
          const { body } = parse(
            z.object({ body: z.string().trim().min(1).max(2000) }).strict(),
            req.body,
          );
          const count = Number(
            (await c.query('SELECT count(*) FROM notes WHERE workspace_id=$1', [a.workspace_id]))
              .rows[0].count,
          );
          assert(count < 300, 422, 'WORKSPACE_LIMIT', 'This demo allows 300 notes.');
          const column = { contacts: 'contact_id', companies: 'company_id', deals: 'deal_id' }[
            kind
          ];
          const note = await insert(c, 'notes', {
            workspace_id: a.workspace_id,
            member_id: a.member_id,
            [column]: r.id,
            body,
          });
          await activity(c, a, 'note.added', kind, r, `Note added to ${recordLabel(r)}.`);
          return { note };
        },
        true,
      ),
    ),
  );
  app.patch('/api/team/:id', requireSession, async (req, res) =>
    res.json(
      await tx(
        req.actor,
        async (c, a) => {
          assert(
            a.role === 'manager',
            403,
            'FORBIDDEN',
            'Only the sales manager can manage the demo team.',
          );
          const input = parse(
            z
              .object({
                name: z.string().trim().min(2).max(80),
                active: z.boolean(),
                version: z.number().int().positive(),
              })
              .strict(),
            req.body,
          );
          parse(uuid, req.params.id);
          const m = (await members(c, a.workspace_id)).find((m) => m.id === req.params.id);
          assert(m, 404, 'NOT_FOUND', 'Team member not found.');
          checkVersion(m, input.version);
          assert(
            m.role !== 'manager' || input.active,
            422,
            'MANAGER_REQUIRED',
            'Keep the demo manager active.',
          );
          if (!input.active) {
            const d = await c.query(
              "SELECT id FROM deals WHERE workspace_id=$1 AND owner_id=$2 AND NOT archived AND stage NOT IN ('won','lost') UNION ALL SELECT id FROM tasks WHERE workspace_id=$1 AND owner_id=$2 AND status<>'completed' LIMIT 1",
              [a.workspace_id, m.id],
            );
            assert(
              !d.rowCount,
              409,
              'ACTIVE_ASSIGNMENTS',
              'Reassign open deals and incomplete tasks before deactivating a member.',
            );
          }
          await c.query('UPDATE users SET name=$1 WHERE workspace_id=$2 AND id=$3', [
            input.name,
            a.workspace_id,
            m.user_id,
          ]);
          await c.query(
            'UPDATE workspace_members SET active=$1,version=version+1 WHERE workspace_id=$2 AND id=$3',
            [input.active, a.workspace_id, m.id],
          );
          await activity(
            c,
            a,
            'team.updated',
            'team',
            { id: m.id },
            `${input.name}'s demo team profile updated.`,
          );
          return { members: await members(c, a.workspace_id) };
        },
        true,
      ),
    ),
  );
  mountAutomation(app, pool, push);
  app.use((req, res) =>
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint not found.' } }),
  );
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    let status = err.status || 500,
      code = err.code || 'INTERNAL',
      message = err.message;
    if (err.type === 'entity.too.large') {
      status = 413;
      code = 'REQUEST_TOO_LARGE';
      message = 'Request must be 32 KB or smaller.';
    } else if (err instanceof SyntaxError && status === 400) {
      code = 'INVALID_JSON';
      message = 'Send valid JSON.';
    } else if (err.code === '23505') {
      status = 409;
      code = 'DUPLICATE';
      message = 'A record with these unique details already exists.';
    } else if (['23503', '23514', '22P02'].includes(err.code)) {
      status = 422;
      code = 'INVALID_DATA';
      message = 'Some record details or relationships are invalid.';
    }
    if (status >= 500) {
      logger.error({ id: req.requestId, code: err.code || 'INTERNAL' }, 'request failed');
      message = 'The service is temporarily unavailable. Please retry.';
      code = 'INTERNAL';
    }
    res
      .status(status)
      .json({ error: { code, message, fields: err.fields }, requestId: req.requestId });
  });
  return app;
}
