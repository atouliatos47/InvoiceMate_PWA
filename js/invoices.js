/* ── Invoice List ───────────────────────────────────────── */
async function renderInvoiceList() {
  const el = document.getElementById('view-invoices');
  el.innerHTML = spinner();

  try {
    const invoices = await API.getInvoices();
    App._invoices = invoices;

    el.innerHTML = `
      <div class="section-header">
        <div class="section-title">Invoices</div>
        <button class="btn btn-primary btn-sm" onclick="openInvoiceForm()">+ New</button>
      </div>

      <div style="display:flex;gap:8px;margin-bottom:12px;overflow-x:auto;padding-bottom:4px">
        ${['all','draft','sent','paid','overdue'].map(s => `
          <button class="btn btn-ghost btn-sm filter-btn" data-status="${s}"
            onclick="filterInvoices('${s}')" style="white-space:nowrap">
            ${s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>`).join('')}
      </div>

      <div class="search-box">
        <span class="search-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
        <input type="text" id="inv-search" placeholder="Search invoices…"
          oninput="filterInvoices(App._invFilter || 'all', this.value)" />
      </div>

      <div id="invoice-list">
        ${renderInvoiceItems(invoices)}
      </div>
    `;

    setFilterBtn('all');
  } catch (err) {
    el.innerHTML = `<div class="empty-state">
      <div class="empty-title">Failed to load invoices</div>
      <div class="text-muted">${err.message}</div>
    </div>`;
  }
}

function renderInvoiceItems(invoices) {
  if (!invoices.length) {
    return emptyState(ICONS.invoice, 'No invoices here', 'Create your first invoice to get started.', '+ New Invoice', 'openInvoiceForm()');
  }
  return invoices.map(inv => `
    <div class="list-item" onclick="openInvoiceDetail(${inv.id})">
      <div class="list-item-left">
        <div class="item-title">${inv.invoice_number}</div>
        <div class="item-sub">
          ${escHtml(inv.client_name || 'No client')} &middot; ${fmtDate(inv.issue_date)}
        </div>
      </div>
      <div class="list-item-right" style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
        <div class="item-amount">${fmtMoney(inv.total)}</div>
        <select class="status-select status-${inv.status}"
          onclick="event.stopPropagation()"
          onchange="quickStatusChange(${inv.id}, this.value, this)">
          ${['draft','sent','paid','overdue','cancelled'].map(s =>
            `<option value="${s}" ${inv.status===s?'selected':''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`
          ).join('')}
        </select>
      </div>
    </div>
  `).join('');
}

function filterInvoices(status, q = '') {
  App._invFilter = status;
  setFilterBtn(status);
  let list = App._invoices || [];
  if (status !== 'all') list = list.filter(i => i.status === status);
  if (q) list = list.filter(i =>
    i.invoice_number.toLowerCase().includes(q.toLowerCase()) ||
    (i.client_name || '').toLowerCase().includes(q.toLowerCase())
  );
  document.getElementById('invoice-list').innerHTML = renderInvoiceItems(list);
}

function setFilterBtn(status) {
  document.querySelectorAll('.filter-btn').forEach(b => {
    b.classList.toggle('btn-primary', b.dataset.status === status);
    b.classList.toggle('btn-ghost',   b.dataset.status !== status);
  });
}

/* ── Invoice Detail ─────────────────────────────────────── */
async function openInvoiceDetail(id) {
  openModal(spinner(), 'Invoice');
  try {
    const inv = await API.getInvoice(id);
    const client = inv.client_snapshot ? JSON.parse(typeof inv.client_snapshot === 'string'
      ? inv.client_snapshot : JSON.stringify(inv.client_snapshot)) : {};
    const cols = unitLabels(inv.billing_mode);   // Hours / Rate or Qty / Price

    document.getElementById('modal-content').innerHTML = `
      <div class="modal-title">${inv.invoice_number}</div>

      <div class="action-row">
        <button class="btn btn-outline btn-sm" onclick="openInvoiceForm(${inv.id})">Edit</button>
        <button class="btn btn-ghost btn-sm" onclick="generatePDF(${inv.id})">PDF</button>
        <button class="btn btn-ghost btn-sm" onclick="sharePDF(${inv.id})">Share</button>
        <button class="btn btn-danger btn-sm" onclick="confirmDeleteInvoice(${inv.id}, '${escHtml(inv.invoice_number)}')">🗑</button>
      </div>

      <!-- Status selector -->
      <div class="form-group">
        <label class="form-label">Status</label>
        <select class="form-control" onchange="quickStatusChange(${inv.id}, this.value)">
          ${['draft','sent','paid','overdue','cancelled'].map(s =>
            `<option value="${s}" ${inv.status === s ? 'selected' : ''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`
          ).join('')}
        </select>
      </div>

      <!-- PDF template — chosen here, since the New Invoice page (like the
           Flutter app's) doesn't ask. Saves as soon as it's changed. -->
      <div class="form-group">
        <label class="form-label">PDF Template</label>
        <select class="form-control" id="detail-template" onchange="quickTemplateChange(${inv.id}, this.value)">
          ${[['classic', 'Classic'], ['modern', 'Modern'], ['minimal', 'Minimal']].map(([v, l]) =>
            `<option value="${v}" ${(inv.template || 'classic') === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
      </div>

      <!-- From (owner) -->
      ${(App.settings.company_name) ? `
        <div class="card">
          <div class="card-title" style="margin-bottom:10px">From</div>
          <div style="font-size:0.9rem;line-height:1.8">
            <strong>${escHtml(App.settings.company_name)}</strong><br>
            ${companyAddressLine(App.settings) ? escHtml(companyAddressLine(App.settings)) + '<br>' : ''}
            ${App.settings.company_email   ? `<a href="mailto:${escHtml(App.settings.company_email)}" style="color:var(--accent)">${escHtml(App.settings.company_email)}</a><br>` : ''}
            ${App.settings.company_phone   ? escHtml(App.settings.company_phone) + '<br>' : ''}
            ${App.settings.bank_name ? `<span style="color:var(--text-muted);font-size:0.82rem">Bank: ${escHtml(App.settings.bank_name)} &nbsp;|&nbsp; A/C: ${escHtml(App.settings.bank_account||'')} &nbsp;|&nbsp; Sort: ${escHtml(App.settings.bank_sort_code||'')}</span>` : ''}
          </div>
        </div>` : ''}

      <div class="card">
        ${row('Invoice No', inv.invoice_number)}
        ${row('Issue Date', fmtDate(inv.issue_date))}
      </div>

      ${client.name ? `
        <div class="card">
          <div class="card-title" style="margin-bottom:10px">Bill To</div>
          <div style="font-size:0.9rem;line-height:1.8">
            <strong>${escHtml(client.name)}</strong><br>
            ${client.address  ? escHtml(client.address)  + '<br>' : ''}
            ${client.city     ? escHtml(client.city)     + '<br>' : ''}
            ${client.postcode ? escHtml(client.postcode) + '<br>' : ''}
            ${client.email    ? `<a href="mailto:${escHtml(client.email)}" style="color:var(--accent)">${escHtml(client.email)}</a>` : ''}
          </div>
        </div>` : ''}

      <!-- Line items -->
      <div class="card">
        <div class="card-title" style="margin-bottom:10px">Items</div>
        <table style="width:100%;font-size:0.88rem;border-collapse:collapse">
          <thead>
            <tr style="color:var(--text-muted);text-align:left;border-bottom:1px solid var(--border)">
              <th style="padding:4px 0;width:50%">Description</th>
              <th style="padding:4px;text-align:right">${cols.qty}</th>
              <th style="padding:4px;text-align:right">${cols.priceShort}</th>
              <th style="padding:4px;text-align:right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${(inv.items || []).map(it => `
              <tr style="border-bottom:1px solid var(--border)">
                <td style="padding:8px 0">${escHtml(it.description)}</td>
                <td style="padding:8px 4px;text-align:right">${it.quantity}</td>
                <td style="padding:8px 4px;text-align:right">${fmtMoney(it.unit_price)}</td>
                <td style="padding:8px 4px;text-align:right">${fmtMoney(it.line_total)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
        <div class="totals-box" style="margin-top:12px">
          <div class="totals-row"><span>Subtotal</span><span>${fmtMoney(inv.subtotal)}</span></div>
          <div class="totals-row"><span>${App.settings.tax_name || 'VAT'} (${inv.tax_rate}%)</span><span>${fmtMoney(inv.tax_amount)}</span></div>
          <div class="totals-row total"><span>Total</span><span>${fmtMoney(inv.total)}</span></div>
        </div>
      </div>

      ${inv.notes ? `<div class="card"><div class="card-title" style="margin-bottom:6px">Notes</div><div style="font-size:0.9rem;color:var(--text-muted)">${escHtml(inv.notes)}</div></div>` : ''}

      <div class="form-actions">
        <button class="btn btn-outline btn-full" onclick="generatePDF(${inv.id})">Download PDF</button>
        <button class="btn btn-primary btn-full" onclick="sharePDF(${inv.id})">Share PDF</button>
      </div>
    `;
  } catch (err) {
    document.getElementById('modal-content').innerHTML =
      `<div class="empty-state"><div class="empty-title">Failed to load invoice</div></div>`;
  }
}

async function quickStatusChange(id, status, selectEl) {
  try {
    await API.patchStatus(id, status);
    showToast('Status updated', 'success');
    // Update dropdown colour immediately
    if (selectEl) {
      selectEl.className = `status-select status-${status}`;
    }
    // Update cached list
    App._invoices = await API.getInvoices();
    if (App.currentView === 'dashboard') renderDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function quickTemplateChange(id, template) {
  try {
    await API.patchTemplate(id, template);
    showToast('PDF template updated', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ── Invoice form ───────────────────────────────────────────
   New Invoice / Edit Invoice is now its own full page, laid out like the
   Flutter app's — see js/invoice-page.js (openInvoiceForm, the draft
   that keeps an unfinished invoice, and saving). */

/* ── Delete invoice ─────────────────────────────────────── */
function confirmDeleteInvoice(id, num) {
  openModal(`
    <div style="text-align:center;padding:16px 0">
      <div style="font-size:2rem;margin-bottom:12px">⚠️</div>
      <div class="bold" style="margin-bottom:8px">Delete ${escHtml(num)}?</div>
      <div class="text-muted" style="margin-bottom:24px;font-size:0.9rem">
        This cannot be undone.
      </div>
      <div class="form-actions">
        <button class="btn btn-ghost btn-full" onclick="closeModal()">Cancel</button>
        <button class="btn btn-danger btn-full" onclick="deleteInvoice(${id})">Delete</button>
      </div>
    </div>
  `);
}

async function deleteInvoice(id) {
  try {
    await API.deleteInvoice(id);
    showToast('Invoice deleted');
    closeModal();
    App._invoices = await API.getInvoices();
    if (App.currentView === 'invoices')  renderInvoiceList();
    if (App.currentView === 'dashboard') renderDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
