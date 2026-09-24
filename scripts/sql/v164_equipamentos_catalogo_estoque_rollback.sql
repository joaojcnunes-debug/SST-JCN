-- ROLLBACK da v164 — desfaz catálogo, razão de estoque e saldo.
--
-- ATENÇÃO: apaga TODAS as movimentações de estoque. Se já houve entrada real
-- lançada em produção, o histórico vai junto — exporte antes se quiser guardar:
--   \copy (select * from public.equipamentos_movimentacoes) to 'mov.csv' csv header
--
-- Rodar à mão:  psql -1 -v ON_ERROR_STOP=1 -f v164_equipamentos_catalogo_estoque_rollback.sql

do $$
begin
  if to_regclass('public.equipamentos_entregas') is not null then
    raise exception 'Rollback da v164 abortado: a v166 (entregas) esta aplicada. Rode os rollbacks na ordem inversa.';
  end if;
  if to_regclass('public.equipamentos_importacoes_nfe') is not null then
    raise exception 'Rollback da v164 abortado: a v165 (NF-e) esta aplicada. Rode os rollbacks na ordem inversa.';
  end if;
end $$;

drop function if exists public.equipamento_lancar_entrada(text, text, numeric, text, text, text);
drop function if exists public.equipamento_ajustar_saldo(text, text, numeric, text);
drop view  if exists public.v_equipamentos_saldo;

alter table public.equipamentos drop column if exists id_catalogo;

drop table if exists public.equipamentos_movimentacoes;
drop table if exists public.equipamentos_catalogo;

delete from public.schema_migrations where version = 'v164_equipamentos_catalogo_estoque';
