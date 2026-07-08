"use client";

import { useMemo, useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, Boxes } from "lucide-react";
import { inputCls, labelCls } from "./EpiModal";
import {
  useEpiCatalogo,
  useEpiSaldo,
  useEpiMovimentacoes,
  useRegistrarMovimentacao,
} from "@/lib/hooks/useEpi";
import { EPI_TIPO_MOV_LABEL, type EpiTipoMovimentacao } from "@/lib/epi/types";
import { fmtData } from "@/lib/utils";

export default function EpiEstoqueTab({
  empresaId,
  canEdit,
}: {
  empresaId: string;
  canEdit: boolean;
}) {
  const { data: itens = [] } = useEpiCatalogo(empresaId);
  const { data: saldos } = useEpiSaldo(empresaId);
  const { data: movs = [] } = useEpiMovimentacoes(empresaId);
  const registrar = useRegistrarMovimentacao();

  const [idCatalogo, setIdCatalogo] = useState("");
  const [tipo, setTipo] = useState<EpiTipoMovimentacao>("entrada");
  const [quantidade, setQuantidade] = useState("");
  const [motivo, setMotivo] = useState("");
  const [responsavel, setResponsavel] = useState("");

  const nomePorId = useMemo(() => {
    const m = new Map<string, string>();
    for (const it of itens) m.set(it.id, it.nome);
    return m;
  }, [itens]);

  function submit() {
    const qtd = Number(quantidade);
    if (!idCatalogo || !(qtd > 0)) return;
    registrar.mutate(
      {
        empresa_id: empresaId,
        id_catalogo: idCatalogo,
        tipo,
        quantidade: qtd,
        origem: "manual",
        motivo: motivo.trim() || null,
        responsavel: responsavel.trim() || null,
      },
      {
        onSuccess: () => {
          setQuantidade("");
          setMotivo("");
        },
      }
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
      {/* Registrar movimentação */}
      {canEdit && (
        <div className="h-fit rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">
            Registrar movimentação
          </h3>
          {itens.length === 0 ? (
            <p className="text-xs text-gray-500">
              Cadastre um EPI no catálogo antes de movimentar o estoque.
            </p>
          ) : (
            <div className="space-y-3">
              <div>
                <label className={labelCls}>EPI</label>
                <select
                  className={inputCls}
                  value={idCatalogo}
                  onChange={(e) => setIdCatalogo(e.target.value)}
                >
                  <option value="">Selecione…</option>
                  {itens.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Tipo</label>
                  <select
                    className={inputCls}
                    value={tipo}
                    onChange={(e) =>
                      setTipo(e.target.value as EpiTipoMovimentacao)
                    }
                  >
                    <option value="entrada">Entrada</option>
                    <option value="saida">Saída</option>
                    <option value="ajuste">Ajuste</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Quantidade</label>
                  <input
                    type="number"
                    min={0.01}
                    step="any"
                    className={inputCls}
                    value={quantidade}
                    onChange={(e) => setQuantidade(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Responsável</label>
                <input
                  className={inputCls}
                  value={responsavel}
                  onChange={(e) => setResponsavel(e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>Motivo / observação</label>
                <input
                  className={inputCls}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                />
              </div>
              <button
                type="button"
                onClick={submit}
                disabled={
                  registrar.isPending || !idCatalogo || !(Number(quantidade) > 0)
                }
                className="w-full rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-50"
              >
                {registrar.isPending ? "Registrando…" : "Registrar"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Saldo + histórico */}
      <div className="space-y-4">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Saldo atual
          </div>
          {itens.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-gray-400">
              <Boxes className="size-6" />
              Sem itens.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {itens.map((it) => {
                const saldo = saldos?.get(it.id) ?? 0;
                const abaixo = saldo < it.estoque_minimo;
                return (
                  <li
                    key={it.id}
                    className="flex items-center justify-between px-4 py-2.5 text-sm"
                  >
                    <span className="text-gray-800">{it.nome}</span>
                    <span
                      className={`font-semibold ${
                        abaixo ? "text-red-600" : "text-gray-900"
                      }`}
                    >
                      {saldo} {it.unidade}
                      {abaixo && (
                        <span className="ml-1 text-[11px] font-normal text-red-500">
                          (mín. {it.estoque_minimo})
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Últimas movimentações
          </div>
          {movs.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-400">
              Nenhuma movimentação.
            </div>
          ) : (
            <ul className="max-h-80 divide-y divide-gray-100 overflow-auto">
              {movs.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm"
                >
                  {m.tipo === "saida" ? (
                    <ArrowUpCircle className="size-4 shrink-0 text-red-500" />
                  ) : (
                    <ArrowDownCircle className="size-4 shrink-0 text-green-600" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-gray-800">
                      {nomePorId.get(m.id_catalogo) ?? "—"}
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {EPI_TIPO_MOV_LABEL[m.tipo]} · {fmtData(m.criado_em)}
                      {m.responsavel ? ` · ${m.responsavel}` : ""}
                      {m.motivo ? ` · ${m.motivo}` : ""}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 font-semibold ${
                      m.tipo === "saida" ? "text-red-600" : "text-green-700"
                    }`}
                  >
                    {m.tipo === "saida" ? "−" : "+"}
                    {m.quantidade}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
