# ⚡ InvoiceMate

A simple, self-hosted invoice PWA for self-employed people. Built with vanilla HTML/CSS/JS, Node.js/Express, and PostgreSQL (Neon). Installable on any device as a Progressive Web App.

---

## Features

- Create & edit invoices with line items, auto-calculated totals
- 3 PDF templates (Classic, Modern, Minimal) — download instantly
- Client address book with full contact details
- Status tracking: Draft → Sent → Paid / Overdue
- Currency & tax settings (10+ currencies, custom VAT/tax name)
- Bank details printed on every PDF
- Fully responsive — works on phone, tablet, desktop
- Installable as a PWA (Add to Home Screen)

---

## Tech Stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Frontend | Vanilla HTML/CSS/JS + PWA           |
| Backend  | Node.js + Express                   |
| Database | PostgreSQL via [Neon](https://neon.tech) |
| PDF      | [pdf-lib](https://pdf-lib.js.org/) (client-side) |
| Hosting  | [Render](https://render.com)        |
| CI/CD    | GitHub → Render auto-deploy         |
| Uptime   | [UptimeRobot](https://uptimerobot.com) (keep-alive) |

---

## Deploy in 4 Steps

### Step 1 — Set up Neon (PostgreSQL)

1. Go to [neon.tech](https://neon.tech) and create a free account
2. Create a new **Project** (e.g. `invoicemate`)
3. In your project dashboard, click **SQL Editor**
4. Paste the entire contents of `schema.sql` and click **Run**
5. Go to **Connection Details** → copy the **Connection string** (starts with `postgresql://...`)

---

### Step 2 — Push to GitHub

```bash
# In the invoicemate folder
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/invoicemate.git
git push -u origin main
```

> ⚠️ Make sure `.env` is in `.gitignore` — it is by default.

---

### Step 3 — Deploy on Render

1. Go to [render.com](https://render.com) and sign in with GitHub
2. Click **New → Web Service**
3. Connect your `invoicemate` GitHub repo
4. Fill in these settings:

| Setting          | Value              |
|------------------|--------------------|
| **Name**         | `invoicemate`      |
| **Runtime**      | `Node`             |
| **Build Command**| `npm install`      |
| **Start Command**| `npm start`        |
| **Instance Type**| Free               |

5. Scroll down to **Environment Variables** and add:

| Key            | Value                              |
|----------------|------------------------------------|
| `DATABASE_URL` | *(paste your Neon connection string)* |
| `NODE_ENV`     | `production`                       |

6. Click **Create Web Service**

Render will build and deploy automatically. Your app will be live at:
```
https://invoicemate.onrender.com
```
(or whatever name you chose)

---

### Step 4 — Keep it alive with UptimeRobot

Render free tier spins down after 15 minutes of inactivity. UptimeRobot pings it every 5 minutes to keep it awake.

1. Go to [uptimerobot.com](https://uptimerobot.com) and create a free account
2. Click **Add New Monitor**
3. Set:
   - **Monitor Type**: HTTP(s)
   - **Friendly Name**: InvoiceMate
   - **URL**: `https://your-app.onrender.com`
   - **Monitoring Interval**: 5 minutes
4. Click **Create Monitor**

---

## Local Development

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/invoicemate.git
cd invoicemate

# 2. Install dependencies
npm install

# 3. Create .env file
cp .env.example .env
# Edit .env and paste your Neon DATABASE_URL

# 4. Run the app
npm start
# → http://localhost:3000
```

---

## Project Structure

```
invoicemate/
├── public/                 ← PWA frontend (served as static files)
│   ├── index.html          ← App shell, navigation, modal, toast
│   ├── manifest.json       ← PWA manifest
│   ├── sw.js               ← Service worker (offline support)
│   ├── css/
│   │   └── style.css       ← Full dark theme styles
│   ├── js/
│   │   ├── api.js          ← Fetch wrapper for all API calls
│   │   ├── app.js          ← Router, navigation, dashboard
│   │   ├── clients.js      ← Client list, add/edit/delete
│   │   ├── invoices.js     ← Invoice list, form, line items
│   │   ├── pdf.js          ← 3 PDF templates (pdf-lib)
│   │   └── settings.js     ← Settings form
│   └── icons/              ← PWA icons (192px, 512px)
├── routes/
│   ├── clients.js          ← REST API: /api/clients
│   ├── invoices.js         ← REST API: /api/invoices
│   └── settings.js         ← REST API: /api/settings
├── db.js                   ← Neon PostgreSQL pool
├── server.js               ← Express server entry point
├── schema.sql              ← Run once in Neon SQL editor
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

---

## API Reference

### Settings
| Method | Endpoint        | Description        |
|--------|-----------------|--------------------|
| GET    | /api/settings   | Get settings       |
| PUT    | /api/settings   | Update settings    |

### Clients
| Method | Endpoint           | Description        |
|--------|--------------------|--------------------|
| GET    | /api/clients       | List all clients   |
| GET    | /api/clients/:id   | Get one client     |
| POST   | /api/clients       | Create client      |
| PUT    | /api/clients/:id   | Update client      |
| DELETE | /api/clients/:id   | Delete client      |

### Invoices
| Method | Endpoint                  | Description         |
|--------|---------------------------|---------------------|
| GET    | /api/invoices             | List all invoices   |
| GET    | /api/invoices/:id         | Get invoice + items |
| POST   | /api/invoices             | Create invoice      |
| PUT    | /api/invoices/:id         | Update invoice      |
| PATCH  | /api/invoices/:id/status  | Quick status update |
| DELETE | /api/invoices/:id         | Delete invoice      |

---

## PWA Icons

You'll need two icons in `public/icons/`:
- `icon-192.png` — 192×192px
- `icon-512.png` — 512×512px

Use the existing `my_invoice.png` logo, resize it with any image editor or a free tool like [realfavicongenerator.net](https://realfavicongenerator.net).

---

## Environment Variables

| Variable       | Required | Description                        |
|----------------|----------|------------------------------------|
| `DATABASE_URL` | ✅       | Neon PostgreSQL connection string  |
| `PORT`         | ❌       | Port (default: 3000, Render sets automatically) |

---

## Future Ideas

- [ ] Email invoices directly (Resend)
- [ ] Recurring invoices
- [ ] Multi-user / team support
- [ ] Invoice templates with logo upload
- [ ] Stripe payment links on invoices
- [ ] Export to CSV / Excel

---

## Licence

MIT — use it, fork it, make it your own.
