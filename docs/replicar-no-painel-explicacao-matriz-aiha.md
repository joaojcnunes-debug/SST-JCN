# Replicar no Painel SST: explicação da matriz AIHA (página, Ajuda, Sinalização e Texto Padrão)

> **Como usar:** abra o Claude Code na pasta do **painel-sst** e diga:
> *"Siga o arquivo `replicar-no-painel-explicacao-matriz-aiha.md`"*.
>
> Origem: JCN (`sst-jcn`), commits `1c9e7ec`, `1d5b9f2` e `dbfd1b6` de 2026-10-05, já em produção lá.
> Tudo o que foi feito nesse dia está aqui. **Mexe no banco só para inserir um
> capítulo de Texto Padrão** (Passo 3); não há migration de schema.

> **Atualizado em 2026-10-05:** o item "5. Limites da avaliação" (componente) e o
> último parágrafo do capítulo do Texto Padrão (SQL) passaram a ter o texto
> definido pelo RT, em três parágrafos (triagem preliminar; DRPS/Questionário
> complementar; revisão conforme NR-01). Se o painel já aplicou a versão
> anterior deste MD, troque só esses dois trechos: o JSX da seção 5 em
> `ExplicacaoMatrizAiha.tsx` e, no banco do painel, o último `<p>` do capítulo
> "Avaliação dos Fatores Psicossociais — Matriz de Risco AIHA" (por SQL
> `replace` ou pela tela Texto Padrão › AEP).

## Pré-requisitos (aplicar antes, se o painel ainda não tiver)

Este MD continua dois anteriores. Confira se já foram aplicados no painel:

1. `replicar-no-painel-aep-matriz-aiha.md`: a regra AIHA da Ergonomia
   Organizacional (`lib/aep/aiha-organizacional.ts` com `SEVERIDADE_PADRAO_IDX`),
   `lib/aep/sinalizacao.ts`, `SeloNivelAiha` e a Sinalização por empresa.
2. `replicar-no-painel-aep-menu-painel-sst.md`: os componentes
   `SinalizacaoEmpresasLista` / `SinalizacaoEmpresaDetalhe` e a página
   `/aep-psicossocial` no menu do Painel SST.

## O que faz

Um quadro **"Entenda a matriz de risco AIHA na Ergonomia Organizacional"**
(`components/aep/ExplicacaoMatrizAiha.tsx`) com a explicação técnica e normativa
de como o nível de cada fator psicossocial é calculado:

1. **O que é a matriz AIHA:** metodologia da American Industrial Hygiene
   Association. Nível = peso da probabilidade × peso da severidade, de 0 a 4 cada.
2. **Fundamentação normativa:**
   - NR-01, itens 1.5.3.1.4, 1.5.4.4.2 e 1.5.4.4.3;
   - NR-17, itens 17.3.1, 17.3.1.1 e 17.3.2;
   - Guia do MTE sobre fatores psicossociais, ISO 45003 e ISO 31000.
3. **Como o sistema aplica:** sem sinal = Trivial; probabilidade pela proporção
   de sinais; severidade padrão por fator; ajuste manual; critério de AET.
4. **A matriz ativa** desenhada em grade 5×5 colorida, com as faixas.
5. **Limites da triagem.**

As tabelas e a grade são **lidas do sistema** (`useMatrizAtiva`,
`calcularNivelComMatriz`, `SEVERIDADE_PADRAO_IDX`, `ITENS_ORGANIZACIONAL`,
`SINAIS_ORGANIZACIONAL`), então acompanham qualquer mudança.

O quadro aparece em quatro lugares:

| Onde | Como |
|---|---|
| **Matriz AIHA**, página nova no menu do módulo AEP (`/aep/matriz-aiha`, entre "Sinalização Psicoss." e "Ajuda") | sempre aberto (`fixo`) |
| **Ajuda da AEP** (`/aep/ajuda`), logo depois de Ergonomia Organizacional | recolhível; aberto na impressão |
| **Sinalização Psicoss.** do módulo AEP (`/sinalizacao-psicossocial`), acima da busca | recolhível |
| Página **AEP** do menu do Painel SST (`/aep-psicossocial`), acima da busca | recolhível |

O mesmo conteúdo também vai para o **laudo/PDF da AEP** por um capítulo
**editável** do Texto Padrão da AEP: "Avaliação dos Fatores Psicossociais —
Matriz de Risco AIHA", na ordem 2, logo após a Metodologia. Por ser texto fixo
em HTML, ele **não acompanha sozinho** mudanças na matriz.

