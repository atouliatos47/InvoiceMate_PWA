/* ── Backup file: export + restore ────────────────────────
   Everything lives on this one device now, so this is the safety net:
     Export  → one file, InvoiceMate-backup-YYYY-MM-DD.json, holding every
               invoice, client and setting. Keep it somewhere safe
               (email it to yourself, Google Drive, a USB stick…).
     Restore → pick a backup file; after a confirmation it REPLACES
               everything on this device with what's in the file.
   The same file moves the data to a new tablet. The PIN is deliberately
   not included (see lock.js), so restoring never brings someone else's
   PIN with it.
──────────────────────────────────────────────────────────── */

const LAST_BACKUP_KEY = 'invoicemate.lastBackup';

const Backup = {
  lastBackupDate() {
    try { return localStorage.getItem(LAST_BACKUP_KEY); } catch (_) { return null; }
  },

  export() {
    const file = {
      app: 'InvoiceMate',
      type: 'backup',
      version: 1,
      exported_at: new Date().toISOString(),
      data: Store.load()
    };
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
    const name = `InvoiceMate-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    localStorage.setItem(LAST_BACKUP_KEY, file.exported_at);
    showToast(`Backup saved: ${name}`, 'success');
    if (App.currentView === 'settings') renderSettings();
  },

  // Opens the file picker. The work happens in restoreFromFile().
  pickFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = () => { if (input.files[0]) this.restoreFromFile(input.files[0]); };
    input.click();
  },

  async restoreFromFile(file) {
    let parsed;
    try {
      parsed = JSON.parse(await file.text());
    } catch (_) {
      return showToast("That file isn't an InvoiceMate backup", 'error');
    }
    const d = parsed && parsed.data;
    const valid = parsed && parsed.app === 'InvoiceMate' && d && d.settings &&
                  Array.isArray(d.invoices) && Array.isArray(d.clients);
    if (!valid) return showToast("That file isn't an InvoiceMate backup", 'error');

    const when = parsed.exported_at ? fmtDate(parsed.exported_at) : 'an unknown date';
    const ok = window.confirm(
      `Restore this backup from ${when}?\n\n` +
      `It contains ${d.invoices.length} invoice${d.invoices.length === 1 ? '' : 's'} and ` +
      `${d.clients.length} client${d.clients.length === 1 ? '' : 's'}.\n\n` +
      'This REPLACES everything currently on this device.');
    if (!ok) return;

    Store.replaceAll(d);
    App.settings = await API.getSettings();
    App._clients = null;
    App._invoices = null;
    showToast('Backup restored', 'success');
    navigate('dashboard');
  }
};
