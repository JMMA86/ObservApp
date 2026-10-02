-- ObservApp · Cali
-- Ejecuta TODO este archivo en Supabase > SQL Editor.

create table if not exists public.submissions (
  id text primary key,
  payload jsonb not null,
  ts bigint not null,
  obs text,
  grp text,
  module text,
  mom text,
  sent_at timestamptz,
  imported_at timestamptz
);

alter table public.submissions enable row level security;

-- Quitamos privilegios amplios y damos solamente lo necesario.
revoke all on table public.submissions from anon, authenticated;
grant insert on table public.submissions to anon;
grant select, insert, update, delete on table public.submissions to authenticated;

-- Los estudiantes pueden ENVIAR respuestas, pero no leerlas.
drop policy if exists "public_can_submit" on public.submissions;
create policy "public_can_submit"
on public.submissions
for insert
to anon, authenticated
with check (true);

-- Solo el usuario autenticado del dashboard puede consultar.
drop policy if exists "dashboard_can_read" on public.submissions;
create policy "dashboard_can_read"
on public.submissions
for select
to authenticated
using (true);

-- Necesario para eliminar/restaurar desde el dashboard.
drop policy if exists "dashboard_can_update" on public.submissions;
create policy "dashboard_can_update"
on public.submissions
for update
to authenticated
using (true)
with check (true);

drop policy if exists "dashboard_can_delete" on public.submissions;
create policy "dashboard_can_delete"
on public.submissions
for delete
to authenticated
using (true);

-- Índices para ordenar/filtrar más rápido.
create index if not exists submissions_ts_idx on public.submissions(ts desc);
create index if not exists submissions_module_idx on public.submissions(module);
create index if not exists submissions_grp_idx on public.submissions(grp);
