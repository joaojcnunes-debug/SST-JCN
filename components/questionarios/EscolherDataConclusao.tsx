"use client";

// v263 — reconcluir uma aplicação que já tinha data de conclusão: qual data vai
// para a capa do laudo? O banco só carimba sozinho a PRIMEIRA conclusão (data
// vazia); daí em diante quem decide é quem conclui, aqui. Usado no botão de
// avançar da aplicação e no quadro de status do Resumo.

import Modal from "@/components/ui/Modal";

function dataBR(iso: string): string {
  return new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString("pt-BR");
}

/** Hoje no calendário de Brasília, em AAAA-MM-DD (o formato da coluna `date`). */
export function hojeIso(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export default function EscolherDataConclusao({
  dataAnterior,
  onEscolher,
  onCancelar,
}: {
  /** A data de conclusão que a aplicação já tem (AAAA-MM-DD). Sem ela, o modal não abre. */
  dataAnterior: string | null;
  /** Recebe a data escolhida (AAAA-MM-DD). */
  onEscolher: (data: string) => void;
  onCancelar: () => void;
}) {
  const hoje = hojeIso();
  return (
    <Modal open={!!dataAnterior} onClose={onCancelar} size="sm" title="Data da conclusão">
      <p className="text-sm leading-relaxed text-gray-600">
        Esta aplicação já foi concluída em <strong>{dataAnterior ? dataBR(dataAnterior) : ""}</strong>.
        Qual data deve sair na capa do laudo?
      </p>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancelar}
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => dataAnterior && onEscolher(dataAnterior)}
          className="rounded-xl border border-verde-primary bg-white px-4 py-2 text-sm font-semibold text-verde-primary hover:bg-green-50"
        >
          Manter {dataAnterior ? dataBR(dataAnterior) : ""}
        </button>
        <button
          type="button"
          onClick={() => onEscolher(hoje)}
          className="rounded-xl bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent"
        >
          Usar hoje ({dataBR(hoje)})
        </button>
      </div>
    </Modal>
  );
}
