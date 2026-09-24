-- V45 — Permissões granulares por usuário (Criar / Editar / Excluir)
--
-- Antes: a capacidade de criar/editar/excluir era determinada inteiramente
-- pelo `perfil`:
--   - Admin: tudo.
--   - Tecnico: criar + editar (mas não excluir relatório top-level).
--   - Visualizador: nada.
--
-- Agora: 3 booleans permitem ao admin habilitar/desabilitar ESSAS ações
-- por usuário, independente do perfil. Admin contorna esses flags (sempre
-- pode tudo via `useIsAdmin()`). Visualizador pode receber permissão
-- granular sem virar Técnico — por exemplo, alguém de RH com perfil
-- Visualizador pode receber "pode_editar = true" só para conseguir
-- ajustar coisa de Psicossocial.
--
-- Backfill aplica defaults sensatos por perfil pra usuários existentes.

alter table public.usuarios
  add column if not exists pode_criar boolean not null default false,
  add column if not exists pode_editar boolean not null default false,
  add column if not exists pode_excluir boolean not null default false;

-- Backfill: Admin com tudo (irrelevante na prática, é só pra UI ficar
-- consistente) e Técnico com criar + editar.
update public.usuarios
  set pode_criar = true,
      pode_editar = true,
      pode_excluir = true
  where perfil = 'Admin';

update public.usuarios
  set pode_criar = true,
      pode_editar = true,
      pode_excluir = false
  where perfil = 'Tecnico';

-- Visualizador continua false em tudo (default). Admin pode override
-- caso a caso pelo /usuarios.
