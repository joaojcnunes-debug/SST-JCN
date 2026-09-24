-- v115 — Inventário: categoria explícita (Equipamentos/Máquinas/Medição) +
-- módulo de Transferências de equipamentos.
--
-- Additiva e idempotente: NÃO altera nada existente de forma destrutiva.
--   1) inventario_maquinas ganha a coluna `categoria_inventario` (nullable, com
--      default 'maquinas'). Backfill: patrimônio interno (sem empresa) => equipamentos;
--      máquina de cliente => maquinas; itens de medição detectados por palavra-chave.
--   2) nova tabela `transferencias` (histórico de movimentação de equipamentos),
--      com snapshot dos dados da máquina para o histórico/PDF ficar íntegro mesmo
--      que a máquina mude ou seja removida depois.
--
-- RLS segue o padrão do sistema: leitura para autenticados; escrita só
-- caller_pode_editar() (Visualizador continua read-only).

-- ── 1) categoria_inventario em inventario_maquinas ───────────────────────────
alter table public.inventario_maquinas
  add column if not exists categoria_inventario text;

alter table public.inventario_maquinas
  alter column categoria_inventario set default 'maquinas';

-- Backfill só das linhas ainda sem categoria (idempotente).
update public.inventario_maquinas
set categoria_inventario = case
  when coalesce(nome,'') || ' ' || coalesce(tipo,'') || ' ' || coalesce(categoria,'')
       ~* 'medi[çc][ãa]o|medi[çc][õo]es|medidor|calibra|lux[íi]metro|decibel|dos[íi]metro|term[oôó]metro|anem[oô]metro|balan[çc]a'
    then 'medicoes'
  when id_empresa is null then 'equipamentos'
  else 'maquinas'
end
where categoria_inventario is null;

-- CHECK idempotente (permite NULL; restringe os valores válidos).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'inventario_maquinas_categoria_inventario_chk'
  ) then
    alter table public.inventario_maquinas
      add constraint inventario_maquinas_categoria_inventario_chk
      check (categoria_inventario in ('equipamentos','maquinas','medicoes'));
  end if;
end $$;

create index if not exists idx_inventario_maquinas_categoria
  on public.inventario_maquinas (categoria_inventario, created_at desc);

-- ── 2) tabela transferencias ─────────────────────────────────────────────────
create table if not exists public.transferencias (
  id_transferencia          text primary key,
  -- Máquina de origem. on delete set null: o histórico sobrevive mesmo se a
  -- máquina for excluída (os campos de snapshot abaixo preservam a identificação).
  id_maquina                text references public.inventario_maquinas(id_maquina) on delete set null,

  -- Situação ANTES da transferência (origem)
  de_unidade                text,
  de_localizacao            text,
  de_responsavel            text,

  -- Situação DEPOIS (destino)
  para_unidade              text,
  para_localizacao          text,
  para_responsavel          text,

  motivo                    text,
  observacoes               text,

  -- Snapshot da máquina no momento da transferência (histórico íntegro / PDF)
  maquina_nome              text,
  maquina_tipo              text,
  maquina_categoria         text,
  maquina_codigo_interno    text,
  maquina_tag               text,
  maquina_marca             text,
  maquina_modelo            text,
  maquina_numero_serie      text,
  maquina_numero_patrimonio text,
  maquina_foto_url          text,

  -- Quem registrou a transferência (usuário logado) + quando
  responsavel_nome          text,
  responsavel_email         text,
  data_hora                 timestamptz not null default now(),
  created_at                timestamptz not null default now()
);

create index if not exists idx_transferencias_maquina
  on public.transferencias (id_maquina, data_hora desc);
create index if not exists idx_transferencias_data
  on public.transferencias (data_hora desc);

alter table public.transferencias enable row level security;

drop policy if exists "auth read transferencias" on public.transferencias;
create policy "auth read transferencias"
  on public.transferencias for select to authenticated using (true);

drop policy if exists "auth write transferencias" on public.transferencias;
create policy "auth write transferencias"
  on public.transferencias for all to authenticated
  using (public.caller_pode_editar())
  with check (public.caller_pode_editar());
