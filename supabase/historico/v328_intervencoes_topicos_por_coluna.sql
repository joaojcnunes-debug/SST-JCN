-- v328 — Tópicos por coluna na página Intervenções (09/11/2026, 0.3.242).
--
-- Pedido do João: o título de cada coluna (Intervenção, Modalidades, Responsável) vira uma lista onde se
-- insere tópico. Uma modalidade ou um responsável inserido ali precisa existir mesmo antes de estar em
-- alguma intervenção, então ganha tabela própria. A intervenção não precisa: inserir cria a linha no catálogo.
-- As listas da tela são a soma desta tabela, do que já está nas intervenções e, nas modalidades, das três
-- de partida (lib/comercial/liberacao.ts).
--
-- Mesma regra de acesso de comercial_intervencoes: lê e grava quem pode liberar.
--
-- Rollback: scripts/sql/v328_intervencoes_topicos_por_coluna_rollback.sql
begin;

create table if not exists public.comercial_intervencao_topicos (
  id_topico  uuid primary key default gen_random_uuid(),
  coluna     text not null check (coluna in ('MODALIDADE', 'RESPONSAVEL')),
  valor      text not null check (btrim(valor) <> ''),
  criado_em  timestamptz not null default now(),
  criado_por text default auth.email()
);

-- O mesmo tópico não entra duas vezes na coluna, sem olhar maiúsculas nem espaços nas pontas.
create unique index if not exists comercial_intervencao_topicos_unico
  on public.comercial_intervencao_topicos (coluna, lower(btrim(valor)));

alter table public.comercial_intervencao_topicos enable row level security;

grant select, insert, delete on public.comercial_intervencao_topicos to authenticated;

drop policy if exists comercial_intervencao_topicos_leitura on public.comercial_intervencao_topicos;
create policy comercial_intervencao_topicos_leitura on public.comercial_intervencao_topicos
  for select to authenticated using (public.comercial_pode_liberar());

drop policy if exists comercial_intervencao_topicos_escrita on public.comercial_intervencao_topicos;
create policy comercial_intervencao_topicos_escrita on public.comercial_intervencao_topicos
  for all to authenticated using (public.comercial_pode_liberar()) with check (public.comercial_pode_liberar());

notify pgrst, 'reload schema';

commit;
