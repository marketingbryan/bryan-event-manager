// GET → list all users (superadmin only)
import { query, ensureAuthSchema, setCors } from '../_db.js';
import { requireSuperAdmin } from '../_auth.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const user = await requireSuperAdmin(req, res);
  if (!user) return;

  await ensureAuthSchema();
  const { rows } = await query(
    `SELECT id, email, role, created_by, created_at, active
     FROM users
     ORDER BY role DESC, created_at`
  );

  return res.status(200).json({ ok: true, users: rows });
}
