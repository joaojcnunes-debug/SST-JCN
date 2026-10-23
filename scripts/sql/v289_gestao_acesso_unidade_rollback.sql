-- ROLLBACK da v289 (JCN). Aplicar DEPOIS dos rollbacks v292, v291 e v290 (eles usam gestao_unidade_ok).
-- Rodar no SQL editor do Supabase (uma transação).

-- ROLLBACK da v294 (acesso por unidade na Gestão). 
-- Volta gestao_ve_tarefa à versão anterior (igual à do JCN em 23/10/2026) e remove o que a v294 criou.
-- O valor 'alterou_unidades' do enum gestao_acao fica (Postgres não remove valor de enum; não atrapalha).

DROP TRIGGER IF EXISTS trg_gestao_tarefa_unidade ON public.gestao_tarefas;
DROP FUNCTION IF EXISTS public.gestao_tarefa_unidade_trg();
DROP FUNCTION IF EXISTS public.gestao_definir_unidades(text, text[], text);

CREATE OR REPLACE FUNCTION public.gestao_ve_tarefa(p_id_tarefa text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_email text;
  v_papel public.gestao_papel;
begin
  -- 1) sem e-mail no JWT -> nao ve
  v_email := public.gestao_email();
  if v_email is null then
    return false;
  end if;

  -- 2) gestor global (owner/admin; perfil=Admin vira owner) ve TODAS
  v_papel := public.gestao_papel_de(v_email);
  if v_papel in ('owner','admin') then
    return true;
  end if;

  -- 3) nao-membro (papel nulo) nao ve
  if v_papel is null then
    return false;
  end if;

  -- 4) gestor DO quadro/espaco da tarefa: nivel herdado 'full' (>=4). Membro de quadro
  --    ABERTO resolve 'edit' (3) e NAO passa aqui — e exatamente o ponto do flip.
  if public.gestao_nivel_ord(
       public.gestao_resolver_nivel(v_email, 'task'::public.gestao_recurso, p_id_tarefa)
     ) >= 4 then
    return true;
  end if;

  -- 4b) v235: supervisor de equipe ve as tarefas do MEU QUADRO dos membros que supervisiona
  --     (restrito a quadros com dono_email; NAO generaliza "edit ve tudo").
  if exists (
       select 1 from public.gestao_tarefas t
       join public.gestao_quadros q on q.id_quadro = t.id_quadro
       where t.id_tarefa = p_id_tarefa
         and q.dono_email is not null
         and coalesce(public.gestao_supervisiona(v_email, q.dono_email), false)
     ) then
    return true;
  end if;

  -- 5) grant explicito NAO-restritivo na PROPRIA tarefa (view/comment/edit/full)
  if exists (
       select 1 from public.gestao_acessos a
       where a.recurso_tipo = 'task'::public.gestao_recurso
         and a.recurso_id = p_id_tarefa
         and coalesce(a.restritivo, false) = false
         and lower(a.usuario_email) = v_email
     ) then
    return true;
  end if;

  -- 6) vinculado (responsavel ou seguidor) a tarefa
  if exists (
       select 1 from public.gestao_tarefa_vinculados v
       where v.id_tarefa = p_id_tarefa
         and lower(v.usuario_email) = v_email
     ) then
    return true;
  end if;

  -- 7) criador da tarefa (created_by = e-mail do caller)
  if exists (
       select 1 from public.gestao_tarefas t
       where t.id_tarefa = p_id_tarefa
         and lower(t.created_by) = v_email
     ) then
    return true;
  end if;

  -- 7.5) responsavel de alguma subtarefa desta tarefa (alocar subtarefa -> ve a tarefa-mae)
  if exists (
       select 1 from public.gestao_subtarefas s
       where s.id_tarefa = p_id_tarefa
         and lower(s.responsavel_email) = v_email
     ) then
    return true;
  end if;

  -- 8) senao, nao ve
  return false;
end
$function$
;

DROP FUNCTION IF EXISTS public.gestao_unidade_ok(text, text);
ALTER TABLE public.gestao_tarefas DROP COLUMN IF EXISTS id_unidade;
ALTER TABLE public.gestao_quadros DROP COLUMN IF EXISTS id_unidade;
ALTER TABLE public.gestao_membros DROP COLUMN IF EXISTS unidades;
DROP FUNCTION IF EXISTS public.gestao_unidade_de_etiquetas(text[]);
DROP FUNCTION IF EXISTS public.gestao_norm_unidade(text);
DROP TRIGGER IF EXISTS trg_gestao_unidade_nova ON public.unidades;
DROP FUNCTION IF EXISTS public.gestao_unidade_nova_trg();
DROP TABLE IF EXISTS public.gestao_unidades;
NOTIFY pgrst, 'reload schema';
