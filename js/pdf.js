/* ── PDF Generation (pdf-lib) ───────────────────────────── */

/* ── Text safety ────────────────────────────────────────────
   The PDFs use pdf-lib's built-in Helvetica, which can only print the
   basic Western character set ("WinAnsi"). Anything outside it — a line
   break, an emoji, Greek letters — used to throw an error, so the whole
   PDF failed ("PDF generation failed"). In practice that meant a business
   address typed over several lines in Settings broke EVERY PDF, and the
   Modern template never worked at all (it drew a ⚡ emoji).

   So every piece of text is cleaned on its way in: line breaks become
   ", " (each template lays the address out as one line) and any character
   the font can't print becomes "?". Done once, here, by wrapping pdf-lib's
   own drawText / widthOfTextAtSize — so no template can forget to do it. */
const WINANSI_EXTRAS = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
function pdfSafe(text) {
  return String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/\s*\n+\s*/g, ', ')
    .replace(/\t/g, ' ')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, ch => (WINANSI_EXTRAS.includes(ch) ? ch : '?'));
}
(function guardPdfText() {
  const page = PDFLib.PDFPage.prototype;
  const font = PDFLib.PDFFont.prototype;
  const drawText = page.drawText;
  const widthOf  = font.widthOfTextAtSize;
  page.drawText = function (text, options) { return drawText.call(this, pdfSafe(text), options); };
  font.widthOfTextAtSize = function (text, size) { return widthOf.call(this, pdfSafe(text), size); };
})();

/* ── Build / download / share ───────────────────────────── */
async function buildInvoicePDF(invoiceId) {
  const inv = await API.getInvoice(invoiceId);
  const saved = await API.getSettings();
  // My Details keeps street, city and postcode apart (like the Flutter
  // app); the templates print the address as one line, so join them here
  // once and every template gets the full address.
  const settings = { ...saved, company_address: companyAddressLine(saved) };
  const client = inv.client_snapshot
    ? (typeof inv.client_snapshot === 'string' ? JSON.parse(inv.client_snapshot) : inv.client_snapshot)
    : {};

  const template = inv.template || 'classic';
  let bytes;
  if (template === 'modern')       bytes = await buildModernPDF(inv, client, settings);
  else if (template === 'minimal') bytes = await buildMinimalPDF(inv, client, settings);
  else                             bytes = await buildClassicPDF(inv, client, settings);

  return { bytes, filename: `${inv.invoice_number}.pdf`, inv };
}

async function generatePDF(invoiceId) {
  showToast('Generating PDF…');
  try {
    const { bytes, filename } = await buildInvoicePDF(invoiceId);
    downloadPDF(bytes, filename);
    showToast('PDF downloaded', 'success');
  } catch (err) {
    console.error(err);
    showToast('PDF generation failed', 'error');
  }
}

// Android's share sheet — WhatsApp, Gmail, Drive, etc. — like the Flutter
// app's Share button (its share_plus package). Where a browser can't share
// files, it falls back to downloading the PDF instead.
async function sharePDF(invoiceId) {
  showToast('Preparing PDF…');
  try {
    const { bytes, filename, inv } = await buildInvoicePDF(invoiceId);
    const file = new File([bytes], filename, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: filename, text: `Invoice ${inv.invoice_number}` });
    } else {
      downloadPDF(bytes, filename);
      showToast("Sharing isn't available here — PDF downloaded instead");
    }
  } catch (err) {
    if (err && err.name === 'AbortError') return;   // closed the share sheet
    console.error(err);
    showToast('Could not share the PDF', 'error');
  }
}

function downloadPDF(bytes, filename) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking straight away can cancel the download on some phones.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ── Shared helpers ─────────────────────────────────────── */
// Same format as the screens (formatMoney in app.js): £1,234.56
function money(amount, sym = '£') {
  return formatMoney(amount, sym);
}

// Bank and tax lines for the "Payment details" block, shared by all three
// templates. The tax lines come from My Details → Tax Information and
// only appear when filled in.
function paymentLines(settings, accountLabel = 'Account') {
  return [
    settings.bank_name          ? `Bank: ${settings.bank_name}`                         : null,
    settings.bank_account       ? `${accountLabel}: ${settings.bank_account}`           : null,
    settings.bank_sort_code     ? `Sort Code: ${settings.bank_sort_code}`               : null,
    settings.tax_number         ? `Tax No: ${settings.tax_number}`                      : null,
    settings.self_assessment_no ? `Self Assessment No: ${settings.self_assessment_no}`  : null
  ].filter(Boolean);
}

function pdfDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}

// Breaks text into lines that fit maxWidth. Line breaks the user typed
// (e.g. in the Notes box) are kept as real new lines.
function wrapText(text, maxWidth, fontSize, font) {
  const lines = [];
  for (const para of String(text || '').replace(/\r\n?/g, '\n').split('\n')) {
    const words = para.split(' ');
    let current = '';
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      const w = font.widthOfTextAtSize(test, fontSize);
      if (w > maxWidth && current) { lines.push(current); current = word; }
      else current = test;
    }
    lines.push(current);
  }
  // Drop empty lines at the very end, keep blank lines in the middle.
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  return lines;
}

/* ══════════════════════════════════════════════════════════
   CLASSIC TEMPLATE — navy header, ruled lines
═══════════════════════════════════════════════════════════ */
async function buildClassicPDF(inv, client, settings) {
  const { PDFDocument, rgb, StandardFonts } = PDFLib;
  const doc  = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const { width, height } = page.getSize();

  const fontR  = await doc.embedFont(StandardFonts.Helvetica);
  const fontB  = await doc.embedFont(StandardFonts.HelveticaBold);
  const sym    = settings.currency_symbol || '£';

  const navy   = rgb(0.08, 0.13, 0.27);
  const accent = rgb(0.39, 0.40, 0.95);
  const grey   = rgb(0.55, 0.55, 0.60);
  const black  = rgb(0.10, 0.10, 0.12);
  const white  = rgb(1, 1, 1);
  const light  = rgb(0.95, 0.96, 0.98);

  const ml = 48, mr = width - 48, mt = height;

  // ── Header band ──
  page.drawRectangle({ x:0, y: mt-90, width, height:90, color: navy });
  page.drawText('INVOICE', { x:ml, y: mt-52, size:26, font:fontB, color:white });
  page.drawText(inv.invoice_number, { x:ml, y: mt-72, size:11, font:fontR, color:rgb(0.7,0.72,0.85) });

  // Company name top-right
  const cn = settings.company_name || 'Your Company';
  const cnW = fontB.widthOfTextAtSize(cn, 11);
  page.drawText(cn, { x: mr - cnW, y: mt-48, size:11, font:fontB, color:white });
  if (settings.company_email) {
    const ew = fontR.widthOfTextAtSize(settings.company_email, 9);
    page.drawText(settings.company_email, { x: mr-ew, y: mt-64, size:9, font:fontR, color:rgb(0.7,0.72,0.85) });
  }
  if (settings.company_phone) {
    const pw = fontR.widthOfTextAtSize(settings.company_phone, 9);
    page.drawText(settings.company_phone, { x: mr-pw, y: mt-76, size:9, font:fontR, color:rgb(0.7,0.72,0.85) });
  }

  let y = mt - 115;

  // ── Two-column: Bill To / Invoice Details ──
  // Bill To
  page.drawText('BILL TO', { x:ml, y, size:8, font:fontB, color:accent });
  y -= 14;
  if (client.name) { page.drawText(client.name, { x:ml, y, size:10, font:fontB, color:black }); y -= 13; }
  for (const line of [client.address, client.city, client.postcode, client.country, client.email, client.phone]) {
    if (line) { page.drawText(String(line), { x:ml, y, size:9, font:fontR, color:grey }); y -= 12; }
  }

  // Invoice meta — right column
  const rx = width / 2 + 20;
  let ry = mt - 115;
  page.drawText('INVOICE DETAILS', { x:rx, y:ry, size:8, font:fontB, color:accent }); ry -= 14;
  const metaRows = [
    ['Issue Date', pdfDate(inv.issue_date)],
    ['Due Date',   pdfDate(inv.due_date)],
    ['Status',     (inv.status||'draft').toUpperCase()]
  ];
  for (const [label, val] of metaRows) {
    page.drawText(label+':', { x:rx,      y:ry, size:9, font:fontR, color:grey  });
    page.drawText(val,       { x:rx+80,   y:ry, size:9, font:fontB, color:black });
    ry -= 13;
  }

  y = Math.min(y, ry) - 20;

  // ── Divider ──
  page.drawLine({ start:{x:ml,y}, end:{x:mr,y}, thickness:1, color:light });
  y -= 18;

  // ── Items table header ──
  page.drawRectangle({ x:ml, y:y-4, width: mr-ml, height:20, color:navy });
  const cols = [ml+4, ml+220, ml+290, ml+360, mr-4];
  const head = unitLabels(inv.billing_mode);   // Hours / Rate or Qty / Unit Price
  page.drawText('Description', { x:cols[0], y:y+3, size:8, font:fontB, color:white });
  page.drawText(head.qty,      { x:cols[1], y:y+3, size:8, font:fontB, color:white });
  page.drawText(head.price,    { x:cols[2], y:y+3, size:8, font:fontB, color:white });
  page.drawText('Total',       { x:cols[3], y:y+3, size:8, font:fontB, color:white });
  y -= 20;

  // ── Items ──
  let rowBg = false;
  for (const it of (inv.items || [])) {
    if (rowBg) page.drawRectangle({ x:ml, y:y-6, width:mr-ml, height:20, color:light });
    rowBg = !rowBg;

    const descLines = wrapText(it.description, 200, 9, fontR);
    for (let li = 0; li < descLines.length; li++) {
      page.drawText(descLines[li], { x:cols[0], y:y+2-(li*11), size:9, font:fontR, color:black });
    }
    const rowH = Math.max(1, descLines.length);
    page.drawText(String(it.quantity),          { x:cols[1], y:y+2, size:9, font:fontR, color:black });
    page.drawText(money(it.unit_price, sym),    { x:cols[2], y:y+2, size:9, font:fontR, color:black });
    page.drawText(money(it.line_total, sym),    { x:cols[3], y:y+2, size:9, font:fontB, color:black });
    y -= (rowH * 11) + 6;
  }

  y -= 10;
  page.drawLine({ start:{x:ml,y}, end:{x:mr,y}, thickness:0.5, color:light });
  y -= 14;

  // ── Totals ──
  const totals = [
    ['Subtotal', money(inv.subtotal, sym)],
    [`${settings.tax_name||'VAT'} (${inv.tax_rate}%)`, money(inv.tax_amount, sym)],
  ];
  for (const [label, val] of totals) {
    const vw = fontR.widthOfTextAtSize(val, 10);
    page.drawText(label+':', { x: mr-120, y, size:10, font:fontR, color:grey });
    page.drawText(val,       { x: mr-vw,  y, size:10, font:fontR, color:black });
    y -= 14;
  }
  // Total row — the extra 8pt gap stops the bar sitting on top of the VAT
  // line above it (its top edge used to cut through the VAT figures).
  y -= 8;
  page.drawRectangle({ x: mr-160, y:y-6, width:160, height:22, color:navy });
  page.drawText('TOTAL', { x: mr-154, y:y+2, size:10, font:fontB, color:white });
  const tw = fontB.widthOfTextAtSize(money(inv.total, sym), 11);
  page.drawText(money(inv.total, sym), { x: mr-tw-4, y:y+2, size:11, font:fontB, color:white });
  y -= 36;

  // ── Bank + tax details ──
  const payLines = paymentLines(settings);
  if (payLines.length) {
    page.drawText('PAYMENT DETAILS', { x:ml, y, size:8, font:fontB, color:accent }); y -= 12;
    for (const l of payLines) { page.drawText(l, { x:ml, y, size:9, font:fontR, color:grey }); y -= 12; }
    y -= 6;
  }

  // ── Notes ──
  if (inv.notes) {
    page.drawText('NOTES', { x:ml, y, size:8, font:fontB, color:accent }); y -= 12;
    for (const line of wrapText(inv.notes, mr-ml, 9, fontR)) {
      page.drawText(line, { x:ml, y, size:9, font:fontR, color:grey }); y -= 12;
    }
  }

  // ── Footer ──
  page.drawLine({ start:{x:ml,y:36}, end:{x:mr,y:36}, thickness:0.5, color:light });
  page.drawText(settings.company_name || '', { x:ml, y:22, size:8, font:fontR, color:grey });
  if (settings.company_address) {
    const aw = fontR.widthOfTextAtSize(settings.company_address, 8);
    page.drawText(settings.company_address, { x: mr-aw, y:22, size:8, font:fontR, color:grey });
  }

  return doc.save();
}

