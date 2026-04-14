// /api/checkin
// POST body: { email, action: 'check-in' | 'check-out' }
// Returns: { ok, participant } or { ok: false, error }
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
    const action = body.action === 'check-out' ? 'check-out' : 'check-in';

    if (!email) {
      return res.status(400).json({ ok: false, error: 'Email mancante' });
    }

    const { rows } = await query(
      `SELECT id, first_name, last_name, email, checked_in, checked_in_at
       FROM participants
       WHERE LOWER(email) = $1
       LIMIT 1`,
      [email]
    );

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Partecipante non trovato', email });
    }

    const participant = rows[0];

    if (action === 'check-in') {
      if (participant.checked_in) {
        return res.status(200).json({
          ok: true,
          alreadyCheckedIn: true,
          participant,
          message: 'Gi\u00e0 fatto check-in',
        });
      }
      const upd = await query(
        `UPDATE participants
         SET checked_in = TRUE, checked_in_at = NOW()
         WHERE id = $1
         RETURNING id, first_name, last_name, email, checked_in, checked_in_at`,
        [participant.id]
      );
      return res.status(200).json({ ok: true, participant: upd.rows[0] });
    } else {
      const upd = await query(
        `UPDATE participants
         SET checked_in = FALSE, checked_in_at = NULL
         WHERE id = $1
         RETURNING id, first_name, last_name, email, checked_in, checked_in_at`,
        [participant.id]
      );
      return res.status(200).json({ ok: true, participant: upd.rows[0] });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
