-- V19 — Configurações do DRPS por empresa
--
-- Metadados do diagnóstico (responsável técnico, CRP, data de elaboração,
-- contagem de trabalhadores etc) que aparecem no relatório formal DRPS
-- mas não fazem parte do cadastro geral da empresa.

create table if not exists public.drps_empresa_config (
  id_empresa              text primary key references public.empresas(id_empresa) on delete cascade,
  responsavel_tecnico     text,
  crp                     text,
  data_elaboracao         date,
  funcoes                 text,
  qtd_trabalhadores       integer,
  qtd_homens              integer,
  qtd_mulheres            integer,
  agravos_saude_mental    text,
  medidas_existentes      text,
  updated_at              timestamptz not null default now()
);

alter table public.drps_empresa_config enable row level security;

drop policy if exists "auth read drps_empresa_config" on public.drps_empresa_config;
create policy "auth read drps_empresa_config"
  on public.drps_empresa_config for select to authenticated using (true);

drop policy if exists "auth write drps_empresa_config" on public.drps_empresa_config;
create policy "auth write drps_empresa_config"
  on public.drps_empresa_config for all to authenticated using (true) with check (true);
