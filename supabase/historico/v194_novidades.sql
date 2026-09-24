-- v194 — Novidades: avisos avulsos e o marcador de "ja vi".
--
-- NAO APLICADA. Escrita em 01/09/2026 na worktree painel-sst-novidades e deixada
-- pronta a pedido do Sanmyo, que ainda nao quer nada no ar.
--
-- NASCEU COMO v191 E FOI RENUMERADA. Tres frentes pegaram numero no mesmo dia,
-- em terminais diferentes: Quimicos levou o v191, Equipamentos (que tambem
-- tinha nascido v191) virou v192, e a Escala levou o v193. CONFIRA DE NOVO
-- antes de aplicar -- este arquivo passou dias parado enquanto outras frentes
-- avancavam:
--   ssh chabra-107 "docker exec db-messages-postgres psql -U chabra_admin -d painel_sst -At -c 'select version from schema_migrations order by 1 desc limit 5'"
--
-- O DESENHO, decidido em 01/09:
--
--   O texto das novidades de versao NAO mora aqui. Mora em lib/novidades/
--   catalogo.ts, no codigo, e sobe junto com a mudanca que descreve. Isso torna
--   impossivel anunciar o que nao subiu e subir o que nao foi anunciado.
--
--   O banco fica com duas coisas que o codigo nao resolve:
--     1) AVISOS AVULSOS -- o que nao e versao e nao pode esperar deploy:
--        "sistema fora do ar sabado de manha", "a base mudou de endereco".
--     2) O MARCADOR de ja-vi, que e por pessoa e precisa seguir ela.
--
-- POR QUE NAO localStorage PARA O MARCADOR: sao 55 contas, muita maquina
-- compartilhada em campo, e a mesma pessoa abre o painel no Electron, no PWA e
-- no APK. Com localStorage ela levaria o mesmo modal tres vezes, e a maquina
-- compartilhada marcaria como lido para o colega seguinte.
--
-- POR QUE UMA LINHA POR PESSOA, E NAO UMA POR NOVIDADE LIDA: 55 x N linhas para
-- responder "tem coisa nova?" e desproporcional. Uma linha por pessoa, com a
-- lista de ids ja vistos dentro, responde a mesma pergunta.
--
-- E POR QUE ids_vistos E NAO SO UMA DATA: marca d'agua por data nao distingue
-- duas novidades publicadas NO MESMO DIA -- e sobem varias versoes por dia
-- aqui (cinco em 01/09). A pessoa fecharia o modal da primeira e a segunda
-- nasceria ja marcada como lida. Com id a conta e exata. visto_ate fica junto,
-- mas so para saber desde quando ela acompanha e para podar a lista depois.
--
-- Idempotente. Rollback em scripts/sql/v194_rollback_novidades.sql
-- (fora de supabase/migrations/ porque o migrate.ps1 varre esta pasta).
-- begin;...commit; PROPRIO -- NAO aplicar com psql -1.

begin;

-- ── (0) Guardas: falha fechada em vez de aplicar as cegas (padrao v186/v190) ──
do $$
begin
  if to_regprocedure('public.caller_pode_editar()') is null then
    raise exception 'v194: caller_pode_editar() ausente -- a escrita dos avisos dependeria dela; abortado';
  end if;
end $$;

