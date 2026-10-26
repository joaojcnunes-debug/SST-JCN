"use client";

import { Fragment, Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Building2, ChevronDown, ChevronRight, RotateCcw, UserRound } from "lucide-react";
import { mesAbsSP, rotuloMesAbs } from "@/lib/dashboard/mes";
import { instanteDeConclusao, mesDeConclusao, tecnicosCreditados } from "@/lib/dashboard/inspecoes";
import { admDoDoc, chaveNome, concluidosValidos, dataConclusaoDoc } from "@/lib/dashboard/documentos";
import { eventosDeAssociacao } from "@/lib/dashboard/associacoes-empresas";
import {
  nomeDaEmpresa,
  useAssociacoesEmpresas,
  useContasDoPainel,
  useInspecoesConcluidas,
  useReaberturas,
  useTecnicosDeCampo,
} from "@/lib/hooks/useDashboardFontes";
import { useDocumentosConcluidos } from "@/lib/hooks/useDocumentosConcluidos";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import type { FontePessoa } from "@/components/dashboard/TickPessoa";
import FiltroUnidade from "@/components/dashboard/FiltroUnidade";
import { useFiltroUnidadeDashboard } from "@/lib/hooks/useFiltroUnidadeDashboard";

/**
 * Página da pessoa (pedido de 26/10/2026): ao clicar no nome num gráfico "por pessoa" do Dashboard,
 * a relação de EMPRESAS em que ela atuou — pela régua do gráfico de origem:
 *  - inspecoes:  inspeções em que ela foi o técnico de campo, no mês da 1ª conclusão;
 *  - documentos: documentos que ela concluiu (responsável na 1ª conclusão);
 *  - associados: empresas associadas a ela (por ela ou por outra pessoa), no mês da associação.
 * Abre em TODOS os meses, com filtro de mês.
 */

interface Registro {
  id_inspecao: string;
  id_empresa: string | null;
  empresa: string;
  mes: number;
  data: string;
  reaberta: boolean;
  detalhe: string;
}

const TITULO: Record<FontePessoa, string> = {
  inspecoes: "Inspeções realizadas (técnico de campo)",
  documentos: "Documentos concluídos (ADM)",
  associados: "Documentos associados",
};
const VOLTAR: Record<FontePessoa, string> = {
  inspecoes: "/dashboard/inspecoes-concluidas",
  documentos: "/dashboard/documentos-emitidos",
  associados: "/dashboard/por-associados",
};

