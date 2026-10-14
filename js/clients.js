/* ── Client List ────────────────────────────────────────── */
async function renderClientList() {
  const el = document.getElementById('view-clients');
  el.innerHTML = spinner();

  try {
    const clients = await API.getClients();
    App._clients = clients; // cache for invoice form

    el.innerHTML = `
      <div class="section-header">
        <div class="section-title">Clients</div>
        <button class="btn btn-primary btn-sm" onclick="openClientForm()">+ Add</button>
      </div>

      <div class="search-box">
        <span class="search-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
        <input type="text" id="client-search" placeholder="Search clients…" oninput="filterClients(this.value)" />
      </div>

      <div id="client-list">
        ${renderClientItems(clients)}
      </div>
    `;
  } catch (err) {
    el.innerHTML = `<div class="empty-state">
      <div class="empty-title">Failed to load clients</div>
      <div class="text-muted">${err.message}</div>
    </div>`;
  }
}

function renderClientItems(clients) {
  if (!clients.length) {
    return emptyState('👥', 'No clients yet', 'Add your first client to get started.', '+ Add Client', 'openClientForm()');
  }
  return clients.map(c => `
    <div class="list-item" onclick="openClientDetail(${c.id})">
      <div class="list-item-left">
        <div class="item-title">${c.name}</div>
        <div class="item-sub">
          ${[c.email, c.city].filter(Boolean).join(' · ') || 'No contact info'}
        </div>
      </div>
      <div class="list-item-right" style="color:var(--text-muted);font-size:1.2rem">›</div>
    </div>
  `).join('');
}

function filterClients(q) {
  const filtered = (App._clients || []).filter(c =>
    c.name.toLowerCase().includes(q.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(q.toLowerCase()) ||
    (c.city || '').toLowerCase().includes(q.toLowerCase())
  );
  document.getElementById('client-list').innerHTML = renderClientItems(filtered);
}

/* ── Client Detail ──────────────────────────────────────── */
async function openClientDetail(id) {
  const c = (App._clients || []).find(c => c.id === id) || await API.getClient(id);

  openModal(`
    <div class="action-row">
      <button class="btn btn-outline btn-sm" onclick="openClientForm(${c.id})">Edit</button>
      <button class="btn btn-danger btn-sm" onclick="confirmDeleteClient(${c.id}, '${escHtml(c.name)}')">Delete</button>
    </div>

    <div class="card">
      ${row('Name', c.name)}
      ${c.email   ? row('Email',    `<a href="mailto:${c.email}" style="color:var(--accent)">${c.email}</a>`) : ''}
      ${c.phone   ? row('Phone',    `<a href="tel:${c.phone}" style="color:var(--accent)">${c.phone}</a>`) : ''}
      ${c.address ? row('Address',  c.address) : ''}
      ${c.city    ? row('City',     c.city) : ''}
      ${c.postcode? row('Postcode', c.postcode) : ''}
      ${c.country ? row('Country',  c.country) : ''}
      ${c.notes   ? row('Notes',    c.notes) : ''}
    </div>
  `, c.name);
}

function row(label, val) {
  return `
    <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.9rem;gap:12px">
      <span style="color:var(--text-muted);flex-shrink:0">${label}</span>
      <span style="text-align:right">${val}</span>
    </div>`;
}

/* ── Client Form (add / edit) ───────────────────────────── */
async function openClientForm(id = null) {
  let c = { country: 'United Kingdom' };
  if (id) {
    c = (App._clients || []).find(x => x.id === id) || await API.getClient(id);
  }

  openModal(`
    <div class="form-group">
      <label class="form-label">Name *</label>
      <input class="form-control" id="cf-name" value="${escHtml(c.name || '')}" placeholder="Client name" />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Email</label>
        <input class="form-control" id="cf-email" type="email" value="${escHtml(c.email || '')}" placeholder="email@example.com" />
      </div>
      <div class="form-group">
        <label class="form-label">Phone</label>
        <input class="form-control" id="cf-phone" type="tel" value="${escHtml(c.phone || '')}" placeholder="+44…" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Address</label>
      <input class="form-control" id="cf-address" value="${escHtml(c.address || '')}" placeholder="Street address" />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">City</label>
        <input class="form-control" id="cf-city" value="${escHtml(c.city || '')}" placeholder="City" />
      </div>
      <div class="form-group">
        <label class="form-label">Postcode</label>
        <input class="form-control" id="cf-postcode" value="${escHtml(c.postcode || '')}" placeholder="Postcode" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Country</label>
      <input class="form-control" id="cf-country" value="${escHtml(c.country || 'United Kingdom')}" />
    </div>
    <div class="form-group">
      <label class="form-label">Notes</label>
      <textarea class="form-control" id="cf-notes" placeholder="Any notes about this client…">${escHtml(c.notes || '')}</textarea>
    </div>
    <div class="form-actions">
      <button class="btn btn-primary btn-full" onclick="saveClient(${id || 'null'})">
        ${id ? 'Save Changes' : 'Add Client'}
      </button>
    </div>
  `, id ? 'Edit Client' : 'New Client');

  document.getElementById('cf-name').focus();
}

/* ── Save client ────────────────────────────────────────── */
async function saveClient(id) {
  const name = document.getElementById('cf-name').value.trim();
  if (!name) { showToast('Client name is required', 'error'); return; }

  const body = {
    name,
    email:    document.getElementById('cf-email').value.trim(),
    phone:    document.getElementById('cf-phone').value.trim(),
    address:  document.getElementById('cf-address').value.trim(),
    city:     document.getElementById('cf-city').value.trim(),
    postcode: document.getElementById('cf-postcode').value.trim(),
    country:  document.getElementById('cf-country').value.trim(),
    notes:    document.getElementById('cf-notes').value.trim()
  };

  try {
    if (id) {
      await API.updateClient(id, body);
      showToast('Client updated', 'success');
    } else {
      await API.createClient(body);
      showToast('Client added', 'success');
    }
    closeModal();
    renderClientList();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ── Delete client ──────────────────────────────────────── */
function confirmDeleteClient(id, name) {
  openModal(`
    <div style="text-align:center;padding:16px 0">
      <div style="font-size:2rem;margin-bottom:12px">⚠️</div>
      <div class="bold" style="margin-bottom:8px">Delete "${name}"?</div>
      <div class="text-muted" style="margin-bottom:24px;font-size:0.9rem">
        This cannot be undone. Invoices linked to this client will not be deleted.
      </div>
      <div class="form-actions">
        <button class="btn btn-ghost btn-full" onclick="closeModal()">Cancel</button>
        <button class="btn btn-danger btn-full" onclick="deleteClient(${id})">Delete</button>
      </div>
    </div>
  `);
}

async function deleteClient(id) {
  try {
    await API.deleteClient(id);
    showToast('Client deleted');
    closeModal();
    renderClientList();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ── Helpers ────────────────────────────────────────────── */
function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
