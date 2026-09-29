// Musik latar Kampung Pos — semua disintesis di browser (WebAudio), tanpa file audio.
// Komposisi orisinal bernuansa Indonesia:
//   Pagi  : angklung + suling bambu + kendang Sunda (diatonis, pentatonis ceria)
//   Siang : gamelan Jawa laras slendro, bentuk lancaran (saron, peking, bonang, kenong, kempul, gong, kendang)
//   Sore  : kecapi suling, laras pelog (nuansa degung)
//   Malam : keroncong (cak, cuk, cello pizzicato, flute) + jangkrik
// Instrumen pukul & petik dirender sekali ke AudioBuffer (cache per nada) supaya ringan di HP.

const TAU = Math.PI * 2;
const midiHz = (m) => 440 * 2 ** ((m - 69) / 12);
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function n(name) {
  const m = /^([A-G])(b|#)?(-?\d)$/.exec(name);
  return midiHz(12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] === 'b' ? -1 : m[2] === '#' ? 1 : 0));
}
// laras slendro (± 240 sen per langkah, tidak rata) & pelog
const SL = { 1: 0, 2: 235, 3: 475, 5: 710, 6: 955 };
export const slendro = (deg, oct = 0, base = 285) => base * 2 ** ((SL[deg] + 1200 * oct) / 1200);
const PL5 = [0, 120, 270, 670, 785]; // pelog 1 2 3 5 6 (rasa degung)
export const pelog5 = (i, base = 294) => { const o = Math.floor(i / 5), k = ((i % 5) + 5) % 5; return base * 2 ** ((PL5[k] + 1200 * o) / 1200); };

// ------------------------------------------------------------------ sintesis buffer
function synthPartials(sr, f, parts, dur, { click = 0.25, attack = 0.002 } = {}) {
  const len = Math.floor(sr * dur);
  const d = new Float32Array(len);
  for (const [r, a, dec] of parts) {
    const w = (TAU * f * r) / sr;
    const k = Math.exp(-1 / (dec * sr));
    let env = a, ph = Math.random() * TAU;
    for (let i = 0; i < len; i++) { d[i] += env * Math.sin(ph + w * i); env *= k; }
  }
  const na = Math.floor(sr * attack), nc = Math.floor(sr * 0.006);
  for (let i = 0; i < len; i++) {
    if (i < na) d[i] *= i / na;
    if (i < nc) d[i] += (Math.random() * 2 - 1) * click * (1 - i / nc);
  }
  const fade = Math.floor(sr * 0.05);
  for (let i = 0; i < fade; i++) d[len - 1 - i] *= i / fade;
  return d;
}
// Karplus–Strong: kecapi, cak, cuk, cello pizzicato
function synthKS(sr, f, dur, { damp = 0.996, bright = 0.5, body = 0 } = {}) {
  const N = Math.max(2, Math.round(sr / f));
  const ring = new Float32Array(N);
  let prev = 0;
  for (let i = 0; i < N; i++) { const x = Math.random() * 2 - 1; prev = prev + bright * (x - prev); ring[i] = prev; }
  const len = Math.floor(sr * dur);
  const d = new Float32Array(len);
  let idx = 0;
  for (let i = 0; i < len; i++) {
    const y = ring[idx];
    d[i] = y;
    ring[idx] = damp * 0.5 * (y + ring[(idx + 1) % N]);
    idx = (idx + 1) % N;
  }
  if (body) for (let i = 0; i < len; i++) d[i] += body * Math.sin((TAU * f * i) / sr) * Math.exp(-i / (sr * 0.25));
  let peak = 0;
  for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(d[i]));
  const fade = Math.floor(sr * 0.04);
  for (let i = 0; i < len; i++) { d[i] /= peak || 1; if (i > len - fade) d[i] *= (len - i) / fade; }
  return d;
}
function makeIR(ctx, seconds = 2.6) {
  const sr = ctx.sampleRate, len = Math.floor(sr * seconds);
  const b = ctx.createBuffer(2, len, sr);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3.2 * (i < sr * 0.012 ? 0.3 : 1);
  }
  return b;
}

