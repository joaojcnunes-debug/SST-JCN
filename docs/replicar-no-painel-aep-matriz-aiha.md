# Replicar no Painel SST: Ergonomia Organizacional da AEP na matriz de risco AIHA

> **Como usar:** abra o Claude Code na pasta do **painel-sst** e diga:
> *"Siga o arquivo `replicar-no-painel-aep-matriz-aiha.md`"*.
>
> Origem: JCN (`sst-jcn`), commits de 2026-10-02 (AEP na matriz AIHA e Sinalização Psicossocial por empresa), já em
> produção lá. **Não mexe no banco**: o resultado fica no jsonb `setores` de
> `aep_relatorios`. O código completo está no fim deste arquivo.

## O que faz

Na AEP, tela **Setores / Triagem**, bloco **Ergonomia Organizacional**, cada
fator marcado **Sim** ganha, logo abaixo dos **Sinais observados**, um quadro
**"Matriz de risco AIHA"** com **Probabilidade**, **Severidade** e o
**resultado** (nível colorido).

O nível usa a **mesma matriz e a mesma ponderação da inspeção**: a matriz ativa
em `matrizes_risco` (hoje a AIHA 5×5), calculada por `calcularNivelComMatriz`
(`lib/calc.ts`): `peso_prob × peso_sev` → faixa da matriz (Trivial 0 · Baixo
1–2 · Moderado 3–6 · Alto 7–10 · Muito Alto ≥11). Se a matriz mudar em
Configurações, a AEP acompanha.

### Regras

1. **Sem nenhum sinal observado marcado → não calcula.**
   - Probabilidade = nível mais baixo da matriz ("Não há exposição").
   - Severidade = nível mais baixo ("Pouca importância").
   - Os dois campos ficam travados e o quadro mostra "Não calculado — marque os
     sinais observados".
   - O fator não conta no "Necessita AET" e não sai no laudo.
   - Uma escolha manual anterior é descartada.
2. **A partir do 1º sinal marcado, calcula.**
   - **Probabilidade sugerida pela proporção** de sinais marcados sobre o total
     de sinais do fator:

     | Proporção | Probabilidade |
     |---|---|
     | até 1/3 | 3º nível ("Exposição moderada") |
     | até 2/3 | 4º nível ("Exposição elevada") |
     | acima de 2/3 | 5º nível ("Exposição elevadíssima") |

   - **Severidade padrão do fator**, como índice na escala de severidade:

     | Severidade (índice) | Fatores |
     |---|---|
     | 3 = Irreversíveis | Assédio, Eventos traumáticos |
     | 2 = Severos | Falta de suporte, Baixo controle, Justiça organizacional, Sobrecarga, Maus relacionamentos |
     | 1 = Preocupantes | Gestão de mudanças, Clareza de papel, Recompensas, Subcarga, Comunicação difícil, Trabalho remoto |

   - O técnico pode **trocar** as duas. A troca fica marcada como manual
     (`prob_manual`/`sev_manual`), e os links "usar sugerida" e "usar padrão"
     voltam para a regra automática.
3. **"Necessita AET"** (`calcNecessitaAet`): passa a ser decidido **só** pelos
   fatores organizacionais na matriz AIHA — 1 fator **Alto/Muito Alto**, ou 2+
   **Moderados**. A lista **"Matriz de Riscos"** do setor (`setor.riscos`)
   **deixa de contar** para a sugestão de AET (continua no laudo como
   registro). O aviso da tela, o texto do laudo/PDF e o formulário em branco
   foram reescritos com esse critério, e o escalonamento do laudo mostra o
   **maior nível AIHA organizacional** do setor no lugar do "Risco máximo".
4. **Laudo e PDF da AEP:** cada fator com nível mostra "Probabilidade ·
   Severidade · Nível".
5. **Sinalização Psicossocial** (refeita no mesmo formato da página Riscos Psicossociais):
   - primeira tela: só a **lista de empresas** com fatores sinalizados (busca,
     maior nível AIHA, nº de alertas e de setores, data da última AEP),
     ordenada do mais grave;
   - clicar abre `/sinalizacao-psicossocial/[idEmpresa]`: dados cadastrais da
     empresa e, por AEP, **um setor embaixo do outro** com a tabela
     **Fator de risco · Resultado final · Probabilidade · Severidade · Sinais
     observados** (observação do fator embaixo do nome);
   - sem link para o editor da AEP, de propósito.

Exemplo com Assédio (6 sinais):

| Sinais | Resultado |
|---|---|
| 0 | não calculado |
| 1–2 | Moderado (2×3) |
| 3–4 | Alto (3×3) |
| 5–6 | Muito Alto (4×3) |

### Onde fica gravado

`aep_relatorios.setores[i].aiha_organizacional` (jsonb, sem migration):

```json
{ "assedio": { "probabilidade": "Exposição elevada", "severidade": "Irreversíveis",
               "nivel": "Alto", "prob_manual": false, "sev_manual": false } }
```

- Só entram os fatores marcados "Sim". `nivel = null` significa que nenhum
  sinal foi marcado.
- O editor recalcula a cada mudança no setor e também ao abrir a AEP; o
  resultado vai para o banco no **Salvar**.
- Laudo, PDF e Sinalização só **leem** o gravado e não precisam da matriz.
- AEPs antigas: o quadro aparece ao abrir, mas a Sinalização só mostra o nível
  depois que a AEP for salva.

## Passo 1: conferir o painel antes de copiar

| Usado pelo código | Conferir no painel |
|---|---|
| `calcularNivelComMatriz` em `lib/calc.ts` e `useMatrizAtiva()` em `lib/hooks/useV3.ts` | existem? a matriz ativa é a AIHA com `pesos_prob`, `pesos_sev` e `faixas`? |
| `NIVEL_CONFIG` em `lib/constants.ts` (cores por nível) | mesmo nome; se não, use as cores de nível da inspeção |
| `SINAIS_ORGANIZACIONAL` em `lib/aep/sinais-organizacional.ts` e `sinais_organizacional` no setor | já existe no painel (veio de lá) |
| As 13 chaves de `AepChecklistOrganizacional` (assedio, falta_suporte, …) | iguais |
| `normalizarSetor` em `lib/hooks/useAep.ts` **e** em `app/api/pdf/aep/[id]/route.ts` | os dois reconstroem o setor campo a campo: **o campo novo precisa entrar nos dois**, senão some |
| `components/aep/AepSetoresEditor.tsx` | no JCN o editor foi extraído da página `app/(aep)/aep/[idRelatorio]/setores/page.tsx`; no painel pode ainda estar dentro da página. Aplique o diff onde o editor estiver |
| Rótulos da matriz AIHA | a severidade padrão é **índice** (não texto), então funciona com qualquer rótulo |

## Passo 2: código

| Arquivo | O quê | Seção |
|---|---|---|
| `lib/aep/aiha-organizacional.ts` | **novo**: a regra inteira | A |
| `lib/aep/aiha-organizacional.test.ts` | **novo**: 14 testes da regra | B |
| `lib/supabase/types.ts` | campo `aiha_organizacional` em `AepSetor` | C |
| `lib/hooks/useAep.ts` | normalizador + `calcNecessitaAet` | D |
| `components/aep/AepSetoresEditor.tsx` | quadro AIHA, recálculo e matriz ativa | E |
| `app/api/pdf/aep/[id]/route.ts` | normalizador do PDF | F |
| `components/pdf/templates/AepTemplate.tsx` | linha "Probabilidade · Severidade · Nível" no PDF | G |
| `app/(aep)/aep/[idRelatorio]/laudo/page.tsx` | a mesma linha na prévia do laudo + critério de AET | H |
| `app/(aep)/aep/formulario-branco/page.tsx` | texto do critério de AET | H.2 |
| `lib/aep/sinalizacao.ts` + `.test.ts` | **novo**: agrupa as AEPs por empresa › setor › fator | I |
| `components/aep/SeloNivelAiha.tsx` | **novo**: selo colorido do nível | J |
| `app/(sinalizacao-psicossocial)/sinalizacao-psicossocial/page.tsx` | **substituir**: lista de empresas | K |
| `app/(sinalizacao-psicossocial)/sinalizacao-psicossocial/[idEmpresa]/page.tsx` | **novo**: página da empresa | L |

## Passo 3: verificar

