-- v192 — Retiradas: emissão como ato, edição com histórico, cancelamento.
--
-- Reconferir o número imediatamente antes de aplicar: a v189 desta frente e a v190 da
-- Escala de Supervisores entraram no mesmo dia, e esta família já foi renumerada 2×.
--
-- ── O que existia, medido ────────────────────────────────────────────────────
-- `equipamentos_entregas` e `_itens` tinham policy só de INSERT e SELECT. Com RLS ligada
-- e sem policy de UPDATE/DELETE, o banco nega os dois por padrão — o GRANT presente não
-- valia nada. Ou seja: **editar e excluir não existiam**. O que existia era o buraco
-- oposto — INSERT com policy, então dava para acrescentar item numa retirada já assinada
-- sem deixar rastro (F3 do revisor, `INSERT 0 1` medido em produção).
--
-- ── As três coisas que esta migration decide ─────────────────────────────────
-- 1) EMISSÃO É UM ATO. Enquanto não emitida, o termo é rascunho e não aceita assinatura.
--    Sem isso o `conteudo_sha256` prenderia a assinatura a um rascunho que ainda vai
--    mudar — o oposto do que ele existe para fazer.
-- 2) EDIÇÃO PASSA POR RPC, com histórico. Depois de emitido ou assinado, exige motivo.
--    As assinaturas já dadas não somem: o hash delas deixa de bater e o termo denuncia.
-- 3) DOCUMENTO ASSINADO NÃO SE APAGA, SE CANCELA. Apagar destrói a prova que a biometria
--    existe para produzir. Cancelar diz "isto não vale mais e aqui está por quê"; apagar
--    diz "isto nunca existiu", que é falso. Decisão do operador em 01/09.

-- ── 1) Estado do documento ──────────────────────────────────────────────────
alter table public.equipamentos_entregas
  add column if not exists emitido_em       timestamptz,
  add column if not exists emitido_por      text,
  add column if not exists cancelado_em     timestamptz,
  add column if not exists cancelado_por    text,
  add column if not exists cancelado_motivo text;

-- ── 2) Histórico ────────────────────────────────────────────────────────────
-- Formato do `equipamentos_status_historico`, que o domínio já usa (anterior/novo +
-- motivo + e-mail), em vez de inventar um terceiro.
create table if not exists public.equipamentos_entregas_historico (
  id_historico  text primary key default gen_random_uuid()::text,
  id_entrega    text not null references public.equipamentos_entregas(id_entrega) on delete cascade,
  id_unidade    text not null,
  acao          text not null check (acao in ('emitiu','editou','item_add','item_edit','item_rem','cancelou','excluiu')),
  campo         text,
  valor_antes   text,
  valor_depois  text,
  motivo        text,
  usuario_email text,
  criado_em     timestamptz not null default now()
);
create index if not exists idx_equip_entrega_hist on public.equipamentos_entregas_historico (id_entrega, criado_em);

alter table public.equipamentos_entregas_historico enable row level security;
revoke all on public.equipamentos_entregas_historico from authenticated, anon, service_role;
-- Leitura sim (o termo e a tela mostram); escrita NUNCA pelo cliente.
-- Histórico que o usuário pode escrever não é histórico.
grant select on public.equipamentos_entregas_historico to authenticated;
drop policy if exists equip_entregas_hist_sel on public.equipamentos_entregas_historico;
create policy equip_entregas_hist_sel on public.equipamentos_entregas_historico
  for select to authenticated using (
    public.caller_eh_admin()
    or (public.caller_pode_equipamentos() and id_unidade = any(public.caller_unidades()))
  );

-- Gravador do histórico. SEM grant nenhum: só o owner alcança, e as RPCs abaixo são
-- `security definer` do mesmo owner. Não existe caminho do cliente até aqui.
create or replace function public.equip_entrega_hist(
  p_id_entrega text, p_acao text, p_campo text, p_antes text, p_depois text, p_motivo text
) returns void
language plpgsql security definer set search_path = public as $fn$
begin
  insert into equipamentos_entregas_historico
    (id_entrega, id_unidade, acao, campo, valor_antes, valor_depois, motivo, usuario_email)
  select p_id_entrega, e.id_unidade, p_acao, p_campo, p_antes, p_depois,
         nullif(btrim(coalesce(p_motivo,'')),''), auth.jwt() ->> 'email'
    from equipamentos_entregas e where e.id_entrega = p_id_entrega;