// ------------------------------------------------------------------ resep instrumen (rasio parsial, amplitudo, decay detik)
const RECIPES = {
  saron:   { dur: 2.2, parts: [[1, 0.7, 1.4], [1.006, 0.45, 1.3], [2.76, 0.22, 0.5], [5.4, 0.07, 0.18]], click: 0.3 },
  peking:  { dur: 1.3, parts: [[1, 0.55, 0.8], [1.008, 0.35, 0.7], [2.76, 0.18, 0.3]], click: 0.35 },
  demung:  { dur: 3.0, parts: [[1, 0.8, 2.0], [1.005, 0.5, 1.9], [2.76, 0.18, 0.6]], click: 0.2 },
  bonang:  { dur: 1.8, parts: [[1, 0.6, 1.0], [1.004, 0.3, 0.9], [1.99, 0.18, 0.5], [3.1, 0.12, 0.25]], click: 0.4 },
  kenong:  { dur: 3.2, parts: [[1, 0.8, 2.4], [1.003, 0.5, 2.2], [2.42, 0.12, 0.8]], click: 0.15, attack: 0.004 },
  kethuk:  { dur: 0.5, parts: [[1, 0.6, 0.18], [2.1, 0.2, 0.07]], click: 0.3 },
  kempul:  { dur: 4.5, parts: [[1, 0.9, 3.2], [1.008, 0.6, 3.0], [2.01, 0.25, 1.2], [2.93, 0.12, 0.6]], click: 0.1, attack: 0.008 },
  gong:    { dur: 8.0, parts: [[1, 1.0, 6.5], [1.011, 0.8, 6.5], [2.0, 0.3, 3.2], [2.93, 0.18, 1.8], [4.1, 0.08, 0.9]], click: 0.05, attack: 0.02 },
  angklung:{ dur: 0.45, parts: [[1, 0.6, 0.22], [2, 0.32, 0.16], [4, 0.1, 0.09], [2.76, 0.08, 0.06]], click: 0.5, attack: 0.001 },
  gender:  { dur: 3.0, parts: [[1, 0.6, 2.2], [1.005, 0.4, 2.0], [3.0, 0.08, 0.6]], click: 0.08, attack: 0.004 },
};
const PLUCKS = {
  kecapi: { dur: 2.4, damp: 0.9975, bright: 0.55 },
  cuk:    { dur: 0.6, damp: 0.985, bright: 0.85 },
  cak:    { dur: 0.9, damp: 0.99, bright: 0.7 },
  cello:  { dur: 1.2, damp: 0.992, bright: 0.25, body: 0.35 },
  gitar:  { dur: 1.6, damp: 0.994, bright: 0.45 },
};

