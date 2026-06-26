-- v82: Validade do documento por laudo.
-- Cada laudo gerado passa a guardar a PRÓPRIA data de validade (informada no
-- editor), para a Visão geral alertar os documentos vencidos / a vencer.
-- Coluna nullable e aditiva (idempotente). Aplicar no Supabase (prod).

alter table public.relatorios_conformidade      add column if not exists data_validade date;
alter table public.relatorios_nao_conformidade  add column if not exists data_validade date;
alter table public.aet_relatorios               add column if not exists data_validade date;
alter table public.aep_relatorios               add column if not exists data_validade date;
alter table public.drps_relatorios              add column if not exists data_validade date;
alter table public.analises_quimicos            add column if not exists data_validade date;
alter table public.apreciacoes_maquinas         add column if not exists data_validade date;
