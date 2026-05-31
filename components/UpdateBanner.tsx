"use client";

import { useEffect, useState } from "react";
import { Download, RefreshCw, X, Loader2 } from "lucide-react";

type UpdateState =
  | { status: "available"; version: string }
  | { status: "ready"; version: string }
  | { status: "downloading"; version: string; percent: number }
  | { status: "installing"; version: string };

type ElectronAPI = {
  onUpdateAvailable?: (cb: (info: { version: string }) => void) => void;
  onUpdateDownloaded?: (cb: (info: { version: string }) => void) => void;
  onDownloadProgress?: (cb: (info: { percent: number }) => void) => void;
  downloadUpdateFile?: (version: string) => Promise<{ success: boolean; path?: string; error?: string }>;
  runInstallerFile?: (path: string) => Promise<{ success: boolean; error?: string }>;
  installUpdate?: () => void;
};

function getAPI(): ElectronAPI | undefined {
  return (window as Window & { electronAPI?: ElectronAPI }).electronAPI;
}

export default function UpdateBanner() {
  const [update, setUpdate] = useState<UpdateState | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const api = getAPI();
    if (!api) return;

    api.onUpdateAvailable?.((info) => {
      setUpdate({ status: "available", version: info.version });
      setDismissed(false);
    });

    api.onUpdateDownloaded?.((info) => {
      setUpdate({ status: "ready", version: info.version });
      setDismissed(false);
    });

    api.onDownloadProgress?.((info) => {
      setUpdate((prev) =>
        prev ? { status: "downloading", version: prev.version, percent: info.percent } : prev
      );
    });
  }, []);

  if (!update || dismissed) return null;

  async function handleDownload() {
    if (!update) return;
    const api = getAPI();
    if (!api?.downloadUpdateFile) return;

    setUpdate({ status: "downloading", version: update.version, percent: 0 });

    const result = await api.downloadUpdateFile(update.version);

    if (!result.success || !result.path) {
      // Fallback: abre GitHub no browser se o download falhar
      (window as Window & { electronAPI?: { openExternal?: (url: string) => void } })
        .electronAPI?.openExternal?.(
          `https://github.com/joaojefferson-hash/Painel-SST--Chabra/releases/latest`
        );
      setUpdate({ status: "available", version: update.version });
      return;
    }

    setUpdate({ status: "installing", version: update.version });
    await api.runInstallerFile?.(result.path);
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex w-80 flex-col gap-3 rounded-2xl bg-gray-900 p-4 text-white shadow-2xl">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold">
            {update.status === "ready"
              ? `v${update.version} pronta para instalar`
              : update.status === "downloading"
              ? `Baixando v${update.version}…`
              : update.status === "installing"
              ? `Iniciando instalador…`
              : `v${update.version} disponível`}
          </p>
          <p className="mt-0.5 text-xs text-gray-400">
            {update.status === "ready"
              ? "Reinicie o app para aplicar a atualização."
              : update.status === "downloading"
              ? "Aguarde, isso pode levar alguns minutos."
              : update.status === "installing"
              ? "O instalador abrirá em instantes."
              : "Clique para baixar e instalar automaticamente."}
          </p>
        </div>
        {update.status !== "downloading" && update.status !== "installing" && (
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="rounded p-0.5 text-gray-400 hover:text-white"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Barra de progresso */}
      {update.status === "downloading" && (
        <div className="flex flex-col gap-1">
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-300"
              style={{ width: `${update.percent}%` }}
            />
          </div>
          <p className="text-right text-xs text-gray-400">{update.percent}%</p>
        </div>
      )}

      {/* Botões de ação */}
      {(update.status === "available" || update.status === "ready") && (
        <div className="flex gap-2">
          {update.status === "ready" && (
            <button
              type="button"
              onClick={() => getAPI()?.installUpdate?.()}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold hover:bg-green-500"
            >
              <RefreshCw className="size-3.5" />
              Reiniciar agora
            </button>
          )}
          {update.status === "available" && (
            <button
              type="button"
              onClick={handleDownload}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold hover:bg-blue-500"
            >
              <Download className="size-3.5" />
              Baixar e instalar
            </button>
          )}
        </div>
      )}

      {/* Estado instalando */}
      {update.status === "installing" && (
        <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
          <Loader2 className="size-3.5 animate-spin" />
          Abrindo instalador…
        </div>
      )}
    </div>
  );
}
