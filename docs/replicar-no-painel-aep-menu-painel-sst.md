# Replicar no Painel SST: página AEP no menu do Painel SST

> **Como usar:** abra o Claude Code na pasta do **painel-sst** e diga:
> *"Siga o arquivo `replicar-no-painel-aep-menu-painel-sst.md`"*.
>
> Origem: JCN (`sst-jcn`), commit `0692d92` de 2026-10-02, já em produção lá.
> **Não mexe no banco.**

## O que faz

No menu lateral do **Painel SST**, logo abaixo de **Riscos Psicossociais**,
entra o item **AEP** (ícone `PersonStanding`). Ele abre a mesma tela da
**Sinalização de Fatores Psicossociais** do módulo AEP:

- **`/aep-psicossocial`:** lista só das empresas com fator organizacional
  marcado "Sim" nas AEPs. Tem busca por empresa/CNPJ e mostra o maior nível
  AIHA, o nº de alertas e de setores e a data da última AEP. A mais grave
  vem primeiro.
- **`/aep-psicossocial/[idEmpresa]`:** dados cadastrais da empresa e, por AEP,
  um setor embaixo do outro com a tabela **Fator de risco · Resultado final
  (AIHA) · Probabilidade · Severidade · Sinais observados**. Sem link para o
  editor da AEP.

Para não duplicar código, as duas páginas da Sinalização viraram componentes
(`SinalizacaoEmpresasLista` e `SinalizacaoEmpresaDetalhe`), que recebem
`basePath`: o caminho para onde vai o clique na empresa e o "Voltar". As rotas
`/sinalizacao-psicossocial/...` (módulo AEP) e `/aep-psicossocial/...` (Painel
SST) só renderizam esses componentes. Como as rotas novas ficam no grupo
`(app)`, a tela usa o layout e o menu do Painel SST.

## Passo 1: conferir o painel antes de copiar

| Usado pelo código | Conferir no painel |
|---|---|
| `lib/aep/sinalizacao.ts` (`montarSinalizacao`) e `components/aep/SeloNivelAiha.tsx` | vieram no MD `replicar-no-painel-aep-matriz-aiha.md` (seções I e J). **Aplique aquele MD antes** se ainda não estiverem lá |
| Páginas `app/(sinalizacao-psicossocial)/sinalizacao-psicossocial/page.tsx` e `[idEmpresa]/page.tsx` no formato de lista de empresas | também do MD da AEP/AIHA (seções K e L) |
| `useAepRelatorios` em `lib/hooks/useAep.ts`; `buscar` em `lib/busca/texto.ts`; `fmtData`, `formatCNPJ` e `cn` em `lib/utils.ts`; `LoadingSkeleton` | mesmos nomes |
| Menu do Painel SST em `components/layout/Sidebar.tsx`, com a lista `CONTROLE` (Certificados, Riscos Psicossociais) | no painel o menu pode ter outra forma: coloque o item **AEP** logo abaixo de Riscos Psicossociais, no mesmo grupo, que o cliente não vê |
| Grupo de rotas `app/(app)` do Painel SST | se o painel usar outro grupo para o menu do Painel SST, crie `aep-psicossocial` nele |

## Passo 2: código

| Arquivo | O quê | Seção |
|---|---|---|
| `components/aep/SinalizacaoEmpresasLista.tsx` | **novo**: a lista de empresas (antes era a página) | A |
| `components/aep/SinalizacaoEmpresaDetalhe.tsx` | **novo**: a página da empresa (antes era a página) | B |
| `app/(app)/aep-psicossocial/page.tsx` | **novo**: rota do Painel SST | C |
| `app/(app)/aep-psicossocial/[idEmpresa]/page.tsx` | **novo**: rota do Painel SST | D |
| `app/(sinalizacao-psicossocial)/sinalizacao-psicossocial/page.tsx` | **substituir**: só renderiza o componente | E |
| `app/(sinalizacao-psicossocial)/sinalizacao-psicossocial/[idEmpresa]/page.tsx` | **substituir**: só renderiza o componente | F |
| `components/layout/Sidebar.tsx` | item **AEP** no menu | G |

Se as páginas da Sinalização no painel tiverem diferenças locais, leve essas
diferenças para os componentes A e B antes de substituir E e F.

### A: `components/aep/SinalizacaoEmpresasLista.tsx`

```tsx
"use client";

// Lista das empresas com fatores organizacionais marcados "Sim" nas triagens
// AEP. Mesma organização da página Riscos Psicossociais (2026-10-02): clicar
// abre a página da empresa, com os setores e o nível de cada fator na matriz
// AIHA. Sem link para o editor da AEP. Usada em /sinalizacao-psicossocial
// (módulo AEP) e em /aep-psicossocial (menu do Painel SST); `basePath` diz
// para onde vai o clique na empresa.

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

export default function SinalizacaoEmpresasLista({
  basePath,
  titulo = "Sinalização de Fatores Psicossociais",
}: {
  basePath: string;
  titulo?: string;
}) {
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
          {titulo}
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
                  href={`${basePath}/${encodeURIComponent(e.idEmpresa)}`}
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

### B: `components/aep/SinalizacaoEmpresaDetalhe.tsx`

```tsx
"use client";

