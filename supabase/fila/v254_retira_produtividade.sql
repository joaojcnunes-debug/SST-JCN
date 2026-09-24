-- v254 — DIM-01: retira o módulo Produtividade do banco.
--
-- ⚠️ SÓ APLIQUE DEPOIS DE:
--   1. `scripts/dim01-backup-prod-drill.sh` terminar com **DRILL_OK** — ele prova que o
--      dump das 7 tabelas RESTAURA, não só que existe. Arquivo que ninguém abriu não é
--      backup, é arquivo.
--   2. O código sem o módulo estar no ar (push de 2026-09-23). Dropar com as telas vivas
--      quebraria `/produtividade`; na ordem certa as tabelas ficam órfãs por minutos.
--
-- O QUE SAI, E POR QUÊ ELE ERA PEQUENO:
-- medido em 2026-09-22, antes de qualquer decisão: **56 linhas** nas 7 tabelas
-- (`prod_documentos_sst` vazia), **3 aberturas por 3 pessoas em 30 dias**. Era um piloto
-- que não pegou. Quem faz esse papel de verdade agora é o `/dimensionamento`, com 3.165
-- linhas de cadastro real migradas do app que a consultoria usava.
--
-- O QUE ESTA MIGRATION **NÃO** FAZ:
--   • não remove `produtividade` de `lib/novidades/catalogo.ts` — é changelog, e changelog
--     descreve o passado; reescrevê-lo seria fingir que o módulo nunca existiu.
--   • não concede `dimensionamento` a ninguém — isso foi a v253, aplicada antes.
--
-- ⚠️⚠️ APLICAR ISTO FECHA A JANELA DE ROLLBACK DO CÓDIGO.
-- Até aqui, voltar era `docker tag painel-sst-app:previous latest` + recreate (~1 min):
-- a imagem antiga tem as 8 telas de `/produtividade` vivas. DEPOIS do drop, essa volta
-- passa a ser um defeito: as telas antigas sobem e consultam 7 tabelas que não existem
-- mais. A partir daqui a volta é restaurar o dump do drill + o rollback SQL, e leva
-- dezenas de minutos. Se houver qualquer dúvida sobre o código no ar, resolva ANTES.
--
-- Rollback: scripts/sql/v254_rollback_retira_produtividade.sql (restaura as permissões do
-- backup; as TABELAS voltam do dump do drill, não da migration).

begin;

do $$ begin
  if current_user <> 'chabra_admin' then
    raise exception 'aplicar como chabra_admin';
  end if;
  if not exists (select 1 from public.schema_migrations where version = 'v253_dimensionamento_concede_modulo') then
    raise exception 'v253 (concessão do módulo novo) é pré-requisito: não retire o antigo antes de o novo estar alcançável';
  end if;
end $$;

-- ── 1) Guarda o estado das permissões ANTES ─────────────────────────────────
-- É o que o rollback usa para devolver o array exato de cada conta, em vez de tentar
-- adivinhar quem tinha o quê.
create table if not exists public.backup_v254_produtividade (
  tipo      text not null,            -- 'usuario' | 'funcao'
  chave     text not null,            -- id_usuario | funcao
  modulos   text[],
  salvo_em  timestamptz not null default now(),
  primary key (tipo, chave)
);
alter table public.backup_v254_produtividade enable row level security;
revoke all on public.backup_v254_produtividade from public, anon, authenticated;

insert into public.backup_v254_produtividade (tipo, chave, modulos)
select 'usuario', u.id_usuario, u.modulos_permitidos
  from public.usuarios u
 where u.modulos_permitidos @> array['produtividade']::text[]
on conflict (tipo, chave) do nothing;

insert into public.backup_v254_produtividade (tipo, chave, modulos)
select 'funcao', f.funcao, f.modulos_padrao
  from public.funcoes_painel f
 where f.modulos_padrao @> array['produtividade']::text[]
on conflict (tipo, chave) do nothing;

-- ── 2) Tira o módulo de quem tinha ──────────────────────────────────────────
update public.usuarios
   set modulos_permitidos = array_remove(modulos_permitidos, 'produtividade')
 where modulos_permitidos @> array['produtividade']::text[];

update public.funcoes_painel
   set modulos_padrao = array_remove(modulos_padrao, 'produtividade')
 where modulos_padrao @> array['produtividade']::text[];

delete from public.rls_modulo_tabelas where modulo = 'produtividade';

-- ── 3) Derruba as 7 tabelas ─────────────────────────────────────────────────
-- Ordem: dependentes primeiro. `cascade` cobre policies, gatilhos e as FKs entre elas.
drop table if exists public.prod_projecoes_salvas    cascade;
drop table if exists public.prod_snapshot_mensal     cascade;
drop table if exists public.prod_registros_mensais   cascade;
drop table if exists public.prod_documentos_sst      cascade;
drop table if exists public.prod_colaborador_unidade cascade;
drop table if exists public.prod_colaboradores       cascade;
drop table if exists public.prod_unidades            cascade;

-- ── 4) Prova dentro da própria transação ────────────────────────────────────
do $$
declare sobrou int; ainda int;
begin
  select count(*) into sobrou
    from information_schema.tables
   where table_schema = 'public' and table_name like 'prod!_%' escape '!';
  if sobrou <> 0 then
    raise exception 'sobraram % tabela(s) prod_* — abortando', sobrou;
  end if;

  select count(*) into ainda
    from public.usuarios where modulos_permitidos @> array['produtividade']::text[];
  if ainda <> 0 then
    raise exception '% conta(s) ainda têm o módulo — abortando', ainda;
  end if;

  raise notice 'produtividade retirado: 0 tabelas, 0 contas, backup em backup_v254_produtividade';
end $$;

insert into public.schema_migrations (version)
select 'v254_retira_produtividade'
 where not exists (select 1 from public.schema_migrations where version = 'v254_retira_produtividade');

commit;
