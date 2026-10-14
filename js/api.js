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
function defaultData() {
  return {
    version: 1,
    settings: {
      company_name: '', company_address: '', company_email: '', company_phone: '',
      company_logo_url: null,
      currency: 'GBP', currency_symbol: '£',
      tax_rate: 20, tax_name: 'VAT',
      invoice_prefix: 'INV', next_invoice_no: 1,
      bank_name: '', bank_account: '', bank_sort_code: '',
      payment_terms: 'Payment due within 30 days.', notes: ''
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
    return this._data;
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
      country: body.country || 'United Kingdom', notes: body.notes || '',
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
  async createInvoice(body) {
    const d = Store.load();
    const s = d.settings;
    // Same numbering as the server: prefix + next number padded to 4 digits.
    const invoice_number = `${s.invoice_prefix || 'INV'}-${String(s.next_invoice_no || 1).padStart(4, '0')}`;
    if (d.invoices.some(i => i.invoice_number === invoice_number)) {
      throw new Error(`${invoice_number} already exists — change "Next Invoice No." in Settings`);
    }
    const id    = Store.newId('invoice');
    const items = buildItems(id, body.items);
    const inv = {
      id, invoice_number,
      client_id:       body.client_id ? Number(body.client_id) : null,
      client_snapshot: body.client_snapshot || null,
      status:          'draft',
      issue_date:      body.issue_date || new Date().toISOString().slice(0, 10),
      due_date:        body.due_date || null,
      template:        body.template || 'classic',
      currency:        body.currency || 'GBP',
      currency_symbol: body.currency_symbol || '£',
      tax_rate:        Number(body.tax_rate) || 0,
      ...calcTotals(items, body.tax_rate),
      notes:           body.notes || '',
      items,
      created_at: now(), updated_at: now()
    };
    d.invoices.push(inv);
    s.next_invoice_no = (Number(s.next_invoice_no) || 1) + 1;
    Store.save();
    return copy(inv);
  },
  async updateInvoice(id, body) {
    const inv   = findInvoice(id);
    const items = buildItems(inv.id, body.items);
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
