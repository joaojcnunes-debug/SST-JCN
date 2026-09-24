-- v104 (JCN sync 2026-06-26) — pg_cron + policies de Storage da Gestão (caminho gestao/).
-- Aplicado via MCP supabase-sst. Aditivo/idempotente.
create extension if not exists pg_cron;

drop policy if exists gestao_anexos_storage_sel on storage.objects;
drop policy if exists gestao_anexos_storage_ins on storage.objects;
drop policy if exists gestao_anexos_storage_upd on storage.objects;
drop policy if exists gestao_anexos_storage_del on storage.objects;
create policy gestao_anexos_storage_sel on storage.objects for select to authenticated
  using (bucket_id='anexos' and name like 'gestao/%');
create policy gestao_anexos_storage_ins on storage.objects for insert to authenticated
  with check (bucket_id='anexos' and name like 'gestao/%' and public.caller_pode_editar());
create policy gestao_anexos_storage_upd on storage.objects for update to authenticated
  using (bucket_id='anexos' and name like 'gestao/%' and public.caller_pode_editar());
create policy gestao_anexos_storage_del on storage.objects for delete to authenticated
  using (bucket_id='anexos' and name like 'gestao/%' and public.caller_pode_editar());
