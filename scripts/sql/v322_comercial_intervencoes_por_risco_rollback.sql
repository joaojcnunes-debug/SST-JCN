-- Rollback da v322: apaga as intervenções por risco e as funções dela.
-- DEPOIS DE RODAR ESTE, rode supabase/historico/v321_comercial_liberacoes.sql para recriar a fila.
-- Atenção: o corte da fila é recriado com a data do novo rodar, porque a função dele foi apagada.
-- Se reverter, reverta também o código da 0.3.235.
begin;

drop function if exists public.comercial_intervencao_salvar(text, text, text, text, text, text, text, text, text, text, integer);
drop function if exists public.comercial_intervencao_retirar(text, text);
drop table if exists public.comercial_atendimento_intervencoes;

commit;
