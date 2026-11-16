-- v355 — Gestão: "@" nos comentários (12/11/2026, 0.3.287). Trazida da v368 do Painel (0.3.962).
--
-- O aviso de menção já existia (gestao_aviso_comentario_trg), mas a tela não tinha o "@" e a regra avisaria gente
-- demais: "@Primeiro" casava todo mundo com esse primeiro nome e "@ana" casava "@anabela" e o "@" de um e-mail.
-- Regra nova (gestao_mencionados; a mesma de lib/gestao/mencoes.ts, que a tela usa para sugerir e destacar):
--   - "@Nome Completo" ou "@Primeiro" quando o primeiro nome é ÚNICO entre as pessoas que podem ser marcadas;
--   - sem diferença de maiúscula e acento; o nome termina onde termina a palavra;
--   - o "@" vem no começo ou depois de espaço/pontuação: o "@" de um e-mail não conta;
--   - pessoas: perfil diferente de Cliente, conta ativa, com nome.
-- O aviso diz quem marcou ("Fulano mencionou você em …"); quem foi mencionado não recebe também o "Novo comentário".
-- O corpo anterior de gestao_aviso_comentario_trg no JCN era igual ao do Painel antes da v368 (conferido em 12/11).
-- Adaptação do JCN: extensions.unaccent (a extensão fica no schema extensions).
--
-- REAPLICAR: não (cria a função). ROLLBACK: scripts/sql/v355_gestao_mencao_comentario_rollback.sql
begin;

do $$ begin
  if to_regprocedure('public.gestao_aviso_comentario_trg()') is null then
    raise exception 'v355: falta public.gestao_aviso_comentario_trg';
  end if;
  if to_regprocedure('extensions.unaccent(text)') is null then
    raise exception 'v355: falta a extensão unaccent no schema extensions';
  end if;
  if to_regprocedure('public.gestao_mencionados(text)') is not null then
    raise exception 'v355: já aplicada (public.gestao_mencionados existe)';
  end if;
end $$;

create function public.gestao_mencionados(p_texto text)
returns text[]
language sql
stable
security definer
set search_path to 'public'
as $$
  with t as (
    select lower(extensions.unaccent(coalesce(p_texto, ''))) as txt
  ), pessoas as (
    select lower(btrim(u.email)) as email,
           regexp_replace(lower(extensions.unaccent(btrim(u.nome))), '\s+', ' ', 'g') as nome
      from public.usuarios u
     where u.perfil <> 'Cliente' and coalesce(u.ativo_sistema, true)
       and btrim(coalesce(u.nome, '')) <> '' and btrim(coalesce(u.email, '')) <> ''
  ), p as (
    select email, nome, split_part(nome, ' ', 1) as primeiro,
           count(*) over (partition by split_part(nome, ' ', 1)) as com_esse_primeiro
      from pessoas
  )
  select coalesce(array_agg(distinct p.email order by p.email), '{}')
    from p, t
   where position('@' in t.txt) > 0
     -- o nome entra literal na expressão: tudo que não é letra, número ou espaço vai escapado ("t.i" → "t\.i")
     and (t.txt ~ ('(^|[^a-z0-9._%+-])@' || regexp_replace(p.nome, '([^a-z0-9 ])', '\\\1', 'g') || '($|[^a-z0-9])')
          or (p.com_esse_primeiro = 1
              and t.txt ~ ('(^|[^a-z0-9._%+-])@' || regexp_replace(p.primeiro, '([^a-z0-9 ])', '\\\1', 'g') || '($|[^a-z0-9])')));
$$;

comment on function public.gestao_mencionados(text) is
  'v355: e-mails de quem foi marcado com @ no texto: @Nome Completo ou @Primeiro (só se único), sem acento/maiúscula.';
revoke all on function public.gestao_mencionados(text) from public;

create or replace function public.gestao_aviso_comentario_trg()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE v_t record; v_ator text := public.gestao_email(); r record;
  v_mencionados text[] := public.gestao_mencionados(new.texto);
  v_quem text;
BEGIN
  SELECT titulo, id_quadro INTO v_t FROM public.gestao_tarefas WHERE id_tarefa = new.id_tarefa;
  IF NOT FOUND THEN RETURN null; END IF;
  IF cardinality(v_mencionados) > 0 THEN
    SELECT nullif(btrim(u.nome), '') INTO v_quem FROM public.usuarios u WHERE lower(u.email) = v_ator LIMIT 1;
  END IF;
  FOR r IN SELECT unnest(v_mencionados) AS email LOOP
    PERFORM public.gestao_avisar(r.email, 'mencao',
      coalesce(v_quem, 'Alguém') || ' mencionou você em "' || v_t.titulo || '"', new.id_tarefa, v_t.id_quadro, v_ator);
  END LOOP;
  FOR r IN SELECT DISTINCT lower(usuario_email) AS email FROM public.gestao_tarefa_vinculados WHERE id_tarefa = new.id_tarefa LOOP
    IF NOT (r.email = ANY (v_mencionados)) THEN
      PERFORM public.gestao_avisar(r.email, 'comentario', 'Novo comentário em "' || v_t.titulo || '"', new.id_tarefa, v_t.id_quadro, v_ator);
    END IF;
  END LOOP;
  RETURN null;
END $function$;

notify pgrst, 'reload schema';

commit;
