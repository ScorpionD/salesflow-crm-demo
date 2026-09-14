import { readFile } from 'node:fs/promises';
import { makePool } from '../server/db.mjs';
const pool = makePool(process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL);
try {
  await pool.query(await readFile(new URL('../server/schema.sql', import.meta.url), 'utf8'));
  console.log('Schema version 1 ready.');
} finally {
  await pool.end();
}
