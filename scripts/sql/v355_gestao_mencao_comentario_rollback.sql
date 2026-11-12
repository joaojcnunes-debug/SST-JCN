begin;
-- Rollback da v355 (= v368 do Painel): volta o aviso de comentário anterior (menção por "@Nome Completo" ou "@Primeiro", sem a regra do
-- primeiro nome único) e tira a gestao_mencionados. Os avisos já criados ficam.
create or replace function public.gestao_aviso_comentario_trg()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE v_t record; v_ator text := public.gestao_email(); v_txt text := lower(coalesce(new.texto, '')); r record;
  v_mencionados text[] := '{}';
BEGIN
  SELECT titulo, id_quadro INTO v_t FROM public.gestao_tarefas WHERE id_tarefa = new.id_tarefa;
  IF NOT FOUND THEN RETURN null; END IF;
  -- Mesma regra do detectarMencoes do app: "@Nome Completo" ou "@Primeiro".
  IF position('@' in v_txt) > 0 THEN
    SELECT coalesce(array_agg(DISTINCT lower(u.email)), '{}') INTO v_mencionados
      FROM public.usuarios u
     WHERE u.perfil <> 'Cliente' AND coalesce(u.ativo_sistema, true) AND btrim(coalesce(u.nome, '')) <> ''
       AND (position('@' || lower(btrim(u.nome)) in v_txt) > 0
            OR position('@' || lower(split_part(btrim(u.nome), ' ', 1)) in v_txt) > 0);
  END IF;
  FOR r IN SELECT unnest(v_mencionados) AS email LOOP
    PERFORM public.gestao_avisar(r.email, 'mencao', 'Você foi mencionado em "' || v_t.titulo || '"', new.id_tarefa, v_t.id_quadro, v_ator);
  END LOOP;
  FOR r IN SELECT DISTINCT lower(usuario_email) AS email FROM public.gestao_tarefa_vinculados WHERE id_tarefa = new.id_tarefa LOOP
    IF NOT (r.email = ANY (v_mencionados)) THEN
      PERFORM public.gestao_avisar(r.email, 'comentario', 'Novo comentário em "' || v_t.titulo || '"', new.id_tarefa, v_t.id_quadro, v_ator);
    END IF;
  END LOOP;
  RETURN null;
END $function$;

drop function if exists public.gestao_mencionados(text);
notify pgrst, 'reload schema';
commit;
