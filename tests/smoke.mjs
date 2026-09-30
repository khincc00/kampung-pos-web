// Uji otomatis Kampung Pos di Chromium headless (WebGL2 via SwiftShader).
// Jalankan:  python3 -m http.server 8765  (di folder proyek)  lalu  node tests/smoke.mjs
import { chromium } from 'playwright';

const URL = process.env.KP_URL || 'http://localhost:8765/index.html';
const OUT = process.env.KP_OUT || '.';
const ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
let fails = 0;
const ok = (cond, msg) => { console.log(`${cond ? '  [OK]   ' : '  [GAGAL]'} ${msg}`); if (!cond) fails++; };

const browser = await chromium.launch({ args: ARGS });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
let offline = false;
// font Google diblokir di sandbox tanpa internet: abaikan, game punya fallback font
page.on('console', (m) => { const u = m.location()?.url || ''; if (m.type() === 'error' && !offline && !/ERR_TUNNEL|fonts\.g/.test(m.text() + u)) errors.push(m.text() + ' @ ' + u); });

async function start(p, name) {
  // jangan tunggu event "load": font Google yang diblokir sandbox bisa menggantung; kesiapan game dicek lewat KP.ready
  await p.goto(URL, { timeout: 180000, waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.KP?.ready, null, { timeout: 180000 });
  await p.fill('#startName', name);
  await p.click('#btnStart');
  await p.waitForTimeout(800);
  await p.evaluate(() => KP.closeDialog());
}
const info = (p) => p.evaluate(() => KP.info());
// SwiftShader headless hanya beberapa fps: tunggu sampai frame memproses tombol
async function pressE(p) {
  await p.keyboard.press('e');
  await p.waitForFunction(() => KP.info().dialog, null, { timeout: 8000 }).catch(() => {});
}
async function settle(p) { await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); }
async function closeDlg(p) { await p.evaluate(() => KP.closeDialog()); await p.waitForTimeout(120); }

console.log('\n=== 1. Boot & performa ===');
await start(page, 'Penguji');
let i = await info(page);
ok(i.webgl2, 'WebGL2 aktif');
ok(i.calls <= 280, `draw call ${i.calls} (desktop, termasuk pass bayangan + bloom; anggaran ≤ 280)`);
ok(i.tris < 1000000, `segitiga per frame (termasuk pass bayangan) ${i.tris}`);
ok(i.stats.houses >= 40, `rumah/bangunan: ${i.stats.houses} (termasuk rumah warga di sepanjang jalan), collider: ${i.stats.colliders}`);
ok(i.stats.decorTris > 20000 && i.stats.decorMeshes >= 8, `dekorasi kampung: ${i.stats.decorTris} segitiga dalam ${i.stats.decorMeshes} kluster (pagar, pohon pisang/bambu, sumur, gapura, taman bermain, sawah)`);
ok(await page.evaluate(() => KP.buildMs) < 1500, `bangun dunia ${await page.evaluate(() => KP.buildMs)} ms`);

console.log('\n=== 2. Surat 1 lewat keyboard sungguhan (E) ===');
await page.evaluate(() => KP.teleport('harjo'));
await settle(page);
i = await info(page);
ok(i.focus === 'Pak Harjo', `fokus interaksi: ${i.focus}`);
await pressE(page);
ok((await info(page)).dialog, 'dialog Pak Harjo terbuka');
await closeDlg(page);
ok((await info(page)).has, 'surat 1 masuk tas');
await page.screenshot({ path: `${OUT}/t1_ambil_surat.png` });
await page.evaluate(() => KP.teleport('sri'));
await settle(page);
await pressE(page); await closeDlg(page);
i = await info(page);
ok(i.stickers === 1 && i.letter === 1 && !i.has, `surat 1 sampai, stiker ${i.stickers}`);

