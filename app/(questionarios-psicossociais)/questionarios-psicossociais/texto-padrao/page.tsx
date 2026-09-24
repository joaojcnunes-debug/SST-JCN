"use client";

import TextoPadraoEditor from "@/components/textos-padrao/TextoPadraoEditor";

/**
 * Texto Padrão da QAP (v226) — o mesmo editor unificado do DRPS e do /config,
 * tabela `textos_padrao` modulo='qps'. É aqui que nascem capa, introdução e
 * metodologia do laudo (as seções do sistema já vêm semeadas pela v226).
 */
export default function TextoPadraoQpsPage() {
  return (
    <div className="space-y-4">
      <TextoPadraoEditor modulo="qps" />
    </div>
  );
}
