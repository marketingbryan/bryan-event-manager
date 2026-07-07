// Shared auth helpers. Not a routable endpoint (prefixed with underscore).
import { query, ensureAuthSchema } from './_db.js';

/**
 * Authenticate a request by checking the Authorization: Bearer <token> header.
 * Returns the user object { id, email, role } or null.
 */
export async function authenticate(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  await ensureAuthSchema();
  const { rows } = await query(
    'SELECT id, email, role FROM users WHERE session_token = $1 AND active = TRUE',
    [token]
  );
  return rows[0] || null;
}

/**
 * Require authentication. Returns user or sends 401 and returns null.
 */
export async function requireAuth(req, res) {
  const user = await authenticate(req);
  if (!user) {
    res.status(401).json({ ok: false, error: 'Authentication required' });
    return null;
  }
  return user;
}

/**
 * Require superadmin role. Returns user or sends 401/403 and returns null.
 */
export async function requireSuperAdmin(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return null;
  if (user.role !== 'superadmin') {
    res.status(403).json({ ok: false, error: 'Superadmin access required' });
    return null;
  }
  return user;
}
