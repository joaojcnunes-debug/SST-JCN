# Replicar no Painel SST: triagem da AEP na largura toda e inventário de risco editável

> **Como usar:** abra o Claude Code na pasta do **painel-sst** e diga:
> *"Siga o arquivo `replicar-no-painel-aep-layout-e-inventario.md`"*.
>
> Origem: JCN (`sst-jcn`), commits `e6949dc`, `62e3356` e `99b1b00` de 2026-10-06, já em produção lá.
> **Sem migration e sem edge function** — tudo no jsonb `aep_relatorios.setores`.

## Pré-requisito

`replicar-no-painel-aep-fases-1-e-2.md` aplicado (biblioteca psicossocial,
checklist de gestão, origem da evidência, `lib/aep/inventario.ts`). Os diffs
abaixo partem do estado do fim da Fase 2.

> A Fase 3 (questionário anônimo por QR Code) foi feita e **removida** no JCN
> a pedido do usuário. Não há nada dela para replicar.

## O que faz

### 1. Triagem Ergonômica na largura toda

- Os blocos **Física**, **Cognitiva** e **Organizacional** ficam um embaixo do
  outro, cada um na largura inteira (antes: três colunas lado a lado).
- **Física e Cognitiva:** itens em até 3 colunas.
- **Organizacional:** um fator embaixo do outro.
- Prop nova `colunasItens` no `ChecklistBloco`.

### 2. Ordem de cada fator organizacional

1. Título com Sim / Não / N/A / N/I
2. **Roteiro de campo, aberto**
3. **Origem da evidência** (se Sim), com a confiança
4. Observação de campo
5. Sinais observados
6. Matriz AIHA
7. **Inventário de risco**

O `Tristate` ganhou o slot `topo`, entre o título e a observação.

### 3. Inventário de risco editável (por fator, por setor)

Cada fator "Sim" mostra o quadro **"Inventário de risco"** (aberto), com as
mesmas colunas da planilha exportada.

| Tópico | Edição |
|---|---|
| Perigo, Meio de propagação, Situação, Tempo de exposição | texto; os três últimos sugerem os valores da biblioteca |
| Fontes geradoras | lacunas do checklist de gestão (automáticas) + fontes da biblioteca (marcar) + manuais |
| Evidências (sinais) | sinais do catálogo (os mesmos do bloco de sinais) + manuais |
| Medidas de controle existentes | itens evidenciados do checklist de gestão (automáticos) + manuais |
| Descrição do risco, Danos à saúde | texto, com "voltar ao texto da biblioteca" |
| Sugestões iniciais, Ações | desmarcar as da biblioteca + manuais |
| Probabilidade × Severidade, Confiança | só leitura: a primeira vem da matriz, a segunda da origem da evidência |

**Como os ajustes funcionam:**
- Ficam em `setor.inventario[fator]` (tipo `InventarioFator`).
- São aplicados por `detalhesDoSetor`, então laudo, PDF, planilha e IA mostram
  a mesma coisa. A IA passa a usar só as ações marcadas.
- Texto em branco volta ao padrão da biblioteca.
- Sugestões e ações sem ajuste = todas as da biblioteca.
- **Evidência manual não conta para a matriz AIHA.**
- Se o fator deixar de ser "Sim", o ajuste dele é apagado.
- As **fontes geradoras saíram do bloco "Origem da evidência"** e ficam só no
  inventário.

## Passo 1: conferir o painel

| Usado | Conferir |
|---|---|
| `lib/aep/inventario.ts` com `detalhesDoSetor`, `DetalheFator`, `SetorInventario` (Fase 2) | mesmos nomes |
| `EvidenciaDoFator`, `RoteiroDoFator`, `ChecklistBloco`, `Tristate` em `components/aep/AepSetoresEditor.tsx` (Fases 1 e 2) | mesmos nomes |
| Os dois normalizadores (`lib/hooks/useAep.ts` e `app/api/pdf/aep/[id]/route.ts`) | precisam conhecer `inventario`, senão o ajuste some ao recarregar |

## Passo 2: código

| Seção | Arquivo | O quê |
|---|---|---|
| A | `lib/aep/inventario.ts` | `InventarioFator`, `normalizarInventario`, ajustes aplicados em `detalhesDoSetor` |
| B | `lib/aep/inventario.test.ts` | teste dos ajustes |
| C | `lib/supabase/types.ts` | `AepSetor.inventario` |
| D | `lib/hooks/useAep.ts` | normalizador |
| E | `app/api/pdf/aep/[id]/route.ts` | normalizador do PDF |
| F | `components/pdf/templates/AepTemplate.tsx` | tipo `AepSetorLocal.inventario` |
| G | `components/aep/AepSetoresEditor.tsx` | layout, ordem do fator, `ListaManual` e `InventarioDoFator` editável |

### A: `lib/aep/inventario.ts` (substituir, completo)

