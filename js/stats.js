/* ── Statistics page ──────────────────────────────────────
   What's been invoiced, year by year — opened from the chart icon in the
   top bar (where the Flutter app has its statistics icon). A full page on
   top of the app; the phone's Back button closes it, because opening it
   adds a step to the browser history (same as My Details).

   Two ways to count a year (the choice is remembered on this device):
   • Calendar year — 1 January to 31 December.
   • Tax year — the UK tax year, 6 April to 5 April: the one Self
     Assessment asks about.
   An invoice counts in the year of its issue date. Cancelled invoices
   don't count; everything else does, drafts included.
──────────────────────────────────────────────────────────── */

const ST_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                   'July', 'August', 'September', 'October', 'November', 'December'];
const ST_MODE_KEY = 'invoicemate.statsMode';

const Stats = {
  _open: false,
  mode: 'calendar',   // 'calendar' or 'tax'
  key: null,          // the year being looked at (for a tax year: the year it starts)
  month: null,        // the month picked on the chart (index into that year's months)
  invoices: [],
  sym: '£',

  /* ── Open / close ─────────────────────────────────────── */
  async open() {
    const [invoices, settings] = await Promise.all([API.getInvoices(), API.getSettings()]);
    this.invoices = invoices.filter(i => i.status !== 'cancelled' && i.issue_date);
    this.sym = settings.currency_symbol || '£';
    try { this.mode = localStorage.getItem(ST_MODE_KEY) === 'tax' ? 'tax' : 'calendar'; } catch (_) {}
    this.key = null;
    this.month = null;
    this.render();
    document.getElementById('stats-page').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    this._open = true;
    history.pushState({ page: 'stats' }, '');   // phone Back closes the page
  },

  close() {
    if (this._open) history.back();
  },

  _hide() {
    this._open = false;
    const page = document.getElementById('stats-page');
    page.classList.add('hidden');
    page.innerHTML = '';
    document.body.style.overflow = '';
  },

  /* ── Which year / month an invoice belongs to ─────────── */
  _parts(iso) {
    return { y: +iso.slice(0, 4), m: +iso.slice(5, 7), d: +iso.slice(8, 10) };
  },

  // The year an issue date counts in. A tax year is named by the year it
  // starts: 6 Apr 2025 – 5 Apr 2026 is 2025 (shown as "2025/26").
  yearOf(iso) {
    const { y, m, d } = this._parts(iso);
    if (this.mode === 'calendar') return y;
    return (m > 4 || (m === 4 && d >= 6)) ? y : y - 1;
  },

  label(key) {
    return this.mode === 'calendar' ? String(key) : `${key}/${String(key + 1).slice(2)}`;
  },

  // The year's months, in order, for the chart. A tax year runs April to
  // March, plus 1–5 April at the very end (shown only if anything's in it).
  monthsOf(key) {
    if (this.mode === 'calendar') {
      return ST_MONTHS.map((name, i) => ({ short: name.slice(0, 3), long: `${name} ${key}` }));
    }
    const list = [];
    for (let i = 0; i < 12; i++) {
      const m = (3 + i) % 12;                     // April = 3 … March = 2
      const y = m >= 3 ? key : key + 1;
      list.push({ short: ST_MONTHS[m].slice(0, 3), long: `${ST_MONTHS[m]} ${y}` + (i === 0 ? ' (from the 6th)' : '') });
    }
    list.push({ short: 'Apr', long: `1–5 April ${key + 1}`, tail: true });
    return list;
  },

  monthIndex(iso) {
    const { m, d } = this._parts(iso);
    if (this.mode === 'calendar') return m - 1;
    if (m === 4 && d < 6) return 12;              // 1–5 April: the tax year's last few days
    return (m - 4 + 12) % 12;
  },

  /* ── Adding up ────────────────────────────────────────── */
  _sum(list) {
    const n = v => parseFloat(v) || 0;
    const t = { total: 0, vat: 0, expenses: 0, paid: 0, count: list.length, anyPaid: false };
    for (const inv of list) {
      t.total += n(inv.total);
      t.vat   += n(inv.tax_amount);
      t.expenses += (inv.expenses || []).reduce((s, x) => s + n(x.amount), 0);
      if (inv.status === 'paid') { t.paid += n(inv.total); t.anyPaid = true; }
    }
    t.work = t.total - t.vat - t.expenses;        // what the work itself brought in
    return t;
  },

  years() {
    const map = new Map();
    for (const inv of this.invoices) {
      const k = this.yearOf(inv.issue_date);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(inv);
    }
    return [...map.entries()].sort((a, b) => b[0] - a[0])
      .map(([key, list]) => ({ key, list, ...this._sum(list) }));
  },

  // Is today inside that year? (Then its figures are "so far".)
  _todayIso() { return todayISO(); },
  isCurrent(key) { return this.yearOf(this._todayIso()) === key; },

  // The year before, up to the same day — a fair comparison for a year
  // that isn't finished yet (October against all of last year would always
  // look like a drop).
  _lastYearSoFar(key) {
    const t = this._todayIso();
    const cutoff = `${+t.slice(0, 4) - 1}${t.slice(4)}`;
    return this._sum(this.invoices.filter(i => this.yearOf(i.issue_date) === key - 1 && i.issue_date <= cutoff));
  },

  /* ── Drawing ──────────────────────────────────────────── */
  money(v) { return formatMoney(v, this.sym); },

  render() {
    const page = document.getElementById('stats-page');
    const years = this.years();
    if (this.key === null || !years.some(y => y.key === this.key)) {
      this.key = years.length ? years[0].key : this.yearOf(this._todayIso());
      this.month = null;
    }
    const yr = years.find(y => y.key === this.key);

    page.innerHTML = `
      <header class="md-appbar">
        <button class="md-icon-btn" onclick="Stats.close()" aria-label="Back">${mdIcon('back')}</button>
        <h1>Statistics</h1>
      </header>
      <div class="md-body st-body">
        <div class="st-toggle" role="group" aria-label="Count years by">
          <button class="${this.mode === 'calendar' ? 'on' : ''}" onclick="Stats.setMode('calendar')">Calendar year</button>
          <button class="${this.mode === 'tax' ? 'on' : ''}" onclick="Stats.setMode('tax')">Tax year <small>6 Apr – 5 Apr</small></button>
        </div>
        ${years.length === 0 ? `
          <section class="st-card st-empty">
            <strong>No invoices yet</strong>
            <span>Once you've made some, what you invoice each year shows up here.</span>
          </section>` : `
          ${this.yearsCard(years)}
          ${this.yearCard(yr, years)}
          ${this.monthsCard(yr)}
          ${this.clientsCard(yr)}`}
      </div>`;
    this._showMonth();
  },

  // Every year side by side; tap one to look at it below.
  yearsCard(years) {
    const max = Math.max(...years.map(y => y.total), 1);
    return `
      <section class="st-card">
        <h2>Year by year</h2>
        <div class="st-years">
          ${years.map(y => `
            <button class="st-year ${y.key === this.key ? 'on' : ''}" onclick="Stats.pickYear(${y.key})"
                    aria-pressed="${y.key === this.key}">
              <span class="st-year-name">${this.label(y.key)}${this.isCurrent(y.key) ? ' <small>so far</small>' : ''}</span>
              <span class="st-year-track"><span class="st-year-bar" style="width:${Math.max(2, y.total / max * 100)}%"></span></span>
              <span class="st-year-amt">${this.money(y.total)}</span>
            </button>`).join('')}
        </div>
      </section>`;
  },

  // The chosen year in detail.
  yearCard(yr) {
    const current = this.isCurrent(yr.key);
    const name = this.mode === 'calendar' ? yr.key : `the ${this.label(yr.key)} tax year`;
    let compare = '';
    const before = current ? this._lastYearSoFar(yr.key) : (this.years().find(y => y.key === yr.key - 1) || null);
    if (before && before.total > 0) {
      const pct = Math.round((yr.total - before.total) / before.total * 100);
      const prev = this.label(yr.key - 1);
      compare = `<div class="st-compare">${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct)}% ${pct >= 0 ? 'up' : 'down'} on ${current ? `the same time in ${prev}` : prev}</div>`;
    }
    const facts = [
      ['Invoices', String(yr.count)],
      ['Average invoice', this.money(yr.total / yr.count)],
      ['Work', this.money(yr.work)]
    ];
    if (yr.expenses) facts.push(['Expenses', this.money(yr.expenses)]);
    if (yr.vat)      facts.push(['VAT', this.money(yr.vat)]);
    if (yr.anyPaid) {
      facts.push(['Paid', this.money(yr.paid)]);
      facts.push(['Still to be paid', this.money(yr.total - yr.paid)]);
    }
    return `
      <section class="st-card">
        <div class="st-kicker">${this.mode === 'tax'
          ? `Tax year ${this.label(yr.key)} · 6 Apr ${yr.key} – 5 Apr ${yr.key + 1}`
          : `${yr.key} · 1 Jan – 31 Dec`}</div>
        <div class="st-hero">${this.money(yr.total)}</div>
        <div class="st-hero-sub">invoiced in ${name}${current ? ' so far' : ''}</div>
        ${compare}
        <div class="st-facts">
          ${facts.map(([k, v]) => `<div><span>${k}</span><strong>${v}</strong></div>`).join('')}
        </div>
      </section>`;
  },

  // Month by month: one bar per month; tap (or point at) a bar to see it.
  monthsCard(yr) {
    const months = this.monthsOf(yr.key).map(m => ({ ...m, total: 0, count: 0 }));
    for (const inv of yr.list) {
      const b = months[this.monthIndex(inv.issue_date)];
      b.total += parseFloat(inv.total) || 0;
      b.count++;
    }
    if (!months[12] || !months[12].count) months.length = Math.min(months.length, 12);
    this._months = months;

    // Which month to show first: this month if it's this year, otherwise
    // the last month that had anything.
    if (this.month === null || this.month >= months.length) {
      const today = this._todayIso();
      this.month = this.isCurrent(yr.key) ? this.monthIndex(today)
        : Math.max(0, months.map(m => m.count > 0).lastIndexOf(true));
    }

    // A little headroom, so the tallest month never touches the top line.
    const top = stNiceMax(Math.max(...months.map(m => m.total)) * 1.08);
    return `
      <section class="st-card">
        <h2>Month by month</h2>
        <div class="st-readout" id="st-readout" aria-live="polite"></div>
        <div class="st-chart">
          <div class="st-grid">
            <div class="st-gridline" style="bottom:100%"><span>${this.money(top).replace(/\.00$/, '')}</span></div>
            <div class="st-gridline" style="bottom:50%"><span>${this.money(top / 2).replace(/\.00$/, '')}</span></div>
          </div>
          <div class="st-bars">
            ${months.map((m, i) => `
              <button class="st-col ${i === this.month ? 'on' : ''}" data-i="${i}"
                      onclick="Stats.pickMonth(${i})" onmouseenter="Stats.pickMonth(${i})"
                      aria-label="${m.long}: ${this.money(m.total)}">
                <span class="st-bar" style="height:${m.total > 0 ? Math.max(1.5, m.total / top * 100) : 0}%"></span>
              </button>`).join('')}
          </div>
        </div>
        <!-- "Jan" on wider screens, "J" on a phone (three letters don't fit 12 bars there) -->
        <div class="st-xlabels">${months.map((m, i) => `<span class="${i === this.month ? 'on' : ''}"><b class="st-x-long">${m.short}</b><b class="st-x-short">${m.short[0]}</b></span>`).join('')}</div>
        <details class="st-list">
          <summary>Show the months as a list</summary>
          <table>
            ${months.map(m => `<tr><td>${m.long}</td><td>${m.count} invoice${m.count === 1 ? '' : 's'}</td><td>${this.money(m.total)}</td></tr>`).join('')}
            <tr class="st-list-total"><td>Total</td><td>${yr.count}</td><td>${this.money(yr.total)}</td></tr>
          </table>
        </details>
      </section>`;
  },

  clientsCard(yr) {
    const map = new Map();
    for (const inv of yr.list) {
      const name = inv.client_name || 'No client';
      const c = map.get(name) || { name, total: 0, count: 0 };
      c.total += parseFloat(inv.total) || 0;
      c.count++;
      map.set(name, c);
    }
    const list = [...map.values()].sort((a, b) => b.total - a.total);
    const top = list.slice(0, 5);
    const max = Math.max(...top.map(c => c.total), 1);
    return `
      <section class="st-card">
        <h2>Top clients</h2>
        ${top.map(c => `
          <div class="st-client">
            <div class="st-client-row">
              <span class="st-client-name">${escHtml(c.name)}</span>
              <span class="st-client-amt">${this.money(c.total)}</span>
            </div>
            <div class="st-client-sub">${c.count} invoice${c.count === 1 ? '' : 's'} · ${Math.round(c.total / yr.total * 100) || 0}% of the year</div>
            <span class="st-client-track"><span class="st-year-bar" style="width:${Math.max(2, c.total / max * 100)}%"></span></span>
          </div>`).join('')}
        ${list.length > 5 ? `<div class="st-more">and ${list.length - 5} more client${list.length - 5 === 1 ? '' : 's'}</div>` : ''}
      </section>`;
  },

  // Fills in the line above the chart for the picked month.
  _showMonth() {
    const m = this._months && this._months[this.month];
    const el = document.getElementById('st-readout');
    if (!m || !el) return;
    el.innerHTML = `<strong>${m.long}</strong> <span>${this.money(m.total)} · ${m.count} invoice${m.count === 1 ? '' : 's'}</span>`;
  },

  /* ── Taps ─────────────────────────────────────────────── */
  setMode(mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    try { localStorage.setItem(ST_MODE_KEY, mode); } catch (_) {}
    this.key = null;            // jump to the newest year in the new way of counting
    this.render();
  },

  pickYear(key) {
    this.key = key;
    this.month = null;
    this.render();
  },

  pickMonth(i) {
    this.month = i;
    document.querySelectorAll('#stats-page .st-col').forEach(b => b.classList.toggle('on', +b.dataset.i === i));
    document.querySelectorAll('#stats-page .st-xlabels span').forEach((s, j) => s.classList.toggle('on', j === i));
    this._showMonth();
  }
};

// A round number just above the biggest month, for the chart's top line:
// 1,840 → 2,000; 4,350 → 5,000; 130 → 150.
function stNiceMax(v) {
  if (!(v > 0)) return 100;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

window.addEventListener('popstate', () => {
  if (Stats._open) Stats._hide();
});
