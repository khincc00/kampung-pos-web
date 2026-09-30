// Karakter bergaya animasi 3D lembut: kepala besar, mata berkilau, kedip, squash & stretch,
// antisipasi lompat, kepala menoleh, melambai, tas surat memantul, selebrasi.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { prefab, softMat } from './world.js';

// ------------------------------------------------------------ model kurir 3D (GLB, rig Mixamo)
// Animasi: idle / walk / run / jump. Tanpa file (atau gagal dimuat) → karakter prosedural biasa.
const HERO_H = 1.42;                       // tinggi default di dunia (m): kurir, sedikit di atas warga
const HERO_BONES = ['Head', 'Chest', 'Spine2', 'RightArm', 'RightForeArm', 'RightHand', 'LeftArm', 'LeftForeArm', 'LeftHand'];
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Quaternion(), _wq = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _id = new THREE.Quaternion();
export async function loadHero(url, height = HERO_H) {
  const g = await new GLTFLoader().loadAsync(url);
  // lompat: rentang "kedua kaki lepas tanah" di klip dipakai memetakan kecepatan vertikal ke waktu klip,
  // lalu translasi pinggul dibuang karena tinggi lompat murni dari fisika
  const jump = g.animations.find((a) => a.name === 'jump');
  const jumpAir = jump ? airWindow(g, jump) : null;
  if (jump) jump.tracks = jump.tracks.filter((t) => !t.name.endsWith('.position'));
  // klip Mixamo tanpa "In Place": pinggul maju terus lalu melompat balik saat klip mengulang.
  // Buang geser lurus awal→akhir (maju/samping); ayunan naik-turun di tengah siklus tetap.
  for (const c of g.animations) for (const t of c.tracks) {
    if (!t.name.endsWith('.position')) continue;
    const v = t.values, T = t.times, k = T.length, span = T[k - 1] - T[0];
    if (k < 2 || span <= 0) continue;
    const d0 = v[(k - 1) * 3] - v[0], d2 = v[(k - 1) * 3 + 2] - v[2];
    for (let i = 0; i < k; i++) { const f = (T[i] - T[0]) / span; v[i * 3] -= d0 * f; v[i * 3 + 2] -= d2 * f; }
  }
  // tinggi diukur dari tulang (pose T bawaan); bounding box mesh ber-skin tidak bisa dipercaya
  g.scene.updateMatrixWorld(true);
  let lo = Infinity, hi = -Infinity;
  g.scene.traverse((o) => { if (o.isBone) { const y = o.getWorldPosition(_a).y; lo = Math.min(lo, y); hi = Math.max(hi, y); } });
  g.scene.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.frustumCulled = false;
    if (!o.geometry.attributes.normal) smoothNormals(o.geometry);   // model tanpa normal → jangan flat shading
    const m = o.material;
    m.flatShading = false; m.needsUpdate = true;
    if (m.map) { m.map.anisotropy = 4; m.emissiveMap = m.map; m.emissive = new THREE.Color(0.22, 0.2, 0.19); }  // sisi teduh tidak jadi hitam, senada karakter lain
    m.roughness = 0.7; m.metalness = 0;
  });
  return { scene: g.scene, clips: g.animations, k: height / ((hi - lo) * 1.04), runOfs: stepOffset(g), jumpAir };   // +4%: ujung kepala/sol di luar tulang
}
/** normal halus yang dirata-rata per posisi: sambungan UV (verteks kembar) tidak kelihatan sebagai garis */
function smoothNormals(geo) {
  geo.computeVertexNormals();
  const p = geo.attributes.position, n = geo.attributes.normal, key = new Map(), acc = [];
  const q = (i) => `${Math.round(p.getX(i) * 1e4)},${Math.round(p.getY(i) * 1e4)},${Math.round(p.getZ(i) * 1e4)}`;
  const id = new Int32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    const k = q(i); let j = key.get(k);
    if (j === undefined) { j = acc.length; key.set(k, j); acc.push(new THREE.Vector3()); }
    id[i] = j; acc[j].x += n.getX(i); acc[j].y += n.getY(i); acc[j].z += n.getZ(i);
  }
  // normal nol (segitiga gepeng / arah saling meniadakan) → NaN di shader → bloom menyebarkannya jadi kedipan layar.
  // Titik seperti itu memakai normal miliknya sendiri, atau arah atas kalau itu pun nol.
  for (let i = 0; i < p.count; i++) {
    const v = acc[id[i]];
    if (v.lengthSq() > 1e-12) { const l = v.length(); n.setXYZ(i, v.x / l, v.y / l, v.z / l); continue; }
    const x = n.getX(i), y = n.getY(i), z = n.getZ(i), l = Math.hypot(x, y, z);
    if (l > 1e-6) n.setXYZ(i, x / l, y / l, z / l); else n.setXYZ(i, 0, 1, 0);
  }
  n.needsUpdate = true;
}
/** sampel klip di pose-pose tertentu tanpa merusak pose T asli */
function sampleClip(g, clip, n, read) {
  const bones = []; g.scene.traverse((o) => { if (o.isBone) bones.push([o, o.position.clone(), o.quaternion.clone(), o.scale.clone()]); });
  const mx = new THREE.AnimationMixer(g.scene), a = mx.clipAction(clip); a.play();
  const out = [];
  for (let i = 0; i < n; i++) { a.time = (clip.duration * i) / n; mx.update(0); g.scene.updateMatrixWorld(true); out.push(read()); }
  mx.stopAllAction(); mx.uncacheRoot(g.scene);
  for (const [o, p, q, sc] of bones) { o.position.copy(p); o.quaternion.copy(q); o.scale.copy(sc); }
  return out;
}
function footBones(g) { let L, R; g.scene.traverse((o) => { if (o.isBone && /LeftFoot$/.test(o.name)) L = o; if (o.isBone && /RightFoot$/.test(o.name)) R = o; }); return [L, R]; }
/** rentang waktu klip lompat saat kedua kaki di udara: { t0, apex, t1 } */
function airWindow(g, clip) {
  const [L, R] = footBones(g); if (!L || !R) return null;
  const N = 96, y = sampleClip(g, clip, N, () => Math.min(L.getWorldPosition(_a).y, R.getWorldPosition(_b).y));
  const ground = Math.min(...y), top = Math.max(...y), thr = ground + (top - ground) * 0.25;
  let best = null;
  for (let i = 0; i < N; i++) {
    if (y[i] <= thr) continue;
    let j = i; while (j + 1 < N && y[j + 1] > thr) j++;
    if (!best || j - i > best[1] - best[0]) best = [i, j];
    i = j;
  }
  if (!best) return null;
  const dt = clip.duration / N, t0 = best[0] * dt, t1 = best[1] * dt;
  return { t0, t1, apex: (t0 + t1) / 2 };
}
/** Selisih fase klip lari terhadap jalan (0..1), dicari dari posisi kaki kiri-kanan di kedua klip,
 *  supaya kaki yang sama sedang di depan saat bobot berpindah jalan ↔ lari. */
