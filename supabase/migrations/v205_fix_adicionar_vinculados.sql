-- v205_fix_adicionar_vinculados.sql
-- GESTAO-KANBAN-01-F2-VINCFIX — corrige a ação adicionar_vinculados do motor v2.
-- Bug (introduzido em v201/F2.2a, carregado por v202/v203): o ramo lia v_acao->>'tipo',
--   que é o DISCRIMINADOR da ação ('adicionar_vinculados'), então v_tipo_vinc nunca casava
--   'responsavel'/'seguidor' e a ação SEMPRE logava 'erro' sem vincular ninguém.
-- Fix: ler v_acao->>'vinculo_tipo' (a chave que a UI da F2.2d grava). Uma linha muda.
-- Recria gestao_automacao_aplicar VERBATIM (corpo capturado por pg_get_functiondef do VIVO),
--   trocando SÓ a linha do ramo adicionar_vinculados. Todos os outros ramos idênticos ao vivo.
-- SQL-only. Idempotente (create or replace). NÃO grava schema_migrations (apply manual pelo operador).
-- Após aplicar: reload PostgREST (NOTIFY pgrst, 'reload schema').

begin;

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
$function$;


-- dono explícito (o VIVO é de chabra_admin)
alter function public.gestao_automacao_aplicar(public.gestao_automacoes, public.gestao_tarefas, text) owner to chabra_admin;

commit;
