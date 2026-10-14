/* ── App Guide ────────────────────────────────────────────
   The Flutter app's "App Guide", copied from it: five pages, each with
   the logo, a picture of a phone showing that part of the app, a title,
   page dots and Back / Next buttons in that page's colour.
   • Opened from the ⓘ icon in the top bar (where the Flutter app has it).
   • Opens by itself once, the very first time the app is used (no
     invoices, no details yet) — then the last button says "Let's Go!".
   • Swipe left/right or use Back / Next; ✕ or the phone's Back closes it.
   Sizes are the Flutter app's own (measured from its screenshots, in the
   same units CSS uses), so on a phone it lines up with the original.
──────────────────────────────────────────────────────────── */

const GUIDE_SEEN_KEY = 'invoicemate.guideSeen';

const GUIDE_ICONS = {
  close:   'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
  next:    'M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z',
  done:    'M16.59 7.58L10 14.17l-3.59-3.58L5 12l5 5 8-8zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z',
  trend:   'M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z',
  money:   'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z',
  bars:    'M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zm5.6 8H19v6h-2.8z',
  bank:    'M4 10v7h3v-7H4zm6 0v7h3v-7h-3zM2 22h19v-3H2v3zm14-12v7h3v-7h-3zm-4.5-9L2 6v2h19V6l-9.5-5z'
};
const gIcon = (name, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${GUIDE_ICONS[name]}"/></svg>`;

/* ── What's on each phone screen (the Flutter app's own example data) ── */
const gStatus = (dark) => `<div class="agm-status${dark ? ' agm-status-flat' : ''}"><span>14:36</span><span>72%🔋</span></div>`;
const gBar = (title, back = true, right = '') =>
  `<div class="agm-bar">${back ? '<span class="agm-arrow">←</span>' : ''}<span class="agm-bar-title">${title}</span>${right}</div>`;

const GUIDE_PAGES = [
  {
    color: '#2E4057', title: 'Welcome to InvoiceMate',
    screen: () => `${gStatus()}${gBar('Invoice Manager', false, '<span class="agm-bar-icons"><span>👤</span><span>📄</span></span>')}
      <div class="agm-list">
        ${[['B', '#2196F3', 'BlueSky Marketing', 'Website Development', '£413.25', 'INV-960100'],
           ['B', '#4CAF50', 'BlueSky Marketing', 'Logo Design', '£551.00', 'INV-606020'],
           ['T', '#FF9800', 'TechCorp Solutions', 'Mobile App Dev', '£1,250.00', 'INV-445890'],
           ['A', '#9C27B0', 'Apex Digital', 'Brand Identity', '£875.50', 'INV-223456']].map(([l, c, name, job, amt, no]) => `
          <div class="agm-inv">
            <span class="agm-avatar" style="background:${c}">${l}</span>
            <span class="agm-inv-mid"><b>${name}</b><i>${job}</i><span class="agm-draft">DRAFT</span></span>
            <span class="agm-inv-right"><b>${amt}</b><span>${no}</span></span>
          </div>`).join('')}
      </div>`
  },
  {
    color: '#048A81', title: 'Manage Your Details',
    screen: () => `${gStatus()}${gBar('My Details')}
      <div class="agm-details">
        <div class="agm-card agm-profile"><span class="agm-jd">JD</span><b>James Digital</b><span>james@digitalcreative.co.uk</span></div>
        <div class="agm-card agm-info"><b><span class="agm-emoji">🏢</span>Business Information</b><span>42 Innovation Drive</span><span>Manchester M1 5DN</span><span>07789 456123</span></div>
        <div class="agm-card agm-info"><b><span class="agm-emoji">🏦</span>Banking Details</b><span>Barclays Bank</span><span>Account: 12345678</span><span>Sort Code: 20 14 53</span></div>
      </div>`
  },
  {
    color: '#FF6B35', title: 'Create Beautiful Invoices',
    screen: () => `${gStatus()}${gBar('New Invoice')}
      <div class="agm-from">
        <div><b>James Digital</b><span>42 Innovation Drive</span><span>Manchester M1 5DN</span></div>
        <div class="agm-from-bank"><span>Bank: Barclays</span><span>Acc: 12345678</span></div>
      </div>
      <div class="agm-card agm-form"><b>Invoice Details</b><div class="agm-input">INV-621293</div></div>
      <div class="agm-card agm-form agm-items"><div class="agm-row"><b>Items</b><span class="agm-add">+ Add Item</span></div><div class="agm-total">Total: £0.00</div></div>`
  },
  {
    color: '#7209B7', title: 'Share & Print Instantly',
    screen: () => `${gStatus(true)}
      <div class="agm-bar agm-bar-dark"><span class="agm-arrow">←</span><span class="agm-bar-title">Invoice INV-621293</span><span class="agm-dots">⋮</span></div>
      <div class="agm-dark">
        <div class="agm-paper">
          <div class="agm-paper-head">
            <div><b class="agm-big">INVOICE</b><span># INV-621293</span></div>
            <div class="agm-paper-from"><b>James Digital</b><span>42 Innovation Drive</span><span>Manchester M1 5DN</span></div>
          </div>
          <div class="agm-billto"><span>BILL TO:</span><b>BlueSky Marketing</b></div>
          <div class="agm-paper-total">TOTAL: £416.25</div>
        </div>
      </div>
      <div class="agm-actions"><span class="agm-print">🖨️ Print</span><span class="agm-share">📧 Share</span></div>`
  },
  {
    color: '#1976D2', title: 'Track Your Income',
    screen: () => `${gStatus()}${gBar('Income Tracker', true, '<b class="agm-year">2025</b>')}
      <div class="agm-two">
        <div class="agm-card agm-stat"><span class="agm-stat-label" style="color:#2196F3">${gIcon('trend')}Total Income</span><b>£28,450.75</b><span>All invoices</span></div>
        <div class="agm-card agm-stat"><span class="agm-stat-label" style="color:#4CAF50">${gIcon('money')}Paid Income</span><b>£24,000.00</b><span>Tax reportable</span></div>
      </div>
      <div class="agm-card agm-chart">
        <b class="agm-chart-title">${gIcon('bars')}Monthly Income (2025)</b>
        <div class="agm-bars">${[21.3, 37.3, 29.7, 44.9, 40.7, 48.3, 33.9, 26.6].map((h, i) =>
          `<span><i style="height:${h}px"></i><em>${'JFMAMJJA'[i]}</em></span>`).join('')}</div>
      </div>
      <!-- The app's own Tax Summary (js/stats.js): on £24,000 paid, Income Tax
           20% after the £12,570 allowance = £2,286; National Insurance 6% = £685.80 -->
      <div class="agm-tax">
        <b class="agm-chart-title">${gIcon('bank')}Tax Summary (2025)</b>
        <div><span>Taxable Income (Paid):</span><b style="color:#4CAF50">£24,000.00</b></div>
        <div><span>Est. Income Tax:</span><b style="color:#F44336">£2,286.00</b></div>
        <div><span>Est. National Insurance:</span><b style="color:#F44336">£685.80</b></div>
        <div><span>VAT charged:</span><b style="color:#2196F3">£0.00</b></div>
      </div>`
  }
];

const Guide = {
  _open: false,
  index: 0,
  firstRun: false,

  /* ── Open / close ─────────────────────────────────────── */
  open(firstRun = false) {
    this.firstRun = firstRun;
    this.index = 0;
    const page = document.getElementById('guide-page');
    page.innerHTML = `
      <header class="ag-appbar">
        <button class="md-icon-btn" onclick="Guide.close()" aria-label="Close the guide">${gIcon('close')}</button>
      </header>
      <div class="ag-track" id="ag-track">
        ${GUIDE_PAGES.map((p, i) => `
          <section class="ag-slide" style="--ag:${p.color}" aria-label="Page ${i + 1} of ${GUIDE_PAGES.length}: ${escHtml(p.title)}">
            <div class="ag-brand"><img src="icons/icon-192.png" alt="" class="ag-logo" /><span>InvoiceMate</span></div>
            <div class="ag-phone-box"><div class="ag-phone"><div class="agm-screen">${p.screen()}</div></div></div>
            <h2 class="ag-title">${escHtml(p.title)}</h2>
          </section>`).join('')}
      </div>
      <div class="ag-foot">
        <div class="ag-dots">${GUIDE_PAGES.map((_, i) => `<span data-i="${i}"></span>`).join('')}</div>
        <div class="ag-btns" id="ag-btns"></div>
      </div>`;
    page.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    this._open = true;
    history.pushState({ page: 'guide' }, '');   // phone Back closes it

    const track = document.getElementById('ag-track');
    this._target = null;
    // Which page is showing as a finger swipes. While Next/Back is sliding
    // to a page, the positions on the way there are ignored — otherwise the
    // dots and colours flick back to the old page for a moment.
    track.addEventListener('scroll', () => {
      const w = Math.max(1, track.clientWidth);
      if (this._target !== null) {
        if (Math.abs(track.scrollLeft - this._target * w) < 2) this._target = null;   // arrived
        return;
      }
      const i = Math.max(0, Math.min(GUIDE_PAGES.length - 1, Math.round(track.scrollLeft / w)));
      if (i !== this.index) { this.index = i; this._paint(); }
    }, { passive: true });
    this._fit();
    this._paint();
  },

  close() {
    if (this._open) history.back();
  },

  _hide() {
    this._open = false;
    try { localStorage.setItem(GUIDE_SEEN_KEY, '1'); } catch (_) {}
    const page = document.getElementById('guide-page');
    page.classList.add('hidden');
    page.innerHTML = '';
    document.body.style.overflow = '';
  },

  // The very first time the app is used: show the guide once.
  async maybeFirstRun() {
    let seen = null;
    try { seen = localStorage.getItem(GUIDE_SEEN_KEY); } catch (_) {}
    if (seen || this._open || (typeof IP !== 'undefined' && IP.open)) return;
    const [settings, invoices] = await Promise.all([API.getSettings(), API.getInvoices()]);
    if (settings.company_name || invoices.length) {
      try { localStorage.setItem(GUIDE_SEEN_KEY, '1'); } catch (_) {}   // already in use — never show it by itself
      return;
    }
    this.open(true);
  },

  /* ── Moving between pages ─────────────────────────────── */
  go(i) {
    const track = document.getElementById('ag-track');
    this.index = Math.max(0, Math.min(GUIDE_PAGES.length - 1, i));
    this._target = this.index;
    clearTimeout(this._targetTimer);   // in case the slide is interrupted, listen again after a moment
    this._targetTimer = setTimeout(() => { this._target = null; }, 900);
    track.scrollTo({ left: this.index * track.clientWidth, behavior: 'smooth' });
    this._paint();
  },
  next() {
    if (this.index < GUIDE_PAGES.length - 1) this.go(this.index + 1);
    else this.close();                         // Done / Let's Go!
  },
  back() { this.go(this.index - 1); },

  // Colours, dots and buttons for the page showing.
  _paint() {
    const page = document.getElementById('guide-page');
    if (!page || !this._open) return;
    const p = GUIDE_PAGES[this.index];
    page.style.setProperty('--ag-c', p.color);
    page.querySelectorAll('.ag-dots span').forEach(d => d.classList.toggle('on', +d.dataset.i === this.index));
    const last = this.index === GUIDE_PAGES.length - 1;
    const label = last ? (this.firstRun ? "Let's Go!" : 'Done') : 'Next';
    document.getElementById('ag-btns').innerHTML = `
      ${this.index > 0 ? '<button class="ag-back" onclick="Guide.back()">Back</button>' : ''}
      <button class="ag-next" onclick="Guide.next()">${label}${gIcon(last ? 'done' : 'next')}</button>`;
  },

  // The phone picture is 300 × 428 — exactly the Flutter size on a phone.
  // On a shorter or narrower screen it shrinks to fit (never grows).
  _fit() {
    const page = document.getElementById('guide-page');
    if (!page || !this._open) return;
    const fixed = 56 + 17.4 + 53.6 + 17.2 + 100.1 + 127;   // everything else, top to bottom
    const s = Math.max(0.5, Math.min(1, (page.clientHeight - fixed) / 428, (page.clientWidth - 40) / 300));
    page.style.setProperty('--ag-s', s.toFixed(3));
    const track = document.getElementById('ag-track');
    if (track) track.scrollLeft = this.index * track.clientWidth;   // stay on the same page
  }
};

window.addEventListener('resize', () => Guide._fit());
window.addEventListener('popstate', () => {
  if (Guide._open) Guide._hide();
});
