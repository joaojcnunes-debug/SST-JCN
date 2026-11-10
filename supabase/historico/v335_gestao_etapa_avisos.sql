-- v335 — Gestão: "Habilitar notificações" no menu "…" de cada coluna do quadro (10/11/2026, 0.3.257).
-- Trazido do Painel SST (v334, 0.3.869). Quem habilita é avisado (sino + e-mail, tipo 'etapa') quando uma tarefa
-- ENTRA naquela coluna: muda para ela ou é criada já nela. Por pessoa e por coluna.
--   gestao_etapa_avisos               quem segue qual coluna (sem acesso direto: só pelas duas RPCs)
--   gestao_etapa_aviso_alternar()     liga/desliga para quem está logado (só em quadro que ele vê)
--   gestao_etapas_avisadas()          as colunas que eu sigo num quadro (para o menu mostrar o estado)
--   gestao_aviso_status_trg           + avisa quem segue a coluna para onde a tarefa foi
--   gestao_aviso_quadro_trg           + avisa quem segue a coluna em que a tarefa nasceu
-- Os dois gatilhos estavam iguais ao "antes" do Painel (conferido em 10/11). Só avisa quem vê TODAS as tarefas do
-- quadro e a unidade da tarefa, nunca a filha de subtarefa (v292), e não repete para vinculado nem membro avisado.
--
-- Rollback: scripts/sql/v335_gestao_etapa_avisos_rollback.sql (devolve os dois gatilhos como estavam)
begin;

create table if not exists public.gestao_etapa_avisos (
  id_quadro     text not null references public.gestao_quadros(id_quadro) on delete cascade,
  status_slug   text not null,
  usuario_email text not null check (usuario_email = lower(usuario_email)),
  created_at    timestamptz not null default now(),
  primary key (id_quadro, status_slug, usuario_email)
);
alter table public.gestao_etapa_avisos enable row level security;
revoke all on public.gestao_etapa_avisos from public, anon, authenticated;
comment on table public.gestao_etapa_avisos is 'v335: quem segue cada coluna (aviso quando uma tarefa entra nela). Só pelas RPCs.';