end $fn$;
-- `service_role` no revoke também: o default ACL desta base concede EXECUTE a
-- {anon, authenticated, service_role}, e omiti-lo deixava a frase acima ("só o owner
-- alcança") verdadeira sobre o cliente e falsa sobre a chave do servidor.
revoke all on function public.equip_entrega_hist(text, text, text, text, text, text) from public, anon, authenticated, service_role;

-- Guarda comum: quem mexe, e o documento aceita mexida?
-- `volatile` e não `stable`, de propósito: ela toma `for update` na linha. Declarar
-- `stable` seria mentir sobre a volatilidade — e a trava é o que fecha a corrida entre
-- ler o estado e agir sobre ele (emitir concorrente comitando no meio de um excluir).
create or replace function public.equip_entrega_guarda(p_id_entrega text)
returns table (id_unidade text, emitido boolean, assinada boolean, cancelada boolean)
language plpgsql security definer set search_path = public as $fn$
declare v_unidade text; v_emit timestamptz; v_canc timestamptz;
begin
  select e.id_unidade, e.emitido_em, e.cancelado_em into v_unidade, v_emit, v_canc
    from equipamentos_entregas e where e.id_entrega = p_id_entrega for update;
  if v_unidade is null then raise exception 'Retirada não encontrada.'; end if;
  if not (public.caller_pode_editar() and public.caller_pode_equipamentos()) then
    raise exception 'Seu perfil não pode alterar retiradas.';
  end if;
  if not (public.caller_eh_admin() or v_unidade = any(public.caller_unidades())) then
    raise exception 'Base fora do seu acesso.';
  end if;
  if v_canc is not null then
    raise exception 'Esta retirada está cancelada. Cancelamento não se desfaz por edição.';
  end if;
  return query select v_unidade, v_emit is not null,
                      exists(select 1 from equipamentos_entrega_assinaturas a where a.id_entrega = p_id_entrega),
                      false;
end $fn$;
revoke all on function public.equip_entrega_guarda(text) from public, anon, authenticated, service_role;

-- ── 3) Emitir ───────────────────────────────────────────────────────────────
create or replace function public.equip_entrega_emitir(p_id_entrega text)
returns void
language plpgsql security definer set search_path = public as $fn$
declare g record;
begin
  select * into g from public.equip_entrega_guarda(p_id_entrega);
  if g.emitido then raise exception 'Esta retirada já foi emitida.'; end if;
  if not exists (select 1 from equipamentos_entregas_itens where id_entrega = p_id_entrega) then
    raise exception 'Não dá para emitir um termo sem nenhum item.';
  end if;
  update equipamentos_entregas
     set emitido_em = now(), emitido_por = auth.jwt() ->> 'email'
   where id_entrega = p_id_entrega;
  perform public.equip_entrega_hist(p_id_entrega, 'emitiu', null, null, null, null);
end $fn$;

-- ── 4) Editar cabeçalho ─────────────────────────────────────────────────────
-- Convenção dos parâmetros: `null` = não mexer neste campo; string vazia = limpar.
-- Sem isso não haveria como distinguir "não quero mexer" de "quero apagar".
create or replace function public.equip_entrega_editar(
  p_id_entrega           text,
  p_observacao           text default null,
  p_data_entrega         date default null,
  p_responsavel_entrega  text default null,
  p_motivo               text default null
) returns void
language plpgsql security definer set search_path = public as $fn$
declare g record; v_ant record; v_motivo text := nullif(btrim(coalesce(p_motivo,'')),'');
begin
  select * into g from public.equip_entrega_guarda(p_id_entrega);
  -- Depois de emitido ou assinado, alteração é ADITAMENTO: sem motivo, não passa.
  -- Antes disso é montagem do documento, e exigir motivo seria atrito sem informação.
  if (g.emitido or g.assinada) and v_motivo is null then
    raise exception 'Esta retirada já foi emitida: descreva o motivo da alteração.';
  end if;

  select observacao, data_entrega, responsavel_entrega into v_ant
    from equipamentos_entregas where id_entrega = p_id_entrega;

  if p_observacao is not null and p_observacao is distinct from v_ant.observacao then
    update equipamentos_entregas set observacao = nullif(p_observacao,'') where id_entrega = p_id_entrega;
    perform public.equip_entrega_hist(p_id_entrega,'editou','observacao',v_ant.observacao,nullif(p_observacao,''),v_motivo);
  end if;
  if p_data_entrega is not null and p_data_entrega is distinct from v_ant.data_entrega then
    update equipamentos_entregas set data_entrega = p_data_entrega where id_entrega = p_id_entrega;
    perform public.equip_entrega_hist(p_id_entrega,'editou','data_entrega',v_ant.data_entrega::text,p_data_entrega::text,v_motivo);
  end if;
  if p_responsavel_entrega is not null and p_responsavel_entrega is distinct from v_ant.responsavel_entrega then
    update equipamentos_entregas set responsavel_entrega = nullif(p_responsavel_entrega,'') where id_entrega = p_id_entrega;
    perform public.equip_entrega_hist(p_id_entrega,'editou','responsavel_entrega',v_ant.responsavel_entrega,nullif(p_responsavel_entrega,''),v_motivo);
  end if;
