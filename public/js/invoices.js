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
        <button class="btn btn-primary btn-sm" onclick="openInvoiceForm()">＋ New</button>
      </div>

      <div style="display:flex;gap:8px;margin-bottom:12px;overflow-x:auto;padding-bottom:4px">
        ${['all','draft','sent','paid','overdue'].map(s => `
          <button class="btn btn-ghost btn-sm filter-btn" data-status="${s}"
            onclick="filterInvoices('${s}')" style="white-space:nowrap">
            ${s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>`).join('')}
      </div>

      <div class="search-box">
        <span class="search-icon">🔍</span>
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
    return emptyState('📄', 'No invoices here', 'Create your first invoice to get started.', '＋ New Invoice', 'openInvoiceForm()');
  }
  return invoices.map(inv => `
    <div class="list-item" onclick="openInvoiceDetail(${inv.id})">
      <div class="list-item-left">
        <div class="item-title">${inv.invoice_number}</div>
        <div class="item-sub">
          ${escHtml(inv.client_name || 'No client')} · ${fmtDate(inv.issue_date)}
        </div>
      </div>
      <div class="list-item-right">
        <div class="item-amount">${fmtMoney(inv.total)}</div>
        <div class="mt-1">${badge(inv.status)}</div>
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

    document.getElementById('modal-content').innerHTML = `
      <div class="modal-title">${inv.invoice_number}</div>

      <div class="action-row">
        <button class="btn btn-outline btn-sm" onclick="openInvoiceForm(${inv.id})">✏️ Edit</button>
        <button class="btn btn-ghost btn-sm" onclick="generatePDF(${inv.id})">📄 PDF</button>
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

      <div class="card">
        ${row('Invoice No', inv.invoice_number)}
        ${row('Issue Date', fmtDate(inv.issue_date))}
        ${row('Due Date',   fmtDate(inv.due_date))}
        ${row('Template',  inv.template)}
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
              <th style="padding:4px;text-align:right">Qty</th>
              <th style="padding:4px;text-align:right">Price</th>
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
        <button class="btn btn-primary btn-full" onclick="generatePDF(${inv.id})">📄 Download PDF</button>
      </div>
    `;
  } catch (err) {
    document.getElementById('modal-content').innerHTML =
      `<div class="empty-state"><div class="empty-title">Failed to load invoice</div></div>`;
  }
}

async function quickStatusChange(id, status) {
  try {
    await API.patchStatus(id, status);
    showToast('Status updated', 'success');
    // Refresh cached list
    App._invoices = await API.getInvoices();
    if (App.currentView === 'invoices') renderInvoiceList();
    if (App.currentView === 'dashboard') renderDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ── Invoice Form ───────────────────────────────────────── */
async function openInvoiceForm(id = null) {
  openModal(spinner(), id ? 'Edit Invoice' : 'New Invoice');

  try {
    // Load clients & settings in parallel, plus invoice if editing
    const [clients, settings, inv] = await Promise.all([
      App._clients ? Promise.resolve(App._clients) : API.getClients(),
      App.settings.currency ? Promise.resolve(App.settings) : API.getSettings(),
      id ? API.getInvoice(id) : Promise.resolve(null)
    ]);
    App._clients  = clients;
    App.settings  = settings;

    // Default values
    const today    = new Date().toISOString().split('T')[0];
    const due30    = new Date(Date.now() + 30*864e5).toISOString().split('T')[0];
    const template = inv?.template    || 'classic';
    const taxRate  = inv?.tax_rate    ?? settings.tax_rate ?? 20;
    const selClient= inv?.client_id   || '';
    const items    = inv?.items?.length ? inv.items
      : [{ description:'', quantity:1, unit_price:0 }];

    document.getElementById('modal-content').innerHTML = `
      <div class="modal-title">${id ? 'Edit Invoice' : 'New Invoice'}</div>

      <!-- Client -->
      <div class="form-group">
        <label class="form-label">Client</label>
        <select class="form-control" id="if-client">
          <option value="">— No client —</option>
          ${clients.map(c => `<option value="${c.id}" ${c.id == selClient ? 'selected':''}>${escHtml(c.name)}</option>`).join('')}
        </select>
      </div>

      <!-- Dates -->
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Issue Date</label>
          <input type="date" class="form-control" id="if-issue" value="${inv?.issue_date?.split('T')[0] || today}" />
        </div>
        <div class="form-group">
          <label class="form-label">Due Date</label>
          <input type="date" class="form-control" id="if-due" value="${inv?.due_date?.split('T')[0] || due30}" />
        </div>
      </div>

      <!-- Template -->
      <div class="form-group">
        <label class="form-label">Template</label>
        <div class="template-grid">
          ${[
            { id:'classic', icon:'📋', label:'Classic' },
            { id:'modern',  icon:'✨', label:'Modern'  },
            { id:'minimal', icon:'⬜', label:'Minimal' }
          ].map(t => `
            <div class="template-option ${template===t.id?'selected':''}"
              onclick="selectTemplate('${t.id}')" data-tpl="${t.id}">
              <div class="template-icon">${t.icon}</div>
              ${t.label}
            </div>`).join('')}
        </div>
        <input type="hidden" id="if-template" value="${template}" />
      </div>

      <!-- Tax rate -->
      <div class="form-group">
        <label class="form-label">${settings.tax_name || 'VAT'} Rate (%)</label>
        <input type="number" class="form-control" id="if-tax" value="${taxRate}"
          min="0" max="100" step="0.1" oninput="recalcTotals()" />
      </div>

      <!-- Line items -->
      <div class="form-group">
        <label class="form-label">Items</label>
        <table class="items-table" id="items-table">
          <thead>
            <tr>
              <th class="col-desc">Description</th>
              <th class="col-qty">Qty</th>
              <th class="col-price">Unit Price</th>
              <th class="col-total">Total</th>
              <th class="col-del"></th>
            </tr>
          </thead>
          <tbody id="items-body">
            ${items.map((it,i) => itemRow(i, it)).join('')}
          </tbody>
        </table>
        <button class="btn btn-ghost btn-sm" onclick="addItemRow()" style="margin-top:6px">＋ Add Line</button>
      </div>

      <!-- Totals -->
      <div class="totals-box">
        <div class="totals-row"><span>Subtotal</span><span id="t-sub">—</span></div>
        <div class="totals-row"><span>${settings.tax_name||'VAT'}</span><span id="t-tax">—</span></div>
        <div class="totals-row total"><span>Total</span><span id="t-total">—</span></div>
      </div>

      <!-- Notes -->
      <div class="form-group" style="margin-top:14px">
        <label class="form-label">Notes</label>
        <textarea class="form-control" id="if-notes" placeholder="Payment terms, bank details, etc.">${escHtml(inv?.notes || settings.payment_terms || '')}</textarea>
      </div>

      <div class="form-actions" style="margin-top:20px">
        <button class="btn btn-ghost btn-full" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary btn-full" onclick="saveInvoice(${id || 'null'})">
          ${id ? 'Save Changes' : 'Create Invoice'}
        </button>
      </div>
    `;

    recalcTotals();
  } catch (err) {
    document.getElementById('modal-content').innerHTML =
      `<div class="empty-state"><div class="empty-title">Failed to load form</div><div class="text-muted">${err.message}</div></div>`;
  }
}

/* ── Line item row HTML ─────────────────────────────────── */
function itemRow(i, it = {}) {
  return `
    <tr id="row-${i}">
      <td class="col-desc">
        <input type="text" placeholder="Description"
          value="${escHtml(it.description||'')}"
          data-field="desc" data-row="${i}" oninput="recalcTotals()" />
      </td>
      <td class="col-qty">
        <input type="number" value="${it.quantity||1}" min="0" step="any"
          data-field="qty" data-row="${i}" oninput="recalcTotals()" />
      </td>
      <td class="col-price">
        <input type="number" value="${it.unit_price||0}" min="0" step="0.01"
          data-field="price" data-row="${i}" oninput="recalcTotals()" />
      </td>
      <td class="col-total">
        <div class="item-total-cell" id="line-${i}">—</div>
      </td>
      <td class="col-del">
        <button class="btn-del-row" onclick="deleteItemRow(${i})">✕</button>
      </td>
    </tr>`;
}

let _rowCount = 1;

function addItemRow() {
  const tbody = document.getElementById('items-body');
  const i = _rowCount++;
  const tr = document.createElement('tr');
  tr.id = `row-${i}`;
  tr.innerHTML = itemRow(i).replace(`<tr id="row-${i}">`, '').replace('</tr>', '');
  // Re-create properly
  tbody.insertAdjacentHTML('beforeend', itemRow(i));
  recalcTotals();
}

function deleteItemRow(i) {
  const row = document.getElementById(`row-${i}`);
  if (row) row.remove();
  recalcTotals();
}

function selectTemplate(tplId) {
  document.querySelectorAll('.template-option').forEach(el => {
    el.classList.toggle('selected', el.dataset.tpl === tplId);
  });
  document.getElementById('if-template').value = tplId;
}

/* ── Recalculate totals ─────────────────────────────────── */
function recalcTotals() {
  const taxRate = parseFloat(document.getElementById('if-tax')?.value || 0);
  let subtotal  = 0;

  document.querySelectorAll('#items-body tr').forEach(tr => {
    const qty   = parseFloat(tr.querySelector('[data-field="qty"]')?.value   || 0);
    const price = parseFloat(tr.querySelector('[data-field="price"]')?.value || 0);
    const line  = qty * price;
    subtotal   += line;
    const rowId = tr.id.replace('row-','');
    const cell  = document.getElementById(`line-${rowId}`);
    if (cell) cell.textContent = fmtMoney(line);
  });

  const taxAmt = (subtotal * taxRate) / 100;
  const total  = subtotal + taxAmt;

  const sym = App.settings.currency_symbol || '£';
  document.getElementById('t-sub').textContent   = fmtMoney(subtotal);
  document.getElementById('t-tax').textContent   = fmtMoney(taxAmt);
  document.getElementById('t-total').textContent = fmtMoney(total);
}

/* ── Read line items from DOM ───────────────────────────── */
function readItems() {
  const items = [];
  document.querySelectorAll('#items-body tr').forEach(tr => {
    const desc  = tr.querySelector('[data-field="desc"]')?.value.trim();
    const qty   = parseFloat(tr.querySelector('[data-field="qty"]')?.value  || 0);
    const price = parseFloat(tr.querySelector('[data-field="price"]')?.value|| 0);
    if (desc || qty || price) {
      items.push({ description: desc || '', quantity: qty, unit_price: price });
    }
  });
  return items;
}

/* ── Save invoice ───────────────────────────────────────── */
async function saveInvoice(id) {
  const clientId  = document.getElementById('if-client').value;
  const client    = (App._clients||[]).find(c => c.id == clientId);
  const items     = readItems();

  if (!items.length) {
    showToast('Add at least one line item', 'error');
    return;
  }

  const body = {
    client_id:       clientId || null,
    client_snapshot: client || null,
    issue_date:      document.getElementById('if-issue').value,
    due_date:        document.getElementById('if-due').value,
    template:        document.getElementById('if-template').value,
    currency:        App.settings.currency        || 'GBP',
    currency_symbol: App.settings.currency_symbol || '£',
    tax_rate:        parseFloat(document.getElementById('if-tax').value || 0),
    notes:           document.getElementById('if-notes').value.trim(),
    items
  };

  try {
    if (id) {
      body.status = 'draft'; // keep status on edit via detail screen
      await API.updateInvoice(id, body);
      showToast('Invoice updated', 'success');
    } else {
      await API.createInvoice(body);
      showToast('Invoice created', 'success');
    }
    closeModal();
    App._invoices = await API.getInvoices();
    if (App.currentView === 'invoices')  renderInvoiceList();
    if (App.currentView === 'dashboard') renderDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

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
