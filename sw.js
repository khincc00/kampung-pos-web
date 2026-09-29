// Service worker: offline setelah load pertama. Naikkan VERSION tiap rilis.
const VERSION = 'kp-v1.1.0';
const SHELL = [
  './', './index.html', './config.js', './manifest.webmanifest',
  './src/game.js', './src/world.js', './src/story.js', './src/net.js',
  './vendor/three.module.min.js', './src/music.js', './src/characters.js', './vendor/addons/geometries/RoundedBoxGeometry.js', './vendor/addons/utils/BufferGeometryUtils.js', './vendor/addons/postprocessing/EffectComposer.js', './vendor/addons/postprocessing/RenderPass.js', './vendor/addons/postprocessing/UnrealBloomPass.js', './vendor/addons/postprocessing/OutputPass.js', './vendor/addons/postprocessing/ShaderPass.js', './vendor/addons/postprocessing/MaskPass.js', './vendor/addons/postprocessing/Pass.js', './vendor/addons/shaders/CopyShader.js', './vendor/addons/shaders/LuminosityHighPassShader.js', './vendor/addons/shaders/OutputShader.js', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('supabase.co')) return; // realtime/REST selalu jaringan
  const isFont = url.hostname.includes('fonts.g');
  if (url.origin === location.origin || isFont || url.hostname === 'cdn.jsdelivr.net') {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => hit)));
  }
});
