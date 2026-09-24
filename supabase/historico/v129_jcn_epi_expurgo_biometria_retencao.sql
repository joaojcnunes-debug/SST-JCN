-- v129 (JCN) — EPI: expurgo do template biométrico por retenção (LGPD). Aplicado via MCP.
-- Ao INATIVAR o colaborador, o template é apagado automaticamente; guarda-se
-- apenas o carimbo de expurgo para prestação de contas. Remoção manual (revogação
-- de consentimento) é feita pelo app zerando o template. Idempotente.

alter table public.epi_colaboradores
  add column if not exists biometria_expurgada_em timestamptz;

create or replace function public.epi_expurgar_biometria_inativo()
returns trigger language plpgsql as $fn$
begin
  if NEW.ativo = false and NEW.biometria_template is not null then
    NEW.biometria_template := null;
    NEW.biometria_cadastrada_em := null;
    NEW.biometria_consentimento_em := null;
    NEW.biometria_expurgada_em := now();
  end if;
  return NEW;
end $fn$;

drop trigger if exists trg_epi_expurgar_biometria on public.epi_colaboradores;
create trigger trg_epi_expurgar_biometria
  before update on public.epi_colaboradores
  for each row execute function public.epi_expurgar_biometria_inativo();
