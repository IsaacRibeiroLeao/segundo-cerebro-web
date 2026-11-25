create extension if not exists vector with schema extensions;

create table public.sc_notas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  conteudo text not null,
  referencias text[] not null default '{}',
  tags text[] not null default '{}',
  embedding extensions.vector(768),
  reflexao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sc_notas_user_created_idx on public.sc_notas (user_id, created_at desc);
create index sc_notas_embedding_idx on public.sc_notas using hnsw (embedding extensions.vector_cosine_ops);
create index sc_notas_tags_idx on public.sc_notas using gin (tags);

create or replace function public.sc_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger sc_notas_updated_at
before update on public.sc_notas
for each row execute function public.sc_set_updated_at();

alter table public.sc_notas enable row level security;

create policy "sc_notas_select_own" on public.sc_notas
  for select to authenticated using (user_id = (select auth.uid()));
create policy "sc_notas_insert_own" on public.sc_notas
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "sc_notas_update_own" on public.sc_notas
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "sc_notas_delete_own" on public.sc_notas
  for delete to authenticated using (user_id = (select auth.uid()));

create or replace function public.sc_buscar_notas(
  consulta extensions.vector(768),
  limite int default 8,
  excluir uuid default null
)
returns table (id uuid, conteudo text, referencias text[], tags text[], created_at timestamptz, similaridade float)
language sql
stable
security invoker
set search_path = ''
as $$
  select n.id, n.conteudo, n.referencias, n.tags, n.created_at,
         1 - (n.embedding operator(extensions.<=>) consulta) as similaridade
  from public.sc_notas n
  where n.embedding is not null
    and (excluir is null or n.id <> excluir)
  order by n.embedding operator(extensions.<=>) consulta
  limit limite;
$$;

revoke all on function public.sc_buscar_notas from public, anon;
grant execute on function public.sc_buscar_notas to authenticated;
