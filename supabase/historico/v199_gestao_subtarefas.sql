-- v199 — GESTAO-UX-01-UXB-F21 (F2.1): a subtarefa jsonb vira TABELA gestao_subtarefas.
--
-- Hoje subtarefa e jsonb {texto,feito} SEM identidade em gestao_tarefas.subtarefas
-- (useGestao.ts). Isso trava a aba rica da UX-B (Etapa/Tipo, gatilho por subtarefa).
-- Esta migration promove a subtarefa para tabela satelite (id, ordem, etapa, tipo ja
-- nullable p/ a UX-B) e mantem TODO leitor do jsonb funcionando via trigger-espelho —
-- mesmo padrao do gestao_vinculo_espelho_trg (v187) que mantem responsavel.
--
-- Fonte de verdade da EDICAO = a tabela; o jsonb gestao_tarefas.subtarefas vira ESPELHO
-- (reconstruido pelo trigger a cada insert/update/delete). O card (TarefaCard.tsx:72),
-- o form (app/api/gestao/form/route.ts) e o tipo Tarefa.subtarefas seguem intactos.
--
-- Grants: licao feedback_pg_default_privileges_tabela_nova_aberta / SEC-GESTAO-01 —
-- toda tabela nova nasce arwd para authenticated por DEFAULT PRIVILEGES. Revogo tudo e
-- reconcedo o mesmo conjunto do satelite equivalente gestao_anexos (CRUD por
-- authenticated, gated pela RLS). anon/public: nada.
--
-- RLS: policies de satelite compostas com gestao_ve_tarefa (contrato F1.3-B/v197),
-- espelhadas VERBATIM das policies vivas de gestao_anexos (gestao_anexos_sel /
-- gestao_anexos_wr), so trocando o nome da tabela.
--
-- Idempotente: create ... if not exists / drop policy if exists + create /
-- create or replace / drop trigger if exists convergem; aplica 2x com exit 0. O backfill
-- so roda com a tabela vazia. begin;...commit; PROPRIO — NAO aplicar com psql -1.
-- schema_migrations e inserido pelo operador no apply (padrao v196 — migrate.ps1);
-- o rollback (scripts/sql/v199_gestao_subtarefas.rollback.sql) remove a linha.

begin;

-- (0) Guardas — falha fechada (padrao v187): sem as funcoes da RLS de satelite, aborta
--     antes de tocar em nada, em vez de criar policy que so quebraria em runtime.
do $$
begin
  if to_regclass('public.gestao_tarefas') is null then
    raise exception 'v199: public.gestao_tarefas nao existe — abortado';
  end if;
  if to_regprocedure('public.gestao_pode_ver(text)') is null then
    raise exception 'v199: gestao_pode_ver(text) ausente — a RLS de SELECT dependeria dela; abortado';
  end if;
  if to_regprocedure('public.gestao_pode_editar_q(text)') is null then
    raise exception 'v199: gestao_pode_editar_q(text) ausente — a RLS de escrita dependeria dela; abortado';
  end if;
  if to_regprocedure('public.gestao_ve_tarefa(text)') is null then
    raise exception 'v199: gestao_ve_tarefa(text) ausente (v197) — a composicao de satelite dependeria dela; abortado';
  end if;
end $$;

-- (1) Tabela ────────────────────────────────────────────────────────────────────
-- id_tarefa e TEXT: a PK de gestao_tarefas e id_tarefa text (nao `id`). ON DELETE
-- CASCADE = apagar a tarefa apaga suas subtarefas (mesmo do gestao_anexos v100).
-- etapa/tipo nullable = prontos para a aba rica da UX-B, sem 2a migration.
create table if not exists public.gestao_subtarefas (
  id text primary key,
  id_tarefa text not null references public.gestao_tarefas(id_tarefa) on delete cascade,
  texto text not null,
  feito boolean not null default false,
  ordem int not null default 0,
  etapa text,
  tipo text,
  created_at timestamptz not null default now()
);

create index if not exists idx_gestao_subtarefas_tarefa
  on public.gestao_subtarefas (id_tarefa);
create index if not exists idx_gestao_subtarefas_ordem
  on public.gestao_subtarefas (id_tarefa, ordem);

comment on table public.gestao_subtarefas is
  'Subtarefas por tarefa (fonte de verdade da edicao). gestao_tarefas.subtarefas (jsonb) '
  'e ESPELHO reconstruido pelo trigger gestao_subtarefa_espelho_trg. etapa/tipo prontos '
  'para a aba rica da UX-B (GESTAO-UX-01-UXB-F21 / F2.1). Escrita so por authenticated com '
  'gestao_pode_editar_q(quadro-pai) AND gestao_ve_tarefa(id_tarefa) via RLS.';

-- (2) Fecha a armadilha de default privileges (arwd aberto a authenticated — raiz de
--     SEC-GESTAO-01). Revoga tudo e reconcede o MESMO conjunto do gestao_anexos: CRUD
--     por authenticated, gated pela RLS. anon/public: nada.
revoke all on public.gestao_subtarefas from authenticated;
revoke all on public.gestao_subtarefas from anon;
revoke all on public.gestao_subtarefas from public;
grant select, insert, update, delete on public.gestao_subtarefas to authenticated;
-- backup_operator=r: cobre a tabela nova no dump logico (espelha gestao_anexos; sem esse
-- grant a subtarefa ficaria fora do backup se o dump roda sob a role backup_operator).
grant select on public.gestao_subtarefas to backup_operator;