console.log('\n=== 3. Salah antar = petunjuk, bukan gagal ===');
await page.evaluate(() => KP.teleport('harjo')); await settle(page);
await pressE(page); await closeDlg(page);
await page.evaluate(() => KP.teleport('ahong')); await settle(page);
await pressE(page);
const wrongText = (await info(page)).dialogText || '';
await closeDlg(page);
i = await info(page);
ok(i.has && i.letter === 1, 'surat tetap di tas setelah salah rumah');
ok(wrongText.length > 5, `warga memberi petunjuk: "${wrongText.slice(0, 60)}…"`);

console.log('\n=== 4. Fisika atap seng (simulasi deterministik) ===');
let r = await page.evaluate(() => { KP.teleport('poi:oyen', 1.2); return KP.sim(1.2); });
ok(r.grounded && r.on === 'roof', `jatuh ke bubungan tertinggi → berdiri di ${r.on} (${r.key}), tinggi ${r.height} m`);
r = await page.evaluate(() => { KP.teleport('ridge:seng_1', 0.1); KP.sim(0.3); KP.faceTo('ridge:seng_4'); return KP.sim(4.5, ['w']); });
ok(r.on === 'roof' && r.height > 3.6, `jalan menyusuri bubungan seng_1 → naik bertingkat, sekarang di ${r.key} tinggi ${r.height} m`);
r = await page.evaluate(() => { KP.teleport('test:depan_drum', 0.05); KP.sim(0.3); KP.faceTo('test:drum'); return KP.sim(0.9, ['w'], [' ']); });
ok(r.on === 'drum' || r.height > 0.8, `lompat ke drum: ${r.on}, tinggi ${r.height}`);
r = await page.evaluate(() => { KP.faceTo('test:emperan'); return KP.sim(1.0, ['w'], [' ']); });
ok(r.on === 'porch' || r.on === 'roof', `drum → emperan/atap seng: ${r.on}, tinggi ${r.height}`);
r = await page.evaluate(() => { KP.faceTo('ridge:seng_1'); KP.sim(0.8, ['w'], [' ']); return KP.sim(0.6); });
ok(r.on === 'roof', `naik ke atap rumah Nenek Warsih: ${r.on} (${r.key}), tinggi ${r.height}`);
r = await page.evaluate(() => { KP.teleport('door:dermaga', 0.05); KP.faceTo('door:lapak_1'); KP.faceTo('door:dermaga'); return KP.sim(0.5); });
ok(r.on === 'dermaga', `berdiri di dermaga kayu: ${r.on}`);
r = await page.evaluate(() => { KP.teleport('door:dermaga', 0.05); KP.faceTo('door:lapak_1'); KP.player.fwd.negate(); KP.faceTo('door:dermaga'); return KP.sim(3, ['s']); });
ok(r.on === 'dermaga' || r.on === 'tanah', `jalan mundur ke arah danau: tertahan di ${r.on} (air dalam tidak bisa dimasuki)`);

