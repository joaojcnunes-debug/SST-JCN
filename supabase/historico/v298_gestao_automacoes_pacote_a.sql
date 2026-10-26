-- v298 (JCN) — Gestão: automações, Pacote A (levantamento Jira/Trello/ClickUp/Notion, 26/10/2026).
--
-- O QUE MUDA
--   gestao_automacoes.acoes jsonb        VÁRIAS ações por regra, em ordem. Cada ação pode ter a sua
--                                        `condicao` (E/OU): só roda se casar — é o "se/senão" (duas
--                                        ações com condições opostas). `acao` (uma só) continua, espelho
--                                        de acoes[0], para cliente antigo; a regra antiga vira acoes=[acao].
--   gestao_notificacoes.mensagem         corpo do e-mail da ação "enviar e-mail".
--   gatilhos novos                       responsável adicionado, prioridade muda, campo muda, etiqueta
--                                        adicionada, comentário adicionado.
--   ações novas                          comentar, enviar e-mail, definir prazo (relativo, dias úteis),
--                                        adicionar/remover etiqueta, concluir, duplicar tarefa.
--   variáveis nos textos                 {titulo} {responsavel} {prazo} {quadro} {status} {prioridade}
--                                        {data} {comentario} {etiqueta} (e {{titulo}} antigo).
--   condições novas                      responsável, título, origem (formulário/recorrência/automação/
--                                        manual), dia da semana, situação do prazo, comentário, campo
--                                        alterado, etiqueta nova. Ops novos: vazio, não vazio, não contém.
--                                        "contém" passa a ignorar maiúsculas.
--   E/OU também nos gatilhos de prazo.
--   gestao_automacao_historico(quadro)   histórico das execuções na tela. O log deixa de ser legível
--                                        por qualquer usuário: só quem vê o quadro.
--
-- REAPLICAR: idempotente. ROLLBACK: scripts/sql/v298_gestao_automacoes_pacote_a_rollback.sql

-- ── 1) Colunas ──────────────────────────────────────────────────────────────
alter table public.gestao_automacoes add column if not exists acoes jsonb not null default '[]'::jsonb;
alter table public.gestao_notificacoes add column if not exists mensagem text;

update public.gestao_automacoes
   set acoes = jsonb_build_array(acao)
 where jsonb_array_length(acoes) = 0 and coalesce(acao->>'tipo', '') <> '';

create index if not exists gestao_automacao_log_autom_idx on public.gestao_automacao_log (id_automacao, created_at desc);
create index if not exists gestao_automacao_log_tarefa_idx on public.gestao_automacao_log (id_tarefa, created_at desc);

-- ── 2) Ação completa? (uma e a lista) ───────────────────────────────────────
create or replace function public.gestao_automacao_completa(p_acao jsonb) returns boolean
  language sql immutable as $$
  select case coalesce(p_acao->>'tipo', '')
    when 'mover_status'             then coalesce(p_acao->>'valor', '') <> ''
    when 'mover_status_se_completo' then coalesce(p_acao->>'valor', '') <> ''
    when 'definir_responsavel'      then coalesce(p_acao->>'valor', '') <> ''
    when 'definir_prioridade'       then coalesce(p_acao->>'valor', '') <> ''
    when 'definir_campo'            then coalesce(p_acao->>'campo_id', '') <> ''
    when 'adicionar_vinculados'     then jsonb_typeof(p_acao->'emails') = 'array' and jsonb_array_length(p_acao->'emails') > 0
    when 'mover_tarefa_quadro'      then coalesce(p_acao->>'id_quadro_destino', '') <> ''
    when 'criar_tarefa_quadro'      then coalesce(p_acao->>'id_quadro_destino', '') <> ''
    when 'criar_subtarefas_modelo'  then coalesce(p_acao->>'modelo_slug', '') <> ''
    when 'notificar'                then true
    when 'solicitar_aprovacao'      then true
    -- v298
    when 'comentar'                 then coalesce(btrim(p_acao->>'texto'), '') <> ''
    when 'enviar_email'             then coalesce(btrim(p_acao->>'assunto'), '') <> ''
                                         and (coalesce(p_acao->>'para', '') in ('vinculados', 'responsaveis')
                                              or (jsonb_typeof(p_acao->'emails') = 'array' and jsonb_array_length(p_acao->'emails') > 0))
    when 'definir_prazo'            then coalesce(p_acao->>'dias', '') ~ '^-?[0-9]+$'
    when 'adicionar_etiqueta'       then coalesce(btrim(p_acao->>'valor'), '') <> ''
    when 'remover_etiqueta'         then coalesce(btrim(p_acao->>'valor'), '') <> ''
    when 'concluir'                 then true
    when 'duplicar_tarefa'          then true
    else false
  end;
$$;

create or replace function public.gestao_automacao_completa_lista(p_acoes jsonb) returns boolean
  language sql immutable as $$
  select jsonb_typeof(p_acoes) = 'array' and jsonb_array_length(p_acoes) > 0
     and not exists (select 1 from jsonb_array_elements(p_acoes) a where not public.gestao_automacao_completa(a));
$$;

create or replace function public.gestao_automacao_completa_trg() returns trigger
  language plpgsql as $$
begin
  -- cliente antigo que grava só `acao`: vira a lista de uma ação
  if (new.acoes is null or jsonb_array_length(new.acoes) = 0) and coalesce(new.acao->>'tipo', '') <> '' then
    new.acoes := jsonb_build_array(new.acao);
  end if;
  new.acoes := coalesce(new.acoes, '[]'::jsonb);
  new.acao := coalesce(new.acoes->0, '{}'::jsonb);
  if new.ativo and not public.gestao_automacao_completa_lista(new.acoes) then
    new.ativo := false;
  end if;
  return new;
end $$;

