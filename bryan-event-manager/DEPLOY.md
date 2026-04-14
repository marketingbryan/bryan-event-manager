# Guida Deploy — Bryan Event Manager

Questa guida ti porta da **"ho il codice"** a **"l'app è online"** in 3 passi.
Ti servono solo browser e mouse, niente installazioni.

Durata totale: **~20 minuti**.

---

## Panoramica

Useremo 3 servizi online (hai già tutti gli account con Google `marketing@bryan.it`):

| Servizio | A cosa serve |
|---|---|
| **GitHub** | Archivia il codice dell'app |
| **Railway** | Ospita il database PostgreSQL |
| **Vercel** | Ospita e pubblica l'app online |

L'ordine corretto è: **1) GitHub → 2) Railway → 3) Vercel**.

---

## Passo 1 — GitHub: carica il codice

### 1.1 Crea la repo
1. Vai su https://github.com/new
2. Repository name: `bryan-event-manager`
3. Lascia **Private** se vuoi (o Public, non cambia nulla)
4. **Non** spuntare "Add a README" (ne abbiamo già uno)
5. Click **Create repository**

### 1.2 Carica i file via browser (il modo più semplice)
1. Nella schermata della repo appena creata, clicca **"uploading an existing file"** (link nel testo centrale), oppure vai su **Add file → Upload files**
2. Trascina nella pagina **tutta la cartella `bryan-event-manager`** (o meglio: aprila e seleziona **tutto il contenuto dentro**, incluso il file nascosto `.gitignore` — se Finder/Windows Explorer li nasconde abilita "mostra file nascosti")
3. Aspetta che l'upload finisca (barra di progresso in fondo alla pagina)
4. In fondo, nel campo "Commit changes":
   - Lascia il messaggio di default ("Add files via upload")
5. Click **Commit changes**

### 1.3 Verifica
Torna sulla pagina principale della repo: dovresti vedere cartelle `api/`, `src/`, `public/` e file come `package.json`, `README.md`, `vercel.json`, ecc.

> **Suggerimento**: se non vedi il file `.gitignore` nell'upload, è normale — basta che tutto il resto sia presente.

---

## Passo 2 — Railway: crea il database

### 2.1 Login
1. Vai su https://railway.app
2. Click **Login** → **Login with Google** → usa `marketing@bryan.it`

### 2.2 Crea un nuovo progetto con Postgres
1. Click **New Project** (o "+ New")
2. Dal menu scegli **Provision PostgreSQL** (o "Add PostgreSQL")
3. Attendi 30-60 secondi mentre Railway crea il database

### 2.3 Copia la stringa di connessione
1. Click sul riquadro **Postgres** che è apparso
2. Vai sulla tab **Variables** (o "Connect")
3. Trova la riga `DATABASE_URL` (inizia con `postgres://`)
4. Click sull'icona per **copiarla** (o clicca sul valore e usa Ctrl/Cmd+C)
5. **Salvala momentaneamente** in un Blocco Note — la useremo al passo 3

> **Importante**: deve essere la `DATABASE_URL` completa che inizia con `postgres://` o `postgresql://`. Non serve fare altro: le tabelle le creerà da sola l'app al primo avvio.

---

## Passo 3 — Vercel: pubblica l'app

### 3.1 Login
1. Vai su https://vercel.com
2. Click **Sign up** / **Log in** → **Continue with Google** → `marketing@bryan.it`
3. Se ti chiede nome team, scegli il tuo account personale (gratis)

### 3.2 Importa la repo da GitHub
1. Dalla dashboard Vercel, click **Add New... → Project**
2. Alla prima volta Vercel chiederà di **collegare GitHub** → click "Install" e autorizza
3. Nella lista repo cerca **bryan-event-manager** e click **Import**

### 3.3 Configura il progetto
Nella schermata "Configure Project":

- **Project Name**: `bryan-event-manager` (o come vuoi)
- **Framework Preset**: dovrebbe rilevare automaticamente **Vite** — se no, selezionalo dal menu
- **Root Directory**: lascia così com'è (`.` / root)
- **Build Command**: `npm run build` (default)
- **Output Directory**: `dist` (default)

### 3.4 Aggiungi la variabile DATABASE_URL
Sempre nella stessa schermata, espandi la sezione **Environment Variables**:

- **Key**: `DATABASE_URL`
- **Value**: incolla qui la stringa che hai copiato da Railway
- Click **Add**

### 3.5 Deploy
Click sul bottone **Deploy** in fondo.

Vercel inizierà a buildare. Tempo: 1-3 minuti. Vedrai una schermata con log in tempo reale.

Quando finisce, vedrai l'animazione celebrativa e il bottone **Continue to Dashboard**.

### 3.6 Apri l'app
1. Click su **Visit** (o sull'URL del tipo `bryan-event-manager-xxxx.vercel.app`)
2. Dovresti vedere la Dashboard con tutti gli zeri

### 3.7 Test rapido
1. Sidebar → **Partecipanti** → **Scegli CSV** → carica il file `sample-partecipanti.csv` incluso nel progetto
2. Dovresti vedere 4 partecipanti
3. Click **Check-in** su una riga → lo stato diventa verde
4. Torna a **Dashboard** → vedrai i numeri aggiornati
5. Vai su **Scanner** → **Avvia scanner** (il browser chiederà permesso fotocamera) → prova a inquadrare il QR generato con: https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=davide.berardino@bryan.it
6. **Export CSV** → scarica il file finale

Se tutto funziona, l'app è **online e pronta**.

---

## Dopo il deploy: dominio personalizzato (opzionale)

Se vuoi un URL tipo `events.bryan.it`:
1. Vercel → progetto → **Settings** → **Domains**
2. Inserisci il dominio, segui le istruzioni DNS
3. SSL automatico

---

## Troubleshooting

### "Errore nel caricamento partecipanti" appena aperta l'app
- Variabile `DATABASE_URL` non configurata su Vercel
- Vai su Vercel → progetto → **Settings → Environment Variables** → verifica che `DATABASE_URL` esista e inizi con `postgres://`
- Se la aggiungi/modifichi dopo il deploy, devi fare **Redeploy**: tab **Deployments** → click sui 3 puntini dell'ultimo deploy → **Redeploy**

### Lo scanner QR non parte
- Vercel usa HTTPS automaticamente: i browser richiedono HTTPS per accedere alla fotocamera ✓
- Su iPhone/Safari: assicurati di consentire l'accesso alla fotocamera quando lo chiede
- Controlla che il QR contenga effettivamente un'email leggibile

### Il build fallisce su Vercel
- Controlla i log: spesso è una variabile mancante o un file non caricato su GitHub
- Ricontrolla che la cartella `api/` e `src/` siano presenti nella repo

### Modifiche future al codice
Ogni volta che fai push di modifiche su GitHub (anche modificando un file direttamente dal sito github.com), Vercel rileva e **ridesploya automaticamente**. Zero lavoro extra.

---

## Costi

Con uso modesto (eventi sporadici, pochi partecipanti) tutti e 3 i servizi sono **gratis**:
- GitHub: gratis per repo private illimitate
- Railway: $5 di credito gratis ogni mese (basta per un DB Postgres piccolo)
- Vercel: Hobby plan gratis (illimitato per uso personale/non commerciale)

Se Railway esaurisce il credito gratis, puoi passare a Neon (https://neon.tech) che ha un free tier permanente per Postgres — basta sostituire la `DATABASE_URL` su Vercel.
