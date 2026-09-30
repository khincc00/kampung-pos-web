// Kampung Pos — Bagian 1: "Surat-Surat yang Menunggu"
// Semua teks cerita di sini. Tidak ada fail state: salah antar = dapat cerita + petunjuk.

export const DISTRICTS = {
  alun:    { name: 'Alun-Alun Tugu Pos', short: 'Alun-Alun' },
  pelangi: { name: 'Gang Pelangi', short: 'Gang Pelangi' },
  pecinan: { name: 'Pecinan Lampion', short: 'Pecinan' },
  pasar:   { name: 'Pasar Tepi Danau', short: 'Pasar Danau' },
  bukit:   { name: 'Bukit Pemancar', short: 'Bukit' },
  seng:    { name: 'Kampung Atap Seng', short: 'Kampung Seng' },
  sawah:   { name: 'Sawah Selatan', short: 'Sawah' },
};

// look: shirt, skin, head (gaya rambut/topi), pants, outfit, accent, face[], hold, act, s (tinggi), w (lebar), stoop
// idle = obrolan biasa; night = obrolan setelah magrib; emote = emoji yang sesekali muncul di atas kepala
export const RESIDENTS = {
  harjo:        { name: 'Pak Harjo', role: 'Kepala Kantor Pos', district: 'alun', house: 'kantor_pos', act: 'tunjuk', wander: 0.6,
                  look: { shirt: '#b5652f', accent: '#f0c65a', outfit: 'batik', skin: '#c68b5e', head: 'peci', pants: '#4a3b33', face: ['kumis', 'kacamata'], w: 1.12, s: 1.02, beardColor: '#2b1d16' },
                  idle: ['Kantor pos ini sudah 41 tahun berdiri. Tinggal seratus surat lagi sebelum kita tutup.', 'Jangan buru-buru. Surat yang sampai pelan tetap surat yang sampai.', 'Cap pos itu saya rawat seperti anak sendiri. Jangan bilang istri saya.'],
                  night: ['Malam begini kantor pos paling tenang. Saya suka dengar detik jamnya.'], emote: ['📮', '📜', '🕰️'] },
  sri:          { name: 'Bu Sri', role: 'Warung Kopi', district: 'alun', house: 'warung_sri', act: 'aduk', wander: 0.8,
                  look: { shirt: '#3f8f8a', outfit: 'apron', accent: '#fef9ef', skin: '#b87d52', head: 'kerudung', headColor: '#d9483b', pants: '#3b302b', w: 1.18, s: 0.95, lash: true, hold: 'sendok' },
                  idle: ['Kopi tubruk, Mas? Gratis buat kurir.', 'Toples krupuk itu jangan dibuka, itu buat pelanggan besok.', 'Pisang goreng masih hangat. Ya, itu yang dekat kompor.'],
                  night: ['Warung tutup jam sembilan. Kecuali ada yang cerita bagus.'], emote: ['☕', '🍌', '🔥'] },
  rina:         { name: 'Mbak Rina', role: 'Penjahit Jemuran', district: 'pelangi', house: 'pelangi_1', act: 'jahit', wander: 1.2,
                  look: { shirt: '#ff9a9e', outfit: 'garis', accent: '#fef9ef', skin: '#c99068', head: 'kuncir', headColor: '#2b1d16', pita: '#48dbfb', pants: '#48dbfb', scarf: '#feca57', s: 1.03, w: 0.9, lash: true, hold: 'meteran' },
                  idle: ['Jemuranku kering dua jam kalau matahari lagi baik.', 'Gang ini dicat warga sendiri, lho. Tiap RT satu warna.', 'Pita ukur ini hadiah dari ibu. Sudah kusut, tapi masih akurat.'],
                  night: ['Jahit malam-malam itu enak, sepi. Cuma jangan sampai jarum jatuh.'], emote: ['🧵', '👗', '✂️'] },
  joko_pelangi: { name: 'Pak Joko (Pelangi)', role: 'Tukang Cat', district: 'pelangi', house: 'pelangi_6', act: 'cat', wander: 1.5,
                  look: { shirt: '#48dbfb', outfit: 'apron', accent: '#feca57', skin: '#a8714a', head: 'topi', headColor: '#feca57', pants: '#4a3b33', face: ['kumis'], brow: 'tebal', s: 1.1, w: 1.0, hold: 'kuas' },
                  idle: ['Kalau ada tembok kusam, panggil saya.', 'Biru ini namanya "biru langit jam sembilan".', 'Cat kuning itu habis dua kaleng cuma buat satu pintu. Puas.'],
                  night: ['Jangan cat malam-malam, warnanya bohong.'], emote: ['🎨', '🖌️'] },
  naya:         { name: 'Dek Naya', role: 'Anak Gang', district: 'pelangi', house: 'pelangi_3', act: 'main', wander: 3.0,
                  look: { shirt: '#1dd1a1', outfit: 'rok', skin: '#c99068', head: 'kepang', headColor: '#3a2618', pita: '#ff9a9e', pants: '#ff9a9e', kid: true, eyes: 'besar', lash: true },
                  idle: ['Kak kurir bisa lompat ke atap nggak? Aku pernah lihat kucing di sana!', 'Aku gambar pos surat pakai kapur. Bagus kan?', 'Ayo main petak umpet! Eh, tapi kamu lagi kerja ya.'],
                  night: ['Aku disuruh tidur jam delapan. Tapi aku belum ngantuk.'], emote: ['🎈', '✏️', '🌈'] },
  ahong:        { name: 'Koh Ahong', role: 'Toko Kelontong', district: 'pecinan', house: 'ruko_1', act: 'kipas', wander: 0.7,
                  look: { shirt: '#fef9ef', outfit: 'rompi', accent: '#8b5a2b', skin: '#e0b48c', head: 'uban', pants: '#3b302b', face: ['kacamata', 'kumis'], eyes: 'sipit', w: 1.25, s: 0.94, beardColor: '#d9d6cf', hold: 'kipas' },
                  idle: ['Sabun, gula, sachet kopi, semua ada. Utang boleh, asal senyum.', 'Lampion ini dinyalakan tiap magrib sejak ayah saya.', 'Sempoa ini masih lebih cepat dari kalkulator. Mau tes?'],
                  night: ['Toko tutup? Tidak. Saya cuma duduk lebih lama.'], emote: ['🧮', '🏮', '💰'] },
  ling:         { name: 'Cici Ling', role: 'Toko Kue', district: 'pecinan', house: 'ruko_3', act: 'aduk', wander: 0.7,
                  look: { shirt: '#d9483b', outfit: 'kebaya', accent: '#feca57', skin: '#e8c09a', head: 'sanggul', headColor: '#1c1410', pita: '#feca57', pants: '#7a1f18', eyes: 'sipit', lash: true, w: 0.92, s: 1.02 },
                  idle: ['Kue bulan masih dua minggu lagi, tapi adonannya sudah kupikirkan dari sekarang.', 'Mas kurir, ada remah di bajumu.', 'Rahasia kue bulan: sabar dan jangan buka oven sebelum waktunya.'],
                  night: ['Malam begini oven masih hangat. Aku suka.'], emote: ['🥮', '🍰', '✨'] },
  joko_jahit:   { name: 'Pak Joko (Jahit)', role: 'Tukang Jahit', district: 'pecinan', house: 'ruko_5', act: 'jahit', wander: 0.6,
                  look: { shirt: '#8b5a2b', outfit: 'kaos', skin: '#b07a50', head: 'kopiah', headColor: '#2b1d16', pants: '#3b302b', face: ['kacamata'], frame: '#c9a24a', scarf: '#feca57', s: 0.97, w: 0.82, stoop: 0.12 },
                  idle: ['Mesin jahit ini lebih tua dari saya.', 'Kancing lepas? Taruh saja, besok jadi.', 'Kacamata ini turun terus. Atau hidung saya yang licin.'],
                  night: ['Lampu ini redup, tapi mata saya sudah hafal jahitan.'], emote: ['🧵', '👔'] },
  ucok:         { name: 'Bang Ucok', role: 'Perahu Kopi', district: 'pasar', house: 'dermaga', act: 'pancing', wander: 0.4,
                  look: { shirt: '#feca57', outfit: 'garis', accent: '#3f7fbf', skin: '#9c6a44', head: 'caping', pants: '#4a3b33', face: ['jenggot'], w: 1.22, s: 1.12, beardColor: '#1c1410', hold: 'pancing' },
                  idle: ['Kopi di atas air rasanya beda. Percaya aku.', 'Danau ini tenang, tapi ikannya cerewet.', 'Kemarin dapat ikan sebesar sandal. Sandal sungguhan, sih.'],
                  night: ['Malam itu ikan lebih malas. Aku juga.'], emote: ['🎣', '🐟', '☕'] },
  ijah:         { name: 'Mak Ijah', role: 'Lapak Sayur', district: 'pasar', house: 'lapak_1', act: 'kipas', wander: 0.6,
                  look: { shirt: '#6aa84f', outfit: 'daster', accent: '#fef9ef', skin: '#a8714a', head: 'kerudung', headColor: '#feca57', pants: '#5a8a3f', w: 1.3, s: 0.9, hold: 'keranjang' },
                  idle: ['Kangkung pagi ini masih ada embunnya.', 'Pasar ini ramainya jam enam. Sekarang sudah santai.', 'Cabai rawit ini pedasnya jujur. Tidak bohong seperti mantan.'],
                  night: ['Lapak saya tutup, tapi kalau kamu lapar, ada kangkung sisa.'], emote: ['🥬', '🌶️', '🧺'] },
  tini:         { name: 'Bu Tini', role: 'Mantan Warung Senja', district: 'pasar', house: 'lapak_3', act: 'aduk', wander: 0.6,
                  look: { shirt: '#ff7a3d', outfit: 'daster', accent: '#fef9ef', skin: '#b87d52', head: 'kerudung', headColor: '#8b5a2b', pants: '#a5551f', w: 1.05, s: 0.98, lash: true },
                  idle: ['Warung di bukit sepi sekarang. Di sini lebih ramai, tapi saya kangen senjanya.', 'Pisang goreng? Masih hangat.', 'Dari bukit, matahari terbenam kelihatan kayak jeruk yang dicelup ke air.'],
                  night: ['Sekarang lagi jam senja di bukit. Saya ingat.'], emote: ['🍌', '🌅'] },
  budi:         { name: 'Om Budi', role: 'Penjaga Pemancar', district: 'bukit', house: 'menara', act: 'tunjuk', wander: 0.8,
                  look: { shirt: '#5a6b8a', outfit: 'rompi', accent: '#ff7a3d', skin: '#b07a50', head: 'helm', helm: '#feca57', pants: '#3b302b', face: ['kumis', 'cambang'], s: 1.14, w: 0.85, hold: 'radio', beardColor: '#2b1d16' },
                  idle: ['Dari sini kelihatan semua atap kampung. Seng yang baru paling silau.', 'Radio Kampung Pos siaran jam tujuh malam. Dengar ya.', 'Kabel semrawut itu sebenarnya rapi. Menurut saya.'],
                  night: ['Malam begini sinyal paling bersih. Coba dengar keroncongnya.'], emote: ['📻', '📡', '🎶'] },
  warsih:       { name: 'Nenek Warsih', role: 'Warga Kampung Seng', district: 'seng', house: 'seng_1', act: 'kipas', wander: 0.5,
                  look: { shirt: '#9a7fb0', outfit: 'kebaya', accent: '#fef9ef', skin: '#a8714a', head: 'uban', pants: '#5e4a72', s: 0.86, w: 1.05, stoop: 0.3, hold: 'tongkat', eyes: 'sipit' },
                  idle: ['Dulu si Oyen tiap pagi mampir minta ikan asin.', 'Atap-atap di sini nyambung kayak tangga. Anak-anak suka main di sana.', 'Nenek sudah delapan puluh satu, tapi belum pernah bosan lihat pagi.'],
                  night: ['Sudah malam, Nak. Nenek cuma duduk mendengarkan jangkrik.'], emote: ['🌸', '🐱', '🍵'] },
  marni:        { name: 'Bu Marni', role: 'Tetangga Mbah Karto', district: 'seng', house: 'seng_6', act: 'sapu', wander: 1.8,
                  look: { shirt: '#c45a2c', outfit: 'daster', accent: '#fef9ef', skin: '#b87d52', head: 'kerudung', headColor: '#3f8f8a', pants: '#8a3f18', w: 0.95, s: 1.04, hold: 'sapu' },
                  idle: ['Rumah sebelah sudah setahun kosong.', 'Hati-hati di atap, sengnya licin kalau habis hujan.', 'Halaman ini disapu tiap pagi, tetap saja daunnya kembali.'],
                  night: ['Sudah malam. Sapunya istirahat dulu.'], emote: ['🧹', '🍂'] },
};

