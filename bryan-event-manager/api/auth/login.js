// POST { email } → generate magic link token and send via Resend
import crypto from 'crypto';
import { query, ensureAuthSchema, normalizeEmail, setCors } from '../_db.js';

const MAGIC_TOKEN_TTL_MINUTES = 15;

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

    // Check user exists and is active
    const { rows } = await query(
      'SELECT id, email, role FROM users WHERE email = $1 AND active = TRUE',
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ ok: false, error: 'Email not authorized' });
    }

    const user = rows[0];

    // Generate magic token
    const magicToken = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + MAGIC_TOKEN_TTL_MINUTES * 60 * 1000);

    await query(
      'UPDATE users SET magic_token = $1, magic_token_expires = $2 WHERE id = $3',
      [magicToken, expires.toISOString(), user.id]
    );

    // Build magic link URL
    const appUrl = (process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173')).replace(/\/$/, '');
    const magicLink = `${appUrl}/?magic=${magicToken}`;

    // Send email via Resend
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      console.error('RESEND_API_KEY not set');
      return res.status(500).json({ ok: false, error: 'Email service not configured' });
    }

    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Event Manager <info@iainazienda.it>';

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject: 'Your login link — Event Manager',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
            <h2 style="color: #111827; font-size: 20px; margin-bottom: 8px;">Event Manager</h2>
            <p style="color: #6b7280; font-size: 15px; line-height: 1.6;">
              Click the button below to log in. This link expires in ${MAGIC_TOKEN_TTL_MINUTES} minutes.
            </p>
            <a href="${magicLink}" style="display: inline-block; margin: 24px 0; padding: 12px 32px; background-color: #4f46e5; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 500;">
              Log in
            </a>
            <p style="color: #9ca3af; font-size: 13px; line-height: 1.5;">
              If the button doesn't work, copy and paste this link:<br/>
              <a href="${magicLink}" style="color: #4f46e5; word-break: break-all;">${magicLink}</a>
            </p>
            <p style="color: #d1d5db; font-size: 12px; margin-top: 32px;">
              If you didn't request this, you can safely ignore this email.
            </p>
          </div>
        `,
      }),
    });

    if (!emailRes.ok) {
      const errBody = await emailRes.text();
      console.error('Resend error:', emailRes.status, errBody);
      return res.status(500).json({ ok: false, error: 'Failed to send email' });
    }

    return res.status(200).json({ ok: true, message: 'Magic link sent — check your inbox' });
  } catch (err) {
    console.error('login error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
