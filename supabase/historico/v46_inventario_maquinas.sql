-- V46 — Módulo Inventário de Máquinas e Equipamentos (MVP)
--
-- Cadastro leve de máquinas/equipamentos. O caso de uso primário é o
-- patrimônio interno da Chabra (id_empresa NULL); mas o modelo já suporta
-- vincular a uma empresa cliente (id_empresa preenchido) pra quando o
-- inventário virar serviço prestado.
--
-- MVP minimalista: identificação + localização + status + foto opcional.
-- Histórico de manutenção, agenda preventiva, integração com Apreciação
-- NR-12 ficam pra versões posteriores.

create table if not exists public.inventario_maquinas (
  id_maquina         text primary key,
  id_empresa         text references public.empresas(id_empresa) on delete cascade,

  -- Identificação
  nome               text not null,        -- "Furadeira de bancada", "Empilhadeira #2"
  marca              text,
  modelo             text,
  numero_serie       text,
  ano_fabricacao     integer,
  numero_patrimonio  text,                 -- código interno (opcional)

  -- Localização e estado
  localizacao        text,                 -- texto livre: "Galpão A", "Sala 3"
  status             text not null default 'OPERANTE'
                       check (status in ('OPERANTE', 'MANUTENCAO', 'INATIVA', 'BAIXADA')),
  observacoes        text,

  -- Foto principal (bucket `fotos`, path `inventario-maquinas/{id_maquina}.{ext}`)
  foto_url           text,
  foto_storage_path  text,

  -- Auditoria
  usuario_email      text,
  usuario_nome       text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz
);

create index if not exists idx_inventario_maquinas_empresa
  on public.inventario_maquinas (id_empresa, created_at desc);

create index if not exists idx_inventario_maquinas_status
  on public.inventario_maquinas (status, created_at desc);

create index if not exists idx_inventario_maquinas_created
  on public.inventario_maquinas (created_at desc);

alter table public.inventario_maquinas enable row level security;

drop policy if exists "auth read inventario_maquinas"
  on public.inventario_maquinas;
create policy "auth read inventario_maquinas"
  on public.inventario_maquinas for select to authenticated using (true);

drop policy if exists "auth write inventario_maquinas"
  on public.inventario_maquinas;
create policy "auth write inventario_maquinas"
  on public.inventario_maquinas for all to authenticated
  using (true) with check (true);
