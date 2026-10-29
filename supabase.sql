-- Supabase: SQL Editor > New query > cole tudo > Run (pode rodar mais de uma vez sem problema)
create table if not exists noticias (
  id bigserial primary key,
  link text unique not null,
  titulo text not null,
  fonte text not null,
  publicado_em timestamptz,
  tema text,
  resumo text,
  brasil text,
  economia text,
  nivel text,
  efeitos jsonb,
  criado_em timestamptz default now()
);
alter table noticias add column if not exists efeitos jsonb;
alter table noticias add column if not exists descricao text;
alter table noticias add column if not exists intensidade int;
alter table noticias add column if not exists horizonte text;
create index if not exists noticias_publicado_idx on noticias (publicado_em desc);
alter table noticias enable row level security;
drop policy if exists "leitura publica" on noticias;
create policy "leitura publica" on noticias for select using (true);

-- Versão 3 (foco em Porto Alegre)
alter table noticias add column if not exists portoalegre text;
alter table noticias add column if not exists escopo text;

-- Versão 5 (seções: regiao, clima, economia, mundo)
alter table noticias add column if not exists secao text;
create index if not exists noticias_secao_idx on noticias (secao, publicado_em desc);

-- Versão 8 (boletim do dia + "última busca há X min")
create table if not exists boletim (dia date primary key, titulo text, texto text, criado_em timestamptz default now());
alter table boletim enable row level security;
drop policy if exists "leitura publica" on boletim;
create policy "leitura publica" on boletim for select using (true);
create table if not exists status_busca (id int primary key, ultima_execucao timestamptz);
alter table status_busca enable row level security;
drop policy if exists "leitura publica" on status_busca;
create policy "leitura publica" on status_busca for select using (true);
