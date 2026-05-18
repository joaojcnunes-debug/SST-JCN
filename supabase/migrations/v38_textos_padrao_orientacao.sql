-- V38 — Orientação da página por capítulo de Texto Padrão
--
-- Cada capítulo agora pode ser impresso em retrato (A4 portrait) ou
-- paisagem (A4 landscape). Útil pra páginas com tabelas largas, gráficos
-- horizontais ou imagens panorâmicas que não cabem na orientação retrato.
--
-- DEFAULT: 'retrato' (compatível com o que existe).

alter table public.textos_padrao
  add column if not exists orientacao text not null default 'retrato'
    check (orientacao in ('retrato', 'paisagem'));
