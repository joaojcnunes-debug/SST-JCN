-- v253 — DIM-01: concede o módulo dimensionamento.
--
-- NO JCN ESTA MIGRATION DIVERGE DO PAINEL, DE PROPÓSITO (decidido com o usuário
-- em 2026-09-24).
--
-- No painel ela dá 'dimensionamento' a toda conta Admin ativa, porque lá o
-- módulo sobe com 3.165 linhas de cadastro real migradas do app que a
-- consultoria usava (scripts/dim01-carga.sh). Aqui não há o que carregar: a
-- v249 só cria esquema, e o dado da Chabra não atravessa para o JCN. Em
-- particular dim_portes e dim_parametros ficam VAZIAS — e sem elas o módulo
-- renderiza mas não calcula.
--
-- Então o esquema entra e o módulo fica DORMENTE: ninguém recebe
-- 'dimensionamento' em modulos_permitidos. Ele acende quando alguém definir
-- quais são os portes e parâmetros do JCN — basta um update em usuarios, ou
-- aplicar a função TI pela tela Sistema › Funções.
--
-- O QUE ENTRA da original: o módulo no modulos_padrao da função TI. Isso é
-- template do catálogo, não concessão: não muda modulos_permitidos de ninguém
-- hoje, e deixa a tela pronta para o dia da decisão.
--
-- O QUE SAI: o UPDATE em public.usuarios, a tabela backup_v253_modulos (que só
-- existia para dar marcha a ré nesse UPDATE) e o insert em
-- public.schema_migrations (rastreador do self-host, inexistente aqui).
--
-- A guarda final foi INVERTIDA. A original aborta se nenhuma conta Admin ficou
-- com o módulo ("subiria inalcançável"); aqui inalcançável é o estado correto,
-- então a guarda aborta se alguém tiver.
--
-- ROLLBACK: scripts/sql/v253_rollback_dimensionamento_concede_modulo.sql

do $$ begin
  if current_user <> 'postgres' then
    raise exception 'aplicar como postgres';
  end if;
  if to_regclass('public.dim_unidades') is null or to_regclass('public.dim_historico') is null then
    raise exception 'v249_dimensionamento (schema dim_*) é pré-requisito desta migration';
  end if;
end $$;

update public.funcoes_painel f
   set modulos_padrao = coalesce(f.modulos_padrao, '{}'::text[]) || array['dimensionamento']::text[]
 where f.funcao = 'TI'
   and not (coalesce(f.modulos_padrao, '{}'::text[]) @> array['dimensionamento']::text[]);

do $$
declare n int; t int;
begin
  select count(*) into n
    from public.usuarios
   where modulos_permitidos @> array['dimensionamento']::text[];
  if n <> 0 then
    raise exception 'v253/JCN: % conta(s) com o modulo dimensionamento — aqui ele deve nascer dormente', n;
  end if;
  select count(*) into t
    from public.funcoes_painel
   where funcao = 'TI' and modulos_padrao @> array['dimensionamento']::text[];
  if t <> 1 then
    raise exception 'v253/JCN: a funcao TI nao ficou com dimensionamento em modulos_padrao';
  end if;
  raise notice 'v253/JCN: esquema dim_* no lugar, modulo DORMENTE (0 contas), template da funcao TI pronto';
end $$;

notify pgrst, 'reload schema';
