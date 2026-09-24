-- v176 — Transferência entre bases também por QUANTIDADE.
--
-- A DECISÃO QUE ORIGINOU ISTO (operador + Leandro, 2026-08-11)
--   O tipo do item decide o modelo:
--     • computador e notebook → ficha individual, cada um com suas especificações
--     • fone, mouse, cabo     → um cadastro só, com quantidade por base
--   "Dei entrada em 10 fones; ele manda 2 pra Piabetá, aí tira do total da base
--   em que foi lançado."
--
--   E a assinatura vale nos DOIS modelos — decisão dele, contra a minha
--   recomendação de assinar só o individualizado.
--
-- POR QUE ESTENDER `transferencias` EM VEZ DE CRIAR TABELA NOVA
--   Ela já tem tudo o que a transferência por quantidade precisa: estado
--   (pendente/aceita/recusada/cancelada), destinatário, aceite assinado com
--   PNG do traço, hash do PDF, IP, consentimento, e as travas de "só o
--   destinatário aceita" e "quem registra não aceita". Duplicar isso numa
--   tabela paralela seria manter duas máquinas de assinatura — e a segunda
--   envelheceria diferente da primeira.
--
--   Duas colunas resolvem: `id_catalogo` e `quantidade`, NULAS no modelo
--   individualizado. Uma restrição garante que a linha é sempre um dos dois,
--   nunca os dois nem nenhum.
--
-- O INTERVALO — a parte que a assinatura obriga a resolver
--   Se o recebimento é assinado, existe um tempo entre registrar e aceitar.
--   Se o saldo só mudasse no aceite, a origem mostraria 10 fones com 8 na mão,
--   e alguém prometeria os 2 que já estão no carro.
--
--   Então: a SAÍDA sai no registro, a ENTRADA entra no aceite. Como romaneio.
--   A quantidade fica "em trânsito" — visível em Pendências, indisponível na
--   origem. O total da Chabra não muda em momento nenhum.
--
--   Recusa e cancelamento DEVOLVEM a quantidade à origem, senão a mercadoria
--   sumiria do sistema por desistência.
--
-- Idempotente. Rollback em scripts\sql\v176_transferencia_por_quantidade_rollback.sql

do $$
begin
  if to_regclass('public.equipamentos_catalogo') is null
     or to_regclass('public.equipamentos_movimentacoes') is null then
    raise exception 'v176 abortada: tabelas de estoque ausentes — aplique a v164 antes';
  end if;
  if to_regclass('public.transferencias') is null then
    raise exception 'v176 abortada: public.transferencias nao existe';
  end if;
end $$;

-- ── 1) As duas colunas ──────────────────────────────────────────────────────
alter table public.transferencias
  add column if not exists id_catalogo text
    references public.equipamentos_catalogo(id_catalogo) on delete restrict;

alter table public.transferencias
  add column if not exists quantidade numeric;

create index if not exists idx_transferencias_catalogo
  on public.transferencias (id_catalogo) where id_catalogo is not null;

-- Uma linha é OU individualizada OU por quantidade. Nunca as duas, nunca
-- nenhuma. Sem isto, uma transferência sem item nenhum passaria despercebida.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'transferencias_um_modelo_ou_outro'
       and conrelid = 'public.transferencias'::regclass
  ) then
    alter table public.transferencias
      add constraint transferencias_um_modelo_ou_outro check (
        (id_catalogo is null and quantidade is null)
        or (id_catalogo is not null and quantidade is not null and quantidade > 0)
      ) not valid;   -- `not valid`: as 3 linhas antigas têm as duas colunas
                     -- nulas e passam, mas não quero travar o deploy por uma
                     -- linha histórica estranha que apareça depois.
  end if;
end $$;