// ------------------------------------------------------------------ warga ramai (ambient)
// Bukan tokoh cerita: mereka jalan-jalan, punya jadwal, dan menyapa. Tiap orang dibuat acak (bibit tetap) supaya tidak kembar.
export const SKINS = ['#f0c9a0', '#e0b48c', '#c99068', '#c68b5e', '#b87d52', '#a8714a', '#9c6a44', '#7c4f33'];
export const HAIR_COLORS = ['#1c1410', '#2b1d16', '#3a2618', '#5a3a22', '#1c1410', '#2b1d16', '#8a8f8a'];
const SHIRTS = ['#ff7a3d', '#48dbfb', '#feca57', '#1dd1a1', '#ff9a9e', '#9a7fb0', '#d9483b', '#3f8f8a', '#fef9ef', '#6aa84f', '#5a6b8a', '#f2c89a', '#c45a2c', '#e8d5b0'];
const PANTS = ['#3b302b', '#3f5f7a', '#4a3b33', '#5a6b8a', '#6b4a2b', '#2b3a4a', '#7a5a3a'];
const MALE_NAMES = ['Bagas', 'Wahyu', 'Dodo', 'Agus', 'Rendi', 'Hasan', 'Bayu', 'Tono', 'Darto', 'Yanto', 'Eko', 'Slamet', 'Pandu', 'Kadir', 'Jaya', 'Lukman'];
const FEMALE_NAMES = ['Wati', 'Lastri', 'Ayu', 'Dewi', 'Yuni', 'Sari', 'Minah', 'Tuti', 'Ratna', 'Fitri', 'Nining', 'Susi', 'Wulan', 'Kartini'];
const KID_NAMES = ['Adi', 'Rara', 'Bimo', 'Sinta', 'Doni', 'Mira', 'Fajar', 'Nisa'];