// ------------------------------------------------------------------ lagu
const bar = (arr) => arr; // penanda keterbacaan
const TRACKS = {
  pagi: {
    title: 'Esuk ing Kampung · angklung & suling', bpm: 88, spb: 2, length: 64,
    chords: [['C4', 'E4', 'G4'], ['A3', 'C4', 'E4'], ['F3', 'A3', 'C4'], ['G3', 'B3', 'D4'], ['C4', 'E4', 'G4'], ['E3', 'G3', 'B3'], ['F3', 'A3', 'C4', 'G3', 'B3', 'D4'], ['C4', 'E4', 'G4']],
    melody: [
      bar([[0, 'E5', 2], [2, 'G5', 2], [4, 'A5', 2], [6, 'G5', 2]]),
      bar([[0, 'E5', 3], [3, 'D5', 1], [4, 'C5', 4]]),
      bar([[0, 'D5', 2], [2, 'E5', 2], [4, 'G5', 2], [6, 'A5', 1], [7, 'G5', 1]]),
      bar([[0, 'E5', 2], [2, 'D5', 6]]),
      bar([[0, 'G5', 2], [2, 'A5', 2], [4, 'C6', 2], [6, 'A5', 2]]),
      bar([[0, 'G5', 3], [3, 'E5', 1], [4, 'G5', 4]]),
      bar([[0, 'A5', 2], [2, 'G5', 2], [4, 'E5', 2], [6, 'D5', 2]]),
      bar([[0, 'C5', 6]]),
    ],
    play(m, step, t, d, sd) {
      const b = Math.floor(step / 8), s = step % 8;
      const ch = this.chords[b];
      const tones = ch.length > 3 ? (s < 4 ? ch.slice(0, 3) : ch.slice(3)) : ch;
      if (s % 4 === 0) for (const nm of tones) m.angklungShake(n(nm), t, d, sd * 3.6, 0.22);
      if (s % 2 === 1) m.hit('angklung', n(tones[(s >> 1) % 3]) * 2, t, d, 0.2);
      if (s === 0 || s === 4) m.pluck('kecapi', n(tones[0]) / 2, t, d, 0.35);
      for (const [st, nm, len] of this.melody[b]) if (st === s) m.suling(n(nm), t, len * sd * 0.95, d, 0.5);
      const kd = { 0: 'dhe', 3: 'tak', 4: 'dhe', 6: 'tak', 7: 'ket' }[s];
      if (kd && step >= 16) m.kendang(kd, t, d, 0.42);
    },
  },
  siang: {
    title: 'Lancaran Tugu Pos · gamelan slendro', level: 0.62, bpm: 108, spb: 2, length: 64,
    balungan: [5, 6, 5, 3, 2, 1, 2, 6, 5, 3, 5, 6, 1, 6, 5, 3, 2, 3, 2, 1, 6, 5, 6, 1, 2, 3, 5, 6, 5, 3, 2, 1],
    play(m, step, t, d, sd) {
      const beat = step >> 1, off = step & 1;
      const note = this.balungan[beat % 32];
      const next = this.balungan[(beat + 1) % 32];
      const o = (deg) => (deg === 6 && (beat % 4 === 0) ? -1 : 0);
      if (!off) {
        m.hit('saron', slendro(note, o(note)), t, d, 0.2);
        m.hit('demung', slendro(note, -1), t, d, 0.12);
        m.hit('peking', slendro(note, 1), t, d, 0.09);
        const g = beat % 16;
        if (g % 4 === 3) m.hit('kenong', slendro(note, 0), t, d, 0.17);
        if (g === 5 || g === 9 || g === 13) m.hit('kempul', slendro(note, -2), t, d, 0.3);
        if (g === 15) m.hit('gong', slendro(note, -3) * 0.95, t, d, 0.6);
      } else {
        m.hit('peking', slendro(next, 1), t, d, 0.07);
        m.hit('bonang', slendro(next, 0), t, d, 0.09);
        m.hit('bonang', slendro(next, 1), t + 0.004, d, 0.06);
        if (beat % 2 === 0) m.hit('kethuk', slendro(2, -1), t, d, 0.2);
      }
      const k = { 0: 'dhe', 2: 'tak', 3: 'ket', 4: 'dhe', 5: 'tak', 7: 'dhe' }[step % 8];
      if (k) m.kendang(k, t, d, 0.42);
    },
  },
  sore: {
    title: 'Senja Kecapi · kecapi suling pelog', bpm: 64, spb: 4, length: 128,
    roots: [0, 0, -1, -1, -2, -2, 1, 0],
    tmpl: [0, 3, 5, 3, 7, 3, 5, 3, 0, 3, 5, 3, 6, 3, 5, 3],
    melody: [
      [[0, 7, 6], [6, 6, 2], [8, 5, 8]],
      [[0, 6, 4], [4, 5, 4], [8, 3, 8]],
      [[0, 5, 6], [6, 4, 2], [8, 3, 4], [12, 2, 4]],
      [[0, 3, 16]],
      [[0, 8, 4], [4, 7, 4], [8, 8, 4], [12, 9, 4]],
      [[0, 8, 8], [8, 7, 8]],
      [[0, 6, 4], [4, 5, 4], [8, 6, 2], [10, 5, 2], [12, 3, 4]],
      [[0, 5, 12]],
    ],
    play(m, step, t, d, sd) {
      const b = Math.floor(step / 16), s = step % 16;
      const r = this.roots[b];
      const v = s % 4 === 0 ? 0.34 : 0.22;
      m.pluck('kecapi', pelog5(r + this.tmpl[s] - 5, 294), t, d, v);
      if (s === 0 && b % 4 === 0) m.hit('kempul', pelog5(r - 10, 294), t, d, 0.35);
      if (s === 8 && b % 2 === 1) m.hit('gender', pelog5(r + 5, 294), t, d, 0.16);
      for (const [st, idx, len] of this.melody[b]) if (st === s) m.suling(pelog5(idx, 588 / 2), t, len * sd * 0.97, d, 0.55, { bend: true });
    },
  },
  malam: {
    title: 'Keroncong Radio Om Budi', bpm: 92, spb: 2, length: 64,
    chords: [['F3', 'A3', 'C4'], ['F3', 'A3', 'C4'], ['C3', 'E3', 'Bb3'], ['C3', 'E3', 'Bb3'], ['Bb2', 'D3', 'F3'], ['C3', 'E3', 'Bb3'], ['F3', 'A3', 'C4'], ['F3', 'A3', 'C4']],
    roots: ['F2', 'F2', 'C2', 'C2', 'Bb1', 'C2', 'F2', 'F2'],
    fifths: ['C3', 'C3', 'G2', 'G2', 'F2', 'G2', 'C3', 'C3'],
    melody: [
      [[0, 'A5', 3], [3, 'G5', 1], [4, 'F5', 2], [6, 'C6', 2]],
      [[0, 'A5', 4], [6, 'F5', 1], [7, 'G5', 1]],
      [[0, 'A5', 2], [2, 'Bb5', 2], [4, 'G5', 4]],
      [[0, 'E5', 2], [2, 'F5', 1], [3, 'G5', 1], [4, 'E5', 2], [6, 'C5', 2]],
      [[0, 'D5', 3], [3, 'F5', 1], [4, 'Bb5', 4]],
      [[0, 'A5', 2], [2, 'G5', 2], [4, 'E5', 2], [6, 'G5', 2]],
      [[0, 'F5', 2], [2, 'A5', 2], [4, 'C6', 3], [7, 'A5', 1]],
      [[0, 'F5', 6]],
    ],
    play(m, step, t, d, sd) {
      const b = Math.floor(step / 8), s = step % 8;
      const ch = this.chords[b].map(n);
      // cuk: "crong-crong" tiap 1/8, aksen di offbeat
      ch.forEach((f, i) => m.pluck('cuk', f * 2, t + i * 0.008, d, s % 2 ? 0.22 : 0.12));
      // cak: sinkop di ketukan 2 & 4
      if (s === 2 || s === 6) ch.forEach((f, i) => m.pluck('cak', f, t + i * 0.012, d, 0.2));
      // cello: pola "dung ... dung-dung" khas keroncong
      if (s === 0) m.pluck('cello', n(this.roots[b]), t, d, 0.75);
      if (s === 3) m.pluck('cello', n(this.fifths[b]), t, d, 0.55);
      if (s === 5) m.pluck('cello', n(this.roots[b]), t, d, 0.6);
      if (s === 6) m.pluck('cello', n(this.roots[b]) * 1.26, t, d, 0.5);
      // gitar arpeggio lembut
      m.pluck('gitar', ch[[0, 1, 2, 1][s % 4]] * 2, t, d, 0.08);
      for (const [st, nm, len] of this.melody[b]) if (st === s) m.suling(n(nm), t, len * sd * 0.92, d, 0.5, { flute: true });
    },
  },
};
export const TRACK_KEYS = ['pagi', 'siang', 'sore', 'malam'];
export const trackTitle = (k) => TRACKS[k]?.title || '';