1. `npm test` (os 14 testes da regra passam) e `npx tsc --noEmit -p .` e `npx next build` sem erros.
2. Numa AEP, marque **Assédio = Sim**:
   - sem sinais: o quadro mostra "Não calculado" e os campos ficam travados;
   - marque 1 sinal: dá Moderado; 4 sinais: Alto; 6 sinais: Muito Alto.
3. Troque a severidade à mão e confira que o nível muda e que "usar padrão" volta para o padrão do fator.
4. Salve; confira o laudo/PDF (linha do fator) e a Sinalização Psicossocial (empresa na lista com o nível; na página da empresa, o setor com a tabela do fator).
5. Um fator organizacional **Alto** sozinho deve ligar o "Necessita AET" do setor; um risco Alto/Crítico na lista "Matriz de Riscos" **não** deve ligar.
6. Publique pelo fluxo de release do painel (versão, changelog, "Novidades").

---

## A: `lib/aep/aiha-organizacional.ts` (novo, completo)

```ts
// Ergonomia Organizacional da AEP na matriz de risco AIHA (pedido de 2026-10-02).
//
// Cada fator marcado "Sim" ganha Probabilidade × Severidade da MESMA matriz da
// inspeção (`matrizes_risco` ativa — hoje a AIHA 5×5), e o nível sai da mesma
// conta: `calcularNivelComMatriz` = peso_prob × peso_sev → faixa da matriz.
//
//   • SÓ CALCULA COM SINAL MARCADO (pedido de 2026-10-02): sem nenhum sinal
//     observado, o fator fica nos níveis mais baixos da matriz (AIHA: "Não há
//     exposição" × "Pouca importância") e SEM nível — não conta para nada.
//   • A partir do 1º sinal, Probabilidade SUGERIDA pela proporção de sinais:
//       até 1/3 → 3º nível da escala ("Exposição moderada")
//       até 2/3 → 4º ("Exposição elevada")
//       acima   → 5º ("Exposição elevadíssima")
//     e Severidade PADRÃO do fator (SEVERIDADE_PADRAO_IDX, índice da escala).
//   • Com sinal marcado, o técnico pode trocar qualquer uma das duas; a troca
//     fica marcada como manual e deixa de acompanhar a sugestão.
//
// O resultado é GRAVADO no setor (`aiha_organizacional`) — laudo, PDF e a
// Sinalização Psicossocial leem o gravado, sem precisar da matriz. O editor
// recalcula a cada mudança no setor.

import { calcularNivelComMatriz } from "@/lib/calc";
import type { AepChecklistOrganizacional, MatrizRisco, NivelRisco } from "@/lib/supabase/types";

export type FatorOrganizacional = keyof AepChecklistOrganizacional;

export interface AihaFator {
  probabilidade: string;
  severidade: string;
  /** null = ainda sem sinal observado marcado → não calculado. */
  nivel: NivelRisco | null;
  /** true = escolhida pelo técnico; false = sugestão (acompanha os sinais). */
  prob_manual?: boolean;
  sev_manual?: boolean;
}

export type AihaOrganizacional = Partial<Record<string, AihaFator>>;

/**
 * Severidade padrão de cada fator, como ÍNDICE na escala de severidade da
 * matriz (AIHA: 0 Pouca importância · 1 Preocupantes · 2 Severos ·
 * 3 Irreversíveis · 4 Ameaça).
 */
export const SEVERIDADE_PADRAO_IDX: Record<FatorOrganizacional, number> = {
  assedio: 3,
  eventos_traumaticos: 3,
  falta_suporte: 2,
  baixo_controle: 2,
  justica_organizacional: 2,
  sobrecarga: 2,
  maus_relacionamentos: 2,
  gestao_mudancas: 1,
  clareza_papel: 1,
  recompensas: 1,
  subcarga: 1,
  comunicacao_dificil: 1,
  trabalho_remoto: 1,
};

/** Índice da probabilidade sugerida pela proporção de sinais marcados. */
export function indiceProbabilidadeSugerida(marcados: number, total: number, nNiveis: number): number {
  const max = Math.max(0, nNiveis - 1);
  let idx: number;
  if (marcados <= 0 || total <= 0) idx = 0;
  else {
    const p = marcados / total;
    idx = p <= 1 / 3 ? 2 : p <= 2 / 3 ? 3 : 4;
  }
  return Math.min(idx, max);
}

/** Avaliação de UM fator marcado "Sim". */
export function avaliarFator(args: {
  fator: string;
  sinaisMarcados: number;
  sinaisTotal: number;
  anterior?: AihaFator;
  matriz: Pick<MatrizRisco, "probabilidades" | "severidades" | "pesos_prob" | "pesos_sev" | "faixas" | "lookup">;
}): AihaFator {
  const { matriz, anterior } = args;

  // Sem sinal marcado: níveis mais baixos da matriz e nada calculado.
  if (args.sinaisMarcados <= 0) {
    return {
      probabilidade: matriz.probabilidades[0],
      severidade: matriz.severidades[0],
      nivel: null,
      prob_manual: false,
      sev_manual: false,
    };
  }

  const probSug = matriz.probabilidades[
    indiceProbabilidadeSugerida(args.sinaisMarcados, args.sinaisTotal, matriz.probabilidades.length)
  ];
  const idxSev = Math.min(
    SEVERIDADE_PADRAO_IDX[args.fator as FatorOrganizacional] ?? 1,
    Math.max(0, matriz.severidades.length - 1),
  );
  const sevSug = matriz.severidades[idxSev];

  // Escolha manual só vale se ainda existir na matriz (a matriz pode ter mudado).
  const probManual = !!anterior?.prob_manual && matriz.probabilidades.includes(anterior.probabilidade);
  const sevManual = !!anterior?.sev_manual && matriz.severidades.includes(anterior.severidade);
  const probabilidade = probManual ? anterior!.probabilidade : probSug;
  const severidade = sevManual ? anterior!.severidade : sevSug;

  return {
    probabilidade,
    severidade,
    nivel: calcularNivelComMatriz(probabilidade, severidade, matriz as MatrizRisco),
    prob_manual: probManual,
    sev_manual: sevManual,
  };
}

/**
 * Recalcula todos os fatores do setor: só os marcados "Sim" ficam; os demais
 * saem (fator negado não tem risco a classificar).
 */
export function recalcularAihaOrganizacional(args: {
  checklist: Record<string, string | null | undefined>;
  sinaisMarcados: Record<string, string[] | undefined> | undefined;
  totalSinais: (fator: string) => number;
  anterior: AihaOrganizacional | undefined;
  matriz: Parameters<typeof avaliarFator>[0]["matriz"];
}): AihaOrganizacional {
  const out: AihaOrganizacional = {};
  for (const [fator, resposta] of Object.entries(args.checklist)) {
    if (resposta !== "sim") continue;
    out[fator] = avaliarFator({
      fator,
      sinaisMarcados: args.sinaisMarcados?.[fator]?.length ?? 0,
      sinaisTotal: args.totalSinais(fator),
      anterior: args.anterior?.[fator],
      matriz: args.matriz,
    });
  }
  return out;
}

/** Quantos fatores contam como Alto e como Moderado para o "Necessita AET". */
export function contagemParaAet(aiha: AihaOrganizacional | undefined): { altos: number; moderados: number } {
  let altos = 0;
  let moderados = 0;
  for (const f of Object.values(aiha ?? {})) {
    if (!f) continue;
    if (f.nivel === "Alto" || f.nivel === "Muito Alto") altos++;
    else if (f.nivel === "Moderado") moderados++;
  }
  return { altos, moderados };
}

/** Cores dos níveis — as MESMAS da inspeção (lib/constants.ts). */
export { NIVEL_CONFIG as COR_NIVEL_AIHA } from "@/lib/constants";
```

## B: `lib/aep/aiha-organizacional.test.ts` (novo, completo)