> ⚠️ Os números dos itens da NR-01 e da NR-17 devem ser **conferidos pelo
> Responsável Técnico** com a versão vigente das normas. No capítulo do Texto
> Padrão isso se ajusta pela tela; no componente, pelo código.

## Passo 1: conferir o painel

| Usado pelo código | Conferir no painel |
|---|---|
| `useMatrizAtiva` (`lib/hooks/useV3.ts`), `calcularNivelComMatriz` (`lib/calc.ts`), `NIVEL_CONFIG` (`lib/constants.ts`) | mesmos nomes |
| `ITENS_ORGANIZACIONAL` (`lib/aep/checklist-itens.ts`) e `SINAIS_ORGANIZACIONAL` (`lib/aep/sinais-organizacional.ts`) | mesmos nomes |
| `SEVERIDADE_PADRAO_IDX` e `FatorOrganizacional` (`lib/aep/aiha-organizacional.ts`) | vêm do pré-requisito 1 |
| Menu do módulo AEP em `app/(aep)/layout.tsx` (lista de itens + `isConfigPage`) | se o menu do painel for outro arquivo, adicione o item lá |
| Ajuda em `app/(aep)/aep/ajuda/page.tsx`, com `CategoriaChecklist` da Organizacional e `printMode` | se não houver `printMode`, use só `<ExplicacaoMatrizAiha />` |
| Tabela `textos_padrao` (colunas `id_capitulo, modulo, titulo, conteudo, ordem, tipo, slug_fixo, ativo, created_at`) | mesmas colunas; veja a ordem dos capítulos da AEP no painel antes de inserir |

## Passo 2: código

| Arquivo | O quê | Seção |
|---|---|---|
| `components/aep/ExplicacaoMatrizAiha.tsx` | **novo**: o quadro completo | A |
| `components/aep/SinalizacaoEmpresasLista.tsx` | prop `extra` (bloco entre o cabeçalho e a busca) | B |
| `app/(app)/aep-psicossocial/page.tsx` | passa o quadro em `extra` | C |
| `app/(sinalizacao-psicossocial)/sinalizacao-psicossocial/page.tsx` | passa o quadro em `extra` | D |
| `app/(aep)/aep/ajuda/page.tsx` | quadro após Ergonomia Organizacional | E |
| `app/(aep)/aep/matriz-aiha/page.tsx` | **novo**: página só com o quadro | F |
| `app/(aep)/layout.tsx` | item **Matriz AIHA** no menu | G |

### A: `components/aep/ExplicacaoMatrizAiha.tsx` (novo, completo)

