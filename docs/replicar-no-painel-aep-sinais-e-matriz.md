# Replicar no Painel SST: novos sinais da Ergonomia Organizacional e matriz 1 sinal = 1 nível

> **Como usar:** abra o Claude Code na pasta do **painel-sst** e diga:
> *"Siga o arquivo `replicar-no-painel-aep-sinais-e-matriz.md`"*.
>
> Origem: JCN (`sst-jcn`), commit `5769716` de 2026-10-06, já em produção lá.
> **Sem migration.** Há só um ajuste de **dados** opcional no Texto Padrão (Passo 3).

## Pré-requisito

O painel precisa já ter a matriz AIHA na Ergonomia Organizacional
(`lib/aep/aiha-organizacional.ts`) e a página/explicação da Matriz AIHA
(`components/aep/ExplicacaoMatrizAiha.tsx`) — MDs
`replicar-no-painel-aep-matriz-aiha.md` e
`replicar-no-painel-explicacao-matriz-aiha.md`.

## O que faz

### 1. Sinais observados (lista do RT de 2026-10-06)

- Cada um dos **13 fatores** passa a ter **5 sinais** (65 no total), no lugar
  dos 95 antigos (5 a 11 por fator). Os fatores não mudam.
- **Chaves de mesmo sentido foram mantidas** (a `key` é o que fica gravado no
  jsonb `aep_relatorios.setores`); ex.: o sinal que juntou "tom agressivo" e
  "brincadeiras constrangedoras" ficou com `tom_agressivo`.
- Chave que saiu do catálogo:
  - é **descartada na leitura** (`normalizarSetor` em `lib/hooks/useAep.ts`,
    some no próximo salvamento);
  - **não conta** para a matriz (`sinaisValidos`);
  - já não aparecia em laudo/PDF (`rotulosDosSinais` percorre o catálogo).
- Ajustes de texto: "Interrompimento" → "Interrupção"; "(Técnico)" e
  "(Colaborador)" da Justiça organizacional viraram a etiqueta `fonte`;
  "Baixa demanda" segue "(Subcarga)".

### 2. Matriz AIHA: 1 sinal = 1 nível

| Sinais marcados | Probabilidade sugerida |
|---|---|
| 0 | Não há exposição (Trivial, travado) |
| 1 | Exposição a níveis baixos |
| 2 | Exposição moderada |
| 3 | Exposição elevada |
| 4 ou 5 | Exposição elevadíssima |

- Antes era pela proporção (até 1/3 → moderada, até 2/3 → elevada, acima →
  elevadíssima).
- **Severidade padrão por fator não mudou.**
- `indiceProbabilidadeSugerida(marcados, nNiveis)` perdeu o parâmetro
  `total`, e `avaliarFator` perdeu `sinaisTotal`.
- `recalcularAihaOrganizacional` trocou `totalSinais` por
  `contarSinais?(fator, marcados)`.
- Exemplos: assédio (Irreversíveis) 1 sinal = Moderado, 3 = Alto, 4–5 = Muito
  Alto; falta de suporte (Severos) 4 = Alto; subcarga (Preocupantes) 2 = Baixo,
  3 = Moderado.

## Passo 1: conferir o painel

| Usado | Conferir no painel |
|---|---|
| `lib/aep/sinais-organizacional.ts` com `SINAIS_ORGANIZACIONAL` e `rotulosDosSinais` | mesmo arquivo; se o painel tiver sinais diferentes dos 95 do JCN, a seção A **substitui** o catálogo inteiro |
| `normalizarSetor` em `lib/hooks/useAep.ts` com o bloco `sinais_organizacional` | o filtro entra ali |
| `AihaDoFator` e `comAiha` em `components/aep/AepSetoresEditor.tsx` | mesmos nomes |
| Quantos laudos têm sinais marcados | rode a consulta abaixo no **banco do painel** |

```sql
select distinct a.id_relatorio, a.id_empresa, a.status
  from aep_relatorios a, jsonb_array_elements(a.setores) st
 where coalesce(st->'sinais_organizacional', '{}'::jsonb) <> '{}'::jsonb;
```

No JCN só havia 1 AEP de teste. Se o painel tiver laudos **concluídos** de
clientes com sinais, avise o responsável: o nível gravado só muda quando o
setor for editado de novo (o editor recalcula), e os sinais que saíram da lista
deixam de aparecer.

## Passo 2: código