```ts
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { avaliarFator, contagemParaAet, indiceProbabilidadeSugerida, recalcularAihaOrganizacional } from "./aiha-organizacional";
import type { MatrizRisco } from "@/lib/supabase/types";

// A matriz AIHA ativa no banco (MTZ-EC03227A).
const AIHA = {
  probabilidades: ["Não há exposição", "Exposição a níveis baixos", "Exposição moderada", "Exposição elevada", "Exposição elevadíssima"],
  severidades: ["Pouca importância", "Preocupantes", "Severos", "Irreversíveis", "Ameaça"],
  pesos_prob: [0, 1, 2, 3, 4],
  pesos_sev: [0, 1, 2, 3, 4],
  faixas: [
    { min: 0, max: 0, nivel: "Trivial" },
    { min: 1, max: 2, nivel: "Baixo" },
    { min: 3, max: 6, nivel: "Moderado" },
    { min: 7, max: 10, nivel: "Alto" },
    { min: 11, max: 999, nivel: "Muito Alto" },
  ],
  lookup: [],
} as unknown as MatrizRisco;

describe("sem sinal observado marcado → não calcula", () => {
  test("fica nos níveis mais baixos da matriz e sem nível", () => {
    const r = avaliarFator({ fator: "assedio", sinaisMarcados: 0, sinaisTotal: 6, matriz: AIHA });
    assert.equal(r.probabilidade, "Não há exposição");
    assert.equal(r.severidade, "Pouca importância");
    assert.equal(r.nivel, null);
  });
  test("escolha manual anterior não vale sem sinal (volta ao mais baixo)", () => {
    const r = avaliarFator({
      fator: "assedio", sinaisMarcados: 0, sinaisTotal: 6, matriz: AIHA,
      anterior: { probabilidade: "Exposição elevada", severidade: "Ameaça", nivel: "Muito Alto", prob_manual: true, sev_manual: true },
    });
    assert.equal(r.nivel, null);
    assert.equal(r.prob_manual, false);
  });
  test("não conta para o Necessita AET", () => {
    const r = avaliarFator({ fator: "assedio", sinaisMarcados: 0, sinaisTotal: 6, matriz: AIHA });
    assert.deepEqual(contagemParaAet({ assedio: r }), { altos: 0, moderados: 0 });
  });
});

describe("probabilidade sugerida pela proporção de sinais", () => {
  test("faixas", () => {
    assert.equal(indiceProbabilidadeSugerida(0, 6, 5), 0);
    assert.equal(indiceProbabilidadeSugerida(1, 6, 5), 2);
    assert.equal(indiceProbabilidadeSugerida(2, 6, 5), 2);
    assert.equal(indiceProbabilidadeSugerida(4, 6, 5), 3);
    assert.equal(indiceProbabilidadeSugerida(6, 6, 5), 4);
  });
  test("nunca passa do tamanho da escala", () => {
    assert.equal(indiceProbabilidadeSugerida(6, 6, 3), 2);
  });
});

describe("com sinais: nível pela ponderação da matriz (peso_prob × peso_sev)", () => {
  test("assédio com 1 de 6 sinais = 2 × 3 = Moderado", () => {
    const r = avaliarFator({ fator: "assedio", sinaisMarcados: 1, sinaisTotal: 6, matriz: AIHA });
    assert.equal(r.probabilidade, "Exposição moderada");
    assert.equal(r.severidade, "Irreversíveis");
    assert.equal(r.nivel, "Moderado");
  });
  test("assédio com 4 de 6 = 3 × 3 = Alto; com 6 de 6 = 4 × 3 = Muito Alto", () => {
    assert.equal(avaliarFator({ fator: "assedio", sinaisMarcados: 4, sinaisTotal: 6, matriz: AIHA }).nivel, "Alto");
    assert.equal(avaliarFator({ fator: "assedio", sinaisMarcados: 6, sinaisTotal: 6, matriz: AIHA }).nivel, "Muito Alto");
  });
  test("subcarga com 1 de 5 = 2 × 1 = Baixo", () => {
    assert.equal(avaliarFator({ fator: "subcarga", sinaisMarcados: 1, sinaisTotal: 5, matriz: AIHA }).nivel, "Baixo");
  });
  test("escolha manual do técnico vence a sugestão", () => {
    const r = avaliarFator({
      fator: "subcarga", sinaisMarcados: 1, sinaisTotal: 5, matriz: AIHA,
      anterior: { probabilidade: "Exposição elevadíssima", severidade: "Ameaça", nivel: "Baixo", prob_manual: true, sev_manual: true },
    });
    assert.equal(r.nivel, "Muito Alto");
    assert.equal(r.prob_manual, true);
  });
  test("escolha manual que não existe mais na matriz volta para a sugestão", () => {
    const r = avaliarFator({
      fator: "subcarga", sinaisMarcados: 1, sinaisTotal: 5, matriz: AIHA,
      anterior: { probabilidade: "Frequente", severidade: "Preocupantes", nivel: "Baixo", prob_manual: true },
    });
    assert.equal(r.probabilidade, "Exposição moderada");
    assert.equal(r.prob_manual, false);
  });
});

test("recalcular mantém só fatores marcados Sim", () => {
  const r = recalcularAihaOrganizacional({
    checklist: { assedio: "sim", subcarga: "nao", sobrecarga: "nao_identificado" },
    sinaisMarcados: { assedio: ["a", "b"] },
    totalSinais: () => 6,
    anterior: { subcarga: { probabilidade: "x", severidade: "y", nivel: "Alto" } },
    matriz: AIHA,
  });
  assert.deepEqual(Object.keys(r), ["assedio"]);
});

test("contagem para o Necessita AET", () => {
  const c = contagemParaAet({
    a: { probabilidade: "", severidade: "", nivel: "Muito Alto" },
    b: { probabilidade: "", severidade: "", nivel: "Alto" },
    c: { probabilidade: "", severidade: "", nivel: "Moderado" },
    d: { probabilidade: "", severidade: "", nivel: "Baixo" },
    e: { probabilidade: "", severidade: "", nivel: null },
  });
  assert.deepEqual(c, { altos: 2, moderados: 1 });
});
```

## C: diff de `lib/supabase/types.ts`

```diff
@@ -2435,6 +2435,20 @@ export interface AepSetor {
    * precisou de migration. Catálogo em `lib/aep/sinais-organizacional.ts`.
    */
   sinais_organizacional?: Record<string, string[]>;
+  /**
+   * v0.3.x (2026-10-02) — cada fator organizacional "Sim" na matriz de risco
+   * ativa (AIHA): probabilidade (sugerida pelos sinais), severidade (padrão
+   * por fator) e o nível calculado. Só fatores "Sim". Ver
+   * `lib/aep/aiha-organizacional.ts`.
+   */
+  aiha_organizacional?: Record<string, {
+    probabilidade: string;
+    severidade: string;
+    /** null = sem sinal observado marcado → não calculado. */
+    nivel: NivelRisco | null;
+    prob_manual?: boolean;
+    sev_manual?: boolean;
+  }>;
   parecer_tecnico: string;
   recomendacoes: string;
   necessita_aet: boolean;
```

## D: diff de `lib/hooks/useAep.ts`

```diff
@@ -1,5 +1,6 @@
 "use client";
 
+import { contagemParaAet } from "@/lib/aep/aiha-organizacional";
 import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
 import toast from "react-hot-toast";
 import { createSupabaseBrowserClient } from "@/lib/supabase/client";
@@ -122,6 +123,11 @@ function normalizarSetor(s: unknown): AepSetor {
       }
       return out;
     })(),
+    // ⚠️ Mesmo cuidado dos sinais: campo fora daqui some em toda leitura.
+    aiha_organizacional:
+      typeof setor.aiha_organizacional === "object" && setor.aiha_organizacional !== null
+        ? (setor.aiha_organizacional as AepSetor["aiha_organizacional"])
+        : {},
     parecer_tecnico: (setor.parecer_tecnico as string) ?? "",
     recomendacoes: (setor.recomendacoes as string) ?? "",
     necessita_aet: Boolean(setor.necessita_aet),
@@ -206,14 +212,16 @@ export function riscoVazioAep(): AepRisco {
 
 // ─── Lógica de escalonamento ──────────────────────────────────────────────────
 
+/**
+ * Sugestão de AET completa (2026-10-02): SÓ os fatores da Ergonomia
+ * Organizacional na matriz AIHA contam — 1 fator Alto/Muito Alto, ou 2+
+ * Moderados. A lista "Matriz de Riscos" do setor (`setor.riscos`) NÃO entra
+ * mais no critério, a pedido do usuário; ela continua no laudo como registro.
+ */
 export function calcNecessitaAet(setor: AepSetor): boolean {
-  const altos = setor.riscos.filter(
-    (r) => r.classificacao_risco === "Alto" || r.classificacao_risco === "Crítico"
-  );
-  const moderados = setor.riscos.filter((r) => r.classificacao_risco === "Moderado");
-  // "Múltiplos riscos Moderados" — o texto da tarja e do laudo diz múltiplos, que
-  // é 2 ou mais. O limiar era 3 e contradizia a própria redação (pedido 10/08).
-  return altos.length > 0 || moderados.length >= 2;
+  const org = contagemParaAet(setor.aiha_organizacional);
+  // "Múltiplos Moderados" = 2 ou mais (pedido de 10/08).
+  return org.altos > 0 || org.moderados >= 2;
 }
 
 export function riscoMaximoAep(setor: AepSetor): ClassificacaoRiscoAET | null {
```

