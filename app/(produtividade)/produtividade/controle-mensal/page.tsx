"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ClipboardPaste, Loader2, Save, X } from "lucide-react";
import toast from "react-hot-toast";
import {
  useProdUnidades,
  useProdSnapshots,
  useSaveSnapshot,
  type ProdUnidade,
  type ProdSnapshotMensal,
} from "@/lib/hooks/useProdutividade";
import { useCanEdit } from "@/lib/hooks/useUsuario";

const MESES_LABEL = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

type Campos = {
  clientes_pagantes: number;
  clientes_cortesia: number;
  vencidos: number;
  vencendo: number;
  inspecao_pendente: number;
};

const CAMPOS: { key: keyof Campos; label: string }[] = [
  { key: "clientes_pagantes", label: "Pagantes" },
  { key: "clientes_cortesia", label: "Cortesia" },
  { key: "vencidos", label: "Vencidos" },
  { key: "vencendo", label: "Vencendo" },
  { key: "inspecao_pendente", label: "Insp. pendente" },
];

const ZERO: Campos = {
  clientes_pagantes: 0, clientes_cortesia: 0, vencidos: 0, vencendo: 0, inspecao_pendente: 0,
};

/** Normaliza nome de unidade p/ casar no import (sem acento, minúsculo). */
function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

function CelulaInput({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <input
      type="number"
      min={0}
      value={value || ""}
      placeholder="0"
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      className="w-20 rounded border border-gray-200 px-2 py-1 text-center text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
    />
  );
}

