-- v350 — Gestão: tela "Produtos" (criar, renomear, excluir) (11/11/2026, 0.3.282).
--
-- Trazida da v363 do Painel (0.3.942). A lista oficial continua sendo as opções do campo "Produtos" da lista Comercial
-- (gestao_campos eb5d9daf…, v342). Só gestores (owner/admin da Gestão) mexem.
--   · RENOMEAR muda em tudo: lista, formulários com a pergunta Produtos, cartões (gestao_tarefas.campos), automações
--     ("Produtos contém/não contém/está em …"), responsáveis por produto e filtros salvos. O nome antigo vira APELIDO:
--     cartão que chegar com ele depois é gravado com o nome novo (gatilho gestao_produtos_apelido).
--   · EXCLUIR tira da lista e dos formulários; os cartões que já tinham CONTINUAM com o produto.
-- Diferenças do Painel: unaccent fica no esquema extensions; os cartões são trocados com os gatilhos de usuário de
-- gestao_tarefas desligados na mesma transação (ALTER TABLE … DISABLE TRIGGER USER) em vez de session_replication_role,
-- que o Supabase não deixa a função ligar para usuário comum; o JCN não tem formulários com Produtos hoje (o
-- "alinhar" não muda nada) e não tem schema_migrations.
--
-- REAPLICAR: não (cria a tabela). ROLLBACK: scripts/sql/v350_gestao_produtos_rollback.sql

begin;

do $$ begin
  if not exists (select 1 from public.gestao_campos where id = 'eb5d9daf-9b81-4903-bfd5-4fea654225e7' and tipo = 'multi') then
    raise exception 'v350: campo Produtos (eb5d9daf…) não encontrado como multi';
  end if;
  if to_regclass('public.gestao_produtos_apelidos') is not null then raise exception 'v350: gestao_produtos_apelidos já existe'; end if;
  if to_regprocedure('extensions.unaccent(text)') is null or to_regprocedure('public.gestao_papel_de(text)') is null
     or to_regprocedure('public.gestao_email()') is null or to_regclass('public.gestao_produto_responsaveis') is null then
    raise exception 'v350: faltam unaccent / funções da Gestão / gestao_produto_responsaveis';
  end if;
end $$;

-- Nome antigo → nome atual (exato, como gravado nos cartões).
create table public.gestao_produtos_apelidos (
  apelido text primary key,
  nome text not null,
  criado_em timestamptz not null default now(),
  criado_por text
);
alter table public.gestao_produtos_apelidos enable row level security;   -- sem política: só pelas funções
revoke all on public.gestao_produtos_apelidos from public, anon, authenticated;

-- ── Ajudantes ────────────────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.gestao_produtos_norm(p text)
returns text language sql immutable set search_path = public as $fn$
  select lower(extensions.unaccent(regexp_replace(btrim(coalesce(p, '')), '\s+', ' ', 'g')))
$fn$;

create or replace function public.gestao_produtos_gestor()
returns boolean language plpgsql stable security definer set search_path = public as $fn$
declare v_email text := public.gestao_email();
begin
  return v_email is not null and coalesce(public.gestao_papel_de(v_email)::text, '') in ('owner', 'admin');
end $fn$;

-- Nome limpo (espaços) ou erro com a mensagem para a pessoa.
create or replace function public.gestao_produto_nome(p text)
returns text language plpgsql immutable set search_path = public as $fn$
declare v text := regexp_replace(btrim(coalesce(p, '')), '\s+', ' ', 'g');
begin
  if v = '' then raise exception 'Digite o nome do produto.'; end if;
  if length(v) > 80 then raise exception 'Nome muito longo (até 80 letras).'; end if;
  if v ~ '[,;]' then raise exception 'O nome do produto não pode ter vírgula nem ponto e vírgula.'; end if;
  return v;
end $fn$;

-- jsonb que deveria ser lista: se não for (nulo, texto…), vira lista vazia — nunca erro.
create or replace function public.gestao_produtos_arr(p jsonb)
returns jsonb language sql immutable as $fn$
  select case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end
$fn$;

