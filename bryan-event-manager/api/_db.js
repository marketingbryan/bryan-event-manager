// Shared database helper. Not a routable endpoint (prefixed with underscore).
import pkg from 'pg';
const { Pool } = pkg;

let pool;

export function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
    });
  }
  return pool;
}

export async function query(text, params) {
  const client = await getPool().connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

// Initial superadmin emails (seeded on first run)
const SEED_SUPERADMINS = [
  'cdp@vidfirekill.com',
  'davide.berardino@bryan.it',
  'max@bryan.it',
  'ggi@vidfirekill.com',
];

export async function ensureSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS participants (
      id SERIAL PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      company TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      rsvp TEXT NOT NULL DEFAULT 'Invited',
      checked_in BOOLEAN NOT NULL DEFAULT FALSE,
      checked_in_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_participants_email ON participants (LOWER(email));`);
  await query(`ALTER TABLE participants ADD COLUMN IF NOT EXISTS company TEXT NOT NULL DEFAULT '';`);
  await query(`ALTER TABLE participants ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT '';`);
  await query(`ALTER TABLE participants ADD COLUMN IF NOT EXISTS rsvp TEXT NOT NULL DEFAULT 'Invited';`);
  await query(`ALTER TABLE participants ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT '';`);
}

export async function ensureAuthSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL DEFAULT 'hostess',
      session_token TEXT,
      magic_token TEXT,
      magic_token_expires TIMESTAMPTZ,
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      active BOOLEAN DEFAULT TRUE
    );
  `);
  // Migration: add magic_token columns if missing
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS magic_token TEXT;`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS magic_token_expires TIMESTAMPTZ;`);
  // Migration: rename role 'admin' → 'hostess' for existing rows
  await query(`UPDATE users SET role = 'hostess' WHERE role = 'admin';`);
  // Seed superadmins if users table is empty
  const { rowCount } = await query('SELECT 1 FROM users LIMIT 1');
  if (rowCount === 0) {
    for (const email of SEED_SUPERADMINS) {
      await query(
        'INSERT INTO users (email, role, created_by) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING',
        [email, 'superadmin', 'system']
      );
    }
  }
}

export function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}
