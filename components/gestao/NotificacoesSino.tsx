"use client";

import { useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNotificacoes, useMarcarLida, type GestaoNotificacao } from "@/lib/hooks/useGestao";

const ICONE_TIPO: Record<string, string> = { atribuicao: "📌", comentario: "💬", mencao: "@", status: "🔄", prazo: "⏰" };

export default function NotificacoesSino({ onAbrir }: { onAbrir: (n: GestaoNotificacao) => void }) {
  const { data: notifs = [] } = useNotificacoes();
  const marcar = useMarcarLida();
  const [aberto, setAberto] = useState(false);
  const naoLidas = notifs.filter((n) => !n.lida).length;

  return (
    <div className="relative">
      <button type="button" onClick={() => setAberto((v) => !v)} title="Notificações" className="relative z-40 rounded-lg border border-gray-200 bg-white p-2 text-gray-600 hover:bg-gray-50">
        <Bell className="size-4" />
        {naoLidas > 0 && <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white">{naoLidas > 9 ? "9+" : naoLidas}</span>}
      </button>
      {aberto && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setAberto(false)} />
          <div className="absolute right-0 z-40 mt-2 w-80 rounded-xl border border-gray-200 bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
              <span className="text-sm font-semibold text-gray-700">Notificações</span>
              {naoLidas > 0 && (
                <button type="button" onClick={() => marcar.mutate({ todas: true })} className="inline-flex items-center gap-1 text-xs text-verde-primary hover:underline">
                  <CheckCheck className="size-3.5" /> Marcar todas
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifs.length === 0 && <p className="px-3 py-6 text-center text-sm text-gray-400">Sem notificações.</p>}
              {notifs.map((n) => (
                <button key={n.id} type="button" onClick={() => { marcar.mutate({ id: n.id }); setAberto(false); onAbrir(n); }}
                  className={`flex w-full items-start gap-2 border-b border-gray-50 px-3 py-2 text-left hover:bg-gray-50 ${n.lida ? "" : "bg-verde-light/30"}`}>
                  <span className="text-sm">{ICONE_TIPO[n.tipo] ?? "•"}</span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${n.lida ? "text-gray-600" : "font-medium text-gray-800"}`}>{n.titulo}</p>
                    <p className="text-[11px] text-gray-400">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}</p>
                  </div>
                  {!n.lida && <span className="mt-1 size-2 shrink-0 rounded-full bg-verde-primary" />}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