-- Lista jsonb de nomes com "de" trocado por "para", na mesma ordem e sem repetir.
create or replace function public.gestao_produto_trocar_lista(p jsonb, p_de text, p_para text)
returns jsonb language sql immutable as $fn$
  select case when jsonb_typeof(p) <> 'array' then p else
    coalesce((select jsonb_agg(v order by n) from (
                select case when x = p_de then p_para else x end as v, min(o) as n
                  from jsonb_array_elements_text(p) with ordinality z(x, o) group by 1) s), '[]'::jsonb) end
$fn$;

-- Cláusulas de automação no campo Produtos: valor texto (contém / não contém) ou lista (está em).
create or replace function public.gestao_produto_trocar_condicao(p jsonb, p_de text, p_para text)
returns jsonb language sql immutable as $fn$
  select case when jsonb_typeof(p) <> 'object' then p else
    p || (select coalesce(jsonb_object_agg(k, (
             select coalesce(jsonb_agg(
                      case when c ->> 'campo' = 'campo:eb5d9daf-9b81-4903-bfd5-4fea654225e7' then
                             case jsonb_typeof(c -> 'valor')
                               -- JCN: "está em" grava a lista como texto separado por vírgula ("A, B, C"): troca o item.
                               when 'string' then case
                                 when c ->> 'valor' = p_de then jsonb_set(c, '{valor}', to_jsonb(p_para))
                                 when lower(coalesce(c ->> 'op', '')) = 'in' and position(',' in c ->> 'valor') > 0
                                      and p_de = any (select btrim(x) from unnest(string_to_array(c ->> 'valor', ',')) x) then
                                   jsonb_set(c, '{valor}', to_jsonb(array_to_string(array(
                                     select case when btrim(x) = p_de then p_para else btrim(x) end
                                       from unnest(string_to_array(c ->> 'valor', ',')) with ordinality u(x, o) order by o), ', ')))
                                 else c end
                               when 'array' then jsonb_set(c, '{valor}', public.gestao_produto_trocar_lista(c -> 'valor', p_de, p_para))
                               else c end
                           else c end order by n), '[]'::jsonb)
               from jsonb_array_elements(p -> k) with ordinality y(c, n))), '{}'::jsonb)
            from unnest(array['all', 'any']) k where jsonb_typeof(p -> k) = 'array') end
$fn$;

-- Opções da pergunta Produtos de cada formulário: aplica uma função de troca em todas.
--   p_modo: 'renomear' (de → para) | 'tirar' (de) | 'por' (para, no fim, se não houver) | 'alinhar' (com a lista)
create or replace function public.gestao_produtos_nos_formularios(p_modo text, p_de text default null, p_para text default null)
returns integer language plpgsql security definer set search_path = public as $fn$
declare
  v_cat text[] := (select opcoes from public.gestao_campos where id = 'eb5d9daf-9b81-4903-bfd5-4fea654225e7');
  v_n integer;
begin
  update public.gestao_formularios f
     set perguntas = (
       select jsonb_agg(
                case when q ->> 'destino' = 'campo:eb5d9daf-9b81-4903-bfd5-4fea654225e7' then
                       jsonb_set(q, '{opcoes}',
                         case p_modo
                           when 'renomear' then public.gestao_produto_trocar_lista(public.gestao_produtos_arr(q -> 'opcoes'), p_de, p_para)
                           when 'tirar' then coalesce((select jsonb_agg(x order by o) from jsonb_array_elements_text(public.gestao_produtos_arr(q -> 'opcoes')) with ordinality z(x, o) where x <> p_de), '[]'::jsonb)
                           when 'por' then case when public.gestao_produtos_arr(q -> 'opcoes') ? p_para then q -> 'opcoes' else public.gestao_produtos_arr(q -> 'opcoes') || to_jsonb(p_para) end
                           else -- alinhar: o que está na lista, na ordem do formulário, e o que falta no fim
                             coalesce((select jsonb_agg(x order by o) from jsonb_array_elements_text(public.gestao_produtos_arr(q -> 'opcoes')) with ordinality z(x, o) where x = any(v_cat)), '[]'::jsonb)
                             || coalesce((select jsonb_agg(c order by i) from unnest(v_cat) with ordinality w(c, i)
                                           where not public.gestao_produtos_arr(q -> 'opcoes') ? c), '[]'::jsonb)
                         end)
                     else q end order by n)
         from jsonb_array_elements(f.perguntas) with ordinality y(q, n))
   where jsonb_typeof(f.perguntas) = 'array'
     and exists (select 1 from jsonb_array_elements(f.perguntas) q where q ->> 'destino' = 'campo:eb5d9daf-9b81-4903-bfd5-4fea654225e7');
  get diagnostics v_n = row_count;
  return v_n;
