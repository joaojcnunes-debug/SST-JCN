-- v291 (JCN) — Gestão: automações seguras + rotina diária + aviso de tarefa nova no quadro
-- Replicado do Painel SST (v297, v0.3.768), sem a trava de banco do painel, sem owner chabra_admin
-- e sem schema_migrations.
-- Diferença: no JCN quem chama a rotina é o pg_cron (job gestao-diario, 07:05 de Brasília);
-- o /api/gestao/google/sync também chama (a rotina tem trava de 1x/dia).
--
-- REAPLICAR: idempotente. ROLLBACK: scripts/sql/v291_*_rollback.sql

-- v297 — automações seguras + rotina diária de volta + aviso de tarefa nova no quadro.
--
-- PEDIDO (19/10), depois da análise das automações:
--   1) desligar as 4 "Nova automação" incompletas (uma delas, no Geral, APAGAVA o responsável a cada
--      mudança de status: definir_responsavel com valor vazio);
--   2) religar a rotina diária (recorrência + avisos de prazo), parada desde 28/06: era agendada pelo
--      pg_cron do Supabase, que não existe no servidor próprio. Agora o worker /api/gestao/google/sync
--      (agendador, 1/min) chama gestao_rotina_diaria(), que roda 1x/dia a partir das 7h (Brasília);
--   3) recorrência: gerar TODAS as repetições que ficaram para trás (decisão do usuário), copiando
--      responsáveis e seguidores da tarefa original;
--   +  aviso "tarefa nova no quadro" aos membros do quadro (quem tem nível total nele e a unidade da
--      tarefa), quando a tarefa é criada no quadro ou chega nele (ex.: OS roteada para a Recepção).
--      Avisa uma vez, no quadro FINAL (gatilho adiado para o fim da transação). Meu Quadro não avisa.
--
-- O QUE MUDA
--   gestao_automacao_completa(acao)  ação tem o que precisa para rodar?
--   trg_gestao_automacao_completa    automação incompleta não fica ativa (qualquer caminho de escrita)
--   gestao_automacao_aplicar         definir_responsavel sem valor deixa de apagar o responsável
--   gestao_aviso_quadro_trg          aviso "Nova tarefa em <quadro>"
--   gestao_cron_diario               recorrência em lote + vínculos copiados; aviso de prazo a TODOS os
--                                    responsáveis (vínculos); e-mail só no dia do vencimento
--   gestao_rotina_diaria             porta de entrada 1x/dia (service_role)
--

-- ── 1) Automação incompleta não roda ───────────────────────────────────────────────
-- Espelha lib/gestao/automacao-completa.ts (mesma regra na tela).
CREATE OR REPLACE FUNCTION public.gestao_automacao_completa(p_acao jsonb) RETURNS boolean
  LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE coalesce(p_acao->>'tipo', '')
    WHEN 'mover_status'             THEN coalesce(p_acao->>'valor', '') <> ''
    WHEN 'mover_status_se_completo' THEN coalesce(p_acao->>'valor', '') <> ''
    WHEN 'definir_responsavel'      THEN coalesce(p_acao->>'valor', '') <> ''
    WHEN 'definir_prioridade'       THEN coalesce(p_acao->>'valor', '') <> ''
    WHEN 'definir_campo'            THEN coalesce(p_acao->>'campo_id', '') <> ''
    WHEN 'adicionar_vinculados'     THEN jsonb_typeof(p_acao->'emails') = 'array' AND jsonb_array_length(p_acao->'emails') > 0
    WHEN 'mover_tarefa_quadro'      THEN coalesce(p_acao->>'id_quadro_destino', '') <> ''
    WHEN 'criar_tarefa_quadro'      THEN coalesce(p_acao->>'id_quadro_destino', '') <> ''
    WHEN 'criar_subtarefas_modelo'  THEN coalesce(p_acao->>'modelo_slug', '') <> ''
    WHEN 'notificar'                THEN true
    WHEN 'solicitar_aprovacao'      THEN true
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.gestao_automacao_completa_trg() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  IF new.ativo AND NOT public.gestao_automacao_completa(new.acao) THEN
    new.ativo := false;
  END IF;
  RETURN new;
