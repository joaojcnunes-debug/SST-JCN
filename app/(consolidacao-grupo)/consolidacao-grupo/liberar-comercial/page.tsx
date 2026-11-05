"use client";

// Consolidação › Liberar para o Comercial (0.3.233, refeita na 0.3.235, banco v322). Uma linha por
// empresa com conciliação fechada e ao menos um risco. O atendimento fica em [idEmpresa].
// A regra está em lib/comercial/liberacao.ts. Quem libera não precisa do módulo Comercial.

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight, Handshake, Search, Timer } from "lucide-react";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { useLiberacaoServicos, usePodeLiberarServicos } from "@/lib/hooks/useComercial";
import { useAgora, useTempoComercial } from "@/lib/hooks/useDocumentoSessoes";
import { resumirEmpresas, type ResumoEmpresa, type SituacaoEmpresa } from "@/lib/comercial/liberacao";
import { fmtDuracao, resumirSessoes } from "@/lib/inspecoes/sessoes";
import { buscar } from "@/lib/busca/texto";
import { cn, fmtData, formatCNPJ } from "@/lib/utils";

const ABAS: { key: SituacaoEmpresa; rotulo: string; vazio: string }[] = [
  { key: "fila", rotulo: "Para atender", vazio: "Nenhuma empresa esperando atendimento." },
  { key: "andamento", rotulo: "Em andamento", vazio: "Nenhum atendimento em andamento." },
  { key: "concluida", rotulo: "Concluídos", vazio: "Nenhum atendimento concluído." },
];

export default function LiberarComercialPage() {
  const { data, isLoading, error } = useLiberacaoServicos();
  const { data: sessoes = [] } = useTempoComercial();
  const podeLiberar = usePodeLiberarServicos();
  const agora = useAgora(60_000);

  const [aba, setAba] = useState<SituacaoEmpresa>("fila");
  const [busca, setBusca] = useState("");

  const empresas = useMemo(() => (data ? resumirEmpresas(data.conciliacoes, data.atendimentos, data.indicadas) : []), [data]);
  const contagem = useMemo(() => {
    const n: Record<SituacaoEmpresa, number> = { fila: 0, andamento: 0, concluida: 0 };
    for (const e of empresas) n[e.situacao]++;
    return n;
  }, [empresas]);
  const linhas = useMemo(() => {
    const daAba = empresas.filter((e) => e.situacao === aba);
    return busca.trim() ? buscar(daAba, busca, (e) => [e.nome, e.cnpj, e.municipio]).itens : daAba;
  }, [empresas, aba, busca]);

  const tempoDe = (idEmpresa: string) => {
    const dela = sessoes.filter((s) => s.id_inspecao === idEmpresa);
    return dela.length > 0 ? fmtDuracao(resumirSessoes(dela, agora).trabalhadoMs) : "—";
  };

  if (isLoading) return <LoadingSkeleton rows={6} />;
  if (error) {
    return <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">Não foi possível carregar os atendimentos. Tente de novo.</p>;
  }
  if (!podeLiberar) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-10 text-center text-sm text-gray-600">
        A liberação para o Comercial é feita por quem edita (Admin ou Técnico).
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
          <Handshake className="size-5 text-marca-primary" /> Liberar para o Comercial
        </h1>
        <p className="max-w-3xl text-sm text-gray-500">
          As empresas chegam aqui quando a <strong>Conciliação DRPS/QPS × AEP é fechada</strong>. Para cada risco confirmado, indique as
          intervenções, escreva o parecer e conclua. O vendedor só vê depois de concluído.
        </p>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-gray-200">
        {ABAS.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={() => setAba(a.key)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-semibold",
              aba === a.key ? "border-marca-primary text-marca-primary" : "border-transparent text-gray-500 hover:text-gray-800",
            )}
          >
            {a.rotulo} <span className="ml-1 rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600">{contagem[a.key]}</span>
          </button>
        ))}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-2 size-4 text-gray-400" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar empresa, CNPJ ou município"
          aria-label="Buscar empresa, CNPJ ou município"
          className="w-full rounded-lg border border-gray-300 bg-white py-1.5 pl-8 pr-2.5 text-sm text-gray-900 focus:border-marca-primary focus:outline-none focus:ring-2 focus:ring-marca-primary/20"
        />
      </div>

      {linhas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-10 text-center text-sm text-gray-500">
          {ABAS.find((a) => a.key === aba)!.vazio}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-600">
              <tr>
                <th className="px-3 py-2">Empresa</th>
                <th className="w-36 px-3 py-2">Conciliação fechada</th>
                <th className="px-3 py-2">Situação</th>
                <th className="w-28 px-3 py-2">Tempo</th>
                <th className="w-8 px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {linhas.map((e) => (
                <tr key={e.idEmpresa} className="hover:bg-gray-50">
                  <td className="px-3 py-2.5">
                    <Link href={`/consolidacao-grupo/liberar-comercial/${e.idEmpresa}`} className="font-medium text-gray-900 hover:text-marca-primary">
                      {e.nome}
                    </Link>
                    <span className="block text-xs text-gray-500">
                      {e.cnpj ? formatCNPJ(e.cnpj) : "—"}
                      {e.municipio ? ` · ${e.municipio}${e.uf ? `/${e.uf}` : ""}` : ""}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-600">{fmtData(e.fechadoEm)}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">
                    <TextoSituacao e={e} />
                  </td>
                  <td className="px-3 py-2.5 text-xs tabular-nums text-gray-600">
                    <span className="inline-flex items-center gap-1">
                      <Timer className="size-3.5 text-gray-400" /> {tempoDe(e.idEmpresa)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <Link href={`/consolidacao-grupo/liberar-comercial/${e.idEmpresa}`} aria-label={`Abrir ${e.nome}`}>
                      <ChevronRight className="size-4 text-gray-400" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TextoSituacao({ e }: { e: ResumoEmpresa }) {
  if (e.conciliacaoNova) {
    return (
      <span className="inline-flex items-center gap-1 font-medium text-amber-800">
        <AlertTriangle className="size-3.5" /> Conciliação fechada de novo: reabra para conferir
      </span>
    );
  }
  const riscos = e.riscos === 1 ? "1 risco" : `${e.riscos} riscos`;
  if (e.situacao === "concluida") {
    return (
      <>
        {riscos} · concluído{e.atendimento?.concluido_em ? ` em ${fmtData(e.atendimento.concluido_em)}` : ""}
        {e.atendimento?.concluido_por ? ` por ${e.atendimento.concluido_por}` : ""}
      </>
    );
  }
  return (
    <>
      {riscos}
      {e.semIntervencao > 0 ? ` · ${e.semIntervencao} sem intervenção` : " · todos com intervenção"}
    </>
  );
}
