"use client";

// Matriz AIHA no menu do módulo Sinalização Psicossocial (2026-10-05): a
// explicação técnica e normativa em página própria, sempre aberta. Rota fora
// de /sinalizacao-psicossocial/ para não acender o "Painel de Alertas" junto.

import ExplicacaoMatrizAiha from "@/components/aep/ExplicacaoMatrizAiha";

export default function SinalizacaoMatrizAihaPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <ExplicacaoMatrizAiha fixo />
    </div>
  );
}
