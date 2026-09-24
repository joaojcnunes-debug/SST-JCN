-- Fase 13a — Permissões por lista na Gestão (acesso ver/editar por quadro).
-- DEFAULT ABERTO (restrito=false) => comportamento idêntico ao anterior (sem regressão).
-- Lista aberta: ver=todos, editar=caller_pode_editar(). Lista restrita: ver/editar só por gestao_acessos.
-- Funções SECURITY DEFINER (evitam recursão de RLS). Dependem de caller_eh_admin()/caller_pode_editar() (prod).
alter table public.gestao_quadros add column if not exists restrito boolean not null default false;

create table if not exists public.gestao_acessos (
  id uuid primary key,
  id_quadro text not null references public.gestao_quadros(id_quadro) on delete cascade,
  usuario_email text not null,
  papel text not null default 'viewer' check (papel in ('viewer','editor')),
  created_at timestamptz not null default now(),
  unique (id_quadro, usuario_email)
);
create index if not exists idx_gestao_acessos_email on public.gestao_acessos (lower(usuario_email));

create or replace function public.gestao_email() returns text
  language sql stable as $$ select lower(auth.jwt()->>'email') $$;

create or replace function public.gestao_pode_ver(p text) returns boolean
  language sql stable security definer set search_path=public as $$
  select public.caller_eh_admin()
    or exists (select 1 from gestao_quadros q where q.id_quadro=p and q.restrito=false)
    or exists (select 1 from gestao_acessos a where a.id_quadro=p and lower(a.usuario_email)=public.gestao_email());
$$;

create or replace function public.gestao_pode_editar_q(p text) returns boolean
  language sql stable security definer set search_path=public as $$
  select public.caller_eh_admin()
    or exists (select 1 from gestao_quadros q where q.id_quadro=p and q.restrito=false and public.caller_pode_editar())
    or exists (select 1 from gestao_acessos a where a.id_quadro=p and lower(a.usuario_email)=public.gestao_email() and a.papel='editor');
$$;

-- gestao_acessos RLS
alter table public.gestao_acessos enable row level security;
drop policy if exists gestao_acessos_sel on public.gestao_acessos;
drop policy if exists gestao_acessos_wr on public.gestao_acessos;
create policy gestao_acessos_sel on public.gestao_acessos for select to authenticated using (public.gestao_pode_ver(id_quadro));
create policy gestao_acessos_wr on public.gestao_acessos for all to authenticated using (public.gestao_pode_editar_q(id_quadro)) with check (public.gestao_pode_editar_q(id_quadro));

-- ===== Tabelas com id_quadro direto =====
-- gestao_quadros (INSERT próprio: o id novo ainda não existe na tabela)
drop policy if exists gestao_quadros_sel on public.gestao_quadros;
drop policy if exists gestao_quadros_wr on public.gestao_quadros;
create policy gestao_quadros_sel on public.gestao_quadros for select to authenticated using (public.gestao_pode_ver(id_quadro));
create policy gestao_quadros_ins on public.gestao_quadros for insert to authenticated with check (public.caller_pode_editar());
create policy gestao_quadros_upd on public.gestao_quadros for update to authenticated using (public.gestao_pode_editar_q(id_quadro)) with check (public.gestao_pode_editar_q(id_quadro));
create policy gestao_quadros_del on public.gestao_quadros for delete to authenticated using (public.gestao_pode_editar_q(id_quadro));

-- gestao_tarefas
drop policy if exists gestao_tarefas_sel on public.gestao_tarefas;
drop policy if exists gestao_tarefas_wr on public.gestao_tarefas;
create policy gestao_tarefas_sel on public.gestao_tarefas for select to authenticated using (public.gestao_pode_ver(id_quadro));
create policy gestao_tarefas_wr on public.gestao_tarefas for all to authenticated using (public.gestao_pode_editar_q(id_quadro)) with check (public.gestao_pode_editar_q(id_quadro));

-- gestao_status
drop policy if exists gestao_status_sel on public.gestao_status;
drop policy if exists gestao_status_wr on public.gestao_status;
create policy gestao_status_sel on public.gestao_status for select to authenticated using (public.gestao_pode_ver(id_quadro));
create policy gestao_status_wr on public.gestao_status for all to authenticated using (public.gestao_pode_editar_q(id_quadro)) with check (public.gestao_pode_editar_q(id_quadro));

-- gestao_campos
drop policy if exists gestao_campos_sel on public.gestao_campos;
drop policy if exists gestao_campos_wr on public.gestao_campos;
create policy gestao_campos_sel on public.gestao_campos for select to authenticated using (public.gestao_pode_ver(id_quadro));
create policy gestao_campos_wr on public.gestao_campos for all to authenticated using (public.gestao_pode_editar_q(id_quadro)) with check (public.gestao_pode_editar_q(id_quadro));

-- gestao_etiquetas
drop policy if exists gestao_etiq_sel on public.gestao_etiquetas;
drop policy if exists gestao_etiq_wr on public.gestao_etiquetas;
create policy gestao_etiq_sel on public.gestao_etiquetas for select to authenticated using (public.gestao_pode_ver(id_quadro));
create policy gestao_etiq_wr on public.gestao_etiquetas for all to authenticated using (public.gestao_pode_editar_q(id_quadro)) with check (public.gestao_pode_editar_q(id_quadro));

