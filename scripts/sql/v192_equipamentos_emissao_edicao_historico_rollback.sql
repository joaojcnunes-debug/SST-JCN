-- ROLLBACK da v192 — volta ao estado da v189: sem emissão, sem edição, sem histórico.
--
-- ⚠️  O que isto faz, e é bem mais do que "desfazer":
--
-- 1) APAGA O HISTÓRICO DE ALTERAÇÕES de todas as retiradas. É a única cópia — o
--    `document_audit_logs` só guarda EXCLUSÕES, não edições. Se algum termo já foi
--    emitido, alterado e assinado, o registro de "o que mudou e por quê" some, e o termo
--    volta a mostrar só o resultado final sem dizer que houve alteração.
--    Se a intenção é só "parar de usar", não rode isto.
--
-- 2) REABRE o INSERT direto de item em retirada já emitida/assinada (o F3), porque
--    restaura a policy antiga, que não olhava o estado do documento.
--
-- 3) Retiradas ficam sem `emitido_em`, e a regra "assinar exige emitido" some junto —
--    coerente, mas quer dizer que rascunho volta a aceitar assinatura.

begin;

drop function if exists public.equip_entrega_excluir(text, text);
drop function if exists public.equip_entrega_cancelar(text, text);
drop function if exists public.equip_entrega_item_remover(text, text);
drop function if exists public.equip_entrega_item_upsert(text, text, text, text, text, numeric, text);
drop function if exists public.equip_entrega_editar(text, text, date, text, text);
drop function if exists public.equip_entrega_emitir(text);
drop function if exists public.equip_entrega_guarda(text);
drop function if exists public.equip_entrega_hist(text, text, text, text, text, text);

drop table if exists public.equipamentos_entregas_historico;   -- ⚠️ única cópia do histórico

-- A POLICY SAI ANTES DAS COLUNAS, e a ordem não é estilo: a policy da v192 referencia
-- `emitido_em`, então `drop column` falha com "other objects depend on it" enquanto ela
-- existir. Descoberto rodando o rollback, não lendo — e é justamente o tipo de erro que
-- só aparece na hora em que se precisa dele.
drop policy if exists equipamentos_entregas_itens_ins on public.equipamentos_entregas_itens;

alter table public.equipamentos_entregas
  drop column if exists emitido_em,
  drop column if exists emitido_por,
  drop column if exists cancelado_em,
  drop column if exists cancelado_por,
  drop column if exists cancelado_motivo;

-- A policy de INSERT de item como estava antes da v192 (capturada de produção).
-- ⚠️ Ver aviso (2): ela não olha o estado do documento.
create policy equipamentos_entregas_itens_ins on public.equipamentos_entregas_itens
  for insert to authenticated
  with check (
    public.caller_pode_editar() and public.caller_pode_equipamentos()
    and (public.caller_eh_admin() or id_unidade = any(public.caller_unidades()))
  );

-- A função de assinatura como estava na v189, sem as guardas de emitido/cancelado.
create or replace function public.equipamento_assinar_entrega_digital(
  p_id_entrega     text,
  p_papel          text,
  p_id_colaborador text,
  p_assinante_nome text,
  p_conteudo_hash  text,
  p_user_agent     text,
  p_ip             text,
  p_match_score    numeric,
  p_threshold      numeric,
  p_sonda_sha256   text,
  p_criado_por     text
) returns text
language plpgsql security definer set search_path = public, extensions as $fn$
declare
  v_unidade text; v_colab_entrega text;
  v_id text := gen_random_uuid()::text;
  v_papel text := coalesce(nullif(btrim(p_papel), ''), 'recebe');
  v_hash_real text;
  v_consent timestamptz;
  v_amostras text[];
