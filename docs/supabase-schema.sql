-- Artemis Interview Copilot — Supabase schema
-- Run in Supabase SQL editor.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  is_guest boolean default false,
  created_at timestamptz not null default now()
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  interviewer_id text not null,
  interviewer_name text,
  candidate_label text,
  status text not null check (status in ('idle','capturing','transcribing','scoring','ready','failed')),
  platform text not null default 'google_meet',
  transcript jsonb not null default '[]'::jsonb,
  scoring jsonb,
  error_message text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sessions_interviewer_id_idx on public.sessions (interviewer_id);
create index if not exists sessions_started_at_idx on public.sessions (started_at desc);

alter table public.profiles enable row level security;
alter table public.sessions enable row level security;

-- Profiles: users read/update self
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_upsert_own" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- Sessions: owner by interviewer_id matching auth.uid()::text OR guest demo id stored client-side
-- Service role bypasses RLS for server writes.
create policy "sessions_select_own" on public.sessions
  for select using (
    interviewer_id = auth.uid()::text
    or interviewer_id = 'guest'
    or interviewer_id like 'demo-%'
  );

create policy "sessions_insert_own" on public.sessions
  for insert with check (
    interviewer_id = auth.uid()::text
    or interviewer_id = 'guest'
    or interviewer_id like 'demo-%'
  );

create policy "sessions_update_own" on public.sessions
  for update using (
    interviewer_id = auth.uid()::text
    or interviewer_id = 'guest'
    or interviewer_id like 'demo-%'
  );

create policy "sessions_delete_own" on public.sessions
  for delete using (
    interviewer_id = auth.uid()::text
    or interviewer_id = 'guest'
    or interviewer_id like 'demo-%'
  );

-- Anonymous guest helper: allow read of demo-interviewer-b seed rows for trends pitch
create policy "sessions_select_demo_seed" on public.sessions
  for select using (interviewer_id = 'demo-interviewer-b');
