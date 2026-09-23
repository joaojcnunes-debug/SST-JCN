-- v175 — O aceite de transferência passa a atualizar as DUAS tabelas.
--
-- O PROBLEMA (achado em 2026-08-11, ao subir a Fase 3)
--   `transferencia_aceitar()` é o único lugar do sistema onde um equipamento
--   muda de base. Ela faz `update public.inventario_maquinas`.
--
--   Com o módulo /equipamentos no ar, o mesmo item existe nas duas tabelas: a
--   original (rede de segurança até o cutover) e a nova (o que a equipe vê).
--   Aceitar uma transferência mudava a base só na ANTIGA — e o módulo novo
--   seguia mostrando a base velha, sem erro nenhum na tela. Divergência
--   silenciosa é o pior tipo: ninguém vê acontecer.
--
-- A DECISÃO (operador, 2026-08-11): sincronizar as duas, em vez de mover a
--   transferência inteira para o módulo novo agora. A mudança completa — tela,
--   hook e esta função apontando só para `equipamentos` — fica para a próxima
--   etapa, junto com o cutover. Esta migration é a ponte até lá.
--
--   Limitação que PERMANECE e é visível: equipamento criado direto no módulo
--   novo não tem linha em `inventario_maquinas`, então não aparece na tela de
--   transferência. Isso é falta de função, não corrupção de dado.
--
-- O QUE MUDA NA FUNÇÃO: um único bloco `update public.equipamentos` depois do
--   update existente. Todo o resto — as validações de quem pode aceitar, a
--   assinatura obrigatória, a trava de destino nulo, a linha travada com
--   `for update` — está idêntico ao que já estava em produção.
--
-- Idempotente (create or replace).
-- Rollback em scripts\sql\v175_..._rollback.sql

do $$
begin
  if to_regclass('public.equipamentos') is null then
    raise exception 'v175 abortada: public.equipamentos nao existe — aplique a v163 antes';
  end if;
  if to_regproc('public.transferencia_aceitar') is null then
    raise exception 'v175 abortada: transferencia_aceitar() nao existe (v136)';
  end if;
end $$;

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
   where id_transferencia = p_id and status = 'pendente' for update;   -- trava a linha
  if not found then raise exception 'Transferência já finalizada por outra pessoa'; end if;

  -- Aceita o destinatário escolhido OU um admin (cobre a base que só tem o
  -- próprio técnico cadastrado — decisão de 2026-07-15).
  if lower(coalesce(t.para_usuario_email,'')) <> me and not public.caller_eh_admin() then
    raise exception 'Só o destinatário selecionado (ou um admin) pode aceitar esta transferência';
  end if;
  -- Quem cria nunca é quem aceita — separa transporte de recebimento (vale até para admin).
  if lower(coalesce(t.responsavel_email,'')) = me then
    raise exception 'Quem registrou a transferência não pode aceitá-la — o recebimento deve ser confirmado por outra pessoa';
  end if;
  if coalesce(btrim(p_assinatura_png),'') = '' then
    raise exception 'Assinatura obrigatória para aceitar a transferência';
  end if;
  -- Blindagem: sem unidade de destino, aceitar apagaria a base da máquina
  -- (perda silenciosa). Aborta em vez de mover para "lugar nenhum".
  if t.para_id_unidade is null then
    raise exception 'Transferência sem unidade de destino definida — não pode ser aceita';
  end if;

  select nome into v_nome from public.usuarios where lower(email) = me limit 1;

  -- É AQUI que o equipamento muda de base. Só aqui.
  update public.inventario_maquinas
     set id_unidade        = t.para_id_unidade,
         unidade           = (select nome from public.unidades where id_unidade = t.para_id_unidade),
         localizacao       = coalesce(t.para_localizacao, localizacao),
         responsavel_setor = coalesce(t.para_responsavel, responsavel_setor),
         updated_at        = now()
   where id_maquina = t.id_maquina;

  -- ── v175: e AQUI também, enquanto as duas tabelas convivem ───────────────
  -- Casa pelo vínculo direto (`id_equipamento`, criado pela v169) ou pelo
  -- rastro da migração (`id_inventario_origem`, gravado pela v163). O primeiro
  -- que existir resolve; os dois cobrem tanto transferência nova quanto antiga.
  --
  -- NÃO toca em `status`: mudar situação exige motivo e passa pela RPC da v167,
  -- que o trigger protege. Transferir muda de lugar, não de estado.
  update public.equipamentos e
     set id_unidade  = t.para_id_unidade,
         localizacao = coalesce(t.para_localizacao, e.localizacao),
         responsavel = coalesce(t.para_responsavel, e.responsavel),
         updated_at  = now()
   where (t.id_equipamento is not null and e.id_equipamento = t.id_equipamento)
      or (t.id_maquina    is not null and e.id_inventario_origem = t.id_maquina);

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
