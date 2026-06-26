"use client";

import { useEffect, useRef, useState } from "react";
import { Download, RefreshCw, X, Loader2 } from "lucide-react";

type UpdateState =
  | { status: "available"; version: string }
  | { status: "ready"; version: string }
  | { status: "downloading"; version: string; percent: number }
  | { status: "installing"; version: string }
  | { status: "error"; version: string; message: string };

type ElectronAPI = {
  onUpdateAvailable?: (cb: (info: { version: string }) => void) => void;
  onUpdateDownloaded?: (cb: (info: { version: string }) => void) => void;
  onDownloadProgress?: (cb: (info: { percent: number }) => void) => void;
  getInstallerUrl?: () => Promise<{ success: boolean; url?: string; error?: string }>;
  downloadUpdateFile?: (url: string) => Promise<{ success: boolean; path?: string; error?: string }>;
  runInstallerFile?: (path: string) => Promise<{ success: boolean; error?: string }>;
  installUpdate?: () => void;
  getVersion?: () => Promise<string>;
  openExternal?: (url: string) => void;
};

function getAPI(): ElectronAPI | undefined {
  return (window as Window & { electronAPI?: ElectronAPI }).electronAPI;
}

function isNewer(remote: string, current: string): boolean {
  const [rMaj, rMin, rPatch] = remote.split(".").map(Number);
  const [cMaj, cMin, cPatch] = current.split(".").map(Number);
  return (
    rMaj > cMaj ||
    (rMaj === cMaj && rMin > cMin) ||
    (rMaj === cMaj && rMin === cMin && rPatch > cPatch)
  );
}

export default function UpdateBanner() {
  const [update, setUpdate] = useState<UpdateState | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const notifiedVersion = useRef<string | null>(null);

  function notify(version: string) {
    if (notifiedVersion.current === version) return;
    notifiedVersion.current = version;
    setUpdate({ status: "available", version });
    setDismissed(false);
  }

  useEffect(() => {
    const api = getAPI();
    if (!api) return;

    // Escuta eventos vindos do processo principal (Electron main.ts)
    api.onUpdateAvailable?.((info) => notify(info.version));
    api.onUpdateDownloaded?.((info) => {
      setUpdate({ status: "ready", version: info.version });
      setDismissed(false);
    });
    api.onDownloadProgress?.((info) => {
      setUpdate((prev) =>
        prev ? { status: "downloading", version: prev.version, percent: info.percent } : prev
      );
    });

    // Verificação direta via GitHub API no renderer — funciona mesmo que o
    // evento IPC do main process não chegue (app aberto antes do release)
    async function checkGitHub() {
      try {
        const currentVersion = await api!.getVersion?.();
        if (!currentVersion) return;
        const resp = await fetch(
          "https://api.github.com/repos/joaojcnunes-debug/SST-JCN/releases/latest",
          { headers: { Accept: "application/vnd.github.v3+json" } }
        );
        if (!resp.ok) return;
        const release = (await resp.json()) as { tag_name: string };
        const remoteVersion = release.tag_name.replace(/^v/, "");
        if (isNewer(remoteVersion, currentVersion)) notify(remoteVersion);
      } catch {
        // silencioso — sem internet ou rate limit
      }
    }

    // Verifica 8s após montar (dá tempo do app carregar)
    const t1 = setTimeout(checkGitHub, 8_000);
    // Verifica a cada 30 minutos
    const t2 = setInterval(checkGitHub, 30 * 60 * 1000);

    return () => {
      clearTimeout(t1);
      clearInterval(t2);
    };
  }, []);

  if (!update || dismissed) return null;

  async function handleDownload() {
    if (!update) return;
    const api = getAPI();

    if (!api?.getInstallerUrl || !api?.downloadUpdateFile) {
      setUpdate({ status: "error", version: update.version, message: "Versão instalada muito antiga — baixe manualmente." });
      return;
    }

    setUpdate({ status: "downloading", version: update.version, percent: 0 });

    const urlResult = await api.getInstallerUrl();
    if (!urlResult?.success || !urlResult.url) {
      console.error("[UpdateBanner] getInstallerUrl falhou:", urlResult?.error);
      setUpdate({ status: "error", version: update.version, message: urlResult?.error ?? "Falha ao obter URL do instalador." });
      return;
    }

    const result = await api.downloadUpdateFile(urlResult.url);
    if (!result?.success || !result.path) {
      console.error("[UpdateBanner] downloadUpdateFile falhou:", result?.error);
      setUpdate({ status: "error", version: update.version, message: result?.error ?? "Falha no download." });
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
              : update.status === "error"
              ? `Erro ao atualizar`
              : `v${update.version} disponível`}
          </p>
          <p className="mt-0.5 text-xs text-gray-400">
            {update.status === "ready"
              ? "Reinicie o app para aplicar a atualização."
              : update.status === "downloading"
              ? "Aguarde, isso pode levar alguns minutos."
              : update.status === "installing"
              ? "O instalador abrirá em instantes."
              : update.status === "error"
              ? update.message
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
      {(update.status === "available" || update.status === "ready" || update.status === "error") && (
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
          {update.status === "error" && (
            <button
              type="button"
              onClick={() => getAPI()?.openExternal?.("https://github.com/joaojcnunes-debug/SST-JCN/releases/latest")}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gray-700 px-3 py-2 text-xs font-semibold hover:bg-gray-600"
            >
              <Download className="size-3.5" />
              Baixar manualmente
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