export default function ControleMensalPage() {
  const today = new Date();
  const [mes, setMes] = useState(today.getMonth() + 1);
  const [ano, setAno] = useState(today.getFullYear());
  const [local, setLocal] = useState<Record<string, Campos>>({});
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const canEdit = useCanEdit();
  const { data: unidades = [], isLoading } = useProdUnidades();
  const { data: snapshots = [] } = useProdSnapshots(mes, ano);
  const saveSnapshot = useSaveSnapshot();

  // Trocar de mês descarta edições não salvas locais (recarrega do banco).
  function prevMes() { setLocal({}); if (mes === 1) { setMes(12); setAno((a) => a - 1); } else setMes((m) => m - 1); }
  function nextMes() { setLocal({}); if (mes === 12) { setMes(1); setAno((a) => a + 1); } else setMes((m) => m + 1); }

  const snapPorUnidade = useMemo(() => {
    const m: Record<string, ProdSnapshotMensal> = {};
    for (const s of snapshots) m[s.id_unidade] = s;
    return m;
  }, [snapshots]);

  function getCampos(idUnidade: string): Campos {
    if (local[idUnidade]) return local[idUnidade];
    const s = snapPorUnidade[idUnidade];
    if (!s) return ZERO;
    return {
      clientes_pagantes: s.clientes_pagantes,
      clientes_cortesia: s.clientes_cortesia,
      vencidos: s.vencidos,
      vencendo: s.vencendo,
      inspecao_pendente: s.inspecao_pendente,
    };
  }

  function setCampo(idUnidade: string, key: keyof Campos, val: number) {
    setLocal((prev) => ({ ...prev, [idUnidade]: { ...getCampos(idUnidade), [key]: val } }));
  }

  const temAlteracao = Object.keys(local).length > 0;

  async function handleSave() {
    if (!temAlteracao) { toast("Nenhuma alteração para salvar", { icon: "ℹ️" }); return; }
    setSaving(true);
    try {
      await Promise.all(
        Object.entries(local).map(([idUnidade, vals]) =>
          saveSnapshot.mutateAsync({ id_unidade: idUnidade, mes, ano, ...vals }),
        ),
      );
      setLocal({});
      toast.success("Controle mensal salvo!");
    } catch {
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  /** Importa colando a planilha (uma linha por unidade, colunas separadas por TAB). */
  function aplicarImport(texto: string) {
    const linhas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    let casados = 0;
    const novo: Record<string, Campos> = { ...local };
    for (const linha of linhas) {
      const cols = linha.split(/\t/).map((c) => c.trim());
      if (cols.length < 2) continue;
      const nomeLinha = norm(cols[0]);
      if (!nomeLinha || nomeLinha === "total") continue;
      const unidade = unidades.find((u) => norm(u.nome) === nomeLinha || norm(u.nome).includes(nomeLinha) || nomeLinha.includes(norm(u.nome)));
      if (!unidade) continue;
      const n = (i: number) => Number((cols[i] ?? "").replace(/[^\d-]/g, "")) || 0;
      // Colunas esperadas: nome | pagantes | cortesia | vencido | vencendo | inspeção
      novo[unidade.id] = {
        clientes_pagantes: n(1),
        clientes_cortesia: n(2),
        vencidos: n(3),
        vencendo: n(4),
        inspecao_pendente: n(5),
      };
      casados += 1;
    }
    if (casados === 0) {
      toast.error("Nenhuma unidade reconhecida. Confira os nomes na 1ª coluna.");
      return;
    }
    setLocal(novo);
    setImportOpen(false);
    toast.success(`${casados} unidade(s) preenchida(s). Revise e salve.`);
  }

  // Totais
  const tot = unidades.reduce(
    (acc, u) => {
      const c = getCampos(u.id);
      acc.clientes_pagantes += c.clientes_pagantes;
      acc.clientes_cortesia += c.clientes_cortesia;
      acc.vencidos += c.vencidos;
      acc.vencendo += c.vencendo;
      acc.inspecao_pendente += c.inspecao_pendente;
      return acc;
    },
    { ...ZERO },
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Controle Mensal</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Quantitativo de clientes e pendências por unidade — base para o Dashboard e a projeção de equipe
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              <ClipboardPaste className="size-4" /> Importar do Excel
            </button>
          )}
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
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 className="size-4 animate-spin" /> Carregando unidades…
        </div>
      )}

      {!isLoading && unidades.length === 0 && (
        <div className="rounded-xl bg-white p-10 text-center shadow-sm ring-1 ring-black/5">
          <p className="text-sm text-gray-500">
            Nenhuma unidade cadastrada. Acesse <strong>Unidades e Equipe</strong> primeiro.
          </p>
        </div>
      )}

      {unidades.length > 0 && (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-[11px] uppercase text-gray-400">
                  <th className="px-4 py-2.5 text-left">Unidade</th>
                  {CAMPOS.map((c) => (
                    <th key={c.key} className="px-4 py-2.5 text-center">{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {unidades.map((u: ProdUnidade) => {
                  const c = getCampos(u.id);
                  return (
                    <tr key={u.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-2.5 font-medium text-gray-800">
                        {u.nome}
                        {u.cidade && <span className="ml-1 text-xs text-gray-400">· {u.cidade}</span>}
                      </td>
                      {CAMPOS.map((campo) => (
                        <td key={campo.key} className="px-4 py-2.5 text-center">
                          <CelulaInput value={c[campo.key]} onChange={(v) => setCampo(u.id, campo.key, v)} disabled={!canEdit} />
                        </td>
                      ))}
                    </tr>
                  );
                })}
                {/* Totais */}
                <tr className="border-t-2 border-gray-200 bg-gray-50 text-xs font-semibold text-gray-600">
                  <td className="px-4 py-2 uppercase tracking-wide text-gray-400">Total</td>
                  {CAMPOS.map((campo) => (
                    <td key={campo.key} className="px-4 py-2 text-center font-mono text-sm text-gray-800">
                      {tot[campo.key]}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          {canEdit && (
            <div className="flex justify-end border-t border-gray-100 px-4 py-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !temAlteracao}
                className="flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-40"
              >
                {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                Salvar controle mensal
              </button>
            </div>
          )}
        </div>
      )}

      {importOpen && <ImportModal onClose={() => setImportOpen(false)} onApply={aplicarImport} />}
    </div>
  );
}

function ImportModal({ onClose, onApply }: { onClose: () => void; onApply: (t: string) => void }) {
  const [texto, setTexto] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <h2 className="font-semibold text-gray-800">Importar do Excel / Google Sheets</h2>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-gray-100">
            <X className="size-4 text-gray-500" />
          </button>
        </div>
        <div className="space-y-3 p-5">
          <p className="text-xs text-gray-500">
            Selecione na planilha as linhas das unidades (com as colunas na ordem
            <strong> Unidade · Pagantes · Cortesia · Vencido · Vencendo · Inspeção Pendente</strong>),
            copie (Ctrl+C) e cole abaixo. As unidades são casadas pelo nome.
          </p>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={10}
            placeholder={"Teresópolis\t1860\t\t422\t721\nPetrópolis\t619\t21\t173\t289\t..."}
            className="w-full rounded-lg border border-gray-200 p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            Cancelar
          </button>
          <button type="button" onClick={() => onApply(texto)} disabled={!texto.trim()} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-40">
            Preencher tabela
          </button>
        </div>
      </div>
    </div>
  );
}