end $fn$;

-- ── Apelidos: cartão gravado com nome antigo fica com o nome atual ────────────────────────────────────────────────
create or replace function public.gestao_produtos_apelido_trg()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare k constant text := 'eb5d9daf-9b81-4903-bfd5-4fea654225e7';
begin
  if jsonb_typeof(new.campos -> k) is distinct from 'array' then return new; end if;
  if tg_op = 'UPDATE' and new.campos -> k is not distinct from old.campos -> k then return new; end if;
  if not exists (select 1 from jsonb_array_elements_text(new.campos -> k) v join public.gestao_produtos_apelidos a on a.apelido = v) then
    return new;
  end if;
  new.campos := jsonb_set(new.campos, array[k],
    (select coalesce(jsonb_agg(v order by n), '[]'::jsonb) from (
       select coalesce(a.nome, x) as v, min(o) as n
         from jsonb_array_elements_text(new.campos -> k) with ordinality z(x, o)
         left join public.gestao_produtos_apelidos a on a.apelido = x
        group by 1) s));
  return new;
end $fn$;

create trigger gestao_produtos_apelido before insert or update of campos on public.gestao_tarefas
  for each row execute function public.gestao_produtos_apelido_trg();

-- ── O que a tela usa ─────────────────────────────────────────────────────────────────────────────────────────────
-- A lista (na ordem dela) + o que está em cartões sem estar na lista, com o uso de cada um. Só gestor.
create or replace function public.gestao_produtos_listar()
returns table (nome text, na_lista boolean, posicao integer, cartoes integer, automacoes integer, formularios integer, apelidos text[])
language plpgsql stable security definer set search_path = public as $fn$
#variable_conflict use_column
declare k constant text := 'eb5d9daf-9b81-4903-bfd5-4fea654225e7';
begin
  if not public.gestao_produtos_gestor() then raise exception 'Só gestores da Gestão mexem nos produtos.'; end if;
  return query
  with cat as (
    select c as nome, i::int as posicao from public.gestao_campos g, unnest(g.opcoes) with ordinality u(c, i) where g.id = k::uuid
  ), uso as (
    select v as nome, count(*)::int as n
      from public.gestao_tarefas t, jsonb_array_elements_text(public.gestao_produtos_arr(t.campos -> k)) v
     group by v
  ), aut as (
    select v as nome, count(distinct a.id)::int as n
      from public.gestao_automacoes a,
           jsonb_array_elements(coalesce(case when jsonb_typeof(a.condicao -> 'all') = 'array' then a.condicao -> 'all' end, '[]'::jsonb)
                              || coalesce(case when jsonb_typeof(a.condicao -> 'any') = 'array' then a.condicao -> 'any' end, '[]'::jsonb)) c,
           lateral (select c ->> 'valor' as v where jsonb_typeof(c -> 'valor') = 'string'
                    union select x from jsonb_array_elements_text(case when jsonb_typeof(c -> 'valor') = 'array' then c -> 'valor' else '[]'::jsonb end) x) vs
     where c ->> 'campo' = 'campo:' || k
     group by v
  ), frm as (
    select x as nome, count(distinct f.id)::int as n
      from public.gestao_formularios f, jsonb_array_elements(case when jsonb_typeof(f.perguntas) = 'array' then f.perguntas else '[]'::jsonb end) q,
           jsonb_array_elements_text(public.gestao_produtos_arr(q -> 'opcoes')) x
     where q ->> 'destino' = 'campo:' || k
     group by x
  ), todos as (
    select nome, true as na_lista, posicao from cat
    union all
    select u.nome, false, null from uso u where not exists (select 1 from cat where cat.nome = u.nome)
  )
  select t.nome, t.na_lista, t.posicao, coalesce(u.n, 0), coalesce(a.n, 0), coalesce(f.n, 0),
         coalesce((select array_agg(ap.apelido order by ap.criado_em) from public.gestao_produtos_apelidos ap where ap.nome = t.nome), '{}'::text[])
    from todos t
    left join uso u on u.nome = t.nome
    left join aut a on a.nome = t.nome
    left join frm f on f.nome = t.nome
   order by t.na_lista desc, t.posicao nulls last, t.nome;
