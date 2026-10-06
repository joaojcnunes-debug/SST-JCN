-- v273 (2026-10-06): Fase 3 da AEP com menos dependência de entrevistas —
-- questionário ANÔNIMO por QR Code, construído DENTRO do QPS (decisão da
-- auditoria aprovada pelo usuário):
--   • tipo QPS "Triagem anônima AEP (13 fatores)" — 13 categorias (os fatores;
--     a chave do fator vai em `descricao`) e 13 afirmações (Anexo D), escala
--     Nunca…Sempre; editável na tela Tipos do QPS. IDs fixos: o app mapeia
--     pergunta → fator por eles (lib/qps/triagem-anonima.ts).
--   • qps_coletas_anonimas — um link por setor da AEP (token aleatório de 256
--     bits, validade, ativo, teto de respostas), presa a uma aplicação QPS.
--   • qps_respostas_anonimas — APPEND-ONLY e sem identificação: sem IP, sem
--     user-agent, sem horário (só a data). RLS ligada e SEM policy: o cliente
--     não lê nem grava direto. Gravação só pela rota do servidor (service
--     role); leitura só pelas funções abaixo, com k-anonimato (≥ 5 respostas).
-- Não substitui o DRPS: é triagem complementar.
-- Já aplicada via MCP. Rollback: scripts/sql/v273_rollback_coleta_anonima_qps.sql

insert into public.qps_tipos (id_tipo, nome, descricao, instrucoes, escala_min, escala_max, ativo)
values ('a3e70000-0000-4000-8000-000000000000', 'Triagem anônima AEP (13 fatores)',
  'Questionário anônimo por QR Code da AEP — uma afirmação por fator psicossocial. Triagem complementar; não substitui o DRPS.',
  'Este questionário é anônimo. Não pedimos seu nome e ninguém da empresa terá acesso às respostas individuais. Responda pensando nos últimos 3 meses.',
  1, 5, true)
on conflict (id_tipo) do nothing;

insert into public.qps_categorias (id_categoria, id_tipo, nome, descricao, ordem) values
  ('a3e70000-0000-4000-8000-000000000101', 'a3e70000-0000-4000-8000-000000000000', 'Assédio de qualquer natureza no trabalho', 'assedio', 1),
  ('a3e70000-0000-4000-8000-000000000102', 'a3e70000-0000-4000-8000-000000000000', 'Falta de suporte / apoio no trabalho', 'falta_suporte', 2),
  ('a3e70000-0000-4000-8000-000000000103', 'a3e70000-0000-4000-8000-000000000000', 'Má gestão de mudanças organizacionais', 'gestao_mudancas', 3),
  ('a3e70000-0000-4000-8000-000000000104', 'a3e70000-0000-4000-8000-000000000000', 'Baixa clareza de papel / função', 'clareza_papel', 4),
  ('a3e70000-0000-4000-8000-000000000105', 'a3e70000-0000-4000-8000-000000000000', 'Baixas recompensas e reconhecimento', 'recompensas', 5),
  ('a3e70000-0000-4000-8000-000000000106', 'a3e70000-0000-4000-8000-000000000000', 'Baixo controle no trabalho / Falta de autonomia', 'baixo_controle', 6),
  ('a3e70000-0000-4000-8000-000000000107', 'a3e70000-0000-4000-8000-000000000000', 'Baixa justiça organizacional', 'justica_organizacional', 7),
  ('a3e70000-0000-4000-8000-000000000108', 'a3e70000-0000-4000-8000-000000000000', 'Eventos violentos ou traumáticos', 'eventos_traumaticos', 8),
  ('a3e70000-0000-4000-8000-000000000109', 'a3e70000-0000-4000-8000-000000000000', 'Baixa demanda no trabalho (Subcarga)', 'subcarga', 9),
  ('a3e70000-0000-4000-8000-000000000110', 'a3e70000-0000-4000-8000-000000000000', 'Excesso de demandas no trabalho (Sobrecarga)', 'sobrecarga', 10),
  ('a3e70000-0000-4000-8000-000000000111', 'a3e70000-0000-4000-8000-000000000000', 'Maus relacionamentos no local de trabalho', 'maus_relacionamentos', 11),
  ('a3e70000-0000-4000-8000-000000000112', 'a3e70000-0000-4000-8000-000000000000', 'Trabalho em condições de difícil comunicação', 'comunicacao_dificil', 12),
  ('a3e70000-0000-4000-8000-000000000113', 'a3e70000-0000-4000-8000-000000000000', 'Trabalho remoto e isolado', 'trabalho_remoto', 13)