// jenis warga: bentuk, jam aktif, tempat, dan obrolan
export const AMBIENT_KINDS = {
  ibu_belanja: { role: 'Ibu belanja', hours: [5.5, 12], where: ['pasar', 'alun', 'pelangi'], female: true, hold: 'keranjang', outfits: ['daster', 'kebaya', 'kaos'], heads: ['kerudung', 'sanggul', 'panjang', 'kuncir'],
    lines: ['Cari cabai, katanya naik lagi harganya.', 'Anak saya minta dibelikan ikan. Tiap hari ikan.', 'Bu Sri jual kopi enak, tapi kalau ngobrol lama, hutang.', 'Awas jalan, Mas, saya bawa telur.'] },
  ojek: { role: 'Tukang ojek', hours: [6, 20], where: ['alun', 'pecinan'], outfits: ['jaket'], heads: ['helm', 'cepak'], face: [[], ['kumis'], ['jenggot']],
    lines: ['Ojek, Mas? Eh, Mas kan kurir. Sama-sama pekerja jalan.', 'Motor saya diberi nama "Si Kilat". Masalahnya cuma pikiran saya yang kilat.', 'Pangkalan sepi hari ini. Semua jalan kaki.'] },
  pelajar: { role: 'Pelajar', hours: [6, 14], where: ['pelangi', 'alun'], outfits: ['seragam'], heads: ['cepak', 'kepang', 'poni', 'kuncir'], kid: true,
    lines: ['Aku telat! Ulangan matematika!', 'Kak kurir, suratnya ada buat aku nggak?', 'Katanya di atap seng ada kucing raksasa.', 'Sekolahku dekat Tugu. Tiangnya dipakai buat main.'] },
  anak_main: { role: 'Anak bermain', hours: [14.5, 18.5], where: ['pelangi', 'alun', 'seng'], outfits: ['kaos', 'rok'], heads: ['kepang', 'botak', 'cepak', 'keriting'], kid: true, act: 'main',
    lines: ['Ayo main kelereng!', 'Layangan aku putus, sedih.', 'Kamu bisa lompat setinggi atap? Aku lihat kamu lompat kemarin.', 'Aku jadi penjaga, kamu sembunyi!'] },
  bapak_ronda: { role: 'Warga ronda', hours: [19.5, 29], where: ['alun', 'pelangi', 'seng', 'pecinan'], outfits: ['sarung', 'kaos'], heads: ['kopiah', 'cepak', 'bandana'], face: [['kumis'], [], ['jenggot']],
    lines: ['Ronda dulu. Kalau ada suara kentongan, itu saya. Bukan hantu.', 'Malam aman. Kecuali kucing yang rebutan ikan.', 'Ada kopi? Ronda tanpa kopi itu cuma jalan malam.'] },
  kakek: { role: 'Kakek', hours: [5.5, 18], where: ['alun', 'seng', 'pasar'], outfits: ['sarung', 'kaos', 'batik'], heads: ['uban', 'kopiah', 'blangkon'], stoop: 0.25, hold: 'tongkat', s: 0.92, face: [['kumis'], ['jenggot'], ['kacamata']],
    lines: ['Dulu sini masih sawah semua.', 'Kaki saya sudah tidak seperti dulu. Tapi mata masih tajam.', 'Nak, kamu kurir? Bagus. Dulu saya juga tukang pos sepeda.'] },
  nenek: { role: 'Nenek', hours: [5.5, 19], where: ['pelangi', 'seng', 'pecinan'], female: true, outfits: ['kebaya', 'daster'], heads: ['uban', 'sanggul', 'kerudung'], stoop: 0.22, hold: 'tongkat', s: 0.88, act: 'kipas',
    lines: ['Sini, makan dulu. Nenek bikin lupis.', 'Cucu saya jauh. Tapi suratnya kadang datang.', 'Cuaca begini enak buat jemur kasur.'] },
  pemuda: { role: 'Pemuda kampung', hours: [9, 23], where: ['alun', 'pasar', 'pecinan'], outfits: ['kaos', 'garis', 'jaket'], heads: ['jambul', 'cepak', 'bandana', 'keriting', 'poni'], face: [[], ['anting'], ['kacamata']], act: 'main',
    lines: ['Nongkrong dulu, Mas. Gratis.', 'Ini rambut lagi tren di kota. Katanya.', 'Ada yang jual gorengan? Perut saya sudah demo.'] },
  petani: { role: 'Petani', hours: [5, 16], where: ['seng', 'pasar', 'bukit'], outfits: ['kaos', 'garis'], heads: ['jerami', 'caping'], face: [[], ['kumis']], w: 1.1, hold: 'jaring',
    lines: ['Padi di selatan bagus tahun ini.', 'Sawah itu seperti ibu: ditinggal sebentar, ngambek.', 'Ini caping, bukan topi. Ada bedanya.'] },
  nelayan: { role: 'Nelayan danau', hours: [4.5, 11], where: ['pasar'], outfits: ['garis', 'kaos'], heads: ['caping', 'bandana', 'jerami'], face: [['kumis'], ['jenggot']], hold: 'pancing',
    lines: ['Pagi ikan lebih ramah.', 'Umpan saya cacing. Dia tidak protes.', 'Danau ini punya satu ikan besar yang tidak pernah mau ketemu.'] },
  pedagang: { role: 'Pedagang keliling', hours: [7, 17], where: ['alun', 'pelangi', 'pecinan'], outfits: ['kaos', 'rompi'], heads: ['topi', 'kopiah', 'bandana'], hold: 'goni', face: [['kumis'], []],
    lines: ['Es, es! Es dawet! Eh... belum dingin sih.', 'Panci, wajan, semua ada. Kecuali janji.', 'Kalau surat nyasar, jangan nyalahin saya ya.'] },
  ibu_jemur: { role: 'Ibu rumah tangga', hours: [6, 17], where: ['pelangi', 'seng'], female: true, outfits: ['daster'], heads: ['kerudung', 'kuncir', 'sanggul'], hold: 'gayung', act: 'sapu',
    lines: ['Jemuran belum kering. Padahal matahari cerah.', 'Ibu-ibu sini paling cepat kalau kabar.', 'Kalau lihat anak saya, suruh pulang ya.'] },
  pembaca: { role: 'Pembaca koran', hours: [6, 12], where: ['alun'], outfits: ['batik', 'kaos'], heads: ['kopiah', 'cepak', 'uban'], face: [['kacamata'], ['kacamata', 'kumis']], hold: 'buku', act: 'tunjuk',
    lines: ['Koran hari ini isinya harga cabai lagi.', 'Sudah tujuh tahun saya cuma baca halaman teka-teki.', 'Diam. Saya lagi di kolom mistik.'] },
};
export const GREETINGS = ['Halo, Kurir!', 'Sugeng enjing!', 'Assalamualaikum!', 'Eh, kurir!', 'Selamat siang!', 'Mampir, Mas!', 'Ada surat buat saya?', 'Hati-hati di jalan!', 'Halo halo!', 'Woy, Kurir!', 'Sore, Mas!', 'Malam, Mas!'];

