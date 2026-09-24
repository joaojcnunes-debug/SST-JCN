-- v201_gestao_automacoes_v2_nucleo.sql
-- GESTAO-KANBAN-01-F2.2a — núcleo do motor de automações v2.
-- Estende o motor v120 (funções lidas verbatim via pg_get_functiondef) com REGRESSÃO ZERO:
--   1. Condição E/OU  ({all:[...], any:[...]}) — função gestao_automacao_cond_bate + helper.
--   2. Gatilhos novos: tarefa_movida_quadro (id_quadro muda) e subtarefa_concluida.
--   3. Guarda por PROFUNDIDADE (GUC gestao.autom_depth, teto 3) no lugar do booleano gestao.in_automacao.
--   4. Ações novas em aplicar: adicionar_vinculados, mover_tarefa_quadro, criar_tarefa_quadro, notificar-todos.
-- SQL-only. Idempotente. NÃO grava schema_migrations (apply manual pelo operador).
-- Segurança: funções SECURITY DEFINER com search_path='public' fixo; zero SQL dinâmico (sem EXECUTE);
--   valores de acao/condicao entram sempre como VALOR parametrizado, nunca como identificador.

begin;

-- ============================================================================
-- 1. Coluna de profundidade no log (idempotente)
-- ============================================================================
alter table public.gestao_automacao_log
  add column if not exists profundidade int not null default 0;

-- ============================================================================
-- 2. Avaliador de UMA cláusula {campo, op, valor} contra o contexto (p_ctx)
--    Campos: status, status_de, status_para, prioridade, quadro, etiqueta, campo:<id>
--    Ops: '=', '!=', 'in', 'contains'
-- ============================================================================
create or replace function public.gestao_automacao_cond_teste(p_clause jsonb, p_ctx jsonb)
  returns boolean
  language plpgsql
  stable
  security definer
  set search_path to 'public'
as $fn$
declare
  f    text  := p_clause->>'campo';
  op   text  := lower(coalesce(p_clause->>'op', '='));
  val  jsonb := p_clause->'valor';
  val_txt text := case
                    when val is null then null
                    when jsonb_typeof(val) = 'string' then val #>> '{}'
                    else val::text
                  end;
  fval text;         -- valor escalar do campo (texto)
  farr jsonb := null; -- valor de array (etiquetas)
begin
  if f is null then
    return false;
  elsif f = 'etiqueta' then
    farr := coalesce(p_ctx->'etiquetas', '[]'::jsonb);
  elsif f like 'campo:%' then
    fval := p_ctx->'campos'->>substring(f from 7);
  elsif f in ('status', 'status_de', 'status_para', 'prioridade', 'quadro') then
    fval := p_ctx->>f;
  else
    return false;  -- campo desconhecido nunca casa
  end if;

  -- campo de array (etiqueta): membership / interseção
  if farr is not null then
    if op in ('=', 'contains') then
      if jsonb_typeof(val) = 'array' then
        return farr @> val;                              -- contém TODAS as listadas
      else
        return farr ? coalesce(val_txt, '');             -- contém a etiqueta
      end if;
    elsif op = 'in' then
      if jsonb_typeof(val) = 'array' then
        return exists (select 1 from jsonb_array_elements_text(val) e where farr ? e);
      else
        return farr ? coalesce(val_txt, '');
      end if;
    elsif op = '!=' then
      return not (farr ? coalesce(val_txt, ''));
    end if;
    return false;
  end if;

  -- campo escalar
  if op = '=' then
    return fval is not distinct from val_txt;
  elsif op = '!=' then
    return fval is distinct from val_txt;
  elsif op = 'in' then
    if jsonb_typeof(val) = 'array' then
      return exists (select 1 from jsonb_array_elements_text(val) e where e = fval);
    else
      return fval = val_txt;
    end if;
  elsif op = 'contains' then
    return fval is not null and val_txt is not null and position(val_txt in fval) > 0;
  end if;
  return false;
