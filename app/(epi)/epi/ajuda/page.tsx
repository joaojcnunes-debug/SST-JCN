"use client";

export default function EpiAjudaPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Ajuda — Gestão de EPI</h1>
      <p className="text-sm text-gray-600">
        Este módulo gerencia os Equipamentos de Proteção Individual (EPI) por
        empresa: catálogo vinculado ao Certificado de Aprovação (CA), controle de
        estoque, entregas ao colaborador e histórico.
      </p>
      <p className="text-sm text-gray-600">
        O acesso é duplo: a equipe interna vê todas as empresas; o cliente, pela
        área do Portal, gerencia apenas o EPI da própria empresa (isolamento
        garantido por RLS). A transferência de estoque entre empresas é exclusiva
        da equipe interna.
      </p>
      <p className="text-sm text-gray-600">
        O módulo está sendo liberado por fases. Consulte a <strong>Visão geral</strong>{" "}
        para o roadmap.
      </p>
    </div>
  );
}