function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (r, a) => a[Math.floor(r() * a.length)];
/** Bikin daftar warga ramai yang beragam (tinggi, lebar, rambut, baju, aksesori, warna kulit semua diacak). */
export function makeAmbient(count = 22) {
  const r = mulberry(20260930);
  const kinds = Object.keys(AMBIENT_KINDS);
  const list = [];
  const used = new Set();
  for (let i = 0; i < count; i++) {
    const kk = i < kinds.length ? kinds[i] : pick(r, kinds);
    const K = AMBIENT_KINDS[kk];
    const isF = K.female || (K.kid ? r() < 0.5 : r() < 0.4 && !K.stoop);
    let name;
    do { name = pick(r, K.kid ? KID_NAMES : isF ? FEMALE_NAMES : MALE_NAMES); } while (used.has(name) && used.size < 30);
    used.add(name);
    const head = pick(r, K.heads);
    const outfit = pick(r, K.outfits);
    const shirt = pick(r, SHIRTS);
    const look = {
      shirt: outfit === 'seragam' ? '#fef9ef' : shirt, accent: pick(r, ['#feca57', '#d9483b', '#3f8f8a', '#fef9ef', '#8b5a2b', '#48dbfb']),
      skin: pick(r, SKINS), headColor: pick(r, HAIR_COLORS), head, outfit, pants: outfit === 'seragam' ? (K.kid && isF ? '#d9483b' : '#d9483b') : pick(r, PANTS),
      face: K.face ? pick(r, K.face) : (!isF && !K.kid && r() < 0.25 ? ['kumis'] : []),
      s: (K.s || 1) * (K.kid ? 1 : 0.9 + r() * 0.24), w: (K.w || 1) * (0.85 + r() * 0.4), kid: !!K.kid, hold: K.hold, act: K.act, stoop: K.stoop || 0,
      fem: isF, lash: isF && r() < 0.8, eyes: pick(r, ['normal', 'normal', 'besar', 'sipit']), pita: pick(r, ['#d9483b', '#feca57', '#48dbfb', '#ff9a9e']), beardColor: '#2b1d16', brow: r() < 0.3 ? 'tebal' : undefined, helm: pick(r, ['#d9483b', '#feca57', '#48a6c9', '#1dd1a1']),
    };
    if (head === 'kerudung') look.headColor = pick(r, ['#d9483b', '#3f8f8a', '#feca57', '#ff9a9e', '#9a7fb0', '#fef9ef', '#6aa84f']);
    if (head === 'uban') { look.headColor = '#d9d6cf'; look.beardColor = '#d9d6cf'; }
    if (outfit === 'sarung') { look.accent = pick(r, ['#3f7fbf', '#8a3f18', '#2e6b4f', '#7a1f4a']); look.pants = look.accent; }
    if (K.female && !['daster', 'kebaya', 'sarung', 'rok'].includes(outfit) && r() < 0.6) look.pants = pick(r, PANTS);
    list.push({
      id: 'w' + i, kind: kk, name, role: K.role, look: { ...look }, hours: K.hours, where: pick(r, K.where), lines: K.lines, night: [
        'Malam-malam begini cari apa, Mas?', 'Bulannya cerah. Jarang-jarang.', 'Jangan lupa lampu, jalan gelap.'],
      seed: 1000 + i * 37, speed: K.kid ? 1.5 : kk === 'kakek' || kk === 'nenek' ? 0.7 : 1.05,
    });
  }
  return list;
}

