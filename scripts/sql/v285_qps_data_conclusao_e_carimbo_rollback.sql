-- ROLLBACK da v285
begin;
drop trigger if exists trg_qps_carimbar_data_conclusao on public.qps_aplicacoes;
drop function if exists public.qps_carimbar_data_conclusao();
alter table public.qps_respondentes drop column if exists data_carimbo;
alter table public.qps_aplicacoes drop column if exists data_conclusao;
commit;
notify pgrst, 'reload schema';