| Seção | Arquivo | O quê |
|---|---|---|
| A | `lib/aep/sinais-organizacional.ts` | **substituir**: catálogo novo + `sinaisValidos` |
| B | `lib/aep/aiha-organizacional.ts` | regra 1 sinal = 1 nível |
| C | `lib/aep/aiha-organizacional.test.ts` | testes da regra |
| D | `lib/aep/sinalizacao.test.ts` | rótulo novo do sinal |
| E | `components/aep/AepSetoresEditor.tsx` | conta só sinais válidos |
| F | `lib/hooks/useAep.ts` | descarta chave antiga na leitura |
| G | `components/aep/ExplicacaoMatrizAiha.tsx` | página Matriz AIHA |

### A: `lib/aep/sinais-organizacional.ts` (substituir, completo)

```ts
import type { AepChecklistOrganizacional } from "@/lib/supabase/types";

/**
 * Sinais observáveis de cada fator de Ergonomia Organizacional da triagem AEP.
 *
 * Fonte: lista do RT de 2026-10-06 — **5 sinais em cada um dos 13 fatores**
 * (65 no total), que substituiu a de 2026-08-06 (95 sinais, de 5 a 11 por
 * fator). Com o mesmo número de sinais em todo fator, a probabilidade da
 * matriz AIHA passou a ser 1 sinal = 1 nível (ver aiha-organizacional.ts).
 *
 * Os sinais só aparecem quando o fator é marcado **Sim**.
 *
 * ⚠️ **`key` é o que fica gravado no banco** (dentro de `aep_relatorios.setores`,
 * que é jsonb). Renomear uma chave apaga a resposta de quem já respondeu —
 * mudar `label` é livre, mudar `key` não é. Na troca de 2026-10-06 as chaves
 * de mesmo sentido foram mantidas (ex.: o sinal que juntou "tom agressivo" e
 * "brincadeiras constrangedoras" ficou com `tom_agressivo`); chave que saiu do
 * catálogo é descartada na leitura (`normalizarSetor` em useAep.ts) e não
 * conta para a matriz (`sinaisValidos`).
 *
 * ⚠️ Esta é a **fonte única**: tela de triagem, laudo, formulário em branco,
 * template do PDF e página da Matriz AIHA leem daqui.
 *
 * Correção de digitação: "Interrompimento" → "Interrupção".
 */

/** Quem costuma revelar o sinal (etiqueta em vez de sujar o texto). */
export type FonteSinal = "colaborador" | "tecnico";

export interface SinalOrganizacional {
  key: string;
  label: string;
  fonte?: FonteSinal;
}

export const SINAIS_ORGANIZACIONAL: Record<
  keyof AepChecklistOrganizacional,
  SinalOrganizacional[]
> = {
  assedio: [
    { key: "tom_agressivo", label: "Tom agressivo, irônico, humilhante e/ou brincadeiras constrangedoras" },
    { key: "sem_escuta", label: "Falta de abertura para escuta" },
    { key: "cobranca_publico", label: "Cobranças em público" },
    { key: "tensao_silencio", label: "Ambiente de tensão ou silêncio excessivo" },
    { key: "naturalizacao", label: "Naturalização de gritos, pressão ou desrespeito (“aqui sempre foi assim”)" },
  ],
  falta_suporte: [
    { key: "lider_ausente", label: "Líder ausente ou pouco acessível no dia a dia" },
    { key: "rh_inacessivel", label: "RH apenas burocrático, mas inacessível" },
    { key: "sem_direcionamento", label: "Pouca interação e/ou ausência de direcionamento técnico" },
    { key: "dificuldade_levar_problemas", label: "Dificuldade de levar problemas e questões para a liderança" },
    { key: "erros_punidos", label: "Erros sendo punidos, mas não trabalhados" },
  ],
  gestao_mudancas: [
    { key: "comunicacao_informal", label: "Comunicação informal das mudanças (boatos e conversas informais)" },
    { key: "instabilidade", label: "Comentários sobre instabilidade" },
    { key: "inseguranca_funcao", label: "Insegurança sobre a função" },
    { key: "improviso", label: "Sensação de improviso na gestão" },
    { key: "duvidas_retrabalho", label: "Relatos de dúvidas e retrabalho" },
  ],
  clareza_papel: [
    { key: "varias_orientacoes", label: "Colaborador recebe orientações de mais de uma pessoa" },
    { key: "quem_manda", label: "Dúvidas sobre “quem manda”" },
    { key: "sem_padrao_comunicacao", label: "Falta de padrão na comunicação" },
    { key: "instrucoes_vagas", label: "Instruções vagas ou incompletas (ou informações que não chegam a todos)" },
    { key: "instrucoes_diferentes", label: "Instruções diferentes para uma mesma atividade" },
  ],
  recompensas: [
    { key: "sem_plano_carreira", label: "Falta de plano de carreira e possibilidade de crescimento" },
    { key: "indiferenca_resultados", label: "Indiferença com relação a resultados (ausência de conversas de desenvolvimento, feedback somente quando há erro)" },
    { key: "desmotivacao", label: "Desmotivação aparente" },
    { key: "sem_retorno_desempenho", label: "Ausência de retorno sobre desempenho" },
    { key: "cobranca_sem_reconhecimento", label: "Cobrança intensa por resultado, sem reconhecimento por esforço" },
  ],
  baixo_controle: [
    { key: "pouca_iniciativa", label: "Pouca margem para iniciativa" },
    { key: "controle_constante", label: "Muito controle em cima das atividades (controle detalhado e constante, revisões excessivas)" },
    { key: "falta_confianca", label: "Falta de confiança explícita ou implícita" },
    { key: "decisoes_concentradas", label: "Decisões concentradas em poucas pessoas" },
    { key: "equipe_nao_resolve", label: "Dificuldade da equipe em resolver problemas sozinha e/ou medo de errar e evitação de iniciativa (“melhor perguntar tudo”)" },
  ],
  justica_organizacional: [
    { key: "decisoes_opacas", label: "Colaboradores não sabem como as decisões são tomadas" },
    { key: "comentarios_preferencias", label: "Comentários informais sobre preferências" },
    { key: "decisoes_pessoais", label: "Decisões percebidas como pessoais, não técnicas", fonte: "tecnico" },
    { key: "descredito_lideranca", label: "Desmotivação ou descrédito na liderança e/ou comentários sobre injustiça ou favoritismo", fonte: "colaborador" },
    { key: "conflitos_interpessoais", label: "Conflitos interpessoais" },
  ],
  eventos_traumaticos: [
    { key: "contato_publico", label: "Atividades com contato com o público (especialmente situações de conflito)" },
    { key: "area_risco_violencia", label: "Trabalho em áreas com risco de violência" },
    { key: "sem_protocolos", label: "Falta de protocolos de segurança" },
    { key: "sem_treinamento_risco", label: "Falta de treinamento para lidar com situações de risco" },
    { key: "historico_incidentes", label: "Histórico de incidentes (mesmo que informais)" },
  ],
  subcarga: [
    { key: "periodos_sem_atividade", label: "Períodos frequentes sem atividades" },
    { key: "sem_desafios", label: "Falta de desafios compatíveis com a função (profissionais qualificados realizando tarefas simples ou repetitivas)" },
    { key: "concentracao_tarefas", label: "Concentração de demandas" },
    { key: "sem_o_que_fazer", label: "Conversas sobre “não ter o que fazer”" },
    { key: "monotonia", label: "Baixa exigência cognitiva, monotonia" },
  ],
  sobrecarga: [
    { key: "atividades_simultaneas", label: "Acúmulo de atividades simultâneas e/ou funções" },
    { key: "urgencia_permanente", label: "Clima laboral onde se percebe sensação de urgência permanente" },
    { key: "equipe_reduzida", label: "Equipe reduzida para o volume de trabalho" },
    { key: "metas_dificeis", label: "Metas percebidas como difíceis de atingir" },
    { key: "cansaco_irritabilidade", label: "Cansaço aparente, irritabilidade, dificuldade de concentração" },
  ],
  maus_relacionamentos: [
    { key: "resistencia_equipe", label: "Resistência ao trabalho em equipe e à colaboração" },
    { key: "conflitos_ignorados", label: "Conflitos ignorados ou minimizados" },
    { key: "evitacao_colegas", label: "Evitação entre colegas" },
    { key: "falta_respeito", label: "Falta de respeito em interações" },
    { key: "comunicacao_indireta", label: "Comunicação indireta (recados, indiretas…)" },
  ],
  comunicacao_dificil: [
    { key: "erros_frequentes", label: "Erros frequentes" },
    { key: "sem_referencia", label: "Colaboradores sem referência de quem procurar" },
    { key: "informacoes_divergentes", label: "Informações divergentes entre pessoas" },
    { key: "dependencia_informal", label: "Dependência de comunicação informal e/ou ausência de canais formais de comunicação" },
    { key: "paradas_por_falta_info", label: "Interrupção das atividades por falta de informação" },
  ],
  trabalho_remoto: [
    { key: "baixo_pertencimento", label: "Baixo senso de pertencimento" },
    { key: "equipe_desconectada", label: "Equipe pouco conectada" },
    { key: "sem_integracao", label: "Falta de ações de integração" },
    { key: "falta_alinhamento", label: "Falta de alinhamento nas informações" },
    { key: "mensagens_objetivas", label: "Comunicação restrita a mensagens objetivas (sem troca real)" },
  ],
};

/** Sinais marcados por fator: `{ assedio: ["tom_agressivo", ...] }`. */
export type SinaisSelecionados = Record<string, string[]>;

/** Rótulos dos sinais marcados de um fator, na ordem do documento. */
export function rotulosDosSinais(
  fator: keyof AepChecklistOrganizacional,
  selecionados: SinaisSelecionados | undefined,
): string[] {
  const marcados = selecionados?.[fator];
  if (!marcados?.length) return [];
  const doFator = SINAIS_ORGANIZACIONAL[fator] ?? [];
  // Percorre o catálogo (não o que foi marcado) para manter a ordem do documento
  // e descartar sozinho qualquer chave que tenha saído da lista.
  return doFator.filter((s) => marcados.includes(s.key)).map((s) => s.label);
}

/** Só as chaves que ainda existem no catálogo do fator (descarta as antigas). */
export function sinaisValidos(fator: string, marcados: readonly string[] | undefined): string[] {
  const doFator = SINAIS_ORGANIZACIONAL[fator as keyof AepChecklistOrganizacional];
  if (!doFator || !marcados?.length) return [];
  return marcados.filter((k) => doFator.some((s) => s.key === k));
}
```

