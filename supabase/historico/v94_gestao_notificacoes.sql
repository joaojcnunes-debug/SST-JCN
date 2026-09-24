-- V94 — Gestão Chabra: notificações in-app (estrutura preparada para e-mail)

create table if not exists public.gestao_notificacoes (
  id uuid primary key,
  destinatario text not null,                  -- usuario_email
  tipo text not null,                          -- atribuicao|comentario|mencao|status|prazo
  titulo text not null,
  id_tarefa text references public.gestao_tarefas(id_tarefa) on delete cascade,
  id_quadro text references public.gestao_quadros(id_quadro) on delete cascade,
  lida boolean not null default false,
  canal text not null default 'in_app',        -- in_app | email (futuro)
  email_enviado boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_gestao_notif_dest on public.gestao_notificacoes (destinatario, lida, created_at desc);

alter table public.gestao_notificacoes enable row level security;
-- O destinatário lê/atualiza apenas as suas; qualquer interno (Admin/Técnico) pode criar para outro.
drop policy if exists notif_sel on public.gestao_notificacoes;
create policy notif_sel on public.gestao_notificacoes for select to authenticated using (lower(destinatario)=lower(auth.jwt()->>'email'));
drop policy if exists notif_upd on public.gestao_notificacoes;
create policy notif_upd on public.gestao_notificacoes for update to authenticated using (lower(destinatario)=lower(auth.jwt()->>'email')) with check (lower(destinatario)=lower(auth.jwt()->>'email'));
drop policy if exists notif_ins on public.gestao_notificacoes;
create policy notif_ins on public.gestao_notificacoes for insert to authenticated with check (public.caller_pode_editar());
