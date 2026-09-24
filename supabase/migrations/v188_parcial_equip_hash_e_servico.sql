-- v188 (PARCIAL, so no JCN) — as duas pecas portaveis da biometria de tres papeis.
--
-- A v188 do painel monta a cadeia de biometria do modulo Equipamentos e reusa
-- public.epi_bio_key(), que le current_setting('app.epi_bio_key') — chave posta
-- por ALTER DATABASE no self-host. No JCN essa chave nao existe, e inventar uma
-- seria decidir por conta propria onde guardar um segredo. Entao a v188 inteira
-- fica FORA e este arquivo traz so o que nao depende dela e do que a v192
-- precisa para funcionar:
--
--   caller_eh_servico()          — a chamada veio do servidor (service_role)?
--   equip_hash_conteudo_entrega  — impressao digital do CONTEUDO do termo, para
--                                  o documento denunciar item acrescentado
--                                  depois da emissao.
--
-- Ficam de fora, e so voltam se a chave for definida: colaboradores_chabra_biometria,
-- equip_validador_unidade, equip_biometria_sondas, equip_biometria_tentativas,
-- equip_definir_validador, equip_bio_* , equip_cadastrar_biometria,
-- equip_obter_biometria e equipamento_assinar_entrega_digital. Com isso,
-- tambem fica fora a v189 (equipe de entrega), que so aceita alguem na equipe
-- se a pessoa ja tiver digital cadastrada.
--
-- O recorte de acesso de equip_hash_conteudo_entrega e o mesmo da policy de
-- SELECT das entregas: sem ele, a funcao viraria oraculo de existencia de
-- retirada de outra base.

create or replace function public.caller_eh_servico() returns boolean
language sql stable set search_path = public as $fn$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role', ''
  ) = 'service_role';
$fn$;

create or replace function public.equip_hash_conteudo_entrega(p_id_entrega text)
returns text
language plpgsql stable security definer set search_path = public, extensions as $fn$
declare v_unidade text;
begin
  select id_unidade into v_unidade from equipamentos_entregas where id_entrega = p_id_entrega;
  if v_unidade is null then return null; end if;
  if not (public.caller_eh_servico()
          or public.caller_eh_admin()
          or (public.caller_pode_equipamentos() and v_unidade = any(public.caller_unidades()))) then
    raise exception 'Base fora do seu acesso.';
  end if;

  return encode(digest(
    coalesce((
      select e.id_entrega || '|' || e.id_unidade || '|' || e.id_colaborador
             || '|' || e.data_entrega::text
             || '|' || coalesce(e.responsavel_entrega, '')
             || '|' || coalesce(e.observacao, '')
             || '|' || e.status
        from equipamentos_entregas e
       where e.id_entrega = p_id_entrega
    ), '')
    || '#' ||
    coalesce((
      select string_agg(
               i.id_item || ':' || coalesce(i.nome_equipamento, '')
               || ':' || coalesce(i.numero_serie, '')
               || ':' || coalesce(i.numero_patrimonio, '')
               || ':' || i.quantidade::text,
               '|' order by i.id_item)
        from equipamentos_entregas_itens i
       where i.id_entrega = p_id_entrega
    ), ''),
  'sha256'), 'hex');
end $fn$;

revoke all on function public.equip_hash_conteudo_entrega(text) from public, anon;
grant execute on function public.equip_hash_conteudo_entrega(text) to authenticated, service_role;
revoke all on function public.caller_eh_servico() from public, anon;
grant execute on function public.caller_eh_servico() to authenticated, service_role;

notify pgrst, 'reload schema';
