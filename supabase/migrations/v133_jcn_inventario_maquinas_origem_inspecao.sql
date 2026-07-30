-- V133 — inventario_maquinas: colunas de ORIGEM DA IMPORTAÇÃO que faltavam no JCN.
--
-- O JCN nunca recebeu as colunas v66 do painel em inventario_maquinas, então o
-- "Enviar p/ Apreciação NR-12" e a importação de máquinas da inspeção quebravam
-- com: column inventario_maquinas.id_maquina_inspecao does not exist.
--
--   id_inspecao         text  → inspeção de onde a máquina veio
--   id_maquina_inspecao uuid  → registro original em inspecao_maquinas (PK uuid), p/ dedup
--
-- + unique index de dedup: 1 item de inventário por máquina de inspeção
--   (NULLs são distintos no Postgres, então máquinas cadastradas à mão não colidem).
-- Idempotente e reversível (drop das 2 colunas + do índice).

alter table public.inventario_maquinas
  add column if not exists id_inspecao text null;
alter table public.inventario_maquinas
  add column if not exists id_maquina_inspecao uuid null;

drop index if exists idx_inventario_maquinas_origem_inspecao;
create unique index idx_inventario_maquinas_origem_inspecao
  on public.inventario_maquinas (id_maquina_inspecao);