### B: diff de `lib/aep/aiha-organizacional.ts`

```diff
@@ -8,11 +8,11 @@
 //     da matriz (AIHA: "Não há exposição" × "Pouca importância"), travado, e o
 //     resultado é o da matriz para eles (AIHA: 0 × 0 = Trivial) — que não conta
 //     para a AET. A sugestão só começa no 1º sinal.
-//   • A partir do 1º sinal, Probabilidade SUGERIDA pela proporção de sinais:
-//       até 1/3 → 3º nível da escala ("Exposição moderada")
-//       até 2/3 → 4º ("Exposição elevada")
-//       acima   → 5º ("Exposição elevadíssima")
-//     e Severidade PADRÃO do fator (SEVERIDADE_PADRAO_IDX, índice da escala).
+//   • A partir do 1º sinal, Probabilidade SUGERIDA = 1 sinal por nível
+//     (2026-10-06, todo fator tem 5 sinais): 1 → "Exposição a níveis baixos",
+//     2 → moderada, 3 → elevada, 4 ou 5 → elevadíssima (topo da escala).
+//     Até 2026-10-05 era pela proporção (até 1/3, 2/3, acima).
+//     Severidade PADRÃO do fator (SEVERIDADE_PADRAO_IDX, índice da escala).
 //   • Com sinal marcado, o técnico pode trocar qualquer uma das duas; a troca
 //     fica marcada como manual e deixa de acompanhar a sugestão.
 //
@@ -58,23 +58,16 @@ export const SEVERIDADE_PADRAO_IDX: Record<FatorOrganizacional, number> = {
   trabalho_remoto: 1,
 };
 
-/** Índice da probabilidade sugerida pela proporção de sinais marcados. */
-export function indiceProbabilidadeSugerida(marcados: number, total: number, nNiveis: number): number {
+/** Índice da probabilidade sugerida: 1 sinal marcado = 1 nível da escala. */
+export function indiceProbabilidadeSugerida(marcados: number, nNiveis: number): number {
   const max = Math.max(0, nNiveis - 1);
-  let idx: number;
-  if (marcados <= 0 || total <= 0) idx = 0;
-  else {
-    const p = marcados / total;
-    idx = p <= 1 / 3 ? 2 : p <= 2 / 3 ? 3 : 4;
-  }
-  return Math.min(idx, max);
+  return Math.min(Math.max(0, Math.floor(marcados)), max);
 }
 
 /** Avaliação de UM fator marcado "Sim". */
 export function avaliarFator(args: {
   fator: string;
   sinaisMarcados: number;
-  sinaisTotal: number;
   anterior?: AihaFator;
   matriz: Pick<MatrizRisco, "probabilidades" | "severidades" | "pesos_prob" | "pesos_sev" | "faixas" | "lookup">;
 }): AihaFator {
@@ -95,7 +88,7 @@ export function avaliarFator(args: {
   }
 
   const probSug = matriz.probabilidades[
-    indiceProbabilidadeSugerida(args.sinaisMarcados, args.sinaisTotal, matriz.probabilidades.length)
+    indiceProbabilidadeSugerida(args.sinaisMarcados, matriz.probabilidades.length)
   ];
   const idxSev = Math.min(
     SEVERIDADE_PADRAO_IDX[args.fator as FatorOrganizacional] ?? 1,
@@ -125,7 +118,8 @@ export function avaliarFator(args: {
 export function recalcularAihaOrganizacional(args: {
   checklist: Record<string, string | null | undefined>;
   sinaisMarcados: Record<string, string[] | undefined> | undefined;
-  totalSinais: (fator: string) => number;
+  /** Conta só os sinais que ainda existem no catálogo (padrão: todos). */
+  contarSinais?: (fator: string, marcados: string[] | undefined) => number;
   anterior: AihaOrganizacional | undefined;
   matriz: Parameters<typeof avaliarFator>[0]["matriz"];
 }): AihaOrganizacional {
@@ -134,8 +128,9 @@ export function recalcularAihaOrganizacional(args: {
     if (resposta !== "sim") continue;
     out[fator] = avaliarFator({
       fator,
-      sinaisMarcados: args.sinaisMarcados?.[fator]?.length ?? 0,
-      sinaisTotal: args.totalSinais(fator),
+      sinaisMarcados: args.contarSinais
+        ? args.contarSinais(fator, args.sinaisMarcados?.[fator])
+        : (args.sinaisMarcados?.[fator]?.length ?? 0),
       anterior: args.anterior?.[fator],
       matriz: args.matriz,
     });
```

