-- ============================================================
-- V7: Triagem de Risco (banco de perguntas condicionantes)
-- ============================================================
-- Cada tipo de risco pode ter perguntas de triagem que aparecem
-- ANTES do agente no RiscoForm. Cada pergunta tem opções multi-
-- selecionáveis; cada opção pode (opcionalmente) estar vinculada
-- a um modelo do tipo. No save:
--   - 0 opções marcadas → comportamento atual (1 risco)
--   - 1 opção           → autofill do modelo da opção
--   - 2+ opções         → replica em N riscos (1 por opção)
--
-- Perguntas e opções são gerenciadas pelo Admin no Catálogo.
-- Idempotente.
-- ============================================================

-- 1) TRIAGENS_TIPO -----------------------------------------------
create table if not exists public.triagens_tipo (
  id_triagem    text primary key,
  id_tipo       text not null references public.tipos_risco(id_tipo) on delete cascade,
  texto         text not null,
  ordem         int  not null default 0,
  ativo         boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz
);

create index if not exists idx_triagens_tipo
  on public.triagens_tipo (id_tipo, ordem);

alter table public.triagens_tipo enable row level security;

drop policy if exists "auth read triagens_tipo" on public.triagens_tipo;
create policy "auth read triagens_tipo"
  on public.triagens_tipo for select
  to authenticated using (true);

drop policy if exists "auth write triagens_tipo" on public.triagens_tipo;
create policy "auth write triagens_tipo"
  on public.triagens_tipo for all
  to authenticated using (true) with check (true);


-- 2) TRIAGENS_OPCAO ----------------------------------------------
create table if not exists public.triagens_opcao (
  id_opcao      text primary key,
  id_triagem    text not null references public.triagens_tipo(id_triagem) on delete cascade,
  texto         text not null,
  -- FK opcional pra modelo: quando setado, marcar essa opção
  -- preenche o form com os dados desse modelo.
  id_modelo     text references public.modelos_risco(id_modelo) on delete set null,
  ordem         int  not null default 0,
  ativo         boolean not null default true,
  created_at    timestamptz not null default now()
);

create index if not exists idx_triagens_opcao_triagem
  on public.triagens_opcao (id_triagem, ordem);

alter table public.triagens_opcao enable row level security;

drop policy if exists "auth read triagens_opcao" on public.triagens_opcao;
create policy "auth read triagens_opcao"
  on public.triagens_opcao for select
  to authenticated using (true);

drop policy if exists "auth write triagens_opcao" on public.triagens_opcao;
create policy "auth write triagens_opcao"
  on public.triagens_opcao for all
  to authenticated using (true) with check (true);