-- ── 2) Registrar transferência por quantidade ───────────────────────────────
-- A saída sai AQUI. O destino só recebe no aceite.
create or replace function public.equipamento_transferir_estoque(
  p_id_catalogo   text,
  p_de_unidade    text,
  p_para_unidade  text,
  p_quantidade    numeric,
  p_para_email    text,
  p_motivo        text default null,
  p_transportado_por text default null
)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id text := 'TRF-' || upper(substring(replace(gen_random_uuid()::text,'-','') from 1 for 8));
  v_saldo numeric;
  v_nome text;
  me text := lower(auth.jwt() ->> 'email');
begin
  if not public.caller_pode_editar() then
    raise exception 'Sem permissão para transferir.';
  end if;
  if not public.caller_pode_equipamentos() then
    raise exception 'Módulo de equipamentos fora do seu acesso.';
  end if;
  if p_de_unidade = p_para_unidade then
    raise exception 'A base de destino tem de ser diferente da de origem.';
  end if;
  if coalesce(p_quantidade, 0) <= 0 then
    raise exception 'A quantidade precisa ser maior que zero.';
  end if;
  if not (p_de_unidade = any(public.caller_unidades())) and not public.caller_eh_admin() then
    raise exception 'Base de origem fora do seu acesso.';
  end if;

  -- Saldo conferido no banco, não na tela: entre a tela carregar e o clique,
  -- outra pessoa pode ter dado saída no mesmo item.
  select coalesce(sum(case when tipo='entrada' then quantidade else -quantidade end), 0)
    into v_saldo
    from public.equipamentos_movimentacoes
   where id_catalogo = p_id_catalogo and id_unidade = p_de_unidade;

  if v_saldo < p_quantidade then
    raise exception 'Saldo insuficiente: há % nesta base e a transferência pede %.',
      v_saldo, p_quantidade;
  end if;

  select nome into v_nome from public.equipamentos_catalogo where id_catalogo = p_id_catalogo;

  insert into public.transferencias (
    id_transferencia, id_maquina, id_catalogo, quantidade,
    de_id_unidade, para_id_unidade, para_usuario_email,
    motivo, transportado_por, status,
    maquina_nome, responsavel_email, data_hora, created_at
  ) values (
    v_id, null, p_id_catalogo, p_quantidade,
    p_de_unidade, p_para_unidade, lower(nullif(btrim(p_para_email),'')),
    p_motivo, p_transportado_por, 'pendente',
    v_nome, me, now(), now()
  );

  -- A saída sai agora — a mercadoria deixou a base de origem de fato.
  insert into public.equipamentos_movimentacoes (
    id_catalogo, id_unidade, tipo, quantidade, origem, ref_id, motivo, criado_por
  ) values (
    p_id_catalogo, p_de_unidade, 'saida', p_quantidade, 'transferencia', v_id,
    coalesce(p_motivo, 'transferência entre bases'), me
  );

  return v_id;
end $function$;

-- ── 3) O aceite passa a saber dos dois modelos ──────────────────────────────
-- Mantém tudo o que a v175 já fazia e acrescenta o ramo da quantidade.
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

  if t.id_catalogo is not null then
    -- ── Modelo POR QUANTIDADE ──────────────────────────────────────────────
    -- A saída já saiu no registro. Aqui entra no destino, e só aqui.
    insert into public.equipamentos_movimentacoes (
      id_catalogo, id_unidade, tipo, quantidade, origem, ref_id, motivo, criado_por
    ) values (
      t.id_catalogo, t.para_id_unidade, 'entrada', t.quantidade, 'transferencia',
      t.id_transferencia, coalesce(t.motivo, 'transferência entre bases'), me
    );
  else
    -- ── Modelo INDIVIDUALIZADO ─────────────────────────────────────────────
    update public.inventario_maquinas
       set id_unidade        = t.para_id_unidade,
           unidade           = (select nome from public.unidades where id_unidade = t.para_id_unidade),
           localizacao       = coalesce(t.para_localizacao, localizacao),
           responsavel_setor = coalesce(t.para_responsavel, responsavel_setor),
           updated_at        = now()
     where id_maquina = t.id_maquina;

    -- v175: enquanto as duas tabelas convivem, as duas mudam juntas.
    update public.equipamentos e
       set id_unidade  = t.para_id_unidade,
           localizacao = coalesce(t.para_localizacao, e.localizacao),
           responsavel = coalesce(t.para_responsavel, e.responsavel),
           updated_at  = now()
     where (t.id_equipamento is not null and e.id_equipamento = t.id_equipamento)
        or (t.id_maquina    is not null and e.id_inventario_origem = t.id_maquina);
  end if;

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

