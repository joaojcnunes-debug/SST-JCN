-- v288 (JCN) — Gestão: Google Agenda — desconectar, enviar existentes, horas, evento vira tarefa, foto
-- Replicado do Painel SST (v292 + v293 + v298 + v301 + v302, v0.3.770–v0.3.790), sem a trava de banco do painel, sem owner chabra_admin
-- e sem schema_migrations.
--
-- REAPLICAR: idempotente. ROLLBACK: scripts/sql/v288_*_rollback.sql

-- ══════════════════════════════════════════════════════════════════════════════════════════
-- v292_gestao_google_desconectar
-- ══════════════════════════════════════════════════════════════════════════════════════════

-- v292 — desconectar a conta Google (Etapa 1 do botão "Google Agenda").
--
-- A tabela gestao_google_contas não aceita escrita direta nem do service_role (v209: só SELECT;
-- escrita só por RPC SECURITY DEFINER). Esta RPC é a via de saída: apaga a conta do usuário
-- (refresh_token cifrado + canal do watch). Os eventos já criados na agenda e o mapa
-- gestao_google_eventos são limpos ANTES pela rota /api/gestao/google/disconnect, que precisa
-- do token para apagar os eventos no Google.
--
-- Aditiva/idempotente. Rollback: drop function public.gestao_google_remover_conta(text).

create or replace function public.gestao_google_remover_conta(p_email text) returns void
  language plpgsql security definer set search_path=public as $fn$
begin
  delete from public.gestao_google_contas where lower(usuario_email) = lower(p_email);
end $fn$;

-- `from public` não basta: o default privilege do Supabase dá EXECUTE a anon/authenticated em toda
-- função nova. Sem tirar de authenticated, qualquer logado desconectaria a agenda de outra pessoa.
revoke all on function public.gestao_google_remover_conta(text) from public, anon, authenticated;
grant execute on function public.gestao_google_remover_conta(text) to service_role;

notify pgrst, 'reload schema';

-- ══════════════════════════════════════════════════════════════════════════════════════════
-- v293_gestao_google_enviar_existentes
-- ══════════════════════════════════════════════════════════════════════════════════════════

-- v293 — Google Agenda, Etapa 2 — ao conectar, manda as tarefas que JÁ existem.
--
-- O trigger da v209 só enfileira quando a tarefa (ou o vínculo) MUDA. Quem conecta a conta depois
-- de ter tarefas ficava com a agenda vazia até cada tarefa ser editada. Esta RPC enfileira, de uma
-- vez, as tarefas ABERTAS com prazo em que a pessoa é responsável ou seguidora — inclusive as
-- atrasadas. O worker /api/gestao/google/sync drena a fila como sempre (cria ou, se já existe o
-- evento no mapa, atualiza — por isso reconectar também conserta a agenda).
--
-- "Aberta" = status que NÃO é do tipo 'concluido' no quadro (mesma regra do worker, que apaga o
-- evento das concluídas). Não enfileira de novo tarefa que já tem item pendente na fila.
-- Chamada pela rota /api/gestao/google/callback logo depois de gravar a conta.
--
-- Aditiva/idempotente. Rollback: drop function public.gestao_google_enfileirar_usuario(text).

create or replace function public.gestao_google_enfileirar_usuario(p_email text) returns integer
  language plpgsql security definer set search_path=public as $fn$
declare v_qtd integer;
begin
  insert into public.gestao_google_fila (id_tarefa, operacao)
  select t.id_tarefa, 'upsert'
    from public.gestao_tarefas t
   where t.prazo is not null
     and exists (select 1 from public.gestao_tarefa_vinculados v
                  where v.id_tarefa = t.id_tarefa and lower(v.usuario_email) = lower(p_email))
     and not exists (select 1 from public.gestao_status s
                      where s.id_quadro = t.id_quadro and s.slug = t.status and s.tipo = 'concluido')
     and not exists (select 1 from public.gestao_google_fila f
                      where f.id_tarefa = t.id_tarefa and f.processado_em is null and f.tentativas < 5)
   order by t.prazo;
  get diagnostics v_qtd = row_count;
  return v_qtd;
