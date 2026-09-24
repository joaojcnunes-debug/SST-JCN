-- v234 — HOTFIX de segurança (SEC-GESTAO-05): guardas de RPC inertes para papel NULL.
--
-- NUMERAÇÃO: aplicada na .107 em 2026-09-21 registrada como 'v231_sec_gestao_guardas_null'; renumerada para
-- v234 porque v231/v232/v233 já estavam tomadas por outras frentes (presenca_auditoria_gerencia,
-- modulo_aberturas_log_leitura, cargos_canonicos). O wrapper da v235 renomeia o registro
-- (update schema_migrations set version='v234_…' where version='v231_…'). Não reaplicar.
--
-- Achado do revisor-seguranca (2026-09-21) ao revisar as equipes (hoje v235):
--   `gestao_papel_de(e-mail)` devolve NULL para quem NÃO é membro da Gestão (interno sem o módulo
--   ou Cliente do portal). Em PL/pgSQL, `IF NOT <NULL> THEN raise` NÃO dispara (NULL é tratado
--   como falso). Logo:
--     • `gestao_definir_membro` (v221:25) — `if v_ator_papel not in ('owner','admin')` com papel NULL
--       não levanta → QUALQUER `authenticated` (inclusive Cliente) podia chamar
--       `rpc/gestao_definir_membro(p_alvo=<ele>, 'owner', true, 'xxxxx')` e virar OWNER da Gestão.
--     • `gestao_eh_gestor` devolve NULL (não false) para não-membro — toda guarda `if not
--       gestao_eh_gestor(...)` fica inerte.
--   Membros comuns ('membro') eram barrados; o furo é para NÃO-membros autenticados E para `anon`:
--   a função nunca teve `revoke execute` (default privileges dão EXECUTE a PUBLIC) e, chamada por `anon`,
--   `gestao_email()` = NULL → papel NULL → guarda inerte → a chave pública do bundle podia inserir
--   qualquer e-mail como owner (2ª rodada do revisor, N2).
--
-- Correção (fail-closed, sem mudar assinaturas — ACL preservada):
--   1) gestao_eh_gestor → coalesce(..., false).
--   2) gestao_definir_membro → `v_ator_papel is null or ...`. Corpo idêntico ao v221 no resto.
--   3) revoke execute de gestao_definir_membro para public/anon (só authenticated/service_role).
-- Auditoria do mesmo padrão: gestao_alterar_acesso (v116) já tem `if v_papel is null then raise`;
-- gestao_vincular/desvincular (v195) e gestao_decidir_aprovacao (v202/v224) caem em `pode_editar_q`
-- = coalesce(false) → fechados para não-membro. Policies (USING) tratam NULL como negado.
--
-- Sem tabela/coluna nova → sem reload do PostgREST. Rollback: scripts/sql/v234_rollback_sec_gestao_guardas_null.sql.

-- JCN: no self-host o dono das funcoes SECURITY DEFINER e chabra_admin; aqui e postgres.
do $$ begin if current_user <> 'postgres' then raise exception 'aplicar como postgres (dono das funções SECURITY DEFINER)'; end if; end $$;

begin;

create or replace function public.gestao_eh_gestor(p_email text) returns boolean
  language sql stable security definer set search_path=public as $$
  select coalesce(public.gestao_papel_de(p_email) in ('owner','admin'), false);
$$;

create or replace function public.gestao_definir_membro(p_alvo text, p_papel gestao_papel, p_ativo boolean, p_motivo text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_ator text := public.gestao_email(); v_ator_papel public.gestao_papel; v_ant public.gestao_papel; v_log uuid;
begin
  if length(trim(coalesce(p_motivo,''))) < 5 then raise exception 'motivo obrigatório (mínimo 5 caracteres)'; end if;
  v_ator_papel := public.gestao_papel_de(v_ator);
  -- v234 (hotfix): NULL (não-membro) BARRA — antes o `not in` com NULL era inerte.
  if v_ator_papel is null or v_ator_papel not in ('owner','admin') then raise exception 'apenas Owner/Admin gerenciam o roster'; end if;
  select papel into v_ant from public.gestao_membros where lower(usuario_email)=lower(p_alvo);
  if v_ator_papel = 'admin' and (p_papel = 'owner' or v_ant = 'owner') then
    raise exception 'admin não promove/altera owner';
  end if;
  insert into public.gestao_membros (usuario_email, papel, ativo, adicionado_por)
    values (p_alvo, p_papel, coalesce(p_ativo, true), v_ator)
  on conflict (lower(usuario_email)) do update set papel=excluded.papel, ativo=excluded.ativo;
  insert into public.gestao_acesso_log (ator_email, alvo_email, acao, motivo)
    values (v_ator, p_alvo,
            (case when v_ant is null then 'convidou' when coalesce(p_ativo,true)=false then 'removeu' else 'alterou_papel' end)::public.gestao_acao,
            p_motivo)
    returning id into v_log;
  return v_log;
end $function$;

revoke execute on function public.gestao_definir_membro(text, public.gestao_papel, boolean, text) from public, anon;
grant execute on function public.gestao_definir_membro(text, public.gestao_papel, boolean, text) to authenticated, service_role;

commit;
