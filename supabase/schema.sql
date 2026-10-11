-- Run once in Supabase → SQL Editor.

create table if not exists public.rooms (
  code text primary key,
  state jsonb not null,
  v integer not null,
  updated_at timestamptz not null default now()
);

-- RLS on with NO policies: the anon/publishable key can't read or write rooms at all.
-- Only our route handlers (secret key) touch this table; clients get state via Realtime broadcast.
alter table public.rooms enable row level security;

create index if not exists rooms_updated_at_idx on public.rooms (updated_at);

-- Private bucket for proofs. Uploads use signed upload URLs minted by the server,
-- views use 24h signed URLs. 50MB = Supabase free-plan per-file cap.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proofs', 'proofs', false, 52428800, array['image/*', 'video/*'])
on conflict (id) do nothing;

-- v2: voice-note proofs live in the same private bucket.
update storage.buckets set allowed_mime_types = array['image/*', 'video/*', 'audio/*'] where id = 'proofs';

-- v2: one Web Push subscription per device/player (player = sha256 of the device secret, same id as in room state).
-- RLS on, no policies: only route handlers touch it. Rows are never broadcast.
create table if not exists public.push_subs (
  player text primary key,
  sub jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.push_subs enable row level security;
