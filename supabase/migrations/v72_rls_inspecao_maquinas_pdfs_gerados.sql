-- v72: fecha exposição via anon key. inspecao_maquinas e pdfs_gerados
-- estavam SEM RLS, com grants pro papel anon — qualquer um com a anon key
-- (embarcada no bundle) podia ler/alterar/apagar sem login. Espelha o padrão
-- das tabelas-irmãs (inventario_maquinas, pdfs_assinados): só authenticated.
alter table public.inspecao_maquinas enable row level security;
create policy "auth all inspecao_maquinas" on public.inspecao_maquinas
  for all to authenticated using (true) with check (true);

alter table public.pdfs_gerados enable row level security;
create policy "auth all pdfs_gerados" on public.pdfs_gerados
  for all to authenticated using (true) with check (true);

revoke all on public.inspecao_maquinas from anon;
revoke all on public.pdfs_gerados from anon;