end $fn$;

-- ── 5) Itens ────────────────────────────────────────────────────────────────
create or replace function public.equip_entrega_item_upsert(
  p_id_entrega        text,
  p_id_item           text default null,   -- null = item novo
  p_nome_equipamento  text default null,
  p_numero_serie      text default null,
  p_numero_patrimonio text default null,
  p_quantidade        numeric default 1,
  p_motivo            text default null
) returns text
language plpgsql security definer set search_path = public as $fn$
declare g record; v_id text; v_ant record; v_motivo text := nullif(btrim(coalesce(p_motivo,'')),'');
begin
  select * into g from public.equip_entrega_guarda(p_id_entrega);
  if (g.emitido or g.assinada) and v_motivo is null then
    raise exception 'Esta retirada já foi emitida: descreva o motivo da alteração.';
  end if;
  if coalesce(btrim(coalesce(p_nome_equipamento,'')),'') = '' then
    raise exception 'O item precisa de descrição.';
  end if;
  if coalesce(p_quantidade, 0) <= 0 then raise exception 'Quantidade tem de ser maior que zero.'; end if;

  if p_id_item is null then
    v_id := gen_random_uuid()::text;
    insert into equipamentos_entregas_itens
      (id_item, id_entrega, id_unidade, nome_equipamento, numero_serie, numero_patrimonio, quantidade, criado_em)
    values (v_id, p_id_entrega, g.id_unidade, p_nome_equipamento,
            nullif(btrim(coalesce(p_numero_serie,'')),''), nullif(btrim(coalesce(p_numero_patrimonio,'')),''),
            p_quantidade, now());
    perform public.equip_entrega_hist(p_id_entrega,'item_add','item',null,
      p_nome_equipamento||' ('||p_quantidade::text||')', v_motivo);
  else
    select * into v_ant from equipamentos_entregas_itens where id_item = p_id_item and id_entrega = p_id_entrega;
    if not found then raise exception 'Item não encontrado nesta retirada.'; end if;
    update equipamentos_entregas_itens
       set nome_equipamento = p_nome_equipamento,
           numero_serie = nullif(btrim(coalesce(p_numero_serie,'')),''),
           numero_patrimonio = nullif(btrim(coalesce(p_numero_patrimonio,'')),''),
           quantidade = p_quantidade
     where id_item = p_id_item;
    v_id := p_id_item;
    perform public.equip_entrega_hist(p_id_entrega,'item_edit','item',
      v_ant.nome_equipamento||' ('||v_ant.quantidade::text||')',
      p_nome_equipamento||' ('||p_quantidade::text||')', v_motivo);
  end if;

  -- `total_itens` não acompanhava a contagem real — era o detector de graça que o
  -- revisor apontou no F3. Se o campo existe, ele tem de ser verdade.
  update equipamentos_entregas
     set total_itens = (select count(*) from equipamentos_entregas_itens where id_entrega = p_id_entrega)
   where id_entrega = p_id_entrega;
  return v_id;
end $fn$;

