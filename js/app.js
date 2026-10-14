/* ── Global state ───────────────────────────────────────── */
const App = {
  settings: {},
  currentView: 'dashboard'
};

// Shown small on the start screen, so it's easy to check which version a
// device is running. Keep in step with CACHE_NAME in sw.js.
const APP_VERSION = 'v11';   // keep in step with CACHE_NAME in sw.js

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
// One money format for the whole app, screens and PDFs alike, with
// thousands separators the way the Flutter app shows money: £1,234.56.
// Text symbols like "CHF" or "kr" get a space: CHF 1,234.56.
function formatMoney(amount, sym = '£') {
  const n = (parseFloat(amount) || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return /^[A-Za-z]/.test(sym) ? `${sym} ${n}` : `${sym}${n}`;
}

function fmtMoney(amount) {
  return formatMoney(amount, App.settings.currency_symbol || '£');
}

// The owner's address as one line: street, city, postcode (My Details
// keeps them separately, like the Flutter app).
function companyAddressLine(s) {
  return [s.company_address, s.company_city, s.company_postcode]
    .map(x => String(x || '').trim()).filter(Boolean).join(', ');
}

// Column names for line items. Bill by the Hour → Hours / Rate,
// Bill by Quantity → Qty / Unit Price. Invoices made before the setting
// existed have no billing_mode and keep their original Qty / Unit Price.
function unitLabels(mode) {
  return mode === 'hourly'
    ? { qty: 'Hours', price: 'Rate', priceShort: 'Rate' }
    : { qty: 'Qty',   price: 'Unit Price', priceShort: 'Price' };
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

    el.innerHTML = `
      <!-- Name on the left, "+ New Invoice" up here on the right, so the
           invoices below have the whole screen -->
      <div class="section-header dash-head">
        <div class="dash-who">
          <div class="section-title">${escHtml(settings.company_name || 'Invoice Manager')}</div>
          <div class="text-muted">${escHtml(settings.company_email || (settings.company_name ? '' : 'Add your details first — tap the person icon at the top'))}</div>
        </div>
        <button class="btn btn-primary dash-new" onclick="openInvoiceForm()">+ New Invoice</button>
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

      ${invoices.length === 0
        ? emptyState(ICONS.invoice, 'No invoices yet', 'Tap + New Invoice at the top to make your first one.')
        : `<div class="dash-grid" id="dash-grid">${invoices.map(inv => `
          <div class="list-item dash-card" onclick="openInvoiceDetail(${inv.id})">
            <div class="list-item-left">
              <div class="item-title">${escHtml(inv.invoice_number)}</div>
              <div class="item-sub dash-client">${escHtml(inv.client_name || 'No client')}</div>
              <div class="item-sub dash-date">${fmtDate(inv.issue_date)}</div>
            </div>
            <div class="list-item-right">
              <div class="item-amount">${fmtMoney(inv.total)}</div>
              <div class="mt-1">${badge(inv.status)}</div>
            </div>
          </div>`).join('')}</div>`
      }
    `;
    layoutDashboardGrid();
  } catch (err) {
    el.innerHTML = `<div class="empty-state">
      <div class="empty-title">Failed to load dashboard</div>
      <div class="text-muted">${err.message}</div>
    </div>`;
  }
}

/* ── Home: invoices in columns ──────────────────────────────
   The invoices go down one column until they reach the bottom bar, then
   carry on in a second column, then a third, and so on — so they're all
   on screen without scrolling. The page gets wider as columns are added.
   Only when there's no more room across (a phone, a narrow window) does
   the list grow downwards and scroll.
   Works it out again whenever the window changes size. */
const DASH_GRID = {
  colMin:   220,   // narrowest a card may get (px)
  colIdeal: 330,   // comfortable card width when there's room
  gap:      10,    // space between columns
  rowGap:   8,     // space between cards in a column
  maxPage:  2000   // the page never gets wider than this (more columns before any scrolling)
};

function layoutDashboardGrid() {
  const view = document.getElementById('view-dashboard');
  const grid = document.getElementById('dash-grid');
  if (!grid || view.classList.contains('hidden')) return;
  const n = grid.children.length;
  const G = DASH_GRID;

  // Measure from a plain single stack, at the usual page width.
  view.style.maxWidth = '';
  grid.style.gridTemplateColumns = grid.style.gridTemplateRows = grid.style.gridAutoFlow = '';

  // Room across: the window less the page's 16px side padding.
  const fullW   = Math.min(window.innerWidth, G.maxPage) - 32;
  const maxCols = Math.max(1, Math.floor((fullW + G.gap) / (G.colMin + G.gap)));

  // Room down: from the top of the first card to the bottom of the screen,
  // less the space kept free under the page (the bottom bar + the raised
  // Home button) and the page's own bottom padding.
  const px      = (el, prop) => parseFloat(getComputedStyle(el)[prop]) || 0;
  const barRoom = px(document.querySelector('main'), 'paddingBottom') + px(view, 'paddingBottom');
  const top     = grid.getBoundingClientRect().top + window.scrollY;
  const cardH   = Math.max(...Array.from(grid.children, c => c.offsetHeight));
  const fitRows = Math.max(2, Math.floor((window.innerHeight - top - barRoom + G.rowGap) / (cardH + G.rowGap)));

  // Fill a column to the bottom, then start the next one…
  let cols = Math.ceil(n / fitRows);
  let rows = cols > 1 ? fitRows : n;
  // …unless that's more columns than fit across: then use every column
  // there's room for and let the list scroll.
  if (cols > maxCols) { cols = maxCols; rows = Math.ceil(n / cols); }

  // Widen the page for the extra columns (one column keeps the usual 680px).
  const wanted = cols * G.colIdeal + (cols - 1) * G.gap + 32;
  view.style.maxWidth = cols > 1 ? `${Math.min(Math.max(680, wanted), fullW + 32)}px` : '';

  grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
  grid.style.gridTemplateRows    = `repeat(${rows}, auto)`;
  grid.style.gridAutoFlow        = 'column';   // fill down each column first
  grid.dataset.cols = cols;   // (handy for checking: how many columns are showing)
  grid.dataset.rows = rows;
}

// Window resized / phone turned: lay the columns out again.
let _dashResizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(_dashResizeTimer);
  _dashResizeTimer = setTimeout(() => { if (App.currentView === 'dashboard') layoutDashboardGrid(); }, 150);
});

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
    // When an update arrives, the new service worker takes over this page
    // straight away — but the page itself was loaded from the old files.
    // Reload once so it's running the new version (an unfinished invoice
    // is saved, and comes back after Go). Only for an UPDATE: on a very
    // first visit the first takeover is just the app being set up for
    // offline use, so that one only marks the page as covered.
    let covered = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!covered) { covered = true; return; }
      if (reloaded) return;
      reloaded = true;
      location.reload();
    });
    navigator.serviceWorker.register('sw.js').catch(console.error);
  }
  document.getElementById('app-version').textContent = APP_VERSION;

  // All the data lives in this browser's storage. Asking for "persistent"
  // storage tells Chrome not to clear it to free up space. (Installed apps
  // usually get this automatically; it's a no-op where unsupported.)
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }

  try { App.settings = await API.getSettings(); } catch (_) {}

  navigate('dashboard');
  // Start screen: logo + Go button, or the PIN keypad if a PIN is set; it
  // also comes back after a minute idle (js/lock.js). The dashboard is
  // already drawn underneath, so it's ready the moment Go is pressed —
  // and an unfinished invoice reopens then too (resumeDraftIfAny).
  Lock.start();
});
