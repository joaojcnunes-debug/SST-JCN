-- ROLLBACK v370 — apaga o plano de intervenções e os métodos por modalidade (os dados digitados neles se perdem).
begin;
drop table if exists public.comercial_planos;
drop table if exists public.comercial_metodos;
commit;