-- gestao_automacoes
drop policy if exists gestao_autom_sel on public.gestao_automacoes;
drop policy if exists gestao_autom_wr on public.gestao_automacoes;
create policy gestao_autom_sel on public.gestao_automacoes for select to authenticated using (public.gestao_pode_ver(id_quadro));
create policy gestao_autom_wr on public.gestao_automacoes for all to authenticated using (public.gestao_pode_editar_q(id_quadro)) with check (public.gestao_pode_editar_q(id_quadro));

-- gestao_formularios
drop policy if exists gestao_formularios_sel on public.gestao_formularios;
drop policy if exists gestao_formularios_wr on public.gestao_formularios;
create policy gestao_formularios_sel on public.gestao_formularios for select to authenticated using (public.gestao_pode_ver(id_quadro));
create policy gestao_formularios_wr on public.gestao_formularios for all to authenticated using (public.gestao_pode_editar_q(id_quadro)) with check (public.gestao_pode_editar_q(id_quadro));

-- ===== Tabelas via id_tarefa (subconsulta para o quadro) =====
-- gestao_comentarios
drop policy if exists gestao_coment_sel on public.gestao_comentarios;
drop policy if exists gestao_coment_wr on public.gestao_comentarios;
create policy gestao_coment_sel on public.gestao_comentarios for select to authenticated using (public.gestao_pode_ver((select t.id_quadro from public.gestao_tarefas t where t.id_tarefa = gestao_comentarios.id_tarefa)));
create policy gestao_coment_wr on public.gestao_comentarios for all to authenticated using (public.gestao_pode_editar_q((select t.id_quadro from public.gestao_tarefas t where t.id_tarefa = gestao_comentarios.id_tarefa))) with check (public.gestao_pode_editar_q((select t.id_quadro from public.gestao_tarefas t where t.id_tarefa = gestao_comentarios.id_tarefa)));

-- gestao_dependencias
drop policy if exists gestao_dep_sel on public.gestao_dependencias;
drop policy if exists gestao_dep_wr on public.gestao_dependencias;
create policy gestao_dep_sel on public.gestao_dependencias for select to authenticated using (public.gestao_pode_ver((select t.id_quadro from public.gestao_tarefas t where t.id_tarefa = gestao_dependencias.id_tarefa)));
create policy gestao_dep_wr on public.gestao_dependencias for all to authenticated using (public.gestao_pode_editar_q((select t.id_quadro from public.gestao_tarefas t where t.id_tarefa = gestao_dependencias.id_tarefa))) with check (public.gestao_pode_editar_q((select t.id_quadro from public.gestao_tarefas t where t.id_tarefa = gestao_dependencias.id_tarefa)));

-- gestao_tempo
drop policy if exists gestao_tempo_sel on public.gestao_tempo;
drop policy if exists gestao_tempo_wr on public.gestao_tempo;
create policy gestao_tempo_sel on public.gestao_tempo for select to authenticated using (public.gestao_pode_ver((select t.id_quadro from public.gestao_tarefas t where t.id_tarefa = gestao_tempo.id_tarefa)));
create policy gestao_tempo_wr on public.gestao_tempo for all to authenticated using (public.gestao_pode_editar_q((select t.id_quadro from public.gestao_tarefas t where t.id_tarefa = gestao_tempo.id_tarefa))) with check (public.gestao_pode_editar_q((select t.id_quadro from public.gestao_tarefas t where t.id_tarefa = gestao_tempo.id_tarefa)));

-- gestao_anexos
drop policy if exists gestao_anexos_sel on public.gestao_anexos;
drop policy if exists gestao_anexos_wr on public.gestao_anexos;
create policy gestao_anexos_sel on public.gestao_anexos for select to authenticated using (public.gestao_pode_ver((select t.id_quadro from public.gestao_tarefas t where t.id_tarefa = gestao_anexos.id_tarefa)));
create policy gestao_anexos_wr on public.gestao_anexos for all to authenticated using (public.gestao_pode_editar_q((select t.id_quadro from public.gestao_tarefas t where t.id_tarefa = gestao_anexos.id_tarefa))) with check (public.gestao_pode_editar_q((select t.id_quadro from public.gestao_tarefas t where t.id_tarefa = gestao_anexos.id_tarefa)));

-- gestao_atividades (SELECT + INSERT; append-only)
drop policy if exists gestao_ativ_sel on public.gestao_atividades;
drop policy if exists gestao_ativ_ins on public.gestao_atividades;
create policy gestao_ativ_sel on public.gestao_atividades for select to authenticated using (public.gestao_pode_ver((select t.id_quadro from public.gestao_tarefas t where t.id_tarefa = gestao_atividades.id_tarefa)));
create policy gestao_ativ_ins on public.gestao_atividades for insert to authenticated with check (public.gestao_pode_editar_q((select t.id_quadro from public.gestao_tarefas t where t.id_tarefa = gestao_atividades.id_tarefa)));
