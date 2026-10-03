-- ============================================================
-- ObservApp · Cali — Setup de Supabase
-- Ejecuta TODO este archivo en Supabase > SQL Editor.
-- ============================================================

-- ------------------------------------------------------------
-- 1) TABLA DE RESPUESTAS
-- ------------------------------------------------------------
create table if not exists public.submissions (
  id text primary key,
  payload jsonb not null,
  ts bigint not null,
  obs text,
  grp text,
  module text,
  mom text,
  sent_at timestamptz default now()
);

alter table public.submissions enable row level security;

-- Permisos base: los estudiantes (anon) solo pueden INSERTAR.
revoke all on table public.submissions from anon, authenticated;
grant insert on table public.submissions to anon;

-- El dashboard lee/borra mediante el serverless proxy con service_role,
-- por lo que no necesita permisos de tabla para authenticated.

-- Cualquiera puede enviar respuestas (ROL anon).
drop policy if exists "public_can_submit" on public.submissions;
create policy "public_can_submit"
on public.submissions
for insert
to anon, authenticated
with check (true);

-- ------------------------------------------------------------
-- 2) BUCKET DE FOTOS (público)
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('observapp', 'observapp', true)
on conflict (id) do update set public = true;

-- Los estudiantes pueden SUBIR fotos, pero no listarlas ni borrarlas.
drop policy if exists "anon_upload_photos" on storage.objects;
create policy "anon_upload_photos"
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'observapp');

-- Lectura pública de las fotos (bucket público + política de select).
drop policy if exists "public_read_photos" on storage.objects;
create policy "public_read_photos"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'observapp');

-- ------------------------------------------------------------
-- 3) ÍNDICES
-- ------------------------------------------------------------
create index if not exists submissions_ts_idx on public.submissions(ts desc);
create index if not exists submissions_module_idx on public.submissions(module);
create index if not exists submissions_grp_idx on public.submissions(grp);