// Landmark yang bisa "ditemukan" (muncul di peta setelah didekati)
export const LANDMARKS = [
  { id: 'tugu', label: 'Tugu Pos', icon: '📮', spot: 'poi:tugu_top', radius: 9 },
  { id: 'kantor', label: 'Kantor Pos', icon: '🏤', spot: 'door:kantor_pos', radius: 8 },
  { id: 'warung_sri', label: 'Warung Kopi', icon: '☕', spot: 'door:warung_sri', radius: 8 },
  { id: 'musala', label: 'Musala', icon: '🕌', spot: 'door:musala', radius: 8 },
  { id: 'pelangi', label: 'Gang Pelangi', icon: '🌈', spot: 'door:pelangi_1', radius: 10 },
  { id: 'pecinan', label: 'Pecinan', icon: '🏮', spot: 'door:ruko_3', radius: 10 },
  { id: 'klenteng', label: 'Klenteng', icon: '⛩️', spot: 'door:klenteng', radius: 8 },
  { id: 'pasar', label: 'Pasar Danau', icon: '🧺', spot: 'door:lapak_3', radius: 10 },
  { id: 'dermaga', label: 'Dermaga', icon: '⚓', spot: 'door:dermaga', radius: 7 },
  { id: 'danau', label: 'Danau', icon: '🌊', spot: 'poi:pancing', radius: 9 },
  { id: 'bukit', label: 'Menara Pemancar', icon: '📡', spot: 'door:menara', radius: 9 },
  { id: 'senja', label: 'Warung Senja', icon: '🌅', spot: 'poi:warung_senja', radius: 8 },
  { id: 'seng', label: 'Kampung Atap Seng', icon: '🏚️', spot: 'door:seng_3', radius: 12 },
  { id: 'oyen', label: 'Bubungan Si Oyen', icon: '🐱', spot: 'poi:oyen', radius: 6 },
  { id: 'sawah', label: 'Sawah Selatan', icon: '🌾', spot: 'poi:sawah', radius: 14 },
  { id: 'beringin', label: 'Pohon Beringin', icon: '🌳', spot: 'poi:beringin', radius: 8 },
  { id: 'sumur', label: 'Sumur Tua', icon: '🪣', spot: 'poi:sumur', radius: 6 },
];
export const CAT_NAMES = ['Mochi', 'Tempe', 'Bakwan', 'Cilok', 'Kopi', 'Ketupat'];

