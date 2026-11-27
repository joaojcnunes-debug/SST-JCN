-- Rollback da v374: tira os avisos do Comercial (gatilhos e funções). Os avisos já criados ficam na caixa de cada um.
begin;
drop trigger if exists trg_comercial_aviso_inspecao on public.inspecoes;
drop trigger if exists trg_comercial_aviso_aep on public.aep_relatorios;
drop trigger if exists trg_comercial_aviso_atendimento on public.comercial_atendimentos;
drop trigger if exists trg_comercial_aviso_atendimento_grupo on public.comercial_atendimentos_grupo;
drop function if exists public.comercial_aviso_liberacao_trg();
drop function if exists public.comercial_aviso_atendimento_trg();
drop function if exists public.comercial_avisar(text, text);
drop function if exists public.comercial_nome_empresa(text);
commit;
