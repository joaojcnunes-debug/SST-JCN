-- v146 (JCN) — Inspeções: data de conclusão real (concluida_em).
-- Reflete a v154 do painel-sst.
--
-- A data da inspeção (`data_inspecao`) é quando a inspeção foi FEITA em campo,
-- não quando foi CONCLUÍDA no sistema. Este campo carimba a conclusão de fato —
-- usado no dashboard "Inspeções por Mês (concluídas)".
--
-- A aplicação grava `concluida_em = now()` ao concluir e LIMPA (null) ao reabrir.
--
-- ⚠️ Backfill = APROXIMAÇÃO. Para as inspeções JÁ concluídas não há histórico da
-- data real de conclusão; usamos `updated_at` (última alteração ≈ conclusão),
-- com fallback para `created_at`. Novas conclusões terão a data exata.
--
-- Aditiva e idempotente. Rodar com `psql -1`.

alter table public.inspecoes
  add column if not exists concluida_em timestamptz;

-- Backfill só das concluídas ainda sem concluida_em (não sobrescreve nada já gravado).
update public.inspecoes
   set concluida_em = coalesce(updated_at, created_at)
 where status = 'CONCLUIDA'
   and concluida_em is null;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'inspecoes' and column_name = 'concluida_em'
  ) then
    raise exception 'v146 abortada: coluna concluida_em nao foi criada';
  end if;
  raise notice 'v146 OK: inspecoes.concluida_em disponivel';
end $$;
