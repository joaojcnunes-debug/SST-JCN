-- Rollback da v239 — remove a coluna calculada `tem_associado` de inspecoes.
-- Antes de rodar, tire a pílula "Associados" da lista (v0.3.630), senão ela
-- passa a dar erro 400 ao ser clicada.

begin;
drop function if exists public.tem_associado(public.inspecoes);
delete from public.schema_migrations where version = 'v239_inspecoes_tem_associado';
commit;

notify pgrst, 'reload schema';
