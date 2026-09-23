-- ROLLBACK da v166 — desfaz colaboradores, entregas e assinaturas.
--
-- ATENÇÃO: apaga TERMOS DE RETIRADA ASSINADOS. A assinatura eletrônica (PNG +
-- pdf_sha256 + IP) é evidência jurídica — se já houve entrega assinada em
-- produção, EXPORTE ANTES:
--   \copy (select * from public.equipamentos_entrega_assinaturas) to 'assinaturas.csv' csv header
--   \copy (select * from public.equipamentos_entregas)            to 'entregas.csv'    csv header
--   \copy (select * from public.equipamentos_entregas_itens)      to 'itens.csv'       csv header
--
-- As saídas de estoque (origem='entrega') NÃO são apagadas — mesma razão da v165.
--
-- Rodar à mão:  psql -1 -v ON_ERROR_STOP=1 -f v166_equipamentos_colaboradores_entregas_rollback.sql

do $$
begin
  if to_regclass('public.equipamentos_devolucoes') is not null then
    raise exception 'Rollback da v166 abortado: a v167 (devolucao/status) esta aplicada. Rode os rollbacks na ordem inversa.';
  end if;
end $$;

drop function if exists public.equipamento_registrar_entrega(text, text, date, text, text, jsonb);
drop function if exists public.equipamento_assinar_entrega(text, text, text, text, text, boolean);
drop view     if exists public.v_equipamentos_com_colaborador;

drop table if exists public.equipamentos_entrega_assinaturas;
drop table if exists public.equipamentos_entregas_itens;
drop table if exists public.equipamentos_entregas;

-- Solta o vínculo antes de derrubar o roster (a FK é on delete set null, mas
-- deixar explícito evita surpresa se alguém mudar a FK depois).
update public.equipamentos set id_colaborador = null, entregue_em = null
 where id_colaborador is not null;
alter table public.equipamentos drop column if exists id_colaborador;
alter table public.equipamentos drop column if exists entregue_em;

drop table if exists public.colaboradores_chabra;

delete from public.schema_migrations where version = 'v166_equipamentos_colaboradores_entregas';
