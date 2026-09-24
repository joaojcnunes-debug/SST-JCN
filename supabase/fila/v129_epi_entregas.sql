-- v129 — Gestão de EPI (Fase 3): entrega física + itens (base da ficha PDF).
--
-- Tabelas APPEND-ONLY por empresa; a escrita real via RPC atômica epi_registrar_entrega
-- (SECURITY DEFINER): valida permissão + colaborador↔empresa, VALIDA O SALDO DE TODOS OS
-- ITENS ANTES DE GRAVAR (sem estoque negativo), grava ficha+itens (snapshot de nome/CA) e
-- dá 'saida' em epi_movimentacoes (origem='entrega'). Idempotente/reversível.

-- ── Cabeçalho da entrega ─────────────────────────────────────────────────────
create table if not exists public.epi_entregas (
  id                  text primary key default gen_random_uuid()::text,
  empresa_id          text not null references public.empresas(id_empresa) on delete cascade,
  id_colaborador      text not null references public.epi_colaboradores(id) on delete restrict,
  data_entrega        date not null default current_date,
  responsavel_entrega text,
  observacao          text,
  total_itens         int not null default 0,
  status              text not null default 'registrada',
  assinatura_recebedor text,
  criado_por          text,
  criado_em           timestamptz not null default now()
);

-- ── Itens da entrega (snapshot de nome/CA no momento) ────────────────────────
create table if not exists public.epi_entregas_itens (
  id          text primary key default gen_random_uuid()::text,
  id_entrega  text not null references public.epi_entregas(id) on delete cascade,
  empresa_id  text not null references public.empresas(id_empresa) on delete cascade,
  id_catalogo text references public.epi_catalogo(id) on delete set null,
  nome_epi    text,
  ca_numero   text,
  quantidade  numeric not null check (quantidade > 0),
  criado_em   timestamptz not null default now()
);

create index if not exists idx_epi_entregas_empresa on public.epi_entregas(empresa_id);
create index if not exists idx_epi_entregas_colab   on public.epi_entregas(id_colaborador);
create index if not exists idx_epi_entregas_itens_e on public.epi_entregas_itens(id_entrega);

-- ── RLS append-only por empresa ──────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['epi_entregas','epi_entregas_itens']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t||'_sel', t);
    execute format($f$create policy %I on public.%I for select to authenticated using (public.caller_pode_ver_empresa(empresa_id))$f$, t||'_sel', t);
    execute format('drop policy if exists %I on public.%I', t||'_ins', t);
    execute format($f$create policy %I on public.%I for insert to authenticated with check (public.caller_pode_editar() and public.caller_pode_ver_empresa(empresa_id))$f$, t||'_ins', t);
  end loop;
end $$;

-- ── RPC atômica: registrar entrega (valida saldo, dá baixa) ───────────────────
create or replace function public.epi_registrar_entrega(
  p_empresa_id text, p_id_colaborador text, p_data_entrega date,
  p_responsavel text, p_observacao text, p_itens jsonb
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_email text := auth.jwt() ->> 'email';
  v_id    text := gen_random_uuid()::text;
  v_item  jsonb;
  v_agg   record;
  v_saldo numeric;
  v_id_cat text;
  v_qty   numeric;
begin
  if not public.caller_pode_editar() then raise exception 'Sem permissão para registrar entrega.'; end if;
  if not public.caller_pode_ver_empresa(p_empresa_id) then raise exception 'Empresa fora do seu acesso.'; end if;
  if not exists (select 1 from epi_colaboradores where id = p_id_colaborador and empresa_id = p_empresa_id) then
    raise exception 'Colaborador não pertence a esta empresa.';
  end if;
  if coalesce(jsonb_array_length(p_itens), 0) = 0 then raise exception 'Informe ao menos um item.'; end if;

  -- valida saldo de TODOS os itens ANTES de qualquer escrita (agrega por item)
  for v_agg in
    select e->>'id_catalogo' as id_catalogo,
           sum(coalesce(nullif(e->>'quantidade','')::numeric, 0)) as req
    from jsonb_array_elements(p_itens) e
    group by e->>'id_catalogo'
  loop
    if nullif(v_agg.id_catalogo,'') is null then raise exception 'Item sem produto do catálogo.'; end if;
    if v_agg.req <= 0 then raise exception 'Quantidade inválida.'; end if;
    v_saldo := coalesce((select sum(case when tipo='saida' then -quantidade else quantidade end)
                         from epi_movimentacoes where id_catalogo = v_agg.id_catalogo and empresa_id = p_empresa_id), 0);
    if v_saldo < v_agg.req then
      raise exception 'Saldo insuficiente para "%": disponível %, solicitado %.',
        coalesce((select nome from epi_catalogo where id = v_agg.id_catalogo), v_agg.id_catalogo), v_saldo, v_agg.req;
    end if;
  end loop;

  insert into epi_entregas (id, empresa_id, id_colaborador, data_entrega, responsavel_entrega, observacao, total_itens, status, criado_por)
  values (v_id, p_empresa_id, p_id_colaborador, coalesce(p_data_entrega, current_date), p_responsavel, p_observacao,
          coalesce(jsonb_array_length(p_itens), 0), 'registrada', v_email);

  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_id_cat := nullif(v_item->>'id_catalogo','');
    v_qty := coalesce(nullif(v_item->>'quantidade','')::numeric, 0);
    if v_id_cat is null or v_qty <= 0 then continue; end if;

    insert into epi_entregas_itens (id, id_entrega, empresa_id, id_catalogo, nome_epi, ca_numero, quantidade)
    values (gen_random_uuid()::text, v_id, p_empresa_id, v_id_cat,
            coalesce(nullif(v_item->>'nome_epi',''), (select nome from epi_catalogo where id = v_id_cat)),
            coalesce(nullif(v_item->>'ca_numero',''), (select ca_numero from epi_catalogo where id = v_id_cat)),
            v_qty);

    insert into epi_movimentacoes (id, empresa_id, id_catalogo, tipo, quantidade, origem, ref_id, motivo, responsavel, criado_por)
    values (gen_random_uuid()::text, p_empresa_id, v_id_cat, 'saida', v_qty, 'entrega', v_id,
            'Entrega de EPI ao colaborador', p_responsavel, v_email);
  end loop;

  return v_id;
end $$;

grant execute on function public.epi_registrar_entrega(text, text, date, text, text, jsonb) to authenticated;