-- ── (1) Avisos avulsos ───────────────────────────────────────────────────────
-- Mesma forma do catalogo em codigo (lib/novidades/tipos.ts), para que a tela
-- ache os dois achatados na mesma lista sem traduzir campo.
--
-- `ativo` em vez de delete: aviso de parada programada perde a validade mas o
-- registro de que ele foi dado tem valor. Desligar e reversivel; apagar nao.
create table if not exists public.novidades_avisos (
  id_aviso   text primary key
    default 'AVS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  data       date not null default current_date,
  tipo       text not null default 'novidade'
    check (tipo in ('novidade', 'melhoria', 'correcao', 'atencao')),
  titulo     text not null check (length(trim(titulo)) > 0),
  texto      text not null check (length(trim(texto)) > 0),
  onde       text,
  impacto    text,
  destaque   boolean not null default false,
  ativo      boolean not null default true,
  criado_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A tela sempre pede "ativos, do mais novo para o mais velho".
create index if not exists idx_novidades_avisos_ativo
  on public.novidades_avisos (ativo, data desc, created_at desc);

-- ── (2) O marcador de ja-vi ──────────────────────────────────────────────────
-- E-mail como chave, e nao id_usuario: e o que gestao_notificacoes (v94),
-- gestao_membros (v116) e escala_supervisores (v190) ja usam para ligar gente.
-- Guardado em lower() por constraint, porque o login do painel nao e sensivel a
-- caixa e "Sanmyo@" e "sanmyo@" viveriam como duas pessoas.
create table if not exists public.novidades_vistas (
  usuario_email text primary key check (usuario_email = lower(usuario_email)),
  -- Os ids de lib/novidades/catalogo.ts e de novidades_avisos que ela ja viu.
  -- Sem FK: metade dos ids vive no codigo e o banco nao tem como conferir.
  ids_vistos    text[] not null default '{}',
  visto_ate     timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── (3) GRANTs ───────────────────────────────────────────────────────────────
-- SEM ISTO A RLS NEM CHEGA A SER CONSULTADA: o Postgres barra antes, com
-- "permission denied for table". Em producao as DEFAULT PRIVILEGES de
-- chabra_admin ja concedem authenticated=arwd a toda tabela nova (e por isso
-- que escala_dias tem os grants sem a v190 pedir) -- mas depender disso em
-- silencio quebra no dia em que a migration for aplicada por outro usuario,
-- ou num banco restaurado sem as ACLs. Duas linhas explicitas resolvem.
--
-- Nao se concede DELETE em novidades_vistas de proposito: nao ha policy de
-- delete, e apagar a linha de alguem faria o modal inteiro reaparecer para
-- essa pessoa. Quem manda continua sendo a RLS logo abaixo.
grant select, insert, update, delete on table public.novidades_avisos to authenticated;
grant select, insert, update         on table public.novidades_vistas to authenticated;

-- ── (4) RLS ──────────────────────────────────────────────────────────────────
alter table public.novidades_avisos  enable row level security;
alter table public.novidades_vistas  enable row level security;

-- Avisos: todo mundo autenticado LE (decisao do Sanmyo -- sem filtro por modulo,
-- todo mundo ve tudo). Escreve quem ja pode editar no painel.
drop policy if exists novidades_avisos_sel on public.novidades_avisos;
create policy novidades_avisos_sel on public.novidades_avisos
  for select to authenticated using (true);

drop policy if exists novidades_avisos_wr on public.novidades_avisos;
create policy novidades_avisos_wr on public.novidades_avisos
  for all to authenticated
  using (public.caller_pode_editar())
  with check (public.caller_pode_editar());

-- Marcador: cada um so enxerga e so mexe na PROPRIA linha. Sem policy de
-- delete de proposito -- apagar a linha de alguem faria o modal inteiro
-- reaparecer para essa pessoa, e nao existe motivo legitimo para isso.
drop policy if exists novidades_vistas_sel on public.novidades_vistas;
create policy novidades_vistas_sel on public.novidades_vistas
  for select to authenticated
  using (usuario_email = lower(auth.jwt() ->> 'email'));

drop policy if exists novidades_vistas_ins on public.novidades_vistas;
create policy novidades_vistas_ins on public.novidades_vistas
  for insert to authenticated
  with check (usuario_email = lower(auth.jwt() ->> 'email'));

drop policy if exists novidades_vistas_upd on public.novidades_vistas;
create policy novidades_vistas_upd on public.novidades_vistas
  for update to authenticated
  using (usuario_email = lower(auth.jwt() ->> 'email'))
  with check (usuario_email = lower(auth.jwt() ->> 'email'));

-- ── (5) updated_at ───────────────────────────────────────────────────────────
create or replace function public.novidades_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_novidades_avisos_touch on public.novidades_avisos;
create trigger trg_novidades_avisos_touch
  before update on public.novidades_avisos
  for each row execute function public.novidades_touch_updated_at();

drop trigger if exists trg_novidades_vistas_touch on public.novidades_vistas;
create trigger trg_novidades_vistas_touch
  before update on public.novidades_vistas
  for each row execute function public.novidades_touch_updated_at();

commit;
