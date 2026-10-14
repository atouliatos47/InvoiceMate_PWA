# InvoiceMate

A simple invoice app for self-employed people. It runs **entirely on the device**:
no server, no database, no account, and it works with no internet once installed.
Each phone or tablet keeps its own separate copy of the data.

Built with plain HTML/CSS/JavaScript as a Progressive Web App (PWA), so it installs
from Chrome onto an Android home screen like a normal app.

---

## Features

- Invoices with line items and automatic totals, VAT/tax and currency settings
- Status tracking: Draft → Sent → Paid / Overdue / Cancelled
- Client address book
- 3 PDF templates (Classic, Modern, Minimal), made on the device
- **Share PDF** through Android's share sheet (WhatsApp, Gmail, Drive…) or download it
- **Start screen** with the InvoiceMate logo
- **App lock**: optional 4-digit PIN (stored only as a salted SHA-256 hash)
- **Backup file**: save everything to one `.json` file and restore it later or on another device
- Works offline (service worker caches every app file)

---

## Install on an Android phone or tablet

1. Open the app's web address in **Chrome**.
2. Tap **⋮ → Add to Home screen** (or **Install app**), or the **Install** button in the top bar.
3. Open it from the home screen icon. From then on it works without internet.

Each device that installs it starts empty and keeps its own data. Nothing is shared
between devices or sent anywhere.

### Backups — please do this

All data lives on the device only. If the device is lost, reset, or Chrome's data
for the app is cleared, the invoices go with it. In **Settings → Backup**:

- **Save backup file** downloads `InvoiceMate-backup-YYYY-MM-DD.json`. Keep it
  somewhere safe (email it to yourself, Google Drive…).
- **Restore from backup** replaces everything on the device with the file's contents.
  The same file moves the data to a new device. The PIN is never included in a backup.

### Forgotten PIN

The PIN can't be recovered. "Forgot?" on the lock screen resets the app (deleting the
data on that device). Restore a backup file afterwards.

---

## Hosting (GitHub Pages)

It's plain static files, so any static host works. With GitHub Pages:

1. Repository **Settings → Pages**.
2. Source: **Deploy from a branch**, pick the branch, folder **/ (root)**, Save.
3. It goes live at `https://<user>.github.io/<repo>/` after a minute or two.

All paths are relative, so it works from that sub-folder address.

### Shipping an update

Change `CACHE_NAME` in `sw.js` (e.g. `-v1` → `-v2`) whenever you change any file.
Installed copies pick up the new version the next time they're opened with internet;
without the bump they keep running the old one.

---

## Project structure

```
index.html            App shell: start screen + keypad, top bar, views, modal, bottom nav
manifest.json         PWA manifest (name, icons, colours)
sw.js                 Service worker: caches every file for offline use
css/style.css         All styles
icons/                App icons made from the InvoiceMate logo (incl. maskable)
js/api.js             On-device data store: settings, clients, invoices, numbering, totals
js/lock.js            Start screen + PIN lock
js/backup.js          Backup export / restore
js/app.js             Navigation, dashboard, boot
js/invoices.js        Invoice list, detail, form, line items
js/clients.js         Client list and form
js/settings.js        Settings form, App Lock and Backup sections
js/pdf.js             The 3 PDF templates, download and share
js/vendor/            pdf-lib 1.17.1 (MIT) — bundled so PDFs work offline
```

Data is stored in the browser's `localStorage` under `invoicemate.data` (one JSON
document), the PIN hash under `invoicemate.lock`.

---

## Known limits

- PDFs use the built-in Helvetica font, which only prints Western European characters.
  Anything else (e.g. Greek letters, emoji) prints as `?` rather than breaking the PDF.

---

## Licence

MIT. Includes [pdf-lib](https://pdf-lib.js.org/) (MIT, see `js/vendor/pdf-lib.LICENSE.md`).
