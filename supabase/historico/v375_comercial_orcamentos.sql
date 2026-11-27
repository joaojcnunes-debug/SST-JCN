-- v375 — Comercial › Orçamentos: catálogo de preços e orçamentos com versões (27/11/2026, 0.3.339).
--
-- POR QUÊ: pedido do João — gerar os orçamentos da equipe comercial dentro do sistema (Plano Essencial, Treinamentos
-- e Avulso), no padrão visual de cada marca (Chabra, Holos e JCN), a partir das empresas e oportunidades do Comercial.
--
-- O QUE MUDA:
--   * comercial_pode_usar(): quem usa o Comercial (Admin, módulos livres ou o módulo 'comercial'), como a comercial_dados;
--   * comercial_catalogo_precos: serviços, treinamentos e exames com o valor padrão (começa VAZIO; a equipe cadastra);
--   * comercial_orcamentos: um orçamento por linha, com número (sequência), versão, marca, modelo, situação
--     (rascunho / enviado / aprovado / recusado) e o conteúdo em `dados` (jsonb: itens, valores e textos). Alterar um
--     orçamento já enviado cria uma VERSÃO nova (mesmo número, versao + 1, id_orcamento_origem = a anterior).
--   * RLS: ler e gravar = comercial_pode_usar(); apagar só rascunho.
-- REAPLICAR: idempotente. Rollback: scripts/sql/v375_comercial_orcamentos_rollback.sql.

begin;

create or replace function public.comercial_pode_usar()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select u.perfil = 'Admin' or u.modulos_permitidos is null or 'comercial' = any(u.modulos_permitidos)
      from public.usuarios u
     where lower(u.email) = lower(nullif(auth.jwt() ->> 'email', '')) and u.ativo_sistema = true
     limit 1
  ), false)
$$;
revoke all on function public.comercial_pode_usar() from public, anon;
grant execute on function public.comercial_pode_usar() to authenticated;

-- 1) Catálogo de preços.
create table if not exists public.comercial_catalogo_precos (
  id_preco      text primary key default ('PRC-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8))),
  tipo          text not null check (tipo in ('servico', 'treinamento', 'exame')),
  nome          text not null check (length(btrim(nome)) > 0),
  descricao     text,
  unidade       text not null default 'unidade',
  valor         numeric(12, 2) not null default 0 check (valor >= 0),
  ativo         boolean not null default true,
  ordem         integer not null default 0,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  atualizado_por text
);
create unique index if not exists ux_comercial_catalogo_precos_nome on public.comercial_catalogo_precos (tipo, lower(btrim(nome)));

-- 2) Orçamentos.
create sequence if not exists public.comercial_orcamento_numero_seq start 1;
create table if not exists public.comercial_orcamentos (
  id_orcamento        text primary key default ('ORC-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8))),
  numero              integer not null default nextval('public.comercial_orcamento_numero_seq'),
  versao              integer not null default 1 check (versao >= 1),
  id_orcamento_origem text references public.comercial_orcamentos (id_orcamento) on delete set null,
  id_empresa          text references public.empresas (id_empresa) on delete set null,
  cliente_nome        text not null check (length(btrim(cliente_nome)) > 0),
  cliente_cnpj        text,
  cidade              text,
  marca               text not null check (marca in ('chabra', 'holos', 'jcn')),
  modelo              text not null check (modelo in ('essencial', 'treinamentos', 'avulso')),
  situacao            text not null default 'rascunho' check (situacao in ('rascunho', 'enviado', 'aprovado', 'recusado')),
  dados               jsonb not null default '{}'::jsonb check (jsonb_typeof(dados) = 'object'),
  total               numeric(12, 2) not null default 0,
  criado_por          text,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now(),
  enviado_em          timestamptz,
  decidido_em         timestamptz,
  unique (numero, versao)
);
alter sequence public.comercial_orcamento_numero_seq owned by public.comercial_orcamentos.numero;
create index if not exists ix_comercial_orcamentos_empresa on public.comercial_orcamentos (id_empresa);

-- 3) RLS.
alter table public.comercial_catalogo_precos enable row level security;
alter table public.comercial_orcamentos enable row level security;
grant select, insert, update, delete on public.comercial_catalogo_precos to authenticated;
grant select, insert, update, delete on public.comercial_orcamentos to authenticated;
grant usage, select on sequence public.comercial_orcamento_numero_seq to authenticated;

drop policy if exists catalogo_precos_sel on public.comercial_catalogo_precos;
create policy catalogo_precos_sel on public.comercial_catalogo_precos for select to authenticated using (public.comercial_pode_usar());
drop policy if exists catalogo_precos_ins on public.comercial_catalogo_precos;
create policy catalogo_precos_ins on public.comercial_catalogo_precos for insert to authenticated with check (public.comercial_pode_usar());
drop policy if exists catalogo_precos_upd on public.comercial_catalogo_precos;
create policy catalogo_precos_upd on public.comercial_catalogo_precos for update to authenticated using (public.comercial_pode_usar()) with check (public.comercial_pode_usar());
drop policy if exists catalogo_precos_del on public.comercial_catalogo_precos;
create policy catalogo_precos_del on public.comercial_catalogo_precos for delete to authenticated using (public.comercial_pode_usar());

drop policy if exists orcamentos_sel on public.comercial_orcamentos;
create policy orcamentos_sel on public.comercial_orcamentos for select to authenticated using (public.comercial_pode_usar());
drop policy if exists orcamentos_ins on public.comercial_orcamentos;
create policy orcamentos_ins on public.comercial_orcamentos for insert to authenticated with check (public.comercial_pode_usar());
drop policy if exists orcamentos_upd on public.comercial_orcamentos;
create policy orcamentos_upd on public.comercial_orcamentos for update to authenticated using (public.comercial_pode_usar()) with check (public.comercial_pode_usar());
drop policy if exists orcamentos_del on public.comercial_orcamentos;
create policy orcamentos_del on public.comercial_orcamentos for delete to authenticated using (public.comercial_pode_usar() and situacao = 'rascunho');

-- 4) atualizado_em sozinho.
create or replace function public.comercial_orcamentos_atualizado_trg()
returns trigger language plpgsql set search_path = public as $$
begin
  new.atualizado_em := now();
  return new;
end $$;
drop trigger if exists trg_comercial_orcamentos_atualizado on public.comercial_orcamentos;
create trigger trg_comercial_orcamentos_atualizado before update on public.comercial_orcamentos
  for each row execute function public.comercial_orcamentos_atualizado_trg();
drop trigger if exists trg_comercial_catalogo_atualizado on public.comercial_catalogo_precos;
create trigger trg_comercial_catalogo_atualizado before update on public.comercial_catalogo_precos
  for each row execute function public.comercial_orcamentos_atualizado_trg();

notify pgrst, 'reload schema';
commit;
