-- Enable extensions
create extension if not exists "uuid-ossp";
-- pgvector is available in Supabase by default; needed for thought_logs.embedding (v2+)
create extension if not exists vector;

-- ─── principles ──────────────────────────────────────────────────────────────
create table if not exists principles (
  id          uuid        primary key default uuid_generate_v4(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  text        text        not null,
  ii_when     text,
  ii_then     text,
  ii_because  text,
  active      boolean     not null default true,
  created_at  timestamptz not null default now()
);

alter table principles enable row level security;
create policy "owner only" on principles
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── tells ───────────────────────────────────────────────────────────────────
create table if not exists tells (
  id         uuid        primary key default uuid_generate_v4(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  label      text        not null,
  created_at timestamptz not null default now()
);

alter table tells enable row level security;
create policy "owner only" on tells
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── check_ins ───────────────────────────────────────────────────────────────
create table if not exists check_ins (
  id             uuid        primary key default uuid_generate_v4(),
  user_id        uuid        not null references auth.users(id) on delete cascade,
  ts             timestamptz not null default now(),
  state          text        not null check (state in ('low', 'ok', 'peak')),
  story          text,
  tells_observed uuid[]      not null default '{}'
);

alter table check_ins enable row level security;
create policy "owner only" on check_ins
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── focus_sessions ──────────────────────────────────────────────────────────
create table if not exists focus_sessions (
  id               uuid        primary key default uuid_generate_v4(),
  user_id          uuid        not null references auth.users(id) on delete cascade,
  started_at       timestamptz not null default now(),
  ended_at         timestamptz,
  intent           text        not null,
  likely_detractor text
);

alter table focus_sessions enable row level security;
create policy "owner only" on focus_sessions
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── thought_logs ────────────────────────────────────────────────────────────
create table if not exists thought_logs (
  id               uuid        primary key default uuid_generate_v4(),
  user_id          uuid        not null references auth.users(id) on delete cascade,
  ts               timestamptz not null default now(),
  original         text        not null,
  rewritten        text        not null,
  suggested_action text        not null,
  highlights       jsonb       not null default '[]',
  principles_used  uuid[]      not null default '{}',
  focus_session_id uuid        references focus_sessions(id) on delete set null,
  -- v2: embedding vector(1536)
  embedding        vector(1536)
);

alter table thought_logs enable row level security;
create policy "owner only" on thought_logs
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- full-text index for spiral autocomplete (substring search in v1)
create index if not exists thought_logs_original_fts
  on thought_logs using gin(to_tsvector('english', original));

-- ─── intentions ─────────────────────────────────────────────────────────────
create table if not exists intentions (
  id         uuid        primary key default uuid_generate_v4(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  text       text        not null,
  scope      text        not null default 'day' check (scope in ('day', 'week', 'longterm')),
  date       date        not null default current_date,
  created_at timestamptz not null default now()
);

alter table intentions enable row level security;
create policy "owner only" on intentions
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── seed helper (call from the app on first sign-in) ────────────────────────
-- The app seeds tells for a new user; this function is never called by RLS.
-- Run from the app after auth: window.api.db.seedDefaultTells()