```ts
/**
 * Detalhe de cada fator organizacional "Sim" e o INVENTÁRIO PSICOSSOCIAL da
 * AEP (Fase 2, 2026-10-06). Uma linha por setor × fator "Sim", nas colunas do
 * plano — para lançamento no SGG (XLSX e CSV).
 *
 * Junta: matriz AIHA gravada, sinais, biblioteca (descrição, danos, meio,
 * situação, tempo, sugestões, ações), fontes geradoras (lacunas do checklist
 * de gestão + fontes da biblioteca marcadas pelo técnico), medidas de
 * controle existentes (itens evidenciados do checklist de gestão) e origem
 * da evidência / confiança. Módulo PURO: tela, laudo, PDF e IA usam o mesmo.
 *
 * AJUSTES DO TÉCNICO (2026-10-06): cada tópico do inventário pode ser editado
 * por fator, no setor (`setor.inventario[fator]`): textos próprios (perigo,
 * meio, situação, tempo, descrição, danos), itens manuais a mais (fontes,
 * evidências, medidas, sugestões, ações) e a seleção das sugestões/ações da
 * biblioteca. Sem ajuste, vale o padrão (biblioteca + gestão + sinais).
 * Itens manuais de evidência NÃO contam para a matriz AIHA (só os sinais do
 * catálogo contam).
 */

/** Ajustes do inventário de UM fator num setor. Tudo opcional. */
export interface InventarioFator {
  perigo?: string;
  meio?: string;
  situacao?: string;
  tempo?: string;
  descricao?: string;
  danos?: string;
  fontes_extra?: string[];
  sinais_extra?: string[];
  medidas_extra?: string[];
  /** Sugestões da biblioteca escolhidas; ausente = todas. */
  sugestoes?: string[];
  sugestoes_extra?: string[];
  /** Ações da biblioteca escolhidas; ausente = todas. */
  acoes?: string[];
  acoes_extra?: string[];
}

const TEXTOS_INV = ["perigo", "meio", "situacao", "tempo", "descricao", "danos"] as const;
const LISTAS_INV = ["fontes_extra", "sinais_extra", "medidas_extra", "sugestoes", "sugestoes_extra", "acoes", "acoes_extra"] as const;

/** `{fator: InventarioFator}` limpo (jsonb pode trazer lixo). */
export function normalizarInventario(raw: unknown): Record<string, InventarioFator> {
  if (typeof raw !== "object" || raw === null) return {};
  const out: Record<string, InventarioFator> = {};
  for (const [fator, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v !== "object" || v === null) continue;
    const o = v as Record<string, unknown>;
    const f: InventarioFator = {};
    for (const k of TEXTOS_INV) if (typeof o[k] === "string") f[k] = o[k] as string;
    for (const k of LISTAS_INV) {
      if (Array.isArray(o[k])) f[k] = [...new Set((o[k] as unknown[]).filter((x): x is string => typeof x === "string" && !!x.trim()))];
    }
    out[fator] = f;
  }
  return out;
}

/** Texto ajustado (não vazio) ou o padrão. */
const ou = (ajuste: string | undefined, padrao: string) => (ajuste?.trim() ? ajuste.trim() : padrao);

import { ITENS_ORGANIZACIONAL } from "@/lib/aep/checklist-itens";
import { rotulosDosSinais } from "@/lib/aep/sinais-organizacional";
import { fontesMarcadas, type Biblioteca } from "@/lib/aep/biblioteca";
import {
  SEM_MEDIDAS,
  lacunasDoFator,
  medidasExistentesDoFator,
  rotuloLacuna,
  type ChecklistGestao,
} from "@/lib/aep/checklist-gestao";
import { confiancaDoFator, origensEfetivas, rotuloOrigem, type Confianca } from "@/lib/aep/evidencia";
import type { AepChecklistOrganizacional } from "@/lib/supabase/types";

/** Recorte do setor lido aqui (casa com AepSetor e AepSetorLocal). */
export interface SetorInventario {
  nome_setor?: string | null;
  ghe?: string | null;
  checklist_organizacional?: object | null;
  sinais_organizacional?: Record<string, string[]> | null;
  aiha_organizacional?: Record<string, { probabilidade?: string; severidade?: string; nivel?: string | null } | undefined> | null;
  origem_evidencia?: Record<string, string[]> | null;
  fontes_geradoras?: Record<string, string[]> | null;
  /** Ajustes do inventário por fator (2026-10-06). */
  inventario?: Record<string, InventarioFator> | null;
}

export interface DetalheFator {
  key: string;
  label: string;
  sinais: string[];
  descricao: string;
  danos: string;
  meio: string;
  situacao: string;
  tempo: string;
  /** Lacunas do checklist de gestão + fontes da biblioteca marcadas. */
  fontes: string[];
  medidasExistentes: string[];
  origens: string[];
  confianca: Confianca | null;
  probabilidade: string;
  severidade: string;
  nivel: string;
  sugestoes: string[];
  acoes: string[];
}

export function detalhesDoSetor(
  setor: SetorInventario,
  gestao: ChecklistGestao | null | undefined,
  biblioteca: Biblioteca | null | undefined,
): DetalheFator[] {
  const cl = (setor.checklist_organizacional ?? {}) as Record<string, string>;
  return ITENS_ORGANIZACIONAL.filter(({ key }) => cl[key] === "sim").map(({ key, label }) => {
    const b = biblioteca?.[key];
    const lacunas = lacunasDoFator(gestao, key);
    const a = setor.aiha_organizacional?.[key];
    const aj = setor.inventario?.[key] ?? {};
    const escolhidas = (todas: string[], sel: string[] | undefined) => (sel ? todas.filter((x) => sel.includes(x)) : todas);
    return {
      key,
      label: ou(aj.perigo, label),
      sinais: [
        ...rotulosDosSinais(key as keyof AepChecklistOrganizacional, setor.sinais_organizacional ?? undefined),
        ...(aj.sinais_extra ?? []),
      ],
      descricao: ou(aj.descricao, b?.descricao_risco ?? ""),
      danos: ou(aj.danos, b?.danos_saude ?? ""),
      meio: ou(aj.meio, b?.meio_propagacao ?? ""),
      situacao: ou(aj.situacao, b?.situacao_padrao ?? ""),
      tempo: ou(aj.tempo, b?.tempo_exposicao_padrao ?? ""),
      fontes: [
        ...lacunas.map(rotuloLacuna),
        ...fontesMarcadas(biblioteca, key, setor.fontes_geradoras?.[key]),
        ...(aj.fontes_extra ?? []),
      ],
      medidasExistentes: [
        ...medidasExistentesDoFator(gestao, key).map((i) => `${i.codigo} — ${i.label}`),
        ...(aj.medidas_extra ?? []),
      ],
      origens: origensEfetivas(setor.origem_evidencia?.[key], lacunas.length > 0).map(rotuloOrigem),
      confianca: confiancaDoFator(setor.origem_evidencia?.[key], lacunas.length > 0),
      probabilidade: a?.nivel ? (a.probabilidade ?? "") : "",
      severidade: a?.nivel ? (a.severidade ?? "") : "",
      nivel: a?.nivel ?? "",
      sugestoes: [...escolhidas(b?.sugestoes_iniciais ?? [], aj.sugestoes), ...(aj.sugestoes_extra ?? [])],
      acoes: [...escolhidas(b?.acoes ?? [], aj.acoes), ...(aj.acoes_extra ?? [])],
    };
  });
}

export const COLUNAS_INVENTARIO = [
  "Setor",
  "GHE",
  "Perigo",
  "Fontes geradoras",
  "Evidências (sinais)",
  "Meio de propagação",
  "Situação",
  "Tempo de exposição",
  "Medidas de controle existentes",
  "Descrição do risco",
  "Danos à saúde",
  "Probabilidade",
  "Severidade",
  "Nível AIHA",
  "Confiança",
  "Sugestões iniciais",
  "Ações",
] as const;

export function linhasInventario(
  setores: SetorInventario[],
  gestao: ChecklistGestao | null | undefined,
  biblioteca: Biblioteca | null | undefined,
): string[][] {
  const linhas: string[][] = [];
  for (const s of setores) {
    for (const d of detalhesDoSetor(s, gestao, biblioteca)) {
      linhas.push([
        s.nome_setor || "Setor sem nome",
        s.ghe ?? "",
        d.label,
        d.fontes.join("; "),
        d.sinais.join("; "),
        d.meio,
        d.situacao,
        d.tempo,
        d.medidasExistentes.length ? d.medidasExistentes.join("; ") : SEM_MEDIDAS,
        d.descricao,
        d.danos,
        d.probabilidade,
        d.severidade,
        d.nivel,
        d.confianca ?? "",
        d.sugestoes.join("; "),
        d.acoes.join("; "),
      ]);
    }
  }
  return linhas;
}

/** CSV com ";" (o Excel em pt-BR abre direto) e BOM para os acentos. */
export function csvInventario(linhas: string[][]): string {
  const esc = (v: string) => (/[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return "﻿" + [COLUNAS_INVENTARIO as readonly string[], ...linhas].map((l) => l.map(esc).join(";")).join("\r\n");
}
```

