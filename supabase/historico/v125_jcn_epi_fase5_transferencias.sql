-- v125 (JCN) — EPI Fase 5: transferência de estoque entre empresas. Aplicado via MCP.
-- Header + itens APPEND-ONLY. Operação atômica via RPC SECURITY DEFINER: valida
-- saldo na origem ANTES de escrever, cria/mapeia item no destino, e gera as duas
-- movimentações (saida na origem + entrada no destino). SÓ equipe interna.
-- Idempotente/reversível (create if not exists + drop policy if exists).

create table if not exists public.epi_transferencias (
  id              text primary key,
  empresa_origem  text not null references public.empresas(id_empresa) on delete cascade,
  empresa_destino text not null references public.empresas(id_empresa) on delete cascade,
  observacao      text,
  total_itens     integer not null default 0,
  criado_por      text,
  criado_em       timestamptz not null default now()
);
create index if not exists idx_epi_transf_origem on public.epi_transferencias (empresa_origem, criado_em desc);
create index if not exists idx_epi_transf_destino on public.epi_transferencias (empresa_destino, criado_em desc);

create table if not exists public.epi_transferencias_itens (
  id                 text primary key,
  id_transferencia   text not null references public.epi_transferencias(id) on delete cascade,
  empresa_origem     text not null references public.empresas(id_empresa) on delete cascade,
  empresa_destino    text not null references public.empresas(id_empresa) on delete cascade,
  id_catalogo_origem  text not null references public.epi_catalogo(id) on delete restrict,
  id_catalogo_destino text not null references public.epi_catalogo(id) on delete restrict,
  nome_epi           text,
  quantidade         numeric not null check (quantidade > 0),
  criado_em          timestamptz not null default now()
);
create index if not exists idx_epi_transf_itens on public.epi_transferencias_itens (id_transferencia);

alter table public.epi_transferencias       enable row level security;
alter table public.epi_transferencias_itens enable row level security;

-- SELECT: interno vê tudo; cliente vê transferências em que sua empresa é origem OU destino.
drop policy if exists epi_transf_sel on public.epi_transferencias;
create policy epi_transf_sel on public.epi_transferencias for select to authenticated
  using (public.get_meu_perfil() in ('Admin','Tecnico','Visualizador')
         or empresa_origem = any(public.get_minhas_empresas())
         or empresa_destino = any(public.get_minhas_empresas()));
-- INSERT: só equipe interna (transferência não é ação do cliente).
drop policy if exists epi_transf_ins on public.epi_transferencias;
create policy epi_transf_ins on public.epi_transferencias for insert to authenticated
  with check (public.get_meu_perfil() in ('Admin','Tecnico'));

drop policy if exists epi_transf_it_sel on public.epi_transferencias_itens;
create policy epi_transf_it_sel on public.epi_transferencias_itens for select to authenticated
  using (public.get_meu_perfil() in ('Admin','Tecnico','Visualizador')
         or empresa_origem = any(public.get_minhas_empresas())
         or empresa_destino = any(public.get_minhas_empresas()));
drop policy if exists epi_transf_it_ins on public.epi_transferencias_itens;
create policy epi_transf_it_ins on public.epi_transferencias_itens for insert to authenticated
  with check (public.get_meu_perfil() in ('Admin','Tecnico'));

create or replace function public.epi_transferir(
  p_empresa_origem text, p_empresa_destino text, p_observacao text, p_itens jsonb
) returns text language plpgsql security definer set search_path=public as $fn$
declare
  v_perfil text := public.get_meu_perfil();
  v_email  text := (select email from public.usuarios where id_usuario = (auth.uid())::text limit 1);
  v_id     text := gen_random_uuid()::text;
  v_item jsonb; v_orig text; v_dest text; v_qtd numeric; v_saldo numeric; v_novo boolean;
  v_nome text; v_total int := 0; v_rec public.epi_catalogo%rowtype;
