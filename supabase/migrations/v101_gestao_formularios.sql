-- Fase 11c — Formulários de entrada (captação de tarefas via link público).
-- A tabela é gerida internamente (RLS); a página pública NÃO lê a tabela direto:
-- a Edge Function gestao-form-submit (service role) valida o token e cria a tarefa.
create table if not exists public.gestao_formularios (
  id uuid primary key,
  id_quadro text not null references public.gestao_quadros(id_quadro) on delete cascade,
  titulo text not null,
  descricao text,
  token text not null unique,
  ativo boolean not null default true,
  mostra_descricao boolean not null default true,
  mostra_prazo boolean not null default false,
  mostra_prioridade boolean not null default false,
  prioridade_padrao text not null default 'Media',
  status_inicial text,
  responsavel_padrao text,
  etiquetas_padrao text[] not null default '{}',
  perguntas jsonb not null default '[]',
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists idx_gestao_formularios_quadro on public.gestao_formularios (id_quadro);
alter table public.gestao_formularios enable row level security;
create policy gestao_formularios_sel on public.gestao_formularios for select to authenticated using (true);
create policy gestao_formularios_wr on public.gestao_formularios for all to authenticated using (public.caller_pode_editar()) with check (public.caller_pode_editar());
