-- ROLLBACK da v290 (JCN). Aplicar DEPOIS do rollback v291 (o aviso de quadro usa gestao_avisar).
-- Rodar no SQL editor do Supabase (uma transação).

-- ROLLBACK da v296 (vários responsáveis + avisos por servidor + e-mail).
--  O app anterior (v0.3.755) volta a criar
-- os avisos pelo navegador. Os avisos já criados ficam; as colunas de e-mail saem.

DROP TRIGGER IF EXISTS trg_gestao_aviso_vinculo ON public.gestao_tarefa_vinculados;
DROP TRIGGER IF EXISTS trg_gestao_aviso_status ON public.gestao_tarefas;
DROP TRIGGER IF EXISTS trg_gestao_aviso_comentario ON public.gestao_comentarios;
DROP FUNCTION IF EXISTS public.gestao_aviso_vinculo_trg();
DROP FUNCTION IF EXISTS public.gestao_aviso_status_trg();
DROP FUNCTION IF EXISTS public.gestao_aviso_comentario_trg();
DROP FUNCTION IF EXISTS public.gestao_avisar(text, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.gestao_aviso_email_reservar(int);
DROP FUNCTION IF EXISTS public.gestao_aviso_email_concluir(uuid, boolean, text);
DROP INDEX IF EXISTS public.idx_gestao_notif_email_pend;
ALTER TABLE public.gestao_notificacoes DROP COLUMN IF EXISTS email_tentativas,
  DROP COLUMN IF EXISTS email_reservado_em, DROP COLUMN IF EXISTS email_erro;

-- Espelho volta a guardar só o último responsável (igual à do JCN em 23/10/2026).
CREATE OR REPLACE FUNCTION public.gestao_vinculo_espelho_trg()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_id text; v_nome text;
begin
  -- guarda de recursao: se ja estamos dentro de um sync, nao reentra.
  if coalesce(current_setting('gestao.in_vinculo_sync', true), '') = 'on' then
    return null;
  end if;
  -- so reconcilia quando o papel envolvido e 'responsavel'.
  if coalesce(new.tipo, old.tipo) is distinct from 'responsavel' then
    return null;
  end if;
  v_id := coalesce(new.id_tarefa, old.id_tarefa);

  select u.nome into v_nome
    from public.gestao_tarefa_vinculados v
    join public.usuarios u on lower(u.email) = v.usuario_email
   where v.id_tarefa = v_id and v.tipo = 'responsavel'
   order by v.created_at desc
   limit 1;

  perform set_config('gestao.in_vinculo_sync', 'on', true);   -- is_local: so nesta transacao
  update public.gestao_tarefas
     set responsavel = v_nome, updated_at = now()
   where id_tarefa = v_id and responsavel is distinct from v_nome;
  perform set_config('gestao.in_vinculo_sync', 'off', true);

  return null;
end $function$
;

NOTIFY pgrst, 'reload schema';
