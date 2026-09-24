-- v167 — Equipamentos Chabra (Fase 7): devolução + histórico de status com motivo.
--
-- As duas coisas saem juntas porque se encontram: devolveu com a tela trincada →
-- status vira Manutenção, motivo "avaria em devolução", tudo numa transação só.
--
-- COMO O SALDO SE COMPORTA NA DEVOLUÇÃO (decisão que o briefing deixa em aberto):
--
--   • Item INDIVIDUALIZADO (tem id_equipamento): a devolução DESVINCULA a pessoa
--     e o ativo volta a ficar disponível. O saldo NÃO sobe.
--     Por quê: quando o notebook saiu do estoque ele virou uma linha em
--     public.equipamentos. Se a devolução também somasse no saldo, a mesma
--     unidade passaria a existir nos dois lugares — o estoque contaria 1 e o
--     patrimônio contaria 1, para um único notebook. Ele é reentregue pelo
--     formato (b) da v166 ("ativo existente e livre"), não saindo do estoque de novo.
--
--   • Item GENÉRICO (sem id_equipamento — produto com controla_individual = false):
--     aí sim a devolução lança 'entrada' e o saldo sobe. Não há ativo para contar
--     em dobro; o par de cabos voltou para a prateleira.
--
-- A MUDANÇA DE STATUS SÓ ACONTECE PELA RPC. Não é validação de tela: um trigger
-- bloqueia UPDATE direto na coluna `status`, inclusive via PostgREST e inclusive
-- para admin. É o que faz o "motivo obrigatório" ser verdade de fato.
--
-- TRANSAÇÃO: psql -1 via deploy\migrate.ps1 (sem begin/commit explícito).
-- Idempotente. Rollback em scripts\sql\v167_equipamentos_devolucao_status_rollback.sql

do $$
begin
  if to_regclass('public.equipamentos_entregas') is null then
    raise exception 'v167 abortada: v166 (entregas) nao foi aplicada';
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- PARTE 1 — Histórico de status
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.equipamentos_status_historico (
  id_historico              text primary key default gen_random_uuid()::text,
  id_equipamento            text not null references public.equipamentos(id_equipamento) on delete cascade,
  id_unidade                text not null references public.unidades(id_unidade) on delete restrict,
  status_anterior           text,
  status_novo               text not null,
  motivo                    text not null check (btrim(motivo) <> ''),
  -- Lista fechada aprovada pelo operador em 2026-08-10. O código é o que permite
  -- perguntar "quantos baixamos por roubo este ano"; o `motivo` acima é o texto
  -- livre que acompanha. Os dois convivem: lista para agregar, texto para narrar.
  -- CADASTRO é interno (linha de abertura da timeline), não aparece na tela.
  -- Acrescentar motivo depois = 1 linha aqui, em migration própria.
  motivo_codigo             text
    check (motivo_codigo is null or motivo_codigo in (
      'DEFEITO',                -- quebrou               → MANUTENCAO
      'MANUTENCAO_PREVENTIVA',  -- revisão programada    → MANUTENCAO
      'DEVOLUCAO_AVARIA',       -- voltou danificado     → MANUTENCAO
      'MANUTENCAO_CONCLUIDA',   -- voltou do conserto    → OPERANTE
      'RESERVA',                -- guardado sem uso      → RESERVA
      'REATIVADO',              -- saiu da reserva       → OPERANTE
      'TROCA_POR_NOVO',         -- substituído           → BAIXADA (+ substituto)
      'FIM_VIDA_UTIL',          -- não compensa consertar→ BAIXADA
      'PERDA_ROUBO',            -- sumiu                 → BAIXADA
      'OUTRO',                  -- exige o texto livre
      'CADASTRO'                -- interno: abertura da timeline
    )),
  -- Preenchido quando o motivo é troca: "substituído por #A47".
  id_equipamento_substituto text references public.equipamentos(id_equipamento) on delete set null,
  usuario_email             text,
  criado_em                 timestamptz not null default now()
);

create index if not exists idx_equip_status_hist
  on public.equipamentos_status_historico (id_equipamento, criado_em desc);

alter table public.equipamentos_status_historico enable row level security;
drop policy if exists equipamentos_status_historico_sel on public.equipamentos_status_historico;
create policy equipamentos_status_historico_sel on public.equipamentos_status_historico
  for select to authenticated using (
    public.caller_eh_admin()
    or (public.caller_pode_equipamentos() and id_unidade = any(public.caller_unidades()))
  );
-- Sem policy de INSERT: a escrita é EXCLUSIVAMENTE pela RPC (security definer).
-- Sem policy de UPDATE/DELETE: histórico não se reescreve.

