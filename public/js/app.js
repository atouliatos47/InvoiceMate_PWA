/* ── Global state ───────────────────────────────────────── */
const App = {
  settings: {},
  currentView: 'dashboard'
};

/* ── Toast ──────────────────────────────────────────────── */
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type}`;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 3000);
}

/* ── Modal ──────────────────────────────────────────────── */
function openModal(html, title = '') {
  const overlay = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');
  content.innerHTML = (title ? `<div class="modal-title">${title}</div>` : '') + html;
  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('modal-content').innerHTML = '';
  document.body.style.overflow = '';
}

/* ── Navigation ─────────────────────────────────────────── */
function navigate(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.view === view);
  });
  const el = document.getElementById(`view-${view}`);
  if (el) el.classList.remove('hidden');
  App.currentView = view;
  switch (view) {
    case 'dashboard': renderDashboard(); break;
    case 'invoices':  renderInvoiceList(); break;
    case 'clients':   renderClientList(); break;
    case 'settings':  renderSettings(); break;
  }
}

/* ── Formatters ─────────────────────────────────────────── */
function fmtMoney(amount) {
  const sym = App.settings.currency_symbol || '£';
  return `${sym}${parseFloat(amount || 0).toFixed(2)}`;
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

function badge(status) {
  return `<span class="badge badge-${status}">${status}</span>`;
}

function spinner() {
  return `<div class="spinner"></div>`;
}

/* ── Empty state (SVG icon, no emoji) ──────────────────── */
function emptyState(svgPath, title, sub, btnLabel, btnAction) {
  return `
    <div class="empty-state">
      <div class="empty-icon">
        <svg viewBox="0 0 24 24"><path d="${svgPath}"/></svg>
      </div>
      <div class="empty-title">${title}</div>
      <div class="empty-sub">${sub}</div>
      ${btnLabel ? `<button class="btn btn-primary" onclick="${btnAction}">${btnLabel}</button>` : ''}
    </div>`;
}

const ICONS = {
  invoice: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
  client:  'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
};

/* ── Dashboard ──────────────────────────────────────────── */
async function renderDashboard() {
  const el = document.getElementById('view-dashboard');
  el.innerHTML = spinner();

  try {
    const [invoices, settings] = await Promise.all([
      API.getInvoices(),
      API.getSettings()
    ]);
    App.settings = settings;

    const total     = invoices.reduce((s, i) => s + parseFloat(i.total || 0), 0);
    const paid      = invoices.filter(i => i.status === 'paid');
    const paidTotal = paid.reduce((s, i) => s + parseFloat(i.total || 0), 0);
    const overdue   = invoices.filter(i => i.status === 'overdue');
    const draft     = invoices.filter(i => i.status === 'draft');
    const recent    = invoices.slice(0, 5);

    el.innerHTML = `
      <div class="section-header" style="margin-bottom:20px">
        <div>
          <div class="section-title">${settings.company_name || 'Invoice Manager'}</div>
          <div class="text-muted">${settings.company_email || 'Set up your company in Settings'}</div>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${fmtMoney(total)}</div>
          <div class="stat-label">Total Invoiced</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color:var(--success)">${fmtMoney(paidTotal)}</div>
          <div class="stat-label">Paid</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color:var(--danger)">${overdue.length}</div>
          <div class="stat-label">Overdue</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color:var(--text-muted)">${draft.length}</div>
          <div class="stat-label">Drafts</div>
        </div>
      </div>

      <div class="section-header">
        <div class="card-title">Recent Invoices</div>
        <button class="btn btn-outline btn-sm" onclick="navigate('invoices')">View all</button>
      </div>

      ${recent.length === 0
        ? emptyState(ICONS.invoice, 'No invoices yet', 'Create your first invoice to get started.', '+ New Invoice', "navigate('invoices')")
        : recent.map(inv => `
          <div class="list-item" onclick="openInvoiceDetail(${inv.id})">
            <div class="list-item-left">
              <div class="item-title">${inv.invoice_number}</div>
              <div class="item-sub">${inv.client_name || 'No client'} &middot; ${fmtDate(inv.issue_date)}</div>
            </div>
            <div class="list-item-right">
              <div class="item-amount">${fmtMoney(inv.total)}</div>
              <div class="mt-1">${badge(inv.status)}</div>
            </div>
          </div>`).join('')
      }

      <div style="margin-top:16px">
        <button class="btn btn-primary btn-full" onclick="navigate('invoices');setTimeout(openInvoiceForm,100)">
          + New Invoice
        </button>
      </div>
    `;
  } catch (err) {
    el.innerHTML = `<div class="empty-state">
      <div class="empty-title">Failed to load dashboard</div>
      <div class="text-muted">${err.message}</div>
    </div>`;
  }
}

/* ── Boot ───────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.view));
  });

  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  });

  // PWA install prompt
  let deferredPrompt;
  const installBtn = document.getElementById('install-btn');
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.classList.remove('hidden');
  });
  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') installBtn.classList.add('hidden');
    deferredPrompt = null;
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(console.error);
  }

  try { App.settings = await API.getSettings(); } catch (_) {}

  navigate('dashboard');
});
