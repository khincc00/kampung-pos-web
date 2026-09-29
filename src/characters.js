// Karakter bergaya animasi 3D lembut: kepala besar, mata berkilau, kedip, squash & stretch,
// antisipasi lompat, kepala menoleh, melambai, tas surat memantul, selebrasi.
import * as THREE from 'three';
import { prefab, softMat } from './world.js';

const charMat = softMat({ vertexColors: true, roughness: 0.62 }, 0.32);
const ghostMat = softMat({ vertexColors: true, roughness: 0.62, transparent: true, opacity: 0.45, depthWrite: false }, 0.5);
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

const geoCache = new Map();
// versi hemat: bola dikurangi segmennya (untuk warga latar yang jauh dari kamera)
const thin = (parts, k = 0.55) => parts.map((p) => (p.t === 'sphere' ? { ...p, seg: Math.max(6, Math.round((p.seg ?? 14) * k)), ring: Math.max(4, Math.round((p.ring ?? 9) * k)) } : p));
function cached(key, make) { let g = geoCache.get(key); if (!g) { g = make(); geoCache.set(key, g); } return g; }

function headParts(look) {
  const skin = look.skin || '#c68b5e';
  const hair = look.headColor || '#2b1d16';
  const brow = look.head === 'uban' ? '#cfcac0' : look.head === 'kerudung' ? '#3a2618' : hair;
  const eyeZ = look.head === 'kerudung' ? 0.268 : 0.245;
  const P = [];
  if (look.head === 'kerudung') {
    P.push({ t: 'sphere', r: 0.33, seg: 22, ring: 16, p: [0, 0.01, -0.02], c: hair });
    P.push({ t: 'cyl', rt: 0.3, rb: 0.4, h: 0.26, p: [0, -0.3, -0.02], c: hair });
    P.push({ t: 'sphere', r: 0.235, p: [0, -0.03, 0.12], sc: [1, 1.12, 0.92], c: skin });
  } else {
    P.push({ t: 'sphere', r: 0.3, seg: 22, ring: 16, p: [0, 0, 0], sc: [1, 0.96, 0.96], c: skin });
    P.push({ t: 'sphere', r: 0.07, p: [0.29, -0.01, 0], sc: [0.55, 1, 0.9], c: skin }, { t: 'sphere', r: 0.07, p: [-0.29, -0.01, 0], sc: [0.55, 1, 0.9], c: skin });
  }
  // wajah
  P.push({ t: 'sphere', r: 0.045, p: [0, -0.045, 0.3], sc: [1, 0.85, 1], c: new THREE.Color(skin).multiplyScalar(0.93).getStyle() });
  const es = look.eyes === 'sipit' ? 0.62 : look.eyes === 'besar' ? 1.12 : 1;   // ukuran mata (sipit / besar)
  for (const sx of [-1, 1]) {
    P.push({ t: 'sphere', r: 0.06, p: [sx * 0.16, -0.08, eyeZ - 0.01], sc: [1, 0.6, 0.4], c: look.blush || '#f08a7a' });
    P.push({ t: 'sphere', r: 0.09, seg: 14, ring: 10, p: [sx * 0.105, 0.03, eyeZ], sc: [0.9, es * 1.15, 0.55], c: '#fbfbf5' });
    P.push({ t: 'sphere', r: 0.06, seg: 12, ring: 9, p: [sx * 0.105, 0.02, eyeZ + 0.033], sc: [1, 1.15, 0.5], c: '#5a331c' });
    P.push({ t: 'sphere', r: 0.032, p: [sx * 0.105, 0.02, eyeZ + 0.052], sc: [1, 1.1, 0.5], c: '#0d0806' });
    P.push({ t: 'sphere', r: 0.019, p: [sx * 0.105 + 0.022, 0.055, eyeZ + 0.06], c: '#ffffff', seg: 8, ring: 6 }, { t: 'sphere', r: 0.009, p: [sx * 0.105 - 0.018, -0.005, eyeZ + 0.06], c: '#ffffff', seg: 6, ring: 4 });
    P.push({ t: 'capsule', r: look.brow === 'tebal' ? 0.024 : 0.015, len: 0.075, p: [sx * 0.105, 0.15, eyeZ + 0.02], r3: [0, 0, Math.PI / 2 - sx * 0.18], c: brow });
    if (look.lash) P.push({ t: 'capsule', r: 0.008, len: 0.05, p: [sx * 0.16, 0.05 + 0.02 * es, eyeZ + 0.05], r3: [0, 0, Math.PI / 2 - sx * 0.6], c: '#1a1210' });
  }
  const face = look.face || [];
  if (face.includes('kumis')) P.push({ t: 'capsule', r: 0.026, len: 0.11, p: [0, -0.093, eyeZ + 0.04], r3: [0, 0, Math.PI / 2], c: look.beardColor || brow });
  if (face.includes('jenggot')) P.push({ t: 'sphere', r: 0.2, theta: 1.9, p: [0, -0.08, 0.05], r3: [Math.PI, 0, 0], sc: [1, 0.85, 0.95], c: look.beardColor || brow });
  if (face.includes('cambang')) for (const sx of [-1, 1]) P.push({ t: 'capsule', r: 0.03, len: 0.14, p: [sx * 0.27, -0.03, 0.08], c: look.beardColor || brow });
  if (face.includes('kacamata')) {
    for (const sx of [-1, 1]) P.push({ t: 'cyl', rt: 0.088, h: 0.02, p: [sx * 0.105, 0.03, eyeZ + 0.07], r3: [Math.PI / 2, 0, 0], seg: 12, c: look.frame || '#2b1d16' },
      { t: 'cyl', rt: 0.07, h: 0.024, p: [sx * 0.105, 0.03, eyeZ + 0.072], r3: [Math.PI / 2, 0, 0], seg: 12, c: '#dff0f5' });
    P.push({ t: 'box', s: [0.06, 0.015, 0.015], p: [0, 0.05, eyeZ + 0.07], sharp: true, c: look.frame || '#2b1d16' });
  }
  if (face.includes('anting')) for (const sx of [-1, 1]) P.push({ t: 'sphere', r: 0.025, p: [sx * 0.3, -0.1, 0], c: '#feca57', seg: 6, ring: 4 });
  if (face.includes('tahilalat')) P.push({ t: 'sphere', r: 0.012, p: [0.1, -0.1, eyeZ + 0.03], c: '#3a2618', seg: 5, ring: 4 });
  if (face.includes('ingus')) P.push({ t: 'capsule', r: 0.012, len: 0.05, p: [0.03, -0.075, eyeZ + 0.05], c: '#cfe9f0' });
  P.push({ t: 'capsule', r: 0.012, len: 0.05, p: [0, -0.125, eyeZ + 0.02], r3: [0, 0, Math.PI / 2], c: '#6a2f28' });
  // rambut / tutup kepala
  switch (look.head) {
    case 'peci': P.push({ t: 'cyl', rt: 0.235, rb: 0.25, h: 0.15, p: [0, 0.24, -0.01], c: '#23201e' }, { t: 'sphere', r: 0.305, theta: 1.15, p: [0, 0.0, -0.03], c: '#2b1d16' }); break;
    case 'topi': P.push({ t: 'sphere', r: 0.315, theta: 1.3, p: [0, 0.02, -0.01], c: hair }, { t: 'box', s: [0.34, 0.035, 0.2], p: [0, 0.12, 0.3], r3: [-0.2, 0, 0], c: hair }); break;
    case 'caping': P.push({ t: 'cone', r: 0.62, h: 0.32, p: [0, 0.34, 0], c: '#d8b56a' }, { t: 'sphere', r: 0.3, theta: 1.1, p: [0, 0.0, -0.02], c: '#2b1d16' }); break;
    case 'uban': P.push({ t: 'sphere', r: 0.305, theta: 1.25, p: [0, 0.02, -0.03], c: '#d9d6cf' }, { t: 'capsule', r: 0.022, len: 0.1, p: [0, -0.095, eyeZ + 0.04], r3: [0, 0, Math.PI / 2], c: '#d9d6cf' }); break;
    case 'kerudung': break;
    case 'botak': P.push({ t: 'sphere', r: 0.3, theta: 0.7, p: [0, 0.02, -0.01], c: skin }, { t: 'capsule', r: 0.03, len: 0.3, p: [0.29, 0.02, -0.07], r3: [0, 0, 0.1], c: hair }, { t: 'capsule', r: 0.03, len: 0.3, p: [-0.29, 0.02, -0.07], r3: [0, 0, -0.1], c: hair }); break;
    case 'cepak': P.push({ t: 'sphere', r: 0.305, theta: 1.05, p: [0, 0.02, -0.02], c: hair }); break;
    case 'poni': P.push({ t: 'sphere', r: 0.315, theta: 1.4, p: [0, 0.02, -0.02], c: hair }, { t: 'sphere', r: 0.27, p: [0, -0.06, -0.14], sc: [1.1, 1, 0.85], c: hair }, { t: 'box', s: [0.4, 0.1, 0.1], p: [0, 0.2, 0.22], r3: [0.5, 0, 0], c: hair }); break;
    case 'kuncir': P.push({ t: 'sphere', r: 0.315, theta: 1.35, p: [0, 0.02, -0.02], c: hair }, { t: 'sphere', r: 0.26, p: [0, -0.05, -0.12], sc: [1.1, 1, 0.85], c: hair }, { t: 'capsule', r: 0.06, len: 0.32, p: [0, 0.02, -0.4], r3: [-0.5, 0, 0], c: hair }, { t: 'sphere', r: 0.05, p: [0, 0.2, -0.34], c: look.pita || '#d9483b', seg: 6, ring: 4 }); break;
    case 'kepang': P.push({ t: 'sphere', r: 0.315, theta: 1.4, p: [0, 0.02, -0.02], c: hair }, { t: 'sphere', r: 0.26, p: [0, -0.05, -0.12], sc: [1.1, 1, 0.85], c: hair });
      for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) P.push({ t: 'sphere', r: 0.065 - k * 0.006, p: [sx * (0.27 + k * 0.02), -0.12 - k * 0.11, 0.0], c: k === 3 ? (look.pita || '#ff9a9e') : hair, seg: 8, ring: 6 }); break;
    case 'keriting': P.push({ t: 'sphere', r: 0.33, seg: 14, ring: 10, p: [0, 0.07, -0.05], sc: [1.1, 1, 1], c: hair });
      for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2; P.push({ t: 'sphere', r: 0.11, seg: 8, ring: 6, p: [Math.cos(a) * 0.3, 0.2 + Math.sin(k * 2.1) * 0.06, Math.sin(a) * 0.28 - 0.05], c: hair }); } break;
    case 'panjang': P.push({ t: 'sphere', r: 0.315, theta: 1.4, p: [0, 0.02, -0.02], c: hair }, { t: 'sphere', r: 0.29, p: [0, -0.05, -0.1], sc: [1.1, 1.1, 0.9], c: hair }, { t: 'capsule', r: 0.2, len: 0.35, p: [0, -0.3, -0.16], sc: [1.1, 1, 0.55], c: hair }); break;
    case 'jambul': P.push({ t: 'sphere', r: 0.315, theta: 1.3, p: [0, 0.02, -0.02], c: hair }, { t: 'sphere', r: 0.16, p: [0, 0.26, 0.1], sc: [1, 0.8, 1.3], c: hair }); break;
    case 'sanggul': P.push({ t: 'sphere', r: 0.315, theta: 1.35, p: [0, 0.02, -0.02], c: hair }, { t: 'sphere', r: 0.26, p: [0, -0.05, -0.12], sc: [1.1, 1, 0.9], c: hair }, { t: 'sphere', r: 0.16, p: [0, 0.12, -0.3], c: hair }, { t: 'box', s: [0.14, 0.03, 0.03], p: [0, 0.14, -0.4], r3: [0, 0, 0.4], c: look.pita || '#feca57' }); break;
    case 'blangkon': P.push({ t: 'sphere', r: 0.3, theta: 1.1, p: [0, 0.02, -0.02], c: '#6b4a2b' }, { t: 'cyl', rt: 0.27, rb: 0.3, h: 0.1, p: [0, 0.16, -0.01], c: '#3b2a20' }, { t: 'sphere', r: 0.09, p: [0, 0.1, -0.3], sc: [1, 0.8, 0.8], c: '#3b2a20' }); break;
    case 'kopiah': P.push({ t: 'cyl', rt: 0.235, rb: 0.25, h: 0.15, p: [0, 0.24, -0.01], c: '#fefcf5' }, { t: 'sphere', r: 0.305, theta: 1.15, p: [0, 0.0, -0.03], c: hair }); break;
    case 'jerami': P.push({ t: 'cone', r: 0.6, h: 0.14, p: [0, 0.25, 0], c: '#e7cf8b' }, { t: 'cyl', rt: 0.22, rb: 0.26, h: 0.16, p: [0, 0.33, 0], c: '#e7cf8b' }, { t: 'cyl', rt: 0.265, rb: 0.265, h: 0.04, p: [0, 0.29, 0], c: look.pita || '#d9483b' }, { t: 'sphere', r: 0.3, theta: 1.1, p: [0, 0.0, -0.02], c: hair }); break;
    case 'helm': P.push({ t: 'sphere', r: 0.36, seg: 16, ring: 10, theta: 1.75, p: [0, 0.03, -0.02], c: look.helm || '#d9483b' }, { t: 'box', s: [0.3, 0.03, 0.14], p: [0, 0.17, 0.32], r3: [-0.25, 0, 0], c: '#2b1d16' }); break;
    case 'bandana': P.push({ t: 'sphere', r: 0.315, theta: 1.3, p: [0, 0.02, -0.02], c: hair }, { t: 'cyl', rt: 0.31, rb: 0.31, h: 0.09, p: [0, 0.12, -0.01], c: look.pita || '#d9483b' }, { t: 'box', s: [0.1, 0.1, 0.03], p: [0.12, 0.1, -0.3], r3: [0, 0, 0.5], c: look.pita || '#d9483b' }); break;
    case 'kepala_pramuka': P.push({ t: 'sphere', r: 0.315, theta: 1.35, p: [0, 0.02, -0.02], c: hair }, { t: 'box', s: [0.32, 0.03, 0.06], p: [0, 0.19, 0.25], r3: [-0.6, 0, 0], c: '#8b5a2b' }); break;
    case 'pos': // topi kurir
      P.push({ t: 'sphere', r: 0.318, theta: 1.28, p: [0, 0.02, -0.01], c: '#ff7a3d' });
      P.push({ t: 'box', s: [0.36, 0.035, 0.22], p: [0, 0.13, 0.31], r3: [-0.18, 0, 0], c: '#c45a2c' });
      P.push({ t: 'box', s: [0.1, 0.07, 0.02], p: [0, 0.22, 0.28], r3: [-0.5, 0, 0], c: '#fef9ef' });
      P.push({ t: 'sphere', r: 0.3, theta: 1.0, p: [0, -0.02, -0.05], c: '#2b1d16' });
      break;
    default:
      P.push({ t: 'sphere', r: 0.315, theta: 1.35, p: [0, 0.02, -0.02], c: hair }, { t: 'sphere', r: 0.26, p: [0, -0.05, -0.12], sc: [1.15, 1, 0.9], c: hair });
      if (look.bun) P.push({ t: 'sphere', r: 0.11, p: [0, 0.2, -0.26], c: hair });
  }
  return P;
}

