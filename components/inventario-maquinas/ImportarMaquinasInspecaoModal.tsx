"use client";

import { useMemo, useState } from "react";
import { X, Download, Loader2, CheckCircle2, Wrench } from "lucide-react";
import toast from "react-hot-toast";
import { useEmpresas } from "@/lib/hooks/useEmpresas";
import { useInspecoesByEmpresa } from "@/lib/hooks/useInspecao";
import {
  useMaquinasInspecaoPendentes,
  useImportarMaquinasInspecao,
} from "@/lib/hooks/useInventarioMaquinas";
import { cn } from "@/lib/utils";

const INPUT_CLASS =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:bg-gray-50 disabled:text-gray-500";

interface Props {
  aberto: boolean;
  onClose: () => void;
  /** Pré-seleciona a empresa (ex: vindo do filtro da página). */
  idEmpresaInicial?: string | null;
}

/**
 * Modal "Importar de inspeção": empresa → inspeção → máquinas registradas
 * na aba Máquinas/NR-12 da inspeção, com checkboxes. Máquinas já importadas
 * aparecem desabilitadas. Importa as selecionadas pro inventário.
 */
export default function ImportarMaquinasInspecaoModal({
  aberto,
  onClose,
  idEmpresaInicial,
}: Props) {
  const { data: empresas = [] } = useEmpresas();
  const [idEmpresa, setIdEmpresa] = useState(idEmpresaInicial ?? "");
  const [idInspecao, setIdInspecao] = useState("");
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());

  const { data: inspecoes = [] } = useInspecoesByEmpresa(idEmpresa || null);
  const { data: pend, isLoading } = useMaquinasInspecaoPendentes(idEmpresa || null);
  const importar = useImportarMaquinasInspecao();

  // Máquinas da inspeção escolhida (todas, pra mostrar as já importadas)
  const maquinasDaInspecao = useMemo(() => {
    if (!pend || !idInspecao) return [];
    return pend.todas.filter((m) => m.id_inspecao === idInspecao);
  }, [pend, idInspecao]);

  const pendentesIds = useMemo(
    () => new Set(pend?.pendentes.map((m) => m.id_maquina_inspecao) ?? []),
    [pend]
  );

  // Inspeções que têm máquinas registradas (evita dropdown cheio de vazias)
  const inspecoesComMaquinas = useMemo(() => {
    if (!pend) return [];
    const ids = new Set(pend.todas.map((m) => m.id_inspecao));
    return inspecoes.filter((i) => ids.has(i.id_inspecao));
  }, [inspecoes, pend]);

  function handleEmpresaChange(v: string) {
    setIdEmpresa(v);
    setIdInspecao("");
    setSelecionadas(new Set());
  }

  function handleInspecaoChange(v: string) {
    setIdInspecao(v);
    // pré-seleciona todas as pendentes da inspeção
    const novas = new Set<string>();
    pend?.pendentes
      .filter((m) => m.id_inspecao === v)
      .forEach((m) => novas.add(m.id_maquina_inspecao));
    setSelecionadas(novas);
  }

  function toggle(id: string) {
    setSelecionadas((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function handleImportar() {
    const escolhidas = maquinasDaInspecao.filter((m) =>
      selecionadas.has(m.id_maquina_inspecao)
    );
    if (escolhidas.length === 0) {
      toast.error("Selecione ao menos uma máquina.");
      return;
    }
    try {
      const r = await importar.mutateAsync(escolhidas);
      if (r.criadas > 0) {
        toast.success(
          `${r.criadas} máquina${r.criadas > 1 ? "s" : ""} importada${r.criadas > 1 ? "s" : ""} pro inventário` +
            (r.ignoradas > 0 ? ` · ${r.ignoradas} já existia(m)` : "")
        );
      } else {
        toast(`Nenhuma nova — ${r.ignoradas} já estava(m) no inventário.`, { icon: "ℹ️" });
      }
      onClose();
    } catch {
      // toast de erro já emitido pelo hook
    }
  }

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" aria-hidden="true">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Importar máquinas de inspeção"
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="flex items-center gap-2 text-base font-bold text-gray-900">
            <Download className="size-4 text-orange-600" />
            Importar máquinas de inspeção
          </h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <p className="text-xs text-gray-500">
            Máquinas registradas na aba <strong>Máquinas/NR-12</strong> de uma
            inspeção entram no inventário e ficam disponíveis pra Apreciação
            NR-12. Registros já importados não são duplicados.
          </p>

          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-600">Empresa</span>
            <select value={idEmpresa} onChange={(e) => handleEmpresaChange(e.target.value)} className={INPUT_CLASS}>
              <option value="">Selecione...</option>
              {empresas.map((e) => (
                <option key={e.id_empresa} value={e.id_empresa}>{e.nome_empresa}</option>
              ))}
            </select>
          </label>

          {idEmpresa && (
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-600">Inspeção</span>
              <select value={idInspecao} onChange={(e) => handleInspecaoChange(e.target.value)} className={INPUT_CLASS}>
                <option value="">
                  {isLoading
                    ? "Carregando..."
                    : inspecoesComMaquinas.length === 0
                      ? "— nenhuma inspeção com máquinas registradas —"
                      : "Selecione a inspeção..."}
                </option>
                {inspecoesComMaquinas.map((i) => (
                  <option key={i.id_inspecao} value={i.id_inspecao}>
                    {i.id_inspecao}
                    {i.data_inspecao ? ` — ${new Date(`${i.data_inspecao}T12:00:00`).toLocaleDateString("pt-BR")}` : ""}
                    {i.responsavel ? ` — ${i.responsavel}` : ""}
                  </option>
                ))}
              </select>
            </label>
          )}

          {idInspecao && (
            <div className="rounded-lg border border-gray-200">
              <div className="border-b border-gray-100 bg-gray-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-600">
                Máquinas da inspeção ({maquinasDaInspecao.length})
              </div>
              <ul className="max-h-64 divide-y divide-gray-100 overflow-y-auto">
                {maquinasDaInspecao.map((m) => {
                  const pendente = pendentesIds.has(m.id_maquina_inspecao);
                  const marcada = selecionadas.has(m.id_maquina_inspecao);
                  return (
                    <li key={m.id_maquina_inspecao}>
                      <label
                        className={cn(
                          "flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-orange-50/50",
                          !pendente && "cursor-default opacity-60"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={pendente ? marcada : true}
                          disabled={!pendente}
                          onChange={() => toggle(m.id_maquina_inspecao)}
                          className="size-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                        />
                        <Wrench className="size-3.5 shrink-0 text-gray-400" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-gray-900">{m.nome}</span>
                          <span className="block truncate text-[11px] text-gray-500">
                            {[m.tipo, m.marca, m.modelo, m.numero_serie && `N/S ${m.numero_serie}`]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </span>
                        </span>
                        {!pendente && (
                          <span className="flex shrink-0 items-center gap-1 text-[10px] font-semibold text-emerald-600">
                            <CheckCircle2 className="size-3" /> já importada
                          </span>
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleImportar}
            disabled={importar.isPending || selecionadas.size === 0}
            className="inline-flex items-center gap-1.5 rounded-md bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {importar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            Importar {selecionadas.size > 0 ? `(${selecionadas.size})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
