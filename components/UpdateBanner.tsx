"use client";

import { useEffect, useState } from "react";
import { Download, RefreshCw, X } from "lucide-react";

const GH_RELEASES_URL =
  "https://github.com/joaojefferson-hash/Painel-SST--Chabra/releases/latest";

type UpdateState =
  | { status: "downloading"; version: string }
  | { status: "ready"; version: string };

export default function UpdateBanner() {
  const [update, setUpdate] = useState<UpdateState | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const api = (window as Window & { electronAPI?: {
      onUpdateAvailable?: (cb: (info: { version: string }) => void) => void;
      onUpdateDownloaded?: (cb: (info: { version: string }) => void) => void;
    } }).electronAPI;
    if (!api) return;

    api.onUpdateAvailable?.((info) => {
      setUpdate({ status: "downloading", version: info.version });
      setDismissed(false);
    });

    api.onUpdateDownloaded?.((info) => {
      setUpdate({ status: "ready", version: info.version });
      setDismissed(false);
    });
  }, []);

  if (!update || dismissed) return null;

  const api = (window as Window & { electronAPI?: {
    openExternal?: (url: string) => void;
    installUpdate?: () => void;
  } }).electronAPI;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex w-80 flex-col gap-3 rounded-2xl bg-gray-900 p-4 text-white shadow-2xl">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold">
            {update.status === "ready"
              ? `v${update.version} pronta para instalar`
              : `v${update.version} disponível`}
          </p>
          <p className="mt-0.5 text-xs text-gray-400">
            {update.status === "ready"
              ? "Reinicie o app para aplicar a atualização."
              : "Baixando em segundo plano..."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="rounded p-0.5 text-gray-400 hover:text-white"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex gap-2">
        {update.status === "ready" && (
          <button
            type="button"
            onClick={() => api?.installUpdate?.()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold hover:bg-green-500"
          >
            <RefreshCw className="size-3.5" />
            Reiniciar agora
          </button>
        )}
        <button
          type="button"
          onClick={() => api?.openExternal?.(GH_RELEASES_URL)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/20"
        >
          <Download className="size-3.5" />
          Baixar manualmente
        </button>
      </div>
    </div>
  );
}
