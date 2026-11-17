-- ROLLBACK v359 — gestao_subtarefa_abrir volta ao corpo da v292 (a janela nasce só com o responsável da linha).
begin;

CREATE OR REPLACE FUNCTION public.gestao_subtarefa_abrir(p_id_subtarefa text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare s record; v_pai record; v_id text;
begin
  select * into s from public.gestao_subtarefas where id = p_id_subtarefa for update;
  if not found then
    raise exception 'Subtarefa não encontrada.' using errcode = 'P0002';
  end if;
  select id_tarefa, id_quadro, id_unidade into v_pai from public.gestao_tarefas where id_tarefa = s.id_tarefa;
  if not (public.gestao_pode_ver(v_pai.id_quadro) and public.gestao_ve_tarefa(v_pai.id_tarefa)) then
    raise exception 'Sem acesso a esta tarefa.' using errcode = '42501';
  end if;
  if s.id_tarefa_filha is not null then
    return s.id_tarefa_filha;
  end if;

  v_id := 'TRF-' || upper(substr(md5(gen_random_uuid()::text), 1, 8));
  perform set_config('gestao.sync_sub', 'on', true);
  insert into public.gestao_tarefas (id_tarefa, id_quadro, titulo, status, id_tarefa_pai, id_unidade, created_by, created_at, updated_at)
  values (v_id, v_pai.id_quadro, s.texto, public.gestao_status_para_feito(v_pai.id_quadro, s.feito),
          v_pai.id_tarefa, v_pai.id_unidade, public.gestao_email(), now(), now());
  if s.responsavel_email is not null then
    insert into public.gestao_tarefa_vinculados (id_tarefa, usuario_email, tipo, origem)
    values (v_id, lower(s.responsavel_email), 'responsavel', 'subtarefa')
    on conflict do nothing;
  end if;
  update public.gestao_subtarefas set id_tarefa_filha = v_id where id = s.id;
  perform set_config('gestao.sync_sub', '', true);
  return v_id;
end $function$;

notify pgrst, 'reload schema';
commit;