end
$fn$;

-- ============================================================================
-- 3. Avaliador da condição composta {all:[...], any:[...]}
--    all -> TODAS verdadeiras; any -> AO MENOS UMA verdadeira; ambos -> all AND any.
-- ============================================================================
create or replace function public.gestao_automacao_cond_bate(p_cond jsonb, p_ctx jsonb)
  returns boolean
  language plpgsql
  stable
  security definer
  set search_path to 'public'
as $fn$
declare
  c        jsonb;
  v_all    boolean := true;
  v_any    boolean := false;
  has_any  boolean := false;
begin
  if p_cond is null then
    return true;
  end if;

  if p_cond ? 'all' then
    for c in select * from jsonb_array_elements(coalesce(p_cond->'all', '[]'::jsonb)) loop
      if not public.gestao_automacao_cond_teste(c, p_ctx) then
        v_all := false;
      end if;
    end loop;
  end if;

  if p_cond ? 'any' then
    has_any := true;
    for c in select * from jsonb_array_elements(coalesce(p_cond->'any', '[]'::jsonb)) loop
      if public.gestao_automacao_cond_teste(c, p_ctx) then
        v_any := true;
      end if;
    end loop;
    -- 'any' vazio => nenhuma cláusula => não casa
  end if;

  if has_any then
    return v_all and v_any;
  end if;
  return v_all;
end
$fn$;

-- ============================================================================
-- 4. gestao_automacao_aplicar — corpo v120 verbatim ESTENDIDO
--    (mesma assinatura; log ganha profundidade lida do GUC; 4 ações novas).
-- ============================================================================
create or replace function public.gestao_automacao_aplicar(p_autom gestao_automacoes, p_tarefa gestao_tarefas, p_gatilho text)
  returns void
  language plpgsql
  security definer
  set search_path to 'public'
as $fn$
declare
  v_acao jsonb := coalesce(p_autom.acao, '{}'::jsonb);
  v_tipo text := v_acao->>'tipo';
  v_email text; v_res text := 'ok'; v_det text := null;
  -- extensões F2.2a
  v_sent int := 0; v_cand int := 0; v_ins int := 0;
  v_e text; v_tipo_vinc text; v_new_id text; v_dest_status text; v_titulo text; v_copiar boolean;
begin
  begin
    if v_tipo = 'mover_status' and coalesce(v_acao->>'valor','') <> '' then
      update public.gestao_tarefas set status = v_acao->>'valor', updated_at = now() where id_tarefa = p_tarefa.id_tarefa;
    elsif v_tipo = 'definir_responsavel' then
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
      v_tipo_vinc := coalesce(nullif(v_acao->>'tipo',''), 'seguidor');
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

    else
      v_res := 'skip'; v_det := 'ação não reconhecida: ' || coalesce(v_tipo,'(vazia)');
    end if;
  exception when others then
    v_res := 'erro'; v_det := left(SQLERRM, 300);
  end;

  insert into public.gestao_automacao_log (id_automacao, id_tarefa, gatilho, resultado, detalhe, profundidade)
    values (p_autom.id, p_tarefa.id_tarefa, p_gatilho, v_res, v_det,
            coalesce(current_setting('gestao.autom_depth', true), '0')::int);
end
$fn$;

-- ============================================================================
-- 5. gestao_automacao_run — corpo v120 verbatim ESTENDIDO
--    Assinatura ganha p_ctx jsonb (default '{}') p/ contexto de subtarefa etc.
--    Guarda por profundidade (GUC gestao.autom_depth, teto 3) no lugar do booleano.
--    Condição E/OU quando condicao tem all/any; senão caminho plano legado.
-- ============================================================================
drop function if exists public.gestao_automacao_run(text, text, text, text);

create or replace function public.gestao_automacao_run(
    p_id_tarefa text, p_gatilho text, p_de text, p_para text, p_ctx jsonb default '{}'::jsonb
  )
  returns void
  language plpgsql
  security definer
  set search_path to 'public'
