"use client";

import { useParams } from "next/navigation";
import SinalizacaoEmpresaDetalhe from "@/components/aep/SinalizacaoEmpresaDetalhe";

export default function AepPsicossocialEmpresaPage() {
  const { idEmpresa } = useParams<{ idEmpresa: string }>();
  return <SinalizacaoEmpresaDetalhe idEmpresa={decodeURIComponent(idEmpresa)} basePath="/aep-psicossocial" />;
}