```tsx
"use client";

// Explicação técnica e normativa da matriz de risco AIHA aplicada aos fatores
// da Ergonomia Organizacional da AEP (página AEP do Painel SST, 2026-10-05).
// Aparece também na Ajuda e na Sinalização do módulo AEP. A matriz, as faixas e as severidades padrão são lidas do sistema (matriz
// ativa + SEVERIDADE_PADRAO_IDX), para o texto nunca divergir do cálculo.

import { useState } from "react";
import { BookOpen, ChevronDown } from "lucide-react";
import { useMatrizAtiva } from "@/lib/hooks/useV3";
import { calcularNivelComMatriz } from "@/lib/calc";
import { NIVEL_CONFIG } from "@/lib/constants";
import { ITENS_ORGANIZACIONAL } from "@/lib/aep/checklist-itens";
import { SEVERIDADE_PADRAO_IDX, type FatorOrganizacional } from "@/lib/aep/aiha-organizacional";
import { SINAIS_ORGANIZACIONAL } from "@/lib/aep/sinais-organizacional";
import type { NivelRisco } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

function Selo({ nivel }: { nivel: string }) {
  const cfg = NIVEL_CONFIG[nivel as NivelRisco];
  return (
    <span
      className="inline-block rounded-full border px-2 py-0.5 text-xs font-semibold"
      style={cfg ? { color: cfg.cor, backgroundColor: cfg.bg, borderColor: cfg.borda } : undefined}
    >
      {nivel}
    </span>
  );
}

function Titulo({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 mt-5 text-sm font-bold text-gray-900 first:mt-0">{children}</h3>;
}

const th = "border border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500";
const td = "border border-gray-200 px-3 py-2 align-top text-sm text-gray-700";

export default function ExplicacaoMatrizAiha({
  abertoInicial = false,
  fixo = false,
}: {
  abertoInicial?: boolean;
  /** Página própria: sempre aberto, sem o botão de recolher. */
  fixo?: boolean;
}) {
  const [estado, setAberto] = useState(abertoInicial);
  const aberto = fixo || estado;
  const { data: matriz } = useMatrizAtiva();

  const probs = matriz?.probabilidades ?? [];
  const sevs = matriz?.severidades ?? [];
  const rotuloProb = (i: number) => probs[Math.min(i, probs.length - 1)] ?? "—";

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => !fixo && setAberto((v) => !v)}
        className={cn("flex w-full items-center gap-3 px-5 py-4 text-left", fixo && "cursor-default")}
        aria-expanded={aberto}
      >
        <BookOpen className="size-5 shrink-0 text-verde-primary" />
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-gray-900">Entenda a matriz de risco AIHA na Ergonomia Organizacional</div>
          <div className="text-xs text-gray-500">
            Fundamentação técnica e normativa de como o nível de cada fator psicossocial é calculado.
          </div>
        </div>
        {!fixo && <ChevronDown className={cn("size-4 shrink-0 text-gray-400 transition-transform", aberto && "rotate-180")} />}
      </button>

      {aberto && (
        <div className="border-t border-gray-100 px-5 py-5 text-sm leading-relaxed text-gray-700">
          <Titulo>1. O que é a matriz AIHA</Titulo>
          <p>
            É a matriz qualitativa de avaliação de riscos difundida pela <strong>AIHA — American Industrial Hygiene
            Association</strong> na metodologia <em>A Strategy for Assessing and Managing Occupational Exposures</em>.
            O nível de risco resulta da combinação de duas dimensões, cada uma graduada em 5 níveis com peso de 0 a 4:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong>Probabilidade</strong> (grau de exposição): de “{probs[0] ?? "Não há exposição"}” a “
              {probs[probs.length - 1] ?? "Exposição elevadíssima"}”.
            </li>
            <li>
              <strong>Severidade</strong> (gravidade do efeito à saúde): de “{sevs[0] ?? "Pouca importância"}” a “
              {sevs[sevs.length - 1] ?? "Ameaça"}”.
            </li>
          </ul>
          <p className="mt-2">
            <strong>Nível de risco = peso da probabilidade × peso da severidade</strong>. O produto (0 a 16) é enquadrado
            nas faixas da matriz. Na Ergonomia Organizacional, a “exposição” é a presença dos{" "}
            <strong>sinais observados</strong> de cada fator e a “severidade” é a gravidade potencial do agravo à saúde
            mental que o fator pode causar.
          </p>

          <Titulo>2. Fundamentação normativa</Titulo>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong>NR-01, item 1.5.3.1.4</strong> (redação da Portaria MTE nº 1.419/2024): o Gerenciamento de Riscos
              Ocupacionais (GRO) deve abranger os riscos relacionados aos fatores ergonômicos,{" "}
              <strong>incluindo os fatores de risco psicossociais relacionados ao trabalho</strong>.
            </li>
            <li>
              <strong>NR-01, item 1.5.4.4.2</strong>: para cada risco deve ser indicado o nível de risco ocupacional,{" "}
              <strong>determinado pela combinação da severidade</strong> das possíveis lesões ou agravos à saúde{" "}
              <strong>com a probabilidade</strong> de sua ocorrência — exatamente a lógica da matriz.
            </li>
            <li>
              <strong>NR-01, item 1.5.4.4.3</strong>: a organização seleciona as ferramentas e técnicas de avaliação
              adequadas ao risco; a matriz AIHA é a ferramenta adotada pela JCN, a mesma usada no inventário de riscos
              da inspeção.
            </li>
            <li>
              <strong>NR-17, item 17.3.1 e 17.3.1.1</strong>: a Avaliação Ergonômica Preliminar (AEP) pode ser feita por
              abordagens qualitativas, semiquantitativas, quantitativas ou combinadas — a matriz é uma abordagem
              semiquantitativa.
            </li>
            <li>
              <strong>NR-17, item 17.3.2</strong>: a Análise Ergonômica do Trabalho (AET) deve ser realizada quando a
              AEP indicar necessidade de avaliação mais aprofundada — base do critério “Necessita AET” (item 3.6).
            </li>
            <li>
              Referências técnicas complementares: <strong>Guia de Informações sobre os Fatores de Riscos
              Psicossociais Relacionados ao Trabalho (MTE)</strong>, <strong>ISO 45003:2021</strong> (saúde e
              segurança psicológica no trabalho) e <strong>ISO 31000</strong> (gestão de riscos).
            </li>
          </ul>

          <Titulo>3. Como o sistema aplica a matriz</Titulo>
          <p>
            <strong>3.1 Fator marcado “Sim”.</strong> Só os fatores apontados na triagem entram na matriz; para cada um
            o técnico marca os sinais observados.
          </p>
          <p className="mt-2">
            <strong>3.2 Sem sinal marcado.</strong> O fator fica nos níveis mais baixos da matriz (“
            {probs[0] ?? "Não há exposição"}” × “{sevs[0] ?? "Pouca importância"}”), com resultado{" "}
            <Selo nivel="Trivial" />. Sem evidência registrada não há como graduar a exposição.
          </p>
          <p className="mt-2">
            <strong>3.3 Probabilidade sugerida</strong> pela proporção de sinais marcados sobre o total de sinais do
            fator (quanto mais evidências, maior a exposição):
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse">
              <thead>
                <tr>
                  <th className={th}>Sinais marcados</th>
                  <th className={th}>Probabilidade</th>
                  <th className={th}>Peso</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Nenhum", 0],
                  ["Até 1/3 dos sinais", 2],
                  ["Acima de 1/3 até 2/3", 3],
                  ["Acima de 2/3", 4],
                ].map(([faixa, idx]) => (
                  <tr key={faixa as string}>
                    <td className={td}>{faixa}</td>
                    <td className={td}>{rotuloProb(idx as number)}</td>
                    <td className={td}>{matriz?.pesos_prob?.[idx as number] ?? idx}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Com o 1º sinal a probabilidade já parte do nível intermediário: um sinal psicossocial observado em campo
            indica exposição real, não apenas eventual.
          </p>

          <p className="mt-3">
            <strong>3.4 Severidade padrão por fator</strong>, definida pela gravidade potencial do agravo à saúde mental
            (ex.: assédio e eventos traumáticos podem gerar dano duradouro):
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse">
              <thead>
                <tr>
                  <th className={th}>Fator organizacional</th>
                  <th className={th}>Sinais</th>
                  <th className={th}>Severidade padrão</th>
                </tr>
              </thead>
              <tbody>
                {[...ITENS_ORGANIZACIONAL]
                  .sort(
                    (a, b) =>
                      (SEVERIDADE_PADRAO_IDX[b.key as FatorOrganizacional] ?? 1) -
                      (SEVERIDADE_PADRAO_IDX[a.key as FatorOrganizacional] ?? 1),
                  )
                  .map((f) => {
                    const idx = SEVERIDADE_PADRAO_IDX[f.key as FatorOrganizacional] ?? 1;
                    return (
                      <tr key={f.key}>
                        <td className={td}>{f.label}</td>
                        <td className={td}>{SINAIS_ORGANIZACIONAL[f.key as FatorOrganizacional]?.length ?? 0}</td>
                        <td className={td}>
                          {sevs[idx] ?? "—"} <span className="text-xs text-gray-400">(peso {matriz?.pesos_sev?.[idx] ?? idx})</span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          <p className="mt-3">
            <strong>3.5 Julgamento do técnico.</strong> Probabilidade e severidade são sugestões: o profissional pode
            alterá-las com base no que observou. A alteração fica registrada como manual e pode voltar à sugestão a
            qualquer momento.
          </p>
          <p className="mt-2">
            <strong>3.6 Necessita AET.</strong> O setor recebe a indicação de AET completa (NR-17, 17.3.2) quando há{" "}
            <strong>1 fator organizacional</strong> <Selo nivel="Alto" /> ou <Selo nivel="Muito Alto" />, ou{" "}
            <strong>2 ou mais fatores</strong> <Selo nivel="Moderado" />.
          </p>

          <Titulo>4. Matriz ativa no sistema</Titulo>
          {!matriz ? (
            <p className="text-gray-500">Matriz de risco não carregada.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse">
                  <thead>
                    <tr>
                      <th className={th}>Probabilidade ↓ / Severidade →</th>
                      {sevs.map((s, j) => (
                        <th key={s} className={th}>
                          {s} <span className="normal-case text-gray-400">({matriz.pesos_sev?.[j] ?? j})</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {probs.map((p, i) => (
                      <tr key={p}>
                        <td className={cn(td, "font-medium")}>
                          {p} <span className="text-xs text-gray-400">({matriz.pesos_prob?.[i] ?? i})</span>
                        </td>
                        {sevs.map((s, j) => {
                          const nivel = calcularNivelComMatriz(p, s, matriz);
                          const cfg = NIVEL_CONFIG[nivel];
                          const score =
                            matriz.pesos_prob && matriz.pesos_sev ? matriz.pesos_prob[i] * matriz.pesos_sev[j] : null;
                          return (
                            <td
                              key={s}
                              className="border border-gray-200 px-2 py-2 text-center text-xs font-semibold"
                              style={cfg ? { color: cfg.cor, backgroundColor: cfg.bg } : undefined}
                            >
                              {nivel}
                              {score != null && <div className="font-normal opacity-80">{score}</div>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {matriz.faixas && matriz.faixas.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {matriz.faixas.map((f) => (
                    <span key={f.nivel} className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                      <Selo nivel={f.nivel} />
                      {f.min === f.max ? f.min : f.max >= 100 ? `≥ ${f.min}` : `${f.min}–${f.max}`}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}

          <Titulo>5. Limites da avaliação</Titulo>
          {/* Texto definido pelo RT em 2026-10-05. */}
          <p>
            A AEP constitui uma <strong>triagem preliminar</strong>, voltada à identificação e priorização de fatores e
            setores que demandam maior atenção. Seu resultado não substitui a AET e deve ser compreendido a partir das
            condições observadas no ambiente de trabalho.
          </p>
          <p className="mt-2">
            O <strong>DRPS/Questionário Psicossocial</strong> possui caráter complementar, contribuindo para ampliar a
            compreensão dos riscos psicossociais a partir de uma perspectiva mais personalizada, considerando como os
            próprios trabalhadores percebem e vivenciam suas condições de trabalho.
          </p>
          <p className="mt-2">
            Os resultados da AEP dependem da qualidade das observações registradas e devem ser revistos sempre que houver
            mudanças nas condições de trabalho, conforme previsto na NR-01 e na revisão do inventário de riscos.
          </p>
        </div>
      )}
    </div>
  );
}
```

