-- v158 — Extintores: separa CONFORMIDADE de NÃO CONFORMIDADE.
-- Reflete a v158 do painel-sst. A partir daqui o SST-JCN adota a MESMA
-- numeração do painel (antes era própria e divergente), para que sync futuro
-- seja 'mesmo número = mesma mudança'.
--
-- No JCN a tabela está VAZIA (0 extintores em 2026-09-23), então o backfill e
-- as conferências abaixo são no-op. As contagens citadas no texto original são
-- da base do painel, mantidas como registro do problema que originou a mudança.
--
-- PROBLEMA: `extintores.status` era um campo de texto livre (input + datalist)
-- que misturava duas coisas de natureza diferente:
--
--   Adequado                 78   <- conformidade
--   (vazio)                  32   <- não avaliado
--   Vencido                  31   <- não conformidade
--   Sinalização inadequada   12   <- não conformidade
--   A vencer (próx. 3 meses)  2   <- não conformidade
--   Lacre violado             1   <- não conformidade
--   Danificado                1   <- não conformidade
--
-- Sendo um valor só, um extintor Vencido E com sinalização inadequada obrigava
-- o técnico a escolher um dos dois — o outro se perdia. E nada impedia marcar
-- "Adequado" junto de "Vencido" se o campo virasse lista.
--
-- O QUE MUDA:
--   * `situacao`           CONFORME | NAO_CONFORME | null (não avaliado)
--   * `nao_conformidades`  text[], uma ou mais causas
--
-- `status` NÃO é apagado: fica congelado com o valor de antes, como trilha de
-- auditoria e rede de segurança. O app para de escrevê-lo a partir daqui.
--
-- ⚠️ DDL: depois de aplicar é OBRIGATÓRIO o `notify pgrst, 'reload schema'` do
-- final, senão o PostgREST segue servindo o schema antigo e a tela quebra com
-- PGRST204 "column not found". O migrate.ps1 já faz isso; aplicando à mão, não
-- pule o último comando.
--
-- Desfazer: scripts/sql/v158_extintores_conformidade_rollback.sql

begin;

-- ── 1) Colunas novas ────────────────────────────────────────────────────────
alter table public.extintores
  add column if not exists situacao text,
  add column if not exists nao_conformidades text[] not null default '{}';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'extintores_situacao_check'
  ) then
    alter table public.extintores
      add constraint extintores_situacao_check
      check (situacao is null or situacao in ('CONFORME', 'NAO_CONFORME'));
  end if;
end $$;

comment on column public.extintores.status is
  'LEGADO — congelado na v158 (2026-08-05) com o valor anterior. O app não '
  'escreve mais aqui: use situacao + nao_conformidades. Mantido como trilha de '
  'auditoria e base do rollback.';
comment on column public.extintores.situacao is
  'CONFORME | NAO_CONFORME | null (não avaliado).';
comment on column public.extintores.nao_conformidades is
  'Causas da não conformidade. Vazio quando situacao <> NAO_CONFORME.';

-- ── 2) Backfill ─────────────────────────────────────────────────────────────
-- Só onde ainda não foi preenchido, para a migration poder rodar de novo sem
-- desfazer edição feita depois.
update public.extintores
   set situacao = 'CONFORME',
       nao_conformidades = '{}'
 where situacao is null
   and nao_conformidades = '{}'
   and trim(coalesce(status, '')) = 'Adequado';

update public.extintores
   set situacao = 'NAO_CONFORME',
       nao_conformidades = array[trim(status)]
 where situacao is null
   and nao_conformidades = '{}'
   and trim(coalesce(status, '')) <> ''
   and trim(coalesce(status, '')) <> 'Adequado';

-- Status vazio continua situacao NULL = "não avaliado". Nada a fazer.

-- ── 3) Conferência ──────────────────────────────────────────────────────────
do $$
declare n_total int; n_adequado int; n_conforme int;
        n_com_status int; n_nao_conforme int; n_incoerente int;
begin
  select count(*) into n_total from public.extintores;

  select count(*) into n_adequado from public.extintores
   where trim(coalesce(status, '')) = 'Adequado';
  select count(*) into n_conforme from public.extintores where situacao = 'CONFORME';
  if n_conforme <> n_adequado then
    raise exception 'v158 abortada: % CONFORME para % "Adequado"', n_conforme, n_adequado;
  end if;

  select count(*) into n_com_status from public.extintores
   where trim(coalesce(status, '')) not in ('', 'Adequado');
  select count(*) into n_nao_conforme from public.extintores where situacao = 'NAO_CONFORME';
  if n_nao_conforme <> n_com_status then
    raise exception 'v158 abortada: % NAO_CONFORME para % com status de nao conformidade', n_nao_conforme, n_com_status;
  end if;

  -- ninguém pode ficar NAO_CONFORME sem causa, nem CONFORME com causa
  select count(*) into n_incoerente from public.extintores
   where (situacao = 'NAO_CONFORME' and coalesce(array_length(nao_conformidades, 1), 0) = 0)
      or (situacao is distinct from 'NAO_CONFORME' and coalesce(array_length(nao_conformidades, 1), 0) > 0);
  if n_incoerente > 0 then
    raise exception 'v158 abortada: % extintores com situacao e causas incoerentes', n_incoerente;
  end if;

  raise notice 'v158 OK: % extintores — % conformes, % nao conformes, % nao avaliados',
    n_total, n_conforme, n_nao_conforme, n_total - n_conforme - n_nao_conforme;
end $$;

commit;

-- ⚠️ Sem isto o PostgREST serve o schema antigo e a tela quebra com PGRST204.
notify pgrst, 'reload schema';
