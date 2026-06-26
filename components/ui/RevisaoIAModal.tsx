"use client";

import { useMemo, useState } from "react";
import { Sparkles, X, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Texto obrigatório em toda devolutiva de IA (NR-12 / responsabilidade técnica). */
export const DISCLAIMER_IA =
  "A análise por IA é apenas apoio técnico e não substitui a avaliação presencial, " +
  "a responsabilidade técnica e a validação final do profissional habilitado.";

export interface CampoRevisaoIA {
  /** Chave devolvida em onAplicar — normalmente o nome do campo do form/tabela. */
  key: string;
  label: string;
  valorSugerido: string;
  /** Valor atual do campo (mostrado pra comparação quando difere). */
  valorAtual?: string | null;
  multiline?: boolean;
  /** Quando presente, renderiza select em vez de input. */
  options?: { value: string; label: string }[];
}

interface Props {
  titulo: string;
  /** Texto auxiliar exibido no topo (ex: resumo do que a IA analisou). */
  descricao?: string;
  campos: CampoRevisaoIA[];
  /** Recebe apenas os campos SELECIONADOS, com o valor possivelmente editado. */
  onAplicar: (valores: Record<string, string>) => void | Promise<void>;
  onClose: () => void;
  aplicando?: boolean;
}

/**
 * Modal de revisão de sugestões de IA — fluxo aceitar/editar/rejeitar.
 * Nada é aplicado sem o usuário marcar o campo e confirmar; valores são
 * editáveis antes de aplicar. Usado por MaquinaForm, MaquinasTab (inspeção),
 * parecer da apreciação e análise de foto por item.
 */
export default function RevisaoIAModal({
  titulo,
  descricao,
  campos,
  onAplicar,
  onClose,
  aplicando = false,
}: Props) {
  const [selecionados, setSelecionados] = useState<Set<string>>(
    () => new Set(campos.map((c) => c.key))
  );
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(campos.map((c) => [c.key, c.valorSugerido]))
  );

  const totalSelecionados = useMemo(
    () => campos.filter((c) => selecionados.has(c.key)).length,
    [campos, selecionados]
  );

  function toggle(key: string) {
    setSelecionados((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  }

  async function handleAplicar() {
    const escolhidos: Record<string, string> = {};
    campos.forEach((c) => {
      if (selecionados.has(c.key)) escolhidos[c.key] = valores[c.key] ?? "";
    });
    await onAplicar(escolhidos);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" aria-hidden="true">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="flex items-center gap-2 text-base font-bold text-gray-900">
            <Sparkles className="size-4 text-purple-600" />
            {titulo}
          </h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-6 py-4">
          {descricao && <p className="text-xs text-gray-500">{descricao}</p>}
          <p className="text-xs text-gray-500">
            Marque o que deseja aplicar — os textos podem ser editados antes.
            Campos desmarcados são descartados.
          </p>

          {campos.map((c) => {
            const marcado = selecionados.has(c.key);
            const atual = c.valorAtual?.trim();
            const difere = !!atual && atual !== valores[c.key];
            return (
              <div
                key={c.key}
                className={cn(
                  "rounded-lg border p-3 transition-colors",
                  marcado ? "border-purple-200 bg-purple-50/40" : "border-gray-200 bg-gray-50 opacity-70"
                )}
              >
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={marcado}
                    onChange={() => toggle(c.key)}
                    className="size-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-700">{c.label}</span>
                  {difere && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                      substitui o valor atual
                    </span>
                  )}
                </label>

                {difere && (
                  <p className="mt-1.5 line-clamp-2 text-[11px] text-gray-400">
                    <span className="font-semibold">Atual:</span> {atual}
                  </p>
                )}

                <div className="mt-2">
                  {c.options ? (
                    <select
                      value={valores[c.key] ?? ""}
                      onChange={(e) => setValores((p) => ({ ...p, [c.key]: e.target.value }))}
                      disabled={!marcado}
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      {c.options.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  ) : c.multiline ? (
                    <textarea
                      rows={Math.min(6, Math.max(2, Math.ceil((valores[c.key] ?? "").length / 90)))}
                      value={valores[c.key] ?? ""}
                      onChange={(e) => setValores((p) => ({ ...p, [c.key]: e.target.value }))}
                      disabled={!marcado}
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:bg-gray-100 disabled:text-gray-400"
                    />
                  ) : (
                    <input
                      type="text"
                      value={valores[c.key] ?? ""}
                      onChange={(e) => setValores((p) => ({ ...p, [c.key]: e.target.value }))}
                      disabled={!marcado}
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:bg-gray-100 disabled:text-gray-400"
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-3 border-t border-gray-200 px-6 py-4">
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
            ⚠ {DISCLAIMER_IA}
          </p>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Descartar
            </button>
            <button
              type="button"
              onClick={handleAplicar}
              disabled={aplicando || totalSelecionados === 0}
              className="inline-flex items-center gap-1.5 rounded-md bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {aplicando ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Aplicar selecionados ({totalSelecionados})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
