-- v186 — SEC-GESTAO-01: fecha a auto-escalação de nível por DML direto em gestao_acessos.
--
-- Achado: a policy gestao_acessos_wr (v103:39) autoriza pelo id_quadro LEGADO, enquanto
-- gestao_resolver_nivel (v117) decide por recurso_tipo/recurso_id/nivel. Qualquer membro com
-- edit num quadro ABERTO inseria uma linha apontando para um quadro RESTRITO e virava 'full'
-- nele, sem registro em gestao_acesso_log.
--
-- Correção: authenticated perde INSERT/UPDATE/DELETE/TRUNCATE na tabela e a policy de escrita
-- some. A escrita legítima passa 100% por gestao_alterar_acesso (SECURITY DEFINER, dono
-- chabra_admin, v118) — que exige motivo, aplica a escada de autorização e grava o log.
-- SELECT é preservado: useAcessosQuadro (useGestao.ts:1389) popula o modal Compartilhar.
--
-- Escopo: SOMENTE SEC-GESTAO-01. SEC-GESTAO-02 (EXECUTE a PUBLIC/anon nas funções gestao_*)
-- e SEC-GESTAO-03 (gestao_papel_de ignora usuarios.ativo_sistema) são tickets próprios.
--
-- Idempotente: revoke/drop policy/grant são convergentes; aplica 2x sem erro.
-- Pré-requisito de deploy: o commit que remove lib/hooks/useGestao.ts::upsertAcesso já está
-- em produção. Aplicar esta migration ANTES disso quebra o botão "Restringir".

begin;

-- (0) Guardas — falha fechada em vez de aplicar às cegas.
do $$
declare v_force boolean; v_owner name;
begin
  if to_regclass('public.gestao_acessos') is null then
    raise exception 'v186: public.gestao_acessos nao existe — abortado';
  end if;
  if to_regprocedure('public.gestao_alterar_acesso(text,public.gestao_acao,public.gestao_recurso,text,public.gestao_nivel,text)') is null then
    raise exception 'v186: gestao_alterar_acesso ausente — revogar o DML deixaria a Gestao sem caminho de concessao';
  end if;
  select c.relforcerowsecurity, pg_get_userbyid(c.relowner)
    into v_force, v_owner
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'gestao_acessos';
  if v_force then
    raise exception 'v186: gestao_acessos tem FORCE RLS — o RPC SECURITY DEFINER nao escaparia da policy; abortado';
  end if;
  if v_owner is distinct from 'chabra_admin' then
    raise exception 'v186: dono de gestao_acessos = % (esperado chabra_admin) — abortado', v_owner;
  end if;
end $$;

-- (1) Tira o privilegio de escrita direta do papel do navegador.
revoke insert, update, delete, truncate on public.gestao_acessos from authenticated;
revoke insert, update, delete, truncate on public.gestao_acessos from anon;
revoke insert, update, delete, truncate on public.gestao_acessos from public;

-- (2) Preserva explicitamente a leitura (o modal Compartilhar depende dela).
grant select on public.gestao_acessos to authenticated;

-- (3) Remove a policy de escrita que autorizava pela coluna legada. Sem policy permissiva
--     para INSERT/UPDATE/DELETE, a RLS nega por ausencia — segunda tranca, independente do grant.
drop policy if exists gestao_acessos_wr on public.gestao_acessos;

-- (4) A policy de SELECT da v103 permanece intacta e nao e recriada aqui.

comment on table public.gestao_acessos is
  'Grants de acesso da Gestao. ESCRITA SOMENTE por public.gestao_alterar_acesso (SECURITY DEFINER, v118) — authenticated nao tem INSERT/UPDATE/DELETE desde a v186 (SEC-GESTAO-01).';

commit;
