-- v165 — Equipamentos Chabra (Fase 5): entrada de estoque por importação de NF-e.
--
-- Portado da v128 (EPI), com uma diferença de regra:
--
--   A CHAVE DA NOTA É ÚNICA NO SISTEMA INTEIRO, não por escopo.
--   No EPI é `unique (empresa_id, chnfe)` — a mesma nota pode existir em duas
--   empresas clientes porque são cadastros independentes. Aqui não: uma NF-e é
--   um documento fiscal único da Chabra. Se ela pudesse ser importada em duas
--   bases, o saldo total inflaria e ninguém veria — que é exatamente o risco
--   que o briefing manda respeitar ao portar.
--
-- Entrada manual (v164) CONTINUA existindo. A NF-e cobre compra formal; doação,
-- reaproveitamento e transferência de contrato não têm nota, e travar tudo na
-- nota emperra o cadastro.
--
-- TRANSAÇÃO: psql -1 via deploy\migrate.ps1 (sem begin/commit explícito).
-- Idempotente. Rollback em scripts\sql\v165_equipamentos_importacao_nfe_rollback.sql

do $$
begin
  if to_regclass('public.equipamentos_movimentacoes') is null then
    raise exception 'v165 abortada: v164 (estoque) nao foi aplicada';
  end if;
end $$;

-- ── Cabeçalho da importação ─────────────────────────────────────────────────
create table if not exists public.equipamentos_importacoes_nfe (
  id_importacao   text primary key default gen_random_uuid()::text,
  id_unidade      text not null references public.unidades(id_unidade) on delete restrict,
  chnfe           text not null unique,        -- 44 dígitos, único no sistema
  fornecedor_cnpj text,
  fornecedor_nome text,
  numero_nf       text,
  data_emissao    date,
  valor_total     numeric(14,2),
  xml_nome        text,
  total_itens     int not null default 0,
  itens_lancados  int not null default 0,
  status          text not null default 'lancada',
  criado_por      text,
  criado_em       timestamptz not null default now()
);

-- ── Itens da nota (conferidos na tela antes de lançar) ──────────────────────
create table if not exists public.equipamentos_importacoes_nfe_itens (
  id_item        text primary key default gen_random_uuid()::text,
  id_importacao  text not null references public.equipamentos_importacoes_nfe(id_importacao) on delete cascade,
  id_unidade     text not null references public.unidades(id_unidade) on delete restrict,
  cprod          text,
  xprod          text,
  ncm            text,
  unidade_medida text,
  quantidade     numeric,
  valor_unitario numeric(14,2),
  id_catalogo    text references public.equipamentos_catalogo(id_catalogo) on delete set null,
  status_map     text not null default 'vinculado'
                 check (status_map in ('novo','vinculado','ignorado')),
  criado_em      timestamptz not null default now()
);

create index if not exists idx_equip_nfe_unidade on public.equipamentos_importacoes_nfe (id_unidade, criado_em desc);
create index if not exists idx_equip_nfe_itens   on public.equipamentos_importacoes_nfe_itens (id_importacao);

-- ── RLS append-only por base ────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['equipamentos_importacoes_nfe','equipamentos_importacoes_nfe_itens']
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

