# Replicar no Painel SST: Riscos Psicossociais com fonte geradora, medidas e agravos

> **Como usar:** abra o Claude Code na pasta do **painel-sst** e diga:
> *"Siga o arquivo `replicar-no-painel-riscos-psicossociais-colunas.md`"*.
>
> **Pré-requisito:** a página Riscos Psicossociais já replicada pelo
> `replicar-no-painel-certificados-e-riscos.md`. Este arquivo cobre o que
> mudou nela no JCN (`sst-jcn`) depois do `replicar-no-painel-aep-aet-e-documentos.md`,
> até o commit `bc1e3bd` de 2026-09-25.
>
> São só **2 arquivos**, e nenhum mexe no banco. As versões completas estão no
> fim deste arquivo e **substituem** as seções C e G do MD de certificados e riscos.

## O que mudou

Na página da empresa (`/riscos-psicossociais/[idEmpresa]`):

1. **Setores um embaixo do outro**, cada um na largura toda (antes eram dois
   por linha).
2. Cada setor virou uma **tabela com colunas nesta ordem**:

   | Risco | Resultado final | Fonte geradora | Medidas de controle recomendadas (medidas que a empresa deve adotar) | Possíveis agravos à saúde mental |
   |---|---|---|---|---|

   - **Risco**, **Resultado final** e **Fonte geradora**: uma linha por risco.
     O resultado final aparece com a cor do nível: Baixo, Médio, Alto ou Crítico.
   - **Medidas** e **Agravos** valem para o **setor**, não para cada risco:
     uma célula só, com `rowSpan` ocupando todas as linhas do setor, como no
     laudo. Um item por linha, em lista. Vazio: "Não informado".
   - Em tela estreita a tabela rola para o lado (`min-w-[960px]` dentro de
     `overflow-x-auto`).
3. A lista de empresas (`/riscos-psicossociais`) **não mudou**.

## De onde vem cada informação

| Coluna | DRPS | Questionário (QPS) |
|---|---|---|
| Fonte geradora | `fonteGeradora` do tópico (`TopicoComMatriz`, vem de `lib/drps/topicos.ts`) | `fonteGeradora` da categoria (`CategoriaGravidade`, da `fonte_geradora` de `qps_categorias`). Sem valor: "—" |
| Medidas de controle | `drps_relatorios.medidas_por_setor[setor]` | `qps_aplicacoes.medidas_por_setor[setor]`; sem texto do setor, usa `["*"]` (a aplicação inteira) |
| Possíveis agravos | `drps_relatorios.agravos_por_setor[setor]` | `qps_aplicacoes.agravos_por_setor[setor]`; sem texto do setor, usa `["*"]` |

Os textos de medidas e agravos são os que a tela de **Análise** grava: texto
livre, um item por linha, às vezes com "•" ou "-" na frente. A função
`itensDoTexto` (no hook) separa por quebra de linha ou `;`, tira o marcador,
apara e remove repetidos.

**Por setor, não por unidade:** no DRPS há também `agravos_por_unidade_setor` /
`medidas_por_unidade_setor`. Esta página agrupa só por setor
(`montarBlocosPorSetor`), então usa as colunas `*_por_setor`.

## Passos

1. **`lib/hooks/useRiscosPsicossociais.ts`**: substitua pela versão da
   seção A. O que mudou em relação à versão anterior:
   - `FatorRisco` ganhou `fonteGeradora: string | null`;
   - `SetorRisco` ganhou `agravos: string[]` e `medidas: string[]`;
   - nova função exportada `itensDoTexto`;
   - `resumirSetor` recebe um 4º parâmetro opcional
     `{ agravos, medidas }`;
   - o select do DRPS passou a trazer `agravos_por_setor, medidas_por_setor`.
     O QPS já fazia `select("*")`.
2. **`app/(app)/riscos-psicossociais/[idEmpresa]/page.tsx`**: substitua pela
   versão da seção B. Ela usa os mesmos helpers da versão anterior
   (`CORES_MATRIZ`, `fmtData`, `formatCNPJ`, `cn`, `LoadingSkeleton`,
   `useUserStore`). Se no painel eles tiverem outro nome, adapte como no MD
   de certificados e riscos.
