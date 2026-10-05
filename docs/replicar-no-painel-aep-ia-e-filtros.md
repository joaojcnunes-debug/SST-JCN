# Replicar no Painel SST: IA do Parecer/Recomendações da AEP e filtros da lista e do Dashboard

> **Como usar:** abra o Claude Code na pasta do **painel-sst** e diga:
> *"Siga o arquivo `replicar-no-painel-aep-ia-e-filtros.md`"*.
>
> Origem: JCN (`sst-jcn`), commits `973845f` (IA) e `8657417` (filtros) de 2026-10-05, já em produção lá.
> **Não mexe no banco.** A parte da IA exige **publicar a edge function**
> `gerar-parecer-aep-ia` no Supabase do **painel**.

## Pré-requisitos

- **AIHA:** a matriz AIHA na Ergonomia Organizacional
  (`replicar-no-painel-aep-matriz-aiha.md`). A IA usa
  `setor.aiha_organizacional`, `sinais_organizacional` e `rotulosDosSinais`.
- **Status:** o status "Em andamento" e as constantes `STATUS_LABEL_AEP` /
  `STATUS_ORDEM_AEP` (`replicar-no-painel-sinalizacao-filtros-e-status-aep.md`),
  usados no filtro de status.
- **Edge function:** `gerar-parecer-aep-ia` com a lista de modelos do Groq (fallback), feita no
  JCN em 2026-10-02. Se a do painel ainda usa um modelo só (`llama-3.1-8b-instant`, retirado
  pelo Groq), a versão completa da seção A já resolve isso.

## Parte 1: IA do Parecer Técnico Preliminar e das Recomendações

### O que faz

A função `gerar-parecer-aep-ia` (botões "Gerar IA" em Setores / Triagem) passa
a seguir as **premissas da AEP definidas pelo RT**:

1. A AEP é uma **triagem preliminar**, voltada à identificação e priorização
   de fatores e setores. Não substitui a AET e deve ser compreendida a partir
   das condições observadas.
2. O **DRPS/Questionário Psicossocial** é **complementar** e traz a percepção
   dos próprios trabalhadores.
3. Os resultados dependem da qualidade das observações e devem ser **revistos**
   quando as condições de trabalho mudarem (NR-01, inventário de riscos).

O que a IA faz com isso:

- **Linguagem de triagem:** "identificou-se", "indícios", "necessidade de
  aprofundamento"; nunca um diagnóstico conclusivo.
- **Fatores organizacionais:** recebe cada fator "Sim" com o **nível AIHA**, a
  probabilidade × severidade e os **sinais observados**, mais o **Necessita
  AET** do setor; cita os níveis e os sinais.
- **AET:** é indicada (NR-17, 17.3.2) só quando o setor tem a indicação.
- **DRPS/Questionário:** entra como complemento quando há 3+ alertas
  organizacionais ou algum fator Alto/Muito Alto.
- **Parecer** (140–240 palavras): diagnóstico, encaminhamento e ressalva de
  triagem/revisão, **sem lista de ações**.
- **Recomendações** (90–180 palavras): ações imediatas/preventivas/estruturais,
  sem repetir o diagnóstico; inclui AET, DRPS como complemento e revisão da AEP
  quando cabíveis.
- `max_tokens` sobe para 2000.

### Código

| Seção | Arquivo | O quê |
|---|---|---|
| A | `supabase/functions/gerar-parecer-aep-ia/index.ts` | **substituir** e **publicar** (`verify_jwt` = true) |
| B | `components/aep/AepSetoresEditor.tsx` | o botão "Gerar IA" envia `fatores_organizacionais` e `necessita_aet` |

Publicar a função no Supabase do painel: `supabase functions deploy gerar-parecer-aep-ia`
(ou pelo MCP do painel). O segredo `GROQ_API_KEY` precisa existir nas Edge
Functions do painel.

### A: `supabase/functions/gerar-parecer-aep-ia/index.ts` (substituir, completo)

