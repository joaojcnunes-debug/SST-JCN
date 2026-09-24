"use client";

import { useMemo, useState } from "react";
import { ArrowLeftRight, Check, X, Ban, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  useTransferencias,
  useAceitarTransferencia,
  useRecusarTransferencia,
  useCancelarTransferencia,
  type Transferencia,
} from "@/lib/hooks/useTransferencias";
import { useEquipamentosCatalogo } from "@/lib/hooks/useEquipamentosEstoque";
import { useUnidades } from "@/lib/hooks/useUnidades";
import { useCurrentUser, useIsAdmin } from "@/lib/hooks/useUsuario";
import AssinaturaAceiteModal from "@/components/equipamentos/AssinaturaAceiteModal";
import { cn } from "@/lib/utils";

/**
 * Transferências esperando aceite — nos DOIS modelos.
 *
 * POR QUE ISTO FICA NO TOPO DO EXTRATO. A quantidade já saiu do saldo da base de
 * origem no momento do registro (v176). Enquanto ninguém aceita, ela não está em
 * lugar nenhum: saiu de uma base e não entrou na outra. Se essa lista ficasse
 * escondida numa aba, o material sumiria da vista de todo mundo — e "sumiu da
 * vista" é como estoque vira prejuízo.
 *
 * ⚠️ OS DOIS MODELOS ESPERAM EM ESTADOS DIFERENTES, e a lista precisa dizer qual:
 *  • POR QUANTIDADE (`id_catalogo`) — já saiu da origem. Está EM TRÂNSITO.
 *  • APARELHO IDENTIFICADO (`id_equipamento`) — continua na origem, e só muda de
 *    base no aceite. Está AGUARDANDO, não em trânsito.
 *  Chamar os dois de "em trânsito" mandaria alguém procurar um notebook que
 *  nunca saiu da sala. Por isso cada linha carrega a sua tarja.
 *
 * QUEM VÊ O QUÊ:
 *  • o destinatário escolhido (ou um admin) aceita ou recusa;
 *  • quem registrou pode cancelar enquanto está pendente;
 *  • na por quantidade, os dois caminhos de desistência DEVOLVEM o saldo à
 *    origem, e quem faz isso é o banco, na mesma transação. Na individualizada
 *    não há o que devolver — o aparelho nunca saiu.
 */