// ------------------------------------------------------------------ mesin
export class Music {
  constructor(ctx, { realtime = true } = {}) {
    this.ctx = ctx;
    this.realtime = realtime;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.25;
    this.master = ctx.createGain(); this.master.gain.value = 0.9;
    this.master.connect(comp).connect(ctx.destination);
    this.musicBus = this._gain(0.6, this.master);
    this.sfxBus = this._gain(0.8, this.master);
    this.ambBus = this._gain(0.35, this.master);
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = makeIR(ctx);
    this.revIn = this._gain(0.32, this.reverb);
    this.reverb.connect(this.master);
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = this.noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.cache = new Map();
    this.cur = null;
    this.amb = { mode: 'day', next: 0 };
    this.scheduled = 0;
    this.timer = null;
  }
  _gain(v, to) { const g = this.ctx.createGain(); g.gain.value = v; if (to) g.connect(to); return g; }

  start() {
    if (this.realtime && !this.timer) this.timer = setInterval(() => this.scheduleUntil(this.ctx.currentTime + 0.3), 40);
  }
  stop() { clearInterval(this.timer); this.timer = null; }
  setVolumes({ music, sfx } = {}) {
    const t = this.ctx.currentTime;
    if (music != null) this.musicBus.gain.setTargetAtTime(music * 0.6, t, 0.1), this.ambBus.gain.setTargetAtTime(music * 0.4, t, 0.1);
    if (sfx != null) this.sfxBus.gain.setTargetAtTime(sfx * 0.8, t, 0.1);
  }
  get nowPlaying() { return this.cur ? TRACKS[this.cur.key].title : ''; }