```ts
// Edge Function — gera Parecer Técnico Preliminar ou Recomendações
// para um setor da AEP, via Groq.
//
// DEPLOY:
//   supabase functions deploy gerar-parecer-aep-ia
//
// Cliente: supabase.functions.invoke('gerar-parecer-aep-ia', { body })

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
// Em ordem de preferência. O Groq retira modelos do ar sem aviso (o
// llama-3.1-8b-instant sumiu em 2026-10 e a função passou a dar 502): se um
// modelo não existir mais, tenta o próximo.
const MODELOS = [
  "llama-3.3-70b-versatile",
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "qwen/qwen3-32b",
  "moonshotai/kimi-k2-instruct",
];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type CampoAep = "parecer_tecnico" | "recomendacoes";

interface ContextoAepIA {
  campo: CampoAep;
  empresa_nome?: string | null;
  setor_nome: string;
  cargos?: { cargo: string; descricao: string }[];
  jornada?: string | null;
  qtd_expostos?: number | null;
  checklist_fisica?: Record<string, string>;
  checklist_cognitiva?: Record<string, string>;
  checklist_organizacional?: Record<string, string>;
  observacoes?: Record<string, string>;
  textoAtual?: string | null;
  /** Fatores organizacionais na matriz AIHA (2026-10-05). */
  fatores_organizacionais?: {
    fator: string;
    nivel: string | null;
    probabilidade?: string | null;
    severidade?: string | null;
    sinais?: string[];
  }[];
  /** O setor tem indicação de AET completa (critério do sistema). */
  necessita_aet?: boolean;
}

const TITULO: Record<CampoAep, string> = {
  parecer_tecnico: "Parecer Técnico Preliminar",
  recomendacoes: "Recomendações Ergonômicas",
};

const SYSTEM_PROMPT = `Você é um(a) ergonomista / técnico(a) de segurança do trabalho brasileiro(a), especialista em Análise Ergonômica Preliminar (AEP), NR-01 GRO/PGR e NR-17.

Sua tarefa: redigir texto técnico para o laudo AEP de um setor específico, com base no checklist ergonômico, nos fatores organizacionais classificados na matriz de risco AIHA e nas observações fornecidas.

Responda APENAS com JSON válido (sem markdown, sem cercas, sem texto fora do JSON):
{ "texto": "Texto em português brasileiro, tom técnico, 3ª pessoa, sem bullets — apenas parágrafos corridos." }

PREMISSAS DA AEP — o texto deve refletir estas premissas (definidas pelo Responsável Técnico):
1. A AEP constitui uma triagem preliminar, voltada à identificação e priorização de fatores e setores que demandam maior atenção. Seu resultado não substitui a AET e deve ser compreendido a partir das condições observadas no ambiente de trabalho.
2. O DRPS/Questionário Psicossocial possui caráter complementar, contribuindo para ampliar a compreensão dos riscos psicossociais a partir de uma perspectiva mais personalizada, considerando como os próprios trabalhadores percebem e vivenciam suas condições de trabalho.
3. Os resultados da AEP dependem da qualidade das observações registradas e devem ser revistos sempre que houver mudanças nas condições de trabalho, conforme previsto na NR-01 e na revisão do inventário de riscos.

Como aplicar as premissas:
- Trate os achados como resultado de TRIAGEM: use "identificou-se", "foram observados indícios", "indica a necessidade de aprofundamento"; nunca apresente a AEP como diagnóstico conclusivo nem como substituta da AET.
- Fatores organizacionais: cite o nível na matriz AIHA (Trivial, Baixo, Moderado, Alto, Muito Alto) e os sinais observados que o sustentam; priorize os de nível mais alto.
- Quando o setor tiver indicação de AET ("Necessita AET: sim"), registre que a análise ergonômica do trabalho (AET, NR-17 item 17.3.2) é o aprofundamento indicado; sem indicação, não recomende AET.
- Quando houver fatores organizacionais relevantes (3 ou mais alertas organizacionais, ou algum fator Alto/Muito Alto), apresente o DRPS/Questionário Psicossocial como instrumento COMPLEMENTAR, que agrega a percepção dos próprios trabalhadores — não como substituto da AEP nem da AET.
- Lembre que a conclusão depende das observações registradas e deve ser revista se as condições de trabalho mudarem (NR-01, inventário de riscos) — uma frase curta, sem repetir as premissas por extenso.

Comprimento esperado:
- parecer_tecnico: 2 a 3 parágrafos (140–240 palavras). Descreva os fatores identificados (itens Sim), as categorias ergonômicas afetadas, os níveis AIHA dos fatores organizacionais, a prioridade do setor e as condições observadas; encerre com o encaminhamento (AET e/ou DRPS/Questionário quando cabíveis) e a ressalva de triagem/revisão. NÃO liste ações corretivas nem prazos (imediatas/preventivas/estruturais) no parecer — isso fica só nas Recomendações.
- recomendacoes: 1 a 2 parágrafos com ações práticas priorizadas (90–180 palavras). Classifique como imediatas (<30 dias), preventivas (30–90 dias) ou estruturais (>90 dias) quando pertinente. Não repita o diagnóstico do parecer; vá direto às ações. Inclua, quando cabíveis, a realização da AET para o setor, a aplicação do DRPS/Questionário Psicossocial como complemento e a revisão da AEP quando houver mudança nas condições de trabalho.

