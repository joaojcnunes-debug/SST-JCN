-- v228 — Gestão: o destinatário pode APAGAR as próprias notificações.
--
-- Motivo: botão "Limpar notificações" na tela Notificações (ex-"Caixa de
--   entrada"). Até aqui gestao_notificacoes (v94) só tinha policies de
--   select/update/insert; sem policy de DELETE a RLS nega qualquer exclusão,
--   mesmo com o grant de tabela presente (default privileges dão arwd a
--   authenticated na produção — o grant abaixo é idempotente e cobre o caso
--   de um rebuild a partir do schema.sql).
--
-- Escopo: só as linhas cujo destinatário é o próprio JWT — espelha notif_sel
--   e notif_upd. Não abre nada para anon nem para outro destinatário.
--   Direção da mudança: AMPLIA o que o dono pode fazer com o que já é dele.

begin;

grant delete on public.gestao_notificacoes to authenticated;

drop policy if exists notif_del on public.gestao_notificacoes;
create policy notif_del on public.gestao_notificacoes
  for delete to authenticated
  using (lower(destinatario) = lower(auth.jwt()->>'email'));

commit;
