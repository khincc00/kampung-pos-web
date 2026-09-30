// Kehidupan kampung: warga yang berjalan menurut jadwal, warga cerita yang berkeliaran di depan rumahnya,
// hewan (kucing, bebek, kambing, kerbau, burung), layangan, angkot, ikan melompat, daun berguguran, hujan + pelangi,
// dan titik interaksi kecil (kentongan, gong, teropong, kopi, pancing, sumur ...).
import * as THREE from 'three';
import { R, WATER, LAKE, heightAt, frameAt, surfacePoint, localDir, prefab, softMat } from './world.js';
import { Character } from './characters.js';
import { makeAmbient, GREETINGS, CAT_NAMES, RESIDENTS } from './story.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = THREE.MathUtils.clamp;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const _m = new THREE.Matrix4(), _l = V3();

const inHours = (h, [a, b]) => (b > 24 ? h >= a || h < b - 24 : h >= a && h < b);

// ------------------------------------------------------------------ geometri hewan (menghadap +z)
const G = {
  kucing: prefab([
    { t: 'sphere', r: 0.16, seg: 9, ring: 7, sc: [0.85, 0.8, 1.55], p: [0, 0.21, 0], c: '#ffffff' },
    { t: 'sphere', r: 0.115, seg: 9, ring: 7, p: [0, 0.36, 0.26], c: '#ffffff' },
    { t: 'cone', r: 0.045, h: 0.1, seg: 3, p: [0.07, 0.47, 0.25], c: '#f7e6e6' }, { t: 'cone', r: 0.045, h: 0.1, seg: 3, p: [-0.07, 0.47, 0.25], c: '#f7e6e6' },
    { t: 'sphere', r: 0.014, p: [0.05, 0.38, 0.36], seg: 5, ring: 4, c: '#1a1210' }, { t: 'sphere', r: 0.014, p: [-0.05, 0.38, 0.36], seg: 5, ring: 4, c: '#1a1210' },
    { t: 'sphere', r: 0.018, p: [0, 0.34, 0.375], seg: 5, ring: 4, c: '#e89aa0' },
    { t: 'capsule', r: 0.026, len: 0.34, p: [0, 0.3, -0.32], r3: [1.0, 0, 0], c: '#f0f0f0' },
    ...[[-0.07, 0.15], [0.07, 0.15], [-0.07, -0.13], [0.07, -0.13]].map(([x, z]) => ({ t: 'capsule', r: 0.032, len: 0.06, p: [x, 0.05, z], c: '#ffffff' })),
  ]),
  bebek: prefab([
    { t: 'sphere', r: 0.2, seg: 9, ring: 7, sc: [0.85, 0.7, 1.3], p: [0, 0.14, 0], c: '#ffffff' },
    { t: 'sphere', r: 0.1, seg: 8, ring: 6, p: [0, 0.36, 0.2], c: '#ffffff' },
    { t: 'box', s: [0.08, 0.03, 0.12], p: [0, 0.34, 0.33], c: '#f2a33a', sharp: true },
    { t: 'cone', r: 0.09, h: 0.16, seg: 4, p: [0, 0.2, -0.3], r3: [-1.9, 0, 0], c: '#f0f0f0' },
    { t: 'sphere', r: 0.014, p: [0.05, 0.4, 0.27], seg: 5, ring: 4, c: '#1a1210' }, { t: 'sphere', r: 0.014, p: [-0.05, 0.4, 0.27], seg: 5, ring: 4, c: '#1a1210' },
  ]),
  kambing: prefab([
    { t: 'sphere', r: 0.3, seg: 10, ring: 8, sc: [0.75, 0.85, 1.5], p: [0, 0.65, 0], c: '#ffffff' },
    { t: 'sphere', r: 0.15, seg: 8, ring: 6, sc: [0.9, 1, 1.2], p: [0, 0.9, 0.5], c: '#ffffff' },
    { t: 'cone', r: 0.04, h: 0.22, seg: 4, p: [0.07, 1.08, 0.45], r3: [-0.6, 0, 0.2], c: '#d8d0c0' }, { t: 'cone', r: 0.04, h: 0.22, seg: 4, p: [-0.07, 1.08, 0.45], r3: [-0.6, 0, -0.2], c: '#d8d0c0' },
    { t: 'cone', r: 0.05, h: 0.1, seg: 3, p: [0.16, 0.96, 0.46], r3: [0, 0, -1.4], c: '#ffffff' }, { t: 'cone', r: 0.05, h: 0.1, seg: 3, p: [-0.16, 0.96, 0.46], r3: [0, 0, 1.4], c: '#ffffff' },
    { t: 'cone', r: 0.03, h: 0.12, seg: 4, p: [0, 0.74, 0.62], c: '#e8e0d0' },
    { t: 'capsule', r: 0.03, len: 0.14, p: [0, 0.78, -0.48], r3: [-0.8, 0, 0], c: '#ffffff' },
    ...[[-0.12, 0.3], [0.12, 0.3], [-0.12, -0.3], [0.12, -0.3]].map(([x, z]) => ({ t: 'cyl', rt: 0.03, rb: 0.024, h: 0.5, p: [x, 0.25, z], c: '#7a6a5a', seg: 5 })),
    { t: 'sphere', r: 0.014, p: [0.06, 0.95, 0.62], seg: 5, ring: 4, c: '#1a1210' }, { t: 'sphere', r: 0.014, p: [-0.06, 0.95, 0.62], seg: 5, ring: 4, c: '#1a1210' },
  ]),
  kerbau: prefab([
    { t: 'sphere', r: 0.55, seg: 12, ring: 9, sc: [0.85, 0.85, 1.6], p: [0, 1.0, 0], c: '#ffffff' },
    { t: 'sphere', r: 0.27, seg: 9, ring: 7, sc: [1, 0.95, 1.2], p: [0, 1.05, 0.95], c: '#f2f2f2' },
    { t: 'capsule', r: 0.05, len: 0.5, p: [0.36, 1.22, 0.82], r3: [0, 0, -1.25], c: '#d8d0c0' }, { t: 'capsule', r: 0.05, len: 0.5, p: [-0.36, 1.22, 0.82], r3: [0, 0, 1.25], c: '#d8d0c0' },
    { t: 'cone', r: 0.16, h: 0.16, seg: 5, p: [0, 0.92, 1.28], r3: [Math.PI / 2, 0, 0], c: '#c9b8a8' },
    ...[[-0.24, 0.55], [0.24, 0.55], [-0.24, -0.55], [0.24, -0.55]].map(([x, z]) => ({ t: 'cyl', rt: 0.09, rb: 0.08, h: 0.7, p: [x, 0.35, z], c: '#8a8078', seg: 6 })),
    { t: 'capsule', r: 0.03, len: 0.5, p: [0, 0.85, -1.0], r3: [-0.2, 0, 0], c: '#f0f0f0' },
    { t: 'sphere', r: 0.025, p: [0.13, 1.14, 1.16], seg: 5, ring: 4, c: '#1a1210' }, { t: 'sphere', r: 0.025, p: [-0.13, 1.14, 1.16], seg: 5, ring: 4, c: '#1a1210' },
  ]),
  burung: prefab([
    { t: 'capsule', r: 0.05, len: 0.1, p: [0, 0, 0], r3: [Math.PI / 2, 0, 0], c: '#4a3b33' }, { t: 'sphere', r: 0.045, p: [0, 0.01, 0.12], seg: 5, ring: 4, c: '#4a3b33' },
    { t: 'box', s: [0.42, 0.012, 0.13], p: [0.24, 0, -0.01], c: '#5a4a3f', sharp: true }, { t: 'box', s: [0.42, 0.012, 0.13], p: [-0.24, 0, -0.01], c: '#5a4a3f', sharp: true },
    { t: 'box', s: [0.06, 0.01, 0.16], p: [0, 0, -0.16], c: '#3b302b', sharp: true },
  ]),
  angkot: prefab([
    { t: 'box', s: [2.0, 0.75, 4.3], p: [0, 0.72, 0], c: '#ffffff' }, { t: 'box', s: [1.9, 0.7, 3.4], p: [0, 1.4, -0.25], c: '#fefcf5', sharp: true },
    { t: 'box', s: [1.92, 0.42, 3.0], p: [0, 1.45, -0.2], c: '#2f3f4c', sharp: true }, { t: 'box', s: [1.95, 0.08, 3.4], p: [0, 1.78, -0.25], c: '#ffffff', sharp: true },
    { t: 'box', s: [1.6, 0.3, 1.0], p: [0, 1.15, 1.45], r3: [-0.5, 0, 0], c: '#2f3f4c', sharp: true },
    ...[[-0.92, 1.4], [0.92, 1.4], [-0.92, -1.4], [0.92, -1.4]].map(([x, z]) => ({ t: 'cyl', rt: 0.36, h: 0.22, p: [x, 0.36, z], r3: [0, 0, Math.PI / 2], c: '#25211e', seg: 10 })),
    ...[-0.6, 0.6].map((x) => ({ t: 'box', s: [0.28, 0.16, 0.06], p: [x, 0.78, 2.17], c: '#fff4c2', sharp: true })),
    { t: 'box', s: [1.7, 0.05, 2.4], p: [0, 1.86, -0.2], c: '#8a8f8a', sharp: true },
    { t: 'box', s: [1.95, 0.14, 4.32], p: [0, 0.58, 0], c: '#fefcf5' },
  ]),
  layangan: (() => {
    const g = new THREE.BufferGeometry();
    const P = [0, 0.7, 0, -0.5, 0, 0, 0, -0.9, 0, 0, 0.7, 0, 0, -0.9, 0, 0.5, 0, 0];
    const cols = ['#d9483b', '#d9483b', '#feca57', '#feca57', '#d9483b', '#feca57'].flatMap((c) => { const k = new THREE.Color(c); return [k.r, k.g, k.b]; });
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); g.computeVertexNormals();
    return g;
  })(),
};
const SPECIES = {
  kucing: { count: 6, geo: G.kucing, tints: ['#f29a3a', '#9a9a92', '#f4ede0', '#3b302b', '#d9a878', '#ffffff'], speed: 0.9, run: 3.4, roam: 4, states: [['sit', 0.35], ['sleep', 0.25], ['walk', 0.3], ['groom', 0.1]], flee: 5.2, pet: true, shadow: 0.5 },
  bebek: { count: 5, geo: G.bebek, tints: ['#ffffff', '#d8c8a8', '#f4ede0', '#b8a37a', '#ffffff'], speed: 0.5, roam: 8, water: true, states: [['walk', 0.7], ['dip', 0.3]], flee: 99 },
  kambing: { count: 4, geo: G.kambing, tints: ['#f4ede0', '#b89a78', '#3b302b', '#e8e0d0'], speed: 0.45, roam: 5, states: [['graze', 0.55], ['walk', 0.3], ['sit', 0.15]], flee: 6 },
  kerbau: { count: 2, geo: G.kerbau, tints: ['#7a726a', '#6a625a'], speed: 0.3, roam: 6, states: [['graze', 0.5], ['walk', 0.3], ['sit', 0.2]], flee: 99 },
};

