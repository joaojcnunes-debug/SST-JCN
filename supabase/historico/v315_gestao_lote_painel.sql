-- v315 — Gestão: lote do Painel SST (02/11/2026). Mesmas mudanças das v312 (partes 2–4), v319, v322,
-- v323, v324, v325, v326 e v327 do Painel, adaptadas ao JCN (pg_cron no lugar do worker; sem a
-- "tarefa restrita" v306 nem o usuário oculto v303, que o JCN não tem).
--
-- POR QUÊ: comparativo Painel × JCN de 02/11 — eram as funções da Gestão que faltavam aqui. Antes de
-- trocar cada função, conferimos que o corpo atual do JCN é igual ao "de antes" do Painel (os
-- rollbacks dele): gestao_automacao_acao, gestao_automacao_completa_trg e gestao_automacao_vencimentos
-- iguais (só comentários); gestao_decidir_aprovacao ganha também o coalesce da v287 do Painel.
--
-- O QUE FAZ
--   1) Funcionários por produto (Painel v319 + v322):
--      gestao_produto_responsaveis(id_quadro, usuario_email, produtos[], ordem) — leitura: quem vê o
--      quadro; escrita: quem edita o quadro. A ação criar_subtarefas_modelo aceita responsavel_email
--      e, sem ele, usa o funcionário ligado ao produto neste quadro (gestao_automacao_acao).
--   2) Automação pausada (Painel v323): gestao_automacoes.pausada_em/_por/_avisada; a regra ATIVA
--      que fica incompleta pausa com carimbo e RELIGA sozinha ao completar; pg_cron
--      'gestao-automacoes-pausadas' (5 min) avisa quem pausou depois de 15 min.
--   3) Vencimento (Painel v324): empate de validade na mesma empresa vai para a maior revisão.
--   4) Campos de origem (Painel v325): gestao_campos_de_origem(id_tarefa) — os campos de OUTRO quadro
--      gravados na tarefa (ex.: copiados por "criar tarefa em outro quadro"), só leitura.
--   5) Pessoas do quadro (Painel v326 + v327): gestao_pessoas_do_quadro(id_quadro) — quem tem acesso
--      ao quadro (sem administradores) + a equipe cujo nome bate com o do quadro.
--   6) Subtarefas (Painel v312, partes 2–4): a recusa da aprovação cria a subtarefa "Corrigir a
--      recusa (dd/mm): motivo" para quem pediu; quem vira responsável de subtarefa aberta é avisado
--      (gatilho gestao_aviso_subtarefa); gestao_minhas_tarefas() = vinculado + responsável de
--      subtarefa aberta (Minhas tarefas e Agenda).
--
-- REAPLICAR: idempotente.
-- ROLLBACK: scripts/sql/v315_gestao_lote_painel_rollback.sql

DO $$ BEGIN
  IF to_regprocedure('public.gestao_automacao_regra_completa(text, jsonb, jsonb)') IS NULL
     OR to_regprocedure('public.gestao_resolver_nivel(text, gestao_recurso, text)') IS NULL
     OR to_regprocedure('public.gestao_avisar(text, text, text, text, text, text)') IS NULL THEN
    RAISE EXCEPTION 'falta a base das automações da Gestão (v298–v302)';
  END IF;
END $$;


-- ── 1) Funcionários por produto ─────────────────────────────────────────────────

