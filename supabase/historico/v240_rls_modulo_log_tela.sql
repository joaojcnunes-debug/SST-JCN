-- v240 — o log da trava por módulo (v236) passa a dizer a TELA, não só a tabela.
--
-- Achado de 21/09 (1 dia de modo LOG): 175 tentativas de 11 contas, 100 % GET,
-- todas nas 9 tabelas que o Início (useHomeStats) e a página da Empresa
-- (useRegistrosEmpresa) leem para TODO MUNDO. O log anota `ultimo_path`
-- (= a tabela do PostgREST), então em 21/10 a lista seria um paredão
-- "drps_relatorios / qps_aplicacoes…" e um caso real ficaria escondido.
--
-- O que muda:
--   1) coluna `rls_modulo_log.ultima_tela` — o caminho da tela do painel de
--      onde veio a leitura/escrita (ex.: /inicio, /empresas/<id>);
--   2) `rls_modulo_tela()` lê a tela dos cabeçalhos que o PostgREST expõe em
--      `request.headers` (JSON, v12): primeiro `x-painel-tela` (o browser
--      client manda `window.location.pathname` a partir da v0.3.632), senão o
--      `referer` (browsers/bundles antigos), sem host e sem query string.
--      Chamada do servidor (rotas /api/*) não tem nenhum dos dois → NULL;
--   3) `rls_modulo_ok` grava a tela (mesmo dblink da v236; a decisão não muda);
--   4) RPC `rls_modulo_por_tela()` agrupa o log por tela × módulo com os ids
--      normalizados ([id]) — é o que o card em Sistema › Funções passa a mostrar.
--
-- Rollback: scripts/sql/v240_rollback_rls_modulo_log_tela.sql (volta a
-- rls_modulo_ok da v236; a coluna cai junto com o que ela guardou).

-- NO JCN: SEM dblink. No painel self-host a anotacao sai por uma conexao
-- autonoma (ext.dblink_exec sem senha), que exige superusuario; o 'postgres'
-- do Supabase nao e, e a propria extensao nao instala aqui. Sobrou a gravacao
-- direta: pega as ESCRITAS; num GET o PostgREST abre a transacao READ ONLY, o
-- insert falha e a tentativa se perde em silencio. Ou seja, o modo log aqui
-- mede MENOS que no painel — e justamente nao mede a leitura, que e a que
-- mais interessa. Antes de virar a chave para 'trava' isso precisa ser
-- resolvido (credencial no Vault para o dblink, ou contagem pelo front).
-- Em modo log nada e barrado, e falha de anotacao nunca altera o resultado
-- da requisicao.

begin;

do $$
begin
  -- JCN: sem public.schema_migrations (rastreador do self-host); a pre-condicao
  -- e conferida no proprio artefato da v236.
  if to_regclass('public.rls_modulo_config') is null
     or to_regprocedure('public.rls_modulo_ok(text,text)') is null then
    raise exception 'v240: aplique a v236 (trava por módulo em modo log) antes.';
  end if;
end $$;

-- ── 1) A coluna ─────────────────────────────────────────────────────────────
alter table public.rls_modulo_log add column if not exists ultima_tela text;
comment on column public.rls_modulo_log.ultima_tela is
  'v240: caminho da tela do painel de onde veio a última tentativa (x-painel-tela ou referer, sem host/query). NULL = antes da v240 ou chamada do servidor.';

-- ── 2) De que tela veio esta requisição? ────────────────────────────────────
-- PostgREST v12 expõe os cabeçalhos em request.headers (JSON, nomes em
-- minúsculas). Nunca lança: qualquer coisa estranha vira NULL.
create or replace function public.rls_modulo_tela()
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  h json;
  t text;
begin
  begin
    h := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    return null;
  end;
  if h is null then return null; end if;

  t := nullif(btrim(h ->> 'x-painel-tela'), '');
  if t is null then
    t := nullif(btrim(h ->> 'referer'), '');
    if t is null then return null; end if;
    -- tira esquema e host: https://painel-sst.chabra.com.br/inicio?x → /inicio?x
    t := regexp_replace(t, '^[a-zA-Z][a-zA-Z0-9+.-]*://[^/]*', '');
  end if;
  t := split_part(split_part(t, '?', 1), '#', 1);
  if t = '' then return null; end if;
  if left(t, 1) <> '/' then t := '/' || t; end if;
  return left(t, 200);
end $$;
revoke all on function public.rls_modulo_tela() from public, anon;
grant execute on function public.rls_modulo_tela() to authenticated;
comment on function public.rls_modulo_tela() is
  'v240: caminho da tela do painel desta requisição (cabeçalho x-painel-tela, senão referer), sem host e sem query. NULL quando não há (servidor).';

-- ── 3) rls_modulo_ok grava a tela ───────────────────────────────────────────
-- Cópia fiel da v236 + `ultima_tela`. A decisão (modo log/trava, memória por
-- transação, 1 anotação por tabela por requisição) é a mesma.
create or replace function public.rls_modulo_ok(p_modulo text, p_tabela text)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_memo   text;
  v_tem    boolean;
  v_email  text;
  v_id     text;
  v_modo   text;
  v_bloq   boolean;
  v_tela   text;
begin
  v_memo := current_setting('rls.m_' || p_modulo, true);
  if v_memo = 't' then return true; end if;

  if v_memo is null or v_memo = '' then
    v_email := lower(nullif(auth.jwt() ->> 'email', ''));
    select (u.perfil = 'Admin' or u.modulos_permitidos is null or p_modulo = any(u.modulos_permitidos)),
           u.id_usuario
      into v_tem, v_id
      from public.usuarios u
     where lower(u.email) = v_email and u.ativo_sistema = true
     limit 1;
    v_tem := coalesce(v_tem, false);
    perform set_config('rls.m_' || p_modulo, case when v_tem then 't' else 'f' end, true);
    if v_tem then return true; end if;
  end if;

  -- Não tem o módulo. Decide pelo modo e anota 1x por tabela por requisição.
  select modo into v_modo from public.rls_modulo_config where chave = 'unico';
  v_bloq := coalesce(v_modo, 'log') = 'trava';

  if coalesce(current_setting('rls.l_' || p_tabela, true), '') <> '1' then
    perform set_config('rls.l_' || p_tabela, '1', true);
    if v_email is null then
      v_email := coalesce(lower(nullif(auth.jwt() ->> 'email', '')), '(sem e-mail)');
      select u.id_usuario into v_id from public.usuarios u where lower(u.email) = v_email limit 1;
    end if;
    v_tela := public.rls_modulo_tela();
    begin
      insert into public.rls_modulo_log (email, id_usuario, modulo, tabela, ultimo_metodo, ultimo_path, bloqueado, ultima_tela)
      values (v_email, v_id, p_modulo, p_tabela,
              left(current_setting('request.method', true), 10),
              left(current_setting('request.path', true), 200),
              v_bloq, v_tela)
        on conflict (email, modulo, tabela, dia) do update
          set vezes = public.rls_modulo_log.vezes + 1, ultima_em = now(),
              ultimo_metodo = excluded.ultimo_metodo, ultimo_path = excluded.ultimo_path,
              bloqueado = excluded.bloqueado,
              ultima_tela = coalesce(excluded.ultima_tela, public.rls_modulo_log.ultima_tela);
    exception when others then
      raise log 'rls_modulo_ok: não anotou % % (%: %)', p_modulo, p_tabela, sqlstate, sqlerrm;
    end;
  end if;

  return not v_bloq;
end $$;
comment on function public.rls_modulo_ok(text, text) is
  'v236/v240: a conta do JWT tem o módulo? Admin/NULL/na lista → true. Senão anota em rls_modulo_log (com a tela de origem) e devolve true (modo log) ou false (modo trava).';

-- ── 4) O log agrupado por tela × módulo (para o card) ───────────────────────
-- Normaliza ids no caminho (uuid e números → [id]) para /empresas/abc… e
-- /empresas/def… caírem na mesma linha "/empresas/[id]".
create or replace function public.rls_modulo_por_tela()
returns table (
  tela text, modulo text, vezes bigint, contas bigint, tabelas bigint,
  ultimo_dia date, bloqueado boolean
)
language sql stable security definer set search_path = public as $$
  select coalesce(
           regexp_replace(
             regexp_replace(l.ultima_tela,
               '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}', '[id]', 'g'),
             '/[0-9]+(?=/|$)', '/[id]', 'g'),
           '(sem tela)') as tela,
         l.modulo,
         sum(l.vezes)::bigint,
         count(distinct l.email)::bigint,
         count(distinct l.tabela)::bigint,
         max(l.dia),
         bool_or(l.bloqueado)
    from public.rls_modulo_log l
   where public.caller_ve_presenca()
   group by 1, 2
   order by 3 desc, 1, 2;
$$;
revoke all on function public.rls_modulo_por_tela() from public, anon;
grant execute on function public.rls_modulo_por_tela() to authenticated;
comment on function public.rls_modulo_por_tela() is
  'v240: rls_modulo_log agrupado por tela (ids normalizados para [id]) × módulo. Só para quem vê Presença/Auditoria.';


commit;

notify pgrst, 'reload schema';
