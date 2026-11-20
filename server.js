/* ── InvoiceMate server ───────────────────────────────────
   The app still works fully on the tablet (js/api.js keeps everything
   in the browser's storage). This small server adds a COPY on Andreas's
   home server, so the invoices are safe if the tablet is lost, and a new
   tablet gets them back by itself.

   It does two jobs:
     1. Hands out the app's files (index.html, js/, css/, icons/).
     2. Keeps one saved copy of the data per person:
          GET  api/data  → the saved copy  { rev, saved_at, data }
          PUT  api/data  → save a new copy (the app sends it after each change)
          POST api/copy  → keep a spare copy without changing the saved one

   Who is who: Cloudflare Access checks the email code before anyone
   reaches this server, then tells us the email in the header
   Cf-Access-Authenticated-User-Email. Each email gets its own file, so
   Sharon's invoices and Andreas's tests never mix.

   That header can be trusted only because this server listens on
   127.0.0.1 — the Cloudflare tunnel on this same machine is the only
   way in. Nothing else on the home network can reach it.

   Safety nets (data is precious):
     - "rev" (revision) goes up by one on every save. The app sends the
       rev it last saw; if the server has moved on since (another device
       saved), the save is refused (409) instead of overwriting.
     - A save that would suddenly drop several invoices is refused too
       (a wiped or reset tablet must not wipe the server).
     - Before the first change of each day, yesterday's copy is kept in
       history/ — so there's always a copy for every day it was used.
     - Files are written to a temp file first and then renamed, so a
       power cut can never leave a half-written file.
──────────────────────────────────────────────────────────── */
const express = require('express');
const fs      = require('fs');
const path    = require('path');
const os      = require('os');

const PORT     = Number(process.env.PORT) || 3010;
const HOST     = process.env.HOST || '127.0.0.1';
const DATA_DIR = process.env.DATA_DIR || path.join(os.homedir(), 'invoicemate-data');
// For testing on a computer with no Cloudflare in front: DEV_USER=me@test node server.js
const DEV_USER = process.env.DEV_USER || '';
const BIG_DROP = 3;   // refuse a save that suddenly loses this many invoices or more

fs.mkdirSync(path.join(DATA_DIR, 'history'), { recursive: true });

const app = express();
app.disable('x-powered-by');

/* ── Who is asking ──────────────────────────────────────── */
// The email, made safe to use as a file name.
function userOf(req) {
  const email = (req.get('Cf-Access-Authenticated-User-Email') || DEV_USER).trim().toLowerCase();
  if (!email || !/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)) return null;
  return email;
}
const fileOf    = user => path.join(DATA_DIR, `${user}.json`);
const historyOf = user => path.join(DATA_DIR, 'history', user);

/* ── Reading and writing one person's file ──────────────── */
function readDoc(user) {
  try { return JSON.parse(fs.readFileSync(fileOf(user), 'utf8')); }
  catch (err) {
    if (err.code === 'ENOENT') return { rev: 0, saved_at: null, data: null };   // nothing saved yet
    throw err;
  }
}

function writeAtomic(file, obj) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj));
  fs.renameSync(tmp, file);
}

const today = () => new Date().toISOString().slice(0, 10);
const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');