// benda di tangan kanan (bagian dari geometri lengan, ujungnya di tangan y = -0.33)
function holdParts(h) {
  switch (h) {
    case 'tongkat': return [{ t: 'capsule', r: 0.017, len: 0.6, p: [0.02, -0.5, 0.05], c: '#6b4a2b' }, { t: 'sphere', r: 0.03, p: [0.02, -0.16, 0.05], c: '#6b4a2b', seg: 6, ring: 4 }];
    case 'sapu': return [{ t: 'capsule', r: 0.015, len: 1.0, p: [0.02, -0.55, 0.06], r3: [0.15, 0, 0], c: '#8b5a2b' }, { t: 'cone', r: 0.13, h: 0.3, p: [0.02, -1.1, 0.13], r3: [0.15, 0, 0], c: '#c9a24a', seg: 8 }];
    case 'sendok': return [{ t: 'capsule', r: 0.015, len: 0.5, p: [0.02, -0.5, 0.1], r3: [0.9, 0, 0], c: '#8b5a2b' }, { t: 'sphere', r: 0.07, p: [0.02, -0.7, 0.3], sc: [1, 0.5, 1], c: '#9a9a92', seg: 8, ring: 5 }];
    case 'keranjang': return [{ t: 'cyl', rt: 0.17, rb: 0.12, h: 0.18, p: [0.1, -0.42, 0.06], c: '#c9a24a', seg: 9 }, { t: 'sphere', r: 0.08, p: [0.1, -0.35, 0.06], c: '#6aa84f', seg: 6, ring: 4 }, { t: 'sphere', r: 0.06, p: [0.15, -0.36, 0.08], c: '#ff7a3d', seg: 6, ring: 4 }];
    case 'kipas': return [{ t: 'cyl', rt: 0.13, h: 0.015, p: [0.02, -0.42, 0.1], r3: [Math.PI / 2, 0, 0], c: '#d9483b', seg: 8 }];
    case 'kuas': return [{ t: 'capsule', r: 0.012, len: 0.3, p: [0.02, -0.4, 0.06], r3: [0.5, 0, 0], c: '#8b5a2b' }, { t: 'box', s: [0.06, 0.09, 0.03], p: [0.02, -0.58, 0.14], r3: [0.5, 0, 0], c: '#48dbfb' }];
    case 'meteran': return [{ t: 'box', s: [0.03, 0.4, 0.008], p: [0.04, -0.5, 0.05], c: '#feca57' }];
    case 'buku': return [{ t: 'box', s: [0.16, 0.2, 0.03], p: [0.04, -0.4, 0.09], r3: [0.8, 0, 0], c: '#3f8f8a' }];
    case 'radio': return [{ t: 'box', s: [0.2, 0.13, 0.08], p: [0.05, -0.42, 0.07], c: '#3b302b' }, { t: 'box', s: [0.02, 0.2, 0.02], p: [0.1, -0.3, 0.07], r3: [0, 0, 0.3], c: '#cfcfcf' }];
    case 'payung': return [{ t: 'capsule', r: 0.012, len: 0.7, p: [0.02, -0.5, 0.05], c: '#4a3b33' }, { t: 'sphere', r: 0.4, seg: 10, ring: 5, theta: 1.1, p: [0.02, -0.15, 0.05], c: '#d9483b' }];
    case 'layangan': return [{ t: 'capsule', r: 0.008, len: 0.4, p: [0.02, -0.5, 0.05], c: '#cfcfcf' }];
    case 'jaring': return [{ t: 'capsule', r: 0.012, len: 1.0, p: [0.02, -0.55, 0.06], r3: [0.2, 0, 0], c: '#8b5a2b' }, { t: 'cyl', rt: 0.16, h: 0.02, p: [0.02, -1.15, 0.2], r3: [0.2, 0, 0], c: '#bfe3ea', seg: 10 }];
    case 'pancing': return [{ t: 'capsule', r: 0.01, len: 1.5, p: [0.02, -0.7, 0.4], r3: [1.1, 0, 0], c: '#8b5a2b' }];
    case 'gayung': return [{ t: 'cyl', rt: 0.09, rb: 0.07, h: 0.11, p: [0.02, -0.42, 0.06], c: '#48a6c9', seg: 8 }];
    case 'goni': return [{ t: 'box', s: [0.3, 0.42, 0.25], p: [0.0, -0.45, -0.1], c: '#c9a24a' }];
    default: return [];
  }
}

