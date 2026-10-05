-- v271 (2026-10-05): as policies de Admin de aep_relatorios (DELETE) e
-- aep_textos_padrao (ALL) comparavam usuarios.id_usuario ("USR_...") com
-- auth.uid() (UUID) — nunca batia. Resultado: excluir AEP não apagava nada,
-- sem erro (0 linhas), e a Lixeira ganhava um snapshot fantasma a cada
-- tentativa. Passam a usar caller_eh_admin() (e-mail do JWT, como o resto).
-- Já aplicada via MCP. Rollback: scripts/sql/v271_rollback_aep_policies_admin.sql
drop policy if exists "admin pode excluir aep_relatorios" on public.aep_relatorios;
create policy "admin pode excluir aep_relatorios" on public.aep_relatorios
  for delete to authenticated using (public.caller_eh_admin());

drop policy if exists "admin pode gerir aep_textos_padrao" on public.aep_textos_padrao;
create policy "admin pode gerir aep_textos_padrao" on public.aep_textos_padrao
  for all to authenticated using (public.caller_eh_admin()) with check (public.caller_eh_admin());

-- Snapshots fantasmas da AEP 80543915 (o registro continua vivo).
delete from public.registros_excluidos
 where tabela = 'aep_relatorios' and registro_id = '80543915-c6f7-42cf-8c40-fae7eb89857d'
   and exists (select 1 from public.aep_relatorios a where a.id_relatorio::text = '80543915-c6f7-42cf-8c40-fae7eb89857d');