-- ── RPC atômica: importar NF-e ──────────────────────────────────────────────
create or replace function public.equipamento_importar_nfe(
  p_id_unidade      text,
  p_chnfe           text,
  p_fornecedor_cnpj text,
  p_fornecedor_nome text,
  p_numero_nf       text,
  p_data_emissao    date,
  p_valor_total     numeric,
  p_xml_nome        text,
  p_itens           jsonb
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_email    text := auth.jwt() ->> 'email';
  v_id_imp   text := gen_random_uuid()::text;
  v_item     jsonb;
  v_id_cat   text;
  v_qty      numeric;
  v_total    int := coalesce(jsonb_array_length(p_itens), 0);
  v_lancados int;
begin
  if not public.caller_pode_editar() then raise exception 'Sem permissão para importar NF-e.'; end if;
  if not public.caller_pode_equipamentos() then raise exception 'Módulo de equipamentos fora do seu acesso.'; end if;
  if not (public.caller_eh_admin() or p_id_unidade = any(public.caller_unidades())) then
    raise exception 'Base fora do seu acesso.';
  end if;

  if p_chnfe is null or length(regexp_replace(p_chnfe, '\D', '', 'g')) <> 44 then
    raise exception 'Chave da NF-e inválida (precisa de 44 dígitos).';
  end if;
  p_chnfe := regexp_replace(p_chnfe, '\D', '', 'g');

  -- Dedup explícito com mensagem legível. A unique da tabela é a garantia final;
  -- esta checagem existe para a pessoa entender o que aconteceu.
  if exists (select 1 from equipamentos_importacoes_nfe where chnfe = p_chnfe) then
    raise exception 'Esta NF-e já foi importada em % (nota %). Importar de novo duplicaria o saldo.',
      coalesce((select u.nome from equipamentos_importacoes_nfe i
                  join unidades u on u.id_unidade = i.id_unidade where i.chnfe = p_chnfe limit 1), 'outra base'),
      coalesce((select numero_nf from equipamentos_importacoes_nfe where chnfe = p_chnfe limit 1), '?');
  end if;

  v_lancados := (
    select count(*)::int from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb)) e
     where coalesce(e->>'status_map', '') = 'novo'
        or (coalesce(e->>'status_map', '') = 'vinculado' and nullif(e->>'id_catalogo', '') is not null)
  );

  insert into equipamentos_importacoes_nfe
    (id_importacao, id_unidade, chnfe, fornecedor_cnpj, fornecedor_nome, numero_nf,
     data_emissao, valor_total, xml_nome, total_itens, itens_lancados, status, criado_por)
  values
    (v_id_imp, p_id_unidade, p_chnfe, p_fornecedor_cnpj, p_fornecedor_nome, p_numero_nf,
     p_data_emissao, p_valor_total, p_xml_nome, v_total, v_lancados, 'lancada', v_email);

  for v_item in select * from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb)) loop
    if coalesce(v_item->>'status_map', '') = 'ignorado' then continue; end if;

    if coalesce(v_item->>'status_map', '') = 'novo' then
      v_id_cat := gen_random_uuid()::text;
      insert into equipamentos_catalogo (id_catalogo, nome, tipo, unidade_medida, controla_individual, criado_por)
      values (v_id_cat,
              coalesce(nullif(btrim(v_item->>'nome_novo'), ''), nullif(btrim(v_item->>'xprod'), ''), 'Item NF-e'),
              nullif(btrim(v_item->>'tipo'), ''),
              coalesce(nullif(btrim(v_item->>'unidade_medida'), ''), 'un'),
              coalesce((v_item->>'controla_individual')::boolean, true),
              v_email);
    else
      v_id_cat := nullif(v_item->>'id_catalogo', '');
      if v_id_cat is null then continue; end if;    -- vinculado sem destino → pula
    end if;

    insert into equipamentos_importacoes_nfe_itens
      (id_item, id_importacao, id_unidade, cprod, xprod, ncm, unidade_medida,
       quantidade, valor_unitario, id_catalogo, status_map)
    values
      (gen_random_uuid()::text, v_id_imp, p_id_unidade, v_item->>'cprod', v_item->>'xprod',
       v_item->>'ncm', v_item->>'unidade_medida',
       nullif(v_item->>'quantidade', '')::numeric, nullif(v_item->>'valor_unitario', '')::numeric,
       v_id_cat, coalesce(nullif(v_item->>'status_map', ''), 'vinculado'));

    v_qty := coalesce(nullif(v_item->>'quantidade', '')::numeric, 0);
    if v_qty > 0 then
      insert into equipamentos_movimentacoes
        (id_movimentacao, id_catalogo, id_unidade, tipo, quantidade, origem, ref_id, motivo, responsavel, criado_por)
      values
        (gen_random_uuid()::text, v_id_cat, p_id_unidade, 'entrada', v_qty, 'nf', p_chnfe,
         'Importação NF-e ' || coalesce(p_numero_nf, ''), p_fornecedor_nome, v_email);
    end if;
  end loop;

  return v_id_imp;
end $$;

grant execute on function public.equipamento_importar_nfe(text, text, text, text, text, date, numeric, text, jsonb) to authenticated;