END $$;
DROP TRIGGER IF EXISTS trg_gestao_automacao_completa ON public.gestao_automacoes;
CREATE TRIGGER trg_gestao_automacao_completa BEFORE INSERT OR UPDATE ON public.gestao_automacoes
  FOR EACH ROW EXECUTE FUNCTION public.gestao_automacao_completa_trg();

-- Desliga as que estão ativas e incompletas (na produção, em 19/10: as 4 "Nova automação").
DO $$ DECLARE n int; BEGIN
  UPDATE public.gestao_automacoes SET ativo = false WHERE ativo AND NOT public.gestao_automacao_completa(acao);
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'v297: automações incompletas desligadas: %', n;
END $$;

-- ── 2) Motor: definir_responsavel sem valor não apaga mais (definição da produção + 1 linha) ──
CREATE OR REPLACE FUNCTION public.gestao_automacao_aplicar(p_autom gestao_automacoes, p_tarefa gestao_tarefas, p_gatilho text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_acao jsonb := coalesce(p_autom.acao, '{}'::jsonb);
  v_tipo text := v_acao->>'tipo';
  v_email text; v_res text := 'ok'; v_det text := null;
  -- extensões F2.2a
  v_sent int := 0; v_cand int := 0; v_ins int := 0;
  v_e text; v_tipo_vinc text; v_new_id text; v_dest_status text; v_titulo text; v_copiar boolean;
  -- extensões F2.2c
  v_modelo public.gestao_subtarefa_modelos; v_item jsonb; v_ordem int; v_txt text;
begin
  begin
    if v_tipo = 'mover_status' and coalesce(v_acao->>'valor','') <> '' then
      update public.gestao_tarefas set status = v_acao->>'valor', updated_at = now() where id_tarefa = p_tarefa.id_tarefa;
    -- v297: sem valor NAO apaga o responsavel (antes: nullif('') -> responsavel = null a cada gatilho).
    elsif v_tipo = 'definir_responsavel' and coalesce(v_acao->>'valor','') <> '' then
      update public.gestao_tarefas set responsavel = nullif(v_acao->>'valor',''), updated_at = now() where id_tarefa = p_tarefa.id_tarefa;
    elsif v_tipo = 'definir_prioridade' and coalesce(v_acao->>'valor','') <> '' then
      update public.gestao_tarefas set prioridade = v_acao->>'valor', updated_at = now() where id_tarefa = p_tarefa.id_tarefa;
    elsif v_tipo = 'definir_campo' and coalesce(v_acao->>'campo_id','') <> '' then
      update public.gestao_tarefas
        set campos = jsonb_set(coalesce(campos,'{}'::jsonb), array[v_acao->>'campo_id'], coalesce(to_jsonb(v_acao->>'valor'), 'null'::jsonb)),
            updated_at = now()
        where id_tarefa = p_tarefa.id_tarefa;

    -- ---- F2.2a: adicionar_vinculados {emails:[], tipo:'responsavel'|'seguidor'} ----
    elsif v_tipo = 'adicionar_vinculados' then
      v_tipo_vinc := coalesce(nullif(v_acao->>'vinculo_tipo',''), 'seguidor');
      if v_tipo_vinc not in ('responsavel','seguidor') then
        v_res := 'erro'; v_det := 'tipo de vínculo inválido: ' || v_tipo_vinc;
      else
        for v_e in select lower(x) from jsonb_array_elements_text(coalesce(v_acao->'emails','[]'::jsonb)) x loop
          if v_e is null or v_e = '' or position('@' in v_e) = 0 then continue; end if;
          insert into public.gestao_tarefa_vinculados (id, id_tarefa, usuario_email, tipo, origem)
          values (gen_random_uuid(), p_tarefa.id_tarefa, v_e, v_tipo_vinc, 'automacao')
          on conflict (id_tarefa, usuario_email, tipo) do nothing;
          v_ins := v_ins + 1;
        end loop;
        v_det := 'vinculados processados: ' || v_ins;
      end if;

    -- ---- F2.2a: mover_tarefa_quadro {id_quadro_destino, status_destino?} ----
    elsif v_tipo = 'mover_tarefa_quadro' and coalesce(v_acao->>'id_quadro_destino','') <> '' then
      v_dest_status := coalesce(
        nullif(v_acao->>'status_destino',''),
        (select slug from public.gestao_status where id_quadro = v_acao->>'id_quadro_destino' order by ordem limit 1)
      );
      update public.gestao_tarefas
        set id_quadro = v_acao->>'id_quadro_destino',
            status = coalesce(v_dest_status, status),
            updated_at = now()
        where id_tarefa = p_tarefa.id_tarefa;
      v_det := 'movida para quadro ' || (v_acao->>'id_quadro_destino');
      -- o trg de UPDATE dispara tarefa_movida_quadro (e status_muda) no destino, sob a guarda de profundidade

    -- ---- F2.2a: criar_tarefa_quadro {id_quadro_destino, titulo_template, copiar_campos?} ----
    elsif v_tipo = 'criar_tarefa_quadro' and coalesce(v_acao->>'id_quadro_destino','') <> '' then
      v_copiar := coalesce(v_acao->>'copiar_campos','') in ('true','1');
      select slug into v_dest_status from public.gestao_status where id_quadro = v_acao->>'id_quadro_destino' order by ordem limit 1;
      v_new_id := 'TRF-' || upper(substring(replace(gen_random_uuid()::text,'-','') from 1 for 8));
      v_titulo := replace(coalesce(nullif(v_acao->>'titulo_template',''), p_tarefa.titulo), '{{titulo}}', p_tarefa.titulo);
      insert into public.gestao_tarefas (id_tarefa, id_quadro, titulo, status, prioridade, etiquetas, campos, created_by)
      values (
        v_new_id,
        v_acao->>'id_quadro_destino',
        v_titulo,
        coalesce(v_dest_status, 'A_FAZER'),
        case when v_copiar then p_tarefa.prioridade else 'Media' end,
        case when v_copiar then p_tarefa.etiquetas else '{}'::text[] end,
        case when v_copiar then p_tarefa.campos else '{}'::jsonb end,
        'automacao'
      );
      v_det := 'tarefa criada: ' || v_new_id;
      -- o INSERT dispara tarefa_criada no destino, sob a guarda de profundidade

    -- ---- F2.2a: notificar -> TODOS os vinculados (fallback ao responsável legado) ----
    elsif v_tipo = 'notificar' then
      for v_email in
        select distinct lower(usuario_email)
          from public.gestao_tarefa_vinculados
         where id_tarefa = p_tarefa.id_tarefa
      loop
        if v_email is null or v_email = '' then continue; end if;
        v_cand := v_cand + 1;
        if p_gatilho like 'prazo%' and exists (
          select 1 from public.gestao_notificacoes n
          where n.id_tarefa = p_tarefa.id_tarefa and n.tipo = 'prazo'
            and lower(n.destinatario) = v_email and n.created_at::date = current_date
        ) then
          continue;  -- dedup diário por destinatário
        end if;
        insert into public.gestao_notificacoes (id, destinatario, tipo, titulo, id_tarefa, id_quadro)
        values (gen_random_uuid(), v_email,
                case when p_gatilho like 'prazo%' then 'prazo' else 'status' end,
                coalesce(nullif(v_acao->>'valor',''), 'Automação: ' || p_tarefa.titulo),
                p_tarefa.id_tarefa, p_tarefa.id_quadro);
        v_sent := v_sent + 1;
      end loop;

      if v_cand = 0 then
        -- sem vinculados: comportamento legado (responsável via usuarios.nome)
        select lower(email) into v_email from public.usuarios where nome = p_tarefa.responsavel limit 1;
        if v_email is null then
          v_res := 'skip'; v_det := 'sem responsável/e-mail';
        elsif p_gatilho like 'prazo%' and exists (
          select 1 from public.gestao_notificacoes n
          where n.id_tarefa = p_tarefa.id_tarefa and n.tipo = 'prazo' and n.created_at::date = current_date
        ) then
          v_res := 'skip'; v_det := 'notificação de prazo já enviada hoje';
        else
          insert into public.gestao_notificacoes (id, destinatario, tipo, titulo, id_tarefa, id_quadro)
          values (gen_random_uuid(), v_email,
                  case when p_gatilho like 'prazo%' then 'prazo' else 'status' end,
                  coalesce(nullif(v_acao->>'valor',''), 'Automação: ' || p_tarefa.titulo),
                  p_tarefa.id_tarefa, p_tarefa.id_quadro);
        end if;
      elsif v_sent = 0 then
        v_res := 'skip'; v_det := 'notificação de prazo já enviada hoje (todos os vinculados)';
      else
        v_det := 'notificados: ' || v_sent || '/' || v_cand;
      end if;

    -- ---- F2.2b: solicitar_aprovacao {aprovador_email?} ----
    elsif v_tipo = 'solicitar_aprovacao' then
      if exists (select 1 from public.gestao_aprovacoes where id_tarefa = p_tarefa.id_tarefa and status = 'pendente') then
        v_res := 'skip'; v_det := 'aprovação pendente já existe';
      else
        insert into public.gestao_aprovacoes (id_tarefa, solicitado_por, aprovador_email, status)
        values (
          p_tarefa.id_tarefa,
          coalesce(public.gestao_email(), 'automacao'),
          lower(nullif(btrim(coalesce(v_acao->>'aprovador_email','')), '')),
          'pendente'
        );
        v_det := 'aprovação solicitada';
      end if;

    -- ---- F2.2c: criar_subtarefas_modelo {modelo_slug} ----
    elsif v_tipo = 'criar_subtarefas_modelo' and coalesce(v_acao->>'modelo_slug','') <> '' then
      select * into v_modelo
        from public.gestao_subtarefa_modelos
       where id_quadro = p_tarefa.id_quadro and slug = v_acao->>'modelo_slug';
      if v_modelo.id is null then
        v_res := 'skip'; v_det := 'modelo inexistente: ' || (v_acao->>'modelo_slug');
      else
        -- ordem incremental a partir do fim do checklist atual da tarefa
        select coalesce(max(ordem), -1) + 1 into v_ordem
          from public.gestao_subtarefas where id_tarefa = p_tarefa.id_tarefa;
        for v_item in select value from jsonb_array_elements(coalesce(v_modelo.itens, '[]'::jsonb)) loop
          v_txt := btrim(coalesce(v_item->>'texto',''));
          if v_txt = '' then continue; end if;
          -- idempotente: não recria a subtarefa (mesmo texto) se já existe na tarefa
          if exists (
            select 1 from public.gestao_subtarefas
             where id_tarefa = p_tarefa.id_tarefa and texto = v_txt
          ) then continue; end if;
          insert into public.gestao_subtarefas (id, id_tarefa, texto, ordem, etapa, tipo)
          values (
            'SUB-' || upper(substring(replace(gen_random_uuid()::text,'-','') from 1 for 8)),
            p_tarefa.id_tarefa,
            v_txt,
            v_ordem,
            nullif(v_item->>'etapa',''),
            nullif(v_item->>'tipo','')
          );
          v_ordem := v_ordem + 1;
          v_ins := v_ins + 1;
        end loop;
        v_det := 'subtarefas do modelo ' || v_modelo.slug || ': ' || v_ins;
      end if;

    -- ---- GE3: mover_status_se_completo {valor} — move só se TODAS as subtarefas estão concluídas ----
    elsif v_tipo = 'mover_status_se_completo' and coalesce(v_acao->>'valor','') <> '' then
      if exists (select 1 from public.gestao_subtarefas where id_tarefa = p_tarefa.id_tarefa and not feito) then
        v_res := 'skip'; v_det := 'ainda há subtarefas pendentes';
      elsif not exists (select 1 from public.gestao_subtarefas where id_tarefa = p_tarefa.id_tarefa) then
        v_res := 'skip'; v_det := 'sem subtarefas';
      else
        update public.gestao_tarefas set status = v_acao->>'valor', updated_at = now() where id_tarefa = p_tarefa.id_tarefa;
        v_det := 'todas subtarefas concluídas -> ' || (v_acao->>'valor');
      end if;

    else
      v_res := 'skip'; v_det := 'ação não reconhecida: ' || coalesce(v_tipo,'(vazia)');
    end if;
  exception when others then
    v_res := 'erro'; v_det := left(SQLERRM, 300);
  end;

  insert into public.gestao_automacao_log (id_automacao, id_tarefa, gatilho, resultado, detalhe, profundidade)
    values (p_autom.id, p_tarefa.id_tarefa, p_gatilho, v_res, v_det,
            coalesce(nullif(current_setting('gestao.autom_depth', true), ''), '0')::int);
end
$function$

;
REVOKE ALL ON FUNCTION public.gestao_automacao_aplicar(public.gestao_automacoes, public.gestao_tarefas, text) FROM public, anon, authenticated;

-- ── 3) Aviso "tarefa nova no quadro" ──────────────────────────────────────────────
-- Adiado para o fim da transação: a OS nasce no Suporte T.I e a automação a move para a Recepção
-- na mesma transação — avisa só quem é do quadro FINAL (relê a linha). Os dois eventos (insert e
-- update) caem no mesmo aviso; gestao_avisar não repete o mesmo aviso em 1 minuto.
CREATE OR REPLACE FUNCTION public.gestao_aviso_quadro_trg() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_t record; v_q record; v_ator text := public.gestao_email(); r record;
BEGIN
  SELECT id_tarefa, id_quadro, titulo INTO v_t FROM public.gestao_tarefas WHERE id_tarefa = new.id_tarefa;
  IF NOT FOUND THEN RETURN null; END IF;                       -- apagada antes do fim da transação
  SELECT id_quadro, nome, id_pasta, id_espaco, dono_email INTO v_q FROM public.gestao_quadros WHERE id_quadro = v_t.id_quadro;
  IF NOT FOUND OR v_q.dono_email IS NOT NULL THEN RETURN null; END IF;   -- Meu Quadro: sem aviso

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
    -- Só quem vê TODAS as tarefas do quadro (nível total) e a unidade da tarefa; vinculado já é avisado.
    IF public.gestao_resolver_nivel(r.email, 'task', v_t.id_tarefa) = 'full'
       AND public.gestao_unidade_ok(r.email, v_t.id_tarefa)
       AND NOT EXISTS (SELECT 1 FROM public.gestao_tarefa_vinculados v WHERE v.id_tarefa = v_t.id_tarefa AND lower(v.usuario_email) = r.email) THEN
      PERFORM public.gestao_avisar(r.email, 'quadro', 'Nova tarefa em ' || v_q.nome || ': ' || v_t.titulo, v_t.id_tarefa, v_q.id_quadro, v_ator);
    END IF;
  END LOOP;
  RETURN null;
