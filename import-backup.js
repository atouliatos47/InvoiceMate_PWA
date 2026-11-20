/* ── Put a backup file onto the server ─────────────────────
   Loads an InvoiceMate backup file (the .json from "Save backup file")
   as someone's saved copy on the server. Their app picks it up the next
   time it opens: a new, empty tablet takes it straight away.

     node import-backup.js <backup file> <their email>

   e.g. node import-backup.js ~/files/InvoiceMate-backup-Sharon.json sharoncare42@gmail.com

   If that person already has a copy on the server, it is kept in
   history/ first, so nothing is ever lost.
──────────────────────────────────────────────────────────── */
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const DATA_DIR = process.env.DATA_DIR || path.join(os.homedir(), 'invoicemate-data');
const [file, emailArg] = process.argv.slice(2);
const email = (emailArg || '').trim().toLowerCase();

if (!file || !/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)) {
  console.log('Usage: node import-backup.js <backup file> <their email>');
  process.exit(1);
}

let backup;
try { backup = JSON.parse(fs.readFileSync(file, 'utf8')); }
catch (err) { console.log(`Could not read ${file}: ${err.message}`); process.exit(1); }

const d = backup && backup.data;
if (!(backup.app === 'InvoiceMate' && d && d.settings && Array.isArray(d.invoices) && Array.isArray(d.clients))) {
  console.log(`${file} is not an InvoiceMate backup file.`);
  process.exit(1);
}

const target = path.join(DATA_DIR, `${email}.json`);
let rev = 0;
if (fs.existsSync(target)) {
  const old = JSON.parse(fs.readFileSync(target, 'utf8'));
  rev = old.rev || 0;
  const dir = path.join(DATA_DIR, 'history', email);
  fs.mkdirSync(dir, { recursive: true });
  const keep = path.join(dir, `before-import-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(keep, JSON.stringify(old));
  console.log(`Kept their old copy (${old.data ? old.data.invoices.length : 0} invoices) in ${keep}`);
}

fs.mkdirSync(DATA_DIR, { recursive: true });
const doc = { rev: rev + 1, saved_at: new Date().toISOString(), data: d };
fs.writeFileSync(`${target}.tmp`, JSON.stringify(doc));
fs.renameSync(`${target}.tmp`, target);

const total = d.invoices.reduce((t, i) => t + (Number(i.total) || 0), 0);
console.log(`Done: ${d.invoices.length} invoices and ${d.clients.length} clients (£${total.toFixed(2)}) saved for ${email}.`);
console.log('If the app is running, it is ready — no restart needed.');
