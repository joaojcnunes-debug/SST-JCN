-- V132 — Apreciação de Máquinas NR-12: evolução para MÚLTIPLAS máquinas por laudo.
--
-- Fase 1 (Regra Zero) — só estrutura/seed/backfill, sem código de app.
--   1) apreciacao_fichas_maquina  — N fichas de máquina por apreciação (o laudo vira "capa").
--   2) apreciacao_perigos_catalogo — catálogo de perigos reutilizável (pré-preenche a linha HRN).
--   3) id_ficha em apreciacao_riscos_hrn e apreciacoes_maquinas_itens (mantém id_apreciacao
--      denormalizado → o RLS atual das filhas continua válido, sem reescrever policy).
--   4) risco RESIDUAL na linha HRN (reduz prioritariamente o POD).
--   5) BACKFILL: 1 ficha por apreciação existente (N=1 vira o caso trivial) + repontar filhas.
--
-- Aditiva e reversível (ver ROLLBACK no fim). Aplicada via MCP no banco JCN.
-- RLS = isolamento por empresa (caller_pode_editar / caller_pode_ver_empresa); as filhas
-- joinam até a empresa via a apreciação-pai, igual a apreciacao_riscos_hrn (v105/v106).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) FICHA DE MÁQUINA (filha da apreciação)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.apreciacao_fichas_maquina (
  id_ficha              text primary key,
  id_apreciacao         text not null references public.apreciacoes_maquinas(id_apreciacao) on delete cascade,
  numero_ordem          integer not null default 1,

  -- Vínculo híbrido com o inventário
  id_maquina            text references public.inventario_maquinas(id_maquina) on delete set null,
  maquina_descricao     text,

  -- Identificação da máquina (snapshot)
  equipamento           text,
  tipo                  text,
  modelo                text,
  fabricante            text,
  serie                 text,
  ano                   text,
  capacidade            text,
  setor                 text,

  -- Identificação ABNT ISO/TR 14121-2 (por máquina)
  componentes_maquina   text[],
  limite_uso            text,
  limite_espaco         text,
  limite_tempo          text,
  limite_produtividade  text,
  npe                   text,
  sistemas_atual        text[],
  sistemas_necessario   text[],

  -- Avaliação da ficha
  constatacoes_inspecao text,
  parecer_tecnico       text,
  prioridade_manual     boolean not null default false,

  -- Fotos da máquina (bucket `fotos`, path apreciacao-maquinas/{id_apreciacao}/{id_ficha}-...)
  foto_urls             text[] not null default array[]::text[],
  foto_storage_paths    text[] not null default array[]::text[],

  created_at            timestamptz not null default now(),
  updated_at            timestamptz
);

create index if not exists idx_apreciacao_fichas_apreciacao
  on public.apreciacao_fichas_maquina (id_apreciacao, numero_ordem);
create index if not exists idx_apreciacao_fichas_maquina
  on public.apreciacao_fichas_maquina (id_maquina) where id_maquina is not null;

alter table public.apreciacao_fichas_maquina enable row level security;

drop policy if exists apreciacao_fichas_sel on public.apreciacao_fichas_maquina;
create policy apreciacao_fichas_sel on public.apreciacao_fichas_maquina
  for select to authenticated
  using (exists (select 1 from public.apreciacoes_maquinas par
                 where par.id_apreciacao = apreciacao_fichas_maquina.id_apreciacao
                   and public.caller_pode_ver_empresa(par.id_empresa)));

drop policy if exists apreciacao_fichas_rw on public.apreciacao_fichas_maquina;
create policy apreciacao_fichas_rw on public.apreciacao_fichas_maquina
  for all to authenticated
  using (public.caller_pode_editar() and exists (select 1 from public.apreciacoes_maquinas par
                 where par.id_apreciacao = apreciacao_fichas_maquina.id_apreciacao
                   and public.caller_pode_ver_empresa(par.id_empresa)))
  with check (public.caller_pode_editar() and exists (select 1 from public.apreciacoes_maquinas par
                 where par.id_apreciacao = apreciacao_fichas_maquina.id_apreciacao
                   and public.caller_pode_ver_empresa(par.id_empresa)));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) CATÁLOGO DE PERIGOS reutilizável (referência global, não escopado por empresa)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.apreciacao_perigos_catalogo (
  id                    text primary key,
  nome                  text not null,
  origem_consequencias  text,
  itens_nr12            text[] not null default array[]::text[],
  medidas_eng           text,
  medidas_adm           text,
  pod_default           text,
  fep_default           text,
  gpd_default           text,
  pod_residual_default  text,
  fep_residual_default  text,
  gpd_residual_default  text,
  ordem                 integer not null default 0,
  ativo                 boolean not null default true,
  created_at            timestamptz not null default now()
);

