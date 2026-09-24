-- v202_gestao_aprovacoes.rollback.sql
-- Reverte v202: repõe gestao_automacao_aplicar SEM o ramo solicitar_aprovacao (corpo v2/v201
--   VERBATIM), remove o RPC gestao_decidir_aprovacao e a tabela gestao_aprovacoes.
-- ATENÇÃO: só rode se F2.2c (que também estende `aplicar`) ainda NÃO estiver aplicada; caso
--   contrário, reponha o corpo `aplicar` vivo do momento (menos este ramo), não este literal.
-- Nome com "rollback" — migrate.ps1 NÃO aplica isto; execução manual por psql -f (operador).

begin;

-- 1. gestao_automacao_aplicar — corpo v2/v201 VERBATIM, sem o ramo solicitar_aprovacao.
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
$function$;

-- 2. Remove o RPC e a tabela (índices e policy caem junto com a tabela).
drop function if exists public.gestao_decidir_aprovacao(uuid, text, text);
drop table if exists public.gestao_aprovacoes;

-- 3. Baixa do registro de migração (se tiver sido gravado no apply manual).
delete from schema_migrations where version = 'v202_gestao_aprovacoes';

commit;
