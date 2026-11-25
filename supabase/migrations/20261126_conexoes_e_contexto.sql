-- Segundo Cérebro v2: referências estruturadas, conexões explicadas, versões de reflexão,
-- busca híbrida e revisões semanais. Só objetos com prefixo sc_.

alter table public.sc_notas
  add column if not exists passagem_ia jsonb,
  add column if not exists tags_sugeridas text[] not null default '{}',
  add column if not exists fts tsvector
    generated always as (to_tsvector('portuguese'::regconfig, coalesce(conteudo, ''))) stored;

create index if not exists sc_notas_fts_idx on public.sc_notas using gin (fts);

-- Referências bíblicas estruturadas (livro 0..65 na ordem canônica)
create table if not exists public.sc_nota_refs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nota_id uuid not null references public.sc_notas(id) on delete cascade,
  livro smallint not null check (livro between 0 and 65),
  capitulo smallint not null check (capitulo >= 1),
  v_ini smallint,
  v_fim smallint,
  origem text not null default 'usuario' check (origem in ('usuario', 'ia')),
  rotulo text not null
);
create index if not exists sc_nota_refs_nota_idx on public.sc_nota_refs (nota_id);
create index if not exists sc_nota_refs_lookup_idx on public.sc_nota_refs (user_id, livro, capitulo);

-- Conexões entre notas, sempre com o motivo
create table if not exists public.sc_conexoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  a uuid not null references public.sc_notas(id) on delete cascade,
  b uuid not null references public.sc_notas(id) on delete cascade,
  tipo text not null check (tipo in ('semantica', 'versiculo', 'capitulo', 'livro', 'tag')),
  peso real not null default 0.5,
  motivo text not null,
  created_at timestamptz not null default now(),
  check (a < b),
  unique (a, b, tipo)
);
create index if not exists sc_conexoes_user_idx on public.sc_conexoes (user_id);
create index if not exists sc_conexoes_a_idx on public.sc_conexoes (a);
create index if not exists sc_conexoes_b_idx on public.sc_conexoes (b);

-- Histórico de reflexões por nota
create table if not exists public.sc_reflexoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nota_id uuid not null references public.sc_notas(id) on delete cascade,
  texto text not null,
  origem text not null default 'auto' check (origem in ('auto', 'edicao', 'manual')),
  created_at timestamptz not null default now()
);
create index if not exists sc_reflexoes_nota_idx on public.sc_reflexoes (nota_id, created_at desc);

-- Revisões periódicas
create table if not exists public.sc_revisoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  inicio date not null,
  fim date not null,
  texto text not null,
  created_at timestamptz not null default now()
);
create index if not exists sc_revisoes_user_idx on public.sc_revisoes (user_id, created_at desc);

-- RLS: cada usuário só vê e altera o que é seu
do $$
declare t text;
begin
  foreach t in array array['sc_nota_refs', 'sc_conexoes', 'sc_reflexoes', 'sc_revisoes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_own', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t || '_own', t);
  end loop;
end $$;

-- Busca híbrida (texto + semântica) com Reciprocal Rank Fusion
create or replace function public.sc_busca_hibrida(
  consulta_texto text,
  consulta extensions.vector(768) default null,
  limite int default 20
)
returns table (
  id uuid, conteudo text, referencias text[], tags text[],
  created_at timestamptz, similaridade double precision, score double precision
)
language sql stable security invoker
set search_path = ''
as $$
  with sem as (
    select n.id,
           row_number() over (order by n.embedding operator(extensions.<=>) consulta) as r,
           1 - (n.embedding operator(extensions.<=>) consulta) as sim
    from public.sc_notas n
    where consulta is not null and n.embedding is not null
    order by n.embedding operator(extensions.<=>) consulta
    limit 40
  ),
  txt as (
    select n.id,
           row_number() over (order by ts_rank_cd(n.fts, q.q) desc, n.created_at desc) as r
    from public.sc_notas n
    cross join (select websearch_to_tsquery('portuguese'::regconfig, coalesce(consulta_texto, '')) as q) q
    where coalesce(trim(consulta_texto), '') <> ''
      and (n.fts @@ q.q
           or exists (select 1 from unnest(n.tags || n.referencias) x
                      where x ilike '%' || trim(consulta_texto) || '%'))
    limit 40
  ),
  fund as (
    select coalesce(sem.id, txt.id) as id,
           sem.sim,
           coalesce(1.0 / (60 + sem.r), 0) + coalesce(1.0 / (60 + txt.r), 0) as score
    from sem full outer join txt on sem.id = txt.id
  )
  select n.id, n.conteudo, n.referencias, n.tags, n.created_at,
         f.sim as similaridade, f.score
  from fund f
  join public.sc_notas n on n.id = f.id
  order by f.score desc
  limit limite;
$$;

revoke execute on function public.sc_busca_hibrida(text, extensions.vector, int) from public, anon;
grant execute on function public.sc_busca_hibrida(text, extensions.vector, int) to authenticated;

alter table public.sc_notas add column if not exists processada_em timestamptz;
