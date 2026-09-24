-- v251 — DIM-01: a FK de hierarquia de `dim_funcoes` vira DEFERRABLE.
--
-- Achado pela prévia da carga (2026-09-23):
--
--   pg_dump: warning: there are circular foreign-key constraints on this table:
--   pg_dump: detail: funcoes
--   pg_dump: hint: You might not be able to restore the dump without using
--                  --disable-triggers or temporarily dropping the constraints.
--
-- `dim_funcoes.responde_para` aponta para `dim_funcoes.id` — é a hierarquia de chefias
-- (Gerente → Supervisor Geral → Supervisor ADM). O `pg_dump --data-only` emite as linhas
-- na ordem FÍSICA da tabela, não em ordem topológica: basta uma subordinada vir antes da
-- chefia dela para a FK estourar e a transação inteira voltar. Com 6 linhas isso pode
-- passar por sorte — e sorte não é critério para carga de dado.
--
-- Por que DEFERRABLE e não as alternativas:
--   • `ALTER TABLE ... DISABLE TRIGGER ALL` cobriria, mas desabilitar gatilho interno de
--     FK exige SUPERUSUÁRIO, e `chabra_admin` não é (e não deve ser).
--   • Carregar com `responde_para` nulo e corrigir depois exige mexer nos INSERT do dump
--     — justamente o que `--column-inserts` existe para evitar.
--   • DEFERRABLE INITIALLY DEFERRED move a checagem para o COMMIT: no fim da transação
--     todas as linhas existem e a integridade é verificada uma vez, inteira. Fora de
--     carga, nada muda — quem tentar gravar hierarquia inválida continua sendo barrado,
--     só que no commit em vez de na linha.
--
-- Vale para qualquer carga futura desta tabela, não só a de hoje.
--
-- Rollback: scripts/sql/v251_rollback_dim_funcoes_fk_adiavel.sql

begin;

do $$ begin
  if current_user <> 'postgres' then
    raise exception 'aplicar como postgres (dono da tabela)';
  end if;
  if to_regclass('public.dim_funcoes') is null then
    raise exception 'v249 (dim_funcoes) é pré-requisito desta migration';
  end if;
end $$;

alter table public.dim_funcoes
  drop constraint if exists dim_funcoes_responde_para_fkey;

alter table public.dim_funcoes
  add constraint dim_funcoes_responde_para_fkey
  foreign key (responde_para) references public.dim_funcoes(id)
  on delete set null
  deferrable initially deferred;

comment on constraint dim_funcoes_responde_para_fkey on public.dim_funcoes is
  'v251: adiável. A hierarquia de chefias é autorreferente e o pg_dump --data-only não ordena topologicamente; com a checagem no COMMIT a carga entra em qualquer ordem. Hierarquia inválida continua barrada — no commit.';


commit;
