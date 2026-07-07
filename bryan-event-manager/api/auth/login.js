// POST { email } → if email is in users table and active, create session token and return it
import crypto from 'crypto';
import { query, ensureAuthSchema, normalizeEmail, setCors } from '../_db.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await ensureAuthSchema();
    const email = normalizeEmail(req.body?.email);
    if (!email || !email.includes('@')) {
      return res.status(400).json({ ok: false, error: 'Valid email required' });
    }

    const { rows } = await query(
      'SELECT id, email, role FROM users WHERE email = $1 AND active = TRUE',
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ ok: false, error: 'Email not authorized' });
    }

    const user = rows[0];
    const sessionToken = crypto.randomBytes(32).toString('hex');
    await query('UPDATE users SET session_token = $1 WHERE id = $2', [sessionToken, user.id]);

    return res.status(200).json({
      ok: true,
      sessionToken,
      user: { email: user.email, role: user.role },
    });
  } catch (err) {
    console.error('login error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