begin
  if not public.caller_eh_servico() then
    raise exception 'Assinatura digital só pode ser gravada pelo servidor.';
  end if;
  if v_papel not in ('envia','recebe','valida') then
    raise exception 'Papel inválido: %.', v_papel;
  end if;
  if p_match_score is null then
    raise exception 'Score ausente — sem comparação, sem assinatura.';
  end if;
  if p_threshold is null then
    raise exception 'Limiar ausente — score sem limiar não afirma nada.';
  end if;
  if p_match_score < p_threshold then
    raise exception 'Score % abaixo do limiar %.', p_match_score, p_threshold;
  end if;
  if coalesce(btrim(p_sonda_sha256), '') = '' then
    raise exception 'Leitura sem identificação — sonda não registrada.';
  end if;

  select id_unidade, id_colaborador into v_unidade, v_colab_entrega
    from equipamentos_entregas where id_entrega = p_id_entrega;
  if not found then raise exception 'Entrega não encontrada.'; end if;

  if not exists (select 1 from colaboradores_chabra where id_colaborador = p_id_colaborador) then
    raise exception 'Colaborador não encontrado.';
  end if;

  if v_papel = 'recebe' then
    if p_id_colaborador is distinct from v_colab_entrega then
      raise exception 'No papel "recebe" quem assina é o colaborador da própria retirada.';
    end if;
  else
    if not exists (select 1 from equip_equipe_entrega e
                     join colaboradores_chabra c on c.id_colaborador = e.id_colaborador
                    where e.id_colaborador = p_id_colaborador and c.ativo) then
      raise exception 'Só a equipe de entrega ativa assina o papel "%".', v_papel;
    end if;
    if p_id_colaborador = v_colab_entrega then
      raise exception 'Quem recebe o equipamento não pode assinar como "%".', v_papel;
    end if;
  end if;

  if exists (select 1 from equipamentos_entrega_assinaturas
              where id_entrega = p_id_entrega and id_colaborador = p_id_colaborador
                and papel <> v_papel and (papel = 'recebe' or v_papel = 'recebe')) then
    raise exception 'Quem recebe não pode assinar outro papel nesta retirada.';
  end if;
  if exists (select 1 from equipamentos_entrega_assinaturas
              where id_entrega = p_id_entrega and papel = v_papel) then
    raise exception 'O papel "%" já foi assinado nesta entrega.', v_papel;
  end if;

  select amostras_sha256 into v_amostras
    from colaboradores_chabra_biometria where id_colaborador = p_id_colaborador;
  if v_amostras is not null and p_sonda_sha256 = any(v_amostras) then
    raise exception 'A leitura enviada é idêntica a uma amostra de cadastro. Capture o dedo agora.';
  end if;
  if exists (select 1 from equip_biometria_sondas where sonda_sha256 = p_sonda_sha256) then
    raise exception 'Esta leitura já foi usada em outra assinatura. Capture o dedo agora.';
  end if;

  v_hash_real := public.equip_hash_conteudo_entrega(p_id_entrega);
  if nullif(btrim(coalesce(p_conteudo_hash, '')), '') is not null
     and p_conteudo_hash <> v_hash_real then
    raise exception 'A retirada mudou enquanto você assinava. Reabra e confira antes de assinar.';
  end if;

  select consentimento_em into v_consent
    from colaboradores_chabra_biometria where id_colaborador = p_id_colaborador;

  insert into equipamentos_entrega_assinaturas
    (id_assinatura, id_entrega, id_unidade, id_colaborador, assinante_nome, papel, metodo,
     assinatura_png, pdf_sha256, conteudo_sha256, user_agent, ip, consentimento_em,
     match_score, finger_verificado, criado_por)
  values
    (v_id, p_id_entrega, v_unidade, p_id_colaborador,
     coalesce(nullif(btrim(p_assinante_nome), ''),
              (select nome from colaboradores_chabra where id_colaborador = p_id_colaborador)),
     v_papel, 'digital', null, null, v_hash_real, p_user_agent, p_ip, v_consent,
     p_match_score, true, p_criado_por);

  insert into equip_biometria_sondas (sonda_sha256, id_colaborador, id_entrega, papel)
  values (p_sonda_sha256, p_id_colaborador, p_id_entrega, v_papel);

  return v_id;
end $fn$;

revoke all on function public.equipamento_assinar_entrega_digital(text, text, text, text, text, text, text, numeric, numeric, text, text) from public, anon, authenticated;
grant execute on function public.equipamento_assinar_entrega_digital(text, text, text, text, text, text, text, numeric, numeric, text, text) to service_role;

delete from schema_migrations where version = 'v192_equipamentos_emissao_edicao_historico';

commit;

-- Depois: `docker restart painel-sst-postgrest` e testar rota de DADOS, não /health.
-- E redeploy da imagem anterior à v192 — a tela nova chama RPCs que deixam de existir.