-- ── 3) Contexto, variáveis e datas ──────────────────────────────────────────
create or replace function public.gestao_automacao_ctx(p_tarefa public.gestao_tarefas, p_extra jsonb default '{}'::jsonb)
  returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(p_extra, '{}'::jsonb) || jsonb_build_object(
    'status',      p_tarefa.status,
    'prioridade',  p_tarefa.prioridade,
    'quadro',      p_tarefa.id_quadro,
    'etiquetas',   to_jsonb(coalesce(p_tarefa.etiquetas, '{}'::text[])),
    'campos',      coalesce(p_tarefa.campos, '{}'::jsonb),
    'responsavel', coalesce(p_tarefa.responsavel, ''),
    'titulo',      coalesce(p_tarefa.titulo, ''),
    'origem',      coalesce(p_tarefa.origem->>'tipo',
                     case p_tarefa.created_by when 'recorrencia' then 'recorrencia' when 'automacao' then 'automacao'
                                              when 'Formulário' then 'formulario' else 'manual' end),
    'dia_semana',  extract(isodow from (now() at time zone 'America/Sao_Paulo'))::int::text,
    'prazo_estado', case when p_tarefa.prazo is null then 'vazio'
                         when p_tarefa.prazo < (now() at time zone 'America/Sao_Paulo')::date then 'vencido'
                         when p_tarefa.prazo = (now() at time zone 'America/Sao_Paulo')::date then 'hoje'
                         else 'futuro' end
  );
$$;

create or replace function public.gestao_data_br(p date) returns text
  language sql immutable as $$ select to_char(p, 'DD/MM/YYYY') $$;

-- Soma N dias (corridos ou úteis — seg a sex) a uma data. N pode ser negativo.
create or replace function public.gestao_somar_dias(p_base date, p_dias int, p_uteis boolean) returns date
  language plpgsql immutable as $$
declare d date := p_base; passo int := case when p_dias < 0 then -1 else 1 end; falta int := abs(p_dias);
begin
  if not p_uteis then return p_base + p_dias; end if;
  while falta > 0 loop
    d := d + passo;
    if extract(isodow from d) < 6 then falta := falta - 1; end if;
  end loop;
  return d;
end $$;

-- Texto com variáveis: {titulo} {responsavel} {prazo} {quadro} {status} {prioridade} {data} e as do contexto
-- (ctx.vars: {comentario}, {etiqueta}, …). {{titulo}} (formato antigo) continua valendo.
create or replace function public.gestao_automacao_texto(p_tpl text, p_tarefa public.gestao_tarefas, p_ctx jsonb default '{}'::jsonb)
  returns text language plpgsql stable security definer set search_path = public as $$
declare r text := coalesce(p_tpl, ''); k text; v text;
begin
  r := replace(r, '{{titulo}}', coalesce(p_tarefa.titulo, ''));
  r := replace(r, '{titulo}', coalesce(p_tarefa.titulo, ''));
  r := replace(r, '{responsavel}', coalesce(p_tarefa.responsavel, ''));
  r := replace(r, '{prazo}', coalesce(public.gestao_data_br(p_tarefa.prazo), 'sem prazo'));
  r := replace(r, '{prioridade}', coalesce(p_tarefa.prioridade, ''));
  r := replace(r, '{data}', public.gestao_data_br((now() at time zone 'America/Sao_Paulo')::date));
  if position('{quadro}' in r) > 0 then
    r := replace(r, '{quadro}', coalesce((select nome from public.gestao_quadros where id_quadro = p_tarefa.id_quadro), ''));
  end if;
  if position('{status}' in r) > 0 then
    r := replace(r, '{status}', coalesce((select nome from public.gestao_status where id_quadro = p_tarefa.id_quadro and slug = p_tarefa.status), p_tarefa.status, ''));
  end if;
  for k, v in select key, value from jsonb_each_text(coalesce(p_ctx->'vars', '{}'::jsonb)) loop
    r := replace(r, '{' || k || '}', coalesce(v, ''));
  end loop;
  return r;
end $$;

-- ── 4) Condições: campos e operadores novos ─────────────────────────────────
create or replace function public.gestao_automacao_cond_teste(p_clause jsonb, p_ctx jsonb) returns boolean
  language plpgsql stable security definer set search_path = public as $$
declare
  f    text  := p_clause->>'campo';
  op   text  := lower(coalesce(p_clause->>'op', '='));
  val  jsonb := p_clause->'valor';
  val_txt text := case when val is null then null when jsonb_typeof(val) = 'string' then val #>> '{}' else val::text end;
  fval text;
  farr jsonb := null;
