-- Rollback da v315 (lote da Gestão vindo do Painel). Rodar DEPOIS de voltar o código (0.3.191).
-- Volta gestao_automacao_acao, gestao_automacao_completa_trg, gestao_automacao_vencimentos e
-- gestao_decidir_aprovacao ao corpo de antes e apaga o que a v315 criou.
-- APAGA a tabela gestao_produto_responsaveis (Funcionários por produto) e as colunas pausada_*.

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'gestao-automacoes-pausadas') THEN
    PERFORM cron.unschedule('gestao-automacoes-pausadas');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.gestao_automacao_acao(p_autom gestao_automacoes, p_acao jsonb, p_tarefa gestao_tarefas, p_gatilho text, p_ctx jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    -- v302 (= painel v313): etapa escolhida, responsáveis da nova, '@unidade' = quadro da unidade da
    -- tarefa; copiar_campos leva também a descrição.
    elsif v_tipo = 'criar_tarefa_quadro' and coalesce(v_acao->>'id_quadro_destino','') <> '' then
      v_copiar := coalesce(v_acao->>'copiar_campos','') in ('true','1');
      v_quadro := v_acao->>'id_quadro_destino';
      if v_quadro = '@unidade' then
        select q.id_quadro into v_quadro
          from public.gestao_quadros q
         where q.dono_email is null
           and q.id_unidade = coalesce(p_tarefa.id_unidade, public.gestao_unidade_de_etiquetas(p_tarefa.etiquetas))
         order by q.ordem limit 1;
      end if;
      if v_quadro is null then
        v_res := 'skip'; v_det := 'tarefa sem unidade (etiqueta da cidade) para achar o quadro';
      else
        select slug into v_dest_status from public.gestao_status
         where id_quadro = v_quadro and slug = nullif(v_acao->>'status_destino','');
        if v_dest_status is null then
          select slug into v_dest_status from public.gestao_status where id_quadro = v_quadro order by ordem limit 1;
        end if;
        v_new_id := 'TRF-' || upper(substring(replace(gen_random_uuid()::text,'-','') from 1 for 8));
        v_titulo := public.gestao_automacao_texto(coalesce(nullif(v_acao->>'titulo_template',''), p_tarefa.titulo), p_tarefa, p_ctx);
        insert into public.gestao_tarefas (id_tarefa, id_quadro, titulo, descricao, status, prioridade, etiquetas, campos, created_by)
        values (v_new_id, v_quadro, v_titulo,
                case when v_copiar then p_tarefa.descricao end,
                coalesce(v_dest_status, 'A_FAZER'),
                case when v_copiar then p_tarefa.prioridade else 'Media' end,
                case when v_copiar then p_tarefa.etiquetas else '{}'::text[] end,
                case when v_copiar then p_tarefa.campos else '{}'::jsonb end,
                'automacao');
        for v_e in select lower(x) from jsonb_array_elements_text(coalesce(v_acao->'emails','[]'::jsonb)) x loop
          if v_e is null or v_e = '' or position('@' in v_e) = 0 then continue; end if;
          insert into public.gestao_tarefa_vinculados (id, id_tarefa, usuario_email, tipo, origem)
          values (gen_random_uuid(), v_new_id, v_e, 'responsavel', 'automacao')
          on conflict (id_tarefa, usuario_email, tipo) do nothing;
        end loop;
        v_det := 'tarefa criada: ' || v_new_id || ' em ' || v_quadro || '/' || coalesce(v_dest_status, 'A_FAZER');
      end if;
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
end $function$;

create or replace function public.gestao_automacao_completa_trg()
returns trigger
language plpgsql
as $function$
begin
  if (new.acoes is null or jsonb_array_length(new.acoes) = 0) and coalesce(new.acao->>'tipo', '') <> '' then
    new.acoes := jsonb_build_array(new.acao);
  end if;
  new.acoes := coalesce(new.acoes, '[]'::jsonb);
  new.acao := coalesce(new.acoes->0, '{}'::jsonb);
  if new.ativo and not public.gestao_automacao_regra_completa(new.gatilho, coalesce(new.condicao, '{}'::jsonb), new.acoes) then
    new.ativo := false;
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.gestao_automacao_vencimentos()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  a public.gestao_automacoes; r record; v_ctx jsonb; v_n int := 0; v_dias int;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  for a in select * from public.gestao_automacoes where ativo and gatilho = 'sst_vencimento' order by ordem loop
    v_dias := coalesce(nullif(a.condicao->>'dias_antes', '')::int, 30);
    for r in
      select 'documento'::text as fonte, i.id_inspecao as id_item, i.id_inspecao, i.data_validade as validade,
             'Documento da inspeção ' || i.id_inspecao as item
        from public.inspecoes i
       where a.condicao->>'fonte' = 'documento' and i.status <> 'DELETADA' and i.data_validade is not null
         and i.data_validade between v_hoje and v_hoje + v_dias
         -- só o documento mais recente da empresa (o renovado substitui o antigo)
         and not exists (select 1 from public.inspecoes n where n.id_empresa = i.id_empresa and n.status <> 'DELETADA'
                           and n.data_validade > i.data_validade)
      union all
      select 'extintor', x.id_extintor, x.id_inspecao, x.data_validade,
             concat_ws(' ', 'Extintor', nullif(x.tipo_agente, ''), nullif(x.capacidade, ''),
                       case when coalesce(x.numero_identificacao, '') <> '' then 'nº ' || x.numero_identificacao end,
                       case when coalesce(x.localizacao, '') <> '' then '(' || x.localizacao || ')' end)
        from public.extintores x
       where a.condicao->>'fonte' = 'extintor' and coalesce(x.ativo, true) and x.data_validade is not null
         and x.data_validade between v_hoje and v_hoje + v_dias
      limit 500
    loop
      v_ctx := coalesce(public.gestao_sst_ctx_inspecao(r.id_inspecao), '{}'::jsonb);
      v_ctx := v_ctx || jsonb_build_object('fonte', r.fonte,
        'vars', coalesce(v_ctx->'vars', '{}'::jsonb) || jsonb_build_object(
                  'validade', public.gestao_data_br(r.validade),
                  'dias_para_vencer', (r.validade - v_hoje)::text,
                  'item', r.item),
        'origem_extra', coalesce(v_ctx->'origem_extra', '{}'::jsonb) || jsonb_build_object('fonte', r.fonte, 'id_item', r.id_item));
      v_n := v_n + public.gestao_automacao_evento_sst('sst_vencimento', v_ctx, 'venc:' || r.fonte || ':' || r.id_item || ':' || r.validade);
    end loop;
  end loop;
  return v_n;
end $function$;

CREATE OR REPLACE FUNCTION public.gestao_decidir_aprovacao(p_id uuid, p_decisao text, p_motivo text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_ator      text := public.gestao_email();
  v_row       public.gestao_aprovacoes;
  v_quadro    text;
  v_eh_gestor boolean;
begin
  if v_ator is null then raise exception 'nao autenticado'; end if;
  if p_decisao not in ('aprovada','rejeitada') then raise exception 'decisao invalida: %', p_decisao; end if;

  select * into v_row from public.gestao_aprovacoes where id = p_id;
  if v_row.id is null then raise exception 'aprovacao inexistente: %', p_id; end if;
  if v_row.status <> 'pendente' then raise exception 'aprovacao ja decidida'; end if;

  v_quadro := (select id_quadro from public.gestao_tarefas where id_tarefa = v_row.id_tarefa);

  -- Autoriza: aprovador designado OU gestor (owner/admin OU edicao no quadro-pai).
  -- v287: coalesce -- nao-membro tem gestao_papel_de() NULL, o que deixava v_eh_gestor NULL e o IF inerte.
  v_eh_gestor := coalesce(public.gestao_papel_de(v_ator) in ('owner','admin'), false)
              or coalesce(v_quadro is not null and public.gestao_pode_editar_q(v_quadro), false);
  if not v_eh_gestor and lower(coalesce(v_row.aprovador_email, '')) <> lower(v_ator) then
    raise exception 'voce nao pode decidir esta aprovacao';
  end if;

  update public.gestao_aprovacoes
     set status      = p_decisao,
         motivo      = nullif(btrim(coalesce(p_motivo, '')), ''),
         decidido_em = now()
   where id = p_id;

  if p_decisao = 'aprovada' then
    perform public.gestao_automacao_run(v_row.id_tarefa, 'tarefa_aprovada', null, null);
  elsif p_decisao = 'rejeitada' then
    -- GE3: recusa dispara tarefa_rejeitada (esteira volta a tarefa p/ Elaboracao/rework)
    perform public.gestao_automacao_run(v_row.id_tarefa, 'tarefa_rejeitada', null, null);
  end if;
end $function$;

drop trigger if exists gestao_aviso_subtarefa on public.gestao_subtarefas;
drop function if exists public.gestao_aviso_subtarefa_trg();
drop function if exists public.gestao_minhas_tarefas();
drop function if exists public.gestao_pessoas_do_quadro(text);
drop function if exists public.gestao_campos_de_origem(text);
drop function if exists public.gestao_automacoes_pausadas_avisar();
drop index if exists public.idx_gestao_subtarefas_resp;
alter table public.gestao_automacoes drop column if exists pausada_avisada;
alter table public.gestao_automacoes drop column if exists pausada_por;
alter table public.gestao_automacoes drop column if exists pausada_em;
drop table if exists public.gestao_produto_responsaveis;
delete from public.auditoria_tabelas where tabela = 'gestao_produto_responsaveis';

NOTIFY pgrst, 'reload schema';