end $fn$;

-- `from public` não basta (default privilege do Supabase dá EXECUTE a anon/authenticated): fechar para anon/authenticated.
revoke all on function public.gestao_google_enfileirar_usuario(text) from public, anon, authenticated;
grant execute on function public.gestao_google_enfileirar_usuario(text) to service_role;

notify pgrst, 'reload schema';

-- ══════════════════════════════════════════════════════════════════════════════════════════
-- v298_gestao_tarefa_horas
-- ══════════════════════════════════════════════════════════════════════════════════════════

-- v298 — hora de início e hora de fim na tarefa (+ Google Agenda com hora).
--
-- O modal da tarefa ganha "Hora de início" (abaixo de "Data de início") e "Hora fim" (abaixo de
-- "Prazo"). Colunas TIME separadas, opcionais: prazo/data_inicio continuam DATE, então nada que já
-- lê essas colunas (vistas, ICS, timeline) muda de comportamento.
--
-- Google Agenda: tarefa com hora vira evento COM HORA (montarEvento); sem hora segue dia inteiro.
--   • Trigger da v209: mudar só a hora também re-enfileira o evento.
--   • Inbound: nova sobrecarga de gestao_google_aplicar_inbound que grava também as horas (mudou o
--     horário no celular → reflete na tarefa). A versão antiga (5 args, v214) fica para o código anterior
--     ao deploy não quebrar na janela de troca.
--
-- Aditiva/idempotente. Rollback:
--   drop function if exists public.gestao_google_aplicar_inbound(text, date, date, time, time, text, text);
--   (trigger: reaplicar o bloco 4 da v209)
--   alter table public.gestao_tarefas drop column if exists hora_inicio, drop column if exists hora_fim;

alter table public.gestao_tarefas
  add column if not exists hora_inicio time,
  add column if not exists hora_fim time;

-- ── Trigger (v209) com as horas na lista do que "mudou de verdade" ─────────────────────────────
create or replace function public.gestao_google_enfileirar_trg() returns trigger
  language plpgsql security definer set search_path=public as $fn$
declare v_id text; v_op text;
begin
  -- Guarda anti-loop (forward-compat F3.B): escrita de reflexo do próprio sync não re-enfileira.
  if coalesce(current_setting('gestao.in_google_sync', true), '') = 'on' then
    return null;
  end if;

  if tg_table_name = 'gestao_tarefas' then
    if tg_op = 'DELETE' then
      v_id := old.id_tarefa; v_op := 'delete';
    elsif tg_op = 'INSERT' then
      if new.prazo is null then return null; end if;      -- sem prazo → nada a agendar
      v_id := new.id_tarefa; v_op := 'upsert';
    else -- UPDATE
      if new.prazo is not distinct from old.prazo
         and new.data_inicio is not distinct from old.data_inicio
         and new.hora_inicio is not distinct from old.hora_inicio
         and new.hora_fim is not distinct from old.hora_fim
         and new.titulo is not distinct from old.titulo
         and new.status is not distinct from old.status then
        return null;                                       -- nada relevante mudou
      end if;
      v_id := new.id_tarefa; v_op := 'upsert';
    end if;
  else -- gestao_tarefa_vinculados: enfileira a tarefa-mãe (reconcilia a lista de convidados)
    v_id := coalesce(new.id_tarefa, old.id_tarefa); v_op := 'upsert';
  end if;

  insert into public.gestao_google_fila (id_tarefa, operacao) values (v_id, v_op);
  return null;
end $fn$;

-- ── Inbound com hora (mesma authz e anti-loop da v214) ─────────────────────────────────────────
create or replace function public.gestao_google_aplicar_inbound(
  p_id_tarefa text, p_prazo date, p_data_inicio date, p_hora_inicio time, p_hora_fim time,
  p_etag text, p_email text
) returns void
  language plpgsql security definer set search_path=public as $function$
