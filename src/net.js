// Ghost pemain lain + emoji + warisan "kurir pensiun" (NPC JSON).
// Transport: Supabase Realtime bila config.js diisi, selain itu BroadcastChannel
// (buka 2 tab untuk menguji ghost secara lokal). Semua gagal = main sendirian, tetap jalan.

const CHANNEL = 'kampung-pos-ghost';
const LEGACY_KEY = 'kp.legacy.v1';
const SUPABASE_ESM = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

export function sanitizeText(s, max) {
  return String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, max);
}

export function sanitizeLegacy(o) {
  if (!o || typeof o !== 'object') return null;
  const dir = Array.isArray(o.dir) && o.dir.length === 3 && o.dir.every(Number.isFinite) ? o.dir : null;
  if (!dir) return null;
  const shirt = /^#[0-9a-fA-F]{6}$/.test(o.shirt) ? o.shirt : '#ff7a3d';
  return {
    v: 1, type: 'kurir_pensiun', example: !!o.example,
    name: sanitizeText(o.name, 20) || 'Kurir',
    message: sanitizeText(o.message, 100),
    shirt, dir, chapter: Number(o.chapter) || 1, letters: Number(o.letters) || 0,
    created_at: sanitizeText(o.created_at, 30),
  };
}

export class Net {
  constructor(cfg = {}) {
    this.cfg = cfg;
    this.id = Math.random().toString(36).slice(2, 10);
    this.mode = 'offline';
    this.handlers = { pos: [], emoji: [] };
    this.sb = null;
    this.channel = null;
    this.bc = null;
  }

  on(evt, fn) { this.handlers[evt]?.push(fn); }
  _emit(evt, data) {
    if (!data || data.id === this.id) return;
    for (const fn of this.handlers[evt] || []) fn(data);
  }

  async connect() {
    if (this.cfg.supabaseUrl && this.cfg.supabaseAnonKey) {
      try {
        const { createClient } = await import(SUPABASE_ESM);
        this.sb = createClient(this.cfg.supabaseUrl, this.cfg.supabaseAnonKey, { realtime: { params: { eventsPerSecond: 12 } } });
        this.channel = this.sb.channel(CHANNEL, { config: { broadcast: { self: false } } });
        this.channel.on('broadcast', { event: 'pos' }, ({ payload }) => this._emit('pos', payload));
        this.channel.on('broadcast', { event: 'emoji' }, ({ payload }) => this._emit('emoji', payload));
        await new Promise((res) => this.channel.subscribe((s) => { if (s === 'SUBSCRIBED') res(); }));
        this.mode = 'supabase';
        return this.mode;
      } catch (e) {
        console.warn('Supabase tidak tersedia, pakai mode lokal.', e);
        this.sb = null;
      }
    }
    try {
      this.bc = new BroadcastChannel(CHANNEL);
      this.bc.onmessage = (ev) => {
        const m = ev.data;
        if (m && (m.t === 'pos' || m.t === 'emoji')) this._emit(m.t, m.d);
      };
      this.mode = 'lokal (antar-tab)';
    } catch {
      this.mode = 'offline';
    }
    return this.mode;
  }

  send(evt, data) {
    const d = { ...data, id: this.id };
    if (this.channel) this.channel.send({ type: 'broadcast', event: evt, payload: d });
    else if (this.bc) this.bc.postMessage({ t: evt, d });
  }

  // ---------- warisan kurir (NPC JSON)
  loadLocalLegacy() {
    try { return (JSON.parse(localStorage.getItem(LEGACY_KEY) || '[]')).map(sanitizeLegacy).filter(Boolean); }
    catch { return []; }
  }

  async loadLegacy(seeds = []) {
    let list = [...seeds.map(sanitizeLegacy).filter(Boolean), ...this.loadLocalLegacy()];
    if (this.sb) {
      try {
        const { data } = await this.sb.from('npc_legacy').select('*').order('created_at', { ascending: false }).limit(20);
        if (data) list = list.concat(data.map((r) => sanitizeLegacy({ ...r, dir: r.dir })).filter(Boolean));
      } catch (e) { console.warn('Gagal memuat npc_legacy', e); }
    }
    return list;
  }

  async saveLegacy(npc) {
    const clean = sanitizeLegacy(npc);
    if (!clean) return { ok: false, where: 'invalid' };
    try {
      const arr = JSON.parse(localStorage.getItem(LEGACY_KEY) || '[]');
      arr.push(clean);
      localStorage.setItem(LEGACY_KEY, JSON.stringify(arr.slice(-20)));
    } catch { /* storage diblokir: tetap lanjut */ }
    if (this.sb) {
      try {
        const { error } = await this.sb.from('npc_legacy').insert({
          name: clean.name, message: clean.message, shirt: clean.shirt, dir: clean.dir, chapter: clean.chapter, letters: clean.letters,
        });
        if (!error) return { ok: true, where: 'supabase' };
      } catch { /* jatuh ke lokal */ }
    }
    return { ok: true, where: 'lokal' };
  }
}
