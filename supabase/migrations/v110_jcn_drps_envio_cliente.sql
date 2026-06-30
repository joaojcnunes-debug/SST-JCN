-- v110 (JCN 2026-06-30) — status ENVIADO_CLIENTE: carimbo de data + CHECK do status.
-- Aplicado via MCP supabase-sst.

-- 1) Coluna de carimbo (análoga a data_conclusao).
alter table public.drps_relatorios
  add column if not exists data_envio_cliente timestamptz;

comment on column public.drps_relatorios.data_envio_cliente
  is 'Carimbo automático (TIMESTAMPTZ) do momento em que o relatório passou para ENVIADO_CLIENTE. Disponível como {{data_envio_cliente}} nos textos padrão do PDF.';

-- 2) Trigger que carimba ao ENTRAR em ENVIADO_CLIENTE (qualquer caminho:
--    drag no dashboard ou select na página do relatório). Preserva o
--    carimbo anterior em re-entradas (mesma semântica de data_conclusao).
create or replace function public.fn_drps_carimbo_envio()
returns trigger
language plpgsql
set search_path to 'public'
as $fn$
begin
  if new.status = 'ENVIADO_CLIENTE'
     and new.data_envio_cliente is null
     and (tg_op = 'INSERT' or old.status is distinct from 'ENVIADO_CLIENTE') then
    new.data_envio_cliente := now();
  end if;
  return new;
end;
$fn$;

drop trigger if exists trg_drps_carimbo_envio on public.drps_relatorios;
create trigger trg_drps_carimbo_envio
  before insert or update on public.drps_relatorios
  for each row execute function public.fn_drps_carimbo_envio();

-- 3) CHECK do status (só há 'EM_ANDAMENTO' na base hoje; todos os valores conformam).
alter table public.drps_relatorios
  drop constraint if exists drps_relatorios_status_check;
alter table public.drps_relatorios
  add constraint drps_relatorios_status_check
  check (status in ('RASCUNHO','EM_ANDAMENTO','CONCLUIDO','ENVIADO_CLIENTE','DELETADO'));
