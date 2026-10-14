/* ── Start screen + PIN lock ──────────────────────────────
   The Flutter InvoiceMate had an app lock (its local_auth and
   flutter_secure_storage packages). This is the PWA's version: an
   optional 4-digit PIN asked for on the start screen.

   - The PIN itself is never stored. Only a SHA-256 hash of it, mixed
     with a random "salt", is saved — so even someone reading the
     device's storage can't see the PIN.
   - It's kept under its own key, separate from the invoice data, so a
     backup file never carries a PIN onto someone else's device.
   - It's a privacy lock, like a phone's lock screen: it stops someone
     picking up the tablet and browsing the invoices.

   Start screen behaviour:
     no PIN set  → logo shows briefly, then fades away
     PIN set     → logo + keypad, waits for the right PIN
   It also locks again if the app has been in the background for more
   than a minute.
──────────────────────────────────────────────────────────── */

const LOCK_KEY        = 'invoicemate.lock';
const PIN_LENGTH      = 4;
const RELOCK_AFTER_MS = 60 * 1000;   // back in the app after 1+ minute away → PIN again
const MAX_TRIES       = 5;           // then a 30-second wait
const WAIT_MS         = 30 * 1000;

const Lock = {
  _mode: null,        // 'unlock' | 'verify' | 'new' | 'confirm'
  _entry: '',
  _firstPin: null,    // the PIN typed the first time, while setting a new one
  _after: null,       // what to do once 'verify' succeeds
  _tries: 0,
  _blockedUntil: 0,
  _hiddenAt: null,

  /* ── Stored PIN ───────────────────────────────────────── */
  _get() {
    try { return JSON.parse(localStorage.getItem(LOCK_KEY)); } catch (_) { return null; }
  },
  isOn() { return !!this._get(); },

  async _hash(pin, salt) {
    const bytes = new TextEncoder().encode(`${salt}:${pin}`);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
  },
  async _matches(pin) {
    const saved = this._get();
    return !!saved && (await this._hash(pin, saved.salt)) === saved.hash;
  },
  async _save(pin) {
    const salt = [...crypto.getRandomValues(new Uint8Array(16))]
      .map(b => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(LOCK_KEY, JSON.stringify({ salt, hash: await this._hash(pin, salt) }));
  },

  /* ── Boot: called once from app.js ────────────────────── */
  start() {
    document.querySelectorAll('#pin-pad button').forEach(btn =>
      btn.addEventListener('click', () => this._press(btn.dataset.key)));
    // A tablet keyboard works too.
    document.addEventListener('keydown', e => {
      if (!this._mode) return;
      if (/^[0-9]$/.test(e.key)) this._press(e.key);
      else if (e.key === 'Backspace') this._press('back');
    });
    // Lock again after a while in the background.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { this._hiddenAt = Date.now(); return; }
      if (this.isOn() && !this._mode && this._hiddenAt && Date.now() - this._hiddenAt > RELOCK_AFTER_MS) {
        this._show('unlock');
      }
    });

    if (this.isOn()) this._show('unlock');
    else setTimeout(() => this._hide(), 900);   // just the logo, briefly
  },

  /* ── Called from Settings ─────────────────────────────── */
  setPin()    { this._show('new'); },
  changePin() { this._after = () => this._show('new'); this._show('verify'); },
  turnOff()   {
    this._after = () => {
      localStorage.removeItem(LOCK_KEY);
      this._hide();
      showToast('App lock turned off', 'success');
      if (App.currentView === 'settings') renderSettings();
    };
    this._show('verify');
  },

  /* ── Screen ───────────────────────────────────────────── */
  _titles: {
    unlock:  'Enter your PIN',
    verify:  'Enter your current PIN',
    new:     `Choose a ${PIN_LENGTH}-digit PIN`,
    confirm: 'Enter the same PIN again'
  },

  _show(mode, title) {
    this._mode = mode;
    this._entry = '';
    const screen = document.getElementById('start-screen');
    screen.classList.remove('fade-out');
    screen.classList.add('locked');
    document.getElementById('lock-panel').classList.remove('hidden');
    document.getElementById('lock-title').textContent = title || this._titles[mode];
    // Unlocking offers "Forgot?"; setting or changing a PIN offers "Cancel".
    document.querySelector('#pin-pad [data-key="forgot"]').textContent = mode === 'unlock' ? 'Forgot?' : 'Cancel';
    this._dots();
  },

  _hide() {
    this._mode = null;
    this._entry = '';
    this._firstPin = null;
    this._after = null;
    const screen = document.getElementById('start-screen');
    screen.classList.add('fade-out');
    setTimeout(() => {
      screen.classList.remove('locked');
      document.getElementById('lock-panel').classList.add('hidden');
    }, 400);
  },

  _dots() {
    document.getElementById('pin-dots').innerHTML =
      Array.from({ length: PIN_LENGTH }, (_, i) => `<span class="${i < this._entry.length ? 'filled' : ''}"></span>`).join('');
  },

  _wrong(title) {
    this._entry = '';
    this._dots();
    const dots = document.getElementById('pin-dots');
    dots.classList.remove('shake'); void dots.offsetWidth; dots.classList.add('shake');
    if (title) document.getElementById('lock-title').textContent = title;
  },

  /* ── Keypad ───────────────────────────────────────────── */
  async _press(key) {
    if (!this._mode) return;
    if (key === 'forgot') return this._mode === 'unlock' ? this._forgot() : this._cancel();
    if (key === 'back')   { this._entry = this._entry.slice(0, -1); return this._dots(); }
    if (Date.now() < this._blockedUntil) return;
    if (this._entry.length >= PIN_LENGTH) return;

    this._entry += key;
    this._dots();
    if (this._entry.length < PIN_LENGTH) return;

    const pin = this._entry;
    if (this._mode === 'unlock' || this._mode === 'verify') {
      if (await this._matches(pin)) {
        this._tries = 0;
        if (this._mode === 'verify' && this._after) {
          const next = this._after; this._after = null; next();
        } else {
          this._hide();
        }
      } else {
        this._tries++;
        if (this._tries >= MAX_TRIES) {
          this._tries = 0;
          this._blockedUntil = Date.now() + WAIT_MS;
          this._wrong('Too many tries — wait 30 seconds');
          setTimeout(() => { if (this._mode) document.getElementById('lock-title').textContent = this._titles[this._mode]; }, WAIT_MS);
        } else {
          this._wrong('Wrong PIN — try again');
        }
      }
    } else if (this._mode === 'new') {
      this._firstPin = pin;
      this._show('confirm');
    } else if (this._mode === 'confirm') {
      if (pin === this._firstPin) {
        await this._save(pin);
        this._hide();
        showToast('PIN set — the app will ask for it when it opens', 'success');
        if (App.currentView === 'settings') renderSettings();
      } else {
        this._firstPin = null;
        this._show('new', "Those didn't match — choose a PIN");
        this._wrong();
      }
    }
  },

  _cancel() {
    this._hide();
  },

  // The PIN can't be recovered (only its hash is stored), so the only way
  // back in is to wipe this device's copy and start again — or restore a
  // backup file afterwards.
  _forgot() {
    const ok = window.confirm(
      'Forgot your PIN?\n\n' +
      "It can't be recovered. The only way back in is to RESET the app, which " +
      'deletes all invoices, clients and settings on this device.\n\n' +
      'If you have a backup file you can restore it afterwards (Settings → Backup).\n\n' +
      'Reset the app?');
    if (!ok) return;
    const typed = window.prompt('To confirm, type RESET');
    if ((typed || '').trim().toUpperCase() !== 'RESET') return;
    localStorage.removeItem(STORE_KEY);
    localStorage.removeItem(LOCK_KEY);
    location.reload();
  }
};
