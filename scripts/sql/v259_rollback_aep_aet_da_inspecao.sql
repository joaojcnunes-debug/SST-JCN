-- Rollback da v259. Os laudos criados pela inspeção CONTINUAM existindo e
-- passam a aparecer nos módulos (perdem só o vínculo com a inspeção).
begin;
drop index if exists public.aep_relatorios_id_inspecao_uq;
drop index if exists public.aet_relatorios_id_inspecao_uq;
alter table public.aep_relatorios drop column if exists enviado_modulo_em, drop column if exists id_inspecao;
alter table public.aet_relatorios drop column if exists enviado_modulo_em, drop column if exists id_inspecao;
commit;