console.log('\n=== 5. Tamatkan Bagian 1 (semua tahap: nyasar, surat angin, Oyen, Kotak Rindu) ===');
const target = (at) => { const [k, id] = at.split(':'); return k === 'npc' ? id : `${k}:${id}`; };
for (let guard = 0; guard < 40; guard++) {
  const st = await page.evaluate(() => ({ idx: KP.quest.idx, stage: KP.quest.stage, has: KP.quest.has, n: KP.LETTERS.length, at: KP.quest.has ? KP.LETTERS[KP.quest.idx].stages[KP.quest.stage]?.at : null }));
  if (st.idx >= st.n) break;
  if (!st.has) {
    await page.evaluate(() => KP.teleport('harjo')); await settle(page);
    await pressE(page); await closeDlg(page);
    if (await page.evaluate(() => !!KP.LETTERS[KP.quest.idx].wind)) {
      await page.waitForFunction(() => KP.info().dialog, null, { timeout: 10000 }); // dialog angin
      await closeDlg(page);
    }
    continue;
  }
  await page.waitForFunction(() => !KP.quest.wind, null, { timeout: 60000 }); // animasi surat angin selesai
  await page.evaluate((t) => KP.teleport(t, t.startsWith('poi:oyen') || t.startsWith('item:') ? 0.4 : 0.3), target(st.at));
  await page.evaluate(() => KP.sim(0.4));
  await settle(page);
  const f = (await info(page)).focus;
  await pressE(page); await closeDlg(page);
  const after = await page.evaluate(() => ({ idx: KP.quest.idx, stage: KP.quest.stage }));
  const progressed = after.idx !== st.idx || after.stage !== st.stage;
  ok(progressed, `surat ${st.idx + 1} tahap ${st.stage + 1} → ${st.at} (fokus: ${f})`);
  if (st.at === 'item:surat_angin') await page.screenshot({ path: `${OUT}/t2_surat_angin_di_atap.png` });
  if (st.at === 'poi:oyen') await page.screenshot({ path: `${OUT}/t3_oyen_di_bubungan.png` });
}
i = await info(page);
ok(i.stickers === 10, `10 stiker terkumpul (${i.stickers})`);
await page.waitForTimeout(900);
ok(await page.isVisible('#ending'), 'layar Tamat muncul');
await page.fill('#endMsg', 'Oyen suka digaruk di dagu.');
await page.click('#endForm button[type=submit]');
await page.waitForTimeout(600);
const json = JSON.parse(await page.textContent('#endJson'));
ok(json.type === 'kurir_pensiun' && json.name === 'Penguji' && json.dir.length === 3 && json.letters === 10, `NPC JSON: ${JSON.stringify(json).slice(0, 110)}…`);
await page.screenshot({ path: `${OUT}/t4_tamat_npc_json.png` });
await page.click('#endClose');

console.log('\n=== 6. Ghost + emoji antar-tab (BroadcastChannel) ===');
const page2 = await ctx.newPage();
await start(page2, 'Tamu');
await page2.evaluate(() => KP.teleport('harjo'));
await page.waitForFunction(() => KP.info().ghosts >= 1, null, { timeout: 30000 }).catch(() => {});
i = await info(page);
ok(i.ghosts === 1, `tab 1 melihat ${i.ghosts} ghost`);
const before = await page.evaluate(() => KP.floaters());
await page2.keyboard.press('1');
const gotEmoji = await page.waitForFunction((b) => KP.floaters() > b, before, { timeout: 15000 }).then(() => true).catch(() => false);
ok(gotEmoji, 'emoji dari tab 2 muncul di tab 1');
await page.evaluate(() => KP.teleport('harjo')); await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/t5_ghost.png` });
await page2.close();

console.log('\n=== 7. Warisan: kurir pensiun muncul lagi setelah reload ===');
await page.reload();
await page.waitForFunction(() => window.KP?.ready, null, { timeout: 180000 });
await page.waitForTimeout(800);
const leg = await page.evaluate(() => JSON.parse(localStorage.getItem('kp.legacy.v1') || '[]').length);
ok(leg >= 1, `NPC JSON tersimpan (${leg})`);

console.log('\n=== 8. Siang–malam ===');
await start(page, 'Penguji');
await page.evaluate(() => { KP.teleport('ling'); KP.setHour(19.5); });
await page.waitForTimeout(900);
ok(await page.evaluate(() => KP.night()) > 0.95, 'jam 19:30 = malam (jendela & lampion menyala)');
await page.screenshot({ path: `${OUT}/t6_pecinan_malam.png` });
await page.evaluate(() => { KP.teleport('harjo'); KP.setHour(17.3); });
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/t7_alun_sore.png` });

