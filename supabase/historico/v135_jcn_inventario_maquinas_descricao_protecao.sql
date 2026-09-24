-- V135 — corrige drift: inventario_maquinas.descricao_protecao_fixa/_movel faltavam.
--
-- O código (tipo Maquina + import de máquinas da inspeção em useInventarioMaquinas)
-- grava `descricao_protecao_fixa` e `descricao_protecao_movel`, mas essas colunas
-- nunca vieram em migration (nem no painel — existem só no DB dele). Sem elas o
-- "Enviar p/ Apreciação NR-12" quebra com
-- "Could not find the 'descricao_protecao_fixa' column ... in the schema cache".
-- São descrições em texto. Idempotente.

alter table public.inventario_maquinas
  add column if not exists descricao_protecao_fixa text null;
alter table public.inventario_maquinas
  add column if not exists descricao_protecao_movel text null;
-- também faltava (mesmo objeto de insert do import): descrição livre dos
-- dispositivos de segurança da máquina.
alter table public.inventario_maquinas
  add column if not exists dispositivos_seguranca text null;