END $$;
REVOKE ALL ON FUNCTION public.gestao_aviso_quadro_trg() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS trg_gestao_aviso_quadro_ins ON public.gestao_tarefas;
DROP TRIGGER IF EXISTS trg_gestao_aviso_quadro_upd ON public.gestao_tarefas;
CREATE CONSTRAINT TRIGGER trg_gestao_aviso_quadro_ins AFTER INSERT ON public.gestao_tarefas
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.gestao_aviso_quadro_trg();
CREATE CONSTRAINT TRIGGER trg_gestao_aviso_quadro_upd AFTER UPDATE OF id_quadro ON public.gestao_tarefas
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (old.id_quadro IS DISTINCT FROM new.id_quadro)
  EXECUTE FUNCTION public.gestao_aviso_quadro_trg();

-- ── 4) Rotina diária: recorrência + avisos de prazo ────────────────────────────────
CREATE OR REPLACE FUNCTION public.gestao_cron_diario()
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  r record; v_novo text; v_status text; v_base date; v_int int; v_prox date; v_guarda int;
begin
  -- 1) Recorrência: gera TODAS as instâncias vencidas (v297: antes 1 por execução), cada uma com o
  --    prazo da data em que deveria ter nascido, e copia responsáveis/seguidores da original.
  for r in
    select * from public.gestao_tarefas
    where recorrencia is not null
      and (recorrencia->>'proxima_geracao') is not null
      and (recorrencia->>'proxima_geracao')::date <= current_date
  loop
    select slug into v_status from public.gestao_status
      where id_quadro = r.id_quadro and tipo = 'nao_iniciado' order by ordem asc limit 1;
    if v_status is null then v_status := 'A_FAZER'; end if;
    v_base := (r.recorrencia->>'proxima_geracao')::date;
    v_int  := greatest(coalesce((r.recorrencia->>'intervalo')::int, 1), 1);
    v_guarda := 0;

    while v_base <= current_date and v_guarda < 400 loop
      v_guarda := v_guarda + 1;
      v_novo := 'TRF-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
      insert into public.gestao_tarefas (id_tarefa, id_quadro, titulo, descricao, status, prioridade, responsavel, prazo, ordem, etiquetas, subtarefas, campos, created_by, created_at)
      values (v_novo, r.id_quadro, r.titulo, r.descricao, v_status, r.prioridade, r.responsavel,
              v_base, 0, r.etiquetas, '[]'::jsonb, coalesce(r.campos,'{}'::jsonb), 'recorrencia', now());

      insert into public.gestao_tarefa_vinculados (id, id_tarefa, usuario_email, tipo, origem)
        select gen_random_uuid(), v_novo, v.usuario_email, v.tipo, 'recorrencia'
          from public.gestao_tarefa_vinculados v where v.id_tarefa = r.id_tarefa
        on conflict (id_tarefa, usuario_email, tipo) do nothing;

      insert into public.gestao_atividades (id, ator, acao, id_tarefa, payload)
        values (gen_random_uuid(), 'cron', 'recorrencia_gerada', v_novo, jsonb_build_object('origem', r.id_tarefa, 'data', v_base));

      if r.recorrencia->>'tipo' = 'semanal' then v_base := v_base + (v_int * 7);
      elsif r.recorrencia->>'tipo' = 'mensal' then v_base := (v_base + (v_int * interval '1 month'))::date;
      else v_base := v_base + v_int;  -- diaria
      end if;
    end loop;

    update public.gestao_tarefas
      set recorrencia = jsonb_set(recorrencia, '{proxima_geracao}', to_jsonb(v_base::text))
      where id_tarefa = r.id_tarefa;
  end loop;

  -- 2) Avisos de prazo (vence hoje / atrasada) a TODOS os responsáveis vinculados; 1 por dia.
  --    E-mail só no dia do vencimento ("Vence hoje"); atrasada fica só no sino (sem e-mail diário).
  insert into public.gestao_notificacoes (id, destinatario, tipo, titulo, id_tarefa, id_quadro, canal, email_enviado)
  select gen_random_uuid(), lower(v.usuario_email), 'prazo',
         case when t.prazo < current_date then 'Tarefa atrasada: ' else 'Vence hoje: ' end || t.titulo,
         t.id_tarefa, t.id_quadro,
         case when t.prazo < current_date then 'in_app' else 'in_app+email' end,
         (t.prazo < current_date)
  from public.gestao_tarefas t
  join public.gestao_tarefa_vinculados v on v.id_tarefa = t.id_tarefa and v.tipo = 'responsavel'
  join public.usuarios u on lower(u.email) = lower(v.usuario_email) and coalesce(u.ativo_sistema, true)
  left join public.gestao_status s on s.id_quadro = t.id_quadro and s.slug = t.status
  where t.prazo is not null
    and t.prazo <= current_date
    and coalesce(s.tipo, 'ativo') <> 'concluido'
    and not exists (
      select 1 from public.gestao_notificacoes n
      where n.id_tarefa = t.id_tarefa and n.tipo = 'prazo' and lower(n.destinatario) = lower(v.usuario_email)
        and (n.created_at at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date
    );
end $function$;
REVOKE ALL ON FUNCTION public.gestao_cron_diario() FROM public, anon, authenticated;

-- Porta de entrada (worker, 1/min): roda 1x por dia, a partir das 7h de Brasília. Trava por advisory
-- lock + marca no log ANTES de rodar (duas chamadas juntas não rodam duas vezes).
CREATE OR REPLACE FUNCTION public.gestao_rotina_diaria() RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_agora timestamp := now() AT TIME ZONE 'America/Sao_Paulo'; v_rec int; v_av int;
BEGIN
  IF v_agora::time < time '07:00' THEN RETURN jsonb_build_object('rodou', false, 'motivo', 'antes das 7h'); END IF;
  IF NOT pg_try_advisory_xact_lock(hashtext('gestao_rotina_diaria')) THEN
    RETURN jsonb_build_object('rodou', false, 'motivo', 'em execução');
  END IF;
  IF EXISTS (SELECT 1 FROM public.gestao_automacao_log WHERE gatilho = 'rotina_diaria'
              AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date = v_agora::date) THEN
    RETURN jsonb_build_object('rodou', false, 'motivo', 'já rodou hoje');
  END IF;
  INSERT INTO public.gestao_automacao_log (gatilho, resultado, detalhe) VALUES ('rotina_diaria', 'ok', 'recorrência + avisos de prazo + prazos das automações');
  SELECT count(*) INTO v_rec FROM public.gestao_atividades WHERE acao = 'recorrencia_gerada';
  SELECT count(*) INTO v_av FROM public.gestao_notificacoes WHERE tipo = 'prazo';
  PERFORM public.gestao_cron_diario();
  PERFORM public.gestao_automacao_tick();   -- automações por prazo (tem trava diária própria)
  RETURN jsonb_build_object('rodou', true,
    'recorrencias', (SELECT count(*) FROM public.gestao_atividades WHERE acao = 'recorrencia_gerada') - v_rec,
    'avisos_prazo', (SELECT count(*) FROM public.gestao_notificacoes WHERE tipo = 'prazo') - v_av);
END $$;
REVOKE ALL ON FUNCTION public.gestao_rotina_diaria() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gestao_rotina_diaria() TO service_role;
REVOKE ALL ON FUNCTION public.gestao_automacao_completa(jsonb) FROM public, anon;
REVOKE ALL ON FUNCTION public.gestao_automacao_completa_trg() FROM public, anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- ── 5) JCN: agendamento pelo pg_cron (o JCN tem pg_cron; o painel chama pelo worker 1/min) ──────
-- gestao-diario passa a chamar a rotina (que já chama gestao_automacao_tick → prazos), às 07:05 de
-- Brasília (10:05 UTC). O job gestao-automacao-prazos sai: a rotina faz o mesmo, com trava diária.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'gestao-automacao-prazos') THEN
    PERFORM cron.unschedule('gestao-automacao-prazos');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'gestao-diario') THEN
    PERFORM cron.unschedule('gestao-diario');
  END IF;
  PERFORM cron.schedule('gestao-diario', '5 10 * * *', 'select public.gestao_rotina_diaria()');
END $$;
