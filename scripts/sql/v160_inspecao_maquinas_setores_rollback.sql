-- v160 ROLLBACK — volta a máquina da inspeção a UM setor só.
--
-- A v160 não apagou nada: `inspecao_maquinas.id_setor` ficou congelada com o
-- valor de antes. Desfazer é derrubar a tabela de ligação — o dado original
-- nunca saiu do lugar.
--
-- ⚠️ O que se PERDE: os setores EXTRAS lançados depois da v160. Uma máquina
-- que passou a servir produção E expedição volta a ter só o setor antigo.
-- Confira antes quantas seriam afetadas:
--
--   select count(*) from (
--     select id_maquina_inspecao from public.inspecao_maquinas_setores
--      group by 1 having count(*) > 1) t;
--
-- Se der zero, o rollback é sem perda.
--
-- Reverter também o código (git): sem isso a tela consulta uma tabela que não
-- existe mais e o editor de inspeção quebra ao carregar.
--
-- Rodar com:
--   docker exec -i db-messages-postgres psql -U chabra_admin -d painel_sst \
--     -v ON_ERROR_STOP=1 -f - < v160_inspecao_maquinas_setores_rollback.sql

begin;

do $$
declare n_multi int; n_novo int;
begin
  select count(*) into n_multi from (
    select id_maquina_inspecao from public.inspecao_maquinas_setores
     group by 1 having count(*) > 1) t;
  -- vínculo que não corresponde ao id_setor congelado = lançado depois
  select count(*) into n_novo from public.inspecao_maquinas_setores v
    join public.inspecao_maquinas m using (id_maquina_inspecao)
   where m.id_setor is distinct from v.id_setor;
  if n_multi > 0 or n_novo > 0 then
    raise warning 'rollback v160: % maquinas com mais de um setor e % vinculos fora do id_setor original serao PERDIDOS', n_multi, n_novo;
  end if;
end $$;

drop table if exists public.inspecao_maquinas_setores;

commit;

-- Sem isto o PostgREST segue anunciando a tabela que acabou de sumir.
notify pgrst, 'reload schema';
