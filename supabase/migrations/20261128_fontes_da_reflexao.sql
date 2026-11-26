alter table public.sc_reflexoes add column if not exists fontes jsonb;
alter table public.sc_notas add column if not exists reflexao_fontes jsonb;
