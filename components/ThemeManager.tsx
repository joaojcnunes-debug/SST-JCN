"use client";

import { useEffect } from "react";
import { useTema } from "@/lib/store";

/**
 * Mantém a classe `.dark` no <html> em sincronia com o tema escolhido, e força
 * o CLARO durante a impressão nativa (Ctrl+P / window.print()), restaurando
 * depois — os documentos impressos devem sair sempre claros.
 *
 * O flash inicial já é evitado pelo script de pré-hidratação em app/layout.tsx;
 * aqui só reagimos às MUDANÇAS de tema e à impressão.
 */
export default function ThemeManager() {
  const tema = useTema((s) => s.tema);

  useEffect(() => {
    const root = document.documentElement;
    if (tema === "dark") {
      root.classList.add("dark");
      root.style.colorScheme = "dark";
    } else {
      root.classList.remove("dark");
      root.style.colorScheme = "light";
    }
  }, [tema]);

  useEffect(() => {
    const root = document.documentElement;
    let tinhaDark = false;
    const antes = () => {
      tinhaDark = root.classList.contains("dark");
      if (tinhaDark) {
        root.classList.remove("dark");
        root.style.colorScheme = "light";
      }
    };
    const depois = () => {
      if (tinhaDark) {
        root.classList.add("dark");
        root.style.colorScheme = "dark";
      }
    };
    window.addEventListener("beforeprint", antes);
    window.addEventListener("afterprint", depois);
    return () => {
      window.removeEventListener("beforeprint", antes);
      window.removeEventListener("afterprint", depois);
    };
  }, []);

  return null;
}
