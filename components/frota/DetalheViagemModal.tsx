"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, Undo2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import DetalheViagem from "@/components/frota/DetalheViagem";
import RegistrarRetornoModal from "@/components/frota/RegistrarRetornoModal";
import { useFrotaVeiculo } from "@/lib/hooks/useFrotaVeiculos";
import { formatarPlaca } from "@/lib/frota/placa";
import type { FrotaChecklist } from "@/lib/frota/tipos";

/**
 * A viagem inteira, sem sair da lista.
 *
 * POR QUE MODAL E NÃO NAVEGAÇÃO
 *   Quem abre a Movimentação está conferindo VÁRIAS viagens em sequência —
 *   "quem está fora, desde quando, já voltou?". Navegar para a página e voltar
 *   perde a busca, o filtro e a posição da rolagem a cada conferência. O modal
 *   devolve para a mesma linha da lista.
 *
 *   A página em tela cheia continua existindo e o rodapé leva até ela: é o
 *   endereço que os alertas do painel guardam, e no celular a leitura é melhor.
 *
 * RASCUNHO NÃO CHEGA AQUI. Rascunho é formulário por terminar, não registro
 * para ler: o card dele leva direto ao assistente. Ver a lista em
 * app/(frota)/frota/movimentacoes/page.tsx.
 */
export default function DetalheViagemModal({
  saida,
  aberto,
  onFechar,
}: {
  saida: FrotaChecklist;
  aberto: boolean;
  onFechar: () => void;
}) {
  const { data: veiculo } = useFrotaVeiculo(saida.id_veiculo);
  const [fechandoViagem, setFechandoViagem] = useState(false);

  const placa = formatarPlaca(veiculo?.placa ?? "—");
  const emAberto = !saida.data_retorno;

  return (
    <>
      <Modal
        open={aberto}
        onClose={onFechar}
        size="xl"
        title={`${placa} · ${saida.condutor_nome}`}
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link
              href={`/frota/${saida.id_veiculo}/saida/${saida.id_checklist}`}
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
            >
              <ExternalLink className="size-4" />
              Abrir em tela cheia
            </Link>

            <div className="flex items-center gap-2">
              {emAberto && (
                <button
                  type="button"
                  onClick={() => setFechandoViagem(true)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
                >
                  <Undo2 className="size-4" />
                  Registrar retorno
                </button>
              )}
              <button
                type="button"
                onClick={onFechar}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Fechar
              </button>
            </div>
          </div>
        }
      >
        <DetalheViagem checklist={saida} veiculo={veiculo} />
      </Modal>

      {/* O de registrar retorno abre POR CIMA deste, e não no lugar dele: ao
          fechar, quem lançou volta para a viagem e confere o que gravou — que
          é justamente o que não dava para fazer antes. */}
      {fechandoViagem && (
        <RegistrarRetornoModal
          saida={saida}
          placa={placa}
          aberto
          onFechar={() => setFechandoViagem(false)}
        />
      )}
    </>
  );
}