export class Character {
  constructor(look, { player = false, courier = false, ghost = false, lod = 0 } = {}) {
    if (lod) look = { ...look, lod };       // lod: 0 = penuh, 0.8 = ringan, 0.55 = hemat
    this.look = look;
    const mat = ghost ? ghostMat : charMat;
    this.root = new THREE.Group();
    this.root.matrixAutoUpdate = false;
    this.rig = new THREE.Group();
    this.root.add(this.rig);
    const skin = look.skin || '#c68b5e', shirt = look.shirt, pants = look.pants || '#3b302b';
    const outfit = look.outfit || 'kaos', acc = look.accent || '#fef9ef';
    const skirt = ['daster', 'kebaya', 'sarung', 'rok'].includes(outfit);
    const body = [
      { t: 'capsule', r: 0.2, len: 0.08, p: [0, 0.45, 0], sc: [1.05, 0.8, 0.85], c: skirt ? shirt : pants },
      { t: 'capsule', r: 0.22, len: 0.2, p: [0, 0.66, 0], sc: [1, 1, 0.82], c: shirt },
      { t: 'cyl', rt: 0.075, h: 0.12, p: [0, 0.86, 0], c: skin },
    ];
    if (outfit === 'batik') for (const [x, y] of [[0, 0.72], [-0.1, 0.62], [0.1, 0.62], [0, 0.52], [-0.14, 0.75], [0.14, 0.75]]) body.push({ t: 'box', s: [0.06, 0.06, 0.02], sharp: true, p: [x, y, 0.185], r3: [0, 0, Math.PI / 4], c: acc });
    if (outfit === 'garis') for (const y of [0.55, 0.62, 0.69, 0.76]) body.push({ t: 'cyl', rt: 0.228, h: 0.03, p: [0, y, 0], sc: [1, 1, 0.83], seg: 14, c: acc });
    if (outfit === 'apron') body.push({ t: 'box', s: [0.32, 0.36, 0.03], p: [0, 0.56, 0.185], c: acc }, { t: 'box', s: [0.05, 0.3, 0.02], p: [0.09, 0.78, 0.17], r3: [0, 0, -0.2], c: acc }, { t: 'box', s: [0.05, 0.3, 0.02], p: [-0.09, 0.78, 0.17], r3: [0, 0, 0.2], c: acc });
    if (outfit === 'rompi') body.push({ t: 'box', s: [0.14, 0.4, 0.05], p: [0.115, 0.63, 0.17], r3: [0, 0.15, 0], c: acc }, { t: 'box', s: [0.14, 0.4, 0.05], p: [-0.115, 0.63, 0.17], r3: [0, -0.15, 0], c: acc });
    if (outfit === 'jaket') body.push({ t: 'sphere', r: 0.13, p: [0, 0.83, -0.12], sc: [1.3, 0.8, 0.8], c: shirt }, { t: 'box', s: [0.04, 0.4, 0.03], p: [0, 0.62, 0.19], c: acc });
    if (outfit === 'seragam') body.push({ t: 'box', s: [0.05, 0.16, 0.02], p: [0, 0.74, 0.185], c: '#d9483b' }, { t: 'box', s: [0.14, 0.05, 0.02], p: [0.06, 0.8, 0.18], r3: [0, 0, -0.4], c: '#d9483b' }, { t: 'box', s: [0.14, 0.05, 0.02], p: [-0.06, 0.8, 0.18], r3: [0, 0, 0.4], c: '#d9483b' });
    if (outfit === 'kebaya') body.push({ t: 'box', s: [0.05, 0.42, 0.02], p: [0, 0.63, 0.187], c: acc }, { t: 'cyl', rt: 0.23, h: 0.05, p: [0, 0.5, 0], sc: [1, 1, 0.83], seg: 14, c: acc });
    if (look.scarf) body.push({ t: 'cyl', rt: 0.1, h: 0.07, p: [0, 0.83, 0], seg: 10, c: look.scarf }, { t: 'box', s: [0.06, 0.22, 0.02], p: [0.04, 0.72, 0.16], c: look.scarf });
    if (skirt) body.push({ t: 'cyl', rt: 0.21, rb: outfit === 'rok' ? 0.31 : 0.33, h: 0.5, p: [0, 0.3, 0], sc: [1, 1, 0.9], seg: 14, c: outfit === 'sarung' ? acc : pants });
    if (!player) {
      for (const sx of [-1, 1]) {
        if (!skirt) body.push({ t: 'capsule', r: 0.085, len: 0.2, p: [sx * 0.1, 0.24, 0], c: outfit === 'seragam' ? '#d9483b' : pants });
        else body.push({ t: 'capsule', r: 0.07, len: 0.12, p: [sx * 0.1, 0.16, 0], c: skin });
        body.push({ t: 'box', s: [0.16, 0.09, 0.25], p: [sx * 0.1, 0.045, 0.03], c: look.shoes || '#3b302b' });
      }
      body.push({ t: 'capsule', r: 0.065, len: 0.24, p: [-0.29, 0.64, 0], r3: [0, 0, 0.12], c: shirt }, { t: 'sphere', r: 0.066, p: [-0.31, 0.46, 0], c: skin });
    }
    if (courier) body.push(
      { t: 'box', s: [0.06, 0.62, 0.04], p: [0, 0.7, 0.12], r3: [0, 0, 0.75], c: '#6b4a2b' },
      { t: 'box', s: [0.1, 0.08, 0.02], p: [0.1, 0.72, 0.18], c: '#fef9ef' });
    const lk = JSON.stringify(look);
    this.body = new THREE.Mesh(cached('b' + player + courier + lk, () => prefab(look.lod ? thin(body, look.lod) : body)), mat);
    this.body.castShadow = true;
    this.rig.add(this.body);
    this.head = new THREE.Group();
    this.head.position.set(0, 1.0, 0);
    this.rig.add(this.head);
    const hm = new THREE.Mesh(cached('h' + lk, () => prefab(look.lod ? thin(headParts(look), look.lod) : headParts(look))), mat);
    hm.castShadow = true;
    this.head.add(hm);
    // kelopak mata (2 kubah dalam satu mesh, berputar di sumbu mata)
    const eyeZ = look.head === 'kerudung' ? 0.268 : 0.245;
    this.lids = new THREE.Mesh(cached('l' + lk, () => prefab([-1, 1].map((sx) => ({ t: 'sphere', r: 0.096, seg: 14, ring: 6, theta: Math.PI / 2, p: [sx * 0.105, 0, 0], sc: [0.95, (look.eyes === 'sipit' ? 0.62 : look.eyes === 'besar' ? 1.12 : 1) * 1.15, 0.62], c: skin })))), mat);
    this.lids.position.set(0, 0.03, eyeZ);
    this.head.add(this.lids);
    // lengan
    const arm = cached('a' + lk, () => prefab([{ t: 'capsule', r: 0.065, len: 0.22, p: [0, -0.16, 0], c: shirt }, { t: 'sphere', r: 0.067, p: [0, -0.33, 0], c: skin }, ...holdParts(look.hold)]));
    this.armR = new THREE.Group(); this.armR.position.set(0.27, 0.8, 0);
    const ar = new THREE.Mesh(arm, mat); ar.castShadow = true; this.armR.add(ar); this.rig.add(this.armR);
    if (player) {
      this.armL = new THREE.Group(); this.armL.position.set(-0.27, 0.8, 0);
      const al = new THREE.Mesh(arm, mat); al.castShadow = true; this.armL.add(al); this.rig.add(this.armL);
      const leg = prefab([{ t: 'capsule', r: 0.085, len: 0.18, p: [0, -0.17, 0], c: pants }, { t: 'box', s: [0.16, 0.09, 0.25], p: [0, -0.37, 0.03], c: '#3b302b' }]);
      this.legs = [-1, 1].map((sx) => { const g = new THREE.Group(); g.position.set(sx * 0.1, 0.42, 0); const m = new THREE.Mesh(leg, mat); m.castShadow = true; g.add(m); this.rig.add(g); return g; });
    }
    if (courier) {
      this.bag = new THREE.Group(); this.bag.position.set(0.2, 0.86, -0.02);
      const bm = new THREE.Mesh(prefab([
        { t: 'box', s: [0.32, 0.28, 0.14], p: [0.06, -0.28, -0.16], c: '#8b5a2b' },
        { t: 'box', s: [0.33, 0.12, 0.15], p: [0.06, -0.18, -0.16], c: '#6b4a2b' },
        { t: 'box', s: [0.16, 0.1, 0.02], p: [0.06, -0.22, -0.08], c: '#fef9ef' },
        { t: 'box', s: [0.05, 0.03, 0.02], p: [0.06, -0.24, -0.07], c: '#d9483b' },
      ]), mat);
      bm.castShadow = true; this.bag.add(bm); this.rig.add(this.bag);
    }
    this.scale = (look.kid ? 0.78 : 1) * (look.s || 1);
    this.girth = look.w || 1;
    this.pop = 1;                                       // 0..1: muncul/menghilang (jadwal warga)
    this.stoop = look.stoop || 0;                       // bungkuk (nenek/kakek)
    this.activity = look.act || null;                   // 'sapu' | 'aduk' | 'jahit' | 'kipas' | 'cat' | ...
    this.rig.scale.set(this.scale * this.girth, this.scale, this.scale * this.girth);
    // status animasi
    this.t = Math.random() * 10;
    this.blinkT = 1 + Math.random() * 3; this.blink = 0;
    this.sq = 0; this.sqV = 0;          // squash-stretch pegas
    this.walk = 0; this.headYaw = 0; this.headPitch = 0;
    this.wave = 0; this.celebrate = 0; this.talk = 0; this.bagSwing = 0; this.bagV = 0; this.lean = 0;
  }