### B: diff de `components/aep/SinalizacaoEmpresasLista.tsx`

```diff
@@ -7,7 +7,7 @@
 // (módulo AEP) e em /aep-psicossocial (menu do Painel SST); `basePath` diz
 // para onde vai o clique na empresa.
 
-import { useMemo, useState } from "react";
+import { useMemo, useState, type ReactNode } from "react";
 import Link from "next/link";
 import { Brain, Building2, ChevronRight, Search } from "lucide-react";
 import { useAepRelatorios } from "@/lib/hooks/useAep";
@@ -23,9 +23,12 @@ const inputCls =
 export default function SinalizacaoEmpresasLista({
   basePath,
   titulo = "Sinalização de Fatores Psicossociais",
+  extra,
 }: {
   basePath: string;
   titulo?: string;
+  /** Bloco opcional entre o cabeçalho e a busca (ex.: explicação da matriz). */
+  extra?: ReactNode;
 }) {
   const { data: relatorios = [], isLoading, error } = useAepRelatorios(null);
   const [busca, setBusca] = useState("");
@@ -49,6 +52,8 @@ export default function SinalizacaoEmpresasLista({
         </p>
       </div>
 
+      {extra}
+
       <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
         <div className="relative">
           <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
```

### C: `app/(app)/aep-psicossocial/page.tsx` (completo)

