// Re-exporta gerarPdfBase como gerarPdfDaPagina para manter compatibilidade
// com código existente. Todos os novos usos devem importar gerarPdfBase.
export { gerarPdfBase as gerarPdfDaPagina } from "./gerarPdfBase";