-- ── Trava real: status só muda por RPC ──────────────────────────────────────
-- A RPC marca a transação com set_config(..., true) = escopo local. Qualquer
-- UPDATE direto (PostgREST, psql, script) esbarra aqui.
create or replace function public.equipamentos_status_guard()
returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status
     and coalesce(current_setting('app.equip_status_rpc', true), '') <> 'on' then
    raise exception
      'Mudança de status exige motivo — use equipamento_mudar_status(). (% → %)',
      old.status, new.status;
  end if;
  return new;
end $$;

drop trigger if exists trg_equipamentos_status_guard on public.equipamentos;
create trigger trg_equipamentos_status_guard
  before update on public.equipamentos
  for each row execute function public.equipamentos_status_guard();

-- ── RPC: mudar status ───────────────────────────────────────────────────────
create or replace function public.equipamento_mudar_status(
  p_id_equipamento text,
  p_status_novo    text,
  p_motivo         text,
  p_motivo_codigo  text default null,
  p_id_substituto  text default null
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_email   text := auth.jwt() ->> 'email';
  v_atual   text;
  v_unidade text;
  v_id      text := gen_random_uuid()::text;
begin
  if not public.caller_pode_editar() then raise exception 'Sem permissão para mudar status.'; end if;
  if not public.caller_pode_equipamentos() then raise exception 'Módulo de equipamentos fora do seu acesso.'; end if;
  if coalesce(btrim(p_motivo), '') = '' then raise exception 'Informe o motivo da mudança de status.'; end if;
  if p_status_novo not in ('OPERANTE','MANUTENCAO','INATIVA','BAIXADA','RESERVA') then
    raise exception 'Status inválido: %', p_status_novo;
  end if;

  select status, id_unidade into v_atual, v_unidade
    from equipamentos where id_equipamento = p_id_equipamento for update;
  if not found then raise exception 'Equipamento não encontrado.'; end if;
  if not (public.caller_eh_admin() or v_unidade = any(public.caller_unidades())) then
    raise exception 'Base fora do seu acesso.';
  end if;
  if v_atual = p_status_novo then raise exception 'O equipamento já está com status %.', p_status_novo; end if;

  -- destrava o trigger só para esta transação
  perform set_config('app.equip_status_rpc', 'on', true);

  update equipamentos
     set status = p_status_novo, updated_at = now()
   where id_equipamento = p_id_equipamento;

  insert into equipamentos_status_historico
    (id_historico, id_equipamento, id_unidade, status_anterior, status_novo,
     motivo, motivo_codigo, id_equipamento_substituto, usuario_email)
  values
    (v_id, p_id_equipamento, v_unidade, v_atual, p_status_novo,
     btrim(p_motivo), nullif(btrim(p_motivo_codigo), ''), nullif(btrim(p_id_substituto), ''), v_email);

  return v_id;
end $$;

grant execute on function public.equipamento_mudar_status(text, text, text, text, text) to authenticated;

-- Dia-zero do histórico: uma linha de abertura por equipamento, para a timeline
-- da tela não começar em branco e para o status atual ter origem declarada.
insert into public.equipamentos_status_historico
  (id_equipamento, id_unidade, status_anterior, status_novo, motivo, motivo_codigo, usuario_email, criado_em)
select e.id_equipamento, e.id_unidade, null, e.status,
       'Situação registrada no cadastro inicial do equipamento', 'CADASTRO',
       e.criado_por, e.criado_em
  from public.equipamentos e
 where not exists (
   select 1 from public.equipamentos_status_historico h where h.id_equipamento = e.id_equipamento
 );

-- ═══════════════════════════════════════════════════════════════════════════
-- PARTE 2 — Devolução
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.equipamentos_devolucoes (
  id_devolucao         text primary key default gen_random_uuid()::text,
  id_unidade           text not null references public.unidades(id_unidade) on delete restrict,
  id_colaborador       text not null references public.colaboradores_chabra(id_colaborador) on delete restrict,
  id_entrega           text references public.equipamentos_entregas(id_entrega) on delete set null,
  data_devolucao       date not null default current_date,
  recebido_por         text,                    -- quem recebeu de volta (§3.5)
  observacao           text,
  total_itens          int  not null default 0,
  criado_por           text,
  criado_em            timestamptz not null default now()
);

create table if not exists public.equipamentos_devolucoes_itens (
  id_item           text primary key default gen_random_uuid()::text,
  id_devolucao      text not null references public.equipamentos_devolucoes(id_devolucao) on delete cascade,
  id_unidade        text not null references public.unidades(id_unidade) on delete restrict,
  id_catalogo       text references public.equipamentos_catalogo(id_catalogo) on delete set null,
  id_equipamento    text references public.equipamentos(id_equipamento) on delete set null,
  nome_equipamento  text,                       -- snapshot
  numero_serie      text,                       -- snapshot
  numero_patrimonio text,                       -- snapshot
  quantidade        numeric not null default 1 check (quantidade > 0),
  estado_retorno    text not null default 'integro'
                    check (estado_retorno in ('integro','avariado','inservivel')),
  observacao_estado text,
  criado_em         timestamptz not null default now(),
  -- Estado diferente de íntegro sem descrição é laudo sem laudo.
  constraint equip_dev_estado_exige_obs
    check (estado_retorno = 'integro' or coalesce(btrim(observacao_estado), '') <> '')
);

-- ── Assinatura da devolução (decisão do operador, 2026-08-10) ───────────────
-- QUEM ASSINA É O GERENTE / REPRESENTANTE QUE RECEBE de volta — não o
-- funcionário que devolveu. A assimetria é proposital e é jurídica:
--   • na RETIRADA assina o funcionário, porque é ele que ASSUME a
--     responsabilidade pelo bem (v166, equipamentos_entrega_assinaturas);
--   • na DEVOLUÇÃO assina quem RECEBE, atestando que o bem voltou e em que
--     estado. Quem devolveu fica registrado por nome em equipamentos_devolucoes
--     .id_colaborador, sem assinar.
-- Append-only, mesmo molde da v166: "assinada" é a existência da linha, nunca um
-- UPDATE na devolução.
create table if not exists public.equipamentos_devolucao_assinaturas (
  id_assinatura    text primary key default gen_random_uuid()::text,
  id_devolucao     text not null references public.equipamentos_devolucoes(id_devolucao) on delete cascade,
  id_unidade       text not null references public.unidades(id_unidade) on delete restrict,
  -- Nome de quem recebeu (gerente/representante). Snapshot: o histórico tem de
  -- sobreviver ao desligamento de quem assinou.
  assinante_nome   text,
  assinante_email  text,
  metodo           text not null default 'canvas' check (metodo in ('canvas','digital')),
  assinatura_png   text,
  user_agent       text,
  ip               text,
  assinado_em      timestamptz not null default now(),
  criado_por       text,
  criado_em        timestamptz not null default now()
);
-- Sem pdf_sha256, ao contrário da retirada: a devolução não gera termo em PDF
-- (decisão de 2026-08-10 — o documento com valor jurídico é o de retirada). Se
-- um dia gerar, a coluna entra aqui e o molde da v166 se repete inteiro.

create index if not exists idx_equip_dev_colab   on public.equipamentos_devolucoes (id_colaborador, data_devolucao desc);
create index if not exists idx_equip_dev_unidade on public.equipamentos_devolucoes (id_unidade, criado_em desc);
create index if not exists idx_equip_dev_itens   on public.equipamentos_devolucoes_itens (id_devolucao);
create index if not exists idx_equip_dev_assin   on public.equipamentos_devolucao_assinaturas (id_devolucao);

-- RLS append-only por base (mesmo padrão da v166).
do $$
declare t text;
begin
  foreach t in array array['equipamentos_devolucoes','equipamentos_devolucoes_itens','equipamentos_devolucao_assinaturas']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t||'_sel', t);
    execute format($f$create policy %I on public.%I for select to authenticated using (
        public.caller_eh_admin()
        or (public.caller_pode_equipamentos() and id_unidade = any(public.caller_unidades()))
      )$f$, t||'_sel', t);
    execute format('drop policy if exists %I on public.%I', t||'_ins', t);
    execute format($f$create policy %I on public.%I for insert to authenticated with check (
        public.caller_pode_editar() and public.caller_pode_equipamentos()
        and (public.caller_eh_admin() or id_unidade = any(public.caller_unidades()))
      )$f$, t||'_ins', t);
  end loop;
