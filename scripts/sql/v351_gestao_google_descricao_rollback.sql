-- Desfaz a v351: volta o gatilho de enfileirar do Google Agenda de antes (descrição não reenvia o evento) e tira
-- gestao_google_ve_tarefa. O que já foi reenviado fica como está.
begin;

CREATE OR REPLACE FUNCTION public.gestao_google_enfileirar_trg()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_id text; v_op text;
begin
  -- Guarda anti-loop (forward-compat F3.B): escrita de reflexo do próprio sync não re-enfileira.
  if coalesce(current_setting('gestao.in_google_sync', true), '') = 'on' then
    return null;
  end if;

  if tg_table_name = 'gestao_tarefas' then
    if tg_op = 'DELETE' then
      v_id := old.id_tarefa; v_op := 'delete';
    elsif tg_op = 'INSERT' then
      if new.prazo is null then return null; end if;      -- sem prazo → nada a agendar
      v_id := new.id_tarefa; v_op := 'upsert';
    else -- UPDATE
      if new.prazo is not distinct from old.prazo
         and new.data_inicio is not distinct from old.data_inicio
         and new.hora_inicio is not distinct from old.hora_inicio
         and new.hora_fim is not distinct from old.hora_fim
         and new.titulo is not distinct from old.titulo
         and new.status is not distinct from old.status then
        return null;                                       -- nada relevante mudou
      end if;
      v_id := new.id_tarefa; v_op := 'upsert';
    end if;
  else -- gestao_tarefa_vinculados: enfileira a tarefa-mãe (reconcilia a lista de convidados)
    v_id := coalesce(new.id_tarefa, old.id_tarefa); v_op := 'upsert';
  end if;

  insert into public.gestao_google_fila (id_tarefa, operacao) values (v_id, v_op);
  return null;
end $function$;

drop function if exists public.gestao_google_ve_tarefa(text, text);
notify pgrst, 'reload schema';
commit;
