-- ROLLBACK da v165 — desfaz a importação de NF-e.
--
-- ATENÇÃO: as movimentações de estoque geradas pelas notas (origem='nf') NÃO são
-- apagadas por este script — elas vivem em equipamentos_movimentacoes, que é
-- append-only e cuja remoção mudaria o saldo em silêncio. Se a intenção for
-- zerar também o saldo vindo de nota, apague explicitamente DEPOIS de conferir:
--   select id_unidade, sum(case when tipo='saida' then -quantidade else quantidade end)
--     from public.equipamentos_movimentacoes where origem = 'nf' group by 1;
--   delete from public.equipamentos_movimentacoes where origem = 'nf';
--
-- Rodar à mão:  psql -1 -v ON_ERROR_STOP=1 -f v165_equipamentos_importacao_nfe_rollback.sql

drop function if exists public.equipamento_importar_nfe(text, text, text, text, text, date, numeric, text, jsonb);

drop table if exists public.equipamentos_importacoes_nfe_itens;
drop table if exists public.equipamentos_importacoes_nfe;

delete from public.schema_migrations where version = 'v165_equipamentos_importacao_nfe';