alter table public.apreciacao_perigos_catalogo enable row level security;

drop policy if exists apreciacao_perigos_catalogo_sel on public.apreciacao_perigos_catalogo;
create policy apreciacao_perigos_catalogo_sel on public.apreciacao_perigos_catalogo
  for select to authenticated using (true);

drop policy if exists apreciacao_perigos_catalogo_rw on public.apreciacao_perigos_catalogo;
create policy apreciacao_perigos_catalogo_rw on public.apreciacao_perigos_catalogo
  for all to authenticated
  using (public.caller_pode_editar()) with check (public.caller_pode_editar());

-- Seed dos perigos recorrentes (valores POD/FEP/GPD = enums já usados no HRN).
-- São defaults editáveis: o técnico ajusta ao instanciar na ficha.
insert into public.apreciacao_perigos_catalogo
  (id, nome, origem_consequencias, itens_nr12, medidas_eng, medidas_adm,
   pod_default, fep_default, gpd_default, pod_residual_default, fep_residual_default, gpd_residual_default, ordem)
values
  ('PCAT-CHOQUE', 'Choque elétrico', 'Contato com partes energizadas / falha de aterramento',
   array['12.14','12.15','12.16','12.17','12.18','12.19','12.20','12.21','12.22','12.23'],
   'Aterramento, proteção contra contatos diretos/indiretos, grau IP adequado, seccionamento com bloqueio.',
   'Procedimento de bloqueio e etiquetagem (LOTO); capacitação NR-10.',
   'PROVAVEL','SEMANALMENTE','CATASTROFICA','REMOTA','SEMANALMENTE','CATASTROFICA', 10),
  ('PCAT-PERFURO', 'Agentes perfurocortantes', 'Contato com arestas/pontas e ferramentas de corte',
   array['12.38','12.39','12.40','12.41','12.42','12.43','12.44','12.45','12.46','12.47','12.48','12.49','12.50','12.51','12.52','12.53','12.54','12.55'],
   'Proteções fixas/móveis intertravadas nas zonas de perigo.',
   'Procedimento de operação segura; EPI (luvas anticorte).',
   'PROVAVEL','DIARIAMENTE','GRAVE','REMOTA','DIARIAMENTE','GRAVE', 20),
  ('PCAT-INERCIA', 'Movimento por inércia', 'Parada não imediata de partes móveis após desligamento',
   array['12.56','12.57','12.58','12.59','12.60','12.61','12.62','12.63'],
   'Freio dinâmico; parada de emergência; tempo de parada compatível com o acesso.',
   'Sinalização; acesso somente após parada total.',
   'PROVAVEL','SEMANALMENTE','GRAVE','REMOTA','SEMANALMENTE','GRAVE', 30),
  ('PCAT-APRISIONA', 'Aprisionamento de membros', 'Zonas de convergência/entrada de material',
   array['12.38','12.46'],
   'Proteções intertravadas; distâncias de segurança (ISO 13857).',
   'Procedimento; capacitação; EPI.',
   'PROVAVEL','DIARIAMENTE','GRAVE','REMOTA','DIARIAMENTE','GRAVE', 40),
  ('PCAT-CORTE', 'Agentes cortantes / lâmina rotativa', 'Lâminas e facas em rotação',
   array['12.38','12.46'],
   'Enclausuramento da lâmina; intertravamento; anteparo.',
   'Procedimento de troca de lâmina com bloqueio; EPI.',
   'PROVAVEL','DIARIAMENTE','CATASTROFICA','REMOTA','DIARIAMENTE','CATASTROFICA', 50),
  ('PCAT-PRENSAGEM', 'Prensagem / selagem', 'Fechamento de matrizes/mordentes de selagem',
   array['12.38'],
   'Comando bimanual; cortina de luz; proteção móvel intertravada.',
   'Procedimento; capacitação.',
   'PROVAVEL','DIARIAMENTE','GRAVE','REMOTA','DIARIAMENTE','GRAVE', 60),
  ('PCAT-QUEIMA', 'Queimaduras (superfícies quentes)', 'Contato com superfícies aquecidas',
   array['12.24','12.119'],
   'Isolamento térmico; anteparos; sinalização de superfície quente.',
   'Procedimento; EPI (luvas térmicas).',
   'IMPROVAVEL','SEMANALMENTE','MODERADA','REMOTA','SEMANALMENTE','MODERADA', 70),
  ('PCAT-OLEO', 'Queimadura por óleo quente', 'Respingos/vazamento de óleo aquecido',
   array['12.24','12.119'],
   'Contenção; anteparos; proteção contra respingos.',
   'Procedimento; EPI.',
   'IMPROVAVEL','SEMANALMENTE','GRAVE','REMOTA','SEMANALMENTE','GRAVE', 80),
  ('PCAT-GLP', 'Incêndio/explosão (GLP)', 'Vazamento de gás combustível / fonte de ignição',
   array['12.132'],
   'Detecção de gás; ventilação; válvula de bloqueio; SPDA.',
   'NR-20; procedimento de emergência; brigada.',
   'IMPROVAVEL','MENSALMENTE','CATASTROFICA','REMOTA','MENSALMENTE','CATASTROFICA', 90),
  ('PCAT-FRIO', 'Baixas temperaturas / partes móveis (refrigeração)', 'Contato com partes frias/móveis em câmaras',
   array['12.38'],
   'Proteções intertravadas; sinalização; isolamento.',
   'Procedimento; EPI (isolamento térmico).',
   'IMPROVAVEL','SEMANALMENTE','MODERADA','REMOTA','SEMANALMENTE','MODERADA', 100),
  ('PCAT-CARGA', 'Queda/esmagamento por carga (elevador)', 'Movimentação vertical de carga',
   array['12.38'],
   'Dispositivo contra queda; batentes; intertravamento de portas.',
   'Procedimento; inspeção periódica; capacitação.',
   'IMPROVAVEL','SEMANALMENTE','CATASTROFICA','REMOTA','SEMANALMENTE','CATASTROFICA', 110),
  ('PCAT-PARTICULA', 'Projeção de partículas', 'Fragmentos projetados durante a operação',
   array['12.46'],
   'Anteparos/enclausuramento; proteção contra projeção.',
   'Procedimento; EPI (óculos/protetor facial).',
   'PROVAVEL','DIARIAMENTE','MODERADA','REMOTA','DIARIAMENTE','MODERADA', 120)
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) id_ficha nas filhas (mantém id_apreciacao denormalizado → RLS atual intacto)
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.apreciacao_riscos_hrn
  add column if not exists id_ficha text
  references public.apreciacao_fichas_maquina(id_ficha) on delete cascade;