```tsx
"use client";

// AEP no menu do Painel SST (2026-10-02): a mesma lista da Sinalização de
// Fatores Psicossociais do módulo AEP, ao lado de Riscos Psicossociais.

import SinalizacaoEmpresasLista from "@/components/aep/SinalizacaoEmpresasLista";
import ExplicacaoMatrizAiha from "@/components/aep/ExplicacaoMatrizAiha";

export default function AepPsicossocialPage() {
  return (
    <SinalizacaoEmpresasLista
      basePath="/aep-psicossocial"
      titulo="AEP — Fatores Psicossociais"
      extra={<ExplicacaoMatrizAiha />}
    />
  );
}
```

### D: `app/(sinalizacao-psicossocial)/sinalizacao-psicossocial/page.tsx` (completo)

```tsx
"use client";

// Sinalização de Fatores Psicossociais (módulo AEP) — lista de empresas.

import SinalizacaoEmpresasLista from "@/components/aep/SinalizacaoEmpresasLista";
import ExplicacaoMatrizAiha from "@/components/aep/ExplicacaoMatrizAiha";

export default function SinalizacaoPsicossocialPage() {
  return <SinalizacaoEmpresasLista basePath="/sinalizacao-psicossocial" extra={<ExplicacaoMatrizAiha />} />;
}
```

### E: diff de `app/(aep)/aep/ajuda/page.tsx`