begin
  -- Authz de negocio (SEC-F3B-01): so reflete se EXISTE o nosso mapa (id_tarefa, email).
  if not exists (select 1 from public.gestao_google_eventos
                  where id_tarefa = p_id_tarefa and usuario_email = p_email) then
    return;
  end if;

  set local gestao.in_google_sync = 'on';

  update public.gestao_tarefas
     set prazo = p_prazo, data_inicio = p_data_inicio,
         hora_inicio = p_hora_inicio, hora_fim = p_hora_fim
   where id_tarefa = p_id_tarefa;

  update public.gestao_google_eventos
     set etag = p_etag, updated_at = now()
   where id_tarefa = p_id_tarefa and usuario_email = p_email;
end $function$;

revoke all on function public.gestao_google_aplicar_inbound(text, date, date, time, time, text, text) from public, anon, authenticated;
grant execute on function public.gestao_google_aplicar_inbound(text, date, date, time, time, text, text) to service_role;

notify pgrst, 'reload schema';

-- ══════════════════════════════════════════════════════════════════════════════════════════
-- v301_gestao_google_tarefa_do_evento
-- ══════════════════════════════════════════════════════════════════════════════════════════

-- v301 — evento criado na Google Agenda vira tarefa (Google → painel), com os
-- convidados como responsáveis.
--
-- PEDIDO (19/10): "toda tarefa que eu criar no Google Agenda virar um cartão no Gestão"; atribuir
-- outra pessoa pelo "adicionar convidado". Decisões do usuário: TODO evento criado pela própria pessoa
-- na agenda principal (convites de outros e repetições ficam de fora — filtro na rota,
-- deveImportarEvento); só daqui para frente; a tarefa cai no Meu Quadro de quem criou o evento.
--
-- O QUE MUDA
--   gestao_google_contas.importar_desde   evento criado ANTES disto não vira tarefa (contas já
--                                         conectadas: a hora desta migration; novas: a da conexão).
--   gestao_google_eventos.origem          'painel' (evento que o painel criou) | 'google' (evento que a
--                                         pessoa criou na agenda e virou tarefa). Evento 'google' é da
--                                         pessoa: o worker nunca o apaga (tarefa concluída/apagada só
--                                         solta o vínculo) e não troca os lembretes dela.
--   vinculados.origem = 'google-convidado' responsável que veio do convidado do evento. Ele já tem o
--                                         evento pelo convite, então o worker NÃO cria cópia na agenda
--                                         dele; e sai da tarefa se sair da lista de convidados.
--   gestao_google_tarefa_do_evento        cria a tarefa (idempotente por evento).
--   gestao_google_sincronizar_convidados  convidados do evento → responsáveis.
--   gestao_google_excluir_inbound         + limpa as horas; evento 'google' apagado na agenda: os
--                                         convidados viram responsáveis comuns (origem 'app').
--   gestao_google_soltar_eventos          desconectar: solta o mapa da pessoa (idem para os convidados).
--                                         O evento que ela criou fica na agenda (lib/gestao/google/conta.ts).
--
-- Anti-loop: tudo sob `set local gestao.in_google_sync='on'` (o trigger da v209/v298 não
-- re-enfileira). Só service_role executa.
--

-- ── 1) Colunas ─────────────────────────────────────────────────────────────────────
-- Default now() é avaliado no ALTER: as contas já conectadas ficam com a hora desta migration.
ALTER TABLE public.gestao_google_contas
  ADD COLUMN IF NOT EXISTS importar_desde timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.gestao_google_eventos
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'painel';
ALTER TABLE public.gestao_google_eventos DROP CONSTRAINT IF EXISTS gestao_google_eventos_origem_chk;
ALTER TABLE public.gestao_google_eventos ADD CONSTRAINT gestao_google_eventos_origem_chk CHECK (origem IN ('painel', 'google'));
-- Achar a tarefa pelo evento (o carimbo gestao_id_tarefa pode ainda não ter chegado ao Google).
CREATE INDEX IF NOT EXISTS idx_gestao_google_eventos_evento ON public.gestao_google_eventos (usuario_email, event_id);