## E: diff de `components/aep/AepSetoresEditor.tsx`

```diff
@@ -35,6 +35,16 @@ import {
 } from "@/components/ui/ListaReordenavel";
 import { cn } from "@/lib/utils";
 import { createSupabaseBrowserClient } from "@/lib/supabase/client";
+import { useMatrizAtiva } from "@/lib/hooks/useV3";
+import {
+  COR_NIVEL_AIHA,
+  indiceProbabilidadeSugerida,
+  recalcularAihaOrganizacional,
+  SEVERIDADE_PADRAO_IDX,
+  type AihaFator,
+  type AihaOrganizacional,
+  type FatorOrganizacional,
+} from "@/lib/aep/aiha-organizacional";
 import toast from "react-hot-toast";
 import { mensagemErro } from "@/lib/errors";
 import {
@@ -60,6 +70,7 @@ import type {
   AepChecklistCognitiva,
   AepChecklistOrganizacional,
   ClassificacaoRiscoAET,
+  MatrizRisco,
   RespostaChecklist,
   RespostaChecklistAep,
   TipoRiscoAET,
@@ -209,6 +220,111 @@ function SinaisDoFator({
   );
 }
 
+// ─── Matriz AIHA do fator (Ergonomia Organizacional) ─────────────────────────
+// Probabilidade sugerida pelos sinais, severidade padrão do fator; o técnico
+// pode trocar as duas. Nível = mesma conta da inspeção (pesos × faixas da
+// matriz ativa). Regra em lib/aep/aiha-organizacional.ts.
+
+function AihaDoFator({
+  fator,
+  valor,
+  matriz,
+  sinaisMarcados,
+  sinaisTotal,
+  onChange,
+  disabled,
+}: {
+  fator: string;
+  valor: AihaFator | undefined;
+  matriz: MatrizRisco;
+  sinaisMarcados: number;
+  sinaisTotal: number;
+  onChange: (patch: Partial<AihaFator>) => void;
+  disabled?: boolean;
+}) {
+  if (!valor) return null;
+  const probSug = matriz.probabilidades[indiceProbabilidadeSugerida(sinaisMarcados, sinaisTotal, matriz.probabilidades.length)];
+  const sevSug = matriz.severidades[
+    Math.min(SEVERIDADE_PADRAO_IDX[fator as FatorOrganizacional] ?? 1, matriz.severidades.length - 1)
+  ];
+  const semSinal = sinaisMarcados <= 0;
+  const cor = valor.nivel ? COR_NIVEL_AIHA[valor.nivel] : undefined;
+  const selectCls =
+    "w-full rounded border border-gray-200 bg-white px-1.5 py-1 text-[11px] text-gray-700 focus:border-gray-400 focus:outline-none disabled:bg-gray-50";
+  return (
+    <div className="rounded-md border border-gray-200 bg-white p-2">
+      <div className="mb-1.5 flex items-center justify-between gap-2">
+        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-600">
+          Matriz de risco {matriz.nome}
+        </span>
+        {valor.nivel ? (
+          <span
+            className="rounded-full px-2 py-0.5 text-[10px] font-bold"
+            style={{ backgroundColor: cor?.bg, color: cor?.cor, border: "1px solid " + (cor?.borda ?? "transparent") }}
+            title="Peso da probabilidade × peso da severidade, nas faixas da matriz"
+          >
+            {valor.nivel}
+          </span>
+        ) : (
+          <span className="rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-[10px] font-medium text-gray-500">
+            Não calculado — marque os sinais observados
+          </span>
+        )}
+      </div>
+      <div className="grid gap-2 md:grid-cols-2">
+        <label className="block space-y-0.5">
+          <span className="flex items-center justify-between text-[10px] text-gray-500">
+            Probabilidade
+            {valor.prob_manual ? (
+              !disabled && (
+                <button type="button" className="text-sky-600 hover:underline" onClick={() => onChange({ prob_manual: false })}>
+                  usar sugerida
+                </button>
+              )
+            ) : (
+              <span className="text-gray-400">sugerida pelos sinais ({sinaisMarcados} de {sinaisTotal})</span>
+            )}
+          </span>
+          <select
+            className={selectCls}
+            disabled={disabled || semSinal}
+            value={valor.probabilidade}
+            onChange={(e) => onChange({ probabilidade: e.target.value, prob_manual: e.target.value !== probSug })}
+          >
+            {matriz.probabilidades.map((p) => (
+              <option key={p} value={p}>{p}{p === probSug ? " (sugerida)" : ""}</option>
+            ))}
+          </select>
+        </label>
+        <label className="block space-y-0.5">
+          <span className="flex items-center justify-between text-[10px] text-gray-500">
+            Severidade
+            {valor.sev_manual ? (
+              !disabled && (
+                <button type="button" className="text-sky-600 hover:underline" onClick={() => onChange({ sev_manual: false })}>
+                  usar padrão
+                </button>
+              )
+            ) : (
+              <span className="text-gray-400">{semSinal ? "aguardando sinais" : "padrão do fator"}</span>
+            )}
+          </span>
+          <select
+            className={selectCls}
+            disabled={disabled || semSinal}
+            value={valor.severidade}
+            onChange={(e) => onChange({ severidade: e.target.value, sev_manual: e.target.value !== sevSug })}
+          >
+            {matriz.severidades.map((sv) => (
+              <option key={sv} value={sv}>{sv}{sv === sevSug ? " (padrão)" : ""}</option>
+            ))}
+          </select>
+        </label>
+      </div>
+    </div>
+  );
+}
+
 // ─── Bloco de checklist ───────────────────────────────────────────────────────
 
 function ChecklistBloco({
@@ -225,6 +341,9 @@ function ChecklistBloco({
   sinais,
   sinaisMarcados,
   onSinaisChange,
+  matriz,
+  aiha,
+  onAihaChange,
 }: {
   titulo: string;
   cor: string;
@@ -242,6 +361,10 @@ function ChecklistBloco({
   sinais?: Record<string, SinalOrganizacional[]>;
   sinaisMarcados?: Record<string, string[]>;
   onSinaisChange?: (fator: string, keys: string[]) => void;
+  /** Matriz AIHA — só a Ergonomia Organizacional passa estes três. */
+  matriz?: MatrizRisco | null;
+  aiha?: AihaOrganizacional;
+  onAihaChange?: (fator: string, patch: Partial<AihaFator>) => void;
 }) {
   const positivos = itens.filter((i) => valores[i.key] === "sim").length;
   return (
@@ -276,6 +399,17 @@ function ChecklistBloco({
                   disabled={disabled}
                 />
               )}
+              {valores[key] === "sim" && matriz && aiha && (
+                <AihaDoFator
+                  fator={key}
+                  valor={aiha[key]}
+                  matriz={matriz}
+                  sinaisMarcados={sinaisMarcados?.[key]?.length ?? 0}
+                  sinaisTotal={doFator?.length ?? 0}
+                  onChange={(patch) => onAihaChange?.(key, patch)}
+                  disabled={disabled}
+                />
+              )}
             </Tristate>
           );
         })}
@@ -321,6 +455,22 @@ export default function AepSetoresPage({ idRelatorio }: { idRelatorio: string })
   const [salvando, setSalvando] = useState(false);
   const [gerandoIA, setGerandoIA] = useState<string | null>(null);
   const [statusOrdem, setStatusOrdem] = useState<StatusOrdemSalva>("parado");
+  // Matriz de risco ativa (a mesma da inspeção) — classifica a Ergonomia Organizacional.
+  const { data: matriz } = useMatrizAtiva();
+
+  /** Recalcula a matriz AIHA dos fatores organizacionais e o "Necessita AET". */
+  function comAiha(s: AepSetor): AepSetor {
+    if (!matriz) return s;
+    const aiha = recalcularAihaOrganizacional({
+      checklist: s.checklist_organizacional as unknown as Record<string, string>,
+      sinaisMarcados: s.sinais_organizacional,
+      totalSinais: (f) => SINAIS_ORGANIZACIONAL[f as FatorOrganizacional]?.length ?? 0,
+      anterior: s.aiha_organizacional,
+      matriz,
+    }) as AepSetor["aiha_organizacional"];
+    const novo = { ...s, aiha_organizacional: aiha };
+    return { ...novo, necessita_aet: calcNecessitaAet(novo) };
+  }
 
   // Só carrega o estado local UMA vez por relatório. Antes isso rodava a cada
   // objeto novo vindo do cache — com o auto-save da ordem, cada arrasto
@@ -333,6 +483,14 @@ export default function AepSetoresPage({ idRelatorio }: { idRelatorio: string })
     if (rel.setores?.length) setAbertos(new Set([rel.setores[0].id]));
   }, [rel, idRelatorio]);
 
+  // Laudos anteriores (ou matriz alterada em Configurações): ao abrir, a matriz
+  // AIHA dos fatores é recalculada na tela; vai para o banco no próximo Salvar.
+  useEffect(() => {
+    if (!matriz) return;
+    setSetores((prev) => prev.map(comAiha));
+    // eslint-disable-next-line react-hooks/exhaustive-deps
+  }, [matriz, rel]);
+
   function toggle(id: string) {
     setAbertos((prev) => {
       const next = new Set(prev);
@@ -383,7 +541,7 @@ export default function AepSetoresPage({ idRelatorio }: { idRelatorio: string })
     setSetores((s) =>
       s.map((x) => {
         if (x.id !== id) return x;
-        const updated = { ...x, ...patch };
+        const updated = comAiha({ ...x, ...patch });
         updated.necessita_aet = calcNecessitaAet(updated);
         return updated;
       })
@@ -813,6 +971,15 @@ export default function AepSetoresPage({ idRelatorio }: { idRelatorio: string })
                           sinais_organizacional: { ...(setor.sinais_organizacional ?? {}), [fator]: keys },
                         })
                       }
+                      matriz={matriz}
+                      aiha={setor.aiha_organizacional}
+                      onAihaChange={(fator, patch) => {
+                        const atual = setor.aiha_organizacional?.[fator];
+                        if (!atual) return;
+                        updateSetor(setor.id, {
+                          aiha_organizacional: { ...(setor.aiha_organizacional ?? {}), [fator]: { ...atual, ...patch } },
+                        });
+                      }}
                     />
                   </div>
                 </section>
@@ -900,7 +1067,7 @@ export default function AepSetoresPage({ idRelatorio }: { idRelatorio: string })
                         Este setor requer elaboração de AET completa
                       </p>
                       <p className="text-xs text-orange-700 mt-0.5">
-                        Foram identificados riscos Alto ou Crítico, ou múltiplos riscos Moderados. Recomenda-se aprofundamento pela Análise Ergonômica do Trabalho (NR-17).
+                        Foram identificados fatores psicossociais organizacionais Alto ou Muito Alto na matriz AIHA, ou múltiplos fatores Moderados. Recomenda-se aprofundamento pela Análise Ergonômica do Trabalho (NR-17).
                       </p>
                     </div>
                   </div>
```