```diff
@@ -25,6 +25,7 @@ import {
 } from "lucide-react";
 import { useState, useCallback } from "react";
 import AjudaComAbas from "@/components/novidades/AjudaComAbas";
+import ExplicacaoMatrizAiha from "@/components/aep/ExplicacaoMatrizAiha";
 
 // ─── Tipos ─────────────────────────────────────────────────────────────────────
 
@@ -699,6 +700,9 @@ function ConteudoAepAjudaPage() {
         forceOpen={printMode}
       />
 
+      {/* Matriz AIHA dos fatores organizacionais — fundamentação técnica e normativa */}
+      <ExplicacaoMatrizAiha key={printMode ? "print" : "tela"} abertoInicial={printMode} />
+
       {/* Parecer */}
       <div>
         <div className="mb-4 flex items-center gap-3">
```

### F: `app/(aep)/aep/matriz-aiha/page.tsx` (novo, completo)

```tsx
"use client";

// Matriz AIHA (módulo AEP, 2026-10-05): página própria só com a explicação
// técnica e normativa da matriz aplicada à Ergonomia Organizacional. O mesmo
// texto vai para o laudo pelo capítulo editável do Texto Padrão da AEP.

import ExplicacaoMatrizAiha from "@/components/aep/ExplicacaoMatrizAiha";

export default function MatrizAihaPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <ExplicacaoMatrizAiha fixo />
    </div>
  );
}
```

### G: diff de `app/(aep)/layout.tsx`

```diff
@@ -7,6 +7,7 @@ import {
   ClipboardCheck,
   ClipboardPen,
   HelpCircle,
+  Grid3x3,
   Info,
   LayoutDashboard,
   List,
@@ -31,7 +32,7 @@ export default function AepLayout({ children }: { children: ReactNode }) {
 
   const match = pathname.match(/\/aep\/([^/]+)\//);
   const idRelatorio = match?.[1];
-  const isConfigPage = ["dashboard", "novo", "formulario-branco", "texto-padrao", "ajuda"].includes(idRelatorio ?? "");
+  const isConfigPage = ["dashboard", "novo", "formulario-branco", "texto-padrao", "ajuda", "matriz-aiha"].includes(idRelatorio ?? "");
 
   const sections = useMemo<NavSection[]>(() => {
     const base: NavSection[] = [
@@ -43,6 +44,7 @@ export default function AepLayout({ children }: { children: ReactNode }) {
           { href: "/aep/novo",                  label: "Nova Análise",         icon: Plus, variant: "action" },
           { href: "/aep/formulario-branco",     label: "Formulário em Branco", icon: ClipboardPen },
           { href: "/sinalizacao-psicossocial",  label: "Sinalização Psicoss.", icon: Brain },
+          { href: "/aep/matriz-aiha",           label: "Matriz AIHA",          icon: Grid3x3 },
           { href: "/aep/ajuda",                 label: "Ajuda",                icon: HelpCircle },
         ],
       },
```

## Passo 3: capítulo no Texto Padrão da AEP (banco do painel)

Rode no **banco do painel**, nunca no do JCN. O SQL só insere o capítulo se
ainda não existir um com o mesmo título.

- Ajuste a `ordem` (`2`) para ficar logo depois da Metodologia no painel.
- O HTML usa as faixas e os rótulos da matriz AIHA do JCN. Se a matriz do
  painel for outra, ajuste as tabelas antes de rodar, ou edite depois em
  Texto Padrão › AEP.
- Se o Texto Padrão da AEP do painel não tiver as **seções do sistema**
  (Indicadores de AET, Triagem por Setor, Considerações e Encaminhamentos,
  Assinatura), o laudo sai sem os dados da análise. Recrie-as pelo botão de
  seções do sistema em Texto Padrão › AEP. No JCN elas estavam faltando.

