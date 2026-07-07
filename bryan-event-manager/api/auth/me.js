// GET → return current user info from session token
import { setCors } from '../_db.js';
import { requireAuth } from '../_auth.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const user = await requireAuth(req, res);
  if (!user) return;

  return res.status(200).json({ ok: true, user: { email: user.email, role: user.role } });
}