## F: diff de `app/api/pdf/aep/[id]/route.ts`

```diff
@@ -104,6 +104,11 @@ function normalizarSetor(s: unknown): AepSetorLocal {
       }
       return out;
     })(),
+    // Matriz AIHA dos fatores organizacionais (2026-10-02) — mesmo cuidado dos sinais.
+    aiha_organizacional:
+      typeof setor.aiha_organizacional === "object" && setor.aiha_organizacional !== null
+        ? (setor.aiha_organizacional as AepSetorLocal["aiha_organizacional"])
+        : {},
     cargos: Array.isArray(setor.cargos)
       ? (setor.cargos as AepSetorLocal["cargos"])
       : [],
```

## G: diff de `components/pdf/templates/AepTemplate.tsx`

```diff
@@ -14,6 +14,8 @@ import { SecaoIdentificacaoEmpresa, SecaoSumario } from "@/components/pdf/Secoes
 import { classeQuebraFixoNova, numerarCapitulos, numLabel } from "@/components/pdf/templates/shared";
 // Módulo puro (sem "use client", sem hook) — pode entrar no template do Puppeteer.
 import { rotulosDosSinais } from "@/lib/aep/sinais-organizacional";
+import { COR_NIVEL_AIHA } from "@/lib/aep/aiha-organizacional";
+import { piorNivel } from "@/lib/aep/sinalizacao";
 import { gerarConsideracoesAep } from "@/lib/aep/consideracoes";
 import type { Empresa } from "@/lib/supabase/types";
 import type { TextoPadraoCapitulo } from "@/lib/textos-padrao/types";
@@ -87,6 +89,8 @@ export interface AepSetorLocal {
   observacoes_checklist?: Record<string, string>;
   /** Sinais marcados nos fatores organizacionais respondidos "sim" (v0.3.503). */
   sinais_organizacional?: Record<string, string[]>;
+  /** Matriz AIHA dos fatores organizacionais "Sim" (2026-10-02). */
+  aiha_organizacional?: Record<string, { probabilidade: string; severidade: string; nivel: string | null }>;
   cargos?: { id: string; cargo: string; descricao: string; quantidade: number }[];
   riscos: AepRisco[];
   checklist_fisica: AepChecklistFisica;
@@ -639,6 +643,19 @@ function SetorBlock({
                     ))}
                   </ul>
                 )}
+                {setor.aiha_organizacional?.[k]?.nivel && (() => {
+                  // Cores cravadas (Puppeteer não enxerga as variáveis de tema).
+                  const a = setor.aiha_organizacional[k]!;
+                  const c = COR_NIVEL_AIHA[a.nivel as keyof typeof COR_NIVEL_AIHA];
+                  return (
+                    <p style={{ margin: "2px 0 0", fontSize: 9, color: "#4b5563" }}>
+                      Probabilidade: <strong>{a.probabilidade}</strong> · Severidade: <strong>{a.severidade}</strong> · Nível:{" "}
+                      <span style={{ backgroundColor: c?.bg, color: c?.cor, fontWeight: 700, padding: "0 4px", borderRadius: 3 }}>
+                        {a.nivel}
+                      </span>
+                    </p>
+                  );
+                })()}
                 {obs && <p style={{ margin: "2px 0 0", fontSize: 9, fontStyle: "italic", color: "#6b7280" }}>Obs.: {obs}</p>}
               </div>
             );
@@ -876,21 +893,23 @@ export default function AepTemplate({
             }}
           >
             <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600, color: "#9a3412" }}>
-              ⚠ Os setores abaixo apresentaram riscos que justificam elaboração de AET completa (NR-17):
+              ⚠ Os setores abaixo apresentaram fatores psicossociais que justificam elaboração de AET completa (NR-17):
             </p>
             <ul style={{ margin: 0, paddingLeft: 20, fontSize: 11, color: "#c2410c", lineHeight: 1.8 }}>
               {setoresComAet.map((s) => (
                 <li key={s.id}>
                   <strong>{s.nome_setor}</strong>
                   {s.cargo && ` — ${s.cargo}`}
-                  {" — "}Risco máximo:{" "}
-                  <span style={{ fontWeight: 600 }}>{riscoMaximoSetor(s)}</span>
+                  {" — "}Maior nível AIHA (organizacional):{" "}
+                  <span style={{ fontWeight: 600 }}>
+                    {piorNivel(Object.values(s.aiha_organizacional ?? {}).map((a) => a?.nivel)) ?? "—"}
+                  </span>
                 </li>
               ))}
             </ul>
           </div>
           <p style={{ margin: 0, fontSize: 11, color: "#4b5563", lineHeight: 1.7 }}>
-            Conforme NR-17 e NR-01 (GRO/PGR), a presença de riscos classificados como Alto ou Crítico, ou a convergência de múltiplos riscos Moderados, indica a necessidade de aprofundamento por meio da Análise Ergonômica do Trabalho completa, com avaliação postural (OWAS), análise biomecânica, medições ambientais e elaboração de laudo técnico detalhado.
+            Conforme NR-17 e NR-01 (GRO/PGR), a identificação de fator psicossocial organizacional classificado como Alto ou Muito Alto na matriz AIHA, ou de dois ou mais fatores Moderados, indica a necessidade de aprofundamento por meio da Análise Ergonômica do Trabalho completa, com avaliação postural (OWAS), análise biomecânica, medições ambientais e elaboração de laudo técnico detalhado.
           </p>
         </>
       ) : (
```