  // ganti lagu dengan crossfade, masuk di awal birama berikutnya
  play(key, when) {
    if (this.cur?.key === key) return;
    const def = TRACKS[key];
    const ctx = this.ctx;
    const t0 = when ?? ctx.currentTime + 0.12;
    const dest = this._gain(0, null);
    dest.connect(this.musicBus); dest.connect(this.revIn);
    dest.gain.setValueAtTime(0, t0);
    dest.gain.linearRampToValueAtTime(def.level ?? 1, t0 + (this.cur ? 3 : 0.8));
    if (this.cur) {
      const old = this.cur.dest;
      old.gain.cancelScheduledValues(t0);
      old.gain.setValueAtTime(old.gain.value || 1, t0);
      old.gain.linearRampToValueAtTime(0, t0 + 3);
      setTimeout(() => old.disconnect(), this.realtime ? 12000 : 0);
    }
    this.cur = { key, def, step: 0, next: t0, sd: 60 / def.bpm / def.spb, dest };
    this.amb.mode = key === 'malam' ? 'night' : 'day';
  }
  setPhase(i) { this.play(TRACK_KEYS[i] || 'pagi'); }

  scheduleUntil(tEnd) {
    const c = this.cur;
    if (c) {
      while (c.next < tEnd) {
        c.def.play(this, c.step, c.next, c.dest, c.sd);
        c.next += c.sd;
        c.step = (c.step + 1) % c.def.length;
      }
    }
    while (this.amb.next < tEnd) {
      const t = Math.max(this.amb.next, this.ctx.currentTime);
      if (this.amb.mode === 'night') { this.cricket(t); this.amb.next = t + 0.5 + Math.random() * 0.9; }
      else { if (Math.random() < 0.6) this.bird(t); this.amb.next = t + 2.5 + Math.random() * 4.5; }
    }
  }

