-- v200 — GESTAO-UX-01-UXB-SUBRESP: responsavel por subtarefa.
--
-- Pedido do operador sobre a F2.1 (ja no ar): cada subtarefa aloca UM responsavel, e quem
-- e responsavel de subtarefa passa a enxergar a tarefa-mae. Decisoes (2026-09-04): 1
-- responsavel por subtarefa (coluna, nao tabela) + subtarefa-responsavel ganha visao da tarefa.
--
-- Idempotente. NAO grava schema_migrations (migrate.ps1 insere a marca no apply manual).
-- A coluna herda os grants e a RLS de satelite da F2.1 (v199) — SEM grant novo, SEM policy nova.
-- gestao_ve_tarefa: mesmo corpo vivo (ramos 1-8, lido por pg_get_functiondef em 2026-09-04),
-- inserindo APENAS o ramo 7.5 antes do return false final. As 12 policies chamam a funcao ->
-- a visao propaga sozinha, sem tocar policy/trigger/jsonb.

begin;

-- (1) coluna nullable (sem grant/policy nova; herda o satelite da F2.1)
alter table public.gestao_subtarefas add column if not exists responsavel_email text;

-- (2) gestao_ve_tarefa: ramos 1-8 verbatim do corpo vivo + ramo 7.5
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
$function$;

alter function public.gestao_ve_tarefa(text) owner to chabra_admin;

commit;
