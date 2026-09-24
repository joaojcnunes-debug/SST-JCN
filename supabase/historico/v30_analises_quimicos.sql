-- V30 — Módulo "Análise de Químicos Chabra"
--
-- Cada análise de um produto químico (FDS/FISPQ ou entrada manual) processada
-- pela IA é persistida aqui pra consulta histórica e impressão posterior.
-- Análise pode opcionalmente ser vinculada a uma empresa específica.

create table if not exists public.analises_quimicos (
  id_analise        text primary key,
  id_empresa        text references public.empresas(id_empresa) on delete set null,

  -- Identificação do produto analisado
  titulo            text not null,
  nome_quimico      text,
  numero_cas        text,
  formula_quimica   text,
  forma_fisica      text,
  concentracao     text,

  -- Modo de entrada
  modo              text not null check (modo in ('PDF', 'Manual')),
  fonte_arquivo     text,
  texto_extraido    text,

  -- Condições de uso (opcional)
  condicoes_uso     jsonb,

  -- Saída da IA
  resultado_texto   text not null,
  conclusao_rapida  jsonb,

  -- Auditoria
  usuario_email     text,
  usuario_nome      text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz
);

create index if not exists idx_analises_quimicos_empresa
  on public.analises_quimicos (id_empresa, created_at desc);

create index if not exists idx_analises_quimicos_created
  on public.analises_quimicos (created_at desc);

create index if not exists idx_analises_quimicos_titulo
  on public.analises_quimicos (titulo);

alter table public.analises_quimicos enable row level security;

drop policy if exists "auth read analises_quimicos" on public.analises_quimicos;
create policy "auth read analises_quimicos"
  on public.analises_quimicos for select to authenticated using (true);

drop policy if exists "auth write analises_quimicos" on public.analises_quimicos;
create policy "auth write analises_quimicos"
  on public.analises_quimicos for all to authenticated using (true) with check (true);
