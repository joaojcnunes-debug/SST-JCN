-- v164 — Equipamentos Chabra (Fase 4): catálogo, razão de estoque e entrada manual.
--
-- Modelo híbrido do briefing (§3.4):
--   CATÁLOGO (produto) → SALDO POR BASE → ATIVO (individualizado na saída)
--
-- DUAS DIFERENÇAS DELIBERADAS EM RELAÇÃO AO MOLDE DO EPI (v127):
--
--   1) O CATÁLOGO É GLOBAL, não por escopo. "Mouse Logitech M170" é o mesmo
--      produto em Guapimirim e em Teresópolis — o que varia por base é o SALDO.
--      No EPI o catálogo é por empresa cliente porque cada cliente tem o seu CA.
--      Aqui, catálogo por base criaria o mesmo mouse cadastrado N vezes e
--      impediria a pergunta "quantos mouses a Chabra tem no total".
--
--   2) `tipo` carrega SÓ A DIREÇÃO (entrada|saida); o PORQUÊ vai em `origem`.
--      No EPI existe tipo='ajuste' com quantidade > 0 — e o saldo soma tudo que
--      não é 'saida', então um ajuste NUNCA consegue diminuir o estoque. Uma
--      contagem de inventário que achar 10 onde o sistema diz 12 não teria como
--      ser lançada. Aqui: tipo='saida' + origem='ajuste' + motivo obrigatório.
--
-- O SALDO NUNCA É COLUNA GRAVADA — é derivado de equipamentos_movimentacoes,
-- que é APPEND-ONLY (só SELECT + INSERT na RLS). É o que dá auditoria e o que
-- impede o saldo de secar por bug de update.
--
-- TRANSAÇÃO: psql -1 via deploy\migrate.ps1 (sem begin/commit explícito).
-- Idempotente. Rollback em scripts\sql\v164_equipamentos_catalogo_estoque_rollback.sql

do $$
begin
  if to_regclass('public.equipamentos') is null then
    raise exception 'v164 abortada: v163 (public.equipamentos) nao foi aplicada';
  end if;
end $$;

-- ── 1) Catálogo de produtos (global) ────────────────────────────────────────
create table if not exists public.equipamentos_catalogo (
  id_catalogo      text primary key default gen_random_uuid()::text,
  nome             text not null,
  tipo             text,                       -- Notebook, Mouse, Cadeira…
  fabricante       text,
  modelo           text,
  unidade_medida   text not null default 'un', -- un, par, cx, m…
  estoque_minimo   numeric not null default 0 check (estoque_minimo >= 0),

  -- Se true, cada unidade entregue vira uma linha em public.equipamentos
  -- (ativo com nº de série/patrimônio próprio) — é o "#A31 → João" do briefing.
  -- Se false, a entrega só baixa o saldo e fica registrada no item da entrega.
  -- Default true = comportamento do briefing; false existe para não obrigar
  -- ninguém a inventar número de série de cabo HDMI.
  controla_individual boolean not null default true,

  foto_url         text,
  foto_path        text,
  foto_thumb_path  text,                       -- miniatura desde o dia zero (§3.1)
  ativo            boolean not null default true,
  criado_por       text,
  criado_em        timestamptz not null default now(),
  updated_at       timestamptz
);

create index if not exists idx_equip_catalogo_ativo on public.equipamentos_catalogo (ativo, nome);