// Fatores psicossociais da AEP de UMA empresa: dados cadastrais e, por
// AEP, um bloco por setor (um embaixo do outro) com os fatores organizacionais
// marcados "Sim" — Fator · Resultado final (AIHA) · Probabilidade · Severidade
// · Sinais observados. Mesmo formato da página Riscos Psicossociais; sem link
// para o editor da AEP, de propósito. Usada em /sinalizacao-psicossocial/[id]
// e em /aep-psicossocial/[id]; `basePath` é a lista para onde o "Voltar" leva.

import { useMemo } from "react";
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

export default function SinalizacaoEmpresaDetalhe({
  idEmpresa,
  basePath,
}: {
  idEmpresa: string;
  basePath: string;
}) {
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
          href={basePath}
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

### C: `app/(app)/aep-psicossocial/page.tsx`

```tsx
"use client";

// AEP no menu do Painel SST (2026-10-02): a mesma lista da Sinalização de
// Fatores Psicossociais do módulo AEP, ao lado de Riscos Psicossociais.

import SinalizacaoEmpresasLista from "@/components/aep/SinalizacaoEmpresasLista";

export default function AepPsicossocialPage() {
  return <SinalizacaoEmpresasLista basePath="/aep-psicossocial" titulo="AEP — Fatores Psicossociais" />;
}
```

### D: `app/(app)/aep-psicossocial/[idEmpresa]/page.tsx`

```tsx
"use client";

import { useParams } from "next/navigation";
import SinalizacaoEmpresaDetalhe from "@/components/aep/SinalizacaoEmpresaDetalhe";

export default function AepPsicossocialEmpresaPage() {
  const { idEmpresa } = useParams<{ idEmpresa: string }>();
  return <SinalizacaoEmpresaDetalhe idEmpresa={decodeURIComponent(idEmpresa)} basePath="/aep-psicossocial" />;
}
```

### E: `app/(sinalizacao-psicossocial)/sinalizacao-psicossocial/page.tsx`

```tsx
"use client";

// Sinalização de Fatores Psicossociais (módulo AEP) — lista de empresas.

import SinalizacaoEmpresasLista from "@/components/aep/SinalizacaoEmpresasLista";

export default function SinalizacaoPsicossocialPage() {
  return <SinalizacaoEmpresasLista basePath="/sinalizacao-psicossocial" />;
}
```

### F: `app/(sinalizacao-psicossocial)/sinalizacao-psicossocial/[idEmpresa]/page.tsx`

```tsx
"use client";

import { useParams } from "next/navigation";
import SinalizacaoEmpresaDetalhe from "@/components/aep/SinalizacaoEmpresaDetalhe";

export default function SinalizacaoEmpresaPage() {
  const { idEmpresa } = useParams<{ idEmpresa: string }>();
  return <SinalizacaoEmpresaDetalhe idEmpresa={decodeURIComponent(idEmpresa)} basePath="/sinalizacao-psicossocial" />;
}
```

### G: diff de `components/layout/Sidebar.tsx`

```diff
@@ -12,6 +12,7 @@ import {
   Trash2,
   Award,
   Brain,
+  PersonStanding,
 } from "lucide-react";
 import { useUserStore } from "@/lib/store";
 import SidebarShell, { type NavItem, type NavSection } from "./SidebarShell";
@@ -22,10 +23,13 @@ const PRINCIPAL: NavItem[] = [
   { href: "/relatorios", label: "Relatórios", icon: BarChart3, variant: "report" },
 ];
 
-// Cliente não vê: as duas telas cruzam TODAS as empresas atendidas.
+// Cliente não vê: estas telas cruzam TODAS as empresas atendidas.
 const CONTROLE: NavItem[] = [
   { href: "/certificados", label: "Certificados", icon: Award },
   { href: "/riscos-psicossociais", label: "Riscos Psicossociais", icon: Brain, variant: "report" },
+  // Fatores psicossociais das triagens AEP (matriz AIHA) — mesma tela da
+  // Sinalização de Fatores Psicossociais do módulo AEP.
+  { href: "/aep-psicossocial", label: "AEP", icon: PersonStanding, variant: "report" },
 ];
 
 const ACOES: NavItem[] = [
```

## Passo 3: verificar

1. Rode `npx tsc --noEmit -p .`, `npx eslint` nos arquivos alterados e `npx next build`; todos devem terminar sem erros.
2. No menu do Painel SST, **AEP** aparece logo abaixo de Riscos Psicossociais, e
   não aparece para o perfil cliente.
3. `/aep-psicossocial` lista as empresas. Clicar abre `/aep-psicossocial/[id]`,
   e o "Voltar às empresas" volta para `/aep-psicossocial`, sem sair do Painel SST.
4. A Sinalização do módulo AEP (`/sinalizacao-psicossocial`) continua igual, e
   os links e o "Voltar" dela continuam em `/sinalizacao-psicossocial`.
5. Publique pelo fluxo de release do painel (versão, changelog, "Novidades").
