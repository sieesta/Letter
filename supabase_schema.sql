-- ============================================================================
-- Memory Lane — Supabase schema
-- Run this in your Supabase project's SQL Editor.
-- ============================================================================

-- 1. Storage buckets (public objects; privacy comes from unguessable slugs + RLS)
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true), ('audio', 'audio', true)
on conflict (id) do update set public = excluded.public;

-- 2. Profiles table (one per hallway; message = the note read at the end of the hall)
create table if not exists profiles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text unique not null,
  pin text,
  her_name text,
  hall_title text default 'A Hallway of Us',
  message text,
  youtube_url text,
  audio_path text,
  audio_file_name text,
  form_link text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Photos table (caption + date are the per-image message fields)
create table if not exists photos (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid not null references profiles(id) on delete cascade,
  storage_path text not null,
  caption text default '',
  date text default '',
  sort_order int default 0,
  created_at timestamptz default now()
);

-- Indexes
create index if not exists profiles_slug_idx on profiles(slug);
create index if not exists profiles_user_id_idx on profiles(user_id);
create index if not exists photos_profile_id_idx on photos(profile_id);

-- 4. Row Level Security
alter table profiles enable row level security;
alter table photos enable row level security;

-- Creator: full access to their own profiles
drop policy if exists profiles_creator_all on profiles;
create policy profiles_creator_all on profiles
  for all using (auth.uid() = user_id);

-- Public: read any profile by slug (needed for /m/:slug sharing)
drop policy if exists profiles_public_read on profiles;
create policy profiles_public_read on profiles
  for select using (true);

-- Creator: full access to photos on their own profiles
drop policy if exists photos_creator_all on photos;
create policy photos_creator_all on photos
  for all using (
    auth.uid() = (select user_id from profiles where id = profile_id)
  );

-- Public: read photos linked to existing profiles
drop policy if exists photos_public_read on photos;
create policy photos_public_read on photos
  for select using (
    exists (select 1 from profiles where id = profile_id)
  );

-- 5. Storage RLS — public buckets
drop policy if exists storage_public_read on storage.objects;
create policy storage_public_read on storage.objects
  for select using (bucket_id in ('photos', 'audio'));

drop policy if exists storage_auth_insert on storage.objects;
create policy storage_auth_insert on storage.objects
  for insert with check (bucket_id in ('photos', 'audio') and auth.uid() is not null);

-- ============================================================================
-- Field summary:
--   profiles.message   → the main message read aloud at the end of the hall
--   photos.caption     → per-image message/caption
--   photos.date        → per-image date
-- ============================================================================
