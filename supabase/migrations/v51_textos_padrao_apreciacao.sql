-- V51 — Habilita 'apreciacao_maquinas' como módulo válido em textos_padrao
--
-- Apreciação de Máquinas NR-12 passa a ter sua própria página de Texto
-- Padrão (capítulos reutilizáveis pra introdução, fundamentação NR-12,
-- considerações finais, lista de normas referenciadas etc.). Os capítulos
-- ativos serão renderizados ao fim do laudo no PDF.
--
-- Mesmo padrão das migrações v41 (nao_conformidade): relax a check
-- constraint pra incluir o novo slug.

alter table public.textos_padrao
  drop constraint if exists textos_padrao_modulo_check;

alter table public.textos_padrao
  add constraint textos_padrao_modulo_check
  check (modulo in (
    'sst',
    'conformidade',
    'nao_conformidade',
    'analise_quimicos',
    'apreciacao_maquinas'
  ));
