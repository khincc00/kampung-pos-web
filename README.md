# Kampung Pos · 100 Surat Terakhir (Bagian 1)

Game antar surat cozy di planet kampung Indonesia. Three.js r160 + WebGL2, PWA offline, ghost pemain via Supabase Realtime.

## Main sekarang
```bash
python3 -m http.server 8765        # dari folder ini
# buka http://localhost:8765
```
Hosting statis apa saja bisa (GitHub Pages, Netlify, Vercel). Setelah load pertama, game jalan offline (service worker).

## Kontrol
| Keyboard | Sentuh | Aksi |
|---|---|---|
| WASD / panah | joystick kiri | jalan (Shift = lari) |
| Spasi | Lompat | lompat (platforming atap seng) |
| E / Enter | E | bicara, ambil surat, antar |
| seret mouse, scroll | geser layar kanan | putar kamera, zoom |
| M / B | 🗺️ / 📒 | peta / buku stiker |
| 1–5 | bar emoji | kirim emoji ke ghost |
| H | Setelan | penanda tujuan on/off |
| Shift+T | – | debug: maju 1 jam |

### Joystick eksternal (USB / Bluetooth, pemetaan standar Xbox/PlayStation)
| Tombol | Aksi |
|---|---|
| Stik kiri / kanan | jalan / putar kamera |
| A (Cross) | lompat, lanjut dialog |
| X (Square) atau B (Circle) | bicara/antar, tutup panel |
| Y (Triangle) | peta |
| Select / Start | buku stiker / setelan |
| RT, RB, L3 | lari |
| LT / LB | zoom kamera |
| D-pad | emoji |
Getar (rumble) saat surat sampai, bila joystick mendukung.

## Core DNA (Abeto) → implementasi
- **Planet mungil, cozy scale**: radius 48 m (keliling ±300 m). Tanah = 1 mesh (1 draw call), 38 bangunan + ribuan prop/rumput via `InstancedMesh`. ±60–72 draw call, ±285k segitiga termasuk pass bayangan.
- **Low-stress delivery**: tidak ada fail state, tidak ada timer. Salah rumah → warga kasih petunjuk. Surat 3 & 8 *nyasar* by design, surat 4 diterbangkan angin ke atap, surat 9 berakhir di Kotak Surat Rindu.
- **WASD + Jump + Interact**: fisika di permukaan bola (gravitasi ke pusat), collider kotak berorientasi + atap pelana. Kampung Atap Seng = tangga bubungan (+0.4 m per rumah) sampai Si Oyen.
- **Waktu**: 1 hari = 16 menit real (Pagi 4 · Siang 5 · Sore 3 · Malam 4). Jendela, lampion, bohlam menyala saat magrib.
- **Ghost + emoji**: Supabase Realtime Broadcast (channel `kampung-pos-ghost`). Tanpa config → BroadcastChannel (coba buka 2 tab).
- **Tamat → NPC JSON**: pemain menulis pesan, tersimpan sebagai `kurir_pensiun` (lokal + tabel `npc_legacy`), muncul sebagai NPC di dunia pemain lain.

## Gaya visual & animasi
Material halus dengan rim light hangat, atap seng metalik, semua tepi membulat (RoundedBox), planet bershading halus, rumput bergoyang (shader), bunga, awan empuk yang bayangannya lewat, ayam kampung mematuk, kupu-kupu, kunang-kunang malam, asap warung, bloom lembut (desktop).
Karakter: kepala besar, mata berkilau, kedip, pipi merona, squash & stretch, antisipasi sebelum lompat, kepala menoleh ke lawan bicara, warga melambai saat didekati, tas surat memantul, selebrasi + konfeti saat surat sampai.

## Musik (disintesis di browser, tanpa file audio)
| Waktu | Lagu orisinal | Instrumen |
|---|---|---|
| Pagi | Esuk ing Kampung | angklung (kurulung & centok), suling bambu, kendang Sunda, kecapi |
| Siang | Lancaran Tugu Pos | gamelan laras slendro: saron, demung, peking, bonang, kethuk, kenong, kempul, gong ageng, kendang |
| Sore | Senja Kecapi | kecapi suling laras pelog (rasa degung) |
| Malam | Keroncong Radio Om Budi | cak, cuk, cello pizzicato, gitar, flute + jangkrik |
Efek suara juga bernada gamelan (bonang saat surat sampai, angklung saat ambil surat, kendang saat lompat). Pratinjau MP3 ada di `docs/musik/`.

## Supabase (opsional)
1. Buat project, jalankan `supabase/schema.sql` di SQL editor.
2. Isi `config.js` dengan `supabaseUrl` dan `supabaseAnonKey`.
3. Naikkan `VERSION` di `sw.js` setiap rilis.

## Uji otomatis
```bash
npm i -D playwright            # sekali
python3 -m http.server 8765 &
node tests/smoke.mjs           # 55 cek: boot, surat, fisika atap, tamat, ghost, offline, HP, musik, joystick, animasi
```
`window.KP` (debug API) dipakai tes: `KP.info()`, `KP.teleport('rina')`, `KP.sim(detik, ['w'], [' '])`.

## Struktur
```
index.html          halaman hosting (dibuat dari src/page.html oleh tools/build.py)
src/page.html       UI + CSS (juga dipakai langsung sebagai artifact)
src/game.js         renderer, pemain, kamera, waktu, quest, UI, ghost
src/world.js        planet, rumah instanced, atap seng, collider, prop Indonesia
src/story.js        warga, 10 surat Bagian 1, dialog
src/net.js          Supabase / BroadcastChannel, NPC JSON
src/characters.js   karakter + animasi
src/music.js        mesin musik gamelan/angklung/keroncong (WebAudio)
vendor/addons/      RoundedBox, BufferGeometryUtils, bloom (Three.js r160)
vendor/three.module.min.js   Three.js r160 (lokal, untuk offline)
sw.js, manifest.webmanifest, icons/   PWA
supabase/schema.sql
tests/smoke.mjs
```
Ukuran total ±900 KB (target < 50 MB).
