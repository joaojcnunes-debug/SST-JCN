"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Target } from "lucide-react";
import {
  useProdUnidades,
  useProdColaboradores,
  useProdSnapshots,
  useProdRegistros,
} from "@/lib/hooks/useProdutividade";

const MESES_LABEL = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** Cor do % de atendimento (realizado ÷ backlog). */
function pctCor(pct: number): string {
  if (pct >= 100) return "bg-green-100 text-green-700";
  if (pct >= 50) return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-700";
}

function Pct({ feito, base }: { feito: number; base: number }) {
  if (base <= 0) return <span className="text-xs text-gray-300">—</span>;
  const pct = Math.round((feito / base) * 100);
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${pctCor(pct)}`}>
      {pct}%
    </span>
  );
}

export default function AcompanhamentoPage() {
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());

  const { data: unidades = [], isLoading: loadingU } = useProdUnidades();
  const { data: snapshots = [], isLoading: loadingS } = useProdSnapshots(mes, ano);
  const { data: registros = [], isLoading: loadingR } = useProdRegistros();
  const { data: colaboradores = [] } = useProdColaboradores();

  const isLoading = loadingU || loadingS || loadingR;

  function prevMes() { if (mes === 1) { setMes(12); setAno((a) => a - 1); } else setMes((m) => m - 1); }
  function nextMes() { if (mes === 12) { setMes(1); setAno((a) => a + 1); } else setMes((m) => m + 1); }

  const linhas = useMemo(() => {
    const snapPorUnidade = new Map(snapshots.map((s) => [s.id_unidade, s]));
    // Produção realizada no mês, somada por unidade
    const prodPorUnidade: Record<string, { docs: number; insp: number }> = {};
    for (const r of registros) {
      if (r.mes !== mes || r.ano !== ano) continue;
      if (!prodPorUnidade[r.id_unidade]) prodPorUnidade[r.id_unidade] = { docs: 0, insp: 0 };
      prodPorUnidade[r.id_unidade].docs += r.docs_gerados;
      prodPorUnidade[r.id_unidade].insp += r.visitas_realizadas;
    }
    return unidades.map((u) => {
      const s = snapPorUnidade.get(u.id);
      const p = prodPorUnidade[u.id] ?? { docs: 0, insp: 0 };
      const backlogDocs = (s?.vencidos ?? 0) + (s?.vencendo ?? 0);
      const backlogInsp = s?.inspecao_pendente ?? 0;
      return {
        unidade: u,
        backlogDocs,
        docsFeitos: p.docs,
        backlogInsp,
        inspFeitas: p.insp,
        adms: colaboradores.filter((c) => c.id_unidade === u.id && c.ativo && c.tipo === "documentos").length,
        tecs: colaboradores.filter((c) => c.id_unidade === u.id && c.ativo && c.tipo === "tecnico_campo").length,
      };
    });
  }, [snapshots, registros, unidades, colaboradores, mes, ano]);

  const tot = linhas.reduce(
    (a, l) => {
      a.backlogDocs += l.backlogDocs; a.docsFeitos += l.docsFeitos;
      a.backlogInsp += l.backlogInsp; a.inspFeitas += l.inspFeitas;
      return a;
    },
    { backlogDocs: 0, docsFeitos: 0, backlogInsp: 0, inspFeitas: 0 },
  );

  const temDados = linhas.some((l) => l.backlogDocs || l.docsFeitos || l.backlogInsp || l.inspFeitas);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projetado × Realizado</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Backlog do mês (Controle Mensal) × produção lançada (Registros Mensais), por unidade
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 shadow-sm ring-1 ring-black/5">
          <button type="button" onClick={prevMes} className="rounded p-1 hover:bg-gray-100">
            <ChevronLeft className="size-4 text-gray-500" />
          </button>
          <p className="min-w-[140px] text-center text-sm font-bold text-gray-800">
            {MESES_LABEL[mes - 1]} de {ano}
          </p>
          <button type="button" onClick={nextMes} className="rounded p-1 hover:bg-gray-100">
            <ChevronRight className="size-4 text-gray-500" />
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 className="size-4 animate-spin" /> Carregando dados…
        </div>
      )}

      {!isLoading && temDados && (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-[11px] uppercase text-gray-400">
                  <th className="px-4 py-2.5 text-left">Unidade</th>
                  <th className="px-4 py-2.5 text-center" colSpan={3}>Documentos (vencidos + vencendo)</th>
                  <th className="px-4 py-2.5 text-center" colSpan={3}>Inspeções</th>
                  <th className="px-4 py-2.5 text-center">Equipe</th>
                </tr>
                <tr className="border-b border-gray-100 bg-gray-50 text-[10px] uppercase text-gray-400">
                  <th className="px-4 py-1.5 text-left"></th>
                  <th className="px-4 py-1.5 text-right">Backlog</th>
                  <th className="px-4 py-1.5 text-right">Feitos</th>
                  <th className="px-4 py-1.5 text-center">Atend.</th>
                  <th className="px-4 py-1.5 text-right">Pend.</th>
                  <th className="px-4 py-1.5 text-right">Feitas</th>
                  <th className="px-4 py-1.5 text-center">Atend.</th>
                  <th className="px-4 py-1.5 text-center">ADM/Téc</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {linhas.map((l) => (
                  <tr key={l.unidade.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-2.5 font-medium text-gray-800">{l.unidade.nome}</td>
                    <td className="px-4 py-2.5 text-right text-gray-600">{l.backlogDocs}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-gray-800">{l.docsFeitos}</td>
                    <td className="px-4 py-2.5 text-center"><Pct feito={l.docsFeitos} base={l.backlogDocs} /></td>
                    <td className="px-4 py-2.5 text-right text-gray-600">{l.backlogInsp}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-gray-800">{l.inspFeitas}</td>
                    <td className="px-4 py-2.5 text-center"><Pct feito={l.inspFeitas} base={l.backlogInsp} /></td>
                    <td className="px-4 py-2.5 text-center text-xs text-gray-500">{l.adms}/{l.tecs}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-gray-200 bg-gray-50 text-xs font-semibold text-gray-700">
                  <td className="px-4 py-2 uppercase tracking-wide text-gray-400">Total</td>
                  <td className="px-4 py-2 text-right">{tot.backlogDocs}</td>
                  <td className="px-4 py-2 text-right">{tot.docsFeitos}</td>
                  <td className="px-4 py-2 text-center"><Pct feito={tot.docsFeitos} base={tot.backlogDocs} /></td>
                  <td className="px-4 py-2 text-right">{tot.backlogInsp}</td>
                  <td className="px-4 py-2 text-right">{tot.inspFeitas}</td>
                  <td className="px-4 py-2 text-center"><Pct feito={tot.inspFeitas} base={tot.backlogInsp} /></td>
                  <td className="px-4 py-2"></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="border-t border-gray-100 px-4 py-2.5 text-[11px] text-gray-400">
            <strong>Atend.</strong> = produção realizada ÷ backlog do mês.
            Backlog vem do <strong>Controle Mensal</strong>; produção vem dos <strong>Registros Mensais</strong>.
          </div>
        </div>
      )}

      {!isLoading && !temDados && (
        <div className="rounded-xl bg-white p-16 text-center shadow-sm ring-1 ring-black/5">
          <Target className="mx-auto size-14 text-gray-200" />
          <h3 className="mt-4 text-lg font-semibold text-gray-600">
            Sem dados para {MESES_LABEL[mes - 1]} de {ano}
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-400">
            Preencha o <strong>Controle Mensal</strong> (backlog) e os <strong>Registros Mensais</strong>
            (produção realizada) do mês para comparar projetado × realizado.
          </p>
        </div>
      )}
    </div>
  );
}
