-- Rollback da v262. As fontes escolhidas e o catálogo são APAGADOS; as telas
-- voltam a mostrar a fonte geradora padrão de cada tópico/categoria.
begin;
drop table if exists public.psi_fontes_geradoras;
alter table public.drps_relatorios drop column if exists fontes_por_setor;
alter table public.qps_aplicacoes drop column if exists fontes_por_setor;
commit;