### C: diff de `lib/aep/aiha-organizacional.test.ts`

```diff
@@ -22,55 +22,61 @@ const AIHA = {
 
 describe("sem sinal observado marcado → níveis mais baixos", () => {
   test("fica em Não há exposição × Pouca importância = Trivial", () => {
-    const r = avaliarFator({ fator: "assedio", sinaisMarcados: 0, sinaisTotal: 6, matriz: AIHA });
+    const r = avaliarFator({ fator: "assedio", sinaisMarcados: 0, matriz: AIHA });
     assert.equal(r.probabilidade, "Não há exposição");
     assert.equal(r.severidade, "Pouca importância");
     assert.equal(r.nivel, "Trivial");
   });
   test("escolha manual anterior não vale sem sinal (volta ao mais baixo)", () => {
     const r = avaliarFator({
-      fator: "assedio", sinaisMarcados: 0, sinaisTotal: 6, matriz: AIHA,
+      fator: "assedio", sinaisMarcados: 0, matriz: AIHA,
       anterior: { probabilidade: "Exposição elevada", severidade: "Ameaça", nivel: "Muito Alto", prob_manual: true, sev_manual: true },
     });
     assert.equal(r.nivel, "Trivial");
     assert.equal(r.prob_manual, false);
   });
   test("não conta para o Necessita AET", () => {
-    const r = avaliarFator({ fator: "assedio", sinaisMarcados: 0, sinaisTotal: 6, matriz: AIHA });
+    const r = avaliarFator({ fator: "assedio", sinaisMarcados: 0, matriz: AIHA });
     assert.deepEqual(contagemParaAet({ assedio: r }), { altos: 0, moderados: 0 });
   });
 });
 
-describe("probabilidade sugerida pela proporção de sinais", () => {
-  test("faixas", () => {
-    assert.equal(indiceProbabilidadeSugerida(0, 6, 5), 0);
-    assert.equal(indiceProbabilidadeSugerida(1, 6, 5), 2);
-    assert.equal(indiceProbabilidadeSugerida(2, 6, 5), 2);
-    assert.equal(indiceProbabilidadeSugerida(4, 6, 5), 3);
-    assert.equal(indiceProbabilidadeSugerida(6, 6, 5), 4);
+describe("probabilidade sugerida: 1 sinal = 1 nível", () => {
+  test("escala", () => {
+    assert.equal(indiceProbabilidadeSugerida(0, 5), 0);
+    assert.equal(indiceProbabilidadeSugerida(1, 5), 1);
+    assert.equal(indiceProbabilidadeSugerida(2, 5), 2);
+    assert.equal(indiceProbabilidadeSugerida(3, 5), 3);
+    assert.equal(indiceProbabilidadeSugerida(4, 5), 4);
+    assert.equal(indiceProbabilidadeSugerida(5, 5), 4);
   });
   test("nunca passa do tamanho da escala", () => {
-    assert.equal(indiceProbabilidadeSugerida(6, 6, 3), 2);
+    assert.equal(indiceProbabilidadeSugerida(5, 3), 2);
   });
 });
 
 describe("com sinais: nível pela ponderação da matriz (peso_prob × peso_sev)", () => {
-  test("assédio com 1 de 6 sinais = 2 × 3 = Moderado", () => {
-    const r = avaliarFator({ fator: "assedio", sinaisMarcados: 1, sinaisTotal: 6, matriz: AIHA });
-    assert.equal(r.probabilidade, "Exposição moderada");
+  test("assédio com 1 sinal = 1 × 3 = Moderado", () => {
+    const r = avaliarFator({ fator: "assedio", sinaisMarcados: 1, matriz: AIHA });
+    assert.equal(r.probabilidade, "Exposição a níveis baixos");
     assert.equal(r.severidade, "Irreversíveis");
     assert.equal(r.nivel, "Moderado");
   });
-  test("assédio com 4 de 6 = 3 × 3 = Alto; com 6 de 6 = 4 × 3 = Muito Alto", () => {
-    assert.equal(avaliarFator({ fator: "assedio", sinaisMarcados: 4, sinaisTotal: 6, matriz: AIHA }).nivel, "Alto");
-    assert.equal(avaliarFator({ fator: "assedio", sinaisMarcados: 6, sinaisTotal: 6, matriz: AIHA }).nivel, "Muito Alto");
+  test("assédio com 3 sinais = 3 × 3 = Alto; com 4 ou 5 = 4 × 3 = Muito Alto", () => {
+    assert.equal(avaliarFator({ fator: "assedio", sinaisMarcados: 3, matriz: AIHA }).nivel, "Alto");
+    assert.equal(avaliarFator({ fator: "assedio", sinaisMarcados: 4, matriz: AIHA }).nivel, "Muito Alto");
+    assert.equal(avaliarFator({ fator: "assedio", sinaisMarcados: 5, matriz: AIHA }).nivel, "Muito Alto");
   });
-  test("subcarga com 1 de 5 = 2 × 1 = Baixo", () => {
-    assert.equal(avaliarFator({ fator: "subcarga", sinaisMarcados: 1, sinaisTotal: 5, matriz: AIHA }).nivel, "Baixo");
+  test("subcarga (Preocupantes): 2 sinais = 2 × 1 = Baixo; 3 = Moderado", () => {
+    assert.equal(avaliarFator({ fator: "subcarga", sinaisMarcados: 2, matriz: AIHA }).nivel, "Baixo");
+    assert.equal(avaliarFator({ fator: "subcarga", sinaisMarcados: 3, matriz: AIHA }).nivel, "Moderado");
+  });
+  test("falta de suporte (Severos): 4 sinais = 4 × 2 = Alto", () => {
+    assert.equal(avaliarFator({ fator: "falta_suporte", sinaisMarcados: 4, matriz: AIHA }).nivel, "Alto");
   });
   test("escolha manual do técnico vence a sugestão", () => {
     const r = avaliarFator({
-      fator: "subcarga", sinaisMarcados: 1, sinaisTotal: 5, matriz: AIHA,
+      fator: "subcarga", sinaisMarcados: 1, matriz: AIHA,
       anterior: { probabilidade: "Exposição elevadíssima", severidade: "Ameaça", nivel: "Baixo", prob_manual: true, sev_manual: true },
     });
     assert.equal(r.nivel, "Muito Alto");
@@ -78,10 +84,10 @@ describe("com sinais: nível pela ponderação da matriz (peso_prob × peso_sev)
   });
   test("escolha manual que não existe mais na matriz volta para a sugestão", () => {
     const r = avaliarFator({
-      fator: "subcarga", sinaisMarcados: 1, sinaisTotal: 5, matriz: AIHA,
+      fator: "subcarga", sinaisMarcados: 1, matriz: AIHA,
       anterior: { probabilidade: "Frequente", severidade: "Preocupantes", nivel: "Baixo", prob_manual: true },
     });
-    assert.equal(r.probabilidade, "Exposição moderada");
+    assert.equal(r.probabilidade, "Exposição a níveis baixos");
     assert.equal(r.prob_manual, false);
   });
 });
@@ -90,7 +96,6 @@ test("recalcular mantém só fatores marcados Sim", () => {
   const r = recalcularAihaOrganizacional({
     checklist: { assedio: "sim", subcarga: "nao", sobrecarga: "nao_identificado" },
     sinaisMarcados: { assedio: ["a", "b"] },
-    totalSinais: () => 6,
     anterior: { subcarga: { probabilidade: "x", severidade: "y", nivel: "Alto" } },
     matriz: AIHA,
   });
```

