"use client";

import TextoPadraoEditor from "@/components/textos-padrao/TextoPadraoEditor";

/**
 * Texto Padrão do DRPS — editor canônico unificado.
 *
 * Consolidado (jun/2026): esta página usa o MESMO editor do /config
 * (TextoPadraoEditor, tabela `textos_padrao` modulo=psicossocial, modo
 * lista única igual ao AEP). Antes havia um editor paralelo aqui que gravava
 * em `drps_texto_padrao` — tabela que NÃO alimentava o laudo/PDF e gerava
 * confusão. Agora há um só editor e uma só fonte de verdade.
 */
export default function TextoPadraoDrpsPage() {
  return (
    <div className="space-y-4">
      <TextoPadraoEditor modulo="psicossocial" />
    </div>
  );
}
