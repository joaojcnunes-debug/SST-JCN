"use client";

import { CalendarDays, Copy, RefreshCw, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import { confirmar } from "@/components/ui/confirm";
import { useDefinirIcsToken, type GestaoQuadro } from "@/lib/hooks/useGestao";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

export default function CalendarioModal({
  open, onClose, quadro, podeEditar,
}: {
  open: boolean;
  onClose: () => void;
  quadro: GestaoQuadro;
  podeEditar: boolean;
}) {
  const definir = useDefinirIcsToken();
  const token = quadro.ics_token;
  const link = token ? `${SUPABASE_URL}/functions/v1/gestao-ics?token=${token}` : "";

  async function copiar() {
    try { await navigator.clipboard.writeText(link); toast.success("Link copiado"); }
    catch { toast.error(link); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Assinar calendário (.ics)" size="md">
      <div className="space-y-3">
        <p className="text-xs text-gray-500">
          Gere um link para assinar as tarefas com prazo desta lista no Google Agenda, Outlook ou Apple Calendar.
          As tarefas viram eventos de dia inteiro e atualizam sozinhas.
        </p>

        {!token ? (
          <button type="button" disabled={!podeEditar || definir.isPending} onClick={() => definir.mutate({ id_quadro: quadro.id_quadro })} className="inline-flex items-center gap-2 rounded-lg bg-verde-primary px-3 py-2 text-sm font-semibold text-white hover:bg-verde-dark disabled:opacity-60">
            <CalendarDays className="size-4" /> Gerar link do calendário
          </button>
        ) : (
          <>
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2">
              <input readOnly value={link} className="min-w-0 flex-1 bg-transparent text-xs text-gray-600 focus:outline-none" onFocus={(e) => e.target.select()} />
              <button type="button" onClick={copiar} className="inline-flex shrink-0 items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 hover:bg-gray-50">
                <Copy className="size-3.5" /> Copiar
              </button>
            </div>
            <ol className="list-decimal space-y-0.5 pl-5 text-xs text-gray-500">
              <li>Google Agenda → Outras agendas → <b>De URL</b> → cole o link.</li>
              <li>Outlook → Adicionar calendário → <b>Assinar pela Web</b>.</li>
            </ol>
            {podeEditar && (
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={async () => { if (await confirmar({ title: "Regenerar link?", description: "O link atual deixa de funcionar para quem já assinou." })) definir.mutate({ id_quadro: quadro.id_quadro }); }} className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
                  <RefreshCw className="size-3.5" /> Regenerar
                </button>
                <button type="button" onClick={async () => { if (await confirmar({ title: "Desativar calendário?", description: "O link para de funcionar." })) definir.mutate({ id_quadro: quadro.id_quadro, remover: true }); }} className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">
                  <Trash2 className="size-3.5" /> Desativar
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
