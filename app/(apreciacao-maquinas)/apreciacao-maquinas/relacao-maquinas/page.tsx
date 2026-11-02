"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { List, Search, Printer, Loader2, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";
import { useRelacaoMaquinas } from "@/lib/hooks/useRelacaoMaquinas";
import { useEmpresas } from "@/lib/hooks/useEmpresas";
import RelatorioPrintHeader from "@/components/layout/RelatorioPrintHeader";
import { buscar } from "@/lib/busca/texto";
import AvisoBuscaAproximada from "@/components/ui/AvisoBuscaAproximada";
import { cn } from "@/lib/utils";
import {
  GRAU_RISCO_INSPECAO_MAQUINA_LABELS,
  type GrauRiscoInspecaoMaquina,
} from "@/lib/supabase/types";

/**
 * Relação de Máquinas e Equipamentos — NR-12 item 1.7 alínea "a".
 *
 * SÓ LEITURA DESDE 30/09/2026 (decisão dele). A lista vem da aba Máquinas das
 * inspeções — é lá que o técnico cadastra e atualiza. Antes esta tela tinha
 * cadastro próprio em `inventario_maquinas`, uma segunda cópia que parou em
 * junho enquanto a inspeção seguia viva. Corrigir uma máquina = "Abrir na
 * inspeção". Saíram as colunas Código interno, Capacidade, Finalidade e Status:
 * a inspeção não tem esses campos (no inventário estavam vazios em 50 de 50).
 */

const GRAU_RISCO_COR: Record<GrauRiscoInspecaoMaquina, string> = {
  BAIXO: "bg-emerald-100 text-emerald-700",
  MEDIO: "bg-amber-100 text-amber-700",
  ALTO: "bg-orange-100 text-orange-700",
  CRITICO: "bg-red-100 text-red-700",
};

const SELECT_CLASS =
  "rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500";

const dataBR = (iso: string | null) =>
  iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—";

