-- v277 (2026-10-06): novo tópico "Medidas de controle recomendadas"
-- (topico 'medida_recomendada') na biblioteca psicossocial, separado das
-- medidas EXISTENTES ('medida'). Seed: as mesmas medidas de referência de cada
-- fator, não marcadas — o técnico marca em "existentes" o que constatou e em
-- "recomendadas" o que falta implantar.
-- Já aplicada via MCP. Rollback: scripts/sql/v277_rollback_biblioteca_medida_recomendada.sql
alter table public.psi_biblioteca_itens drop constraint if exists psi_biblioteca_itens_topico_check;
alter table public.psi_biblioteca_itens add constraint psi_biblioteca_itens_topico_check check (topico in
  ('perigo','fonte','evidencia','descricao','danos','medida','medida_recomendada','sugestao','acao','meio','situacao','tempo'));

insert into public.psi_biblioteca_itens (id_item, fator, topico, texto, ordem, padrao)
select 'BIB-' || upper(substr(md5(coalesce(fator, '*') || '|medida_recomendada|' || lower(trim(texto))), 1, 8)),
       fator, 'medida_recomendada', texto, ordem, false
  from public.psi_biblioteca_itens
 where topico = 'medida' and status = 'ativo'
on conflict do nothing;