create table if not exists public.gestao_produto_responsaveis (
  id uuid primary key default gen_random_uuid(),
  id_quadro text not null references public.gestao_quadros(id_quadro) on delete cascade,
  usuario_email text not null,
  produtos text[] not null default '{}',
  ordem integer not null default 0,
  created_by text default lower(coalesce(auth.jwt() ->> 'email', '')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists gestao_produto_responsaveis_quadro_idx on public.gestao_produto_responsaveis (id_quadro);
comment on table public.gestao_produto_responsaveis is
  'v322: funcionário responsável pelas subtarefas de cada produto, por quadro (aba Funcionários por produto das Automações).';

alter table public.gestao_produto_responsaveis enable row level security;
drop policy if exists gestao_produto_responsaveis_sel on public.gestao_produto_responsaveis;
create policy gestao_produto_responsaveis_sel on public.gestao_produto_responsaveis
  for select to authenticated using (public.gestao_pode_ver(id_quadro));
drop policy if exists gestao_produto_responsaveis_wr on public.gestao_produto_responsaveis;
create policy gestao_produto_responsaveis_wr on public.gestao_produto_responsaveis
  for all to authenticated using (public.gestao_pode_editar_q(id_quadro)) with check (public.gestao_pode_editar_q(id_quadro));
grant select, insert, update, delete on public.gestao_produto_responsaveis to authenticated;
revoke all on public.gestao_produto_responsaveis from anon;

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
        -- v319: responsável escolhido na automação (por produto e unidade). Só vale usuário ativo da
        -- equipe; o aviso "você foi atribuído" sai pelo gatilho gestao_aviso_subtarefa (ou aqui, sem ator).
        select lower(u.email) into v_email from public.usuarios u
         where lower(u.email) = lower(btrim(coalesce(v_acao->>'responsavel_email','')))
           and coalesce(u.ativo_sistema, true) and u.perfil <> 'Cliente';
        -- v322: sem responsável na própria ação, vale o "Funcionários por produto" do quadro — o produto
        -- é o valor que a condição da automação procura no campo (ex.: Produtos contém "PGR").
        if v_email is null then
          select lower(u.email) into v_email
            from public.gestao_produto_responsaveis r
            join public.usuarios u on lower(u.email) = lower(r.usuario_email)
           where r.id_quadro = p_tarefa.id_quadro
             and coalesce(u.ativo_sistema, true) and u.perfil <> 'Cliente'
             and exists (select 1
                           from jsonb_array_elements(coalesce(p_autom.condicao->'all', '[]'::jsonb) || coalesce(p_autom.condicao->'any', '[]'::jsonb)) c
                          where c->>'op' = 'contains' and c->>'campo' like 'campo:%' and c->>'valor' = any(r.produtos))
           order by r.ordem, r.created_at
           limit 1;
        end if;
        select coalesce(max(ordem), -1) + 1 into v_ordem from public.gestao_subtarefas where id_tarefa = p_tarefa.id_tarefa;
        for v_item in select value from jsonb_array_elements(coalesce(v_modelo.itens, '[]'::jsonb)) loop
          v_txt := btrim(coalesce(v_item->>'texto',''));
          if v_txt = '' then continue; end if;
          if exists (select 1 from public.gestao_subtarefas where id_tarefa = p_tarefa.id_tarefa and texto = v_txt) then continue; end if;
          insert into public.gestao_subtarefas (id, id_tarefa, texto, ordem, etapa, tipo, responsavel_email)
          values ('SUB-' || upper(substring(replace(gen_random_uuid()::text,'-','') from 1 for 8)), p_tarefa.id_tarefa, v_txt,
                  v_ordem, nullif(v_item->>'etapa',''), nullif(v_item->>'tipo',''), v_email);
          v_ordem := v_ordem + 1; v_ins := v_ins + 1;
        end loop;
        v_det := 'subtarefas do modelo ' || v_modelo.slug || ': ' || v_ins
                 || case when v_email is not null and v_ins > 0 then ' (responsável ' || v_email || ')' else '' end;
        if v_email is not null and v_ins > 0 then
          begin v_e := public.gestao_email(); exception when others then v_e := null; end;
          if v_e is null then
            perform public.gestao_avisar(v_email, 'atribuicao',
              'Você foi atribuído à subtarefa: ' || v_txt || ' (tarefa: ' || p_tarefa.titulo || ')',
              p_tarefa.id_tarefa, p_tarefa.id_quadro, 'automacao');
          end if;
        end if;
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

-- ── 2) Automação pausada volta sozinha e avisa ─────────────────────────────────

alter table public.gestao_automacoes add column if not exists pausada_em timestamptz;
alter table public.gestao_automacoes add column if not exists pausada_por text;
alter table public.gestao_automacoes add column if not exists pausada_avisada boolean not null default false;

comment on column public.gestao_automacoes.pausada_em is
  'v315 (Painel v323): quando a regra ATIVA foi pausada por ficar incompleta; volta sozinha ao ficar completa.';

create or replace function public.gestao_automacao_completa_trg()
returns trigger
language plpgsql
as $function$
declare
  v_completa boolean;
begin
  if (new.acoes is null or jsonb_array_length(new.acoes) = 0) and coalesce(new.acao->>'tipo', '') <> '' then
    new.acoes := jsonb_build_array(new.acao);
  end if;
  new.acoes := coalesce(new.acoes, '[]'::jsonb);
  new.acao := coalesce(new.acoes->0, '{}'::jsonb);
  v_completa := public.gestao_automacao_regra_completa(new.gatilho, coalesce(new.condicao, '{}'::jsonb), new.acoes);

  if new.ativo and not v_completa then
    new.ativo := false;
    -- v323: estava rodando e ficou incompleta → pausa com carimbo (volta sozinha ao completar)
    if tg_op = 'UPDATE' and old.ativo then
      new.pausada_em := now();
      begin new.pausada_por := public.gestao_email(); exception when others then new.pausada_por := null; end;
      new.pausada_avisada := false;
    end if;
  elsif tg_op = 'UPDATE' and new.pausada_em is not null then
    if new.ativo is distinct from old.ativo then
      -- ligou/desligou na mão: a decisão é da pessoa
      new.pausada_em := null; new.pausada_por := null; new.pausada_avisada := false;
    elsif v_completa then
      -- v323: completou de novo → religa sozinha
      new.ativo := true;
      new.pausada_em := null; new.pausada_por := null; new.pausada_avisada := false;
    end if;
  end if;
  return new;
end $function$;

create or replace function public.gestao_automacoes_pausadas_avisar()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  r record;
  v_n int := 0;
begin
  for r in
    select a.id, a.nome, a.id_quadro, a.pausada_por, a.pausada_em, q.nome as quadro
      from public.gestao_automacoes a
      join public.gestao_quadros q on q.id_quadro = a.id_quadro
     where a.pausada_em is not null and not a.pausada_avisada and not a.ativo
       and a.pausada_em < now() - interval '15 minutes'
     order by a.pausada_em
     limit 50
     for update of a skip locked
  loop
    update public.gestao_automacoes set pausada_avisada = true where id = r.id;
    if r.pausada_por is not null then
      perform public.gestao_avisar(
        r.pausada_por, 'automacao_pausada',
        'Automação pausada em ' || r.quadro || ': "' || r.nome || '" ficou incompleta às '
          || to_char(r.pausada_em at time zone 'America/Sao_Paulo', 'HH24:MI')
          || ' e não está rodando. Complete as ações em Configurar › Automações — ela volta sozinha.',
        null, r.id_quadro, null);
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end $function$;

revoke all on function public.gestao_automacoes_pausadas_avisar() from public, anon, authenticated;
grant execute on function public.gestao_automacoes_pausadas_avisar() to service_role;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'gestao-automacoes-pausadas') THEN
    PERFORM cron.unschedule('gestao-automacoes-pausadas');
  END IF;
  PERFORM cron.schedule('gestao-automacoes-pausadas', '*/5 * * * *', 'select public.gestao_automacoes_pausadas_avisar()');