on conflict (id_categoria) do nothing;

insert into public.qps_perguntas (id_pergunta, id_categoria, texto, logica, ordem, ativo, opcoes) values
  ('a3e70000-0000-4000-8000-000000000201', 'a3e70000-0000-4000-8000-000000000101', 'No meu setor, as pessoas são tratadas com grosseria, ironia ou constrangidas na frente dos outros.', 'direta', 1, true, '["Nunca", "Raramente", "Às vezes", "Frequentemente", "Sempre"]'::jsonb),
  ('a3e70000-0000-4000-8000-000000000202', 'a3e70000-0000-4000-8000-000000000102', 'Quando tenho um problema no trabalho, não tenho a quem recorrer.', 'direta', 1, true, '["Nunca", "Raramente", "Às vezes", "Frequentemente", "Sempre"]'::jsonb),
  ('a3e70000-0000-4000-8000-000000000203', 'a3e70000-0000-4000-8000-000000000103', 'As mudanças aqui chegam por boatos antes de serem comunicadas oficialmente.', 'direta', 1, true, '["Nunca", "Raramente", "Às vezes", "Frequentemente", "Sempre"]'::jsonb),
  ('a3e70000-0000-4000-8000-000000000204', 'a3e70000-0000-4000-8000-000000000104', 'Recebo orientações diferentes de pessoas diferentes para a mesma tarefa.', 'direta', 1, true, '["Nunca", "Raramente", "Às vezes", "Frequentemente", "Sempre"]'::jsonb),
  ('a3e70000-0000-4000-8000-000000000205', 'a3e70000-0000-4000-8000-000000000105', 'Quando faço um bom trabalho, ninguém reconhece.', 'direta', 1, true, '["Nunca", "Raramente", "Às vezes", "Frequentemente", "Sempre"]'::jsonb),
  ('a3e70000-0000-4000-8000-000000000206', 'a3e70000-0000-4000-8000-000000000106', 'Preciso pedir autorização até para decisões simples do meu trabalho.', 'direta', 1, true, '["Nunca", "Raramente", "Às vezes", "Frequentemente", "Sempre"]'::jsonb),
  ('a3e70000-0000-4000-8000-000000000207', 'a3e70000-0000-4000-8000-000000000107', 'As decisões aqui (folgas, escalas, promoções) dependem de quem é preferido.', 'direta', 1, true, '["Nunca", "Raramente", "Às vezes", "Frequentemente", "Sempre"]'::jsonb),
  ('a3e70000-0000-4000-8000-000000000208', 'a3e70000-0000-4000-8000-000000000108', 'No meu trabalho, passo por situações de agressão, ameaça ou risco de violência.', 'direta', 1, true, '["Nunca", "Raramente", "Às vezes", "Frequentemente", "Sempre"]'::jsonb),
  ('a3e70000-0000-4000-8000-000000000209', 'a3e70000-0000-4000-8000-000000000109', 'Passo boa parte do tempo sem ter o que fazer ou fazendo tarefas abaixo da minha capacidade.', 'direta', 1, true, '["Nunca", "Raramente", "Às vezes", "Frequentemente", "Sempre"]'::jsonb),
  ('a3e70000-0000-4000-8000-000000000210', 'a3e70000-0000-4000-8000-000000000110', 'Não consigo dar conta do meu trabalho dentro do horário normal.', 'direta', 1, true, '["Nunca", "Raramente", "Às vezes", "Frequentemente", "Sempre"]'::jsonb),
  ('a3e70000-0000-4000-8000-000000000211', 'a3e70000-0000-4000-8000-000000000111', 'A convivência entre os colegas do meu setor é difícil.', 'direta', 1, true, '["Nunca", "Raramente", "Às vezes", "Frequentemente", "Sempre"]'::jsonb),
  ('a3e70000-0000-4000-8000-000000000212', 'a3e70000-0000-4000-8000-000000000112', 'Fico sem as informações de que preciso para fazer meu trabalho.', 'direta', 1, true, '["Nunca", "Raramente", "Às vezes", "Frequentemente", "Sempre"]'::jsonb),
  ('a3e70000-0000-4000-8000-000000000213', 'a3e70000-0000-4000-8000-000000000113', 'Trabalhando sozinho ou à distância, me sinto desconectado da equipe.', 'direta', 1, true, '["Nunca", "Raramente", "Às vezes", "Frequentemente", "Sempre"]'::jsonb)
