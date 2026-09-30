import * as THREE from 'three';
import { R, WATER, buildWorld, heightAt, frameAt, surfacePoint, DISTRICT_DEF, prefab, softMat, LOOK } from './world.js';
import { Character, loadHero, loadWarga, wargaBaseFor } from './characters.js';
import { Music, trackTitle, TRACK_KEYS } from './music.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RESIDENTS, LETTERS, DISTRICTS, LANDMARKS, wrongDoorLine, SEED_LEGACY } from './story.js';
import { createLife } from './life.js';
import { createMaps } from './minimap.js';
import { initTouch } from './touch.js';
import { Net, sanitizeText } from './net.js';

const $ = (id) => document.getElementById(id);
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = THREE.MathUtils.clamp;
const cfg = window.KP_CONFIG || {};
const isTouch = matchMedia('(pointer: coarse)').matches;
const lowQ = isTouch || navigator.hardwareConcurrency <= 4;
const SAVE_KEY = 'kp.save.v1';

// ================================================================ renderer
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowQ, powerPreference: 'high-performance' });
if (!renderer.capabilities.isWebGL2) $('nogl').hidden = false;
renderer.info.autoReset = false;
renderer.setPixelRatio(Math.min(devicePixelRatio, lowQ ? 1.25 : 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#f4dfc4', 45, 150);
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 700);

const hemi = new THREE.HemisphereLight('#fff1dc', '#7a8f52', 0.95);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff1dc', 1.7);
sun.castShadow = true;
sun.shadow.mapSize.set(lowQ ? 1024 : 2048, lowQ ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 140 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.04;
sun.shadow.radius = 3;
scene.add(sun, sun.target);
const lantern = new THREE.PointLight('#ffb865', 0, 10, 1.6);
scene.add(lantern);
// bloom lembut (desktop default; HP bisa dinyalakan di Setelan)
let composer = null, bloomOn = !lowQ;
function setupComposer() {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.32, 0.55, 0.82);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  composer.bloom = bloom;
}

// ================================================================ langit & bintang (mengikuti kamera)
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color('#6fa8dc') }, horizon: { value: new THREE.Color('#ffe3c6') }, upv: { value: V3(0, 1, 0) }, sunDir: { value: V3(0, 1, 0) }, sunCol: { value: new THREE.Color('#fff1d6') } },
  vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }',
  fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 upv; uniform vec3 sunDir; uniform vec3 sunCol; varying vec3 vDir;
    void main(){ float h = dot(normalize(vDir), upv); vec3 c = mix(horizon, top, smoothstep(-0.05, 0.55, h));
      float s = max(dot(normalize(vDir), sunDir), 0.0); c += sunCol * (pow(s, 600.0) * 1.2 + pow(s, 12.0) * 0.18);
      gl_FragColor = vec4(c, 1.0); }`,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 24, 12), skyMat);
sky.frustumCulled = false;
sky.renderOrder = -10;
scene.add(sky);
const starGeo = new THREE.BufferGeometry();
{
  const a = [];
  for (let i = 0; i < 500; i++) { const v = V3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize().multiplyScalar(420); a.push(v.x, v.y, v.z); }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(a, 3));
}
const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#fff6e0', size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
stars.frustumCulled = false;
scene.add(stars);

// ================================================================ dunia
const t0 = performance.now();
const world = buildWorld(scene, { quality: lowQ ? 'low' : 'high' });
const buildMs = Math.round(performance.now() - t0);

// ================================================================ waktu (16 menit real = 1 hari; fase 4/5/3/4 menit)
const PHASES = [
  { name: 'Pagi', start: 5, hours: 5, real: 240 },
  { name: 'Siang', start: 10, hours: 5, real: 300 },
  { name: 'Sore', start: 15, hours: 3, real: 180 },
  { name: 'Malam', start: 18, hours: 11, real: 240 },
];
const time = {
  hour: 7, day: 1, speed: 1,
  phaseIndex(h = this.hour) { return h >= 5 && h < 10 ? 0 : h >= 10 && h < 15 ? 1 : h >= 15 && h < 18 ? 2 : 3; },
  advance(dt) {
    let rem = dt * this.speed;
    for (let guard = 0; rem > 1e-9 && guard < 16; guard++) {
      const p = PHASES[this.phaseIndex()];
      const rate = p.hours / p.real;
      const bounds = [5, 10, 15, 18];
      let next = bounds.find((b) => b > this.hour + 1e-9) ?? 29;
      const toB = next - this.hour, realToB = toB / rate;
      if (rem >= realToB) { this.hour = next; rem -= realToB; } else { this.hour += rem * rate; rem = 0; }
      if (this.hour >= 24) { this.hour -= 24; this.day++; }
    }
  },
  str() { const h = Math.floor(this.hour), m = Math.floor((this.hour - h) * 60); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; },
};
const LIGHT_KEYS = [
  // jam, warna matahari, intensitas, hemi langit, hemi tanah, hemi int, langit atas, horizon, kabut
  [0, '#8fa3d9', 0.3, '#56628e', '#2b3044', 0.72, '#141a3a', '#2e3566', '#1e2440'],
  [4.8, '#9aa6e0', 0.3, '#5a5f8e', '#30344a', 0.72, '#1f2552', '#4a3f78', '#2d2a48'],
  [5.8, '#ffb38a', 0.9, '#ffc9a8', '#6a6a4a', 0.75, '#5a6aa8', '#ffab8a', '#f0b9a0'],
  [8, '#ffe0b8', 1.55, '#fff1dc', '#7a8f52', 0.95, '#6fa8dc', '#ffe3c6', '#f4dfc4'],
  [12, '#fff4e4', 1.75, '#f4f6ff', '#7a8f52', 1.0, '#5fa8e8', '#d8ecf5', '#dcecf0'],
  [15.5, '#ffe2b4', 1.6, '#fff1dc', '#7a8f52', 0.95, '#6aa6de', '#ffe6c4', '#f4e2c8'],
  [17.4, '#ff9a55', 1.3, '#ffcfa6', '#6f7a4a', 0.85, '#7a7fc4', '#ff9a6a', '#f2b48c'],
  [18.4, '#ff7a3d', 0.7, '#c9a0b0', '#4a4a4a', 0.7, '#4a4a8a', '#ff8a5c', '#c98a80'],
  [19.6, '#9aa6e0', 0.32, '#5f6592', '#30344a', 0.72, '#1f2552', '#5a4a80', '#39345a'],
  [24, '#8fa3d9', 0.3, '#56628e', '#2b3044', 0.72, '#141a3a', '#2e3566', '#1e2440'],
].map((k) => k.map((v) => (typeof v === 'string' ? new THREE.Color(v) : v)));
function lightAt(h) {
  let i = 0;
  while (i < LIGHT_KEYS.length - 2 && h >= LIGHT_KEYS[i + 1][0]) i++;
  const a = LIGHT_KEYS[i], b = LIGHT_KEYS[i + 1];
  const t = clamp((h - a[0]) / (b[0] - a[0]), 0, 1);
  const L = (k) => (typeof a[k] === 'number' ? THREE.MathUtils.lerp(a[k], b[k], t) : a[k].clone().lerp(b[k], t));
  return { sunC: L(1), sunI: L(2), hSky: L(3), hGround: L(4), hI: L(5), top: L(6), hor: L(7), fog: L(8) };
}
const nightness = (h) => (h >= 18.3 || h < 5.2 ? 1 : h >= 17.6 ? (h - 17.6) / 0.7 : h < 6 ? 1 - (h - 5.2) / 0.8 : 0);

// ================================================================ karakter & sprite
const matVC = softMat({ vertexColors: true });
function textSprite(text, { bg = 'rgba(254,249,239,0.92)', fg = '#3b2a20', size = 30, scale = 0.011 } = {}) {
  const cv = document.createElement('canvas');
  const g = cv.getContext('2d');
  g.font = `700 ${size}px Karla, system-ui, sans-serif`;
  const w = Math.ceil(g.measureText(text).width) + 28;
  cv.width = w; cv.height = size + 20;
  g.font = `700 ${size}px Karla, system-ui, sans-serif`;
  g.fillStyle = bg; g.beginPath(); g.roundRect(0, 0, w, size + 20, 12); g.fill();
  g.fillStyle = fg; g.textBaseline = 'middle'; g.fillText(text, 14, (size + 20) / 2 + 1);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true }));
  s.scale.set(w * scale, (size + 20) * scale, 1);
  return s;
}
const emojiCache = {};
function emojiSprite(e) {
  if (!emojiCache[e]) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 96;
    const g = cv.getContext('2d'); g.font = '72px system-ui, "Apple Color Emoji", "Noto Color Emoji", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(e, 48, 54);
    emojiCache[e] = new THREE.CanvasTexture(cv);
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiCache[e], transparent: true, depthWrite: false }));
  s.scale.set(0.9, 0.9, 1);
  return s;
}
function radialTex(inner = 'rgba(40,28,20,0.55)', outer = 'rgba(40,28,20,0)') {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  gr.addColorStop(0, inner); gr.addColorStop(1, outer);
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}
// bayangan bulat lembut di kaki karakter (1 draw untuk semua)
const blobMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: radialTex(), transparent: true, depthWrite: false }), 96);
blobMesh.frustumCulled = false; blobMesh.renderOrder = 2;
scene.add(blobMesh);
let blobCount = 0;
const _bm = new THREE.Matrix4();
function blob(pos, up, size = 0.9) {
  if (blobCount >= 96) return;
  const f = frameAt(up);
  _bm.makeBasis(f.east, up, f.north).scale(V3(size, 1, size)).setPosition(pos.clone().addScaledVector(up, 0.03));
  blobMesh.setMatrixAt(blobCount++, _bm);
}

// ================================================================ NPC warga
const npcs = {};
for (const [id, r] of Object.entries(RESIDENTS)) {
  const sp = world.spots['door:' + r.house];
  if (!sp) { console.warn('spot hilang', r.house); continue; }
  const ch = new Character({ ...r.look, act: r.act }, { lod: lowQ ? 0.6 : 0.85 });
  scene.add(ch.root);
  const tag = textSprite(r.name, { size: 26, scale: 0.0085 });
  tag.visible = false;
  scene.add(tag);
  npcs[id] = { id, ...r, ch, tag, pos: sp.pos.clone(), up: sp.up.clone(), face: sp.face.clone(), look: sp.face.clone(), heading: sp.face.clone(), walkV: 0, near: false };
  ch.place(sp.pos, sp.up, sp.face);
}

// ================================================================ kehidupan kampung (warga ramai, hewan, cuaca, titik interaksi)
const life = createLife({
  lowQ, scene, world, npcs, textSprite, spawnEmoji: (e, p, u) => spawnEmoji(e, p, u), sfx: (k) => sfx(k), blob: (p, u, s) => blob(p, u, s),
  toast: (m) => toast(m), say: (sp, lines, done) => say(sp, lines, done), talk: (w) => talkVillager(w), save: () => save(),
});

// ================================================================ pemain
const player = {
  pos: world.spots['door:kantor_pos'].pos.clone().addScaledVector(world.spots['door:kantor_pos'].face, 1.5).add(V3()),
  vT: V3(), vUp: 0, fwd: world.spots['door:kantor_pos'].face.clone().negate(), grounded: false, coyote: 0, jumpBuf: 0,
  walkPhase: 0, squash: 0, onCollider: null, name: 'Kurir',
};
player.pos.normalize().multiplyScalar(R + heightAt(player.pos.clone().normalize()) + 0.2);
const LOOK_PLAYER = {
  shirt: '#b8cde6', outfit: 'kemeja', sleeve: 'gulung', skin: '#d29a6c', head: 'jambul', headColor: '#161210',
  pants: '#3d5577', shoes: '#7a4424', face: ['goatee', 'bintik', 'senyum'], beardColor: '#161210', brow: 'tebal', eyes: 'besar',
};
const playerCh = new Character(LOOK_PLAYER, { player: true, courier: true });
scene.add(playerCh.root);
// model kurir 3D (assets/kurir.glb). Sampai termuat (atau kalau gagal) kurir tetap prosedural.
let hero = null;
const heroWait = [];
let heroLite = null;              // versi ringan: kurir pensiun, ghost, dan pemain di HP
const heroFor = (ch, opts = {}) => { const h = opts.lite ? heroLite : hero; if (h) ch.useHero(h, opts); else heroWait.push([ch, opts]); return ch; };
heroFor(playerCh, { lite: lowQ });
Promise.all([lowQ ? null : loadHero('./assets/kurir.glb'), loadHero('./assets/kurir_hp.glb')]).then(([full, lite]) => {
  heroLite = lite; hero = full || lite;
  for (const [ch, opts] of heroWait.splice(0)) ch.useHero(opts.lite ? heroLite : hero, opts);
}).catch((e) => console.warn('model kurir tidak termuat, pakai karakter prosedural', e));

// warga 3D (paket Quaternius, CC0): tiap warga cerita & warga ramai memakai model dasar terdekat, diwarnai ulang
// sesuai cirinya + tutup kepala. Model dasar dimuat sekali; gagal → warga tetap prosedural.
{
  const people = [...Object.values(npcs).map((n) => [n.ch, { ...RESIDENTS[n.id].look, act: n.act }]), ...life.walkers.map((w) => [w.ch, w.def.look])];
  const need = [...new Set(people.map(([, look]) => wargaBaseFor(look)))];
  const bases = {};
  Promise.all(need.map((k) => loadWarga(`./assets/warga/${k}.glb`).then((b) => { bases[k] = b; }).catch((e) => console.warn('warga', k, e))))
    .then(() => { for (const [ch, look] of people) { const b = bases[wargaBaseFor(look)]; if (b) ch.useWarga(b, look); } });
}

// istri kurir: selalu ikut di belakang, menapaki jejak yang sama (atap, drum, dermaga ikut terlewati)
const LOOK_ISTRI = {
  shirt: '#7f97c2', outfit: 'rompi', accent: '#f2ecdc', skin: '#d6a47c', head: 'kerudung', headColor: '#8a7e74',
  pants: '#8aa6cc', shoes: '#7a4a2e', face: ['kacamata'], frame: '#b9b2aa', lash: true, s: 0.95, w: 0.92,
};
const wife = { ch: new Character(LOOK_ISTRI, { player: true }), pos: V3(), fwd: V3(0, 0, 1), crumbs: [], speed: 0, placed: false, grounded: true };
scene.add(wife.ch.root);
loadHero(lowQ ? './assets/istri_hp.glb' : './assets/istri.glb', 1.34).then((h) => wife.ch.useHero(h, { shadow: !lowQ })).catch(() => {});   // HP: versi ringan; gagal → tetap prosedural
const WIFE_GAP = 1.5;
function wifeSnap() {   // muncul di belakang kurir (awal main, teleport, atau tertinggal jauh)
  const d = player.pos.clone().addScaledVector(player.fwd, -WIFE_GAP).normalize();
  // menapak: di tanah, atau setinggi kurir kalau kurir sedang berdiri di atap/drum (bukan saat kurir melayang)
  wife.pos.copy(d).multiplyScalar(player.grounded ? Math.max(R + heightAt(d), player.pos.length()) : R + heightAt(d));
  wife.fwd.copy(player.fwd); wife.crumbs.length = 0; wife.speed = 0; wife.placed = true; wife.grounded = true;
}
function stepWife(dt) {
  if (!wife.placed) wifeSnap();
  const C = wife.crumbs, last = C[C.length - 1];
  if (!last || last.p.distanceTo(player.pos) > 0.15) C.push({ p: player.pos.clone(), g: player.grounded });
  let len = C.length ? wife.pos.distanceTo(C[0].p) : 0;
  for (let i = 1; i < C.length; i++) len += C[i - 1].p.distanceTo(C[i].p);
  if (len > 14 || C.length > 400) { wifeSnap(); return; }
  // kejar jejak: makin tertinggal makin cepat, berhenti saat jaraknya pas
  const want = THREE.MathUtils.clamp((len - WIFE_GAP) * 3.2, 0, K.RUN * 1.15);
  wife.speed += (want - wife.speed) * (1 - Math.exp(-(want > wife.speed ? 6 : 10) * dt));
  let step = wife.speed * dt;
  const prev = wife.pos.clone();
  while (step > 0 && C.length) {
    const d = wife.pos.distanceTo(C[0].p);
    if (d <= step) { wife.pos.copy(C[0].p); wife.grounded = C[0].g; step -= d; C.shift(); }
    else { wife.pos.lerp(C[0].p, step / d); step = 0; }
  }
  const up = wife.pos.clone().normalize();
  const mv = wife.pos.clone().sub(prev); mv.addScaledVector(up, -mv.dot(up));
  const face = mv.lengthSq() > 1e-6 && wife.speed > 0.3 ? mv.normalize() : player.pos.clone().sub(wife.pos).addScaledVector(up, -player.pos.clone().sub(wife.pos).dot(up)).normalize();
  if (face.lengthSq() > 0.5) wife.fwd.lerp(face, 1 - Math.exp(-8 * dt)).addScaledVector(up, -wife.fwd.dot(up)).normalize();
  // status menapak = jejak terakhir yang benar-benar dilewati (jejak di depan bisa basi, mis. kurir jatuh saat spawn)
  if (wife.speed < 0.05) wife.grounded = true;
  const grounded = wife.grounded;
  wife.ch.place(wife.pos, up, wife.fwd);
  wife.ch.update(dt, { speed: wife.speed, grounded, look: wife.speed < 0.5 ? player.pos.clone().addScaledVector(player.pos.clone().normalize(), 1.1) : null });
  blob(wife.pos.clone().addScaledVector(up, -Math.max(0, wife.pos.length() - (R + heightAt(up)))), up, grounded ? 0.85 : 0.6);
}
const K = { WALK: 4.3, RUN: 6.8, ACC_G: 14, ACC_A: 4.5, G: 22, JUMP: 8.4, RAD: 0.35, H: 1.3, STEP: 0.5, SNAP: 0.28 };

const cam = { f: world.spots['door:kantor_pos'].face.clone().negate(), pitch: 0.42, dist: 7.6, pos: V3(), lastDrag: -10, sunRef: null }; // menghadap Kantor Pos
cam.pos.copy(player.pos).addScaledVector(player.pos.clone().normalize(), 5).addScaledVector(cam.f, -6);
cam.sunRef = frameAt(player.pos.clone().normalize()).east;

// ================================================================ input
const keys = new Set();
const pressed = new Set();
const joy = { x: 0, y: 0, mag: 0, active: false, run: false };
const auto = { it: null, t: 0 };            // jalan otomatis ke benda yang diketuk
addEventListener('keydown', (e) => {
  if (e.target.closest && e.target.closest('input,textarea')) return;
  const k = e.key.toLowerCase();
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
  if (!keys.has(k)) pressed.add(k);
  keys.add(k);
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());
let drag = null;
canvas.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') return; drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, id: e.pointerId, wasDialog: ui.dialogOpen }; canvas.setPointerCapture(e.pointerId); if (ui.dialogOpen) advanceDialog(); });
canvas.addEventListener('pointermove', (e) => {
  if (!drag || drag.id !== e.pointerId) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  drag.x = e.clientX; drag.y = e.clientY;
  rotateCam(-dx * 0.006, dy * 0.004);
});
canvas.addEventListener('pointerup', (e) => { if (drag && !drag.wasDialog && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 5 && !ui.dialogOpen) tapWorld(e.clientX, e.clientY); drag = null; });
canvas.addEventListener('wheel', (e) => { cam.dist = clamp(cam.dist + e.deltaY * 0.004, 3, 12); }, { passive: true });
function rotateCam(yaw, pitch) {
  const up = player.pos.clone().normalize();
  cam.f.applyAxisAngle(up, yaw);
  cam.pitch = clamp(cam.pitch + pitch, 0.12, 1.1);
  cam.lastDrag = clock.elapsedTime;
}
// sentuh: joystick melayang + kamera + tombol (lihat touch.js)
const touch = initTouch({
  keys, pressed, joy,
  rotateCam: (yaw, pitch) => rotateCam(yaw, pitch),
  zoom: (d) => { cam.dist = clamp(cam.dist + d, 3, 12); },
  onTap: (x, y) => tapWorld(x, y),
  onManual: () => { auto.it = null; },
});
// ketuk benda/warga di layar: interaksi kalau dekat, kalau jauh kurir berjalan otomatis ke sana
const _sp = V3();
function tapWorld(x, y) {
  if (!started) return;
  if (ui.dialogOpen) return advanceDialog();          // ketuk di mana saja melanjutkan percakapan
  let best = null, bd = 64;
  for (const it of interactables(4)) {
    _sp.copy(it.pos).addScaledVector(it.pos.clone().normalize(), it.kind === 'npc' || it.kind === 'villager' ? 1.0 : 0.5).project(camera);
    if (_sp.z > 1) continue;
    const sx = (_sp.x * 0.5 + 0.5) * innerWidth, sy = (-_sp.y * 0.5 + 0.5) * innerHeight;
    const d = Math.hypot(sx - x, sy - y) - (it.kind === 'npc' ? 24 : 0);   // warga cerita diutamakan
    if (d < bd) { bd = d; best = it; }
  }
  if (!best) return;
  if (best.pos.distanceTo(player.pos) < 3.2) { auto.it = null; interact(best); }
  else { auto.it = best; auto.t = 12; toast(`Menuju ${best.label}…`); }
}

// ================================================================ musik & suara (mulai setelah klik Mulai)
let actx = null, music = null, muted = false;
const vol = { music: 0.8, sfx: 0.9 };
function sfx(kind) { if (music && !muted) music.sfx(kind); }
function startAudio() {
  if (actx) return;
  try {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    music = new Music(actx);
    music.setVolumes(vol);
    music.start();
    music.setPhase(time.phaseIndex());
    lastPhase = time.phaseIndex();
  } catch (e) { console.warn('Audio tidak tersedia', e); }
}
let lastPhase = -1;

// ================================================================ quest
const quest = { idx: 0, stage: 0, has: false, card: null, stickers: [], wind: null, done: false };
function currentLetter() { return LETTERS[quest.idx]; }
function baseCard(L) { return { to: L.to, address: L.address, hint: L.hint, district: L.district, title: L.title, from: L.from }; }
function targetOfStage() {
  const L = currentLetter();
  if (!quest.has || !L) return null;
  const st = L.stages[quest.stage];
  return st ? st.at : null;
}
function targetPos(at) {
  if (!at) return null;
  const [kind, id] = at.split(':');
  if (kind === 'npc') return npcs[id]?.pos;
  if (kind === 'item') return itemPos(id);
  if (kind === 'poi') return world.spots['poi:' + id]?.pos;
  return null;
}
const windLetter = new THREE.Group();
{
  const env = new THREE.Mesh(prefab([{ t: 'box', s: [0.5, 0.34, 0.04], p: [0, 0, 0], c: '#fef9ef', sharp: true }, { t: 'box', s: [0.18, 0.12, 0.05], p: [0.12, 0.07, 0.01], c: '#d9483b' }]), matVC);
  env.castShadow = true;
  windLetter.add(env);
  windLetter.visible = false;
  scene.add(windLetter);
}
function itemPos(id) { return id === 'surat_angin' ? world.spots['item:surat_angin'].pos : null; }

function giveLetter() {
  const L = currentLetter();
  quest.has = true; quest.stage = 0; quest.card = baseCard(L);
  sfx('pick');
  const lines = [`Surat ke-${quest.idx + 1}: "${L.title}".`, `Untuk ${L.to}. ${L.address}.`];
  if (quest.idx === 0) lines.push('Jalan pakai WASD, lompat Spasi, bicara/antar pakai E. Tidak ada batas waktu. Nyasar juga boleh.');
  say('Pak Harjo', lines, () => {
    if (L.wind) {
      setTimeout(() => startWind(L), 1500);
    }
    save();
  });
}
function startWind(L) {
  quest.wind = { t: 0, from: player.pos.clone().addScaledVector(player.pos.clone().normalize(), 1.2), to: world.spots['item:surat_angin'].pos.clone() };
  windLetter.visible = true;
  sfx('wind');
  say('', L.wind.say);
}
function completeStage(st, speaker) {
  const L = currentLetter();
  say(speaker, st.say, () => {
    if (st.redirect) {
      quest.card = { ...quest.card, ...st.redirect };
      quest.stage++;
      toast(st.redirect.to ? `Alamat baru: ${st.redirect.to}` : 'Tujuan diperbarui');
      if (st.at === 'item:surat_angin') { windLetter.visible = false; sfx('pick'); }
      save();
      return;
    }
    quest.stage++;
    if (quest.stage >= L.stages.length) {
      quest.has = false;
      quest.stickers.push({ ...L.sticker, id: L.id });
      sfx('deliver');
      playerCh.startCelebrate();
      if (st.at.startsWith('npc:')) npcs[st.at.slice(4)]?.ch.startCelebrate();
      confetti(player.pos, player.pos.clone().normalize());
      rumble(0.6, 250);
      toast(`${L.sticker.icon} Stiker baru: ${L.sticker.name}`);
      quest.idx++;
      quest.card = null;
      save();
      if (st.final) setTimeout(openEnding, 600);
    }
  });
}

// ================================================================ interaksi
function interactables(reach = 1) {
  const list = [];
  for (const n of Object.values(npcs)) list.push({ kind: 'npc', id: n.id, pos: n.pos, label: n.name });
  for (const k of ['tugu_top', 'kotak_rindu', 'oyen', 'warung_senja']) if (world.spots['poi:' + k]) list.push({ kind: 'poi', id: k, pos: world.spots['poi:' + k].pos, label: { tugu_top: 'Kotak Pos Tugu', kotak_rindu: 'Kotak Surat Rindu', oyen: 'Si Oyen', warung_senja: 'Warung Senja' }[k] });
  if (windLetter.visible && !quest.wind) list.push({ kind: 'item', id: 'surat_angin', pos: world.spots['item:surat_angin'].pos, label: 'Surat yang terbang' });
  for (const g of legacy) list.push({ kind: 'legacy', id: g.name, pos: g.pos, label: g.name, data: g });
  for (const it of life.interactables(reach)) list.push(it);
  return list;
}
let focus = null;
function findFocus() {
  let best = null, bd = 2.4;
  const tgt = targetOfStage();
  for (const it of interactables()) {
    const raw = it.pos.distanceTo(player.pos);
    if (raw > 2.4) continue;
    // tujuan surat & warga cerita diutamakan daripada warga ramai / kucing yang kebetulan lewat
    const d = raw - (`${it.kind}:${it.id}` === tgt ? 3 : it.kind === 'npc' ? 0.9 : 0);
    if (d < bd) { bd = d; best = it; }
  }
  return best;
}
function interact(it) {
  const at = `${it.kind}:${it.id}`;
  const tgt = targetOfStage();
  const L = currentLetter();
  if (it.kind === 'legacy') { say(it.data.name + (it.data.example ? ' (contoh)' : ''), [it.data.message || '...', `Kurir pensiun. Mengantar ${it.data.letters} surat.`]); return; }
  if (tgt && at === tgt) {
    const st = L.stages[quest.stage];
    completeStage(st, it.kind === 'npc' ? npcs[it.id].name : '');
    return;
  }
  if (it.kind === 'npc' && it.id === 'harjo') {
    if (!quest.has && L) return giveLetter();
    if (!L) return say('Pak Harjo', ['Bagian 1 selesai. Sisanya... nanti. Jalan-jalan dulu saja.']);
    return say('Pak Harjo', [`Surat "${L.title}" masih di tasmu.`, quest.card.hint]);
  }
  if (it.kind === 'npc') {
    const n = npcs[it.id];
    if (quest.has && quest.card) return say(n.name, wrongDoorLine(n, { ...quest.card, id: L.id }));
    return say(n.name, nightness(time.hour) > 0.6 && n.night ? [...n.night] : [...n.idle].sort(() => Math.random() - 0.5).slice(0, 2));
  }
  if (it.kind === 'villager') return talkVillager(it.data);
  if (it.kind === 'cat' || it.kind === 'act') { life.interact(it); return; }
  if (it.kind === 'poi') {
    const flavor = {
      tugu_top: ['Kotak pos kecil di alas Tugu. Kosong, untuk sekarang.'],
      kotak_rindu: ['Kotak Surat Rindu. Tempat surat-surat yang tidak punya alamat lagi.'],
      oyen: ['Si Oyen tidur di bubungan seng yang hangat. Ekornya bergerak sedikit.'],
      warung_senja: ['Warung Senja. Tutup. Ada bangku kayu yang masih menghadap barat.'],
    };
    return say('', flavor[it.id]);
  }
}

// warga ramai: obrolan acak + petunjuk arah kalau kurir sedang membawa surat
function talkVillager(w) {
  const d = w.def;
  const night = nightness(time.hour) > 0.6;
  const lines = [night ? d.night[Math.floor(Math.random() * d.night.length)] : d.lines[Math.floor(Math.random() * d.lines.length)]];
  if (quest.has && quest.card && Math.random() < 0.6) lines.push(`Cari ${quest.card.to}? Coba ke ${DISTRICTS[quest.card.district].short}.`);
  w.ch.startWave();
  say(`${d.name} · ${d.role}`, lines);
}

// ================================================================ UI
const ui = { dialogOpen: false, queue: [], speaker: '', done: null, typing: 0, full: '' };
function say(speaker, lines, done) {
  ui.queue = [...lines]; ui.speaker = speaker; ui.done = done || null; ui.dialogOpen = true;
  $('dialog').hidden = false;
  nextLine();
}
function nextLine() {
  const line = ui.queue.shift();
  $('dlgName').textContent = ui.speaker || '';
  $('dlgName').hidden = !ui.speaker;
  ui.full = line; ui.typing = 0;
  $('dlgText').textContent = '';
}
function advanceDialog() {
  if (!ui.dialogOpen) return;
  if (ui.typing < ui.full.length) { ui.typing = ui.full.length; $('dlgText').textContent = ui.full; return; }
  if (ui.queue.length) return nextLine();
  ui.dialogOpen = false;
  $('dialog').hidden = true;
  const cb = ui.done; ui.done = null;
  if (cb) cb();
}
$('dialog').addEventListener('pointerdown', advanceDialog);
let toastT = 0;
function toast(msg) { $('toast').textContent = msg; $('toast').hidden = false; toastT = 3.2; }

function renderCard() {
  const c = quest.card;
  $('card').hidden = !c;
  if (!c) {
    $('cardEmpty').hidden = !!quest.done;
    $('cardEmpty').textContent = quest.idx < LETTERS.length ? 'Tas kosong. Ambil surat di Pak Harjo, Kantor Pos.' : 'Bagian 1 selesai. Kampung ini milikmu untuk dijelajahi.';
    return;
  }
  $('cardEmpty').hidden = true;
  $('cardTitle').textContent = `Surat ${quest.idx + 1}/${LETTERS.length} · ${c.title}`;
  $('cardTo').textContent = c.to;
  $('cardAddr').textContent = c.address;
  $('cardHint').textContent = c.hint;
}
function openPanel(id) { for (const p of ['map', 'book', 'settings']) $(p).hidden = p !== id || !$(p).hidden; if (id === 'map' && !$('map').hidden) { mapOpen(); sfx('ui'); } if (id === 'book' && !$('book').hidden) renderBook(); }
$('btnMap').onclick = () => openPanel('map');
$('btnBook').onclick = () => openPanel('book');
$('btnSet').onclick = () => openPanel('settings');
document.querySelectorAll('[data-close]').forEach((b) => (b.onclick = () => (b.closest('.panel').hidden = true)));
function renderBook() {
  const grid = $('stickers');
  grid.innerHTML = '';
  for (const L of LETTERS) {
    const got = quest.stickers.find((s) => s.id === L.id);
    const d = document.createElement('div');
    d.className = 'sticker' + (got ? ' got' : '');
    const i = document.createElement('span'); i.className = 'ico'; i.textContent = got ? L.sticker.icon : '?';
    const n = document.createElement('span'); n.textContent = got ? L.sticker.name : 'Belum';
    d.append(i, n);
    grid.append(d);
  }
  $('bookCount').textContent = `${quest.stickers.length} dari ${LETTERS.length} stiker`;
}
let showMarker = true;
$('optMarker').onchange = (e) => { showMarker = e.target.checked; };
$('optMute').onchange = (e) => { muted = e.target.checked; music?.setVolumes({ music: muted ? 0 : vol.music, sfx: muted ? 0 : vol.sfx }); };
$('volMusic').oninput = (e) => { vol.music = +e.target.value; if (!muted) music?.setVolumes({ music: vol.music }); };
$('volSfx').oninput = (e) => { vol.sfx = +e.target.value; if (!muted) music?.setVolumes({ sfx: vol.sfx }); };
$('optBloom').checked = bloomOn;
$('optBloom').onchange = (e) => { bloomOn = e.target.checked; };
$('optShadow').onchange = (e) => { renderer.shadowMap.enabled = e.target.checked; scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; }); };
$('btnReset').onclick = () => { $('resetConfirm').hidden = false; };
$('resetNo').onclick = () => { $('resetConfirm').hidden = true; };
$('resetYes').onclick = () => { try { localStorage.removeItem(SAVE_KEY); } catch {} location.reload(); };

// ================================================================ peta: minimap bulat + peta bola besar (seret / zoom / ditemukan)
const maps = createMaps(world);
const discovered = new Set();
const miniCv = $('miniCanvas'), bigCv = $('mapCanvas');
miniCv.width = miniCv.height = lowQ ? 144 : 184;
const miniView = { c: V3(0, 1, 0), u: V3(1, 0, 0), k: 100 };
const mapV = { c: V3(0, 1, 0), u: V3(1, 0, 0), k: 270 };
const mapUI = { follow: false, hover: null, acc: 0 };
const landmarkDone = () => LANDMARKS.filter((L) => discovered.has(L.id)).length;
function npcDots() {
  const out = [];
  for (const n of Object.values(npcs)) out.push({ dir: n.pos.clone().normalize(), color: RESIDENTS[n.id].look.shirt, big: true });
  for (const w of life.walkers) if (w.active && w.fade > 0.5) out.push({ dir: w.dir, color: w.def.look.shirt, big: false });
  return out;
}
function mapState(mini) {
  const tp = targetPos(targetOfStage());
  const cardD = quest.card ? DISTRICT_DEF[quest.card.district] : null;
  const targetDir = quest.has ? (showMarker && tp ? tp.clone().normalize() : cardD?.dir || null) : (currentLetter() ? npcs.harjo.pos.clone().normalize() : null);
  return { mini, t: clock.elapsedTime, player: { dir: player.pos.clone().normalize(), fwd: player.fwd }, targetDir, targetDistrict: quest.card?.district, discovered, hover: mapUI.hover, npcs: npcDots() };
}
const northOf = (dir) => { const n = V3(0, 1, 0).addScaledVector(dir, -dir.y); return n.lengthSq() < 1e-3 ? V3(1, 0, 0).addScaledVector(dir, -dir.x).normalize() : n.normalize(); };
let miniLast = null;
function drawMini() {
  const dir = player.pos.clone().normalize(), u = cam.f.clone().addScaledVector(dir, -cam.f.dot(dir)).normalize();
  if (!miniLast || miniLast.c.angleTo(dir) * R > 0.45 || miniLast.u.angleTo(u) > 0.03) { miniLast = { c: dir, u }; }
  miniView.c.copy(miniLast.c); miniView.u.copy(miniLast.u); miniView.k = (miniCv.width / 2) / Math.sin(34 / R);
  maps.draw(miniCv, miniView, mapState(true));
}
function drawBig() {
  if (mapUI.follow) maps.centerOn(mapV, player.pos.clone().normalize(), cam.f);
  maps.draw(bigCv, mapV, mapState(false));
}
function renderLegend() {
  const ul = $('mapLegend'); ul.innerHTML = '';
  for (const L of LANDMARKS) { const li = document.createElement('li'); const f = discovered.has(L.id); li.className = f ? '' : 'lock'; li.textContent = f ? `${L.icon} ${L.label}` : '❔ ???'; ul.append(li); }
  $('mapCaption').textContent = `Ditemukan ${landmarkDone()} dari ${LANDMARKS.length} tempat`;
}
function mapOpen() {
  mapV.k = bigCv.width * 0.5 * 0.96;
  const dir = player.pos.clone().normalize();
  maps.centerOn(mapV, dir, mapUI.follow ? cam.f : northOf(dir));
  renderLegend(); drawBig();
}
const clampK = () => { mapV.k = clamp(mapV.k, bigCv.width * 0.3, bigCv.width * 2.4); };
$('mapMe').onclick = () => { const d = player.pos.clone().normalize(); maps.centerOn(mapV, d, mapUI.follow ? cam.f : northOf(d)); drawBig(); };
$('mapHome').onclick = () => { maps.centerOn(mapV, V3(0, 1, 0), V3(1, 0, 0)); drawBig(); };
$('mapTarget').onclick = () => { const st = mapState(false); if (!st.targetDir) return toast('Belum ada tujuan. Ambil surat dulu.'); maps.centerOn(mapV, st.targetDir, northOf(st.targetDir)); mapV.k = Math.max(mapV.k, bigCv.width * 0.9); drawBig(); };
$('mapFollow').onclick = (e) => { mapUI.follow = !mapUI.follow; e.currentTarget.setAttribute('aria-pressed', mapUI.follow); e.currentTarget.classList.toggle('on', mapUI.follow); drawBig(); };
$('mapZoomIn').onclick = () => { mapV.k *= 1.35; clampK(); drawBig(); };
$('mapZoomOut').onclick = () => { mapV.k /= 1.35; clampK(); drawBig(); };
{
  const ptrs = new Map(); let pinch = 0, moved = 0;
  const toCv = (e) => { const r = bigCv.getBoundingClientRect(); return [(e.clientX - r.left) * (bigCv.width / r.width), (e.clientY - r.top) * (bigCv.height / r.height)]; };
  bigCv.addEventListener('pointerdown', (e) => { bigCv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = 0; if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); } });
  bigCv.addEventListener('pointermove', (e) => {
    const p = ptrs.get(e.pointerId);
    if (!p) { const [x, y] = toCv(e); const L = maps.hitLandmark(bigCv, mapV, x, y); const id = L && discovered.has(L.id) ? L.id : null; if (id !== mapUI.hover) { mapUI.hover = id; drawBig(); } return; }
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
    if (ptrs.size >= 2) { const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch) { mapV.k *= d / pinch; clampK(); } pinch = d; }
    else { const r = bigCv.getBoundingClientRect(); const f = bigCv.width / r.width; maps.rotateView(mapV, dx * f, dy * f); mapUI.follow = false; $('mapFollow').classList.remove('on'); $('mapFollow').setAttribute('aria-pressed', 'false'); }
    drawBig();
  });
  const up = (e) => {
    const had = ptrs.delete(e.pointerId); pinch = 0;
    if (had && moved < 8 && e.type === 'pointerup') {
      const [x, y] = toCv(e), L = maps.hitLandmark(bigCv, mapV, x, y);
      if (L) { const found = discovered.has(L.id); $('mapCaption').textContent = found ? `${L.icon} ${L.label}` : '❔ Tempat ini belum kamu temukan. Jalan ke sana dulu.'; if (found) { mapUI.hover = L.id; maps.centerOn(mapV, world.spots[L.spot].pos.clone().normalize(), mapV.u); } drawBig(); }
    }
  };
  bigCv.addEventListener('pointerup', up); bigCv.addEventListener('pointercancel', up);
  bigCv.addEventListener('wheel', (e) => { e.preventDefault(); mapV.k *= e.deltaY < 0 ? 1.12 : 1 / 1.12; clampK(); drawBig(); }, { passive: false });
}
$('mini').onclick = () => openPanel('map');
// tempat baru ditemukan saat kurir mendekat
let discTimer = 0;
function checkDiscover(dt) {
  discTimer -= dt; if (discTimer > 0 || !started) return; discTimer = 0.5;
  for (const L of LANDMARKS) {
    if (discovered.has(L.id)) continue;
    const sp = world.spots[L.spot]; if (!sp || sp.pos.distanceToSquared(player.pos) > L.radius * L.radius) continue;
    discovered.add(L.id); sfx('coin'); toast(`📍 Tempat baru: ${L.icon} ${L.label}  (${discovered.size}/${LANDMARKS.length})`); save();
    if (!$('map').hidden) renderLegend();
  }
}

// emoji
const EMOJI = ['👋', '😊', '☕', '📮', '🐱'];
const floaters = [];
function spawnEmoji(e, pos, up) {
  const s = emojiSprite(e);
  s.position.copy(pos).addScaledVector(up, 2.2);
  scene.add(s);
  floaters.push({ s, up: up.clone(), t: 0 });
}
function sendEmoji(i) {
  const e = EMOJI[i];
  spawnEmoji(e, player.pos, player.pos.clone().normalize());
  net.send('emoji', { e, p: player.pos.toArray() });
}
document.querySelectorAll('[data-emoji]').forEach((b) => (b.onclick = () => { sendEmoji(+b.dataset.emoji); document.body.classList.remove('emoji-open'); }));
$('btnEmoji').onclick = () => document.body.classList.toggle('emoji-open');

// ================================================================ ghost + warisan
const net = new Net(cfg);
const ghosts = new Map();
net.on('pos', (d) => {
  if (!Array.isArray(d.p) || !Array.isArray(d.f)) return;
  let g = ghosts.get(d.id);
  if (!g) {
    const ch = heroFor(new Character({ ...LOOK_PLAYER, shirt: /^#[0-9a-f]{6}$/i.test(d.s) ? d.s : '#48dbfb' }, { player: true, courier: true, ghost: true }), { ghost: true, lite: true });
    const tag = textSprite(sanitizeText(d.n, 20) || 'Kurir', { size: 24, bg: 'rgba(59,42,32,0.55)', fg: '#fef9ef' });
    scene.add(ch.root, tag);
    g = { ch, mesh: ch.root, tag, pos: V3().fromArray(d.p), tpos: V3(), f: V3(0, 0, 1), tf: V3(0, 0, 1), seen: 0, prev: V3().fromArray(d.p) };
    ghosts.set(d.id, g);
    toast(`${sanitizeText(d.n, 20) || 'Kurir lain'} ikut mengantar surat`);
  }
  g.tpos.fromArray(d.p); g.tf.fromArray(d.f); g.seen = clock.elapsedTime;
});
net.on('emoji', (d) => {
  if (!EMOJI.includes(d.e) || !Array.isArray(d.p)) return;
  const p = V3().fromArray(d.p);
  spawnEmoji(d.e, p, p.clone().normalize());
});
const legacy = [];
function spawnLegacy(o) {
  const dir = V3(...o.dir).normalize();
  const f = frameAt(dir);
  const pos = dir.clone().multiplyScalar(R + heightAt(dir));
  const ch = heroFor(new Character({ ...LOOK_PLAYER, shirt: o.shirt }, { player: true, courier: true }), { shadow: false, lite: true });
  ch.place(pos, dir, f.north);
  const mesh = ch.root;
  const tag = textSprite(o.name + (o.example ? ' · contoh' : ''), { size: 24 });
  tag.position.copy(pos).addScaledVector(dir, 1.9);
  tag.visible = false;
  scene.add(mesh, tag);
  legacy.push({ ...o, pos, mesh, tag, ch, up: dir });
}

// ================================================================ akhir bagian 1 → jadi NPC
function openEnding() {
  $('ending').hidden = false;
  $('endName').value = player.name;
  $('endJson').hidden = true;
  $('endStatus').textContent = '';
}
$('endForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = sanitizeText($('endName').value, 20) || player.name;
  const message = sanitizeText($('endMsg').value, 100) || 'Jalan pelan-pelan saja.';
  const dir = player.pos.clone().normalize();
  const npc = {
    v: 1, type: 'kurir_pensiun', name, message, shirt: LOOK_PLAYER.shirt,
    dir: dir.toArray().map((v) => +v.toFixed(4)), chapter: 1, letters: quest.stickers.length,
    stickers: quest.stickers.map((s) => s.icon), playtime_min: Math.round(stats.play / 60), created_at: new Date().toISOString(),
  };
  const res = await net.saveLegacy(npc);
  $('endJson').textContent = JSON.stringify(npc, null, 2);
  $('endJson').hidden = false;
  $('endCopy').hidden = false;
  $('endStatus').textContent = res.where === 'supabase' ? 'Tersimpan di Supabase. Kurir lain akan bertemu kamu di Tugu.' : 'Tersimpan di perangkat ini. Isi config.js (Supabase) supaya pemain lain bisa bertemu kamu.';
  spawnLegacy({ ...npc, dir: npc.dir });
  quest.done = true;
  save();
});
$('endCopy').onclick = async () => {
  try { await navigator.clipboard.writeText($('endJson').textContent); $('endCopy').textContent = 'Tersalin'; }
  catch { const r = document.createRange(); r.selectNodeContents($('endJson')); getSelection().removeAllRanges(); getSelection().addRange(r); $('endCopy').textContent = 'Teks dipilih, tekan Ctrl+C'; }
};
$('endClose').onclick = () => { $('ending').hidden = true; };

// ================================================================ simpan
function saveData() {
  return { idx: quest.idx, stage: quest.stage, has: quest.has, card: quest.card, stickers: quest.stickers, done: quest.done, name: player.name, hour: time.hour, day: time.day, pos: player.pos.toArray(), disc: [...discovered], fish: life.stats.fish };
}
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(saveData())); } catch {} }
function load(d) {
  if (!d) return false;
  Object.assign(quest, { idx: d.idx | 0, stage: d.stage | 0, has: !!d.has, card: d.card || null, stickers: d.stickers || [], done: !!d.done });
  if (quest.idx >= LETTERS.length) { quest.has = false; quest.card = null; }
  if (quest.has && currentLetter()?.stages[quest.stage]?.at === 'item:surat_angin') windLetter.visible = true;
  player.name = sanitizeText(d.name, 20) || 'Kurir';
  (d.disc || []).forEach((id) => discovered.add(id)); life.setFish(d.fish);
  time.hour = +d.hour || 7; time.day = d.day | 0 || 1;
  if (Array.isArray(d.pos) && d.pos.every(Number.isFinite)) player.pos.fromArray(d.pos);
  return true;
}
window.claude?.hot?.snapshot?.(saveData);

// ================================================================ fisika pemain
const stats = { play: 0 };
const _l = V3();
function topAt(c, lz) { return c.rise ? c.top + c.rise * (1 - clamp(Math.abs(lz) / c.hz, 0, 1)) : c.top; }
function stepPlayer(dt) {
  const up = player.pos.clone().normalize();
  // parallel transport vektor kamera & referensi matahari
  cam.f.addScaledVector(up, -cam.f.dot(up)).normalize();
  cam.sunRef.addScaledVector(up, -cam.sunRef.dot(up)).normalize();
  const right = V3().crossVectors(cam.f, up).normalize();
  let ix = 0, iz = 0;
  if (!ui.dialogOpen && $('ending').hidden) {
    ix = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0) + joy.x;
    iz = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - joy.y;
    ix += pad.axes[0]; iz -= pad.axes[1];
    if (auto.it) {
      const ap = (auto.it.data && auto.it.data.pos) || auto.it.pos;
      const gd = ap.clone().sub(player.pos); gd.addScaledVector(up, -gd.dot(up));
      const dist = gd.length();
      auto.t -= dt;
      if (joy.active || keys.size || Math.hypot(ix, iz) > 0.2) auto.it = null;
      else if (dist < 1.6 || auto.t <= 0) { const it = auto.it; auto.it = null; if (dist < 3.4) interact(it); }
      else { gd.normalize(); ix = gd.dot(right); iz = gd.dot(cam.f); }
    }
  }
  const il = Math.hypot(ix, iz); if (il > 1) { ix /= il; iz /= il; }
  const speed = (keys.has('shift') || pad.run || joy.run || joy.mag > 0.93 ? K.RUN : K.WALK) * life.speedBuff;
  const desired = cam.f.clone().multiplyScalar(iz).addScaledVector(right, ix).multiplyScalar(speed);
  player.vT.addScaledVector(up, -player.vT.dot(up));
  player.vT.lerp(desired, 1 - Math.exp(-(player.grounded ? K.ACC_G : K.ACC_A) * dt));

  player.jumpBuf -= dt; player.coyote -= dt;
  if (pressed.has(' ') && !ui.dialogOpen) player.jumpBuf = 0.14;
  // antisipasi: jongkok sebentar (0.07 dtk) sebelum melompat
  if (player.jumpBuf > 0 && (player.grounded || player.coyote > 0) && !player.prep) { player.prep = 0.07; player.jumpBuf = 0; }
  if (player.prep) {
    player.prep -= dt;
    if (player.prep <= 0) { player.prep = 0; player.vUp = K.JUMP; player.grounded = false; player.coyote = 0; sfx('jump'); }
  }
  if (!player.grounded) player.vUp -= K.G * dt;

  const prev = player.pos.clone();
  player.pos.addScaledVector(player.vT, dt).addScaledVector(up, player.vUp * dt);
  const nup = player.pos.clone().normalize();

  // dorong keluar dari dinding
  const near = [];
  for (const c of world.colliders) if (c.base.distanceToSquared(player.pos) < 196) near.push(c);
  for (let it = 0; it < 2; it++) {
    for (const c of near) {
      _l.copy(player.pos).sub(c.base);
      const lx = _l.dot(c.lx), ly = _l.dot(c.up), lz = _l.dot(c.lz);
      const hx = c.hx + K.RAD, hz = c.hz + K.RAD;
      if (Math.abs(lx) >= hx || Math.abs(lz) >= hz) continue;
      const top = topAt(c, lz);
      if (ly >= top - K.STEP || ly + K.H <= c.y0) continue;
      if (player.vUp > 0 && ly + K.H > c.y0 && ly < c.y0 && Math.abs(lx) < c.hx && Math.abs(lz) < c.hz) { player.vUp = 0; continue; }
      const px = hx - Math.abs(lx), pz = hz - Math.abs(lz);
      const n = px < pz ? c.lx.clone().multiplyScalar(Math.sign(lx) || 1) : c.lz.clone().multiplyScalar(Math.sign(lz) || 1);
      player.pos.addScaledVector(n, Math.min(px, pz));
      const vn = player.vT.dot(n); if (vn < 0) player.vT.addScaledVector(n, -vn);
    }
  }
  // pijakan: tanah planet atau atas collider (atap seng, emperan, drum, dermaga, tugu)
  const pup = player.pos.clone().normalize();
  let best = (R + heightAt(pup)) - player.pos.length(), bestC = null;
  for (const c of near) {
    _l.copy(player.pos).sub(c.base);
    const lx = _l.dot(c.lx), ly = _l.dot(c.up), lz = _l.dot(c.lz);
    if (Math.abs(lx) > c.hx + K.RAD * 0.5 || Math.abs(lz) > c.hz + K.RAD * 0.5) continue;
    const d = topAt(c, lz) - ly;
    if (d <= K.STEP + 0.02 && d > -3 && d > best) { best = d; bestC = c; }
  }
  const wasGrounded = player.grounded;
  if (player.vUp <= 0 && best >= -(wasGrounded ? K.SNAP : 0.02)) {
    player.pos.addScaledVector(pup, best);
    if (!wasGrounded && player.vUp < -4) { playerCh.land(Math.min(1.4, -player.vUp / 9)); if (player.vUp < -6) sfx('land'); }
    player.grounded = true; player.vUp = 0; player.coyote = 0.12; player.onCollider = bestC;
  } else {
    player.grounded = false; player.onCollider = null;
    if (best > 0) { player.pos.addScaledVector(pup, best); if (player.vUp < 0) player.vUp = 0; }
  }
  // air dalam: tidak bisa masuk kecuali di atas dermaga/perahu
  if (!player.onCollider && heightAt(player.pos.clone().normalize()) < WATER - 0.3) {
    const pu = prev.clone().normalize();
    player.pos.copy(prev);
    player.vT.multiplyScalar(0);
    if (!stats.waterWarned) { stats.waterWarned = true; toast('Airnya dalam. Lewat dermaga kayu saja.'); }
    player.pos.normalize().multiplyScalar(Math.max(prev.length(), R + heightAt(pu)));
  }
  // hadap
  const sp = player.vT.length();
  if (sp > 0.4) player.fwd.lerp(player.vT.clone().normalize(), 1 - Math.exp(-12 * dt));
  player.fwd.addScaledVector(nup, -player.fwd.dot(nup)).normalize();
  // kamera ikut pelan di belakang saat berjalan tanpa drag
  if (sp > 1 && clock.elapsedTime - cam.lastDrag > 2.5 && iz >= 0) {
    const a = Math.atan2(V3().crossVectors(cam.f, player.fwd).dot(nup), cam.f.dot(player.fwd));
    if (Math.abs(a) < 2.4) cam.f.applyAxisAngle(nup, a * (1 - Math.exp(-0.7 * dt)) * (sp / K.RUN));
  }
  player.walkPhase += sp * dt * 2.4;
  player.squash *= Math.exp(-10 * dt);
}

// ================================================================ joystick eksternal (Gamepad API, pemetaan standar)
// Stik kiri = jalan · stik kanan = kamera · A/Cross = lompat & lanjut dialog · X/Square atau B/Circle = bicara/antar
// Y/Triangle = peta · Back/Select = buku stiker · Start = setelan · RT/R2, RB/R1 atau L3 = lari · D-pad = emoji
const pad = { connected: false, id: '', prev: [], axes: [0, 0, 0, 0], run: false, lastUse: -99, gp: null };
addEventListener('gamepadconnected', (e) => { toast(`🎮 Joystick terhubung: ${e.gamepad.id.replace(/\(.*\)/, '').slice(0, 28).trim()}`); pad.lastUse = clock.elapsedTime; });
addEventListener('gamepaddisconnected', () => toast('🎮 Joystick terputus'));
const panelOpen = () => ['map', 'book', 'settings'].some((id) => !$(id).hidden);
function pollPad(dt) {
  const list = navigator.getGamepads ? navigator.getGamepads() : [];
  let gp = null;
  for (const g of list) if (g && g.connected) { gp = g; break; }
  pad.gp = gp;
  if (!gp) { pad.connected = false; pad.axes = [0, 0, 0, 0]; pad.run = false; return; }
  pad.connected = true; pad.id = gp.id;
  const dz = (v = 0) => (Math.abs(v) < 0.18 ? 0 : (v - Math.sign(v) * 0.18) / 0.82);
  pad.axes = [dz(gp.axes[0]), dz(gp.axes[1]), dz(gp.axes[2]), dz(gp.axes[3])];
  const on = (i) => !!gp.buttons[i]?.pressed;
  const edge = (i) => on(i) && !pad.prev[i];
  if (edge(0)) pressed.add(ui.dialogOpen ? 'e' : ' ');
  if (edge(2) || edge(1)) { if (panelOpen()) { for (const id of ['map', 'book', 'settings']) $(id).hidden = true; } else if (!$('ending').hidden) { $('ending').hidden = true; } else pressed.add('e'); }
  if (edge(3)) pressed.add('m');
  if (edge(8)) pressed.add('b');
  if (edge(9)) openPanel('settings');
  for (const [i, k] of [[12, '1'], [15, '2'], [13, '3'], [14, '4']]) if (edge(i)) pressed.add(k);
  pad.run = (gp.buttons[7]?.value || 0) > 0.4 || on(5) || on(10);
  if (pad.axes[2] || pad.axes[3]) rotateCam(-pad.axes[2] * 2.6 * dt, pad.axes[3] * 1.4 * dt);
  if ((gp.buttons[6]?.value || 0) > 0.4) cam.dist = clamp(cam.dist + dt * 4, 4.5, 12);
  if (on(4)) cam.dist = clamp(cam.dist - dt * 4, 4.5, 12);
  if (pad.axes.some((v) => v) || gp.buttons.some((b) => b.pressed)) pad.lastUse = clock.elapsedTime;
  pad.prev = gp.buttons.map((b) => b.pressed);
}
function rumble(strength = 0.5, ms = 200) {
  try { pad.gp?.vibrationActuator?.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: strength, weakMagnitude: strength * 0.6 })?.catch?.(() => {}); } catch {}
}
const usingPad = () => pad.connected && clock.elapsedTime - pad.lastUse < 15;

// ================================================================ konfeti & asap warung
const CONF_N = 90;
const confMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.13, 0.08), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), CONF_N);
confMesh.frustumCulled = false;
const confCols = ['#ff7a3d', '#feca57', '#48dbfb', '#1dd1a1', '#ff9a9e', '#fef9ef', '#d9483b'];
const confP = [];
for (let i = 0; i < CONF_N; i++) { confMesh.setColorAt(i, new THREE.Color(confCols[i % confCols.length])); confP.push({ p: V3(), v: V3(), r: V3(), rv: V3(), life: 0 }); confMesh.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0)); }
scene.add(confMesh);
function confetti(pos, up) {
  const f = frameAt(up);
  for (const c of confP) {
    const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 2.2;
    c.p.copy(pos).addScaledVector(up, 1.4);
    c.v.copy(up).multiplyScalar(4 + Math.random() * 3).addScaledVector(f.east, Math.cos(a) * sp).addScaledVector(f.north, Math.sin(a) * sp);
    c.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6); c.rv.set(Math.random() * 12 - 6, Math.random() * 12 - 6, Math.random() * 12 - 6);
    c.life = 1.6 + Math.random() * 0.8;
  }
}
const _cq = new THREE.Quaternion(), _ce = new THREE.Euler(), _cmx = new THREE.Matrix4();
function updateConfetti(dt) {
  let any = false;
  confP.forEach((c, i) => {
    if (c.life <= 0) return;
    any = true;
    c.life -= dt;
    const g = c.p.clone().normalize();
    c.v.addScaledVector(g, -7 * dt).multiplyScalar(1 - 1.6 * dt);
    c.p.addScaledVector(c.v, dt);
    c.r.addScaledVector(c.rv, dt);
    _cq.setFromEuler(_ce.set(c.r.x, c.r.y, c.r.z));
    const s = c.life > 0 ? Math.min(1, c.life * 2) : 0;
    confMesh.setMatrixAt(i, _cmx.compose(c.p, _cq, V3(s, s, s)));
  });
  if (any) confMesh.instanceMatrix.needsUpdate = true;
}
const smoke = [];
{
  const sp = world.spots['smoke:warung_sri'];
  const tex = radialTex('rgba(255,255,255,0.8)', 'rgba(255,255,255,0)');
  for (let i = 0; i < 8; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.5 }));
    scene.add(s);
    smoke.push({ s, t: i / 8, sp });
  }
}
function updateSmoke(dt, night) {
  for (const k of smoke) {
    k.t = (k.t + dt / 4) % 1;
    const u = k.sp.up;
    k.s.position.copy(k.sp.pos).addScaledVector(u, k.t * 3.2).addScaledVector(k.sp.face, Math.sin(k.t * 6 + k.t) * 0.3 + k.t * 0.6);
    const sc = 0.4 + k.t * 1.4;
    k.s.scale.set(sc, sc, 1);
    k.s.material.opacity = (1 - k.t) * 0.45 * (1 - night * 0.6);
  }
}

const CAM_BLOCK = new Set(['wall', 'roof', 'tugu', 'menara']);
// ray target→kamera vs kotak collider (slab test di ruang lokal). Kembalikan fraksi [0..1].
function rayHitColliders(a, b) {
  const d = b.clone().sub(a);
  let best = 1;
  for (const c of world.colliders) {
    if (!CAM_BLOCK.has(c.kind) || c.base.distanceToSquared(a) > 400) continue;
    const o = a.clone().sub(c.base);
    const ox = o.dot(c.lx), oy = o.dot(c.up), oz = o.dot(c.lz);
    const dx = d.dot(c.lx), dy = d.dot(c.up), dz = d.dot(c.lz);
    let t0 = 0, t1 = best;
    const slab = (orig, dir, lo, hi) => {
      if (Math.abs(dir) < 1e-6) return orig >= lo && orig <= hi;
      let ta = (lo - orig) / dir, tb = (hi - orig) / dir;
      if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
      return t0 <= t1;
    };
    if (slab(ox, dx, -c.hx, c.hx) && slab(oz, dz, -c.hz, c.hz) && slab(oy, dy, c.y0, c.top + (c.rise || 0)) && t0 > 0.02) best = Math.min(best, t0);
  }
  return best;
}

// ================================================================ loop
const clock = new THREE.Clock();
const isTouchUI = () => document.body.classList.contains('touch');
function actionVerb(f) {
  const tgtAt = targetOfStage();
  const isT = tgtAt === `${f.kind}:${f.id}`;
  if (f.verb) return f.verb;
  if (f.kind === 'cat') return 'Elus';
  if (f.kind === 'npc' && f.id === 'harjo' && !quest.has && currentLetter()) return 'Ambil surat';
  if (isT) return f.kind === 'item' ? 'Ambil' : currentLetter()?.stages[quest.stage + 1] ? 'Tunjukkan surat' : 'Antar surat';
  if (f.kind === 'poi' || f.kind === 'item') return 'Lihat';
  return f.kind === 'villager' ? 'Sapa' : 'Bicara';
}
let netTimer = 0, started = false, hudTimer = 0, rainTick = 0;
function lifeCtx() {
  const up = player.pos.clone().normalize();
  return { pos: player.pos, up, speed: player.vT.length(), hour: time.hour, night: nightness(time.hour), sunDir: skyMat.uniforms.sunDir.value, headPos: player.pos.clone().addScaledVector(up, 1.1), speaker: ui.dialogOpen ? ui.speaker.split(' · ')[0] : '', started };
}
const RAIN_COL = new THREE.Color('#8794a0');
function frame() {
  renderer.info.reset();
  const dt = Math.min(clock.getDelta(), 1 / 20);
  const t = clock.elapsedTime;
  if (started) { time.advance(dt); stats.play += dt; }
  pollPad(dt);
  stepPlayer(dt);

  // interaksi
  focus = ui.dialogOpen ? null : findFocus();
  if (pressed.has('e') || pressed.has('enter')) {
    if (ui.dialogOpen) advanceDialog();
    else if (focus && started) interact(focus);
  } else if (pressed.has(' ') && ui.dialogOpen) advanceDialog();
  if (pressed.has('m')) openPanel('map');
  if (pressed.has('b')) openPanel('book');
  if (pressed.has('h')) { showMarker = !showMarker; $('optMarker').checked = showMarker; toast(showMarker ? 'Penanda tujuan: tampil' : 'Penanda tujuan: sembunyi'); }
  if (pressed.has('escape')) { for (const p of ['map', 'book', 'settings']) $(p).hidden = true; }
  for (let i = 0; i < 5; i++) if (pressed.has(String(i + 1))) sendEmoji(i);
  if (pressed.has('t') && keys.has('shift')) time.hour = (time.hour + 1) % 24;
  pressed.clear();

  // typewriter
  if (ui.dialogOpen && ui.typing < ui.full.length) {
    const before = Math.floor(ui.typing);
    ui.typing = Math.min(ui.full.length, ui.typing + dt * 55);
    if (Math.floor(ui.typing) !== before) { $('dlgText').textContent = ui.full.slice(0, Math.floor(ui.typing)); if (before % 4 === 0) sfx('talk'); }
  }

  // surat angin terbang
  if (quest.wind) {
    quest.wind.t += dt / 1.8;
    const k = Math.min(1, quest.wind.t);
    const p = quest.wind.from.clone().lerp(quest.wind.to, k).addScaledVector(quest.wind.to.clone().normalize(), Math.sin(k * Math.PI) * 5);
    windLetter.position.copy(p);
    windLetter.rotation.set(t * 5, t * 3, t * 4);
    if (k >= 1) quest.wind = null;
  } else if (windLetter.visible) {
    const sp = world.spots['item:surat_angin'];
    windLetter.position.copy(sp.pos).addScaledVector(sp.up, 0.35 + Math.sin(t * 2.5) * 0.08);
    windLetter.rotation.set(0.2, t * 1.2, Math.sin(t * 2) * 0.2);
  }

  // pemain: pose & animasi
  const up = player.pos.clone().normalize();
  blobCount = 0;
  playerCh.place(player.pos, up, player.fwd);
  const lookTarget = focus && focus.pos.distanceTo(player.pos) < 4 ? focus.pos.clone().addScaledVector(up, 1.1) : null;
  playerCh.update(dt, { speed: player.vT.length(), grounded: player.grounded, vUp: player.vUp, prep: player.prep ? 1 - player.prep / 0.07 : 0, look: lookTarget });
  blob(player.pos.clone().addScaledVector(up, -Math.max(0, player.pos.length() - (R + heightAt(up)))), up, player.grounded ? 0.95 : 0.7);
  stepWife(dt);

  // NPC: hanya yang di sisi planet yang terlihat; menoleh, melambai, bicara, kedip
  const headPos = player.pos.clone().addScaledVector(up, 1.1);
  for (const n of Object.values(npcs)) {
    const vis = n.up.dot(up) > 0.45;
    n.ch.root.visible = vis;
    if (!vis) { n.tag.visible = false; continue; }
    const d = n.pos.distanceTo(player.pos);
    const want = d < 5 ? player.pos.clone().sub(n.pos) : n.walkV > 0.12 ? n.heading.clone() : n.face.clone();
    want.addScaledVector(n.up, -want.dot(n.up)).normalize();
    n.look.lerp(want, 1 - Math.exp(-3 * dt)).normalize();
    n.ch.place(n.pos, n.up, n.look);
    if (d < 5 && !n.near) { n.near = true; n.ch.startWave(); }
    if (d > 9) n.near = false;
    n.ch.setShadow(d < (lowQ ? 7 : 10));
    n.ch.update(dt, { speed: n.walkV, grounded: true, look: d < 6 ? headPos : null, talking: ui.dialogOpen && ui.speaker === n.name && ui.typing < ui.full.length });
    blob(n.pos, n.up, 0.9);
    n.tag.visible = d > 2.6 && d < 8;
    if (n.tag.visible) { const lk = RESIDENTS[n.id].look; n.tag.position.copy(n.pos).addScaledVector(n.up, (lk.kid ? 1.6 : 2.15) * (lk.s || 1)); }
  }
  for (const g of legacy) {
    const vis = g.up.dot(up) > 0.45;
    g.mesh.visible = vis;
    g.tag.visible = vis && g.pos.distanceTo(player.pos) < 7;
    if (vis) { g.ch.update(dt, { speed: 0, grounded: true, look: g.pos.distanceTo(player.pos) < 6 ? headPos : null }); blob(g.pos, g.up, 0.9); }
  }

  // ghost
  for (const [id, g] of ghosts) {
    if (t - g.seen > 6) { scene.remove(g.mesh, g.tag); ghosts.delete(id); continue; }
    g.pos.lerp(g.tpos, 1 - Math.exp(-10 * dt));
    g.f.lerp(g.tf, 1 - Math.exp(-10 * dt));
    const gu = g.pos.clone().normalize();
    const gf = g.f.clone().addScaledVector(gu, -g.f.dot(gu));
    if (gf.lengthSq() > 1e-6) g.ch.place(g.pos, gu, gf.normalize());
    const gsp = g.pos.distanceTo(g.prev) / Math.max(dt, 1e-3); g.prev.copy(g.pos);
    g.ch.update(dt, { speed: gsp, grounded: true });
    g.tag.position.copy(g.pos).addScaledVector(gu, 1.95);
  }
  netTimer -= dt;
  if (netTimer <= 0 && started) { netTimer = 0.12; net.send('pos', { p: player.pos.toArray().map((v) => +v.toFixed(2)), f: player.fwd.toArray().map((v) => +v.toFixed(2)), n: player.name, s: LOOK_PLAYER.shirt }); }

  // emoji melayang
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i];
    f.t += dt;
    f.s.position.addScaledVector(f.up, dt * 0.6);
    f.s.material.opacity = 1 - Math.max(0, f.t - 1.4) / 0.8;
    if (f.t > 2.2) { scene.remove(f.s); floaters.splice(i, 1); }
  }

  const nightK = nightness(time.hour);
  life.update(dt, t, lifeCtx());
  world.updateLife(t, dt, nightK, { pos: player.pos, speed: player.vT.length() });
  checkDiscover(dt);
  if (music && (rainTick -= dt) <= 0) { rainTick = 0.25; music.setRain(life.rain); }
  updateConfetti(dt);
  updateSmoke(dt, nightness(time.hour));

  // cahaya & langit
  const lt = lightAt(time.hour);
  const night = nightness(time.hour);
  const dayT = (time.hour - 5.5) / 13;
  const el = dayT >= 0 && dayT <= 1 ? Math.max(0.14, Math.sin(dayT * Math.PI) * 1.13) : 0.7;
  const az = dayT >= 0 && dayT <= 1 ? (dayT - 0.5) * 2.6 : 0.6;
  const sref = cam.sunRef.clone().applyAxisAngle(up, az);
  const sunDir = up.clone().multiplyScalar(Math.sin(el)).addScaledVector(sref, Math.cos(el)).normalize();
  sun.position.copy(player.pos).addScaledVector(sunDir, 60);
  sun.target.position.copy(player.pos);
  const rn = life.rain;
  sun.color.copy(lt.sunC); sun.intensity = lt.sunI * (1 - 0.55 * rn);
  hemi.color.copy(lt.hSky); hemi.groundColor.copy(lt.hGround); hemi.intensity = lt.hI * (1 - 0.1 * rn);
  hemi.position.copy(up);
  scene.fog.color.copy(lt.fog).lerp(RAIN_COL, rn * 0.65); scene.fog.near = 45 - rn * 22; scene.fog.far = 150 - rn * 70;
  skyMat.uniforms.top.value.copy(lt.top).lerp(RAIN_COL, rn * 0.6); skyMat.uniforms.horizon.value.copy(lt.hor).lerp(RAIN_COL, rn * 0.7);
  skyMat.uniforms.upv.value.copy(up); skyMat.uniforms.sunDir.value.copy(sunDir);
  skyMat.uniforms.sunCol.value.copy(lt.sunC).multiplyScalar((1 - night) * (1 - rn));
  stars.material.opacity = night * 0.9;
  world.setNight(night);
  LOOK.rim.value.copy(lt.sunC).multiplyScalar(0.7 * (1 - night)).add(new THREE.Color('#6f7fb8').multiplyScalar(0.35 * night));
  if (music && time.phaseIndex() !== lastPhase) { lastPhase = time.phaseIndex(); music.setPhase(lastPhase); toast(`♪ ${trackTitle(TRACK_KEYS[lastPhase])}`); }
  lantern.intensity = night * 1.4;
  lantern.position.copy(player.pos).addScaledVector(up, 1.6).addScaledVector(player.fwd, 0.3);

  // kamera
  const tgt = player.pos.clone().addScaledVector(up, 1.3);
  // gang sempit: kamera naik (lebih top-down) dulu sebelum mendekat, supaya rumah tidak menutupi
  const camAt = (pitch) => tgt.clone().addScaledVector(cam.f, -cam.dist * Math.cos(pitch)).addScaledVector(up, cam.dist * Math.sin(pitch));
  let want = camAt(cam.pitch), hit = cam.free ? 1 : rayHitColliders(tgt, want);
  for (const p of [0.75, 1.0, 1.25]) {
    if (hit >= 0.97 || p <= cam.pitch) continue;
    const w2 = camAt(p), h2 = rayHitColliders(tgt, w2);
    if (h2 > hit) { want = w2; hit = h2; }
  }
  cam.autoPitch = THREE.MathUtils.lerp(cam.autoPitch ?? cam.pitch, Math.asin(clamp(want.clone().sub(tgt).dot(up) / cam.dist, -1, 1)), 1 - Math.exp(-4 * dt));
  if (hit < 1) want.lerpVectors(tgt, want, Math.max(0.25, hit - 0.06));
  const wdir = want.clone().normalize();
  const minR = R + heightAt(wdir) + 0.8;
  if (want.length() < minR) want.setLength(minR);
  if (cam.snap) { cam.pos.copy(want); cam.snap = false; }
  const closer = want.distanceTo(tgt) < cam.pos.distanceTo(tgt);
  cam.pos.lerp(want, 1 - Math.exp(-dt / (closer ? 0.06 : 0.2)));
  camera.position.copy(cam.pos);
  camera.up.copy(up);
  camera.lookAt(tgt);
  sky.position.copy(camera.position);
  stars.position.copy(camera.position);

  // HUD
  hudTimer -= dt;
  if (hudTimer <= 0) {
    hudTimer = 0.1;
    $('clock').textContent = time.str();
    $('phase').textContent = `${PHASES[time.phaseIndex()].name} · Hari ${time.day}`;
    const tp = targetPos(targetOfStage());
    const cardD = quest.card ? DISTRICT_DEF[quest.card.district] : null;
    const goal = tp || cardD?.dir.clone().multiplyScalar(R);
    if (goal && quest.has) {
      const gd = goal.clone().sub(player.pos); gd.addScaledVector(up, -gd.dot(up));
      const a = Math.atan2(gd.dot(V3().crossVectors(cam.f, up)), gd.dot(cam.f));
      const dist = Math.acos(clamp(goal.clone().normalize().dot(up), -1, 1)) * R;
      $('compass').hidden = false;
      $('arrow').style.transform = `rotate(${a}rad)`;
      $('compassText').textContent = `${DISTRICTS[quest.card.district].short} · ${Math.round(dist)} m`;
    } else $('compass').hidden = true;
    renderCard();
    if (focus && !ui.dialogOpen && started) {
      $('prompt').hidden = false;
      $('promptKey').textContent = usingPad() ? 'X' : isTouchUI() ? '👆' : 'E';
      $('promptText').textContent = `${actionVerb(focus)} · ${focus.label}`;
    } else $('prompt').hidden = true;
    if (toastT > 0) { toastT -= 0.1; if (toastT <= 0) $('toast').hidden = true; }
    $('netStatus').textContent = `Ghost: ${net.mode}${ghosts.size ? ` · ${ghosts.size} kurir lain` : ''}${pad.connected ? ' · 🎮' : ''}`;
    $('dlgMore').textContent = usingPad() ? 'Ⓐ untuk lanjut' : 'E / klik untuk lanjut';
    if (!$('settings').hidden) { $('nowPlaying').textContent = music ? music.nowPlaying : 'Musik mulai setelah menekan Mulai'; $('padStatus').textContent = pad.connected ? `Terhubung: ${pad.id.slice(0, 48)}` : 'Belum ada joystick. Colok USB / sambungkan Bluetooth lalu tekan tombol apa saja.'; }
    drawMini();
    if (!$('map').hidden && !mapUI.follow) drawBig();
    if (isTouchUI()) touch.setAction(focus && !ui.dialogOpen && started ? actionVerb(focus) : 'Aksi', !!focus && !ui.dialogOpen && started);
    document.body.classList.toggle('dialog-open', ui.dialogOpen);
  }
  if (!$('map').hidden && mapUI.follow && (mapUI.acc -= dt) <= 0) { mapUI.acc = 0.25; drawBig(); }
  // penanda tujuan
  const tp = targetPos(targetOfStage());
  marker.visible = !!(showMarker && tp && started);
  if (marker.visible) { marker.position.copy(tp).addScaledVector(tp.clone().normalize(), 2.6 + Math.sin(t * 3) * 0.15); }

  blobMesh.count = blobCount;
  blobMesh.instanceMatrix.needsUpdate = true;
  if (bloomOn) { if (!composer) setupComposer(); composer.render(); } else renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
const marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'); g.fillStyle = '#ff7a3d'; g.beginPath(); g.moveTo(32, 60); g.lineTo(8, 22); g.arc(32, 22, 24, Math.PI, 0); g.closePath(); g.fill(); g.fillStyle = '#fef9ef'; g.fillRect(19, 13, 26, 18); g.strokeStyle = '#ff7a3d'; g.lineWidth = 3; g.beginPath(); g.moveTo(19, 13); g.lineTo(32, 24); g.lineTo(45, 13); g.stroke(); const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; return tx; })(), depthTest: false, transparent: true }));
marker.scale.set(0.9, 0.9, 1);
marker.renderOrder = 20;
scene.add(marker);

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (composer) composer.setSize(w, h);
}
addEventListener('resize', resize);
resize();

// ================================================================ start
let savedData = window.claude?.hot?.data && Object.keys(window.claude.hot.data).length ? window.claude.hot.data : null;
try { savedData = savedData || JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch {}
if (savedData) { $('btnStart').textContent = 'Lanjutkan'; $('startName').value = savedData.name || ''; }
$('startForm').addEventListener('submit', (e) => {
  e.preventDefault();
  startAudio();
  if (savedData) load(savedData);
  player.name = sanitizeText($('startName').value, 20) || player.name;
  $('title').hidden = true;
  $('hud').hidden = false;
  if (isTouch) touch.show();
  if (isTouchUI()) touch.keepAwake();
  started = true;
  save();
  if (!quest.has && quest.idx === 0 && !quest.stickers.length) setTimeout(() => say('Pak Harjo', [`Selamat datang, ${player.name}. Kantor pos ini tinggal menunggu seratus surat terakhir.`, 'Mampir ke saya di depan pintu kalau sudah siap. Tekan E untuk bicara.']), 400);
});

(async () => {
  const mode = await net.connect();
  const list = await net.loadLegacy(SEED_LEGACY);
  list.forEach(spawnLegacy);
  $('netStatus').textContent = `Ghost: ${mode}`;
})();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

setTimeout(() => maps.bake(), 400);
requestAnimationFrame(frame);

// ================================================================ API uji coba (dipakai tests/smoke.mjs)
window.KP = {
  ready: true, scene, buildMs, world, player, playerCh, wife, quest, time, npcs, renderer, LETTERS, life, maps, discovered, touch, joy,
  info() {
    return {
      calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geometries: renderer.info.memory.geometries,
      webgl2: renderer.capabilities.isWebGL2, stats: world.stats, net: net.mode, ghosts: ghosts.size,
      letter: quest.idx, stage: quest.stage, has: quest.has, stickers: quest.stickers.length, grounded: player.grounded,
      onCollider: player.onCollider?.kind || null, height: +(player.pos.length() - R).toFixed(2), dialog: ui.dialogOpen, dialogText: ui.full, focus: focus?.label || null,
    };
  },
  teleport(name, lift = 0.3) {
    const s = world.spots[name] || (npcs[name] && { pos: npcs[name].pos, up: npcs[name].up, face: npcs[name].face });
    if (!s) return false;
    player.pos.copy(s.pos).addScaledVector(s.up, lift);
    if (s.face) player.pos.addScaledVector(s.face, name.startsWith('poi:') || name.startsWith('item:') ? 0 : 0.9);
    player.vT.set(0, 0, 0); player.vUp = 0;
    if (s.face && !name.startsWith('poi:') && !name.startsWith('item:')) { cam.f.copy(s.face).negate(); player.fwd.copy(s.face).negate(); }
    cam.snap = true;
    return true;
  },
  setHour(h) { time.hour = h; },
  camera(dist, pitch, yaw = 0, free = true) { cam.dist = dist; cam.pitch = pitch; cam.free = free; if (yaw) rotateCam(yaw, 0); cam.pitch = pitch; cam.lastDrag = clock.elapsedTime + 999; cam.snap = true; },
  spot(name) { return world.spots[name]?.pos.toArray(); },
  // hadapkan kamera+pemain ke titik (untuk uji jalan/lompat)
  faceTo(name) {
    const p = world.spots[name]?.pos; if (!p) return false;
    const up = player.pos.clone().normalize();
    const d = p.clone().sub(player.pos); d.addScaledVector(up, -d.dot(up)).normalize();
    cam.f.copy(d); player.fwd.copy(d); return true;
  },
  // simulasi fisika deterministik: tahan tombol selama `seconds` (dt 1/60)
  sim(seconds, holdKeys = [], tapKeys = []) {
    const saved = new Set(keys); keys.clear();
    holdKeys.forEach((k) => keys.add(k));
    tapKeys.forEach((k) => pressed.add(k));
    const n = Math.round(seconds * 60);
    for (let i = 0; i < n; i++) { stepPlayer(1 / 60); if (i === 0) pressed.clear(); }
    keys.clear(); saved.forEach((k) => keys.add(k));
    return { height: +(player.pos.length() - R).toFixed(2), on: player.onCollider?.kind || 'tanah', key: player.onCollider?.key || null, grounded: player.grounded };
  },
  floaters: () => floaters.length,
  music: () => (music ? { playing: music.nowPlaying, scheduled: music.scheduled, state: actx.state } : null),
  pad: () => ({ connected: pad.connected, axes: pad.axes, usingPad: usingPad() }),
  character: () => ({ lid: +playerCh.lids.rotation.x.toFixed(2), squash: +playerCh.sq.toFixed(3), armR: +playerCh.armR.rotation.x.toFixed(2), celebrate: playerCh.celebrate > 0 }),
  confetti: () => confP.filter((c) => c.life > 0).length,
  night: () => nightness(time.hour),
  camDist: () => +cam.dist.toFixed(2),
  /** majukan simulasi kehidupan (warga, hewan, cuaca, pancing) tanpa menggambar */
  stepLife(seconds) { const n = Math.round(seconds * 20); for (let i = 0; i < n; i++) life.update(1 / 20, clock.elapsedTime + i / 20, lifeCtx()); },
  focusInfo: () => focus && { kind: focus.kind, id: focus.id, label: focus.label },
  look: () => ({ npcs: Object.values(npcs).map((n) => JSON.stringify(RESIDENTS[n.id].look)), walkers: life.walkers.map((w) => JSON.stringify(w.def.look)) }),
  screenOf(id) { const it = npcs[id]; const v = it.pos.clone().addScaledVector(it.up, 1.0).project(camera); return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight }; },
  closeDialog() { let n = 0; while (ui.dialogOpen && n++ < 20) { ui.typing = ui.full.length; advanceDialog(); } },
};
