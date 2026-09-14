import { createApp } from './app.mjs';
import { makePool } from './db.mjs';
import { dispatchOutbox } from './automation.mjs';
const pool = makePool(process.env.DATABASE_URL),
  app = createApp({
    pool,
    origin: process.env.PUBLIC_ORIGIN || 'http://localhost:5173',
    originSecret: process.env.ORIGIN_SECRET,
    automationSecret: process.env.AUTOMATION_SECRET,
    production: process.env.NODE_ENV === 'production',
  });
const server = app.listen(Number(process.env.PORT || 4600), '0.0.0.0');
let listener,
  stopping = false,
  busy = false,
  reconnect;
async function listen() {
  try {
    listener = await pool.connect();
    await listener.query('LISTEN salesflow_changes');
    listener.on('notification', (m) => {
      try {
        const e = JSON.parse(m.payload);
        app.locals.push(e.workspace, e.id);
      } catch {}
    });
    listener.once('error', () => {
      listener.release(true);
      if (!stopping) reconnect = setTimeout(listen, 2000);
    });
  } catch {
    if (!stopping) reconnect = setTimeout(listen, 2000);
  }
}
await listen();
const tick = setInterval(async () => {
  if (busy) return;
  busy = true;
  try {
    await dispatchOutbox(pool, {
      webhook: process.env.N8N_WEBHOOK_URL,
      secret: process.env.AUTOMATION_SECRET,
      push: app.locals.push,
    });
  } catch {
    console.error(JSON.stringify({ event: 'outbox_scan_failed' }));
  } finally {
    busy = false;
  }
}, 2500);
const cleanup = setInterval(
  () =>
    pool
      .query('DELETE FROM workspaces WHERE expires_at<now()')
      .catch(() => console.error(JSON.stringify({ event: 'cleanup_failed' }))),
  60000,
);
async function stop() {
  stopping = true;
  clearInterval(tick);
  clearInterval(cleanup);
  clearTimeout(reconnect);
  app.locals.closeStreams();
  server.close();
  if (listener) {
    await listener.query('UNLISTEN *').catch(() => {});
    listener.release();
  }
  await pool.end();
}
process.once('SIGTERM', stop);
process.once('SIGINT', stop);