begin
  if f is null then
    return false;
  elsif f = 'etiqueta' then
    farr := coalesce(p_ctx->'etiquetas', '[]'::jsonb);
  elsif f like 'campo:%' then
    if jsonb_typeof(p_ctx->'campos'->substring(f from 7)) = 'array' then
      farr := p_ctx->'campos'->substring(f from 7);
    else
      fval := p_ctx->'campos'->>substring(f from 7);
    end if;
  elsif f in ('subtarefa', 'subtarefa_texto') then
    fval := p_ctx->>'subtarefa_texto';
  elsif f in ('subtarefa_etapa', 'subtarefa_tipo', 'status', 'status_de', 'status_para', 'prioridade', 'quadro',
              'responsavel', 'responsavel_email', 'titulo', 'origem', 'dia_semana', 'prazo_estado',
              'campo_alterado', 'etiqueta_nova', 'prioridade_de') then
    fval := p_ctx->>f;
  elsif f in ('comentario', 'comentario_texto') then
    fval := p_ctx->>'comentario_texto';
  else
    return false;
  end if;

  -- vazio / não vazio servem para texto e lista
  if op = 'vazio' then
    return case when farr is not null then jsonb_array_length(farr) = 0 else coalesce(fval, '') = '' end;
  elsif op = 'nao_vazio' then
    return case when farr is not null then jsonb_array_length(farr) > 0 else coalesce(fval, '') <> '' end;
  end if;

  if farr is not null then
    if op in ('=', 'contains') then
      if jsonb_typeof(val) = 'array' then return farr @> val; end if;
      return farr ? coalesce(val_txt, '');
    elsif op = 'in' then
      if jsonb_typeof(val) = 'array' then
        return exists (select 1 from jsonb_array_elements_text(val) e where farr ? e);
      end if;
      return exists (select 1 from unnest(string_to_array(coalesce(val_txt, ''), ',')) e where farr ? btrim(e));
    elsif op in ('!=', 'nao_contem') then
      return not (farr ? coalesce(val_txt, ''));
    end if;
    return false;
  end if;

  if op = '=' then
    return fval is not distinct from val_txt;
  elsif op = '!=' then
    return fval is distinct from val_txt;
  elsif op = 'in' then
    if jsonb_typeof(val) = 'array' then
      return exists (select 1 from jsonb_array_elements_text(val) e where e = fval);
    end if;
    return exists (select 1 from unnest(string_to_array(coalesce(val_txt, ''), ',')) e where btrim(e) = fval);
  elsif op = 'contains' then
    return fval is not null and val_txt is not null and position(lower(val_txt) in lower(fval)) > 0;
  elsif op = 'nao_contem' then
    return val_txt is not null and position(lower(val_txt) in lower(coalesce(fval, ''))) = 0;
  end if;
  return false;
end $$;

-- ── 5) Uma ação ─────────────────────────────────────────────────────────────
-- Devolve {res: ok|skip|erro, det: texto}. Erro numa ação não derruba as outras.
create or replace function public.gestao_automacao_acao(p_autom public.gestao_automacoes, p_acao jsonb,
                                                        p_tarefa public.gestao_tarefas, p_gatilho text, p_ctx jsonb)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_acao jsonb := coalesce(p_acao, '{}'::jsonb);
  v_tipo text := v_acao->>'tipo';
  v_email text; v_res text := 'ok'; v_det text := null;
  v_sent int := 0; v_cand int := 0; v_ins int := 0;
  v_e text; v_tipo_vinc text; v_new_id text; v_dest_status text; v_titulo text; v_copiar boolean;
  v_modelo public.gestao_subtarefa_modelos; v_item jsonb; v_ordem int; v_txt text;
  v_base date; v_prazo date; v_quadro text; v_assunto text;
