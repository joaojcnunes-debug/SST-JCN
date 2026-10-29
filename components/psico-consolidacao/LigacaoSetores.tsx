"use client";

// Conciliação DRPS/QPS × AEP — setores que aparecem numa fonte só, a sugestão "parece o
// mesmo setor" e a ligação manual por empresa (v0.3.176, banco v310). Ligar junta os dois
// na conciliação com o nome da AEP; nada muda nos documentos.

import { useState } from "react";
import { Link2, Link2Off, Sparkles } from "lucide-react";
import { confirmar } from "@/components/ui/confirm";
import { useDesligarSetor, useLigarSetores } from "@/lib/hooks/useConciliacaoParecer";
import { sugerirPares, type LigacaoSetor, type SetorConciliacao } from "@/lib/psico-consolidacao/conciliacao";

const sel =
  "rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

export default function LigacaoSetores({
  idEmpresa,
  setores,
  ligacoes,
  podeEditar,
}: {
  idEmpresa: string;
  setores: SetorConciliacao[];
  ligacoes: LigacaoSetor[];
  podeEditar: boolean;
}) {
  const ligar = useLigarSetores();
  const desligar = useDesligarSetor();
  const [deAep, setDeAep] = useState("");
  const [deQ, setDeQ] = useState("");

  const soAep = setores.filter((s) => s.avaliadoPor.length === 1 && s.avaliadoPor[0] === "AEP");
  const soQ = setores.filter((s) => !s.avaliadoPor.includes("AEP"));
  const semPar = [...soAep, ...soQ].sort((a, b) => a.setor.localeCompare(b.setor, "pt-BR"));
  const pares = sugerirPares(setores);

  if (semPar.length === 0 && ligacoes.length === 0) return null;

  // O setor do questionário passa a valer como o da AEP (o nome mostrado é o da AEP).
  const juntar = async (aep: SetorConciliacao, q: SetorConciliacao) => {
    for (const k of q.chavesOriginais) {
      if (k === aep.chave) continue;
      await ligar.mutateAsync({ idEmpresa, chaveDe: k, nomeDe: q.setor, chavePara: aep.chave, nomePara: aep.setor });
    }
  };

  const desfazer = async (l: LigacaoSetor) => {
    if (!l.id_depara) return;
    const ok = await confirmar({
      title: `Desfazer a ligação "${l.nome_de}" → "${l.nome_para}"?`,
      description: "Os pareceres dados com os setores ligados ficam guardados, mas deixam de aparecer até ligar de novo.",
      confirmLabel: "Desfazer",
      variant: "danger",
    });
    if (ok) desligar.mutate(l.id_depara);
  };

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      {semPar.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-gray-800">Setores que aparecem numa fonte só</p>
          <p className="mb-2 text-xs text-gray-500">
            Não dá para conciliar estes setores. Se for o mesmo setor escrito de outro jeito, ligue os dois aqui (vale só na
            conciliação) ou ajuste o nome no documento.
          </p>
          <ul className="space-y-1 text-sm">
            {semPar.map((s) => (
              <li key={s.chave} className="text-gray-700">
                <span className="font-medium">{s.setor}</span>{" "}
                <span className="text-xs text-gray-500">
                  — só em {s.avaliadoPor.join(", ")}
                  {Object.entries(s.originais)
                    .map(([o, nomes]) => ` · ${o}: "${nomes!.join('", "')}"`)
                    .join("")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pares.length > 0 && (
        <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-indigo-800">
            <Sparkles className="size-3.5" /> Parecem o mesmo setor
          </p>
          <ul className="space-y-1.5">
            {pares.map((p) => (
              <li key={`${p.aep.chave}|${p.questionario.chave}`} className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
                <span>
                  AEP <b>{p.aep.setor}</b> ↔ {p.questionario.avaliadoPor.join("/")} <b>{p.questionario.setor}</b>
                </span>
                <span className="text-[11px] text-gray-400">{Math.round(p.semelhanca * 100)}% parecido</span>
                {podeEditar && (
                  <button
                    type="button"
                    disabled={ligar.isPending}
                    onClick={() => juntar(p.aep, p.questionario)}
                    className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-white px-2 py-0.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                  >
                    <Link2 className="size-3" /> Ligar
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {podeEditar && soAep.length > 0 && soQ.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs font-semibold text-gray-600">Ligar à mão:</span>
          <select value={deAep} onChange={(e) => setDeAep(e.target.value)} className={sel}>
            <option value="">Setor da AEP…</option>
            {soAep.map((s) => (
              <option key={s.chave} value={s.chave}>{s.setor}</option>
            ))}
          </select>
          <span className="text-gray-400">é o mesmo que</span>
          <select value={deQ} onChange={(e) => setDeQ(e.target.value)} className={sel}>
            <option value="">Setor do questionário…</option>
            {soQ.map((s) => (
              <option key={s.chave} value={s.chave}>{s.setor} ({s.avaliadoPor.join("/")})</option>
            ))}
          </select>
          <button
            type="button"
            disabled={!deAep || !deQ || ligar.isPending}
            onClick={async () => {
              const a = soAep.find((s) => s.chave === deAep);
              const q = soQ.find((s) => s.chave === deQ);
              if (!a || !q) return;
              await juntar(a, q);
              setDeAep("");
              setDeQ("");
            }}
            className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <Link2 className="size-3.5" /> Ligar
          </button>
        </div>
      )}

      {ligacoes.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold text-gray-600">Setores ligados nesta empresa</p>
          <ul className="space-y-1 text-sm">
            {ligacoes.map((l) => (
              <li key={l.id_depara ?? l.chave_de} className="flex items-center gap-2 text-gray-700">
                <span>
                  {l.nome_de || l.chave_de} → <b>{l.nome_para}</b>
                </span>
                {podeEditar && (
                  <button
                    type="button"
                    onClick={() => desfazer(l)}
                    className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-red-600"
                    title="Desfazer a ligação"
                  >
                    <Link2Off className="size-3" /> Desfazer
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
