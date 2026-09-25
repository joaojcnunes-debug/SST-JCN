-- v258 — Certificados de treinamento: controle de quem está emitindo.
--
-- Pedido em 2026-09-25: página "Certificados" no menu do Painel SST para
-- registrar os certificados de treinamento (NR-35, NR-10…) emitidos aos
-- trabalhadores das empresas atendidas, e saber QUEM emitiu cada um.
--
-- Até aqui o sistema não tinha nada disso: `treinamentos_nr` é o treinamento
-- RECOMENDADO no laudo de inspeção, não o certificado entregue.
--
-- Quem emitiu fica em duas colunas: `emitido_por_id` (FK para o usuário, que é
-- o que a tela filtra) e `emitido_por_nome` (retrato do nome no dia — o
-- certificado continua dizendo quem assinou mesmo se o usuário for renomeado
-- ou excluído, e por isso a FK é ON DELETE SET NULL).
--
-- Escopo de leitura segue o das empresas (`caller_pode_ver_empresa`, por
-- unidade); escrita exige perfil Admin/Técnico (`caller_pode_editar`).
--
-- Rollback: scripts/sql/v258_rollback_certificados_treinamento.sql

begin;

do $$ begin
  if current_user <> 'postgres' then
    raise exception 'aplicar como postgres';
  end if;
end $$;

create table if not exists public.certificados_treinamento (
  id_certificado     uuid primary key default gen_random_uuid(),
  id_empresa         text not null references public.empresas(id_empresa) on delete restrict,
  trabalhador_nome   text not null check (length(trim(trabalhador_nome)) > 0),
  trabalhador_cpf    text,
  setor              text,
  cargo              text,
  nr                 text,
  treinamento        text not null check (length(trim(treinamento)) > 0),
  carga_horaria      numeric(6,2) check (carga_horaria is null or carga_horaria > 0),
  data_realizacao    date,
  data_emissao       date not null default current_date,
  validade           date,
  numero             text,
  instrutor          text,
  emitido_por_id     text references public.usuarios(id_usuario) on delete set null,
  emitido_por_nome   text not null,
  observacoes        text,
  criado_por_email   text default lower(auth.jwt() ->> 'email'),
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now(),
  constraint certificados_validade_depois_emissao
    check (validade is null or validade >= data_emissao)
);

comment on table public.certificados_treinamento is
  'Certificados de treinamento emitidos aos trabalhadores das empresas. emitido_por_* = quem emitiu (v258).';

create index if not exists certificados_treinamento_empresa_idx
  on public.certificados_treinamento (id_empresa);
create index if not exists certificados_treinamento_emissor_idx
  on public.certificados_treinamento (emitido_por_id);
create index if not exists certificados_treinamento_emissao_idx
  on public.certificados_treinamento (data_emissao desc);

create or replace function public.certificados_treinamento_touch()
returns trigger language plpgsql set search_path = public as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

drop trigger if exists trg_certificados_treinamento_touch on public.certificados_treinamento;
create trigger trg_certificados_treinamento_touch
  before update on public.certificados_treinamento
  for each row execute function public.certificados_treinamento_touch();

alter table public.certificados_treinamento enable row level security;

drop policy if exists certificados_ler on public.certificados_treinamento;
create policy certificados_ler on public.certificados_treinamento
  for select to authenticated
  using (public.caller_pode_ver_empresa(id_empresa));

drop policy if exists certificados_inserir on public.certificados_treinamento;
create policy certificados_inserir on public.certificados_treinamento
  for insert to authenticated
  with check (public.caller_pode_editar() and public.caller_pode_ver_empresa(id_empresa));

drop policy if exists certificados_alterar on public.certificados_treinamento;
create policy certificados_alterar on public.certificados_treinamento
  for update to authenticated
  using (public.caller_pode_editar() and public.caller_pode_ver_empresa(id_empresa))
  with check (public.caller_pode_editar() and public.caller_pode_ver_empresa(id_empresa));

drop policy if exists certificados_excluir on public.certificados_treinamento;
create policy certificados_excluir on public.certificados_treinamento
  for delete to authenticated
  using (public.caller_pode_editar() and public.caller_pode_ver_empresa(id_empresa));

grant select, insert, update, delete on public.certificados_treinamento to authenticated;

-- ── Prova dentro da própria transação ───────────────────────────────────────
do $$ begin
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'certificados_treinamento' and c.relrowsecurity
  ) then
    raise exception 'certificados_treinamento sem RLS';
  end if;
  if (select count(*) from pg_policies
       where schemaname = 'public' and tablename = 'certificados_treinamento') <> 4 then
    raise exception 'certificados_treinamento: esperava 4 policies';
  end if;
end $$;

commit;
