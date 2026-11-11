"use client";

import Modal from "@/components/ui/Modal";
import { ATALHOS } from "@/lib/gestao/atalhos";

const Tecla = ({ t }: { t: string }) => (
  <kbd className="inline-flex min-w-7 items-center justify-center rounded border border-gray-300 bg-gray-50 px-1.5 py-0.5 font-mono text-xs font-semibold text-gray-700 shadow-sm">{t}</kbd>
);

/** Lista dos atalhos de teclado da Gestão (tecla ?). */
export default function AtalhosAjuda({ open, onClose }: { open: boolean; onClose: () => void }) {
  const linha = (teclas: string[], texto: string) => (
    <li key={texto} className="flex items-center justify-between gap-3 border-t border-gray-100 py-1.5 first:border-t-0">
      <span className="text-sm text-gray-700">{texto}</span>
      <span className="flex shrink-0 gap-1">{teclas.map((t) => <Tecla key={t} t={t} />)}</span>
    </li>
  );
  return (
    <Modal open={open} onClose={onClose} title="Atalhos de teclado" size="md">
      <div className="space-y-4">
        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Com o mouse sobre um cartão</h3>
          <ul>{ATALHOS.filter((a) => a.noCartao).map((a) => linha(a.teclas, a.texto))}</ul>
        </section>
        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">No quadro</h3>
          <ul>{ATALHOS.filter((a) => !a.noCartao).map((a) => linha(a.teclas, a.texto))}</ul>
        </section>
        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Na janela da tarefa</h3>
          <ul>
            {linha(["Ctrl", "Enter"], "Salvar")}
            {linha(["Esc"], "Fechar")}
          </ul>
        </section>
        <p className="text-xs text-gray-500">Os atalhos não disparam enquanto você digita num campo.</p>
      </div>
    </Modal>
  );
}
