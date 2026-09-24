-- v214 — Gestão Chabra: F3.B — Google Agenda INBOUND (Google → painel).
--
-- Editar/mover/apagar o evento no celular reflete de volta na tarefa. SÓ RPCs — NENHUMA tabela
-- nova: a v209 já criou gestao_google_contas (com sync_token/channel_id/channel_token/channel_expira),
-- gestao_google_eventos (com etag) e o trigger de enfileiramento que checa a GUC gestao.in_google_sync.
--
-- Escopo do inbound (briefing §5 F3.B): SÓ data/hora (prazo/data_inicio) e exclusão refletem. Título
-- e descrição ficam one-way painel→Google (editar o título no celular NÃO corrompe a tarefa). Só
-- eventos NOSSOS (extendedProperties.private.gestao_id_tarefa) — filtrado na rota.
--
-- Anti-loop (2 camadas): (1) o writeback roda sob `set local gestao.in_google_sync='on'`, então o
-- trigger de enfileiramento (v209) NÃO re-enfileira → é a ÚNICA forma de o UPDATE não gerar eco;
-- (2) a rota compara etag (deveAplicarInbound) antes de chamar aplicar_inbound.
--
-- RPCs SECURITY DEFINER (owner chabra_admin) search_path=public — escrita só via service_role.
-- Idempotente 2× (create or replace). Aditivo/reversível: rollback = drop das 4 funções + delete do
-- registro. As colunas sync_token/channel_* (da v209) ficam — são inertes sem as rotas.

-- ── 1) Writeback do inbound: aplica data/hora vinda do Google, SOB a guarda anti-loop ─────────────
-- Toca SÓ prazo/data_inicio da tarefa (nunca titulo/descricao/status) + atualiza o etag do mapa.
-- NO JCN: esta migration foi aplicada sem os "alter function ... owner to
-- chabra_admin" e sem os grants a backup_operator — as duas roles sao do
-- painel self-host e nao existem aqui. As funcoes ficam com o dono padrao
-- (postgres), que ja e quem o SECURITY DEFINER precisa ser, e o dump logico
-- no JCN e responsabilidade do Supabase, nao de uma role de backup.

create or replace function public.gestao_google_aplicar_inbound(
  p_id_tarefa text, p_prazo date, p_data_inicio date, p_etag text, p_email text
) returns void
  language plpgsql security definer set search_path=public as $function$
begin
  -- Authz de negocio (SEC-F3B-01): so reflete se EXISTE o nosso mapa (id_tarefa, email). O outbound
  -- so cria esse mapa para vinculado conectado; sem esta guarda, um evento com gestao_id_tarefa
  -- FORJADO na agenda do proprio usuario alteraria tarefa alheia (a RPC e SECURITY DEFINER e
  -- bypassa a RLS de gestao_tarefas). O par (id_tarefa, email) e a prova do vinculo legitimo.
  if not exists (select 1 from public.gestao_google_eventos
                  where id_tarefa = p_id_tarefa and usuario_email = p_email) then
    return;
  end if;

  -- Camada 1 do anti-loop: escrita de reflexo do sync não re-enfileira (o trigger v209 pula quando 'on').
  set local gestao.in_google_sync = 'on';

  update public.gestao_tarefas
     set prazo = p_prazo, data_inicio = p_data_inicio
   where id_tarefa = p_id_tarefa;

  update public.gestao_google_eventos
     set etag = p_etag, updated_at = now()
   where id_tarefa = p_id_tarefa and usuario_email = p_email;
end $function$;


-- ── 2) Exclusão do inbound: apagou no celular → desagenda a tarefa + remove o mapa ────────────────
-- Limpa prazo/data_inicio (a exclusão "gruda": sem prazo o outbound não recria) e apaga o mapeamento.
create or replace function public.gestao_google_excluir_inbound(
  p_id_tarefa text, p_email text
) returns void
  language plpgsql security definer set search_path=public as $function$
begin
  -- Authz de negocio (SEC-F3B-01): so desagenda se EXISTE o nosso mapa (id_tarefa, email) — mesma
  -- prova de vinculo legitimo do aplicar_inbound. Checa ANTES de zerar/apagar (idempotente no replay).
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


-- ── 3) Persiste o nextSyncToken do pull incremental (p_token null zera após 410 Gone) ─────────────
create or replace function public.gestao_google_salvar_sync_token(
  p_email text, p_token text
) returns void
  language plpgsql security definer set search_path=public as $function$
begin
  update public.gestao_google_contas
     set sync_token = p_token
   where usuario_email = p_email;
end $function$;


-- ── 4) Registra/renova o canal do watch (events.watch) — otimização de latência ───────────────────
create or replace function public.gestao_google_registrar_watch(
  p_email text, p_channel_id text, p_channel_token text, p_expira timestamptz
) returns void
  language plpgsql security definer set search_path=public as $function$
begin
  update public.gestao_google_contas
     set channel_id = p_channel_id,
         channel_token = p_channel_token,
         channel_expira = p_expira
   where usuario_email = p_email;
end $function$;


-- ── 5) Fechamento de segurança: fecha public/anon/authenticated; abre só service_role ─────────────
revoke all on function public.gestao_google_aplicar_inbound(text, date, date, text, text) from public, anon, authenticated;
revoke all on function public.gestao_google_excluir_inbound(text, text)                    from public, anon, authenticated;
revoke all on function public.gestao_google_salvar_sync_token(text, text)                  from public, anon, authenticated;
revoke all on function public.gestao_google_registrar_watch(text, text, text, timestamptz) from public, anon, authenticated;

grant execute on function public.gestao_google_aplicar_inbound(text, date, date, text, text) to service_role;
grant execute on function public.gestao_google_excluir_inbound(text, text)                    to service_role;
grant execute on function public.gestao_google_salvar_sync_token(text, text)                  to service_role;
grant execute on function public.gestao_google_registrar_watch(text, text, text, timestamptz) to service_role;