END $$;

-- ── 3) Vencimento: empate de validade ───────────────────────────────────────────

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
         -- só o documento mais recente da empresa (o renovado substitui o antigo). v324: empate de
         -- validade → vale a maior revisão e, depois, a criada por último (senão saíam duas tarefas)
         and not exists (select 1 from public.inspecoes n where n.id_empresa = i.id_empresa and n.status <> 'DELETADA'
                           and n.data_validade is not null
                           and (n.data_validade > i.data_validade
                                or (n.data_validade = i.data_validade
                                    and (coalesce(n.revisao, 0), n.created_at, n.id_inspecao)
                                        > (coalesce(i.revisao, 0), i.created_at, i.id_inspecao))))
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

-- ── 4) Campos de origem ─────────────────────────────────────────────────────────

create or replace function public.gestao_campos_de_origem(p_id_tarefa text)
returns table(id text, nome text, tipo text, quadro text, valor jsonb)
language sql
stable security definer
set search_path to 'public'
as $function$
  select c.id::text, c.nome, c.tipo::text, q.nome, t.campos -> c.id::text
    from public.gestao_tarefas t
    join lateral jsonb_object_keys(coalesce(t.campos, '{}'::jsonb)) k on true
    join public.gestao_campos c on c.id::text = k
    join public.gestao_quadros q on q.id_quadro = c.id_quadro
   where t.id_tarefa = p_id_tarefa
     and c.id_quadro <> t.id_quadro
     and public.gestao_ve_tarefa(p_id_tarefa)
     and jsonb_typeof(t.campos -> c.id::text) <> 'null'
   order by q.nome, c.ordem, c.nome