-- ── 2) Razão de estoque — APPEND-ONLY ───────────────────────────────────────
create table if not exists public.equipamentos_movimentacoes (
  id_movimentacao text primary key default gen_random_uuid()::text,
  id_catalogo     text not null references public.equipamentos_catalogo(id_catalogo) on delete restrict,
  id_unidade      text not null references public.unidades(id_unidade) on delete restrict,

  tipo            text not null check (tipo in ('entrada','saida')),
  quantidade      numeric not null check (quantidade > 0),

  -- Por que essa linha existe. 'ajuste' é o que permite corrigir contagem
  -- para baixo (tipo='saida', origem='ajuste'), impossível no molde do EPI.
  origem          text not null default 'manual'
                  check (origem in ('manual','nf','entrega','devolucao','transferencia','ajuste')),
  ref_id          text,                        -- chNFe | id_entrega | id_devolucao | id_transferencia
  motivo          text,
  responsavel     text,

  criado_por      text,
  criado_em       timestamptz not null default now(),

  -- Ajuste sem justificativa é como status sem motivo: vira lixo em auditoria.
  constraint equip_mov_ajuste_exige_motivo
    check (origem <> 'ajuste' or coalesce(btrim(motivo), '') <> '')
);

create index if not exists idx_equip_mov_catalogo on public.equipamentos_movimentacoes (id_catalogo);
create index if not exists idx_equip_mov_unidade  on public.equipamentos_movimentacoes (id_unidade, criado_em desc);
create index if not exists idx_equip_mov_ref      on public.equipamentos_movimentacoes (origem, ref_id);

-- ── 3) Saldo derivado (nunca gravado) ───────────────────────────────────────
-- security_invoker: a view respeita a RLS de quem consulta, não a do dono.
create or replace view public.v_equipamentos_saldo with (security_invoker = true) as
  select id_unidade,
         id_catalogo,
         sum(case when tipo = 'saida' then -quantidade else quantidade end) as saldo
    from public.equipamentos_movimentacoes
   group by id_unidade, id_catalogo;

-- ── 4) Ligação ativo → produto ──────────────────────────────────────────────
-- Preenchido quando o ativo nasceu de uma saída de estoque. NULL nos 86 itens
-- migrados da v163, que nunca passaram por estoque — e isso é informação, não falha.
alter table public.equipamentos
  add column if not exists id_catalogo text references public.equipamentos_catalogo(id_catalogo) on delete set null;
create index if not exists idx_equipamentos_catalogo on public.equipamentos (id_catalogo);

-- ── 5) RLS ──────────────────────────────────────────────────────────────────
-- Catálogo: leitura para quem tem o módulo (produto é global); escrita só editor.
alter table public.equipamentos_catalogo enable row level security;
drop policy if exists equipamentos_catalogo_sel on public.equipamentos_catalogo;
create policy equipamentos_catalogo_sel on public.equipamentos_catalogo
  for select to authenticated using (public.caller_pode_equipamentos());
drop policy if exists equipamentos_catalogo_rw on public.equipamentos_catalogo;
create policy equipamentos_catalogo_rw on public.equipamentos_catalogo
  for all to authenticated
  using (public.caller_pode_editar() and public.caller_pode_equipamentos())
  with check (public.caller_pode_editar() and public.caller_pode_equipamentos());

-- Movimentações: APPEND-ONLY e por base. Sem update, sem delete — nem para admin.
alter table public.equipamentos_movimentacoes enable row level security;
drop policy if exists equipamentos_movimentacoes_sel on public.equipamentos_movimentacoes;
create policy equipamentos_movimentacoes_sel on public.equipamentos_movimentacoes
  for select to authenticated using (
    public.caller_eh_admin()
    or (public.caller_pode_equipamentos() and id_unidade = any(public.caller_unidades()))
  );
drop policy if exists equipamentos_movimentacoes_ins on public.equipamentos_movimentacoes;
create policy equipamentos_movimentacoes_ins on public.equipamentos_movimentacoes
  for insert to authenticated with check (
    public.caller_pode_editar()
    and public.caller_pode_equipamentos()
    and (public.caller_eh_admin() or id_unidade = any(public.caller_unidades()))
  );

