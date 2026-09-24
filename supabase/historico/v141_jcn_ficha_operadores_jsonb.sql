-- V141 — Operadores da ficha de máquina vira jsonb [{nome,cargo}].
-- Antes era TEXT livre (v136). Agora colunas Nome+Cargo, igual à inspeção.
-- Guarda contra reexecução: só converte se ainda for text (senão viraria no-op
-- destrutivo que nula os dados a cada rerun). Já aplicado via MCP.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='apreciacao_fichas_maquina'
      and column_name='operadores' and data_type='text'
  ) then
    alter table public.apreciacao_fichas_maquina
      alter column operadores type jsonb using null::jsonb;
  end if;
end $$;
