-- v334 — Usuários: marca "Ver relatório na lista" (10/11/2026, 0.3.255).
--
-- Trazido do Painel SST (v332, 0.3.862). Marca por pessoa, em Sistema › Usuários: mostra só o botão
-- Ver relatório na lista de Inspeções (sem Editar) e tira Assumir elaboração e Associar-me do relatório.
-- Para quem só consulta. Só muda a tela: não libera nem bloqueia dado na RLS. Escrita só por Admin.
-- Rodar ANTES do deploy (o useAuth lê a coluna).
--
-- Rollback: scripts/sql/v334_usuarios_ve_relatorio_lista_rollback.sql (depois de voltar o código)
begin;

alter table public.usuarios
  add column if not exists ve_relatorio_lista boolean not null default false;
comment on column public.usuarios.ve_relatorio_lista is
  'Só consulta (v334): botão Ver relatório na lista de Inspeções, sem Assumir nem Associar-me no relatório. Só muda a tela: não libera nem bloqueia dado na RLS.';

notify pgrst, 'reload schema';

commit;
