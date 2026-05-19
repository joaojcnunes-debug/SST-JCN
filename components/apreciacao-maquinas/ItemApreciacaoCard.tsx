"use client";

import { useState, useRef, useEffect } from "react";
import {
  CheckCircle2,
  XCircle,
  MinusCircle,
  HelpCircle,
  Upload,
  X,
  Loader2,
  Trash2,
  Sparkles,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  useAtualizarItemApreciacao,
  useUploadFotoItemApreciacao,
  useRemoverFotoItemApreciacao,
  useExcluirItemApreciacao,
  MAX_FOTOS_POR_ITEM_APR,
} from "@/lib/hooks/useApreciacoesMaquinas";
import { useMatrizAtiva } from "@/lib/hooks/useV3";
import { calcularNivelComMatriz } from "@/lib/calc";
import {
  SITUACAO_APRECIACAO_LABELS,
  type ApreciacaoMaquinaItem,
  type NivelRisco,
  type SituacaoApreciacaoItem,
} from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

const NIVEL_CORES: Record<NivelRisco, string> = {
  Trivial: "bg-blue-100 text-blue-700 border-blue-300",
  Baixo: "bg-emerald-100 text-emerald-700 border-emerald-300",
  Moderado: "bg-amber-100 text-amber-700 border-amber-300",
  Alto: "bg-orange-100 text-orange-700 border-orange-300",
  "Muito Alto": "bg-red-100 text-red-700 border-red-300",
};

const SITUACAO_CORES: Record<SituacaoApreciacaoItem, string> = {
  CONFORME: "bg-emerald-100 text-emerald-700 border-emerald-300",
  NAO_CONFORME: "bg-red-100 text-red-700 border-red-300",
  NAO_APLICAVEL: "bg-gray-100 text-gray-700 border-gray-300",
  PENDENTE: "bg-amber-100 text-amber-700 border-amber-300",
};

const SITUACAO_ICONES: Record<SituacaoApreciacaoItem, React.ReactNode> = {
  CONFORME: <CheckCircle2 className="size-4" />,
  NAO_CONFORME: <XCircle className="size-4" />,
  NAO_APLICAVEL: <MinusCircle className="size-4" />,
  PENDENTE: <HelpCircle className="size-4" />,
};

const ORDEM_SITUACAO: SituacaoApreciacaoItem[] = [
  "CONFORME",
  "NAO_CONFORME",
  "NAO_APLICAVEL",
  "PENDENTE",
];

