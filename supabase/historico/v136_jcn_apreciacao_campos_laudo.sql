-- V136 — Apreciação: campos p/ o formato do laudo (TERE PÃO).
--   apreciacao_riscos_hrn.itens_nr12   → itens da NR-12 do perigo (ex.: 12.38 a 12.55)
--   apreciacao_fichas_maquina.operadores → operadores/responsáveis da máquina
-- (as medidas Eng./Adm. já saem via medidas_preventivas com prefixo — sem coluna nova.)
-- Idempotente.

alter table public.apreciacao_riscos_hrn
  add column if not exists itens_nr12 text[];
alter table public.apreciacao_fichas_maquina
  add column if not exists operadores text;
