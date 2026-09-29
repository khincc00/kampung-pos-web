// Planet mungil Kampung Pos: 1 draw call untuk tanah, rumah & prop via InstancedMesh.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// ------------------------------------------------------------------ gaya visual: material halus + rim light hangat
export const LOOK = { rim: { value: new THREE.Color('#ffd9a8') }, time: { value: 0 }, wind: { value: 1 } };
export function softMat(opts = {}, rim = 0.28) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.78, metalness: 0, ...opts });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRim = LOOK.rim;
    sh.fragmentShader = 'uniform vec3 uRim;\n' + sh.fragmentShader.replace('#include <dithering_fragment>',
      `#include <dithering_fragment>
      float rimK = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0);
      gl_FragColor.rgb += uRim * rimK * ${rim.toFixed(2)};`);
  };
  m.customProgramCacheKey = () => 'soft' + rim;
  return m;
}

export const R = 48;                 // radius planet (m) — keliling ±300 m
export const WATER = -0.55;          // tinggi muka air relatif R
const D2R = Math.PI / 180;
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const C = (hex) => new THREE.Color(hex);

export function dirLL(lat, lon) {
  const la = lat * D2R, lo = lon * D2R;
  return V3(Math.cos(la) * Math.cos(lo), Math.sin(la), Math.cos(la) * Math.sin(lo));
}
export function frameAt(up) {
  const ref = Math.abs(up.y) < 0.9 ? V3(0, 1, 0) : V3(1, 0, 0);
  const east = V3().crossVectors(ref, up).normalize();
  const north = V3().crossVectors(up, east).normalize();
  return { up: up.clone(), east, north };
}
export function latLonOf(dir) {
  return { lat: Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1)) / D2R, lon: Math.atan2(dir.z, dir.x) / D2R };
}

// ------------------------------------------------------------------ noise
function hash3(x, y, z) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const s = (t) => t * t * (3 - 2 * t);
  const u = s(xf), v = s(yf), w = s(zf);
  const L = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz);
  return L(L(L(c(0, 0, 0), c(1, 0, 0), u), L(c(0, 1, 0), c(1, 1, 0), u), v),
           L(L(c(0, 0, 1), c(1, 0, 1), u), L(c(0, 1, 1), c(1, 1, 1), u), v), w);
}
function rng(seed) { let s = seed >>> 0; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9 >>> 0) / 4294967296); }

// ------------------------------------------------------------------ layout
export const DISTRICT_DEF = {
  alun:    { dir: dirLL(90, 0),    r: 17 },
  pelangi: { dir: dirLL(38, 0),    r: 15 },
  pecinan: { dir: dirLL(38, 120),  r: 15 },
  pasar:   { dir: dirLL(14, 235),  r: 13 },
  bukit:   { dir: dirLL(-36, 58),  r: 7 },
  seng:    { dir: dirLL(-40, 178), r: 17 },
};
const LAKE = dirLL(-10, 235);
const HILL = DISTRICT_DEF.bukit.dir;
const ROADS = [['alun', 'pelangi'], ['alun', 'pecinan'], ['alun', 'pasar'], ['pelangi', 'bukit'], ['bukit', 'seng'], ['seng', 'pasar'], ['pecinan', 'seng']];
for (const k in DISTRICT_DEF) DISTRICT_DEF[k].frame = frameAt(DISTRICT_DEF[k].dir);

const angle = (a, b) => Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1));

export function heightAt(dir) {
  let h = 0.2 + (vnoise(dir.x * 3.1 + 7, dir.y * 3.1, dir.z * 3.1) - 0.5) * 1.3
            + (vnoise(dir.x * 9 + 3, dir.y * 9, dir.z * 9) - 0.5) * 0.35;
  // ratakan distrik
  for (const k in DISTRICT_DEF) {
    const d = DISTRICT_DEF[k];
    const m = angle(dir, d.dir) * R;
    const f = 1 - THREE.MathUtils.smoothstep(m, d.r, d.r + 9);
    if (f > 0) h = THREE.MathUtils.lerp(h, 0.15, f);
  }
  const ah = angle(dir, HILL);
  h += 10 * Math.min(1, 1.25 * Math.exp(-((ah / 0.28) ** 2)));
  const al = angle(dir, LAKE);
  h -= 3.0 * Math.exp(-((al / 0.3) ** 2));
  return h;
}

function distToArc(dir, a, b) {
  const ab = angle(a, b);
  if (angle(dir, a) + angle(dir, b) > ab + 0.25) return Infinity;
  const n = V3().crossVectors(a, b).normalize();
  return Math.abs(Math.asin(THREE.MathUtils.clamp(dir.dot(n), -1, 1))) * R;
}

// koordinat lokal distrik → arah di bola
export function localDir(dk, x, z) {
  const d = DISTRICT_DEF[dk];
  return d.dir.clone().addScaledVector(d.frame.east, x / R).addScaledVector(d.frame.north, z / R).normalize();
}
function localCoords(dk, dir) {
  const d = DISTRICT_DEF[dk];
  const off = dir.clone().multiplyScalar(R).sub(d.dir.clone().multiplyScalar(R));
  return { x: off.dot(d.frame.east), z: off.dot(d.frame.north) };
}
export function surfacePoint(dir, lift = 0) { return dir.clone().multiplyScalar(R + heightAt(dir) + lift); }

// ------------------------------------------------------------------ warna tanah
const COL = {
  grass: C('#9cba66'), grass2: C('#8fb05a'), grass3: C('#a9c46f'), dirt: C('#c9ae82'), paving: C('#e3d2b0'),
  sand: C('#dcc99d'), hill: C('#86a857'), sawah1: C('#7fae4f'), sawah2: C('#a8c25a'), sawahWater: C('#8fb8a8'),
};
function lanes(dk) {
  // [x0, x1, z0, z1] area gang/jalan lokal
  return {
    alun: [[-2.5, 2.5, -17, 17], [-17, 17, -2.5, 2.5]],
    pelangi: [[-1.3, 1.3, -15, 15]],
    pecinan: [[-1.6, 1.6, -15, 15]],
    pasar: [[-2, 2, -3, 12], [-9, 9, 3, 5]],
    seng: [[-15, 15, -0.2, 2.2]],
    bukit: [],
  }[dk];
}
function groundColor(dir, h, jitter) {
  const out = COL.grass.clone().lerp(COL.grass2, vnoise(dir.x * 14, dir.y * 14, dir.z * 14)).lerp(COL.grass3, jitter * 0.35);
  if (h < WATER + 0.35) return COL.sand.clone().offsetHSL(0, 0, (jitter - 0.5) * 0.04);
  if (h > 6) out.lerp(COL.hill, 0.6);
  if (dir.y < -0.93) { // sawah di kutub selatan
    const band = Math.floor((Math.atan2(dir.z, dir.x) + Math.PI) * 14) % 3;
    return (band === 0 ? COL.sawahWater : band === 1 ? COL.sawah1 : COL.sawah2).clone().offsetHSL(0, 0, (jitter - 0.5) * 0.05);
  }
  for (const [a, b] of ROADS) {
    if (distToArc(dir, DISTRICT_DEF[a].dir, DISTRICT_DEF[b].dir) < 1.6) return COL.dirt.clone().offsetHSL(0, 0, (jitter - 0.5) * 0.05);
  }
  for (const dk in DISTRICT_DEF) {
    const d = DISTRICT_DEF[dk];
    const m = angle(dir, d.dir) * R;
    if (m > d.r + 4) continue;
    if (dk === 'alun' && m < 13) return COL.paving.clone().offsetHSL(0, 0, (jitter - 0.5) * 0.04);
    const lc = localCoords(dk, dir);
    for (const [x0, x1, z0, z1] of lanes(dk)) {
      if (lc.x > x0 && lc.x < x1 && lc.z > z0 && lc.z < z1) return (dk === 'pecinan' ? COL.paving : COL.dirt).clone().offsetHSL(0, 0, (jitter - 0.5) * 0.05);
    }
  }
  return out;
}

// ------------------------------------------------------------------ geometri
function nonIndexed(g) { return g.index ? g.toNonIndexed() : g; }

