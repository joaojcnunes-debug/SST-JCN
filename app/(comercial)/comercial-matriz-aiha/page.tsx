"use client";

// Matriz AIHA no módulo Comercial: a mesma explicação técnica e normativa, para
// o vendedor saber explicar ao cliente de onde vem a indicação de AET.

import ExplicacaoMatrizAiha from "@/components/aep/ExplicacaoMatrizAiha";

export default function ComercialMatrizAihaPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <ExplicacaoMatrizAiha fixo />
    </div>
  );
}
