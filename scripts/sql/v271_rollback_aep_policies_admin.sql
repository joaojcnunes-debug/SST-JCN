-- Rollback da v271 (volta as policies antigas, que não funcionavam).
drop policy if exists "admin pode excluir aep_relatorios" on public.aep_relatorios;
create policy "admin pode excluir aep_relatorios" on public.aep_relatorios for delete
  using (exists (select 1 from public.usuarios where usuarios.id_usuario = (auth.uid())::text and usuarios.perfil = 'Admin'));
drop policy if exists "admin pode gerir aep_textos_padrao" on public.aep_textos_padrao;
create policy "admin pode gerir aep_textos_padrao" on public.aep_textos_padrao for all
  using (exists (select 1 from public.usuarios where usuarios.id_usuario = (auth.uid())::text and usuarios.perfil = 'Admin'));
