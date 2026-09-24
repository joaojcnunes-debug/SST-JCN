-- v169 — Transferência entre bases passa a apontar para o módulo Equipamentos.
--
-- POR QUE ESTA MIGRATION EXISTE (2026-08-11)
--   A Fase 3 subiu o módulo /equipamentos com tabela própria. A tela de
--   transferência, porém, ainda lista `inventario_maquinas` — então equipamento
--   NOVO, cadastrado no módulo novo, não teria linha lá e ficaria impossível de
--   transferir entre bases. Silenciosamente: a pessoa cadastra o notebook, vai
--   transferir, e ele simplesmente não aparece na lista.
--
--   O conserto já estava escrito, mas dentro do `scripts/sql/v168_*` — que é o
--   CUTOVER, um script manual que também APAGA as 99 linhas originais do
--   inventário. Aquele delete é o único passo irreversível do plano e só deve
--   rodar depois do módulo em uso e conferido.
--
--   Esta migration extrai APENAS a parte aditiva do v168 (o passo 2 dele):
--   cria a coluna e liga o histórico. NADA é apagado, nenhum `check` é mexido,
--   e as linhas originais seguem intactas como rede de segurança.
--
--   Quando o v168 rodar, o `add column if not exists` e o `update ... where
--   id_equipamento is null` deste arquivo já terão sido feitos: ele passa
--   batido, sem duplicar trabalho e sem conflito.
--
-- TRANSAÇÃO: aplicada por deploy\migrate.ps1 (psql -1, ON_ERROR_STOP=1). Por
-- isso não há begin/commit explícito — seria um BEGIN aninhado.
--
-- Idempotente. Rollback em scripts\sql\v169_transferencias_aponta_equipamentos_rollback.sql

-- ── Pré-condições ───────────────────────────────────────────────────────────
do $$
declare v_sem_par bigint;
begin
  if to_regclass('public.equipamentos') is null then
    raise exception 'v169 abortada: public.equipamentos nao existe — aplique a v163 antes';
  end if;
  if to_regclass('public.transferencias') is null then
    raise exception 'v169 abortada: public.transferencias nao existe (v115/v136)';
  end if;

  -- Mesma trava do v168: toda linha de equipamento do inventário precisa ter par
  -- na tabela nova. Sem isso, uma transferência ficaria órfã — apontando para um
  -- item que o módulo novo não conhece.
  select count(*) into v_sem_par
    from public.inventario_maquinas m
   where coalesce(m.categoria_inventario, 'maquinas') = 'equipamentos'
     and not exists (
       select 1 from public.equipamentos e where e.id_inventario_origem = m.id_maquina
     );
  if v_sem_par > 0 then
    raise exception 'v169 abortada: % linha(s) de equipamento sem par em public.equipamentos. Reaplique a v163 antes.', v_sem_par;
  end if;
end $$;

-- ── A coluna ────────────────────────────────────────────────────────────────
-- `on delete set null` (e não cascade): apagar um equipamento não pode apagar o
-- histórico de que ele foi transferido. O snapshot em texto da própria
-- `transferencias` continua contando a história.
alter table public.transferencias
  add column if not exists id_equipamento text
    references public.equipamentos(id_equipamento) on delete set null;

create index if not exists idx_transferencias_equipamento
  on public.transferencias (id_equipamento) where id_equipamento is not null;

-- ── Liga o histórico que já existe ──────────────────────────────────────────
-- `id_inventario_origem` é o rastro que a v163 gravou na cópia. É ele que casa
-- a transferência antiga com o equipamento novo.
update public.transferencias t
   set id_equipamento = e.id_equipamento
  from public.equipamentos e
 where e.id_inventario_origem = t.id_maquina
   and t.id_equipamento is null;

-- ── Conferência dentro da transação ─────────────────────────────────────────
do $$
declare v_total bigint; v_ligadas bigint; v_orfas bigint;
begin
  select count(*) into v_total from public.transferencias;
  select count(*) into v_ligadas from public.transferencias where id_equipamento is not null;

  -- Transferência cujo item de origem é um equipamento mas que NÃO conseguiu
  -- ligar: seria histórico perdendo o vínculo. Aborta.
  select count(*) into v_orfas
    from public.transferencias t
    join public.inventario_maquinas m on m.id_maquina = t.id_maquina
   where coalesce(m.categoria_inventario,'maquinas') = 'equipamentos'
     and t.id_equipamento is null;

  if v_orfas > 0 then
    raise exception 'v169 abortada: % transferencia(s) de equipamento ficaram sem vinculo', v_orfas;
  end if;

  raise notice 'v169: % de % transferencia(s) ligadas ao modulo Equipamentos', v_ligadas, v_total;
end $$;
