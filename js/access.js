/* ── Access codes + Share the app ─────────────────────────
   A brand-new copy of the app asks for a code before it can be used.
   Two kinds of code:

   • The OWNER code — given to Sharon (and Andreas). It unlocks the app
     as an "owner", which adds "Share InvoiceMate" (at the bottom of My
     Details): a QR code and an invite code for a friend.
   • INVITE codes — made by an owner's app, one per friend, like K7QM-2XPD.
     They unlock the app as a "guest": everything works, but there's no
     Share option, so the app only spreads through the owner.

   The friend scans the QR code: the app opens with the code already in
   (the link carries it). On an iPhone, the installed app keeps its own
   storage, so there they type the code shown under the QR code.

   Copies already in use before codes existed (they have invoices,
   clients or details) carry on as owners — nobody gets locked out.

   Honest limits: with no server, everything here lives in the app
   itself. The owner code is stored only as a salted SHA-256 hash, so it
   can't be read from the files, and invite codes can't be guessed — but
   someone technical could still get round the check by digging into the
   app. It keeps ordinary people out, not experts. Codes aren't single-use
   (nothing to keep track of them without a server).
──────────────────────────────────────────────────────────── */

const ACCESS_KEY      = 'invoicemate.access';            // { role: 'owner' | 'guest', since }
const ACCESS_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I, so codes are easy to read out
const OWNER_SALT      = 'invoicemate-owner-v1';
const OWNER_HASH      = 'ece7ae89c0d68e671d30c6917fdea70f07595ddd7d14fc9a81940eafac9f8a68';
// Invite codes = 4 random characters + 4 check characters worked out from
// them with this key, so a code that's made up won't pass.
const INVITE_KEY      = 'im-invite-f72ee76229b24b74b441a035';

const Access = {
  _get() {
    try { return JSON.parse(localStorage.getItem(ACCESS_KEY)); } catch (_) { return null; }
  },
  _set(role) {
    try { localStorage.setItem(ACCESS_KEY, JSON.stringify({ role, since: new Date().toISOString() })); } catch (_) {}
  },
  role()        { const a = this._get(); return a && a.role; },
  isActivated() { return !!this.role(); },
  isOwner()     { return this.role() === 'owner'; },

  // At start-up: a copy that's already being used carries on, as an owner.
  boot() {
    if (this.isActivated()) return;
    try {
      const d = Store.load();
      if (d.invoices.length || d.clients.length || (d.settings.company_name || '').trim()) this._set('owner');
    } catch (_) {}
  },

  /* ── Codes ────────────────────────────────────────────── */
  // "k7qm 2xpd", "K7QM-2XPD" and "K7QM2XPD" are all the same code.
  normalize(code) { return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); },
  pretty(code)    { const c = this.normalize(code); return `${c.slice(0, 4)}-${c.slice(4)}`; },

  async _sha256(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
  },
  // The 4 check characters for 4 random ones (HMAC-SHA-256 with INVITE_KEY).
  async _check(rand) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(INVITE_KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(rand)));
    return Array.from(sig.slice(0, 4), b => ACCESS_ALPHABET[b % 32]).join('');
  },

  // Unlocks this copy with a code. Returns 'owner', 'guest' or null (wrong code).
  async activate(code) {
    const c = this.normalize(code);
    if (c.length !== 8 || [...c].some(ch => !ACCESS_ALPHABET.includes(ch))) return null;
    if (await this._sha256(OWNER_SALT + c) === OWNER_HASH) { this._set('owner'); return 'owner'; }
    if (await this._check(c.slice(0, 4)) === c.slice(4))   { this._set('guest'); return 'guest'; }
    return null;
  },

  async makeInvite() {
    const rand = Array.from(crypto.getRandomValues(new Uint8Array(4)), b => ACCESS_ALPHABET[b % 32]).join('');
    return this.pretty(rand + await this._check(rand));
  },

  /* ── Links ────────────────────────────────────────────── */
  appUrl()          { return new URL('./', location.href).href; },
  inviteLink(code)  { return `${this.appUrl()}?code=${this.normalize(code)}`; },
  codeFromUrl()     { return this.normalize(new URLSearchParams(location.search).get('code')); },
  // Once used, take the code out of the address bar (so it isn't bookmarked).
  clearUrlCode() {
    if (!new URLSearchParams(location.search).has('code')) return;
    try { history.replaceState(history.state, '', location.pathname + location.hash); } catch (_) {}
  },

  /* ── Share InvoiceMate (owners only) ──────────────────── */
  _code: null,

  async openShare(fresh = true) {
    if (!this.isOwner()) return;
    if (fresh || !this._code) this._code = await this.makeInvite();
    const code = this._code;
    openModal(`
      <div class="share-box">
        <p class="share-lead">Ask your friend to scan this with their phone's camera. They get their own empty
          InvoiceMate: they can't see your invoices, and you can't see theirs.</p>
        <div class="share-qr" aria-label="QR code for the invite link">${qrSvg(this.inviteLink(code))}</div>
        <div class="share-code-label">Their invite code</div>
        <div class="share-code" id="share-code">${code}</div>
        <p class="share-hint">If the app asks (on an iPhone it will, once it's installed), they type this code.
          Each friend can have their own code: tap New code.</p>
        <div class="share-actions">
          <button class="btn btn-primary" onclick="Access.sendInvite()">Send the link</button>
          <button class="btn btn-outline" onclick="Access.openShare(true)">New code</button>
        </div>
      </div>`, 'Share InvoiceMate');
  },

  // WhatsApp, text, email… whatever the phone offers. Falls back to copying.
  async sendInvite() {
    const code = this._code;
    const text = `Here's InvoiceMate, the invoice app I use. Open the link and tap Install (on an iPhone: Share → Add to Home Screen). Your invite code: ${code}`;
    const url = this.inviteLink(code);
    try {
      if (navigator.share) { await navigator.share({ title: 'InvoiceMate', text, url }); return; }
    } catch (err) {
      if (err && err.name === 'AbortError') return;          // they closed the share sheet
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      showToast('Link and code copied: paste them into a message', 'success');
    } catch (_) {
      showToast(`Send them: ${url}  (code ${code})`);
    }
  }
};

// The QR code as an SVG picture (js/vendor/qrcode.js does the encoding).
// Medium error correction, so it still scans if the screen has a glare.
function qrSvg(text) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount(), m = 4;                       // 4-module quiet zone all round
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + m} ${r + m}h1v1h-1z`;
  return `<svg viewBox="0 0 ${n + 2 * m} ${n + 2 * m}" shape-rendering="crispEdges" role="img"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#111"/></svg>`;
}
