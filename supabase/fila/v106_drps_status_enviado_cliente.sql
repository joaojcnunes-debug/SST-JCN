-- v106 — drps_relatorios.status: permite ENVIADO_CLIENTE (4ª coluna do Dashboard Geral).
-- O frontend (StatusRelatorio) já usava o status; a constraint do banco não o permitia,
-- então mover um card para "Enviados para clientes" dava 23514 (check_violation) e revertia.
-- Idempotente/reversível.
alter table public.drps_relatorios drop constraint if exists drps_relatorios_status_check;
alter table public.drps_relatorios add constraint drps_relatorios_status_check
  check (status = any (array['RASCUNHO'::text, 'EM_ANDAMENTO'::text, 'CONCLUIDO'::text, 'ENVIADO_CLIENTE'::text, 'DELETADO'::text]));
