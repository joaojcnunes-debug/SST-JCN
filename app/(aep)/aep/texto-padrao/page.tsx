"use client";

// Unificado no editor compartilhado (grava em textos_padrao, que é a tabela
// que o PDF do AEP lê). Antes esta página tinha um editor próprio que gravava
// em aep_textos_padrao — tabela que o laudo não lia, então as edições não
// apareciam no PDF. Conteúdo migrado em v79.
import TextoPadraoEditor from "@/components/textos-padrao/TextoPadraoEditor";

export default function AepTextoPadraoPage() {
  return <TextoPadraoEditor modulo="aep" />;
}