export default function TransferenciasPendentes() {
  const { data: transferencias = [] } = useTransferencias();
  const { data: catalogo = [] } = useEquipamentosCatalogo();
  const { data: unidades = [] } = useUnidades();
  const user = useCurrentUser();
  const isAdmin = useIsAdmin();

  const aceitar = useAceitarTransferencia();
  const recusar = useRecusarTransferencia();
  const cancelar = useCancelarTransferencia();

  const [assinando, setAssinando] = useState<Transferencia | null>(null);

  const nomeBase = useMemo(
    () => new Map(unidades.map((u) => [u.id_unidade, u.nome])),
    [unidades]
  );
  const nomeProduto = useMemo(
    () => new Map(catalogo.map((c) => [c.id_catalogo, c.nome])),
    [catalogo]
  );

  /** Os dois modelos, desde que nascidos no módulo novo. A linha antiga, sem
   *  `id_catalogo` nem `id_equipamento`, é do inventário e não aparece aqui —
   *  são 3 registros de teste, todos já com a máquina apagada. */
  const pendentes = useMemo(
    () =>
      transferencias.filter(
        (t) => t.status === "pendente" && (t.id_catalogo != null || t.id_equipamento != null)
      ),
    [transferencias]
  );

  if (pendentes.length === 0) return null;

  const meuEmail = (user?.email ?? "").toLowerCase();

  return (
    <>
      <div className="space-y-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
          <ArrowLeftRight className="size-4 text-blue-600" />
          Aguardando aceite
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-700">
            {pendentes.length}
          </span>
        </h2>

        <div className="space-y-2">
          {pendentes.map((t) => {
            const individual = t.id_equipamento != null;
            const souDestinatario =
              (t.para_usuario_email ?? "").toLowerCase() === meuEmail || isAdmin;
            const souRemetente =
              (t.responsavel_email ?? "").toLowerCase() === meuEmail;

            return (
              <div
                key={t.id_transferencia}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50/50 p-3"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-900">
                    {individual
                      ? (t.maquina_nome ?? "aparelho")
                      : `${t.quantidade}× ${nomeProduto.get(t.id_catalogo ?? "") ?? t.maquina_nome ?? "item"}`}
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                        individual
                          ? "bg-gray-200 text-gray-700"
                          : "bg-blue-100 text-blue-700"
                      )}
                    >
                      {individual ? "ainda na origem" : "em trânsito"}
                    </span>
                  </p>
                  {/* Na individualizada, o que identifica é plaqueta e série —
                      não a quantidade. É por eles que se acha o aparelho. */}
                  {individual && (
                    <p className="text-xs text-gray-500">
                      {[
                        t.maquina_numero_patrimonio && `plaqueta ${t.maquina_numero_patrimonio}`,
                        t.maquina_modelo,
                        t.maquina_numero_serie && `série ${t.maquina_numero_serie}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                  <p className="text-xs text-gray-600">
                    {nomeBase.get(t.de_id_unidade ?? "") ?? "—"} →{" "}
                    <strong>{nomeBase.get(t.para_id_unidade ?? "") ?? "—"}</strong>
                    {t.para_usuario_nome && <> · aguarda {t.para_usuario_nome}</>}
                  </p>
                  {t.motivo && (
                    <p className="text-xs text-gray-500">{t.motivo}</p>
                  )}
                </div>

                <div className="flex shrink-0 gap-1.5">
                  {souDestinatario && (
                    <>
                      <button
                        type="button"
                        onClick={() => setAssinando(t)}
                        className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        <Check className="size-3.5" />
                        Receber e assinar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const motivo = window.prompt(
                            individual
                              ? "Por que está recusando? O aparelho continua na base de origem."
                              : "Por que está recusando? O material volta para a base de origem."
                          );
                          if (motivo === null) return;
                          if (!motivo.trim())
                            return toast.error("Escreva o motivo da recusa.");
                          recusar.mutate({ id: t.id_transferencia, motivo: motivo.trim() });
                        }}
                        disabled={recusar.isPending}
                        className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-red-50 hover:text-red-700"
                      >
                        <X className="size-3.5" />
                        Recusar
                      </button>
                    </>
                  )}
                  {souRemetente && !souDestinatario && (
                    <button
                      type="button"
                      onClick={() => {
                        const motivo = window.prompt(
                          individual
                            ? "Cancelar esta transferência? O aparelho continua onde está."
                            : "Cancelar esta transferência? O material volta para a base de origem."
                        );
                        if (motivo === null) return;
                        cancelar.mutate({
                          id: t.id_transferencia,
                          motivo: motivo.trim() || undefined,
                        });
                      }}
                      disabled={cancelar.isPending}
                      className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <Ban className="size-3.5" />
                      Cancelar
                    </button>
                  )}
                  {!souDestinatario && !souRemetente && (
                    <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                      <Loader2 className="size-3.5" />
                      aguardando o destinatário
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-gray-400">
          <strong>Em trânsito</strong>: já saiu do saldo da origem e ainda não
          entrou no destino — recusar ou cancelar devolve tudo para a origem.{" "}
          <strong>Ainda na origem</strong>: o aparelho não se moveu, e só muda de
          base quando alguém assinar o recebimento.
        </p>
      </div>

      {assinando && (
        <AssinaturaAceiteModal
          transferencia={assinando}
          pending={aceitar.isPending}
          onConfirmar={(png) =>
            aceitar.mutate(
              { id: assinando.id_transferencia, assinaturaPng: png },
              { onSuccess: () => setAssinando(null) }
            )
          }
          onFechar={() => setAssinando(null)}
        />
      )}
    </>
  );
}