/* ══════════════════════════════════════════════════════════
   MODERN TEMPLATE — full-bleed accent sidebar
═══════════════════════════════════════════════════════════ */
async function buildModernPDF(inv, client, settings) {
  const { PDFDocument, rgb, StandardFonts } = PDFLib;
  const doc  = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const { width, height } = page.getSize();

  const fontR = await doc.embedFont(StandardFonts.Helvetica);
  const fontB = await doc.embedFont(StandardFonts.HelveticaBold);
  const sym   = settings.currency_symbol || '£';

  const purple = rgb(0.39, 0.40, 0.95);
  const dark   = rgb(0.08, 0.10, 0.18);
  const grey   = rgb(0.50, 0.52, 0.58);
  const light  = rgb(0.96, 0.96, 0.98);
  const white  = rgb(1, 1, 1);
  const black  = rgb(0.12, 0.12, 0.14);

  const sideW = 170;

  // ── Purple sidebar ──
  page.drawRectangle({ x:0, y:0, width:sideW, height, color:dark });

  // Sidebar content
  let sy = height - 48;
  // A short accent bar where a ⚡ emoji used to be drawn. Helvetica can't
  // print emoji, so that one line made the Modern template fail every time.
  page.drawRectangle({ x:20, y:sy + 4, width:28, height:4, color:purple }); sy -= 26;
  // Name and address wrapped onto as many lines as they need, each line
  // moving the next item down — maxWidth alone wrapped them on top of
  // whatever came next.
  const sideText = (text, size, font, color) => {
    for (const line of wrapText(pdfSafe(text), sideW - 24, size, font)) {
      page.drawText(line, { x:20, y:sy, size, font, color });
      sy -= size + 4;
    }
  };
  sideText(settings.company_name || 'Company', 11, fontB, white); sy -= 1;
  const sideGrey = rgb(0.6, 0.62, 0.75);
  if (settings.company_email)   sideText(settings.company_email,   8, fontR, sideGrey);
  if (settings.company_phone)   sideText(settings.company_phone,   8, fontR, sideGrey);
  if (settings.company_address) sideText(settings.company_address, 8, fontR, sideGrey);

  sy -= 24;
  page.drawLine({ start:{x:20,y:sy}, end:{x:sideW-16,y:sy}, thickness:0.5, color:rgb(0.25,0.27,0.40) }); sy -= 20;

  page.drawText('INVOICE',        { x:20, y:sy, size:8, font:fontB, color:rgb(0.5,0.52,0.72) }); sy -= 13;
  page.drawText(inv.invoice_number,{ x:20, y:sy, size:10, font:fontB, color:white }); sy -= 24;

  page.drawText('ISSUED',         { x:20, y:sy, size:7, font:fontB, color:rgb(0.5,0.52,0.72) }); sy -= 12;
  page.drawText(pdfDate(inv.issue_date), { x:20, y:sy, size:9, font:fontR, color:white }); sy -= 22;

  page.drawText('DUE',            { x:20, y:sy, size:7, font:fontB, color:rgb(0.5,0.52,0.72) }); sy -= 12;
  page.drawText(pdfDate(inv.due_date),   { x:20, y:sy, size:9, font:fontR, color:white }); sy -= 22;

  page.drawText('STATUS',         { x:20, y:sy, size:7, font:fontB, color:rgb(0.5,0.52,0.72) }); sy -= 12;
  page.drawText((inv.status||'draft').toUpperCase(), { x:20, y:sy, size:9, font:fontB, color:purple }); sy -= 24;

  // Total in sidebar
  page.drawRectangle({ x:10, y:sy-30, width:sideW-20, height:44, color:purple, borderRadius:4 });
  page.drawText('TOTAL', { x:20, y:sy-10, size:7, font:fontB, color:white });
  const totalStr = money(inv.total, sym);
  page.drawText(totalStr, { x:20, y:sy-24, size:13, font:fontB, color:white });

  // ── Main content area ──
  const mx = sideW + 24;
  const mw = width - mx - 24;
  let y = height - 48;

  page.drawText('BILL TO', { x:mx, y, size:8, font:fontB, color:purple }); y -= 14;
  if (client.name) { page.drawText(client.name, { x:mx, y, size:12, font:fontB, color:dark }); y -= 15; }
  for (const line of [client.address, client.city, client.postcode, client.email, client.phone]) {
    if (line) { page.drawText(String(line), { x:mx, y, size:9, font:fontR, color:grey }); y -= 12; }
  }

  y -= 20;

  // ── Table header ──
  page.drawRectangle({ x:mx, y:y-4, width:mw, height:20, color:purple });
  const c = [mx+4, mx+140, mx+190, mx+240, mx+mw-4];
  const head = unitLabels(inv.billing_mode);   // Hours / Rate or Qty / Price
  page.drawText('Description',   { x:c[0], y:y+3, size:8, font:fontB, color:white });
  page.drawText(head.qty,        { x:c[1], y:y+3, size:8, font:fontB, color:white });
  page.drawText(head.priceShort, { x:c[2], y:y+3, size:8, font:fontB, color:white });
  page.drawText('Total',       { x:c[3], y:y+3, size:8, font:fontB, color:white });
  y -= 22;

  let alt = false;
  for (const it of (inv.items || [])) {
    if (alt) page.drawRectangle({ x:mx, y:y-4, width:mw, height:18, color:light });
    alt = !alt;
    page.drawText(String(it.description||'').substring(0,36), { x:c[0], y, size:9, font:fontR, color:black });
    page.drawText(String(it.quantity),       { x:c[1], y, size:9, font:fontR, color:black });
    page.drawText(money(it.unit_price, sym), { x:c[2], y, size:9, font:fontR, color:black });
    page.drawText(money(it.line_total,  sym),{ x:c[3], y, size:9, font:fontB, color:black });
    y -= 18;
  }

  y -= 12;
  // Subtotal / tax
  for (const [label, val] of [
    ['Subtotal', money(inv.subtotal, sym)],
    [`${settings.tax_name||'VAT'} ${inv.tax_rate}%`, money(inv.tax_amount, sym)]
  ]) {
    const vw = fontR.widthOfTextAtSize(val, 9);
    page.drawText(label+':', { x: mx+mw-120, y, size:9, font:fontR, color:grey });
    page.drawText(val,       { x: mx+mw-vw,  y, size:9, font:fontR, color:black });
    y -= 13;
  }

  y -= 20;

  // Notes / bank + tax
  const payLines = paymentLines(settings);
  if (payLines.length || inv.notes) {
    page.drawLine({ start:{x:mx,y}, end:{x:mx+mw,y}, thickness:0.5, color:light }); y -= 14;
    if (payLines.length) {
      page.drawText('PAYMENT', { x:mx, y, size:7, font:fontB, color:purple }); y -= 12;
      for (const l of payLines) { page.drawText(l, { x:mx, y, size:9, font:fontR, color:grey }); y -= 12; }
      y -= 8;
    }
    if (inv.notes) {
      page.drawText('NOTES', { x:mx, y, size:7, font:fontB, color:purple }); y -= 12;
      for (const line of wrapText(inv.notes, mw, 9, fontR)) {
        page.drawText(line, { x:mx, y, size:9, font:fontR, color:grey }); y -= 12;
      }
    }
  }

  return doc.save();
}

