-- v216 — Gestão Chabra: G1.1 — trilha de movimentações da tarefa (histórico).
--
-- Uma linha por CAMPO alterado em gestao_tarefas (status/prioridade/prazo/data_inicio/titulo).
-- INSERT de tarefa → uma linha tipo 'criada'. O front (G1.2) mescla isto com gestao_comentarios
-- numa linha do tempo ordenada por created_at na sidebar do TarefaModal.
--
-- Arquitetura (rubrica GESTAO-KANBAN-02-G1):
--   • Trigger AFTER insert/update em gestao_tarefas — SÓ GRAVA no histórico. ZERO HTTP no banco
--     (mesmo contrato dos triggers da esteira v199/v209). SECURITY DEFINER owner chabra_admin →
--     escreve mesmo sem grant de escrita ao caller. Escrita da tabela é EXCLUSIVA do trigger.
--   • ator = public.gestao_email() (e-mail do JWT da sessão) se disponível, senão null. O "quem"
--     fino pode ser enriquecido depois; null é aceitável na v1.
--   • RLS ON + revoke all (anon/authenticated/public) + policy de SELECT reusando
--     gestao_ve_tarefa(id_tarefa): quem vê a tarefa vê o histórico dela (mesmo princípio de
--     visibilidade dos comentários/subtarefas). Sem policy de escrita — só o trigger grava.
--   • grant select a authenticated (RLS-gated, lido via PostgREST) + select a backup_operator.
--
-- Aditivo/reversível: a tabela é nova e isolada; o drop no rollback não afeta nada existente.
-- Idempotente 2×: create table/index if not exists, create or replace function, drop trigger/policy
-- if exists + create. $fn$ fechado com ';'.

-- (0) Pré-condições: aborta cedo se as dependências não existem (espelha v199) ────────
-- NO JCN: esta migration foi aplicada sem os "alter function ... owner to
-- chabra_admin" e sem os grants a backup_operator — as duas roles sao do
-- painel self-host e nao existem aqui. As funcoes ficam com o dono padrao
-- (postgres), que ja e quem o SECURITY DEFINER precisa ser, e o dump logico
-- no JCN e responsabilidade do Supabase, nao de uma role de backup.

do $$
begin
  if to_regclass('public.gestao_tarefas') is null then
    raise exception 'v216: public.gestao_tarefas nao existe — abortado';
  end if;
  if to_regprocedure('public.gestao_ve_tarefa(text)') is null then
    raise exception 'v216: gestao_ve_tarefa(text) ausente (v197) — a policy de SELECT dependeria dela; abortado';
  end if;
end $$;

-- (1) Tabela ──────────────────────────────────────────────────────────────────────
-- id_tarefa é TEXT (a PK de gestao_tarefas é id_tarefa text). ON DELETE CASCADE: apagar a
-- tarefa apaga o histórico dela (mesmo de gestao_comentarios v88). de/para em TEXT (as datas
-- viram texto no trigger) para uniformizar a linha do tempo.
create table if not exists public.gestao_tarefa_historico (
  id bigserial primary key,
  id_tarefa text not null references public.gestao_tarefas(id_tarefa) on delete cascade,
  ator text,
  tipo text not null
    check (tipo in ('status','prioridade','prazo','data_inicio','titulo','criada')),
  campo text,
  de text,
  para text,
  created_at timestamptz not null default now()
);

create index if not exists idx_gestao_tarefa_historico_tarefa
  on public.gestao_tarefa_historico (id_tarefa, created_at);

comment on table public.gestao_tarefa_historico is
  'Trilha de movimentacoes por tarefa (uma linha por campo alterado). Escrita EXCLUSIVA do '
  'trigger gestao_tarefa_historico_trg (AFTER, SECURITY DEFINER owner chabra_admin, zero HTTP). '
  'Leitura via PostgREST por authenticated, gated pela policy que reusa gestao_ve_tarefa(id_tarefa). '
  'O front (G1.2) mescla com gestao_comentarios por created_at na sidebar do TarefaModal.';

-- (2) Trigger: SÓ GRAVA o histórico (zero HTTP) ────────────────────────────────────
-- SECURITY DEFINER owner chabra_admin → grava mesmo sem grant de escrita ao caller. Uma linha
-- por campo alterado no UPDATE; INSERT → uma linha 'criada'. Datas viram texto (::text).
create or replace function public.gestao_tarefa_historico_trg() returns trigger
  language plpgsql security definer set search_path=public as $fn$