create or replace function public.equip_entrega_item_remover(p_id_item text, p_motivo text default null)
returns void
language plpgsql security definer set search_path = public as $fn$
declare g record; v_ent text; v_ant record; v_motivo text := nullif(btrim(coalesce(p_motivo,'')),'');
begin
  select id_entrega into v_ent from equipamentos_entregas_itens where id_item = p_id_item;
  if v_ent is null then raise exception 'Item não encontrado.'; end if;
  select * into g from public.equip_entrega_guarda(v_ent);
  if (g.emitido or g.assinada) and v_motivo is null then
    raise exception 'Esta retirada já foi emitida: descreva o motivo da remoção.';
  end if;
  select * into v_ant from equipamentos_entregas_itens where id_item = p_id_item;
  delete from equipamentos_entregas_itens where id_item = p_id_item;
  perform public.equip_entrega_hist(v_ent,'item_rem','item',
    v_ant.nome_equipamento||' ('||v_ant.quantidade::text||')', null, v_motivo);
  update equipamentos_entregas
     set total_itens = (select count(*) from equipamentos_entregas_itens where id_entrega = v_ent)
   where id_entrega = v_ent;
end $fn$;

-- ── 6) Cancelar e excluir ───────────────────────────────────────────────────
create or replace function public.equip_entrega_cancelar(p_id_entrega text, p_motivo text)
returns void
language plpgsql security definer set search_path = public as $fn$
declare g record; v_motivo text := nullif(btrim(coalesce(p_motivo,'')),'');
begin
  select * into g from public.equip_entrega_guarda(p_id_entrega);
  -- Decisão do operador em 01/09: cancelar e excluir são de ADMIN. `caller_pode_editar()`
  -- alcançava 33 pessoas — e três delas eram Técnicos promovidos temporariamente para
  -- escrever análises químicas, que ganhariam o botão de anular termo de equipamento como
  -- efeito colateral de uma promoção dada por outro motivo. Técnico monta, edita e emite;
  -- desfazer documento fica com quem responde por ele.
  if not public.caller_eh_admin() then
    raise exception 'Só um administrador cancela um termo de retirada.';
  end if;
  if v_motivo is null then raise exception 'Cancelamento exige motivo.'; end if;
  -- Rascunho não se cancela: se cancelasse, ficaria congelado para sempre (não edita, não
  -- assina, não exclui, e não existe descancelar). Rascunho errado se exclui.
  if not (g.emitido or g.assinada) then
    raise exception 'Esta retirada ainda é rascunho. Exclua-a em vez de cancelar.';
  end if;
  update equipamentos_entregas
     set cancelado_em = now(), cancelado_por = auth.jwt() ->> 'email', cancelado_motivo = v_motivo
   where id_entrega = p_id_entrega;
  perform public.equip_entrega_hist(p_id_entrega,'cancelou',null,null,null,v_motivo);
end $fn$;

create or replace function public.equip_entrega_excluir(p_id_entrega text, p_motivo text default null)
returns void
language plpgsql security definer set search_path = public as $fn$
declare g record; v_resumo text;
begin
  select * into g from public.equip_entrega_guarda(p_id_entrega);
  -- Admin, pela mesma razão do cancelar: apagar é o ato menos reversível do módulo.
  if not public.caller_eh_admin() then
    raise exception 'Só um administrador exclui uma retirada.';
  end if;
  -- Devolução aponta para a retirada com `on delete set null`: apagar a retirada
  -- órfanaria a devolução em silêncio. Improvável em rascunho, mas custa um `exists`.
  if exists (select 1 from equipamentos_devolucoes d where d.id_entrega = p_id_entrega) then
    raise exception 'Esta retirada tem devolução vinculada e não pode ser excluída.';
  end if;
  -- A recusa que importa, e ela é deliberada: documento com assinatura biométrica não
  -- se apaga. Apagar destrói exatamente a prova que a biometria existe para produzir.
  if g.assinada then
    raise exception 'Esta retirada tem assinatura biométrica e não pode ser excluída. Use o cancelamento, que preserva o registro.';
  end if;
  if g.emitido then
    raise exception 'Esta retirada já foi emitida. Use o cancelamento, que preserva o registro.';
  end if;

  select 'entrega '||e.id_entrega||' | unidade '||e.id_unidade||' | colaborador '||e.id_colaborador
         ||' | data '||e.data_entrega::text||' | itens '||
         coalesce((select string_agg(i.nome_equipamento||' x'||i.quantidade::text, '; ')
                     from equipamentos_entregas_itens i where i.id_entrega = e.id_entrega), '(nenhum)')
    into v_resumo
    from equipamentos_entregas e where e.id_entrega = p_id_entrega;

  -- Rastro em tabela SEPARADA, que sobrevive ao delete. O histórico próprio cascateia
  -- junto com a linha — então ele não serve para registrar a própria exclusão.
  insert into document_audit_logs (id, modulo, id_referencia, acao, descricao, usuario_email, metadata, created_at)
  values (gen_random_uuid(), 'equipamentos', p_id_entrega, 'excluiu_retirada', v_resumo,
          auth.jwt() ->> 'email',
          jsonb_build_object('motivo', nullif(btrim(coalesce(p_motivo,'')),''), 'unidade', g.id_unidade),
          now());

  delete from equipamentos_entregas where id_entrega = p_id_entrega;