/** Debounce simples para auto-save de observação/recomendação. */
function useDebounced<T>(value: T, delay = 600): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function ItemApreciacaoCard({
  item,
  disabled = false,
}: {
  item: ApreciacaoMaquinaItem;
  disabled?: boolean;
}) {
  const atualizar = useAtualizarItemApreciacao();
  const uploadFoto = useUploadFotoItemApreciacao();
  const removerFoto = useRemoverFotoItemApreciacao();
  const excluirItem = useExcluirItemApreciacao();
  const { data: matrizAtiva } = useMatrizAtiva();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmandoExcluir, setConfirmandoExcluir] = useState(false);

  const ehLivre = item.item_origem === "LIVRE";
  const ehNaoConforme = item.situacao === "NAO_CONFORME";

  function handleProbSev(prob: string | null, sev: string | null) {
    if (disabled) return;
    const nivel = calcularNivelComMatriz(prob, sev, matrizAtiva);
    atualizar.mutate({
      id_apreciacao: item.id_apreciacao,
      id_item: item.id_item,
      probabilidade: prob,
      severidade: sev,
      // Quando ainda não escolheu os dois, mantém null (não polui o agregado)
      nivel_risco_calculado: prob && sev ? nivel : null,
      id_matriz: prob && sev && matrizAtiva ? matrizAtiva.id_matriz : null,
    });
  }

  const [observacao, setObservacao] = useState(item.observacao ?? "");
  const [recomendacao, setRecomendacao] = useState(item.recomendacao ?? "");
  const obsDeb = useDebounced(observacao);
  const recDeb = useDebounced(recomendacao);

  // Auto-save quando o debounced muda E é diferente do valor salvo
  useEffect(() => {
    if (disabled) return;
    if (obsDeb === (item.observacao ?? "")) return;
    atualizar.mutate({
      id_apreciacao: item.id_apreciacao,
      id_item: item.id_item,
      observacao: obsDeb || null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obsDeb]);

  useEffect(() => {
    if (disabled) return;
    if (recDeb === (item.recomendacao ?? "")) return;
    atualizar.mutate({
      id_apreciacao: item.id_apreciacao,
      id_item: item.id_item,
      recomendacao: recDeb || null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recDeb]);

  function handleSituacao(situacao: SituacaoApreciacaoItem) {
    if (disabled) return;
    atualizar.mutate({
      id_apreciacao: item.id_apreciacao,
      id_item: item.id_item,
      situacao,
    });
  }

  async function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Foto maior que 5 MB.");
      return;
    }
    try {
      await uploadFoto.mutateAsync({
        id_apreciacao: item.id_apreciacao,
        id_item: item.id_item,
        file,
        fotos_urls_atuais: item.foto_urls,
        fotos_paths_atuais: item.foto_storage_paths,
      });
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Falha ao enviar foto"
      );
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleRemoverFoto(path: string) {
    try {
      await removerFoto.mutateAsync({
        id_apreciacao: item.id_apreciacao,
        id_item: item.id_item,
        foto_storage_path: path,
        fotos_urls_atuais: item.foto_urls,
        fotos_paths_atuais: item.foto_storage_paths,
      });
    } catch (err) {
      console.error(err);
      toast.error("Falha ao remover foto");
    }
  }

  async function handleExcluirItem() {
    try {
      await excluirItem.mutateAsync({
        id_apreciacao: item.id_apreciacao,
        id_item: item.id_item,
      });
      toast.success("Item livre excluído");
    } catch (err) {
      console.error(err);
      toast.error("Falha ao excluir item");
    }
  }

  const corBorda = SITUACAO_CORES[item.situacao].split(" ")[2] ?? "border-gray-200";

  return (
    <div
      className={cn(
        "rounded-lg border bg-white p-4 shadow-sm space-y-3",
        corBorda
      )}
    >
      {/* Cabeçalho do item */}
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold",
            ehLivre
              ? "bg-purple-100 text-purple-700"
              : "bg-gray-100 text-gray-600"
          )}
        >
          {item.item_codigo}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-sm font-semibold text-gray-900">
              {item.item_titulo}
            </p>
            {ehLivre && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-purple-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-purple-700">
                <Sparkles className="size-2.5" />
                Livre
              </span>
            )}
          </div>
          {item.item_descricao && (
            <p className="mt-0.5 text-xs text-gray-500">
              {item.item_descricao}
            </p>
          )}
        </div>
        {ehLivre && !disabled && (
          <div className="shrink-0 print:hidden">
            {confirmandoExcluir ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleExcluirItem}
                  disabled={excluirItem.isPending}
                  className="rounded-md bg-red-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {excluirItem.isPending ? "..." : "Excluir"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmandoExcluir(false)}
                  className="rounded-md border border-gray-300 bg-white px-2 py-1 text-[10px] font-medium text-gray-700 hover:bg-gray-50"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmandoExcluir(true)}
                title="Excluir item livre"
                className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Botões de situação — só na tela */}
      <div className="flex flex-wrap gap-1.5 print:hidden">
        {ORDEM_SITUACAO.map((s) => {
          const ativo = item.situacao === s;
          return (
            <button
              key={s}
              type="button"
              disabled={disabled}
              onClick={() => handleSituacao(s)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition-all disabled:opacity-50",
                ativo
                  ? SITUACAO_CORES[s]
                  : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
              )}
            >
              {SITUACAO_ICONES[s]}
              {SITUACAO_APRECIACAO_LABELS[s]}
            </button>
          );
        })}
      </div>

      {/* Versão print da situação — texto compacto */}
      <div
        className={cn(
          "hidden items-center gap-1 rounded border px-2 py-1 text-xs font-bold print:inline-flex",
          SITUACAO_CORES[item.situacao]
        )}
      >
        Situação: {SITUACAO_APRECIACAO_LABELS[item.situacao]}
      </div>

      {/* Avaliação de risco — só pra NAO_CONFORME, usa matriz ativa do Painel SST */}
      {ehNaoConforme && matrizAtiva && (
        <div className="rounded-md border border-orange-200 bg-orange-50/40 p-2">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-orange-700">
            Avaliação de risco (matriz: {matrizAtiva.nome})
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <label className="block">
              <span className="mb-0.5 block text-[9px] font-semibold uppercase tracking-wider text-gray-600">
                Probabilidade
              </span>
              <select
                value={item.probabilidade ?? ""}
                onChange={(e) =>
                  handleProbSev(e.target.value || null, item.severidade)
                }
                disabled={disabled}
                className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-xs focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:bg-gray-50 print:hidden"
              >
                <option value="">—</option>
                {matrizAtiva.probabilidades.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              {/* Versão print: só o valor */}
              <span className="hidden text-xs font-medium text-gray-800 print:inline">
                {item.probabilidade || "—"}
              </span>
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[9px] font-semibold uppercase tracking-wider text-gray-600">
                Severidade
              </span>
              <select
                value={item.severidade ?? ""}
                onChange={(e) =>
                  handleProbSev(item.probabilidade, e.target.value || null)
                }
                disabled={disabled}
                className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-xs focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:bg-gray-50 print:hidden"
              >
                <option value="">—</option>
                {matrizAtiva.severidades.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <span className="hidden text-xs font-medium text-gray-800 print:inline">
                {item.severidade || "—"}
              </span>
            </label>
            <div className="flex items-end">
              {item.nivel_risco_calculado ? (
                <span
                  className={cn(
                    "inline-flex w-full items-center justify-center rounded-md border px-2 py-1 text-xs font-bold",
                    NIVEL_CORES[item.nivel_risco_calculado]
                  )}
                >
                  Nível: {item.nivel_risco_calculado}
                </span>
              ) : (
                <span className="text-[10px] italic text-gray-400">
                  Selecione probabilidade e severidade
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Observação */}
      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">
          Observação técnica
        </label>
        <textarea
          rows={2}
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          disabled={disabled}
          placeholder="O que foi observado em campo..."
          className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:bg-gray-50"
        />
      </div>

      {/* Recomendação (só relevante se NAO_CONFORME, mas sempre habilitado) */}
      {(item.situacao === "NAO_CONFORME" || recomendacao) && (
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-red-600">
            Recomendação / ação corretiva
          </label>
          <textarea
            rows={2}
            value={recomendacao}
            onChange={(e) => setRecomendacao(e.target.value)}
            disabled={disabled}
            placeholder="Ação corretiva sugerida..."
            className="w-full rounded-md border border-red-200 bg-red-50/30 px-2 py-1.5 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 disabled:bg-gray-50"
          />
        </div>
      )}

      {/* Fotos */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            Evidência fotográfica ({item.foto_urls.length}/
            {MAX_FOTOS_POR_ITEM_APR})
          </label>
          {!disabled && item.foto_urls.length < MAX_FOTOS_POR_ITEM_APR && (
            <div className="print:hidden">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploadFoto.isPending}
                onChange={handleFotoChange}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploadFoto.isPending}
                className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {uploadFoto.isPending ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Upload className="size-3" />
                )}
                Adicionar
              </button>
            </div>
          )}
        </div>
        {item.foto_urls.length > 0 && (
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
            {item.foto_urls.map((url, idx) => (
              <div
                key={idx}
                className="relative aspect-square overflow-hidden rounded-md border border-gray-200 bg-gray-50"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Evidência ${idx + 1}`}
                  className="size-full object-cover"
                  referrerPolicy="no-referrer"
                />
                {!disabled && (
                  <button
                    type="button"
                    onClick={() =>
                      handleRemoverFoto(item.foto_storage_paths[idx])
                    }
                    disabled={removerFoto.isPending}
                    className="absolute right-0.5 top-0.5 rounded-full bg-red-600/80 p-0.5 text-white hover:bg-red-700 disabled:opacity-50 print:hidden"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
