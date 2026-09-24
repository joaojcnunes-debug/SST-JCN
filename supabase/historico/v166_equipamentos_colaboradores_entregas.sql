-- v166 — Equipamentos Chabra (Fase 6): colaboradores, entrega e termo assinado.
--
-- Este é o "base → funcionário" que falta do ponto 5 do briefing. A transferência
-- base → base já existe (v115+v136) e continua valendo; o que ela NÃO cobre é
-- entregar a quem não tem login: a RPC transferencia_aceitar() lê
-- auth.jwt()->>'email' e exige que o próprio destinatário esteja logado. A maioria
-- de quem retira equipamento não tem conta no painel.
--
-- A solução é a do EPI (v129/v130): cadastro próprio de pessoas, assinatura
-- PRESENCIAL no dispositivo de quem entrega, e o que dá validade jurídica é o
-- SHA-256 do PDF (Lei 14.063/2020 + MP 2.200-2/2001), não o desenho.
--
-- DOIS FORMATOS DE ITEM na entrega — é a parte que o briefing deixa implícita:
--   a) { "id_catalogo": "...", "quantidade": 2, "seriais": [...] }
--      Sai do ESTOQUE: valida saldo, lança 'saida' e, se o produto for
--      controla_individual, cria uma linha em public.equipamentos por unidade.
--   b) { "id_equipamento": "..." }
--      Ativo que JÁ existe e está livre (ex.: os 86 itens migrados na v163, que
--      nunca passaram por estoque). Só vincula à pessoa — não mexe em saldo,
--      porque ele nunca esteve lá. Lançar 'saida' aqui secaria o saldo do nada.
--
-- TRANSAÇÃO: psql -1 via deploy\migrate.ps1 (sem begin/commit explícito).
-- Idempotente. Rollback em scripts\sql\v166_equipamentos_colaboradores_entregas_rollback.sql

do $$
begin
  if to_regclass('public.equipamentos_movimentacoes') is null then
    raise exception 'v166 abortada: v164 (estoque) nao foi aplicada';
  end if;
end $$;

-- ── 1) Roster de pessoas da Chabra ──────────────────────────────────────────
-- Independente de ter login no painel — é essa a razão de existir da tabela.
create table if not exists public.colaboradores_chabra (
  id_colaborador text primary key default gen_random_uuid()::text,
  id_unidade     text not null references public.unidades(id_unidade) on delete restrict,
  nome           text not null,
  cpf            text,
  matricula      text,
  cargo          text,
  setor          text,
  email          text,                          -- opcional; só para aviso, não para login
  ativo          boolean not null default true,
  criado_por     text,
  criado_em      timestamptz not null default now(),
  updated_at     timestamptz
);

create index if not exists idx_colab_chabra_unidade on public.colaboradores_chabra (id_unidade, ativo, nome);
-- CPF é o que impede a mesma pessoa cadastrada duas vezes. Parcial: CPF em branco
-- é comum no cadastro rápido e não pode travar.
create unique index if not exists uniq_colab_chabra_cpf
  on public.colaboradores_chabra (regexp_replace(cpf, '\D', '', 'g'))
  where coalesce(btrim(cpf), '') <> '';

-- ── 2) Vínculo do ativo com a pessoa ────────────────────────────────────────
alter table public.equipamentos
  add column if not exists id_colaborador text references public.colaboradores_chabra(id_colaborador) on delete set null,
  add column if not exists entregue_em     timestamptz;
create index if not exists idx_equipamentos_colaborador on public.equipamentos (id_colaborador)
  where id_colaborador is not null;

-- ── 3) Entrega (cabeçalho + itens) ──────────────────────────────────────────
create table if not exists public.equipamentos_entregas (
  id_entrega          text primary key default gen_random_uuid()::text,
  id_unidade          text not null references public.unidades(id_unidade) on delete restrict,
  id_colaborador      text not null references public.colaboradores_chabra(id_colaborador) on delete restrict,
  data_entrega        date not null default current_date,
  responsavel_entrega text,
  observacao          text,
  total_itens         int  not null default 0,
  status              text not null default 'registrada',
  criado_por          text,
  criado_em           timestamptz not null default now()
);

