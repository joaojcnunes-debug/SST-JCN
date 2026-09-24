-- v122 (JCN) — EPI Fase 2: importação de NF-e (XML). Aplicado via MCP. Idempotente/reversível.
-- Cabeçalho + itens (APPEND-ONLY: só select+insert; sem update/delete). Dedup por (empresa_id, chNFe).
-- Entrada no estoque via RPC atômica (SECURITY DEFINER): mapear existente / criar novo / ignorar,
-- sem estado parcial. itens_lancados é pré-calculado (sem UPDATE no cabeçalho).

create table if not exists public.epi_importacoes_nfe (
  id              text primary key,
  empresa_id      text not null references public.empresas(id_empresa) on delete cascade,
  chnfe           text not null,
  fornecedor_cnpj text,
  fornecedor_nome text,
  numero_nf       text,
  data_emissao    date,
  xml_nome        text,
  total_itens     integer not null default 0,
  itens_lancados  integer not null default 0,
  status          text not null default 'importada',
  criado_por      text,
  criado_em       timestamptz not null default now(),
  unique (empresa_id, chnfe)
);
create index if not exists idx_epi_imp_empresa on public.epi_importacoes_nfe (empresa_id, criado_em desc);

create table if not exists public.epi_importacoes_nfe_itens (
  id             text primary key,
  id_importacao  text not null references public.epi_importacoes_nfe(id) on delete cascade,
  empresa_id     text not null references public.empresas(id_empresa) on delete cascade,
  cprod          text,
  xprod          text,
  ncm            text,
  unidade        text,
  quantidade     numeric not null default 0,
  valor_unitario numeric,
  id_catalogo    text references public.epi_catalogo(id) on delete set null,
  status_map     text not null default 'pendente',
  criado_em      timestamptz not null default now()
);
create index if not exists idx_epi_imp_itens_imp on public.epi_importacoes_nfe_itens (id_importacao);

alter table public.epi_importacoes_nfe       enable row level security;
alter table public.epi_importacoes_nfe_itens enable row level security;

drop policy if exists epi_imp_sel on public.epi_importacoes_nfe;
create policy epi_imp_sel on public.epi_importacoes_nfe for select to authenticated
  using (public.get_meu_perfil() in ('Admin','Tecnico','Visualizador') or empresa_id = any(public.get_minhas_empresas()));
drop policy if exists epi_imp_ins on public.epi_importacoes_nfe;
create policy epi_imp_ins on public.epi_importacoes_nfe for insert to authenticated
  with check (public.get_meu_perfil() in ('Admin','Tecnico') or empresa_id = any(public.get_minhas_empresas()));

drop policy if exists epi_imp_it_sel on public.epi_importacoes_nfe_itens;
create policy epi_imp_it_sel on public.epi_importacoes_nfe_itens for select to authenticated
  using (public.get_meu_perfil() in ('Admin','Tecnico','Visualizador') or empresa_id = any(public.get_minhas_empresas()));
drop policy if exists epi_imp_it_ins on public.epi_importacoes_nfe_itens;
create policy epi_imp_it_ins on public.epi_importacoes_nfe_itens for insert to authenticated
  with check (public.get_meu_perfil() in ('Admin','Tecnico') or empresa_id = any(public.get_minhas_empresas()));

create or replace function public.epi_importar_nfe(
  p_empresa_id text, p_chnfe text, p_fornecedor_cnpj text, p_fornecedor_nome text,
  p_numero_nf text, p_data_emissao date, p_xml_nome text, p_itens jsonb
) returns text language plpgsql security definer set search_path=public as $fn$
declare
  v_perfil text := public.get_meu_perfil();
  v_email  text := (select email from public.usuarios where id_usuario = (auth.uid())::text limit 1);
  v_id_imp text := gen_random_uuid()::text;
  v_item jsonb; v_id_cat text; v_status text; v_qtd numeric; v_novo boolean;
  v_total int := coalesce(jsonb_array_length(p_itens), 0);
  v_lancados int;
begin
  if not (v_perfil in ('Admin','Tecnico') or p_empresa_id = any(public.get_minhas_empresas())) then
    raise exception 'sem permissão para importar NF nesta empresa';
  end if;
  if p_chnfe is null or length(regexp_replace(p_chnfe,'\D','','g')) <> 44 then
    raise exception 'chNFe inválida';
  end if;
  if exists (select 1 from public.epi_importacoes_nfe where empresa_id = p_empresa_id and chnfe = p_chnfe) then
    raise exception 'NF já importada (chNFe %)', p_chnfe using errcode = 'unique_violation';
  end if;

  select count(*) into v_lancados
  from jsonb_array_elements(p_itens) as t(value)
  where coalesce(value->>'status_map','pendente') = 'lancado'
    and coalesce((value->>'quantidade')::numeric, 0) > 0
    and (nullif(value->>'id_catalogo','') is not null or coalesce((value->>'criar_novo')::boolean, false));

  insert into public.epi_importacoes_nfe (id, empresa_id, chnfe, fornecedor_cnpj, fornecedor_nome, numero_nf, data_emissao, xml_nome, total_itens, itens_lancados, status, criado_por)
    values (v_id_imp, p_empresa_id, p_chnfe, p_fornecedor_cnpj, p_fornecedor_nome, p_numero_nf, p_data_emissao, p_xml_nome, v_total, v_lancados, 'importada', v_email);

  for v_item in select value from jsonb_array_elements(p_itens) as t(value) loop
    v_id_cat := nullif(v_item->>'id_catalogo','');
    v_status := coalesce(v_item->>'status_map','pendente');
    v_qtd    := coalesce((v_item->>'quantidade')::numeric, 0);
    v_novo   := coalesce((v_item->>'criar_novo')::boolean, false);

    if v_status = 'lancado' and v_id_cat is null and v_novo then
      v_id_cat := gen_random_uuid()::text;
      insert into public.epi_catalogo (id, empresa_id, nome, tipo, unidade, criado_por)
        values (v_id_cat, p_empresa_id, coalesce(nullif(v_item->>'xprod',''),'Item NF-e'),
                'EPI', coalesce(nullif(v_item->>'unidade',''),'un'), v_email);
    end if;

    insert into public.epi_importacoes_nfe_itens (id, id_importacao, empresa_id, cprod, xprod, ncm, unidade, quantidade, valor_unitario, id_catalogo, status_map)
      values (gen_random_uuid()::text, v_id_imp, p_empresa_id, v_item->>'cprod', v_item->>'xprod', v_item->>'ncm',
              v_item->>'unidade', v_qtd, nullif(v_item->>'valor_unitario','')::numeric, v_id_cat, v_status);

    if v_status = 'lancado' and v_id_cat is not null and v_qtd > 0 then
      insert into public.epi_movimentacoes (id, empresa_id, id_catalogo, tipo, quantidade, origem, ref_id, motivo, responsavel, criado_por)
        values (gen_random_uuid()::text, p_empresa_id, v_id_cat, 'entrada', v_qtd, 'nfe', p_chnfe,
                'Importação NF-e ' || coalesce(p_numero_nf,''), v_email, v_email);
    end if;
  end loop;

  return v_id_imp;
end $fn$;

grant execute on function public.epi_importar_nfe(text,text,text,text,text,date,text,jsonb) to authenticated;