function stepOffset(g) {
  const walk = g.animations.find((a) => a.name === 'walk'), run = g.animations.find((a) => a.name === 'run');
  const [L, R] = footBones(g);
  if (!walk || !run || !L || !R) return 0;
  const N = 32, gap = () => L.getWorldPosition(_a).z - R.getWorldPosition(_b).z;
  const w = sampleClip(g, walk, N, gap), r = sampleClip(g, run, N, gap);
  let bestS = 0, best = -Infinity;
  for (let sft = 0; sft < N; sft++) { let c = 0; for (let i = 0; i < N; i++) c += w[i] * r[(i + sft) % N]; if (c > best) { best = c; bestS = sft; } }
  return bestS / N;
}
/** putar tulang (dalam ruang dunia) supaya arah tulang→anak menunjuk ke dir, dengan bobot k */
function aimBone(bone, child, dir, k) {
  if (!bone || !child || k <= 0.001) return;
  bone.getWorldPosition(_a); child.getWorldPosition(_b);
  if (_b.sub(_a).lengthSq() < 1e-10 || dir.lengthSq() < 1e-10) return;   // vektor nol → quaternion NaN
  _q.setFromUnitVectors(_b.normalize(), dir);
  if (k < 1) _q.slerpQuaternions(_id, _q, k);
  bone.getWorldQuaternion(_wq).premultiply(_q);
  bone.parent.getWorldQuaternion(_pq);
  bone.quaternion.copy(_pq.invert().multiply(_wq));
  bone.updateMatrixWorld(true);
}
function turnBone(bone, axis, angle) {
  if (!bone || Math.abs(angle) < 1e-4) return;
  _q.setFromAxisAngle(axis, angle);
  bone.getWorldQuaternion(_wq).premultiply(_q);
  bone.parent.getWorldQuaternion(_pq);
  bone.quaternion.copy(_pq.invert().multiply(_wq));
  bone.updateMatrixWorld(true);
}

