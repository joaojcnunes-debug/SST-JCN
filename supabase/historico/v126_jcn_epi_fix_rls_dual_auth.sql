-- v126 (JCN) — EPI: correção de RLS/RPC para acesso DUAL (interno + cliente).
--
-- BUG: as policies e RPCs do EPI (v121–v125) usavam só o modelo Portal
-- (get_meu_perfil()/get_minhas_empresas()), que casa o usuário por
-- id_usuario = auth.uid(). A equipe interna (usuarios com id custom, ex.
-- USR_ADMIN_001) casa por EMAIL (auth.jwt()->>'email') via caller_*; logo o
-- Portal retornava perfil nulo/empresas vazias e o interno era barrado em TUDO
-- ("Você não tem permissão para esta ação"), inclusive na transferência.
--
-- FIX: políticas duais — interno (caller_pode_editar/caller_eh_admin/novo
-- epi_caller_interno, por email) OU cliente (get_minhas_empresas, por id).
-- RPCs passam a usar caller_pode_editar()/get_minhas_empresas() e
-- auth.jwt()->>'email' como autor. Idempotente/reversível.

-- Helper: qualquer usuário INTERNO ativo (por email) — leitura do módulo.
create or replace function public.epi_caller_interno()
  returns boolean language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.usuarios
    where lower(email) = lower(auth.jwt() ->> 'email') and ativo_sistema = true
  );
$$;
grant execute on function public.epi_caller_interno() to authenticated;

-- ============================================================
-- epi_colaboradores (CRUD)
-- ============================================================
drop policy if exists epi_colab_sel on public.epi_colaboradores;
create policy epi_colab_sel on public.epi_colaboradores for select to authenticated
  using (public.epi_caller_interno() or empresa_id = any(public.get_minhas_empresas()));
drop policy if exists epi_colab_ins on public.epi_colaboradores;
create policy epi_colab_ins on public.epi_colaboradores for insert to authenticated
  with check (public.caller_pode_editar() or empresa_id = any(public.get_minhas_empresas()));
drop policy if exists epi_colab_upd on public.epi_colaboradores;
create policy epi_colab_upd on public.epi_colaboradores for update to authenticated
  using (public.caller_pode_editar() or empresa_id = any(public.get_minhas_empresas()))
  with check (public.caller_pode_editar() or empresa_id = any(public.get_minhas_empresas()));
drop policy if exists epi_colab_del on public.epi_colaboradores;
create policy epi_colab_del on public.epi_colaboradores for delete to authenticated
  using (public.caller_eh_admin() or empresa_id = any(public.get_minhas_empresas()));

-- ============================================================
-- epi_catalogo (CRUD)
-- ============================================================
drop policy if exists epi_cat_sel on public.epi_catalogo;
create policy epi_cat_sel on public.epi_catalogo for select to authenticated
  using (public.epi_caller_interno() or empresa_id = any(public.get_minhas_empresas()));
drop policy if exists epi_cat_ins on public.epi_catalogo;
create policy epi_cat_ins on public.epi_catalogo for insert to authenticated
  with check (public.caller_pode_editar() or empresa_id = any(public.get_minhas_empresas()));
drop policy if exists epi_cat_upd on public.epi_catalogo;
create policy epi_cat_upd on public.epi_catalogo for update to authenticated
  using (public.caller_pode_editar() or empresa_id = any(public.get_minhas_empresas()))
  with check (public.caller_pode_editar() or empresa_id = any(public.get_minhas_empresas()));
drop policy if exists epi_cat_del on public.epi_catalogo;
create policy epi_cat_del on public.epi_catalogo for delete to authenticated
  using (public.caller_eh_admin() or empresa_id = any(public.get_minhas_empresas()));

-- ============================================================
-- epi_movimentacoes (append-only)
-- ============================================================
drop policy if exists epi_mov_sel on public.epi_movimentacoes;
create policy epi_mov_sel on public.epi_movimentacoes for select to authenticated
  using (public.epi_caller_interno() or empresa_id = any(public.get_minhas_empresas()));
