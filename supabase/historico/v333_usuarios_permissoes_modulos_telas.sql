-- v333 — Usuários: Criar/Editar/Excluir por módulo e Visualizar por tela (10/11/2026, 0.3.253).
--
-- Trazido do Painel SST: v345 (0.3.901, grade por módulo) e o Visualizar por tela (MD 0.3.906, v347 de lá).
-- A 2ª etapa do Painel (v346, o banco conferir a grade em 116 tabelas) NÃO entra: aqui a grade só muda a tela.
--
--   usuarios.permissoes_modulos  jsonb  { "<modulo>": { "criar", "editar", "excluir" }, "geral": {...} }
--     NULL (todas as contas hoje) = valem pode_criar/pode_editar/pode_excluir em todo lugar, como antes.
--   usuarios.telas_bloqueadas    text[] as telas (rota principal) que a pessoa NÃO vê dentro dos módulos.
--     NULL ou vazia = vê todas.
-- Nada muda para ninguém até alguém salvar a conta no cadastro novo. Escrita só por Admin (policy
-- "admin write usuarios"). Regras: lib/acesso/permissoes-modulo.ts e lib/acesso/telas-modulo.ts.
-- Rodar ANTES do deploy (o useAuth lê as duas colunas).
--
-- Rollback: scripts/sql/v333_usuarios_permissoes_modulos_telas_rollback.sql (depois de voltar o código)
begin;

alter table public.usuarios add column if not exists permissoes_modulos jsonb;
alter table public.usuarios drop constraint if exists usuarios_permissoes_modulos_objeto;
alter table public.usuarios
  add constraint usuarios_permissoes_modulos_objeto
  check (permissoes_modulos is null or jsonb_typeof(permissoes_modulos) = 'object');
comment on column public.usuarios.permissoes_modulos is
  'Criar/Editar/Excluir por módulo (v333): {"<modulo>": {"criar", "editar", "excluir"}}. NULL = valem pode_criar/pode_editar/pode_excluir em todos os módulos. Só muda a tela.';

alter table public.usuarios add column if not exists telas_bloqueadas text[];
comment on column public.usuarios.telas_bloqueadas is
  'Visualizar por tela (v333): rotas das telas que a pessoa NÃO vê dentro dos módulos que tem. NULL ou vazio = vê todas. Só muda a tela.';

notify pgrst, 'reload schema';

commit;
