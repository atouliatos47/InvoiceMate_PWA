/* ── On-device data store ─────────────────────────────────
   InvoiceMate used to send every read and write to a Node server with a
   Neon database behind it. This file replaces that with storage on the
   device itself, so the app runs standalone: no server, no internet, and
   each phone or tablet has its own separate copy of the data.

   The rest of the app still calls exactly the same API.getInvoices(),
   API.createInvoice(...) etc. as before, and gets back the same shapes
   the server used to send — so the screens didn't need to change. The
   rules the server used to apply (invoice numbering, totals, the client
   snapshot, deleting a client) now live in here instead.

   Everything is kept as ONE JSON document under one key. That makes
   every save all-or-nothing, and it makes a backup file trivial: the
   backup IS this document (see backup.js).
──────────────────────────────────────────────────────────── */

const STORE_KEY = 'invoicemate.data';

// What a brand-new install starts with — the same defaults schema.sql
// gave the settings row on the server.
// The payment terms older versions filled in by themselves. Version 2 of
// the data removes it (see Store.load) — invoices no longer say it.
const OLD_DEFAULT_TERMS = 'Payment due within 30 days.';

function defaultData() {
  return {
    version: 2,
    settings: {
      company_name: '', company_email: '', company_phone: '',
      // Address split the way the Flutter app's My Details page has it:
      // company_address is the street part, then city and postcode.
      company_address: '', company_city: '', company_postcode: '',
      company_logo_url: null,
      // 'hourly' = Bill by the Hour (Hours / Rate columns),
      // 'quantity' = Bill by Quantity (Qty / Unit Price columns).
      invoice_mode: 'hourly',
      currency: 'GBP', currency_symbol: '£',
      // 0 = not VAT registered, so the New Invoice page's "VAT %" box starts
      // empty like the Flutter app's. (Was 20, from the old server schema.)
      tax_rate: 0, tax_name: 'VAT',
      invoice_prefix: 'INV', next_invoice_no: 1,
      bank_name: '', bank_account: '', bank_sort_code: '',
      tax_number: '', self_assessment_no: '',
      payment_terms: '', notes: ''      // empty = no Notes on the invoice
    },
    clients: [],
    invoices: [],          // each invoice carries its own items array
    nextId: { client: 1, invoice: 1, item: 1 }
  };
}

const Store = {
  _data: null,

  load() {
    if (this._data) return this._data;
    let raw = null;
    try { raw = localStorage.getItem(STORE_KEY); } catch (_) {}
    const base = defaultData();
    if (!raw) { this._data = base; return this._data; }
    const saved = JSON.parse(raw);
    // Fill in anything a newer version of the app added since this was saved.
    saved.settings = { ...base.settings, ...(saved.settings || {}) };
    saved.nextId   = { ...base.nextId,   ...(saved.nextId   || {}) };
    saved.clients  = saved.clients  || [];
    saved.invoices = saved.invoices || [];
    this._data = saved;
    this._upgrade(saved);
    return this._data;
  },

  // One-time tidy-ups for data saved by an older version. Each runs once,
  // then the data's version number goes up so it never runs again.
  _upgrade(d) {
    if (!(d.version >= 2)) {
      // Take out the "Payment due within 30 days." the app used to add by
      // itself. Only that exact sentence — anything typed is left alone.
      if (d.settings.payment_terms === OLD_DEFAULT_TERMS) d.settings.payment_terms = '';
      for (const inv of d.invoices) {
        if ((inv.notes || '').trim() === OLD_DEFAULT_TERMS) inv.notes = '';
      }
      d.version = 2;
      try { localStorage.setItem(STORE_KEY, JSON.stringify(d)); } catch (_) {}
    }
  },

  save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(this._data));
    } catch (err) {
      throw new Error('Could not save on this device — storage may be full.');
    }
  },

  // Swaps in a whole document at once (used by Restore from backup).
  replaceAll(data) {
    this._data = null;
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
    return this.load();
  },

  newId(kind) {
    const d = this.load();
    return d.nextId[kind]++;
  }
};

// Copies out, so a screen editing the object it got back can't change
// the stored data by accident — the server gave you a fresh copy too.
const copy = obj => JSON.parse(JSON.stringify(obj));
const now  = () => new Date().toISOString();
const round2 = n => Math.round((Number(n) || 0) * 100) / 100;

// Same sums the server's routes/invoices.js did.
function calcTotals(items, taxRate) {
  const subtotal   = items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0);
  const tax_amount = round2(subtotal * (Number(taxRate) || 0) / 100);
  return { subtotal: round2(subtotal), tax_amount, total: round2(subtotal + tax_amount) };
}