```sql
-- 2026-10-05: capítulo editável do Texto Padrão da AEP com a fundamentação
-- técnica e normativa da matriz AIHA (Ergonomia Organizacional), logo após a
-- Metodologia. Já executado via MCP.
-- ROLLBACK: delete from textos_padrao where modulo='aep' and titulo='Avaliação dos Fatores Psicossociais — Matriz de Risco AIHA';
insert into textos_padrao (id_capitulo, modulo, titulo, conteudo, ordem, tipo, slug_fixo, ativo, created_at)
select 'TXT-' || upper(substr(md5(random()::text || 'aiha'), 1, 8)), 'aep', 'Avaliação dos Fatores Psicossociais — Matriz de Risco AIHA', $html$<p style="text-align: justify">Os fatores de risco psicossociais da Ergonomia Organizacional identificados na triagem foram classificados pela <strong>matriz de risco AIHA</strong> (American Industrial Hygiene Association — metodologia <em>A Strategy for Assessing and Managing Occupational Exposures</em>), a mesma ferramenta adotada no inventário de riscos ocupacionais. O nível de risco resulta da combinação de duas dimensões, cada uma graduada em cinco níveis com peso de 0 a 4: a <strong>probabilidade</strong> (grau de exposição, representado pelos sinais observados do fator) e a <strong>severidade</strong> (gravidade potencial do agravo à saúde mental). <strong>Nível de risco = peso da probabilidade × peso da severidade.</strong></p><h3>Fundamentação normativa</h3><ul><li><strong>NR-01, item 1.5.3.1.4</strong> (Portaria MTE nº 1.419/2024): o Gerenciamento de Riscos Ocupacionais abrange os fatores ergonômicos, incluindo os fatores de risco psicossociais relacionados ao trabalho.</li><li><strong>NR-01, item 1.5.4.4.2</strong>: o nível de risco ocupacional é determinado pela combinação da severidade das possíveis lesões ou agravos à saúde com a probabilidade de sua ocorrência.</li><li><strong>NR-01, item 1.5.4.4.3</strong>: a organização seleciona as ferramentas e técnicas de avaliação adequadas ao risco.</li><li><strong>NR-17, itens 17.3.1 e 17.3.1.1</strong>: a Avaliação Ergonômica Preliminar pode utilizar abordagens qualitativas, semiquantitativas, quantitativas ou combinadas.</li><li><strong>NR-17, item 17.3.2</strong>: a Análise Ergonômica do Trabalho deve ser realizada quando a avaliação preliminar indicar necessidade de aprofundamento.</li><li>Referências complementares: Guia de Informações sobre os Fatores de Riscos Psicossociais Relacionados ao Trabalho (MTE), ISO 45003:2021 e ISO 31000.</li></ul><h3>Critérios de aplicação</h3><p style="text-align: justify">Entram na matriz apenas os fatores apontados como presentes na triagem. Sem sinal observado registrado, o fator permanece nos níveis mais baixos (“Não há exposição” × “Pouca importância”), com resultado <strong>Trivial</strong>. A probabilidade é sugerida pela proporção de sinais observados sobre o total de sinais do fator; a severidade parte de um valor padrão por fator. Ambas podem ser ajustadas pelo profissional responsável com base no que foi observado em campo.</p><table><thead><tr><th>Sinais observados</th><th>Probabilidade</th><th>Peso</th></tr></thead><tbody><tr><td>Nenhum</td><td>Não há exposição</td><td>0</td></tr><tr><td>Até 1/3 dos sinais</td><td>Exposição moderada</td><td>2</td></tr><tr><td>Acima de 1/3 até 2/3</td><td>Exposição elevada</td><td>3</td></tr><tr><td>Acima de 2/3</td><td>Exposição elevadíssima</td><td>4</td></tr></tbody></table><table><thead><tr><th>Fator organizacional</th><th>Sinais</th><th>Severidade padrão (peso)</th></tr></thead><tbody><tr><td>Assédio de qualquer natureza no trabalho</td><td>6</td><td>Irreversíveis (3)</td></tr><tr><td>Eventos violentos ou traumáticos</td><td>6</td><td>Irreversíveis (3)</td></tr><tr><td>Falta de suporte / apoio no trabalho</td><td>7</td><td>Severos (2)</td></tr><tr><td>Baixo controle no trabalho / Falta de autonomia</td><td>10</td><td>Severos (2)</td></tr><tr><td>Baixa justiça organizacional</td><td>7</td><td>Severos (2)</td></tr><tr><td>Excesso de demandas no trabalho (Sobrecarga)</td><td>11</td><td>Severos (2)</td></tr><tr><td>Maus relacionamentos no local de trabalho</td><td>9</td><td>Severos (2)</td></tr><tr><td>Má gestão de mudanças organizacionais</td><td>5</td><td>Preocupantes (1)</td></tr><tr><td>Baixa clareza de papel / função</td><td>6</td><td>Preocupantes (1)</td></tr><tr><td>Baixas recompensas e reconhecimento</td><td>8</td><td>Preocupantes (1)</td></tr><tr><td>Baixa demanda no trabalho (Subcarga)</td><td>8</td><td>Preocupantes (1)</td></tr><tr><td>Trabalho em condições de difícil comunicação</td><td>7</td><td>Preocupantes (1)</td></tr><tr><td>Trabalho remoto e isolado</td><td>5</td><td>Preocupantes (1)</td></tr></tbody></table><h3>Matriz de risco</h3><table><thead><tr><th>Probabilidade \ Severidade</th><th>Pouca importância (0)</th><th>Preocupantes (1)</th><th>Severos (2)</th><th>Irreversíveis (3)</th><th>Ameaça (4)</th></tr></thead><tbody><tr><td><strong>Não há exposição (0)</strong></td><td style="background-color: #dcfce7; text-align: center">Trivial (0)</td><td style="background-color: #dcfce7; text-align: center">Trivial (0)</td><td style="background-color: #dcfce7; text-align: center">Trivial (0)</td><td style="background-color: #dcfce7; text-align: center">Trivial (0)</td><td style="background-color: #dcfce7; text-align: center">Trivial (0)</td></tr><tr><td><strong>Exposição a níveis baixos (1)</strong></td><td style="background-color: #dcfce7; text-align: center">Trivial (0)</td><td style="background-color: #ecfccb; text-align: center">Baixo (1)</td><td style="background-color: #ecfccb; text-align: center">Baixo (2)</td><td style="background-color: #fef3c7; text-align: center">Moderado (3)</td><td style="background-color: #fef3c7; text-align: center">Moderado (4)</td></tr><tr><td><strong>Exposição moderada (2)</strong></td><td style="background-color: #dcfce7; text-align: center">Trivial (0)</td><td style="background-color: #ecfccb; text-align: center">Baixo (2)</td><td style="background-color: #fef3c7; text-align: center">Moderado (4)</td><td style="background-color: #fef3c7; text-align: center">Moderado (6)</td><td style="background-color: #fee2e2; text-align: center">Alto (8)</td></tr><tr><td><strong>Exposição elevada (3)</strong></td><td style="background-color: #dcfce7; text-align: center">Trivial (0)</td><td style="background-color: #fef3c7; text-align: center">Moderado (3)</td><td style="background-color: #fef3c7; text-align: center">Moderado (6)</td><td style="background-color: #fee2e2; text-align: center">Alto (9)</td><td style="background-color: #fce7f3; text-align: center">Muito Alto (12)</td></tr><tr><td><strong>Exposição elevadíssima (4)</strong></td><td style="background-color: #dcfce7; text-align: center">Trivial (0)</td><td style="background-color: #fef3c7; text-align: center">Moderado (4)</td><td style="background-color: #fee2e2; text-align: center">Alto (8)</td><td style="background-color: #fce7f3; text-align: center">Muito Alto (12)</td><td style="background-color: #fce7f3; text-align: center">Muito Alto (16)</td></tr></tbody></table><p style="text-align: justify">Faixas: <strong>Trivial</strong> 0 · <strong>Baixo</strong> 1–2 · <strong>Moderado</strong> 3–6 · <strong>Alto</strong> 7–10 · <strong>Muito Alto</strong> ≥ 11. É indicada a Análise Ergonômica do Trabalho (NR-17, 17.3.2) para o setor com ao menos um fator organizacional Alto ou Muito Alto, ou com dois ou mais fatores Moderados.</p><p style="text-align: justify">A AEP constitui uma triagem preliminar, voltada à identificação e priorização de fatores e setores que demandam maior atenção. Seu resultado não substitui a AET e deve ser compreendido a partir das condições observadas no ambiente de trabalho.</p><p style="text-align: justify">O DRPS/Questionário Psicossocial possui caráter complementar, contribuindo para ampliar a compreensão dos riscos psicossociais a partir de uma perspectiva mais personalizada, considerando como os próprios trabalhadores percebem e vivenciam suas condições de trabalho.</p><p style="text-align: justify">Os resultados da AEP dependem da qualidade das observações registradas e devem ser revistos sempre que houver mudanças nas condições de trabalho, conforme previsto na NR-01 e na revisão do inventário de riscos.</p>$html$, 2, 'editavel', null, true, now()
where not exists (select 1 from textos_padrao where modulo='aep' and titulo='Avaliação dos Fatores Psicossociais — Matriz de Risco AIHA');
```

## Passo 4: verificar

1. Rode `npx tsc --noEmit -p .`, `npx eslint` nos arquivos alterados e `npx next build`; todos devem terminar sem erros.
2. No menu do módulo AEP, **Matriz AIHA** abre a explicação já aberta, sem botão de recolher, com a grade colorida e as faixas.
3. Em **Ajuda**, o quadro aparece depois de Ergonomia Organizacional e abre ao clicar; na impressão da Ajuda sai aberto.
4. Em **Sinalização Psicoss.** e na página **AEP** do Painel SST, o quadro aparece acima da busca e a lista de empresas continua funcionando.
5. Abra o laudo de uma AEP: o capítulo "Avaliação dos Fatores Psicossociais — Matriz de Risco AIHA" sai depois da Metodologia, com as tabelas e a matriz colorida. Confira também no PDF.
6. Publique pelo fluxo de release do painel (versão, changelog, "Novidades").