-- (3) RLS on + policies de satelite compostas com gestao_ve_tarefa — espelho VERBATIM
--     das policies vivas de gestao_anexos (v197 2.2 e 2.8.2), so trocando a tabela.
alter table public.gestao_subtarefas enable row level security;

-- 3.1 SELECT (== gestao_anexos_sel)
drop policy if exists gestao_subtarefas_sel on public.gestao_subtarefas;
create policy gestao_subtarefas_sel on public.gestao_subtarefas
  for select to authenticated
  using (
    gestao_pode_ver(( SELECT t.id_quadro
       FROM gestao_tarefas t
      WHERE (t.id_tarefa = gestao_subtarefas.id_tarefa)))
    and public.gestao_ve_tarefa(gestao_subtarefas.id_tarefa)
  );

-- 3.2 WRITE FOR ALL (== gestao_anexos_wr): USING compoe gestao_ve_tarefa (o USING de
--     FOR ALL tambem incide no SELECT — furo 2.8 do v197); WITH CHECK so por
--     gestao_pode_editar_q (HAZARD/Decisao 4 do v197: nao compor ve_tarefa no INSERT).
drop policy if exists gestao_subtarefas_wr on public.gestao_subtarefas;
create policy gestao_subtarefas_wr on public.gestao_subtarefas
  for all to authenticated
  using (
    gestao_pode_editar_q(( SELECT t.id_quadro
       FROM gestao_tarefas t
      WHERE (t.id_tarefa = gestao_subtarefas.id_tarefa)))
    and public.gestao_ve_tarefa(gestao_subtarefas.id_tarefa)
  )
  with check (gestao_pode_editar_q(( SELECT t.id_quadro
     FROM gestao_tarefas t
    WHERE (t.id_tarefa = gestao_subtarefas.id_tarefa))));

-- (4) Trigger-espelho server-side (padrao v187, direcao unica tabela -> jsonb).
--     Reconstroi gestao_tarefas.subtarefas = [{texto,feito}] ordenado por (ordem,created_at)
--     da tarefa afetada. Sem guarda de recursao: o trigger e SO em gestao_subtarefas; o
--     update no jsonb de gestao_tarefas nao dispara nada de volta. NAO bumpa updated_at
--     (evita reordenar/notificar por espelho). Mantem card e todo leitor do jsonb.
create or replace function public.gestao_subtarefa_espelho_trg() returns trigger
  language plpgsql security definer set search_path=public as $fn$
declare v_id text;
begin
  v_id := coalesce(new.id_tarefa, old.id_tarefa);
  update public.gestao_tarefas t
     set subtarefas = coalesce((
       select jsonb_agg(jsonb_build_object('texto', s.texto, 'feito', s.feito)
                        order by s.ordem, s.created_at)
         from public.gestao_subtarefas s
        where s.id_tarefa = v_id
     ), '[]'::jsonb)
   where t.id_tarefa = v_id;
  return null;
end $fn$;

alter function public.gestao_subtarefa_espelho_trg() owner to chabra_admin;

drop trigger if exists gestao_subtarefa_espelho_trg on public.gestao_subtarefas;
create trigger gestao_subtarefa_espelho_trg
  after insert or update or delete on public.gestao_subtarefas
  for each row execute function public.gestao_subtarefa_espelho_trg();

-- (5) Backfill idempotente — SO com a tabela vazia (a 2a aplicacao nao duplica). Uma linha
--     por elemento de gestao_tarefas.subtarefas, preservando a ORDEM (ordinality-1 = ordem).
--     id no formato gerarId (PREFIXO-8HEX). O proprio INSERT dispara o trigger e reescreve
--     o jsonb identico (idempotente).
do $$
begin
  if not exists (select 1 from public.gestao_subtarefas) then
    insert into public.gestao_subtarefas (id, id_tarefa, texto, feito, ordem)
    select 'SUB-' || upper(substr(md5(gen_random_uuid()::text), 1, 8)),
           t.id_tarefa,
           elem->>'texto',
           coalesce((elem->>'feito')::boolean, false),
           (ord - 1)::int
      from public.gestao_tarefas t
      -- guarda o INPUT do lateral (jsonb_array_elements erra se o valor nao for array;
      -- o WHERE so filtra DEPOIS de a funcao rodar). A coluna e jsonb not null default '[]'.
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(t.subtarefas) = 'array' then t.subtarefas else '[]'::jsonb end
      ) with ordinality as e(elem, ord)
     where coalesce(btrim(elem->>'texto'), '') <> '';
    raise notice 'v199 backfill: % subtarefa(s) inserida(s) a partir do jsonb',
      (select count(*) from public.gestao_subtarefas);
  else
    raise notice 'v199 backfill: gestao_subtarefas nao-vazia — backfill pulado (idempotente)';
  end if;
end $$;

commit;
