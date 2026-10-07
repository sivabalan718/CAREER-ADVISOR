-- =====================================================================
-- M63 / PRISM Engine — Supabase schema
-- Run once in Supabase Dashboard → SQL Editor → New query → Run.
-- Safe to re-run (idempotent).
-- Every user table is protected by Row Level Security: a user can only
-- read/write their own rows. Deleting the auth user cascades all data.
-- =====================================================================

-- ---------- Profiles ----------
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text,
  language      text not null default 'en',
  is_minor      boolean,
  journey       jsonb,          -- raw journey answers (for editing)
  student       jsonb,          -- canonical StudentProfile
  parent        jsonb,          -- canonical ParentProfile (ranges only; no exact income)
  assessment    jsonb,          -- adaptive aptitude result + item history
  education_costs jsonb,        -- program fees entered by the family from official pages
  onboarding_complete boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------- Guardian consent (students under 18) ----------
create table if not exists public.guardian_consents (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  guardian_name    text not null,
  relationship     text not null,
  guardian_contact text,
  consented        boolean not null default false,
  consented_at     timestamptz not null default now()
);

-- ---------- Analyses (decision history) ----------
create table if not exists public.analyses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  top_title   text,
  top_score   numeric,
  candidates_count int,
  summary     jsonb,     -- small summary for history lists
  result      jsonb      -- full engine output + evidence package
);
create index if not exists analyses_user_created_idx on public.analyses(user_id, created_at desc);

-- ---------- Roadmap progress ----------
create table if not exists public.milestones (
  user_id     uuid not null references auth.users(id) on delete cascade,
  step_key    text not null,
  analysis_id uuid references public.analyses(id) on delete set null,
  done        boolean not null default false,
  updated_at  timestamptz not null default now(),
  primary key (user_id, step_key)
);

-- ---------- Saved opportunities ----------
create table if not exists public.saved_opportunities (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  opportunity_id text not null,
  opportunity  jsonb not null,
  note         text,
  created_at   timestamptz not null default now(),
  unique (user_id, opportunity_id)
);

-- ---------- Decision updates (change detection) ----------
create table if not exists public.user_updates (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  analysis_id uuid references public.analyses(id) on delete cascade,
  update      jsonb not null,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists user_updates_user_idx on public.user_updates(user_id, created_at desc);

-- ---------- AI conversations ----------
create table if not exists public.chat_messages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null check (role in ('user','assistant')),
  content     text not null,
  meta        jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists chat_messages_user_idx on public.chat_messages(user_id, created_at);

-- ---------- Market snapshots (server-side, for job velocity) ----------
create table if not exists public.market_snapshots (
  country        text not null,
  location       text not null default '',
  role           text not null,
  snapshot_date  date not null,
  total_postings int not null,
  primary key (country, location, role, snapshot_date)
);

-- ---------- Row Level Security ----------
alter table public.profiles            enable row level security;
alter table public.guardian_consents   enable row level security;
alter table public.analyses            enable row level security;
alter table public.milestones          enable row level security;
alter table public.saved_opportunities enable row level security;
alter table public.user_updates        enable row level security;
alter table public.chat_messages       enable row level security;
alter table public.market_snapshots    enable row level security; -- no policies: service role only

do $$
declare t text;
begin
  -- profiles uses id as the owner column
  execute 'drop policy if exists own_rows on public.profiles';
  execute 'create policy own_rows on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id)';
  foreach t in array array['guardian_consents','analyses','milestones','saved_opportunities','user_updates','chat_messages'] loop
    execute format('drop policy if exists own_rows on public.%I', t);
    execute format('create policy own_rows on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;

-- ---------- Auto-create a profile on sign-up ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- updated_at ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------- GoalPath sessions (adaptive mission maps) ----------
create table if not exists public.goals (
  id          text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text,
  session     jsonb not null,
  updated_at  timestamptz not null default now()
);
alter table public.goals enable row level security;
drop policy if exists own_rows on public.goals;
create policy own_rows on public.goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
