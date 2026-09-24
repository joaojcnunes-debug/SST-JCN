-- v242 — a trava por UNIDADE responde 1 vez por requisição, não 1 vez por linha.
--
-- NADA muda no que cada conta vê. É só velocidade. Critério de aceite do
-- ensaio: para TODA conta ativa, a contagem de linhas visíveis em cada tabela
-- é idêntica antes e depois — se uma só divergir, não sobe.
--
-- O problema (medido na produção em 22/09, `select count(*) from riscos` como
-- técnico com 1–5 unidades): 5.707 ms, 236.874 buffers para 15.700 linhas
-- (~15 páginas por linha). O plano mostra o porquê:
--     Seq Scan on riscos … Filter: (rls_modulo_ok(…) AND caller_pode_ver_empresa(id_empresa))
-- `caller_pode_ver_empresa` chama `caller_eh_admin()` e `caller_unidades()`,
-- e CADA UMA vai à tabela `usuarios` procurar o e-mail do JWT — por linha.
-- A resposta é a mesma nas 15.700 linhas: quem chama não muda no meio da
-- requisição.
--
-- A correção: carregar "é Admin?" e "quais unidades?" UMA vez e guardar em GUC
-- local (`set_config(..., true)`), que morre no fim da transação — a mesma
-- técnica da v236 (`rls.m_<modulo>`), e o PostgREST abre uma transação por
-- requisição, então nada vaza entre pessoas na mesma conexão. A chave de
-- validade é o próprio e-mail do JWT: se mudar, recarrega.
--
-- O que NÃO muda: assinatura, volatilidade (STABLE), SECURITY DEFINER,
-- search_path e a REGRA das três funções. As 123 policies que chamam
-- `caller_pode_ver_empresa` (60 tabelas), as 30 que chamam `caller_unidades` e
-- as 37 que chamam `caller_eh_admin` continuam apontando para os mesmos nomes.
--
-- Comportamento de borda preservado, um a um (conferido na cópia de 22/09):
--   · conta inexistente/inativa → caller_eh_admin() = FALSE (nunca NULL) e
--     caller_unidades() = NULL (o `any(NULL)` continua dando NULL → não vê);
--   · linha existe com `unidades` NULL → '{}' (o coalesce de hoje);
--   · `p_id_empresa` NULL → true, como hoje;
--   · JWT sem e-mail → mesma coisa que e-mail desconhecido.
--
-- Rollback: scripts/sql/v242_rollback_rls_memo_por_transacao.sql (devolve as
-- três funções exatamente como estavam).

begin;

-- ── 1) Carrega o memo desta transação (1 select em `usuarios`) ──────────────
-- Guarda em três GUCs locais:
--   rls.quem = e-mail do JWT (ou '(sem)') — chave de validade do memo
--   rls.adm  = 't' / 'f'
--   rls.uni  = json do array de unidades, ou '' quando não há conta (= NULL)
create or replace function public.caller_memo()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text;
  v_chave text;
  v_adm   boolean;
  v_uni   text[];
  v_achou boolean := false;
begin
  v_email := lower(nullif(auth.jwt() ->> 'email', ''));
  v_chave := coalesce(v_email, '(sem)');
  if coalesce(current_setting('rls.quem', true), '') = v_chave then
    return; -- já carregado nesta transação, para esta mesma pessoa
  end if;

  select (u.perfil = 'Admin'), coalesce(u.unidades, '{}'), true
    into v_adm, v_uni, v_achou
    from public.usuarios u
   where lower(u.email) = v_email
     and u.ativo_sistema = true
   limit 1;

  perform set_config('rls.adm', case when coalesce(v_adm, false) then 't' else 'f' end, true);
  perform set_config('rls.uni', case when coalesce(v_achou, false) then to_json(v_uni)::text else '' end, true);
  perform set_config('rls.quem', v_chave, true);
end $$;
revoke all on function public.caller_memo() from public, anon;
grant execute on function public.caller_memo() to authenticated;
comment on function public.caller_memo() is
  'v242: lê UMA vez por transação quem está chamando (é Admin? quais unidades?) e guarda em GUC local. Some no fim da transação; o PostgREST abre uma por requisição.';

-- ── 2) As duas que iam ao cadastro por linha ────────────────────────────────
create or replace function public.caller_eh_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.caller_memo();
  return coalesce(current_setting('rls.adm', true), 'f') = 't';
end $$;
comment on function public.caller_eh_admin() is
  'v242: quem chama é Admin ativo? Mesma regra de sempre; a resposta agora é lida do memo da transação (caller_memo).';

create or replace function public.caller_unidades()
returns text[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_uni text;
begin
  perform public.caller_memo();
  v_uni := current_setting('rls.uni', true);
  if v_uni is null or v_uni = '' then
    return null; -- conta inexistente ou inativa: era NULL antes, segue NULL
  end if;
  return array(select json_array_elements_text(v_uni::json));
end $$;
comment on function public.caller_unidades() is
  'v242: unidades de quem chama (NULL quando não há conta ativa). Mesma regra; lida do memo da transação (caller_memo).';

-- `caller_pode_ver_empresa` NÃO muda: ela já chama as duas acima e ganha de
-- graça. Fica só o lookup da empresa por chave primária, por linha.

-- ── 3) Trava: as três funções têm de continuar existindo com a mesma cara ───
do $$
declare v_falta text := '';
begin
  if (select provolatile from pg_proc where oid = 'public.caller_eh_admin()'::regprocedure) <> 's'
     then v_falta := v_falta || ' caller_eh_admin_nao_stable'; end if;
  if (select provolatile from pg_proc where oid = 'public.caller_unidades()'::regprocedure) <> 's'
     then v_falta := v_falta || ' caller_unidades_nao_stable'; end if;
  if (select prosecdef from pg_proc where oid = 'public.caller_eh_admin()'::regprocedure) is not true
     then v_falta := v_falta || ' caller_eh_admin_sem_secdef'; end if;
  if (select prosecdef from pg_proc where oid = 'public.caller_unidades()'::regprocedure) is not true
     then v_falta := v_falta || ' caller_unidades_sem_secdef'; end if;
  -- JCN: piso 20 (aqui sao 27 policies; no painel eram 123).
  if (select count(*) from pg_policies where qual like '%caller_pode_ver_empresa%' or with_check like '%caller_pode_ver_empresa%') < 20
     then v_falta := v_falta || ' policies_sumiram'; end if;
  if v_falta <> '' then
    raise exception 'v242 abortada:%', v_falta;
  end if;
end $$;


commit;

notify pgrst, 'reload schema';
