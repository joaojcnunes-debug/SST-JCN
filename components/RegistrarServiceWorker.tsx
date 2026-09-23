"use client";

import { useEffect } from "react";

/**
 * Registra o service worker (`public/sw.js`) — o que faz o app abrir sem
 * internet. Não renderiza nada.
 *
 * TRÊS GUARDAS, cada uma por um motivo diferente:
 *
 * 1. ELECTRON. O mesmo código roda no app desktop, onde a atualização é do
 *    electron-updater (ver `UpdateBanner`). Um service worker ali serviria
 *    versão de arquivo em cache por cima do que o instalador acabou de trocar —
 *    duas correntes de atualização brigando pelo mesmo app.
 *
 * 2. DESENVOLVIMENTO. Em `next dev` os chunks não têm hash estável; cachear
 *    isso faz o HMR servir código velho e o dev caçar fantasma.
 *
 * 3. SUPORTE. Sem HTTPS (ou localhost) `navigator.serviceWorker` nem existe.
 *
 * A versão vai na query porque a URL do script é a identidade do worker: subiu
 * versão nova, o browser vê `/sw.js?v=0.3.523` como outro arquivo e atualiza.
 * Sem isso, `sw.js` sem hash ficaria preso no cache HTTP do próprio browser.
 */
export default function RegistrarServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined") return;
    if ((window as Window & { electronAPI?: { isElectron?: boolean } }).electronAPI?.isElectron) return;
    if (!("serviceWorker" in navigator)) return;

    const versao = process.env.NEXT_PUBLIC_APP_VERSION ?? "0";
    navigator.serviceWorker.register(`/sw.js?v=${versao}`, { scope: "/" }).catch((erro) => {
      // Falha aqui não pode derrubar nada: sem service worker o app continua
      // funcionando normalmente, só perde o "abre offline". Registrar em log e
      // seguir é o comportamento certo — inclusive quando o CF Access devolve o
      // HTML de login no lugar do script.
      console.warn("[sw] registro falhou:", erro);
    });
  }, []);

  return null;
}
