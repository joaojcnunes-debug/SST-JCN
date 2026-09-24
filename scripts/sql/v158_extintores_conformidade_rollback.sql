-- v158 ROLLBACK — desfaz a separação conformidade × não conformidade dos
-- extintores.
--
-- NÃO precisa restaurar valor nenhum: a v158 só ACRESCENTOU colunas e a
-- `status` ficou intacta, com o valor de antes. Desfazer é derrubar as duas
-- colunas novas — o dado original nunca saiu do lugar.
--
-- ⚠️ O que se PERDE ao rodar isto: qualquer não conformidade lançada DEPOIS da
-- v158 que não caiba na `status` de valor único (ex.: um extintor marcado como
-- Vencido E com sinalização inadequada volta a ter só o valor antigo, que é o
-- de antes da migration). Confira antes se alguém já usou a tela nova:
--
--   select count(*) from public.extintores
--    where coalesce(array_length(nao_conformidades, 1), 0) > 1;
--
-- Se der zero, o rollback é sem perda.
--
-- Rodar com:
--   docker exec -i db-messages-postgres psql -U chabra_admin -d painel_sst \
--     -v ON_ERROR_STOP=1 -f - < v158_extintores_conformidade_rollback.sql
--
-- Reverter também o código (git): sem isso a tela grava em coluna que não
-- existe mais e quebra com PGRST204.

begin;

do $$
declare n_multi int;
begin
  select count(*) into n_multi from public.extintores
   where coalesce(array_length(nao_conformidades, 1), 0) > 1;
  if n_multi > 0 then
    raise warning 'rollback v158: % extintores tinham MAIS DE UMA nao conformidade e voltarao ao valor unico antigo', n_multi;
  end if;
end $$;

alter table public.extintores
  drop constraint if exists extintores_situacao_check;

alter table public.extintores
  drop column if exists situacao,
  drop column if exists nao_conformidades;

comment on column public.extintores.status is null;

commit;

-- Sem isto o PostgREST segue anunciando as colunas que acabaram de sumir.
notify pgrst, 'reload schema';