end $fn$;

create or replace function public.gestao_produto_criar(p_nome text)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  k constant text := 'eb5d9daf-9b81-4903-bfd5-4fea654225e7';
  v text;
  v_cat text[];
  n_forms integer;
begin
  if not public.gestao_produtos_gestor() then raise exception 'Só gestores da Gestão mexem nos produtos.'; end if;
  v := public.gestao_produto_nome(p_nome);
  select opcoes into v_cat from public.gestao_campos where id = k::uuid for update;
  if exists (select 1 from unnest(v_cat) o where public.gestao_produtos_norm(o) = public.gestao_produtos_norm(v)) then
    raise exception 'Já existe o produto "%".', (select o from unnest(v_cat) o where public.gestao_produtos_norm(o) = public.gestao_produtos_norm(v) limit 1);
  end if;
  update public.gestao_campos set opcoes = array_append(coalesce(opcoes, '{}'::text[]), v) where id = k::uuid;
  n_forms := public.gestao_produtos_nos_formularios('por', null, v);
  -- o nome volta a ser produto de verdade: deixa de ser apelido de outro
  delete from public.gestao_produtos_apelidos where apelido = v;
  return jsonb_build_object('nome', v, 'formularios', n_forms);
end $fn$;

create or replace function public.gestao_produto_renomear(p_de text, p_para text)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  k constant text := 'eb5d9daf-9b81-4903-bfd5-4fea654225e7';
  v text;
  v_cat text[];
  v_email text := public.gestao_email();
  n_cartoes integer; n_autom integer; n_forms integer; n_resp integer; n_filtros integer;
begin
  if not public.gestao_produtos_gestor() then raise exception 'Só gestores da Gestão mexem nos produtos.'; end if;
  v := public.gestao_produto_nome(p_para);
  select opcoes into v_cat from public.gestao_campos where id = k::uuid for update;
  if not (p_de = any(v_cat)) then raise exception 'O produto "%" não está mais na lista. Atualize a tela.', p_de; end if;
  if v = p_de then return jsonb_build_object('nome', v, 'sem_mudanca', true); end if;
  if exists (select 1 from unnest(v_cat) o where o <> p_de and public.gestao_produtos_norm(o) = public.gestao_produtos_norm(v)) then
    raise exception 'Já existe o produto "%". Para juntar dois produtos, exclua um deles.', v;
  end if;

  update public.gestao_campos set opcoes = array_replace(opcoes, p_de, v) where id = k::uuid;
  n_forms := public.gestao_produtos_nos_formularios('renomear', p_de, v);

  update public.gestao_automacoes a set condicao = public.gestao_produto_trocar_condicao(a.condicao, p_de, v)
   where a.condicao::text like '%campo:' || k || '%'
     and public.gestao_produto_trocar_condicao(a.condicao, p_de, v) is distinct from a.condicao;
  get diagnostics n_autom = row_count;

  update public.gestao_produto_responsaveis r
     set produtos = array(select x from (select case when y = p_de then v else y end as x, min(o) as o
                                           from unnest(r.produtos) with ordinality u(y, o) group by 1) s order by o),
         updated_at = now()
   where p_de = any(r.produtos);
  get diagnostics n_resp = row_count;

  update public.gestao_filtros_salvos s
     set criterios = jsonb_set(s.criterios, '{produtos}', public.gestao_produto_trocar_lista(s.criterios -> 'produtos', p_de, v))
   where jsonb_typeof(s.criterios -> 'produtos') = 'array' and s.criterios -> 'produtos' ? p_de;
  get diagnostics n_filtros = row_count;

  -- nome antigo vira apelido (e quem apontava para ele passa a apontar para o novo)
  delete from public.gestao_produtos_apelidos where apelido = v;
  update public.gestao_produtos_apelidos set nome = v where nome = p_de;
  insert into public.gestao_produtos_apelidos (apelido, nome, criado_por) values (p_de, v, v_email)
  on conflict (apelido) do update set nome = excluded.nome, criado_por = excluded.criado_por, criado_em = now();

  -- Cartões: sem gatilhos (não é edição de ninguém). JCN: desliga os gatilhos de usuário de gestao_tarefas só nesta
  -- transação (com erro, volta junto); quem estiver gravando cartões espera o fim (instantes).
  execute 'alter table public.gestao_tarefas disable trigger user';
  update public.gestao_tarefas t
     set campos = jsonb_set(t.campos, array[k], public.gestao_produto_trocar_lista(t.campos -> k, p_de, v))
   where jsonb_typeof(t.campos -> k) = 'array' and t.campos -> k ? p_de;
  get diagnostics n_cartoes = row_count;
  execute 'alter table public.gestao_tarefas enable trigger user';

  insert into public.auditoria_eventos (tabela, registro_id, acao, modulo, titulo, usuario_email, usuario_role, campos_alterados, antes, depois)
  values ('gestao_tarefas', null, 'editou', 'gestao_chabra', format('Produto renomeado em %s cartões', n_cartoes), v_email, 'authenticated',
          array['produtos'], jsonb_build_object('produto', p_de), jsonb_build_object('produto', v, 'cartoes', n_cartoes));

  return jsonb_build_object('nome', v, 'cartoes', n_cartoes, 'automacoes', n_autom, 'formularios', n_forms,
                            'responsaveis', n_resp, 'filtros', n_filtros);