begin
  if v_perfil not in ('Admin','Tecnico') then
    raise exception 'transferência restrita à equipe interna';
  end if;
  if p_empresa_origem is null or p_empresa_destino is null then
    raise exception 'informe as empresas de origem e destino';
  end if;
  if p_empresa_origem = p_empresa_destino then
    raise exception 'origem e destino devem ser diferentes';
  end if;
  if p_itens is null or jsonb_array_length(p_itens) = 0 then
    raise exception 'informe ao menos um item';
  end if;

  -- valida saldo de TODOS os itens antes de qualquer escrita
  for v_item in select value from jsonb_array_elements(p_itens) as t(value) loop
    v_orig := nullif(v_item->>'id_catalogo_origem','');
    v_qtd  := coalesce((v_item->>'quantidade')::numeric, 0);
    if v_orig is null or v_qtd <= 0 then raise exception 'item inválido'; end if;
    if not exists (select 1 from public.epi_catalogo where id = v_orig and empresa_id = p_empresa_origem) then
      raise exception 'item de origem inválido para a empresa';
    end if;
    select coalesce(sum(case when tipo='entrada' then quantidade when tipo='saida' then -quantidade else 0 end), 0)
      into v_saldo from public.epi_movimentacoes where empresa_id = p_empresa_origem and id_catalogo = v_orig;
    if v_saldo < v_qtd then
      select nome into v_nome from public.epi_catalogo where id = v_orig;
      raise exception 'saldo insuficiente de % (disponível %, solicitado %)', coalesce(v_nome,'EPI'), v_saldo, v_qtd;
    end if;
    v_total := v_total + 1;
  end loop;

  insert into public.epi_transferencias (id, empresa_origem, empresa_destino, observacao, total_itens, criado_por)
    values (v_id, p_empresa_origem, p_empresa_destino, p_observacao, v_total, v_email);

  for v_item in select value from jsonb_array_elements(p_itens) as t(value) loop
    v_orig := v_item->>'id_catalogo_origem';
    v_qtd  := (v_item->>'quantidade')::numeric;
    v_dest := nullif(v_item->>'id_catalogo_destino','');
    v_novo := coalesce((v_item->>'criar_no_destino')::boolean, false);

    if v_dest is null then
      if not v_novo then raise exception 'defina o destino de cada item (existente ou novo)'; end if;
      select * into v_rec from public.epi_catalogo where id = v_orig;
      v_dest := gen_random_uuid()::text;
      insert into public.epi_catalogo (id, empresa_id, nome, tipo, ca_numero, ca_validade, fabricante, descricao, unidade, estoque_minimo, criado_por)
        values (v_dest, p_empresa_destino, v_rec.nome, v_rec.tipo, v_rec.ca_numero, v_rec.ca_validade, v_rec.fabricante, v_rec.descricao, v_rec.unidade, coalesce(v_rec.estoque_minimo, 0), v_email);
    else
      if not exists (select 1 from public.epi_catalogo where id = v_dest and empresa_id = p_empresa_destino) then
        raise exception 'item de destino inválido para a empresa';
      end if;
    end if;

    select nome into v_nome from public.epi_catalogo where id = v_orig;

    insert into public.epi_transferencias_itens (id, id_transferencia, empresa_origem, empresa_destino, id_catalogo_origem, id_catalogo_destino, nome_epi, quantidade)
      values (gen_random_uuid()::text, v_id, p_empresa_origem, p_empresa_destino, v_orig, v_dest, v_nome, v_qtd);

    insert into public.epi_movimentacoes (id, empresa_id, id_catalogo, tipo, quantidade, origem, ref_id, motivo, responsavel, criado_por)
      values (gen_random_uuid()::text, p_empresa_origem, v_orig, 'saida', v_qtd, 'transferencia', v_id, 'Transferência (saída)', v_email, v_email);
    insert into public.epi_movimentacoes (id, empresa_id, id_catalogo, tipo, quantidade, origem, ref_id, motivo, responsavel, criado_por)
      values (gen_random_uuid()::text, p_empresa_destino, v_dest, 'entrada', v_qtd, 'transferencia', v_id, 'Transferência (entrada)', v_email, v_email);
  end loop;

  return v_id;
end $fn$;

grant execute on function public.epi_transferir(text,text,text,jsonb) to authenticated;