// Tahapan: { at: 'npc:ID' | 'item:ID' | 'poi:ID', say: [..lines], speaker? }
// Tahap terakhir = surat sampai (atau berakhir di tempat lain — itu juga sampai).
export const LETTERS = [
  {
    id: 'l1', title: 'Surat Pertama', from: 'Pak Harjo', to: 'Bu Sri', address: 'Warung Kopi, sisi timur Alun-Alun',
    hint: 'Warung beratap seng karat, dekat gerobak bakso.', district: 'alun', sticker: { name: 'Cangkir Tubruk', icon: '☕' },
    stages: [
      { at: 'npc:sri', say: ['Wah, surat dari Pak Harjo? Paling isinya utang kopi 41 tahun.', 'Terima kasih, Mas. Kurir baru ya? Semoga betah di kampung kecil ini.'] },
    ],
  },
  {
    id: 'l2', title: 'Kabar dari Seberang', from: 'Mas Deni (Samarinda)', to: 'Mbak Rina', address: 'Rumah pink no. 1, Gang Pelangi',
    hint: 'Ikuti jalan tanah dari Tugu. Rumah pertama, temboknya pink.', district: 'pelangi', sticker: { name: 'Jemuran Pelangi', icon: '👕' },
    stages: [
      { at: 'npc:rina', say: ['Dari adikku! Tulisannya masih jelek kayak dulu.', 'Katanya dia pulang Lebaran. Aku harus jahit baju baru dari sekarang.'] },
    ],
  },
  {
    id: 'l3', title: 'Untuk Pak Joko', from: 'Toko Benang Makmur', to: 'Pak Joko', address: 'Rumah biru, Gang Pelangi (?)',
    hint: 'Alamatnya cuma "Pak Joko, rumah biru". Semoga tidak ada dua Joko.', district: 'pelangi', sticker: { name: 'Gulungan Benang', icon: '🧵' },
    stages: [
      { at: 'npc:joko_pelangi', say: ['Joko? Saya Joko, iya. Tapi benang? Saya tukang cat, Mas.', 'Pasti buat Joko yang tukang jahit di Pecinan. Rukonya juga dicat biru, saya yang ngecat!'],
        redirect: { to: 'Pak Joko (Jahit)', address: 'Ruko biru, Pecinan Lampion', hint: 'Pecinan: gang lampion merah. Ruko kelima, temboknya biru.', district: 'pecinan' } },
      { at: 'npc:joko_jahit', say: ['Nah ini benang pesanan saya! Sudah seminggu saya tungguin.', 'Surat nyasar itu biasa. Yang penting nyasarnya ke orang baik.'] },
    ],
  },
  {
    id: 'l4', title: 'Surat Angin', from: 'Bibi Mei (Singkawang)', to: 'Cici Ling', address: 'Toko Kue, Pecinan Lampion',
    hint: 'Pecinan, ruko ketiga, yang harum mentega.', district: 'pecinan', sticker: { name: 'Kue Bulan', icon: '🥮' },
    wind: { item: 'surat_angin', say: ['Wush! Angin kencang!', 'Suratnya terbang ke atap seng Warung Bu Sri. Naik lewat drum dan emperan, ambil pelan-pelan.'] },
    stages: [
      { at: 'item:surat_angin', say: ['Dapat! Amplopnya agak lecek, tapi masih utuh.'],
        redirect: { hint: 'Suratnya sudah di tangan. Antar ke Cici Ling, ruko ketiga Pecinan.', district: 'pecinan' } },
      { at: 'npc:ling', say: ['Amplopnya ada bekas debu seng... kamu naik atap buat ini?', 'Resep kue bulan Nenek! Kupikir sudah hilang selamanya. Ini, ambil satu kue.'] },
    ],
  },
  {
    id: 'l5', title: 'Untuk Si Oyen', from: 'Nenek Warsih', to: 'Si Oyen (kucing)', address: 'Atap seng tertinggi, Kampung Atap Seng',
    hint: 'Kucing oranye yang suka tidur di bubungan paling tinggi. Naik atap bertingkat dari rumah Nenek.', district: 'seng', sticker: { name: 'Si Oyen', icon: '🐱' },
    stages: [
      { at: 'npc:warsih', say: ['Surat itu dari saya, Mas. Buat si Oyen.', 'Bacakan ya di atas sana. Dia tidak bisa baca, tapi dia suka didongengin.'],
        redirect: { hint: 'Naik atap seng bertingkat di Kampung Seng. Oyen tidur di bubungan paling tinggi.', district: 'seng' } },
      { at: 'poi:oyen', say: ['"Oyen, maaf Nenek jarang kasih ikan asin sekarang. Kaki Nenek sudah malas jalan."', 'Oyen mengeong pelan, lalu tidur lagi. Sepertinya itu artinya "tidak apa-apa".'] },
    ],
  },
  {
    id: 'l6', title: 'Pesanan Gula Aren', from: 'Koh Ahong', to: 'Bang Ucok', address: 'Perahu Kopi, dermaga Pasar Danau',
    hint: 'Pasar di tepi danau. Bang Ucok jualan dari perahu, cari di dermaga kayu.', district: 'pasar', sticker: { name: 'Perahu Kopi', icon: '🛶' },
    stages: [
      { at: 'npc:ucok', say: ['Nota dari Koh Ahong! Gula aren datang Kamis, mantap.', 'Duduk dulu di dermaga. Danau jam segini bagus buat bengong.'] },
    ],
  },
  {
    id: 'l7', title: 'Salam dari Pendengar', from: 'Pendengar Setia (tanpa nama)', to: 'Om Budi', address: 'Menara Pemancar, Bukit',
    hint: 'Naik bukit paling tinggi. Menara merah-putih kelihatan dari mana-mana.', district: 'bukit', sticker: { name: 'Menara Radio', icon: '📻' },
    stages: [
      { at: 'npc:budi', say: ['"Terima kasih sudah memutar lagu keroncong tiap malam." Tanpa nama...', 'Saya kira tidak ada yang dengar. Ternyata ada satu. Satu itu cukup.'] },
    ],
  },
  {
    id: 'l8', title: 'Warung Senja', from: 'Dinas Pasar', to: 'Bu Tini', address: 'Warung Senja, Bukit Pemancar',
    hint: 'Warung kecil di bukit yang menghadap matahari terbenam.', district: 'bukit', sticker: { name: 'Pisang Goreng', icon: '🍌' },
    stages: [
      { at: 'poi:warung_senja', say: ['Warungnya tutup. Ada tulisan kapur: "Pindah ke pasar. — Tini".'],
        redirect: { to: 'Bu Tini', address: 'Lapak ketiga, Pasar Tepi Danau', hint: 'Bu Tini sekarang jualan di Pasar Danau, lapak ketiga.', district: 'pasar' } },
      { at: 'npc:tini', say: ['Surat izin lapak! Akhirnya resmi juga saya di sini.', 'Tapi kalau senja, saya masih suka naik ke bukit. Kebiasaan.'] },
    ],
  },
  {
    id: 'l9', title: 'Untuk Mbah Karto', from: 'Cucu di Jakarta', to: 'Mbah Karto', address: 'Rumah no. 7, Kampung Atap Seng',
    hint: 'Kampung Seng, rumah ketujuh. Pintu hijau.', district: 'seng', sticker: { name: 'Kotak Surat Rindu', icon: '💌' },
    stages: [
      { at: 'npc:marni', say: ['Mbah Karto? Beliau sudah tidak ada, Mas. Setahun lalu.', 'Cucunya mungkin belum tahu. Bawa saja ke Kotak Surat Rindu di Kantor Pos. Pak Harjo menyimpan surat-surat seperti itu.'],
        redirect: { to: 'Kotak Surat Rindu', address: 'Samping pintu Kantor Pos', hint: 'Kotak kayu kecil di samping pintu Kantor Pos, Alun-Alun.', district: 'alun' } },
      { at: 'poi:kotak_rindu', say: ['Kamu memasukkan surat ke Kotak Surat Rindu. Isinya sudah hampir penuh.', 'Tidak semua surat sampai ke orangnya. Tapi semua surat sampai ke suatu tempat.'] },
    ],
  },
  {
    id: 'l10', title: 'Untuk Kurir Baru', from: 'Pak Harjo', to: 'Kurir Baru', address: 'Puncak alas Tugu Pos',
    hint: 'Naik anak tangga batu Tugu Pos. Ada kotak pos kecil di atas alasnya.', district: 'alun', sticker: { name: 'Tugu Pos', icon: '📮' },
    stages: [
      { at: 'poi:tugu_top', say: ['Surat ini untukmu. Tulisan tangan Pak Harjo:', '"Sembilan surat sudah sampai. Sembilan puluh satu lagi. Tidak perlu cepat. Kampung ini akan menunggu."'], final: true },
    ],
  },
];

// Salah antar: warga memberi petunjuk ke distrik tujuan (tidak ada hukuman)
export function wrongDoorLine(resident, letter) {
  const d = DISTRICTS[letter.district]?.short || 'sana';
  const lines = [
    [`Bukan buat saya, Mas. Coba ke ${d}.`, `${letter.hint}`],
    [`Hmm, "${letter.to}"? Kayaknya di ${d}.`, 'Tanya-tanya saja, orang sini ramah.'],
    [`Wah salah rumah. Tapi nggak apa-apa, sekalian mampir.`, `Tujuanmu di ${d}. ${letter.hint}`],
  ];
  const i = (resident.name.length + letter.id.length) % lines.length;
  return lines[i];
}

// Contoh kurir pensiun (NPC JSON dari pemain yang sudah tamat). Ditandai contoh.
export const SEED_LEGACY = [
  { v: 1, type: 'kurir_pensiun', example: true, name: 'Kurir Contoh A', message: 'Jalan pelan. Oyen suka digaruk di dagu.', shirt: '#48dbfb', dir: [0.17, 0.984, 0.05], chapter: 1, letters: 10, created_at: '2026-09-01T07:00:00Z' },
];