$function$;

revoke all on function public.gestao_campos_de_origem(text) from public, anon;
grant execute on function public.gestao_campos_de_origem(text) to authenticated;

-- ── 5) Pessoas do quadro ────────────────────────────────────────────────────────

create or replace function public.gestao_pessoas_do_quadro(p_id_quadro text)
returns table(email text, nome text, nivel gestao_nivel)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_nome text;
begin
  if not coalesce(public.gestao_pode_ver(p_id_quadro), false) then
    raise exception 'sem acesso a este quadro' using errcode = '42501';
  end if;
  select lower(q.nome) into v_nome from public.gestao_quadros q where q.id_quadro = p_id_quadro;
  return query
  with da_equipe as (
    -- equipe da base: o nome de um contém o do outro ("Campos" ↔ "Campos dos Goytacazes")
    select distinct lower(em.usuario_email) as email
      from public.gestao_equipes e
      join public.gestao_equipe_membros em on em.id_equipe = e.id
     where e.ativo and v_nome is not null
       and (position(v_nome in lower(e.nome)) > 0 or position(lower(e.nome) in v_nome) > 0)
  )
  select lower(u.email)::text, u.nome::text, n.nivel
    from public.usuarios u
    cross join lateral (select public.gestao_resolver_nivel(u.email, 'list', p_id_quadro) as nivel) n
   where coalesce(u.ativo_sistema, true)
     and u.perfil is distinct from 'Cliente'
     and (lower(u.email) in (select d.email from da_equipe d)
          or (n.nivel is not null
              and coalesce(public.gestao_papel_de(u.email)::text, '') not in ('owner', 'admin')))
   order by u.nome;
end $function$;

revoke all on function public.gestao_pessoas_do_quadro(text) from public, anon;
grant execute on function public.gestao_pessoas_do_quadro(text) to authenticated;

-- ── 6) Subtarefas: recusa vira correção, aviso ao responsável, Minhas tarefas ───

