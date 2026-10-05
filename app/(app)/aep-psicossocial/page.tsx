"use client";

// AEP no menu do Painel SST (2026-10-02): a mesma lista da Sinalização de
// Fatores Psicossociais do módulo AEP, ao lado de Riscos Psicossociais.

import SinalizacaoEmpresasLista from "@/components/aep/SinalizacaoEmpresasLista";
import ExplicacaoMatrizAiha from "@/components/aep/ExplicacaoMatrizAiha";

export default function AepPsicossocialPage() {
  return (
    <SinalizacaoEmpresasLista
      basePath="/aep-psicossocial"
      titulo="AEP — Fatores Psicossociais"
      extra={<ExplicacaoMatrizAiha />}
    />
  );
}
