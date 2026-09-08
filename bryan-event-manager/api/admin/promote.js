// POST { email } → promote a hostess to superadmin (superadmin only)
import { query, ensureAuthSchema, normalizeEmail, setCors } from '../_db.js';
import { requireSuperAdmin } from '../_auth.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const superadmin = await requireSuperAdmin(req, res);
  if (!superadmin) return;

  try {
    await ensureAuthSchema();
    const email = normalizeEmail(req.body?.email);
    if (!email) {
      return res.status(400).json({ ok: false, error: 'Email required' });
    }

    const target = await query('SELECT id, role, active FROM users WHERE email = $1', [email]);
    if (target.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }
    if (!target.rows[0].active) {
      return res.status(400).json({ ok: false, error: 'User is inactive' });
    }
    if (target.rows[0].role === 'superadmin') {
      return res.status(409).json({ ok: false, error: 'Already a superadmin' });
    }

    await query('UPDATE users SET role = $1 WHERE email = $2', ['superadmin', email]);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('admin promote error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