### B: `lib/aep/inventario.test.ts` (substituir, completo)

```ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { COLUNAS_INVENTARIO, csvInventario, detalhesDoSetor, linhasInventario, normalizarInventario } from "./inventario";
import { confiancaDoFator, normalizarMapaLista, origensEfetivas } from "./evidencia";
import { ITENS_GESTAO, lacunasDoFator, medidasExistentesDoFator, normalizarChecklistGestao } from "./checklist-gestao";
import { ITENS_ORGANIZACIONAL } from "./checklist-itens";
import { montarBiblioteca } from "./biblioteca";

const BIB = montarBiblioteca([
  {
    fator: "assedio",
    ordem: 1,
    descricao_risco: "Condutas abusivas",
    danos_saude: "Estresse",
    meio_propagacao: "Relações interpessoais",
    situacao_padrao: "Normal",
    tempo_exposicao_padrao: "Habitual e permanente",
    fontes_geradoras: [{ codigo: "1.4", texto: "Gestão autoritária" }, { codigo: "1.5", texto: "Lideranças sem capacitação" }],
    sugestoes_iniciais: ["Política de prevenção"],
    acoes: ["Código de conduta"],
  },
]);

const GESTAO = normalizarChecklistGestao({
  itens: {
    G01: { resposta: "nao_existe" },
    G02: { resposta: "existe_evidenciado", origem: "documento", evidencia: "Canal X" },
    G03: { resposta: "existe_sem_evidencia" },
    G99: { resposta: "nao_existe" },
  },
});

test("confiança: 1 tipo baixa, 2 média, 3+ alta; lacuna de gestão conta como documental", () => {
  assert.equal(confiancaDoFator([], false), null);
  assert.equal(confiancaDoFator(["observacao_direta"], false), "Baixa");
  assert.equal(confiancaDoFator(["observacao_direta"], true), "Média");
  assert.equal(confiancaDoFator(["observacao_direta", "relato_grupo", "documental"], true), "Alta");
  assert.deepEqual(origensEfetivas(["documental", "xx"], true), ["documental"]);
});

test("checklist de gestão: lacunas e medidas por fator; código desconhecido descartado", () => {
  assert.equal(GESTAO.itens?.G99, undefined);
  assert.deepEqual(lacunasDoFator(GESTAO, "assedio").map((i) => i.codigo), ["G01", "G03"]);
  assert.deepEqual(medidasExistentesDoFator(GESTAO, "assedio").map((i) => i.codigo), ["G02"]);
  assert.deepEqual(lacunasDoFator(GESTAO, "sobrecarga"), []);
});

test("todo item de gestão aponta para fatores que existem", () => {
  const chaves = ITENS_ORGANIZACIONAL.map((i) => i.key as string);
  assert.equal(ITENS_GESTAO.length, 26);
  for (const i of ITENS_GESTAO) for (const f of i.fatores) assert.ok(chaves.includes(f), `${i.codigo}:${f}`);
});

test("detalhe do fator junta biblioteca, gestão, sinais, origem e AIHA", () => {
  const setor = {
    nome_setor: "Produção",
    ghe: "GHE-1",
    checklist_organizacional: { assedio: "sim", sobrecarga: "nao" },
    sinais_organizacional: { assedio: ["tom_agressivo"] },
    aiha_organizacional: { assedio: { probabilidade: "Exposição a níveis baixos", severidade: "Irreversíveis", nivel: "Moderado" } },
    origem_evidencia: { assedio: ["observacao_direta"] },
    fontes_geradoras: { assedio: ["1.5"] },
  };
  const [d] = detalhesDoSetor(setor, GESTAO, BIB);
  assert.equal(d.key, "assedio");
  assert.deepEqual(d.fontes, [
    "G01 — Política de prevenção e enfrentamento ao assédio e demais formas de violência (não existe)",
    "G03 — Procedimento de apuração de denúncias e aplicação de medidas (existe, sem evidência)",
    "1.5 — Lideranças sem capacitação",
  ]);
  assert.deepEqual(d.origens, ["Observação direta", "Documental"]);
  assert.equal(d.confianca, "Média");
  assert.equal(d.nivel, "Moderado");

  const linhas = linhasInventario([setor], GESTAO, BIB);
  assert.equal(linhas.length, 1);
  assert.equal(linhas[0].length, COLUNAS_INVENTARIO.length);
  assert.equal(linhas[0][8], "G02 — Canal de denúncia com sigilo e garantia de não retaliação");
  // Sem medidas evidenciadas: frase padrão.
  const semMedidas = linhasInventario([setor], normalizarChecklistGestao({}), BIB);
  assert.equal(semMedidas[0][8], "Não evidenciadas medidas de controle específicas");
});

test("CSV com ponto e vírgula, BOM e aspas quando preciso", () => {
  const csv = csvInventario([["A;B", 'diz "oi"', "ok", ...Array(14).fill("")]]);
  assert.ok(csv.startsWith("﻿Setor;GHE;Perigo"));
  assert.ok(csv.includes('"A;B";"diz ""oi""";ok'));
});

test("normalizarMapaLista tira duplicados e lixo", () => {
  assert.deepEqual(normalizarMapaLista({ a: ["x", "x", 3], b: "y" }), { a: ["x"] });
});

test("ajustes do técnico no inventário: textos, seleção e itens manuais", () => {
  const setor = {
    checklist_organizacional: { assedio: "sim" },
    sinais_organizacional: { assedio: ["tom_agressivo"] },
    inventario: normalizarInventario({
      assedio: {
        perigo: "  Assédio moral pela supervisão  ",
        meio: "",
        descricao: "Texto próprio",
        fontes_extra: ["Fonte manual"],
        sinais_extra: ["Relato do cipeiro"],
        medidas_extra: ["Medida manual"],
        sugestoes: [],
        acoes: ["Código de conduta", "inexistente"],
        acoes_extra: ["Ação manual"],
        lixo: 3,
      },
    }),
  };
  const [d] = detalhesDoSetor(setor, GESTAO, BIB);
  assert.equal(d.label, "Assédio moral pela supervisão");
  assert.equal(d.meio, "Relações interpessoais"); // vazio = padrão
  assert.equal(d.descricao, "Texto próprio");
  assert.equal(d.danos, "Estresse");
  assert.deepEqual(d.sinais, ["Tom agressivo, irônico, humilhante e/ou brincadeiras constrangedoras", "Relato do cipeiro"]);
  assert.ok(d.fontes.includes("Fonte manual"));
  assert.deepEqual(d.medidasExistentes, ["G02 — Canal de denúncia com sigilo e garantia de não retaliação", "Medida manual"]);
  assert.deepEqual(d.sugestoes, []); // seleção vazia = nenhuma da biblioteca
  assert.deepEqual(d.acoes, ["Código de conduta", "Ação manual"]);
  // Sem ajuste: tudo da biblioteca.
  const [p] = detalhesDoSetor({ checklist_organizacional: { assedio: "sim" } }, GESTAO, BIB);
  assert.deepEqual(p.sugestoes, ["Política de prevenção"]);
});
```

