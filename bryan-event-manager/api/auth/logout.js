// POST → clear session token
import { query, setCors } from '../_db.js';
import { authenticate } from '../_auth.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await authenticate(req);
  if (user) {
    await query('UPDATE users SET session_token = NULL WHERE id = $1', [user.id]);
  }
  return res.status(200).json({ ok: true });
}