drop policy if exists epi_mov_ins on public.epi_movimentacoes;
create policy epi_mov_ins on public.epi_movimentacoes for insert to authenticated
  with check (public.caller_pode_editar() or empresa_id = any(public.get_minhas_empresas()));

-- ============================================================
-- epi_importacoes_nfe + itens (append-only)
-- ============================================================
drop policy if exists epi_imp_sel on public.epi_importacoes_nfe;
create policy epi_imp_sel on public.epi_importacoes_nfe for select to authenticated
  using (public.epi_caller_interno() or empresa_id = any(public.get_minhas_empresas()));
drop policy if exists epi_imp_ins on public.epi_importacoes_nfe;
create policy epi_imp_ins on public.epi_importacoes_nfe for insert to authenticated
  with check (public.caller_pode_editar() or empresa_id = any(public.get_minhas_empresas()));

drop policy if exists epi_imp_it_sel on public.epi_importacoes_nfe_itens;
create policy epi_imp_it_sel on public.epi_importacoes_nfe_itens for select to authenticated
  using (public.epi_caller_interno() or empresa_id = any(public.get_minhas_empresas()));
drop policy if exists epi_imp_it_ins on public.epi_importacoes_nfe_itens;
create policy epi_imp_it_ins on public.epi_importacoes_nfe_itens for insert to authenticated
  with check (public.caller_pode_editar() or empresa_id = any(public.get_minhas_empresas()));

-- ============================================================
-- epi_entregas + itens (append-only)
-- ============================================================
drop policy if exists epi_ent_sel on public.epi_entregas;
create policy epi_ent_sel on public.epi_entregas for select to authenticated
  using (public.epi_caller_interno() or empresa_id = any(public.get_minhas_empresas()));
drop policy if exists epi_ent_ins on public.epi_entregas;
create policy epi_ent_ins on public.epi_entregas for insert to authenticated
  with check (public.caller_pode_editar() or empresa_id = any(public.get_minhas_empresas()));

drop policy if exists epi_ent_it_sel on public.epi_entregas_itens;
create policy epi_ent_it_sel on public.epi_entregas_itens for select to authenticated
  using (public.epi_caller_interno() or empresa_id = any(public.get_minhas_empresas()));
drop policy if exists epi_ent_it_ins on public.epi_entregas_itens;
create policy epi_ent_it_ins on public.epi_entregas_itens for insert to authenticated
  with check (public.caller_pode_editar() or empresa_id = any(public.get_minhas_empresas()));

-- ============================================================
-- epi_entrega_assinaturas (append-only)
-- ============================================================
drop policy if exists epi_ent_assin_sel on public.epi_entrega_assinaturas;
create policy epi_ent_assin_sel on public.epi_entrega_assinaturas for select to authenticated
  using (public.epi_caller_interno() or empresa_id = any(public.get_minhas_empresas()));
drop policy if exists epi_ent_assin_ins on public.epi_entrega_assinaturas;
create policy epi_ent_assin_ins on public.epi_entrega_assinaturas for insert to authenticated
  with check (public.caller_pode_editar() or empresa_id = any(public.get_minhas_empresas()));

-- ============================================================
-- epi_transferencias + itens (append-only; INSERT só interno)
-- ============================================================
drop policy if exists epi_transf_sel on public.epi_transferencias;
create policy epi_transf_sel on public.epi_transferencias for select to authenticated
  using (public.epi_caller_interno()
         or empresa_origem = any(public.get_minhas_empresas())
         or empresa_destino = any(public.get_minhas_empresas()));
drop policy if exists epi_transf_ins on public.epi_transferencias;
create policy epi_transf_ins on public.epi_transferencias for insert to authenticated
  with check (public.caller_pode_editar());

