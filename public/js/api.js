/* ── API wrapper ────────────────────────────────────────── */
const API = {
  async _fetch(method, path, body) {
    try {
      const opts = {
        method,
        headers: { 'Content-Type': 'application/json' }
      };
      if (body) opts.body = JSON.stringify(body);
      const res = await fetch('/api' + path, opts);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      return data;
    } catch (err) {
      console.error(`API ${method} ${path}:`, err);
      throw err;
    }
  },

  // Settings
  getSettings:    ()       => API._fetch('GET',  '/settings'),
  saveSettings:   (body)   => API._fetch('PUT',  '/settings', body),

  // Clients
  getClients:     ()       => API._fetch('GET',  '/clients'),
  getClient:      (id)     => API._fetch('GET',  `/clients/${id}`),
  createClient:   (body)   => API._fetch('POST', '/clients', body),
  updateClient:   (id, b)  => API._fetch('PUT',  `/clients/${id}`, b),
  deleteClient:   (id)     => API._fetch('DELETE',`/clients/${id}`),

  // Invoices
  getInvoices:    ()       => API._fetch('GET',  '/invoices'),
  getInvoice:     (id)     => API._fetch('GET',  `/invoices/${id}`),
  createInvoice:  (body)   => API._fetch('POST', '/invoices', body),
  updateInvoice:  (id, b)  => API._fetch('PUT',  `/invoices/${id}`, b),
  patchStatus:    (id, s)  => API._fetch('PATCH',`/invoices/${id}/status`, { status: s }),
  deleteInvoice:  (id)     => API._fetch('DELETE',`/invoices/${id}`)
};
