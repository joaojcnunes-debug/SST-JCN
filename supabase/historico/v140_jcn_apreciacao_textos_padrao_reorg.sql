-- V140 — Texto Padrão da Apreciação: capítulos batendo com o template multi-máquina.
-- (DML no seed prod; idempotente. Já aplicado via MCP.)
--   - apreciacao_identificacao (renderizava nada → gerava página em branco em
--     paisagem) vira apreciacao_metodo "Objetivo, Base Normativa e Método".
--   - nova seção apreciacao_relacao "Relação de Máquinas e Equipamentos" (paisagem).
--   - apreciacao_checklist renomeado "Apreciação de Risco por Máquina" (paisagem —
--     tabela HRN larga).
--   - apreciacao_risco renomeado "Conclusão Geral".

update public.textos_padrao
set slug_fixo = 'apreciacao_metodo',
    titulo = 'Objetivo, Base Normativa e Método',
    orientacao = 'retrato'
where modulo = 'apreciacao_maquinas' and slug_fixo = 'apreciacao_identificacao';

insert into public.textos_padrao
  (id_capitulo, modulo, ordem, titulo, ativo, orientacao, quebra_pagina, posicao_pdf, tipo, slug_fixo)
values
  ('TXT-DA7C1E90', 'apreciacao_maquinas', 45, 'Relação de Máquinas e Equipamentos',
   true, 'paisagem', 'nova', 'inicio', 'fixo', 'apreciacao_relacao')
on conflict (id_capitulo) do nothing;

update public.textos_padrao
set titulo = 'Apreciação de Risco por Máquina', orientacao = 'paisagem'
where modulo = 'apreciacao_maquinas' and slug_fixo = 'apreciacao_checklist';

update public.textos_padrao
set titulo = 'Conclusão Geral'
where modulo = 'apreciacao_maquinas' and slug_fixo = 'apreciacao_risco';