Diretrizes:
- Citar setor, cargos e jornada quando relevante
- Basear-se apenas nos itens marcados como Sim, nos níveis AIHA e nas observações fornecidas — não inventar dados, medições ou números
- Referenciar NR-17, NR-01 e normas pertinentes
- Sem bullets, apenas parágrafos corridos`;

function buildPrompt(ctx: ContextoAepIA): string {
  const l: string[] = [];
  if (ctx.empresa_nome) l.push(`Empresa: ${ctx.empresa_nome}`);
  l.push(`Setor: ${ctx.setor_nome}`);
  if (ctx.cargos?.length) {
    const lista = ctx.cargos
      .map((c) => (c.descricao ? `${c.cargo} (${c.descricao})` : c.cargo))
      .filter(Boolean);
    if (lista.length) l.push(`Cargos: ${lista.join("; ")}`);
  }
  if (ctx.jornada) l.push(`Jornada: ${ctx.jornada}`);
  if (ctx.qtd_expostos) l.push(`Trabalhadores expostos: ${ctx.qtd_expostos}`);

  const addChecklist = (nome: string, cl?: Record<string, string>) => {
    if (!cl) return;
    const sims = Object.entries(cl)
      .filter(([, v]) => v === "sim")
      .map(([k]) => k.replace(/_/g, " "));
    if (sims.length) l.push(`${nome} — alertas: ${sims.join(", ")}`);
  };
  addChecklist("Ergonomia Física", ctx.checklist_fisica);
  addChecklist("Ergonomia Cognitiva", ctx.checklist_cognitiva);
  addChecklist("Ergonomia Organizacional", ctx.checklist_organizacional);

  // Fatores organizacionais na matriz AIHA, do mais grave para o menos.
  const PESO: Record<string, number> = { "Muito Alto": 5, Alto: 4, Moderado: 3, Baixo: 2, Trivial: 1 };
  const fatores = [...(ctx.fatores_organizacionais ?? [])].sort((a, b) => (PESO[b.nivel ?? ""] ?? 0) - (PESO[a.nivel ?? ""] ?? 0));
  if (fatores.length) {
    l.push("Fatores organizacionais na matriz AIHA:");
    for (const f of fatores) {
      const pxs = [f.probabilidade, f.severidade].filter(Boolean).join(" × ");
      const sinais = (f.sinais ?? []).filter(Boolean);
      l.push(
        `  - ${f.fator}: ${f.nivel ?? "sem nível"}${pxs ? ` (${pxs})` : ""}${sinais.length ? ` — sinais: ${sinais.join("; ")}` : " — nenhum sinal observado marcado"}`,
      );
    }
  }
  if (typeof ctx.necessita_aet === "boolean") {
    l.push(`Necessita AET (critério do sistema): ${ctx.necessita_aet ? "sim" : "não"}`);
  }

  if (ctx.observacoes) {
    const obs = Object.entries(ctx.observacoes)
      .filter(([, v]) => v?.trim())
      .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`);
    if (obs.length) l.push(`Observações de campo:\n${obs.map((o) => `  - ${o}`).join("\n")}`);
  }

  l.push(`\nCampo a redigir: ${TITULO[ctx.campo]}`);
  if (ctx.textoAtual?.trim()) l.push(`\nTexto já redigido (refine se necessário):\n${ctx.textoAtual}`);
  l.push("\nGere o texto em JSON conforme o formato definido.");
  return l.join("\n");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  if (!GROQ_API_KEY) {
    return new Response(
      JSON.stringify({ error: "GROQ_API_KEY não configurada." }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = (await req.json()) as ContextoAepIA;
    if (!body?.setor_nome || !body?.campo) {
      return new Response(
        JSON.stringify({ error: "setor_nome e campo são obrigatórios" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    let groqRes: Response | null = null;
    const falhas: string[] = [];
    for (const model of MODELOS) {
      groqRes = await fetch(GROQ_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: buildPrompt(body) },
          ],
          response_format: { type: "json_object" },
          temperature: 0.55,
          max_tokens: 2000,
        }),
      });
      if (groqRes.ok) break;
      // Modelo retirado, sem acesso ou JSON malformado: tenta o próximo.
      falhas.push(`${model}: ${groqRes.status} ${(await groqRes.text()).slice(0, 200)}`);
      if (groqRes.status === 401) break;
    }

    if (!groqRes || !groqRes.ok) {
      return new Response(
        JSON.stringify({ error: `Groq falhou em todos os modelos — ${falhas.join(" | ")}` }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const groqData = await groqRes.json();
    const content: string | undefined = groqData?.choices?.[0]?.message?.content;
    if (!content) {
      return new Response(
        JSON.stringify({ error: "Resposta vazia do modelo" }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(content); } catch {
      return new Response(
        JSON.stringify({ error: "JSON inválido do modelo", raw: content.slice(0, 400) }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const texto = (
      typeof parsed?.texto === "string" ? parsed.texto :
      typeof parsed?.text  === "string" ? parsed.text  :
      Object.values(parsed).find((v) => typeof v === "string") as string | undefined ?? ""
    ).trim();

    if (!texto) {
      return new Response(
        JSON.stringify({ error: "Campo 'texto' ausente", raw: content.slice(0, 400) }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ data: { texto } }), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
```

### B: diff de `components/aep/AepSetoresEditor.tsx`

```diff
@@ -53,6 +53,7 @@ import toast from "react-hot-toast";
 import { mensagemErro } from "@/lib/errors";
 import {
   SINAIS_ORGANIZACIONAL,
+  rotulosDosSinais,
   type SinalOrganizacional,
 } from "@/lib/aep/sinais-organizacional";
 import {
@@ -683,6 +684,20 @@ export default function AepSetoresPage({ idRelatorio }: { idRelatorio: string })
           checklist_organizacional: setor.checklist_organizacional as unknown as Record<string, string>,
           observacoes: setor.observacoes_checklist ?? {},
           textoAtual: (setor[campo] as string) || null,
+          // Fatores organizacionais "Sim" com o nível AIHA e os sinais (2026-10-05).
+          fatores_organizacionais: ITENS_ORGANIZACIONAL.filter(
+            ({ key }) => (setor.checklist_organizacional as unknown as Record<string, string>)?.[key] === "sim"
+          ).map(({ key, label }) => {
+            const a = setor.aiha_organizacional?.[key];
+            return {
+              fator: label,
+              nivel: a?.nivel ?? null,
+              probabilidade: a?.probabilidade ?? null,
+              severidade: a?.severidade ?? null,
+              sinais: rotulosDosSinais(key as keyof AepChecklistOrganizacional, setor.sinais_organizacional),
+            };
+          }),
+          necessita_aet: !!setor.necessita_aet,
         },
       });
       if (error) { toast.error(mensagemErro(error, "Erro ao gerar texto")); return; }
```

## Parte 2: filtros na lista de Análises e no Dashboard AEP

### O que faz

Uma barra de filtros, igual nas duas telas (`components/aep/FiltrosListaAep.tsx`,
regra em `lib/aep/filtros-lista.ts`, testada):

- **Busca:** empresa, CNPJ ou responsável.
- **Status:** Rascunho, Em andamento ou Concluído.
- **AET:** requer ou não requer.
- **Nível AIHA (organizacional):** o maior nível entre os fatores dos setores, com a opção "Alto ou Muito Alto".
- **Inspeção:** registrada em inspeção ou sem inspeção.
- **Realizada por.**
- **Período de elaboração:** de / até.

Junto vêm a contagem "N de M análises" e o botão "Limpar filtros".

Os filtros somam-se ao seletor de empresa da página e à unidade ativa do topo.
No **Dashboard**, os cartões contam com todos os filtros **menos o de status**,
e clicar num cartão de status liga ou desliga esse filtro. A barra mostra o
mesmo status.

### Código

| Seção | Arquivo | O quê |
|---|---|---|
| C | `lib/aep/filtros-lista.ts` | **novo**: regra dos filtros |
| D | `lib/aep/filtros-lista.test.ts` | **novo**: testes |
| E | `components/aep/FiltrosListaAep.tsx` | **novo**: a barra |
| F | `app/(aep)/aep/page.tsx` | lista de Análises com a barra |
| G | `app/(aep)/aep/dashboard/page.tsx` | Dashboard com a barra e os cartões ligados ao filtro de status |

### C: `lib/aep/filtros-lista.ts` (novo, completo)

```ts
// Filtros da lista de Análises e do Dashboard da AEP (2026-10-05). Puro, para
// testar sem tela. A unidade ativa continua vindo do seletor do topo
// (`useUnidadeFiltro`) e a empresa, do seletor de empresa da própria página.

import { buscar } from "@/lib/busca/texto";
import { piorNivel } from "@/lib/aep/sinalizacao";
import type { AepRelatorio, StatusAEP } from "@/lib/supabase/types";

export interface FiltrosListaAep {
  busca: string;
  status: "" | StatusAEP;
  /** "sim" = algum setor com Necessita AET. */
  aet: "" | "sim" | "nao";
  /** Maior nível AIHA dos fatores organizacionais; "altos" = Alto ou Muito Alto. */
  nivel: string;
  inspecao: "" | "com" | "sem";
  responsavel: string;
  /** Data de elaboração, AAAA-MM-DD. */
  de: string;
  ate: string;
}

export const FILTROS_LISTA_VAZIOS: FiltrosListaAep = {
  busca: "",
  status: "",
  aet: "",
  nivel: "",
  inspecao: "",
  responsavel: "",
  de: "",
  ate: "",
};

export function filtrosListaAtivos(f: FiltrosListaAep): number {
  return Object.values(f).filter((v) => String(v).trim()).length;
}

/** Maior nível AIHA entre os fatores organizacionais de todos os setores. */
export function nivelAepRelatorio(rel: AepRelatorio): string | null {
  return piorNivel(
    (rel.setores ?? []).flatMap((s) => Object.values(s.aiha_organizacional ?? {}).map((a) => a?.nivel ?? null)),
  );
}

export function precisaAetRelatorio(rel: AepRelatorio): boolean {
  return (rel.setores ?? []).some((s) => s.necessita_aet);
}

/**
 * Aplica os filtros. `ignorar` deixa um filtro de fora — o Dashboard conta os
 * cartões de status com todos os outros filtros, menos o próprio status.
 */
export function filtrarAeps(
  lista: AepRelatorio[],
  f: FiltrosListaAep,
  ignorar: (keyof FiltrosListaAep)[] = [],
): AepRelatorio[] {
  const usa = (k: keyof FiltrosListaAep) => !ignorar.includes(k) && String(f[k]).trim() !== "";
  let r = lista;
  if (usa("busca")) {
    r = buscar(r, f.busca, (x) => {
      const emp = x.empresas as { nome_empresa?: string; cnpj?: string | null } | null;
      return [emp?.nome_empresa, emp?.cnpj, x.responsavel_elaboracao];
    }).itens;
  }
  return r.filter((x) => {
    if (usa("status") && x.status !== f.status) return false;
    if (usa("aet") && precisaAetRelatorio(x) !== (f.aet === "sim")) return false;
    if (usa("nivel")) {
      const n = nivelAepRelatorio(x);
      if (f.nivel === "altos" ? n !== "Alto" && n !== "Muito Alto" : n !== f.nivel) return false;
    }
    const temInsp = !!(x as { id_inspecao?: string | null }).id_inspecao;
    if (usa("inspecao") && temInsp !== (f.inspecao === "com")) return false;
    if (usa("responsavel") && (x.responsavel_elaboracao ?? "").trim() !== f.responsavel) return false;
    const data = (x.data_elaboracao ?? "").slice(0, 10);
    if (usa("de") && (!data || data < f.de)) return false;
    if (usa("ate") && (!data || data > f.ate)) return false;
    return true;
  });
}
```

### D: `lib/aep/filtros-lista.test.ts` (novo, completo)

```ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { FILTROS_LISTA_VAZIOS, filtrarAeps, filtrosListaAtivos, nivelAepRelatorio } from "./filtros-lista";
import type { AepRelatorio } from "@/lib/supabase/types";

function rel(id: string, p: Record<string, unknown>): AepRelatorio {
  return {
    id_relatorio: id,
    id_empresa: "E" + id,
    status: "RASCUNHO",
    data_elaboracao: "2026-06-01",
    responsavel_elaboracao: "Ana",
    empresas: { nome_empresa: "Empresa " + id, cnpj: null },
    setores: [],
    ...p,
  } as unknown as AepRelatorio;
}

const lista = [
  rel("1", {
    status: "CONCLUIDO",
    id_inspecao: "INS-1",
    setores: [{ necessita_aet: true, aiha_organizacional: { assedio: { nivel: "Alto" } } }],
  }),
  rel("2", {
    status: "EM_ANDAMENTO",
    responsavel_elaboracao: "Bruno",
    data_elaboracao: "2026-09-10",
    setores: [{ necessita_aet: false, aiha_organizacional: { subcarga: { nivel: "Baixo" } } }],
  }),
  rel("3", { empresas: { nome_empresa: "Padaria Central", cnpj: null } }),
];
const ids = (r: AepRelatorio[]) => r.map((x) => x.id_relatorio);

test("sem filtro devolve tudo", () => {
  assert.deepEqual(ids(filtrarAeps(lista, FILTROS_LISTA_VAZIOS)), ["1", "2", "3"]);
  assert.equal(filtrosListaAtivos(FILTROS_LISTA_VAZIOS), 0);
});

test("status, AET, nível, inspeção, responsável e período", () => {
  const f = FILTROS_LISTA_VAZIOS;
  assert.deepEqual(ids(filtrarAeps(lista, { ...f, status: "EM_ANDAMENTO" })), ["2"]);
  assert.deepEqual(ids(filtrarAeps(lista, { ...f, aet: "sim" })), ["1"]);
  assert.deepEqual(ids(filtrarAeps(lista, { ...f, aet: "nao" })), ["2", "3"]);
  assert.deepEqual(ids(filtrarAeps(lista, { ...f, nivel: "altos" })), ["1"]);
  assert.deepEqual(ids(filtrarAeps(lista, { ...f, nivel: "Baixo" })), ["2"]);
  assert.deepEqual(ids(filtrarAeps(lista, { ...f, inspecao: "com" })), ["1"]);
  assert.deepEqual(ids(filtrarAeps(lista, { ...f, responsavel: "Bruno" })), ["2"]);
  assert.deepEqual(ids(filtrarAeps(lista, { ...f, de: "2026-09-01" })), ["2"]);
  assert.deepEqual(ids(filtrarAeps(lista, { ...f, ate: "2026-08-31" })), ["1", "3"]);
});

test("busca por empresa e responsável; ignorar um filtro", () => {
  const f = FILTROS_LISTA_VAZIOS;
  assert.deepEqual(ids(filtrarAeps(lista, { ...f, busca: "padaria" })), ["3"]);
  assert.deepEqual(ids(filtrarAeps(lista, { ...f, busca: "bruno" })), ["2"]);
  assert.deepEqual(ids(filtrarAeps(lista, { ...f, status: "CONCLUIDO", aet: "sim" }, ["status"])), ["1"]);
  assert.equal(nivelAepRelatorio(lista[2]), null);
});
```

### E: `components/aep/FiltrosListaAep.tsx` (novo, completo)

```tsx
"use client";

// Barra de filtros da lista de Análises e do Dashboard da AEP (2026-10-05).
// A regra fica em lib/aep/filtros-lista.ts.

import { FilterX, Search } from "lucide-react";
import { filtrosListaAtivos, FILTROS_LISTA_VAZIOS, type FiltrosListaAep } from "@/lib/aep/filtros-lista";
import { STATUS_LABEL_AEP, STATUS_ORDEM_AEP } from "@/lib/hooks/useAep";
import type { StatusAEP } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

const campo =
  "w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";
const rotulo = "text-[11px] font-medium text-gray-500";

export default function FiltrosListaAep({
  valor,
  onChange,
  responsaveis,
  total,
  mostrando,
}: {
  valor: FiltrosListaAep;
  onChange: (f: FiltrosListaAep) => void;
  /** Nomes de "Realizada por" que existem na lista. */
  responsaveis: string[];
  total: number;
  mostrando: number;
}) {
  const set = (patch: Partial<FiltrosListaAep>) => onChange({ ...valor, ...patch });
  const ativos = filtrosListaAtivos(valor);

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
        <input
          value={valor.busca}
          onChange={(e) => set({ busca: e.target.value })}
          placeholder="Buscar por empresa, CNPJ ou responsável..."
          className={cn(campo, "py-2 pl-8")}
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <label className={rotulo}>
          Status
          <select value={valor.status} onChange={(e) => set({ status: e.target.value as "" | StatusAEP })} className={campo}>
            <option value="">Todos</option>
            {STATUS_ORDEM_AEP.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL_AEP[s]}
              </option>
            ))}
          </select>
        </label>
        <label className={rotulo}>
          AET
          <select value={valor.aet} onChange={(e) => set({ aet: e.target.value as FiltrosListaAep["aet"] })} className={campo}>
            <option value="">Todas</option>
            <option value="sim">Requer AET</option>
            <option value="nao">Não requer</option>
          </select>
        </label>
        <label className={rotulo}>
          Nível AIHA (organizacional)
          <select value={valor.nivel} onChange={(e) => set({ nivel: e.target.value })} className={campo}>
            <option value="">Todos</option>
            <option value="altos">Alto ou Muito Alto</option>
            {["Muito Alto", "Alto", "Moderado", "Baixo", "Trivial"].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className={rotulo}>
          Inspeção
          <select
            value={valor.inspecao}
            onChange={(e) => set({ inspecao: e.target.value as FiltrosListaAep["inspecao"] })}
            className={campo}
          >
            <option value="">Todas</option>
            <option value="com">Registrada em inspeção</option>
            <option value="sem">Sem inspeção</option>
          </select>
        </label>
        <label className={rotulo}>
          Realizada por
          <select value={valor.responsavel} onChange={(e) => set({ responsavel: e.target.value })} className={campo}>
            <option value="">Todos</option>
            {responsaveis.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className={rotulo}>
          Elaborada de
          <input type="date" value={valor.de} onChange={(e) => set({ de: e.target.value })} className={campo} />
        </label>
        <label className={rotulo}>
          até
          <input type="date" value={valor.ate} onChange={(e) => set({ ate: e.target.value })} className={campo} />
        </label>
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          {mostrando} de {total} análise{total !== 1 ? "s" : ""}
        </span>
        {ativos > 0 && (
          <button
            type="button"
            onClick={() => onChange(FILTROS_LISTA_VAZIOS)}
            className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline"
          >
            <FilterX className="size-3.5" /> Limpar filtros ({ativos})
          </button>
        )}
      </div>
    </div>
  );
}
```

### F: diff de `app/(aep)/aep/page.tsx`

```diff
@@ -9,6 +9,9 @@ import { useUnidadeFiltro } from "@/lib/hooks/useUnidadeFiltro";
 import EmpresaSelect from "@/components/empresas/EmpresaSelect";
 import ConfirmDialog from "@/components/ui/ConfirmDialog";
 import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
+import FiltrosListaAep from "@/components/aep/FiltrosListaAep";
+import { FILTROS_LISTA_VAZIOS, filtrarAeps, type FiltrosListaAep as Filtros } from "@/lib/aep/filtros-lista";
+import { opcoesDistintas } from "@/lib/aep/sinalizacao-filtros";
 import type { AepRelatorio, ClassificacaoRiscoAET } from "@/lib/supabase/types";
 
 const RISCO_DOT: Record<ClassificacaoRiscoAET, string> = {
@@ -25,7 +28,11 @@ export default function AepListaPage() {
   const [confirmarExcluir, setConfirmarExcluir] = useState<AepRelatorio | null>(null);
   const { data: relatoriosAll = [], isLoading } = useAepRelatorios(empresaId);
   const { unidadeId, inUnidade } = useUnidadeFiltro();
-  const relatorios = useMemo(() => relatoriosAll.filter((r) => inUnidade(r.id_empresa)), [relatoriosAll, inUnidade]);
+  const daUnidade = useMemo(() => relatoriosAll.filter((r) => inUnidade(r.id_empresa)), [relatoriosAll, inUnidade]);
+  // Filtros da lista (2026-10-05): status, AET, nível AIHA, inspeção, responsável e período.
+  const [filtros, setFiltros] = useState<Filtros>(FILTROS_LISTA_VAZIOS);
+  const relatorios = useMemo(() => filtrarAeps(daUnidade, filtros), [daUnidade, filtros]);
+  const responsaveis = useMemo(() => opcoesDistintas(daUnidade.map((r) => r.responsavel_elaboracao)), [daUnidade]);
   const excluir = useExcluirAep();
   const canCreate = useCanCreate();
   const canDelete = useCanDelete();
@@ -58,6 +65,14 @@ export default function AepListaPage() {
         />
       </div>
 
+      <FiltrosListaAep
+        valor={filtros}
+        onChange={setFiltros}
+        responsaveis={responsaveis}
+        total={daUnidade.length}
+        mostrando={relatorios.length}
+      />
+
       {isLoading && <LoadingSkeleton rows={4} />}
 
       {!isLoading && relatorios.length === 0 && (
```

### G: diff de `app/(aep)/aep/dashboard/page.tsx`

```diff
@@ -1,11 +1,14 @@
 "use client";
 
-import { useState } from "react";
+import { useMemo, useState } from "react";
 import { useRouter } from "next/navigation";
 import { AlertTriangle, Printer } from "lucide-react";
 import { useAepRelatorios, riscoMaximoRelatorio, CLASS_COLOR_AEP, STATUS_LABEL_AEP, STATUS_COR_AEP } from "@/lib/hooks/useAep";
 import EmpresaSelect from "@/components/empresas/EmpresaSelect";
 import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
+import FiltrosListaAep from "@/components/aep/FiltrosListaAep";
+import { FILTROS_LISTA_VAZIOS, filtrarAeps, type FiltrosListaAep as Filtros } from "@/lib/aep/filtros-lista";
+import { opcoesDistintas } from "@/lib/aep/sinalizacao-filtros";
 import type { ClassificacaoRiscoAET, StatusAEP } from "@/lib/supabase/types";
 
 const RISCO_DOT: Record<ClassificacaoRiscoAET, string> = {
@@ -19,10 +22,15 @@ const RISCO_DOT: Record<ClassificacaoRiscoAET, string> = {
 export default function AepDashboardPage() {
   const router = useRouter();
   const [empresaId, setEmpresaId] = useState<string | null>(null);
-  const { data: todos = [], isLoading } = useAepRelatorios(empresaId);
-  // Clique num cartão de status filtra a lista abaixo (clicar de novo limpa).
-  const [filtroStatus, setFiltroStatus] = useState<StatusAEP | null>(null);
-  const relatorios = filtroStatus ? todos.filter((r) => r.status === filtroStatus) : todos;
+  const { data: base = [], isLoading } = useAepRelatorios(empresaId);
+  // Filtros (2026-10-05). Os cartões contam com todos os filtros MENOS o de
+  // status — clicar num cartão de status liga/desliga esse filtro.
+  const [filtros, setFiltros] = useState<Filtros>(FILTROS_LISTA_VAZIOS);
+  const todos = useMemo(() => filtrarAeps(base, filtros, ["status"]), [base, filtros]);
+  const relatorios = useMemo(() => filtrarAeps(base, filtros), [base, filtros]);
+  const responsaveis = useMemo(() => opcoesDistintas(base.map((r) => r.responsavel_elaboracao)), [base]);
+  const filtroStatus: StatusAEP | null = filtros.status || null;
+  const setFiltroStatus = (s: StatusAEP | null) => setFiltros((f) => ({ ...f, status: s ?? "" }));
 
   const totalAnalises = todos.length;
   const porStatus = (s: StatusAEP) => todos.filter((r) => r.status === s).length;
@@ -79,6 +87,14 @@ export default function AepDashboardPage() {
         </p>
       )}
 
+      <FiltrosListaAep
+        valor={filtros}
+        onChange={setFiltros}
+        responsaveis={responsaveis}
+        total={base.length}
+        mostrando={relatorios.length}
+      />
+
       {isLoading && <LoadingSkeleton rows={4} />}
 
       <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
```

## Conferir no painel

| Usado | Conferir |
|---|---|
| `buscar` em `lib/busca/texto.ts`, `piorNivel` em `lib/aep/sinalizacao.ts`, `opcoesDistintas` em `lib/aep/sinalizacao-filtros.ts` | mesmos nomes |
| `useUnidadeFiltro` na lista de Análises | se o painel não tiver, troque `daUnidade` pela lista direta |
| `ITENS_ORGANIZACIONAL` e `rotulosDosSinais` importados no `AepSetoresEditor` | a seção B adiciona o import de `rotulosDosSinais` |

## Verificar

1. Rode `npm test` (os testes de `filtros-lista` passam), `npx tsc --noEmit -p .` e `npx next build`; todos devem terminar sem erros.
2. **IA:** num setor com fatores organizacionais Alto e "Necessita AET", clique em "Gerar IA":
   - o **Parecer** cita os níveis AIHA e os sinais, indica a AET (NR-17, 17.3.2) e o DRPS/Questionário como complemento, fecha com a ressalva de triagem e revisão e não lista ações;
   - as **Recomendações** trazem as ações por prazo.
3. Num setor **sem** indicação de AET, o texto **não** recomenda AET.
4. **Filtros:**
   - na lista de Análises e no Dashboard, cada filtro reduz a lista e a contagem "N de M" acompanha;
   - no Dashboard, os cartões mudam com os filtros (exceto status), e clicar em "Em andamento" filtra e marca o cartão.
5. Publique pelo fluxo de release do painel (versão, changelog, "Novidades").
