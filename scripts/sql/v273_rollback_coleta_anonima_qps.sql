-- Rollback da v273. ⚠️ Apaga as respostas anônimas coletadas. Exporte antes.
drop function if exists public.qps_comentarios_coleta(text);
drop function if exists public.qps_resultado_coleta(text);
drop table if exists public.qps_respostas_anonimas;
drop table if exists public.qps_coletas_anonimas;
-- O tipo QPS só sai se nenhuma aplicação o usar:
delete from public.qps_tipos t where t.id_tipo = 'a3e70000-0000-4000-8000-000000000000'
  and not exists (select 1 from public.qps_aplicacoes a where a.id_tipo = t.id_tipo);
