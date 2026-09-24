-- v171 — Apreciação NR-12: o checklist passa a sair no PDF por PADRÃO.
--
-- A v153 criou `incluir_checklist_pdf` com default FALSE, para não mudar o
-- comportamento de então. Consequência: em 07/08/2026 as 15 apreciações da base
-- estavam com o checklist desligado e NENHUM laudo o imprimia — o cliente
-- recebia o Plano de Ação (as conclusões) sem a verificação que o gerou.
--
-- Decisão do usuário em 07/08: o checklist é o padrão de todos os documentos
-- impressos. É o formato que o técnico pediu — cada requisito com o código da
-- NR-12, a situação constatada, a foto e a observação técnica.
--
-- ⚠️ PRÉ-REQUISITO JÁ CUMPRIDO: `scripts/sql/v170_apreciacao_nr12_demais_laudos.sql`
-- traduziu 666 itens em 14 laudos que ainda citavam a NR-12 anterior à Portaria
-- SEPRT 916/2019. Sem aquilo, ligar o checklist publicaria códigos revogados
-- (12.131.1, 12.94.1 — que não existem na norma vigente) em 14 documentos.
-- NÃO reordenar: v170 antes desta.
--
-- Aditiva e idempotente. Reverter = trocar `true` por `false` nos dois comandos.
-- Continua sendo uma ESCOLHA por laudo: quem não quiser desmarca no editor.

alter table public.apreciacoes_maquinas
  alter column incluir_checklist_pdf set default true;

-- Laudos já existentes passam a imprimir o checklist também.
update public.apreciacoes_maquinas
   set incluir_checklist_pdf = true
 where incluir_checklist_pdf is distinct from true;

do $$
declare padrao text; n_off int;
begin
  select column_default into padrao from information_schema.columns
   where table_schema = 'public' and table_name = 'apreciacoes_maquinas'
     and column_name = 'incluir_checklist_pdf';
  if padrao is null or padrao not like 'true%' then
    raise exception 'v171 abortada: default ficou %, esperado true', padrao;
  end if;

  select count(*) into n_off from public.apreciacoes_maquinas
   where incluir_checklist_pdf is distinct from true;
  if n_off > 0 then
    raise exception 'v171 abortada: % laudos ainda com o checklist desligado', n_off;
  end if;

  raise notice 'v171 OK: checklist no PDF e o padrao, e todos os laudos ligados';
end $$;