3. Se o painel ainda não tiver as colunas `agravos_por_setor` /
   `medidas_por_setor` em `drps_relatorios` ou `qps_aplicacoes`, confira
   antes:
   ```sql
   select table_name, column_name from information_schema.columns
    where table_schema = 'public'
      and table_name in ('drps_relatorios', 'qps_aplicacoes')
      and column_name in ('agravos_por_setor', 'medidas_por_setor');
   ```
   Tem que voltar **4 linhas**. Se faltar alguma, tire essa coluna do select
   e deixe o campo correspondente vazio. Não crie colunas só para esta página.

## Verificar

1. `npx tsc --noEmit -p .` e `npx next build`, sem erros.
2. Abra uma empresa com DRPS concluído:
   - setores empilhados;
   - colunas na ordem **Risco · Resultado final · Fonte geradora · Medidas ·
     Agravos**;
   - Medidas e Agravos numa célula só por setor.
3. Preencha agravos e medidas de um setor na tela de **Análise** do DRPS,
   salve e confira que aparecem na página. Antes de preencher, aparece
   "Não informado".
4. A fonte geradora de cada tópico do DRPS é igual à do laudo.

---

## A: `lib/hooks/useRiscosPsicossociais.ts`

```ts
"use client";

// Riscos Psicossociais por empresa, setorizados — a visão consolidada do
// Painel SST sobre o que o DRPS e o Questionário (QPS) já concluíram.
//
// Regra do pedido (2026-09-25): só entra avaliação que chegou à coluna
// "Concluídos" do quadro — status CONCLUIDO, ou ENVIADO_CLIENTE, que é a
// coluna seguinte (passou por Concluídos). Rascunho e em andamento ficam de
// fora porque a probabilidade ainda pode mudar.
//
// Nada é recalculado de um jeito novo: cada setor passa pelas MESMAS funções
// das telas de Análise (`montarBlocosPorSetor` no DRPS, `calcularAnaliseSetor`
// no QPS), então o nível mostrado aqui é o que está no laudo.

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { fetchAllRows } from "@/lib/supabase/fetchAllRows";
import { montarBlocosPorSetor } from "@/lib/drps/blocos";
import { calcularAnaliseSetor, listarSetoresQps } from "@/lib/qps/gravidade";
import type { DrpsProbabilidade, DrpsRespondente, NivelMatriz } from "@/lib/drps/types";
import type {
  QpsAplicacao,
  QpsCategoria,
  QpsPergunta,
  QpsProbabilidade,
  QpsRespondente,
  QpsTipo,
} from "@/lib/supabase/types";

// drps_* e qps_* não estão no tipo `Database`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db() { return createSupabaseBrowserClient() as any; }

export const STATUS_CONCLUIDOS = ["CONCLUIDO", "ENVIADO_CLIENTE"] as const;

/** Do menor para o maior — o índice serve de peso para achar o pior. */
export const NIVEIS: NivelMatriz[] = ["Baixo", "Médio", "Alto", "Crítico"];

export interface FatorRisco {
  nome: string;
  /** Fonte geradora do risco (texto do tópico no DRPS / da categoria no QPS). */
  fonteGeradora: string | null;
  nivel: NivelMatriz;
}

export interface SetorRisco {
  setor: string;
  respondentes: number;
  fatores: FatorRisco[];
  /** "Possíveis agravos à saúde mental" da tela de Análise, um item por linha. */
  agravos: string[];
  /** "Medidas de controle recomendadas", um item por linha. */
  medidas: string[];
  contagem: Record<NivelMatriz, number>;
  pior: NivelMatriz | null;
}

export interface AvaliacaoRisco {
  fonte: "DRPS" | "Questionário";
  id: string;
  titulo: string;
  status: string;
  /** Data de referência para ordenar (conclusão, elaboração ou última edição). */
  data: string | null;
  responsavel: string | null;
  setores: SetorRisco[];
}

export interface EmpresaRisco {
  idEmpresa: string;
  nome: string;
  cnpj: string | null;
  municipio: string | null;
  uf: string | null;
  avaliacoes: AvaliacaoRisco[];
}

interface EmpresaMin {
  id_empresa: string;
  nome_empresa: string | null;
  cnpj: string | null;
  municipio: string | null;
  uf: string | null;
}

/** `.in()` com centenas de ids estoura a URL — busca em lotes. */
async function porLotes<T>(
  ids: string[],
  busca: (lote: string[]) => Promise<T[]>,
  tamanho = 100
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += tamanho) {
    out.push(...(await busca(ids.slice(i, i + tamanho))));
  }
  return out;
}

function todasAsLinhas<T>(tabela: string, coluna: string, ids: string[], select = "*") {
  return porLotes(ids, (lote) =>
    fetchAllRows<T>((de, ate) => db().from(tabela).select(select).in(coluna, lote).range(de, ate))
  );
}

/**
 * Os textos por setor da Análise são gravados como texto livre, um item por
 * linha (às vezes com "•" ou "-" na frente). Vira lista limpa, sem repetidos.
 */
export function itensDoTexto(texto: string | null | undefined): string[] {
  if (!texto) return [];
  const itens = texto
    .split(/\r?\n|;/)
    .map((l) => l.replace(/^\s*[•\-*·]\s*/, "").trim())
    .filter(Boolean);
  return [...new Set(itens)];
}

function resumirSetor(
  setor: string,
  respondentes: number,
  fatores: FatorRisco[],
  textos: { agravos?: string | null; medidas?: string | null } = {}
): SetorRisco {
  const contagem: Record<NivelMatriz, number> = { Baixo: 0, Médio: 0, Alto: 0, Crítico: 0 };
  let pior: NivelMatriz | null = null;
  for (const f of fatores) {
    contagem[f.nivel]++;
    if (!pior || NIVEIS.indexOf(f.nivel) > NIVEIS.indexOf(pior)) pior = f.nivel;
  }
  return {
    setor,
    respondentes,
    fatores,
    agravos: itensDoTexto(textos.agravos),
    medidas: itensDoTexto(textos.medidas),
    contagem,
    pior,
  };
}

async function carregarDrps(): Promise<{ avaliacoes: (AvaliacaoRisco & { idEmpresa: string })[]; empresas: EmpresaMin[] }> {
  const { data, error } = await db()
    .from("drps_relatorios")
    .select(
      "id_relatorio, id_empresa, revisao, status, data_elaboracao, data_conclusao, responsavel_tecnico, updated_at, agravos_por_setor, medidas_por_setor, empresas(id_empresa, nome_empresa, cnpj, municipio, uf)"
    )
    .in("status", STATUS_CONCLUIDOS);
  if (error) throw error;
  const relatorios = (data ?? []) as Array<{
    id_relatorio: string;
    id_empresa: string;
    revisao: number | string | null;
    status: string;
    data_elaboracao: string | null;
    data_conclusao: string | null;
    responsavel_tecnico: string | null;
    updated_at: string | null;
    agravos_por_setor: Record<string, string> | null;
    medidas_por_setor: Record<string, string> | null;
    empresas: EmpresaMin | null;
  }>;
  const ids = relatorios.map((r) => r.id_relatorio);
  if (ids.length === 0) return { avaliacoes: [], empresas: [] };

  const [respondentes, probabilidades] = await Promise.all([
    todasAsLinhas<DrpsRespondente>("drps_respondentes", "id_relatorio", ids),
    todasAsLinhas<DrpsProbabilidade>("drps_probabilidades", "id_relatorio", ids),
  ]);

  const avaliacoes = relatorios.map((r) => {
    const resp = respondentes.filter((x) => x.id_relatorio === r.id_relatorio);
    const probs = probabilidades.filter((x) => x.id_relatorio === r.id_relatorio);
    const setores = montarBlocosPorSetor(resp, probs).map((b) =>
      resumirSetor(
        b.setor,
        b.totalRespondentes,
        b.topicos.map((t) => ({ nome: t.nome, fonteGeradora: t.fonteGeradora || null, nivel: t.matriz })),
        { agravos: r.agravos_por_setor?.[b.setor], medidas: r.medidas_por_setor?.[b.setor] }
      )
    );
    return {
      idEmpresa: r.id_empresa,
      fonte: "DRPS" as const,
      id: r.id_relatorio,
      titulo: `DRPS · Revisão ${r.revisao ?? 0}`,
      status: r.status,
      data: r.data_conclusao ?? r.data_elaboracao ?? r.updated_at,
      responsavel: r.responsavel_tecnico,
      setores,
    };
  });
  const empresas = relatorios.map((r) => r.empresas).filter((e): e is EmpresaMin => !!e);
  return { avaliacoes, empresas };
}

async function carregarQps(): Promise<{ avaliacoes: (AvaliacaoRisco & { idEmpresa: string })[]; idsEmpresa: string[] }> {
  const { data, error } = await db()
    .from("qps_aplicacoes")
    .select("*")
    .in("status", STATUS_CONCLUIDOS);
  if (error) throw error;
  const aplicacoes = (data ?? []) as QpsAplicacao[];
  const ids = aplicacoes.map((a) => a.id_aplicacao);
  if (ids.length === 0) return { avaliacoes: [], idsEmpresa: [] };

  const [tiposRes, catsRes, pergsRes, respondentes, probabilidades] = await Promise.all([
    db().from("qps_tipos").select("*"),
    db().from("qps_categorias").select("*").order("ordem"),
    fetchAllRows<QpsPergunta>((de, ate) =>
      db().from("qps_perguntas").select("*").eq("ativo", true).order("ordem").range(de, ate)
    ),
    todasAsLinhas<QpsRespondente>("qps_respondentes", "id_aplicacao", ids),
    todasAsLinhas<QpsProbabilidade>("qps_probabilidades", "id_aplicacao", ids),
  ]);
  if (tiposRes.error) throw tiposRes.error;
  if (catsRes.error) throw catsRes.error;
  const tipos = new Map(((tiposRes.data ?? []) as QpsTipo[]).map((t) => [t.id_tipo, t]));
  const categorias = (catsRes.data ?? []) as QpsCategoria[];
  const perguntas = pergsRes;

  const avaliacoes = aplicacoes.map((ap) => {
    const tipo = tipos.get(ap.id_tipo);
    const cats = categorias.filter((c) => c.id_tipo === ap.id_tipo);
    const resp = respondentes
      .filter((r) => r.id_aplicacao === ap.id_aplicacao)
      .map((r) => ({ setor: r.setor, respostas: r.respostas ?? {} }));
    const probs = probabilidades.filter((p) => p.id_aplicacao === ap.id_aplicacao);
    const setores = tipo
      ? listarSetoresQps(resp).map((s) => {
          const analise = calcularAnaliseSetor(s, cats, perguntas, resp, probs, tipo.escala_min, tipo.escala_max);
          const n = resp.filter((r) => (r.setor ?? "").trim() === s).length;
          return resumirSetor(
            s,
            n,
            // Categoria sem resposta no setor não tem nível — não vira "Baixo".
            analise
              .filter((c) => c.matriz)
              .map((c) => ({ nome: c.nome, fonteGeradora: c.fonteGeradora, nivel: c.matriz! })),
            // No QPS, "*" guarda o texto da aplicação inteira: vale quando o setor não tem o seu.
            {
              agravos: ap.agravos_por_setor?.[s] || ap.agravos_por_setor?.["*"],
              medidas: ap.medidas_por_setor?.[s] || ap.medidas_por_setor?.["*"],
            }
          );
        })
      : [];
    return {
      idEmpresa: ap.id_empresa,
      fonte: "Questionário" as const,
      id: ap.id_aplicacao,
      titulo: ap.titulo || "Questionário",
      status: ap.status,
      data: ap.data_elaboracao ?? ap.atualizado_em ?? ap.criado_em,
      responsavel: ap.responsavel ?? ap.usuario_nome,
      setores,
    };
  });
  return { avaliacoes, idsEmpresa: [...new Set(aplicacoes.map((a) => a.id_empresa))] };
}

export function useRiscosPsicossociais() {
  return useQuery({
    queryKey: ["riscos-psicossociais"],
    staleTime: 60_000,
    queryFn: async (): Promise<EmpresaRisco[]> => {
      const [drps, qps] = await Promise.all([carregarDrps(), carregarQps()]);

      const empresaPorId = new Map(drps.empresas.map((e) => [e.id_empresa, e]));
      const faltando = qps.idsEmpresa.filter((id) => id && !empresaPorId.has(id));
      if (faltando.length > 0) {
        const emps = await porLotes(faltando, async (lote) => {
          const { data, error } = await db()
            .from("empresas")
            .select("id_empresa, nome_empresa, cnpj, municipio, uf")
            .in("id_empresa", lote);
          if (error) throw error;
          return (data ?? []) as EmpresaMin[];
        });
        for (const e of emps) empresaPorId.set(e.id_empresa, e);
      }

      const porEmpresa = new Map<string, EmpresaRisco>();
      for (const av of [...drps.avaliacoes, ...qps.avaliacoes]) {
        const { idEmpresa, ...avaliacao } = av;
        let alvo = porEmpresa.get(idEmpresa);
        if (!alvo) {
          const e = empresaPorId.get(idEmpresa);
          alvo = {
            idEmpresa,
            nome: e?.nome_empresa ?? "Empresa sem cadastro",
            cnpj: e?.cnpj ?? null,
            municipio: e?.municipio ?? null,
            uf: e?.uf ?? null,
            avaliacoes: [],
          };
          porEmpresa.set(idEmpresa, alvo);
        }
        alvo.avaliacoes.push(avaliacao);
      }
      const lista = [...porEmpresa.values()];
      for (const e of lista) {
        e.avaliacoes.sort((a, b) => (b.data ?? "").localeCompare(a.data ?? ""));
      }
      return lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    },
  });
}
```

