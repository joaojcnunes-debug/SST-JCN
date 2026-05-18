-- V41 — Habilita 'nao_conformidade' como módulo válido em textos_padrao
--
-- A constraint criada em V37 só permitia ('sst', 'conformidade', 'analise_quimicos').
-- Agora o RNC também tem sua própria página de Texto Padrão (capítulos
-- reutilizáveis pra introdução, fundamentação, conclusão), então precisamos
-- relaxar a constraint.

alter table public.textos_padrao
  drop constraint if exists textos_padrao_modulo_check;

alter table public.textos_padrao
  add constraint textos_padrao_modulo_check
  check (modulo in ('sst', 'conformidade', 'nao_conformidade', 'analise_quimicos'));
