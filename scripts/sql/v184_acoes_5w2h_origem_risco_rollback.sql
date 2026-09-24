-- Rollback da v184 (marca de origem do risco no Plano de Ação).
--
-- ⚠️ Derruba a coluna id_risco_origem. As ações JÁ ENVIADAS continuam no plano
-- (id_inspecao / id_setor / id_risco seguem preenchidos) — o que se perde é a
-- trava de duplicação: reenviar a mesma inspeção passaria a criar linha nova.
-- Se a intenção for só parar de usar o botão, basta reverter o front.

begin;

drop index if exists public.idx_acoes_5w2h_origem_risco;

alter table public.acoes_5w2h
  drop column if exists id_risco_origem;

delete from public.schema_migrations where version = 'v184_acoes_5w2h_origem_risco';

commit;

notify pgrst, 'reload schema';