// ------------------------------------------------------------ warga 3D (paket Quaternius, CC0)
// Tiap model dasar: bagian-bagiannya (kepala/badan/kaki/sepatu, tiap warna = 1 material) digabung jadi SATU mesh
// ber-skin dengan warna per verteks → 1 draw call per warga, dan tiap warga bisa diwarnai ulang sesuai ciri di story.js.
const R_SKIN = 0, R_SKIN2 = 1, R_KEEP = 2, R_HAIR = 3, R_BROW = 4, R_TOP = 5, R_ACCENT = 6, R_BOTTOM = 7, R_BOTTOM2 = 8, R_SHOES = 9, R_SHOES2 = 10;
const WARGA_ROLE_FIX = {           // material yang bukan rambut/baju walau paling besar di bagiannya
  pria_petani: { Beige: 11, Red: R_KEEP },          // 11 = topi bawaan (diwarnai jerami)
  pria_pekerja: { Worker_Yellow: 11, Worker_Vest: R_ACCENT },   // helm bawaan (diwarnai helm/topi warga)
};
let wargaMat = null;
// tinggi tulang warga dewasa: tampak ±1,8 m (model Quaternius berkepala besar, ujung kepala jauh di atas tulang),
// setara kurir (±1,9 m) & istri; variasi look.s dan anak (kid) tetap berlaku di atasnya
export async function loadWarga(url, height = 1.6) {
  const base = await loadHero(url, height);
  const key = url.split('/').pop().replace('.glb', ''), fix = WARGA_ROLE_FIX[key] || {};
  const parts = []; base.scene.traverse((o) => { if (o.isSkinnedMesh) parts.push(o); });
  const ref = parts[0];
  const partOf = (o) => { const n = o.name + ' ' + (o.parent?.name || ''); return /Head/i.test(n) ? 'head' : /Legs|Pants/i.test(n) ? 'legs' : /Feet/i.test(n) ? 'feet' : 'body'; };
  const isSkin = (n) => /^Skin/i.test(n), isFace = (n) => /^Eye$|Eyebrows|Moustache/i.test(n);
  // warna utama tiap bagian = material bukan-kulit terbesar
  const primary = {};
  for (const o of parts) {
    const n = o.material.name, c = o.geometry.attributes.position.count, pt = partOf(o);
    if (isSkin(n) || isFace(n) || fix[n] !== undefined) continue;
    if (!primary[pt] || c > primary[pt].c) primary[pt] = { o, c };
  }
  const roleOf = (o) => {
    const n = o.material.name, pt = partOf(o), prim = primary[pt]?.o === o;
    if (fix[n] !== undefined) return fix[n];
    if (/^Skin_Darker/i.test(n)) return R_SKIN2;
    if (isSkin(n)) return R_SKIN;
    if (/^Eye$/i.test(n)) return R_KEEP;
    if (/Eyebrows|Moustache/i.test(n)) return R_BROW;
    if (pt === 'head') return prim ? R_HAIR : /Hair|Brown/i.test(n) ? R_BROW : R_KEEP;
    if (pt === 'legs') return prim ? R_BOTTOM : R_BOTTOM2;
    if (pt === 'feet') return prim ? R_SHOES : R_SHOES2;
    return prim ? R_TOP : R_ACCENT;
  };
  const comp = (a, i, k) => (k === 0 ? a.getX(i) : k === 1 ? a.getY(i) : k === 2 ? a.getZ(i) : a.getW(i));   // r160: belum ada getComponent
  const f32 = (a) => { const out = new Float32Array(a.count * a.itemSize); for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = comp(a, i, k); return new THREE.BufferAttribute(out, a.itemSize); };
  const refInv = ref.bindMatrix.clone().invert(), geos = [], roles = [], orig = [];
  const refIdx = new Map(ref.skeleton.bones.map((b, i) => [b.name, i]));
  for (const o of parts) {
    const g0 = o.geometry, g = new THREE.BufferGeometry();
    g.setAttribute('position', f32(g0.attributes.position));
    g.setAttribute('normal', f32(g0.attributes.normal));
    // tiap bagian punya skin sendiri dengan urutan tulang berbeda → petakan indeks ke urutan tulang skin acuan (lewat nama)
    const map = o.skeleton.bones.map((b) => refIdx.get(b.name) ?? 0);
    const si = g0.attributes.skinIndex, idx = new Uint16Array(si.count * 4); for (let i = 0; i < si.count; i++) for (let k = 0; k < 4; k++) idx[i * 4 + k] = map[comp(si, i, k)];
    g.setAttribute('skinIndex', new THREE.BufferAttribute(idx, 4));
    g.setAttribute('skinWeight', f32(g0.attributes.skinWeight));
    g.setIndex(g0.index ? Array.from(g0.index.array) : [...Array(si.count).keys()]);
    // hasil kuantisasi: tiap skin punya inverse-bind sendiri (berbeda satu matriks dekuantisasi) → ubah posisi ke ruang skin acuan:
    // v' = bindRef⁻¹ · IBMref⁻¹ · IBMbagian · bindBagian · v   (dihitung lewat satu tulang yang sama, mis. Hips)
    const jb = o.skeleton.bones.findIndex((b) => refIdx.has(b.name)), jr = refIdx.get(o.skeleton.bones[jb].name);
    const M = refInv.clone().multiply(ref.skeleton.boneInverses[jr].clone().invert()).multiply(o.skeleton.boneInverses[jb]).multiply(o.bindMatrix);
    if (!M.equals(new THREE.Matrix4())) g.applyMatrix4(M);
    const r = roleOf(o), c = o.material.color;
    for (let i = 0; i < si.count; i++) { roles.push(r); orig.push(c.r, c.g, c.b); }
    geos.push(g);
  }
  const geo = mergeGeometries(geos);
  if (!wargaMat) wargaMat = softMat({ vertexColors: true, roughness: 0.78 }, 0.3);
  const mesh = new THREE.SkinnedMesh(geo, wargaMat);
  mesh.name = 'warga'; mesh.castShadow = true; mesh.frustumCulled = false;
  ref.parent.add(mesh); mesh.bind(ref.skeleton, ref.bindMatrix);
  for (const o of parts) o.parent.remove(o);
  // ukuran & pusat kepala (kulit/wajah yang ikut tulang kepala), untuk menempel kerudung/peci/caping
  const bones = ref.skeleton.bones, hi = bones.findIndex((b) => /(^|[^a-z])Head$/i.test(b.name));
  // posisi dunia sebenarnya (pose T): tulang · inverse-bind · bind · v  (inverse-bind hasil kuantisasi tidak boleh dipakai sendirian)
  base.scene.updateMatrixWorld(true);
  const hb = bones[hi], toWorld = hb ? hb.matrixWorld.clone().multiply(ref.skeleton.boneInverses[hi]).multiply(ref.bindMatrix) : null;
  const pos = geo.attributes.position, sI = geo.attributes.skinIndex, sW = geo.attributes.skinWeight, box = new THREE.Box3(), v = new THREE.Vector3();
  for (let i = 0; hb && i < pos.count; i++) {
    if (roles[i] !== R_SKIN && roles[i] !== R_SKIN2) continue;          // kulit wajah/telinga saja (bukan rambut/topi bawaan)
    let w = 0; for (let k = 0; k < 4; k++) if (comp(sI, i, k) === hi) w += comp(sW, i, k);
    if (w > 0.6) box.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(toWorld));
  }
  const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
  center.y += size.y * 0.08;                                               // kulit terukur sampai leher: geser sedikit ke atas
  // bagian tubuh tiap verteks (dari tulang dominan): untuk menutup lengan/leher/kaki (gamis)
  const catOfBone = bones.map((b) => /UpperArm|LowerArm|Shoulder/.test(b.name) ? 1 : /UpperLeg|LowerLeg/.test(b.name) ? 2 : /Neck|Chest|Torso|Abdomen|Hips/.test(b.name) ? 3 : 0);
  const cat = new Uint8Array(pos.count), legBox = new THREE.Box3(), vw = new THREE.Vector3();
  const boneWorld = bones.map((b, i) => b.matrixWorld.clone().multiply(ref.skeleton.boneInverses[i]).multiply(ref.bindMatrix));
  for (let i = 0; i < pos.count; i++) {
    let bi = 0, bw = -1; for (let k = 0; k < 4; k++) { const w = comp(sW, i, k); if (w > bw) { bw = w; bi = comp(sI, i, k); } }
    cat[i] = catOfBone[bi];
    if (/UpperLeg/.test(bones[bi].name)) legBox.expandByPoint(vw.fromBufferAttribute(pos, i).applyMatrix4(boneWorld[bi]));
  }
  const hipsBone = bones.find((b) => /Hips$/.test(b.name)), footBone = bones.find((b) => /Foot\.?L$|LeftFoot$/.test(b.name));   // three membuang titik: Foot.L → FootL
  const hips = hipsBone && footBone ? { bone: hipsBone.name, inv: hipsBone.matrixWorld.clone().invert(), p: hipsBone.getWorldPosition(new THREE.Vector3()),
    foot: footBone.getWorldPosition(new THREE.Vector3()).y, w: legBox.getSize(new THREE.Vector3()).x / 2, d: legBox.getSize(new THREE.Vector3()).z / 2 } : null;
  // versi gamis (untuk kerudung): verteks rambut diciutkan ke pusat kepala → tidak menembus kain,
  // dan pinggang model yang ramping diisi (baju longgar) supaya badan menyambung mulus dari dada ke rok gamis
  let gamis = null;
  if (toWorld) {
    const cl = center.clone().applyMatrix4(toWorld.clone().invert()), arr = new Float32Array(pos.array);
    for (let i = 0; i < pos.count; i++) if (roles[i] === R_HAIR) { arr[i * 3] = cl.x; arr[i * 3 + 1] = cl.y; arr[i * 3 + 2] = cl.z; }
    if (hips) shapeGamis(arr, pos, sI, sW, bones, boneWorld, hips, comp);
    gamis = new THREE.BufferAttribute(arr, 3);
  }
  return { ...base, key, roles: Uint8Array.from(roles), orig: Float32Array.from(orig), gamis, cat, hips,
    head: { bone: hb?.name, inv: hb ? hb.matrixWorld.clone().invert() : null, center, r: Math.max(size.x, size.z) / 2 } };
}
/** rok gamis (dalam ruang dunia pose T): dari sedikit di atas pinggul sampai mata kaki */
function gamisSkirt(H) {
  const leg = H.p.y - H.foot;
  return { top: H.p.y + leg * 0.06, bot: H.foot + leg * 0.05, rt: H.w * 0.84, rb: H.w * 1.45, dz: Math.max(0.75, H.d / H.w) };   // paha dirampingkan (shapeGamis) → pinggang rok boleh sempit
}
/** Badan antara tepi atas rok gamis dan dada dibuat longgar: tiap verteks badan yang ada di dalam elips target
 *  (lebar & tebal rok di bawah → lebar & tebal dada di atas) didorong keluar ke elips itu. Pinggang ramping model
 *  jadi terisi dan menyambung mulus ke rok; bagian yang sudah lebih lebar tidak diubah.
 *  Kaki di dalam rok dirampingkan ke sumbu tulangnya supaya lutut yang menekuk (idle/jalan) tidak menembus kain. */