## B: `app/(app)/riscos-psicossociais/[idEmpresa]/page.tsx`

```tsx
"use client";

// Riscos Psicossociais de UMA empresa: dados cadastrais + o resultado final de
// cada risco, por setor. Só o nível final (matriz) — gravidade, probabilidade
// e perguntas ficam no laudo. Sem link para as telas de Análise, de propósito.

import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Building2, Layers, Users } from "lucide-react";
import { useRiscosPsicossociais } from "@/lib/hooks/useRiscosPsicossociais";
import { CORES_MATRIZ } from "@/lib/drps/calculos";
import type { NivelMatriz } from "@/lib/drps/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { useUserStore } from "@/lib/store";
import { cn, fmtData, formatCNPJ } from "@/lib/utils";

const STATUS_ROTULO: Record<string, string> = {
  CONCLUIDO: "Concluído",
  ENVIADO_CLIENTE: "Enviado ao cliente",
};

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

function SeloNivel({ nivel }: { nivel: NivelMatriz }) {
  return (
    <span
      className="inline-block min-w-[64px] rounded-full px-2.5 py-0.5 text-center text-xs font-semibold text-white"
      style={{ backgroundColor: CORES_MATRIZ[nivel] }}
    >
      {nivel}
    </span>
  );
}

function ListaTexto({ itens }: { itens: string[] }) {
  if (itens.length === 0) return <p className="text-sm text-gray-400">Não informado</p>;
  return (
    <ul className="list-disc space-y-0.5 pl-4 text-sm text-gray-700">
      {itens.map((i) => (
        <li key={i}>{i}</li>
      ))}
    </ul>
  );
}

function Info({ rotulo, valor, className }: { rotulo: string; valor: string | null | undefined; className?: string }) {
  return (
    <div className={className}>
      <div className="text-xs text-gray-500">{rotulo}</div>
      <div className="text-sm text-gray-900">{valor && valor.trim() ? valor : "—"}</div>
    </div>
  );
}

export default function RiscosEmpresaPage() {
  const user = useUserStore((s) => s.user);
  const { idEmpresa: bruto } = useParams<{ idEmpresa: string }>();
  const idEmpresa = decodeURIComponent(bruto);
  const { data: empresas = [], isLoading } = useRiscosPsicossociais();
  const riscos = empresas.find((e) => e.idEmpresa === idEmpresa) ?? null;

  const { data: cadastro } = useQuery({
    queryKey: ["riscos-psicossociais-empresa", idEmpresa],
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

  if (user?.perfil === "Cliente") {
    return <p className="py-10 text-center text-sm text-gray-500">Sem acesso a esta página.</p>;
  }

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
          href="/riscos-psicossociais"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-verde-primary"
        >
          <ArrowLeft className="size-4" /> Voltar às empresas
        </Link>
        <h1 className="mt-1 flex items-center gap-2 text-xl font-bold text-gray-900">
          <Building2 className="size-5 text-verde-primary" />
          {cadastro?.nome_empresa ?? riscos?.nome ?? "Empresa"}
        </h1>
        <p className="text-sm text-gray-500">Riscos psicossociais por setor — resultado final de cada risco.</p>
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
      ) : !riscos ? (
        <p className="rounded-2xl border border-gray-100 bg-white p-10 text-center text-sm text-gray-500 shadow-sm">
          Esta empresa não tem avaliação do DRPS ou do Questionário concluída.
        </p>
      ) : (
        riscos.avaliacoes.map((a) => (
          <section key={a.id} className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "rounded-md px-2 py-0.5 text-xs font-semibold",
                  a.fonte === "DRPS" ? "bg-violet-100 text-violet-700" : "bg-sky-100 text-sky-700"
                )}
              >
                {a.fonte}
              </span>
              <h2 className="text-base font-semibold text-gray-900">{a.titulo}</h2>
              <span className="text-xs text-gray-500">
                {STATUS_ROTULO[a.status] ?? a.status}
                {a.data ? ` · ${fmtData(a.data)}` : ""}
                {a.responsavel ? ` · ${a.responsavel}` : ""}
              </span>
            </div>

            {a.setores.length === 0 ? (
              <p className="rounded-2xl border border-gray-100 bg-white p-5 text-sm text-gray-500 shadow-sm">
                Sem respondentes importados nesta avaliação.
              </p>
            ) : (
              <div className="space-y-4">
                {a.setores.map((s) => (
                  <div key={s.setor} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h3 className="flex items-center gap-2 font-semibold text-gray-900">
                        <Layers className="size-4 text-verde-primary" /> {s.setor}
                      </h3>
                      <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                        <Users className="size-3.5" /> {s.respondentes} respondente{s.respondentes !== 1 ? "s" : ""}
                      </span>
                    </div>
                    {s.fatores.length === 0 ? (
                      <p className="text-sm text-gray-500">Nenhum risco com resposta neste setor.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        {/* Agravos e medidas são do SETOR, não de cada risco: uma célula
                            só, ocupando todas as linhas do setor — como no laudo. */}
                        <table className="w-full min-w-[960px] border-collapse text-sm">
                          <thead>
                            <tr className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                              <th className="w-64 border border-gray-200 px-3 py-2 font-medium">Risco</th>
                              <th className="w-32 border border-gray-200 px-3 py-2 font-medium">Resultado final</th>
                              <th className="border border-gray-200 px-3 py-2 font-medium">Fonte geradora</th>
                              <th className="w-64 border border-gray-200 px-3 py-2 font-medium">
                                Medidas de controle recomendadas (medidas que a empresa deve adotar)
                              </th>
                              <th className="w-56 border border-gray-200 px-3 py-2 font-medium">Possíveis agravos à saúde mental</th>
                            </tr>
                          </thead>
                          <tbody>
                            {s.fatores.map((f, i) => (
                              <tr key={f.nome}>
                                <td className="border border-gray-200 px-3 py-2 align-top text-gray-800">{f.nome}</td>
                                <td className="border border-gray-200 px-3 py-2 align-top">
                                  <SeloNivel nivel={f.nivel} />
                                </td>
                                <td className="border border-gray-200 px-3 py-2 align-top text-xs text-gray-600">
                                  {f.fonteGeradora ?? "—"}
                                </td>
                                {i === 0 && (
                                  <>
                                    <td rowSpan={s.fatores.length} className="border border-gray-200 px-3 py-2 align-top">
                                      <ListaTexto itens={s.medidas} />
                                    </td>
                                    <td rowSpan={s.fatores.length} className="border border-gray-200 px-3 py-2 align-top">
                                      <ListaTexto itens={s.agravos} />
                                    </td>
                                  </>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        ))
      )}
    </div>
  );
}
```