### C: diff de `lib/supabase/types.ts`

```diff
@@ -2466,6 +2466,8 @@ export interface AepSetor {
   origem_evidencia?: Record<string, string[]>;
   /** Fontes geradoras da biblioteca marcadas por fator (códigos, ex. "1.3"). */
   fontes_geradoras?: Record<string, string[]>;
+  /** Ajustes do inventário de risco por fator (2026-10-06). Ver lib/aep/inventario.ts. */
+  inventario?: Record<string, import("@/lib/aep/inventario").InventarioFator>;
   parecer_tecnico: string;
   recomendacoes: string;
   necessita_aet: boolean;
```

### D: diff de `lib/hooks/useAep.ts`

```diff
@@ -4,6 +4,7 @@ import { sinaisValidos } from "@/lib/aep/sinais-organizacional";
 import { normalizarCondicoesColeta, normalizarMotivoNi } from "@/lib/aep/coleta";
 import { normalizarMapaLista } from "@/lib/aep/evidencia";
 import { normalizarChecklistGestao } from "@/lib/aep/checklist-gestao";
+import { normalizarInventario } from "@/lib/aep/inventario";
 import { situacaoQuestionario, type SituacaoQuestionario } from "@/lib/aep/sinalizacao";
 import { montarCatalogoSetores } from "@/lib/aep/catalogo-setores";
 import { contagemParaAet } from "@/lib/aep/aiha-organizacional";
@@ -137,6 +138,7 @@ function normalizarSetor(s: unknown): AepSetor {
     // Origem da evidência e fontes geradoras marcadas (2026-10-06).
     origem_evidencia: normalizarMapaLista(setor.origem_evidencia),
     fontes_geradoras: normalizarMapaLista(setor.fontes_geradoras),
+    inventario: normalizarInventario(setor.inventario),
     // ⚠️ Mesmo cuidado dos sinais: campo fora daqui some em toda leitura.
     aiha_organizacional:
       typeof setor.aiha_organizacional === "object" && setor.aiha_organizacional !== null
```

### E: diff de `app/api/pdf/aep/[id]/route.ts`

```diff
@@ -3,6 +3,7 @@ import { normalizarCondicoesColeta, normalizarMotivoNi } from "@/lib/aep/coleta"
 import { normalizarMapaLista } from "@/lib/aep/evidencia";
 import { normalizarChecklistGestao } from "@/lib/aep/checklist-gestao";
 import { montarBiblioteca } from "@/lib/aep/biblioteca";
+import { normalizarInventario } from "@/lib/aep/inventario";
 import { cookies } from "next/headers";
 import { createSupabaseServerClient } from "@/lib/supabase/client";
 import type { AepRelatorioLocal, AepSetorLocal } from "@/components/pdf/templates/AepTemplate";
@@ -113,6 +114,7 @@ function normalizarSetor(s: unknown): AepSetorLocal {
     condicoes_coleta: normalizarCondicoesColeta(setor.condicoes_coleta),
     origem_evidencia: normalizarMapaLista(setor.origem_evidencia),
     fontes_geradoras: normalizarMapaLista(setor.fontes_geradoras),
+    inventario: normalizarInventario(setor.inventario),
     // Matriz AIHA dos fatores organizacionais (2026-10-02) — mesmo cuidado dos sinais.
     aiha_organizacional:
       typeof setor.aiha_organizacional === "object" && setor.aiha_organizacional !== null
```

### F: diff de `components/pdf/templates/AepTemplate.tsx`

```diff
@@ -15,7 +15,7 @@ import { classeQuebraFixoNova, numerarCapitulos, numLabel } from "@/components/p
 // Módulo puro (sem "use client", sem hook) — pode entrar no template do Puppeteer.
 import { rotulosDosSinais } from "@/lib/aep/sinais-organizacional";
 import { fraseCondicoesColeta, limitacoesDaAvaliacao, type CondicoesColeta, type MotivoNiFator } from "@/lib/aep/coleta";
-import { detalhesDoSetor } from "@/lib/aep/inventario";
+import { detalhesDoSetor, type InventarioFator } from "@/lib/aep/inventario";
 import { COR_CONFIANCA } from "@/lib/aep/evidencia";
 import type { ChecklistGestao } from "@/lib/aep/checklist-gestao";
 import type { Biblioteca } from "@/lib/aep/biblioteca";
@@ -101,6 +101,7 @@ export interface AepSetorLocal {
   condicoes_coleta?: CondicoesColeta;
   origem_evidencia?: Record<string, string[]>;
   fontes_geradoras?: Record<string, string[]>;
+  inventario?: Record<string, InventarioFator>;
   cargos?: { id: string; cargo: string; descricao: string; quantidade: number }[];
   riscos: AepRisco[];
   checklist_fisica: AepChecklistFisica;
```

### G: diff de `components/aep/AepSetoresEditor.tsx`