create index if not exists idx_gestao_subtarefas_resp on public.gestao_subtarefas (lower(responsavel_email))
  where responsavel_email is not null;

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
  v_motivo    text := nullif(btrim(coalesce(p_motivo, '')), '');
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
         motivo      = v_motivo,
         decidido_em = now()
   where id = p_id;

  if p_decisao = 'aprovada' then
    perform public.gestao_automacao_run(v_row.id_tarefa, 'tarefa_aprovada', null, null);
  elsif p_decisao = 'rejeitada' then
    -- v312: pendência de correção ANTES da esteira voltar a tarefa p/ Elaboração — senão a "9b"
    -- (Elaboração já completa) devolve na hora para Aguardando Aprovação. Fica com quem pediu a aprovação.
    insert into public.gestao_subtarefas (id, id_tarefa, texto, ordem, responsavel_email)
    values (
      'SUB-' || upper(substring(replace(gen_random_uuid()::text,'-','') from 1 for 8)),
      v_row.id_tarefa,
      left('Corrigir a recusa (' || to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM') || ')'
           || coalesce(': ' || v_motivo, ''), 500),
      (select coalesce(max(ordem), -1) + 1 from public.gestao_subtarefas where id_tarefa = v_row.id_tarefa),
      case when position('@' in coalesce(v_row.solicitado_por, '')) > 0 then lower(v_row.solicitado_por) end
    );
    -- GE3: recusa dispara tarefa_rejeitada (esteira volta a tarefa p/ Elaboracao/rework)
    perform public.gestao_automacao_run(v_row.id_tarefa, 'tarefa_rejeitada', null, null);
  end if;
end $function$;

create or replace function public.gestao_aviso_subtarefa_trg()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
DECLARE v_t record; v_ator text;
BEGIN
  IF coalesce(current_setting('gestao.sync_sub', true), '') = 'on' THEN RETURN null; END IF;
  -- auth.jwt() quebra com request.jwt.claims vazio (conexão que já teve claims locais): sem ator, sem aviso,
  -- e nunca impede gravar a subtarefa.
  BEGIN v_ator := public.gestao_email(); EXCEPTION WHEN others THEN v_ator := null; END;
  IF v_ator IS NULL THEN RETURN null; END IF;
  IF new.responsavel_email IS NULL OR new.feito THEN RETURN null; END IF;
  IF tg_op = 'UPDATE' AND lower(old.responsavel_email) IS NOT DISTINCT FROM lower(new.responsavel_email) THEN RETURN null; END IF;
  SELECT titulo, id_quadro INTO v_t FROM public.gestao_tarefas WHERE id_tarefa = new.id_tarefa;
  IF NOT FOUND THEN RETURN null; END IF;
  PERFORM public.gestao_avisar(
    new.responsavel_email, 'atribuicao',
    'Você foi atribuído à subtarefa: ' || new.texto || ' (tarefa: ' || v_t.titulo || ')',
    new.id_tarefa, v_t.id_quadro, v_ator);
  RETURN null;
END $function$;

revoke all on function public.gestao_aviso_subtarefa_trg() from public, anon, authenticated;

drop trigger if exists gestao_aviso_subtarefa on public.gestao_subtarefas;
create trigger gestao_aviso_subtarefa
  after insert or update of responsavel_email on public.gestao_subtarefas
  for each row execute function public.gestao_aviso_subtarefa_trg();

create or replace function public.gestao_minhas_tarefas()
 returns setof public.gestao_tarefas language sql stable security definer set search_path to 'public'
as $function$
  with eu as (select public.gestao_email() as email),
  cand as (
    select v.id_tarefa from public.gestao_tarefa_vinculados v, eu where lower(v.usuario_email) = eu.email
    union
    select s.id_tarefa from public.gestao_subtarefas s, eu where lower(s.responsavel_email) = eu.email and not s.feito
  )
  select t.* from public.gestao_tarefas t join cand c on c.id_tarefa = t.id_tarefa
   where coalesce(public.gestao_pode_ver(t.id_quadro) and public.gestao_ve_tarefa(t.id_tarefa), false);
$function$;

revoke all on function public.gestao_minhas_tarefas() from public, anon;
grant execute on function public.gestao_minhas_tarefas() to authenticated, service_role;

NOTIFY pgrst, 'reload schema';