on conflict (id_pergunta) do nothing;

create table if not exists public.qps_coletas_anonimas (
  id_coleta text primary key,
  token text not null unique,
  id_aplicacao uuid not null references public.qps_aplicacoes(id_aplicacao) on delete restrict,
  id_relatorio_aep uuid references public.aep_relatorios(id_relatorio) on delete set null,
  id_setor_aep text,
  setor text not null,
  expira_em date not null,
  ativo boolean not null default true,
  max_respostas integer not null default 300 check (max_respostas > 0),
  criado_por text,
  criado_em timestamptz not null default now()
);
create index if not exists qps_coletas_anonimas_aep_idx on public.qps_coletas_anonimas (id_relatorio_aep);

alter table public.qps_coletas_anonimas enable row level security;
drop policy if exists "autenticado le qps_coletas_anonimas" on public.qps_coletas_anonimas;
create policy "autenticado le qps_coletas_anonimas" on public.qps_coletas_anonimas
  for select to authenticated using (true);
drop policy if exists "autenticado cria qps_coletas_anonimas" on public.qps_coletas_anonimas;
create policy "autenticado cria qps_coletas_anonimas" on public.qps_coletas_anonimas
  for insert to authenticated with check (true);
drop policy if exists "autenticado altera qps_coletas_anonimas" on public.qps_coletas_anonimas;
create policy "autenticado altera qps_coletas_anonimas" on public.qps_coletas_anonimas
  for update to authenticated using (true) with check (true);

create table if not exists public.qps_respostas_anonimas (
  id uuid primary key default gen_random_uuid(),
  id_coleta text not null references public.qps_coletas_anonimas(id_coleta) on delete restrict,
  respostas jsonb not null,
  comentario text,
  data date not null default current_date
);
create index if not exists qps_respostas_anonimas_coleta_idx on public.qps_respostas_anonimas (id_coleta);

-- Sem policy de propósito: o cliente não lê nem grava (append-only via servidor).
alter table public.qps_respostas_anonimas enable row level security;
revoke all on public.qps_respostas_anonimas from anon, authenticated;

-- Resultado agregado por pergunta, só com k >= 5: % de Frequentemente/Sempre (4–5).
create or replace function public.qps_resultado_coleta(p_id_coleta text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_total int;
begin
  -- Só a equipe (usuário ativo, perfil diferente de Cliente).
  if not exists (
    select 1 from public.usuarios u
     where lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
       and u.ativo_sistema = true and u.perfil <> 'Cliente'
  ) then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  select count(*) into v_total from public.qps_respostas_anonimas where id_coleta = p_id_coleta;
  if v_total < 5 then
    return jsonb_build_object('total', v_total, 'suficiente', false);
  end if;
  return jsonb_build_object(
    'total', v_total,
    'suficiente', true,
    'perguntas', coalesce((
      select jsonb_agg(jsonb_build_object('id_pergunta', k, 'n', n, 'freq', freq))
        from (
          select e.key as k, count(*) as n,
                 count(*) filter (where (e.value)::text in ('4', '5')) as freq
            from public.qps_respostas_anonimas r, jsonb_each(r.respostas) e
           where r.id_coleta = p_id_coleta
           group by e.key
        ) x
    ), '[]'::jsonb)
  );
end $$;

-- Comentários livres: só para o técnico/RT e só com k >= 5 (nunca no laudo literal).
create or replace function public.qps_comentarios_coleta(p_id_coleta text)
returns text[] language plpgsql stable security definer set search_path = public as $$
declare
  v_total int;
begin
  -- Só a equipe (usuário ativo, perfil diferente de Cliente).
  if not exists (
    select 1 from public.usuarios u
     where lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
       and u.ativo_sistema = true and u.perfil <> 'Cliente'
  ) then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  select count(*) into v_total from public.qps_respostas_anonimas where id_coleta = p_id_coleta;
  if v_total < 5 then return array[]::text[]; end if;
  return coalesce((
    select array_agg(comentario order by random())
      from public.qps_respostas_anonimas
     where id_coleta = p_id_coleta and nullif(trim(comentario), '') is not null
  ), array[]::text[]);
end $$;

revoke all on function public.qps_resultado_coleta(text) from public, anon;
revoke all on function public.qps_comentarios_coleta(text) from public, anon;
grant execute on function public.qps_resultado_coleta(text) to authenticated;
grant execute on function public.qps_comentarios_coleta(text) to authenticated;