### D: diff de `lib/aep/sinalizacao.test.ts`

```diff
@@ -42,7 +42,7 @@ test("fator traz rótulo, sinais, observação e nível", () => {
   const [e] = montarSinalizacao([rel("A1", "E1", "2026-01-01", [setorComAssedio])]);
   const f = e.avaliacoes[0].setores[0].fatores[0];
   assert.equal(f.label, "Assédio de qualquer natureza no trabalho");
-  assert.deepEqual(f.sinais, ["Tom agressivo, irônico ou humilhante"]);
+  assert.deepEqual(f.sinais, ["Tom agressivo, irônico, humilhante e/ou brincadeiras constrangedoras"]);
   assert.equal(f.observacao, "gritos");
   assert.equal(f.nivel, "Moderado");
 });
```

### E: diff de `components/aep/AepSetoresEditor.tsx`

```diff
@@ -54,6 +54,7 @@ import { mensagemErro } from "@/lib/errors";
 import {
   SINAIS_ORGANIZACIONAL,
   rotulosDosSinais,
+  sinaisValidos,
   type SinalOrganizacional,
 } from "@/lib/aep/sinais-organizacional";
 import {
@@ -248,7 +249,7 @@ function AihaDoFator({
   disabled?: boolean;
 }) {
   if (!valor) return null;
-  const probSug = matriz.probabilidades[indiceProbabilidadeSugerida(sinaisMarcados, sinaisTotal, matriz.probabilidades.length)];
+  const probSug = matriz.probabilidades[indiceProbabilidadeSugerida(sinaisMarcados, matriz.probabilidades.length)];
   const sevSug = matriz.severidades[
     Math.min(SEVERIDADE_PADRAO_IDX[fator as FatorOrganizacional] ?? 1, matriz.severidades.length - 1)
   ];
@@ -410,7 +411,7 @@ function ChecklistBloco({
                   fator={key}
                   valor={aiha[key]}
                   matriz={matriz}
-                  sinaisMarcados={sinaisMarcados?.[key]?.length ?? 0}
+                  sinaisMarcados={sinaisValidos(key, sinaisMarcados?.[key]).length}
                   sinaisTotal={doFator?.length ?? 0}
                   onChange={(patch) => onAihaChange?.(key, patch)}
                   disabled={disabled}
@@ -475,7 +476,7 @@ export default function AepSetoresPage({ idRelatorio }: { idRelatorio: string })
     const aiha = recalcularAihaOrganizacional({
       checklist: s.checklist_organizacional as unknown as Record<string, string>,
       sinaisMarcados: s.sinais_organizacional,
-      totalSinais: (f) => SINAIS_ORGANIZACIONAL[f as FatorOrganizacional]?.length ?? 0,
+      contarSinais: (f, marcados) => sinaisValidos(f, marcados).length,
       anterior: s.aiha_organizacional,
       matriz,
     }) as AepSetor["aiha_organizacional"];
```

