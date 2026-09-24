-- v159 — Extintores: a coerência entre situação e causas passa a valer no BANCO.
--
-- A v158 separou `situacao` de `nao_conformidades`, mas a regra "não conforme
-- exige ao menos uma causa" ficou só no formulário. Medido em 2026-08-05: o
-- banco aceitava `situacao='NAO_CONFORME'` com a lista vazia. Hoje o único
-- escritor da tabela é o ExtintorForm (a aba só apaga, o hook só lê), então a
-- brecha era teórica — mas regra que vive só na tela some no primeiro import,
-- script ou tela nova que alguém escrever.
--
-- O que passa a ser impossível gravar:
--   * NAO_CONFORME sem nenhuma causa
--   * CONFORME (ou não avaliado) COM causa — "conforme, mas vencido"
--   * causa em branco no meio da lista
--
-- Não toca em dado: os 158 registros já satisfazem as três regras (a v158
-- conferiu 0 incoerências). Se algum violasse, o ADD CONSTRAINT abortaria
-- sozinho — é a própria trava.
--
-- Não exige deploy: é só banco, e o app já grava em conformidade.
--
-- Desfazer: scripts/sql/v159_extintores_coerencia_check_rollback.sql

begin;

-- Rede de segurança: mostra o que quebraria ANTES de tentar criar a constraint,
-- senão o erro do Postgres diz só "violates check constraint" sem dizer quantos.
do $$
declare n_incoerente int; n_vazio int;
begin
  select count(*) into n_incoerente from public.extintores
   where case
           when situacao = 'NAO_CONFORME'
             then coalesce(array_length(nao_conformidades, 1), 0) = 0
           else coalesce(array_length(nao_conformidades, 1), 0) > 0
         end;
  select count(*) into n_vazio from public.extintores
   where exists (
     select 1 from unnest(nao_conformidades) as c where trim(c) = ''
   );
  if n_incoerente > 0 or n_vazio > 0 then
    raise exception 'v159 abortada: % extintores incoerentes e % com causa em branco — corrija antes', n_incoerente, n_vazio;
  end if;
  raise notice 'v159: base coerente, criando a trava';
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'extintores_coerencia_check'
  ) then
    alter table public.extintores
      add constraint extintores_coerencia_check
      check (
        case
          when situacao = 'NAO_CONFORME'
            then coalesce(array_length(nao_conformidades, 1), 0) > 0
          else coalesce(array_length(nao_conformidades, 1), 0) = 0
        end
        -- `array_position` e não `not exists (select ...)`: CHECK não aceita
        -- subquery. A tela já faz trim, então causa em branco chega como ''.
        and array_position(nao_conformidades, '') is null
      );
  end if;
end $$;

commit;
