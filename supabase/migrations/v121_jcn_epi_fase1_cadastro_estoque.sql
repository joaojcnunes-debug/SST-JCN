-- v121 (JCN) — EPI Fase 1: cadastro (colaboradores, catálogo↔CA) + estoque (movimentações
-- APPEND-ONLY) + view de saldo. Aplicado via MCP supabase-sst. Idempotente/reversível.
-- RLS padrão Portal: equipe interna (Admin/Tecnico/Visualizador) vê tudo; cliente só a própria
-- empresa (get_minhas_empresas). Movimentações: SOMENTE select+insert = append-only.

create table if not exists public.epi_colaboradores (
  id          text primary key,
  empresa_id  text not null references public.empresas(id_empresa) on delete cascade,
  nome        text not null,
  cpf         text,
  matricula   text,
  cargo       text,
  setor       text,
  ativo       boolean not null default true,
  criado_por  text,
  criado_em   timestamptz not null default now(),
  updated_at  timestamptz
);
create index if not exists idx_epi_colab_empresa on public.epi_colaboradores (empresa_id);

create table if not exists public.epi_catalogo (
  id             text primary key,
  empresa_id     text not null references public.empresas(id_empresa) on delete cascade,
  nome           text not null,
  tipo           text not null default 'EPI',
  ca_numero      text,
  ca_validade    date,
  fabricante     text,
  descricao      text,
  unidade        text not null default 'un',
  estoque_minimo numeric not null default 0,
  foto_url       text,
  foto_path      text,
  ativo          boolean not null default true,
  criado_por     text,
  criado_em      timestamptz not null default now(),
  updated_at     timestamptz
);
create index if not exists idx_epi_catalogo_empresa on public.epi_catalogo (empresa_id);

create table if not exists public.epi_movimentacoes (
  id           text primary key,
  empresa_id   text not null references public.empresas(id_empresa) on delete cascade,
  id_catalogo  text not null references public.epi_catalogo(id) on delete cascade,
  tipo         text not null check (tipo in ('entrada','saida','ajuste')),
  quantidade   numeric not null check (quantidade > 0),
  origem       text not null default 'manual',
  ref_id       text,
  motivo       text,
  responsavel  text,
  criado_por   text,
  criado_em    timestamptz not null default now()
);
create index if not exists idx_epi_mov_empresa on public.epi_movimentacoes (empresa_id);
create index if not exists idx_epi_mov_catalogo on public.epi_movimentacoes (id_catalogo, criado_em);

drop view if exists public.v_epi_saldo;
create view public.v_epi_saldo with (security_invoker = true) as
  select c.id as id_catalogo, c.empresa_id,
    coalesce(sum(case when m.tipo = 'entrada' then m.quantidade
                      when m.tipo = 'saida'   then -m.quantidade
                      when m.tipo = 'ajuste'  then m.quantidade
                      else 0 end), 0) as saldo
  from public.epi_catalogo c
  left join public.epi_movimentacoes m on m.id_catalogo = c.id
  group by c.id, c.empresa_id;

alter table public.epi_colaboradores enable row level security;
alter table public.epi_catalogo      enable row level security;
alter table public.epi_movimentacoes enable row level security;

drop policy if exists epi_colab_sel on public.epi_colaboradores;
create policy epi_colab_sel on public.epi_colaboradores for select to authenticated
  using (public.get_meu_perfil() in ('Admin','Tecnico','Visualizador') or empresa_id = any(public.get_minhas_empresas()));
drop policy if exists epi_colab_ins on public.epi_colaboradores;
create policy epi_colab_ins on public.epi_colaboradores for insert to authenticated
  with check (public.get_meu_perfil() in ('Admin','Tecnico') or empresa_id = any(public.get_minhas_empresas()));
drop policy if exists epi_colab_upd on public.epi_colaboradores;
create policy epi_colab_upd on public.epi_colaboradores for update to authenticated
  using  (public.get_meu_perfil() in ('Admin','Tecnico') or empresa_id = any(public.get_minhas_empresas()))
  with check (public.get_meu_perfil() in ('Admin','Tecnico') or empresa_id = any(public.get_minhas_empresas()));
drop policy if exists epi_colab_del on public.epi_colaboradores;
create policy epi_colab_del on public.epi_colaboradores for delete to authenticated
  using (public.get_meu_perfil() = 'Admin' or empresa_id = any(public.get_minhas_empresas()));

drop policy if exists epi_cat_sel on public.epi_catalogo;
create policy epi_cat_sel on public.epi_catalogo for select to authenticated
  using (public.get_meu_perfil() in ('Admin','Tecnico','Visualizador') or empresa_id = any(public.get_minhas_empresas()));
drop policy if exists epi_cat_ins on public.epi_catalogo;
create policy epi_cat_ins on public.epi_catalogo for insert to authenticated
  with check (public.get_meu_perfil() in ('Admin','Tecnico') or empresa_id = any(public.get_minhas_empresas()));
drop policy if exists epi_cat_upd on public.epi_catalogo;
create policy epi_cat_upd on public.epi_catalogo for update to authenticated
  using  (public.get_meu_perfil() in ('Admin','Tecnico') or empresa_id = any(public.get_minhas_empresas()))
  with check (public.get_meu_perfil() in ('Admin','Tecnico') or empresa_id = any(public.get_minhas_empresas()));
drop policy if exists epi_cat_del on public.epi_catalogo;
create policy epi_cat_del on public.epi_catalogo for delete to authenticated
  using (public.get_meu_perfil() = 'Admin' or empresa_id = any(public.get_minhas_empresas()));

drop policy if exists epi_mov_sel on public.epi_movimentacoes;
create policy epi_mov_sel on public.epi_movimentacoes for select to authenticated
  using (public.get_meu_perfil() in ('Admin','Tecnico','Visualizador') or empresa_id = any(public.get_minhas_empresas()));
drop policy if exists epi_mov_ins on public.epi_movimentacoes;
create policy epi_mov_ins on public.epi_movimentacoes for insert to authenticated
  with check (public.get_meu_perfil() in ('Admin','Tecnico') or empresa_id = any(public.get_minhas_empresas()));