/** opts: { scene, world, npcs, textSprite, emojiSprite, spawnEmoji, sfx, isTouch } */
export function createLife(opts) {
  const { scene, world, npcs, textSprite, spawnEmoji, sfx } = opts;
  const matVC = softMat({ vertexColors: true }, 0.3);
  const colliders = world.colliders;
  const S = { pets: 0, greets: 0, fish: 0, coffee: 0 };
  const T = { rain: 0, rainTarget: 0, rainbow: 0, nextRain: 75 + Math.random() * 60, rainT: 0 };
  let hourNow = 8, playerPos = V3(), playerUp = V3(0, 1, 0), playerSpeed = 0, dialogSpeaker = '';
  const follower = { cat: null };

  // ---------------------------------------------------------------- utilitas gerak di permukaan bola
  function blockedAt(p) {
    for (const c of colliders) {
      if (c.base.distanceToSquared(p) > 110) continue;
      _l.copy(p).sub(c.base);
      const lx = _l.dot(c.lx), lz = _l.dot(c.lz);
      if (Math.abs(lx) < c.hx + 0.5 && Math.abs(lz) < c.hz + 0.5 && c.y0 < 1.2 && c.top > 0.6) return true;
    }
    return false;
  }
  function segmentClear(a, b) {
    for (let i = 0; i <= 8; i++) if (blockedAt(surfacePoint(a.clone().lerp(b, i / 8).normalize()))) return false;
    return true;
  }
  const _to = V3();
  function stepOn(o, target, speed, dt, turn = 9) {
    _to.copy(target).sub(o.dir); _to.addScaledVector(o.dir, -_to.dot(o.dir));
    const dist = _to.length() * R;
    if (dist > 0.04) {
      _to.normalize();
      o.heading.lerp(_to, 1 - Math.exp(-turn * dt));
      o.heading.addScaledVector(o.dir, -o.heading.dot(o.dir));
      if (o.heading.lengthSq() < 1e-6) o.heading.copy(_to);
      o.heading.normalize();
      o.dir.addScaledVector(o.heading, Math.min(speed * dt, dist) / R).normalize();
    }
    o.heading.addScaledVector(o.dir, -o.heading.dot(o.dir)).normalize();
    return dist;
  }
  const randomDirNear = (dir, r) => { const f = frameAt(dir), a = Math.random() * 6.283, d = Math.sqrt(Math.random()) * r; return dir.clone().addScaledVector(f.east, Math.cos(a) * d / R).addScaledVector(f.north, Math.sin(a) * d / R).normalize(); };

  // ---------------------------------------------------------------- warga ramai
  const nodes = {};
  for (const [dk, list] of Object.entries(world.walk)) nodes[dk] = list.filter((d) => !blockedAt(surfacePoint(d)));
  const speechCache = new Map();
  function bubble(text) {
    let base = speechCache.get(text);
    if (!base) { base = textSprite(text, { size: 26, scale: 0.0088, bg: 'rgba(255,255,255,0.96)' }); speechCache.set(text, base); }
    const s = base.clone(); s.renderOrder = 8; return s;
  }
  const walkers = makeAmbient(opts.lowQ ? 14 : 22).map((def, idx) => {
    const ch = new Character(def.look, { lod: 0.6 });
    ch.pop = 0; ch.root.visible = false;
    scene.add(ch.root);
    const tag = textSprite(def.name, { size: 24, scale: 0.008, bg: 'rgba(59,42,32,0.55)', fg: '#fef9ef' });
    tag.visible = false; scene.add(tag);
    const list = nodes[def.where] || nodes.alun;
    const start = pick(list);
    return { def, idx, ch, tag, dir: start.clone(), heading: frameAt(start).north.clone(), target: start.clone(), state: 'idle', t: rnd(0, 3), pos: surfacePoint(start), up: start.clone(), fade: 0, active: false, greetCd: 0, bubble: null, bubbleT: 0, walkV: 0, emoteT: rnd(6, 20) };
  });
  function pickTarget(w) {
    const list = nodes[w.def.where] || nodes.alun;
    for (let tries = 0; tries < 8; tries++) {
      const n = pick(list), d = n.angleTo(w.dir) * R;
      if (d > 2.5 && d < 18 && segmentClear(w.dir, n)) return n;
    }
    return null;
  }
  function updateWalkers(dt, t, headPos) {
    const rainy = T.rain > 0.55;
    for (const w of walkers) {
      const want = inHours(hourNow, w.def.hours) && !(rainy && w.idx % 2 === 1);
      if (want && !w.active && w.fade < 0.02) { const list = nodes[w.def.where] || nodes.alun; const n = pick(list); w.dir.copy(n); w.target.copy(n); w.state = 'idle'; w.t = rnd(0.5, 2); }
      w.active = want;
      w.fade = damp(w.fade, want ? 1 : 0, 2.2, dt);
      if (w.fade < 0.02 && !want) { w.ch.root.visible = false; w.tag.visible = false; continue; }
      w.pos.copy(surfacePoint(w.dir)); w.up.copy(w.dir);
      const d = w.pos.distanceTo(playerPos);
      const talkingToMe = dialogSpeaker === w.def.name;
      const near = d < 3 && playerSpeed < 3.5;
      // keadaan
      if (talkingToMe || (near && w.state !== 'chat')) { if (w.state !== 'chat') { w.state = 'chat'; if (w.greetCd <= 0) { w.ch.startWave(); w.greetCd = 30; S.greets++; showBubble(w, pick(GREETINGS), 2.6); } } }
      else if (w.state === 'chat' && d > 4.5 && !talkingToMe) { w.state = 'idle'; w.t = rnd(0.4, 1.4); }
      w.greetCd -= dt;
      let speed = 0;
      if (w.state === 'walk') {
        speed = w.def.speed * (rainy ? 1.6 : 1);
        const rem = stepOn(w, w.target, speed, dt);
        if (rem < 0.3) { w.state = 'idle'; w.t = rnd(2.5, 8); }
      } else if (w.state === 'idle') {
        w.t -= dt;
        if (w.t <= 0) { const n = pickTarget(w); if (n) { w.target.copy(n); w.state = 'walk'; } else w.t = rnd(1.5, 4); }
      } else if (w.state === 'chat') {
        // menghadap kurir
        _to.copy(playerPos).sub(w.pos); _to.addScaledVector(w.up, -_to.dot(w.up)); if (_to.lengthSq() > 1e-4) { _to.normalize(); w.heading.lerp(_to, 1 - Math.exp(-5 * dt)).normalize(); }
      }
      w.emoteT -= dt;
      if (w.emoteT <= 0) { w.emoteT = rnd(9, 24); if (d < 12 && w.state !== 'walk') spawnEmoji(pick(['🎵', '💭', '😊', '☀️', '🍃', '💬']), w.pos, w.up); }
      if (w.bubble) { w.bubbleT -= dt; w.bubble.position.copy(w.pos).addScaledVector(w.up, (w.def.look.kid ? 1.5 : 2.05) * (w.def.look.s || 1)); if (w.bubbleT <= 0) { scene.remove(w.bubble); w.bubble = null; } }
      // tampilan
      const vis = d < 30 && w.up.dot(playerUp) > 0.55;
      w.ch.root.visible = vis;
      w.tag.visible = vis && d > 2.6 && d < 9 && !w.bubble;
      if (!vis) { w.walkV = 0; continue; }
      w.ch.pop = clamp(w.fade, 0, 1);
      w.ch.setShadow(d < (opts.lowQ ? 0 : 10));
      w.ch.place(w.pos, w.up, w.heading);
      w.walkV = damp(w.walkV, speed, 8, dt);
      w.ch.update(dt, { speed: w.walkV, grounded: true, look: d < 6 ? headPos : null, talking: talkingToMe });
      if (w.tag.visible) w.tag.position.copy(w.pos).addScaledVector(w.up, (w.def.look.kid ? 1.55 : 2.1) * (w.def.look.s || 1));
      opts.blob(w.pos, w.up, 0.8);
    }
  }
  function showBubble(w, text, secs) {
    if (w.bubble) scene.remove(w.bubble);
    w.bubble = bubble(text); w.bubbleT = secs; scene.add(w.bubble);
  }

  // ---------------------------------------------------------------- warga cerita: berkeliaran di depan rumahnya
  const residents = Object.values(npcs).map((n) => {
    const def = RESIDENTS[n.id];
    const basis = { lx: V3().crossVectors(n.up, n.face).normalize(), lz: n.face.clone() };
    return { n, home: n.pos.clone(), homeDir: n.pos.clone().normalize(), basis, radius: def.house === 'dermaga' ? 0 : def.wander || 0, state: 'idle', t: rnd(1, 5), target: null, dir: n.pos.clone().normalize(), heading: n.face.clone(), speed: 0.55, emoteT: rnd(8, 20), def };
  });
  function updateResidents(dt, headPos) {
    for (const r of residents) {
      const n = r.n;
      const dPl = n.pos.distanceTo(playerPos);
      const busy = dialogSpeaker === n.name || dPl < 4.2;
      n.walkV = n.walkV || 0;
      let speed = 0;
      if (r.radius > 0 && !busy) {
        if (r.state === 'idle') { r.t -= dt; if (r.t <= 0) { const off = r.basis.lx.clone().multiplyScalar(rnd(-1, 1) * r.radius).addScaledVector(r.basis.lz, rnd(-0.3, 1) * Math.min(1, r.radius)); const tgt = r.home.clone().add(off).normalize(); if (!blockedAt(surfacePoint(tgt)) && segmentClear(r.dir, tgt)) { r.target = tgt; r.state = 'walk'; } else r.t = rnd(2, 5); } }
        else { speed = r.speed * (r.def.look?.stoop > 0.2 ? 0.6 : 1); const rem = stepOn(r, r.target, speed, dt); if (rem < 0.15) { r.state = 'idle'; r.t = rnd(3, 9); } }
      } else if (r.state === 'walk') { r.state = 'idle'; r.t = 2; }
      n.walkV = damp(n.walkV, speed, 8, dt);
      if (r.state === 'walk' || r.dir.distanceToSquared(r.homeDir) > 1e-12) { n.pos.copy(surfacePoint(r.dir)); n.up.copy(r.dir); }
      n.heading = r.heading;
      r.emoteT -= dt;
      if (r.emoteT <= 0) { r.emoteT = rnd(10, 26); if (dPl < 14 && !busy && n.ch.root.visible) spawnEmoji(pick(r.def.emote || ['💭']), n.pos, n.up); }
    }
  }

  // ---------------------------------------------------------------- hewan (instanced, 1 draw per jenis)
  const animals = [];
  const meshes = {};
  const homes = {
    kucing: [['alun', -6.8, 3.4], ['pelangi', 2.2, 5], ['pecinan', -0.6, 13.5], ['pasar', 2.4, 5.4], ['seng', -3, 1.6], ['bukit', 3.6, 5]],
    bebek: [['pasar', -2.5, -12], ['pasar', 3, -10], ['pasar', -5, -7], ['pasar', 5.5, -13], ['pasar', -1.5, -15]],
    kambing: [['bukit', -5, 4.5], ['bukit', 5, 3.5], ['seng', 14, 5.8], ['seng', -14, 6.4]],
    kerbau: [['sawah', -3, 1], ['sawah', 3, -1]],
  };
  for (const [kind, sp] of Object.entries(SPECIES)) {
    const im = new THREE.InstancedMesh(sp.geo, matVC, sp.count);
    im.frustumCulled = false; im.castShadow = !opts.lowQ; im.name = 'hewan_' + kind;
    scene.add(im); meshes[kind] = im;
    for (let i = 0; i < sp.count; i++) {
      const [dk, x, z] = homes[kind][i % homes[kind].length];
      let home = localDir(dk, x, z);
      if (sp.water) { for (let k = 0; k < 30 && heightAt(home) > WATER - 0.6; k++) home = randomDirNear(localDir(dk, x, z), 4); }
      else for (let k = 0; k < 12 && (blockedAt(surfacePoint(home)) || heightAt(home) < WATER + 0.6); k++) home = randomDirNear(localDir(dk, x, z), 2.5);
      im.setColorAt(i, new THREE.Color(sp.tints[i % sp.tints.length]));
      animals.push({ kind, sp, im, i, home, dir: home.clone(), heading: frameAt(home).north.clone(), target: home.clone(), state: kind === 'kucing' ? 'sit' : 'graze', t: rnd(0, 4), seed: Math.random() * 20, name: kind === 'kucing' ? CAT_NAMES[i % CAT_NAMES.length] : kind, pet: 0, fleeT: 0, vis: true });
    }
    im.instanceColor.needsUpdate = true;
  }
  const waterAt = (d) => heightAt(d) < WATER - 0.5;
  const _up = V3();
  function updateAnimals(dt, t) {
    for (const a of animals) {
      const sp = a.sp;
      a.t -= dt; a.pet = Math.max(0, a.pet - dt);
      const pos0 = surfacePoint(a.dir);
      const dPl = pos0.distanceTo(playerPos);
      // kucing pengikut
      const following = follower.cat === a;
      if (following && dPl > 32) follower.cat = null;
      // kaget
      if (a.state !== 'flee' && a.pet <= 0 && playerSpeed > sp.flee * 0.9 && dPl < 3.2 && !following) { a.state = 'flee'; a.t = rnd(0.9, 1.6); const away = pos0.clone().sub(playerPos); away.addScaledVector(a.dir, -away.dot(a.dir)).normalize(); a.target = a.dir.clone().addScaledVector(away, rnd(4, 7) / R).normalize(); if (a.kind === 'kucing' && dPl < 5) sfx('meow'); }
      let speed = 0;
      if (a.pet > 0) { a.state = 'pet'; }
      else if (a.state === 'pet') { a.state = 'sit'; a.t = rnd(2, 5); }
      if (following && a.state !== 'flee' && a.pet <= 0) {
        const rem = a.dir.angleTo(playerUp) * R; // dekat pemain
        const goal = playerPos.clone().normalize().addScaledVector(V3().crossVectors(playerUp, a.heading).normalize(), 0.9 / R).normalize();
        const dd = stepOn(a, goal, dPl > 5 ? sp.run : dPl > 2.2 ? 1.6 : 0, dt, 6);
        speed = dPl > 5 ? sp.run : dPl > 2.2 ? 1.6 : 0; a.state = speed > 0 ? 'walk' : 'sit';
      } else if (a.state === 'flee') {
        speed = sp.run || 3.2; stepOn(a, a.target, speed, dt, 12);
        if (a.t <= 0) { a.state = 'sit'; a.t = rnd(2, 5); }
      } else if (a.state === 'walk') {
        speed = sp.speed;
        const rem = stepOn(a, a.target, speed, dt);
        if (rem < 0.2 || a.t <= 0) { a.state = pick(sp.states.filter((s) => s[0] !== 'walk')).at(0); a.t = rnd(3, 10); }
      } else if (a.state !== 'pet' && a.t <= 0) {
        const r = Math.random(); let acc = 0, ns = 'walk';
        for (const [s, p] of sp.states) { acc += p; if (r < acc) { ns = s; break; } }
        a.state = ns; a.t = rnd(3, 10);
        if (ns === 'walk') {
          for (let k = 0; k < 8; k++) { const c = randomDirNear(a.home, sp.roam); if (sp.water ? waterAt(c) : !blockedAt(surfacePoint(c)) && heightAt(c) > WATER + 0.5) { a.target = c; break; } }
          a.t = 6;
        }
      }
      // pose
      const up = a.dir;
      const lift0 = sp.water ? 0 : 0;
      const bob = a.state === 'walk' || a.state === 'flee' ? Math.abs(Math.sin(t * (a.state === 'flee' ? 16 : 7) + a.seed)) * (a.kind === 'kucing' ? 0.03 : 0.02) : 0;
      let pos;
      if (sp.water) { pos = up.clone().multiplyScalar(R + WATER + 0.02 + Math.sin(t * 1.6 + a.seed) * 0.025); }
      else pos = surfacePoint(a.dir, bob + lift0);
      let pitch = 0, sy = 1, sxz = 1, yOff = 0;
      switch (a.state) {
        case 'graze': pitch = 0.55 + Math.sin(t * 2 + a.seed) * 0.05; break;
        case 'sit': pitch = a.kind === 'kucing' ? -0.62 : -0.25; yOff = a.kind === 'kucing' ? -0.02 : 0; sy = 0.97 + Math.sin(t * 2 + a.seed) * 0.02; break;
        case 'sleep': sy = 0.55 + Math.sin(t * 1.4 + a.seed) * 0.03; sxz = 1.12; break;
        case 'groom': pitch = 0.3 + Math.sin(t * 9 + a.seed) * 0.12; break;
        case 'dip': pitch = 0.7 + Math.sin(t * 3 + a.seed) * 0.1; break;
        case 'pet': sy = 1 + Math.sin(t * 12) * 0.03; pitch = -0.3; break;
        case 'flee': pitch = -0.08; break;
        default: pitch = 0;
      }
      const lx = V3().crossVectors(up, a.heading).normalize();
      _m.makeBasis(lx, up, a.heading).multiply(new THREE.Matrix4().makeRotationX(pitch)).multiply(new THREE.Matrix4().makeScale(sxz, sy, sxz)).setPosition(pos.addScaledVector(up, yOff));
      a.im.setMatrixAt(a.i, _m);
      a.pos = pos;
      a.speed = speed;
      if (sp.shadow && d2vis(a)) opts.blob(a.pos, up, sp.shadow);
    }
    for (const m of Object.values(meshes)) m.instanceMatrix.needsUpdate = true;
  }
  const d2vis = (a) => a.pos.distanceToSquared(playerPos) < 900 && a.dir.dot(playerUp) > 0.5;

  // ---------------------------------------------------------------- burung, layangan, angkot, ikan, daun, hujan
  // burung
  const birdMesh = new THREE.InstancedMesh(G.burung, matVC, 22);
  birdMesh.frustumCulled = false; scene.add(birdMesh);
  const birds = Array.from({ length: 22 }, (_, i) => {
    const flock = i < 12 ? 0 : 1;
    return { flock, ph: Math.random() * 6.28, r: (flock ? 16 : 13) + Math.random() * 8, alt: 9 + Math.random() * 9, sp: (flock ? 0.16 : 0.2) + Math.random() * 0.08, boost: 0 };
  });
  const flockCenters = [localDir('alun', 0, 0), localDir('pasar', 0, -6)];
  function scatterBirds() { for (const b of birds) b.boost = 1; }
  function updateBirds(dt, t, night) {
    birds.forEach((b, i) => {
      b.boost = Math.max(0, b.boost - dt * 0.25);
      const c = flockCenters[b.flock], f = frameAt(c);
      const a = t * b.sp + b.ph, r = b.r + b.boost * 22;
      const d = c.clone().addScaledVector(f.east, Math.cos(a) * r / R).addScaledVector(f.north, Math.sin(a) * r / R).normalize();
      const alt = night > 0.6 ? -20 : b.alt + b.boost * 14 + Math.sin(a * 3) * 1.4;
      const pos = surfacePoint(d, alt);
      const head = f.east.clone().multiplyScalar(-Math.sin(a)).addScaledVector(f.north, Math.cos(a)); head.addScaledVector(d, -head.dot(d)).normalize();
      const flap = 0.3 + Math.abs(Math.sin(t * (10 + b.boost * 6) + i)) * 0.8;
      _m.makeBasis(V3().crossVectors(d, head).normalize(), d, head).scale(V3(flap, 1, 1)).setPosition(pos);
      birdMesh.setMatrixAt(i, _m);
    });
    birdMesh.instanceMatrix.needsUpdate = true;
  }
  // layangan
  const kiteMesh = new THREE.Mesh(G.layangan, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  const kiteTail = new THREE.Mesh(prefab(Array.from({ length: 7 }, (_, i) => ({ t: 'box', s: [0.16, 0.06, 0.02], sharp: true, p: [Math.sin(i * 1.4) * 0.12, -1.05 - i * 0.34, 0], c: i % 2 ? '#48dbfb' : '#ff9a9e' }))), new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  kiteMesh.add(kiteTail); kiteMesh.scale.setScalar(1.5);
  const kiteLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 12 }, () => V3())), new THREE.LineBasicMaterial({ color: '#efe3c4', transparent: true, opacity: 0.8 }));
  kiteLine.frustumCulled = false; kiteMesh.frustumCulled = false;
  scene.add(kiteMesh, kiteLine);
  const kiteAnchorDir = localDir('alun', 0.5, 14.4), kiteBase = localDir('alun', 5.5, 17);
  function updateKite(t, hour) {
    const on = hour > 8 && hour < 17.6 && T.rain < 0.3;
    kiteMesh.visible = kiteLine.visible = on;
    if (!on) return;
    const f = frameAt(kiteBase);
    const d = kiteBase.clone().addScaledVector(f.east, Math.sin(t * 0.25) * 4 / R).addScaledVector(f.north, Math.cos(t * 0.19) * 3 / R).normalize();
    const p = surfacePoint(d, 21 + Math.sin(t * 0.7) * 1.6);
    const wind = f.east.clone();
    _m.makeBasis(wind, d, V3().crossVectors(wind, d).normalize()); kiteMesh.quaternion.setFromRotationMatrix(_m);
    kiteMesh.rotateZ(Math.sin(t * 1.3) * 0.25); kiteMesh.rotateX(-0.5);
    kiteMesh.position.copy(p);
    const a = surfacePoint(kiteAnchorDir, 1.4), pts = kiteLine.geometry.attributes.position;
    for (let i = 0; i < 12; i++) { const k = i / 11; const q = a.clone().lerp(p, k).addScaledVector(d, -Math.sin(k * Math.PI) * 1.6); pts.setXYZ(i, q.x, q.y, q.z); }
    pts.needsUpdate = true;
  }
  // angkot
  const angkotRoutes = [];
  world.roads.forEach((pts, ri) => {
    if (ri > 1) return;          // alun–pelangi, alun–pecinan (datar & aman)
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].angleTo(pts[i - 1]) * R);
    angkotRoutes.push({ pts, cum, len: cum[cum.length - 1] });
  });
  const angkotMesh = new THREE.InstancedMesh(G.angkot, matVC, angkotRoutes.length);
  angkotMesh.frustumCulled = false; angkotMesh.castShadow = !opts.lowQ; scene.add(angkotMesh);
  ['#3f8f8a', '#ff7a3d'].forEach((c, i) => angkotMesh.setColorAt(i, new THREE.Color(c)));
  const vehicles = angkotRoutes.map((r, i) => ({ r, s: r.len * (0.2 + 0.4 * i), dirn: 1, wait: 0, v: 0, pos: V3(), heading: V3(0, 0, 1), up: V3(0, 1, 0), honk: 0 }));
  function samplePath(r, s) {
    let i = 1; while (i < r.cum.length - 1 && r.cum[i] < s) i++;
    const k = clamp((s - r.cum[i - 1]) / Math.max(1e-6, r.cum[i] - r.cum[i - 1]), 0, 1);
    return r.pts[i - 1].clone().lerp(r.pts[i], k).normalize();
  }
  function updateVehicles(dt, night) {
    vehicles.forEach((v, i) => {
      const r = v.r;
      const ahead = samplePath(r, clamp(v.s + v.dirn * 3, 0, r.len)), here = samplePath(r, v.s);
      const dP = surfacePoint(here).distanceTo(playerPos);
      // pelan / berhenti kalau ada kurir di jalan depan
      let target = v.wait > 0 ? 0 : 3.2;
      const toP = playerPos.clone().sub(surfacePoint(here)), fwd = surfacePoint(ahead).sub(surfacePoint(here)).normalize();
      if (dP < 7 && toP.dot(fwd) > 0 && Math.abs(toP.dot(V3().crossVectors(here, fwd).normalize())) < 1.6) { target = dP < 3.2 ? 0 : 1; if (v.honk <= 0 && dP < 5.5) { sfx('bell'); v.honk = 3; spawnEmoji('📢', surfacePoint(here), here); } }
      v.honk -= dt;
      v.v = damp(v.v, target, 3, dt);
      v.wait -= dt;
      v.s += v.dirn * v.v * dt;
      if (v.s > r.len - 5 || v.s < 5) { v.s = clamp(v.s, 5, r.len - 5); v.dirn *= -1; v.wait = 4; v.v = 0; }
      const d = samplePath(r, v.s), d2 = samplePath(r, clamp(v.s + v.dirn * 0.8, 0, r.len));
      const side = V3().crossVectors(d, d2.clone().sub(d)).normalize();
      const dd = d.clone().addScaledVector(side, (v.dirn > 0 ? 0.9 : -0.9) / R).normalize();
      const pos = surfacePoint(dd, 0.02);
      const head = surfacePoint(d2).sub(surfacePoint(d)).normalize(); head.addScaledVector(dd, -head.dot(dd)).normalize();
      _m.makeBasis(V3().crossVectors(dd, head).normalize(), dd, head).setPosition(pos);
      angkotMesh.setMatrixAt(i, _m);
      v.pos.copy(pos);
    });
    angkotMesh.instanceMatrix.needsUpdate = true;
  }
  // ikan melompat + riak di danau
  const fish = new THREE.Mesh(prefab([{ t: 'sphere', r: 0.11, seg: 7, ring: 5, sc: [0.5, 0.6, 1.5], p: [0, 0, 0], c: '#c9d2d4' }, { t: 'cone', r: 0.06, h: 0.12, seg: 3, p: [0, 0, -0.2], r3: [-Math.PI / 2, 0, 0], c: '#ff9a55' }]), matVC);
  fish.visible = false; scene.add(fish);
  const ripples = [0, 1, 2].map(() => { const m = new THREE.Mesh(new THREE.RingGeometry(0.15, 0.22, 20), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })); m.visible = false; scene.add(m); return { m, t: 9 }; });
  const jump = { t: 9, dir: null, next: 3 };
  function ripple(dir, big = 1) {
    const r = ripples.find((x) => x.t > 1.4) || ripples[0];
    r.t = 0; r.dir = dir.clone(); r.big = big; r.m.visible = true;
  }
  function updateFish(dt, t, night) {
    for (const r of ripples) {
      if (r.t > 1.4) { r.m.visible = false; continue; }
      r.t += dt;
      const p = r.dir.clone().multiplyScalar(R + WATER + 0.06);
      r.m.position.copy(p);
      r.m.quaternion.setFromUnitVectors(V3(0, 0, 1), r.dir);
      r.m.scale.setScalar((0.4 + r.t * 1.8) * r.big);
      r.m.material.opacity = Math.max(0, 0.6 - r.t * 0.45);
    }
    jump.next -= dt;
    if (jump.next <= 0 && jump.t > 1) {
      const c = randomDirNear(LAKE, 14);
      if (heightAt(c) < WATER - 0.9) { jump.dir = c; jump.t = 0; jump.next = rnd(3, 9); sfx(surfacePoint(c).distanceTo(playerPos) < 24 ? 'splash' : ''); ripple(c, 1); }
      else jump.next = 0.5;
    }
    if (jump.t <= 1) {
      jump.t += dt * 1.5;
      const k = Math.min(1, jump.t), h = Math.sin(k * Math.PI) * 1.5;
      const f = frameAt(jump.dir), d = jump.dir.clone().addScaledVector(f.east, (k - 0.5) * 1.2 / R).normalize();
      const pos = d.clone().multiplyScalar(R + WATER + 0.05 + h);
      const head = f.east.clone().multiplyScalar(1).addScaledVector(d, Math.cos(k * Math.PI) * -1.4).normalize();
      _m.makeBasis(V3().crossVectors(d, head).normalize(), d, head).setPosition(pos); fish.matrixAutoUpdate = false; fish.matrix.copy(_m); fish.matrixWorldNeedsUpdate = true;
      fish.visible = true;
      if (jump.t > 1) { fish.visible = false; ripple(jump.dir, 1.4); }
    }
  }
  // daun & kelopak berguguran di sekitar kurir
  const LEAF_N = 30;
  const leafMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.12, 0.075), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true }), LEAF_N);
  leafMesh.frustumCulled = false; scene.add(leafMesh);
  const leafCols = ['#c9a24a', '#8fb35a', '#d9704a', '#ffc9d9', '#f0d060'];
  const leaves = Array.from({ length: LEAF_N }, (_, i) => { leafMesh.setColorAt(i, new THREE.Color(leafCols[i % leafCols.length])); return { p: V3(), ph: Math.random() * 9, sp: rnd(0.4, 0.9), u: 0, v: 0, y: Math.random() * 6 }; });
  leafMesh.instanceColor.needsUpdate = true;
  function updateLeaves(dt, t, cam, on) {
    const up = playerUp, f = frameAt(up);
    leaves.forEach((l, i) => {
      l.y -= l.sp * dt;
      if (l.y < 0) { l.y = rnd(4, 7); do { l.u = rnd(-13, 13); l.v = rnd(-13, 13); } while (Math.hypot(l.u, l.v) < 3.5); }
      const sx = Math.sin(t * 0.9 + l.ph) * 0.8, sz = Math.cos(t * 0.7 + l.ph * 1.3) * 0.8;
      const p = playerPos.clone().addScaledVector(f.east, l.u + sx + t * 0.15 % 1).addScaledVector(f.north, l.v + sz).addScaledVector(up, l.y);
      _m.makeRotationFromEuler(new THREE.Euler(t * 2 + l.ph, t * 1.4 + l.ph, t + l.ph)).setPosition(p);
      if (!on) _m.scale(V3(0, 0, 0));
      leafMesh.setMatrixAt(i, _m);
    });
    leafMesh.instanceMatrix.needsUpdate = true;
  }
  // hujan
  const RAIN_N = 520;
  const rainGeo = new THREE.BufferGeometry();
  const rainPos = new Float32Array(RAIN_N * 6), rainSeed = [];
  for (let i = 0; i < RAIN_N; i++) rainSeed.push({ u: rnd(-14, 14), v: rnd(-14, 14), y: rnd(0, 14), s: rnd(16, 24) });
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: '#dfe9f2', transparent: true, opacity: 0.5, depthWrite: false }));
  rain.frustumCulled = false; rain.visible = false; scene.add(rain);
  function updateRain(dt) {
    rain.visible = T.rain > 0.02;
    if (!rain.visible) return;
    rain.material.opacity = 0.55 * T.rain;
    const up = playerUp, f = frameAt(up);
    for (let i = 0; i < RAIN_N; i++) {
      const r = rainSeed[i];
      r.y -= r.s * dt; if (r.y < -1) { r.y += 15; r.u = rnd(-14, 14); r.v = rnd(-14, 14); }
      const p = playerPos.clone().addScaledVector(f.east, r.u).addScaledVector(f.north, r.v).addScaledVector(up, r.y);
      rainPos.set([p.x, p.y, p.z, p.x - up.x * 0.55 + f.east.x * 0.05, p.y - up.y * 0.55 + f.east.y * 0.05, p.z - up.z * 0.55 + f.east.z * 0.05], i * 6);
    }
    rainGeo.attributes.position.needsUpdate = true;
  }
  // pelangi setelah hujan
  const rainbow = new THREE.Group();
  ['#e4483b', '#ff9a3d', '#feca57', '#5fbf6a', '#48a6e8', '#7a6fd0'].forEach((c, k) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(80 - k * 2.4, 1.3, 6, 48, Math.PI), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    rainbow.add(m);
  });
  rainbow.visible = false; scene.add(rainbow);
  function updateWeather(dt, t, night, sunDir, started) {
    T.rainT -= dt;
    if (started) T.nextRain -= dt;
    if (T.nextRain <= 0 && T.rainTarget === 0 && night < 0.5) { T.rainTarget = 1; T.rainT = rnd(45, 90); T.nextRain = rnd(220, 420); opts.toast('🌧️ Hujan turun. Warga berteduh.'); }
    if (T.rainTarget === 1 && T.rainT <= 0) { T.rainTarget = 0; T.rainbow = night < 0.3 ? 1 : 0; T.rbT = 80; opts.toast(T.rainbow ? '🌈 Hujan reda. Lihat ke langit.' : 'Hujan reda.'); }
    T.rain = damp(T.rain, T.rainTarget, 0.6, dt);
    if (T.rbT > 0) { T.rbT -= dt; if (T.rbT <= 0 || night > 0.4) T.rainbow = 0; }
    const rbA = damp(rainbow.children[0].material.opacity / 0.4, T.rainbow && T.rain < 0.1 ? 1 : 0, 0.7, dt);
    rainbow.children.forEach((m) => { m.material.opacity = rbA * 0.4; });
    rainbow.visible = rbA > 0.01;
    if (rainbow.visible) {
      const away = sunDir.clone().addScaledVector(playerUp, -sunDir.dot(playerUp)).normalize().negate();
      const c = playerPos.clone().addScaledVector(away, 240).addScaledVector(playerUp, -75);
      _m.makeBasis(V3().crossVectors(playerUp, away).normalize(), playerUp, away.clone().negate()).setPosition(c);
      rainbow.matrixAutoUpdate = false; rainbow.matrix.copy(_m); rainbow.matrixWorldNeedsUpdate = true;
    }
  }

  // ---------------------------------------------------------------- titik interaksi
  const fishing = { on: false, t: 0, spot: null, sprite: null };
  const buff = { speed: 1, t: 0, cd: 0 };
  const FISH = [['🐟', 'ikan mas'], ['🐠', 'ikan hias'], ['🐡', 'ikan buntal'], ['🦐', 'udang galah'], ['🥾', 'sepatu bot butut'], ['🐸', 'kodok kecil'], ['🦀', 'kepiting'], ['🐟', 'ikan nila']];
  const teropongLines = (h) => h < 10
    ? ['Kabut tipis di atas danau. Perahu Bang Ucok kelihatan seperti mainan.', 'Asap dapur Warung Kopi naik lurus. Pertanda hari cerah.']
    : h < 15 ? ['Atap seng berkilau semua. Dari sini kelihatan seperti tangga menuju langit.', 'Ada layangan merah di atas Alun-Alun. Anak-anak pasti sedang di bawahnya.']
    : h < 18.3 ? ['Matahari mulai turun. Lampion Pecinan sebentar lagi dinyalakan.', 'Burung-burung berputar di atas danau. Mereka tahu sebentar lagi malam.']
    : ['Lampu-lampu rumah menyala satu per satu. Kampung ini seperti sekumpulan kunang-kunang.', 'Kabel semrawut itu, kalau dilihat malam-malam, jadi kelihatan seperti rasi bintang.'];
  const ACTS = [
    { id: 'kentongan', spot: 'poi:kentongan', label: 'Kentongan Pos Ronda', verb: 'Pukul', run() { sfx('kentongan'); scatterBirds(); for (const a of animals) if (a.kind === 'kucing' && a.pos.distanceTo(playerPos) < 25) { a.state = 'flee'; a.t = 1.4; a.target = randomDirNear(a.dir, 6); } opts.toast('🔔 Tok-tok-tok! Semua burung kaget.'); for (const w of walkers) if (w.active && w.pos.distanceTo(playerPos) < 20) w.ch.startWave(); } },
    { id: 'gong', spot: 'poi:gong', label: 'Gong Klenteng', verb: 'Pukul', run() { sfx('gong'); spawnEmoji('🐉', playerPos, playerUp); opts.toast('🔔 Gooong… semoga suratmu selamat sampai.'); } },
    { id: 'teropong', spot: 'poi:teropong', label: 'Teropong Bukit', verb: 'Intip', run() { opts.say('Teropong', teropongLines(hourNow)); } },
    { id: 'kopi', spot: 'poi:kopi', label: 'Kopi Tubruk Bu Sri', verb: 'Seruput', run() {
      if (buff.cd > 0) return opts.toast(buff.t > 0 ? '☕ Kopimu masih hangat. Larimu masih ngebut.' : '☕ Gelasnya masih kosong. Tunggu sebentar.');
      sfx('sip'); S.coffee++; buff.speed = 1.3; buff.t = 40; buff.cd = 55;
      spawnEmoji('☕', playerPos, playerUp); opts.toast('☕ Semangat! Lari & jalan 30% lebih cepat selama 40 detik.'); } },
    { id: 'pancing', spot: 'poi:pancing', label: 'Pancingan Dermaga', verb: 'Mancing', run(it) {
      if (fishing.on) { fishing.on = false; opts.toast('Kamu menggulung pancing.'); return; }
      fishing.on = true; fishing.t = rnd(2.5, 5.5); fishing.spot = it.pos; sfx('splash'); opts.toast('🎣 Menunggu ikan… (jalan menjauh untuk berhenti)'); ripple(it.pos.clone().normalize(), 0.7); } },
    { id: 'sumur', spot: 'poi:sumur', label: 'Sumur Tua', verb: 'Timba', run() { sfx('splash'); spawnEmoji('💧', playerPos, playerUp); opts.say('', ['Kamu menimba air. Dingin, jernih, sedikit rasa besi.', 'Di dasar sumur ada suara gema. Mungkin cuma suaramu sendiri.']); } },
    { id: 'beringin', spot: 'poi:beringin', label: 'Pohon Beringin', verb: 'Berteduh', run() { sfx('heart'); for (let i = 0; i < 3; i++) spawnEmoji('🍃', playerPos.clone().addScaledVector(V3().crossVectors(playerUp, V3(0.3, 1, 0.2)).normalize(), i - 1), playerUp); opts.say('', [pick(['Akar gantungnya bergoyang pelan. Rasanya semua orang pernah duduk di sini.', 'Bayangan beringin ini menutupi separuh alun-alun. Kesejukannya gratis.', 'Ada ukiran di batang: "R + M 1998". Kamu tidak kenal siapa mereka, tapi tersenyum.'])]); } },
    { id: 'sawah', spot: 'poi:sawah', label: 'Gubuk Sawah', verb: 'Lihat', run() { opts.say('', ['Gubuk kecil di tengah sawah. Ada topi caping tergantung.', 'Di dinding kayu ada tulisan kapur: "Padi bilang terima kasih."']); } },
  ];
  const actList = ACTS.filter((a) => world.spots[a.spot]).map((a) => ({ ...a, pos: world.spots[a.spot].pos }));

  function interactables(reach = 1) {
    const list = [], rV = (8 * reach) ** 2, rA = (5 * reach) ** 2;
    for (const w of walkers) if (w.active && w.fade > 0.5 && w.ch.root.visible && w.pos.distanceToSquared(playerPos) < rV) list.push({ kind: 'villager', id: w.def.id, pos: w.pos, label: w.def.name, data: w });
    for (const a of animals) if (a.sp.pet && a.pos && a.pos.distanceToSquared(playerPos) < rA) list.push({ kind: 'cat', id: 'cat' + a.i, pos: a.pos, label: `Kucing ${a.name}`, data: a });
    for (const a of actList) if (a.pos.distanceToSquared(playerPos) < rA) list.push({ kind: 'act', id: a.id, pos: a.pos, label: a.label, verb: a.verb, data: a });
    return list;
  }
  function interact(it) {
    if (it.kind === 'cat') {
      const a = it.data;
      a.pet = 3.5; a.state = 'pet'; S.pets++;
      sfx(Math.random() < 0.5 ? 'meow' : 'heart');
      spawnEmoji(pick(['💗', '😻', '🐾']), a.pos, a.dir);
      if (S.pets % 3 === 0) { follower.cat = a; opts.toast(`🐱 ${a.name} mau ikut kamu!`); }
      else if (follower.cat === a) { follower.cat = null; opts.toast(`${a.name} duduk manis.`); }
      else opts.toast(`${a.name}: “meong”`);
      return true;
    }
    if (it.kind === 'act') { it.data.run(it); return true; }
    if (it.kind === 'villager') { const w = it.data; opts.talk(w); return true; }
    return false;
  }
  function updateActs(dt) {
    buff.t = Math.max(0, buff.t - dt); buff.cd = Math.max(0, buff.cd - dt);
    if (buff.t <= 0) buff.speed = 1;
    if (fishing.on) {
      if (playerPos.distanceTo(fishing.spot) > 3.5) { fishing.on = false; opts.toast('Kamu berhenti memancing.'); }
      else { fishing.t -= dt; if (fishing.t <= 0) { fishing.on = false; const [e, n] = pick(FISH); S.fish++; sfx('splash'); spawnEmoji(e, playerPos, playerUp); ripple(fishing.spot.clone().normalize(), 1.1); opts.toast(`🎣 Dapat ${n}! Total ${S.fish}`); opts.save?.(); } }
    }
  }

  // ---------------------------------------------------------------- tick utama
  function update(dt, t, ctx) {
    playerPos = ctx.pos; playerUp = ctx.up; playerSpeed = ctx.speed; hourNow = ctx.hour; dialogSpeaker = ctx.speaker || '';
    updateWeather(dt, t, ctx.night, ctx.sunDir, ctx.started);
    updateWalkers(dt, t, ctx.headPos);
    updateResidents(dt, ctx.headPos);
    updateAnimals(dt, t);
    updateBirds(dt, t, ctx.night);
    updateKite(t, ctx.hour);
    updateVehicles(dt, ctx.night);
    updateFish(dt, t, ctx.night);
    updateLeaves(dt, t, null, T.rain < 0.2 && ctx.night < 0.7);
    updateRain(dt);
    updateActs(dt);
  }
  return {
    update, interactables, interact, scatterBirds,
    get rain() { return T.rain; }, get speedBuff() { return buff.speed; }, stats: S,
    setFish(n) { S.fish = n | 0; }, forceRain(v) { T.rainTarget = v; T.rainT = 60; },
    info: () => ({ walkers: walkers.filter((w) => w.active).length, walkersTotal: walkers.length, animals: animals.length, birds: birds.length, vehicles: vehicles.length, rain: T.rain, acts: actList.length, pets: S.pets, fish: S.fish, following: !!follower.cat }),
    walkers, animals, residents, actList, vehicles, fishing, buff,
  };
}
