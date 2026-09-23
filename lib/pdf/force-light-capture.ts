/**
 * Remove a classe `.dark` do <html> durante a captura/impressão de PDF a partir
 * do DOM ao vivo (Electron printToPDF, html-to-image) e devolve uma função que
 * restaura o estado anterior. Os PDFs/documentos devem sair SEMPRE claros.
 *
 * Os caminhos que usam `window.print()` já são cobertos pelo guard
 * `beforeprint`/`afterprint` do ThemeManager; use este helper nos caminhos que
 * NÃO disparam esses eventos.
 */
export function stripDarkForCapture(): () => void {
  if (typeof document === "undefined") return () => {};
  const root = document.documentElement;
  const tinhaDark = root.classList.contains("dark");
  const colorSchemeAnterior = root.style.colorScheme;
  if (tinhaDark) {
    root.classList.remove("dark");
    root.style.colorScheme = "light";
  }
  return () => {
    if (tinhaDark) {
      root.classList.add("dark");
      root.style.colorScheme = colorSchemeAnterior || "dark";
    }
  };
}
