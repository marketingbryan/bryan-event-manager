// POST { email } → add a new admin (superadmin only)
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
    if (!email || !email.includes('@')) {
      return res.status(400).json({ ok: false, error: 'Valid email required' });
    }

    // Check if already exists
    const existing = await query('SELECT id, active, role FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      if (existing.rows[0].active) {
        return res.status(409).json({ ok: false, error: 'User already exists' });
      }
      // Reactivate
      await query(
        'UPDATE users SET active = TRUE, role = $1, created_by = $2 WHERE email = $3',
        ['admin', superadmin.email, email]
      );
    } else {
      await query(
        'INSERT INTO users (email, role, created_by) VALUES ($1, $2, $3)',
        [email, 'admin', superadmin.email]
      );
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('admin add error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
