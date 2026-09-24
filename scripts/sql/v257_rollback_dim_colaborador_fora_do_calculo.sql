-- ROLLBACK da v257 — tira as colunas `sem_producao_diaria` e `gestao` de dim_colaboradores.
--
-- ⚠️ ISTO APAGA QUEM ESTAVA MARCADO. Não há backup: a informação é um par de booleanos
-- preenchido a mão na tela de Colaboradores, e `drop column` leva junto. Se houver alguém
-- marcado e você quiser poder voltar, guarde antes:
--
--   \copy (select id, nome, sem_producao_diaria, gestao from public.dim_colaboradores
--          where sem_producao_diaria or gestao) to '/tmp/dim-fora-do-calculo.csv' csv header
--
-- Efeito no número: todo mundo volta a contar como capacidade, e o déficit exibido CAI de
-- volta (era o estado até 2026-09-24). Ver o cabeçalho da v257 para o porquê.
--
-- O código também precisa voltar: sem o push revertido, a tela lê colunas que não existem
-- e o PostgREST devolve erro no cadastro inteiro — `/dimensionamento` para de carregar.

begin;

do $$ begin
  if current_user <> 'chabra_admin' then raise exception 'aplicar como chabra_admin'; end if;
end $$;

do $$
declare marcados int;
begin
  select count(*) into marcados
    from public.dim_colaboradores
   where sem_producao_diaria or gestao;
  if marcados > 0 then
    raise warning '% colaborador(es) marcados serão perdidos com o drop', marcados;
  end if;
end $$;

alter table public.dim_colaboradores
  drop column if exists sem_producao_diaria,
  drop column if exists gestao;

delete from public.schema_migrations where version = 'v257_dim_colaborador_fora_do_calculo';

commit;