-- ── 6) RPC: entrada de estoque ──────────────────────────────────────────────
-- Um lançamento = uma linha na razão. "Entrada de 20 mouses é um único
-- lançamento" (critério de aceite do §3.4).
create or replace function public.equipamento_lancar_entrada(
  p_id_catalogo text,
  p_id_unidade  text,
  p_quantidade  numeric,
  p_fornecedor  text default null,
  p_nota_fiscal text default null,
  p_observacao  text default null
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_email text := auth.jwt() ->> 'email';
  v_id    text := gen_random_uuid()::text;
begin
  if not public.caller_pode_editar() then raise exception 'Sem permissão para lançar entrada.'; end if;
  if not public.caller_pode_equipamentos() then raise exception 'Módulo de equipamentos fora do seu acesso.'; end if;
  if not (public.caller_eh_admin() or p_id_unidade = any(public.caller_unidades())) then
    raise exception 'Base fora do seu acesso.';
  end if;
  if coalesce(p_quantidade, 0) <= 0 then raise exception 'Quantidade deve ser maior que zero.'; end if;
  if not exists (select 1 from equipamentos_catalogo where id_catalogo = p_id_catalogo and ativo) then
    raise exception 'Produto inexistente ou inativo no catálogo.';
  end if;

  insert into equipamentos_movimentacoes
    (id_movimentacao, id_catalogo, id_unidade, tipo, quantidade, origem, ref_id, motivo, responsavel, criado_por)
  values
    (v_id, p_id_catalogo, p_id_unidade, 'entrada', p_quantidade, 'manual', p_nota_fiscal,
     coalesce(nullif(btrim(p_observacao), ''), 'Entrada manual de estoque'), p_fornecedor, v_email);

  return v_id;
end $$;

grant execute on function public.equipamento_lancar_entrada(text, text, numeric, text, text, text) to authenticated;

-- ── 7) RPC: ajuste de contagem (para cima ou para baixo) ────────────────────
-- p_saldo_contado é o que a pessoa CONTOU na prateleira; a RPC calcula a
-- diferença e lança só o delta. Evita a conta de cabeça, que é onde erra.
create or replace function public.equipamento_ajustar_saldo(
  p_id_catalogo   text,
  p_id_unidade    text,
  p_saldo_contado numeric,
  p_motivo        text
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_email text := auth.jwt() ->> 'email';
  v_atual numeric;
  v_delta numeric;
  v_id    text := gen_random_uuid()::text;
begin
  if not public.caller_pode_editar() then raise exception 'Sem permissão para ajustar estoque.'; end if;
  if not public.caller_pode_equipamentos() then raise exception 'Módulo de equipamentos fora do seu acesso.'; end if;
  if not (public.caller_eh_admin() or p_id_unidade = any(public.caller_unidades())) then
    raise exception 'Base fora do seu acesso.';
  end if;
  if coalesce(btrim(p_motivo), '') = '' then raise exception 'Ajuste exige motivo.'; end if;
  if coalesce(p_saldo_contado, -1) < 0 then raise exception 'Saldo contado inválido.'; end if;

  v_atual := coalesce((
    select sum(case when tipo = 'saida' then -quantidade else quantidade end)
      from equipamentos_movimentacoes
     where id_catalogo = p_id_catalogo and id_unidade = p_id_unidade), 0);

  v_delta := p_saldo_contado - v_atual;
  if v_delta = 0 then raise exception 'Saldo contado já é o saldo do sistema (%). Nada a ajustar.', v_atual; end if;

  insert into equipamentos_movimentacoes
    (id_movimentacao, id_catalogo, id_unidade, tipo, quantidade, origem, motivo, criado_por)
  values
    (v_id, p_id_catalogo, p_id_unidade,
     case when v_delta > 0 then 'entrada' else 'saida' end, abs(v_delta), 'ajuste',
     p_motivo || ' (sistema: ' || v_atual || ' → contado: ' || p_saldo_contado || ')', v_email);

  return v_id;
end $$;

grant execute on function public.equipamento_ajustar_saldo(text, text, numeric, text) to authenticated;
