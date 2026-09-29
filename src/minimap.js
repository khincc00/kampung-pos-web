// Peta: bola dunia ortografis (bisa diputar & di-zoom) + minimap bulat yang berputar mengikuti kamera.
// Medan dipanggang sekali dari fungsi tinggi/warna dunia (dengan bayangan lereng), lalu tiap tampilan
// disampel per piksel. Jalan, rumah, penanda, warga, dan kurir digambar sebagai vektor di atasnya.
import * as THREE from 'three';
import { R, WATER, heightAt, mapColorAt, DISTRICT_DEF, LAKE } from './world.js';
import { DISTRICTS, LANDMARKS } from './story.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const BW = 640, BH = 320;

export function createMaps(world) {
  const baked = new Uint8ClampedArray(BW * BH * 4);
  const M = { ready: false, progress: 0, discovered: new Set(), caches: new Map() };

  // ---------------------------------------------------------------- panggang medan (bertahap agar tidak menahan frame)
  function bake(done) {
    let row = 0;
    const d = V3(), de = V3(), dn = V3();
    const eps = 0.011;
    const dirOf = (lat, lon, out) => out.set(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon));
    const slice = () => {
      const t0 = performance.now();
      while (row < BH && performance.now() - t0 < 9) {
        const lat = Math.PI / 2 - ((row + 0.5) / BH) * Math.PI;
        for (let x = 0; x < BW; x++) {
          const lon = ((x + 0.5) / BW) * TAU - Math.PI;
          dirOf(lat, lon, d);
          const h = heightAt(d);
          let r, g, b;
          if (h < WATER) {
            const depth = Math.min(1, (WATER - h) / 3.2);
            r = 122 - depth * 52; g = 200 - depth * 62; b = 214 - depth * 42;
          } else {
            const c = mapColorAt(d, h, 0.5);
            const he = heightAt(dirOf(lat, lon + eps / Math.max(0.2, Math.cos(lat)), de)), hn = heightAt(dirOf(lat + eps, lon, dn));
            const sh = THREE.MathUtils.clamp(1 + ((h - he) * 0.5 + (hn - h) * 0.5) * 0.9, 0.7, 1.28);
            r = c.r * 255 * sh; g = c.g * 255 * sh; b = c.b * 255 * sh;
            if (h > 6) { const k = Math.min(1, (h - 6) / 5) * 0.22; r += (255 - r) * k; g += (255 - g) * k; b += (240 - b) * k; }
          }
          const i = (row * BW + x) * 4;
          baked[i] = r; baked[i + 1] = g; baked[i + 2] = b; baked[i + 3] = 255;
        }
        row++;
      }
      M.progress = row / BH;
      if (row < BH) setTimeout(slice, 0);
      else { M.ready = true; M.caches.clear(); done?.(); }
    };
    slice();
  }

  // ---------------------------------------------------------------- tampilan
  // view: { c: arah pusat (unit), u: arah "atas layar" (unit, tegak lurus c), k: piksel per radius bola }
  const basis = (view) => { const r = V3().crossVectors(view.u, view.c).normalize(); return { r, u: view.u, c: view.c }; };
  function sample(px, py, pz, out) {
    const lat = Math.asin(py), lon = Math.atan2(pz, px);
    const fx = ((lon + Math.PI) / TAU) * BW - 0.5, fy = ((Math.PI / 2 - lat) / Math.PI) * BH - 0.5;
    let x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = fx - x0, ty = fy - y0;
    const y1 = Math.min(BH - 1, Math.max(0, y0 + 1)); y0 = Math.min(BH - 1, Math.max(0, y0));
    const x1 = ((x0 + 1) % BW + BW) % BW; x0 = ((x0 % BW) + BW) % BW;
    const a = (y0 * BW + x0) * 4, b = (y0 * BW + x1) * 4, c = (y1 * BW + x0) * 4, d = (y1 * BW + x1) * 4;
    for (let i = 0; i < 3; i++) out[i] = (baked[a + i] * (1 - tx) + baked[b + i] * tx) * (1 - ty) + (baked[c + i] * (1 - tx) + baked[d + i] * tx) * ty;
  }
  const _s = [0, 0, 0];
  function renderTerrain(canvas, view, bg) {
    const W = canvas.width, H = canvas.height;
    let cache = M.caches.get(canvas);
    if (!cache || cache.W !== W || cache.H !== H) {
      const off = document.createElement('canvas'); off.width = W; off.height = H;
      cache = { off, g: off.getContext('2d'), img: null, W, H, key: '' };
      cache.img = cache.g.createImageData(W, H);
      M.caches.set(canvas, cache);
    }
    const key = [view.c.x, view.c.y, view.c.z, view.u.x, view.u.y, view.u.z, view.k].map((v) => v.toFixed(4)).join();
    if (cache.key !== key && M.ready) {
      cache.key = key;
      const { r, u, c } = basis(view), data = cache.img.data, cx = W / 2, cy = H / 2, k = view.k;
      for (let y = 0; y < H; y++) {
        const dy = (cy - y - 0.5) / k;
        for (let x = 0; x < W; x++) {
          const dx = (x + 0.5 - cx) / k, rr = dx * dx + dy * dy, i = (y * W + x) * 4;
          if (rr >= 0.9985) { data[i] = bg[0]; data[i + 1] = bg[1]; data[i + 2] = bg[2]; data[i + 3] = bg[3] ?? 255; continue; }
          const dz = Math.sqrt(1 - rr);
          sample(r.x * dx + u.x * dy + c.x * dz, r.y * dx + u.y * dy + c.y * dz, r.z * dx + u.z * dy + c.z * dz, _s);
          const edge = rr > 0.93 ? 1 - (rr - 0.93) * 4.2 : 1;
          data[i] = _s[0] * edge; data[i + 1] = _s[1] * edge; data[i + 2] = _s[2] * edge; data[i + 3] = 255;
        }
      }
      cache.g.putImageData(cache.img, 0, 0);
    }
    return cache.off;
  }
  const project = (view, W, H, p, out = [0, 0, 0]) => {
    const { r, u, c } = view._b || (view._b = basis(view));
    out[0] = W / 2 + p.dot(r) * view.k; out[1] = H / 2 - p.dot(u) * view.k; out[2] = p.dot(c);
    return out;
  };
  const _p = [0, 0, 0], _q = [0, 0, 0];
  const tangentOffset = (dir, tang, meters) => dir.clone().addScaledVector(tang, meters / R).normalize();

  /** Gambar peta ke canvas. st: { player:{pos,fwd}, targetDir, targetPin, npcs[], discovered:Set, mini:boolean, hover, t } */
  function draw(canvas, view, st) {
    const g = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    view._b = null;
    const mini = !!st.mini;
    const sc = W / (mini ? 160 : 560);                       // skala teks/garis relatif ukuran kanvas
    g.clearRect(0, 0, W, H);
    if (!M.ready) {
      g.fillStyle = '#5fb3c4'; g.fillRect(0, 0, W, H); g.fillStyle = '#fff'; g.font = `700 ${14 * sc}px Karla, sans-serif`; g.textAlign = 'center';
      g.fillText(`Menggambar peta… ${Math.round(M.progress * 100)}%`, W / 2, H / 2); return;
    }
    if (mini) { g.save(); g.beginPath(); g.arc(W / 2, H / 2, W / 2 - 1, 0, TAU); g.clip(); }
    const bg = mini ? [95, 179, 196, 255] : [43, 33, 26, 0];
    g.drawImage(renderTerrain(canvas, view, bg), 0, 0);
    const ppm = (view.k / R);                                // piksel per meter di pusat
    const vis = (p) => project(view, W, H, p, _p)[2] > 0.03;

    // jalan
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const pass of [0, 1]) {
      g.strokeStyle = pass ? '#dcc79c' : '#8b6a45'; g.lineWidth = Math.max(1.5, ppm * (pass ? 2.6 : 3.6));
      for (const pts of world.roads) {
        let open = false; g.beginPath();
        for (const p of pts) { const pr = project(view, W, H, p, _p); if (pr[2] > 0.03) { if (!open) { g.moveTo(pr[0], pr[1]); open = true; } else g.lineTo(pr[0], pr[1]); } else open = false; }
        g.stroke();
      }
    }
    // pohon (tajuk bulat berbayang) dan kelapa (bintang kecil)
    if (ppm > 0.9) for (const t of world.plants) {
      if (!vis(t.dir)) continue;
      const pr = project(view, W, H, t.dir, _p), r = Math.max(1.6, t.r * ppm);
      if (t.palm) { g.strokeStyle = '#3f7a3a'; g.lineWidth = Math.max(1, r * 0.35); g.beginPath(); for (let a = 0; a < 5; a++) { g.moveTo(pr[0], pr[1]); g.lineTo(pr[0] + Math.cos(a * 1.257) * r * 1.5, pr[1] + Math.sin(a * 1.257) * r * 1.5); } g.stroke(); continue; }
      g.fillStyle = 'rgba(40,86,40,0.85)'; g.beginPath(); g.arc(pr[0] + r * 0.12, pr[1] + r * 0.12, r, 0, TAU); g.fill();
      g.fillStyle = '#5f9c47'; g.beginPath(); g.arc(pr[0], pr[1], r * 0.86, 0, TAU); g.fill();
      g.fillStyle = '#86c25e'; g.beginPath(); g.arc(pr[0] - r * 0.25, pr[1] - r * 0.25, r * 0.4, 0, TAU); g.fill();
    }
    // rumah (denah): rumah cerita penuh, rumah warga lebih kecil
    const drawHouse = (h) => {
      if (!vis(h.dir)) return;
      const f = h.lz, lx = V3().crossVectors(h.dir, f).normalize();
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => {
        const p = h.dir.clone().addScaledVector(lx, (a * h.w) / 2 / R).addScaledVector(f, (b * h.d) / 2 / R).normalize();
        return project(view, W, H, p, [0, 0, 0]);
      });
      g.beginPath(); corners.forEach((c, i) => (i ? g.lineTo(c[0], c[1]) : g.moveTo(c[0], c[1]))); g.closePath();
      g.fillStyle = h.roof; g.fill(); g.strokeStyle = 'rgba(59,42,32,0.75)'; g.lineWidth = Math.max(0.8, ppm * 0.3); g.stroke();
      // sisi pintu (depan) diberi garis terang
      g.beginPath(); g.moveTo(corners[2][0], corners[2][1]); g.lineTo(corners[3][0], corners[3][1]); g.strokeStyle = h.wall; g.lineWidth = Math.max(1, ppm * 0.6); g.stroke();
    };
    if (!mini || ppm > 1.6) for (const h of world.houses) drawHouse(h);
    // nama distrik
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (!mini) {
      for (const [k, d] of Object.entries(DISTRICT_DEF)) {
        if (!vis(d.dir)) continue;
        const pr = project(view, W, H, d.dir, _p);
        const isT = st.targetDistrict === k;
        if (isT) { g.strokeStyle = '#ff7a3d'; g.lineWidth = 3 * sc; g.setLineDash([6 * sc, 5 * sc]); g.beginPath(); g.arc(pr[0], pr[1], d.r * ppm * 0.95, 0, TAU); g.stroke(); g.setLineDash([]); }
        const label = DISTRICTS[k].short;
        g.font = `800 ${13 * sc}px Karla, sans-serif`;
        const w = g.measureText(label).width + 12 * sc;
        g.fillStyle = 'rgba(254,249,239,0.86)'; g.beginPath(); g.roundRect(pr[0] - w / 2, pr[1] - d.r * ppm * 0.62 - 10 * sc, w, 20 * sc, 8 * sc); g.fill();
        g.fillStyle = isT ? '#c45a2c' : '#3b2a20'; g.fillText(label, pr[0], pr[1] - d.r * ppm * 0.62);
      }
      // danau
      const lp = project(view, W, H, LAKE, _p);
      if (lp[2] > 0.05) { g.font = `italic 700 ${13 * sc}px Karla, sans-serif`; g.fillStyle = 'rgba(28,78,100,0.85)'; g.fillText('Danau', lp[0], lp[1]); }
    }
    // landmark
    g.font = `${(mini ? 12 : 20) * sc}px system-ui, "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
    for (const L of LANDMARKS) {
      const s = world.spots[L.spot]; if (!s) continue;
      const found = st.discovered.has(L.id);
      if (mini && !found) continue;
      const dir = s.pos.clone().normalize();
      if (!vis(dir)) continue;
      const pr = project(view, W, H, dir, _p);
      if (!found) { g.globalAlpha = 0.6; g.fillStyle = 'rgba(59,42,32,0.55)'; g.beginPath(); g.arc(pr[0], pr[1], 9 * sc, 0, TAU); g.fill(); g.fillStyle = '#fef9ef'; g.font = `800 ${13 * sc}px Karla, sans-serif`; g.fillText('?', pr[0], pr[1] + 1); g.globalAlpha = 1; g.font = `${20 * sc}px system-ui, "Apple Color Emoji", "Noto Color Emoji", sans-serif`; continue; }
      if (!mini) { g.fillStyle = 'rgba(254,249,239,0.9)'; g.beginPath(); g.arc(pr[0], pr[1], 12 * sc, 0, TAU); g.fill(); g.strokeStyle = '#3b2a20'; g.lineWidth = 1.5 * sc; g.stroke(); }
      g.fillStyle = '#000'; g.fillText(L.icon, pr[0], pr[1] + 1 * sc);
      if (!mini && st.hover === L.id) { g.font = `800 ${13 * sc}px Karla, sans-serif`; const w = g.measureText(L.label).width + 12 * sc; g.fillStyle = '#3b2a20'; g.beginPath(); g.roundRect(pr[0] - w / 2, pr[1] + 15 * sc, w, 20 * sc, 8 * sc); g.fill(); g.fillStyle = '#fef9ef'; g.fillText(L.label, pr[0], pr[1] + 25 * sc); g.font = `${20 * sc}px system-ui, "Apple Color Emoji", "Noto Color Emoji", sans-serif`; }
    }
    // warga (titik)
    for (const n of st.npcs || []) {
      if (!vis(n.dir)) continue;
      const pr = project(view, W, H, n.dir, _p);
      g.fillStyle = n.color; g.strokeStyle = 'rgba(59,42,32,0.85)'; g.lineWidth = Math.max(1, sc);
      g.beginPath(); g.arc(pr[0], pr[1], (n.big ? 3.6 : 2.4) * sc, 0, TAU); g.fill(); g.stroke();
    }
    // tujuan surat
    if (st.targetDir) {
      const pr = project(view, W, H, st.targetDir, _p), pulse = (Math.sin((st.t || 0) * 4) + 1) / 2;
      if (pr[2] > 0.03) {
        g.strokeStyle = '#d9483b'; g.lineWidth = 2.5 * sc; g.beginPath(); g.arc(pr[0], pr[1], (6 + pulse * 5) * sc, 0, TAU); g.stroke();
        g.fillStyle = '#d9483b'; g.strokeStyle = '#fef9ef'; g.lineWidth = 1.5 * sc; g.beginPath(); g.arc(pr[0], pr[1], 4.5 * sc, 0, TAU); g.fill(); g.stroke();
      } else if (mini) { /* di belakang bola: tak digambar */ }
      else { g.fillStyle = '#d9483b'; g.font = `800 ${12 * sc}px Karla, sans-serif`; g.fillText('tujuan di sisi lain planet ↻', W / 2, H - 14 * sc); }
      // panah di tepi minimap kalau tujuan di luar tampilan
      if (mini) {
        const dx = pr[0] - W / 2, dy = pr[1] - H / 2, dd = Math.hypot(dx, dy), lim = W / 2 - 9 * sc;
        if (pr[2] <= 0.03 || dd > lim) {
          const a = pr[2] <= 0.03 ? Math.atan2(-(st.targetDir.dot(view.u)), st.targetDir.dot(V3().crossVectors(view.u, view.c))) : Math.atan2(dy, dx);
          const ex = W / 2 + Math.cos(a) * lim, ey = H / 2 + Math.sin(a) * lim;
          g.save(); g.translate(ex, ey); g.rotate(a); g.fillStyle = '#d9483b'; g.strokeStyle = '#fef9ef'; g.lineWidth = 1.5 * sc;
          g.beginPath(); g.moveTo(7 * sc, 0); g.lineTo(-5 * sc, -5 * sc); g.lineTo(-2 * sc, 0); g.lineTo(-5 * sc, 5 * sc); g.closePath(); g.fill(); g.stroke(); g.restore();
        }
      }
    }
    // pemain
    {
      const pr = project(view, W, H, st.player.dir, _p);
      if (pr[2] > 0.03) {
        const q = project(view, W, H, tangentOffset(st.player.dir, st.player.fwd, 1.5), _q);
        const a = Math.atan2(q[1] - pr[1], q[0] - pr[0]);
        g.save(); g.translate(pr[0], pr[1]); g.rotate(a);
        g.fillStyle = 'rgba(255,122,61,0.28)'; g.beginPath(); g.arc(0, 0, (mini ? 11 : 15) * sc, 0, TAU); g.fill();
        g.fillStyle = '#ff7a3d'; g.strokeStyle = '#3b2a20'; g.lineWidth = 2 * sc;
        g.beginPath(); g.moveTo(9 * sc, 0); g.lineTo(-6 * sc, -6 * sc); g.lineTo(-3 * sc, 0); g.lineTo(-6 * sc, 6 * sc); g.closePath(); g.fill(); g.stroke();
        g.restore();
        if (!mini) { g.font = `800 ${12 * sc}px Karla, sans-serif`; g.fillStyle = '#3b2a20'; g.fillText('Kamu', pr[0], pr[1] - 17 * sc); }
      }
    }
    if (mini) g.restore();
  }

  // ---------------------------------------------------------------- pengelola tampilan bola (drag / zoom)
  const tmpQ = new THREE.Quaternion();
  function rotateView(view, dxPx, dyPx) {
    const { r, u } = basis(view);
    const ax = dxPx / view.k, ay = dyPx / view.k;
    // geser isi peta: putar bola supaya titik yang diseret ikut bergerak
    tmpQ.setFromAxisAngle(u, -ax); view.c.applyQuaternion(tmpQ).normalize(); view.u.applyQuaternion(tmpQ).normalize();
    const r2 = V3().crossVectors(view.u, view.c).normalize();
    tmpQ.setFromAxisAngle(r2, -ay); view.c.applyQuaternion(tmpQ).normalize(); view.u.applyQuaternion(tmpQ).normalize();
    view.u.addScaledVector(view.c, -view.u.dot(view.c)).normalize();
  }
  function centerOn(view, dir, heading) {
    view.c.copy(dir);
    if (heading) view.u.copy(heading);
    view.u.addScaledVector(view.c, -view.u.dot(view.c));
    if (view.u.lengthSq() < 1e-6) view.u.copy(Math.abs(dir.y) < 0.9 ? V3(0, 1, 0) : V3(1, 0, 0));
    view.u.addScaledVector(view.c, -view.u.dot(view.c)).normalize();
  }
  function hitLandmark(canvas, view, x, y, discovered) {
    const W = canvas.width, H = canvas.height; let best = null, bd = 22 * (W / 560);
    view._b = null;
    for (const L of LANDMARKS) {
      const s = world.spots[L.spot]; if (!s) continue;
      const pr = project(view, W, H, s.pos.clone().normalize(), [0, 0, 0]);
      if (pr[2] < 0.03) continue;
      const d = Math.hypot(pr[0] - x, pr[1] - y);
      if (d < bd) { bd = d; best = L; }
    }
    return best;
  }
  return { M, bake, draw, rotateView, centerOn, hitLandmark, get ready() { return M.ready; } };
}