begin
  begin
    if v_tipo = 'mover_status' and coalesce(v_acao->>'valor','') <> '' then
      update public.gestao_tarefas set status = v_acao->>'valor', updated_at = now() where id_tarefa = p_tarefa.id_tarefa;
    elsif v_tipo = 'definir_responsavel' and coalesce(v_acao->>'valor','') <> '' then
      update public.gestao_tarefas set responsavel = nullif(v_acao->>'valor',''), updated_at = now() where id_tarefa = p_tarefa.id_tarefa;
    elsif v_tipo = 'definir_prioridade' and coalesce(v_acao->>'valor','') <> '' then
      update public.gestao_tarefas set prioridade = v_acao->>'valor', updated_at = now() where id_tarefa = p_tarefa.id_tarefa;
    elsif v_tipo = 'definir_campo' and coalesce(v_acao->>'campo_id','') <> '' then
      update public.gestao_tarefas
         set campos = jsonb_set(coalesce(campos,'{}'::jsonb), array[v_acao->>'campo_id'],
                                coalesce(to_jsonb(public.gestao_automacao_texto(v_acao->>'valor', p_tarefa, p_ctx)), 'null'::jsonb)),
             updated_at = now()
       where id_tarefa = p_tarefa.id_tarefa;
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
        v_det := 'vinculados: ' || v_ins;
      end if;
    elsif v_tipo = 'mover_tarefa_quadro' and coalesce(v_acao->>'id_quadro_destino','') <> '' then
      v_dest_status := coalesce(nullif(v_acao->>'status_destino',''),
        (select slug from public.gestao_status where id_quadro = v_acao->>'id_quadro_destino' order by ordem limit 1));
      update public.gestao_tarefas
         set id_quadro = v_acao->>'id_quadro_destino', status = coalesce(v_dest_status, status), updated_at = now()
       where id_tarefa = p_tarefa.id_tarefa;
      v_det := 'movida para ' || (v_acao->>'id_quadro_destino');
    elsif v_tipo = 'criar_tarefa_quadro' and coalesce(v_acao->>'id_quadro_destino','') <> '' then
      v_copiar := coalesce(v_acao->>'copiar_campos','') in ('true','1');
      select slug into v_dest_status from public.gestao_status where id_quadro = v_acao->>'id_quadro_destino' order by ordem limit 1;
      v_new_id := 'TRF-' || upper(substring(replace(gen_random_uuid()::text,'-','') from 1 for 8));
      v_titulo := public.gestao_automacao_texto(coalesce(nullif(v_acao->>'titulo_template',''), p_tarefa.titulo), p_tarefa, p_ctx);
      insert into public.gestao_tarefas (id_tarefa, id_quadro, titulo, status, prioridade, etiquetas, campos, created_by)
      values (v_new_id, v_acao->>'id_quadro_destino', v_titulo, coalesce(v_dest_status, 'A_FAZER'),
              case when v_copiar then p_tarefa.prioridade else 'Media' end,
              case when v_copiar then p_tarefa.etiquetas else '{}'::text[] end,
              case when v_copiar then p_tarefa.campos else '{}'::jsonb end,
              'automacao');
      v_det := 'tarefa criada: ' || v_new_id;
    elsif v_tipo = 'notificar' then
      v_titulo := coalesce(nullif(public.gestao_automacao_texto(v_acao->>'valor', p_tarefa, p_ctx), ''), 'Automação: ' || p_tarefa.titulo);
      for v_email in
        select distinct lower(usuario_email) from public.gestao_tarefa_vinculados where id_tarefa = p_tarefa.id_tarefa
      loop
        if v_email is null or v_email = '' then continue; end if;
        v_cand := v_cand + 1;
        if p_gatilho like 'prazo%' and exists (
          select 1 from public.gestao_notificacoes n
           where n.id_tarefa = p_tarefa.id_tarefa and n.tipo = 'prazo' and lower(n.destinatario) = v_email and n.created_at::date = current_date
        ) then continue; end if;
        insert into public.gestao_notificacoes (id, destinatario, tipo, titulo, id_tarefa, id_quadro)
        values (gen_random_uuid(), v_email, case when p_gatilho like 'prazo%' then 'prazo' else 'status' end,
                left(v_titulo, 300), p_tarefa.id_tarefa, p_tarefa.id_quadro);
        v_sent := v_sent + 1;
      end loop;
      if v_cand = 0 then
        select lower(email) into v_email from public.usuarios where nome = p_tarefa.responsavel limit 1;
        if v_email is null then
          v_res := 'skip'; v_det := 'sem responsável/e-mail';
        else
          insert into public.gestao_notificacoes (id, destinatario, tipo, titulo, id_tarefa, id_quadro)
          values (gen_random_uuid(), v_email, case when p_gatilho like 'prazo%' then 'prazo' else 'status' end,
                  left(v_titulo, 300), p_tarefa.id_tarefa, p_tarefa.id_quadro);
          v_det := 'notificado: responsável';
        end if;
      elsif v_sent = 0 then
        v_res := 'skip'; v_det := 'aviso de prazo já enviado hoje';
      else
        v_det := 'notificados: ' || v_sent || '/' || v_cand;
      end if;
    elsif v_tipo = 'solicitar_aprovacao' then
      if exists (select 1 from public.gestao_aprovacoes where id_tarefa = p_tarefa.id_tarefa and status = 'pendente') then
        v_res := 'skip'; v_det := 'aprovação pendente já existe';
      else
        insert into public.gestao_aprovacoes (id_tarefa, solicitado_por, aprovador_email, status)
        values (p_tarefa.id_tarefa, coalesce(public.gestao_email(), 'automacao'),
                lower(nullif(btrim(coalesce(v_acao->>'aprovador_email','')), '')), 'pendente');
        v_det := 'aprovação solicitada';
      end if;
    elsif v_tipo = 'criar_subtarefas_modelo' and coalesce(v_acao->>'modelo_slug','') <> '' then
      select * into v_modelo from public.gestao_subtarefa_modelos
       where id_quadro = p_tarefa.id_quadro and slug = v_acao->>'modelo_slug';
      if v_modelo.id is null then
        v_res := 'skip'; v_det := 'modelo inexistente: ' || (v_acao->>'modelo_slug');
      else
        select coalesce(max(ordem), -1) + 1 into v_ordem from public.gestao_subtarefas where id_tarefa = p_tarefa.id_tarefa;
        for v_item in select value from jsonb_array_elements(coalesce(v_modelo.itens, '[]'::jsonb)) loop
          v_txt := btrim(coalesce(v_item->>'texto',''));
          if v_txt = '' then continue; end if;
          if exists (select 1 from public.gestao_subtarefas where id_tarefa = p_tarefa.id_tarefa and texto = v_txt) then continue; end if;
          insert into public.gestao_subtarefas (id, id_tarefa, texto, ordem, etapa, tipo)
          values ('SUB-' || upper(substring(replace(gen_random_uuid()::text,'-','') from 1 for 8)), p_tarefa.id_tarefa, v_txt,
                  v_ordem, nullif(v_item->>'etapa',''), nullif(v_item->>'tipo',''));
          v_ordem := v_ordem + 1; v_ins := v_ins + 1;
        end loop;
        v_det := 'subtarefas do modelo ' || v_modelo.slug || ': ' || v_ins;
      end if;
    elsif v_tipo = 'mover_status_se_completo' and coalesce(v_acao->>'valor','') <> '' then
      if exists (select 1 from public.gestao_subtarefas where id_tarefa = p_tarefa.id_tarefa and not feito) then
        v_res := 'skip'; v_det := 'ainda há subtarefas pendentes';
      elsif not exists (select 1 from public.gestao_subtarefas where id_tarefa = p_tarefa.id_tarefa) then
        v_res := 'skip'; v_det := 'sem subtarefas';
      else
        update public.gestao_tarefas set status = v_acao->>'valor', updated_at = now() where id_tarefa = p_tarefa.id_tarefa;
        v_det := 'subtarefas concluídas → ' || (v_acao->>'valor');
      end if;

    -- ── v298 ──
    elsif v_tipo = 'comentar' then
      v_txt := btrim(public.gestao_automacao_texto(v_acao->>'texto', p_tarefa, p_ctx));
      if v_txt = '' then
        v_res := 'skip'; v_det := 'comentário vazio';
      else
        insert into public.gestao_comentarios (id_comentario, id_tarefa, autor, texto)
        values ('CMT-' || upper(substring(replace(gen_random_uuid()::text,'-','') from 1 for 8)), p_tarefa.id_tarefa, 'automacao', v_txt);
        v_det := 'comentário publicado';
      end if;
    elsif v_tipo = 'enviar_email' then
      v_assunto := left(btrim(public.gestao_automacao_texto(v_acao->>'assunto', p_tarefa, p_ctx)), 300);
      v_txt := public.gestao_automacao_texto(v_acao->>'mensagem', p_tarefa, p_ctx);
      for v_email in
        select distinct d from (
          select lower(v.usuario_email) d from public.gestao_tarefa_vinculados v
           where v.id_tarefa = p_tarefa.id_tarefa
             and ((v_acao->>'para') = 'vinculados' or ((v_acao->>'para') = 'responsaveis' and v.tipo = 'responsavel'))
          union
          select lower(btrim(x)) from jsonb_array_elements_text(coalesce(v_acao->'emails', '[]'::jsonb)) x
        ) s where d like '%@%'
      loop
        insert into public.gestao_notificacoes (id, destinatario, tipo, titulo, mensagem, id_tarefa, id_quadro, canal)
        values (gen_random_uuid(), v_email, 'automacao', v_assunto, nullif(btrim(v_txt), ''), p_tarefa.id_tarefa, p_tarefa.id_quadro, 'in_app+email');
        v_sent := v_sent + 1;
      end loop;
      if v_sent = 0 then v_res := 'skip'; v_det := 'nenhum destinatário'; else v_det := 'e-mails na fila: ' || v_sent; end if;
    elsif v_tipo = 'definir_prazo' then
      v_base := case coalesce(v_acao->>'base', 'hoje')
                  when 'prazo'       then coalesce(p_tarefa.prazo, (now() at time zone 'America/Sao_Paulo')::date)
                  when 'data_inicio' then coalesce(p_tarefa.data_inicio, (now() at time zone 'America/Sao_Paulo')::date)
                  when 'criacao'     then (p_tarefa.created_at at time zone 'America/Sao_Paulo')::date
                  else (now() at time zone 'America/Sao_Paulo')::date end;
      v_prazo := public.gestao_somar_dias(v_base, (v_acao->>'dias')::int, coalesce(v_acao->>'uteis', '') in ('true', '1'));
      update public.gestao_tarefas set prazo = v_prazo, updated_at = now() where id_tarefa = p_tarefa.id_tarefa;
      v_det := 'prazo → ' || public.gestao_data_br(v_prazo);
    elsif v_tipo = 'adicionar_etiqueta' then
      v_txt := btrim(v_acao->>'valor');
      if v_txt = any (coalesce(p_tarefa.etiquetas, '{}'::text[])) then
        v_res := 'skip'; v_det := 'já tinha a etiqueta';
      else
        update public.gestao_tarefas set etiquetas = array_append(coalesce(etiquetas, '{}'::text[]), v_txt), updated_at = now()
         where id_tarefa = p_tarefa.id_tarefa;
        v_det := 'etiqueta + ' || v_txt;
      end if;
    elsif v_tipo = 'remover_etiqueta' then
      v_txt := btrim(v_acao->>'valor');
      if not (v_txt = any (coalesce(p_tarefa.etiquetas, '{}'::text[]))) then
        v_res := 'skip'; v_det := 'não tinha a etiqueta';
      else
        update public.gestao_tarefas set etiquetas = array_remove(etiquetas, v_txt), updated_at = now() where id_tarefa = p_tarefa.id_tarefa;
        v_det := 'etiqueta − ' || v_txt;
      end if;
    elsif v_tipo = 'concluir' then
      select slug into v_dest_status from public.gestao_status where id_quadro = p_tarefa.id_quadro and tipo = 'concluido' order by ordem limit 1;
      if v_dest_status is null then
        v_res := 'skip'; v_det := 'quadro sem status de concluído';
      elsif v_dest_status = p_tarefa.status then
        v_res := 'skip'; v_det := 'já concluída';
      else
        update public.gestao_tarefas set status = v_dest_status, updated_at = now() where id_tarefa = p_tarefa.id_tarefa;
        v_det := 'concluída';
      end if;
    elsif v_tipo = 'duplicar_tarefa' then
      v_quadro := coalesce(nullif(v_acao->>'id_quadro_destino', ''), p_tarefa.id_quadro);
      select slug into v_dest_status from public.gestao_status where id_quadro = v_quadro order by (tipo = 'nao_iniciado') desc, ordem limit 1;
      v_new_id := 'TRF-' || upper(substring(replace(gen_random_uuid()::text,'-','') from 1 for 8));
      v_titulo := public.gestao_automacao_texto(coalesce(nullif(v_acao->>'titulo_template', ''), '{titulo} (cópia)'), p_tarefa, p_ctx);
      insert into public.gestao_tarefas (id_tarefa, id_quadro, titulo, descricao, status, prioridade, responsavel, prazo, data_inicio,
                                         etiquetas, campos, created_by, origem)
      values (v_new_id, v_quadro, v_titulo, p_tarefa.descricao, coalesce(v_dest_status, 'A_FAZER'), p_tarefa.prioridade,
              p_tarefa.responsavel, p_tarefa.prazo, p_tarefa.data_inicio, p_tarefa.etiquetas, p_tarefa.campos, 'automacao',
              jsonb_build_object('tipo', 'automacao', 'copia_de', p_tarefa.id_tarefa));
      insert into public.gestao_tarefa_vinculados (id, id_tarefa, usuario_email, tipo, origem)
        select gen_random_uuid(), v_new_id, v.usuario_email, v.tipo, 'automacao'
          from public.gestao_tarefa_vinculados v where v.id_tarefa = p_tarefa.id_tarefa
        on conflict (id_tarefa, usuario_email, tipo) do nothing;
      v_det := 'cópia criada: ' || v_new_id;
    else
      v_res := 'skip'; v_det := 'ação não reconhecida: ' || coalesce(v_tipo, '(vazia)');
    end if;
  exception when others then
    v_res := 'erro'; v_det := left(SQLERRM, 300);
  end;
  return jsonb_build_object('res', v_res, 'det', v_det);
