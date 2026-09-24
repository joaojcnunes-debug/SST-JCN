-- ROLLBACK da v175 — o aceite de transferência volta a escrever SÓ no inventário.
--
-- ⚠️ LEIA ANTES DE RODAR.
--   Desfazer isto REINTRODUZ a divergência silenciosa que a v175 fechou: com o
--   módulo /equipamentos no ar, aceitar uma transferência passaria a mudar a
--   base apenas na tabela antiga, e o módulo novo seguiria mostrando a base
--   velha — sem erro em tela nenhuma.
--
--   Só faz sentido rodar isto se o módulo /equipamentos tiver sido removido, ou
--   se a transferência tiver sido movida de vez para a tabela nova (aí a função
--   certa é outra, que escreve só em `equipamentos`).
--
-- Restaura a definição exata que estava em produção antes de 2026-08-11.

create or replace function public.transferencia_aceitar(
  p_id text,
  p_assinatura_png text,
  p_pdf_sha256 text default null::text,
  p_user_agent text default null::text,
  p_ip text default null::text,
  p_consentimento boolean default false
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  t public.transferencias;
  me text := lower(auth.jwt() ->> 'email');
  v_nome text;
begin
  select * into t from public.transferencias
   where id_transferencia = p_id and status = 'pendente' for update;
  if not found then raise exception 'Transferência já finalizada por outra pessoa'; end if;

  if lower(coalesce(t.para_usuario_email,'')) <> me and not public.caller_eh_admin() then
    raise exception 'Só o destinatário selecionado (ou um admin) pode aceitar esta transferência';
  end if;
  if lower(coalesce(t.responsavel_email,'')) = me then
    raise exception 'Quem registrou a transferência não pode aceitá-la — o recebimento deve ser confirmado por outra pessoa';
  end if;
  if coalesce(btrim(p_assinatura_png),'') = '' then
    raise exception 'Assinatura obrigatória para aceitar a transferência';
  end if;
  if t.para_id_unidade is null then
    raise exception 'Transferência sem unidade de destino definida — não pode ser aceita';
  end if;

  select nome into v_nome from public.usuarios where lower(email) = me limit 1;

  update public.inventario_maquinas
     set id_unidade        = t.para_id_unidade,
         unidade           = (select nome from public.unidades where id_unidade = t.para_id_unidade),
         localizacao       = coalesce(t.para_localizacao, localizacao),
         responsavel_setor = coalesce(t.para_responsavel, responsavel_setor),
         updated_at        = now()
   where id_maquina = t.id_maquina;

  update public.transferencias
     set status = 'aceita',
         aceita_por_email = me, aceita_em = now(),
         assinante_nome = coalesce(v_nome, t.para_usuario_nome),
         assinatura_png = p_assinatura_png,
         pdf_sha256     = p_pdf_sha256,
         user_agent     = p_user_agent,
         assinatura_ip  = p_ip,
         consentimento_em = case when p_consentimento then now() else null end,
         assinado_em    = now(),
         em_atendimento_por = null, em_atendimento_em = null
   where id_transferencia = p_id;
end $function$;

do $$
begin
  raise notice 'v175 desfeita: transferencia_aceitar() escreve apenas em inventario_maquinas';
end $$;
