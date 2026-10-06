-- v274 (2026-10-06): questionário anônimo da AEP sem service role.
-- A v273 gravava pela rota do servidor com a service role, mas a produção
-- (Vercel) não tem SUPABASE_SERVICE_ROLE_KEY. Mais seguro e sem segredo:
-- duas funções SECURITY DEFINER, as ÚNICAS portas públicas, que validam o
-- token e o conteúdo dentro do banco. A tabela qps_respostas_anonimas segue
-- fechada (RLS sem policy + revoke) e append-only; a data vem do default
-- (sem horário). Nada identifica quem responde.
-- Já aplicada via MCP. Rollback: scripts/sql/v274_rollback_questionario_anonimo_rpc.sql

-- Perguntas do link (ou a situação, se não estiver aberto).
create or replace function public.qps_questionario_publico(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  c record;
  v_total int;
  v_situacao text;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return null;
  end if;
  select id_coleta, setor, expira_em, ativo, max_respostas into c
    from public.qps_coletas_anonimas where token = p_token;
  if not found then return null; end if;
  select count(*) into v_total from public.qps_respostas_anonimas where id_coleta = c.id_coleta;
  v_situacao := case
    when not c.ativo then 'encerrada'
    when current_date > c.expira_em then 'expirada'
    when v_total >= c.max_respostas then 'cheia'
    else 'aberta' end;
  return jsonb_build_object(
    'setor', c.setor,
    'situacao', v_situacao,
    'instrucoes', (select instrucoes from public.qps_tipos where id_tipo = 'a3e70000-0000-4000-8000-000000000000'),
    'perguntas', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id_pergunta, 'texto', p.texto) order by cat.ordem, p.ordem)
        from public.qps_perguntas p
        join public.qps_categorias cat on cat.id_categoria = p.id_categoria
       where cat.id_tipo = 'a3e70000-0000-4000-8000-000000000000' and p.ativo
    ), '[]'::jsonb)
  );
end $$;

-- Grava UMA resposta: exige todas as perguntas ativas, valores 1..5, nada a mais.
create or replace function public.qps_responder_anonimo(p_token text, p_respostas jsonb, p_comentario text)
returns text language plpgsql volatile security definer set search_path = public as $$
declare
  c record;
  v_total int;
  v_ids text[];
  v_limpo jsonb := '{}'::jsonb;
  v_id text;
  v_val jsonb;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then return 'invalido'; end if;
  select id_coleta, expira_em, ativo, max_respostas into c
    from public.qps_coletas_anonimas where token = p_token for update;
  if not found then return 'invalido'; end if;
  select count(*) into v_total from public.qps_respostas_anonimas where id_coleta = c.id_coleta;
  if not c.ativo or current_date > c.expira_em or v_total >= c.max_respostas then
    return 'fechado';
  end if;
  if p_respostas is null or jsonb_typeof(p_respostas) <> 'object' then return 'incompleto'; end if;

  select array_agg(p.id_pergunta::text) into v_ids
    from public.qps_perguntas p
    join public.qps_categorias cat on cat.id_categoria = p.id_categoria
   where cat.id_tipo = 'a3e70000-0000-4000-8000-000000000000' and p.ativo;
  foreach v_id in array coalesce(v_ids, array[]::text[]) loop
    v_val := p_respostas -> v_id;
    if v_val is null or jsonb_typeof(v_val) <> 'number'
       or (v_val)::text !~ '^[1-5]$' then
      return 'incompleto';
    end if;
    v_limpo := v_limpo || jsonb_build_object(v_id, (v_val)::text::int);
  end loop;

  insert into public.qps_respostas_anonimas (id_coleta, respostas, comentario)
  values (c.id_coleta, v_limpo, nullif(left(trim(coalesce(p_comentario, '')), 1000), ''));
  return 'ok';
end $$;

revoke all on function public.qps_questionario_publico(text) from public;
revoke all on function public.qps_responder_anonimo(text, jsonb, text) from public;
grant execute on function public.qps_questionario_publico(text) to anon, authenticated;
grant execute on function public.qps_responder_anonimo(text, jsonb, text) to anon, authenticated;
