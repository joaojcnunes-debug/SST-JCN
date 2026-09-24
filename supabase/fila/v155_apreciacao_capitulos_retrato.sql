-- v155 — Apreciação NR-12: laudo inteiro num único formato de folha (A4 retrato).
--
-- CONTEXTO: depois da v152 sobraram DOIS capítulos em paisagem no módulo —
-- `apreciacao_relacao` (Relação de Máquinas) e `apreciacao_checklist`
-- (Apreciação de Risco por Máquina). O laudo saía trocando de orientação no meio,
-- o que lê como descuido no documento entregue ao cliente. O laudo de referência
-- aprovado pelo RT tem 42 páginas, TODAS na mesma orientação.
--
-- Só é seguro virar para retrato porque o template foi reorganizado no mesmo
-- commit: o bloco INVENTÁRIO da ficha deixou de ser uma faixa horizontal de 7
-- campos e virou lista vertical ocupando ~58% da largura, com as fotos ao lado.
-- Isso libera a largura inteira para a tabela HRN de 6 colunas.
--
-- ⚠️ MIGRATION E CÓDIGO SÃO UM PACOTE SÓ. Aplicar sem o deploy do template novo
-- espreme a faixa de inventário de 7 colunas em retrato. Deployar sem a migration
-- deixa a ficha nova (estreita) numa folha deitada, com metade da folha vazia.
--
-- ⚠️ DML em `textos_padrao` (dado de produção). Aplicar manualmente.
-- Idempotente: updates no-op se já aplicados. Rodar com `psql -1`.

update public.textos_padrao
   set orientacao = 'retrato',
       updated_at = now()
 where modulo = 'apreciacao_maquinas'
   and slug_fixo in ('apreciacao_relacao', 'apreciacao_checklist')
   and orientacao <> 'retrato';

-- ── Conferência ─────────────────────────────────────────────────────────────
do $$
declare v_paisagem text;
begin
  select string_agg(slug_fixo, ', ' order by ordem) into v_paisagem
    from public.textos_padrao
   where modulo = 'apreciacao_maquinas' and orientacao = 'paisagem' and ativo;
  if v_paisagem is not null then
    raise exception 'v155 abortada: ainda ha capitulo em paisagem -> %', v_paisagem;
  end if;
  raise notice 'v155 OK: laudo da apreciacao inteiro em retrato';
end $$;