// gabung bagian-bagian (box/cyl/ico) jadi 1 geometri ber-vertex-color
export function prefab(parts) {
  const pos = [], nor = [], col = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (const p of parts) {
    let g;
    // jumlah segmen menyesuaikan ukuran benda: halus di yang besar, hemat di yang kecil
    const auto = (r, lo, hi) => Math.round(THREE.MathUtils.clamp(lo + r * 40, lo, hi));
    if (p.t === 'box') { const m0 = Math.min(...p.s); g = m0 > 0.08 && !p.sharp ? new RoundedBoxGeometry(...p.s, 1, Math.min(m0 * 0.3, 0.12)) : new THREE.BoxGeometry(...p.s); }
    else if (p.t === 'cyl') g = new THREE.CylinderGeometry(p.rt, p.rb ?? p.rt, p.h, p.seg ?? auto(Math.max(p.rt, p.rb ?? 0), 6, 14));
    else if (p.t === 'ico') g = new THREE.IcosahedronGeometry(p.r, p.d ?? 1);
    else if (p.t === 'cone') g = new THREE.ConeGeometry(p.r, p.h, p.seg ?? auto(p.r, 6, 14));
    else if (p.t === 'sphere') { const sg = p.seg ?? auto(p.r, 6, 18); g = new THREE.SphereGeometry(p.r, sg, p.ring ?? Math.max(4, Math.round(sg * 0.65)), 0, Math.PI * 2, 0, p.theta ?? Math.PI); }
    else if (p.t === 'capsule') g = new THREE.CapsuleGeometry(p.r, p.len, p.r > 0.05 ? 4 : 2, p.r > 0.05 ? 12 : 6);
    g = nonIndexed(g);
    if (p.sc) g.scale(...p.sc);
    e.set(...(p.r3 || [0, 0, 0]));
    q.setFromEuler(e);
    m.compose(V3(...(p.p || [0, 0, 0])), q, V3(1, 1, 1));
    g.applyMatrix4(m);
    if (p.flat) g.computeVertexNormals();
    const c = C(p.c);
    const a = g.attributes.position.array, n = g.attributes.normal.array;
    for (let i = 0; i < a.length; i += 3) {
      pos.push(a[i], a[i + 1], a[i + 2]); nor.push(n[i], n[i + 1], n[i + 2]);
      const shade = p.shadeY ? 0.82 + 0.18 * THREE.MathUtils.clamp((a[i + 1] - (p.p?.[1] ?? 0)) / p.shadeY + 0.5, 0, 1) : 1;
      col.push(c.r * shade, c.g * shade, c.b * shade);
    }
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}

// Atap seng bergelombang (unit): bubungan sejajar X, lebar 1, kedalaman 1, tinggi 1.
function sengRoofGeometry(ridges = 26) {
  const pos = [], col = [];
  const amp = 0.018;
  const pushQuad = (a, b, c, d, shade) => {
    pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    for (let i = 0; i < 6; i++) col.push(shade, shade, shade);
  };
  for (const side of [-1, 1]) {
    for (let i = 0; i < ridges; i++) {
      const x0 = -0.5 + i / ridges, x1 = -0.5 + (i + 1) / ridges, xm = (x0 + x1) / 2;
      const eave = [0, side * 0.5], ridge = [1, 0];      // [y, z]
      const P = (x, yz, lift) => [x, yz[0] + lift, yz[1]];
      const s1 = 0.93 + ((i * 7) % 5) * 0.012, s2 = 1.0;
      pushQuad(P(x0, eave, 0), P(xm, eave, amp), P(xm, ridge, amp), P(x0, ridge, 0), s1);
      pushQuad(P(xm, eave, amp), P(x1, eave, 0), P(x1, ridge, 0), P(xm, ridge, amp), s2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}
function gableGeometry() {
  const s = new THREE.Shape();
  s.moveTo(-0.5, 0); s.lineTo(0.5, 0); s.lineTo(0, 1); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false });
  g.translate(0, 0, -0.5);
  g.rotateY(Math.PI / 2); // segitiga di bidang Z-Y, tebal sepanjang X
  return nonIndexed(g);
}
function unitBox(r = 0.05) { const g = new RoundedBoxGeometry(1, 1, 1, 2, r); g.translate(0, 0.5, 0); return g; }
function sharpBox() { const g = new THREE.BoxGeometry(1, 1, 1); g.translate(0, 0.5, 0); return g; }

// ------------------------------------------------------------------ batch instanced
class Batch {
  constructor(name, geo, mat, opts = {}) {
    this.name = name; this.geo = geo; this.mat = mat; this.items = []; this.opts = opts;
  }
  add(matrix, color) { this.items.push([matrix.clone(), color ? C(color) : null]); return this.items.length - 1; }
  build(scene) {
    if (!this.items.length) return null;
    const im = new THREE.InstancedMesh(this.geo, this.mat, this.items.length);
    im.name = this.name;
    this.items.forEach(([m, c], i) => { im.setMatrixAt(i, m); if (c) im.setColorAt(i, c); });
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.castShadow = this.opts.cast !== false;
    im.receiveShadow = this.opts.receive !== false;
    im.computeBoundingSphere();
    scene.add(im);
    this.mesh = im;
    return im;
  }
}

// ------------------------------------------------------------------ builder
export function buildWorld(scene, { quality = 'high' } = {}) {
  const colliders = [];
  const spots = {};            // titik NPC / POI / item
  const houses = [];           // untuk peta
  const signs = [];
  const lampPositions = [];

  const matInst = softMat();
  const matVC = softMat({ vertexColors: true });
  const matRoof = softMat({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.45, metalness: 0.35 }, 0.2);
  const matWindow = softMat({ color: '#2f3f4c', emissive: '#000000', roughness: 0.15, metalness: 0.2 }, 0.5);
  const matBulb = new THREE.MeshBasicMaterial({ color: '#efe3c4' });
  const matLampion = softMat({ color: '#d9483b', emissive: '#000000', roughness: 0.6 });

  const B = {
    plinth: new Batch('plinth', unitBox(0.08), matInst),
    wall: new Batch('walls', unitBox(), matInst),
    gable: new Batch('gables', gableGeometry(), matInst),
    roof: new Batch('roofs_seng', sengRoofGeometry(), matRoof),
    trim: new Batch('trim', sharpBox(), matInst),
    window: new Batch('windows', sharpBox(), matWindow, { cast: false }),
    post: new Batch('posts', unitBox(0.2), matInst),
    porch: new Batch('porch_seng', unitBox(0.1), matInst),
    trunk: new Batch('trunks', prefab([{ t: 'cyl', rt: 0.16, rb: 0.24, h: 2.4, p: [0, 1.2, 0], c: '#8b5a2b', seg: 6 }]), matVC),
    crown: new Batch('crowns', prefab([
      { t: 'ico', r: 1.5, p: [0, 3.1, 0], c: '#5f9c47', d: 1 }, { t: 'ico', r: 1.15, p: [0.85, 3.7, 0.35], c: '#74b454', d: 1 },
      { t: 'ico', r: 1.05, p: [-0.75, 3.6, -0.45], c: '#5a9443', d: 1 }, { t: 'ico', r: 0.95, p: [0.1, 4.35, -0.2], c: '#86c25e', d: 1 },
      { t: 'ico', r: 0.8, p: [-0.3, 2.6, 0.9], c: '#6aa84f', d: 1 }]), matVC),
    kelapa: new Batch('kelapa', prefab([
      { t: 'cyl', rt: 0.13, rb: 0.2, h: 5.5, p: [0.25, 2.75, 0], r3: [0, 0, -0.09], c: '#9a7a52', seg: 6 },
      ...[0, 1, 2, 3, 4, 5].map((i) => ({ t: 'box', s: [0.28, 0.06, 2.4], p: [0.5 + Math.cos(i * 1.05) * 1.0, 5.3, Math.sin(i * 1.05) * 1.0], r3: [0.35 * Math.cos(i * 1.05 + Math.PI / 2), -i * 1.05 + Math.PI / 2, 0.35 * Math.sin(i * 1.05)], c: i % 2 ? '#5f9c47' : '#6fae52' })),
      { t: 'ico', r: 0.28, p: [0.5, 5.05, 0], c: '#7a5a2e' },
    ]), matVC),
    bush: new Batch('bushes', prefab([{ t: 'ico', r: 0.7, p: [0, 0.35, 0], c: '#6fa84e' }, { t: 'ico', r: 0.5, p: [0.55, 0.3, 0.2], c: '#7fb85a' }, { t: 'ico', r: 0.45, p: [-0.4, 0.28, -0.3], c: '#5f9c47' }, { t: 'sphere', r: 0.09, p: [0.3, 0.75, 0.35], c: '#e8453c', seg: 6, ring: 4 }, { t: 'sphere', r: 0.08, p: [-0.35, 0.62, 0.3], c: '#feca57', seg: 6, ring: 4 }]), matVC, { cast: false }),
    rice: new Batch('padi', prefab([{ t: 'cone', r: 0.18, h: 0.6, p: [0, 0.3, 0], c: '#9cc25a', seg: 4 }]), matVC, { cast: false }),
    pole: new Batch('tiang_listrik', prefab([
      { t: 'cyl', rt: 0.08, rb: 0.12, h: 7, p: [0, 3.5, 0], c: '#b9ada0', seg: 6 },
      { t: 'box', s: [1.2, 0.08, 0.08], p: [0, 6.5, 0], c: '#4a3b33' },
      { t: 'box', s: [0.3, 0.42, 0.25], p: [0.2, 5.6, 0.12], c: '#6b6f6a' },
    ]), matVC),
    lamp: new Batch('lampu_jalan', prefab([
      { t: 'cyl', rt: 0.06, rb: 0.08, h: 3.4, p: [0, 1.7, 0], c: '#4a3b33', seg: 6 },
      { t: 'box', s: [0.08, 0.08, 0.7], p: [0, 3.35, 0.3], c: '#4a3b33' },
      { t: 'cone', r: 0.28, h: 0.22, p: [0, 3.25, 0.62], c: '#3f8f8a', seg: 6 },
    ]), matVC),
    bulb: new Batch('bohlam', prefab([{ t: 'ico', r: 0.13, p: [0, 0, 0], c: '#ffffff' }]), matBulb, { cast: false, receive: false }),
    lampion: new Batch('lampion', prefab([
      { t: 'sphere', r: 0.2, seg: 10, ring: 7, sc: [1, 1.25, 1], p: [0, 0, 0], c: '#ffffff' },
      { t: 'cyl', rt: 0.12, h: 0.06, p: [0, 0.33, 0], c: '#feca57', seg: 6 },
      { t: 'cyl', rt: 0.12, h: 0.06, p: [0, -0.33, 0], c: '#feca57', seg: 6 },
    ]), matLampion, { cast: false }),
  };

  // prefab prop sekali-pakai / sedikit instance
  const P = {
    gerobak: new Batch('gerobak', prefab([
      { t: 'box', s: [1.7, 0.85, 0.85], p: [0, 0.75, 0], c: '#8b5a2b' },
      { t: 'box', s: [1.7, 0.6, 0.85], p: [0, 1.48, 0], c: '#bfe3ea' },
      { t: 'box', s: [2.0, 0.08, 1.2], p: [0, 2.35, 0], c: '#ff7a3d' },
      { t: 'box', s: [0.07, 1.2, 0.07], p: [0.8, 1.75, 0.38], c: '#8b5a2b' }, { t: 'box', s: [0.07, 1.2, 0.07], p: [-0.8, 1.75, 0.38], c: '#8b5a2b' },
      { t: 'cyl', rt: 0.3, h: 0.08, p: [-0.3, 0.3, 0.47], r3: [Math.PI / 2, 0, 0], c: '#3b302b', seg: 8 },
      { t: 'cyl', rt: 0.3, h: 0.08, p: [-0.3, 0.3, -0.47], r3: [Math.PI / 2, 0, 0], c: '#3b302b', seg: 8 },
      { t: 'cyl', rt: 0.22, h: 0.35, p: [0.45, 1.35, 0], c: '#d9d2c4', seg: 8 },
      { t: 'box', s: [0.9, 0.06, 0.06], p: [1.3, 0.95, 0], c: '#8b5a2b' },
    ]), matVC),
    becak: new Batch('becak', prefab([
      { t: 'box', s: [1.15, 0.45, 0.9], p: [0, 0.6, 0.55], c: '#48a6c9' },
      { t: 'box', s: [1.15, 0.7, 0.12], p: [0, 1.1, 0.1], c: '#48a6c9' },
      { t: 'box', s: [1.3, 0.08, 1.05], p: [0, 1.75, 0.55], c: '#ff7a3d' },
      { t: 'cyl', rt: 0.34, h: 0.06, p: [0.62, 0.34, 0.6], r3: [0, 0, Math.PI / 2], c: '#3b302b', seg: 10 },
      { t: 'cyl', rt: 0.34, h: 0.06, p: [-0.62, 0.34, 0.6], r3: [0, 0, Math.PI / 2], c: '#3b302b', seg: 10 },
      { t: 'cyl', rt: 0.34, h: 0.06, p: [0, 0.34, -1.1], r3: [0, 0, Math.PI / 2], c: '#3b302b', seg: 10 },
      { t: 'box', s: [0.07, 0.07, 1.3], p: [0, 0.55, -0.45], c: '#3b302b' },
      { t: 'box', s: [0.32, 0.08, 0.3], p: [0, 1.05, -0.85], c: '#3b302b' },
    ]), matVC),
    vespa: new Batch('vespa', prefab([
      { t: 'box', s: [0.55, 0.5, 0.8], p: [0, 0.55, -0.3], c: '#feca57' },
      { t: 'box', s: [0.38, 0.12, 0.7], p: [0, 0.32, 0.35], c: '#feca57' },
      { t: 'box', s: [0.45, 0.8, 0.14], p: [0, 0.7, 0.68], c: '#feca57' },
      { t: 'box', s: [0.34, 0.1, 0.55], p: [0, 0.85, -0.3], c: '#4a3b33' },
      { t: 'box', s: [0.6, 0.06, 0.06], p: [0, 1.12, 0.72], c: '#4a3b33' },
      { t: 'cyl', rt: 0.07, h: 0.1, p: [0, 1.02, 0.8], r3: [Math.PI / 2, 0, 0], c: '#fff4d6', seg: 8 },
      { t: 'cyl', rt: 0.2, h: 0.1, p: [0, 0.2, 0.72], r3: [0, 0, Math.PI / 2], c: '#3b302b', seg: 9 },
      { t: 'cyl', rt: 0.2, h: 0.1, p: [0, 0.2, -0.5], r3: [0, 0, Math.PI / 2], c: '#3b302b', seg: 9 },
    ]), matVC),
    motor: new Batch('motor_bebek', prefab([
      { t: 'box', s: [0.3, 0.35, 1.2], p: [0, 0.55, 0], c: '#d9483b' },
      { t: 'box', s: [0.3, 0.1, 0.6], p: [0, 0.8, -0.2], c: '#3b302b' },
      { t: 'box', s: [0.6, 0.05, 0.05], p: [0, 1.0, 0.5], c: '#3b302b' },
      { t: 'cyl', rt: 0.28, h: 0.08, p: [0, 0.28, 0.55], r3: [0, 0, Math.PI / 2], c: '#3b302b', seg: 9 },
      { t: 'cyl', rt: 0.28, h: 0.08, p: [0, 0.28, -0.55], r3: [0, 0, Math.PI / 2], c: '#3b302b', seg: 9 },
    ]), matVC),
    kucing: new Batch('kucing_oyen', prefab([
      { t: 'box', s: [0.26, 0.22, 0.46], p: [0, 0.2, 0], c: '#f29a3a' },
      { t: 'box', s: [0.24, 0.22, 0.2], p: [0, 0.34, 0.28], c: '#f29a3a' },
      { t: 'cone', r: 0.05, h: 0.1, p: [0.07, 0.49, 0.28], c: '#e0842a', seg: 3 },
      { t: 'cone', r: 0.05, h: 0.1, p: [-0.07, 0.49, 0.28], c: '#e0842a', seg: 3 },
      { t: 'box', s: [0.05, 0.05, 0.32], p: [0, 0.3, -0.32], r3: [0.6, 0, 0], c: '#e0842a' },
      { t: 'box', s: [0.2, 0.04, 0.3], p: [0, 0.3, 0.02], c: '#fbe3c4' },
    ]), matVC),
    drum: new Batch('drum_ember', prefab([
      { t: 'cyl', rt: 0.36, h: 0.9, p: [0, 0.45, 0], c: '#3f7fbf', seg: 9 },
      { t: 'cyl', rt: 0.37, h: 0.05, p: [0, 0.6, 0], c: '#2f6aa3', seg: 9 },
      { t: 'cyl', rt: 0.37, h: 0.05, p: [0, 0.25, 0], c: '#2f6aa3', seg: 9 },
    ]), matVC),
    ember: new Batch('ember', prefab([{ t: 'cyl', rt: 0.22, rb: 0.17, h: 0.3, p: [0, 0.15, 0], c: '#ffffff', seg: 8 }]), matInst),
    crate: new Batch('peti_kayu', prefab([
      { t: 'box', s: [0.9, 0.7, 0.9], p: [0, 0.35, 0], c: '#a67b4d' },
      { t: 'box', s: [0.94, 0.08, 0.94], p: [0, 0.66, 0], c: '#8b5a2b' },
      { t: 'box', s: [0.94, 0.08, 0.94], p: [0, 0.04, 0], c: '#8b5a2b' },
    ]), matVC),
    toren: new Batch('toren_air', prefab([
      ...[[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]].map(([x, z]) => ({ t: 'box', s: [0.1, 2.3, 0.1], p: [x, 1.15, z], c: '#8b5a2b' })),
      { t: 'box', s: [1.3, 0.1, 1.3], p: [0, 2.3, 0], c: '#8b5a2b' },
      { t: 'cyl', rt: 0.55, rb: 0.6, h: 1.0, p: [0, 2.85, 0], c: '#ff8a3d', seg: 10 },
      { t: 'cyl', rt: 0.3, rb: 0.55, h: 0.2, p: [0, 3.45, 0], c: '#ff8a3d', seg: 10 },
    ]), matVC),
    parabola: new Batch('parabola', prefab([
      { t: 'sphere', r: 0.5, seg: 9, ring: 4, theta: 0.9, p: [0, 0.6, 0], r3: [-1.1, 0, 0], c: '#d8d8d2' },
      { t: 'box', s: [0.06, 0.6, 0.06], p: [0, 0.3, 0], c: '#9a9a92' },
    ]), matVC),
    jemuran: new Batch('jemuran', prefab([
      { t: 'box', s: [0.07, 1.9, 0.07], p: [-1.6, 0.95, 0], c: '#8b5a2b' }, { t: 'box', s: [0.07, 1.9, 0.07], p: [1.6, 0.95, 0], c: '#8b5a2b' },
      { t: 'box', s: [3.2, 0.02, 0.02], p: [0, 1.85, 0], c: '#e8e2d6' },
      ...['#ff9a9e', '#feca57', '#48dbfb', '#fbf3e4', '#1dd1a1', '#ff7a3d'].map((c, i) => ({ t: 'box', s: [0.42, 0.55 + (i % 2) * 0.15, 0.03], p: [-1.25 + i * 0.5, 1.55 - (i % 2) * 0.07, 0], c })),
    ]), matVC, { cast: true }),
    pot: new Batch('pot_monstera', prefab([
      { t: 'cyl', rt: 0.26, rb: 0.2, h: 0.4, p: [0, 0.2, 0], c: '#c45a2c', seg: 8 },
      ...[0, 1, 2, 3, 4].map((i) => ({ t: 'box', s: [0.42, 0.04, 0.32], p: [Math.cos(i * 1.26) * 0.3, 0.65 + (i % 2) * 0.15, Math.sin(i * 1.26) * 0.3], r3: [0, -i * 1.26, 0.4], c: '#3f8f4a' })),
    ]), matVC, { cast: false }),
    table: new Batch('meja_toples', prefab([
      { t: 'box', s: [1.8, 0.08, 0.7], p: [0, 0.8, 0], c: '#8b5a2b' },
      { t: 'box', s: [0.08, 0.8, 0.08], p: [-0.8, 0.4, -0.28], c: '#8b5a2b' }, { t: 'box', s: [0.08, 0.8, 0.08], p: [0.8, 0.4, -0.28], c: '#8b5a2b' },
      { t: 'box', s: [0.08, 0.8, 0.08], p: [-0.8, 0.4, 0.28], c: '#8b5a2b' }, { t: 'box', s: [0.08, 0.8, 0.08], p: [0.8, 0.4, 0.28], c: '#8b5a2b' },
      ...[-0.6, -0.2, 0.2, 0.6].flatMap((x) => [
        { t: 'cyl', rt: 0.13, h: 0.3, p: [x, 0.99, 0], c: '#cfe6ea', seg: 8 },
        { t: 'cyl', rt: 0.11, h: 0.18, p: [x, 0.96, 0], c: '#f0c65a', seg: 7 },
        { t: 'cyl', rt: 0.14, h: 0.06, p: [x, 1.17, 0], c: '#d9483b', seg: 8 },
      ]),
      { t: 'box', s: [1.6, 0.08, 0.35], p: [0, 0.42, 0.75], c: '#8b5a2b' },
    ]), matVC),
    renteng: new Batch('sachet_renteng', prefab([
      ...[0, 1, 2, 3, 4, 5, 6].map((i) => ({ t: 'box', s: [0.14, 0.9, 0.02], p: [-0.6 + i * 0.2, 0, 0], c: ['#d9483b', '#feca57', '#48dbfb', '#1dd1a1', '#ff7a3d', '#9a7fb0', '#fef9ef'][i] })),
    ]), matVC, { cast: false }),
    lapak: new Batch('lapak', prefab([
      ...[[-1.3, -1], [1.3, -1], [-1.3, 1], [1.3, 1]].map(([x, z]) => ({ t: 'box', s: [0.08, 2.3, 0.08], p: [x, 1.15, z], c: '#8b5a2b' })),
      { t: 'box', s: [3.0, 0.07, 2.4], p: [0, 2.3, 0], r3: [0.12, 0, 0], c: '#ffffff' },
      { t: 'box', s: [2.4, 0.75, 0.9], p: [0, 0.38, 0.4], c: '#8b5a2b' },
      { t: 'box', s: [0.55, 0.28, 0.5], p: [-0.7, 0.9, 0.4], c: '#6aa84f' },
      { t: 'box', s: [0.55, 0.28, 0.5], p: [0, 0.9, 0.4], c: '#feca57' },
      { t: 'box', s: [0.55, 0.28, 0.5], p: [0.7, 0.9, 0.4], c: '#ff7a3d' },
    ]), matVC),
    perahu: new Batch('perahu', prefab([
      { t: 'box', s: [1.5, 0.55, 4.2], p: [0, 0.1, 0], c: '#8b5a2b' },
      { t: 'cone', r: 0.76, h: 1.0, seg: 4, p: [0, 0.1, 2.5], r3: [Math.PI / 2, Math.PI / 4, 0], sc: [1, 1, 0.55], c: '#7a4e25' },
      { t: 'box', s: [1.3, 0.05, 3.9], p: [0, 0.38, 0], c: '#a67b4d' },
      ...[[-0.6, -1], [0.6, -1], [-0.6, 1], [0.6, 1]].map(([x, z]) => ({ t: 'box', s: [0.05, 1.5, 0.05], p: [x, 1.1, z], c: '#8b5a2b' })),
      { t: 'box', s: [1.6, 0.06, 2.6], p: [0, 1.85, 0], c: '#ff7a3d' },
      { t: 'box', s: [0.5, 0.3, 0.45], p: [-0.3, 0.55, -0.6], c: '#6aa84f' }, { t: 'box', s: [0.5, 0.3, 0.45], p: [0.3, 0.55, 0.3], c: '#feca57' },
    ]), matVC),
    bangku: new Batch('bangku', prefab([
      { t: 'box', s: [1.8, 0.08, 0.45], p: [0, 0.45, 0], c: '#8b5a2b' },
      { t: 'box', s: [0.08, 0.45, 0.4], p: [-0.8, 0.22, 0], c: '#8b5a2b' }, { t: 'box', s: [0.08, 0.45, 0.4], p: [0.8, 0.22, 0], c: '#8b5a2b' },
    ]), matVC),
    posRonda: new Batch('pos_ronda', prefab([
      ...[[-1.2, -1], [1.2, -1], [-1.2, 1], [1.2, 1]].map(([x, z]) => ({ t: 'box', s: [0.14, 2.4, 0.14], p: [x, 1.2, z], c: '#8b5a2b' })),
      { t: 'box', s: [2.6, 0.12, 2.2], p: [0, 0.55, 0], c: '#a67b4d' },
      { t: 'box', s: [3.0, 0.08, 2.6], p: [0, 2.45, 0], r3: [0.1, 0, 0], c: '#9aa3a2' },
      { t: 'cyl', rt: 0.12, h: 0.9, p: [1.0, 1.7, -1.0], c: '#8b5a2b', seg: 7 },
    ]), matVC),
    kotakPos: new Batch('kotak_pos', prefab([
      { t: 'box', s: [0.1, 1.0, 0.1], p: [0, 0.5, 0], c: '#4a3b33' },
      { t: 'box', s: [0.55, 0.6, 0.42], p: [0, 1.25, 0], c: '#ff7a3d' },
      { t: 'box', s: [0.6, 0.06, 0.48], p: [0, 1.57, 0], c: '#c45a2c' },
      { t: 'box', s: [0.3, 0.04, 0.02], p: [0, 1.38, 0.22], c: '#3b302b' },
    ]), matVC),
    kotakRindu: new Batch('kotak_rindu', prefab([
      { t: 'box', s: [0.12, 0.9, 0.12], p: [0, 0.45, 0], c: '#8b5a2b' },
      { t: 'box', s: [0.7, 0.55, 0.45], p: [0, 1.15, 0], c: '#a67b4d' },
      { t: 'box', s: [0.76, 0.12, 0.5], p: [0, 1.46, 0], r3: [0, 0, 0], c: '#8b5a2b' },
      { t: 'box', s: [0.35, 0.18, 0.02], p: [0, 1.2, 0.23], c: '#ff9a9e' },
    ]), matVC),
    dome: new Batch('kubah_musala', prefab([
      { t: 'cyl', rt: 1.6, h: 0.5, p: [0, 0.25, 0], c: '#fef9ef', seg: 10 },
      { t: 'sphere', r: 1.6, seg: 10, ring: 5, theta: Math.PI / 2, p: [0, 0.5, 0], c: '#2e8b57' },
      { t: 'cyl', rt: 0.04, h: 0.8, p: [0, 2.4, 0], c: '#feca57', seg: 5 },
    ]), matVC),
    tower: new Batch('menara_pemancar', towerPrefab(), matVC),
  };

  // helper matriks: base (titik dunia), basis (lx, up, lz), offset lokal, skala, rotasi lokal
  const _m = new THREE.Matrix4(), _r = new THREE.Matrix4(), _s = new THREE.Matrix4();
  function mat(base, basis, o = [0, 0, 0], s = [1, 1, 1], rotY = 0, rotX = 0, rotZ = 0) {
    const p = base.clone().addScaledVector(basis.lx, o[0]).addScaledVector(basis.up, o[1]).addScaledVector(basis.lz, o[2]);
    _m.makeBasis(basis.lx, basis.up, basis.lz);
    _r.makeRotationFromEuler(new THREE.Euler(rotX, rotY, rotZ, 'YXZ'));
    _s.makeScale(...s);
    return new THREE.Matrix4().makeTranslation(p.x, p.y, p.z).multiply(_m).multiply(_r).multiply(_s);
  }
  function worldOf(base, basis, x, y, z) {
    return base.clone().addScaledVector(basis.lx, x).addScaledVector(basis.up, y).addScaledVector(basis.lz, z);
  }
  // penempatan di distrik: posisi lokal (x,z), menghadap titik lokal (tx,tz) atau yaw
  function place(dk, x, z, face) {
    const dir = localDir(dk, x, z);
    const up = dir.clone();
    const base = surfacePoint(dir);
    let lz;
    if (Array.isArray(face)) {
      const t = surfacePoint(localDir(dk, face[0], face[1]));
      lz = t.sub(base); lz.addScaledVector(up, -lz.dot(up));
      if (lz.lengthSq() < 1e-6) lz = DISTRICT_DEF[dk].frame.north.clone();
      lz.normalize();
    } else {
      const f = DISTRICT_DEF[dk].frame;
      const a = (face || 0) * D2R;
      lz = f.north.clone().multiplyScalar(Math.cos(a)).addScaledVector(f.east, Math.sin(a));
      lz.addScaledVector(up, -lz.dot(up)).normalize();
    }
    const lx = V3().crossVectors(up, lz).normalize();
    return { base, basis: { lx, up, lz }, dir };
  }
  function placeDir(dir, yawSeed = 0) {
    const f = frameAt(dir);
    const a = yawSeed;
    const lz = f.north.clone().multiplyScalar(Math.cos(a)).addScaledVector(f.east, Math.sin(a)).normalize();
    const lx = V3().crossVectors(dir, lz).normalize();
    return { base: surfacePoint(dir), basis: { lx, up: dir.clone(), lz }, dir };
  }
  function addCollider(pl, o, hx, hz, y0, top, extra = {}) {
    const base = worldOf(pl.base, pl.basis, o[0], 0, o[2]);
    colliders.push({ base, lx: pl.basis.lx, up: pl.basis.up, lz: pl.basis.lz, hx, hz, y0: y0 + o[1], top: top + o[1], rise: 0, ...extra });
  }
  function prop(batch, pl, o = [0, 0, 0], rotY = 0, color, s = [1, 1, 1]) { batch.add(mat(pl.base, pl.basis, o, s, rotY), color); }
  function spot(name, pl, o, extra = {}) {
    spots[name] = { pos: worldOf(pl.base, pl.basis, ...o), up: pl.basis.up.clone(), face: pl.basis.lz.clone(), ...extra };
  }

  // ---------------------------------------------------------------- rumah
  function house(key, dk, x, z, face, o) {
    const pl = place(dk, x, z, face);
    const { w, d, h } = o;
    const rise = o.rise ?? 0.9, ov = 0.35;
    const wallC = C(o.wall);
    prop(B.plinth, pl, [0, -1.0, 0], 0, '#cdbfa6', [w + 0.25, 1.25, d + 0.25]);
    prop(B.wall, pl, [0, 0, 0], 0, o.wall, [w, h, d]);
    prop(B.wall, pl, [0, 0, 0], 0, '#' + wallC.clone().multiplyScalar(0.84).getHexString(), [w + 0.04, 0.65, d + 0.04]); // cat bawah
    if (!o.flat) {
      prop(B.gable, pl, [w / 2 - 0.05, h, 0], 0, o.wall, [0.1, rise, d]);
      prop(B.gable, pl, [-w / 2 + 0.05, h, 0], 0, o.wall, [0.1, rise, d]);
      prop(B.roof, pl, [0, h, 0], 0, o.roof, [w + 2 * ov, rise, d + 2 * ov]);
      addCollider(pl, [0, h, 0], w / 2 + ov, d / 2 + ov, 0, 0, { rise, kind: 'roof', key });
    }
    addCollider(pl, [0, 0, 0], w / 2, d / 2, -1.5, h, { kind: 'wall', key });
    // pintu + kusen + jendela
    const doorX = o.doorX ?? 0;
    prop(B.trim, pl, [doorX, 0.05, d / 2 + 0.03], 0, '#fef9ef', [1.12, 2.18, 0.06]);
    prop(B.trim, pl, [doorX, 0.05, d / 2 + 0.06], 0, o.door || '#8b5a2b', [0.92, 2.05, 0.06]);
    const winY = o.winY ?? 1.05;
    for (const sx of [-1, 1]) {
      const wx = doorX + sx * Math.min(w * 0.3, 1.6);
      if (Math.abs(wx) > w / 2 - 0.5) continue;
      prop(B.trim, pl, [wx, winY - 0.08, d / 2 + 0.03], 0, '#fef9ef', [1.0, 0.96, 0.05]);
      prop(B.window, pl, [wx, winY, d / 2 + 0.05], 0, null, [0.8, 0.8, 0.05]);
      prop(B.trim, pl, [wx, winY + 0.38, d / 2 + 0.07], 0, '#fef9ef', [0.06, 0.8, 0.04]); // teralis tengah
    }
    if (o.side) { // jendela samping
      prop(B.trim, pl, [w / 2 + 0.03, winY - 0.08, 0], Math.PI / 2, '#fef9ef', [1.0, 0.96, 0.05]);
      prop(B.window, pl, [w / 2 + 0.05, winY, 0], Math.PI / 2, null, [0.8, 0.8, 0.05]);
    }
    if (o.upper) { // lantai 2 (ruko)
      for (const sx of [-1, 1]) {
        prop(B.trim, pl, [sx * w * 0.25, h * 0.62 - 0.08, d / 2 + 0.03], 0, '#fef9ef', [1.1, 1.1, 0.05]);
        prop(B.window, pl, [sx * w * 0.25, h * 0.62, d / 2 + 0.05], 0, null, [0.9, 0.95, 0.05]);
      }
      prop(B.porch, pl, [0, h * 0.5, d / 2 + 0.55], 0, '#8b5a2b', [w, 0.12, 1.1]); // balkon
      addCollider(pl, [0, 0, d / 2 + 0.55], w / 2, 0.55, h * 0.5 - 0.1, h * 0.5 + 0.12, { kind: 'balkon' });
    }
    if (o.porch) {
      const pz = d / 2 + 0.85, ph = o.porchH ?? 2.05, pw = Math.min(w * 0.85, 4.2);
      prop(B.post, pl, [-pw / 2 + 0.1, 0, pz + 0.7], 0, '#8b5a2b', [0.12, ph, 0.12]);
      prop(B.post, pl, [pw / 2 - 0.1, 0, pz + 0.7], 0, '#8b5a2b', [0.12, ph, 0.12]);
      prop(B.porch, pl, [0, ph, pz], 0, o.porchRoof || o.roof, [pw, 0.08, 1.9], 0, -0.1);
      addCollider(pl, [0, 0, pz], pw / 2, 0.95, ph - 0.3, ph + 0.05, { kind: 'porch', key });
    }
    if (o.sign) signs.push({ text: o.sign, pos: worldOf(pl.base, pl.basis, doorX, h - 0.45, d / 2 + 0.12), basis: pl.basis, color: o.signColor || '#ff7a3d', w: Math.min(w - 0.6, 3.6) });
    spot('door:' + key, pl, [doorX, 0, d / 2 + 1.25]);
    houses.push({ key, dk, dir: pl.dir.clone(), w, d, wall: o.wall, roof: o.roof });
    return pl;
  }

  // ---------------------------------------------------------------- ALUN-ALUN
  {
    const dk = 'alun';
    const t = place(dk, 0, 0, 0);
    // Tugu Pos: 4 anak tangga batu + badan + amplop
    const tiers = [6.2, 5.0, 3.8, 2.8];
    tiers.forEach((s, i) => {
      prop(B.plinth, t, [0, i * 0.45 - 0.6, 0], 0, i % 2 ? '#e3d3bb' : '#d8c8ae', [s, 1.05, s]);
      addCollider(t, [0, 0, 0], s / 2, s / 2, -1, i * 0.45 + 0.45, { kind: 'tugu' });
    });
    prop(B.wall, t, [0, 1.8, 0], Math.PI / 4, '#fffaf2', [1.3, 7.2, 1.3]);
    prop(B.wall, t, [0, 9.0, 0], 0, '#ff7a3d', [1.9, 0.25, 1.9]);
    prop(B.wall, t, [0, 9.25, 0], 0, '#fffaf2', [1.6, 1.05, 0.4]);
    prop(B.gable, t, [0, 10.3, 0], 0, '#ff7a3d', [0.45, 0.9, 1.6]);
    addCollider(t, [0, 0, 0], 0.75, 0.75, 0, 10.6, { kind: 'tugu' });
    prop(P.kotakPos, t, [1.05, 1.8, 0.2], -Math.PI / 2);
    spot('poi:tugu_top', t, [0.95, 1.8, 0.95]);
    signs.push({ text: 'TUGU POS', pos: worldOf(t.base, t.basis, 0, 0.55, 3.13), basis: t.basis, color: '#c45a2c', w: 2.4 });

    const kp = house('kantor_pos', dk, 0, -13.5, [0, 0], { w: 9, d: 6, h: 3.4, wall: '#fef9ef', roof: '#d9662e', sign: 'KANTOR POS', side: true, porch: true, porchRoof: '#ff7a3d' });
    prop(B.trim, kp, [0, 3.0, 3.02], 0, '#ff7a3d', [9.02, 0.3, 0.05]);
    prop(P.kotakRindu, kp, [3.0, 0, 3.35], 0);
    spot('poi:kotak_rindu', kp, [3.0, 0, 4.2]);
    addCollider(kp, [3.0, 0, 3.35], 0.4, 0.3, -1, 1.5);
    prop(P.kotakPos, kp, [-3.2, 0, 3.4], 0);

    const ws = house('warung_sri', dk, 12.5, 4.5, [0, 4.5], { w: 5, d: 4, h: 2.6, wall: '#feca57', roof: '#9a5a3a', porch: true, porchH: 2.0, porchRoof: '#8fa3a8', sign: 'WARUNG KOPI', signColor: '#3f8f8a' });
    prop(P.table, ws, [0, 0, 3.0], 0);
    prop(P.renteng, ws, [-1.6, 1.55, 2.2], 0);
    prop(P.drum, ws, [2.35, 0, 3.6], 0);
    addCollider(ws, [2.35, 0, 3.6], 0.38, 0.38, -1, 0.9, { kind: 'drum' });
    addCollider(ws, [0, 0, 3.0], 0.9, 0.35, -1, 0.85, { kind: 'meja' });
    spot('item:surat_angin', ws, [0.8, 2.6 + 0.9 + 0.05, 0]); // di bubungan
    prop(P.kucing, ws, [-1.8, 0, 3.2], 0.8);
    spot('smoke:warung_sri', ws, [1.6, 3.3, -1.0]);

    house('bakso', dk, -12.5, 4.5, [0, 4.5], { w: 5, d: 4, h: 2.6, wall: '#1dd1a1', roof: '#8fa3a8', sign: 'BAKSO PAK MIN', signColor: '#d9483b', porch: true, porchH: 2.0 });
    const ms = house('musala', dk, -11, -9.5, [0, 0], { w: 5.5, d: 5.5, h: 3.2, wall: '#fef9ef', roof: '#2e8b57', flat: true, side: true });
    prop(P.dome, ms, [0, 3.2, 0], 0);
    house('fotokopi', dk, 11, -9.5, [0, 0], { w: 5, d: 4.5, h: 2.8, wall: '#ff9a9e', roof: '#6b7f99', sign: 'FOTOKOPI', signColor: '#48a6c9' });
    house('sukamart', dk, 13.5, -1.5, [0, -1.5], { w: 4.2, d: 5, h: 3.0, wall: '#fef9ef', roof: '#8fa3a8', sign: 'SUKAMART', signColor: '#2f6aa3' });

    const g1 = place(dk, 5.5, 7.5, [0, 0]); prop(P.gerobak, g1, [0, 0, 0], 0.4);
    const g2 = place(dk, -6.5, 7, [0, 0]); prop(P.gerobak, g2, [0, 0, 0], -0.3);
    addCollider(g1, [0, 0, 0], 1.0, 0.5, -1, 1.8);
    addCollider(g2, [0, 0, 0], 1.0, 0.5, -1, 1.8);
    const bc = place(dk, 6, -6.5, 30); prop(P.becak, bc); addCollider(bc, [0, 0, 0], 0.7, 1.4, -1, 1.2);
    const vp = place(dk, -5.5, -6.5, -50); prop(P.motor, vp);
    const pr = place(dk, 8.5, 12, [0, 0]); prop(P.posRonda, pr); addCollider(pr, [0, 0, 0], 1.3, 1.1, -1, 0.62, { kind: 'pos_ronda' });
    for (const [x, z] of [[-5, 4], [5, -3.5], [-4, -4]]) { const b = place(dk, x, z, [0, 0]); prop(P.bangku, b); }
    for (const [x, z] of [[-8.5, 0], [8.5, 0], [0, 8.5], [-3.5, -8.5]]) { const l = place(dk, x, z, [0, 0]); prop(B.lamp, l); lampPositions.push(worldOf(l.base, l.basis, 0, 3.15, 0.62)); }
  }

  // ---------------------------------------------------------------- GANG PELANGI
  {
    const dk = 'pelangi';
    const walls = ['#ff9a9e', '#feca57', '#1dd1a1', '#48dbfb', '#feca57', '#48dbfb', '#ff9a9e', '#1dd1a1'];
    const roofs = ['#8fa3a8', '#c45a2c', '#3f8f8a', '#6b7f99', '#9a5a3a', '#8fa3a8', '#3f8f8a', '#c45a2c'];
    let i = 0;
    for (const side of [-1, 1]) {
      for (const z of [-10.5, -3.5, 3.5, 10.5]) {
        const k = `pelangi_${i + 1}`;
        const pl = house(k, dk, side * 5.3, z, [0, z], { w: 5.4, d: 4.6, h: i % 3 === 1 ? 4.6 : 2.8, wall: walls[i], roof: roofs[i], porch: i % 2 === 0, porchH: 2.05, side: true, upper: i % 3 === 1 });
        prop(P.pot, pl, [1.9, 0, 2.7], i);
        if (i % 3 === 0) prop(P.toren, pl, [-3.4, 0, -0.8], 0);
        if (i % 3 === 0) addCollider(pl, [-3.4, 0, -0.8], 0.65, 0.65, 1.8, 3.55, { kind: 'toren' });
        if (i % 4 === 2) prop(P.parabola, pl, [1.2, (i % 3 === 1 ? 4.6 : 2.8) + 0.5, -1.0], 0.5);
        if (i % 2 === 1) prop(P.ember, pl, [-2.0, 0, 2.7], 0, ['#48dbfb', '#ff9a9e', '#1dd1a1', '#feca57'][i % 4]);
        i++;
      }
    }
    for (const [x, z, r] of [[-5.5, -7, 0], [5.5, 7, 0], [-5.5, 14, 0]]) { const j = place(dk, x + (x < 0 ? -3.4 : 3.4), z, r); prop(P.jemuran, j, [0, 0, 0], Math.PI / 2); }
    const c1 = place(dk, 0.6, 1.5, 70); prop(P.kucing, c1);
    const m1 = place(dk, 2.2, -14, [0, 0]); prop(P.vespa, m1, [0, 0, 0], 1.2);
    for (const z of [-7, 7]) { const l = place(dk, 1.6, z, [0, z]); prop(B.lamp, l, [0, 0, 0], Math.PI / 2); lampPositions.push(worldOf(l.base, l.basis, 0.62, 3.15, 0)); }
  }

  // ---------------------------------------------------------------- PECINAN
  {
    const dk = 'pecinan';
    const walls = ['#fef9ef', '#feca57', '#e8d5b0', '#ff9a9e', '#48dbfb', '#fef9ef'];
    let i = 0;
    for (const side of [-1, 1]) {
      for (const z of [-8, 0, 8]) {
        const k = `ruko_${i + 1}`;
        house(k, dk, side * 4.9, z, [0, z], { w: 7.2, d: 6, h: 5.4, wall: walls[i], roof: '#b5532a', upper: true, winY: 1.25,
          sign: ['KELONTONG ABADI', 'OBAT CAP NAGA', 'KUE LESTARI', 'EMAS SINAR', 'JAHIT JOKO', 'KOPI TIAM'][i], signColor: '#d9483b' });
        i++;
      }
    }
    for (const z of [-12, -4, 4, 12]) {
      const a = place(dk, -1.7, z, 0), b = place(dk, 1.7, z, 0);
      for (let k = 0; k < 3; k++) {
        const pa = worldOf(a.base, a.basis, 0, 4.4, 0), pb = worldOf(b.base, b.basis, 0, 4.4, 0);
        const p = pa.clone().lerp(pb, (k + 1) / 4).addScaledVector(a.basis.up, -0.25 - 0.18 * Math.sin(((k + 1) / 4) * Math.PI));
        B.lampion.add(new THREE.Matrix4().makeBasis(a.basis.lx, a.basis.up, a.basis.lz).setPosition(p));
      }
      extraCables.push([worldOf(a.base, a.basis, 0, 4.45, 0), worldOf(b.base, b.basis, 0, 4.45, 0), 0.35]);
    }
    // gapura
    const g = place(dk, 0, -15.5, 0);
    for (const sx of [-1, 1]) { prop(B.wall, g, [sx * 2.2, 0, 0], 0, '#d9483b', [0.6, 4.6, 0.6]); addCollider(g, [sx * 2.2, 0, 0], 0.3, 0.3, -1, 4.6); }
    prop(B.wall, g, [0, 4.6, 0], 0, '#d9483b', [5.6, 0.5, 0.9]);
    prop(B.roof, g, [0, 5.1, 0], 0, '#2e8b57', [6.4, 0.7, 1.6]);
    prop(B.wall, g, [0, 3.9, 0], 0, '#feca57', [3.2, 0.5, 0.2]);
    signs.push({ text: 'PECINAN', pos: worldOf(g.base, g.basis, 0, 4.15, 0.13), basis: g.basis, color: '#d9483b', w: 3.0, fg: '#feca57' });
    // klenteng kecil
    house('klenteng', dk, 0, 16.5, [0, 0], { w: 6, d: 4.5, h: 3.0, wall: '#d9483b', roof: '#2e8b57', rise: 1.2 });
    const c = place(dk, -0.6, 2, 190); prop(P.kucing, c);
    const gr = place(dk, 1.0, -11, 90); prop(P.gerobak, gr, [0, 0, 0], 0);
  }

  // ---------------------------------------------------------------- PASAR TEPI DANAU
  {
    const dk = 'pasar';
    const tarps = ['#6aa84f', '#ff7a3d', '#feca57', '#48a6c9', '#ff9a9e'];
    for (let i = 0; i < 5; i++) {
      const x = -8 + i * 4;
      const pl = place(dk, x, 7.5, [x, 0]);
      prop(P.lapak, pl);
      B.porch.add(mat(pl.base, pl.basis, [0, 2.33, 0], [3.0, 0.06, 2.4], 0, 0.12), tarps[i]);
      addCollider(pl, [0, 0, 0.4], 1.2, 0.45, -1, 0.78);
      spot(`door:lapak_${i + 1}`, pl, [0, 0, 1.8]);
      houses.push({ key: `lapak_${i + 1}`, dk, dir: pl.dir.clone(), w: 3, d: 2.4, wall: tarps[i], roof: tarps[i] });
    }
    // dermaga ke danau
    const pier = place(dk, 0, -6, 0);
    const pierTop = WATER + 0.45;
    for (let k = 0; k < 7; k++) {
      const pk = place(dk, 0, -2 - k * 2, 0);
      const lift = (R + pierTop) - pk.base.length();
      prop(B.porch, pk, [0, lift - 0.1, 0], 0, '#a67b4d', [2.2, 0.12, 2.05]);
      for (const sx of [-1, 1]) prop(B.post, pk, [sx * 1.0, lift - 2.2, 0], 0, '#8b5a2b', [0.14, 2.1, 0.14]);
      addCollider(pk, [0, 0, 0], 1.1, 1.05, lift - 2, lift + 0.02, { kind: 'dermaga' });
    }
    const pend = place(dk, 0, -14, 0);
    spots['door:dermaga'] = { pos: pend.dir.clone().multiplyScalar(R + pierTop), up: pend.dir.clone(), face: pend.basis.lz.clone() };
    for (const [x, z, r] of [[-3.2, -12, 0.2], [3.4, -9.5, -0.3], [-3.6, -6.5, 0.1]]) {
      const bt = place(dk, x, z, 0);
      const lift = (R + WATER) - bt.base.length();
      prop(P.perahu, bt, [0, lift, 0], r);
      boats.push({ index: P.perahu.items.length - 1, base: bt, lift, r, phase: x });
    }
    for (const [x, z] of [[-7, 3], [7, 3]]) { const l = place(dk, x, z, [0, 0]); prop(B.lamp, l); lampPositions.push(worldOf(l.base, l.basis, 0, 3.15, 0.62)); }
    house('gudang_ikan', dk, 11.5, 10, [0, 6], { w: 4.6, d: 4, h: 2.6, wall: '#e8d5b0', roof: '#8fa3a8', sign: 'IKAN SEGAR', signColor: '#48a6c9' });
    const c = place(dk, 1.6, 4.5, 40); prop(P.kucing, c);
  }

  // ---------------------------------------------------------------- BUKIT PEMANCAR
  {
    const dk = 'bukit';
    const tw = place(dk, 2.5, -1.5, 0);
    prop(P.tower, tw);
    addCollider(tw, [0, 0, 0], 1.6, 1.6, -1, 1.4, { kind: 'menara' });
    spot('door:menara', tw, [0, 0, 2.6]);
    spots['beacon'] = { pos: worldOf(tw.base, tw.basis, 0, 12.3, 0), up: tw.basis.up.clone() };
    const wsj = house('warung_senja', dk, -3, 2.5, [-10, 2.5], { w: 3.8, d: 3.2, h: 2.4, wall: '#feca57', roof: '#9a5a3a', sign: 'TUTUP', signColor: '#8b5a2b', door: '#6b4a2b' });
    spot('poi:warung_senja', wsj, [0, 0, 2.9]);
    const v = place(dk, -1, 5.5, 60); prop(P.vespa, v);
    const bn = place(dk, 3.5, 4.5, 200); prop(P.bangku, bn);
    houses.push({ key: 'menara', dk, dir: tw.dir.clone(), w: 3, d: 3, wall: '#d9483b', roof: '#fef9ef' });
  }

  // ---------------------------------------------------------------- KAMPUNG ATAP SENG (platforming)
  {
    const dk = 'seng';
    const hs = [2.2, 2.6, 3.0, 3.4, 3.8]; // tiap bubungan naik 0.4 m: bisa didaki jalan kaki
    const walls = ['#e8d5b0', '#9fc7c0', '#fef9ef', '#f2c89a', '#c9d8a6'];
    const roofs = ['#8fa3a8', '#9a5a3a', '#6b7f99', '#8a8f8a', '#c45a2c'];
    hs.forEach((h, i) => {
      const x = -11.6 + i * 5.8;
      const pl = house(`seng_${i + 1}`, dk, x, -3.2, [x, 5], { w: 5, d: 5, h, rise: 0.8, wall: walls[i], roof: roofs[i], porch: i === 0, porchH: 1.8, side: i === 4 });
      spot(`ridge:seng_${i + 1}`, pl, [0, h + 0.8, 0]);
      if (i === 4) spot('poi:oyen', pl, [0.6, h + 0.8, 0], { roof: true });
      if (i === 4) prop(P.kucing, pl, [0.6, h + 0.8 - 0.05, 0], 1.3);
      if (i === 2) prop(P.toren, pl, [0, 0, -3.6], 0);
      if (i === 2) addCollider(pl, [0, 0, -3.6], 0.65, 0.65, 1.8, 3.55, { kind: 'toren' });
      if (i === 3) prop(P.parabola, pl, [-1.4, h + 0.35, 1.2], 0.4);
    });
    const s1 = place(dk, -11.6, -3.2, [-11.6, 5]);
    prop(P.drum, s1, [-1.6, 0, 4.3], 0);
    spot('test:depan_drum', s1, [-1.6, 0, 5.6]);
    spot('test:drum', s1, [-1.6, 0.9, 4.3]);
    spot('test:emperan', s1, [-1.2, 1.85, 3.6]);
    addCollider(s1, [-1.6, 0, 4.3], 0.38, 0.38, -1, 0.9, { kind: 'drum' });
    prop(P.crate, s1, [1.9, 0, 4.4], 0.3);
    addCollider(s1, [1.9, 0, 4.4], 0.47, 0.47, -1, 0.72, { kind: 'peti' });
    const row2 = [[-9, '#48dbfb', '#8fa3a8', 2.8, '#8b5a2b'], [-3, '#ff9a9e', '#9a5a3a', 2.6, '#8b5a2b'], [3, '#e8d5b0', '#6b7f99', 2.6, '#3f8f4a'], [9, '#feca57', '#8a8f8a', 3.0, '#8b5a2b']];
    row2.forEach(([x, wall, roof, h, door], i) => {
      const pl = house(`seng_${i + 6}`, dk, x, 7.0, [x, 0], { w: 4.8, d: 4.6, h, wall, roof, door, porch: i === 1, porchH: 1.9 });
      if (i === 3) prop(P.jemuran, pl, [0, 0, 3.2], 0);
    });
    for (const [x, z] of [[-6, 1], [6, 1.3]]) { const l = place(dk, x, z, [x, 5]); prop(B.lamp, l); lampPositions.push(worldOf(l.base, l.basis, 0, 3.15, 0.62)); }
    const c = place(dk, 4, 1.2, 110); prop(P.kucing, c);
    const cr = place(dk, 8.5, 2.2, 20); prop(P.crate, cr); addCollider(cr, [0, 0, 0], 0.47, 0.47, -1, 0.72);
  }

  // ---------------------------------------------------------------- tiang listrik + kabel semrawut
  const cableSegs = [];
  function sag(a, b, s, n = 8) {
    const mid = a.clone().add(b).multiplyScalar(0.5).normalize();
    let prev = a;
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      const p = a.clone().lerp(b, t).addScaledVector(mid, -s * 4 * t * (1 - t));
      cableSegs.push(prev, p);
      prev = p;
    }
  }
  const poleTops = [];
  for (const [a, b] of ROADS) {
    const da = DISTRICT_DEF[a].dir, db = DISTRICT_DEF[b].dir;
    const ang = angle(da, db);
    const n = Math.max(2, Math.floor((ang * R) / 11));
    let prev = null;
    for (let k = 1; k < n; k++) {
      const dir = da.clone().lerp(db, k / n).normalize();
      const side = V3().crossVectors(da, db).normalize();
      const pd = dir.clone().addScaledVector(side, 2.6 / R).normalize();
      if (heightAt(pd) < WATER + 0.2) { prev = null; continue; }
      const pl = placeDir(pd, k);
      prop(B.pole, pl);
      const top = worldOf(pl.base, pl.basis, 0, 6.45, 0);
      poleTops.push(top);
      if (prev) { sag(prev, top, 0.7); sag(prev.clone().addScaledVector(pd, -0.35), top.clone().addScaledVector(pd, -0.35), 1.1); if (k % 2) sag(prev.clone().addScaledVector(pd, -0.7), top.clone().addScaledVector(pd, -0.7), 1.5); }
      prev = top;
    }
  }
  // kabel ke atap rumah (sambungan liar khas kampung)
  for (const h of houses) {
    let best = null, bd = 1e9;
    const hp = surfacePoint(h.dir, 2.4);
    for (const t of poleTops) { const d = t.distanceTo(hp); if (d < bd) { bd = d; best = t; } }
    if (best && bd < 22) sag(best, hp, 0.9, 7);
  }
  for (const [a, b, s] of extraCables) sag(a, b, s, 6);
  const cableGeo = new THREE.BufferGeometry().setFromPoints(cableSegs);
  const cables = new THREE.LineSegments(cableGeo, new THREE.LineBasicMaterial({ color: '#2e2622' }));
  cables.name = 'kabel_semrawut';
  scene.add(cables);

  // ---------------------------------------------------------------- vegetasi
  const rand = rng(1234);
  const nearDistrict = (dir, pad) => Object.values(DISTRICT_DEF).some((d) => angle(dir, d.dir) * R < d.r + pad);
  const nearRoad = (dir) => ROADS.some(([a, b]) => distToArc(dir, DISTRICT_DEF[a].dir, DISTRICT_DEF[b].dir) < 3.2);
  let trees = 0, palms = 0, bushes = 0, rice = 0;
  const maxTrees = quality === 'low' ? 120 : 170, maxBush = quality === 'low' ? 90 : 130;
  for (let n = 0; n < 5000 && (trees < maxTrees || palms < 60 || bushes < maxBush); n++) {
    const dir = V3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1);
    if (dir.lengthSq() > 1 || dir.lengthSq() < 0.01) continue;
    dir.normalize();
    const h = heightAt(dir);
    if (h < WATER + 0.3 || dir.y < -0.9) continue;
    if (nearRoad(dir)) continue;
    const pl = placeDir(dir, rand() * 6.28);
    const s = 0.75 + rand() * 0.6;
    const nearLake = angle(dir, LAKE) * R < 26;
    if (nearDistrict(dir, 2)) {
      if (bushes < maxBush && !nearDistrict(dir, -3)) { prop(B.bush, pl, [0, 0, 0], 0, null, [s, s, s]); bushes++; }
      continue;
    }
    if ((nearLake || rand() < 0.2) && palms < 60) {
      prop(B.kelapa, pl, [0, -0.1, 0], rand() * 6, null, [s, s * 1.1, s]);
      addCollider(pl, [0, 0, 0], 0.25, 0.25, -1, 3.5, { kind: 'pohon' });
      palms++;
    } else if (trees < maxTrees) {
      prop(B.trunk, pl, [0, -0.1, 0], 0, null, [s, s, s]);
      prop(B.crown, pl, [0, -0.1, 0], rand() * 6, null, [s, s, s]);
      addCollider(pl, [0, 0, 0], 0.25 * s, 0.25 * s, -1, 2.2 * s, { kind: 'pohon' });
      trees++;
    } else if (bushes < maxBush) { prop(B.bush, pl, [0, 0, 0], 0, null, [s, s, s]); bushes++; }
  }
  // sawah: baris padi di kutub selatan
  for (let lat = -84; lat <= -68; lat += 1.1) {
    for (let lon = 0; lon < 360; lon += 360 / Math.max(8, Math.round(Math.cos(lat * D2R) * 2 * Math.PI * R / 1.2))) {
      const dir = dirLL(lat + (rand() - 0.5) * 0.3, lon + (rand() - 0.5) * 0.6);
      const band = Math.floor((Math.atan2(dir.z, dir.x) + Math.PI) * 14) % 3;
      if (band === 0) continue;
      prop(B.rice, placeDir(dir, rand() * 6), [0, 0, 0], 0, null, [1, 0.8 + rand() * 0.5, 1]);
      rice++;
    }
  }

  // ---------------------------------------------------------------- rumput bergoyang + bunga (instanced, 1 draw masing-masing)
  const grassN = quality === 'low' ? 2000 : 5000;
  const grassMat = softMat({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.9 }, 0.15);
  grassMat.onBeforeCompile = ((orig) => (sh) => {
    orig(sh);
    sh.uniforms.uTime = LOOK.time;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
      float sway = sin(uTime * 1.8 + ip.x * 0.35 + ip.z * 0.27) * 0.12 + sin(uTime * 3.1 + ip.y * 0.5) * 0.04;
      transformed.x += sway * position.y * position.y * 2.2;
      transformed.z += sway * 0.6 * position.y * position.y * 2.2;`);
  })(grassMat.onBeforeCompile);
  grassMat.customProgramCacheKey = () => 'grass';
  const tuft = (() => {
    const pos = [], col = [];
    const base = C('#4f8a35'), tip = C('#b8d27a');
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + Math.random() * 0.6, r = 0.08 + Math.random() * 0.1;
      const x = Math.cos(a) * r, z = Math.sin(a) * r, h = 0.32 + Math.random() * 0.28, w = 0.05;
      const tx = x + Math.cos(a) * 0.12, tz = z + Math.sin(a) * 0.12;
      const px = -Math.sin(a) * w, pz = Math.cos(a) * w;
      pos.push(x - px, 0, z - pz, x + px, 0, z + pz, tx, h, tz);
      col.push(base.r, base.g, base.b, base.r, base.g, base.b, tip.r, tip.g, tip.b);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  })();
  const grass = new Batch('rumput', tuft, grassMat, { cast: false });
  const flowerB = new Batch('bunga', prefab([
    { t: 'cyl', rt: 0.012, h: 0.3, p: [0, 0.15, 0], c: '#4f8a35', seg: 5 },
    ...[0, 1, 2, 3, 4].map((i) => ({ t: 'sphere', r: 0.05, p: [Math.cos(i * 1.26) * 0.055, 0.31, Math.sin(i * 1.26) * 0.055], sc: [1, 0.45, 1], c: '#ffffff', seg: 5, ring: 3 })),
    { t: 'sphere', r: 0.035, p: [0, 0.33, 0], c: '#feca57', seg: 5, ring: 3 },
  ]), softMat({ vertexColors: true }), { cast: false });
  const flowerCols = ['#ff6f7d', '#ffd166', '#ffffff', '#ff9ad5', '#c9a0ff', '#ff7a3d'];
  let gN = 0, fN = 0;
  const onPath = (dir) => ROADS.some(([a, b]) => distToArc(dir, DISTRICT_DEF[a].dir, DISTRICT_DEF[b].dir) < 1.9);
  for (let n = 0; n < grassN * 3 && gN < grassN; n++) {
    const dir = V3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1);
    if (dir.lengthSq() > 1 || dir.lengthSq() < 0.01) continue;
    dir.normalize();
    const h = heightAt(dir);
    if (h < WATER + 0.4 || dir.y < -0.93 || onPath(dir)) continue;
    if (Object.values(DISTRICT_DEF).some((d) => angle(dir, d.dir) * R < d.r * 0.85)) continue;
    const pl = placeDir(dir, rand() * 6.28);
    const sc = 0.7 + rand() * 0.8;
    grass.add(mat(pl.base, pl.basis, [0, -0.02, 0], [sc, sc * (0.8 + rand() * 0.5), sc], rand() * 6.28));
    gN++;
    if (rand() < 0.12) { flowerB.add(mat(pl.base, pl.basis, [0.25, 0, 0.1], [1, 0.8 + rand() * 0.6, 1], rand() * 6), flowerCols[fN++ % flowerCols.length]); }
  }
  B.grass = grass; B.flower = flowerB;

  // ---------------------------------------------------------------- awan empuk (bayangannya lewat di atas kampung)
  const cloudGroup = new THREE.Group();
  cloudGroup.name = 'awan';
  const cloudMat = softMat({ color: '#ffffff', emissive: '#fff4e6', emissiveIntensity: 0.25, roughness: 1 }, 0.4);
  for (let i = 0; i < 12; i++) {
    const parts = [];
    const nP = 4 + Math.floor(rand() * 4);
    for (let k = 0; k < nP; k++) parts.push({ t: 'ico', r: 2 + rand() * 2.2, d: 2, p: [(k - nP / 2) * 2.4 + rand(), rand() * 1.2, (rand() - 0.5) * 2.5], sc: [1, 0.72, 1], c: '#ffffff' });
    const m = new THREE.Mesh(prefab(parts), cloudMat);
    const dir = V3(rand() * 2 - 1, rand() * 1.6 - 0.6, rand() * 2 - 1).normalize();
    const f = frameAt(dir);
    m.matrixAutoUpdate = false;
    m.matrix.makeBasis(V3().crossVectors(dir, f.north), dir, f.north).setPosition(dir.clone().multiplyScalar(R + 24 + rand() * 10));
    m.castShadow = true;
    cloudGroup.add(m);
  }
  scene.add(cloudGroup);

  // ---------------------------------------------------------------- ayam kampung & kupu-kupu (instanced, digerakkan tiap frame)
  const chickenGeo = prefab([
    { t: 'sphere', r: 0.2, p: [0, 0.3, 0], sc: [0.85, 0.85, 1.15], c: '#f4ede0' },
    { t: 'sphere', r: 0.12, p: [0, 0.5, 0.17], c: '#f4ede0' },
    { t: 'cone', r: 0.035, h: 0.08, p: [0, 0.5, 0.3], r3: [Math.PI / 2, 0, 0], c: '#f2b43a' },
    { t: 'box', s: [0.03, 0.08, 0.1], p: [0, 0.63, 0.16], c: '#e0402f' },
    { t: 'sphere', r: 0.035, p: [0, 0.43, 0.25], c: '#e0402f' },
    { t: 'sphere', r: 0.13, p: [0, 0.4, -0.22], sc: [0.5, 1, 0.8], r3: [-0.5, 0, 0], c: '#b0562e' },
    { t: 'cyl', rt: 0.015, h: 0.16, p: [0.07, 0.08, 0], c: '#f2b43a' }, { t: 'cyl', rt: 0.015, h: 0.16, p: [-0.07, 0.08, 0], c: '#f2b43a' },
    { t: 'sphere', r: 0.018, p: [0.06, 0.53, 0.25], c: '#1a1410' }, { t: 'sphere', r: 0.018, p: [-0.06, 0.53, 0.25], c: '#1a1410' },
  ]);
  const chickens = [];
  const chickenHomes = [['pelangi', 0, 13], ['seng', -3, 3], ['pasar', -5, 3], ['alun', 6, 10], ['pelangi', -1, -6], ['seng', 8, 4], ['bukit', -3, 5], ['pecinan', 0, 13]];
  for (const [dk, x, z] of chickenHomes) {
    const home = localDir(dk, x, z);
    for (let k = 0; k < 2; k++) chickens.push({ home, dir: home.clone(), target: home.clone(), heading: frameAt(home).north.clone(), state: 'walk', t: rand() * 3, peck: 0, tint: k ? '#b0562e' : null });
  }
  const chickenMesh = new THREE.InstancedMesh(chickenGeo, matVC, chickens.length);
  chickenMesh.name = 'ayam_kampung';
  chickenMesh.castShadow = true;
  chickenMesh.frustumCulled = false;
  scene.add(chickenMesh);
  const butterGeo = (() => {
    const g = prefab([
      { t: 'box', s: [0.3, 0.01, 0.22], p: [0.16, 0, 0], c: '#ffffff', sharp: true },
      { t: 'box', s: [0.3, 0.01, 0.22], p: [-0.16, 0, 0], c: '#ffffff', sharp: true },
      { t: 'capsule', r: 0.018, len: 0.14, p: [0, 0, 0], r3: [Math.PI / 2, 0, 0], c: '#3b2a20' },
    ]);
    return g;
  })();
  const butterflies = [];
  const bCols = ['#feca57', '#ff9a9e', '#48dbfb', '#ffffff', '#ff7a3d'];
  for (let i = 0; i < 18; i++) {
    const dk = Object.keys(DISTRICT_DEF)[i % 6];
    butterflies.push({ center: localDir(dk, (rand() - 0.5) * 20, (rand() - 0.5) * 20), ph: rand() * 10, sp: 0.4 + rand() * 0.4, r: 2 + rand() * 4 });
  }
  const butterMesh = new THREE.InstancedMesh(butterGeo, softMat({ vertexColors: true, side: THREE.DoubleSide }), butterflies.length);
  butterMesh.name = 'kupu_kupu';
  butterMesh.frustumCulled = false;
  butterflies.forEach((b, i) => butterMesh.setColorAt(i, C(bCols[i % bCols.length])));
  scene.add(butterMesh);

  // kunang-kunang malam hari (points, additive)
  const ffN = 160;
  const ffPos = new Float32Array(ffN * 3), ffBase = [];
  for (let i = 0; i < ffN; i++) {
    const dk = Object.keys(DISTRICT_DEF)[i % 6];
    const d = localDir(dk, (rand() - 0.5) * 34, (rand() - 0.5) * 34);
    ffBase.push({ p: surfacePoint(d, 0.6 + rand() * 1.8), ph: rand() * 20, f: frameAt(d) });
  }
  const ffGeo = new THREE.BufferGeometry();
  ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3));
  const fireflies = new THREE.Points(ffGeo, new THREE.PointsMaterial({ color: '#fff3a0', size: 0.22, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  fireflies.frustumCulled = false;
  scene.add(fireflies);

  // ---------------------------------------------------------------- planet (1 draw)
  const detail = quality === 'low' ? 30 : 44;
  let pg = new THREE.IcosahedronGeometry(1, detail);
  pg.deleteAttribute('normal'); pg.deleteAttribute('uv');
  pg = mergeVertices(pg);
  const pa = pg.attributes.position;
  const colors = new Float32Array(pa.count * 3);
  const tmp = V3();
  for (let i = 0; i < pa.count; i++) {
    tmp.fromBufferAttribute(pa, i).normalize();
    const h = heightAt(tmp);
    const c = groundColor(tmp, h, hash3(i, 7, 3));
    colors.set([c.r, c.g, c.b], i * 3);
    tmp.multiplyScalar(R + h);
    pa.setXYZ(i, tmp.x, tmp.y, tmp.z);
  }
  pg.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  pg.computeVertexNormals();
  const planet = new THREE.Mesh(pg, softMat({ vertexColors: true, roughness: 0.92 }, 0.12));
  planet.name = 'planet';
  planet.receiveShadow = true;
  scene.add(planet);

  const waterMat = new THREE.MeshStandardMaterial({ color: '#4fb0c6', roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.86 });
  waterMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = LOOK.time;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float wv = sin(position.x * 0.9 + uTime * 1.3) * 0.05 + sin(position.z * 1.1 - uTime * 1.1) * 0.05 + sin(position.y * 0.7 + uTime) * 0.03;
      transformed += normalize(position) * wv;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>
      float fr = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 2.0);
      gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.85, 0.95, 1.0), fr * 0.45);`);
  };
  const water = new THREE.Mesh(new THREE.IcosahedronGeometry(R + WATER, 24), waterMat);
  water.name = 'air';
  water.receiveShadow = true;
  scene.add(water);

  // bohlam lampu jalan
  for (const p of lampPositions) B.bulb.add(new THREE.Matrix4().setPosition(p));

  // papan nama (canvas texture)
  const signMeshes = [];
  for (const s of signs) {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 96;
    const g = cv.getContext('2d');
    g.fillStyle = s.color; g.fillRect(0, 0, 512, 96);
    g.fillStyle = s.fg || '#fef9ef';
    g.font = '700 54px "Karla", system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(s.text, 256, 52, 480);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.w * 96 / 512), new THREE.MeshLambertMaterial({ map: tex }));
    m.matrixAutoUpdate = false;
    m.matrix.makeBasis(s.basis.lx, s.basis.up, s.basis.lz).setPosition(s.pos);
    scene.add(m);
    signMeshes.push(m);
  }

  const meshes = {};
  for (const [k, b] of Object.entries({ ...B, ...P })) { const m = b.build(scene); if (m) meshes[k] = m; }
  if (meshes.bulb) { meshes.bulb.castShadow = false; }

  // warna jendela & lampion ikut jam (dipanggil dari game)
  const nightColor = C('#ffc873'), off = C('#000000');
  function setNight(k) {
    matWindow.emissive.copy(off).lerp(nightColor, k * 0.95);
    matLampion.emissive.copy(off).lerp(C('#ff3a26'), k * 0.9);
    matBulb.color.copy(C('#efe3c4')).lerp(C('#fff0b0').multiplyScalar(1.6), k);
  }

  const _cm = new THREE.Matrix4(), _q = new THREE.Quaternion(), _one = V3(1, 1, 1);
  function updateLife(t, dt, night, focus) {
    LOOK.time.value = t;
    cloudGroup.rotation.y = t * 0.004;
    // ayam: jalan pendek, berhenti, mematuk
    chickens.forEach((c, i) => {
      c.t -= dt;
      if (c.t <= 0) {
        if (c.state === 'walk') { c.state = 'peck'; c.t = 1 + rand() * 2.5; }
        else { c.state = 'walk'; c.t = 1.5 + rand() * 2.5; const f = frameAt(c.home); c.target = c.home.clone().addScaledVector(f.east, (rand() - 0.5) * 7 / R).addScaledVector(f.north, (rand() - 0.5) * 7 / R).normalize(); }
      }
      const up = c.dir;
      if (c.state === 'walk') {
        const to = c.target.clone().sub(c.dir); to.addScaledVector(up, -to.dot(up));
        if (to.length() * R > 0.2) { to.normalize(); c.heading.lerp(to, 1 - Math.exp(-5 * dt)); c.dir.addScaledVector(c.heading, (0.8 * dt) / R).normalize(); }
      }
      c.heading.addScaledVector(c.dir, -c.heading.dot(c.dir)).normalize();
      const lx = V3().crossVectors(c.dir, c.heading).normalize();
      const pos = surfacePoint(c.dir, c.state === 'walk' ? Math.abs(Math.sin(t * 14 + i)) * 0.04 : 0);
      const pitch = c.state === 'peck' ? Math.max(0, Math.sin(t * 9 + i)) * 0.7 : 0;
      _cm.makeBasis(lx, c.dir, c.heading).multiply(new THREE.Matrix4().makeRotationX(pitch)).setPosition(pos);
      chickenMesh.setMatrixAt(i, _cm);
    });
    chickenMesh.instanceMatrix.needsUpdate = true;
    // kupu-kupu: siang saja, terbang melingkar & mengepak
    butterflies.forEach((b, i) => {
      const f = frameAt(b.center);
      const a = t * b.sp + b.ph;
      const d = b.center.clone().addScaledVector(f.east, (Math.cos(a) * b.r) / R).addScaledVector(f.north, (Math.sin(a * 1.3) * b.r) / R).normalize();
      const p = surfacePoint(d, night > 0.5 ? -5 : 1.1 + Math.sin(a * 3) * 0.4);
      const head = f.east.clone().multiplyScalar(-Math.sin(a)).addScaledVector(f.north, Math.cos(a * 1.3) * 1.3).normalize();
      const flap = 0.25 + Math.abs(Math.sin(t * 16 + i)) * 0.85;
      _cm.makeBasis(V3().crossVectors(d, head).normalize(), d, head).scale(V3(flap, 1, 1)).setPosition(p);
      butterMesh.setMatrixAt(i, _cm);
    });
    butterMesh.instanceMatrix.needsUpdate = true;
    // kunang-kunang
    fireflies.material.opacity = night * 0.95;
    if (night > 0.02) {
      ffBase.forEach((b, i) => {
        const k = t * 0.6 + b.ph;
        ffPos[i * 3] = b.p.x + b.f.east.x * Math.sin(k) * 0.8 + b.f.north.x * Math.cos(k * 0.7) * 0.8 + b.f.up.x * Math.sin(k * 1.3) * 0.3;
        ffPos[i * 3 + 1] = b.p.y + b.f.east.y * Math.sin(k) * 0.8 + b.f.north.y * Math.cos(k * 0.7) * 0.8 + b.f.up.y * Math.sin(k * 1.3) * 0.3;
        ffPos[i * 3 + 2] = b.p.z + b.f.east.z * Math.sin(k) * 0.8 + b.f.north.z * Math.cos(k * 0.7) * 0.8 + b.f.up.z * Math.sin(k * 1.3) * 0.3;
      });
      ffGeo.attributes.position.needsUpdate = true;
      fireflies.material.size = 0.16 + Math.sin(t * 3) * 0.05;
    }
    updateBoats(t);
  }
  function updateBoats(t) {
    const pm = meshes.perahu;
    if (!pm) return;
    for (const b of boats) {
      pm.setMatrixAt(b.index, mat(b.base.base, b.base.basis, [0, b.lift + Math.sin(t * 1.3 + b.phase) * 0.06, 0], [1, 1, 1], b.r, 0, Math.sin(t * 0.9 + b.phase) * 0.035));
    }
    pm.instanceMatrix.needsUpdate = true;
  }

  return {
    colliders, spots, houses, meshes, planet, water, lampPositions, setNight, updateBoats, updateLife, clouds: cloudGroup,
    stats: { trees, palms, bushes, rice, grass: gN, flowers: fN, chickens: chickens.length, houses: houses.length, colliders: colliders.length },
  };
}