### F: diff de `lib/hooks/useAep.ts`

```diff
@@ -1,5 +1,6 @@
 "use client";
 
+import { sinaisValidos } from "@/lib/aep/sinais-organizacional";
 import { situacaoQuestionario, type SituacaoQuestionario } from "@/lib/aep/sinalizacao";
 import { montarCatalogoSetores } from "@/lib/aep/catalogo-setores";
 import { contagemParaAet } from "@/lib/aep/aiha-organizacional";
@@ -121,7 +122,9 @@ function normalizarSetor(s: unknown): AepSetor {
       if (typeof bruto !== "object" || bruto === null) return {};
       const out: Record<string, string[]> = {};
       for (const [k, v] of Object.entries(bruto as Record<string, unknown>)) {
-        if (Array.isArray(v)) out[k] = v.filter((x): x is string => typeof x === "string");
+        // Só chaves do catálogo atual: sinal que saiu da lista (troca de
+        // 2026-10-06) some aqui e no próximo salvamento.
+        if (Array.isArray(v)) out[k] = sinaisValidos(k, v.filter((x): x is string => typeof x === "string"));
       }
       return out;
     })(),
```

### G: diff de `components/aep/ExplicacaoMatrizAiha.tsx`

```diff
@@ -138,8 +138,9 @@ export default function ExplicacaoMatrizAiha({
             <Selo nivel="Trivial" />. Sem evidência registrada não há como graduar a exposição.
           </p>
           <p className="mt-2">
-            <strong>3.3 Probabilidade sugerida</strong> pela proporção de sinais marcados sobre o total de sinais do
-            fator (quanto mais evidências, maior a exposição):
+            <strong>3.3 Probabilidade sugerida</strong> pela quantidade de sinais marcados: cada fator tem{" "}
+            <strong>5 sinais observáveis</strong>, e cada sinal registrado sobe um nível na escala de exposição
+            (quanto mais evidências, maior a exposição):
           </p>
           <div className="mt-2 overflow-x-auto">
             <table className="w-full min-w-[420px] border-collapse">
@@ -153,9 +154,10 @@ export default function ExplicacaoMatrizAiha({
               <tbody>
                 {[
                   ["Nenhum", 0],
-                  ["Até 1/3 dos sinais", 2],
-                  ["Acima de 1/3 até 2/3", 3],
-                  ["Acima de 2/3", 4],
+                  ["1 sinal", 1],
+                  ["2 sinais", 2],
+                  ["3 sinais", 3],
+                  ["4 ou 5 sinais", 4],
                 ].map(([faixa, idx]) => (
                   <tr key={faixa as string}>
                     <td className={td}>{faixa}</td>
@@ -167,8 +169,10 @@ export default function ExplicacaoMatrizAiha({
             </table>
           </div>
           <p className="mt-2 text-xs text-gray-500">
-            Com o 1º sinal a probabilidade já parte do nível intermediário: um sinal psicossocial observado em campo
-            indica exposição real, não apenas eventual.
+            A escala tem 5 níveis e o primeiro (“{probs[0] ?? "Não há exposição"}”) é reservado ao fator sem
+            evidência; por isso 4 e 5 sinais chegam ambos ao topo. Exemplo: assédio (severidade padrão “
+            {sevs[3] ?? "Irreversíveis"}”) com 1 sinal = <Selo nivel="Moderado" />; com 3 sinais ={" "}
+            <Selo nivel="Alto" />.
           </p>
 
           <p className="mt-3">
```