/* The New Invoice page (like the Flutter app's) builds an invoice from
   ITEMS, each with one or more dated ENTRIES, plus EXPENSES:
     groups:   [{ description, entries: [{ date, quantity, unit_price }] }]
     expenses: [{ description, amount }]
   The invoice screen, totals and all three PDF templates work on a flat
   list of lines, so this turns the structure into those lines:
     Bill by the Hour → "Description — 14 Oct 2026", hours × rate (one line per entry)
     Bill by Quantity → "Description", qty × price (date added only when an
                        item has several entries, to tell them apart)
     each expense     → "Expense: description", 1 × amount
   The structure itself is stored too (groups/expenses) so the invoice
   opens for editing exactly as it was typed. */
function shortDate(d) {
  return d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
}
function flattenLines(groups, expenses, mode) {
  const lines = [];
  for (const g of groups || []) {
    const desc = (g.description || '').trim();
    const entries = (g.entries || []).filter(e => Number(e.quantity) || Number(e.unit_price));
    for (const e of entries) {
      const dated = mode === 'hourly' || entries.length > 1;
      lines.push({
        description: [desc, dated ? shortDate(e.date) : ''].filter(Boolean).join(' — '),
        quantity: Number(e.quantity) || 0,
        unit_price: Number(e.unit_price) || 0
      });
    }
  }
  for (const x of expenses || []) {
    if (!Number(x.amount) && !(x.description || '').trim()) continue;
    lines.push({ description: `Expense: ${(x.description || '').trim() || 'expense'}`, quantity: 1, unit_price: Number(x.amount) || 0 });
  }
  return lines;
}

function nextAutoNumber(s) {
  return `${s.invoice_prefix || 'INV'}-${String(s.next_invoice_no || 1).padStart(4, '0')}`;
}

function buildItems(invoiceId, items) {
  return (items || []).map((it, i) => ({
    id:          Store.newId('item'),
    invoice_id:  invoiceId,
    description: it.description || '',
    quantity:    Number(it.quantity) || 0,
    unit_price:  Number(it.unit_price) || 0,
    line_total:  round2((Number(it.quantity) || 0) * (Number(it.unit_price) || 0)),
    sort_order:  i
  }));
}

function findInvoice(id) {
  const inv = Store.load().invoices.find(i => i.id == id);
  if (!inv) throw new Error('Invoice not found');
  return inv;
}

function findClient(id) {
  const c = Store.load().clients.find(c => c.id == id);
  if (!c) throw new Error('Client not found');
  return c;
}

