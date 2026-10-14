/* ── Settings View ────────────────────────────────────────
   Business name, address, currency and bank details now live on the
   My Details page (js/details.js), laid out like the Flutter app's.
   Settings keeps the rest: invoice numbering and notes, VAT, App Lock
   and Backup.
──────────────────────────────────────────────────────────── */
async function renderSettings() {
  const el = document.getElementById('view-settings');
  el.innerHTML = spinner();

  try {
    const s = await API.getSettings();
    App.settings = s;

    el.innerHTML = `
      <!-- Shortcut to My Details -->
      <div class="settings-section" onclick="MyDetails.open()" style="cursor:pointer">
        <div class="settings-section-title">My Details</div>
        <div class="settings-note" style="margin-bottom:8px">
          ${s.company_name
            ? `<strong>${escHtml(s.company_name)}</strong>${companyAddressLine(s) ? '<br>' + escHtml(companyAddressLine(s)) : ''}`
            : 'Not filled in yet — your business, address, currency, bank and tax details go here. They are printed on every invoice.'}
        </div>
        <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); MyDetails.open()">Open My Details</button>
      </div>

      <!-- Invoice settings -->
      <div class="settings-section">
        <div class="settings-section-title">Invoice</div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Invoice Prefix</label>
            <input class="form-control" id="s-inv-prefix" value="${escHtml(s.invoice_prefix||'INV')}" placeholder="INV" />
          </div>
          <div class="form-group">
            <label class="form-label">Next Invoice No.</label>
            <input class="form-control" id="s-inv-next" type="number" value="${s.next_invoice_no||1}" min="1" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Payment Terms / Default Notes</label>
          <textarea class="form-control" id="s-payment-terms" placeholder="Printed under Notes on new invoices — leave empty for none">${escHtml(s.payment_terms||'')}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Additional Notes</label>
          <textarea class="form-control" id="s-notes" placeholder="Any extra info on invoices…">${escHtml(s.notes||'')}</textarea>
        </div>
      </div>

      <!-- Tax -->
      <div class="settings-section">
        <div class="settings-section-title">Tax</div>
        <div class="form-group">
          <label class="form-label">Tax Name</label>
          <input class="form-control" id="s-tax-name" value="${escHtml(s.tax_name||'VAT')}" placeholder="VAT" />
        </div>
        <!-- No default rate: the VAT % is typed on each invoice, like the Flutter app. -->
        <div class="settings-note" style="margin-bottom:0">The VAT % is typed on each invoice. Leave it empty if you're not VAT registered.</div>
      </div>

      <button class="btn btn-primary btn-full" onclick="saveSettings()" style="margin-bottom:24px">
        Save Settings
      </button>

      <!-- App lock (js/lock.js) — acts straight away, no Save needed -->
      <div class="settings-section">
        <div class="settings-section-title">App Lock</div>
        ${Lock.isOn() ? `
          <div class="settings-note">On — the app asks for your PIN when it opens, and again after a minute in the background.</div>
          <div class="settings-actions">
            <button class="btn btn-outline btn-sm" onclick="Lock.changePin()">Change PIN</button>
            <button class="btn btn-ghost btn-sm" onclick="Lock.turnOff()">Turn off</button>
          </div>` : `
          <div class="settings-note">Off — anyone holding the device can open the app.</div>
          <div class="settings-actions">
            <button class="btn btn-outline btn-sm" onclick="Lock.setPin()">Set a PIN</button>
          </div>`}
      </div>

      <!-- Backup (js/backup.js) -->
      <div class="settings-section">
        <div class="settings-section-title">Backup</div>
        <div class="settings-note">
          Everything is stored on this device only. Save a backup file now and then and keep it
          somewhere safe — email it to yourself or put it on Google Drive.<br>
          Last backup: <strong>${Backup.lastBackupDate() ? fmtDate(Backup.lastBackupDate()) : 'never'}</strong>
        </div>
        <div class="settings-actions">
          <button class="btn btn-outline btn-sm" onclick="Backup.export()">Save backup file</button>
          <button class="btn btn-ghost btn-sm" onclick="Backup.pickFile()">Restore from backup</button>
        </div>
      </div>
    `;
  } catch (err) {
    el.innerHTML = `<div class="empty-state">
      <div class="empty-title">Failed to load settings</div>
      <div class="text-muted">${err.message}</div>
    </div>`;
  }
}

/* ── Save settings ──────────────────────────────────────── */
// Only the fields on this page. API.saveSettings merges, so everything
// My Details owns (business, address, currency, bank, tax numbers) is
// left exactly as it was.
async function saveSettings() {
  const body = {
    invoice_prefix:   document.getElementById('s-inv-prefix').value.trim() || 'INV',
    next_invoice_no:  parseInt(document.getElementById('s-inv-next').value) || 1,
    payment_terms:    document.getElementById('s-payment-terms').value.trim(),
    notes:            document.getElementById('s-notes').value.trim(),
    tax_name:         document.getElementById('s-tax-name').value.trim() || 'VAT'
  };

  try {
    App.settings = await API.saveSettings(body);
    showToast('Settings saved', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}