function dataBR(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function useRegistros(fonte: FontePessoa, nome: string): { registros: Registro[]; carregando: boolean } {
  const insp = useInspecoesConcluidas();
  const tec = useTecnicosDeCampo();
  const contas = useContasDoPainel();
  const reabInsp = useReaberturas("inspecao");
  const docs = useDocumentosConcluidos();
  const reabDoc = useReaberturas("documento");
  const assoc = useAssociacoesEmpresas();

  const registros = useMemo<Registro[]>(() => {
    const chave = chaveNome(nome);
    if (fonte === "inspecoes") {
      const contasL = contas.data ?? [];
      const opcoes = { tecnicosDeCampo: tec.data ?? new Map(), cadastro: contasL.map((c) => c.nome), contas: contasL };
      const reab = new Set((reabInsp.data ?? []).map((r) => r.id_inspecao));
      return (insp.data ?? [])
        // Nome EXATO, como a barra do gráfico (porTecnico agrupa pelo nome canônico, não pela chave).
        .filter((r) => mesDeConclusao(r) != null && tecnicosCreditados(r, opcoes).nomes.includes(nome))
        .map((r) => ({
          id_inspecao: r.id_inspecao,
          id_empresa: r.id_empresa ?? null,
          empresa: nomeDaEmpresa(r.empresas),
          mes: mesDeConclusao(r)!,
          data: instanteDeConclusao(r),
          reaberta: reab.has(r.id_inspecao),
          detalhe: `visita ${r.data_inspecao ? r.data_inspecao.split("-").reverse().join("/") : "—"}`,
        }));
    }
    if (fonte === "documentos") {
      const reab = new Set((reabDoc.data ?? []).map((r) => r.id_inspecao));
      return concluidosValidos(docs.data ?? [])
        .filter((d) => chaveNome(admDoDoc(d)) === chave)
        .map((d) => ({
          id_inspecao: d.id_inspecao,
          id_empresa: d.id_empresa ?? null,
          empresa: nomeDaEmpresa(d.empresas),
          mes: mesAbsSP(dataConclusaoDoc(d)!),
          data: dataConclusaoDoc(d)!,
          reaberta: reab.has(d.id_inspecao),
          detalhe: "documento concluído",
        }));
    }
    const a = assoc.data;
    if (!a) return [];
    return eventosDeAssociacao(a.assoc, a.assuncoes, a.docs, mesAbsSP)
      .filter((e) => e.chave === chave)
      .map((e) => ({
        id_inspecao: e.id_inspecao,
        id_empresa: e.id_empresa,
        empresa: e.nome_empresa,
        mes: e.mes,
        data: e.em,
        reaberta: false,
        detalhe: e.origem === "assuncao" ? "assumiu a elaboração" : "associado ao documento",
      }));
  }, [fonte, nome, insp.data, tec.data, contas.data, reabInsp.data, docs.data, reabDoc.data, assoc.data]);

  const carregando =
    fonte === "inspecoes" ? insp.isLoading || tec.isLoading : fonte === "documentos" ? docs.isLoading : assoc.isLoading;
  return { registros, carregando };
}

function Conteudo() {
  const params = useSearchParams();
  const fonteBruta = params.get("fonte");
  const fonte: FontePessoa = fonteBruta === "documentos" || fonteBruta === "associados" ? fonteBruta : "inspecoes";
  const nome = params.get("nome") ?? "";
  const { registros: todos, carregando: carregandoRegs } = useRegistros(fonte, nome);
  // Mesma unidade do gráfico de onde veio (o filtro é compartilhado entre as telas do dashboard).
  const filtroUnidade = useFiltroUnidadeDashboard();
  const registros = todos.filter((r) => filtroUnidade.naUnidade(r.id_empresa));
  const carregando = carregandoRegs || filtroUnidade.carregando;
  const [mes, setMes] = useState<number | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);

  const meses = [...new Set(registros.map((r) => r.mes))].sort((a, b) => b - a);
  const recorte = mes == null ? registros : registros.filter((r) => r.mes === mes);

  // Por empresa: registros, meses e a data mais recente.
  const porEmpresa = new Map<string, { id_empresa: string | null; empresa: string; itens: Registro[] }>();
  for (const r of recorte) {
    const k = r.id_empresa ?? r.empresa;
    const g = porEmpresa.get(k) ?? { id_empresa: r.id_empresa, empresa: r.empresa, itens: [] };
    g.itens.push(r);
    porEmpresa.set(k, g);
  }
  const empresas = [...porEmpresa.values()].sort(
    (a, b) => b.itens.length - a.itens.length || a.empresa.localeCompare(b.empresa, "pt-BR"),
  );
  // No gráfico de associados a empresa conta 1 vez POR MÊS; "todos os meses" lá é a soma dos meses.
  // Este é o número que bate com o gráfico.
  const empresasMes = new Set(recorte.map((r) => `${r.id_empresa ?? r.empresa}|${r.mes}`)).size;
  const unidade = fonte === "inspecoes" ? "inspeç" : "documento";
  const plural = (n: number) => (fonte === "inspecoes" ? (n !== 1 ? "ões" : "ão") : n !== 1 ? "s" : "");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={VOLTAR[fonte]} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-verde-primary">
            <ArrowLeft className="size-4" /> Voltar ao gráfico
          </Link>
          <h1 className="mt-1 flex items-center gap-2 text-xl font-bold text-gray-900">
            <UserRound className="size-5 text-verde-primary" />
            {nome || "Pessoa"}
          </h1>
          <p className="text-sm text-gray-500">
            {TITULO[fonte]} — empresas em que atuou
            {filtroUnidade.nomeUnidade ? ` · unidade ${filtroUnidade.nomeUnidade}` : ""}
          </p>
        </div>
        <FiltroUnidade idUnidade={filtroUnidade.idUnidade} unidades={filtroUnidade.unidades} onChange={filtroUnidade.setIdUnidade} />
      </div>

      <div className="reveal-up rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-700">
            {carregando ? (
              "Carregando…"
            ) : (
              <>
                <strong>{empresas.length}</strong> empresa{empresas.length !== 1 ? "s" : ""} · <strong>{recorte.length}</strong>{" "}
                {unidade}
                {plural(recorte.length)} {mes == null ? "em todos os meses" : `em ${rotuloMesAbs(mes, true)}`}
                {fonte === "associados" && mes == null && empresasMes !== empresas.length && (
                  <span className="block text-xs text-gray-500">
                    No gráfico: <strong>{empresasMes}</strong> — a mesma empresa conta uma vez em cada mês em que foi associada.
                  </span>
                )}
              </>
            )}
          </p>
          <label className="flex items-center gap-2 text-xs text-gray-600">
            Mês
            <select
              value={mes ?? ""}
              onChange={(e) => setMes(e.target.value ? Number(e.target.value) : null)}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-800"
            >
              <option value="">Todos os meses</option>
              {meses.map((m) => (
                <option key={m} value={m}>
                  {rotuloMesAbs(m, true)}
                </option>
              ))}
            </select>
          </label>
        </div>

        {carregando ? (
          <LoadingSkeleton rows={5} />
        ) : empresas.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">Nenhuma empresa neste recorte.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500">
                  <th className="py-2 pr-3 font-medium">Empresa</th>
                  <th className="py-2 pr-3 font-medium">{fonte === "inspecoes" ? "Inspeções" : "Documentos"}</th>
                  <th className="py-2 pr-3 font-medium">Meses</th>
                  <th className="py-2 font-medium">Mais recente</th>
                </tr>
              </thead>
              <tbody>
                {empresas.map((g) => {
                  const k = g.id_empresa ?? g.empresa;
                  const ok = aberta === k;
                  const mesesG = [...new Set(g.itens.map((i) => i.mes))].sort((a, b) => a - b).map((m) => rotuloMesAbs(m, true));
                  const recente = g.itens.reduce((a, b) => (b.data > a.data ? b : a));
                  return (
                    <Fragment key={k}>
                      <tr className="border-b border-gray-50">
                        <td className="py-2 pr-3">
                          <button type="button" onClick={() => setAberta(ok ? null : k)} className="flex items-center gap-1 text-left text-gray-800 hover:text-verde-primary">
                            {ok ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                            <Building2 className="size-3.5 text-gray-400" /> {g.empresa}
                          </button>
                        </td>
                        <td className="py-2 pr-3 font-semibold text-gray-800">
                          {g.itens.length}
                          {g.itens.some((i) => i.reaberta) && (
                            <span className="ml-1 inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                              <RotateCcw className="size-3" /> reaberta
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-xs text-gray-600">{mesesG.join(", ")}</td>
                        <td className="whitespace-nowrap py-2 text-gray-600">{dataBR(recente.data)}</td>
                      </tr>
                      {ok &&
                        g.itens
                          .sort((a, b) => b.data.localeCompare(a.data))
                          .map((i) => (
                            <tr key={`${k}-${i.id_inspecao}-${i.data}`} className="border-b border-gray-50 bg-gray-50/60 text-xs">
                              <td className="py-1.5 pl-7 pr-3" colSpan={2}>
                                <Link href={`/inspecoes/${i.id_inspecao}`} className="text-sky-700 hover:underline">
                                  {i.id_inspecao}
                                </Link>{" "}
                                <span className="text-gray-500">· {i.detalhe}</span>
                                {i.reaberta && <span className="ml-1 text-amber-700">· reaberta depois de concluída</span>}
                              </td>
                              <td className="py-1.5 pr-3 text-gray-600">{rotuloMesAbs(i.mes, true)}</td>
                              <td className="whitespace-nowrap py-1.5 text-gray-600">{dataBR(i.data)}</td>
                            </tr>
                          ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PaginaPessoa() {
  return (
    <Suspense fallback={<LoadingSkeleton rows={5} />}>
      <Conteudo />
    </Suspense>
  );
}
