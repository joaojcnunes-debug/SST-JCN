-- ROLLBACK da v288 (JCN). Desfaz, na ordem inversa, as partes v302, v301, v298, v293 e v292 do painel.
-- Rodar no SQL editor do Supabase (uma transação).

-- v302: foto da conta Google
DROP FUNCTION IF EXISTS public.gestao_salvar_foto(text, text);
DROP TABLE IF EXISTS public.gestao_usuario_fotos;

-- v301: evento da agenda vira tarefa
-- ROLLBACK da v301. DEPOIS de voltar o
-- código (o worker da v301 lê as colunas novas).
-- Tarefas que já nasceram de eventos da agenda NÃO são apagadas; seguem como tarefas comuns.

DROP FUNCTION IF EXISTS public.gestao_google_tarefa_do_evento(text, text, text, text, text, date, date, time, time);
DROP FUNCTION IF EXISTS public.gestao_google_sincronizar_convidados(text, text, text[]);
DROP FUNCTION IF EXISTS public.gestao_google_soltar_eventos(text);

-- excluir_inbound volta à definição da v214.
CREATE OR REPLACE FUNCTION public.gestao_google_excluir_inbound(p_id_tarefa text, p_email text)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
begin
  if not exists (select 1 from public.gestao_google_eventos
                  where id_tarefa = p_id_tarefa and usuario_email = p_email) then
    return;
  end if;

  set local gestao.in_google_sync = 'on';

  update public.gestao_tarefas
     set prazo = null, data_inicio = null
   where id_tarefa = p_id_tarefa;

  delete from public.gestao_google_eventos
   where id_tarefa = p_id_tarefa and usuario_email = p_email;
end $function$;

-- Convidados viram responsáveis comuns (o worker antigo não conhece a origem 'google-convidado').
UPDATE public.gestao_tarefa_vinculados SET origem = 'app' WHERE origem = 'google-convidado';

DROP INDEX IF EXISTS public.idx_gestao_google_eventos_evento;
ALTER TABLE public.gestao_google_eventos DROP CONSTRAINT IF EXISTS gestao_google_eventos_origem_chk;
ALTER TABLE public.gestao_google_eventos DROP COLUMN IF EXISTS origem;
ALTER TABLE public.gestao_google_contas DROP COLUMN IF EXISTS importar_desde;

NOTIFY pgrst, 'reload schema';

-- v298: horas na tarefa (trigger volta à v209; a sobrecarga de 7 args sai)
DROP FUNCTION IF EXISTS public.gestao_google_aplicar_inbound(text, date, date, time, time, text, text);
CREATE OR REPLACE FUNCTION public.gestao_google_enfileirar_trg() returns trigger
  language plpgsql security definer set search_path=public as $fn$
declare v_id text; v_op text;
begin
  if coalesce(current_setting('gestao.in_google_sync', true), '') = 'on' then
    return null;
  end if;
  if tg_table_name = 'gestao_tarefas' then
    if tg_op = 'DELETE' then
      v_id := old.id_tarefa; v_op := 'delete';
    elsif tg_op = 'INSERT' then
      if new.prazo is null then return null; end if;
      v_id := new.id_tarefa; v_op := 'upsert';
    else
      if new.prazo is not distinct from old.prazo
         and new.data_inicio is not distinct from old.data_inicio
         and new.titulo is not distinct from old.titulo
         and new.status is not distinct from old.status then
        return null;
      end if;
      v_id := new.id_tarefa; v_op := 'upsert';
    end if;
  else
    v_id := coalesce(new.id_tarefa, old.id_tarefa); v_op := 'upsert';
  end if;
  insert into public.gestao_google_fila (id_tarefa, operacao) values (v_id, v_op);
  return null;
end $fn$;
ALTER TABLE public.gestao_tarefas DROP COLUMN IF EXISTS hora_inicio, DROP COLUMN IF EXISTS hora_fim;

-- v293 e v292
DROP FUNCTION IF EXISTS public.gestao_google_enfileirar_usuario(text);
DROP FUNCTION IF EXISTS public.gestao_google_remover_conta(text);

NOTIFY pgrst, 'reload schema';
