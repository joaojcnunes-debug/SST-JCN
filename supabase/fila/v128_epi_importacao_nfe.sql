-- v128 — Gestão de EPI (Fase 2): importação de NF-e (XML).
--
-- Tabelas APPEND-ONLY (SELECT + INSERT) por empresa; a escrita real acontece via a
-- RPC atômica epi_importar_nfe (SECURITY DEFINER): valida permissão, chNFe e dedup,
-- cria itens novos no catálogo se marcado, insere cabeçalho + itens e dá 'entrada'
-- em epi_movimentacoes (origem='nfe', ref_id=chNFe). Idempotente/reversível.

-- ── Cabeçalho da importação ──────────────────────────────────────────────────
create table if not exists public.epi_importacoes_nfe (
  id              text primary key default gen_random_uuid()::text,
  empresa_id      text not null references public.empresas(id_empresa) on delete cascade,
  chnfe           text not null,
  fornecedor_cnpj text,
  fornecedor_nome text,
  numero_nf       text,
  data_emissao    date,
  xml_nome        text,
  total_itens     int not null default 0,
  itens_lancados  int not null default 0,
  status          text not null default 'lancada',
  criado_por      text,
  criado_em       timestamptz not null default now(),
  unique (empresa_id, chnfe)
);

-- ── Itens da importação ──────────────────────────────────────────────────────
create table if not exists public.epi_importacoes_nfe_itens (
  id             text primary key default gen_random_uuid()::text,
  id_importacao  text not null references public.epi_importacoes_nfe(id) on delete cascade,
  empresa_id     text not null references public.empresas(id_empresa) on delete cascade,
  cprod          text,
  xprod          text,
  ncm            text,
  unidade        text,
  quantidade     numeric,
  valor_unitario numeric,
  id_catalogo    text references public.epi_catalogo(id) on delete set null,
  status_map     text,                          -- 'novo' | 'vinculado' | 'ignorado'
  criado_em      timestamptz not null default now()
);

create index if not exists idx_epi_imp_empresa on public.epi_importacoes_nfe(empresa_id);
create index if not exists idx_epi_imp_itens_imp on public.epi_importacoes_nfe_itens(id_importacao);

-- ── RLS append-only por empresa (padrão da Fase 1) ───────────────────────────
do $$
declare t text;
begin
  foreach t in array array['epi_importacoes_nfe','epi_importacoes_nfe_itens']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t||'_sel', t);
    execute format($f$create policy %I on public.%I for select to authenticated using (public.caller_pode_ver_empresa(empresa_id))$f$, t||'_sel', t);
    execute format('drop policy if exists %I on public.%I', t||'_ins', t);
    execute format($f$create policy %I on public.%I for insert to authenticated with check (public.caller_pode_editar() and public.caller_pode_ver_empresa(empresa_id))$f$, t||'_ins', t);
  end loop;
end $$;

-- ── RPC atômica ──────────────────────────────────────────────────────────────
create or replace function public.epi_importar_nfe(
  p_empresa_id text, p_chnfe text, p_fornecedor_cnpj text, p_fornecedor_nome text,
  p_numero_nf text, p_data_emissao date, p_xml_nome text, p_itens jsonb
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
  if not public.caller_pode_ver_empresa(p_empresa_id) then raise exception 'Empresa fora do seu acesso.'; end if;
  if p_chnfe is null or length(regexp_replace(p_chnfe, '\D', '', 'g')) <> 44 then
    raise exception 'Chave da NF-e inválida (precisa de 44 dígitos).';
  end if;
  p_chnfe := regexp_replace(p_chnfe, '\D', '', 'g');
  if exists (select 1 from epi_importacoes_nfe where empresa_id = p_empresa_id and chnfe = p_chnfe) then
    raise exception 'Esta NF-e já foi importada nesta empresa.';
  end if;

  -- itens que serão lançados (novo, ou vinculado com item existente)
  v_lancados := (select count(*)::int from jsonb_array_elements(coalesce(p_itens,'[]'::jsonb)) e
    where coalesce(e->>'status_map','') = 'novo'
       or (coalesce(e->>'status_map','') = 'vinculado' and nullif(e->>'id_catalogo','') is not null));

  -- cabeçalho primeiro (FK dos itens); itens_lancados pré-calculado (sem UPDATE)
  insert into epi_importacoes_nfe
    (id, empresa_id, chnfe, fornecedor_cnpj, fornecedor_nome, numero_nf, data_emissao, xml_nome, total_itens, itens_lancados, status, criado_por)
  values
    (v_id_imp, p_empresa_id, p_chnfe, p_fornecedor_cnpj, p_fornecedor_nome, p_numero_nf, p_data_emissao, p_xml_nome, v_total, v_lancados, 'lancada', v_email);

  for v_item in select * from jsonb_array_elements(coalesce(p_itens,'[]'::jsonb)) loop
    if coalesce(v_item->>'status_map','') = 'ignorado' then continue; end if;

    if coalesce(v_item->>'status_map','') = 'novo' then
      v_id_cat := gen_random_uuid()::text;
      insert into epi_catalogo (id, empresa_id, nome, tipo, unidade, criado_por)
      values (v_id_cat, p_empresa_id,
              coalesce(nullif(trim(v_item->>'nome_novo'),''), nullif(trim(v_item->>'xprod'),''), 'Item NF-e'),
              'EPI', v_item->>'unidade', v_email);
    else
      v_id_cat := nullif(v_item->>'id_catalogo','');
      if v_id_cat is null then continue; end if;   -- vinculado sem destino → pula
    end if;

    insert into epi_importacoes_nfe_itens
      (id, id_importacao, empresa_id, cprod, xprod, ncm, unidade, quantidade, valor_unitario, id_catalogo, status_map)
    values
      (gen_random_uuid()::text, v_id_imp, p_empresa_id, v_item->>'cprod', v_item->>'xprod', v_item->>'ncm',
       v_item->>'unidade', nullif(v_item->>'quantidade','')::numeric, nullif(v_item->>'valor_unitario','')::numeric,
       v_id_cat, coalesce(v_item->>'status_map','vinculado'));

    v_qty := coalesce(nullif(v_item->>'quantidade','')::numeric, 0);
    if v_qty > 0 then
      insert into epi_movimentacoes (id, empresa_id, id_catalogo, tipo, quantidade, origem, ref_id, motivo, responsavel, criado_por)
      values (gen_random_uuid()::text, p_empresa_id, v_id_cat, 'entrada', v_qty, 'nfe', p_chnfe,
              'Importação NF-e ' || coalesce(p_numero_nf,''), p_fornecedor_nome, v_email);
    end if;
  end loop;

  return v_id_imp;
end $$;

grant execute on function public.epi_importar_nfe(text, text, text, text, text, date, text, jsonb) to authenticated;