## H: diff de `app/(aep)/aep/[idRelatorio]/laudo/page.tsx`

```diff
@@ -16,6 +16,8 @@ import { useEmpresa } from "@/lib/hooks/useEmpresas";
 import { usePdfAssinado, usePdfCongelado } from "@/lib/hooks/usePdfsGerados";
 import { baixarPdfAssinado } from "@/lib/pdf/baixar-assinado";
 import { rotulosDosSinais } from "@/lib/aep/sinais-organizacional";
+import { COR_NIVEL_AIHA } from "@/lib/aep/aiha-organizacional";
+import { piorNivel } from "@/lib/aep/sinalizacao";
 import { gerarConsideracoesAep } from "@/lib/aep/consideracoes";
 import { montarValoresAep } from "@/lib/textos-padrao/variaveis-aep";
 import { formatarDataBR, substituirVariaveis, substituirVariaveisTexto } from "@/lib/textos-padrao/variaveis";
@@ -229,6 +231,21 @@ function SetorBlock({ setor, idx }: { setor: AepSetor; idx: number }) {
                     ))}
                   </ul>
                 )}
+                {setor.aiha_organizacional?.[k]?.nivel && (() => {
+                  const a = setor.aiha_organizacional[k]!;
+                  const c = COR_NIVEL_AIHA[a.nivel!];
+                  return (
+                    <p className="mt-0.5 text-[10px] text-gray-600">
+                      Probabilidade: <strong>{a.probabilidade}</strong> · Severidade: <strong>{a.severidade}</strong> · Nível:{" "}
+                      <span
+                        className="rounded px-1 font-bold"
+                        style={{ backgroundColor: c?.bg, color: c?.cor }}
+                      >
+                        {a.nivel}
+                      </span>
+                    </p>
+                  );
+                })()}
                 {obs && <p className="mt-0.5 text-[10px] italic text-gray-500">Obs.: {obs}</p>}
               </div>
             );
@@ -582,13 +599,14 @@ export default function AepLaudoPage({
                               <li key={s.id}>
                                 <strong>{s.nome_setor}</strong>
                                 {s.cargo && ` — ${s.cargo}`}
-                                {" — "}Risco máximo: <span className="font-semibold">{riscoMaximoSetor(s)}</span>
+                                {" — "}Maior nível AIHA (organizacional):{" "}
+                                <span className="font-semibold">{piorNivel(Object.values(s.aiha_organizacional ?? {}).map((a) => a?.nivel)) ?? "—"}</span>
                               </li>
                             ))}
                           </ul>
                         </div>
                         <p className="text-xs text-gray-600 leading-relaxed">
-                          Conforme NR-17 e NR-01 (GRO/PGR), a presença de riscos classificados como Alto ou Crítico, ou a convergência de múltiplos riscos Moderados, indica a necessidade de aprofundamento por meio da Análise Ergonômica do Trabalho completa, com avaliação postural (OWAS), análise biomecânica, medições ambientais e elaboração de laudo técnico detalhado.
+                          Conforme NR-17 e NR-01 (GRO/PGR), a identificação de fator psicossocial organizacional classificado como Alto ou Muito Alto na matriz AIHA, ou de dois ou mais fatores Moderados, indica a necessidade de aprofundamento por meio da Análise Ergonômica do Trabalho completa, com avaliação postural (OWAS), análise biomecânica, medições ambientais e elaboração de laudo técnico detalhado.
                         </p>
                       </>
                     ) : (
```

## H.2: diff de `app/(aep)/aep/formulario-branco/page.tsx`

```diff
@@ -207,8 +207,8 @@ function BlocoSetor({ indice, total }: { indice: number; total: number }) {
             <FbCaixa label="Não" />
           </div>
           <p className="fb-nota">
-            Marque <strong>Sim</strong> quando houver risco classificado como Alto ou Crítico, ou dois ou mais riscos Moderados
-            — é o critério que o sistema aplica sozinho ao digitar a matriz.
+            Marque <strong>Sim</strong> quando algum fator da Ergonomia Organizacional ficar Alto ou Muito Alto na matriz
+            AIHA, ou dois ou mais fatores ficarem Moderados — é o critério que o sistema aplica sozinho ao digitar.
           </p>
         </div>
       </FbSecao>
```

## I: `lib/aep/sinalizacao.ts` (novo, completo)

```ts
// Sinalização de Fatores Psicossociais — montagem pura dos dados (2026-10-02).
//
// Mesma organização da página Riscos Psicossociais: lista de EMPRESAS → página
// da empresa com cada AEP e, dentro dela, os SETORES com os fatores
// organizacionais marcados "Sim" (nível na matriz AIHA, probabilidade,
// severidade e sinais observados). Sem link para o editor da AEP, de propósito.

import { ITENS_ORGANIZACIONAL } from "@/lib/aep/checklist-itens";
import { rotulosDosSinais } from "@/lib/aep/sinais-organizacional";
import type { AepChecklistOrganizacional, AepRelatorio } from "@/lib/supabase/types";

/** Ordem de gravidade dos níveis da matriz — o mais grave primeiro. */
export const PESO_NIVEL: Record<string, number> = { "Muito Alto": 5, Alto: 4, Moderado: 3, Baixo: 2, Trivial: 1 };

export interface FatorSinalizado {
  key: string;
  label: string;
  /** null = sem sinal observado marcado (não calculado) ou AEP ainda não salva. */
  nivel: string | null;
  probabilidade: string | null;
  severidade: string | null;
  sinais: string[];
  observacao: string | null;
}

export interface SetorSinalizado {
  id: string;
  nome: string;
  fatores: FatorSinalizado[];
  pior: string | null;
}

export interface AvaliacaoSinalizada {
  idRelatorio: string;
  data: string | null;
  responsavel: string | null;
  status: string;
  setores: SetorSinalizado[];
}

export interface EmpresaSinalizada {
  idEmpresa: string;
  nome: string;
  cnpj: string | null;
  avaliacoes: AvaliacaoSinalizada[];
  totalSetores: number;
  totalAlertas: number;
  totalAltos: number;
  pior: string | null;
  ultimaData: string | null;
}

export function piorNivel(niveis: (string | null | undefined)[]): string | null {
  let pior: string | null = null;
  for (const n of niveis) {
    if (n && (PESO_NIVEL[n] ?? 0) > (PESO_NIVEL[pior ?? ""] ?? 0)) pior = n;
  }
  return pior;
}

export function montarSinalizacao(relatorios: AepRelatorio[]): EmpresaSinalizada[] {
  const porEmpresa = new Map<string, EmpresaSinalizada>();

  for (const rel of relatorios) {
    const setores: SetorSinalizado[] = (rel.setores ?? [])
      .map((setor) => {
        const cl = setor.checklist_organizacional as unknown as Record<string, string>;
        const fatores: FatorSinalizado[] = ITENS_ORGANIZACIONAL.filter(({ key }) => cl?.[key] === "sim")
          .map(({ key, label }) => {
            const a = setor.aiha_organizacional?.[key];
            return {
              key,
              label,
              nivel: a?.nivel ?? null,
              probabilidade: a?.nivel ? a.probabilidade : null,
              severidade: a?.nivel ? a.severidade : null,
              sinais: rotulosDosSinais(key as keyof AepChecklistOrganizacional, setor.sinais_organizacional),
              observacao: setor.observacoes_checklist?.[key]?.trim() || null,
            };
          })
          .sort((x, y) => (PESO_NIVEL[y.nivel ?? ""] ?? 0) - (PESO_NIVEL[x.nivel ?? ""] ?? 0));
        return {
          id: setor.id,
          nome: setor.nome_setor || "Setor sem nome",
          fatores,
          pior: piorNivel(fatores.map((f) => f.nivel)),
        };
      })
      .filter((s) => s.fatores.length > 0);

    if (setores.length === 0) continue;

    const id = rel.id_empresa;
    let alvo = porEmpresa.get(id);
    if (!alvo) {
      alvo = {
        idEmpresa: id,
        nome: rel.empresas?.nome_empresa ?? "Empresa sem cadastro",
        cnpj: rel.empresas?.cnpj ?? null,
        avaliacoes: [],
        totalSetores: 0,
        totalAlertas: 0,
        totalAltos: 0,
        pior: null,
        ultimaData: null,
      };
      porEmpresa.set(id, alvo);
    }
    alvo.avaliacoes.push({
      idRelatorio: rel.id_relatorio,
      data: rel.data_elaboracao,
      responsavel: rel.responsavel_elaboracao || null,
      status: rel.status,
      setores,
    });
  }

  const lista = [...porEmpresa.values()];
  for (const e of lista) {
    e.avaliacoes.sort((a, b) => (b.data ?? "").localeCompare(a.data ?? ""));
    const todos = e.avaliacoes.flatMap((a) => a.setores);
    e.totalSetores = todos.length;
    e.totalAlertas = todos.reduce((n, s) => n + s.fatores.length, 0);
    e.totalAltos = todos.reduce(
      (n, s) => n + s.fatores.filter((f) => f.nivel === "Alto" || f.nivel === "Muito Alto").length,
      0,
    );
    e.pior = piorNivel(todos.map((s) => s.pior));
    e.ultimaData = e.avaliacoes[0]?.data ?? null;
  }
  // Mais grave primeiro; empate pelo nome.
  return lista.sort(
    (a, b) => (PESO_NIVEL[b.pior ?? ""] ?? 0) - (PESO_NIVEL[a.pior ?? ""] ?? 0) || a.nome.localeCompare(b.nome, "pt-BR"),
  );
}
```