  /** matikan bayangan untuk karakter jauh (hemat pass bayangan) */
  setShadow(on) { if (this._sh === on) return; this._sh = on; this.root.traverse((o) => { if (o.isMesh) o.castShadow = on; }); }
  land(power = 1) { this.sqV -= 3.5 * power; }
  hop() { this.sqV += 2.5; }
  startWave() { this.wave = 1.4; }
  startCelebrate() { this.celebrate = 1.3; this.sqV += 2; }

  /** s: { speed (m/s), grounded, vUp, prep (0..1 antisipasi), look: Vector3 dunia | null, talking } */
  update(dt, s = {}) {
    this.t += dt;
    const sp = Math.min(1, (s.speed || 0) / 4.3);
    // pegas squash & stretch
    const target = s.prep ? -0.18 * s.prep : !s.grounded && s.vUp != null ? THREE.MathUtils.clamp(s.vUp * 0.018, -0.06, 0.12) : 0;
    this.sqV += ((target - this.sq) * 140 - this.sqV * 11) * dt;
    this.sq += this.sqV * dt;
    const breathe = Math.sin(this.t * 2.2) * 0.012 * (1 - sp);
    const sy = 1 + this.sq + breathe, sxz = 1 - this.sq * 0.55;
    this.rig.scale.set(sxz * this.scale * this.girth * this.pop, sy * this.scale * this.pop, sxz * this.scale * this.girth * this.pop);
    // jalan: ayun, bob, condong
    if (s.grounded !== false && sp > 0.05) this.walk += dt * (6 + sp * 7);
    const sw = Math.sin(this.walk) * sp;
    this.rig.position.y = s.grounded === false ? 0 : Math.abs(Math.sin(this.walk)) * 0.06 * sp;
    this.lean = damp(this.lean, sp * 0.16 + this.stoop, 8, dt);
    this.rig.rotation.x = this.lean;
    this.rig.rotation.z = Math.sin(this.walk) * 0.04 * sp;
    if (this.legs) {
      const air = s.grounded === false;
      this.legs[0].rotation.x = air ? -0.5 : sw * 0.8;
      this.legs[1].rotation.x = air ? 0.35 : -sw * 0.8;
    }
    // lengan
    let rArm = -sw * 0.7 * (this.legs ? 1 : 0.3), rZ = 0.08;
    if (s.grounded === false && this.legs) { rArm = -2.4; rZ = 0.5; }
    if (this.wave > 0) { this.wave -= dt; rArm = -2.6; rZ = 0.35 + Math.sin(this.t * 14) * 0.35; }
    if (this.celebrate > 0) { this.celebrate -= dt; rArm = -2.9; rZ = 0.5; }
    if (this.activity && sp < 0.05 && this.wave <= 0 && this.celebrate <= 0 && !s.talking) {
      const a = this.t, k = this.activity;
      if (k === 'aduk') { rArm = -1.0 + Math.sin(a * 5) * 0.25; rZ = 0.35 + Math.cos(a * 5) * 0.25; }
      else if (k === 'sapu') { rArm = -0.9 + Math.sin(a * 3.2) * 0.35; rZ = 0.1 + Math.sin(a * 3.2) * 0.3; }
      else if (k === 'jahit') { rArm = -1.1 + Math.sin(a * 7) * 0.12; rZ = 0.2; }
      else if (k === 'kipas') { rArm = -1.3; rZ = 0.4 + Math.sin(a * 9) * 0.3; }
      else if (k === 'cat') { rArm = -1.4 + Math.sin(a * 2.2) * 0.4; rZ = 0.25; }
      else if (k === 'tunjuk') { rArm = -1.5 + Math.sin(a * 0.9) * 0.1; rZ = 0.3; }
      else if (k === 'main') { rArm = -2.2 + Math.sin(a * 6) * 0.6; rZ = 0.3; }
    }
    this.armR.rotation.x = damp(this.armR.rotation.x, rArm, 14, dt);
    this.armR.rotation.z = damp(this.armR.rotation.z, rZ, 14, dt);
    if (this.armL) {
      let lArm = sw * 0.7, lZ = -0.08;
      if (s.grounded === false) { lArm = -2.4; lZ = -0.5; }
      if (this.celebrate > 0) { lArm = -2.9; lZ = -0.5; }
      this.armL.rotation.x = damp(this.armL.rotation.x, lArm, 14, dt);
      this.armL.rotation.z = damp(this.armL.rotation.z, lZ, 14, dt);
    }
    // kepala menoleh ke target
    let yaw = Math.sin(this.t * 0.4) * 0.15 * (1 - sp), pitch = 0;
    if (s.look) {
      this.root.updateMatrixWorld();
      const l = this.root.worldToLocal(s.look.clone());
      l.y -= 1.0 * this.scale;
      yaw = THREE.MathUtils.clamp(Math.atan2(l.x, l.z), -0.9, 0.9);
      pitch = THREE.MathUtils.clamp(-Math.atan2(l.y, Math.hypot(l.x, l.z)), -0.4, 0.4);
    }
    if (s.talking) pitch += Math.sin(this.t * 11) * 0.05;
    this.headYaw = damp(this.headYaw, yaw, 7, dt);
    this.headPitch = damp(this.headPitch, pitch, 7, dt);
    this.head.rotation.set(this.headPitch, this.headYaw, Math.sin(this.t * 1.3) * 0.03);
    this.head.position.y = 1.0 + (this.celebrate > 0 ? 0.03 : 0);
    // kedip
    this.blinkT -= dt;
    if (this.blinkT < 0) { this.blink = 0.14; this.blinkT = 2 + Math.random() * 3.5; }
    const closed = this.blink > 0 ? Math.sin((1 - this.blink / 0.14) * Math.PI) : this.celebrate > 0 ? 0.55 : 0;
    this.blink = Math.max(0, this.blink - dt);
    this.lids.rotation.x = -0.45 + closed * 1.9;
    // tas memantul (secondary motion)
    if (this.bag) {
      const force = (s.vUp || 0) * -0.03 + Math.sin(this.walk * 2) * 0.05 * sp;
      this.bagV += ((force - this.bagSwing) * 60 - this.bagV * 6) * dt;
      this.bagSwing += this.bagV * dt;
      this.bag.rotation.x = this.bagSwing;
      this.bag.rotation.z = -Math.sin(this.walk) * 0.08 * sp;
    }
  }

  place(pos, up, fwd) {
    const lx = V3().crossVectors(up, fwd).normalize();
    const f = V3().crossVectors(lx, up).normalize();
    this.root.matrix.makeBasis(lx, up, f).setPosition(pos);
    this.root.matrixWorldNeedsUpdate = true;
  }
}
