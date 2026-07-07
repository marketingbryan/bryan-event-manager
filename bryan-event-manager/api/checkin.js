// /api/checkin
// POST body: { email, action: 'check-in' | 'check-out', first_name?, last_name?, company?, role?, phone?, rsvp? }
import { query, ensureSchema, setCors, normalizeEmail } from './_db.js';
import { requireAuth } from './_auth.js';

const FIELDS = 'id, first_name, last_name, email, company, role, phone, rsvp, checked_in, checked_in_at';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await requireAuth(req, res);
  if (!user) return;

  try {
    await ensureSchema();
    const body = req.body || {};
    const email = normalizeEmail(body.email);
    const action = body.action === 'check-out' ? 'check-out' : 'check-in';

    if (!email) {
      return res.status(400).json({ ok: false, error: 'Email missing' });
    }

    let { rows } = await query(
      `SELECT ${FIELDS} FROM participants WHERE LOWER(email) = $1 LIMIT 1`,
      [email]
    );

    // If not found, try to create if name is provided (manual check-in from scanner)
    if (rows.length === 0 && action === 'check-in') {
      const first = String(body.first_name || '').trim();
      const last = String(body.last_name || '').trim();
      if (first || last) {
        const company = String(body.company || '').trim();
        const role = String(body.role || '').trim();
        const phone = String(body.phone || '').trim();
        const rsvpRaw = String(body.rsvp || '').trim();
        const rsvp = rsvpRaw === 'Registered' ? 'Registered' : 'Invited';
        const ins = await query(
          `INSERT INTO participants (first_name, last_name, email, company, role, phone, rsvp, checked_in, checked_in_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, NOW())
           ON CONFLICT (email) DO NOTHING
           RETURNING ${FIELDS}`,
          [first, last, email, company, role, phone, rsvp]
        );
        if (ins.rows.length > 0) {
          return res.status(200).json({ ok: true, participant: ins.rows[0], created: true });
        }
        const re = await query(`SELECT ${FIELDS} FROM participants WHERE LOWER(email) = $1 LIMIT 1`, [email]);
        rows = re.rows;
      }
    }

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Participant not found', email });
    }

    const participant = rows[0];

    if (action === 'check-in') {
      if (participant.checked_in) {
        return res.status(200).json({ ok: true, alreadyCheckedIn: true, participant });
      }
      const upd = await query(
        `UPDATE participants SET checked_in = TRUE, checked_in_at = NOW() WHERE id = $1 RETURNING ${FIELDS}`,
        [participant.id]
      );
      return res.status(200).json({ ok: true, participant: upd.rows[0] });
    } else {
      const upd = await query(
        `UPDATE participants SET checked_in = FALSE, checked_in_at = NULL WHERE id = $1 RETURNING ${FIELDS}`,
        [participant.id]
      );
      return res.status(200).json({ ok: true, participant: upd.rows[0] });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
