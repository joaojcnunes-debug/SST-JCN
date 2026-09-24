-- v211 — Gestão Gerencial para quem tem a Escala de Supervisores (dado, não schema).
--
-- CONTEXTO (2026-09-14): o card "Escala de Supervisores" saiu do hub "Chabra
-- Sistema Interno" (v0.3.596) porque a escala já tem porta dentro da Gestão
-- Gerencial (card na tela inicial + item do menu lateral). Só que o card da
-- Gestão Gerencial no hub aparece APENAS para quem tem o módulo
-- `gestao_gerencial`, e a tela dela recusa quem não tem. Medido antes de
-- escrever: 55 contas ativas com `escala_supervisores`, só 9 com
-- `gestao_gerencial` — 46 ficariam sem porta nenhuma para a escala.
--
-- DECISÃO DELE (14/09): tirar o card e liberar a Gestão Gerencial para essas
-- 46 contas. É mudança de permissão em massa, feita de propósito e com backup.
--
-- O QUE FAZ
--   1) Copia `id_usuario, email, modulos_permitidos` de toda conta ativa que tem
--      a Escala e não tem a Gestão para `public.bkp_v211_usuarios_modulos`.
--   2) Acrescenta 'gestao_gerencial' ao array dessas contas.
--   3) Confere que atualizou exatamente as linhas do backup (retrato tirado
--      DENTRO da transação — a base é viva, número fixo quebraria).
--
-- ROLLBACK: scripts/sql/v211_gestao_gerencial_para_quem_tem_escala.rollback.sql
-- (devolve o array gravado no backup, conta por conta).
--
-- Idempotente: reexecutar não acha conta para atualizar (0 linhas) e não
-- recria o backup por cima de um que tenha linhas.
-- Rodar com `psql -1 -v ON_ERROR_STOP=1`.

create table if not exists public.bkp_v211_usuarios_modulos (
  id_usuario         text primary key,
  email              text,
  modulos_permitidos text[],
  copiado_em         timestamptz not null default now()
);

do $$
declare
  v_alvo   int;
  v_atual  int;
  v_backup int;
begin
  -- Retrato de AGORA, dentro da transação.
  select count(*) into v_alvo
    from public.usuarios
   where ativo_sistema
     and 'escala_supervisores' = any(modulos_permitidos)
     and not ('gestao_gerencial' = any(modulos_permitidos));

  if v_alvo = 0 then
    raise notice 'v211: nenhuma conta para atualizar (já aplicada?). Nada feito.';
    return;
  end if;

  -- Backup só das contas que vão mudar. Não sobrescreve quem já está lá.
  insert into public.bkp_v211_usuarios_modulos (id_usuario, email, modulos_permitidos)
  select id_usuario, email, modulos_permitidos
    from public.usuarios
   where ativo_sistema
     and 'escala_supervisores' = any(modulos_permitidos)
     and not ('gestao_gerencial' = any(modulos_permitidos))
  on conflict (id_usuario) do nothing;

  update public.usuarios
     set modulos_permitidos = array_append(modulos_permitidos, 'gestao_gerencial')
   where ativo_sistema
     and 'escala_supervisores' = any(modulos_permitidos)
     and not ('gestao_gerencial' = any(modulos_permitidos));
  get diagnostics v_atual = row_count;

  select count(*) into v_backup from public.bkp_v211_usuarios_modulos;

  if v_atual <> v_alvo then
    raise exception 'v211 abortado: retrato dizia % conta(s), o UPDATE tocou %. A base mudou no meio — reexecute.',
      v_alvo, v_atual;
  end if;

  raise notice 'v211: % conta(s) ganharam gestao_gerencial; backup com % linha(s) em public.bkp_v211_usuarios_modulos.',
    v_atual, v_backup;
end $$;

insert into public.schema_migrations (version)
values ('v211_gestao_gerencial_para_quem_tem_escala')
on conflict (version) do nothing;