end $fn$;

-- NO JCN: o bloco que redefinia equipamento_assinar_entrega_digital foi
-- removido daqui. Ele e o caminho da DIGITAL e depende da cadeia da v188
-- (epi_bio_key, colaboradores_chabra_biometria, equip_biometria_sondas), que
-- nao e portavel: a chave vem de current_setting('app.epi_bio_key'), posta por
-- ALTER DATABASE no self-host. Todo o resto desta migration e independente de
-- biometria e e o que a tela RetiradaGerenciarModal usa.

-- ── 8) O INSERT direto de item só vale enquanto é rascunho ──────────────────
-- Fecha o F3: a policy antiga não olhava o estado do documento, então dava para
-- acrescentar item numa retirada já assinada, direto pelo PostgREST, sem rastro.
-- Continua permitindo a criação normal (montar a retirada é INSERT de item em rascunho).
drop policy if exists equipamentos_entregas_itens_ins on public.equipamentos_entregas_itens;
create policy equipamentos_entregas_itens_ins on public.equipamentos_entregas_itens
  for insert to authenticated
  with check (
    public.caller_pode_editar() and public.caller_pode_equipamentos()
    and (public.caller_eh_admin() or id_unidade = any(public.caller_unidades()))
    and exists (
      select 1 from public.equipamentos_entregas e
       where e.id_entrega = equipamentos_entregas_itens.id_entrega
         and e.emitido_em is null and e.cancelado_em is null
    )
  );

-- ── 9) As retiradas que já existem ──────────────────────────────────────────
-- Sem isto, a regra "assinar exige emitido" viraria retroativa e a retirada de teste do
-- operador deixaria de aceitar assinatura. Marcadas como emitidas, com `emitido_por`
-- dizendo de onde veio: dado histórico não pode ser reescrito para fingir que o campo
-- sempre existiu.
update public.equipamentos_entregas e
   set emitido_em = coalesce(e.emitido_em, e.criado_em),
       emitido_por = coalesce(e.emitido_por, 'migração v192 — anterior à emissão explícita')
 where e.emitido_em is null
   and (exists (select 1 from equipamentos_entrega_assinaturas a where a.id_entrega = e.id_entrega)
        or exists (select 1 from equipamentos_entregas_itens i where i.id_entrega = e.id_entrega));

-- ── 10) Grants ──────────────────────────────────────────────────────────────
-- O default ACL desta base concede EXECUTE a PUBLIC e `anon` em toda função nova.
revoke all on function public.equip_entrega_emitir(text) from public, anon;
grant execute on function public.equip_entrega_emitir(text) to authenticated;
revoke all on function public.equip_entrega_editar(text, text, date, text, text) from public, anon;
grant execute on function public.equip_entrega_editar(text, text, date, text, text) to authenticated;
revoke all on function public.equip_entrega_item_upsert(text, text, text, text, text, numeric, text) from public, anon;
grant execute on function public.equip_entrega_item_upsert(text, text, text, text, text, numeric, text) to authenticated;
revoke all on function public.equip_entrega_item_remover(text, text) from public, anon;
grant execute on function public.equip_entrega_item_remover(text, text) to authenticated;
revoke all on function public.equip_entrega_cancelar(text, text) from public, anon;
grant execute on function public.equip_entrega_cancelar(text, text) to authenticated;
revoke all on function public.equip_entrega_excluir(text, text) from public, anon;
grant execute on function public.equip_entrega_excluir(text, text) to authenticated;