-- ── 4) Recusa e cancelamento devolvem a quantidade ──────────────────────────
-- Sem isto, desistir de uma transferência FARIA A MERCADORIA SUMIR: a saída já
-- tinha sido lançada no registro e nada a traria de volta.
create or replace function public.equipamento_estornar_transferencia(p_id text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare t public.transferencias;
begin
  select * into t from public.transferencias where id_transferencia = p_id;
  if not found then return; end if;
  if t.id_catalogo is null then return; end if;  -- individualizado: nada saiu

  -- Já estornado? A razão é append-only, então a marca é a própria linha de volta.
  if exists (
    select 1 from public.equipamentos_movimentacoes
     where ref_id = p_id and id_unidade = t.de_id_unidade and tipo = 'entrada'
  ) then
    return;
  end if;

  insert into public.equipamentos_movimentacoes (
    id_catalogo, id_unidade, tipo, quantidade, origem, ref_id, motivo, criado_por
  ) values (
    t.id_catalogo, t.de_id_unidade, 'entrada', t.quantidade, 'transferencia', p_id,
    'devolução por transferência ' || coalesce(t.status, 'desfeita'),
    lower(auth.jwt() ->> 'email')
  );
end $function$;

-- ── 5) Recusar e cancelar passam a CHAMAR o estorno ─────────────────────────
-- Deixar o estorno a cargo da tela seria confiar em alguém lembrar. Se a recusa
-- vier por outra via — outra tela, um script, o PostgREST direto — a mercadoria
-- sumiria em silêncio. A devolução tem de estar na mesma transação que muda o
-- status, e é por isso que estas duas funções são reescritas aqui.
--
-- Fora a chamada nova, a definição é idêntica à que estava em produção.

create or replace function public.transferencia_recusar(p_id text, p_motivo text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare t public.transferencias; me text := lower(auth.jwt() ->> 'email');
begin
  select * into t from public.transferencias
   where id_transferencia = p_id and status = 'pendente' for update;
  if not found then raise exception 'Transferência já finalizada por outra pessoa'; end if;
  if lower(coalesce(t.para_usuario_email,'')) <> me and not public.caller_eh_admin() then
    raise exception 'Só o destinatário selecionado (ou um admin) pode recusar esta transferência';
  end if;

  update public.transferencias
     set status = 'recusada', recusada_por_email = me, recusada_em = now(),
         recusada_motivo = p_motivo, em_atendimento_por = null, em_atendimento_em = null
   where id_transferencia = p_id;

  -- v176: a quantidade volta para a base de origem, na mesma transação.
  perform public.equipamento_estornar_transferencia(p_id);
end $function$;

create or replace function public.transferencia_cancelar(p_id text, p_motivo text default null::text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare me text := lower(auth.jwt() ->> 'email');
begin
  if not public.caller_pode_transferir() then
    raise exception 'Sem permissão de transferência';
  end if;
  update public.transferencias
     set status = 'cancelada', cancelada_por_email = me, cancelada_em = now(),
         cancelada_motivo = p_motivo,
         em_atendimento_por = null, em_atendimento_em = null
   where id_transferencia = p_id and status = 'pendente';
  if not found then raise exception 'Transferência já finalizada — não é mais possível cancelar'; end if;

  -- v176: idem.
  perform public.equipamento_estornar_transferencia(p_id);
end $function$;

do $$
begin
  raise notice 'v176: transferencia por quantidade pronta (saida no registro, entrada no aceite, estorno na recusa e no cancelamento)';
end $$;
