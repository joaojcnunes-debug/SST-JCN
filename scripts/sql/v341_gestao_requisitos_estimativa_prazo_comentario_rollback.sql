-- Rollback da v341 (= v353 do Painel). APAGA: marcações de requisito das colunas, tempos estimados, configuração e
-- avisos do prazo de atendimento e as atribuições/resoluções de comentário. Use junto com a volta do código.
begin;
drop trigger if exists gestao_aviso_comentario_atribuido on public.gestao_comentarios;
drop function if exists public.gestao_aviso_comentario_atribuido_trg();
drop function if exists public.gestao_comentario_resolver(text, boolean);
drop index if exists public.idx_gestao_coment_atribuido;
alter table public.gestao_comentarios drop column if exists resolvido_por;
alter table public.gestao_comentarios drop column if exists resolvido_em;
alter table public.gestao_comentarios drop column if exists atribuido_a;

drop function if exists public.gestao_sla_avisar();
drop function if exists public.gestao_sla_tarefas(text, text[]);
drop function if exists public.gestao_sla_calcular(text);
drop function if exists public.gestao_sla_somar(timestamptz, int, time, time, int[]);
do $$ begin
  if to_regclass('public.auditoria_tabelas') is not null and exists (select 1 from public.auditoria_tabelas where tabela = 'gestao_sla_avisos') then perform public.auditoria_desativar('gestao_sla_avisos'); end if;
  if to_regclass('public.auditoria_tabelas') is not null and exists (select 1 from public.auditoria_tabelas where tabela = 'gestao_sla_quadros') then perform public.auditoria_desativar('gestao_sla_quadros'); end if;
end $$;
drop table if exists public.gestao_sla_avisos;
drop table if exists public.gestao_sla_quadros;
drop function if exists public.gestao_sla_quadro_trg();

alter table public.gestao_tarefas drop constraint if exists gestao_tarefas_tempo_estimado_min_chk;
alter table public.gestao_tarefas drop column if exists tempo_estimado_min;

drop trigger if exists gestao_requisitos_etapa on public.gestao_tarefas;
drop function if exists public.gestao_requisitos_etapa_trg();
drop function if exists public.gestao_mover_forcando_requisito(text, text);
drop function if exists public.gestao_requisitos_faltando(text, text, text);
alter table public.gestao_status drop column if exists requer_anexo;
alter table public.gestao_status drop column if exists requer_checklist;

-- gestao_email_ou_nulo() fica: o gatilho do checklist (v339 endurecido) usa.
notify pgrst, 'reload schema';
commit;
