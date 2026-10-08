-- Run this once if you already ran schema.sql earlier (adds the GoalPath table only).
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
