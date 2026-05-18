-- V39 — Controle de quebra de página por capítulo de Texto Padrão
--
-- Permite escolher se o capítulo começa em uma NOVA página (padrão) ou
-- continua a página anterior. Útil quando dois capítulos curtos cabem na
-- mesma folha (por exemplo, "Considerações Finais" logo abaixo de "Conclusão").
--
-- DEFAULT: 'nova' (mantém o comportamento atual — cada capítulo em sua página).
-- Capítulos com imagem de capa (bg_imagem_url) ignoram este campo e sempre
-- ocupam página inteira.

alter table public.textos_padrao
  add column if not exists quebra_pagina text not null default 'nova'
    check (quebra_pagina in ('nova', 'continua'));
