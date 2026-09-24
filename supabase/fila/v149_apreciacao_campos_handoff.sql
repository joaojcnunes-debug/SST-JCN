-- v149 — Apreciação NR-12: colunas que faltavam para o formato do handoff SST-JCN.
--
-- CONTEXTO: o handoff de 2026-07-31 descreve o módulo já evoluído na instância
-- SST-JCN. Comparando schema a schema, faltavam aqui: itens da NR-12 como LISTA
-- (não texto solto), a Categoria de Segurança da NBR 14153, o número da
-- notificação SIT/MTE no laudo, CREA/ART do responsável técnico e os operadores
-- estruturados na máquina da inspeção.
--
-- SEGURANÇA DO DADO: todas as colunas são novas e nullable. Nenhum backfill
-- destrutivo. Medido antes de rodar (2026-07-31): 0 linhas em
-- `apreciacao_riscos_hrn`, portanto nada a converter em itens_nr12.
--
-- ⚠️ `item_nr12` (texto, criado hoje na v147) NÃO é removida de propósito. O app
-- em produção (v0.3.486) escreve nela; derrubar a coluna antes do deploy do
-- código novo quebraria "Adicionar risco" com PGRST204. Ela vira legado: a v150+
-- passa a gravar em `itens_nr12`, e a remoção fica para uma migration futura,
-- depois que o código novo estiver no ar.
--
-- Aditiva e idempotente. Rodar com `psql -1`.

-- ── 1) Riscos HRN: itens da norma como lista + categoria de segurança ───────
alter table public.apreciacao_riscos_hrn
  add column if not exists itens_nr12 text[],
  add column if not exists categoria_seguranca text;

-- Converte o que estiver no campo texto da v147 (hoje: nada) sem perdê-lo.
update public.apreciacao_riscos_hrn
   set itens_nr12 = array[btrim(item_nr12)]
 where item_nr12 is not null
   and btrim(item_nr12) <> ''
   and itens_nr12 is null;

comment on column public.apreciacao_riscos_hrn.itens_nr12 is
  'Itens da NR-12 ligados ao perigo, um por elemento — ex.: {"12.38 a 12.55","12.46"}. Sai na coluna "Item NR-12" da ficha. Substitui `item_nr12` (v147, texto solto), mantida por compatibilidade.';
comment on column public.apreciacao_riscos_hrn.item_nr12 is
  'LEGADO (v147) — substituída por `itens_nr12` (text[]) na v149. Mantida enquanto houver código antigo em produção escrevendo nela.';
comment on column public.apreciacao_riscos_hrn.categoria_seguranca is
  'Categoria de segurança do comando (ABNT NBR 14153 / ISO 13849): B, 1, 2, 3 ou 4. Sai junto das medidas de controle no PDF.';

-- ── 2) Laudo: número da notificação SIT/MTE ─────────────────────────────────
alter table public.apreciacoes_maquinas
  add column if not exists notificacao_sit text;

comment on column public.apreciacoes_maquinas.notificacao_sit is
  'Número da notificação SIT/MTE que originou o laudo (ex.: RMBHIUV2OAHH6O). Sai na identificação do documento.';

-- ── 3) Responsável técnico: CREA e ART ──────────────────────────────────────
alter table public.usuarios
  add column if not exists crea text,
  add column if not exists art  text;

comment on column public.usuarios.crea is
  'Registro no CREA do responsável técnico (ex.: 2025106994-RJ). Usado quando o cargo é de engenharia — ver lib/registro-profissional.ts.';
comment on column public.usuarios.art is
  'ART vinculada ao documento (Anotação de Responsabilidade Técnica).';

-- ── 4) Operadores estruturados na máquina da inspeção ───────────────────────
alter table public.inspecao_maquinas
  add column if not exists operadores jsonb;

comment on column public.inspecao_maquinas.operadores is
  'Operadores/responsáveis da máquina: jsonb [{nome, cargo}]. Viajam junto quando a máquina é importada para um laudo de apreciação.';

-- ── 5) Conferência ──────────────────────────────────────────────────────────
do $$
declare faltando text;
begin
  select string_agg(x.tab || '.' || x.col, ', ')
    into faltando
    from (values
      ('apreciacao_riscos_hrn','itens_nr12'),
      ('apreciacao_riscos_hrn','categoria_seguranca'),
      ('apreciacoes_maquinas','notificacao_sit'),
      ('usuarios','crea'), ('usuarios','art'),
      ('inspecao_maquinas','operadores')
    ) as x(tab,col)
   where not exists (
     select 1 from information_schema.columns c
      where c.table_schema='public' and c.table_name=x.tab and c.column_name=x.col
   );
  if faltando is not null then
    raise exception 'v149 abortada: colunas nao criadas -> %', faltando;
  end if;
end $$;
