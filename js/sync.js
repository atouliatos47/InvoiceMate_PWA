/* ── Server copy: tablet first, server second ─────────────
   The app keeps working exactly as before: every invoice is saved on
   the tablet first (js/api.js), so it works with no internet at all.
   When the app runs from Andreas's home server (server.js), this file
   ALSO sends a copy there after each change, and fetches it back when
   needed. On a host with no server (GitHub Pages) it finds nothing to
   talk to and stays quiet — the app is then just as it was.

   The server numbers each saved copy: "rev" 1, 2, 3… This device
   remembers the rev it last sent or fetched, and whether it has
   changes the server hasn't got yet ("dirty"). That is enough to know
   what to do each time:

     server has nothing yet              → send this device's copy
     this device is empty (new or reset) → take the server's copy
     server rev = the one we know        → send our changes, if any
     server moved on, we changed nothing → take the server's copy
     server moved on AND we changed too  → ask which one to keep
                                           (the other is kept on the server)

   Nothing is ever thrown away: the server keeps a copy of anything it
   replaces (see server.js).
──────────────────────────────────────────────────────────── */

const SYNC_KEY = 'invoicemate.sync';   // { user, rev, dirty, change_no, changed_at, last_ok }

const Sync = {
  // 'unknown'   — not asked the server yet
  // 'none'      — no server here (e.g. GitHub Pages): stay quiet
  // 'ok'        — the server has everything
  // 'saving'    — sending a change
  // 'offline'   — no internet: changes wait on the device
  // 'signedout' — the Cloudflare sign-in ran out
  // 'error'     — the server didn't answer properly; will try again
  // 'conflict'  — waiting for the person to choose a copy
  mode: 'unknown',
  conflict: null,       // { kind, server } while waiting for a choice
  _running: null,       // the sync in progress, so two never overlap
  _again: false,        // a change came in during a sync → go again after
  _timer: null,
  _lastTry: 0,
  _taking: false,
  _booting: false,
  user: null,           // the email signed in (from Cloudflare, via the server)
  _toldSignedOut: false,

  /* ── Remembered state ─────────────────────────────────── */
  state() {
    try { return JSON.parse(localStorage.getItem(SYNC_KEY)) || {}; } catch (_) { return {}; }
  },
  _setState(patch) {
    const s = { ...this.state(), ...patch };
    try { localStorage.setItem(SYNC_KEY, JSON.stringify(s)); } catch (_) {}
    return s;
  },

  // Nothing typed in yet: no invoices, no clients, no business name.
  _isEmpty(d) {
    return !d || (!(d.invoices || []).length && !(d.clients || []).length &&
                  !((d.settings && d.settings.company_name) || '').trim());
  },

  /* ── Start-up ─────────────────────────────────────────── */
  async boot() {
    // Every save on this device marks a change and sends it shortly after.
    const save = Store.save.bind(Store);
    Store.save = () => { save(); this.changed(); };
    // Restore from backup swaps everything at once — that's a change too
    // (but not when it's this file taking the server's copy).
    const replaceAll = Store.replaceAll.bind(Store);
    Store.replaceAll = data => { const r = replaceAll(data); if (!this._taking) this.changed(); return r; };

    window.addEventListener('online', () => this.syncNow());
    document.addEventListener('visibilitychange', () => {
      // Back in the app: check for news, at most every 20 seconds.
      if (document.visibilityState === 'visible' && Date.now() - this._lastTry > 20000) this.syncNow();
    });

    this._booting = true;
    const first = this.syncNow();
    // A brand-new (or reset) tablet waits a moment for its invoices, so
    // they're there on the very first screen. Others carry on at once.
    if (this._isEmpty(Store.load())) {
      await Promise.race([first, new Promise(r => setTimeout(r, 10000))]);
    }
    this._booting = false;
  },

  // Called after every save on this device.
  changed() {
    const s = this.state();
    this._setState({ dirty: true, change_no: (s.change_no || 0) + 1, changed_at: new Date().toISOString() });
    if (this.mode === 'none') return;          // no server here
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.syncNow(), 1500);   // wait for typing to settle
    if (this.mode === 'ok') this._setMode('saving');
  },

  /* ── Talking to the server ────────────────────────────── */
  async _call(method, url, body) {
    let res;
    try {
      res = await fetch(url, {
        method, credentials: 'same-origin', cache: 'no-store',
        // An expired Cloudflare sign-in answers with a redirect to its
        // login page. 'manual' lets us see that, instead of following it.
        redirect: 'manual',
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined
      });
    } catch (_) {
      throw { kind: navigator.onLine === false ? 'offline' : 'error' };
    }
    if (res.type === 'opaqueredirect' || res.status === 401 || res.status === 403) throw { kind: 'signedout' };
    const isJson = (res.headers.get('content-type') || '').includes('application/json');
    const json = isJson ? await res.json().catch(() => null) : null;
    // A web page instead of our JSON (e.g. GitHub Pages' "not found"): no server here.
    if (!json) throw { kind: res.status === 404 || res.ok ? 'none' : 'error' };
    return { status: res.status, json };
  },

  // Runs one full check-and-send. Calls during a run are folded into one more run.
  syncNow() {
    if (this._running) { this._again = true; return this._running; }
    this._running = (async () => {
      do {
        this._again = false;
        this._lastTry = Date.now();
        await this._syncOnce();
      } while (this._again && this.mode !== 'conflict');
    })().finally(() => { this._running = null; });
    return this._running;
  },

  async _syncOnce() {
    if (this.mode === 'none' || this.mode === 'conflict') return;
    if (navigator.onLine === false) return this._setMode('offline');
    try {
      // First a quick "who am I, and which copy is on the server?"
      const { json: hello } = await this._call('GET', 'api/hello');
      this.user = hello.user;
      // The server knows who this is (Cloudflare checked the email), so a
      // new tablet doesn't need the app's own invite code as well. It joins
      // as a 'guest': everything works, but there's no "Share InvoiceMate" —
      // a friend couldn't get into this private server anyway.
      if (typeof Access !== 'undefined' && !Access.isActivated()) {
        Access._set('guest');
        // If the server was slow to answer, the invite-code box may already
        // be on screen: swap it for the normal start (Go button or PIN).
        if (typeof Lock !== 'undefined' && Lock._mode === 'access') Lock.showStart();
      }

      let s = this.state();
      // A different person signed in on this device: what's here is the
      // other person's (already on the server, under their email). This
      // device now follows the person signed in.
      if (s.user && s.user !== hello.user) return this._switchPerson(s, hello);
      if (!s.user) s = this._setState({ user: hello.user });

      const local = Store.load();
      // Nothing new on either side — no need to download the whole copy.
      if (hello.rev === s.rev && !s.dirty && (hello.rev === 0 || !this._isEmpty(local))) return this._ok(hello.rev);

      const { json: server } = await this._call('GET', 'api/data');
      if (!server.data) {                                   // server has nothing yet
        if (this._isEmpty(local)) return this._ok(server.rev);
        return this._send(server.rev, false);
      }
      if (this._isEmpty(local)) return this._take(server, true);   // new or reset device
      if (s.rev == null) {                                  // first time here, both have data
        if (JSON.stringify(local) === JSON.stringify(server.data)) return this._ok(server.rev);
        return this._ask('first', server);
      }
      if (server.rev === s.rev) {
        if (s.dirty) return this._send(s.rev, false);
        return this._ok(server.rev);
      }
      if (!s.dirty) return this._take(server, false);       // another device saved; we have nothing new
      return this._ask('both', server);                     // both changed
    } catch (err) {
      this._failed(err);
    }
  },

  // Signed in as someone else than last time (e.g. Andreas's email was
  // used on Sharon's tablet, then Sharon's): swap to the new person's copy,
  // or to an empty app if they have none yet. The old person's data is
  // already on the server under their own email — unless it had changes
  // not sent yet; those are kept as a spare copy so nothing is lost.
  async _switchPerson(s, hello) {
    if (s.dirty) await this._call('POST', 'api/copy', { data: Store.load() });
    const { json: server } = await this._call('GET', 'api/data');
    this._setState({ user: hello.user, rev: null, dirty: false });
    if (server.data) return this._take(server, true);
    this._taking = true;
    try { Store.replaceAll(defaultData()); } finally { this._taking = false; }
    this._ok(server.rev);
    await this._refreshScreens();
  },

  async _send(baseRev, force) {
    const sentNo = this.state().change_no || 0;
    this._setMode('saving');
    const { status, json } = await this._call('PUT', 'api/data', { base_rev: baseRev, data: Store.load(), force });
    if (status === 409) {
      if (json.error === 'big_drop') {
        const { json: server } = await this._call('GET', 'api/data');
        return this._ask('drop', server);
      }
      this._again = true;            // the server moved on in the meantime — look again
      return;
    }
    if (status !== 200) throw { kind: 'error' };
    // Still dirty if another change was made while this one was on its way.
    const now = this.state();
    this._setState({ rev: json.rev, dirty: (now.change_no || 0) !== sentNo });
    if ((now.change_no || 0) !== sentNo) this._again = true;
    this._ok(json.rev);
  },

  // Replaces this device's data with the server's copy.
  async _take(server, wasEmpty) {
    this._taking = true;
    try { Store.replaceAll(server.data); } finally { this._taking = false; }
    this._setState({ rev: server.rev, dirty: false });
    this._ok(server.rev);
    const n = server.data.invoices.length;
    if (wasEmpty && n) showToast(`Loaded your ${n} invoice${n === 1 ? '' : 's'} from your server`, 'success');
    await this._refreshScreens();
  },

  _ok(rev) {
    this._setState({ rev, last_ok: new Date().toISOString() });
    this._setMode('ok');
  },

  _failed(err) {
    const kind = (err && err.kind) || 'error';
    if (kind !== 'error' && kind !== 'offline' && kind !== 'signedout' && kind !== 'none') console.error(err);
    this._setMode(['none', 'offline', 'signedout'].includes(kind) ? kind : 'error');
    // Say it once, when there's something waiting to be saved.
    if (kind === 'signedout' && this.state().dirty && !this._toldSignedOut) {
      this._toldSignedOut = true;
      showToast('Not saved to your server yet — sign in again (Settings → Backup)', 'error');
    }
  },

  _setMode(mode) {
    const was = this.mode;
    this.mode = mode;
    const el = document.getElementById('sync-status');
    if (el) el.innerHTML = this.statusHtml();
    // Settings was drawn before we knew there's a server: draw it again.
    else if (was === 'unknown' && this.hasServer() && App.currentView === 'settings') renderSettings();
  },

  // After taking the server's copy, redraw what's on screen (not during
  // start-up — the app draws everything itself then).
  async _refreshScreens() {
    if (this._booting) return;
    App.settings = await API.getSettings();
    App._clients = null;
    App._invoices = null;
    if (typeof IP !== 'undefined' && IP.open) return;      // don't disturb an invoice being typed
    if (['dashboard', 'invoices', 'clients', 'settings'].includes(App.currentView)) navigate(App.currentView);
  },

  /* ── Two different copies: the person chooses ─────────── */
  _ask(kind, server) {
    this.conflict = { kind, server };
    this._setMode('conflict');
    this.openChoice();
  },

  openChoice() {
    const c = this.conflict;
    if (!c) return;
    const local = Store.load();
    const s = this.state();
    const count = d => { const n = d.invoices.length; return `${n} invoice${n === 1 ? '' : 's'}`; };
    const when  = iso => iso ? new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
    const why = {
      first: 'This device and your server both have invoices, and they are not the same.',
      both:  'Invoices were changed on this device and also somewhere else (another device) since they last matched.',
      drop:  `This device has far fewer invoices than your server. If this device was reset or cleared, keep the server's copy.`
    }[c.kind];
    openModal(`
      <p class="sync-why">${why}</p>
      <div class="sync-choice">
        <button class="btn btn-primary btn-full" onclick="Sync.choose('server')">
          Keep the server's copy — ${count(c.server.data)}${c.server.saved_at ? ` · ${when(c.server.saved_at)}` : ''}</button>
        <button class="btn btn-outline btn-full" onclick="Sync.choose('device')">
          Keep this device's copy — ${count(local)}${s.changed_at ? ` · ${when(s.changed_at)}` : ''}</button>
      </div>
      <p class="sync-note">The copy you don't keep is saved on your server, so nothing is lost.</p>`,
      'Which invoices do you want to keep?');
  },

  async choose(which) {
    const c = this.conflict;
    if (!c) return;
    closeModal();
    try {
      if (which === 'server') {
        await this._call('POST', 'api/copy', { data: Store.load() });   // keep this device's copy too
        this.conflict = null;
        await this._take(c.server, false);
        showToast("Done — this device now has your server's invoices", 'success');
      } else {
        this.conflict = null;
        this.mode = 'saving';
        await this._send(c.server.rev, true);                       // the server keeps what it replaces
        showToast("Done — your server now has this device's invoices", 'success');
      }
    } catch (err) {
      this.conflict = c;
      this._setMode('conflict');
      showToast("Couldn't reach your server — try again in a moment", 'error');
    }
  },

  // Cloudflare's own sign-out page. Next time the app opens it shows
  // "Sign in again", and the email typed then decides whose invoices load.
  signOut() {
    if (!window.confirm('Sign out of your server on this device?\n\nYour invoices stay saved. To get back in, tap "Sign in again" and type your email.')) return;
    location.href = '/cdn-cgi/access/logout';
  },

  signIn() {
    // A normal page visit (not fetch), so Cloudflare can show its email-code
    // page. After signing in, the server sends the app back to its start.
    location.href = 'api/signin';
  },

  /* ── What Settings → Backup shows ─────────────────────── */
  hasServer() { return !['none', 'unknown'].includes(this.mode); },

  statusHtml() {
    const s = this.state();
    const at = s.last_ok ? new Date(s.last_ok).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
    switch (this.mode) {
      case 'ok':        return s.dirty ? `<span class="sync-dot busy"></span>Saving to your server…`
                                       : `<span class="sync-dot ok"></span>Saved on your server${at ? ` · ${at}` : ''}`;
      case 'saving':    return `<span class="sync-dot busy"></span>Saving to your server…`;
      case 'offline':   return `<span class="sync-dot wait"></span>No internet. Your changes are safe on this device and go to your server when you're back online.`;
      case 'signedout': return `<span class="sync-dot bad"></span>Not connected to your server: the sign-in has run out.
                               <div class="settings-actions"><button class="btn btn-primary btn-sm" onclick="Sync.signIn()">Sign in again</button></div>`;
      case 'conflict':  return `<span class="sync-dot bad"></span>This device and your server have different invoices.
                               <div class="settings-actions"><button class="btn btn-primary btn-sm" onclick="Sync.openChoice()">Choose which to keep</button></div>`;
      case 'error':     return `<span class="sync-dot wait"></span>Couldn't reach your server just now. It will try again.
                               <div class="settings-actions"><button class="btn btn-outline btn-sm" onclick="Sync.syncNow()">Try again</button></div>`;
      default:          return '';
    }
  }
};