-- ── 2) Convidados → responsáveis ─────────────────────────────────────────────────────
-- p_convidados: e-mails dos convidados (a rota já tirou o dono, salas e quem recusou). Entra só quem
-- é usuário interno ativo e membro da Gestão; e-mail de fora (cliente, fornecedor) é ignorado.
CREATE OR REPLACE FUNCTION public.gestao_google_sincronizar_convidados(p_id_tarefa text, p_email text, p_convidados text[])
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_dono text := lower(btrim(coalesce(p_email, ''))); v_lista text[];
BEGIN
  -- Mesma prova de vínculo da v214: só mexe se o evento desta pessoa É a origem da tarefa.
  IF NOT EXISTS (SELECT 1 FROM public.gestao_google_eventos
                  WHERE id_tarefa = p_id_tarefa AND usuario_email = v_dono AND origem = 'google') THEN
    RETURN;
  END IF;

  SELECT coalesce(array_agg(DISTINCT lower(u.email)), '{}') INTO v_lista
    FROM unnest(coalesce(p_convidados, '{}')) AS c(email)
    JOIN public.usuarios u ON lower(u.email) = lower(btrim(c.email))
   WHERE lower(u.email) <> v_dono
     AND coalesce(u.ativo_sistema, true) AND u.perfil <> 'Cliente'
     AND public.gestao_papel_de(lower(u.email)) IS NOT NULL;

  SET LOCAL gestao.in_google_sync = 'on';

  -- Já vinculado (responsável incluído no painel) fica como está.
  INSERT INTO public.gestao_tarefa_vinculados (id_tarefa, usuario_email, tipo, origem)
  SELECT p_id_tarefa, e, 'responsavel', 'google-convidado' FROM unnest(v_lista) AS e
  ON CONFLICT (id_tarefa, usuario_email, tipo) DO NOTHING;

  -- Saiu da lista de convidados → sai da tarefa (só quem entrou pelo convite).
  DELETE FROM public.gestao_tarefa_vinculados
   WHERE id_tarefa = p_id_tarefa AND tipo = 'responsavel' AND origem = 'google-convidado'
     AND NOT (usuario_email = ANY (v_lista));
END $$;

