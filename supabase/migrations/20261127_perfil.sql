create table if not exists public.sc_perfil (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nome text check (nome is null or char_length(nome) <= 60),
  avatar text check (avatar is null or char_length(avatar) <= 200000),
  atualizado_em timestamptz not null default now()
);
alter table public.sc_perfil enable row level security;
create policy sc_perfil_own on public.sc_perfil for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