export default function RelacaoMaquinasPage() {
  const { data: maquinas = [], isLoading, error } = useRelacaoMaquinas();
  const { data: empresas = [] } = useEmpresas();

  const [busca, setBusca] = useState("");
  const [filtroEmpresa, setFiltroEmpresa] = useState("");
  const [filtroSetor, setFiltroSetor] = useState("");
  const [filtroGrau, setFiltroGrau] = useState<GrauRiscoInspecaoMaquina | "">("");
  const [filtroAdequacao, setFiltroAdequacao] = useState<"" | "sim" | "nao">("");

  // Seleção manual para a impressão. Vazia = imprime tudo que está filtrado;
  // com linhas marcadas, só as marcadas saem no papel.
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());

  const empresaMap = useMemo(() => {
    const m = new Map<string, string>();
    empresas.forEach((e) => m.set(e.id_empresa, e.nome_empresa));
    return m;
  }, [empresas]);

  // Só as empresas que têm máquina: 131 de um cadastro com centenas.
  const empresasComMaquina = useMemo(() => {
    const ids = new Set(maquinas.map((m) => m.id_empresa).filter((id): id is string => !!id));
    return [...ids]
      .map((id) => ({ id, nome: empresaMap.get(id) ?? id }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [maquinas, empresaMap]);

  // Setores da empresa escolhida (ou de todas, se nenhuma).
  const setoresUnicos = useMemo(() => {
    const s = new Set<string>();
    maquinas.forEach((m) => {
      if (filtroEmpresa && m.id_empresa !== filtroEmpresa) return;
      m.setores.forEach((n) => s.add(n));
    });
    return [...s].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [maquinas, filtroEmpresa]);

  const { itens: filtradas, aproximado } = useMemo(() => {
    const dosFiltros = maquinas.filter((m) => {
      if (filtroEmpresa && m.id_empresa !== filtroEmpresa) return false;
      if (filtroSetor && !m.setores.includes(filtroSetor)) return false;
      if (filtroGrau && m.grau_risco !== filtroGrau) return false;
      if (filtroAdequacao === "sim" && m.necessita_adequacao_nr12 !== true) return false;
      if (filtroAdequacao === "nao" && m.necessita_adequacao_nr12 === true) return false;
      return true;
    });
    // Busca tolerante (acento, ordem das palavras, erro de digitação); mantém a ordem da relação.
    return buscar(
      dosFiltros,
      busca,
      (m) => [
        m.nome, m.tipo, m.tag, m.marca, m.modelo, m.numero_serie,
        ...m.setores,
        empresaMap.get(m.id_empresa ?? ""),
      ],
      { manterOrdem: true },
    );
  }, [maquinas, busca, filtroEmpresa, filtroSetor, filtroGrau, filtroAdequacao, empresaMap]);

  const stats = useMemo(() => ({
    total: filtradas.length,
    empresas: new Set(filtradas.map((m) => m.id_empresa)).size,
    adequacao: filtradas.filter((m) => m.necessita_adequacao_nr12 === true).length,
    altoCritico: filtradas.filter((m) => m.grau_risco === "ALTO" || m.grau_risco === "CRITICO").length,
  }), [filtradas]);

  // A seleção só vale para o que está visível: mudar o filtro não pode fazer
  // sair no papel uma máquina que o usuário nem enxerga mais na tela.
  const idsFiltrados = useMemo(() => filtradas.map((m) => m.id), [filtradas]);
  const selecionadasVisiveis = useMemo(
    () => idsFiltrados.filter((id) => selecionadas.has(id)),
    [idsFiltrados, selecionadas],
  );
  const temSelecao = selecionadasVisiveis.length > 0;
  const todasMarcadas = idsFiltrados.length > 0 && selecionadasVisiveis.length === idsFiltrados.length;

  function toggleSelecao(id: string) {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleTodasVisiveis() {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      if (todasMarcadas) idsFiltrados.forEach((id) => next.delete(id));
      else idsFiltrados.forEach((id) => next.add(id));
      return next;
    });
  }

  const empresaImpressao = filtroEmpresa ? empresaMap.get(filtroEmpresa) ?? null : null;
  const dataInspecaoImpressao = filtroEmpresa
    ? filtradas.find((m) => m.id_empresa === filtroEmpresa)?.data_inspecao ?? null
    : null;

  // A relação é um entregável de UMA empresa: sem empresa escolhida a
  // impressão misturaria clientes.
  function handleImprimir() {
    if (!filtroEmpresa) {
      toast.error("Escolha a empresa antes de imprimir — a relação é um documento de um cliente só.");
      return;
    }
    if (filtradas.length === 0) {
      toast.error("Nenhuma máquina nos filtros atuais — não há o que imprimir.");
      return;
    }
    window.print();
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 print:max-w-none">
      <style>{`
        /* Nº por contador de CSS, não pelo índice do array: linha escondida na
           impressão (não selecionada) não incrementa, então o papel sai 1,2,3...
           sem buracos mesmo com seleção parcial. */
        .relacao-tabela tbody { counter-reset: linha-relacao; }
        .relacao-tabela tbody tr { counter-increment: linha-relacao; }
        .relacao-tabela .col-num::after { content: counter(linha-relacao); }
        @media print {
          @page { size: A4 landscape; margin: 1.5cm; }
          body { font-size: 10pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
      `}</style>

      <RelatorioPrintHeader
        titulo="Relação de Máquinas e Equipamentos"
        subtitulo={empresaImpressao ?? "Atendimento NR-12 — item 1.7 alínea 'a'"}
        terciario={
          `Atendimento NR-12 — item 1.7 alínea 'a'` +
          (dataInspecaoImpressao ? ` · Inspeção de ${dataBR(dataInspecaoImpressao)}` : "") +
          ` · Emitido em ${new Date().toLocaleDateString("pt-BR")}`
        }
      />

      {/* Topo — tela */}
      <div className="no-print flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
            <List className="size-5 text-orange-600" />
            Relação de Máquinas e Equipamentos
          </h1>
          <p className="text-xs text-gray-500">
            NR-12 item 1.7 alínea &quot;a&quot; — vem da aba Máquinas da inspeção mais recente de cada
            empresa. Para corrigir uma máquina, abra a inspeção.
          </p>
        </div>
        <button
          type="button"
          onClick={handleImprimir}
          title={
            !filtroEmpresa
              ? "Escolha a empresa para imprimir"
              : temSelecao
                ? `Imprimir só as ${selecionadasVisiveis.length} máquinas marcadas`
                : "Imprimir a relação inteira desta empresa"
          }
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          <Printer className="size-4" /> Imprimir / PDF
        </button>
      </div>

      {/* Stats */}
      <div className="no-print grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Máquinas listadas" valor={stats.total} />
        <StatCard label="Empresas" valor={stats.empresas} />
        <StatCard label="Necessita adequação NR-12" valor={stats.adequacao} />
        <StatCard label="Grau alto ou crítico" valor={stats.altoCritico} />
      </div>

      {/* Filtros */}
      <div className="no-print flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, TAG, modelo, setor, empresa..."
            className="w-full rounded-md border border-gray-300 bg-white px-9 py-1.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>
        <select
          value={filtroEmpresa}
          onChange={(e) => { setFiltroEmpresa(e.target.value); setFiltroSetor(""); }}
          className={SELECT_CLASS}
        >
          <option value="">Todas as empresas</option>
          {empresasComMaquina.map((e) => (
            <option key={e.id} value={e.id}>{e.nome}</option>
          ))}
        </select>
        {setoresUnicos.length > 0 && (
          <select value={filtroSetor} onChange={(e) => setFiltroSetor(e.target.value)} className={SELECT_CLASS}>
            <option value="">Todos os setores</option>
            {setoresUnicos.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}
        <select
          value={filtroGrau}
          onChange={(e) => setFiltroGrau(e.target.value as GrauRiscoInspecaoMaquina | "")}
          className={SELECT_CLASS}
        >
          <option value="">Todos os graus de risco</option>
          {(Object.keys(GRAU_RISCO_INSPECAO_MAQUINA_LABELS) as GrauRiscoInspecaoMaquina[]).map((g) => (
            <option key={g} value={g}>{GRAU_RISCO_INSPECAO_MAQUINA_LABELS[g]}</option>
          ))}
        </select>
        <select
          value={filtroAdequacao}
          onChange={(e) => setFiltroAdequacao(e.target.value as "" | "sim" | "nao")}
          className={SELECT_CLASS}
        >
          <option value="">Adequação NR-12: todas</option>
          <option value="sim">Necessita adequação</option>
          <option value="nao">Sem adequação apontada</option>
        </select>
      </div>

      {/* Tabela */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-500">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Não foi possível carregar a relação. Recarregue a página; se continuar, avise o suporte.
        </div>
      ) : filtradas.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-500">
          {maquinas.length === 0
            ? "Nenhuma máquina nas inspeções que você enxerga. As máquinas são cadastradas na aba Máquinas da inspeção."
            : "Nenhum resultado para os filtros atuais."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <AvisoBuscaAproximada aproximado={aproximado} busca={busca} total={filtradas.length} className="m-3 print:hidden" />
          <table className="relacao-tabela min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-600">
                <th className="px-2 py-2 no-print">
                  <input
                    type="checkbox"
                    checked={todasMarcadas}
                    onChange={toggleTodasVisiveis}
                    title="Marcar / desmarcar todas as linhas listadas"
                    className="size-3.5 accent-orange-600"
                  />
                </th>
                <th className="px-2 py-2 text-right">Nº</th>
                <th className="px-3 py-2">TAG</th>
                <th className="px-3 py-2">Máquina / Tipo</th>
                <th className="px-3 py-2">Fabricante / Modelo</th>
                <th className="px-3 py-2">Série</th>
                <th className="px-3 py-2">Ano</th>
                <th className="px-3 py-2">Empresa / Setor</th>
                <th className="px-3 py-2">Adequação NR-12</th>
                <th className="px-3 py-2">Grau de Risco</th>
                <th className="px-3 py-2 no-print">Inspeção</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtradas.map((m, idx) => (
                <tr
                  key={m.id}
                  className={cn(
                    "hover:bg-gray-50",
                    idx % 2 === 1 && "bg-gray-50/40",
                    // Com seleção ativa, as não marcadas somem só no papel.
                    temSelecao && !selecionadas.has(m.id) && "print:hidden",
                  )}
                >
                  <td className="px-2 py-2 no-print">
                    <input
                      type="checkbox"
                      checked={selecionadas.has(m.id)}
                      onChange={() => toggleSelecao(m.id)}
                      title="Incluir esta máquina na impressão"
                      className="size-3.5 accent-orange-600"
                    />
                  </td>
                  <td className="col-num px-2 py-2 text-right text-xs font-semibold text-gray-500" />
                  <td className="px-3 py-2">
                    <p className="font-mono text-xs text-gray-700">{m.tag || "—"}</p>
                  </td>
                  <td className="px-3 py-2">
                    <p className="font-semibold text-gray-900">{m.nome}</p>
                    {m.tipo && <p className="text-[11px] text-gray-500">{m.tipo}</p>}
                  </td>
                  <td className="px-3 py-2">
                    <p className="text-gray-700">{m.marca || "—"}</p>
                    {m.modelo && <p className="text-[11px] text-gray-500">{m.modelo}</p>}
                  </td>
                  <td className="px-3 py-2">
                    <p className="font-mono text-xs text-gray-700">{m.numero_serie || "—"}</p>
                  </td>
                  <td className="px-3 py-2 text-gray-700">{m.ano_fabricacao || "—"}</td>
                  <td className="px-3 py-2">
                    <p className="text-gray-700">{m.id_empresa ? (empresaMap.get(m.id_empresa) ?? "—") : "—"}</p>
                    {m.setores.length > 0 && (
                      <p className="text-[11px] text-gray-500">{m.setores.join(", ")}</p>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {m.necessita_adequacao_nr12 === true ? (
                      <span className="text-[11px] font-semibold text-red-600">⚠ Necessita</span>
                    ) : m.necessita_adequacao_nr12 === false ? (
                      <span className="text-[11px] text-gray-600">Não</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {m.grau_risco ? (
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", GRAU_RISCO_COR[m.grau_risco])}>
                        {GRAU_RISCO_INSPECAO_MAQUINA_LABELS[m.grau_risco]}
                      </span>
                    ) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-3 py-2 no-print">
                    <Link
                      href={`/inspecoes/${m.id_inspecao}?aba=maquinas`}
                      title="Abrir a aba Máquinas desta inspeção para corrigir"
                      className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-orange-700 hover:underline"
                    >
                      {dataBR(m.data_inspecao)} <ExternalLink className="size-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="no-print flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-4 py-2 text-xs text-gray-500">
            <span>
              {filtradas.length} {filtradas.length === 1 ? "máquina" : "máquinas"} exibidas
              {filtradas.length !== maquinas.length && ` de ${maquinas.length} total`}
            </span>
            {temSelecao ? (
              <span className="flex items-center gap-2 font-semibold text-orange-700">
                A impressão sairá com {selecionadasVisiveis.length}{" "}
                {selecionadasVisiveis.length === 1 ? "máquina marcada" : "máquinas marcadas"}
                <button
                  type="button"
                  onClick={() => setSelecionadas(new Set())}
                  className="rounded border border-orange-300 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700 hover:bg-orange-50"
                >
                  Limpar seleção
                </button>
              </span>
            ) : (
              <span>Sem nada marcado, a impressão sai com a lista inteira acima.</span>
            )}
          </div>
        </div>
      )}

      {/* Rodapé de impressão */}
      <div className="relacao-maquinas-footer-print mt-6 text-center text-[9px] text-gray-500 border-t border-gray-200 pt-3">
        Relação de Máquinas e Equipamentos — NR-12 item 1.7 alínea &quot;a&quot; · Gerado por JCN Consultoria SST · {new Date().toLocaleDateString("pt-BR")}
      </div>
    </div>
  );
}

function StatCard({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{valor}</p>
    </div>
  );
}
