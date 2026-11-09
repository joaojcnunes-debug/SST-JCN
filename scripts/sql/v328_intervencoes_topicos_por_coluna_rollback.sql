-- Desfaz a v328. Rode depois de voltar o código para a 0.3.241.
-- Os tópicos inseridos só pelo título da coluna, e que não estão em nenhuma intervenção, se perdem.
-- Os que já estão nas intervenções continuam lá (moram em comercial_intervencoes).
begin;

drop table if exists public.comercial_intervencao_topicos;

notify pgrst, 'reload schema';

commit;
