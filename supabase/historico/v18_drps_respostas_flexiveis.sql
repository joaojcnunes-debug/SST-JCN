-- V18 — Relaxa a constraint de tamanho do array de respostas no DRPS.
--
-- Antes: cardinality(respostas) = 90 (exatamente 9 tópicos × 10 perguntas)
-- Agora: cardinality entre 10 e 90, e múltiplo de 10
--
-- Isso permite questionários reduzidos (5 tópicos = 50 perguntas, etc),
-- mantendo a regra de "10 perguntas por tópico" do spec.

alter table public.drps_respondentes
  drop constraint if exists drps_resp_tam;

alter table public.drps_respondentes
  add constraint drps_resp_tam check (
    cardinality(respostas) >= 10
    and cardinality(respostas) <= 90
    and cardinality(respostas) % 10 = 0
  );
