-- v118 — Gestão Chabra: Fase 4b — sincroniza o modelo legado no RPC de acesso.
--
-- Problema: gestao_alterar_acesso (v116) só gravava nivel/recurso_tipo/recurso_id. Mas
--   (a) gestao_acessos.id_quadro é NOT NULL → o INSERT do RPC falharia em qualquer concessão;
--   (b) o cliente ainda lê o modelo legado: useAcessosQuadro filtra por id_quadro e mostra
--       `papel`; useMeusAcessos (podeEditar) lê id_quadro/papel. Sem espelhar esses campos, um
--       acesso concedido via RPC ficaria invisível no modal e no podeEditar do cliente.
--
-- Correção (idempotente/reversível):
--   (1) id_quadro deixa de ser obrigatório — concessões de space/folder/task (futuras) não têm
--       quadro. Concessões de lista continuam preenchendo id_quadro.
--   (2) O RPC passa a gravar id_quadro (list→recurso_id) e papel (nivel>=edit→editor) junto de
--       nivel, mantendo os DOIS modelos em sincronia no servidor (fim do dual-write no cliente).
--
-- Não-regressão: só troca a definição de uma função + relaxa um NOT NULL. Linhas existentes
-- (todas com id_quadro) intactas. Reverter = restaurar a definição da v116 e re-adicionar NOT NULL.

-- (1) id_quadro opcional ────────────────────────────────────────────────────
alter table public.gestao_acessos alter column id_quadro drop not null;

-- (2) RPC com dual-write server-side (nivel + papel/id_quadro) ────────────────
create or replace function public.gestao_alterar_acesso(
  p_alvo text, p_acao public.gestao_acao, p_recurso_tipo public.gestao_recurso, p_recurso_id text,
  p_nivel_novo public.gestao_nivel, p_motivo text
) returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_ator text := public.gestao_email(); v_papel public.gestao_papel; v_ator_nivel public.gestao_nivel;
  v_ant public.gestao_nivel; v_log uuid; v_papel_legado text; v_id_quadro text;
begin
  if length(trim(coalesce(p_motivo,''))) < 5 then raise exception 'motivo obrigatório (mínimo 5 caracteres)'; end if;
  v_papel := public.gestao_papel_de(v_ator);
  if v_papel is null then raise exception 'apenas membros da Gestão podem gerenciar acesso'; end if;
  if v_papel = 'membro' then
    v_ator_nivel := public.gestao_resolver_nivel(v_ator, p_recurso_tipo, p_recurso_id);
    if v_ator_nivel is null or public.gestao_nivel_ord(v_ator_nivel) < 3 then raise exception 'sem permissão para gerenciar acesso neste recurso'; end if;
    if p_nivel_novo = 'full' then raise exception 'nível full não é delegável'; end if;
    if public.gestao_nivel_ord(p_nivel_novo) > public.gestao_nivel_ord(v_ator_nivel) then raise exception 'não é possível conceder nível acima do próprio'; end if;
  end if;

  v_ant := (select nivel from public.gestao_acessos where lower(usuario_email)=lower(p_alvo) and recurso_tipo=p_recurso_tipo and recurso_id=p_recurso_id);
  if p_acao in ('removeu','revogou') then
    delete from public.gestao_acessos where lower(usuario_email)=lower(p_alvo) and recurso_tipo=p_recurso_tipo and recurso_id=p_recurso_id;
  else
    -- espelha no modelo legado: papel p/ o cliente; id_quadro p/ concessões de lista.
    v_papel_legado := case when public.gestao_nivel_ord(p_nivel_novo) >= 3 then 'editor' else 'viewer' end;
    v_id_quadro := case when p_recurso_tipo = 'list' then p_recurso_id else null end;
    insert into public.gestao_acessos (id, usuario_email, recurso_tipo, recurso_id, nivel, concedido_por, id_quadro, papel)
      values (gen_random_uuid(), p_alvo, p_recurso_tipo, p_recurso_id, p_nivel_novo, v_ator, v_id_quadro, v_papel_legado)
    on conflict (lower(usuario_email), recurso_tipo, recurso_id) do update
      set nivel = excluded.nivel, concedido_por = excluded.concedido_por,
          id_quadro = excluded.id_quadro, papel = excluded.papel;
  end if;
  insert into public.gestao_acesso_log (ator_email, alvo_email, acao, recurso_tipo, recurso_id, nivel_anterior, nivel_novo, motivo)
    values (v_ator, p_alvo, p_acao, p_recurso_tipo, p_recurso_id, v_ant,
            case when p_acao in ('removeu','revogou') then null else p_nivel_novo end, p_motivo)
    returning id into v_log;
  return v_log;
end $$;