## I.2: `lib/aep/sinalizacao.test.ts` (novo, completo)

```ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { montarSinalizacao, piorNivel } from "./sinalizacao";
import type { AepRelatorio } from "@/lib/supabase/types";

function rel(id: string, empresa: string, data: string, setores: unknown[]): AepRelatorio {
  return {
    id_relatorio: id,
    id_empresa: empresa,
    status: "RASCUNHO",
    data_elaboracao: data,
    responsavel_elaboracao: "Fulano",
    empresas: { nome_empresa: "Empresa " + empresa, cnpj: null },
    setores,
  } as unknown as AepRelatorio;
}

const setorComAssedio = {
  id: "s1",
  nome_setor: "ADM",
  checklist_organizacional: { assedio: "sim", subcarga: "nao" },
  sinais_organizacional: { assedio: ["tom_agressivo"] },
  aiha_organizacional: { assedio: { probabilidade: "Exposição moderada", severidade: "Irreversíveis", nivel: "Moderado" } },
  observacoes_checklist: { assedio: " gritos " },
};

test("agrupa por empresa e só entra setor com fator Sim", () => {
  const r = montarSinalizacao([
    rel("A1", "E1", "2026-01-01", [setorComAssedio, { id: "s2", nome_setor: "X", checklist_organizacional: { assedio: "nao" } }]),
    rel("A2", "E1", "2026-03-01", [setorComAssedio]),
    rel("A3", "E2", "2026-02-01", [{ id: "s3", nome_setor: "Y", checklist_organizacional: { assedio: "nao" } }]),
  ]);
  assert.equal(r.length, 1);
  assert.equal(r[0].avaliacoes.length, 2);
  assert.equal(r[0].avaliacoes[0].idRelatorio, "A2"); // mais recente primeiro
  assert.equal(r[0].totalSetores, 2);
  assert.equal(r[0].pior, "Moderado");
});

test("fator traz rótulo, sinais, observação e nível", () => {
  const [e] = montarSinalizacao([rel("A1", "E1", "2026-01-01", [setorComAssedio])]);
  const f = e.avaliacoes[0].setores[0].fatores[0];
  assert.equal(f.label, "Assédio de qualquer natureza no trabalho");
  assert.deepEqual(f.sinais, ["Tom agressivo, irônico ou humilhante"]);
  assert.equal(f.observacao, "gritos");
  assert.equal(f.nivel, "Moderado");
});

test("fator sem nível calculado não mostra probabilidade/severidade", () => {
  const [e] = montarSinalizacao([
    rel("A1", "E1", "2026-01-01", [{
      ...setorComAssedio,
      aiha_organizacional: { assedio: { probabilidade: "Não há exposição", severidade: "Pouca importância", nivel: null } },
    }]),
  ]);
  const f = e.avaliacoes[0].setores[0].fatores[0];
  assert.equal(f.nivel, null);
  assert.equal(f.probabilidade, null);
});

test("pior nível", () => {
  assert.equal(piorNivel(["Baixo", null, "Alto", "Moderado"]), "Alto");
  assert.equal(piorNivel([null, undefined]), null);
});
```

## J: `components/aep/SeloNivelAiha.tsx` (novo, completo)

```tsx
"use client";

import { COR_NIVEL_AIHA } from "@/lib/aep/aiha-organizacional";
import { cn } from "@/lib/utils";

/** Selo do nível na matriz AIHA (cores da inspeção). null = "Não calculado". */
export default function SeloNivelAiha({ nivel, className }: { nivel: string | null; className?: string }) {
  if (!nivel) {
    return (
      <span
        className={cn("inline-block rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-[11px] text-gray-500", className)}
        title="Nenhum sinal observado marcado (ou AEP ainda não salva)"
      >
        Não calculado
      </span>
    );
  }
  const c = COR_NIVEL_AIHA[nivel as keyof typeof COR_NIVEL_AIHA];
  return (
    <span
      className={cn("inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold", className)}
      style={{ backgroundColor: c?.bg, color: c?.cor, borderColor: c?.borda }}
    >
      {nivel}
    </span>
  );
}
```

## K: `app/(sinalizacao-psicossocial)/sinalizacao-psicossocial/page.tsx` (novo, completo)

```tsx
"use client";

// Sinalização de Fatores Psicossociais — lista das empresas com fatores
// organizacionais marcados "Sim" nas triagens AEP. Mesma organização da página
// Riscos Psicossociais (2026-10-02): clicar abre a página da empresa, com os
// setores e o nível de cada fator na matriz AIHA. Sem link para o editor da AEP.

import { useMemo, useState } from "react";
import Link from "next/link";
import { Brain, Building2, ChevronRight, Search } from "lucide-react";
import { useAepRelatorios } from "@/lib/hooks/useAep";
import { montarSinalizacao } from "@/lib/aep/sinalizacao";
import SeloNivelAiha from "@/components/aep/SeloNivelAiha";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { buscar } from "@/lib/busca/texto";
import { cn, fmtData, formatCNPJ } from "@/lib/utils";

const inputCls =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/20";

export default function SinalizacaoPsicossocialPage() {
  const { data: relatorios = [], isLoading, error } = useAepRelatorios(null);
  const [busca, setBusca] = useState("");

  const empresas = useMemo(() => montarSinalizacao(relatorios), [relatorios]);
  const filtradas = useMemo(
    () => (busca.trim() ? buscar(empresas, busca, (e) => [e.nome, e.cnpj ?? ""]).itens : empresas),
    [empresas, busca],
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
          <Brain className="size-5 text-verde-primary" />
          Sinalização de Fatores Psicossociais
        </h1>
        <p className="text-sm text-gray-500">
          Empresas com fatores organizacionais identificados nas triagens AEP, com o nível na matriz AIHA. Clique na
          empresa para ver os fatores por setor.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar empresa ou CNPJ..."
            className={cn(inputCls, "pl-8")}
          />
        </div>
      </div>

      {isLoading ? (
        <LoadingSkeleton rows={6} />
      ) : error ? (
        <p className="rounded-2xl border border-red-100 bg-red-50 p-5 text-sm text-red-700">
          Não foi possível carregar as análises: {(error as Error).message}
        </p>
      ) : filtradas.length === 0 ? (
        <p className="rounded-2xl border border-gray-100 bg-white p-10 text-center text-sm text-gray-500 shadow-sm">
          {empresas.length === 0 ? "Nenhum fator psicossocial sinalizado nas análises AEP." : "Nenhuma empresa encontrada."}
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <ul className="divide-y divide-gray-100">
            {filtradas.map((e) => (
              <li key={e.idEmpresa}>
                <Link
                  href={`/sinalizacao-psicossocial/${encodeURIComponent(e.idEmpresa)}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50"
                >
                  <Building2 className="size-5 shrink-0 text-verde-primary" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-gray-900">{e.nome}</div>
                    <div className="text-xs text-gray-500">{e.cnpj ? formatCNPJ(e.cnpj) : "—"}</div>
                  </div>
                  <div className="hidden sm:block" title="Maior nível AIHA entre os fatores da empresa">
                    <SeloNivelAiha nivel={e.pior} />
                  </div>
                  <div className="hidden w-24 text-right text-sm text-gray-600 md:block">
                    {e.totalAlertas} alerta{e.totalAlertas !== 1 ? "s" : ""}
                  </div>
                  <div className="hidden w-24 text-right text-sm text-gray-600 md:block">
                    {e.totalSetores} setor{e.totalSetores !== 1 ? "es" : ""}
                  </div>
                  <div className="hidden w-28 text-right text-xs text-gray-500 md:block">
                    {e.ultimaData ? `AEP ${fmtData(e.ultimaData)}` : ""}
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-gray-400" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

