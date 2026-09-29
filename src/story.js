// Kampung Pos — Bagian 1: "Surat-Surat yang Menunggu"
// Semua teks cerita di sini. Tidak ada fail state: salah antar = dapat cerita + petunjuk.

export const DISTRICTS = {
  alun:    { name: 'Alun-Alun Tugu Pos', short: 'Alun-Alun' },
  pelangi: { name: 'Gang Pelangi', short: 'Gang Pelangi' },
  pecinan: { name: 'Pecinan Lampion', short: 'Pecinan' },
  pasar:   { name: 'Pasar Tepi Danau', short: 'Pasar Danau' },
  bukit:   { name: 'Bukit Pemancar', short: 'Bukit' },
  seng:    { name: 'Kampung Atap Seng', short: 'Kampung Seng' },
};

// look: shirt, skin, head ('peci'|'kerudung'|'rambut'|'caping'|'topi'|'uban'), pants
export const RESIDENTS = {
  harjo:        { name: 'Pak Harjo', role: 'Kepala Kantor Pos', district: 'alun', house: 'kantor_pos',
                  look: { shirt: '#e8773a', skin: '#c68b5e', head: 'peci', pants: '#4a3b33' },
                  idle: ['Kantor pos ini sudah 41 tahun berdiri. Tinggal seratus surat lagi sebelum kita tutup.', 'Jangan buru-buru. Surat yang sampai pelan tetap surat yang sampai.'] },
  sri:          { name: 'Bu Sri', role: 'Warung Kopi', district: 'alun', house: 'warung_sri',
                  look: { shirt: '#3f8f8a', skin: '#b87d52', head: 'kerudung', headColor: '#d9483b', pants: '#3b302b' },
                  idle: ['Kopi tubruk, Mas? Gratis buat kurir.', 'Toples krupuk itu jangan dibuka, itu buat pelanggan besok.'] },
  rina:         { name: 'Mbak Rina', role: 'Penjahit Jemuran', district: 'pelangi', house: 'pelangi_1',
                  look: { shirt: '#ff9a9e', skin: '#c99068', head: 'rambut', headColor: '#2b1d16', pants: '#48dbfb' },
                  idle: ['Jemuranku kering dua jam kalau matahari lagi baik.', 'Gang ini dicat warga sendiri, lho. Tiap RT satu warna.'] },
  joko_pelangi: { name: 'Pak Joko (Pelangi)', role: 'Tukang Cat', district: 'pelangi', house: 'pelangi_6',
                  look: { shirt: '#48dbfb', skin: '#a8714a', head: 'topi', headColor: '#feca57', pants: '#4a3b33' },
                  idle: ['Kalau ada tembok kusam, panggil saya.', 'Biru ini namanya "biru langit jam sembilan".'] },
  naya:         { name: 'Dek Naya', role: 'Anak Gang', district: 'pelangi', house: 'pelangi_3',
                  look: { shirt: '#1dd1a1', skin: '#c99068', head: 'rambut', headColor: '#3a2618', pants: '#ff9a9e', kid: true },
                  idle: ['Kak kurir bisa lompat ke atap nggak? Aku pernah lihat kucing di sana!', 'Aku gambar pos surat pakai kapur. Bagus kan?'] },
  ahong:        { name: 'Koh Ahong', role: 'Toko Kelontong', district: 'pecinan', house: 'ruko_1',
                  look: { shirt: '#fef9ef', skin: '#e0b48c', head: 'uban', pants: '#3b302b' },
                  idle: ['Sabun, gula, sachet kopi, semua ada. Utang boleh, asal senyum.', 'Lampion ini dinyalakan tiap magrib sejak ayah saya.'] },
  ling:         { name: 'Cici Ling', role: 'Toko Kue', district: 'pecinan', house: 'ruko_3',
                  look: { shirt: '#d9483b', skin: '#e8c09a', head: 'rambut', headColor: '#1c1410', pants: '#3b302b' },
                  idle: ['Kue bulan masih dua minggu lagi, tapi adonannya sudah kupikirkan dari sekarang.', 'Mas kurir, ada remah di bajumu.'] },
  joko_jahit:   { name: 'Pak Joko (Jahit)', role: 'Tukang Jahit', district: 'pecinan', house: 'ruko_5',
                  look: { shirt: '#8b5a2b', skin: '#b07a50', head: 'peci', pants: '#3b302b' },
                  idle: ['Mesin jahit ini lebih tua dari saya.', 'Kancing lepas? Taruh saja, besok jadi.'] },
  ucok:         { name: 'Bang Ucok', role: 'Perahu Kopi', district: 'pasar', house: 'dermaga',
                  look: { shirt: '#feca57', skin: '#9c6a44', head: 'caping', pants: '#4a3b33' },
                  idle: ['Kopi di atas air rasanya beda. Percaya aku.', 'Danau ini tenang, tapi ikannya cerewet.'] },
  ijah:         { name: 'Mak Ijah', role: 'Lapak Sayur', district: 'pasar', house: 'lapak_1',
                  look: { shirt: '#6aa84f', skin: '#a8714a', head: 'kerudung', headColor: '#feca57', pants: '#3b302b' },
                  idle: ['Kangkung pagi ini masih ada embunnya.', 'Pasar ini ramainya jam enam. Sekarang sudah santai.'] },
  tini:         { name: 'Bu Tini', role: 'Mantan Warung Senja', district: 'pasar', house: 'lapak_3',
                  look: { shirt: '#ff7a3d', skin: '#b87d52', head: 'kerudung', headColor: '#8b5a2b', pants: '#3b302b' },
                  idle: ['Warung di bukit sepi sekarang. Di sini lebih ramai, tapi saya kangen senjanya.', 'Pisang goreng? Masih hangat.'] },
  budi:         { name: 'Om Budi', role: 'Penjaga Pemancar', district: 'bukit', house: 'menara',
                  look: { shirt: '#5a6b8a', skin: '#b07a50', head: 'topi', headColor: '#d9483b', pants: '#3b302b' },
                  idle: ['Dari sini kelihatan semua atap kampung. Seng yang baru paling silau.', 'Radio Kampung Pos siaran jam tujuh malam. Dengar ya.'] },
  warsih:       { name: 'Nenek Warsih', role: 'Warga Kampung Seng', district: 'seng', house: 'seng_1',
                  look: { shirt: '#9a7fb0', skin: '#a8714a', head: 'kerudung', headColor: '#fef9ef', pants: '#4a3b33' },
                  idle: ['Dulu si Oyen tiap pagi mampir minta ikan asin.', 'Atap-atap di sini nyambung kayak tangga. Anak-anak suka main di sana.'] },
  marni:        { name: 'Bu Marni', role: 'Tetangga Mbah Karto', district: 'seng', house: 'seng_6',
                  look: { shirt: '#c45a2c', skin: '#b87d52', head: 'kerudung', headColor: '#3f8f8a', pants: '#3b302b' },
                  idle: ['Rumah sebelah sudah setahun kosong.', 'Hati-hati di atap, sengnya licin kalau habis hujan.'] },
};

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
  { v: 1, type: 'kurir_pensiun', example: true, name: 'Kurir Contoh B', message: 'Aku nyasar tiga kali. Ternyata itu bagian paling seru.', shirt: '#1dd1a1', dir: [0.706, 0.707, 0.037], chapter: 1, letters: 10, created_at: '2026-09-03T18:30:00Z' },
];
