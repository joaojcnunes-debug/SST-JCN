-- Rollback da v375: apaga o catálogo de preços e os orçamentos (ATENÇÃO: perde os orçamentos gravados).
begin;
drop table if exists public.comercial_orcamentos;
drop table if exists public.comercial_catalogo_precos;
drop sequence if exists public.comercial_orcamento_numero_seq;
drop function if exists public.comercial_orcamentos_atualizado_trg();
drop function if exists public.comercial_pode_usar();
notify pgrst, 'reload schema';
commit;
