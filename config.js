// Isi untuk ghost lintas perangkat + NPC kurir pensiun bersama (Supabase Realtime).
// Kosong = mode lokal (BroadcastChannel antar-tab) + simpan NPC di perangkat.
// anon key aman ditaruh di klien SELAMA Row Level Security aktif (lihat supabase/schema.sql).
window.KP_CONFIG = {
  supabaseUrl: '',      // mis. 'https://abcd1234.supabase.co'
  supabaseAnonKey: '',  // Project Settings → API → anon public
};