as $fn$
declare
  v_tarefa public.gestao_tarefas;
  a public.gestao_automacoes;
  v_depth int;
  v_ctx jsonb;
  v_match boolean;
begin
  select * into v_tarefa from public.gestao_tarefas where id_tarefa = p_id_tarefa;
  if not found then return; end if;

  -- guarda por profundidade: teto 3 (evita loop infinito nas cadeias criar/mover)
  v_depth := coalesce(current_setting('gestao.autom_depth', true), '0')::int;
  if v_depth >= 3 then
    insert into public.gestao_automacao_log (id_tarefa, gatilho, resultado, detalhe, profundidade)
      values (p_id_tarefa, p_gatilho, 'skip', 'profundidade', v_depth);
    return;
  end if;
  perform set_config('gestao.autom_depth', (v_depth + 1)::text, true);

  -- contexto p/ cond_bate (merge com o p_ctx do gatilho, ex.: dados da subtarefa)
  v_ctx := coalesce(p_ctx, '{}'::jsonb) || jsonb_build_object(
    'status',      v_tarefa.status,
    'status_de',   p_de,
    'status_para', p_para,
    'prioridade',  v_tarefa.prioridade,
    'quadro',      v_tarefa.id_quadro,
    'etiquetas',   to_jsonb(coalesce(v_tarefa.etiquetas, '{}'::text[])),
    'campos',      coalesce(v_tarefa.campos, '{}'::jsonb)
  );

  for a in
    select * from public.gestao_automacoes
    where id_quadro = v_tarefa.id_quadro and ativo and gatilho = p_gatilho
    order by ordem
  loop
    if (a.condicao ? 'all') or (a.condicao ? 'any') then
      v_match := public.gestao_automacao_cond_bate(a.condicao, v_ctx);
    else
      -- caminho PLANO legado (regressão zero)
      v_match := true;
      if p_gatilho = 'status_muda' then
        if (a.condicao->>'de')   is not null and a.condicao->>'de'   <> coalesce(p_de,'')   then v_match := false; end if;
        if (a.condicao->>'para') is not null and a.condicao->>'para' <> coalesce(p_para,'') then v_match := false; end if;
      end if;
    end if;
    if not v_match then continue; end if;

    perform public.gestao_automacao_aplicar(a, v_tarefa, p_gatilho);
    select * into v_tarefa from public.gestao_tarefas where id_tarefa = p_id_tarefa;  -- reflete mudanças
    if not found then exit; end if;  -- tarefa pode ter sido movida/removida
    v_ctx := v_ctx || jsonb_build_object(
      'status',     v_tarefa.status,
      'prioridade', v_tarefa.prioridade,
      'quadro',     v_tarefa.id_quadro,
      'etiquetas',  to_jsonb(coalesce(v_tarefa.etiquetas, '{}'::text[])),
      'campos',     coalesce(v_tarefa.campos, '{}'::jsonb)
    );
  end loop;

  perform set_config('gestao.autom_depth', v_depth::text, true);  -- decrementa
exception when others then
  -- exception-safe: nunca derruba o save; restaura a profundidade e loga
  perform set_config('gestao.autom_depth', coalesce(v_depth, 0)::text, true);
  insert into public.gestao_automacao_log (id_tarefa, gatilho, resultado, detalhe, profundidade)
    values (p_id_tarefa, p_gatilho, 'erro', left(SQLERRM, 300), coalesce(v_depth, 0));
end
$fn$;

-- ============================================================================
-- 6. gestao_automacao_trg — corpo v120 verbatim ESTENDIDO
--    Sem o booleano in_automacao (recursão agora é permitida e limitada por profundidade).
--    UPDATE: dispara tarefa_movida_quadro (quadro muda) e status_muda (status muda).
-- ============================================================================
create or replace function public.gestao_automacao_trg()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
as $fn$
begin
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
    end if;
  exception when others then
    perform set_config('gestao.autom_depth', '0', true);
    insert into public.gestao_automacao_log (id_tarefa, gatilho, resultado, detalhe)
      values (new.id_tarefa, tg_op, 'erro', left(SQLERRM, 300));  -- nunca falha o save do usuário
  end;
  return null;
