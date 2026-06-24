// /api/update-rsvp
// POST body: { email, rsvp: 'Invited' | 'Registered' }
import { query, ensureSchema, setCors, normalizeEmail } from './_db.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await ensureSchema();
    const body = req.body || {};
    const email = normalizeEmail(body.email);
    const rsvp = body.rsvp === 'Registered' ? 'Registered' : 'Invited';

    if (!email) {
      return res.status(400).json({ ok: false, error: 'Email missing' });
    }

    const { rowCount, rows } = await query(
      `UPDATE participants SET rsvp = $1 WHERE LOWER(email) = $2
       RETURNING id, first_name, last_name, email, company, role, rsvp, checked_in, checked_in_at`,
      [rsvp, email]
    );

    if (rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'Participant not found' });
    }

    return res.status(200).json({ ok: true, participant: rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
