"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { AlertTriangle, FileCheck2, Plus, Trash2, XCircle } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface Item {
  id_item: string;
  nome_equipamento: string | null;
  numero_serie: string | null;
  numero_patrimonio: string | null;
  quantidade: number;
}

interface Cabecalho {
  observacao: string | null;
  data_entrega: string;
  responsavel_entrega: string | null;
  emitido_em: string | null;
  emitido_por: string | null;
  cancelado_em: string | null;
  cancelado_por: string | null;
  cancelado_motivo: string | null;
}

interface Hist {
  acao: string;
  campo: string | null;
  valor_antes: string | null;
  valor_depois: string | null;
  motivo: string | null;
  usuario_email: string | null;
  criado_em: string;
}

type Rpc = {
  rpc(fn: string, args?: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }>;
};

const ROTULO: Record<string, string> = {
  emitiu: "Emissão",
  editou: "Edição",
  item_add: "Item incluído",
  item_edit: "Item alterado",
  item_rem: "Item removido",
  cancelou: "Cancelamento",
};

const ITEM_VAZIO = { nome_equipamento: "", numero_serie: "", numero_patrimonio: "", quantidade: 1 };

/**
 * Gerenciar uma retirada: montar, emitir, corrigir e cancelar.
 *
 * Tudo passa por RPC — as tabelas não têm policy de UPDATE/DELETE, de propósito. Escrita
 * direta não conseguiria impor "depois de emitido, exige motivo" nem gravar o histórico,
 * e foi o achado do revisor na v188 que tabela com CRUD aberto não sustenta regra.
 *
 * A tela não decide o que pode: ela ANTECIPA. Mostra o campo de motivo quando o banco vai
 * exigir, e esconde "Excluir" quando o banco vai recusar. Se ela errar a antecipação, o
 * banco recusa do mesmo jeito — a tela é conveniência, não controle.
 */
