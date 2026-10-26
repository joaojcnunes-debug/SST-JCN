-- ROLLBACK da v301 (Gestão, automações Pacote D — gatilhos do SST). Rodar DEPOIS de voltar o código.
-- O relógio volta a não chamar os vencimentos: reaplique gestao_automacao_relogio do arquivo
-- supabase/historico/v299_gestao_automacoes_pacote_b.sql ANTES de apagar gestao_automacao_vencimentos.
-- gestao_automacao_cond_teste e gestao_automacao_regra_completa voltam às da v298/v299 (os campos e
-- gatilhos do SST deixam de existir; nada quebra se ficarem).

update public.gestao_automacoes set ativo = false
 where gatilho in ('sst_inspecao_concluida', 'sst_documento_concluido', 'sst_vencimento');

drop trigger if exists trg_inspecoes_automacao_sst on public.inspecoes;
drop trigger if exists trg_inspecoes_automacao_sst_ins on public.inspecoes;
drop function if exists public.gestao_automacao_inspecao_trg();
drop function if exists public.gestao_automacao_vencimentos();
drop function if exists public.gestao_automacao_evento_sst(text, jsonb, text);
drop function if exists public.gestao_sst_ctx_inspecao(text);

notify pgrst, 'reload schema';
