-- V134 — corrige drift: apreciacoes_maquinas_itens.foto_legendas faltava no banco JCN.
--
-- A migration v68 (foto_legendas: array pareado 1:1 com foto_urls) está no repo
-- mas nunca foi aplicada ao banco do JCN. O código (ApreciacaoMaquinaItem + os
-- inserts de checklist em useCriarApreciacaoMaquina / useCriarFicha) sempre grava
-- foto_legendas → sem a coluna, criar apreciação/ficha quebra com
-- "column foto_legendas does not exist". Reaplica a coluna (idempotente).

alter table public.apreciacoes_maquinas_itens
  add column if not exists foto_legendas text[] not null default array[]::text[];
