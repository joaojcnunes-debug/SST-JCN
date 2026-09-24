-- ROLLBACK da v190 — Escala de Supervisores (Fase 1).
--
-- Mora em scripts/sql/ e NAO em supabase/migrations/ de proposito: o migrate.ps1 varre
-- a pasta de migrations e ignora arquivo com "rollback" no nome, mas a regra ja falhou
-- uma vez (v138) -- entao o arquivo fica fora do caminho dele.
--
-- APAGA TODA A ESCALA. Se ja existir supervisor, padrao ou dia lancado, isso e perda de
-- dado real. Confira antes:
--     select
--       (select count(*) from public.escala_supervisores)   as supervisores,
--       (select count(*) from public.escala_dias)           as dias,
--       (select count(*) from public.escala_padrao_semanal) as padroes,
--       (select count(*) from public.escala_log)            as log;
--
-- Nao toca em public.unidades nem em nenhuma tabela gg_*: a v190 so leu unidades.
-- begin;...commit; PROPRIO -- NAO aplicar com psql -1.

begin;

-- (1) Tira o modulo de quem recebeu na v190 §12.
update public.usuarios
  set modulos_permitidos = array_remove(modulos_permitidos, 'escala_supervisores')
  where modulos_permitidos is not null
    and 'escala_supervisores' = any(modulos_permitidos);

-- (2) Tabelas. Ordem inversa da criacao; o cascade cuida das FKs internas.
drop table if exists public.escala_log            cascade;
drop table if exists public.escala_regras         cascade;
drop table if exists public.escala_feriados       cascade;
drop table if exists public.escala_dias           cascade;
drop table if exists public.escala_padrao_semanal cascade;
drop table if exists public.escala_unidade_config cascade;
drop table if exists public.escala_supervisores   cascade;

-- (3) Funcoes.
drop function if exists public.escala_semear_feriados(int);
drop function if exists public.escala_pascoa(int);

commit;
