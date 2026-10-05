"use client";

// Sinalização de Fatores Psicossociais (módulo AEP) — lista de empresas.

import SinalizacaoEmpresasLista from "@/components/aep/SinalizacaoEmpresasLista";
import ExplicacaoMatrizAiha from "@/components/aep/ExplicacaoMatrizAiha";

export default function SinalizacaoPsicossocialPage() {
  return <SinalizacaoEmpresasLista basePath="/sinalizacao-psicossocial" extra={<ExplicacaoMatrizAiha />} />;
}
