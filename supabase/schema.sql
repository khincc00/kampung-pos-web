-- Kampung Pos: tabel warisan "kurir pensiun" (pemain tamat → NPC JSON)
-- Ghost posisi & emoji memakai Realtime Broadcast (channel 'kampung-pos-ghost'), tidak butuh tabel.
create table if not exists public.npc_legacy (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 20),
  message text not null default '' check (char_length(message) <= 100),
  shirt text not null default '#ff7a3d' check (shirt ~ '^#[0-9a-fA-F]{6}$'),
  dir jsonb not null check (jsonb_typeof(dir) = 'array' and jsonb_array_length(dir) = 3),
  chapter int not null default 1,
  letters int not null default 0 check (letters between 0 and 100),
  created_at timestamptz not null default now()
);
alter table public.npc_legacy enable row level security;
-- semua orang boleh membaca & menambah; tidak ada update/delete dari klien
create policy "baca warisan" on public.npc_legacy for select using (true);
create policy "tambah warisan" on public.npc_legacy for insert with check (true);
create index if not exists npc_legacy_created on public.npc_legacy (created_at desc);
