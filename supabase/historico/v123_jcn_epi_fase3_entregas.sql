-- v123 (JCN) — EPI Fase 3: entregas físicas de EPI (ficha de entrega). Aplicado via MCP.
-- Cabeçalho + itens APPEND-ONLY (só select+insert). Baixa de estoque via RPC
-- atômica (SECURITY DEFINER): valida saldo de cada item ANTES de escrever;
-- sem estado parcial. Movimentação 'saida' origem='entrega', ref_id=id_entrega.
-- Idempotente/reversível (create if not exists + drop policy if exists).

create table if not exists public.epi_entregas (
  id                  text primary key,
  empresa_id          text not null references public.empresas(id_empresa) on delete cascade,
  id_colaborador      text not null references public.epi_colaboradores(id) on delete restrict,
  data_entrega        date not null default current_date,
  responsavel_entrega text,
  observacao          text,
  total_itens         integer not null default 0,
  status              text not null default 'entregue',
  -- reservado p/ Fase 4 (biometria/não-repúdio): hash do PDF + assinatura do recebedor
  assinatura_recebedor text,
  criado_por          text,
  criado_em           timestamptz not null default now()
);
create index if not exists idx_epi_entregas_empresa on public.epi_entregas (empresa_id, data_entrega desc);
create index if not exists idx_epi_entregas_colab on public.epi_entregas (id_colaborador);

create table if not exists public.epi_entregas_itens (
  id            text primary key,
  id_entrega    text not null references public.epi_entregas(id) on delete cascade,
  empresa_id    text not null references public.empresas(id_empresa) on delete cascade,
  id_catalogo   text not null references public.epi_catalogo(id) on delete restrict,
  nome_epi      text,      -- snapshot do nome no momento da entrega
  ca_numero     text,      -- snapshot do CA no momento da entrega
  quantidade    numeric not null check (quantidade > 0),
  criado_em     timestamptz not null default now()
);
create index if not exists idx_epi_entregas_itens_ent on public.epi_entregas_itens (id_entrega);

alter table public.epi_entregas       enable row level security;
alter table public.epi_entregas_itens enable row level security;

drop policy if exists epi_ent_sel on public.epi_entregas;
create policy epi_ent_sel on public.epi_entregas for select to authenticated
  using (public.get_meu_perfil() in ('Admin','Tecnico','Visualizador') or empresa_id = any(public.get_minhas_empresas()));
drop policy if exists epi_ent_ins on public.epi_entregas;
create policy epi_ent_ins on public.epi_entregas for insert to authenticated
  with check (public.get_meu_perfil() in ('Admin','Tecnico') or empresa_id = any(public.get_minhas_empresas()));

drop policy if exists epi_ent_it_sel on public.epi_entregas_itens;
create policy epi_ent_it_sel on public.epi_entregas_itens for select to authenticated
  using (public.get_meu_perfil() in ('Admin','Tecnico','Visualizador') or empresa_id = any(public.get_minhas_empresas()));
drop policy if exists epi_ent_it_ins on public.epi_entregas_itens;
create policy epi_ent_it_ins on public.epi_entregas_itens for insert to authenticated
  with check (public.get_meu_perfil() in ('Admin','Tecnico') or empresa_id = any(public.get_minhas_empresas()));

create or replace function public.epi_registrar_entrega(
  p_empresa_id text, p_id_colaborador text, p_data_entrega date,
  p_responsavel text, p_observacao text, p_itens jsonb
) returns text language plpgsql security definer set search_path=public as $fn$
declare
  v_perfil text := public.get_meu_perfil();
  v_email  text := (select email from public.usuarios where id_usuario = (auth.uid())::text limit 1);
  v_id     text := gen_random_uuid()::text;
  v_item jsonb; v_id_cat text; v_qtd numeric; v_saldo numeric; v_nome text; v_ca text;
  v_total int := 0;
begin
  if not (v_perfil in ('Admin','Tecnico') or p_empresa_id = any(public.get_minhas_empresas())) then
    raise exception 'sem permissão para registrar entrega nesta empresa';
  end if;
  if p_id_colaborador is null or not exists (
    select 1 from public.epi_colaboradores where id = p_id_colaborador and empresa_id = p_empresa_id
  ) then
    raise exception 'colaborador inválido para esta empresa';
  end if;
  if p_itens is null or jsonb_array_length(p_itens) = 0 then
    raise exception 'informe ao menos um item para a entrega';
  end if;

  -- valida saldo de TODOS os itens antes de qualquer escrita (sem estoque negativo)
  for v_item in select value from jsonb_array_elements(p_itens) as t(value) loop
    v_id_cat := nullif(v_item->>'id_catalogo','');
    v_qtd := coalesce((v_item->>'quantidade')::numeric, 0);
    if v_id_cat is null or v_qtd <= 0 then
      raise exception 'item inválido (EPI/quantidade)';
    end if;
    select coalesce(sum(case when tipo='entrada' then quantidade
                             when tipo='saida'   then -quantidade
                             else 0 end), 0)
      into v_saldo
      from public.epi_movimentacoes
      where empresa_id = p_empresa_id and id_catalogo = v_id_cat;
    if v_saldo < v_qtd then
      select nome into v_nome from public.epi_catalogo where id = v_id_cat;
      raise exception 'saldo insuficiente de % (disponível %, solicitado %)',
        coalesce(v_nome, 'EPI'), v_saldo, v_qtd;
    end if;
    v_total := v_total + 1;
  end loop;

  insert into public.epi_entregas (id, empresa_id, id_colaborador, data_entrega, responsavel_entrega, observacao, total_itens, status, criado_por)
    values (v_id, p_empresa_id, p_id_colaborador, coalesce(p_data_entrega, current_date), p_responsavel, p_observacao, v_total, 'entregue', v_email);

  for v_item in select value from jsonb_array_elements(p_itens) as t(value) loop
    v_id_cat := v_item->>'id_catalogo';
    v_qtd := (v_item->>'quantidade')::numeric;
    select nome, ca_numero into v_nome, v_ca from public.epi_catalogo where id = v_id_cat;
    insert into public.epi_entregas_itens (id, id_entrega, empresa_id, id_catalogo, nome_epi, ca_numero, quantidade)
      values (gen_random_uuid()::text, v_id, p_empresa_id, v_id_cat, v_nome, v_ca, v_qtd);
    insert into public.epi_movimentacoes (id, empresa_id, id_catalogo, tipo, quantidade, origem, ref_id, motivo, responsavel, criado_por)
      values (gen_random_uuid()::text, p_empresa_id, v_id_cat, 'saida', v_qtd, 'entrega', v_id,
              'Entrega de EPI', p_responsavel, v_email);
  end loop;

  return v_id;
end $fn$;

grant execute on function public.epi_registrar_entrega(text,text,date,text,text,jsonb) to authenticated;
