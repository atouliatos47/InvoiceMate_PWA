/* ── New Invoice / Edit Invoice page ──────────────────────
   Laid out exactly like the Flutter app's New Invoice screen, so anyone
   moving across from it isn't confused:

     ← New Invoice
     Invoice Details   Invoice Number (editable), Issue Date (calendar)
     Client Details    Client Name
     Items      + Add Item
       [ Description
         Date | Hours | Rate (£)          ← one row per entry
                              Add Entry ]
       VAT        VAT %
       Expenses   + Add Expense
       Subtotal: £0.00
       Total: £0.00
     [ Save Invoice ]

   How it works: everything typed lives in ONE object, IP.state. The page
   is drawn from it; typing updates it (one listener for the whole page);
   adding or removing an item/entry/expense changes the state and redraws
   that list. The unfinished-invoice draft is simply IP.state saved on
   the device as you type (see Draft at the bottom), which is why a
   half-typed invoice survives the start screen, the Back arrow, and even
   Android closing the app.

   Bill by the Hour (My Details) gives Hours / Rate columns; Bill by
   Quantity gives Qty / Price. Saving turns items + entries + expenses into
   invoice lines (js/api.js, flattenLines) for the PDFs and invoice screen.
──────────────────────────────────────────────────────────── */

const IP_ICONS = {
  back:     'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z',
  add:      'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
  calendar: 'M20 3h-1V1h-2v2H7V1H5v2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 18H4V8h16v13z',
  save:     'M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z',
  close:    'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z'
};
const ipIcon = (name, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${IP_ICONS[name]}"/></svg>`;
const todayISO = () => new Date().toISOString().slice(0, 10);

const IP = {
  open: false,
  state: null,       // everything on the form — see blankState()
  settings: {},
  clients: [],

  blankState(settings, number) {
    return {
      id: null,
      invoice_number: number,
      issue_date: todayISO(),
      client_name: '',
      // Always empty, like Hours / Rate — VAT only counts once it's typed in.
      tax_rate: '',
      billing_mode: settings.invoice_mode || 'hourly',
      groups: [{ description: '', entries: [{ date: todayISO(), quantity: '', unit_price: '' }] }],
      expenses: []
    };
  },

  // An invoice made before this page existed has plain lines, not items
  // with entries: each line becomes one item with one entry.
  stateFromInvoice(inv) {
    const groups = inv.groups && inv.groups.length ? inv.groups
      : (inv.items || []).map(it => ({
          description: it.description || '',
          entries: [{ date: inv.issue_date || todayISO(), quantity: String(it.quantity ?? ''), unit_price: String(it.unit_price ?? '') }]
        }));
    return {
      id: inv.id,
      invoice_number: inv.invoice_number,
      issue_date: (inv.issue_date || todayISO()).slice(0, 10),
      client_name: (inv.client_snapshot && inv.client_snapshot.name) || '',
      tax_rate: Number(inv.tax_rate) > 0 ? String(inv.tax_rate) : '',
      billing_mode: inv.billing_mode || 'quantity',
      groups: groups.length ? groups : [{ description: '', entries: [{ date: todayISO(), quantity: '', unit_price: '' }] }],
      expenses: inv.expenses || []
    };
  },

  /* ── Open / close ─────────────────────────────────────── */
  async openPage(id = null) {
    const [settings, clients, inv] = await Promise.all([
      API.getSettings(), API.getClients(), id ? API.getInvoice(id) : Promise.resolve(null)
    ]);
    this.settings = settings;
    this.clients = clients;
    this.invoice = inv;

    // An unfinished version of THIS form (same invoice, or both "new")?
    const saved = Draft.get();
    const draft = saved && (saved.id || null) === (id || null) ? saved : null;
    this.state = draft || (inv ? this.stateFromInvoice(inv) : this.blankState(settings, await API.nextInvoiceNumber()));
    this.render(!!draft);

    if (!this.open) {
      document.getElementById('invoice-page').classList.remove('hidden');
      document.body.style.overflow = 'hidden';
      this.open = true;
      history.pushState({ page: 'invoice' }, '');   // phone Back closes the page
    }
  },

  // Back arrow / phone Back. What was typed stays as a draft.
  close() {
    if (this.open) history.back();
  },

  _hide() {
    this.open = false;
    document.getElementById('invoice-page').classList.add('hidden');
    document.getElementById('invoice-page').innerHTML = '';
    document.body.style.overflow = '';
    if (Draft.get()) showToast('Unfinished invoice kept — it opens again where you left off');
  },

  /* ── Drawing ──────────────────────────────────────────── */
  labels() {
    const sym = this.settings.currency_symbol || '£';
    return this.state.billing_mode === 'hourly'
      ? { qty: 'Hours', price: `Rate (${sym})` }
      : { qty: 'Qty',   price: `Price (${sym})` };
  },

  // Outlined box with a label that sits inside when empty and moves up onto
  // the border once there's something in it — Flutter's OutlineInputBorder.
  field(bind, label, value, opts = {}) {
    return `
      <div class="of ${opts.cls || ''}">
        <input data-bind="${bind}" placeholder=" " value="${escHtml(value ?? '')}"
          ${opts.type ? `type="${opts.type}"` : ''} ${opts.inputmode ? `inputmode="${opts.inputmode}"` : ''}
          ${opts.list ? `list="${opts.list}"` : ''} ${opts.id ? `id="${opts.id}"` : ''} autocomplete="off" />
        <label>${label}</label>
      </div>`;
  },

  // Shows the date as "14 Oct 2026" like Flutter; an invisible real date box
  // sits on top, so a tap opens the phone's own calendar.
  dateField(bind, label, iso, withIcon) {
    return `
      <div class="of of-date ${withIcon ? 'of-icon' : ''}">
        <input class="of-date-text" value="${escHtml(fmtDate(iso))}" placeholder=" " readonly tabindex="-1" />
        <label>${label}</label>
        ${withIcon ? ipIcon('calendar', 'of-trailing') : ''}
        <input type="date" class="of-date-native" data-bind="${bind}" value="${iso || ''}"
          onclick="try { this.showPicker(); } catch (_) {}" aria-label="${label}" />
      </div>`;
  },

  render(restored) {
    const s = this.state;
    const page = document.getElementById('invoice-page');
    page.innerHTML = `
      <header class="ip-appbar">
        <button class="md-icon-btn" onclick="IP.close()" aria-label="Back">${ipIcon('back')}</button>
        <h1>${s.id ? 'Edit Invoice' : 'New Invoice'}</h1>
      </header>

      <div class="ip-body" id="ip-body">
        ${restored ? `
          <div class="draft-banner">
            <span>Your unfinished invoice — carry on where you left off.</span>
            <button class="btn btn-ghost btn-sm" onclick="discardDraft(${s.id || 'null'})">Discard</button>
          </div>` : ''}

        <section class="ip-card">
          <h2>Invoice Details</h2>
          ${this.field('invoice_number', 'Invoice Number', s.invoice_number, { id: 'ip-number' })}
          ${this.dateField('issue_date', 'Issue Date', s.issue_date, true)}
        </section>

        <section class="ip-card">
          <h2>Client Details</h2>
          ${this.field('client_name', 'Client Name', s.client_name, { list: 'ip-client-list', id: 'ip-client' })}
          <!-- Saved clients pop up as you type; pick one and their address
               goes on the invoice too. Any other name works as well. -->
          <datalist id="ip-client-list">${this.clients.map(c => `<option value="${escHtml(c.name)}">`).join('')}</datalist>
        </section>

        <section class="ip-card">
          <div class="ip-card-head">
            <h2>Items</h2>
            <button class="ip-text-btn" onclick="IP.addItem()">${ipIcon('add')}Add Item</button>
          </div>
          <div id="ip-items"></div>

          <hr class="ip-divider" />
          <h2 class="ip-section">VAT</h2>
          ${this.field('tax_rate', 'VAT %', s.tax_rate, { type: 'number', inputmode: 'decimal', id: 'ip-vat' })}

          <hr class="ip-divider" />
          <div class="ip-card-head">
            <h2>Expenses</h2>
            <button class="ip-text-btn" onclick="IP.addExpense()">${ipIcon('add')}Add Expense</button>
          </div>
          <div id="ip-expenses"></div>

          <div class="ip-subtotal" id="ip-subtotal"></div>
          <div class="ip-vat-line" id="ip-vat-line"></div>
          <div class="ip-total" id="ip-total"></div>
        </section>
      </div>

      <!-- Pinned under the scrolling part, so Save is always on screen —
           on a phone there's no hunting for it at the very bottom. -->
      <footer class="ip-footer">
        <button class="ip-save" onclick="IP.save()">${ipIcon('save')}Save Invoice</button>
      </footer>`;

    this.renderItems();
    this.renderExpenses();
    this.recalc();
    // One listener for every box on the page, however many get added.
    const body = document.getElementById('ip-body');
    body.addEventListener('input',  e => this.onInput(e));
    body.addEventListener('change', e => this.onInput(e));
  },

  renderItems() {
    const L = this.labels();
    const many = this.state.groups.length > 1;
    document.getElementById('ip-items').innerHTML = this.state.groups.map((g, gi) => `
      <div class="ip-item">
        ${many ? `<button class="ip-remove ip-remove-item" onclick="IP.removeItem(${gi})" aria-label="Remove item">${ipIcon('close')}</button>` : ''}
        ${this.field(`g.${gi}.description`, 'Description', g.description)}
        <hr class="ip-divider ip-divider-tight" />
        ${g.entries.map((e, ei) => `
          <div class="ip-entry ${g.entries.length > 1 ? 'ip-entry-x' : ''}">
            ${this.dateField(`g.${gi}.e.${ei}.date`, 'Date', e.date, false)}
            ${this.field(`g.${gi}.e.${ei}.quantity`,   L.qty,   e.quantity,   { type: 'number', inputmode: 'decimal', cls: 'of-qty' })}
            ${this.field(`g.${gi}.e.${ei}.unit_price`, L.price, e.unit_price, { type: 'number', inputmode: 'decimal', cls: 'of-price' })}
            ${g.entries.length > 1 ? `<button class="ip-remove" onclick="IP.removeEntry(${gi}, ${ei})" aria-label="Remove entry">${ipIcon('close')}</button>` : ''}
          </div>`).join('')}
        <div class="ip-item-foot">
          <button class="ip-text-btn" onclick="IP.addEntry(${gi})">Add Entry</button>
        </div>
      </div>`).join('');
  },

  renderExpenses() {
    const sym = this.settings.currency_symbol || '£';
    document.getElementById('ip-expenses').innerHTML = this.state.expenses.map((x, xi) => `
      <div class="ip-expense">
        ${this.field(`x.${xi}.description`, 'Expense', x.description)}
        ${this.field(`x.${xi}.amount`, `Amount (${sym})`, x.amount, { type: 'number', inputmode: 'decimal' })}
        <button class="ip-remove" onclick="IP.removeExpense(${xi})" aria-label="Remove expense">${ipIcon('close')}</button>
      </div>`).join('');
  },

  /* ── Typing ───────────────────────────────────────────── */
  onInput(e) {
    const bind = e.target.dataset && e.target.dataset.bind;
    if (!bind) return;
    const v = e.target.value;
    const p = bind.split('.');
    const s = this.state;
    if (p[0] === 'g') {
      const g = s.groups[+p[1]];
      if (p[2] === 'description') g.description = v;
      else g.entries[+p[3]][p[4]] = v;
    } else if (p[0] === 'x') {
      s.expenses[+p[1]][p[2]] = v;
    } else {
      s[bind] = v;
    }
    // A date picked: show it as "14 Oct 2026" in the visible box.
    if (e.target.classList.contains('of-date-native')) {
      e.target.parentElement.querySelector('.of-date-text').value = fmtDate(v);
    }
    this.recalc();
    Draft.save();
  },

  /* ── Adding / removing ────────────────────────────────── */
  addItem() {
    this.state.groups.push({ description: '', entries: [{ date: todayISO(), quantity: '', unit_price: '' }] });
    this.renderItems(); Draft.save();
  },
  removeItem(gi) {
    this.state.groups.splice(gi, 1);
    this.renderItems(); this.recalc(); Draft.save();
  },
  addEntry(gi) {
    const entries = this.state.groups[gi].entries;
    const last = entries[entries.length - 1];
    // Same rate as the entry above, so a week of the same job is quick to add.
    entries.push({ date: todayISO(), quantity: '', unit_price: last ? last.unit_price : '' });
    this.renderItems(); this.recalc(); Draft.save();
  },
  removeEntry(gi, ei) {
    this.state.groups[gi].entries.splice(ei, 1);
    this.renderItems(); this.recalc(); Draft.save();
  },
  addExpense() {
    this.state.expenses.push({ description: '', amount: '' });
    this.renderExpenses(); Draft.save();
  },
  removeExpense(xi) {
    this.state.expenses.splice(xi, 1);
    this.renderExpenses(); this.recalc(); Draft.save();
  },

  /* ── Totals ───────────────────────────────────────────── */
  totals() {
    const n = v => parseFloat(v) || 0;
    const items = this.state.groups.reduce((sum, g) =>
      sum + g.entries.reduce((s2, e) => s2 + n(e.quantity) * n(e.unit_price), 0), 0);
    const expenses = this.state.expenses.reduce((sum, x) => sum + n(x.amount), 0);
    const subtotal = items + expenses;
    const vat = subtotal * n(this.state.tax_rate) / 100;
    return { subtotal, vat, total: subtotal + vat };
  },

  recalc() {
    const t = this.totals();
    const sym = this.settings.currency_symbol || '£';
    document.getElementById('ip-subtotal').textContent = `Subtotal: ${formatMoney(t.subtotal, sym)}`;
    document.getElementById('ip-vat-line').textContent = t.vat ? `VAT (${parseFloat(this.state.tax_rate)}%): ${formatMoney(t.vat, sym)}` : '';
    document.getElementById('ip-total').textContent = `Total: ${formatMoney(t.total, sym)}`;
  },

  /* ── Save Invoice ─────────────────────────────────────── */
  async save() {
    const s = this.state;
    const name = (s.client_name || '').trim();
    const hasLine = s.groups.some(g => g.entries.some(e => (parseFloat(e.quantity) || 0) * (parseFloat(e.unit_price) || 0) > 0))
                 || s.expenses.some(x => parseFloat(x.amount) > 0);
    if (!name)    return showToast('Add the client name', 'error');
    if (!hasLine) return showToast(`Add at least one entry with ${this.labels().qty.toLowerCase()} and a rate`, 'error');

    // A name that matches a saved client brings their address onto the invoice.
    const client = this.clients.find(c => (c.name || '').trim().toLowerCase() === name.toLowerCase());
    const issue = s.issue_date || todayISO();
    const inv = this.invoice;
    const body = {
      invoice_number:  s.invoice_number,
      client_id:       client ? client.id : null,
      client_snapshot: client || { name },
      issue_date:      issue,
      // No due date — invoices don't carry a payment deadline.
      due_date:        null,
      template:        inv ? inv.template : 'classic',
      billing_mode:    s.billing_mode,
      currency:        this.settings.currency || 'GBP',
      currency_symbol: this.settings.currency_symbol || '£',
      tax_rate:        parseFloat(s.tax_rate) || 0,
      // Payment terms from Settings print under Notes — empty means nothing printed.
      notes:           inv ? inv.notes : (this.settings.payment_terms || ''),
      groups:          s.groups.map(g => ({ description: (g.description || '').trim(), entries: g.entries.map(e => ({ ...e })) })),
      expenses:        s.expenses.map(x => ({ description: (x.description || '').trim(), amount: x.amount }))
    };
    try {
      if (s.id) await API.updateInvoice(s.id, body);
      else      await API.createInvoice(body);
      Draft.clear();   // it's saved for real now
      showToast(s.id ? 'Invoice updated' : 'Invoice saved', 'success');
      this.close();
      App._invoices = await API.getInvoices();
      if (App.currentView === 'invoices')  renderInvoiceList();
      if (App.currentView === 'dashboard') renderDashboard();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
};

window.addEventListener('popstate', () => {
  if (IP.open) IP._hide();
});

// The rest of the app opens the page through this name (dashboard,
// invoice list, Edit on an invoice, the draft resume).
function openInvoiceForm(id = null) {
  return IP.openPage(id);
}

/* ── Unfinished invoice (draft) ─────────────────────────────
   IP.state is saved on the device as it's typed into, so a half-finished
   invoice is never lost — not when the app goes back to the start screen
   after a minute idle, not with the Back arrow, not even if Android shuts
   the app. It's cleared only by Save Invoice, or Discard on the banner.
   One draft at a time: either a new invoice, or edits to one invoice. */
const DRAFT_KEY = 'invoicemate.draft';

const Draft = {
  get() {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY)); } catch (_) { return null; }
  },
  save() {
    if (!IP.open || !IP.state) return;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...IP.state, saved_at: new Date().toISOString() })); } catch (_) {}
  },
  clear() {
    localStorage.removeItem(DRAFT_KEY);
  }
};

// "Discard" on the banner: start the form again from scratch.
function discardDraft(id) {
  Draft.clear();
  IP.openPage(id);
}

// Called by the start screen after Go / PIN (js/lock.js). If the page is
// still open underneath, everything is already as it was. If it isn't —
// the app was closed and reopened — open it again from the saved draft.
async function resumeDraftIfAny() {
  const draft = Draft.get();
  if (!draft || IP.open) return;
  if (draft.id) {
    try { await API.getInvoice(draft.id); }
    catch (_) { Draft.clear(); return; }      // that invoice has since been deleted
  }
  navigate('invoices');
  openInvoiceForm(draft.id);
}
