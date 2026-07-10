"use client";

import { useMemo, useState } from "react";
import {
  Plus,
  Trash2,
  ClipboardCheck,
  FileText,
  UserCheck,
  PenLine,
  ShieldCheck,
} from "lucide-react";
import { inputCls, labelCls } from "./EpiModal";
import EpiAssinaturaModal from "./EpiAssinaturaModal";
import BotaoGerarPdf from "@/components/ui/BotaoGerarPdf";
import {
  useEpiColaboradores,
  useEpiCatalogo,
  useEpiSaldo,
  useEpiEntregas,
  useEpiEntregasAssinadas,
  useRegistrarEntrega,
  type RegistrarEntregaItem,
} from "@/lib/hooks/useEpi";
import { fmtData } from "@/lib/utils";

interface LinhaItem {
  id_catalogo: string;
  quantidade: string;
}

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function EpiEntregasTab({
  empresaId,
  canEdit,
  podeSelar = false,
}: {
  empresaId: string;
  canEdit: boolean;
  /** Selagem PAdES A1 (ICP-Brasil) — só no contexto interno da JCN. */
  podeSelar?: boolean;
}) {
  const { data: colaboradores = [] } = useEpiColaboradores(empresaId);
  const { data: catalogo = [] } = useEpiCatalogo(empresaId);
  const { data: saldos } = useEpiSaldo(empresaId);
  const { data: entregas = [] } = useEpiEntregas(empresaId);
  const { data: assinadas } = useEpiEntregasAssinadas(empresaId);
  const registrar = useRegistrarEntrega();

  const [assinandoId, setAssinandoId] = useState<string | null>(null);
  const entregaAssinando = entregas.find((e) => e.id === assinandoId) ?? null;

  const [idColaborador, setIdColaborador] = useState("");
  const [data, setData] = useState(hojeISO());
  const [observacao, setObservacao] = useState("");
  const [linhas, setLinhas] = useState<LinhaItem[]>([
    { id_catalogo: "", quantidade: "" },
  ]);

  const nomeColab = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of colaboradores) m.set(c.id, c.nome);
    return m;
  }, [colaboradores]);

  const templateColab = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const c of colaboradores) m.set(c.id, c.biometria_template ?? null);
    return m;
  }, [colaboradores]);

  function setLinha(i: number, patch: Partial<LinhaItem>) {
    setLinhas((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addLinha() {
    setLinhas((prev) => [...prev, { id_catalogo: "", quantidade: "" }]);
  }
  function removeLinha(i: number) {
    setLinhas((prev) =>
      prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)
    );
  }

  const itensValidos: RegistrarEntregaItem[] = useMemo(
    () =>
      linhas
        .filter((l) => l.id_catalogo && Number(l.quantidade) > 0)
        .map((l) => ({
          id_catalogo: l.id_catalogo,
          quantidade: Number(l.quantidade),
        })),
    [linhas]
  );

  // valida saldo no cliente (a RPC revalida no servidor)
  const linhaAcimaSaldo = linhas.some((l) => {
    if (!l.id_catalogo || !(Number(l.quantidade) > 0)) return false;
    const saldo = saldos?.get(l.id_catalogo) ?? 0;
    return Number(l.quantidade) > saldo;
  });

  const podeEnviar =
    !!idColaborador && itensValidos.length > 0 && !linhaAcimaSaldo;

  function submit() {
    if (!podeEnviar) return;
    registrar.mutate(
      {
        empresa_id: empresaId,
        id_colaborador: idColaborador,
        data_entrega: data || null,
        responsavel: null,
        observacao: observacao.trim() || null,
        itens: itensValidos,
      },
      {
        onSuccess: () => {
          setLinhas([{ id_catalogo: "", quantidade: "" }]);
          setObservacao("");
        },
      }
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
      {/* Registrar entrega */}
      {canEdit && (
        <div className="h-fit rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-gray-900">
            <ClipboardCheck className="size-4 text-verde-primary" />
            Registrar entrega
          </h3>

          {colaboradores.length === 0 ? (
            <p className="text-xs text-gray-500">
              Cadastre um colaborador antes de registrar entregas.
            </p>
          ) : catalogo.length === 0 ? (
            <p className="text-xs text-gray-500">
              Cadastre um EPI no catálogo antes de registrar entregas.
            </p>
          ) : (
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Colaborador</label>
                <select
                  className={inputCls}
                  value={idColaborador}
                  onChange={(e) => setIdColaborador(e.target.value)}
                >
                  <option value="">Selecione…</option>
                  {colaboradores.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                      {c.cargo ? ` — ${c.cargo}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelCls}>Data da entrega</label>
                <input
                  type="date"
                  className={inputCls}
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                />
              </div>

              {/* Itens */}
              <div>
                <label className={labelCls}>Itens entregues</label>
                <div className="space-y-2">
                  {linhas.map((l, i) => {
                    const saldo = l.id_catalogo
                      ? saldos?.get(l.id_catalogo) ?? 0
                      : null;
                    const acima =
                      saldo != null && Number(l.quantidade) > saldo;
                    return (
                      <div key={i} className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <select
                            className={inputCls}
                            value={l.id_catalogo}
                            onChange={(e) =>
                              setLinha(i, { id_catalogo: e.target.value })
                            }
                          >
                            <option value="">EPI…</option>
                            {catalogo.map((it) => (
                              <option key={it.id} value={it.id}>
                                {it.nome}
                              </option>
                            ))}
                          </select>
                          {l.id_catalogo && (
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
                        <div className="w-20 shrink-0">
                          <input
                            type="number"
                            min={0.01}
                            step="any"
                            placeholder="Qtd."
                            className={inputCls}
                            value={l.quantidade}
                            onChange={(e) =>
                              setLinha(i, { quantidade: e.target.value })
                            }
                          />
                        </div>
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
                disabled={registrar.isPending || !podeEnviar}
                className="w-full rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-50"
              >
                {registrar.isPending ? "Registrando…" : "Registrar entrega"}
              </button>
              {linhaAcimaSaldo && (
                <p className="text-xs text-red-600">
                  Há item com quantidade acima do saldo disponível.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Histórico de entregas */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Entregas registradas
        </div>
        {entregas.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-gray-400">
            <UserCheck className="size-6" />
            Nenhuma entrega registrada.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {entregas.map((e) => {
              const assinatura = assinadas?.get(e.id) ?? null;
              return (
                <li
                  key={e.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-medium text-gray-800">
                        {nomeColab.get(e.id_colaborador) ?? "Colaborador"}
                      </span>
                      {assinatura && (
                        <span
                          title={`Assinada em ${fmtData(assinatura.assinado_em)}`}
                          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700"
                        >
                          <ShieldCheck className="size-3" /> Assinada
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {fmtData(e.data_entrega)} · {e.total_itens}{" "}
                      {e.total_itens === 1 ? "item" : "itens"}
                      {e.responsavel_entrega ? ` · ${e.responsavel_entrega}` : ""}
                    </div>
                  </div>
                  {canEdit && !assinatura && (
                    <button
                      type="button"
                      onClick={() => setAssinandoId(e.id)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-sky-300 bg-white px-2.5 py-1.5 text-xs font-medium text-verde-accent hover:bg-sky-50"
                    >
                      <PenLine className="size-3.5" /> Assinar
                    </button>
                  )}
                  <BotaoGerarPdf
                    label="Ficha"
                    apiPdfUrl={`/api/pdf/epi-entrega/${e.id}`}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    tabelaNome={podeSelar ? "epi_entregas" : undefined}
                    docId={podeSelar ? e.id : undefined}
                  />
                </li>
              );
            })}
          </ul>
        )}
        <div className="flex items-center gap-1.5 border-t border-gray-100 px-4 py-2 text-[11px] text-gray-400">
          <FileText className="size-3" /> A ficha gera um PDF; a assinatura do
          colaborador é vinculada ao documento por hash (não-repúdio).
        </div>
      </div>

      {entregaAssinando && (
        <EpiAssinaturaModal
          open={!!assinandoId}
          onClose={() => setAssinandoId(null)}
          entregaId={entregaAssinando.id}
          empresaId={empresaId}
          colaboradorNome={nomeColab.get(entregaAssinando.id_colaborador) ?? ""}
          colaboradorTemplate={
            templateColab.get(entregaAssinando.id_colaborador) ?? null
          }
        />
      )}
    </div>
  );
}
