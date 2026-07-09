// POST { token } → verify magic link token, create session, return sessionToken + user
import crypto from 'crypto';
import { query, ensureAuthSchema, setCors } from '../_db.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await ensureAuthSchema();
    const token = (req.body?.token || '').trim();
    if (!token) {
      return res.status(400).json({ ok: false, error: 'Token required' });
    }

    // Find user with this magic token
    const { rows } = await query(
      'SELECT id, email, role, magic_token_expires FROM users WHERE magic_token = $1 AND active = TRUE',
      [token]
    );

    if (rows.length === 0) {
      return res.status(401).json({ ok: false, error: 'Invalid or expired link' });
    }

    const user = rows[0];

    // Check expiry
    if (user.magic_token_expires && new Date(user.magic_token_expires) < new Date()) {
      // Clear expired token
      await query('UPDATE users SET magic_token = NULL, magic_token_expires = NULL WHERE id = $1', [user.id]);
      return res.status(401).json({ ok: false, error: 'Link expired — please request a new one' });
    }

    // Generate session token and clear magic token (single-use)
    const sessionToken = crypto.randomBytes(32).toString('hex');
    await query(
      'UPDATE users SET session_token = $1, magic_token = NULL, magic_token_expires = NULL WHERE id = $2',
      [sessionToken, user.id]
    );

    return res.status(200).json({
      ok: true,
      sessionToken,
      user: { email: user.email, role: user.role },
    });
  } catch (err) {
    console.error('verify error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
