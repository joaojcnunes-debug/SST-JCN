-- v152 — Apreciação NR-12: capítulos do laudo IGUAIS ao SST-JCN.
--
-- CONTEXTO: a v151 seguiu a regra "só adicionar, nunca remover" e deixou o laudo
-- com DOIS capítulos de máquina — `apreciacao_checklist` (checklist de 37 itens)
-- E `apreciacao_maquinas` (ficha HRN por máquina). O SST-JCN (v140) usa apenas
-- UM: `apreciacao_checklist` REAPROVEITADO como "Apreciação de Risco por Máquina",
-- sem capítulo `apreciacao_maquinas` e sem imprimir o checklist no PDF.
--
-- Esta migration alinha o painel ao JCN (validado com o RT):
--   1) `apreciacao_checklist` é retitulado para "Apreciação de Risco por Máquina"
--      (paisagem, quebra_pagina 'nova'). No template, esse slug passa a renderizar
--      a MaquinasSection — o checklist de 37 itens deixa de sair no PDF
--      (INCLUIR_CHECKLIST_PDF=false).
--   2) o capítulo extra `apreciacao_maquinas` (criado pela v151) é REMOVIDO.
--   3) a ordem dos capítulos fixos é fixada de forma determinística.
--
-- NÃO toca em `conteudo` de nenhum capítulo editável. O checklist continua sendo
-- PREENCHIDO na tela do editor (os dados permanecem) — só não é impresso, como no
-- JCN. Para voltar a imprimi-lo, vire INCLUIR_CHECKLIST_PDF para true no template.
--
-- ⚠️ DML em `textos_padrao` (dado de produção). Aplicar manualmente e conferir.
-- Idempotente: updates no-op se já aplicados; delete guardado. Rodar com `psql -1`.

-- ── 1) O checklist vira a "Apreciação de Risco por Máquina" ──────────────────
-- `quebra_pagina` TEM de vir junto: o capítulo aposentado (`apreciacao_maquinas`)
-- era 'nova' e o que assume o lugar dele está 'continua'. Sem esta coluna aqui, a
-- seção nasce colada embaixo da "Relação de Máquinas" (ambas paisagem, então não
-- há troca de orientação para forçar a quebra) e a ficha da 1ª máquina parte no
-- meio — a 2ª linha de risco cai órfã na página seguinte. Medido no PDF real em
-- 2026-08-03; com 'nova' o layout fecha certo.
update public.textos_padrao
   set titulo        = 'Apreciação de Risco por Máquina',
       orientacao    = 'paisagem',
       quebra_pagina = 'nova',
       updated_at    = now()
 where modulo = 'apreciacao_maquinas'
   and slug_fixo = 'apreciacao_checklist';

-- ── 2) Ordem determinística dos capítulos fixos (metodo → relacao → máquina →
--        conclusão → plano → assinatura), igual à sequência do JCN ────────────
update public.textos_padrao set ordem = 45 where modulo = 'apreciacao_maquinas' and slug_fixo = 'apreciacao_metodo';
update public.textos_padrao set ordem = 55 where modulo = 'apreciacao_maquinas' and slug_fixo = 'apreciacao_relacao';
update public.textos_padrao set ordem = 65 where modulo = 'apreciacao_maquinas' and slug_fixo = 'apreciacao_checklist';
update public.textos_padrao set ordem = 75 where modulo = 'apreciacao_maquinas' and slug_fixo = 'apreciacao_risco';
update public.textos_padrao set ordem = 85 where modulo = 'apreciacao_maquinas' and slug_fixo = 'apreciacao_plano';
update public.textos_padrao set ordem = 95 where modulo = 'apreciacao_maquinas' and slug_fixo = 'apreciacao_assinatura';

-- ── 3) Remove o capítulo extra `apreciacao_maquinas` (JCN não o tem) ─────────
-- Só o capítulo fixo criado pela v151; não há conteúdo editável nele.
delete from public.textos_padrao
 where modulo = 'apreciacao_maquinas'
   and slug_fixo = 'apreciacao_maquinas'
   and tipo = 'fixo';

-- ── 4) Conferência ──────────────────────────────────────────────────────────
do $$
declare v_titulo text;
        v_quebra text;
        v_orient text;
begin
  -- o capítulo extra não pode mais existir
  if exists (select 1 from public.textos_padrao
              where modulo = 'apreciacao_maquinas' and slug_fixo = 'apreciacao_maquinas') then
    raise exception 'v152 abortada: capitulo apreciacao_maquinas ainda existe';
  end if;

  -- apreciacao_checklist tem de existir e estar retitulado
  select titulo, quebra_pagina, orientacao
    into v_titulo, v_quebra, v_orient
    from public.textos_padrao
   where modulo = 'apreciacao_maquinas' and slug_fixo = 'apreciacao_checklist' limit 1;
  if v_titulo is null then
    raise exception 'v152 abortada: capitulo apreciacao_checklist ausente';
  end if;
  if v_titulo <> 'Apreciação de Risco por Máquina' then
    raise exception 'v152 abortada: apreciacao_checklist com titulo inesperado -> %', v_titulo;
  end if;
  -- sem 'nova' a ficha da 1ª máquina parte no meio da página (ver nota no passo 1)
  if v_quebra is distinct from 'nova' then
    raise exception 'v152 abortada: apreciacao_checklist com quebra_pagina -> % (esperado nova)', v_quebra;
  end if;
  if v_orient is distinct from 'paisagem' then
    raise exception 'v152 abortada: apreciacao_checklist com orientacao -> % (esperado paisagem)', v_orient;
  end if;

  raise notice 'v152 OK: capitulos do laudo alinhados ao SST-JCN';
end $$;