create index if not exists idx_apreciacao_riscos_hrn_ficha
  on public.apreciacao_riscos_hrn (id_ficha);

alter table public.apreciacoes_maquinas_itens
  add column if not exists id_ficha text
  references public.apreciacao_fichas_maquina(id_ficha) on delete cascade;
create index if not exists idx_apreciacoes_maquinas_itens_ficha
  on public.apreciacoes_maquinas_itens (id_ficha);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) Risco RESIDUAL na linha HRN (reduz prioritariamente o POD)
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.apreciacao_riscos_hrn add column if not exists pod_residual text;
alter table public.apreciacao_riscos_hrn add column if not exists fep_residual text;
alter table public.apreciacao_riscos_hrn add column if not exists gpd_residual text;
alter table public.apreciacao_riscos_hrn add column if not exists classificacao_residual text;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) BACKFILL reversível: 1 ficha por apreciação + repontar filhas para essa ficha
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.apreciacao_fichas_maquina
  (id_ficha, id_apreciacao, numero_ordem, id_maquina, maquina_descricao, setor,
   componentes_maquina, limite_uso, limite_espaco, limite_tempo, limite_produtividade,
   npe, sistemas_atual, sistemas_necessario, created_at)
select
  'APF-' || upper(substr(md5(a.id_apreciacao), 1, 8)),
  a.id_apreciacao, 1, a.id_maquina, a.maquina_descricao, a.setor,
  a.componentes_maquina, a.limite_uso, a.limite_espaco, a.limite_tempo, a.limite_produtividade,
  a.npe, a.sistemas_atual, a.sistemas_necessario, now()
from public.apreciacoes_maquinas a
where not exists (
  select 1 from public.apreciacao_fichas_maquina f where f.id_apreciacao = a.id_apreciacao
);

update public.apreciacao_riscos_hrn r
set id_ficha = f.id_ficha
from public.apreciacao_fichas_maquina f
where f.id_apreciacao = r.id_apreciacao and r.id_ficha is null;

update public.apreciacoes_maquinas_itens it
set id_ficha = f.id_ficha
from public.apreciacao_fichas_maquina f
where f.id_apreciacao = it.id_apreciacao and it.id_ficha is null;

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK (referência — não executar):
--   drop table if exists public.apreciacao_perigos_catalogo;
--   alter table public.apreciacao_riscos_hrn
--     drop column if exists id_ficha, drop column if exists pod_residual,
--     drop column if exists fep_residual, drop column if exists gpd_residual,
--     drop column if exists classificacao_residual;
--   alter table public.apreciacoes_maquinas_itens drop column if exists id_ficha;
--   drop table if exists public.apreciacao_fichas_maquina;
-- (os dados originais permanecem em apreciacoes_maquinas / filhas via id_apreciacao)
-- ─────────────────────────────────────────────────────────────────────────────
