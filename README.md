# Kampung Pos · 100 Surat Terakhir (Bagian 1)

Game antar surat cozy di planet kampung Indonesia. Three.js r160 + WebGL2, PWA offline, ghost pemain via Supabase Realtime.

## Main sekarang
```bash
python3 -m http.server 8765        # dari folder ini
# buka http://localhost:8765
```
Hosting statis apa saja bisa (GitHub Pages, Netlify, Vercel). Setelah load pertama, game jalan offline (service worker).

## Kontrol
| Keyboard | Sentuh (HP / tablet) | Aksi |
|---|---|---|
| WASD / panah | jempol kiri di mana saja (joystick melayang) | jalan (Shift / dorong sampai ujung = lari) |
| Spasi | Lompat | lompat (platforming atap seng) |
| E / Enter | tombol Aksi (label ikut benda di dekat: *Bicara*, *Elus*, *Antar surat* …) atau **ketuk langsung** warga/kucing/benda | bicara, ambil surat, antar, elus kucing, pukul kentongan … |
| seret mouse, scroll | geser jempol kanan, cubit dua jari | putar kamera, zoom |
| M / B | 🗺️ / 📒 / minimap (ketuk) | peta / buku stiker |
| 1–5 | 😊 lalu pilih emoji | kirim emoji ke ghost |
| H | Setelan | penanda tujuan on/off |
| Shift+T | – | debug: maju 1 jam |

**Layar sentuh**: joystick muncul di mana pun jempol kiri menyentuh (dan ikut terseret kalau jempol keluar batas). Dorong sampai ujung = lari, atau kunci lari dengan tombol *Lari*. Ketuk warga / kucing / benda yang jauh dan kurir **berjalan sendiri** ke sana lalu berinteraksi. Layar penuh & layar-tetap-menyala ada di Setelan. Dipakai multi-sentuh (joystick + kamera + tombol bersamaan) lewat Pointer Events.

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

## Kampung yang hidup (v1.2)
- **Karakter tidak kembar**: 15 warga cerita dan 22 warga ramai dibuat dari 20+ gaya rambut/topi (kuncir, kepang, keriting, sanggul, blangkon, kopiah, caping, helm ojek, bandana …), 10 jenis baju (batik, daster, kebaya, sarung, seragam sekolah, apron, rompi, jaket, kaos garis …), aksesori wajah (kacamata, kumis, jenggot, anting), mata sipit/besar, tinggi & lebar tubuh, bungkuk, dan benda di tangan (sapu, sendok, tongkat, keranjang, kuas, pancing, radio …). Tiap warga cerita punya kegiatan (mengaduk, menjahit, mengecat, menyapu, mengipas, memancing).
- **Warga ramai** (`src/life.js`): pedagang, ojek, pelajar, anak bermain, ronda malam, kakek-nenek, petani, nelayan … berjalan antar titik jalan, punya **jadwal harian** (pasar pagi, anak main sore, ronda malam), menyapa dengan balon ucapan, bisa diajak bicara dan memberi petunjuk arah kalau kamu membawa surat. Warga cerita berkeliaran di depan rumahnya dan berhenti kalau kamu mendekat.
- **Hewan**: kucing (bisa dielus, mengikuti kamu setelah tiga kali elusan, kabur kalau kamu berlari), bebek di danau, kambing, kerbau di sawah, ayam yang kaget, kawanan burung yang berhamburan saat kentongan dipukul, ikan melompat + riak, kupu-kupu, kunang-kunang. Layangan di atas Alun-Alun, angkot hilir-mudik (klakson kalau kamu menghalangi jalan).
- **Dunia lebih penuh**: rumah warga di sepanjang jalan antar-distrik, pagar, beringin besar, sumur, angkringan, gapura selamat datang & gapura pelangi, taman bermain (ayunan, perosotan, jungkat-jungkit), klenteng dengan patung singa & gong, teratai & rumbia di danau, jemuran ikan, sawah dengan gubuk, orang-orangan sawah dan jerami, rumbai bendera dari Tugu, papan pengumuman lucu, pisang/bambu/kamboja/mangga/flamboyan. Dekorasi digabung per kluster (bisa di-cull).
- **Titik interaksi**: pukul kentongan, pukul gong, intip teropong (deskripsi berubah tiap jam), seruput kopi (kecepatan ×1.3 selama 40 dtk), memancing di dermaga (ikan/sepatu bot/kepiting …), timba sumur, berteduh di bawah beringin.
- **Cuaca**: hujan acak (kabut merapat, cahaya meredup, warga berlari/berteduh, suara hujan) lalu pelangi. Daun & kelopak berguguran.
- **Peta baru**: minimap bulat di HUD yang berputar mengikuti kamera + peta bola dunia yang bisa **diseret, di-zoom, dicubit** dengan denah rumah, jalan, pohon, warga, tujuan surat, dan **17 tempat yang baru muncul setelah kamu menemukannya** (progres tersimpan). Medan dipanggang sekali dari fungsi tinggi dunia dengan bayangan lereng.

## Core DNA (Abeto) → implementasi
- **Planet mungil, cozy scale**: radius 48 m (keliling ±300 m). Tanah = 1 mesh (1 draw call), 45 bangunan + ribuan prop/rumput via `InstancedMesh`, dekorasi statis digabung per kluster. Mode HP (bayangan karakter/dekor dimatikan, warga ramai 14): ±100–160 draw call, ±450–500 rb segitiga termasuk pass bayangan; desktop lebih tinggi karena bloom dan warga lebih banyak.
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
node tests/smoke.mjs           # ±90 cek: boot, surat, fisika atap, tamat, ghost, offline, HP + sentuhan, musik, joystick, animasi,
                               # karakter beragam, warga & jadwal, interaksi, peta, cuaca
```
`window.KP` (debug API) dipakai tes: `KP.info()`, `KP.teleport('rina')`, `KP.sim(detik, ['w'], [' '])`, `KP.stepLife(detik)` (majukan warga/hewan/cuaca tanpa menggambar), `KP.life`, `KP.maps`.

## Struktur
```
index.html          halaman hosting (dibuat dari src/page.html oleh tools/build.py)
src/page.html       UI + CSS (juga dipakai langsung sebagai artifact)
src/game.js         renderer, pemain, kamera, waktu, quest, UI, ghost
src/world.js        planet, rumah instanced, atap seng, collider, prop Indonesia
src/story.js        warga, 10 surat Bagian 1, dialog
src/net.js          Supabase / BroadcastChannel, NPC JSON
src/characters.js   karakter (gaya rambut, baju, aksesori, bentuk tubuh, kegiatan) + animasi
src/life.js         warga ramai + jadwal, hewan, burung, layangan, angkot, cuaca, titik interaksi
src/minimap.js      minimap bulat + peta bola (medan dipanggang, denah, penanda, tempat ditemukan)
src/touch.js        joystick melayang, kamera geser/cubit, tombol, ketuk-untuk-interaksi, layar penuh
src/music.js        mesin musik gamelan/angklung/keroncong (WebAudio)
vendor/addons/      RoundedBox, BufferGeometryUtils, bloom (Three.js r160)
vendor/three.module.min.js   Three.js r160 (lokal, untuk offline)
sw.js, manifest.webmanifest, icons/   PWA
supabase/schema.sql
tests/smoke.mjs
```
Ukuran total ±900 KB (target < 50 MB).
