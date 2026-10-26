-- ROLLBACK da v298 (Gestão, automações Pacote A). Rodar DEPOIS de voltar o código.
-- Volta: gatilhos/ações/condições da v291-v292, uma ação por regra (vale `acao` = acoes[0]),
-- e-mail sem mensagem, log legível por todos. As colunas novas ficam (inofensivas); para tirar:
--   alter table public.gestao_automacoes drop column acoes; alter table public.gestao_notificacoes drop column mensagem;

drop trigger if exists trg_gestao_automacao_vinculo on public.gestao_tarefa_vinculados;
drop trigger if exists trg_gestao_automacao_comentario on public.gestao_comentarios;
drop function if exists public.gestao_automacao_vinculo_trg();
drop function if exists public.gestao_automacao_comentario_trg();
drop function if exists public.gestao_automacao_historico(text, int);
drop function if exists public.gestao_automacao_aplicar(public.gestao_automacoes, public.gestao_tarefas, text, jsonb);
drop function if exists public.gestao_automacao_acao(public.gestao_automacoes, jsonb, public.gestao_tarefas, text, jsonb);
drop function if exists public.gestao_automacao_completa_lista(jsonb);

drop trigger if exists trg_gestao_automacao_upd on public.gestao_tarefas;
create trigger trg_gestao_automacao_upd after update on public.gestao_tarefas
  for each row when (old.status is distinct from new.status or old.id_quadro is distinct from new.id_quadro)
  execute function public.gestao_automacao_trg();

create or replace function public.gestao_automacao_completa(p_acao jsonb) returns boolean
  language sql immutable as $$
  select case coalesce(p_acao->>'tipo', '')
    when 'mover_status'             then coalesce(p_acao->>'valor', '') <> ''
    when 'mover_status_se_completo' then coalesce(p_acao->>'valor', '') <> ''
    when 'definir_responsavel'      then coalesce(p_acao->>'valor', '') <> ''
    when 'definir_prioridade'       then coalesce(p_acao->>'valor', '') <> ''
    when 'definir_campo'            then coalesce(p_acao->>'campo_id', '') <> ''
    when 'adicionar_vinculados'     then jsonb_typeof(p_acao->'emails') = 'array' and jsonb_array_length(p_acao->'emails') > 0
    when 'mover_tarefa_quadro'      then coalesce(p_acao->>'id_quadro_destino', '') <> ''
    when 'criar_tarefa_quadro'      then coalesce(p_acao->>'id_quadro_destino', '') <> ''
    when 'criar_subtarefas_modelo'  then coalesce(p_acao->>'modelo_slug', '') <> ''
    when 'notificar'                then true
    when 'solicitar_aprovacao'      then true
    else false
  end;
$$;

create or replace function public.gestao_automacao_completa_trg() returns trigger
  language plpgsql as $$
begin
  if new.ativo and not public.gestao_automacao_completa(new.acao) then new.ativo := false; end if;
  return new;
end $$;

-- As funções abaixo voltam ao texto da v291/v292. Reaplique, nesta ordem, os blocos de:
--   supabase/historico/v292_gestao_subtarefa_janela.sql  → gestao_automacao_trg, gestao_automacao_prazos
--   supabase/historico/v291_gestao_rotina_diaria_automacoes.sql → gestao_automacao_aplicar (3 argumentos)
--   supabase/historico/v223_gestao_automacao_guc_depth_nullif.sql → gestao_automacao_run
--   supabase/historico/v222_gestao_automacao_cond_subtarefa.sql → gestao_automacao_cond_teste
-- e, para o e-mail sem mensagem, gestao_aviso_email_reservar da v290 (drop + create, o retorno muda).

drop policy if exists gestao_autom_log_sel on public.gestao_automacao_log;
create policy gestao_autom_log_sel on public.gestao_automacao_log for select using (true);

notify pgrst, 'reload schema';
