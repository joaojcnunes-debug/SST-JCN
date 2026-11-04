-- Rollback da v320: devolve a policy aberta "auth write usuarios" (como estava antes de 04/11/2026)
-- e tira a RPC usuario_atualizar_meu_perfil. ATENÇÃO: reabre a brecha (qualquer conta logada
-- altera qualquer usuário). Se reverter, reverta também o código do Portal › Meu perfil (0.3.228).
begin;

create policy "auth write usuarios" on public.usuarios
  for all to authenticated using (true) with check (true);

drop function if exists public.usuario_atualizar_meu_perfil(text, text);

commit;