end $$;

-- ── 6) Aplicar a regra: as ações em ordem, cada uma com a sua condição ──────
create or replace function public.gestao_automacao_aplicar(p_autom public.gestao_automacoes, p_tarefa public.gestao_tarefas,
                                                           p_gatilho text, p_ctx jsonb)
  returns void language plpgsql security definer set search_path = public as $$
declare
  v_acoes jsonb := case when jsonb_array_length(coalesce(p_autom.acoes, '[]'::jsonb)) > 0 then p_autom.acoes
                        when coalesce(p_autom.acao->>'tipo', '') <> '' then jsonb_build_array(p_autom.acao)
                        else '[]'::jsonb end;
  v_acao jsonb; v_r jsonb; v_i int := 0;
  v_tarefa public.gestao_tarefas := p_tarefa;
  v_ctx jsonb := coalesce(p_ctx, '{}'::jsonb);
  v_partes text[] := '{}'; v_ok boolean := false; v_erro boolean := false;
begin
  for v_acao in select value from jsonb_array_elements(v_acoes) loop
    v_i := v_i + 1;
    if (v_acao->'condicao') is not null and ((v_acao->'condicao') ? 'all' or (v_acao->'condicao') ? 'any')
       and not public.gestao_automacao_cond_bate(v_acao->'condicao', v_ctx) then
      v_partes := v_partes || (v_i || '. ' || coalesce(v_acao->>'tipo', '?') || ': condição da ação não casou');
      continue;
    end if;
    v_r := public.gestao_automacao_acao(p_autom, v_acao, v_tarefa, p_gatilho, v_ctx);
    v_partes := v_partes || (v_i || '. ' || coalesce(v_acao->>'tipo', '?') || ': ' || (v_r->>'res')
                              || coalesce(' — ' || (v_r->>'det'), ''));
    if v_r->>'res' = 'ok' then v_ok := true; elsif v_r->>'res' = 'erro' then v_erro := true; end if;
    -- a próxima ação enxerga o efeito da anterior
    select * into v_tarefa from public.gestao_tarefas where id_tarefa = p_tarefa.id_tarefa;
    if not found then exit; end if;
    v_ctx := public.gestao_automacao_ctx(v_tarefa, v_ctx);
  end loop;

  insert into public.gestao_automacao_log (id_automacao, id_tarefa, gatilho, resultado, detalhe, profundidade)
  values (p_autom.id, p_tarefa.id_tarefa, p_gatilho,
          case when v_erro then 'erro' when v_ok then 'ok' else 'skip' end,
          left(coalesce(array_to_string(v_partes, ' · '), ''), 1000),
          coalesce(nullif(current_setting('gestao.autom_depth', true), ''), '0')::int);
