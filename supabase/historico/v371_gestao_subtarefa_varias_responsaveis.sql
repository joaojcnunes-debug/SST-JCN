-- v371 — Gestão: automação cria subtarefa com VÁRIAS responsáveis (26/11/2026, 0.3.323). Vem da v394 do Painel (0.3.1023).
--
-- POR QUÊ: no Painel, pedido de "deixar quantas pessoas forem necessárias" na subtarefa criada pela automação (ex.:
-- "Agendar Visita" de Teresópolis, que no Runrun vai para duas pessoas). O motor só aceitava UM responsável.
--
-- COMO FICA (criar_subtarefas_modelo e, no JCN, também criar_subtarefas_produtos da v367):
--   * chave nova na ação: responsaveis_emails [e-mails]. A tela grava a lista e repete a 1ª em responsavel_email;
--   * a 1ª pessoa válida (ativa, não Cliente) vai no responsável da LINHA, como antes;
--   * com 2 ou mais, a subtarefa ganha a "janela" (tarefa filha, v300) e TODAS entram como responsáveis dela — o mesmo
--     caminho de alocar a 2ª pessoa na tela, então Alocados, "Minhas" e o acesso ao cartão já tratam;
--   * da 2ª pessoa em diante recebem o aviso "Você foi atribuído à subtarefa".
-- Regras antigas (só responsavel_email, ou ninguém → "Funcionários por produto"): exatamente como antes.
-- O JCN não tem a ação criar_subtarefa (v387 do Painel); no lugar dela, os 2 trechos da criar_subtarefas_produtos.
--
-- TÉCNICA: o corpo de gestao_automacao_acao não é recopiado; troca 5 trechos exatos (cada um tem de aparecer 1 vez,
-- senão para tudo). Reaplicar não muda (já trocada → aviso).
-- ENSAIO (26/11/2026): modelo com 2 → 2 vínculos na janela; produtos com 3 → 6 vínculos (2 subtarefas); produtos com 1
-- → sem janela; reaplicar = mesmo md5; rollback devolve a função idêntica (md5) e tira as 2 funções.
-- Rollback: scripts/sql/v371_gestao_subtarefa_varias_responsaveis_rollback.sql.

begin;

-- 1ª responsável e demais: responsaveis_emails (na ordem) e, se vazio, responsavel_email. Só usuário ativo, não Cliente.
create or replace function public.gestao_automacao_resp_lista(p_acao jsonb) returns text[]
  language sql stable security definer set search_path = public as $fn$
  select coalesce(array_agg(e order by ord), '{}')
    from (
      select distinct on (lower(btrim(x.e))) lower(btrim(x.e)) as e, x.ord
        from (
          select v.e, v.ord from jsonb_array_elements_text(
                   case when jsonb_typeof(p_acao->'responsaveis_emails') = 'array' then p_acao->'responsaveis_emails' else '[]'::jsonb end
                 ) with ordinality as v(e, ord)
          union all
          select p_acao->>'responsavel_email', 100000
           where coalesce(jsonb_array_length(case when jsonb_typeof(p_acao->'responsaveis_emails') = 'array'
                                                  then p_acao->'responsaveis_emails' end), 0) = 0
        ) x
       where coalesce(btrim(x.e), '') <> ''
         and exists (select 1 from public.usuarios u
                      where lower(u.email) = lower(btrim(x.e)) and coalesce(u.ativo_sistema, true) and u.perfil <> 'Cliente')
       order by lower(btrim(x.e)), x.ord
    ) d
$fn$;
revoke all on function public.gestao_automacao_resp_lista(jsonb) from public, anon;
grant execute on function public.gestao_automacao_resp_lista(jsonb) to authenticated, service_role;

-- Com 2+ responsáveis: abre a janela da subtarefa (se ainda não tem) e põe TODAS como responsáveis dela; avisa da 2ª
-- em diante. Devolve quantas pessoas ficaram na janela (0 = nada a fazer: 1 responsável ou nenhuma).
create or replace function public.gestao_automacao_sub_varias(p_sub text, p_acao jsonb, p_tarefa gestao_tarefas, p_txt text)
  returns int language plpgsql security definer set search_path = public as $fn$
