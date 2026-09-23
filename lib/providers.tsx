"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider, QueryCache } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import toast from "react-hot-toast";
import { mensagemErro } from "@/lib/errors";
import ThemeManager from "@/components/ThemeManager";

export default function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error, query) => {
            // Queries best-effort (ex.: assinar URL de mídia) marcam-se com
            // meta.silent — uma falha não deve poluir a tela com toast de erro
            // (a imagem só faz fallback). Ver useSignedUrl.
            if (query.meta?.silent) return;
            toast.error(mensagemErro(error, "Não foi possível carregar os dados."));
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: 10 * 60 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={client}>
      <ThemeManager />
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: {
            borderRadius: "10px",
            fontSize: "14px",
            padding: "12px 16px",
          },
          // O toast é montado fora da árvore da página (portal no <body>), então
          // nenhuma classe do shim o alcança: as cores vão inline. Os pares
          // --toast-* têm o hexadecimal EXATO de hoje no tema claro, então quem
          // nunca ligar o escuro não vê diferença nenhuma.
          success: {
            iconTheme: { primary: "#0ea5e9", secondary: "#fff" },
            style: {
              background: "var(--toast-ok-bg)",
              color: "var(--toast-ok-tx)",
              border: "1px solid var(--toast-ok-bd)",
            },
          },
          error: {
            iconTheme: { primary: "#D32F2F", secondary: "#fff" },
            style: {
              background: "var(--toast-erro-bg)",
              color: "var(--toast-erro-tx)",
              border: "1px solid var(--toast-erro-bd)",
            },
          },
        }}
      />
    </QueryClientProvider>
  );
}
