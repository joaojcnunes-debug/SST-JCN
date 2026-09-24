-- v200 ROLLBACK — desfaz "responsavel por subtarefa" (GESTAO-UX-01-UXB-SUBRESP).
--
-- ⚠️  NAO E UMA MIGRATION — por isso mora aqui, fora de supabase/migrations/, e o nome
--     contem "rollback" (migrate.ps1 pula arquivos com "rollback" no nome). Nunca roda no
--     deploy. So executar manualmente, a mao, no psql/SQL Editor, se a v200 precisar voltar.
--
-- ORDEM DURA: a FUNCAO volta PRIMEIRO (de volta aos 8 ramos, sem o 7.5), so DEPOIS a coluna
--     e dropada — senao a funcao nova (com o ramo 7.5) referenciaria uma coluna que ja nao existe.
-- Front: git revert do commit da subtarefa-responsavel.

begin;

-- (1) gestao_ve_tarefa de volta aos 8 ramos (SEM o ramo 7.5) — corpo vivo pre-v200.
create or replace function public.gestao_ve_tarefa(p_id_tarefa text)
 returns boolean
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
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

  -- 8) senao, nao ve
  return false;
end
$function$;

alter function public.gestao_ve_tarefa(text) owner to chabra_admin;

-- (2) so agora a coluna (a funcao ja nao a referencia mais)
alter table public.gestao_subtarefas drop column if exists responsavel_email;

-- (3) remove a marca da migration (o apply insere, o rollback remove).
delete from public.schema_migrations where version = 'v200_gestao_subtarefa_responsavel';

commit;
