-- V21 — Atualiza DRPS para modelo NR-01 50P / 13 tópicos
--
-- Estrutura nova:
--   - 13 tópicos com número variável de perguntas (5, 5, 4, 4, 3, 4, 4, 3, 4,
--     4, 3, 4, 3 = 50 no total)
--   - topico_idx vai de 0 a 12 (antes era 0 a 8)
--   - cardinality(respostas) = exatamente 50 (antes era múltiplo de 10 entre
--     10 e 90)
--
-- ATENÇÃO: este migration NÃO apaga dados existentes. Mas a estrutura dos
-- tópicos mudou — respondentes já importados precisam ser removidos
-- manualmente via "Remover tudo" e reimportados com o novo questionário.

-- 1) drps_respondentes: cardinality exata em 50
alter table public.drps_respondentes
  drop constraint if exists drps_resp_tam;

alter table public.drps_respondentes
  add constraint drps_resp_tam check (cardinality(respostas) = 50);


-- 2) drps_probabilidades: topico_idx 0..12 (remove o check antigo via PL/pgSQL)
do $$
declare
  r record;
begin
  for r in
    select conname
      from pg_constraint
     where conrelid = 'public.drps_probabilidades'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%topico_idx%'
  loop
    execute 'alter table public.drps_probabilidades drop constraint ' || quote_ident(r.conname);
  end loop;
end $$;

alter table public.drps_probabilidades
  add constraint drps_probabilidades_topico_idx_chk
  check (topico_idx between 0 and 12);


-- 3) drps_monitoramento: topico_idx 0..12 (idem)
do $$
declare
  r record;
begin
  for r in
    select conname
      from pg_constraint
     where conrelid = 'public.drps_monitoramento'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%topico_idx%'
  loop
    execute 'alter table public.drps_monitoramento drop constraint ' || quote_ident(r.conname);
  end loop;
end $$;

alter table public.drps_monitoramento
  add constraint drps_monitoramento_topico_idx_chk
  check (topico_idx between 0 and 12);
