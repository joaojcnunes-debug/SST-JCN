-- v276 (2026-10-06): biblioteca psicossocial como BASE DE OPÇÕES.
-- Cada tópico do inventário de risco vira uma lista de opções selecionáveis
-- (decisão do usuário): perigo, fonte geradora, evidência, descrição do
-- risco, danos à saúde, medida de controle, sugestão inicial e ação — por
-- fator; meio de propagação, situação e tempo de exposição — listas COMUNS a
-- todos os fatores (fator null). `padrao` = vem marcado no inventário.
-- Quem inclui: Admin direto (status 'ativo'); técnico SUGERE (status
-- 'pendente', sugerido_por) e o Admin aprova ou recusa.
-- O padrão de meio/situação/tempo de cada fator continua em
-- psi_biblioteca_fatores (meio_propagacao, situacao_padrao,
-- tempo_exposicao_padrao). As demais colunas de texto/lista de
-- psi_biblioteca_fatores ficam como legado (seed desta migration).
-- Já aplicada via MCP. Rollback: scripts/sql/v276_rollback_biblioteca_psi_itens.sql

create table if not exists public.psi_biblioteca_itens (
  id_item text primary key,
  fator text,
  topico text not null check (topico in
    ('perigo','fonte','evidencia','descricao','danos','medida','sugestao','acao','meio','situacao','tempo')),
  texto text not null check (length(trim(texto)) > 0),
  codigo text,
  ordem integer not null default 0,
  padrao boolean not null default false,
  status text not null default 'ativo' check (status in ('ativo','pendente','recusado')),
  sugerido_por text,
  sugerido_em timestamptz,
  revisado_por text,
  revisado_em timestamptz,
  criado_em timestamptz not null default now()
);
create unique index if not exists psi_biblioteca_itens_unico
  on public.psi_biblioteca_itens (coalesce(fator, '*'), topico, lower(trim(texto)));
create index if not exists psi_biblioteca_itens_fator_idx on public.psi_biblioteca_itens (fator, topico);

alter table public.psi_biblioteca_itens enable row level security;

drop policy if exists "autenticado le psi_biblioteca_itens" on public.psi_biblioteca_itens;
create policy "autenticado le psi_biblioteca_itens" on public.psi_biblioteca_itens
  for select to authenticated using (true);

-- Admin inclui em qualquer status; os demais só SUGEREM (pendente).
drop policy if exists "inclui psi_biblioteca_itens" on public.psi_biblioteca_itens;
create policy "inclui psi_biblioteca_itens" on public.psi_biblioteca_itens
  for insert to authenticated
  with check (public.caller_eh_admin() or (status = 'pendente' and padrao = false));

drop policy if exists "admin altera psi_biblioteca_itens" on public.psi_biblioteca_itens;
create policy "admin altera psi_biblioteca_itens" on public.psi_biblioteca_itens
  for update to authenticated using (public.caller_eh_admin()) with check (public.caller_eh_admin());

drop policy if exists "admin exclui psi_biblioteca_itens" on public.psi_biblioteca_itens;
create policy "admin exclui psi_biblioteca_itens" on public.psi_biblioteca_itens
  for delete to authenticated using (public.caller_eh_admin());

-- ── Seed a partir do que a biblioteca já tem (idempotente) ──────────────────
-- id determinístico: BIB- + 8 hex do md5(fator|tópico|texto).
create or replace function pg_temp.bib_id(f text, t text, x text) returns text
  language sql immutable as $$ select 'BIB-' || upper(substr(md5(coalesce(f, '*') || '|' || t || '|' || lower(trim(x))), 1, 8)) $$;

-- Perigo = nome do fator.
insert into public.psi_biblioteca_itens (id_item, fator, topico, texto, ordem, padrao)
select pg_temp.bib_id(v.fator, 'perigo', v.nome), v.fator, 'perigo', v.nome, 1, true
  from (values
    ('assedio', 'Assédio de qualquer natureza no trabalho'),
    ('falta_suporte', 'Falta de suporte / apoio no trabalho'),
    ('gestao_mudancas', 'Má gestão de mudanças organizacionais'),
    ('clareza_papel', 'Baixa clareza de papel / função'),
    ('recompensas', 'Baixas recompensas e reconhecimento'),
    ('baixo_controle', 'Baixo controle no trabalho / Falta de autonomia'),
    ('justica_organizacional', 'Baixa justiça organizacional'),
    ('eventos_traumaticos', 'Eventos violentos ou traumáticos'),
    ('subcarga', 'Baixa demanda no trabalho (Subcarga)'),
    ('sobrecarga', 'Excesso de demandas no trabalho (Sobrecarga)'),
    ('maus_relacionamentos', 'Maus relacionamentos no local de trabalho'),
    ('comunicacao_dificil', 'Trabalho em condições de difícil comunicação'),
    ('trabalho_remoto', 'Trabalho remoto e isolado')
  ) v(fator, nome)
