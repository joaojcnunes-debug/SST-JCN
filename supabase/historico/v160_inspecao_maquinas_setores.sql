-- v160 — Máquina da inspeção pode estar em VÁRIOS setores.
--
-- PROBLEMA: `inspecao_maquinas.id_setor` é FK única. Uma máquina usada na
-- produção E na expedição obrigava a escolher um setor — ou a cadastrar a mesma
-- máquina duas vezes, inflando a contagem de equipamento.
--
-- POR QUE TABELA DE LIGAÇÃO, e não o padrão dos riscos: em `riscos`, "vários
-- setores" é resolvido DUPLICANDO a linha (uma por setor) — ver RiscoForm,
-- `ids_setores` vira N inserts. Para risco isso é aceitável; para máquina, não:
-- máquina é objeto físico, e duplicar a linha faria 1 equipamento contar como N
-- no inventário e no relatório.
--
-- Segue o formato de `treinamentos_setor` / `treinamentos_cargo`: ligação pura,
-- CASCADE dos dois lados. Apagar o setor solta a máquina; apagar a máquina
-- limpa os vínculos.
--
-- `inspecao_maquinas.id_setor` NÃO é apagada: fica congelada com o valor de
-- antes, como trilha e base do rollback. O app passa a ler/escrever a ligação.
--
-- Estado medido antes: 309 máquinas, 274 com setor, 35 sem, em 69 inspeções.
--
-- ⚠️ DDL: o `notify pgrst` do final é obrigatório, senão o PostgREST não
-- enxerga a tabela nova e a tela quebra.
--
-- Desfazer: scripts/sql/v160_inspecao_maquinas_setores_rollback.sql

begin;

-- ── 1) Tabela de ligação ────────────────────────────────────────────────────
create table if not exists public.inspecao_maquinas_setores (
  id_maquina_inspecao uuid not null
    references public.inspecao_maquinas(id_maquina_inspecao) on delete cascade,
  id_setor text not null
    references public.setores(id_setor) on delete cascade,
  primary key (id_maquina_inspecao, id_setor)
);

create index if not exists idx_ims_setor
  on public.inspecao_maquinas_setores(id_setor);

comment on table public.inspecao_maquinas_setores is
  'v160 — setores em que a máquina da inspeção é utilizada. Substitui o '
  'inspecao_maquinas.id_setor de valor único, que ficou congelado como legado.';

-- ── 2) RLS no mesmo molde das outras tabelas de ligação ─────────────────────
alter table public.inspecao_maquinas_setores enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
     where tablename = 'inspecao_maquinas_setores' and policyname = 'ims_sel_auth'
  ) then
    create policy ims_sel_auth on public.inspecao_maquinas_setores
      for select to authenticated using (true);
  end if;
  if not exists (
    select 1 from pg_policies
     where tablename = 'inspecao_maquinas_setores' and policyname = 'ims_rw_editor'
  ) then
    create policy ims_rw_editor on public.inspecao_maquinas_setores
      for all to authenticated
      using (caller_pode_editar()) with check (caller_pode_editar());
  end if;
end $$;

-- ── 3) Backfill a partir do id_setor atual ──────────────────────────────────
insert into public.inspecao_maquinas_setores (id_maquina_inspecao, id_setor)
select m.id_maquina_inspecao, m.id_setor
  from public.inspecao_maquinas m
 where m.id_setor is not null
   -- o setor pode ter sido apagado (a FK antiga era SET NULL, mas em dado
   -- vindo de importação isso não é garantido)
   and exists (select 1 from public.setores s where s.id_setor = m.id_setor)
on conflict do nothing;

-- ── 4) Conferência ──────────────────────────────────────────────────────────
do $$
declare n_com_setor int; n_vinculos int; n_orfao int;
begin
  select count(*) into n_com_setor from public.inspecao_maquinas
   where id_setor is not null
     and exists (select 1 from public.setores s where s.id_setor = inspecao_maquinas.id_setor);
  select count(*) into n_vinculos from public.inspecao_maquinas_setores;
  if n_vinculos <> n_com_setor then
    raise exception 'v160 abortada: % vinculos para % maquinas com setor valido', n_vinculos, n_com_setor;
  end if;

  -- nenhuma máquina pode ter perdido o setor que tinha
  select count(*) into n_orfao from public.inspecao_maquinas m
   where m.id_setor is not null
     and exists (select 1 from public.setores s where s.id_setor = m.id_setor)
     and not exists (
       select 1 from public.inspecao_maquinas_setores v
        where v.id_maquina_inspecao = m.id_maquina_inspecao and v.id_setor = m.id_setor
     );
  if n_orfao > 0 then
    raise exception 'v160 abortada: % maquinas ficaram sem o vinculo do setor original', n_orfao;
  end if;

  raise notice 'v160 OK: % vinculos criados a partir de % maquinas com setor', n_vinculos, n_com_setor;
end $$;

commit;

-- ⚠️ Sem isto o PostgREST não enxerga a tabela nova.
notify pgrst, 'reload schema';
