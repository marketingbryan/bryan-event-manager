// /api/scan-card
// POST body: { image: "data:image/jpeg;base64,..." }
// Returns: { ok: true, fields: { first_name, last_name, email, company, role } }
import { setCors } from './_db.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ ok: false, error: 'OPENAI_API_KEY not configured' });
  }

  try {
    const { image } = req.body || {};
    if (!image) {
      return res.status(400).json({ ok: false, error: 'No image provided' });
    }

    // Call OpenAI GPT-4o-mini with vision
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 300,
        messages: [
          {
            role: 'system',
            content: `You are a business card reader. Extract contact information from the business card image.
Return ONLY a JSON object with these fields (use empty string if not found):
{
  "first_name": "",
  "last_name": "",
  "email": "",
  "company": "",
  "role": ""
}
Rules:
- Split the full name into first_name and last_name
- email must be a valid email address
- company is the organization/business name
- role is the job title or position
- Return ONLY the JSON, no markdown, no explanation, no code fences`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract the contact details from this business card image.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: image,
                  detail: 'high'
                }
              }
            ]
          }
        ]
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error('OpenAI API error:', response.status, errData);
      return res.status(502).json({
        ok: false,
        error: `OpenAI API error: ${errData.error?.message || response.statusText}`
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Parse the JSON response — strip markdown fences if present
    const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    let fields;
    try {
      fields = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('Failed to parse OpenAI response:', content);
      return res.status(502).json({ ok: false, error: 'Could not parse AI response', raw: content });
    }

    // Ensure all expected fields exist
    const result = {
      first_name: String(fields.first_name || '').trim(),
      last_name: String(fields.last_name || '').trim(),
      email: String(fields.email || '').trim().toLowerCase(),
      company: String(fields.company || '').trim(),
      role: String(fields.role || '').trim(),
    };

    return res.status(200).json({ ok: true, fields: result });
  } catch (err) {
    console.error('scan-card error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