-- ── 3) Evento → tarefa ───────────────────────────────────────────────────────────────
-- Idempotente por (pessoa, evento): o aviso do Google e o agendador podem trazer o mesmo evento ao
-- mesmo tempo (trava por evento), e o carimbo no Google pode falhar (o mapa já existe → devolve a
-- mesma tarefa). Devolve null se a conta não está conectada ou a pessoa não é membro da Gestão.
CREATE OR REPLACE FUNCTION public.gestao_google_tarefa_do_evento(
  p_email text, p_event_id text, p_etag text, p_titulo text, p_descricao text,
  p_prazo date, p_data_inicio date, p_hora_inicio time, p_hora_fim time
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email text := lower(btrim(coalesce(p_email, ''))); v_id text; v_quadro text; v_nome text; v_status text;
BEGIN
  IF v_email = '' OR coalesce(p_event_id, '') = '' THEN RETURN null; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.gestao_google_contas WHERE usuario_email = v_email AND ativo) THEN RETURN null; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('gestao_google_evento:' || v_email || ':' || p_event_id));
  SELECT id_tarefa INTO v_id FROM public.gestao_google_eventos
   WHERE usuario_email = v_email AND event_id = p_event_id LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  IF public.gestao_papel_de(v_email) IS NULL THEN RETURN null; END IF;

  -- Meu Quadro (mesma regra da gestao_quadro_pessoal_de da v235, que exige sessão — aqui não há).
  SELECT id_quadro INTO v_quadro FROM public.gestao_quadros WHERE lower(dono_email) = v_email;
  IF v_quadro IS NULL THEN
    SELECT nome INTO v_nome FROM public.usuarios WHERE lower(email) = v_email;
    INSERT INTO public.gestao_quadros (id_quadro, nome, descricao, created_by, dono_email, ordem, restrito)
    VALUES ('QDR-ME' || upper(substr(md5(v_email), 1, 6)), 'Meu Quadro — ' || coalesce(v_nome, v_email),
            'Quadro pessoal (criado automaticamente)', v_email, v_email, 999, false)
    ON CONFLICT (id_quadro) DO NOTHING;
    SELECT id_quadro INTO v_quadro FROM public.gestao_quadros WHERE lower(dono_email) = v_email;
    IF v_quadro IS NULL THEN RETURN null; END IF;  -- id ocupado por outro quadro (ver N1 da v235)
  END IF;

  SELECT slug INTO v_status FROM public.gestao_status
   WHERE id_quadro = v_quadro ORDER BY (tipo = 'nao_iniciado') DESC, ordem LIMIT 1;

  SET LOCAL gestao.in_google_sync = 'on';

  v_id := 'TRF-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  INSERT INTO public.gestao_tarefas (id_tarefa, id_quadro, titulo, descricao, status, prazo, data_inicio,
                                     hora_inicio, hora_fim, created_by, created_at, updated_at)
  VALUES (v_id, v_quadro, left(coalesce(nullif(btrim(p_titulo), ''), '(Sem título)'), 300), nullif(btrim(p_descricao), ''),
          coalesce(v_status, 'A_FAZER'), p_prazo, p_data_inicio, p_hora_inicio, p_hora_fim, v_email, now(), now());

  INSERT INTO public.gestao_tarefa_vinculados (id_tarefa, usuario_email, tipo, origem)
  VALUES (v_id, v_email, 'responsavel', 'google-agenda');

  INSERT INTO public.gestao_google_eventos (id_tarefa, usuario_email, event_id, etag, origem, updated_at)
  VALUES (v_id, v_email, p_event_id, p_etag, 'google', now());

  -- Sem sessão não há "ator": o gatilho da v296 avisaria a própria pessoa de que ela foi atribuída à
  -- tarefa que ela mesma criou. Tira só esse aviso (os convidados entram depois e são avisados).
  DELETE FROM public.gestao_notificacoes WHERE id_tarefa = v_id AND lower(destinatario) = v_email;

  RETURN v_id;
END $$;

-- ── 4) Evento apagado na agenda (v214 + horas + convidados) ─────────────────────────────
CREATE OR REPLACE FUNCTION public.gestao_google_excluir_inbound(p_id_tarefa text, p_email text)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE v_origem text;
BEGIN
  -- Authz de negocio (SEC-F3B-01): so desagenda se EXISTE o nosso mapa (id_tarefa, email).
  SELECT origem INTO v_origem FROM public.gestao_google_eventos
   WHERE id_tarefa = p_id_tarefa AND usuario_email = p_email;
  IF NOT FOUND THEN RETURN; END IF;

  SET LOCAL gestao.in_google_sync = 'on';

  UPDATE public.gestao_tarefas
     SET prazo = null, data_inicio = null, hora_inicio = null, hora_fim = null
   WHERE id_tarefa = p_id_tarefa;

  DELETE FROM public.gestao_google_eventos
   WHERE id_tarefa = p_id_tarefa AND usuario_email = p_email;

  -- Sem o evento de origem, os convidados não têm mais o convite: passam a responsáveis comuns
  -- (se a tarefa ganhar prazo de novo, o worker põe o evento na agenda deles).
  IF v_origem = 'google' THEN
    UPDATE public.gestao_tarefa_vinculados SET origem = 'app'
     WHERE id_tarefa = p_id_tarefa AND origem = 'google-convidado';
  END IF;
