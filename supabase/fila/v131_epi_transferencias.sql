-- v131 — Gestão de EPI (Fase 5): transferência de EPI entre empresas.
--
-- SÓ EQUIPE INTERNA (caller_pode_editar). Tabelas APPEND-ONLY; a escrita via RPC atômica
-- epi_transferir (SECURITY DEFINER): valida acesso a origem+destino, valida saldo na
-- ORIGEM antes de gravar, cria/mapeia o item no destino e gera 'saida' na origem +
-- 'entrada' no destino (origem='transferencia'). Idempotente/reversível.

create table if not exists public.epi_transferencias (
  id              text primary key default gen_random_uuid()::text,
  empresa_origem  text not null references public.empresas(id_empresa) on delete cascade,
  empresa_destino text not null references public.empresas(id_empresa) on delete cascade,
  observacao      text,
  total_itens     int not null default 0,
  criado_por      text,
  criado_em       timestamptz not null default now()
);
create table if not exists public.epi_transferencias_itens (
  id                  text primary key default gen_random_uuid()::text,
  id_transferencia    text not null references public.epi_transferencias(id) on delete cascade,
  empresa_origem      text not null,
  empresa_destino     text not null,
  id_catalogo_origem  text references public.epi_catalogo(id) on delete set null,
  id_catalogo_destino text references public.epi_catalogo(id) on delete set null,
  nome_epi            text,
  quantidade          numeric not null check (quantidade > 0),
  criado_em           timestamptz not null default now()
);
create index if not exists idx_epi_transf_origem  on public.epi_transferencias(empresa_origem);
create index if not exists idx_epi_transf_destino on public.epi_transferencias(empresa_destino);
create index if not exists idx_epi_transf_itens_t on public.epi_transferencias_itens(id_transferencia);

-- RLS append-only: vê se enxerga qualquer um dos dois lados; escreve se interno e enxerga ambos
do $$
declare t text;
begin
  foreach t in array array['epi_transferencias','epi_transferencias_itens']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t||'_sel', t);
    execute format($f$create policy %I on public.%I for select to authenticated using (public.caller_pode_ver_empresa(empresa_origem) or public.caller_pode_ver_empresa(empresa_destino))$f$, t||'_sel', t);
    execute format('drop policy if exists %I on public.%I', t||'_ins', t);
    execute format($f$create policy %I on public.%I for insert to authenticated with check (public.caller_pode_editar() and public.caller_pode_ver_empresa(empresa_origem) and public.caller_pode_ver_empresa(empresa_destino))$f$, t||'_ins', t);
  end loop;
end $$;

create or replace function public.epi_transferir(
  p_empresa_origem text, p_empresa_destino text, p_observacao text, p_itens jsonb
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_email text := auth.jwt() ->> 'email';
  v_id    text := gen_random_uuid()::text;
  v_item  jsonb;
  v_agg   record;
  v_src   record;
  v_saldo numeric;
  v_cat_o text; v_cat_d text; v_qty numeric;
begin
  if not public.caller_pode_editar() then raise exception 'Sem permissão para transferir.'; end if;
  if p_empresa_origem = p_empresa_destino then raise exception 'Origem e destino devem ser diferentes.'; end if;
  if not public.caller_pode_ver_empresa(p_empresa_origem) then raise exception 'Empresa de origem fora do seu acesso.'; end if;
  if not public.caller_pode_ver_empresa(p_empresa_destino) then raise exception 'Empresa de destino fora do seu acesso.'; end if;
  if coalesce(jsonb_array_length(p_itens), 0) = 0 then raise exception 'Informe ao menos um item.'; end if;

  -- valida saldo na ORIGEM antes de qualquer escrita
  for v_agg in
    select e->>'id_catalogo_origem' as id_cat, sum(coalesce(nullif(e->>'quantidade','')::numeric, 0)) as req
    from jsonb_array_elements(p_itens) e group by e->>'id_catalogo_origem'
  loop
    if nullif(v_agg.id_cat, '') is null then raise exception 'Item de origem inválido.'; end if;
    if v_agg.req <= 0 then raise exception 'Quantidade inválida.'; end if;
    v_saldo := coalesce((select sum(case when tipo='saida' then -quantidade else quantidade end)
                         from epi_movimentacoes where id_catalogo = v_agg.id_cat and empresa_id = p_empresa_origem), 0);
    if v_saldo < v_agg.req then
      raise exception 'Saldo insuficiente na origem para "%": disponível %, solicitado %.',
        coalesce((select nome from epi_catalogo where id = v_agg.id_cat), v_agg.id_cat), v_saldo, v_agg.req;
    end if;
  end loop;

  insert into epi_transferencias (id, empresa_origem, empresa_destino, observacao, total_itens, criado_por)
  values (v_id, p_empresa_origem, p_empresa_destino, p_observacao, coalesce(jsonb_array_length(p_itens), 0), v_email);

  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_cat_o := nullif(v_item->>'id_catalogo_origem', '');
    v_qty := coalesce(nullif(v_item->>'quantidade', '')::numeric, 0);
    if v_cat_o is null or v_qty <= 0 then continue; end if;
    select nome, ca_numero, ca_validade, tipo, unidade into v_src from epi_catalogo where id = v_cat_o;

    v_cat_d := nullif(v_item->>'id_catalogo_destino', '');
    if v_cat_d is null then                                     -- cria no destino copiando da origem
      v_cat_d := gen_random_uuid()::text;
      insert into epi_catalogo (id, empresa_id, nome, tipo, ca_numero, ca_validade, unidade, criado_por)
      values (v_cat_d, p_empresa_destino, coalesce(v_src.nome, 'Item transferido'), coalesce(v_src.tipo, 'EPI'),
              v_src.ca_numero, v_src.ca_validade, v_src.unidade, v_email);
    end if;

    insert into epi_transferencias_itens (id, id_transferencia, empresa_origem, empresa_destino, id_catalogo_origem, id_catalogo_destino, nome_epi, quantidade)
    values (gen_random_uuid()::text, v_id, p_empresa_origem, p_empresa_destino, v_cat_o, v_cat_d, v_src.nome, v_qty);

    insert into epi_movimentacoes (id, empresa_id, id_catalogo, tipo, quantidade, origem, ref_id, motivo, criado_por)
    values (gen_random_uuid()::text, p_empresa_origem, v_cat_o, 'saida', v_qty, 'transferencia', v_id, 'Transferência para outra empresa', v_email);
    insert into epi_movimentacoes (id, empresa_id, id_catalogo, tipo, quantidade, origem, ref_id, motivo, criado_por)
    values (gen_random_uuid()::text, p_empresa_destino, v_cat_d, 'entrada', v_qty, 'transferencia', v_id, 'Transferência recebida', v_email);
  end loop;

  return v_id;
end $$;

grant execute on function public.epi_transferir(text, text, text, jsonb) to authenticated;
