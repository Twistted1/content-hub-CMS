create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  content text,
  is_pinned boolean not null default false,
  color text not null default 'bg-card',
  tags text[] not null default '{}',
  start_date date,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notes enable row level security;

create policy "Users can view own notes"
on public.notes
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can create own notes"
on public.notes
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own notes"
on public.notes
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own notes"
on public.notes
for delete
to authenticated
using (auth.uid() = user_id);

create index if not exists idx_notes_user_id_created_at on public.notes(user_id, created_at desc);

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists update_notes_updated_at on public.notes;
create trigger update_notes_updated_at
before update on public.notes
for each row
execute function public.update_updated_at_column();