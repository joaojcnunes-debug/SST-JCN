"use client";

// Sinalização de Fatores Psicossociais (módulo AEP) — lista de empresas. A
// explicação da matriz AIHA fica na página Matriz AIHA do menu lateral.

import SinalizacaoEmpresasLista from "@/components/aep/SinalizacaoEmpresasLista";

export default function SinalizacaoPsicossocialPage() {
  return <SinalizacaoEmpresasLista basePath="/sinalizacao-psicossocial" />;
}