/* ── The API the screens call — same names as before ─────── */
const API = {
  // Settings
  async getSettings() {
    return copy(Store.load().settings);
  },
  async saveSettings(body) {
    const d = Store.load();
    d.settings = { ...d.settings, ...body, updated_at: now() };
    Store.save();
    return copy(d.settings);
  },

  // Clients — alphabetical, like the server's ORDER BY name
  async getClients() {
    return copy(Store.load().clients)
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'en', { sensitivity: 'base' }));
  },
  async getClient(id) {
    return copy(findClient(id));
  },
  async createClient(body) {
    if (!body.name) throw new Error('Client name is required');
    const d = Store.load();
    const c = {
      id: Store.newId('client'),
      name: body.name, email: body.email || '', phone: body.phone || '',
      address: body.address || '', city: body.city || '', postcode: body.postcode || '',
      // An explicit '' stays empty (a client added by just typing a name on
      // an invoice); nothing given at all means United Kingdom.
      country: body.country ?? 'United Kingdom', notes: body.notes || '',
      created_at: now(), updated_at: now()
    };
    d.clients.push(c);
    Store.save();
    return copy(c);
  },
  async updateClient(id, body) {
    if (!body.name) throw new Error('Client name is required');
    const c = findClient(id);
    Object.assign(c, {
      name: body.name, email: body.email, phone: body.phone,
      address: body.address, city: body.city, postcode: body.postcode,
      country: body.country, notes: body.notes, updated_at: now()
    });
    // Details added or changed here also go onto this client's invoices that
    // are still drafts (e.g. one saved with just a name, before the address
    // was filled in). Sent and paid invoices keep the details they went out with.
    Store.load().invoices.forEach(inv => {
      if (inv.client_id == id && (inv.status || 'draft') === 'draft') inv.client_snapshot = copy(c);
    });
    Store.save();
    return copy(c);
  },
  async deleteClient(id) {
    const d = Store.load();
    d.clients = d.clients.filter(c => c.id != id);
    // Same as the database's ON DELETE SET NULL: their invoices stay, they
    // just stop pointing at a client. Each invoice still has the client's
    // details printed on it — that's what client_snapshot is for.
    d.invoices.forEach(inv => { if (inv.client_id == id) inv.client_id = null; });
    Store.save();
    return { message: 'Client deleted' };
  },

  // Invoices — newest first, with the client's current name alongside
  async getInvoices() {
    const d = Store.load();
    return d.invoices
      .slice()
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '') || b.id - a.id)
      .map(inv => {
        const { items, ...row } = copy(inv);
        const c = d.clients.find(c => c.id == inv.client_id);
        // Falls back to the name printed on the invoice if the client has
        // since been deleted, rather than showing "No client".
        return { ...row, client_name: c ? c.name : (inv.client_snapshot && inv.client_snapshot.name) || null };
      });
  },
  async getInvoice(id) {
    const inv = copy(findInvoice(id));
    inv.items = (inv.items || []).sort((a, b) => a.sort_order - b.sort_order);
    return inv;
  },
  // What the next invoice will be called — the New Invoice page shows it
  // in its (editable) Invoice Number box.
  async nextInvoiceNumber() {
    return nextAutoNumber(Store.load().settings);
  },
  async createInvoice(body) {
    const d = Store.load();
    const s = d.settings;
    // Same numbering as the server: prefix + next number padded to 4 digits —
    // unless a number was typed into the Invoice Number box.
    const auto = nextAutoNumber(s);
    const invoice_number = (body.invoice_number || '').trim() || auto;
    if (d.invoices.some(i => i.invoice_number === invoice_number)) {
      throw new Error(invoice_number === auto
        ? `${invoice_number} already exists — change "Next Invoice No." in Settings`
        : `${invoice_number} is already used by another invoice`);
    }
    const id    = Store.newId('invoice');
    const mode  = body.billing_mode || s.invoice_mode || 'quantity';
    const items = buildItems(id, body.groups ? flattenLines(body.groups, body.expenses, mode) : body.items);
    const inv = {
      id, invoice_number,
      client_id:       body.client_id ? Number(body.client_id) : null,
      client_snapshot: body.client_snapshot || null,
      status:          'draft',
      issue_date:      body.issue_date || new Date().toISOString().slice(0, 10),
      due_date:        body.due_date || null,
      template:        body.template || 'classic',
      // Hours/Rate or Qty/Unit Price — taken from My Details when the
      // invoice is made and kept with it, so changing the setting later
      // doesn't relabel invoices that were already sent.
      billing_mode:    mode,
      currency:        body.currency || 'GBP',
      currency_symbol: body.currency_symbol || '£',
      tax_rate:        Number(body.tax_rate) || 0,
      ...calcTotals(items, body.tax_rate),
      notes:           body.notes || '',
      items,
      // The New Invoice page's own structure, kept for editing later.
      groups:          body.groups   || null,
      expenses:        body.expenses || null,
      created_at: now(), updated_at: now()
    };
    d.invoices.push(inv);
    // The counter only moves on when its own number was used; a hand-typed
    // number leaves it where it was.
    if (invoice_number === auto) s.next_invoice_no = (Number(s.next_invoice_no) || 1) + 1;
    Store.save();
    return copy(inv);
  },
  async updateInvoice(id, body) {
    const inv   = findInvoice(id);
    const num   = (body.invoice_number || '').trim() || inv.invoice_number;
    if (num !== inv.invoice_number && Store.load().invoices.some(i => i.invoice_number === num)) {
      throw new Error(`${num} is already used by another invoice`);
    }
    const mode  = body.billing_mode || inv.billing_mode || 'quantity';
    const items = buildItems(inv.id, body.groups ? flattenLines(body.groups, body.expenses, mode) : body.items);
    if (body.groups) { inv.groups = body.groups; inv.expenses = body.expenses || []; }
    inv.invoice_number = num;
    Object.assign(inv, {
      client_id:       body.client_id ? Number(body.client_id) : null,
      client_snapshot: body.client_snapshot || null,
      issue_date:      body.issue_date,
      due_date:        body.due_date,
      template:        body.template,
      currency:        body.currency,
      currency_symbol: body.currency_symbol,
      tax_rate:        Number(body.tax_rate) || 0,
      ...calcTotals(items, body.tax_rate),
      // Editing keeps the invoice's status unless the caller sets one.
      status:          body.status || inv.status,
      notes:           body.notes || '',
      items,
      updated_at: now()
    });
    Store.save();
    return copy(inv);
  },
  async patchTemplate(id, template) {
    const inv = findInvoice(id);
    inv.template = ['classic', 'modern', 'minimal'].includes(template) ? template : 'classic';
    inv.updated_at = now();
    Store.save();
    return copy(inv);
  },
  async patchStatus(id, status) {
    const inv = findInvoice(id);
    inv.status = status;
    inv.updated_at = now();
    Store.save();
    return copy(inv);
  },
  async deleteInvoice(id) {
    const d = Store.load();
    d.invoices = d.invoices.filter(i => i.id != id);
    Store.save();
    return { message: 'Invoice deleted' };
  }
};