```diff
@@ -18,8 +18,9 @@ import {
 import { ROTEIRO_CAMPO, type RoteiroFator } from "@/lib/aep/roteiro-campo";
 import { ORIGENS_EVIDENCIA, COR_CONFIANCA, confiancaDoFator } from "@/lib/aep/evidencia";
 import { lacunasDoFator, rotuloLacuna, type ChecklistGestao } from "@/lib/aep/checklist-gestao";
-import type { Biblioteca } from "@/lib/aep/biblioteca";
-import { detalhesDoSetor } from "@/lib/aep/inventario";
+import { detalhesDoSetor, type DetalheFator, type InventarioFator } from "@/lib/aep/inventario";
+import { SEM_MEDIDAS, medidasExistentesDoFator } from "@/lib/aep/checklist-gestao";
+import type { FatorBiblioteca } from "@/lib/aep/biblioteca";
 import { useBibliotecaPsi } from "@/lib/hooks/useBibliotecaPsi";
 import { registrarAuditoria } from "@/lib/auditoria/registrar";
 import { chaveNome, type CargoCatalogo, type SetorCatalogo } from "@/lib/aep/catalogo-setores";
@@ -127,6 +128,7 @@ function Tristate({
   onObservacaoChange,
   disabled,
   children,
+  topo,
 }: {
   label: string;
   value: RespostaChecklistAep;
@@ -138,6 +140,8 @@ function Tristate({
   disabled?: boolean;
   /** Conteúdo extra do item — usado pelos sinais da Ergonomia Organizacional. */
   children?: React.ReactNode;
+  /** Entre o título e a observação (roteiro de campo e origem da evidência). */
+  topo?: React.ReactNode;
 }) {
   return (
     <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 space-y-1.5">
@@ -165,6 +169,7 @@ function Tristate({
           ))}
         </div>
       </div>
+      {topo}
       <textarea
         disabled={disabled}
         value={observacao ?? ""}
@@ -412,7 +417,7 @@ function MotivoNiCampo({
 
 function RoteiroDoFator({ roteiro }: { roteiro: RoteiroFator }) {
   return (
-    <details className="group rounded-md border border-teal-100 bg-teal-50/40 px-2 py-1">
+    <details open className="group rounded-md border border-teal-100 bg-teal-50/40 px-2 py-1">
       <summary className="flex cursor-pointer list-none items-center gap-1 text-[10px] font-semibold text-teal-800">
         <Compass className="size-3" /> Roteiro de campo
         <ChevronDown className="size-3 transition group-open:rotate-180" />
@@ -569,24 +574,17 @@ function EvidenciaDoFator({
   fator,
   origens,
   onOrigens,
-  fontes,
-  onFontes,
   gestao,
-  biblioteca,
   disabled,
 }: {
   fator: string;
   origens: string[];
   onOrigens: (v: string[]) => void;
-  fontes: string[];
-  onFontes: (v: string[]) => void;
   gestao: ChecklistGestao | undefined;
-  biblioteca: Biblioteca | undefined;
   disabled?: boolean;
 }) {
   const lacunas = lacunasDoFator(gestao, fator);
   const conf = confiancaDoFator(origens, lacunas.length > 0);
-  const doFator = biblioteca?.[fator]?.fontes_geradoras ?? [];
   const alternar = (lista: string[], k: string) => (lista.includes(k) ? lista.filter((x) => x !== k) : [...lista, k]);
   return (
     <div className="rounded-md border border-sky-200 bg-sky-50/50 p-2 space-y-2">
@@ -626,40 +624,274 @@ function EvidenciaDoFator({
           );
         })}
       </div>
-      {(lacunas.length > 0 || doFator.length > 0) && (
-        <details className="group">
-          <summary className="flex cursor-pointer list-none items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-sky-800">
-            Fontes geradoras ({lacunas.length + fontes.filter((c) => doFator.some((f) => f.codigo === c)).length})
-            <ChevronDown className="size-3 transition group-open:rotate-180" />
-          </summary>
-          <div className="mt-1 space-y-1 text-[11px] leading-snug text-gray-700">
-            {lacunas.map((l) => (
-              <p key={l.codigo} className="flex items-start gap-1.5">
-                <span className="mt-0.5 rounded bg-amber-100 px-1 text-[9px] font-semibold text-amber-800">gestão</span>
-                {rotuloLacuna(l)}
-              </p>
-            ))}
-            {doFator.map((f) => (
-              <label key={f.codigo} className={cn("flex items-start gap-1.5", disabled ? "opacity-60" : "cursor-pointer")}>
-                <input
-                  type="checkbox"
-                  disabled={disabled}
-                  checked={fontes.includes(f.codigo)}
-                  onChange={() => onFontes(alternar(fontes, f.codigo))}
-                  className="mt-0.5 size-3 shrink-0 accent-sky-600"
-                />
-                <span>
-                  <span className="font-mono text-[10px] text-gray-500">{f.codigo}</span> {f.texto}
-                </span>
-              </label>
-            ))}
-          </div>
-        </details>
+    </div>
+  );
+}
+
+// ─── Inventário de risco do fator "Sim" (2026-10-06) ─────────────────────────
+// As mesmas colunas do inventário psicossocial exportado (lib/aep/inventario.ts),
+// só leitura: vêm da biblioteca, do checklist de gestão, dos sinais, da matriz
+// e da origem da evidência. Muda conforme o técnico preenche o resto.
+
+/** Lista de itens manuais: chips removíveis + campo para adicionar. */
+function ListaManual({
+  itens,
+  onChange,
+  disabled,
+  placeholder,
+}: {
+  itens: string[];
+  onChange: (v: string[]) => void;
+  disabled?: boolean;
+  placeholder: string;
+}) {
+  const [novo, setNovo] = useState("");
+  const adicionar = () => {
+    const t = novo.trim();
+    if (!t || itens.includes(t)) return setNovo("");
+    onChange([...itens, t]);
+    setNovo("");
+  };
+  return (
+    <div className="mt-1 space-y-1">
+      {itens.map((x) => (
+        <p key={x} className="flex items-start gap-1.5">
+          <span className="mt-0.5 rounded bg-violet-100 px-1 text-[9px] font-semibold text-violet-800">manual</span>
+          <span className="flex-1">{x}</span>
+          {!disabled && (
+            <button type="button" onClick={() => onChange(itens.filter((i) => i !== x))} className="text-gray-400 hover:text-red-500" title="Remover">
+              <Trash2 className="size-3" />
+            </button>
+          )}
+        </p>
+      ))}
+      {!disabled && (
+        <div className="flex gap-1">
+          <input
+            value={novo}
+            onChange={(e) => setNovo(e.target.value)}
+            onKeyDown={(e) => {
+              if (e.key === "Enter") {
+                e.preventDefault();
+                adicionar();
+              }
+            }}
+            placeholder={placeholder}
+            className="min-w-0 flex-1 rounded border border-gray-200 px-2 py-0.5 text-[11px] focus:border-emerald-500 focus:outline-none"
+          />
+          <button type="button" onClick={adicionar} className="rounded border border-emerald-300 px-2 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50">
+            <Plus className="size-3" />
+          </button>
+        </div>
       )}
     </div>
   );
 }
 
+/**
+ * Inventário de risco EDITÁVEL do fator "Sim" (2026-10-06): cada tópico é
+ * selecionável (itens da biblioteca / checklist de gestão / sinais) e aceita
+ * texto ou itens manuais. Os ajustes ficam em `setor.inventario[fator]` e
+ * seguem para laudo, PDF, inventário exportado e IA (lib/aep/inventario.ts).
+ */
+function InventarioDoFator({
+  d,
+  padrao,
+  rotuloPadrao,
+  aj,
+  onAjuste,
+  sinaisCatalogo,
+  sinaisMarcados,
+  onSinais,
+  fontesMarcadas,
+  onFontes,
+  gestao,
+  sugestoesTexto,
+  disabled,
+}: {
+  d: DetalheFator;
+  padrao: FatorBiblioteca | undefined;
+  rotuloPadrao: string;
+  aj: InventarioFator;
+  onAjuste: (patch: Partial<InventarioFator>) => void;
+  sinaisCatalogo: SinalOrganizacional[];
+  sinaisMarcados: string[];
+  onSinais: (keys: string[]) => void;
+  fontesMarcadas: string[];
+  onFontes: (codigos: string[]) => void;
+  gestao: ChecklistGestao | undefined;
+  /** Valores já usados na biblioteca, para sugerir em meio/situação/tempo. */
+  sugestoesTexto: { meio: string[]; situacao: string[]; tempo: string[] };
+  disabled?: boolean;
+}) {
+  const alternar = (lista: string[], k: string) => (lista.includes(k) ? lista.filter((x) => x !== k) : [...lista, k]);
+  const inputCls =
+    "w-full rounded border border-gray-200 bg-white px-2 py-1 text-[11px] focus:border-emerald-500 focus:outline-none disabled:bg-gray-50";
+  const lacunas = lacunasDoFator(gestao, d.key);
+  const medidasGestao = medidasExistentesDoFator(gestao, d.key);
+  const idLista = (c: string) => `inv-${d.key}-${c}`;
+
+  const texto = (campo: "perigo" | "meio" | "situacao" | "tempo", valorPadrao: string, lista?: string[]) => (
+    <>
+      <input
+        disabled={disabled}
+        list={lista ? idLista(campo) : undefined}
+        value={aj[campo] ?? valorPadrao}
+        onChange={(e) => onAjuste({ [campo]: e.target.value })}
+        className={inputCls}
+      />
+      {lista && (
+        <datalist id={idLista(campo)}>
+          {lista.map((x) => (
+            <option key={x} value={x} />
+          ))}
+        </datalist>
+      )}
+      {aj[campo] !== undefined && aj[campo] !== valorPadrao && !disabled && (
+        <button type="button" onClick={() => onAjuste({ [campo]: undefined })} className="mt-0.5 text-[10px] text-sky-700 underline">
+          voltar ao padrão
+        </button>
+      )}
+    </>
+  );
+  const textoLongo = (campo: "descricao" | "danos", valorPadrao: string) => (
+    <>
+      <textarea
+        disabled={disabled}
+        rows={2}
+        value={aj[campo] ?? valorPadrao}
+        onChange={(e) => onAjuste({ [campo]: e.target.value })}
+        className={inputCls}
+      />
+      {aj[campo] !== undefined && aj[campo] !== valorPadrao && !disabled && (
+        <button type="button" onClick={() => onAjuste({ [campo]: undefined })} className="mt-0.5 text-[10px] text-sky-700 underline">
+          voltar ao texto da biblioteca
+        </button>
+      )}
+    </>
+  );
+  const selecao = (campo: "sugestoes" | "acoes", campoExtra: "sugestoes_extra" | "acoes_extra", daBiblioteca: string[], rotuloNovo: string) => {
+    const sel = aj[campo] ?? daBiblioteca;
+    return (
+      <>
+        {daBiblioteca.map((x) => (
+          <label key={x} className={cn("flex items-start gap-1.5", disabled ? "opacity-70" : "cursor-pointer")}>
+            <input
+              type="checkbox"
+              disabled={disabled}
+              checked={sel.includes(x)}
+              onChange={() => onAjuste({ [campo]: alternar(sel, x) })}
+              className="mt-0.5 size-3 shrink-0 accent-emerald-600"
+            />
+            <span>{x}</span>
+          </label>
+        ))}
+        <ListaManual itens={aj[campoExtra] ?? []} onChange={(v) => onAjuste({ [campoExtra]: v })} disabled={disabled} placeholder={rotuloNovo} />
+      </>
+    );
+  };
+
+  const linhas: [string, React.ReactNode][] = [
+    ["Perigo", texto("perigo", rotuloPadrao)],
+    [
+      "Fontes geradoras",
+      <>
+        {lacunas.map((l) => (
+          <p key={l.codigo} className="flex items-start gap-1.5">
+            <span className="mt-0.5 rounded bg-amber-100 px-1 text-[9px] font-semibold text-amber-800">gestão</span>
+            {rotuloLacuna(l)}
+          </p>
+        ))}
+        {(padrao?.fontes_geradoras ?? []).map((f) => (
+          <label key={f.codigo} className={cn("flex items-start gap-1.5", disabled ? "opacity-70" : "cursor-pointer")}>
+            <input
+              type="checkbox"
+              disabled={disabled}
+              checked={fontesMarcadas.includes(f.codigo)}
+              onChange={() => onFontes(alternar(fontesMarcadas, f.codigo))}
+              className="mt-0.5 size-3 shrink-0 accent-emerald-600"
+            />
+            <span>
+              <span className="font-mono text-[10px] text-gray-500">{f.codigo}</span> {f.texto}
+            </span>
+          </label>
+        ))}
+        <ListaManual itens={aj.fontes_extra ?? []} onChange={(v) => onAjuste({ fontes_extra: v })} disabled={disabled} placeholder="Outra fonte geradora…" />
+      </>,
+    ],
+    [
+      "Evidências (sinais)",
+      <>
+        {sinaisCatalogo.map((s) => (
+          <label key={s.key} className={cn("flex items-start gap-1.5", disabled ? "opacity-70" : "cursor-pointer")}>
+            <input
+              type="checkbox"
+              disabled={disabled}
+              checked={sinaisMarcados.includes(s.key)}
+              onChange={() => onSinais(alternar(sinaisMarcados, s.key))}
+              className="mt-0.5 size-3 shrink-0 accent-red-600"
+            />
+            <span>{s.label}</span>
+          </label>
+        ))}
+        <ListaManual itens={aj.sinais_extra ?? []} onChange={(v) => onAjuste({ sinais_extra: v })} disabled={disabled} placeholder="Outra evidência (não conta na matriz)…" />
+      </>,
+    ],
+    ["Meio de propagação", texto("meio", padrao?.meio_propagacao ?? "", sugestoesTexto.meio)],
+    ["Situação", texto("situacao", padrao?.situacao_padrao ?? "", sugestoesTexto.situacao)],
+    ["Tempo de exposição", texto("tempo", padrao?.tempo_exposicao_padrao ?? "", sugestoesTexto.tempo)],
+    [
+      "Medidas de controle existentes",
+      <>
+        {medidasGestao.map((m) => (
+          <p key={m.codigo} className="flex items-start gap-1.5">
+            <span className="mt-0.5 rounded bg-emerald-100 px-1 text-[9px] font-semibold text-emerald-800">gestão</span>
+            {m.codigo} — {m.label}
+          </p>
+        ))}
+        {medidasGestao.length === 0 && (aj.medidas_extra ?? []).length === 0 && <p className="text-gray-400">{SEM_MEDIDAS}</p>}
+        <ListaManual itens={aj.medidas_extra ?? []} onChange={(v) => onAjuste({ medidas_extra: v })} disabled={disabled} placeholder="Medida existente observada…" />
+      </>,
+    ],
+    ["Descrição do risco", textoLongo("descricao", padrao?.descricao_risco ?? "")],
+    ["Danos à saúde", textoLongo("danos", padrao?.danos_saude ?? "")],
+    [
+      "Probabilidade × Severidade",
+      <span key="pxs">
+        {d.nivel ? `${d.probabilidade} × ${d.severidade} → ${d.nivel}` : "sem nível (marque os sinais observados)"}
+        <span className="ml-1 text-gray-400">· ajuste na Matriz de risco AIHA acima</span>
+      </span>,
+    ],
+    [
+      "Confiança",
+      <span key="conf">
+        {d.confianca ?? "—"} <span className="text-gray-400">· pela origem da evidência</span>
+      </span>,
+    ],
+    ["Sugestões iniciais", selecao("sugestoes", "sugestoes_extra", padrao?.sugestoes_iniciais ?? [], "Outra sugestão…")],
+    ["Ações", selecao("acoes", "acoes_extra", padrao?.acoes ?? [], "Outra ação…")],
+  ];
+  return (
+    <details open className="group rounded-md border border-gray-200 bg-white">
+      <summary className="flex cursor-pointer list-none items-center gap-1 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-700">
+        Inventário de risco
+        <span className="ml-1 font-normal normal-case text-gray-400">— selecione ou inclua itens; vale para laudo, PDF, planilha e IA</span>
+        <ChevronDown className="size-3 transition group-open:rotate-180" />
+      </summary>
+      <table className="w-full border-t border-gray-100 text-[11px] leading-snug text-gray-700">
+        <tbody>
+          {linhas.map(([rotulo, valor]) => (
+            <tr key={rotulo} className="border-b border-gray-100 last:border-0 align-top">
+              <th className="w-48 bg-gray-50 px-2 py-1 text-left font-semibold text-gray-600">{rotulo}</th>
+              <td className="space-y-0.5 px-2 py-1">{valor}</td>
+            </tr>
+          ))}
+        </tbody>
+      </table>
+    </details>
+  );
+}
+
 // ─── Bloco de checklist ───────────────────────────────────────────────────────
 
 function ChecklistBloco({
@@ -673,6 +905,7 @@ function ChecklistBloco({
   disabled,
   opcoes,
   legenda,
+  colunasItens = "md:grid-cols-2 xl:grid-cols-3",
   sinais,
   sinaisMarcados,
   onSinaisChange,
@@ -683,6 +916,7 @@ function ChecklistBloco({
   onMotivoNiChange,
   roteiro,
   extraSim,
+  inventarioSim,
 }: {
   titulo: string;
   cor: string;
@@ -696,6 +930,8 @@ function ChecklistBloco({
   opcoes?: RespostaChecklistAep[];
   /** Siglas explicadas no pé do bloco, na ordem dada. */
   legenda?: RespostaChecklistAep[];
+  /** Colunas dos itens dentro do bloco (blocos empilhados na largura toda, 2026-10-06). */
+  colunasItens?: string;
   /** Só a Ergonomia Organizacional passa isto; física e cognitiva ignoram. */
   sinais?: Record<string, SinalOrganizacional[]>;
   sinaisMarcados?: Record<string, string[]>;
@@ -710,6 +946,8 @@ function ChecklistBloco({
   roteiro?: Record<string, RoteiroFator>;
   /** Conteúdo extra do fator marcado "Sim" (origem da evidência, fontes). */
   extraSim?: (fator: string) => React.ReactNode;
+  /** Inventário de risco do fator "Sim" (por último, depois do roteiro). */
+  inventarioSim?: (fator: string) => React.ReactNode;
 }) {
   const positivos = itens.filter((i) => valores[i.key] === "sim").length;
   return (
@@ -722,7 +960,7 @@ function ChecklistBloco({
           </span>
         )}
       </div>
-      <div className="divide-y divide-gray-100 p-2 space-y-1">
+      <div className={cn("grid items-start gap-2 p-2", colunasItens)}>
         {itens.map(({ key, label }) => {
           const doFator = sinais?.[key];
           return (
@@ -735,6 +973,14 @@ function ChecklistBloco({
               onChange={(v) => onChange({ [key]: v })}
               onObservacaoChange={(text) => onObservacaoChange(key, text)}
               disabled={disabled}
+              topo={
+                roteiro?.[key] || valores[key] === "sim" ? (
+                  <>
+                    {roteiro?.[key] && <RoteiroDoFator roteiro={roteiro[key]} />}
+                    {valores[key] === "sim" && extraSim?.(key)}
+                  </>
+                ) : undefined
+              }
             >
               {valores[key] === "sim" && doFator && doFator.length > 0 && (
                 <SinaisDoFator
@@ -755,7 +1001,6 @@ function ChecklistBloco({
                   disabled={disabled}
                 />
               )}
-              {valores[key] === "sim" && extraSim?.(key)}
               {valores[key] === "nao_identificado" && onMotivoNiChange && (
                 <MotivoNiCampo
                   valor={motivosNi?.[key]}
@@ -763,7 +1008,7 @@ function ChecklistBloco({
                   disabled={disabled}
                 />
               )}
-              {roteiro?.[key] && <RoteiroDoFator roteiro={roteiro[key]} />}
+              {valores[key] === "sim" && inventarioSim?.(key)}
             </Tristate>
           );
         })}
@@ -814,6 +1059,12 @@ export default function AepSetoresPage({ idRelatorio }: { idRelatorio: string })
   // Biblioteca psicossocial e checklist de gestão (Fase 2, 2026-10-06).
   const { data: biblioteca } = useBibliotecaPsi();
   const gestao = rel?.checklist_gestao;
+  // Valores da biblioteca para sugerir nos campos de texto do inventário.
+  const sugestoesTextoInventario = {
+    meio: [...new Set(Object.values(biblioteca ?? {}).map((b) => b.meio_propagacao).filter(Boolean))],
+    situacao: [...new Set(Object.values(biblioteca ?? {}).map((b) => b.situacao_padrao).filter(Boolean))],
+    tempo: [...new Set(Object.values(biblioteca ?? {}).map((b) => b.tempo_exposicao_padrao).filter(Boolean))],
+  };
   // Setores e cargos que a empresa já tem no sistema (das inspeções) — o
   // editor sugere, e o técnico continua podendo digitar à mão (2026-10-05).
   const { data: catalogo = [] } = useCatalogoSetoresEmpresa(
@@ -1451,7 +1702,10 @@ export default function AepSetoresPage({ idRelatorio }: { idRelatorio: string })
                   <p className="mb-2 text-[11px] text-gray-500">
                     Ao marcar <strong>Sim</strong>, um campo de observação aparece para registrar o que foi observado.
                   </p>
-                  <div className="grid gap-3 lg:grid-cols-3">
+                  {/* Um bloco embaixo do outro, cada um na largura toda, com os
+                      itens em colunas (2026-10-06): lado a lado, a Organizacional
+                      (sinais + matriz) ficava espremida. */}
+                  <div className="space-y-3">
                     <ChecklistBloco
                       titulo="Ergonomia Física"
                       cor="bg-blue-50 text-blue-800"
@@ -1491,11 +1745,13 @@ export default function AepSetoresPage({ idRelatorio }: { idRelatorio: string })
                         // E a origem da evidência / fontes de quem deixou de ser Sim.
                         const origens = { ...(setor.origem_evidencia ?? {}) };
                         const fontes = { ...(setor.fontes_geradoras ?? {}) };
+                        const inventario = { ...(setor.inventario ?? {}) };
                         for (const [k, v] of Object.entries(p)) {
                           if (v !== "sim") {
                             delete sinais[k];
                             delete origens[k];
                             delete fontes[k];
+                            delete inventario[k];
                           }
                           if (v !== "nao_identificado") delete motivos[k];
                         }
@@ -1505,6 +1761,7 @@ export default function AepSetoresPage({ idRelatorio }: { idRelatorio: string })
                           motivo_ni: motivos,
                           origem_evidencia: origens,
                           fontes_geradoras: fontes,
+                          inventario,
                         });
                       }}
                       onObservacaoChange={(key, text) =>
@@ -1512,6 +1769,7 @@ export default function AepSetoresPage({ idRelatorio }: { idRelatorio: string })
                       }
                       disabled={!canEdit}
                       opcoes={OPCOES_COM_NI}
+                      colunasItens=""
                       legenda={["nao_aplica", "nao_identificado"]}
                       sinais={SINAIS_ORGANIZACIONAL}
                       sinaisMarcados={setor.sinais_organizacional ?? {}}
@@ -1532,15 +1790,42 @@ export default function AepSetoresPage({ idRelatorio }: { idRelatorio: string })
                           onOrigens={(v) =>
                             updateSetor(setor.id, { origem_evidencia: { ...(setor.origem_evidencia ?? {}), [fator]: v } })
                           }
-                          fontes={setor.fontes_geradoras?.[fator] ?? []}
-                          onFontes={(v) =>
-                            updateSetor(setor.id, { fontes_geradoras: { ...(setor.fontes_geradoras ?? {}), [fator]: v } })
-                          }
                           gestao={gestao}
-                          biblioteca={biblioteca}
                           disabled={!canEdit}
                         />
                       )}
+                      inventarioSim={(fator) => {
+                        const d = detalhesDoSetor(setor, gestao, biblioteca).find((x) => x.key === fator);
+                        if (!d) return null;
+                        const aj = setor.inventario?.[fator] ?? {};
+                        return (
+                          <InventarioDoFator
+                            d={d}
+                            padrao={biblioteca?.[fator]}
+                            rotuloPadrao={ITENS_ORGANIZACIONAL.find((i) => i.key === fator)?.label ?? fator}
+                            aj={aj}
+                            onAjuste={(patch) =>
+                              updateSetor(setor.id, {
+                                inventario: { ...(setor.inventario ?? {}), [fator]: { ...aj, ...patch } },
+                              })
+                            }
+                            sinaisCatalogo={SINAIS_ORGANIZACIONAL[fator as FatorOrganizacional] ?? []}
+                            sinaisMarcados={setor.sinais_organizacional?.[fator] ?? []}
+                            onSinais={(keys) =>
+                              updateSetor(setor.id, {
+                                sinais_organizacional: { ...(setor.sinais_organizacional ?? {}), [fator]: keys },
+                              })
+                            }
+                            fontesMarcadas={setor.fontes_geradoras?.[fator] ?? []}
+                            onFontes={(v) =>
+                              updateSetor(setor.id, { fontes_geradoras: { ...(setor.fontes_geradoras ?? {}), [fator]: v } })
+                            }
+                            gestao={gestao}
+                            sugestoesTexto={sugestoesTextoInventario}
+                            disabled={!canEdit}
+                          />
+                        );
+                      }}
                       matriz={matriz}
                       aiha={setor.aiha_organizacional}
                       onAihaChange={(fator, patch) => {
```

## Passo 3: verificar

1. `npm test`, `npx tsc --noEmit -p .` e `npx next build` sem erros (teste novo em `inventario.test.ts`).
2. **Layout:** em Setores / Triagem, Física, Cognitiva e Organizacional ficam um embaixo do outro; a Organizacional tem um fator por linha.
3. **Ordem:** num fator organizacional, o Roteiro de campo aparece aberto acima da observação; com o fator em Sim, a Origem da evidência vem logo depois do roteiro.
4. **Inventário editável:**
   - mude o Meio de propagação, desmarque uma ação, inclua uma ação manual e uma fonte manual;
   - salve e recarregue: os ajustes continuam;
   - o laudo/PDF e a planilha "Inventário (Excel)" mostram os ajustes;
   - "Gerar IA" nas Recomendações usa só as ações marcadas.
5. **Sinais:** marcar um sinal no inventário marca no bloco "Sinais observados" e recalcula a matriz; evidência manual não muda o nível.
6. **Fator desmarcado:** passe o fator para Não; volte para Sim — o inventário volta ao padrão.
7. Publique pelo fluxo de release do painel (versão, changelog, "Novidades").
