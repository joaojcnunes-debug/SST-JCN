-- ROLLBACK da v316 — tira a aba Histórico do banco e devolve o gatilho da v256.
-- As colunas doc_tabela/doc_id SAEM (ninguém mais as lê depois do rollback do código).
-- 

drop policy if exists auditoria_eventos_sel_doc on public.auditoria_eventos;
-- Volta a policy da v231 (Admin/Presença).
drop policy if exists auditoria_eventos_sel on public.auditoria_eventos;
create policy auditoria_eventos_sel on public.auditoria_eventos
  for select to authenticated using (public.caller_ve_presenca());
drop function if exists public.auditoria_doc_visivel(text, text);

create or replace function public.auditoria_registrar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg        public.auditoria_tabelas%rowtype;
  j_old      jsonb;
  j_new      jsonb;
  antes      jsonb := '{}'::jsonb;
  depois     jsonb := '{}'::jsonb;
  campos     text[] := '{}';
  k          text;
  v_old      jsonb;
  v_new      jsonb;
  sub_antes  jsonb;
  sub_depois jsonb;
  sk         text;
  claims     jsonb;
  v_email    text;
  v_role     text;
  headers    jsonb;
  v_origem   text;
  v_registro text;
  v_empresa  text;
  v_titulo   text;
  v_acao     text;
  -- Colunas que nunca saem em claro.
  c_mascara  constant text := 'senha|password|token|secret|pfx|biometria_dedo|biometria_template|^template$|assinatura_png|_base64';
  -- Colunas que não contam como mudança.
  c_ignora   constant text[] := array['updated_at','atualizado_em'];
begin
  select * into cfg from public.auditoria_tabelas where tabela = TG_TABLE_NAME;
  if not found or not cfg.ativo then
    return null;
  end if;

  claims  := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  v_email := lower(nullif(claims ->> 'email', ''));
  v_role  := coalesce(claims ->> 'role', current_user::text);

  -- v256: gravação pelo token de SERVIÇO traz quem está por trás nos cabeçalhos
  -- X-Painel-Ator / X-Painel-Origem (lib/supabase/client.ts). Só vale para
  -- service_role: esse token nunca sai do servidor, então do navegador não dá
  -- para se passar por outra pessoa (um authenticated que mande o cabeçalho é
  -- ignorado — o e-mail dele vem do JWT, acima).
  if v_role = 'service_role' then
    headers  := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb;
    v_origem := left(nullif(btrim(headers ->> 'x-painel-origem'), ''), 80);
    if v_email is null then
      v_email := left(lower(nullif(btrim(headers ->> 'x-painel-ator'), '')), 200);
    end if;
  end if;

  if TG_OP in ('UPDATE','DELETE') then j_old := to_jsonb(OLD); end if;
  if TG_OP in ('UPDATE','INSERT') then j_new := to_jsonb(NEW); end if;

  -- Mascara segredos nos dois lados.
  if j_old is not null then
    select coalesce(jsonb_object_agg(e.key, case when e.key ~* c_mascara and e.value <> 'null'::jsonb then '"***"'::jsonb else e.value end), '{}'::jsonb)
      into j_old from jsonb_each(j_old) e;
  end if;
  if j_new is not null then
    select coalesce(jsonb_object_agg(e.key, case when e.key ~* c_mascara and e.value <> 'null'::jsonb then '"***"'::jsonb else e.value end), '{}'::jsonb)
      into j_new from jsonb_each(j_new) e;
  end if;

  if TG_OP = 'INSERT' then
    v_acao := 'criou';
    depois := j_new;
    antes  := null;
  elsif TG_OP = 'DELETE' then
    v_acao := 'excluiu';
    antes  := j_old;
    depois := null;
  else
    v_acao := 'editou';
    for k in select key from jsonb_each(j_new) union select key from jsonb_each(j_old) loop
      if k = any(c_ignora) then continue; end if;
      v_old := j_old -> k;
      v_new := j_new -> k;
      if v_old is distinct from v_new then
        campos := array_append(campos, k);
        -- jsonb OBJETO dos dois lados: guarda só as chaves que mudaram.
        if jsonb_typeof(v_old) = 'object' and jsonb_typeof(v_new) = 'object' then
          sub_antes := '{}'::jsonb; sub_depois := '{}'::jsonb;
          for sk in select key from jsonb_each(v_new) union select key from jsonb_each(v_old) loop
            if (v_old -> sk) is distinct from (v_new -> sk) then
              sub_antes  := sub_antes  || jsonb_build_object(sk, v_old -> sk);
              sub_depois := sub_depois || jsonb_build_object(sk, v_new -> sk);
            end if;
          end loop;
          antes  := antes  || jsonb_build_object(k, sub_antes);
          depois := depois || jsonb_build_object(k, sub_depois);
        else
          antes  := antes  || jsonb_build_object(k, v_old);
          depois := depois || jsonb_build_object(k, v_new);
        end if;
      end if;
    end loop;
    -- Só updated_at mudou (ou nada): não é movimentação.
    if coalesce(array_length(campos, 1), 0) = 0 then
      return null;
    end if;
  end if;

  -- Identificação do registro (PK simples ou composta, unida por '|').
  select string_agg(coalesce(coalesce(j_new, j_old) ->> c, ''), '|' order by ord)
    into v_registro
    from unnest(cfg.pk_colunas) with ordinality as u(c, ord);

  v_empresa := coalesce(j_new ->> 'id_empresa', j_old ->> 'id_empresa',
                        j_new ->> 'empresa_id', j_old ->> 'empresa_id');
  if cfg.coluna_titulo is not null then
    v_titulo := left(coalesce(j_new ->> cfg.coluna_titulo, j_old ->> cfg.coluna_titulo), 200);
  end if;

  insert into public.auditoria_eventos
    (tabela, registro_id, acao, modulo, id_empresa, titulo, usuario_email, usuario_role, usuario_origem, campos_alterados, antes, depois)
  values
    (TG_TABLE_NAME, v_registro, v_acao, cfg.modulo, v_empresa, v_titulo, v_email, v_role, v_origem, campos, antes, depois);

  return null;
exception when others then
  -- Nunca derruba a gravação do usuário por causa da trilha.
  raise warning 'auditoria: falha ao registrar % em % (%): %', TG_OP, TG_TABLE_NAME, v_registro, sqlerrm;
  return null;
end
$$;

revoke all on function public.auditoria_registrar() from public, authenticated, anon;

drop function if exists public.auditoria_doc_de(text, jsonb);
drop table if exists public.auditoria_doc_regras;
drop index if exists public.auditoria_eventos_doc_idx;
alter table public.auditoria_eventos drop column if exists doc_id;
alter table public.auditoria_eventos drop column if exists doc_tabela;


notify pgrst, 'reload schema';