end $$;

-- assinatura antiga (3 argumentos): monta o contexto a partir da tarefa
create or replace function public.gestao_automacao_aplicar(p_autom public.gestao_automacoes, p_tarefa public.gestao_tarefas, p_gatilho text)
  returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.gestao_automacao_aplicar(p_autom, p_tarefa, p_gatilho, public.gestao_automacao_ctx(p_tarefa, '{}'::jsonb));
end $$;

-- ── 7) Rodar as regras de um gatilho ────────────────────────────────────────
create or replace function public.gestao_automacao_run(p_id_tarefa text, p_gatilho text, p_de text, p_para text, p_ctx jsonb default '{}'::jsonb)
  returns void language plpgsql security definer set search_path = public as $$
declare
  v_tarefa public.gestao_tarefas; a public.gestao_automacoes; v_depth int; v_ctx jsonb; v_match boolean;
begin
  select * into v_tarefa from public.gestao_tarefas where id_tarefa = p_id_tarefa;
  if not found then return; end if;
  v_depth := coalesce(nullif(current_setting('gestao.autom_depth', true), ''), '0')::int;
  if v_depth >= 3 then
    insert into public.gestao_automacao_log (id_tarefa, gatilho, resultado, detalhe, profundidade)
    values (p_id_tarefa, p_gatilho, 'skip', 'profundidade', v_depth);
    return;
  end if;
  perform set_config('gestao.autom_depth', (v_depth + 1)::text, true);
  v_ctx := public.gestao_automacao_ctx(v_tarefa, coalesce(p_ctx, '{}'::jsonb) || jsonb_build_object('status_de', p_de, 'status_para', p_para));
  for a in
    select * from public.gestao_automacoes
     where id_quadro = v_tarefa.id_quadro and ativo and gatilho = p_gatilho
     order by ordem
  loop
    if (a.condicao ? 'all') or (a.condicao ? 'any') then
      v_match := public.gestao_automacao_cond_bate(a.condicao, v_ctx);
    else
      v_match := true;
      if p_gatilho = 'status_muda' then
        if (a.condicao->>'de')   is not null and a.condicao->>'de'   <> coalesce(p_de,'')   then v_match := false; end if;
        if (a.condicao->>'para') is not null and a.condicao->>'para' <> coalesce(p_para,'') then v_match := false; end if;
      end if;
    end if;
    if not v_match then continue; end if;
    perform public.gestao_automacao_aplicar(a, v_tarefa, p_gatilho, v_ctx);
    select * into v_tarefa from public.gestao_tarefas where id_tarefa = p_id_tarefa;
    if not found then exit; end if;
    v_ctx := public.gestao_automacao_ctx(v_tarefa, v_ctx);
  end loop;
  perform set_config('gestao.autom_depth', v_depth::text, true);
exception when others then
  perform set_config('gestao.autom_depth', coalesce(v_depth, 0)::text, true);
  insert into public.gestao_automacao_log (id_tarefa, gatilho, resultado, detalhe, profundidade)
  values (p_id_tarefa, p_gatilho, 'erro', left(SQLERRM, 300), coalesce(v_depth, 0));
end $$;

-- ── 8) Gatilhos na tarefa: os de antes + prioridade, campo, etiqueta ────────
create or replace function public.gestao_automacao_trg() returns trigger
  language plpgsql security definer set search_path = public as $$
