-- V44 — Itens extras no Relatório de Conformidade (livres + cross-ref de outras NRs)
--
-- Mantém o fluxo principal: ao criar o relatório, todos os itens do checklist
-- da NR escolhida continuam vindo snapshotados em `relatorios_conformidade_itens`
-- (não muda nada na lógica existente). Mas agora o auditor pode ADICIONAR
-- mais itens depois — dois tipos:
--
--   1) Item livre — algo encontrado em campo que não está no catálogo.
--      `item_nr_origem = 'LIVRE'`, `item_codigo = 'LIVRE-{N}'`, título/desc
--      editáveis inline pelo usuário.
--
--   2) Cross-ref — item do catálogo de OUTRA NR (ex: auditando NR-24 mas
--      precisa marcar 1-2 itens de NR-17). `item_nr_origem = 'NR-17'`,
--      `item_codigo`/`item_titulo`/`item_descricao` snapshotados do catálogo
--      dessa outra NR.
--
-- Itens snapshot do checklist principal continuam com `item_nr_origem = NULL`
-- (zero impacto em relatórios existentes — backfill desnecessário).

alter table public.relatorios_conformidade_itens
  add column if not exists item_nr_origem text;

create index if not exists idx_relatorios_conformidade_itens_origem
  on public.relatorios_conformidade_itens (id_relatorio, item_nr_origem)
  where item_nr_origem is not null;