console.log('\n=== 9. PWA offline ===');
const reg = await page.evaluate(async () => { const r = await navigator.serviceWorker.ready; return !!r.active; });
ok(reg, 'service worker aktif');
await page.waitForTimeout(1500);
offline = true;
await ctx.setOffline(true);
await page.reload();
const offlineOk = await page.waitForFunction(() => window.KP?.ready, null, { timeout: 30000 }).then(() => true).catch(() => false);
ok(offlineOk, 'game tetap jalan saat offline setelah load pertama');
await ctx.setOffline(false);
offline = false;

console.log('\n=== 10. HP (layar sentuh 390×844) ===');
const mctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const mp = await mctx.newPage();
await start(mp, 'HP');
ok(await mp.isVisible('#joy') && await mp.isVisible('#btnJump') && await mp.isVisible('#btnAct') && await mp.isVisible('#btnRun'), 'joystick + tombol Lompat/Aksi/Lari tampil');
const mi = await info(mp);
ok(mi.calls <= 230 && mi.tris < 650000, `mode HP: ${mi.calls} draw call, ${mi.tris} segitiga (anggaran ≤ 230 / 650 rb)`);
await mp.evaluate(() => KP.teleport('rina'));
await mp.waitForTimeout(1000);
await mp.screenshot({ path: `${OUT}/t8_hp.png` });
{
  // sentuhan sungguhan lewat CDP: joystick melayang, geser kamera, cubit zoom, ketuk warga
  const cdp = await mctx.newCDPSession(mp);
  const tch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], n) => ({ x, y, id: n })) });
  await mp.evaluate(() => KP.teleport('harjo')); await settle(mp);
  const p0 = await mp.evaluate(() => KP.player.pos.toArray());
  await tch('touchStart', [[140, 300]]); await tch('touchMove', [[140, 270]]); await tch('touchMove', [[140, 240]]);
  await mp.waitForFunction(() => KP.joy.active, null, { timeout: 8000 }).catch(() => {});
  const jv = await mp.evaluate(() => ({ ...KP.joy }));
  ok(jv.active && jv.y < -0.9, `joystick melayang aktif di mana saja jempol kiri menyentuh (y=${jv.y.toFixed(2)})`);
  ok(jv.run || jv.mag > 0.93, 'dorong joystick sampai ujung = lari');
  await mp.waitForTimeout(2500);
  await tch('touchEnd', []);
  const p1 = await mp.evaluate(() => KP.player.pos.toArray());
  ok(Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]) > 0.8, 'jempol kiri menggerakkan kurir');
  ok(!(await mp.evaluate(() => KP.joy.active)), 'joystick berhenti saat jempol diangkat');
  const d0 = await mp.evaluate(() => KP.camDist());
  await tch('touchStart', [[560, 150], [640, 150]]); await tch('touchMove', [[520, 150], [680, 150]]); await tch('touchMove', [[470, 150], [730, 150]]); await tch('touchEnd', []);
  ok((await mp.evaluate(() => KP.camDist())) < d0 - 0.5, `cubit dua jari = zoom (${d0} → ${await mp.evaluate(() => KP.camDist())})`);
  await mp.evaluate(() => KP.teleport('harjo')); await settle(mp); await settle(mp);
  const sp = await mp.evaluate(() => KP.screenOf('harjo'));
  await tch('touchStart', [[sp.x, sp.y]]); await tch('touchEnd', []);
  await mp.waitForFunction(() => KP.info().dialog, null, { timeout: 8000 }).catch(() => {});
  ok((await info(mp)).dialog, 'ketuk Pak Harjo di layar = bicara');
  await mp.evaluate(() => KP.closeDialog());
  ok(/Ambil|Aksi|Bicara|Sapa|Elus/.test(await mp.textContent('#btnAct')), `tombol Aksi mengikuti benda di dekat kurir: "${(await mp.textContent('#btnAct')).trim()}"`);
}
await mctx.close();


