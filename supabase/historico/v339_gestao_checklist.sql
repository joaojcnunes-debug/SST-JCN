-- v339 — Gestão: checklist da tarefa (10/11/2026, 0.3.267).
--
-- Trazida da v351 do Painel SST (0.3.914). Checklist separado das subtarefas: itens simples de marcar, sem responsável,
-- sem janela própria e sem automação. Tabela satélite gestao_checklist_itens com o MESMO acesso das subtarefas do JCN
-- (policies gestao_subtarefas_sel/_wr, v199). Quem criou / marcou e quando: gatilho, a partir do JWT (gestao_email).
-- Diferenças do Painel: o JCN não tem as tarefas restritas (v306 do Painel), a OS da T.I (v340 do Painel), o papel
-- backup_operator nem schema_migrations — essas partes ficaram de fora.
-- Rollback: scripts/sql/v339_gestao_checklist_rollback.sql
begin;

do $$
begin
  if to_regclass('public.gestao_tarefas') is null then raise exception 'v339: gestao_tarefas não existe'; end if;
  if to_regprocedure('public.gestao_pode_ver(text)') is null
     or to_regprocedure('public.gestao_pode_editar_q(text)') is null
     or to_regprocedure('public.gestao_ve_tarefa(text)') is null then
    raise exception 'v339: faltam as funções da RLS de satélite (gestao_pode_ver / gestao_pode_editar_q / gestao_ve_tarefa)';
  end if;
  if to_regprocedure('public.gestao_email()') is null then raise exception 'v339: falta gestao_email()'; end if;
end $$;

create table if not exists public.gestao_checklist_itens (
  id text primary key,
  id_tarefa text not null references public.gestao_tarefas(id_tarefa) on delete cascade,
  texto text not null check (length(btrim(texto)) > 0),
  feito boolean not null default false,
  ordem int not null default 0,
  feito_por text,
  feito_em timestamptz,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists idx_gestao_checklist_itens_tarefa on public.gestao_checklist_itens (id_tarefa, ordem);

comment on table public.gestao_checklist_itens is
  'v339 (Painel v351): checklist da tarefa (itens simples de marcar, sem responsável). Mesmo acesso de gestao_subtarefas; '
  'feito_por/feito_em gravados pelo gatilho gestao_checklist_item_trg.';

revoke all on public.gestao_checklist_itens from authenticated;
revoke all on public.gestao_checklist_itens from anon;
revoke all on public.gestao_checklist_itens from public;
grant select, insert, update, delete on public.gestao_checklist_itens to authenticated;

alter table public.gestao_checklist_itens enable row level security;

-- == gestao_subtarefas_sel (v199)
drop policy if exists gestao_checklist_itens_sel on public.gestao_checklist_itens;
create policy gestao_checklist_itens_sel on public.gestao_checklist_itens
  for select to authenticated
  using (
    gestao_pode_ver(( SELECT t.id_quadro
       FROM gestao_tarefas t
      WHERE (t.id_tarefa = gestao_checklist_itens.id_tarefa)))
    and public.gestao_ve_tarefa(gestao_checklist_itens.id_tarefa)
  );

-- == gestao_subtarefas_wr (v199)
drop policy if exists gestao_checklist_itens_wr on public.gestao_checklist_itens;
create policy gestao_checklist_itens_wr on public.gestao_checklist_itens
  for all to authenticated
  using (
    gestao_pode_editar_q(( SELECT t.id_quadro
       FROM gestao_tarefas t
      WHERE (t.id_tarefa = gestao_checklist_itens.id_tarefa)))
    and public.gestao_ve_tarefa(gestao_checklist_itens.id_tarefa)
  )
  with check (gestao_pode_editar_q(( SELECT t.id_quadro
     FROM gestao_tarefas t
    WHERE (t.id_tarefa = gestao_checklist_itens.id_tarefa))));

-- Quem criou / quem marcou e quando: do JWT (gestao_email), nunca do que o navegador mandar.
create or replace function public.gestao_checklist_item_trg() returns trigger
  language plpgsql set search_path = public as $fn$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(public.gestao_email(), new.created_by);
    if new.feito then
      new.feito_por := coalesce(public.gestao_email(), new.feito_por);
      new.feito_em := now();
    else
      new.feito_por := null;
      new.feito_em := null;
    end if;
  else
    new.created_by := old.created_by;
    if new.feito is distinct from old.feito then
      if new.feito then
        new.feito_por := public.gestao_email();
        new.feito_em := now();
      else
        new.feito_por := null;
        new.feito_em := null;
      end if;
    else
      new.feito_por := old.feito_por;
      new.feito_em := old.feito_em;
    end if;
  end if;
  return new;
end $fn$;

drop trigger if exists gestao_checklist_item_trg on public.gestao_checklist_itens;
create trigger gestao_checklist_item_trg before insert or update on public.gestao_checklist_itens
  for each row execute function public.gestao_checklist_item_trg();

notify pgrst, 'reload schema';

commit;
