-- Rollback da v266: volta as AEPs "Em andamento" para Rascunho e o CHECK antigo.
update public.aep_relatorios set status = 'RASCUNHO' where status = 'EM_ANDAMENTO';
alter table public.aep_relatorios drop constraint if exists aep_relatorios_status_check;
alter table public.aep_relatorios add constraint aep_relatorios_status_check
  check (status = any (array['RASCUNHO'::text, 'CONCLUIDO'::text]));