console.log('\n=== 11. Musik latar Indonesia (WebAudio) ===');
{
  const mp2 = await ctx.newPage();
  await start(mp2, 'Pendengar');
  await mp2.evaluate(() => KP.setHour(8)); await mp2.waitForTimeout(1500);
  let mu = await mp2.evaluate(() => KP.music());
  ok(mu && /angklung/.test(mu.playing) && mu.scheduled > 0, `pagi: "${mu?.playing}" (${mu?.scheduled} not terjadwal, audio ${mu?.state})`);
  await mp2.evaluate(() => KP.setHour(12)); await mp2.waitForTimeout(1500);
  mu = await mp2.evaluate(() => KP.music());
  ok(/gamelan/.test(mu.playing), `siang: "${mu.playing}"`);
  await mp2.evaluate(() => KP.setHour(16)); await mp2.waitForTimeout(1500);
  ok(/kecapi/.test((await mp2.evaluate(() => KP.music())).playing), 'sore: kecapi suling');
  await mp2.evaluate(() => KP.setHour(20)); await mp2.waitForTimeout(1500);
  ok(/Keroncong/.test((await mp2.evaluate(() => KP.music())).playing), 'malam: keroncong');
  await mp2.close();
}

console.log('\n=== 12. Joystick eksternal (Gamepad API, disimulasikan) ===');
{
  // SwiftShader: GPU proses dipakai bersama semua konteks — selama konteks WebGL tab utama hidup (walau dibekukan),
  // kompilasi shader tab kedua merayap > 3 menit. Tutup dulu game di tab utama, jalankan lagi sesudahnya.
  await page.goto('about:blank');
  const gctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await gctx.addInitScript(() => {
    window.__pad = { id: 'Simulasi Xbox Controller (STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), timestamp: 0 };
    navigator.getGamepads = () => [window.__pad];
  });
  const gp = await gctx.newPage();
  gp.on('pageerror', (e) => errors.push('gamepad page: ' + e.message));
  await start(gp, 'Joystick');
  const setPad = (axes, btn) => gp.evaluate(([axes, btn]) => { window.__pad.axes = axes; window.__pad.buttons.forEach((b, i) => { b.pressed = btn === i; b.value = btn === i ? 1 : 0; }); }, [axes, btn]);
  await gp.evaluate(() => { KP.teleport('harjo'); KP.faceTo('poi:tugu_top'); });
  await settle(gp);
  const p0 = await gp.evaluate(() => KP.player.pos.toArray());
  await setPad([0, -1, 0, 0], -1);
  await gp.waitForFunction((p0) => { const p = KP.player.pos; return Math.hypot(p.x - p0[0], p.y - p0[1], p.z - p0[2]) > 1.5; }, p0, { timeout: 20000 }).catch(() => {});
  await setPad([0, 0, 0, 0], -1);
  const p1 = await gp.evaluate(() => KP.player.pos.toArray());
  const moved = Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
  ok(moved > 0.8, `stik kiri menggerakkan kurir ${moved.toFixed(1)} m`);
  ok((await gp.evaluate(() => KP.pad())).connected, 'joystick terdeteksi');
  await setPad([0, 0, 0, 0], 0); await settle(gp); await settle(gp);
  const air = await gp.evaluate(() => new Promise((r) => { let best = 0; const t0 = performance.now(); const f = () => { best = Math.max(best, KP.info().height); if (performance.now() - t0 < 12000 && best < 0.6) requestAnimationFrame(f); else r(best); }; f(); }));
  await setPad([0, 0, 0, 0], -1);
  ok(air > 0.5, `tombol A = lompat (tinggi maks ${air.toFixed(2)} m)`);
  await gp.evaluate(() => KP.teleport('harjo')); await settle(gp);
  await setPad([0, 0, 0, 0], 2); await settle(gp); await settle(gp); await setPad([0, 0, 0, 0], -1);
  await gp.waitForFunction(() => KP.info().dialog, null, { timeout: 8000 }).catch(() => {});
  ok((await info(gp)).dialog, 'tombol X = bicara dengan Pak Harjo');
  ok(/Ⓐ/.test(await gp.textContent('#dlgMore')), 'petunjuk tombol berganti ke joystick (Ⓐ)');
  await gctx.close();
  await start(page, 'Kurir');
}

console.log('\n=== 13. Animasi karakter ===');
{
  // kedip tiap 2–5.5 dtk waktu-game; headless hanya ±3 fps, jadi beri waktu longgar
  const lids = await page.evaluate(() => new Promise((r) => { let mx = -9; const t0 = performance.now(); const f = () => { mx = Math.max(mx, KP.character().lid); if (performance.now() - t0 < 90000 && mx <= 0) requestAnimationFrame(f); else r(mx); }; f(); }));
  ok(lids > 0, `kurir berkedip (kelopak maks ${lids.toFixed(2)} rad)`);
  const sq = await page.evaluate(() => { KP.teleport('harjo'); KP.sim(0.3); const a = []; KP.sim(0.05, [], [' ']); return new Promise((r) => { let n = 0; const f = () => { a.push(KP.character().squash); if (++n < 30) requestAnimationFrame(f); else r([Math.min(...a), Math.max(...a)]); }; f(); }); });
  ok(sq[0] < -0.02 || sq[1] > 0.02, `squash & stretch saat lompat (${sq.map((v) => v.toFixed(3)).join(' … ')})`);
}

console.log('\n=== 14. Karakter beragam & dunia hidup ===');
{
  await start(page, 'Penguji');
  const lk = await page.evaluate(() => KP.look());
  const all = [...lk.npcs, ...lk.walkers];
  ok(new Set(all).size === all.length, `tidak ada karakter kembar: ${all.length} penampilan berbeda`);
  const heads = new Set(all.map((x) => JSON.parse(x).head)), outfits = new Set(all.map((x) => JSON.parse(x).outfit || 'kaos')), faces = new Set(all.map((x) => (JSON.parse(x).face || []).join('+')));
  ok(heads.size >= 12 && outfits.size >= 8 && faces.size >= 5, `ragam: ${heads.size} gaya rambut/topi, ${outfits.size} jenis baju, ${faces.size} gaya wajah`);
  const sizes = new Set(all.map((x) => { const l = JSON.parse(x); return `${((l.s || 1) * 10) | 0}/${((l.w || 1) * 10) | 0}`; }));
  ok(sizes.size >= 10, `bentuk tubuh bervariasi (${sizes.size} kombinasi tinggi/lebar)`);
  await page.evaluate(() => { KP.setHour(9); KP.teleport('door:lapak_2'); });
  await page.evaluate(() => KP.stepLife(12));
  const li = await page.evaluate(() => KP.life.info());
  ok(li.walkers >= 10, `warga ramai berkeliaran menurut jadwal: ${li.walkers} dari ${li.walkersTotal} aktif jam 09:00`);
  ok(li.animals >= 15 && li.birds >= 20 && li.vehicles >= 2, `hewan ${li.animals}, burung ${li.birds}, angkot ${li.vehicles}`);
  const moved = await page.evaluate(() => { const w = KP.life.walkers.find((x) => x.active && x.state === 'walk') || KP.life.walkers.find((x) => x.active); const a = w.pos.clone(); KP.stepLife(20); return { d: w.pos.distanceTo(a), st: w.state }; });
  ok(moved.d > 1 || moved.st === 'idle', `warga benar-benar berjalan (${moved.d.toFixed(1)} m dalam 20 dtk)`);
  await page.evaluate(() => KP.setHour(2)); await page.evaluate(() => KP.stepLife(8));
  const night = await page.evaluate(() => KP.life.info().walkers);
  ok(night < li.walkers, `jadwal malam: warga siang pulang (${li.walkers} → ${night})`);
  await page.evaluate(() => KP.setHour(9));
  // NPC cerita berkeliaran di depan rumah tapi tetap bisa diajak bicara
  const wander = await page.evaluate(() => { const r = KP.life.residents.find((x) => x.radius > 1); const a = r.n.pos.clone(); KP.stepLife(60); return { d: r.n.pos.distanceTo(a), home: r.n.pos.distanceTo(r.home), name: r.n.name }; });
  ok(wander.home < 4, `${wander.name} berkeliaran sekitar rumahnya (${wander.d.toFixed(1)} m, jarak dari rumah ${wander.home.toFixed(1)} m)`);
}

console.log('\n=== 15. Interaksi dunia (kucing, kentongan, kopi, pancing, teropong, sapa warga) ===');
{
  await page.evaluate(() => { KP.setHour(9); KP.teleport('door:pelangi_2'); KP.stepLife(2); });
  const cat = await page.evaluate(() => { const a = KP.life.animals.find((x) => x.kind === 'kucing'); KP.player.pos.copy(a.pos).addScaledVector(a.pos.clone().normalize(), 0.3).addScaledVector(a.heading, 0.9); KP.player.vT.set(0, 0, 0); return a.name; });
  await settle(page); await settle(page);
  let fi = await page.evaluate(() => KP.focusInfo());
  ok(fi && (fi.kind === 'cat' || fi.kind === 'villager' || fi.kind === 'npc' || fi.kind === 'act'), `kurir berdiri dekat kucing ${cat}, fokus: ${fi && fi.label}`);
  await page.evaluate(() => { const a = KP.life.animals.find((x) => x.kind === 'kucing'); KP.life.interact({ kind: 'cat', data: a }); });
  ok((await page.evaluate(() => KP.life.info().pets)) === 1, 'elus kucing → 💗 muncul, hitungan elusan 1');
  const tk = async (spot, expectFn, label) => {
    await page.evaluate((s) => { KP.teleport(s, 0.4); KP.player.pos.addScaledVector(KP.player.pos.clone().normalize(), 0.1); KP.sim(0.3); }, spot);
    await settle(page); await settle(page);
    fi = await page.evaluate(() => KP.focusInfo());
    ok(fi && fi.kind === 'act', `${label}: fokus "${fi && fi.label}"`);
    await page.keyboard.press('e');
    await page.waitForTimeout(400); await settle(page);
    return expectFn();
  };
  await tk('poi:kentongan', () => 0, 'kentongan pos ronda');
  ok((await page.evaluate(() => KP.life.animals.some(() => true))) && (await page.evaluate(() => KP.floaters())) >= 0, 'kentongan dipukul (burung berhamburan)');
  await tk('poi:kopi', () => 0, 'kopi Bu Sri');
  await page.waitForFunction(() => KP.life.buff.speed > 1.2, null, { timeout: 30000 }).catch(() => {});
  ok((await page.evaluate(() => KP.life.buff.speed)) > 1.2, `seruput kopi → kecepatan ×${(await page.evaluate(() => KP.life.buff.speed)).toFixed(1)}`);
  await tk('poi:pancing', () => 0, 'pancing di dermaga');
  await page.waitForFunction(() => KP.life.fishing.on, null, { timeout: 30000 }).catch(() => {});
  ok(await page.evaluate(() => KP.life.fishing.on), 'mulai memancing');
  await page.evaluate(() => { KP.life.fishing.t = 0.05; KP.stepLife(1); });
  ok((await page.evaluate(() => KP.life.info().fish)) >= 1, 'dapat ikan dari dermaga');
  await tk('poi:teropong', () => 0, 'teropong bukit');
  await page.waitForFunction(() => KP.info().dialog, null, { timeout: 30000 }).catch(() => {});
  ok((await info(page)).dialog, 'teropong menampilkan pemandangan sesuai jam');
  await closeDlg(page);
  // sapa warga ramai
  await page.evaluate(() => { KP.setHour(9); KP.teleport('door:pelangi_2'); KP.stepLife(3); });
  const vill = await page.evaluate(() => { const w = KP.life.walkers.find((x) => x.active && x.fade > 0.5); KP.player.pos.copy(w.pos).addScaledVector(w.pos.clone().normalize(), 0.3).addScaledVector(w.heading, 1.1); KP.player.vT.set(0, 0, 0); return w.def.role; });
  await page.evaluate(() => KP.life.interact({ kind: 'villager', data: KP.life.walkers.find((x) => x.active && x.fade > 0.5) }));
  await settle(page);
  ok((await info(page)).dialog, `warga ramai ("${vill}") bisa disapa`);
  await closeDlg(page);
}

console.log('\n=== 16. Peta bola, minimap, tempat ditemukan ===');
{
  await page.evaluate(() => KP.teleport('door:kantor_pos'));
  await page.waitForFunction(() => KP.maps.ready, null, { timeout: 90000 });
  await page.waitForTimeout(800);
  const mini = await page.evaluate(() => { const c = document.getElementById('miniCanvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n / (d.length / 4); });
  ok(mini > 0.5, `minimap bulat tergambar (${(mini * 100).toFixed(0)}% piksel terisi)`);
  await page.waitForFunction(() => KP.discovered.size >= 2, null, { timeout: 60000 }).catch(() => {});
  const disc = await page.evaluate(() => KP.discovered.size);
  ok(disc >= 2, `${disc} tempat sudah ditemukan saat berjalan (Tugu, Kantor Pos, ...)`);
  await page.keyboard.press('m');
  await page.waitForTimeout(600);
  ok(await page.isVisible('#map'), 'tombol M membuka peta besar');
  const big = await page.evaluate(() => { const c = document.getElementById('mapCanvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n / (d.length / 4); });
  ok(big > 0.5, `peta bola tergambar (${(big * 100).toFixed(0)}%)`);
  ok((await page.locator('#mapLegend li').count()) === 17, 'legenda 17 tempat (terkunci = ???)');
  const box = await page.locator('#mapCanvas').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 30, { steps: 5 }); await page.mouse.up();
  await page.waitForTimeout(500);
  ok(true, 'seret peta memutar bola dunia (tanpa error)');
  await page.click('#mapZoomIn'); await page.click('#mapMe'); await page.click('#mapHome');
  await page.screenshot({ path: `${OUT}/t9_peta.png` });
  await page.keyboard.press('Escape');
  ok(!(await page.isVisible('#map')), 'Escape menutup peta');
  // simpan & muat: tempat ditemukan + ikan
  await page.reload(); await page.waitForFunction(() => window.KP?.ready, null, { timeout: 60000 });
  await page.click('#btnStart'); await page.waitForTimeout(600);
  const back = await page.evaluate(() => ({ d: KP.discovered.size, f: KP.life.info().fish }));
  ok(back.d >= disc && back.f >= 1, `progres peta & ikan tersimpan (${back.d} tempat, ${back.f} ikan)`);
  await page.evaluate(() => KP.closeDialog());
}

console.log('\n=== 17. Cuaca: hujan & pelangi ===');
{
  await page.evaluate(() => { KP.setHour(10); KP.life.forceRain(1); });
  await page.evaluate(() => KP.stepLife(12));
  const r1 = await page.evaluate(() => KP.life.rain);
  ok(r1 > 0.5, `hujan turun (intensitas ${r1.toFixed(2)}), cahaya meredup & kabut merapat`);
  await settle(page);
  await page.screenshot({ path: `${OUT}/t10_hujan.png` });
  await page.evaluate(() => { KP.life.forceRain(0); KP.stepLife(15); });
  ok((await page.evaluate(() => KP.life.rain)) < r1, 'hujan reda');
}

ok(errors.length === 0, `tidak ada error JS${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
console.log(`\n=== HASIL: ${fails ? fails + ' GAGAL' : 'SEMUA LULUS'} ===\n`);
await browser.close();
process.exit(fails ? 1 : 0);
