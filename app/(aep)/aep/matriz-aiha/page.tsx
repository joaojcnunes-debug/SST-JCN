"use client";

// Matriz AIHA (módulo AEP, 2026-10-05): página própria só com a explicação
// técnica e normativa da matriz aplicada à Ergonomia Organizacional. O mesmo
// texto vai para o laudo pelo capítulo editável do Texto Padrão da AEP.

import ExplicacaoMatrizAiha from "@/components/aep/ExplicacaoMatrizAiha";

export default function MatrizAihaPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <ExplicacaoMatrizAiha fixo />
    </div>
  );
}
