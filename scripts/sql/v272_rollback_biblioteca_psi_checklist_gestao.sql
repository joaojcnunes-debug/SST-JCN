-- Rollback da v272. ⚠️ Apaga as edições da biblioteca e as respostas do
-- checklist de gestão de todas as AEPs. Exporte antes se precisar guardar.
alter table public.aep_relatorios drop column if exists checklist_gestao;
drop table if exists public.psi_biblioteca_fatores;
