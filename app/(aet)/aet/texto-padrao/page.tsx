"use client";

// Unificado no editor compartilhado (grava em textos_padrao, que é a tabela
// que o PDF do AET lê). Antes esta página gravava em aet_textos_padrao —
// tabela que o laudo não lia, então as edições não apareciam no PDF (e o
// laudo ficava sem os capítulos padrão). Conteúdo migrado em v79.
// (O botão de template inicial NR-17 da versão antiga foi descontinuado; os
// capítulos já existentes foram preservados na migração.)
import TextoPadraoEditor from "@/components/textos-padrao/TextoPadraoEditor";

export default function AetTextoPadraoPage() {
  return <TextoPadraoEditor modulo="aet" />;
}
