// Kontrol layar sentuh: joystick melayang (muncul di mana jempol kiri menyentuh), geser jempol kanan untuk memutar kamera,
// cubit dua jari untuk zoom, tombol Lompat / Aksi / Lari, ketuk warga atau benda untuk berinteraksi (jalan otomatis kalau jauh).
// Semua memakai Pointer Events multi-sentuh, jadi joystick dan kamera bisa dipakai bersamaan.
const $ = (id) => document.getElementById(id);
const vibrate = (ms) => { try { navigator.vibrate?.(ms); } catch {} };

/**
 * hooks: { keys, pressed, joy, rotateCam(yaw,pitch), zoom(delta), onTap(x,y), onManual() }
 * joy: { x, y, mag, active, run }
 */
export function initTouch(hooks) {
  const { keys, pressed, joy } = hooks;
  const root = $('touch');
  const zoneL = $('joyZone'), zoneR = $('lookZone'), base = $('joy'), knob = $('joyKnob');
  const state = { shown: false, runLatch: false, joyId: null };
  const RADIUS = 52;

  function show() {
    if (state.shown) return;
    state.shown = true;
    document.body.classList.add('touch');
    root.hidden = false;
  }

  // ---------------------------------------------------------------- joystick melayang
  let jc = { x: 0, y: 0 };
  const restPos = () => { const r = base.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
  function setBase(x, y) { base.style.left = `${x - base.offsetWidth / 2}px`; base.style.top = `${y - base.offsetHeight / 2}px`; base.style.right = 'auto'; base.style.bottom = 'auto'; }
  function resetBase() { base.style.left = base.style.top = base.style.right = base.style.bottom = ''; }
  function moveJoy(e) {
    let dx = (e.clientX - jc.x) / RADIUS, dy = (e.clientY - jc.y) / RADIUS;
    const l = Math.hypot(dx, dy);
    if (l > 1) {
      // basis ikut terseret supaya jempol tidak "kehabisan jalan"
      const over = (l - 1) * RADIUS;
      jc.x += (dx / l) * over; jc.y += (dy / l) * over; setBase(jc.x, jc.y);
      dx /= l; dy /= l;
    }
    joy.x = dx; joy.y = dy; joy.mag = Math.min(1, l); joy.active = true;
    knob.style.transform = `translate(${dx * 40}px, ${dy * 40}px)`;
  }
  const tapInfo = new Map();
  zoneL.addEventListener('pointerdown', (e) => {
    show();
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    hooks.onManual?.();
    tapInfo.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 });
    if (state.joyId !== null) return;
    state.joyId = e.pointerId; zoneL.setPointerCapture(e.pointerId);
    jc = { x: e.clientX, y: e.clientY };
    setBase(jc.x, jc.y); base.classList.add('on');
    moveJoy(e);
  });
  zoneL.addEventListener('pointermove', (e) => {
    const ti = tapInfo.get(e.pointerId); if (ti) ti.moved = Math.max(ti.moved, Math.hypot(e.clientX - ti.x, e.clientY - ti.y));
    if (e.pointerId === state.joyId) moveJoy(e);
  });
  const endJoy = (e) => {
    const ti = tapInfo.get(e.pointerId); tapInfo.delete(e.pointerId);
    if (e.pointerId !== state.joyId) return;
    state.joyId = null; joy.x = joy.y = joy.mag = 0; joy.active = false;
    knob.style.transform = ''; base.classList.remove('on'); resetBase();
    if (ti && e.type === 'pointerup' && ti.moved < 10 && performance.now() - ti.t < 320) hooks.onTap?.(e.clientX, e.clientY);
  };
  zoneL.addEventListener('pointerup', endJoy); zoneL.addEventListener('pointercancel', endJoy);

  // ---------------------------------------------------------------- kamera: geser satu jari, cubit dua jari
  const looks = new Map();
  let pinch0 = 0;
  zoneR.addEventListener('pointerdown', (e) => {
    show();
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    zoneR.setPointerCapture(e.pointerId);
    looks.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: 0 });
    if (looks.size === 2) { const [a, b] = [...looks.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); }
  });
  zoneR.addEventListener('pointermove', (e) => {
    const p = looks.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.moved = Math.max(p.moved, Math.hypot(e.clientX - p.sx, e.clientY - p.sy));
    p.x = e.clientX; p.y = e.clientY;
    if (looks.size >= 2) {
      const [a, b] = [...looks.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch0) hooks.zoom?.((pinch0 - d) * 0.02);
      pinch0 = d;
    } else hooks.rotateCam(-dx * 0.0075, dy * 0.0055);
  });
  const endLook = (e) => {
    const p = looks.get(e.pointerId); looks.delete(e.pointerId); pinch0 = 0;
    if (p && e.type === 'pointerup' && looks.size === 0 && p.moved < 10 && performance.now() - p.t < 320) hooks.onTap?.(e.clientX, e.clientY);
  };
  zoneR.addEventListener('pointerup', endLook); zoneR.addEventListener('pointercancel', endLook);

  // ---------------------------------------------------------------- tombol
  const press = (id, fn) => {
    const el = $(id);
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); show(); hooks.onManual?.(); el.classList.add('down'); vibrate(8); fn(e); });
    const up = () => el.classList.remove('down');
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('pointerleave', up);
  };
  const tapKey = (k) => { pressed.add(k); keys.add(k); setTimeout(() => keys.delete(k), 120); };
  press('btnJump', () => tapKey(' '));
  press('btnAct', () => tapKey('e'));
  press('btnRun', () => { state.runLatch = !state.runLatch; joy.run = state.runLatch; $('btnRun').classList.toggle('on', state.runLatch); });

  // ---------------------------------------------------------------- pengaman browser HP
  for (const el of [root, $('game')]) el.addEventListener('contextmenu', (e) => e.preventDefault());
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault());
  document.addEventListener('touchmove', (e) => { if (e.target.closest('#touch, #game, #mini')) e.preventDefault(); }, { passive: false });
  // sentuhan pertama di perangkat hybrid memunculkan UI sentuh
  addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') show(); }, { capture: true });

  // ---------------------------------------------------------------- layar penuh & layar tetap menyala
  const fsBtn = $('btnFull');
  const canFull = !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
  if (fsBtn) {
    fsBtn.hidden = !canFull;
    fsBtn.onclick = async () => {
      try {
        if (document.fullscreenElement || document.webkitFullscreenElement) { await (document.exitFullscreen || document.webkitExitFullscreen).call(document); }
        else {
          await (document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen).call(document.documentElement, { navigationUI: 'hide' });
          try { await screen.orientation?.lock?.('landscape'); } catch {}
        }
      } catch {}
    };
  }
  let wake = null;
  async function keepAwake() { try { if (navigator.wakeLock && document.visibilityState === 'visible') wake = await navigator.wakeLock.request('screen'); } catch {} }
  document.addEventListener('visibilitychange', () => { if (state.shown && document.visibilityState === 'visible') keepAwake(); });

  return {
    show, keepAwake, state,
    /** label dan status tombol aksi mengikuti benda di dekat kurir */
    setAction(label, enabled) { const b = $('btnAct'); b.textContent = label || 'Aksi'; b.classList.toggle('ready', !!enabled); },
    reset() { joy.x = joy.y = joy.mag = 0; joy.active = false; state.joyId = null; base.classList.remove('on'); resetBase(); knob.style.transform = ''; },
  };
}
