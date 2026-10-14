/* ── My Details ───────────────────────────────────────────
   The owner's own details, laid out exactly like the Flutter app's
   "My Details" page so anyone moving across from it isn't confused:

     ← My Details                                   Save
     Business Information   business name, email, phone
     Address                street, city, postcode
     Invoice Settings       Bill by the Hour / Bill by Quantity
     Currency & Pricing     currency picker + preview
     Banking Details        bank, account number, sort code
     Tax Information        tax number, self assessment number
     [ Save All Details ]

   It's a full page on top of the app (like a Flutter route), opened
   from the person icon in the top bar. The phone's Back button closes
   it too, because opening it adds a step to the browser history.
   Everything here is printed on the invoices (see pdf.js).
──────────────────────────────────────────────────────────── */

// Material icons (the set Flutter uses), as SVG paths on a 24x24 grid.
const MD_ICONS = {
  back:      'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z',
  business:  'M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z',
  briefcase: 'M10 16v-1H3.01L3 19c0 1.11.89 2 2 2h14c1.11 0 2-.89 2-2v-4h-7v1h-4zm10-9h-4.01V5l-2-2h-4l-2 2v2H4c-1.1 0-2 .9-2 2v3c0 1.11.89 2 2 2h6v-2h4v2h6c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm-6 0h-4V5h4v2z',
  email:     'M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z',
  phone:     'M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z',
  place:     'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
  home:      'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
  city:      'M15 11V5l-3-3-3 3v2H3v14h18V11h-6zm-8 8H5v-2h2v2zm0-4H5v-2h2v2zm0-4H5V9h2v2zm6 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V9h2v2zm0-4h-2V5h2v2zm6 12h-2v-2h2v2zm0-4h-2v-2h2v2z',
  settings:  'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.488.488 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z',
  money:     'M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z',
  bank:      'M4 10v7h3v-7H4zm6 0v7h3v-7h-3zM2 22h19v-3H2v3zm14-12v7h3v-7h-3zm-4.5-9L2 6v2h19V6l-9.5-5z',
  account:   'M3 5v14a2 2 0 002 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2H5a2 2 0 00-2 2zm12 4c0 1.66-1.34 3-3 3s-3-1.34-3-3 1.34-3 3-3 3 1.34 3 3zm-9 8c0-2 4-3.1 6-3.1s6 1.1 6 3.1v1H6v-1z',
  code:      'M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z',
  receipt:   'M19.5 3.5L18 2l-1.5 1.5L15 2l-1.5 1.5L12 2l-1.5 1.5L9 2 7.5 3.5 6 2v14H3v3c0 1.66 1.34 3 3 3h12c1.66 0 3-1.34 3-3V2l-1.5 1.5zM19 19c0 .55-.45 1-1 1s-1-.45-1-1v-3H8V5h11v14zM9 7h6v2H9V7zm7 0h2v2h-2V7zm-7 3h6v2H9v-2zm7 0h2v2h-2v-2z',
  tag:       'M20 10V8h-4V4h-2v4h-4V4H8v4H4v2h4v4H4v2h4v4h2v-4h4v4h2v-4h4v-2h-4v-4h4zm-6 4h-4v-4h4v4z',
  personSearch: 'M10 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm.35 2.01C7.62 13.91 2 15.27 2 18v2h9.54c-2.47-2.76-1.23-5.89-1.19-5.99zM19.43 18.02c.36-.59.57-1.28.57-2.02 0-2.21-1.79-4-4-4s-4 1.79-4 4 1.79 4 4 4c.74 0 1.43-.22 2.02-.57L20.59 22 22 20.59l-2.57-2.57zM16 18c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z',
  info:      'M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z',
  dropDown:  'M7 10l5 5 5-5z',
  person:    'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'
};
const mdIcon = (name, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${MD_ICONS[name]}"/></svg>`;

// The currencies the app already offered, with the names the Flutter
// picker shows ("GBP - British Pound").
const CURRENCIES = [
  ['GBP', '£',   'British Pound'],
  ['EUR', '€',   'Euro'],
  ['USD', '$',   'US Dollar'],
  ['CAD', '$',   'Canadian Dollar'],
  ['AUD', '$',   'Australian Dollar'],
  ['CHF', 'CHF', 'Swiss Franc'],
  ['JPY', '¥',   'Japanese Yen'],
  ['NOK', 'kr',  'Norwegian Krone'],
  ['SEK', 'kr',  'Swedish Krona'],
  ['DKK', 'kr',  'Danish Krone'],
];

// The green note under the two billing modes.
const MODE_NOTES = {
  hourly:   'Perfect for consultants, freelancers, and service providers who charge by time.',
  quantity: 'Perfect for businesses that sell products, items, or materials.'
};

/* ── One text field: icon, floating label ───────────────── */
// The label sits in the middle of an empty box and slides up small once
// you type — Flutter's labelText behaviour. placeholder=" " is what lets
// the CSS tell an empty box from a filled one (:placeholder-shown).
function mdField(id, label, icon, value, opts = {}) {
  const tag = opts.multiline ? 'textarea' : 'input';
  const attrs = `id="${id}" placeholder=" " ${opts.type ? `type="${opts.type}"` : ''} ${opts.inputmode ? `inputmode="${opts.inputmode}"` : ''} autocomplete="off"`;
  const field = opts.multiline
    ? `<textarea ${attrs} rows="2">${escHtml(value || '')}</textarea>`
    : `<input ${attrs} value="${escHtml(value || '')}" />`;
  return `
    <div class="md-field ${opts.multiline ? 'md-multiline' : ''}">
      ${mdIcon(icon, 'md-field-icon')}
      ${field}
      <label for="${id}">${label}</label>
    </div>
    ${opts.helper ? `<div class="md-helper">${opts.helper}</div>` : ''}`;
}

function mdCard(icon, title, body) {
  return `
    <section class="md-card">
      <div class="md-card-head">
        <span class="md-card-icon">${mdIcon(icon)}</span>
        <h2>${title}</h2>
      </div>
      ${body}
    </section>`;
}

const MyDetails = {
  _open: false,

  async open() {
    const s = await API.getSettings();
    const page = document.getElementById('details-page');
    const mode = s.invoice_mode === 'quantity' ? 'quantity' : 'hourly';

    page.innerHTML = `
      <header class="md-appbar" id="md-appbar">
        <button class="md-icon-btn" onclick="MyDetails.close()" aria-label="Back">${mdIcon('back')}</button>
        <h1>My Details</h1>
        <button class="md-text-btn" onclick="MyDetails.save()">Save</button>
      </header>

      <div class="md-body" id="md-body">
        ${mdCard('business', 'Business Information', `
          ${mdField('d-name',  'Business Name', 'briefcase', s.company_name)}
          ${mdField('d-email', 'Email Address', 'email',     s.company_email, { type: 'email', inputmode: 'email' })}
          ${mdField('d-phone', 'Phone Number',  'phone',     s.company_phone, { type: 'tel', inputmode: 'tel' })}
        `)}

        ${mdCard('place', 'Address', `
          ${mdField('d-street', 'Street Address', 'home', s.company_address, { multiline: true })}
          <div class="md-row">
            ${mdField('d-city',     'City',        'city',  s.company_city)}
            ${mdField('d-postcode', 'Postal Code', 'email', s.company_postcode)}
          </div>
        `)}

        ${mdCard('settings', 'Invoice Settings', `
          <div class="md-sublabel">Default Invoice Mode</div>
          <label class="md-radio">
            <input type="radio" name="d-mode" value="hourly" ${mode === 'hourly' ? 'checked' : ''} onchange="MyDetails.modeChanged(this.value)" />
            <span class="md-radio-dot"></span>
            <span class="md-radio-text"><strong>Bill by the Hour</strong><small>For consulting, labor, and other services.</small></span>
          </label>
          <label class="md-radio">
            <input type="radio" name="d-mode" value="quantity" ${mode === 'quantity' ? 'checked' : ''} onchange="MyDetails.modeChanged(this.value)" />
            <span class="md-radio-dot"></span>
            <span class="md-radio-text"><strong>Bill by Quantity</strong><small>For products, items, or materials sold.</small></span>
          </label>
          <div class="md-note md-note-green">${mdIcon('info')}<span id="d-mode-note">${MODE_NOTES[mode]}</span></div>
        `)}

        ${mdCard('money', 'Currency &amp; Pricing', `
          <div class="md-sublabel">Default Currency</div>
          <div class="md-select">
            <span class="md-select-avatar" id="d-cur-sym"></span>
            <span class="md-select-text"><strong id="d-cur-name"></strong><small id="d-cur-example"></small></span>
            ${mdIcon('dropDown', 'md-select-arrow')}
            <!-- The real picker: invisible, laid over the box, so a tap opens
                 Android's own list — the same as Flutter's dropdown. -->
            <select id="d-currency" onchange="MyDetails.currencyChanged()" aria-label="Default Currency">
              ${CURRENCIES.map(([code, , name]) =>
                `<option value="${code}" ${(s.currency || 'GBP') === code ? 'selected' : ''}>${code} - ${name}</option>`).join('')}
            </select>
          </div>
          <div class="md-note md-note-blue">${mdIcon('info')}
            <span><strong>Currency Preview</strong><br>Invoice total will appear as: <span id="d-cur-preview"></span></span>
          </div>
        `)}

        ${mdCard('bank', 'Banking Details', `
          ${mdField('d-bank',    'Bank Name',      'bank',    s.bank_name)}
          ${mdField('d-account', 'Account Number', 'account', s.bank_account, { inputmode: 'numeric' })}
          ${mdField('d-sort',    'Sort Code',      'code',    s.bank_sort_code)}
        `)}

        ${mdCard('receipt', 'Tax Information', `
          ${mdField('d-tax',  'Tax Number',         'tag',          s.tax_number,         { helper: 'Optional - for tax reporting' })}
          ${mdField('d-utr',  'Self Assessment No', 'personSearch', s.self_assessment_no, { helper: 'Optional - for tax reporting' })}
        `)}

        <button class="md-save-all" onclick="MyDetails.save()">Save All Details</button>

        <!-- The old Settings tab's home now: backup, PIN, numbering -->
        <button class="md-more-link" onclick="MyDetails.openMore()">
          ${mdIcon('settings')}
          <span><strong>Backup, PIN lock &amp; numbering</strong><small>Save a backup file, set a PIN, change the invoice numbers</small></span>
          <svg class="md-more-arrow" viewBox="0 0 24 24"><path d="M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>
        </button>
      </div>`;

    this.currencyChanged();
    // Material 3 tints the app bar once the page scrolls under it.
    const body = document.getElementById('md-body');
    // (A last scroll can arrive just after the page closed — hence the check.)
    body.addEventListener('scroll', () => {
      const bar = document.getElementById('md-appbar');
      if (bar) bar.classList.toggle('scrolled', body.scrollTop > 4);
    });

    page.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    this._open = true;
    // A history step, so the phone's Back button closes this page
    // instead of leaving the app.
    history.pushState({ page: 'my-details' }, '');
  },

  // Back arrow / after saving: step back through history; the popstate
  // handler below does the actual closing (same path as the phone's Back).
  close() {
    if (this._open) history.back();
  },

  // "Backup, PIN lock & numbering": close this page and show what used to
  // be the Settings tab underneath.
  openMore() {
    this.close();
    navigate('settings');
  },

  _hide() {
    this._open = false;
    document.getElementById('details-page').classList.add('hidden');
    document.getElementById('details-page').innerHTML = '';
    document.body.style.overflow = '';
  },

  modeChanged(mode) {
    document.getElementById('d-mode-note').textContent = MODE_NOTES[mode];
  },

  currencyChanged() {
    const code = document.getElementById('d-currency').value;
    const [, sym, name] = CURRENCIES.find(c => c[0] === code) || CURRENCIES[0];
    const example = formatMoney(1234.56, sym);
    document.getElementById('d-cur-sym').textContent = sym;
    document.getElementById('d-cur-name').textContent = `${code} - ${name}`;
    document.getElementById('d-cur-example').textContent = `Example: ${example}`;
    document.getElementById('d-cur-preview').textContent = example;
  },

  async save() {
    const val = id => document.getElementById(id).value.trim();
    const code = document.getElementById('d-currency').value;
    const [, sym] = CURRENCIES.find(c => c[0] === code) || CURRENCIES[0];
    try {
      App.settings = await API.saveSettings({
        company_name:       val('d-name'),
        company_email:      val('d-email'),
        company_phone:      val('d-phone'),
        company_address:    val('d-street'),
        company_city:       val('d-city'),
        company_postcode:   val('d-postcode'),
        invoice_mode:       document.querySelector('input[name="d-mode"]:checked').value,
        currency:           code,
        currency_symbol:    sym,
        bank_name:          val('d-bank'),
        bank_account:       val('d-account'),
        bank_sort_code:     val('d-sort'),
        tax_number:         val('d-tax'),
        self_assessment_no: val('d-utr')
      });
      showToast('Details saved', 'success');
      this.close();
      navigate(App.currentView);   // redraw whatever's underneath with the new details
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
};

window.addEventListener('popstate', () => {
  if (MyDetails._open) MyDetails._hide();
});