END $function$;

-- ── 5) Desconectar ──────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.gestao_google_soltar_eventos(p_email text)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  SET LOCAL gestao.in_google_sync = 'on';
  UPDATE public.gestao_tarefa_vinculados v SET origem = 'app'
   WHERE v.origem = 'google-convidado'
     AND v.id_tarefa IN (SELECT e.id_tarefa FROM public.gestao_google_eventos e
                          WHERE e.usuario_email = p_email AND e.origem = 'google');
  DELETE FROM public.gestao_google_eventos WHERE usuario_email = p_email;
END $$;

REVOKE ALL ON FUNCTION public.gestao_google_soltar_eventos(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gestao_google_soltar_eventos(text) TO service_role;

REVOKE ALL ON FUNCTION public.gestao_google_sincronizar_convidados(text, text, text[]) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.gestao_google_tarefa_do_evento(text, text, text, text, text, date, date, time, time) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.gestao_google_excluir_inbound(text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gestao_google_sincronizar_convidados(text, text, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.gestao_google_tarefa_do_evento(text, text, text, text, text, date, date, time, time) TO service_role;
GRANT EXECUTE ON FUNCTION public.gestao_google_excluir_inbound(text, text) TO service_role;

NOTIFY pgrst, 'reload schema';

-- ══════════════════════════════════════════════════════════════════════════════════════════
-- v302_gestao_usuario_fotos
-- ══════════════════════════════════════════════════════════════════════════════════════════

-- v302 — foto da conta Google no lugar das iniciais.
--
-- Ao conectar o Google Agenda, o consent passa a pedir também o perfil básico (userinfo.profile);
-- a rota /api/gestao/google/callback lê a foto da conta e grava aqui pela RPC (service_role).
-- O app mostra a foto onde hoje mostra as iniciais (sem foto → iniciais, como antes).
--
-- Leitura: só membros da Gestão (mesma régua do papel). Escrita: só pela RPC.
-- Aditiva/idempotente. Rollback:
--   drop function if exists public.gestao_salvar_foto(text, text);
--   drop table if exists public.gestao_usuario_fotos;

create table if not exists public.gestao_usuario_fotos (
  usuario_email text primary key check (usuario_email = lower(usuario_email)),
  foto_url      text not null check (foto_url ~ '^https://'),
  origem        text not null default 'google',
  atualizado_em timestamptz not null default now()
);

alter table public.gestao_usuario_fotos enable row level security;

drop policy if exists gestao_usuario_fotos_sel on public.gestao_usuario_fotos;
create policy gestao_usuario_fotos_sel on public.gestao_usuario_fotos
  for select to authenticated
  using (public.gestao_papel_de(public.gestao_email()) is not null);

revoke all on public.gestao_usuario_fotos from anon, authenticated;
grant select on public.gestao_usuario_fotos to authenticated;
grant select on public.gestao_usuario_fotos to service_role;

create or replace function public.gestao_salvar_foto(p_email text, p_foto_url text) returns void
  language plpgsql security definer set search_path=public as $fn$
begin
  if p_email is null or p_foto_url is null or p_foto_url !~ '^https://' then
    return;
  end if;
  insert into public.gestao_usuario_fotos (usuario_email, foto_url, origem, atualizado_em)
  values (lower(p_email), p_foto_url, 'google', now())
  on conflict (usuario_email) do update
    set foto_url = excluded.foto_url, origem = excluded.origem, atualizado_em = now();
end $fn$;

-- `from public` não basta: o default privilege do Supabase dá EXECUTE a anon/authenticated em toda
-- função nova (ver v292). Só o servidor (service_role) grava a foto de alguém.
revoke all on function public.gestao_salvar_foto(text, text) from public, anon, authenticated;
grant execute on function public.gestao_salvar_foto(text, text) to service_role;

notify pgrst, 'reload schema';
