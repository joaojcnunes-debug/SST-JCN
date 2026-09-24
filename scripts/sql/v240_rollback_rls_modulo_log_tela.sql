-- Rollback da v240 (tela de origem no log da trava por módulo).
-- Volta a rls_modulo_ok exatamente como a v236 a deixou, derruba a coluna
-- ultima_tela (e o que ela guardou), a rls_modulo_tela() e a RPC por tela.
-- As policies restritivas seguem de pé (apontam para a mesma função).

begin;

-- ── 4) A função que as policies chamam ──────────────────────────────────────
-- Memória por transação em GUCs locais (SET LOCAL): rls.m_<modulo> = 't'/'f'
-- (a conta tem o módulo?) e rls.l_<tabela> = '1' (já anotei esta tabela nesta
-- requisição). Um GUC local some no fim da transação, e o PostgREST abre uma
-- transação por requisição — então nada vaza entre pessoas na mesma conexão.
-- Nunca lança erro: qualquer falha ao anotar vira `raise log` e a decisão segue.
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
    begin
      if v_email is null then
        v_email := coalesce(lower(nullif(auth.jwt() ->> 'email', '')), '(sem e-mail)');
        select u.id_usuario into v_id from public.usuarios u where lower(u.email) = v_email limit 1;
      end if;
      perform ext.dblink_exec(
        'dbname=' || current_database() || ' user=' || current_user || ' application_name=rls_modulo_log',
        format(
          'insert into public.rls_modulo_log (email, id_usuario, modulo, tabela, ultimo_metodo, ultimo_path, bloqueado) values (%L, %L, %L, %L, %L, %L, %L) '
          'on conflict (email, modulo, tabela, dia) do update set vezes = public.rls_modulo_log.vezes + 1, ultima_em = now(), '
          'ultimo_metodo = excluded.ultimo_metodo, ultimo_path = excluded.ultimo_path, bloqueado = excluded.bloqueado',
          v_email, v_id, p_modulo, p_tabela,
          left(current_setting('request.method', true), 10),
          left(current_setting('request.path', true), 200),
          v_bloq));
    exception when others then
      raise log 'rls_modulo_ok: não anotou % % (%: %)', p_modulo, p_tabela, sqlstate, sqlerrm;
    end;
  end if;

  return not v_bloq;
end $$;
revoke all on function public.rls_modulo_ok(text, text) from public, anon;
grant execute on function public.rls_modulo_ok(text, text) to authenticated;
comment on function public.rls_modulo_ok(text, text) is
  'v236: a conta do JWT tem o módulo? Admin/NULL/na lista → true. Senão anota em rls_modulo_log e devolve true (modo log) ou false (modo trava).';

drop function if exists public.rls_modulo_por_tela();
drop function if exists public.rls_modulo_tela();
alter table public.rls_modulo_log drop column if exists ultima_tela;

delete from public.schema_migrations where version = 'v240_rls_modulo_log_tela';

commit;

notify pgrst, 'reload schema';
