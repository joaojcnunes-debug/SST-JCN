-- v307 — Inspeções: prioridade na escala do painel (28/10/2026)
--
-- A v306 criou a prioridade no JCN com outra escala (BAIXA/MEDIA/ALTA/URGENTE) e só para supervisor.
-- O painel já tinha, desde a v308 de lá (22/10), a prioridade BAIXA | MEDIA | GRAVE | CRITICA
-- (na tela: Baixa, Média, Urgente, Crítica), marcada por QUEM EDITA a inspeção, direto na lista.
-- Decisão de 28/10: os dois seguem o painel. Ninguém tinha marcado prioridade no JCN (0 linhas).
--
-- - inspecoes_prioridade_check: os valores do painel; índice parcial igual ao do painel.
-- - inspecoes_prioridade_trg: SEM trava de supervisor (as policies de UPDATE da inspeção decidem
--   quem grava, como no painel); só carimba quem/quando mexeu na prioridade ou no prazo.
-- - prioridade_auto: CRITICA (prazo vencido, documento vencido ou espera > 45 d) · GRAVE (prazo em
--   até 3 d, validade em até 30 d ou espera > 30 d) · MEDIA (prazo em até 7 d ou espera > 15 d) ·
--   BAIXA. prioridade_peso na mesma escala. O resto da v306 (colunas calculadas, RPC) não muda.
--
-- Rollback: scripts/sql/v307_inspecoes_prioridade_escala_painel_rollback.sql

alter table public.inspecoes drop constraint if exists inspecoes_prioridade_check;
alter table public.inspecoes add constraint inspecoes_prioridade_check
  check (prioridade is null or prioridade in ('BAIXA', 'MEDIA', 'GRAVE', 'CRITICA'));

create index if not exists inspecoes_prioridade_idx on public.inspecoes (prioridade) where prioridade is not null;

create or replace function public.inspecoes_prioridade_trg()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  if new.prioridade is distinct from old.prioridade or new.prazo is distinct from old.prazo then
    new.prioridade_definida_por := lower(coalesce(auth.jwt() ->> 'email', ''));
    new.prioridade_definida_em := now();
  end if;
  return new;
end $$;

create or replace function public.prioridade_auto(i inspecoes)
returns text language sql stable set search_path to 'public' as $$
  with b as (select public.dias_espera(i) as espera, (now() at time zone 'America/Sao_Paulo')::date as hoje)
  select case when b.espera is null then null
              when (i.prazo is not null and i.prazo < b.hoje) or (i.data_validade is not null and i.data_validade < b.hoje) or b.espera > 45 then 'CRITICA'
              when (i.prazo is not null and i.prazo <= b.hoje + 3) or (i.data_validade is not null and i.data_validade <= b.hoje + 30) or b.espera > 30 then 'GRAVE'
              when (i.prazo is not null and i.prazo <= b.hoje + 7) or b.espera > 15 then 'MEDIA'
              else 'BAIXA' end from b
$$;

create or replace function public.prioridade_peso(p text)
returns integer language sql immutable set search_path to 'public' as $$
  select case p when 'CRITICA' then 4 when 'GRAVE' then 3 when 'MEDIA' then 2 when 'BAIXA' then 1 else 0 end
$$;

notify pgrst, 'reload schema';
