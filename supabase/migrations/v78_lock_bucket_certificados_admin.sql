-- v78: Item 3 da auditoria — trava o bucket certificados (.pfx A1) para acesso
-- direto SÓ de Admin. Técnicos/Visualizadores não leem mais o .pfx de ninguém
-- pelo storage. A assinatura (/api/sign-pdf) e a verificação de validade
-- (/api/cert/validar) leem o .pfx via service_role (bypassa RLS), então
-- continuam funcionando para qualquer signatário. Upload/remoção é feito na
-- tela admin de Usuários (sessão de Admin).
drop policy if exists "Auth read certificados" on storage.objects;
drop policy if exists "Auth write certificados" on storage.objects;
drop policy if exists "Auth update certificados" on storage.objects;
drop policy if exists "Auth delete certificados" on storage.objects;

create policy "Admin read certificados" on storage.objects for select to authenticated
  using (bucket_id = 'certificados' and public.caller_eh_admin());
create policy "Admin write certificados" on storage.objects for insert to authenticated
  with check (bucket_id = 'certificados' and public.caller_eh_admin());
create policy "Admin update certificados" on storage.objects for update to authenticated
  using (bucket_id = 'certificados' and public.caller_eh_admin());
create policy "Admin delete certificados" on storage.objects for delete to authenticated
  using (bucket_id = 'certificados' and public.caller_eh_admin());
