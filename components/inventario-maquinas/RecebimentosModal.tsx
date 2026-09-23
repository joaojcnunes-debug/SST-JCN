"use client";

import { useMemo, useState } from "react";
import { Check, Ban, Inbox } from "lucide-react";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import {
  useTransferencias,
  useAceitarTransferencia,
  useRecusarTransferencia,
  type Transferencia,
} from "@/lib/hooks/useTransferencias";
import { useCurrentUser, useIsAdmin } from "@/lib/hooks/useUsuario";
import AssinaturaAceiteModal from "./AssinaturaAceiteModal";

/**
 * Mini-tela de "Recebimentos" de uma unidade: lista as transferências PENDENTES
 * que estão chegando naquela base. Quem é o destinatário (ou admin) pode aceitar
 * e assinar / recusar; os demais veem "Aguardando aceite de Fulano" (só leitura).
 * Reaproveita a caixa de aceite da tela /transferencia — nenhum fluxo novo.
 */
export default function RecebimentosModal({
  open,
  onClose,
  idUnidade,
  nomeUnidade,
}: {
  open: boolean;
  onClose: () => void;
  idUnidade: string;
  nomeUnidade: string | null;
}) {
  const user = useCurrentUser();
  const isAdmin = useIsAdmin();
  const meuEmail = (user?.email ?? "").toLowerCase();

  const { data: transferencias = [] } = useTransferencias();
  const aceitar = useAceitarTransferencia();
  const recusar = useRecusarTransferencia();

  const [assinando, setAssinando] = useState<Transferencia | null>(null);
  const [recusandoId, setRecusandoId] = useState<string | null>(null);
  const [motivoRecusa, setMotivoRecusa] = useState("");

  const pendentesDaUnidade = useMemo(
    () =>
      transferencias.filter(
        (t) => t.status === "pendente" && t.para_id_unidade === idUnidade,
      ),
    [transferencias, idUnidade],
  );

  function podeAgir(t: Transferencia) {
    return isAdmin || (t.para_usuario_email ?? "").toLowerCase() === meuEmail;
  }

  async function confirmarRecusa(t: Transferencia) {
    try {
      await recusar.mutateAsync({ id: t.id_transferencia, motivo: motivoRecusa.trim() });
      toast.success("Transferência recusada");
      setRecusandoId(null);
      setMotivoRecusa("");
    } catch {
      /* toast tratado no hook */
    }
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        size="lg"
        title={`Recebimentos${nomeUnidade ? ` — ${nomeUnidade}` : ""}`}
      >
        {pendentesDaUnidade.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 py-10 text-center">
            <Inbox className="size-6 text-gray-400" />
            <p className="text-sm text-gray-500">
              Nenhuma transferência chegando para{" "}
              <strong>{nomeUnidade ?? "esta unidade"}</strong> no momento.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {pendentesDaUnidade.map((t) => (
              <li
                key={t.id_transferencia}
                className="rounded-lg border border-amber-200 bg-amber-50/40 p-3"
              >
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900">{t.maquina_nome ?? "—"}</p>
                    <p className="text-xs text-gray-500">
                      {[t.maquina_codigo_interno, t.maquina_tag, t.maquina_modelo]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </p>
                    <p className="mt-1 text-xs text-gray-600">
                      <span className="text-gray-400">{t.de_unidade ?? "origem"}</span>
                      <span className="mx-1 text-blue-500">→</span>
                      <span className="font-medium">{t.para_unidade ?? nomeUnidade ?? "destino"}</span>
                      {t.responsavel_nome ? (
                        <span className="text-gray-400"> · enviado por {t.responsavel_nome}</span>
                      ) : null}
                    </p>
                  </div>

                  {podeAgir(t) ? (
                    recusandoId === t.id_transferencia ? null : (
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => setAssinando(t)}
                          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
                        >
                          <Check className="size-4" /> Aceitar e assinar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRecusandoId(t.id_transferencia);
                            setMotivoRecusa("");
                          }}
                          className="inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
                        >
                          <Ban className="size-4" /> Recusar
                        </button>
                      </div>
                    )
                  ) : (
                    <span className="shrink-0 self-center rounded-md bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                      Aguardando aceite de {t.para_usuario_nome ?? "destinatário"}
                    </span>
                  )}
                </div>

                {/* Recusa inline — substitui o window.prompt da tela antiga */}
                {recusandoId === t.id_transferencia && (
                  <div className="mt-3 space-y-2 border-t border-amber-200 pt-3">
                    <textarea
                      value={motivoRecusa}
                      onChange={(e) => setMotivoRecusa(e.target.value)}
                      placeholder="Motivo da recusa (opcional)"
                      rows={2}
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setRecusandoId(null);
                          setMotivoRecusa("");
                        }}
                        className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Voltar
                      </button>
                      <button
                        type="button"
                        onClick={() => confirmarRecusa(t)}
                        disabled={recusar.isPending}
                        className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        <Ban className="size-4" /> Confirmar recusa
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Modal>

      {assinando && (
        <AssinaturaAceiteModal
          transferencia={assinando}
          pending={aceitar.isPending}
          onConfirmar={async (png) => {
            try {
              await aceitar.mutateAsync({ id: assinando.id_transferencia, assinaturaPng: png });
              toast.success("Recebimento confirmado — equipamento transferido");
              setAssinando(null);
            } catch {
              /* toast tratado no hook */
            }
          }}
          onFechar={() => setAssinando(null)}
        />
      )}
    </>
  );
}
