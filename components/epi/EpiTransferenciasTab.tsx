"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, ArrowLeftRight, Building2 } from "lucide-react";
import { inputCls, labelCls } from "./EpiModal";
import EmpresaSelect from "@/components/empresas/EmpresaSelect";
import {
  useEpiCatalogo,
  useEpiSaldo,
  useEpiTransferencias,
  useTransferir,
  type TransferirItem,
} from "@/lib/hooks/useEpi";
import { useEmpresas } from "@/lib/hooks/useEmpresas";
import { fmtData } from "@/lib/utils";

type DestinoAcao = "novo" | "existente";

interface LinhaItem {
  id_catalogo_origem: string;
  quantidade: string;
  acao: DestinoAcao;
  id_catalogo_destino: string;
}

/**
 * Transferência de estoque entre empresas — SÓ contexto interno da JCN.
 * A origem é a empresa selecionada no topo; o destino é escolhido aqui. A RPC
 * `epi_transferir` valida saldo e faz saída+entrada de forma atômica.
 */
export default function EpiTransferenciasTab({
  empresaOrigem,
}: {
  empresaOrigem: string;
}) {
  const { data: catalogoOrigem = [] } = useEpiCatalogo(empresaOrigem);
  const { data: saldos } = useEpiSaldo(empresaOrigem);
  const { data: transferencias = [] } = useEpiTransferencias(empresaOrigem);
  const { data: empresas = [] } = useEmpresas();
  const transferir = useTransferir();

  const [destino, setDestino] = useState<string | null>(null);
  const { data: catalogoDestino = [] } = useEpiCatalogo(destino);
  const [observacao, setObservacao] = useState("");
  const [linhas, setLinhas] = useState<LinhaItem[]>([
    { id_catalogo_origem: "", quantidade: "", acao: "novo", id_catalogo_destino: "" },
  ]);

  const nomeEmpresa = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of empresas) m.set(e.id_empresa, e.nome_empresa);
    return m;
  }, [empresas]);

  function setLinha(i: number, patch: Partial<LinhaItem>) {
    setLinhas((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addLinha() {
    setLinhas((prev) => [
      ...prev,
      { id_catalogo_origem: "", quantidade: "", acao: "novo", id_catalogo_destino: "" },
    ]);
  }
  function removeLinha(i: number) {
    setLinhas((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  const mesmaEmpresa = !!destino && destino === empresaOrigem;

  const linhaAcimaSaldo = linhas.some((l) => {
    if (!l.id_catalogo_origem || !(Number(l.quantidade) > 0)) return false;
    return Number(l.quantidade) > (saldos?.get(l.id_catalogo_origem) ?? 0);
  });
  const destinoIncompleto = linhas.some(
    (l) =>
      l.id_catalogo_origem &&
      Number(l.quantidade) > 0 &&
      l.acao === "existente" &&
      !l.id_catalogo_destino
  );

  const itensValidos: TransferirItem[] = useMemo(
    () =>
      linhas
        .filter((l) => l.id_catalogo_origem && Number(l.quantidade) > 0)
        .map((l) => ({
          id_catalogo_origem: l.id_catalogo_origem,
          quantidade: Number(l.quantidade),
          criar_no_destino: l.acao === "novo",
          id_catalogo_destino: l.acao === "existente" ? l.id_catalogo_destino || null : null,
        })),
    [linhas]
  );

  const podeEnviar =
    !!destino &&
    !mesmaEmpresa &&
    itensValidos.length > 0 &&
    !linhaAcimaSaldo &&
    !destinoIncompleto;

  function submit() {
    if (!podeEnviar || !destino) return;
    transferir.mutate(
      {
        empresa_origem: empresaOrigem,
        empresa_destino: destino,
        observacao: observacao.trim() || null,
        itens: itensValidos,
      },
      {
        onSuccess: () => {
          setLinhas([
            { id_catalogo_origem: "", quantidade: "", acao: "novo", id_catalogo_destino: "" },
          ]);
          setObservacao("");
        },
      }
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      {/* Nova transferência */}
      <div className="h-fit rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-gray-900">
          <ArrowLeftRight className="size-4 text-verde-primary" />
          Nova transferência
        </h3>

        {catalogoOrigem.length === 0 ? (
          <p className="text-xs text-gray-500">
            A empresa de origem não tem itens no catálogo.
          </p>
        ) : (
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Empresa de destino</label>
              <EmpresaSelect
                value={destino}
                onChange={setDestino}
                placeholder="Selecione a empresa de destino…"
                allowAll
              />
              {mesmaEmpresa && (
                <p className="mt-1 text-[11px] text-red-600">
                  Destino deve ser diferente da origem.
                </p>
              )}
            </div>

            <div>
              <label className={labelCls}>Itens a transferir</label>
              <div className="space-y-2">
                {linhas.map((l, i) => {
                  const saldo = l.id_catalogo_origem
                    ? saldos?.get(l.id_catalogo_origem) ?? 0
                    : null;
                  const acima = saldo != null && Number(l.quantidade) > saldo;
                  return (
                    <div key={i} className="rounded-lg border border-gray-100 p-2">
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <select
                            className={inputCls}
                            value={l.id_catalogo_origem}
                            onChange={(e) =>
                              setLinha(i, { id_catalogo_origem: e.target.value })
                            }
                          >
                            <option value="">EPI de origem…</option>
                            {catalogoOrigem.map((it) => (
                              <option key={it.id} value={it.id}>
                                {it.nome}
                              </option>
                            ))}
                          </select>
                          {l.id_catalogo_origem && (
                            <p
                              className={`mt-0.5 text-[11px] ${
                                acima ? "text-red-600" : "text-gray-400"
                              }`}
                            >
                              Saldo: {saldo}
                              {acima ? " — insuficiente" : ""}
                            </p>
                          )}
                        </div>
                        <input
                          type="number"
                          min={0.01}
                          step="any"
                          placeholder="Qtd."
                          className={`${inputCls} w-20 shrink-0`}
                          value={l.quantidade}
                          onChange={(e) => setLinha(i, { quantidade: e.target.value })}
                        />
                        <button
                          type="button"
                          onClick={() => removeLinha(i)}
                          disabled={linhas.length === 1}
                          aria-label="Remover item"
                          className="mt-1.5 shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600 disabled:opacity-30"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>

                      {/* Destino do item */}
                      <div className="mt-2 flex items-center gap-2 pl-0.5">
                        <span className="text-[11px] text-gray-400">→ destino:</span>
                        <select
                          className={`${inputCls} flex-1`}
                          value={l.acao}
                          onChange={(e) =>
                            setLinha(i, { acao: e.target.value as DestinoAcao })
                          }
                          disabled={!destino}
                        >
                          <option value="novo">Criar cópia no destino</option>
                          <option value="existente">Vincular a EPI do destino</option>
                        </select>
                        {l.acao === "existente" && (
                          <select
                            className={`${inputCls} flex-1`}
                            value={l.id_catalogo_destino}
                            onChange={(e) =>
                              setLinha(i, { id_catalogo_destino: e.target.value })
                            }
                            disabled={!destino}
                          >
                            <option value="">EPI do destino…</option>
                            {catalogoDestino.map((it) => (
                              <option key={it.id} value={it.id}>
                                {it.nome}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={addLinha}
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-verde-primary hover:text-verde-accent"
              >
                <Plus className="size-3.5" /> Adicionar item
              </button>
            </div>

            <div>
              <label className={labelCls}>Observação</label>
              <input
                className={inputCls}
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
              />
            </div>

            <button
              type="button"
              onClick={submit}
              disabled={transferir.isPending || !podeEnviar}
              className="w-full rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-50"
            >
              {transferir.isPending ? "Transferindo…" : "Transferir"}
            </button>
            {(linhaAcimaSaldo || destinoIncompleto) && (
              <p className="text-xs text-red-600">
                {linhaAcimaSaldo
                  ? "Há item com quantidade acima do saldo disponível."
                  : "Selecione o EPI de destino para os itens marcados como “vincular”."}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Histórico */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Transferências
        </div>
        {transferencias.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-gray-400">
            <ArrowLeftRight className="size-6" />
            Nenhuma transferência.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {transferencias.map((t) => {
              const saida = t.empresa_origem === empresaOrigem;
              return (
                <li key={t.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span
                    className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full ${
                      saida ? "bg-red-50 text-red-500" : "bg-green-50 text-green-600"
                    }`}
                  >
                    <ArrowLeftRight className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 truncate text-gray-800">
                      <Building2 className="size-3 shrink-0 text-gray-300" />
                      <span className="truncate">
                        {nomeEmpresa.get(t.empresa_origem) ?? t.empresa_origem}
                        {" → "}
                        {nomeEmpresa.get(t.empresa_destino) ?? t.empresa_destino}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {fmtData(t.criado_em)} · {t.total_itens}{" "}
                      {t.total_itens === 1 ? "item" : "itens"}
                      {t.observacao ? ` · ${t.observacao}` : ""}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 text-[11px] font-medium ${
                      saida ? "text-red-600" : "text-green-700"
                    }`}
                  >
                    {saida ? "Saída" : "Entrada"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