drop policy if exists epi_transf_it_sel on public.epi_transferencias_itens;
create policy epi_transf_it_sel on public.epi_transferencias_itens for select to authenticated
  using (public.epi_caller_interno()
         or empresa_origem = any(public.get_minhas_empresas())
         or empresa_destino = any(public.get_minhas_empresas()));
drop policy if exists epi_transf_it_ins on public.epi_transferencias_itens;
create policy epi_transf_it_ins on public.epi_transferencias_itens for insert to authenticated
  with check (public.caller_pode_editar());

-- ============================================================
-- RPCs — permissão dual + autor por email (auth.jwt)
-- ============================================================

create or replace function public.epi_importar_nfe(
  p_empresa_id text, p_chnfe text, p_fornecedor_cnpj text, p_fornecedor_nome text,
  p_numero_nf text, p_data_emissao date, p_xml_nome text, p_itens jsonb
) returns text language plpgsql security definer set search_path=public as $fn$
declare
  v_email  text := auth.jwt() ->> 'email';
  v_id_imp text := gen_random_uuid()::text;
  v_item jsonb; v_id_cat text; v_status text; v_qtd numeric; v_novo boolean;
  v_total int := coalesce(jsonb_array_length(p_itens), 0);
  v_lancados int;
begin
  if not (public.caller_pode_editar() or p_empresa_id = any(public.get_minhas_empresas())) then
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

create or replace function public.epi_registrar_entrega(
  p_empresa_id text, p_id_colaborador text, p_data_entrega date,
  p_responsavel text, p_observacao text, p_itens jsonb
) returns text language plpgsql security definer set search_path=public as $fn$
declare
  v_email  text := auth.jwt() ->> 'email';
  v_id     text := gen_random_uuid()::text;
  v_item jsonb; v_id_cat text; v_qtd numeric; v_saldo numeric; v_nome text; v_ca text;
  v_total int := 0;
begin
  if not (public.caller_pode_editar() or p_empresa_id = any(public.get_minhas_empresas())) then
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

create or replace function public.epi_assinar_entrega(
  p_id_entrega text, p_assinante_nome text, p_assinatura_png text,
  p_pdf_sha256 text, p_user_agent text
) returns text language plpgsql security definer set search_path=public as $fn$
declare
  v_email   text := auth.jwt() ->> 'email';
  v_id      text := gen_random_uuid()::text;
  v_empresa text; v_colab text; v_ip text;
begin
  select empresa_id, id_colaborador into v_empresa, v_colab
    from public.epi_entregas where id = p_id_entrega;
  if v_empresa is null then
    raise exception 'entrega não encontrada';
  end if;
  if not (public.caller_pode_editar() or v_empresa = any(public.get_minhas_empresas())) then
    raise exception 'sem permissão para assinar esta entrega';
  end if;
  if p_assinatura_png is null or length(p_assinatura_png) < 100 then
    raise exception 'assinatura ausente';
  end if;

  begin
    v_ip := coalesce(
      nullif(split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1), ''),
      current_setting('request.headers', true)::json->>'x-real-ip'
    );
  exception when others then
    v_ip := null;
  end;

  insert into public.epi_entrega_assinaturas
    (id, id_entrega, empresa_id, id_colaborador, assinante_nome, assinatura_png, pdf_sha256, user_agent, ip, criado_por)
  values
    (v_id, p_id_entrega, v_empresa, v_colab, p_assinante_nome, p_assinatura_png, p_pdf_sha256, p_user_agent, v_ip, v_email);

  return v_id;
end $fn$;

create or replace function public.epi_transferir(
  p_empresa_origem text, p_empresa_destino text, p_observacao text, p_itens jsonb
) returns text language plpgsql security definer set search_path=public as $fn$
declare
  v_email  text := auth.jwt() ->> 'email';
  v_id     text := gen_random_uuid()::text;
  v_item jsonb; v_orig text; v_dest text; v_qtd numeric; v_saldo numeric; v_novo boolean;
  v_nome text; v_total int := 0; v_rec public.epi_catalogo%rowtype;
begin
  if not public.caller_pode_editar() then
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