declare v_lista text[] := public.gestao_automacao_resp_lista(p_acao); s record; v_filha text; i int;
begin
  if coalesce(array_length(v_lista, 1), 0) < 2 then return 0; end if;
  select * into s from public.gestao_subtarefas where id = p_sub;
  if not found then return 0; end if;
  perform set_config('gestao.sync_sub', 'on', true);
  v_filha := s.id_tarefa_filha;
  if v_filha is null then
    v_filha := 'TRF-' || upper(substr(md5(gen_random_uuid()::text), 1, 8));
    insert into public.gestao_tarefas (id_tarefa, id_quadro, titulo, status, prazo, data_inicio, id_tarefa_pai, id_unidade,
                                       created_by, created_at, updated_at)
    values (v_filha, p_tarefa.id_quadro, s.texto, public.gestao_status_para_feito(p_tarefa.id_quadro, s.feito),
            (s.entrega_desejada at time zone 'America/Sao_Paulo')::date, (s.inicio_desejado at time zone 'America/Sao_Paulo')::date,
            p_tarefa.id_tarefa, p_tarefa.id_unidade, 'automacao', now(), now());
    update public.gestao_subtarefas set id_tarefa_filha = v_filha where id = s.id;
  end if;
  -- na ordem: a 1ª primeiro (o espelho janela → linha usa a 1ª responsável)
  for i in 1 .. array_length(v_lista, 1) loop
    insert into public.gestao_tarefa_vinculados (id_tarefa, usuario_email, tipo, origem)
    values (v_filha, v_lista[i], 'responsavel', 'subtarefa') on conflict do nothing;
  end loop;
  perform set_config('gestao.sync_sub', '', true);
  for i in 2 .. array_length(v_lista, 1) loop
    perform public.gestao_avisar(v_lista[i], 'atribuicao',
      'Você foi atribuído à subtarefa: ' || coalesce(p_txt, s.texto) || ' (tarefa: ' || p_tarefa.titulo || ')',
      p_tarefa.id_tarefa, p_tarefa.id_quadro, 'automacao');
  end loop;
  return array_length(v_lista, 1);
end $fn$;
revoke all on function public.gestao_automacao_sub_varias(text, jsonb, gestao_tarefas, text) from public, anon;
grant execute on function public.gestao_automacao_sub_varias(text, jsonb, gestao_tarefas, text) to service_role;

-- Troca os trechos do corpo atual de gestao_automacao_acao (cada um tem de aparecer UMA vez; reaplicar não muda nada).
do $$
declare
  d text := pg_get_functiondef('public.gestao_automacao_acao(gestao_automacoes, jsonb, gestao_tarefas, text, jsonb)'::regprocedure);
  t record;
begin
  if position('gestao_automacao_resp_lista' in d) > 0 then raise notice 'v371: gestao_automacao_acao já trocada'; return; end if;
  for t in select * from (values
    -- (1) modelo: a 1ª responsável vem da lista
    ('modelo-resp',
     $a$where lower(u.email) = lower(btrim(coalesce(v_acao->>'responsavel_email','')))$a$,
     $b$where lower(u.email) = coalesce((public.gestao_automacao_resp_lista(v_acao))[1], '')$b$),
    -- (2) modelo: cada subtarefa criada abre a janela com todas (2+)
    ('modelo-janela',
     $a$v_ordem, nullif(v_item->>'etapa',''), nullif(v_item->>'tipo',''), v_email);$a$,
     $b$v_ordem, nullif(v_item->>'etapa',''), nullif(v_item->>'tipo',''), v_email) returning id into v_new_id;
          perform public.gestao_automacao_sub_varias(v_new_id, v_acao, p_tarefa, v_txt);$b$),
    -- (3) modelo: o detalhe do log cita todas
    ('modelo-log',
     $a$|| case when v_email is not null and v_ins > 0 then ' (responsável ' || v_email || ')' else '' end;$a$,
     $b$|| case when v_email is not null and v_ins > 0 then ' (responsável ' || array_to_string(coalesce(nullif(public.gestao_automacao_resp_lista(v_acao), '{}'), array[v_email]), ', ') || ')' else '' end;$b$),
    -- (4) produtos (v367): a 1ª responsável vem da lista
    ('produtos-resp',
     $a$where lower(u.email) = lower(btrim(coalesce(v_acao->>'responsavel_email', '')))$a$,
     $b$where lower(u.email) = coalesce((public.gestao_automacao_resp_lista(v_acao))[1], '')$b$),
    -- (5) produtos: cada subtarefa criada abre a janela com todas (2+)
    ('produtos-janela',
     $a$nullif(v_item->>'etapa', ''), nullif(v_item->>'tipo', ''), v_resp);$a$,
     $b$nullif(v_item->>'etapa', ''), nullif(v_item->>'tipo', ''), v_resp) returning id into v_new_id;
              perform public.gestao_automacao_sub_varias(v_new_id, v_acao, p_tarefa, v_t);$b$)
  ) as x(nome, de, para) loop
    if (length(d) - length(replace(d, t.de, ''))) / length(t.de) <> 1 then
      raise exception 'v371: trecho "%" não aparece exatamente 1 vez no corpo atual de gestao_automacao_acao — nada foi aplicado', t.nome;
    end if;
    d := replace(d, t.de, t.para);
  end loop;
  execute d;
end $$;

notify pgrst, 'reload schema';
commit;