## L: `app/(sinalizacao-psicossocial)/sinalizacao-psicossocial/[idEmpresa]/page.tsx` (novo, completo)

```tsx
"use client";

// Sinalização de Fatores Psicossociais de UMA empresa: dados cadastrais e, por
// AEP, um bloco por setor (um embaixo do outro) com os fatores organizacionais
// marcados "Sim" — Fator · Resultado final (AIHA) · Probabilidade · Severidade
// · Sinais observados. Mesmo formato da página Riscos Psicossociais; sem link
// para o editor da AEP, de propósito.

import { useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Building2, Layers } from "lucide-react";
import { useAepRelatorios } from "@/lib/hooks/useAep";
import { montarSinalizacao } from "@/lib/aep/sinalizacao";
import SeloNivelAiha from "@/components/aep/SeloNivelAiha";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { fmtData, formatCNPJ } from "@/lib/utils";

const STATUS_ROTULO: Record<string, string> = { RASCUNHO: "Rascunho", CONCLUIDO: "Concluída" };

interface EmpresaCadastro {
  nome_empresa: string | null;
  razao_social: string | null;
  nome_fantasia: string | null;
  cnpj: string | null;
  cnae_principal: string | null;
  cnae_descricao: string | null;
  grau_risco: number | string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  cep: string | null;
  telefone: string | null;
  email: string | null;
}

function Info({ rotulo, valor, className }: { rotulo: string; valor: string | null | undefined; className?: string }) {
  return (
    <div className={className}>
      <div className="text-xs text-gray-500">{rotulo}</div>
      <div className="text-sm text-gray-900">{valor && valor.trim() ? valor : "—"}</div>
    </div>
  );
}

export default function SinalizacaoEmpresaPage() {
  const { idEmpresa: bruto } = useParams<{ idEmpresa: string }>();
  const idEmpresa = decodeURIComponent(bruto);
  const { data: relatorios = [], isLoading } = useAepRelatorios(idEmpresa);
  const sinal = useMemo(() => montarSinalizacao(relatorios)[0] ?? null, [relatorios]);

  const { data: cadastro } = useQuery({
    queryKey: ["sinalizacao-empresa", idEmpresa],
    queryFn: async (): Promise<EmpresaCadastro | null> => {
      const { data, error } = await createSupabaseBrowserClient()
        .from("empresas")
        .select(
          "nome_empresa, razao_social, nome_fantasia, cnpj, cnae_principal, cnae_descricao, grau_risco, logradouro, numero, complemento, bairro, municipio, uf, cep, telefone, email"
        )
        .eq("id_empresa", idEmpresa)
        .maybeSingle();
      if (error) throw error;
      return data as EmpresaCadastro | null;
    },
  });

  const endereco = cadastro
    ? [
        [cadastro.logradouro, cadastro.numero].filter(Boolean).join(", "),
        cadastro.complemento,
        cadastro.bairro,
        cadastro.municipio && cadastro.uf ? `${cadastro.municipio}/${cadastro.uf}` : cadastro.municipio,
        cadastro.cep ? `CEP ${cadastro.cep}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/sinalizacao-psicossocial"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-verde-primary"
        >
          <ArrowLeft className="size-4" /> Voltar às empresas
        </Link>
        <h1 className="mt-1 flex items-center gap-2 text-xl font-bold text-gray-900">
          <Building2 className="size-5 text-verde-primary" />
          {cadastro?.nome_empresa ?? sinal?.nome ?? "Empresa"}
        </h1>
        <p className="text-sm text-gray-500">
          Fatores psicossociais por setor nas triagens AEP — resultado na matriz AIHA.
        </p>
      </div>

      {/* Dados da empresa */}
      <div className="grid gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <Info rotulo="Razão social" valor={cadastro?.razao_social} className="sm:col-span-2" />
        <Info rotulo="Nome fantasia" valor={cadastro?.nome_fantasia} />
        <Info rotulo="CNPJ" valor={cadastro?.cnpj ? formatCNPJ(cadastro.cnpj) : null} />
        <Info
          rotulo="CNAE principal"
          valor={[cadastro?.cnae_principal, cadastro?.cnae_descricao].filter(Boolean).join(" — ")}
          className="sm:col-span-2"
        />
        <Info rotulo="Grau de risco" valor={cadastro?.grau_risco != null ? String(cadastro.grau_risco) : null} />
        <Info rotulo="Telefone" valor={cadastro?.telefone} />
        <Info rotulo="Endereço" valor={endereco} className="sm:col-span-2 lg:col-span-3" />
        <Info rotulo="E-mail" valor={cadastro?.email} />
      </div>

      {isLoading ? (
        <LoadingSkeleton rows={6} />
      ) : !sinal ? (
        <p className="rounded-2xl border border-gray-100 bg-white p-10 text-center text-sm text-gray-500 shadow-sm">
          Esta empresa não tem fator psicossocial sinalizado nas análises AEP.
        </p>
      ) : (
        sinal.avaliacoes.map((a) => (
          <section key={a.idRelatorio} className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">AEP</span>
              <h2 className="text-base font-semibold text-gray-900">Análise Ergonômica Preliminar</h2>
              <span className="text-xs text-gray-500">
                {STATUS_ROTULO[a.status] ?? a.status}
                {a.data ? ` · ${fmtData(a.data)}` : ""}
                {a.responsavel ? ` · ${a.responsavel}` : ""}
              </span>
            </div>

            <div className="space-y-4">
              {a.setores.map((s) => (
                <div key={s.id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="flex items-center gap-2 font-semibold text-gray-900">
                      <Layers className="size-4 text-verde-primary" /> {s.nome}
                    </h3>
                    <span className="inline-flex items-center gap-2 text-xs text-gray-500">
                      {s.fatores.length} fator{s.fatores.length !== 1 ? "es" : ""}
                      <SeloNivelAiha nivel={s.pior} />
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[860px] border-collapse text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                          <th className="w-64 border border-gray-200 px-3 py-2 font-medium">Fator de risco</th>
                          <th className="w-32 border border-gray-200 px-3 py-2 font-medium">Resultado final</th>
                          <th className="w-44 border border-gray-200 px-3 py-2 font-medium">Probabilidade</th>
                          <th className="w-40 border border-gray-200 px-3 py-2 font-medium">Severidade</th>
                          <th className="border border-gray-200 px-3 py-2 font-medium">Sinais observados</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.fatores.map((f) => (
                          <tr key={f.key}>
                            <td className="border border-gray-200 px-3 py-2 align-top text-gray-800">
                              {f.label}
                              {f.observacao && (
                                <div className="mt-1 text-xs italic text-gray-500">Obs.: {f.observacao}</div>
                              )}
                            </td>
                            <td className="border border-gray-200 px-3 py-2 align-top">
                              <SeloNivelAiha nivel={f.nivel} />
                            </td>
                            <td className="border border-gray-200 px-3 py-2 align-top text-gray-700">{f.probabilidade ?? "—"}</td>
                            <td className="border border-gray-200 px-3 py-2 align-top text-gray-700">{f.severidade ?? "—"}</td>
                            <td className="border border-gray-200 px-3 py-2 align-top">
                              {f.sinais.length === 0 ? (
                                <span className="text-sm text-gray-400">Nenhum sinal marcado</span>
                              ) : (
                                <ul className="list-disc space-y-0.5 pl-4 text-sm text-gray-700">
                                  {f.sinais.map((x) => (
                                    <li key={x}>{x}</li>
                                  ))}
                                </ul>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
```