// Keeps the copy as it was before today's first change (once per day).
function keepDailyCopy(user, doc) {
  if (!doc.data) return;
  const dir = historyOf(user);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${today()}.json`);
  if (!fs.existsSync(file)) writeAtomic(file, doc);
}

function keepSpareCopy(user, doc, why) {
  const dir = historyOf(user);
  fs.mkdirSync(dir, { recursive: true });
  writeAtomic(path.join(dir, `${why}-${stamp()}.json`), doc);
}

// Same check as the app's Restore from backup: it must look like InvoiceMate data.
function looksLikeData(d) {
  return d && typeof d === 'object' && d.settings && typeof d.settings === 'object' &&
         Array.isArray(d.invoices) && Array.isArray(d.clients);
}

/* ── API ────────────────────────────────────────────────── */
const api = express.Router();
api.use(express.json({ limit: '25mb' }));     // a big logo picture can make the data large
api.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');      // never keep an old copy anywhere
  req.user = userOf(req);
  if (!req.user) return res.status(401).json({ error: 'not_signed_in' });
  next();
});

// "Is there a server, and who am I?" — the app asks this first.
api.get('/hello', (req, res) => {
  const doc = readDoc(req.user);
  res.json({ app: 'InvoiceMate', user: req.user, rev: doc.rev, saved_at: doc.saved_at });
});

api.get('/data', (req, res) => {
  res.json(readDoc(req.user));
});

api.put('/data', (req, res) => {
  const { base_rev, data, force } = req.body || {};
  if (!looksLikeData(data)) return res.status(400).json({ error: 'not_invoicemate_data' });

  const doc = readDoc(req.user);
  if (!force) {
    // Someone else saved since this device last looked.
    if (Number(base_rev) !== doc.rev) {
      return res.status(409).json({ error: 'changed_elsewhere', rev: doc.rev, saved_at: doc.saved_at });
    }
    // A sudden big loss of invoices — most likely a wiped device, not a choice.
    const had = doc.data ? doc.data.invoices.length : 0;
    if (had - data.invoices.length >= BIG_DROP) {
      return res.status(409).json({ error: 'big_drop', rev: doc.rev, had, sent: data.invoices.length });
    }
  } else if (doc.data) {
    // A forced save (the person chose this device's copy): keep what it replaces.
    keepSpareCopy(req.user, doc, 'replaced');
  }

  keepDailyCopy(req.user, doc);
  const saved = { rev: doc.rev + 1, saved_at: new Date().toISOString(), data };
  writeAtomic(fileOf(req.user), saved);
  console.log(`${saved.saved_at} ${req.user}: saved rev ${saved.rev} (${data.invoices.length} invoices)${force ? ' [forced]' : ''}`);
  res.json({ rev: saved.rev, saved_at: saved.saved_at });
});

// A spare copy (e.g. this device's data before it takes the server's).
api.post('/copy', (req, res) => {
  const { data } = req.body || {};
  if (!looksLikeData(data)) return res.status(400).json({ error: 'not_invoicemate_data' });
  keepSpareCopy(req.user, { rev: null, saved_at: new Date().toISOString(), data }, 'device');
  res.json({ ok: true });
});

// "Sign in again": the app opens this page; Cloudflare asks for the email
// code first (the session ran out), then lets it through to here, and we
// send it back to the app.
api.get('/signin', (req, res) => res.redirect('../'));

app.use('/api', api);
app.use('/api', (req, res) => res.status(404).json({ error: 'not_found' }));

/* ── The app's files ────────────────────────────────────── */
// Only these — not server.js, package.json or anything else in the folder.
const ROOT = __dirname;
const noCache = res => res.set('Cache-Control', 'no-cache');   // always check for a newer copy
app.get(['/', '/index.html'], (req, res) => { noCache(res); res.sendFile(path.join(ROOT, 'index.html')); });
app.get('/sw.js',         (req, res) => { noCache(res); res.sendFile(path.join(ROOT, 'sw.js')); });
app.get('/manifest.json', (req, res) => { noCache(res); res.sendFile(path.join(ROOT, 'manifest.json')); });
for (const dir of ['css', 'js', 'icons']) {
  app.use(`/${dir}`, express.static(path.join(ROOT, dir), { dotfiles: 'ignore', setHeaders: noCache }));
}
app.use((req, res) => res.status(404).send('Not found'));

app.listen(PORT, HOST, () => {
  console.log(`InvoiceMate on http://${HOST}:${PORT} — data in ${DATA_DIR}${DEV_USER ? ` — TEST USER ${DEV_USER}` : ''}`);
});