-- SNAPSHOT: nome/série/patrimônio congelados no momento da entrega. O histórico
-- tem de sobreviver à edição ou exclusão do equipamento — mesmo cuidado que a
-- tabela `transferencias` já toma desde a v115.
create table if not exists public.equipamentos_entregas_itens (
  id_item           text primary key default gen_random_uuid()::text,
  id_entrega        text not null references public.equipamentos_entregas(id_entrega) on delete cascade,
  id_unidade        text not null references public.unidades(id_unidade) on delete restrict,
  id_catalogo       text references public.equipamentos_catalogo(id_catalogo) on delete set null,
  id_equipamento    text references public.equipamentos(id_equipamento) on delete set null,
  nome_equipamento  text,                       -- snapshot
  numero_serie      text,                       -- snapshot
  numero_patrimonio text,                       -- snapshot
  quantidade        numeric not null default 1 check (quantidade > 0),
  devolvido_em      timestamptz,                -- preenchido pela v167
  criado_em         timestamptz not null default now()
);

create index if not exists idx_equip_entregas_colab   on public.equipamentos_entregas (id_colaborador, data_entrega desc);
create index if not exists idx_equip_entregas_unidade on public.equipamentos_entregas (id_unidade, criado_em desc);
create index if not exists idx_equip_entregas_itens   on public.equipamentos_entregas_itens (id_entrega);
create index if not exists idx_equip_entregas_itens_eq on public.equipamentos_entregas_itens (id_equipamento);

-- ── 4) Assinatura do recebedor (append-only) ────────────────────────────────
-- Estado "assinada" é DERIVADO da existência da linha — nunca um UPDATE na entrega.
create table if not exists public.equipamentos_entrega_assinaturas (
  id_assinatura    text primary key default gen_random_uuid()::text,
  id_entrega       text not null references public.equipamentos_entregas(id_entrega) on delete cascade,
  id_unidade       text not null references public.unidades(id_unidade) on delete restrict,
  id_colaborador   text,
  assinante_nome   text,
  metodo           text not null default 'canvas' check (metodo in ('canvas','digital')),
  assinatura_png   text,
  pdf_sha256       text,                        -- é ISTO que dá validade jurídica
  user_agent       text,
  ip               text,
  consentimento_em timestamptz,
  assinado_em      timestamptz not null default now(),
  criado_por       text,
  criado_em        timestamptz not null default now()
);
create index if not exists idx_equip_assin_entrega on public.equipamentos_entrega_assinaturas (id_entrega);

-- ── 5) RLS ──────────────────────────────────────────────────────────────────
-- Colaboradores: CRUD por base.
alter table public.colaboradores_chabra enable row level security;
drop policy if exists colaboradores_chabra_sel on public.colaboradores_chabra;
create policy colaboradores_chabra_sel on public.colaboradores_chabra
  for select to authenticated using (
    public.caller_eh_admin()
    or (public.caller_pode_equipamentos() and id_unidade = any(public.caller_unidades()))
  );
drop policy if exists colaboradores_chabra_rw on public.colaboradores_chabra;
create policy colaboradores_chabra_rw on public.colaboradores_chabra
  for all to authenticated
  using (public.caller_pode_editar() and public.caller_pode_equipamentos()
         and (public.caller_eh_admin() or id_unidade = any(public.caller_unidades())))
  with check (public.caller_pode_editar() and public.caller_pode_equipamentos()
         and (public.caller_eh_admin() or id_unidade = any(public.caller_unidades())));

-- Entregas, itens e assinaturas: append-only por base.
do $$
declare t text;
begin
  foreach t in array array['equipamentos_entregas','equipamentos_entregas_itens','equipamentos_entrega_assinaturas']
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