declare k text; e text;
begin
  -- v300: subtarefa aberta como tarefa não roda as automações do quadro.
  if new.id_tarefa_pai is not null then return null; end if;
  begin
    if tg_op = 'INSERT' then
      perform public.gestao_automacao_run(new.id_tarefa, 'tarefa_criada', null, null);
    elsif tg_op = 'UPDATE' then
      if old.id_quadro is distinct from new.id_quadro then
        perform public.gestao_automacao_run(new.id_tarefa, 'tarefa_movida_quadro', old.id_quadro, new.id_quadro);
      end if;
      if old.status is distinct from new.status then
        perform public.gestao_automacao_run(new.id_tarefa, 'status_muda', old.status, new.status);
      end if;
      if old.prioridade is distinct from new.prioridade then
        perform public.gestao_automacao_run(new.id_tarefa, 'prioridade_muda', null, null,
          jsonb_build_object('prioridade_de', old.prioridade));
      end if;
      if old.campos is distinct from new.campos then
        for k in
          select key from jsonb_each(coalesce(new.campos, '{}'::jsonb))
           where (coalesce(old.campos, '{}'::jsonb) -> key) is distinct from value
          union
          select key from jsonb_each(coalesce(old.campos, '{}'::jsonb)) where not (coalesce(new.campos, '{}'::jsonb) ? key)
        loop
          perform public.gestao_automacao_run(new.id_tarefa, 'campo_muda', null, null, jsonb_build_object('campo_alterado', k));
        end loop;
      end if;
      if old.etiquetas is distinct from new.etiquetas then
        for e in select x from unnest(coalesce(new.etiquetas, '{}'::text[])) x where not (x = any (coalesce(old.etiquetas, '{}'::text[]))) loop
          perform public.gestao_automacao_run(new.id_tarefa, 'etiqueta_adicionada', null, null,
            jsonb_build_object('etiqueta_nova', e, 'vars', jsonb_build_object('etiqueta', e)));
        end loop;
      end if;
    end if;
  exception when others then
    perform set_config('gestao.autom_depth', '0', true);
    insert into public.gestao_automacao_log (id_tarefa, gatilho, resultado, detalhe)
    values (new.id_tarefa, tg_op, 'erro', left(SQLERRM, 300));
  end;
  return null;
end $$;

drop trigger if exists trg_gestao_automacao_upd on public.gestao_tarefas;
create trigger trg_gestao_automacao_upd after update on public.gestao_tarefas
  for each row when (old.status is distinct from new.status or old.id_quadro is distinct from new.id_quadro
                     or old.prioridade is distinct from new.prioridade or old.campos is distinct from new.campos
                     or old.etiquetas is distinct from new.etiquetas)
  execute function public.gestao_automacao_trg();

-- responsável adicionado (vínculo tipo responsavel)
create or replace function public.gestao_automacao_vinculo_trg() returns trigger
  language plpgsql security definer set search_path = public as $$
declare v_nome text;
begin
  if new.tipo <> 'responsavel' then return null; end if;
  begin
    select nome into v_nome from public.usuarios where lower(email) = lower(new.usuario_email) limit 1;
    perform public.gestao_automacao_run(new.id_tarefa, 'responsavel_adicionado', null, null,
      jsonb_build_object('responsavel_email', lower(new.usuario_email),
                         'vars', jsonb_build_object('novo_responsavel', coalesce(v_nome, new.usuario_email))));
  exception when others then
    perform set_config('gestao.autom_depth', '0', true);
    insert into public.gestao_automacao_log (id_tarefa, gatilho, resultado, detalhe)
    values (new.id_tarefa, 'responsavel_adicionado', 'erro', left(SQLERRM, 300));
  end;
  return null;
end $$;
drop trigger if exists trg_gestao_automacao_vinculo on public.gestao_tarefa_vinculados;
create trigger trg_gestao_automacao_vinculo after insert on public.gestao_tarefa_vinculados
  for each row execute function public.gestao_automacao_vinculo_trg();

-- comentário adicionado (o da própria automação não dispara)
create or replace function public.gestao_automacao_comentario_trg() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.autor, '') = 'automacao' then return null; end if;
  begin
    perform public.gestao_automacao_run(new.id_tarefa, 'comentario_adicionado', null, null,
      jsonb_build_object('comentario_texto', left(coalesce(new.texto, ''), 2000),
                         'vars', jsonb_build_object('comentario', left(coalesce(new.texto, ''), 500),
                                                    'autor_comentario', coalesce(new.autor, ''))));
  exception when others then
    perform set_config('gestao.autom_depth', '0', true);
    insert into public.gestao_automacao_log (id_tarefa, gatilho, resultado, detalhe)
    values (new.id_tarefa, 'comentario_adicionado', 'erro', left(SQLERRM, 300));
  end;
  return null;
end $$;
drop trigger if exists trg_gestao_automacao_comentario on public.gestao_comentarios;
create trigger trg_gestao_automacao_comentario after insert on public.gestao_comentarios
  for each row execute function public.gestao_automacao_comentario_trg();

-- ── 9) Prazos: E/OU também ─────────────────────────────────────────────────
create or replace function public.gestao_automacao_prazos() returns void
  language plpgsql security definer set search_path = public as $$