  // ---------------- instrumen
  _buffer(key, make) {
    let b = this.cache.get(key);
    if (!b) {
      const data = make(this.ctx.sampleRate);
      b = this.ctx.createBuffer(1, data.length, this.ctx.sampleRate);
      b.copyToChannel(data, 0);
      this.cache.set(key, b);
    }
    return b;
  }
  _playBuf(buf, t, dest, vel) {
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    const g = this.ctx.createGain(); g.gain.value = vel;
    s.connect(g).connect(dest);
    s.start(t);
    this.scheduled++;
  }
  hit(inst, f, t, dest, vel = 0.5) {
    const r = RECIPES[inst];
    const key = `${inst}:${f.toFixed(1)}`;
    const buf = this._buffer(key, (sr) => synthPartials(sr, f, r.parts, r.dur, r));
    this._playBuf(buf, t, dest, vel);
  }
  angklungShake(f, t, dest, dur, vel) {
    const rate = 1 / 12.5;
    const hits = Math.max(1, Math.round(dur / rate));
    for (let i = 0; i < hits; i++) {
      const env = i === 0 ? 1 : 0.55 + 0.3 * Math.sin((i / hits) * Math.PI);
      this.hit('angklung', f, t + i * rate + (Math.random() - 0.5) * 0.006, dest, vel * env);
    }
  }
  pluck(kind, f, t, dest, vel = 0.4) {
    const p = PLUCKS[kind];
    const key = `${kind}:${f.toFixed(1)}`;
    const buf = this._buffer(key, (sr) => synthKS(sr, f, p.dur, p));
    this._playBuf(buf, t, dest, vel);
  }
  suling(f, t, dur, dest, vel = 0.5, { bend = false, flute = false } = {}) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = 'sine';
    const o2 = ctx.createOscillator(); o2.type = 'triangle';
    const start = bend ? f * 0.94 : f * 0.985;
    o.frequency.setValueAtTime(start, t); o.frequency.exponentialRampToValueAtTime(f, t + (bend ? 0.12 : 0.05));
    o2.frequency.setValueAtTime(start * 2, t); o2.frequency.exponentialRampToValueAtTime(f * 2, t + (bend ? 0.12 : 0.05));
    const lfo = ctx.createOscillator(); lfo.frequency.value = flute ? 5.6 : 5.0;
    const lg = ctx.createGain(); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * (flute ? 0.006 : 0.009), t + Math.min(0.35, dur * 0.6));
    lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
    const g = ctx.createGain();
    const a = Math.min(0.07, dur * 0.3), rel = Math.min(0.12, dur * 0.3);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * 0.3, t + a);
    g.gain.setValueAtTime(vel * 0.27, t + dur - rel); g.gain.linearRampToValueAtTime(0, t + dur);
    const g2 = ctx.createGain(); g2.gain.value = flute ? 0.05 : 0.09;
    const nz = ctx.createBufferSource(); nz.buffer = this.noise; nz.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 1.5; bp.Q.value = 4;
    const ng = ctx.createGain(); ng.gain.value = (flute ? 0.05 : 0.11) * vel;
    o.connect(g); o2.connect(g2).connect(g); nz.connect(bp).connect(ng).connect(g);
    g.connect(dest);
    for (const s of [o, o2, lfo, nz]) { s.start(t); s.stop(t + dur + 0.05); }
    this.scheduled++;
  }
  kendang(stroke, t, dest, vel = 0.5) {
    const ctx = this.ctx;
    const env = (g, peak, dec) => { g.gain.setValueAtTime(peak * vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dec); };
    if (stroke === 'dhe') {
      const o = ctx.createOscillator(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(64, t + 0.14);
      const g = ctx.createGain(); env(g, 0.9, 0.42); o.connect(g).connect(dest); o.start(t); o.stop(t + 0.45);
    } else if (stroke === 'tung') {
      const o = ctx.createOscillator(); o.frequency.setValueAtTime(260, t); o.frequency.exponentialRampToValueAtTime(205, t + 0.1);
      const g = ctx.createGain(); env(g, 0.55, 0.25); o.connect(g).connect(dest); o.start(t); o.stop(t + 0.3);
    }
    if (stroke === 'tak' || stroke === 'ket' || stroke === 'dhe') {
      const s = ctx.createBufferSource(); s.buffer = this.noise;
      const f = ctx.createBiquadFilter();
      f.type = stroke === 'dhe' ? 'lowpass' : 'bandpass';
      f.frequency.value = stroke === 'tak' ? 2100 : stroke === 'ket' ? 4200 : 380; f.Q.value = 1.4;
      const g = ctx.createGain(); env(g, stroke === 'dhe' ? 0.3 : stroke === 'tak' ? 0.55 : 0.3, stroke === 'ket' ? 0.035 : 0.075);
      s.connect(f).connect(g).connect(dest); s.start(t, Math.random() * 0.5); s.stop(t + 0.12);
    }
    this.scheduled++;
  }
  bird(t) {
    const ctx = this.ctx;
    const n2 = 2 + Math.floor(Math.random() * 3), base = 2600 + Math.random() * 1400;
    for (let i = 0; i < n2; i++) {
      const tt = t + i * (0.09 + Math.random() * 0.05);
      const o = ctx.createOscillator(); o.frequency.setValueAtTime(base, tt); o.frequency.exponentialRampToValueAtTime(base * (1.3 + Math.random() * 0.4), tt + 0.06);
      const g = ctx.createGain(); g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(0.05, tt + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.08);
      o.connect(g).connect(this.ambBus); o.start(tt); o.stop(tt + 0.1);
    }
  }
  cricket(t) {
    const ctx = this.ctx;
    const f = 4300 + Math.random() * 600;
    for (let i = 0; i < 3; i++) {
      const tt = t + i * 0.045;
      const o = ctx.createOscillator(); o.frequency.value = f;
      const g = ctx.createGain(); g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(0.025, tt + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.03);
      o.connect(g).connect(this.ambBus); o.start(tt); o.stop(tt + 0.04);
    }
  }

  // ---------------- SFX bernada (tetap bernuansa gamelan/angklung)
  sfx(kind) {
    const t = this.ctx.currentTime + 0.01, d = this.sfxBus;
    if (kind === 'pick') [n('C5'), n('E5'), n('G5')].forEach((f, i) => this.angklungShake(f, t + i * 0.09, d, 0.18, 0.4));
    if (kind === 'deliver') { [5, 6, 1].forEach((g, i) => this.hit('bonang', slendro(g, g === 1 ? 1 : 0), t + i * 0.16, d, 0.55)); this.hit('kempul', slendro(1, -2), t + 0.5, d, 0.5); }
    if (kind === 'jump') this.kendang('tak', t, d, 0.25);
    if (kind === 'land') this.kendang('dhe', t, d, 0.3);
    if (kind === 'talk') this.hit('peking', slendro([1, 2, 3, 5, 6][Math.floor(Math.random() * 5)], 1), t, d, 0.09);
    if (kind === 'ui') this.kendang('ket', t, d, 0.4);
    if (kind === 'wind') {
      const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.loop = true;
      const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.8;
      f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(1800, t + 0.6); f.frequency.exponentialRampToValueAtTime(400, t + 1.3);
      const g = this.ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.35, t + 0.3); g.gain.linearRampToValueAtTime(0, t + 1.3);
      s.connect(f).connect(g).connect(d); s.start(t); s.stop(t + 1.4);
    }
  }
}

// Render lagu ke AudioBuffer (untuk pratinjau / tes)
export async function renderTrack(key, seconds = 20, sampleRate = 44100) {
  const ctx = new OfflineAudioContext(2, Math.floor(seconds * sampleRate), sampleRate);
  const m = new Music(ctx, { realtime: false });
  m.play(key, 0.05);
  m.scheduleUntil(seconds);
  return ctx.startRendering();
}
