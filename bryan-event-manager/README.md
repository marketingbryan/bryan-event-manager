# Bryan Event Manager

App per la gestione dei check-in agli eventi. Funzionalità:

- Upload CSV partecipanti (colonne: `nome`, `cognome`, `email`)
- Scanner QR code (legge l'email dai QR generati come `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=<email>`)
- Tabella partecipanti con check-in e annulla check-in
- Export CSV finale con stato (Check-in / No-show) e timestamp

## Stack

- Frontend: React 18 + Vite + Tailwind CSS
- Backend: Vercel Serverless Functions (Node.js)
- Database: PostgreSQL (Railway)
- QR scanner: `html5-qrcode`
- CSV: `papaparse`

## Sviluppo locale

```bash
npm install
cp .env.example .env.local   # poi incolla la DATABASE_URL di Railway
npm run dev                  # http://localhost:5173
```

> **Nota:** Le funzioni `/api/*` girano solo su Vercel. Per testare localmente installa Vercel CLI: `npm i -g vercel` e poi usa `vercel dev`.

## Deploy

Vedi [`DEPLOY.md`](./DEPLOY.md) per la guida passo-passo.

## Struttura

```
.
├── api/                # Serverless functions (Vercel)
│   ├── _db.js          # Pool Postgres + schema
│   ├── participants.js # GET/POST/DELETE partecipanti
│   └── checkin.js      # POST check-in/out
├── src/
│   ├── App.jsx
│   ├── main.jsx
│   ├── index.css
│   └── components/
│       ├── Sidebar.jsx
│       ├── Dashboard.jsx
│       ├── ParticipantsPage.jsx
│       ├── ScannerPanel.jsx
│       ├── ExportPage.jsx
│       └── Toast.jsx
├── public/favicon.svg
├── index.html
├── package.json
├── tailwind.config.js
├── vite.config.js
├── vercel.json
└── sample-partecipanti.csv
```

## Variabili d'ambiente

| Nome | Descrizione |
|------|-------------|
| `DATABASE_URL` | Connection string PostgreSQL (da Railway). Formato: `postgres://user:pass@host:port/db` |

## API

- `GET  /api/participants` — elenco partecipanti
- `POST /api/participants` — body `{ participants: [{first_name, last_name, email}, ...] }`
- `DELETE /api/participants` — body `{ confirm: true }` azzera lista
- `POST /api/checkin` — body `{ email, action: 'check-in' | 'check-out' }`
