-- V138 — Apreciação NR-12: campos exigidos pela norma.
--   apreciacoes_maquinas.notificacao_sit → nº da Notificação SIT/MTE atendida (fiscalização)
--   apreciacao_riscos_hrn.categoria_seguranca → categoria/PL do sistema de comando (NBR 14153 / ISO 13849): B,1,2,3,4
-- Idempotente.

alter table public.apreciacoes_maquinas
  add column if not exists notificacao_sit text;
alter table public.apreciacao_riscos_hrn
  add column if not exists categoria_seguranca text;