end $fn$;

create or replace function public.gestao_produto_excluir(p_nome text)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  k constant text := 'eb5d9daf-9b81-4903-bfd5-4fea654225e7';
  v_cat text[];
  n_forms integer;
  n_cartoes integer;
begin
  if not public.gestao_produtos_gestor() then raise exception 'Só gestores da Gestão mexem nos produtos.'; end if;
  select opcoes into v_cat from public.gestao_campos where id = k::uuid for update;
  if not (p_nome = any(v_cat)) then raise exception 'O produto "%" não está mais na lista. Atualize a tela.', p_nome; end if;
  update public.gestao_campos set opcoes = array_remove(opcoes, p_nome) where id = k::uuid;
  n_forms := public.gestao_produtos_nos_formularios('tirar', p_nome, null);
  select count(*)::int into n_cartoes from public.gestao_tarefas t where jsonb_typeof(t.campos -> k) = 'array' and t.campos -> k ? p_nome;
  return jsonb_build_object('nome', p_nome, 'formularios', n_forms, 'cartoes_que_mantem', n_cartoes);
end $fn$;

-- ── Alinha os formulários com a lista agora (decisão do usuário: os 5 seguem a lista) ────────────────────────────
select 'formulários alinhados', public.gestao_produtos_nos_formularios('alinhar');

revoke all on function public.gestao_produtos_norm(text) from public, anon;
revoke all on function public.gestao_produtos_gestor() from public, anon, authenticated;
revoke all on function public.gestao_produto_nome(text) from public, anon;
revoke all on function public.gestao_produtos_arr(jsonb) from public, anon;
revoke all on function public.gestao_produto_trocar_lista(jsonb, text, text) from public, anon;
revoke all on function public.gestao_produto_trocar_condicao(jsonb, text, text) from public, anon;
revoke all on function public.gestao_produtos_nos_formularios(text, text, text) from public, anon, authenticated;
revoke all on function public.gestao_produtos_apelido_trg() from public, anon, authenticated;
revoke all on function public.gestao_produtos_listar() from public, anon;
revoke all on function public.gestao_produto_criar(text) from public, anon;
revoke all on function public.gestao_produto_renomear(text, text) from public, anon;
revoke all on function public.gestao_produto_excluir(text) from public, anon;
grant execute on function public.gestao_produtos_listar() to authenticated;
grant execute on function public.gestao_produto_criar(text) to authenticated;
grant execute on function public.gestao_produto_renomear(text, text) to authenticated;
grant execute on function public.gestao_produto_excluir(text) to authenticated;


notify pgrst, 'reload schema';

commit;