-- ── 6) RPC atômica: registrar entrega ───────────────────────────────────────
-- ORDEM: valida TUDO, só então grava. É o que impede a entrega gravada pela
-- metade quando o quarto item não tem saldo.
create or replace function public.equipamento_registrar_entrega(
  p_id_unidade     text,
  p_id_colaborador text,
  p_data_entrega   date,
  p_responsavel    text,
  p_observacao     text,
  p_itens          jsonb
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_email  text := auth.jwt() ->> 'email';
  v_id     text := gen_random_uuid()::text;
  v_item   jsonb;
  v_agg    record;
  v_saldo  numeric;
  v_id_cat text;
  v_id_eq  text;
  v_qty    numeric;
  v_serial text;
  v_indiv  boolean;
  v_i      int;
begin
  if not public.caller_pode_editar() then raise exception 'Sem permissão para registrar entrega.'; end if;
  if not public.caller_pode_equipamentos() then raise exception 'Módulo de equipamentos fora do seu acesso.'; end if;
  if not (public.caller_eh_admin() or p_id_unidade = any(public.caller_unidades())) then
    raise exception 'Base fora do seu acesso.';
  end if;
  if not exists (select 1 from colaboradores_chabra
                  where id_colaborador = p_id_colaborador and id_unidade = p_id_unidade and ativo) then
    raise exception 'Colaborador não pertence a esta base (ou está inativo).';
  end if;
  if coalesce(jsonb_array_length(p_itens), 0) = 0 then raise exception 'Informe ao menos um item.'; end if;

  -- (a) itens de estoque: valida saldo de TODOS antes de qualquer escrita
  for v_agg in
    select e->>'id_catalogo' as id_catalogo,
           sum(coalesce(nullif(e->>'quantidade', '')::numeric, 1)) as req
      from jsonb_array_elements(p_itens) e
     where nullif(e->>'id_catalogo', '') is not null
     group by e->>'id_catalogo'
  loop
    if v_agg.req <= 0 then raise exception 'Quantidade inválida.'; end if;
    v_saldo := coalesce((
      select sum(case when tipo = 'saida' then -quantidade else quantidade end)
        from equipamentos_movimentacoes
       where id_catalogo = v_agg.id_catalogo and id_unidade = p_id_unidade), 0);
    if v_saldo < v_agg.req then
      raise exception 'Saldo insuficiente para "%": disponível %, solicitado %.',
        coalesce((select nome from equipamentos_catalogo where id_catalogo = v_agg.id_catalogo), v_agg.id_catalogo),
        v_saldo, v_agg.req;
    end if;
  end loop;

  -- (b) ativos já existentes: precisam existir, estar na base e estar LIVRES
  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_id_eq := nullif(v_item->>'id_equipamento', '');
    if v_id_eq is null then continue; end if;
    if not exists (select 1 from equipamentos where id_equipamento = v_id_eq and id_unidade = p_id_unidade) then
      raise exception 'Equipamento % não existe nesta base.', v_id_eq;
    end if;
    if exists (select 1 from equipamentos where id_equipamento = v_id_eq and id_colaborador is not null) then
      raise exception 'Equipamento "%" já está com outra pessoa. Registre a devolução antes de entregar de novo.',
        coalesce((select nome from equipamentos where id_equipamento = v_id_eq), v_id_eq);
    end if;
  end loop;

  insert into equipamentos_entregas
    (id_entrega, id_unidade, id_colaborador, data_entrega, responsavel_entrega, observacao,
     total_itens, status, criado_por)
  values
    (v_id, p_id_unidade, p_id_colaborador, coalesce(p_data_entrega, current_date), p_responsavel, p_observacao,
     coalesce(jsonb_array_length(p_itens), 0), 'registrada', v_email);

  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_id_cat := nullif(v_item->>'id_catalogo', '');
    v_id_eq  := nullif(v_item->>'id_equipamento', '');

    -- ── (b) ativo existente: só vincula, sem tocar no saldo ──
    if v_id_eq is not null then
      update equipamentos
         set id_colaborador = p_id_colaborador, entregue_em = now(), updated_at = now()
       where id_equipamento = v_id_eq;

      insert into equipamentos_entregas_itens
        (id_item, id_entrega, id_unidade, id_catalogo, id_equipamento,
         nome_equipamento, numero_serie, numero_patrimonio, quantidade)
      select gen_random_uuid()::text, v_id, p_id_unidade, e.id_catalogo, e.id_equipamento,
             e.nome, e.numero_serie, e.numero_patrimonio, 1
        from equipamentos e where e.id_equipamento = v_id_eq;
      continue;
    end if;

    -- ── (a) saída de estoque ──
    if v_id_cat is null then continue; end if;
    v_qty := coalesce(nullif(v_item->>'quantidade', '')::numeric, 1);
    if v_qty <= 0 then continue; end if;

    select controla_individual into v_indiv from equipamentos_catalogo where id_catalogo = v_id_cat;

    insert into equipamentos_movimentacoes
      (id_movimentacao, id_catalogo, id_unidade, tipo, quantidade, origem, ref_id, motivo, responsavel, criado_por)
    values
      (gen_random_uuid()::text, v_id_cat, p_id_unidade, 'saida', v_qty, 'entrega', v_id,
       'Entrega ao colaborador', p_responsavel, v_email);

    if coalesce(v_indiv, true) then
      -- Cada unidade vira um ativo: é o "#A31 → João" do briefing.
      -- `seriais` é opcional e posicional; sem ele o ativo nasce sem série.
      for v_i in 1 .. v_qty::int loop
        v_serial := nullif(btrim(coalesce(v_item->'seriais'->>(v_i - 1), '')), '');
        v_id_eq  := gen_random_uuid()::text;

        insert into equipamentos
          (id_equipamento, id_unidade, id_catalogo, nome, tipo, fabricante, modelo,
           numero_serie, status, id_colaborador, entregue_em, criado_por)
        select v_id_eq, p_id_unidade, c.id_catalogo, c.nome, c.tipo, c.fabricante, c.modelo,
               v_serial, 'OPERANTE', p_id_colaborador, now(), v_email
          from equipamentos_catalogo c where c.id_catalogo = v_id_cat;

        insert into equipamentos_entregas_itens
          (id_item, id_entrega, id_unidade, id_catalogo, id_equipamento,
           nome_equipamento, numero_serie, numero_patrimonio, quantidade)
        select gen_random_uuid()::text, v_id, p_id_unidade, v_id_cat, v_id_eq,
               c.nome, v_serial, null, 1
          from equipamentos_catalogo c where c.id_catalogo = v_id_cat;
      end loop;
    else
      -- Consumível/genérico: só o registro da quantidade entregue.
      insert into equipamentos_entregas_itens
        (id_item, id_entrega, id_unidade, id_catalogo, id_equipamento,
         nome_equipamento, numero_serie, numero_patrimonio, quantidade)
      select gen_random_uuid()::text, v_id, p_id_unidade, v_id_cat, null,
             c.nome, null, null, v_qty
        from equipamentos_catalogo c where c.id_catalogo = v_id_cat;
    end if;
  end loop;

  return v_id;
end $$;

grant execute on function public.equipamento_registrar_entrega(text, text, date, text, text, jsonb) to authenticated;

-- ── 7) RPC: assinar a entrega ───────────────────────────────────────────────
-- O IP é capturado NO SERVIDOR (request.headers do PostgREST) — o cliente não forja.
create or replace function public.equipamento_assinar_entrega(
  p_id_entrega     text,
  p_assinante_nome text,
  p_assinatura_png text,
  p_pdf_sha256     text,
  p_user_agent     text,
  p_consentimento  boolean default false
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_email    text := auth.jwt() ->> 'email';
  v_unidade  text;
  v_colab    text;
  v_ip       text;
  v_id       text := gen_random_uuid()::text;
begin
  if not public.caller_pode_editar() then raise exception 'Sem permissão para assinar.'; end if;

  select id_unidade, id_colaborador into v_unidade, v_colab
    from equipamentos_entregas where id_entrega = p_id_entrega;
  if not found then raise exception 'Entrega não encontrada.'; end if;
  if not (public.caller_eh_admin() or v_unidade = any(public.caller_unidades())) then
    raise exception 'Base fora do seu acesso.';
  end if;
  if coalesce(btrim(p_assinatura_png), '') = '' then raise exception 'Assinatura em branco.'; end if;
  if not coalesce(p_consentimento, false) then raise exception 'É necessário o consentimento do recebedor.'; end if;
  if exists (select 1 from equipamentos_entrega_assinaturas where id_entrega = p_id_entrega) then
    raise exception 'Esta entrega já foi assinada.';
  end if;

  begin
    v_ip := coalesce(
      nullif(split_part(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ',', 1), ''),
      current_setting('request.headers', true)::json ->> 'x-real-ip'
    );
  exception when others then v_ip := null;
  end;

  insert into equipamentos_entrega_assinaturas
    (id_assinatura, id_entrega, id_unidade, id_colaborador, assinante_nome, metodo,
     assinatura_png, pdf_sha256, user_agent, ip, consentimento_em, criado_por)
  values
    (v_id, p_id_entrega, v_unidade, v_colab,
     coalesce(nullif(btrim(p_assinante_nome), ''),
              (select nome from colaboradores_chabra where id_colaborador = v_colab)),
     'canvas', p_assinatura_png, p_pdf_sha256, p_user_agent, v_ip,
     case when p_consentimento then now() else null end, v_email);

  return v_id;
end $$;

grant execute on function public.equipamento_assinar_entrega(text, text, text, text, text, boolean) to authenticated;

-- ── 8) "O que está com o Fulano" ────────────────────────────────────────────
-- Uma tela, uma consulta. É a fonte do termo de rescisão/desligamento.
create or replace view public.v_equipamentos_com_colaborador with (security_invoker = true) as
  select e.id_colaborador,
         c.nome  as colaborador_nome,
         c.matricula,
         c.cargo,
         e.id_unidade,
         e.id_equipamento,
         e.nome  as equipamento_nome,
         e.numero_serie,
         e.numero_patrimonio,
         e.status,
         e.entregue_em
    from public.equipamentos e
    join public.colaboradores_chabra c on c.id_colaborador = e.id_colaborador
   where e.id_colaborador is not null;