declare
  v_ator text;
begin
  -- e-mail da sessao (JWT via PostgREST) se disponivel, senao null. gestao_email() e STABLE e
  -- resolve auth.jwt()->>'email'; fora de contexto PostgREST retorna null (ok).
  begin
    v_ator := public.gestao_email();
  exception when others then
    v_ator := null;
  end;

  if tg_op = 'INSERT' then
    insert into public.gestao_tarefa_historico (id_tarefa, ator, tipo, campo, de, para)
    values (new.id_tarefa, v_ator, 'criada', null, null, new.titulo);
    return null;
  end if;

  -- UPDATE: uma linha por campo relevante que mudou (is distinct from cobre null↔valor).
  if new.status is distinct from old.status then
    insert into public.gestao_tarefa_historico (id_tarefa, ator, tipo, campo, de, para)
    values (new.id_tarefa, v_ator, 'status', 'status', old.status, new.status);
  end if;

  if new.prioridade is distinct from old.prioridade then
    insert into public.gestao_tarefa_historico (id_tarefa, ator, tipo, campo, de, para)
    values (new.id_tarefa, v_ator, 'prioridade', 'prioridade', old.prioridade, new.prioridade);
  end if;

  if new.prazo is distinct from old.prazo then
    insert into public.gestao_tarefa_historico (id_tarefa, ator, tipo, campo, de, para)
    values (new.id_tarefa, v_ator, 'prazo', 'prazo', old.prazo::text, new.prazo::text);
  end if;

  if new.data_inicio is distinct from old.data_inicio then
    insert into public.gestao_tarefa_historico (id_tarefa, ator, tipo, campo, de, para)
    values (new.id_tarefa, v_ator, 'data_inicio', 'data_inicio', old.data_inicio::text, new.data_inicio::text);
  end if;

  if new.titulo is distinct from old.titulo then
    insert into public.gestao_tarefa_historico (id_tarefa, ator, tipo, campo, de, para)
    values (new.id_tarefa, v_ator, 'titulo', 'titulo', old.titulo, new.titulo);
  end if;

  return null;
end $fn$;


drop trigger if exists gestao_tarefa_historico_trg on public.gestao_tarefas;
create trigger gestao_tarefa_historico_trg
  after insert or update on public.gestao_tarefas
  for each row execute function public.gestao_tarefa_historico_trg();

-- (3) Fechamento de segurança ──────────────────────────────────────────────────────
-- Tabela nova nasce arwd para authenticated (default privileges desta base — raiz de
-- SEC-GESTAO-01). Revoga tudo; reconcede SÓ SELECT a authenticated (RLS-gated). Sem grant de
-- escrita: o trigger (SECURITY DEFINER owner) é a única via de escrita. backup_operator=r.
alter table public.gestao_tarefa_historico enable row level security;

revoke all on public.gestao_tarefa_historico from authenticated;
revoke all on public.gestao_tarefa_historico from anon;
revoke all on public.gestao_tarefa_historico from public;

grant select on public.gestao_tarefa_historico to authenticated;
-- backup_operator=r: cobre a tabela nova no dump logico (espelha gestao_subtarefas/anexos).

-- SELECT policy ESPELHANDO gestao_coment_sel (SEC-G1): a visibilidade do histórico tem de ser
-- IDÊNTICA à dos comentários e da própria tarefa — gestao_pode_ver(quadro) AND gestao_ve_tarefa.
-- Só gestao_ve_tarefa vazaria: ele retorna true em ramos (grant na tarefa, vinculado/criador
-- não-membro do quadro) onde gestao_pode_ver é falso — nesses estados a tarefa e os comentários
-- NÃO aparecem, mas o histórico apareceria (ator/e-mail + transições de status/prazo). O conjunto
-- gestao_pode_ver fecha isso. Sem policy de INSERT/UPDATE/DELETE → authenticated não escreve (só o
-- trigger, como owner). service_role (BYPASSRLS) lê livre para o worker/backup.
drop policy if exists gestao_tarefa_historico_sel on public.gestao_tarefa_historico;
create policy gestao_tarefa_historico_sel on public.gestao_tarefa_historico
  for select to authenticated
  using (
    public.gestao_pode_ver((
      select t.id_quadro from public.gestao_tarefas t
       where t.id_tarefa = gestao_tarefa_historico.id_tarefa
    ))
    and public.gestao_ve_tarefa(gestao_tarefa_historico.id_tarefa)
  );