## Passo 3: capítulo do Texto Padrão (opcional, banco do painel)

No JCN o capítulo editável **"Avaliação dos Fatores Psicossociais — Matriz de
Risco AIHA"** (`textos_padrao`, módulo `aep`) foi atualizado: a frase da
proporção, a tabela da probabilidade e a coluna "Sinais" (todos = 5). Se o
painel tiver esse capítulo, **confira o texto antes** — se ele foi editado lá,
os `replace` abaixo simplesmente não acham o trecho e nada muda. Troque
`<ID_DO_CAPITULO>` pelo id do painel:

```sql
select id_capitulo, titulo from textos_padrao where titulo ilike '%Matriz de Risco AIHA%';

update textos_padrao set conteudo =
  regexp_replace(
  replace(replace(conteudo,
    'A probabilidade é sugerida pela proporção de sinais observados sobre o total de sinais do fator;',
    'Cada fator tem cinco sinais observáveis, e a probabilidade é sugerida pela quantidade de sinais registrados — cada sinal sobe um nível na escala de exposição (4 ou 5 sinais chegam ao nível máximo);'),
    '<tr><td>Até 1/3 dos sinais</td><td>Exposição moderada</td><td>2</td></tr><tr><td>Acima de 1/3 até 2/3</td><td>Exposição elevada</td><td>3</td></tr><tr><td>Acima de 2/3</td><td>Exposição elevadíssima</td><td>4</td></tr>',
    '<tr><td>1 sinal</td><td>Exposição a níveis baixos</td><td>1</td></tr><tr><td>2 sinais</td><td>Exposição moderada</td><td>2</td></tr><tr><td>3 sinais</td><td>Exposição elevada</td><td>3</td></tr><tr><td>4 ou 5 sinais</td><td>Exposição elevadíssima</td><td>4</td></tr>'),
  '(</td>)<td>\d+</td>(<td>(Irreversíveis|Severos|Preocupantes) \()', '\1<td>5</td>\2', 'g'),
  updated_at = now()
where id_capitulo = '<ID_DO_CAPITULO>'
returning position('1 sinal' in conteudo) > 0 as tabela_ok,
          position('proporção' in conteudo) = 0 as sem_proporcao;
```

Esperado: `tabela_ok = true` e `sem_proporcao = true`. Se vier `false`, ajuste
o capítulo pela tela do Texto Padrão.

## Passo 4: verificar

1. `npm test`, `npx tsc --noEmit -p .` e `npx next build` sem erros.
2. Numa AEP, marque um fator organizacional **Sim**: aparecem **5 sinais**.
3. Marque 1, 2, 3, 4 sinais de "Assédio": a probabilidade sugerida vai de
   "Exposição a níveis baixos" a "Exposição elevadíssima"; o nível vai de
   Moderado a Muito Alto ("sugerida pelos sinais (n de 5)").
4. Página **Matriz AIHA**: tabela "1 sinal / 2 sinais / 3 sinais / 4 ou 5
   sinais" e coluna "Sinais" = 5 em todos os fatores.
5. Laudo/PDF de uma AEP com sinais: os rótulos novos aparecem.
6. Publique pelo fluxo de release do painel (versão, changelog, "Novidades").