declare a public.gestao_automacoes; t public.gestao_tarefas; v_dias int; v_depth int; v_ctx jsonb;
begin
  v_depth := coalesce(nullif(current_setting('gestao.autom_depth', true), ''), '0')::int;
  perform set_config('gestao.autom_depth', (v_depth + 1)::text, true);
  for a in select * from public.gestao_automacoes where ativo and gatilho in ('prazo_proximo','prazo_vencido') order by ordem loop
    v_dias := coalesce(nullif(a.condicao->>'dias_antes', '')::int, 3);
    for t in
      select tk.* from public.gestao_tarefas tk
        left join public.gestao_status s on s.id_quadro = tk.id_quadro and s.slug = tk.status
       where tk.id_quadro = a.id_quadro and tk.prazo is not null and tk.id_tarefa_pai is null
         and coalesce(s.tipo, 'ativo') <> 'concluido'
         and ((a.gatilho = 'prazo_proximo' and current_date >= (tk.prazo - v_dias) and current_date <= tk.prazo)
              or (a.gatilho = 'prazo_vencido' and tk.prazo < current_date))
         and not exists (select 1 from public.gestao_automacao_log l
                          where l.id_automacao = a.id and l.id_tarefa = tk.id_tarefa and l.gatilho = a.gatilho and l.resultado <> 'erro')
    loop
      v_ctx := public.gestao_automacao_ctx(t, '{}'::jsonb);
      if ((a.condicao ? 'all') or (a.condicao ? 'any')) and not public.gestao_automacao_cond_bate(a.condicao, v_ctx) then
        continue;
      end if;
      perform public.gestao_automacao_aplicar(a, t, a.gatilho, v_ctx);
    end loop;
  end loop;
  perform set_config('gestao.autom_depth', v_depth::text, true);
exception when others then
  perform set_config('gestao.autom_depth', coalesce(v_depth, 0)::text, true);
end $$;

-- ── 10) Histórico na tela ───────────────────────────────────────────────────
create or replace function public.gestao_automacao_historico(p_id_quadro text, p_limite int default 200)
  returns table (created_at timestamptz, id_automacao uuid, automacao text, id_tarefa text, tarefa text,
                 gatilho text, resultado text, detalhe text)
  language plpgsql stable security definer set search_path = public as $$
begin
  if not public.gestao_pode_ver(p_id_quadro) then
    raise exception 'Sem acesso ao quadro.' using errcode = '42501';
  end if;
  return query
  select l.created_at, l.id_automacao, a.nome, l.id_tarefa, t.titulo, l.gatilho, l.resultado, l.detalhe
    from public.gestao_automacao_log l
    join public.gestao_automacoes a on a.id = l.id_automacao
    left join public.gestao_tarefas t on t.id_tarefa = l.id_tarefa
   where a.id_quadro = p_id_quadro
   order by l.created_at desc
   limit greatest(1, least(coalesce(p_limite, 200), 1000));
end $$;

drop policy if exists gestao_autom_log_sel on public.gestao_automacao_log;
create policy gestao_autom_log_sel on public.gestao_automacao_log for select to authenticated
  using (exists (select 1 from public.gestao_automacoes a where a.id = gestao_automacao_log.id_automacao and public.gestao_pode_ver(a.id_quadro))
         or exists (select 1 from public.gestao_tarefas t where t.id_tarefa = gestao_automacao_log.id_tarefa and public.gestao_pode_ver(t.id_quadro)));

-- ── 11) E-mail com mensagem ─────────────────────────────────────────────────
drop function if exists public.gestao_aviso_email_reservar(integer);
create function public.gestao_aviso_email_reservar(p_limite integer)
  returns table(id uuid, destinatario text, nome text, tipo text, titulo text, id_tarefa text, id_quadro text,
                tarefa_titulo text, quadro_nome text, prazo date, mensagem text)
  language plpgsql security definer set search_path = public as $$
begin
  return query
  with alvo as (
    select n.id from public.gestao_notificacoes n
     where not n.email_enviado and n.email_tentativas < 5
       and (n.email_reservado_em is null or n.email_reservado_em < now() - interval '10 minutes')
     order by n.created_at
     limit greatest(1, least(coalesce(p_limite, 20), 100))
     for update skip locked
  ), res as (
    update public.gestao_notificacoes n
       set email_reservado_em = now(), email_tentativas = n.email_tentativas + 1
      from alvo where n.id = alvo.id
    returning n.id, n.destinatario, n.tipo, n.titulo, n.id_tarefa, n.id_quadro, n.mensagem
  )
  select res.id, res.destinatario, u.nome, res.tipo, res.titulo, res.id_tarefa, res.id_quadro,
         t.titulo, q.nome, t.prazo, res.mensagem
    from res
    left join public.usuarios u on lower(u.email) = lower(res.destinatario)
    left join public.gestao_tarefas t on t.id_tarefa = res.id_tarefa
    left join public.gestao_quadros q on q.id_quadro = coalesce(res.id_quadro, t.id_quadro);
end $$;

-- ── 12) Permissões ──────────────────────────────────────────────────────────
revoke all on function public.gestao_aviso_email_reservar(integer) from public, anon, authenticated;
grant execute on function public.gestao_aviso_email_reservar(integer) to service_role;
revoke all on function public.gestao_automacao_acao(public.gestao_automacoes, jsonb, public.gestao_tarefas, text, jsonb) from public, anon, authenticated;
revoke all on function public.gestao_automacao_aplicar(public.gestao_automacoes, public.gestao_tarefas, text, jsonb) from public, anon, authenticated;
revoke all on function public.gestao_automacao_ctx(public.gestao_tarefas, jsonb) from public, anon, authenticated;
revoke all on function public.gestao_automacao_texto(text, public.gestao_tarefas, jsonb) from public, anon, authenticated;
-- o motor só roda por gatilho/rotina (SECURITY DEFINER do dono); chamar direto pela API disparava
-- automação em tarefa que a pessoa nem vê.
revoke all on function public.gestao_automacao_run(text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.gestao_automacao_prazos() from public, anon, authenticated;
revoke all on function public.gestao_automacao_trg() from public, anon, authenticated;
revoke all on function public.gestao_automacao_vinculo_trg() from public, anon, authenticated;
revoke all on function public.gestao_automacao_comentario_trg() from public, anon, authenticated;
grant execute on function public.gestao_automacao_run(text, text, text, text, jsonb) to service_role;
grant execute on function public.gestao_automacao_prazos() to service_role;
revoke all on function public.gestao_automacao_historico(text, int) from public, anon;
grant execute on function public.gestao_automacao_historico(text, int) to authenticated, service_role;

notify pgrst, 'reload schema';
