-- v151 — Apreciação NR-12: capítulos do laudo multi-máquina.
--
-- CONTEXTO: o corpo do PDF é dirigido pelos capítulos de `textos_padrao`. Para o
-- laudo sair no formato do documento de referência faltavam três seções, e o
-- capítulo `apreciacao_identificacao` (ordem 60) existia sem renderizar NADA —
-- sobra do modelo "1 laudo = 1 máquina", em que os dados da máquina iam no
-- cabeçalho fixo.
--
-- O QUE MUDA:
--   * `apreciacao_identificacao` → vira `apreciacao_metodo` ("Método de Cálculo
--     do Risco"). Reaproveita o capítulo morto em vez de criar mais um: capítulo
--     fixo que não renderiza seção gera PÁGINA EM BRANCO no PDF.
--   * novo `apreciacao_relacao` — relação consolidada das máquinas, PAISAGEM.
--   * novo `apreciacao_maquinas` — uma ficha por máquina, PAISAGEM.
--   * `apreciacao_risco` é retitulado para "Conclusão Geral" (o conteúdo agora é
--     o resumo do risco residual do parque, não o parecer de uma máquina).
--
-- O QUE NÃO MUDA — de propósito:
--   * `apreciacao_checklist` continua existindo e imprimindo o checklist de 37
--     itens. O documento de referência não o tem, mas a regra do RT é "só
--     ADICIONAR, nunca REMOVER". Quem não quiser basta desativar o capítulo pela
--     tela de Texto Padrão. (Ele já estava marcado `paisagem` no banco.)
--   * Nenhum `conteudo` de capítulo editável é tocado.
--
-- Idempotente: os inserts checam o slug antes; os updates são no-op se já
-- aplicados. Rodar com `psql -1`.

-- ── 1) Capítulo morto vira o Método de Cálculo ──────────────────────────────
update public.textos_padrao
   set slug_fixo = 'apreciacao_metodo',
       titulo    = 'Método de Cálculo do Risco',
       ordem     = 45,
       orientacao = 'retrato',
       updated_at = now()
 where modulo = 'apreciacao_maquinas'
   and slug_fixo = 'apreciacao_identificacao';

-- ── 2) Relação de máquinas (paisagem) ───────────────────────────────────────
insert into public.textos_padrao
  (id_capitulo, modulo, ordem, titulo, tipo, slug_fixo, orientacao, quebra_pagina, ativo, obrigatorio)
select 'TXT-' || upper(substr(md5('apreciacao_relacao'), 1, 8)),
       'apreciacao_maquinas', 55, 'Relação de Máquinas', 'fixo', 'apreciacao_relacao',
       'paisagem', 'nova', true, false
 where not exists (
   select 1 from public.textos_padrao
    where modulo = 'apreciacao_maquinas' and slug_fixo = 'apreciacao_relacao'
 );

-- ── 3) Ficha por máquina (paisagem) ─────────────────────────────────────────
insert into public.textos_padrao
  (id_capitulo, modulo, ordem, titulo, tipo, slug_fixo, orientacao, quebra_pagina, ativo, obrigatorio)
select 'TXT-' || upper(substr(md5('apreciacao_maquinas_ficha'), 1, 8)),
       'apreciacao_maquinas', 65, 'Apreciação de Risco por Máquina', 'fixo', 'apreciacao_maquinas',
       'paisagem', 'nova', true, false
 where not exists (
   select 1 from public.textos_padrao
    where modulo = 'apreciacao_maquinas' and slug_fixo = 'apreciacao_maquinas'
 );

-- ── 4) A antiga "Apreciação de Risco" vira a Conclusão Geral ────────────────
update public.textos_padrao
   set titulo = 'Conclusão Geral', updated_at = now()
 where modulo = 'apreciacao_maquinas'
   and slug_fixo = 'apreciacao_risco'
   and titulo <> 'Conclusão Geral';

-- ── 5) Conferência ──────────────────────────────────────────────────────────
do $$
declare faltando text;
begin
  select string_agg(s, ', ') into faltando
    from unnest(array['apreciacao_metodo','apreciacao_relacao','apreciacao_maquinas']) as s
   where not exists (
     select 1 from public.textos_padrao
      where modulo = 'apreciacao_maquinas' and slug_fixo = s and ativo
   );
  if faltando is not null then
    raise exception 'v151 abortada: capitulos ausentes -> %', faltando;
  end if;

  if exists (select 1 from public.textos_padrao
              where modulo='apreciacao_maquinas' and slug_fixo='apreciacao_identificacao') then
    raise exception 'v151 abortada: apreciacao_identificacao ainda existe (geraria pagina em branco em paisagem)';
  end if;

  raise notice 'v151 OK: capitulos do laudo multi-maquina no lugar';
end $$;
