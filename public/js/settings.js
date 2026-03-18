/* ── Settings View ──────────────────────────────────────── */
async function renderSettings() {
  const el = document.getElementById('view-settings');
  el.innerHTML = spinner();

  try {
    const s = await API.getSettings();
    App.settings = s;

    el.innerHTML = `
      <!-- Company -->
      <div class="settings-section">
        <div class="settings-section-title">🏢 Company</div>
        <div class="form-group">
          <label class="form-label">Company Name</label>
          <input class="form-control" id="s-company-name" value="${escHtml(s.company_name||'')}" placeholder="Your Company Ltd" />
        </div>
        <div class="form-group">
          <label class="form-label">Address</label>
          <textarea class="form-control" id="s-company-address" placeholder="Street, City, Postcode">${escHtml(s.company_address||'')}</textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Email</label>
            <input class="form-control" id="s-company-email" type="email" value="${escHtml(s.company_email||'')}" placeholder="you@example.com" />
          </div>
          <div class="form-group">
            <label class="form-label">Phone</label>
            <input class="form-control" id="s-company-phone" type="tel" value="${escHtml(s.company_phone||'')}" placeholder="+44…" />
          </div>
        </div>
      </div>

      <!-- Invoice settings -->
      <div class="settings-section">
        <div class="settings-section-title">🧾 Invoice</div>
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
          <textarea class="form-control" id="s-payment-terms" placeholder="Payment due within 30 days.">${escHtml(s.payment_terms||'')}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Additional Notes</label>
          <textarea class="form-control" id="s-notes" placeholder="Any extra info on invoices…">${escHtml(s.notes||'')}</textarea>
        </div>
      </div>

      <!-- Currency & Tax -->
      <div class="settings-section">
        <div class="settings-section-title">💷 Currency & Tax</div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Currency Code</label>
            <select class="form-control" id="s-currency" onchange="updateSymbol()">
              ${[
                ['GBP','£','GBP — British Pound'],
                ['EUR','€','EUR — Euro'],
                ['USD','$','USD — US Dollar'],
                ['CAD','$','CAD — Canadian Dollar'],
                ['AUD','$','AUD — Australian Dollar'],
                ['CHF','CHF','CHF — Swiss Franc'],
                ['JPY','¥','JPY — Japanese Yen'],
                ['NOK','kr','NOK — Norwegian Krone'],
                ['SEK','kr','SEK — Swedish Krona'],
                ['DKK','kr','DKK — Danish Krone'],
              ].map(([code,sym,label]) =>
                `<option value="${code}" data-sym="${sym}" ${(s.currency||'GBP')===code?'selected':''}>${label}</option>`
              ).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Symbol</label>
            <input class="form-control" id="s-currency-symbol" value="${escHtml(s.currency_symbol||'£')}" placeholder="£" maxlength="4" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Tax Name</label>
            <input class="form-control" id="s-tax-name" value="${escHtml(s.tax_name||'VAT')}" placeholder="VAT" />
          </div>
          <div class="form-group">
            <label class="form-label">Default Tax Rate (%)</label>
            <input class="form-control" id="s-tax-rate" type="number" value="${s.tax_rate||20}" min="0" max="100" step="0.1" />
          </div>
        </div>
      </div>

      <!-- Bank Details -->
      <div class="settings-section">
        <div class="settings-section-title">🏦 Bank Details</div>
        <div class="form-group">
          <label class="form-label">Bank Name</label>
          <input class="form-control" id="s-bank-name" value="${escHtml(s.bank_name||'')}" placeholder="Barclays, HSBC…" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Account Number</label>
            <input class="form-control" id="s-bank-account" value="${escHtml(s.bank_account||'')}" placeholder="12345678" />
          </div>
          <div class="form-group">
            <label class="form-label">Sort Code</label>
            <input class="form-control" id="s-bank-sort" value="${escHtml(s.bank_sort_code||'')}" placeholder="12-34-56" />
          </div>
        </div>
      </div>

      <button class="btn btn-primary btn-full" onclick="saveSettings()" style="margin-bottom:24px">
        💾 Save Settings
      </button>
    `;
  } catch (err) {
    el.innerHTML = `<div class="empty-state">
      <div class="empty-title">Failed to load settings</div>
      <div class="text-muted">${err.message}</div>
    </div>`;
  }
}

/* ── Auto-fill symbol when currency changes ─────────────── */
function updateSymbol() {
  const sel = document.getElementById('s-currency');
  const opt = sel.options[sel.selectedIndex];
  document.getElementById('s-currency-symbol').value = opt.dataset.sym || '';
}

/* ── Save settings ──────────────────────────────────────── */
async function saveSettings() {
  const body = {
    company_name:     document.getElementById('s-company-name').value.trim(),
    company_address:  document.getElementById('s-company-address').value.trim(),
    company_email:    document.getElementById('s-company-email').value.trim(),
    company_phone:    document.getElementById('s-company-phone').value.trim(),
    invoice_prefix:   document.getElementById('s-inv-prefix').value.trim() || 'INV',
    next_invoice_no:  parseInt(document.getElementById('s-inv-next').value) || 1,
    payment_terms:    document.getElementById('s-payment-terms').value.trim(),
    notes:            document.getElementById('s-notes').value.trim(),
    currency:         document.getElementById('s-currency').value,
    currency_symbol:  document.getElementById('s-currency-symbol').value.trim(),
    tax_name:         document.getElementById('s-tax-name').value.trim() || 'VAT',
    tax_rate:         parseFloat(document.getElementById('s-tax-rate').value) || 20,
    bank_name:        document.getElementById('s-bank-name').value.trim(),
    bank_account:     document.getElementById('s-bank-account').value.trim(),
    bank_sort_code:   document.getElementById('s-bank-sort').value.trim()
  };

  try {
    App.settings = await API.saveSettings(body);
    showToast('Settings saved', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}