end $$;

-- ── RPC atômica: registrar devolução ────────────────────────────────────────
-- Item esperado em p_itens:
--   { "id_equipamento": "...", "estado_retorno": "avariado",
--     "observacao_estado": "tela trincada", "novo_status": "MANUTENCAO" }
--   ou, para genérico:
--   { "id_catalogo": "...", "quantidade": 3, "estado_retorno": "integro" }
create or replace function public.equipamento_registrar_devolucao(
  p_id_unidade     text,
  p_id_colaborador text,
  p_id_entrega     text,
  p_data_devolucao date,
  p_recebido_por   text,
  p_observacao     text,
  p_itens          jsonb
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_email  text := auth.jwt() ->> 'email';
  v_id     text := gen_random_uuid()::text;
  v_item   jsonb;
  v_id_eq  text;
  v_id_cat text;
  v_qty    numeric;
  v_estado text;
  v_obs    text;
  v_novo   text;
begin
  if not public.caller_pode_editar() then raise exception 'Sem permissão para registrar devolução.'; end if;
  if not public.caller_pode_equipamentos() then raise exception 'Módulo de equipamentos fora do seu acesso.'; end if;
  if not (public.caller_eh_admin() or p_id_unidade = any(public.caller_unidades())) then
    raise exception 'Base fora do seu acesso.';
  end if;
  if coalesce(jsonb_array_length(p_itens), 0) = 0 then raise exception 'Informe ao menos um item.'; end if;

  -- Valida TUDO antes de gravar (mesma ordem da entrega).
  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_id_eq := nullif(v_item->>'id_equipamento', '');
    if v_id_eq is not null then
      if not exists (select 1 from equipamentos
                      where id_equipamento = v_id_eq and id_colaborador = p_id_colaborador) then
        raise exception 'O equipamento "%" não está com este colaborador.',
          coalesce((select nome from equipamentos where id_equipamento = v_id_eq), v_id_eq);
      end if;
    elsif nullif(v_item->>'id_catalogo', '') is null then
      raise exception 'Item sem equipamento nem produto do catálogo.';
    end if;

    if coalesce(v_item->>'estado_retorno', 'integro') <> 'integro'
       and coalesce(btrim(v_item->>'observacao_estado'), '') = '' then
      raise exception 'Descreva a avaria do item devolvido em estado "%".', v_item->>'estado_retorno';
    end if;
  end loop;

  insert into equipamentos_devolucoes
    (id_devolucao, id_unidade, id_colaborador, id_entrega, data_devolucao,
     recebido_por, observacao, total_itens, criado_por)
  values
    (v_id, p_id_unidade, p_id_colaborador, nullif(btrim(p_id_entrega), ''),
     coalesce(p_data_devolucao, current_date), p_recebido_por, p_observacao,
     coalesce(jsonb_array_length(p_itens), 0), v_email);

  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_id_eq  := nullif(v_item->>'id_equipamento', '');
    v_id_cat := nullif(v_item->>'id_catalogo', '');
    v_qty    := coalesce(nullif(v_item->>'quantidade', '')::numeric, 1);
    v_estado := coalesce(nullif(v_item->>'estado_retorno', ''), 'integro');
    v_obs    := nullif(btrim(v_item->>'observacao_estado'), '');
    v_novo   := nullif(btrim(v_item->>'novo_status'), '');

    if v_id_eq is not null then
      -- Individualizado: desvincula. Saldo NÃO sobe (veja o cabeçalho).
      insert into equipamentos_devolucoes_itens
        (id_item, id_devolucao, id_unidade, id_catalogo, id_equipamento,
         nome_equipamento, numero_serie, numero_patrimonio, quantidade, estado_retorno, observacao_estado)
      select gen_random_uuid()::text, v_id, p_id_unidade, e.id_catalogo, e.id_equipamento,
             e.nome, e.numero_serie, e.numero_patrimonio, 1, v_estado, v_obs
        from equipamentos e where e.id_equipamento = v_id_eq;

      update equipamentos
         set id_colaborador = null, entregue_em = null, updated_at = now()
       where id_equipamento = v_id_eq;

      update equipamentos_entregas_itens
         set devolvido_em = now()
       where id_equipamento = v_id_eq and devolvido_em is null;

      -- Avaria vira mudança de status COM MOTIVO, na mesma transação.
      if v_novo is not null then
        perform public.equipamento_mudar_status(
          v_id_eq, v_novo,
          coalesce(v_obs, 'Avaria constatada na devolução'),
          'DEVOLUCAO_AVARIA', null);
      end if;
    else
      -- Genérico: volta para a prateleira, saldo sobe.
      insert into equipamentos_devolucoes_itens
        (id_item, id_devolucao, id_unidade, id_catalogo, id_equipamento,
         nome_equipamento, numero_serie, numero_patrimonio, quantidade, estado_retorno, observacao_estado)
      select gen_random_uuid()::text, v_id, p_id_unidade, c.id_catalogo, null,
             c.nome, null, null, v_qty, v_estado, v_obs
        from equipamentos_catalogo c where c.id_catalogo = v_id_cat;

      -- Item inservível não volta para o estoque: sumiria a informação de que
      -- ele foi descartado. Fica só o registro da devolução.
      if v_estado <> 'inservivel' then
        insert into equipamentos_movimentacoes
          (id_movimentacao, id_catalogo, id_unidade, tipo, quantidade, origem, ref_id, motivo, responsavel, criado_por)
        values
          (gen_random_uuid()::text, v_id_cat, p_id_unidade, 'entrada', v_qty, 'devolucao', v_id,
           'Devolução de colaborador' || coalesce(' — ' || v_obs, ''), p_recebido_por, v_email);
      end if;
    end if;
  end loop;

  return v_id;
end $$;

grant execute on function public.equipamento_registrar_devolucao(text, text, text, date, text, text, jsonb) to authenticated;
