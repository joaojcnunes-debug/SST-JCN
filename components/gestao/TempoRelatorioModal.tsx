"use client";

import Modal from "@/components/ui/Modal";
import { formatarDuracao, totalSegundos, iniciais, type GestaoTempo } from "@/lib/hooks/useGestao";

export default function TempoRelatorioModal({
  open,
  onClose,
  entries,
}: {
  open: boolean;
  onClose: () => void;
  entries: GestaoTempo[];
}) {
  const total = totalSegundos(entries);
  const porUser = new Map<string, GestaoTempo[]>();
  for (const e of entries) {
    if (!porUser.has(e.usuario_email)) porUser.set(e.usuario_email, []);
    porUser.get(e.usuario_email)!.push(e);
  }
  const linhas = [...porUser.entries()].map(([email, es]) => ({ email, seg: totalSegundos(es) })).sort((a, b) => b.seg - a.seg);

  return (
    <Modal open={open} onClose={onClose} title="Relatório de tempo" size="md">
      <div className="space-y-3">
        <div className="rounded-lg bg-verde-light/40 p-3">
          <p className="text-xs text-gray-500">Total desta lista</p>
          <p className="text-2xl font-bold text-verde-primary">{formatarDuracao(total)}</p>
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-gray-500">Por pessoa</p>
          <div className="space-y-1">
            {linhas.map((l) => (
              <div key={l.email} className="flex items-center gap-2 text-sm">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-verde-light text-[10px] font-bold text-verde-primary">{iniciais(l.email)}</span>
                <span className="min-w-0 flex-1 truncate text-gray-700">{l.email}</span>
                <span className="font-medium text-gray-600">{formatarDuracao(l.seg)}</span>
              </div>
            ))}
            {linhas.length === 0 && <p className="text-sm text-gray-400">Nenhum tempo registrado nesta lista.</p>}
          </div>
        </div>
      </div>
    </Modal>
  );
}