export default function RetiradaGerenciarModal({
  open,
  onClose,
  idEntrega,
  nomeColaborador,
  onMudou,
}: {
  open: boolean;
  onClose: () => void;
  idEntrega: string;
  nomeColaborador: string;
  onMudou?: () => void;
}) {
  const [cab, setCab] = useState<Cabecalho | null>(null);
  const [itens, setItens] = useState<Item[]>([]);
  const [hist, setHist] = useState<Hist[]>([]);
  const [temAssinatura, setTemAssinatura] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [novo, setNovo] = useState({ ...ITEM_VAZIO });
  const [obs, setObs] = useState("");

  const emitido = cab?.emitido_em != null;
  const cancelado = cab?.cancelado_em != null;
  /** O banco exige motivo a partir da emissão (ou de qualquer assinatura). A tela mostra
   *  o campo no mesmo momento, para o erro não chegar depois de a pessoa digitar tudo. */
  const exigeMotivo = emitido || temAssinatura;
  const podeExcluir = !emitido && !temAssinatura && !cancelado;

  const recarregar = useCallback(async () => {
    setCarregando(true);
    const sb = createSupabaseBrowserClient();
    const [{ data: e }, { data: i }, { data: h }, { data: a }] = await Promise.all([
      sb
        .from("equipamentos_entregas")
        .select("observacao, data_entrega, responsavel_entrega, emitido_em, emitido_por, cancelado_em, cancelado_por, cancelado_motivo")
        .eq("id_entrega", idEntrega)
        .maybeSingle(),
      sb
        .from("equipamentos_entregas_itens")
        .select("id_item, nome_equipamento, numero_serie, numero_patrimonio, quantidade")
        .eq("id_entrega", idEntrega)
        .order("criado_em"),
      sb
        .from("equipamentos_entregas_historico")
        .select("acao, campo, valor_antes, valor_depois, motivo, usuario_email, criado_em")
        .eq("id_entrega", idEntrega)
        .order("criado_em"),
      sb.from("equipamentos_entrega_assinaturas").select("id_assinatura").eq("id_entrega", idEntrega),
    ]);
    const cabecalho = (e ?? null) as Cabecalho | null;
    setCab(cabecalho);
    setObs(cabecalho?.observacao ?? "");
    setItens((i ?? []) as Item[]);
    setHist((h ?? []) as Hist[]);
    setTemAssinatura(Array.isArray(a) && a.length > 0);
    setCarregando(false);
  }, [idEntrega]);

  useEffect(() => {
    if (open) void recarregar();
  }, [open, recarregar]);

  async function chamar(fn: string, args: Record<string, unknown>, sucesso: string) {
    if (exigeMotivo && !motivo.trim() && fn !== "equip_entrega_emitir") {
      return toast.error("Esta retirada já foi emitida: descreva o motivo da alteração.");
    }
    setOcupado(true);
    try {
      const sb = createSupabaseBrowserClient() as unknown as Rpc;
      const { error } = await sb.rpc(fn, args);
      if (error) throw new Error(error.message);
      toast.success(sucesso);
      setMotivo("");
      await recarregar();
      onMudou?.();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falhou.");
      return false;
    } finally {
      setOcupado(false);
    }
  }

  const estado = cancelado ? "Cancelada" : emitido ? "Emitida" : "Rascunho";
  const corEstado = cancelado
    ? "bg-red-50 text-red-700"
    : emitido
      ? "bg-emerald-50 text-emerald-700"
      : "bg-amber-50 text-amber-800";

  return (
    <Modal open={open} onClose={onClose} title={`Retirada — ${nomeColaborador}`} size="lg">
      {carregando ? (
        <p className="py-6 text-center text-sm text-slate-500">Carregando…</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${corEstado}`}>{estado}</span>
            {emitido ? (
              <span className="text-xs text-slate-500">
                emitida por {cab?.emitido_por ?? "—"}
              </span>
            ) : (
              <span className="text-xs text-slate-500">
                ainda não emitida — o PDF sai como rascunho e não aceita assinatura
              </span>
            )}
          </div>

          {cancelado ? (
            <p className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
              <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Cancelada por {cab?.cancelado_por ?? "—"}. Motivo: {cab?.cancelado_motivo ?? "—"}. As
              assinaturas continuam registradas — o cancelamento declara que o termo não vale
              mais, não apaga o que aconteceu.
            </p>
          ) : null}

          {exigeMotivo && !cancelado ? (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Motivo da alteração (obrigatório após a emissão)
              </label>
              <input
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="ex.: item conferido a mais na entrega"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
              />
              {temAssinatura ? (
                <p className="mt-1 flex items-start gap-1.5 text-xs text-amber-700">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Esta retirada já tem assinatura. Alterar não apaga as assinaturas, mas o termo
                  passa a declarar que foi alterado depois delas.
                </p>
              ) : null}
            </div>
          ) : null}

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Itens</p>
            <div className="divide-y divide-slate-200 rounded-md border border-slate-200">
              {itens.length === 0 ? (
                <p className="px-3 py-2 text-xs text-slate-500">Nenhum item. Um termo sem item não pode ser emitido.</p>
              ) : (
                itens.map((it) => (
                  <div key={it.id_item} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <span className="flex-1">
                      {it.nome_equipamento}
                      {it.numero_patrimonio ? ` · pat. ${it.numero_patrimonio}` : ""}
                      {it.numero_serie ? ` · s/n ${it.numero_serie}` : ""}
                    </span>
                    <span className="text-xs text-slate-500">×{it.quantidade}</span>
                    {cancelado ? null : (
                      <button
                        type="button"
                        disabled={ocupado}
                        onClick={() =>
                          chamar("equip_entrega_item_remover", { p_id_item: it.id_item, p_motivo: motivo }, "Item removido.")
                        }
                        className="text-slate-400 hover:text-red-600 disabled:opacity-50"
                        title="Remover item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {cancelado ? null : (
            <div className="grid grid-cols-12 gap-2">
              <input
                className="col-span-5 rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800"
                placeholder="Equipamento / descrição"
                value={novo.nome_equipamento}
                onChange={(e) => setNovo({ ...novo, nome_equipamento: e.target.value })}
              />
              <input
                className="col-span-3 rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800"
                placeholder="Patrimônio"
                value={novo.numero_patrimonio}
                onChange={(e) => setNovo({ ...novo, numero_patrimonio: e.target.value })}
              />
              <input
                className="col-span-2 rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800"
                placeholder="Nº série"
                value={novo.numero_serie}
                onChange={(e) => setNovo({ ...novo, numero_serie: e.target.value })}
              />
              <input
                type="number"
                min={1}
                className="col-span-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800"
                value={novo.quantidade}
                onChange={(e) => setNovo({ ...novo, quantidade: Number(e.target.value) })}
              />
              <button
                type="button"
                disabled={ocupado || !novo.nome_equipamento.trim()}
                onClick={async () => {
                  const ok = await chamar(
                    "equip_entrega_item_upsert",
                    {
                      p_id_entrega: idEntrega,
                      p_nome_equipamento: novo.nome_equipamento,
                      p_numero_serie: novo.numero_serie,
                      p_numero_patrimonio: novo.numero_patrimonio,
                      p_quantidade: novo.quantidade,
                      p_motivo: motivo,
                    },
                    "Item incluído.",
                  );
                  if (ok) setNovo({ ...ITEM_VAZIO });
                }}
                className="col-span-1 inline-flex items-center justify-center rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          )}

          {cancelado ? null : (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Observação
              </label>
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                  value={obs}
                  onChange={(e) => setObs(e.target.value)}
                />
                <button
                  type="button"
                  disabled={ocupado || obs === (cab?.observacao ?? "")}
                  onClick={() =>
                    chamar("equip_entrega_editar", { p_id_entrega: idEntrega, p_observacao: obs, p_motivo: motivo }, "Observação salva.")
                  }
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  Salvar
                </button>
              </div>
            </div>
          )}

          {hist.length > 0 ? (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Histórico
              </p>
              <div className="max-h-40 space-y-1 overflow-auto rounded-md border border-slate-200 p-2 text-xs">
                {hist.map((h, i) => (
                  <div key={i} className="text-slate-600">
                    <span className="text-slate-400">
                      {new Date(h.criado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                    </span>{" "}
                    <b>{ROTULO[h.acao] ?? h.acao}</b>
                    {h.campo ? ` · ${h.campo}` : ""}
                    {h.valor_depois ? ` → ${h.valor_depois}` : ""}
                    {h.motivo ? ` · ${h.motivo}` : ""}
                    {h.usuario_email ? ` · ${h.usuario_email}` : ""}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-3">
            {podeExcluir ? (
              <button
                type="button"
                disabled={ocupado}
                onClick={async () => {
                  // Confirmação porque é o único ato do módulo que não tem volta: a linha
                  // some, e o que resta é a descrição no log de auditoria. Um clique sem
                  // pergunta seria desproporcional ao estrago.
                  if (
                    !window.confirm(
                      `Excluir a retirada de ${nomeColaborador}? A linha some e não há como desfazer. Fica só o registro no log de auditoria.`,
                    )
                  ) {
                    return;
                  }
                  const ok = await chamar(
                    "equip_entrega_excluir",
                    { p_id_entrega: idEntrega, p_motivo: motivo },
                    "Retirada excluída.",
                  );
                  if (ok) onClose();
                }}
                className="mr-auto inline-flex items-center gap-1 rounded-md border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" /> Excluir
              </button>
            ) : null}

            {!cancelado && (emitido || temAssinatura) ? (
              <button
                type="button"
                disabled={ocupado || !motivo.trim()}
                onClick={() =>
                  chamar("equip_entrega_cancelar", { p_id_entrega: idEntrega, p_motivo: motivo }, "Retirada cancelada.")
                }
                title={motivo.trim() ? "" : "Cancelamento exige motivo"}
                className="inline-flex items-center gap-1 rounded-md border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                <XCircle className="h-4 w-4" /> Cancelar retirada
              </button>
            ) : null}

            {!emitido && !cancelado ? (
              <button
                type="button"
                disabled={ocupado || itens.length === 0}
                onClick={() => chamar("equip_entrega_emitir", { p_id_entrega: idEntrega }, "Termo emitido.")}
                title={itens.length === 0 ? "Um termo sem item não pode ser emitido" : ""}
                className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <FileCheck2 className="h-4 w-4" /> Emitir termo
              </button>
            ) : null}

            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
