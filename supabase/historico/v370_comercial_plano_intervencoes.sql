-- v370 — Plano de intervenções da conciliação: métodos por modalidade e planejamento (26/11/2026, 0.3.321).
--
-- POR QUÊ: pedido do João — a etapa Intervenções vira um plano com: setores envolvidos, riscos identificados, temas
-- sugeridos, método por tema (EAD, online ou presencial), descrição dos métodos (forma de realização, duração,
-- avaliação de aprendizado e certificado, conforme a modalidade) e o planejamento das ações (um tema por mês, ou o EAD
-- o período todo com ações online e presenciais todo mês). Decisão dele: o texto padrão de cada método fica no
-- catálogo, por modalidade, e cada empresa pode ajustar o seu.
--
-- O QUE CRIA
--   comercial_metodos(modalidade pk, forma, duracao, avaliacao, certificado, ordem) — o texto padrão por modalidade
--     (já com EAD, Ao vivo = online, e Presencial). Editado no Catálogo de intervenções.
--   comercial_planos(id_alvo pk, tipo_alvo empresa|grupo, planejamento tema_por_mes|ead_continuo, inicio, meses,
--     temas jsonb {tema: mês 1..n}, metodos jsonb {modalidade: {forma, duracao, avaliacao, certificado}} = ajustes).
--   Acesso: o mesmo do catálogo de intervenções (comercial_pode_liberar()).
--
-- REAPLICAR: idempotente. ROLLBACK: scripts/sql/v370_comercial_plano_intervencoes_rollback.sql
begin;

create table if not exists public.comercial_metodos (
  modalidade text primary key,
  forma text,
  duracao text,
  avaliacao text,
  certificado text,
  ordem integer not null default 0,
  atualizado_em timestamptz not null default now(),
  atualizado_por text
);

create table if not exists public.comercial_planos (
  id_alvo text primary key,
  tipo_alvo text not null check (tipo_alvo in ('empresa', 'grupo')),
  planejamento text not null default 'tema_por_mes' check (planejamento in ('tema_por_mes', 'ead_continuo')),
  inicio date,
  meses integer check (meses is null or meses between 1 and 36),
  temas jsonb not null default '{}'::jsonb,
  metodos jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now(),
  atualizado_por text
);

alter table public.comercial_metodos enable row level security;
alter table public.comercial_planos enable row level security;
grant select, insert, update, delete on public.comercial_metodos, public.comercial_planos to authenticated;

drop policy if exists comercial_metodos_leitura on public.comercial_metodos;
create policy comercial_metodos_leitura on public.comercial_metodos for select to authenticated using (public.comercial_pode_liberar());
drop policy if exists comercial_metodos_escrita on public.comercial_metodos;
create policy comercial_metodos_escrita on public.comercial_metodos for all to authenticated
  using (public.comercial_pode_liberar()) with check (public.comercial_pode_liberar());
drop policy if exists comercial_planos_leitura on public.comercial_planos;
create policy comercial_planos_leitura on public.comercial_planos for select to authenticated using (public.comercial_pode_liberar());
drop policy if exists comercial_planos_escrita on public.comercial_planos;
create policy comercial_planos_escrita on public.comercial_planos for all to authenticated
  using (public.comercial_pode_liberar()) with check (public.comercial_pode_liberar());

insert into public.comercial_metodos (modalidade, forma, duracao, avaliacao, certificado, ordem) values
  ('EAD',
   'Curso gravado na plataforma, feito no ritmo de cada trabalhador, com material de apoio para baixar.',
   'Carga horária indicada em cada tema; acesso liberado durante todo o período do plano.',
   'Questionário ao fim de cada módulo, com nota mínima para concluir.',
   'Certificado emitido automaticamente ao concluir o curso com aproveitamento.', 1),
  ('Ao vivo',
   'Encontro online ao vivo (videoconferência), com o facilitador e espaço para perguntas.',
   '1 a 2 horas por encontro.',
   'Lista de presença e atividade ou questionário ao final do encontro.',
   'Certificado de participação para quem esteve presente.', 2),
  ('Presencial',
   'Encontro presencial na empresa, com dinâmicas em grupo conduzidas pelo facilitador.',
   '1 a 4 horas por encontro.',
   'Lista de presença assinada e avaliação de aprendizado ao final.',
   'Certificado de participação emitido após o encontro.', 3)
on conflict (modalidade) do nothing;

commit;