on conflict do nothing;

-- Fontes geradoras (com código), não marcadas por padrão.
insert into public.psi_biblioteca_itens (id_item, fator, topico, texto, codigo, ordem, padrao)
select pg_temp.bib_id(b.fator, 'fonte', f->>'texto'), b.fator, 'fonte', f->>'texto', f->>'codigo', o::int, false
  from public.psi_biblioteca_fatores b, jsonb_array_elements(b.fontes_geradoras) with ordinality as x(f, o)
 where coalesce(trim(f->>'texto'), '') <> ''
on conflict do nothing;

-- Descrição do risco e danos à saúde: o texto atual, marcado por padrão.
insert into public.psi_biblioteca_itens (id_item, fator, topico, texto, ordem, padrao)
select pg_temp.bib_id(fator, 'descricao', descricao_risco), fator, 'descricao', descricao_risco, 1, true
  from public.psi_biblioteca_fatores where trim(descricao_risco) <> ''
on conflict do nothing;
insert into public.psi_biblioteca_itens (id_item, fator, topico, texto, ordem, padrao)
select pg_temp.bib_id(fator, 'danos', danos_saude), fator, 'danos', danos_saude, 1, true
  from public.psi_biblioteca_fatores where trim(danos_saude) <> ''
on conflict do nothing;

-- Medidas de controle: as "a verificar em campo", uma por item, NÃO marcadas
-- (medida existente é o que se constata em campo).
insert into public.psi_biblioteca_itens (id_item, fator, topico, texto, ordem, padrao)
select pg_temp.bib_id(b.fator, 'medida', m.t), b.fator, 'medida', m.t, m.o::int, false
  from public.psi_biblioteca_fatores b,
       lateral (
         select initcap(left(trim(x), 1)) || substr(trim(trailing '.' from trim(x)), 2) as t, o
           from unnest(string_to_array(regexp_replace(b.medidas_controle_verificar, '^\s*A verificar em campo:\s*', '', 'i'), ';'))
                with ordinality as u(x, o)
          where trim(x) <> ''
       ) m
on conflict do nothing;

-- Sugestões iniciais e ações: marcadas por padrão (era o comportamento).
insert into public.psi_biblioteca_itens (id_item, fator, topico, texto, ordem, padrao)
select pg_temp.bib_id(b.fator, 'sugestao', s), b.fator, 'sugestao', s, o::int, true
  from public.psi_biblioteca_fatores b, jsonb_array_elements_text(b.sugestoes_iniciais) with ordinality as x(s, o)
 where trim(s) <> ''
on conflict do nothing;
insert into public.psi_biblioteca_itens (id_item, fator, topico, texto, ordem, padrao)
select pg_temp.bib_id(b.fator, 'acao', s), b.fator, 'acao', s, o::int, true
  from public.psi_biblioteca_fatores b, jsonb_array_elements_text(b.acoes) with ordinality as x(s, o)
 where trim(s) <> ''
on conflict do nothing;

-- Listas comuns: meio de propagação, situação e tempo de exposição (fator null).
insert into public.psi_biblioteca_itens (id_item, fator, topico, texto, ordem, padrao)
select pg_temp.bib_id(null, 'meio', v), null, 'meio', v, row_number() over (order by v)::int, false
  from (select distinct trim(meio_propagacao) v from public.psi_biblioteca_fatores where trim(meio_propagacao) <> '') d
on conflict do nothing;
insert into public.psi_biblioteca_itens (id_item, fator, topico, texto, ordem, padrao)
select pg_temp.bib_id(null, 'situacao', v), null, 'situacao', v, row_number() over (order by v)::int, false
  from (select distinct trim(situacao_padrao) v from public.psi_biblioteca_fatores where trim(situacao_padrao) <> '') d
on conflict do nothing;
insert into public.psi_biblioteca_itens (id_item, fator, topico, texto, ordem, padrao)
select pg_temp.bib_id(null, 'tempo', v), null, 'tempo', v, row_number() over (order by v)::int, false
  from (select distinct trim(tempo_exposicao_padrao) v from public.psi_biblioteca_fatores where trim(tempo_exposicao_padrao) <> '') d
on conflict do nothing;
