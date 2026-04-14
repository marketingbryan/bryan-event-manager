// /api/participants
// GET    -> list all participants
// POST   -> body: { participants: [{first_name, last_name, email}, ...] }
//           bulk upsert (insert new, skip duplicates)
// DELETE -> body: { confirm: true } to clear all participants (reset event)
import { query, ensureSchema, setCors, normalizeEmail } from './_db.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    await ensureSchema();

    if (req.method === 'GET') {
      const { rows } = await query(
        `SELECT id, first_name, last_name, email, checked_in, checked_in_at, created_at
         FROM participants
         ORDER BY last_name ASC, first_name ASC`
      );
      return res.status(200).json({ participants: rows });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const list = Array.isArray(body.participants) ? body.participants : [];
      if (list.length === 0) {
        return res.status(400).json({ error: 'Nessun partecipante fornito' });
      }

      let inserted = 0;
      let skipped = 0;
      const errors = [];

      for (const p of list) {
        const first = String(p.first_name || '').trim();
        const last = String(p.last_name || '').trim();
        const email = normalizeEmail(p.email);

        if (!email || !email.includes('@')) {
          errors.push({ row: p, error: 'Email non valida' });
          continue;
        }
        if (!first && !last) {
          errors.push({ row: p, error: 'Nome e cognome mancanti' });
          continue;
        }

        const result = await query(
          `INSERT INTO participants (first_name, last_name, email)
           VALUES ($1, $2, $3)
           ON CONFLICT (email) DO NOTHING
           RETURNING id`,
          [first, last, email]
        );
        if (result.rowCount > 0) inserted++;
        else skipped++;
      }

      return res.status(200).json({ inserted, skipped, errors });
    }

    if (req.method === 'DELETE') {
      const body = req.body || {};
      if (body.confirm !== true) {
        return res.status(400).json({ error: 'Conferma richiesta' });
      }
      await query('DELETE FROM participants');
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