end
$fn$;

-- WHEN ampliado p/ cobrir movimentação de quadro (era só status)
drop trigger if exists trg_gestao_automacao_upd on public.gestao_tarefas;
create trigger trg_gestao_automacao_upd
  after update on public.gestao_tarefas
  for each row
  when (old.status is distinct from new.status or old.id_quadro is distinct from new.id_quadro)
  execute function public.gestao_automacao_trg();

-- ============================================================================
-- 7. Gatilho novo: subtarefa_concluida (independente do espelho da F2.1)
-- ============================================================================
create or replace function public.gestao_subtarefa_autom_trg()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
as $fn$
begin
  begin
    perform public.gestao_automacao_run(
      new.id_tarefa, 'subtarefa_concluida', null, null,
      jsonb_build_object(
        'subtarefa_id',    new.id,
        'subtarefa_texto', new.texto,
        'subtarefa_tipo',  new.tipo,
        'subtarefa_etapa', new.etapa
      )
    );
  exception when others then
    perform set_config('gestao.autom_depth', '0', true);
    insert into public.gestao_automacao_log (id_tarefa, gatilho, resultado, detalhe)
      values (new.id_tarefa, 'subtarefa_concluida', 'erro', left(SQLERRM, 300));
  end;
  return null;
end
$fn$;

drop trigger if exists gestao_subtarefa_autom_trg on public.gestao_subtarefas;
create trigger gestao_subtarefa_autom_trg
  after update on public.gestao_subtarefas
  for each row
  when (new.feito is true and old.feito is distinct from new.feito)
  execute function public.gestao_subtarefa_autom_trg();

-- ============================================================================
-- 8. gestao_automacao_prazos — corpo v120 verbatim ESTENDIDO
--    Booleano in_automacao -> profundidade; exception-safe restaura a profundidade.
-- ============================================================================
create or replace function public.gestao_automacao_prazos()
  returns void
  language plpgsql
  security definer
  set search_path to 'public'
as $fn$
declare a public.gestao_automacoes; t public.gestao_tarefas; v_dias int; v_depth int;
begin
  v_depth := coalesce(current_setting('gestao.autom_depth', true), '0')::int;
  perform set_config('gestao.autom_depth', (v_depth + 1)::text, true);
  for a in
    select * from public.gestao_automacoes
    where ativo and gatilho in ('prazo_proximo','prazo_vencido')
    order by ordem
  loop
    v_dias := coalesce((a.condicao->>'dias_antes')::int, 3);
    for t in
      select tk.* from public.gestao_tarefas tk
      left join public.gestao_status s on s.id_quadro = tk.id_quadro and s.slug = tk.status
      where tk.id_quadro = a.id_quadro
        and tk.prazo is not null
        and coalesce(s.tipo, 'ativo') <> 'concluido'
        and (
          (a.gatilho = 'prazo_proximo' and current_date >= (tk.prazo - v_dias) and current_date <= tk.prazo)
          or (a.gatilho = 'prazo_vencido' and tk.prazo < current_date)
        )
        -- dedup: cada automação dispara uma vez por tarefa
        and not exists (
          select 1 from public.gestao_automacao_log l
          where l.id_automacao = a.id and l.id_tarefa = tk.id_tarefa and l.gatilho = a.gatilho and l.resultado <> 'erro'
        )
    loop
      perform public.gestao_automacao_aplicar(a, t, a.gatilho);
    end loop;
  end loop;
  perform set_config('gestao.autom_depth', v_depth::text, true);
exception when others then
  perform set_config('gestao.autom_depth', coalesce(v_depth, 0)::text, true);
end
$fn$;

commit;
