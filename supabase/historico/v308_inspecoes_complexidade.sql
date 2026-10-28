-- v308 — Inspeções: complexidade (28/10/2026)
--
-- Pedido de 28/10: na lista de Inspeções, uma coluna Complexidade logo depois da Prioridade, com a
-- mesma mecânica dela (seletor na própria linha, quem edita a inspeção marca, filtro na lista).
-- Valores: BAIXA | MEDIA | ALTA | MUITO_ALTA (na tela: Baixa, Média, Alta, Muito alta); nula = não
-- definida. Manual — não há complexidade calculada. Quem pode gravar é quem já grava na inspeção
-- (mesmas policies de UPDATE) — nada novo de RLS.
--
-- Rollback: scripts/sql/v308_inspecoes_complexidade_rollback.sql

alter table public.inspecoes add column if not exists complexidade text;

alter table public.inspecoes drop constraint if exists inspecoes_complexidade_check;
alter table public.inspecoes add constraint inspecoes_complexidade_check
  check (complexidade is null or complexidade in ('BAIXA', 'MEDIA', 'ALTA', 'MUITO_ALTA'));

comment on column public.inspecoes.complexidade is
  'v308: complexidade marcada na lista (BAIXA/MEDIA/ALTA/MUITO_ALTA); nula = não definida.';

create index if not exists inspecoes_complexidade_idx on public.inspecoes (complexidade) where complexidade is not null;

notify pgrst, 'reload schema';