create or replace function public.gestao_etapa_aviso_alternar(p_id_quadro text, p_slug text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_email text := lower(coalesce(public.gestao_email(), ''));
begin
  if v_email = '' then raise exception 'Entre no painel.' using errcode = '42501'; end if;
  if not public.gestao_pode_ver(p_id_quadro) then raise exception 'Sem acesso a este quadro.' using errcode = '42501'; end if;
  if not exists (select 1 from public.gestao_status where id_quadro = p_id_quadro and slug = p_slug) then
    raise exception 'Coluna não encontrada.' using errcode = 'P0002';
  end if;
  delete from public.gestao_etapa_avisos where id_quadro = p_id_quadro and status_slug = p_slug and usuario_email = v_email;
  if found then return false; end if;
  insert into public.gestao_etapa_avisos (id_quadro, status_slug, usuario_email) values (p_id_quadro, p_slug, v_email);
  return true;
end $$;

create or replace function public.gestao_etapas_avisadas(p_id_quadro text)
returns setof text
language sql
stable
security definer
set search_path to 'public'
as $$
  select status_slug from public.gestao_etapa_avisos
   where id_quadro = p_id_quadro and usuario_email = lower(coalesce(public.gestao_email(), ''))
$$;

revoke all on function public.gestao_etapa_aviso_alternar(text, text) from public, anon;
revoke all on function public.gestao_etapas_avisadas(text) from public, anon;
grant execute on function public.gestao_etapa_aviso_alternar(text, text) to authenticated;
grant execute on function public.gestao_etapas_avisadas(text) to authenticated;

-- Mudou de coluna: avisa os vinculados (como antes) e, v335, quem segue a coluna nova.
create or replace function public.gestao_aviso_status_trg()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
DECLARE v_nome text; v_ator text := public.gestao_email(); r record;
BEGIN
  SELECT s.nome INTO v_nome FROM public.gestao_status s WHERE s.id_quadro = new.id_quadro AND s.slug = new.status;
  FOR r IN SELECT DISTINCT usuario_email FROM public.gestao_tarefa_vinculados WHERE id_tarefa = new.id_tarefa LOOP
    PERFORM public.gestao_avisar(r.usuario_email, 'status',
      '"' || new.titulo || '" mudou para ' || coalesce(v_nome, new.status), new.id_tarefa, new.id_quadro, v_ator);
  END LOOP;
  -- v335: quem segue a coluna (menu "…" › Habilitar notificações); vinculado já foi avisado acima.
  IF new.id_tarefa_pai IS NULL THEN
    FOR r IN SELECT a.usuario_email AS email FROM public.gestao_etapa_avisos a
              WHERE a.id_quadro = new.id_quadro AND a.status_slug = new.status
                AND NOT EXISTS (SELECT 1 FROM public.gestao_tarefa_vinculados v
                                 WHERE v.id_tarefa = new.id_tarefa AND lower(v.usuario_email) = a.usuario_email) LOOP
      IF public.gestao_nivel_ve_todas(public.gestao_resolver_nivel(r.email, 'task', new.id_tarefa))
         AND public.gestao_unidade_ok(r.email, new.id_tarefa) THEN
        PERFORM public.gestao_avisar(r.email, 'etapa',
          '"' || new.titulo || '" entrou em ' || coalesce(v_nome, new.status), new.id_tarefa, new.id_quadro, v_ator);
      END IF;
    END LOOP;
  END IF;
  RETURN null;
END $function$;

-- Tarefa nova no quadro: avisa os membros que veem todas (como antes) e, v335, quem segue a coluna em que ela
-- nasceu e ainda não foi avisado.
create or replace function public.gestao_aviso_quadro_trg()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
DECLARE v_t record; v_q record; v_ator text := public.gestao_email(); r record; v_avisados text[] := '{}'; v_col text;
BEGIN
  SELECT id_tarefa, id_quadro, titulo, id_tarefa_pai, status INTO v_t FROM public.gestao_tarefas WHERE id_tarefa = new.id_tarefa;
  IF NOT FOUND THEN RETURN null; END IF;
  IF v_t.id_tarefa_pai IS NOT NULL THEN RETURN null; END IF;   -- v292
  SELECT id_quadro, nome, id_pasta, id_espaco, dono_email INTO v_q FROM public.gestao_quadros WHERE id_quadro = v_t.id_quadro;
  IF NOT FOUND OR v_q.dono_email IS NOT NULL THEN RETURN null; END IF;

  FOR r IN
    WITH g AS (
      SELECT a.usuario_email, a.id_equipe FROM public.gestao_acessos a
       WHERE (a.recurso_tipo = 'list'   AND a.recurso_id = v_q.id_quadro)
          OR (a.recurso_tipo = 'folder' AND a.recurso_id = v_q.id_pasta::text)
          OR (a.recurso_tipo = 'space'  AND a.recurso_id = v_q.id_espaco::text)
    )
    SELECT DISTINCT lower(e) AS email FROM (
      SELECT g.usuario_email AS e FROM g WHERE g.usuario_email IS NOT NULL
      UNION ALL
      SELECT m.usuario_email FROM g JOIN public.gestao_equipe_membros m ON m.id_equipe = g.id_equipe
        JOIN public.gestao_equipes eq ON eq.id = m.id_equipe AND eq.ativo
    ) x
  LOOP
    -- Só quem vê TODAS as tarefas do quadro (v304: full, view_all, comment_all); vinculado já é avisado.
    IF public.gestao_nivel_ve_todas(public.gestao_resolver_nivel(r.email, 'task', v_t.id_tarefa))
       AND public.gestao_unidade_ok(r.email, v_t.id_tarefa)
       AND NOT EXISTS (SELECT 1 FROM public.gestao_tarefa_vinculados v WHERE v.id_tarefa = v_t.id_tarefa AND lower(v.usuario_email) = r.email) THEN
      PERFORM public.gestao_avisar(r.email, 'quadro', 'Nova tarefa em ' || v_q.nome || ': ' || v_t.titulo, v_t.id_tarefa, v_q.id_quadro, v_ator);
      v_avisados := v_avisados || r.email;
    END IF;
  END LOOP;

  -- v335: quem segue a coluna em que a tarefa nasceu (e não foi avisado acima nem é vinculado).
  SELECT s.nome INTO v_col FROM public.gestao_status s WHERE s.id_quadro = v_t.id_quadro AND s.slug = v_t.status;
  FOR r IN SELECT a.usuario_email AS email FROM public.gestao_etapa_avisos a
            WHERE a.id_quadro = v_t.id_quadro AND a.status_slug = v_t.status
              AND NOT (a.usuario_email = ANY (v_avisados))
              AND NOT EXISTS (SELECT 1 FROM public.gestao_tarefa_vinculados v
                               WHERE v.id_tarefa = v_t.id_tarefa AND lower(v.usuario_email) = a.usuario_email) LOOP
    IF public.gestao_nivel_ve_todas(public.gestao_resolver_nivel(r.email, 'task', v_t.id_tarefa))
       AND public.gestao_unidade_ok(r.email, v_t.id_tarefa) THEN
      PERFORM public.gestao_avisar(r.email, 'etapa',
        'Nova tarefa em ' || coalesce(v_col, v_t.status) || ' (' || v_q.nome || '): ' || v_t.titulo, v_t.id_tarefa, v_q.id_quadro, v_ator);
    END IF;
  END LOOP;
  RETURN null;
END $function$;

notify pgrst, 'reload schema';

commit;