/* ══════════════════════════════════════════════════════════
   MINIMAL TEMPLATE — ultra-clean, lots of whitespace
═══════════════════════════════════════════════════════════ */
async function buildMinimalPDF(inv, client, settings) {
  const { PDFDocument, rgb, StandardFonts } = PDFLib;
  const doc  = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const { width, height } = page.getSize();

  const fontR = await doc.embedFont(StandardFonts.Helvetica);
  const fontB = await doc.embedFont(StandardFonts.HelveticaBold);
  const sym   = settings.currency_symbol || '£';

  const ink   = rgb(0.08, 0.08, 0.10);
  const mid   = rgb(0.45, 0.45, 0.50);
  const light = rgb(0.88, 0.88, 0.90);

  const ml = 56, mr = width - 56;
  let y = height - 60;

  // ── Company ──
  page.drawText(settings.company_name || 'Your Company', { x:ml, y, size:14, font:fontB, color:ink }); y -= 18;
  for (const line of [settings.company_address, settings.company_email, settings.company_phone]) {
    if (line) { page.drawText(String(line), { x:ml, y, size:9, font:fontR, color:mid }); y -= 12; }
  }

  // ── INVOICE label top-right ──
  const invLabel = 'INVOICE';
  const ilw = fontB.widthOfTextAtSize(invLabel, 22);
  page.drawText(invLabel, { x: mr-ilw, y: height-60, size:22, font:fontB, color:ink });
  const numStr = inv.invoice_number;
  const nw = fontR.widthOfTextAtSize(numStr, 10);
  page.drawText(numStr, { x: mr-nw, y: height-82, size:10, font:fontR, color:mid });

  y -= 24;
  page.drawLine({ start:{x:ml,y}, end:{x:mr,y}, thickness:0.75, color:ink }); y -= 20;

  // ── Bill To + Dates ──
  page.drawText('Bill To', { x:ml, y, size:8, font:fontB, color:mid }); y -= 13;
  if (client.name) { page.drawText(client.name, { x:ml, y, size:11, font:fontB, color:ink }); y -= 14; }
  for (const l of [client.address, client.city, client.postcode, client.email]) {
    if (l) { page.drawText(String(l), { x:ml, y, size:9, font:fontR, color:mid }); y -= 12; }
  }

  // Dates — right
  let ry = height - 60 - 18 - 14 - 24 - 20;
  for (const [label, val] of [['Issue Date', pdfDate(inv.issue_date)], ['Due Date', pdfDate(inv.due_date)]]) {
    const vw = fontR.widthOfTextAtSize(val, 10);
    page.drawText(label, { x: mr-120, y:ry, size:8,  font:fontB, color:mid });
    page.drawText(val,   { x: mr-vw,  y:ry, size:10, font:fontR, color:ink });
    ry -= 16;
  }

  y = Math.min(y, ry) - 20;
  page.drawLine({ start:{x:ml,y}, end:{x:mr,y}, thickness:0.5, color:light }); y -= 18;

  // ── Items ──
  const head = unitLabels(inv.billing_mode);   // Hours / Rate or Qty / Price
  page.drawText('Description',   { x:ml,      y, size:8, font:fontB, color:mid });
  page.drawText(head.qty,        { x:ml+230,  y, size:8, font:fontB, color:mid });
  page.drawText(head.priceShort, { x:ml+285,  y, size:8, font:fontB, color:mid });
  const thw = fontB.widthOfTextAtSize('Amount', 8);
  page.drawText('Amount',      { x: mr-thw, y, size:8, font:fontB, color:mid });
  y -= 10;
  page.drawLine({ start:{x:ml,y}, end:{x:mr,y}, thickness:0.4, color:light }); y -= 14;

  for (const it of (inv.items || [])) {
    const descLines = wrapText(it.description, 210, 9, fontR);
    for (let li = 0; li < descLines.length; li++) {
      page.drawText(descLines[li], { x:ml, y:y-(li*12), size:9, font:fontR, color:ink });
    }
    page.drawText(String(it.quantity),          { x:ml+230,  y, size:9, font:fontR, color:ink });
    page.drawText(money(it.unit_price, sym),    { x:ml+285,  y, size:9, font:fontR, color:ink });
    const ltw = fontB.widthOfTextAtSize(money(it.line_total, sym), 9);
    page.drawText(money(it.line_total, sym),    { x: mr-ltw, y, size:9, font:fontB, color:ink });
    y -= (Math.max(1,descLines.length) * 12) + 4;
  }

  y -= 10;
  page.drawLine({ start:{x:ml,y}, end:{x:mr,y}, thickness:0.5, color:light }); y -= 16;

  // Totals
  for (const [label, val, bold] of [
    ['Subtotal', money(inv.subtotal, sym), false],
    [`${settings.tax_name||'VAT'} (${inv.tax_rate}%)`, money(inv.tax_amount, sym), false],
    ['Total Due', money(inv.total, sym), true]
  ]) {
    const vw  = (bold ? fontB : fontR).widthOfTextAtSize(val, bold?12:10);
    const lw  = (bold ? fontB : fontR).widthOfTextAtSize(label+':', bold?12:10);
    page.drawText(label+':', { x: mr-150, y, size:bold?12:10, font: bold?fontB:fontR, color: bold?ink:mid });
    page.drawText(val,       { x: mr-vw,  y, size:bold?12:10, font: bold?fontB:fontR, color: bold?ink:mid });
    if (bold) { y -= 6; page.drawLine({ start:{x:mr-160,y}, end:{x:mr,y}, thickness:0.75, color:ink }); }
    y -= bold ? 18 : 14;
  }

  y -= 20;

  // Bank + tax / notes
  const payLines = paymentLines(settings, 'Account No');
  if (payLines.length) {
    page.drawText('Payment Details', { x:ml, y, size:8, font:fontB, color:mid }); y -= 13;
    for (const l of payLines) {
      page.drawText(l, { x:ml, y, size:9, font:fontR, color:mid }); y -= 12;
    }
    y -= 8;
  }

  if (inv.notes) {
    page.drawText('Notes', { x:ml, y, size:8, font:fontB, color:mid }); y -= 13;
    for (const line of wrapText(inv.notes, mr-ml, 9, fontR)) {
      page.drawText(line, { x:ml, y, size:9, font:fontR, color:mid }); y -= 12;
    }
  }

  // Footer line
  page.drawLine({ start:{x:ml,y:40}, end:{x:mr,y:40}, thickness:0.4, color:light });
  page.drawText('Thank you for your business.', { x:ml, y:26, size:8, font:fontR, color:mid });

  return doc.save();
}