function shapeGamis(arr, pos, sI, sW, bones, boneWorld, H, comp) {
  const neck = bones.find((b) => /Neck$/.test(b.name));
  if (!neck) return;
  const S = gamisSkirt(H), y0 = S.top, y1 = neck.getWorldPosition(new THREE.Vector3()).y, yM = (y0 + y1) / 2;
  const torso = bones.map((b) => /(Body|Hips|Abdomen|Torso|Chest)$/.test(b.name));
  const vs = [], v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    let t = 0, bi = 0, bw = -1;
    for (let k = 0; k < 4; k++) { const b = comp(sI, i, k), w = comp(sW, i, k); if (torso[b]) t += w; if (w > bw) { bw = w; bi = b; } }
    if (t < 0.5) continue;
    v.fromBufferAttribute(pos, i).applyMatrix4(boneWorld[bi]);
    if (v.y > y0 - (y1 - y0) * 0.15 && v.y < y1) vs.push({ i, bi, p: v.clone() });
  }
  // dada: lebar & tebal terbesar di separuh atas badan, dan ketinggian titik terlebarnya
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, yC = yM;
  for (const { p } of vs) if (p.y >= yM) {
    if (p.x > x1) { x1 = p.x; yC = p.y; }
    x0 = Math.min(x0, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z);
  }
  if (!(x1 > x0) || yC <= y0) return;
  const top = { w: (x1 - x0) / 2, d: (z1 - z0) / 2, x: (x0 + x1) / 2, z: (z0 + z1) / 2 };
  const bot = { w: S.rt * 0.96, d: S.rt * S.dz * 0.96, x: H.p.x, z: H.p.z };            // sedikit di dalam rok: tidak z-fighting
  const inv = new Map();
  for (const { i, bi, p } of vs) {
    if (p.y >= yC) continue;
    const f = THREE.MathUtils.smoothstep(p.y, y0, yC), L = THREE.MathUtils.lerp;
    const cx = L(bot.x, top.x, f), cz = L(bot.z, top.z, f), ex = (p.x - cx) / L(bot.w, top.w, f), ez = (p.z - cz) / L(bot.d, top.d, f);
    const r = Math.hypot(ex, ez);
    if (r >= 1 || r < 0.2) continue;                     // sudah di luar elips, atau titik dalam (bukan permukaan)
    p.x = cx + (p.x - cx) / r; p.z = cz + (p.z - cz) / r;
    if (!inv.has(bi)) inv.set(bi, boneWorld[bi].clone().invert());
    p.applyMatrix4(inv.get(bi));
    arr[i * 3] = p.x; arr[i * 3 + 1] = p.y; arr[i * 3 + 2] = p.z;
  }
  const leg = bones.map((b) => /(UpperLeg|LowerLeg)/.test(b.name)), bp = bones.map((b) => b.getWorldPosition(new THREE.Vector3()));
  for (let i = 0; i < pos.count; i++) {
    let bi = 0, bw = -1; for (let k = 0; k < 4; k++) { const w = comp(sW, i, k); if (w > bw) { bw = w; bi = comp(sI, i, k); } }
    if (!leg[bi]) continue;
    v.set(arr[i * 3], arr[i * 3 + 1], arr[i * 3 + 2]).applyMatrix4(boneWorld[bi]);
    if (v.y < S.bot + (S.top - S.bot) * 0.12) continue;          // pergelangan & sepatu tetap utuh
    v.x = bp[bi].x + (v.x - bp[bi].x) * 0.55; v.z = bp[bi].z + (v.z - bp[bi].z) * 0.55;
    if (!inv.has(bi)) inv.set(bi, boneWorld[bi].clone().invert());
    v.applyMatrix4(inv.get(bi));
    arr[i * 3] = v.x; arr[i * 3 + 1] = v.y; arr[i * 3 + 2] = v.z;
  }
}
/** model dasar yang paling dekat dengan ciri warga (jenis kelamin, baju, tutup kepala, benda di tangan) */
export function wargaBaseFor(look) {
  const fem = look.fem ?? (['kerudung', 'sanggul', 'kuncir', 'kepang', 'panjang'].includes(look.head) || ['daster', 'kebaya', 'rok'].includes(look.outfit));
  if (fem && look.head === 'kerudung') return 'wanita_kaos';   // gamis: dasar bercelana panjang, lengan & rok ditutup saat diwarnai
  if (fem) return ['daster', 'kebaya', 'rok', 'sarung'].includes(look.outfit) ? 'wanita_gaun' : look.outfit === 'rompi' ? 'wanita_celana' : 'wanita_kaos';
  if (['caping', 'jerami'].includes(look.head) || ['jaring', 'pancing'].includes(look.hold)) return 'pria_petani';
  if (['helm', 'topi'].includes(look.head) || look.outfit === 'apron') return 'pria_pekerja';
  if (look.outfit === 'jaket') return 'pria_jaket';
  if (look.outfit === 'rompi') return 'pria_rompi';
  if (look.outfit === 'batik') return 'pria_jas';
  if (look.outfit === 'garis') return 'pria_santai';
  return 'pria_kaos';
}
/** warna per verteks untuk satu warga, dari ciri di story.js */
function wargaColors(base, look) {
  const C = (h, k = 1) => new THREE.Color(h).multiplyScalar(k);
  const hairHidden = ['kerudung', 'topi', 'helm'].includes(look.head);
  const hair = look.head === 'uban' ? C('#d9d6cf') : C(hairHidden ? '#2b1d16' : look.headColor || '#2b1d16');
  const skin = C(look.skin || '#c68b5e'), top = C(look.shirt || '#48dbfb');
  const skirt = ['daster', 'kebaya', 'rok'].includes(look.outfit);
  const bottom = C(look.outfit === 'sarung' ? look.accent || '#6b4a2b' : look.pants || '#3b302b');
  const shoes = C(look.shoes || '#3b302b');
  const pal = {
    [R_SKIN]: skin, [R_SKIN2]: skin.clone().multiplyScalar(0.88), [R_HAIR]: hair, [R_BROW]: hair.clone().multiplyScalar(look.head === 'uban' ? 0.8 : 0.7),
    [R_TOP]: top, [R_ACCENT]: look.accent ? C(look.accent) : top.clone().multiplyScalar(0.75),
    [R_BOTTOM]: skirt && look.outfit !== 'rok' ? C(look.pants || '#3b302b') : bottom, [R_BOTTOM2]: bottom.clone().multiplyScalar(0.8),
    [R_SHOES]: shoes, [R_SHOES2]: shoes.clone().multiplyScalar(0.7),
    11: C(look.head === 'helm' ? look.helm || '#d9483b' : look.head === 'topi' ? look.headColor || '#feca57' : ['caping', 'jerami'].includes(look.head) ? '#d8b56a' : '#6b5a3c'),
  };
  const gamis = look.head === 'kerudung';        // berkerudung → gamis: lengan panjang, leher & kaki tertutup
  if (gamis) { pal[R_BOTTOM] = top.clone().multiplyScalar(0.92); pal[R_BOTTOM2] = top.clone().multiplyScalar(0.8); }
  const cover = [null, top.clone().multiplyScalar(0.95), top.clone().multiplyScalar(0.9), top];   // [lain, lengan, kaki, leher/badan]
  const out = new Float32Array(base.roles.length * 3);
  for (let i = 0; i < base.roles.length; i++) {
    const r = base.roles[i];
    const c = gamis && (r === R_SKIN || r === R_SKIN2) && cover[base.cat[i]] ? cover[base.cat[i]] : pal[r];
    if (c) { out[i * 3] = c.r; out[i * 3 + 1] = c.g; out[i * 3 + 2] = c.b; } else { out[i * 3] = base.orig[i * 3]; out[i * 3 + 1] = base.orig[i * 3 + 1]; out[i * 3 + 2] = base.orig[i * 3 + 2]; }
  }
  return out;
}
/** tutup kepala & aksesori wajah, dalam koordinat kepala prosedural (pusat 0, jari-jari 0.3, depan +z) */
function hatParts(look, baseKey) {
  const hc = look.headColor || '#2b1d16', P = [];
  const own = baseKey === 'pria_pekerja' ? ['helm', 'topi'] : baseKey === 'pria_petani' ? ['jerami'] : [];   // model sudah punya tutup kepala sendiri
  switch (own.includes(look.head) ? null : look.head) {
    case 'kerudung':   // tudung (dimiringkan ke belakang: dahi & wajah terbuka) + kain belakang kepala + lilitan leher
      P.push({ t: 'sphere', r: 0.34, seg: 16, ring: 11, theta: 1.95, p: [0, 0.03, -0.03], r3: [-0.55, 0, 0], c: hc },
        { t: 'sphere', r: 0.31, seg: 12, ring: 9, p: [0, -0.12, -0.1], sc: [1.06, 1.15, 0.92], c: hc },
        { t: 'sphere', r: 0.26, seg: 12, ring: 8, p: [0, -0.3, -0.02], sc: [1.2, 0.6, 1.1], c: hc },            // bawah dagu
        { t: 'cyl', rt: 0.3, rb: 0.6, h: 0.5, seg: 14, p: [0, -0.62, -0.02], sc: [1, 1, 0.8], c: hc });       // kain menjuntai menutup dada & bahu
      break;
    case 'peci': P.push({ t: 'cyl', rt: 0.25, rb: 0.27, h: 0.17, p: [0, 0.3, -0.02], c: '#23201e' }); break;
    case 'kopiah': P.push({ t: 'cyl', rt: 0.25, rb: 0.27, h: 0.17, p: [0, 0.3, -0.02], c: '#fefcf5' }); break;
    case 'caping': P.push({ t: 'cone', r: 0.66, h: 0.34, p: [0, 0.42, 0], c: '#d8b56a' }); break;
    case 'jerami': P.push({ t: 'cone', r: 0.62, h: 0.14, p: [0, 0.33, 0], c: '#e7cf8b' }, { t: 'cyl', rt: 0.24, rb: 0.28, h: 0.18, p: [0, 0.42, 0], c: '#e7cf8b' }, { t: 'cyl', rt: 0.285, h: 0.04, p: [0, 0.37, 0], c: look.pita || '#d9483b' }); break;
    case 'helm': P.push({ t: 'sphere', r: 0.37, seg: 16, ring: 10, theta: 1.75, p: [0, 0.06, -0.02], c: look.helm || '#d9483b' }, { t: 'box', s: [0.32, 0.03, 0.14], p: [0, 0.2, 0.33], r3: [-0.25, 0, 0], c: '#2b1d16' }); break;
    case 'topi': P.push({ t: 'sphere', r: 0.34, theta: 1.3, p: [0, 0.07, -0.01], c: hc }, { t: 'box', s: [0.36, 0.035, 0.22], p: [0, 0.17, 0.32], r3: [-0.2, 0, 0], c: hc }); break;
    case 'blangkon': P.push({ t: 'sphere', r: 0.33, theta: 1.15, p: [0, 0.05, -0.02], c: '#6b4a2b' }, { t: 'cyl', rt: 0.29, rb: 0.32, h: 0.1, p: [0, 0.2, -0.01], c: '#3b2a20' }, { t: 'sphere', r: 0.1, p: [0, 0.12, -0.33], sc: [1, 0.8, 0.8], c: '#3b2a20' }); break;
    case 'bandana': P.push({ t: 'cyl', rt: 0.325, h: 0.09, p: [0, 0.16, -0.01], c: look.pita || '#d9483b' }); break;
    case 'sanggul': P.push({ t: 'sphere', r: 0.16, p: [0, 0.12, -0.33], c: hc }); break;
    case 'kuncir': P.push({ t: 'capsule', r: 0.06, len: 0.3, p: [0, 0.02, -0.4], r3: [-0.5, 0, 0], c: hc }, { t: 'sphere', r: 0.05, p: [0, 0.2, -0.35], c: look.pita || '#d9483b', seg: 6, ring: 4 }); break;
    case 'kepang': for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) P.push({ t: 'sphere', r: 0.065 - k * 0.006, p: [sx * (0.27 + k * 0.02), -0.14 - k * 0.11, -0.04], c: k === 3 ? (look.pita || '#ff9a9e') : hc, seg: 8, ring: 6 }); break;
  }
  const face = look.face || [];
  if (face.includes('kacamata')) {
    for (const sx of [-1, 1]) P.push({ t: 'cyl', rt: 0.085, h: 0.02, p: [sx * 0.11, 0.04, 0.3], r3: [Math.PI / 2, 0, 0], seg: 12, c: look.frame || '#2b1d16' },
      { t: 'cyl', rt: 0.068, h: 0.022, p: [sx * 0.11, 0.04, 0.302], r3: [Math.PI / 2, 0, 0], seg: 12, c: '#dff0f5' });
    P.push({ t: 'box', s: [0.06, 0.015, 0.015], p: [0, 0.05, 0.3], sharp: true, c: look.frame || '#2b1d16' });
  }
  const beard = look.beardColor || hc;
  if (face.includes('kumis')) P.push({ t: 'capsule', r: 0.024, len: 0.1, p: [0, -0.1, 0.29], r3: [0, 0, Math.PI / 2], c: beard });
  if (face.includes('jenggot')) P.push({ t: 'sphere', r: 0.13, p: [0, -0.24, 0.17], sc: [1, 0.8, 0.8], c: beard });
  return P;
}

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
  if (face.includes('goatee')) P.push(   // janggut kecil di dagu + garis tipis ke bibir
    { t: 'sphere', r: 0.045, seg: 10, ring: 8, p: [0, -0.2, 0.225], sc: [0.9, 1.1, 0.7], c: look.beardColor || brow },
    { t: 'capsule', r: 0.012, len: 0.035, p: [0, -0.16, 0.26], c: look.beardColor || brow });
  if (face.includes('bintik')) for (const sx of [-1, 1]) for (const [dx, dy] of [[0, 0], [0.035, 0.012], [0.018, -0.03], [0.05, -0.018], [-0.012, -0.022]])
    P.push({ t: 'sphere', r: 0.0075, seg: 5, ring: 4, p: [sx * (0.135 + dx), -0.045 + dy, eyeZ - 0.005 - Math.abs(dx) * 0.4], c: new THREE.Color(skin).multiplyScalar(0.72).getStyle() });
  if (face.includes('senyum')) P.push(   // senyum lebar dengan gigi
    { t: 'sphere', r: 0.06, seg: 12, ring: 8, theta: Math.PI / 2, p: [0, -0.118, eyeZ + 0.012], r3: [Math.PI, 0, 0], sc: [1.3, 0.75, 0.45], c: '#6a2f28' },
    { t: 'box', s: [0.1, 0.022, 0.02], sharp: true, p: [0, -0.123, eyeZ + 0.035], c: '#fbfbf5' });
  else P.push({ t: 'capsule', r: 0.012, len: 0.05, p: [0, -0.125, eyeZ + 0.02], r3: [0, 0, Math.PI / 2], c: '#6a2f28' });
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
      { t: 'capsule', r: 0.2, len: 0.08, p: [0, 0.45, 0], sc: [1.05, 0.8, 0.85], c: skirt || outfit === 'kemeja' ? shirt : pants },
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
    if (outfit === 'kemeja') {   // kemeja berkerah, kancing, ujung dikeluarkan
      const dk = new THREE.Color(shirt).multiplyScalar(0.9).getStyle();
      body.push({ t: 'cyl', rt: 0.232, rb: 0.24, h: 0.08, p: [0, 0.4, 0], sc: [1, 1, 0.84], seg: 16, c: shirt },
        { t: 'box', s: [0.012, 0.44, 0.012], sharp: true, p: [0, 0.6, 0.184], c: dk });
      for (const y of [0.44, 0.54, 0.64, 0.74]) body.push({ t: 'cyl', rt: 0.013, h: 0.008, p: [0.012, y, 0.19], r3: [Math.PI / 2, 0, 0], seg: 8, c: '#eef3f8' });
      for (const sx of [-1, 1]) body.push({ t: 'box', s: [0.1, 0.075, 0.02], sharp: true, p: [sx * 0.055, 0.845, 0.1], r3: [-0.35, sx * 0.5, sx * 0.55], c: shirt },
        { t: 'box', s: [0.09, 0.06, 0.02], sharp: true, p: [sx * 0.07, 0.87, -0.06], r3: [0.3, -sx * 0.3, 0], c: shirt });
    }
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
    const sleeve = look.sleeve === 'gulung'   // lengan kemeja digulung sampai siku, lengan bawah kelihatan
      ? [{ t: 'capsule', r: 0.07, len: 0.1, p: [0, -0.08, 0], c: shirt }, { t: 'cyl', rt: 0.074, h: 0.05, p: [0, -0.175, 0], seg: 12, c: shirt },
        { t: 'capsule', r: 0.05, len: 0.12, p: [0, -0.25, 0], c: skin }]
      : [{ t: 'capsule', r: 0.065, len: 0.22, p: [0, -0.16, 0], c: shirt }];
    const arm = cached('a' + lk, () => prefab([...sleeve, { t: 'sphere', r: 0.067, p: [0, -0.33, 0], c: skin }, ...holdParts(look.hold)]));
    this.armR = new THREE.Group(); this.armR.position.set(0.27, 0.8, 0);
    const ar = new THREE.Mesh(arm, mat); ar.castShadow = true; this.armR.add(ar); this.rig.add(this.armR);
    if (player) {
      this.armL = new THREE.Group(); this.armL.position.set(-0.27, 0.8, 0);
      const al = new THREE.Mesh(arm, mat); al.castShadow = true; this.armL.add(al); this.rig.add(this.armL);
      const shoe = look.shoes || '#3b302b';
      const leg = prefab([{ t: 'capsule', r: 0.085, len: 0.18, p: [0, -0.17, 0], c: pants }, { t: 'box', s: [0.16, 0.09, 0.25], p: [0, -0.37, 0.03], c: shoe },
        ...(look.shoes ? [{ t: 'box', s: [0.165, 0.025, 0.255], sharp: true, p: [0, -0.405, 0.03], c: '#3a2214' }, { t: 'box', s: [0.1, 0.02, 0.05], sharp: true, p: [0, -0.33, 0.1], r3: [-0.2, 0, 0], c: new THREE.Color(shoe).multiplyScalar(0.75).getStyle() }] : [])]);
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

  /** ganti tubuh prosedural dengan model GLB (hasil loadHero). ghost = tembus pandang, shadow = ikut pass bayangan. */
  /** warga 3D: model dasar (loadWarga) diwarnai ulang + tutup kepala sesuai ciri warga */
  useWarga(base, look = this.look) {
    const m = cloneSkinned(base.scene);
    m.traverse((o) => {
      if (!o.isSkinnedMesh || o.name !== 'warga') return;
      const g0 = o.geometry, g = new THREE.BufferGeometry();
      for (const k in g0.attributes) g.setAttribute(k, g0.attributes[k]);
      if (look.head === 'kerudung' && base.gamis) g.setAttribute('position', base.gamis);
      g.setIndex(g0.index); g.boundingSphere = g0.boundingSphere;
      g.setAttribute('color', new THREE.BufferAttribute(wargaColors(base, look), 3));
      o.geometry = g;
    });
    const hat = hatParts(look, base.key);
    if (hat.length && base.head.bone) {
      let hb; m.traverse((o) => { if (o.isBone && o.name === base.head.bone) hb = o; });
      if (hb) {
        const hm = new THREE.Mesh(cached('hat' + JSON.stringify(hat), () => prefab(hat)), charMat);
        hm.castShadow = true; hm.matrixAutoUpdate = false;
        const sc = base.head.r / 0.3;
        hm.matrix.copy(base.head.inv).multiply(new THREE.Matrix4().compose(base.head.center, new THREE.Quaternion(), new THREE.Vector3(sc, sc, sc)));
        hb.add(hm);
      }
    }
    if (look.head === 'kerudung' && base.hips) {   // rok gamis sampai mata kaki, ikut goyang pinggul
      let hb; m.traverse((o) => { if (o.isBone && o.name === base.hips.bone) hb = o; });
      if (hb) {
        const H = base.hips, { top, bot, rt, rb, dz } = gamisSkirt(H), h = top - bot;
        const col = new THREE.Color(look.shirt || '#48dbfb').multiplyScalar(0.92).getHexString();
        // + pinggang kain yang menyempit landai di atas rok (masuk ke badan yang sudah dilebarkan shapeGamis):
        // tepi atas rok tidak jadi undakan rata
        const hc = (H.p.y - H.foot) * 0.11;
        const parts = [{ t: 'cyl', rt, rb, h, seg: 16, p: [0, 0, 0], sc: [1, 1, dz], c: '#' + col },
          { t: 'cyl', rt: rt * 0.9, rb: rt, h: hc, seg: 16, p: [0, (h + hc) / 2, 0], sc: [1, 1, dz], c: '#' + col }];
        const sk = new THREE.Mesh(cached('gamis' + JSON.stringify(parts), () => prefab(parts)), charMat);
        sk.castShadow = true; sk.matrixAutoUpdate = false;
        sk.matrix.copy(H.inv).multiply(new THREE.Matrix4().makeTranslation(H.p.x, (top + bot) / 2, H.p.z));
        hb.add(sk);
      }
    }
    return this.useHero({ ...base, scene: m }, { lookScale: true, clone: false });
  }

  useHero(hero, { ghost = false, shadow = true, lookScale = false, clone = true } = {}) {
    const m = clone ? cloneSkinned(hero.scene) : hero.scene;
    this.heroS = lookScale ? this.scale : 1; this.heroG = lookScale ? this.girth : 1;
    if (!shadow) m.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    if (ghost) m.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); Object.assign(o.material, { transparent: true, opacity: 0.45, depthWrite: false }); o.castShadow = false; } });
    this.rig.visible = false;
    this.hero = new THREE.Group();
    this.hero.add(m);
    this.root.add(this.hero);
    this.heroK = hero.k;
    this.runOfs = hero.runOfs || 0;
    this.jumpAir = hero.jumpAir || { t0: 0.8, apex: 0.9, t1: 1.04 };
    this.mixer = new THREE.AnimationMixer(m);
    this.acts = {};
    this.hw = {};
    for (const c of hero.clips) { const a = this.mixer.clipAction(c); a.play(); a.setEffectiveWeight(0); this.acts[c.name] = a; this.hw[c.name] = 0; }
    if (this.acts.jump) this.acts.jump.timeScale = 0;       // waktu lompat diatur manual dari kecepatan vertikal
    // jalan & lari berbagi satu fase langkah (0..1) supaya kaki tidak bertabrakan saat berpindah klip
    for (const n of ['walk', 'run']) if (this.acts[n]) this.acts[n].timeScale = 0;
    this.phase = Math.random();                              // ghost/pensiun tidak melangkah serempak
    this.airT = 0;
    this.bones = {};
    m.traverse((o) => { if (o.isBone) for (const n of HERO_BONES) if (!this.bones[n] && o.name.endsWith(n)) this.bones[n] = o; });
    this.heroArm = 0; this.heroArmL = 0;
    this._sh = shadow && !ghost;
    return this;
  }

  _updateHero(dt, s, sp, sy, sxz) {
    // di udara baru dihitung setelah sebentar (atau benar-benar melompat): permukaan tidak rata
    // bikin status menapak berkedip sesaat, dan pose lompat tidak boleh ikut berkedip
    this.airT = s.grounded === false ? this.airT + dt : 0;
    const air = this.airT > 0.12 || (s.grounded === false && (s.vUp || 0) > 3), v = s.speed || 0;
    // bobot klip: diam ↔ jalan ↔ lari, lompat saat di udara
    const move = air ? 0 : THREE.MathUtils.clamp((v - 0.2) / 0.8, 0, 1), run = THREE.MathUtils.clamp((v - 4.6) / 1.6, 0, 1);
    const tgt = { idle: air ? 0 : 1 - move, walk: move * (1 - run), run: move * run, jump: air ? 1 : 0 };
    // klip tambahan (warga): lambai saat menyapa/selebrasi, "interact" saat bekerja di tempat
    const over = this.acts.wave && (this.wave > 0 || this.celebrate > 0) ? 'wave'
      : this.acts.interact && this.activity && this.activity !== 'tunjuk' && !this.stoop && v < 0.05 && !s.talking && !air ? 'interact' : null;
    if (over) { for (const n in tgt) tgt[n] *= 0; tgt[over] = 1; }
    for (const n in this.acts) { this.hw[n] = damp(this.hw[n], tgt[n] ?? 0, air ? 18 : 10, dt); this.acts[n].setEffectiveWeight(this.hw[n]); }
    const W = this.acts.walk, Rn = this.acts.run;
    if (W && Rn) {
      const wd = W.getClip().duration, rd = Rn.getClip().duration;
      const rate = THREE.MathUtils.lerp(THREE.MathUtils.clamp(v / 2.6, 0.8, 1.9) / wd, THREE.MathUtils.clamp(v / 6, 0.9, 1.5) / rd, run);
      this.phase = (this.phase + dt * rate) % 1;
      W.time = this.phase * wd;
      Rn.time = ((this.phase + this.runOfs) % 1) * rd;       // selisih fase diukur dari posisi kaki (loadHero)
    }
    if (this.acts.jump && air) this.acts.jump.time = ((J) => J.apex - THREE.MathUtils.clamp((s.vUp || 0) / 8.4, -1, 1) * (J.t1 - J.t0) / 2)(this.jumpAir);
    this.mixer.update(dt);
    // squash & stretch + muncul/menghilang tetap dari pegas karakter
    const k = this.heroK * this.pop * (this.heroS ?? 1), g = this.heroG ?? 1;
    this.hero.scale.set(sxz * k * g, sy * k, sxz * k * g);
    this.hero.updateMatrixWorld(true);
    const B = this.bones;
    // kepala menoleh ke lawan bicara (di atas animasi)
    const up = _a.setFromMatrixColumn(this.root.matrix, 1).normalize().clone();
    turnBone(B.Head, up, this.headYaw * 0.8);
    if (this.stoop && B.Chest) turnBone(B.Chest, _b.setFromMatrixColumn(this.root.matrix, 0).normalize().clone(), this.stoop * 0.7);   // bungkuk (kakek/nenek)
    // lambai (tangan kanan) & selebrasi (dua tangan)
    const wave = this.wave > 0, cel = this.celebrate > 0;
    this.heroArm = damp(this.heroArm, wave || cel ? 1 : 0, 12, dt);
    this.heroArmL = damp(this.heroArmL, cel ? 1 : 0, 12, dt);
    if ((this.heroArm > 0.01 || this.heroArmL > 0.01) && B.Spine2) {
      const side = (bone) => bone.getWorldPosition(_b).sub(B.Spine2.getWorldPosition(new THREE.Vector3())).normalize().clone();
      if (B.RightArm && this.heroArm > 0.01) {
        const sd = side(B.RightArm);
        aimBone(B.RightArm, B.RightForeArm, up.clone().multiplyScalar(1).addScaledVector(sd, 0.45).normalize(), this.heroArm);
        aimBone(B.RightForeArm, B.RightHand, up.clone().addScaledVector(sd, wave ? Math.sin(this.t * 14) * 0.7 : 0.2).normalize(), this.heroArm);
      }
      if (B.LeftArm && this.heroArmL > 0.01) {
        const sd = side(B.LeftArm);
        aimBone(B.LeftArm, B.LeftForeArm, up.clone().addScaledVector(sd, 0.45).normalize(), this.heroArmL);
        aimBone(B.LeftForeArm, B.LeftHand, up.clone().addScaledVector(sd, 0.2).normalize(), this.heroArmL);
      }
    }
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
    if (this.hero) this._updateHero(dt, s, sp, sy, sxz);
  }

  place(pos, up, fwd) {
    const lx = V3().crossVectors(up, fwd).normalize();
    const f = V3().crossVectors(lx, up).normalize();
    this.root.matrix.makeBasis(lx, up, f).setPosition(pos);
    this.root.matrixWorldNeedsUpdate = true;
  }
}