const extraCables = [];
const boats = [];

function towerPrefab() {
  const parts = [];
  const base = 1.5, top = 0.35, H = 11.5;
  const legs = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  const at = (sx, sz, t) => [sx * THREE.MathUtils.lerp(base, top, t), H * t, sz * THREE.MathUtils.lerp(base, top, t)];
  const beam = (a, b, th, c) => {
    const va = V3(...a), vb = V3(...b);
    const mid = va.clone().add(vb).multiplyScalar(0.5);
    const len = va.distanceTo(vb);
    const dir = vb.clone().sub(va).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), dir);
    const e = new THREE.Euler().setFromQuaternion(q);
    parts.push({ t: 'box', s: [th, len, th], p: [mid.x, mid.y, mid.z], r3: [e.x, e.y, e.z], c, sharp: true });
  };
  const bands = 6;
  for (let k = 0; k < bands; k++) {
    const t0 = k / bands, t1 = (k + 1) / bands;
    const col = k % 2 ? '#fef9ef' : '#d9483b';
    for (let i = 0; i < 4; i++) {
      const [sx, sz] = legs[i], [nx, nz] = legs[(i + 1) % 4];
      beam(at(sx, sz, t0), at(sx, sz, t1), 0.16, col);
      beam(at(sx, sz, t1), at(nx, nz, t1), 0.07, '#fef9ef');
      beam(at(sx, sz, t0), at(nx, nz, t1), 0.05, '#fef9ef');
    }
  }
  parts.push({ t: 'box', s: [3.6, 0.3, 3.6], p: [0, 0.15, 0], c: '#d8c8ae' });
  parts.push({ t: 'box', s: [1.0, 0.15, 1.0], p: [0, H + 0.05, 0], c: '#d9483b' });
  parts.push({ t: 'cyl', rt: 0.04, rb: 0.07, h: 1.4, p: [0, H + 0.8, 0], c: '#fef9ef', seg: 5 });
  parts.push({ t: 'sphere', r: 0.4, seg: 8, ring: 4, theta: 1.0, p: [0.35, H - 2, 0], r3: [0, 0, -1.3], c: '#d8d8d2' });
  return prefab(parts);
}
