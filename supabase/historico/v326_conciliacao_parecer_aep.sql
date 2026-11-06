-- v326 — Conciliação: parecer na própria AEP (06/11/2026, 0.3.239).
--
-- A empresa que só tem a AEP não tem questionário para ser a coluna do parecer. Com um documento só
-- não há comparação, mas o caminho até o Comercial é o mesmo (pedido do João), então o parecer precisa
-- existir: questionario passa a aceitar AEP. Só alarga a regra; nenhum dado muda.
--
-- Rollback: scripts/sql/v326_conciliacao_parecer_aep_rollback.sql
begin;

alter table public.psico_conciliacao_pareceres drop constraint if exists psico_conciliacao_pareceres_questionario_check;
alter table public.psico_conciliacao_pareceres
  add constraint psico_conciliacao_pareceres_questionario_check check (questionario in ('DRPS', 'QPS', 'AEP'));

-- Correção da v324: a chave em cascata com o gatilho de só inserção impedia apagar a empresa que tem
-- reabertura. A reabertura fica como o fechamento (v310), sem chave: o registro sobrevive à empresa.
alter table public.psico_conciliacao_reaberturas drop constraint if exists psico_conciliacao_reaberturas_id_empresa_fkey;

commit;
