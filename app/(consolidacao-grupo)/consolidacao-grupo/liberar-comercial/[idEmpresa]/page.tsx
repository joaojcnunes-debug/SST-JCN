import { redirect } from "next/navigation";

// A liberação para o Comercial virou etapa da Conciliação (0.3.238); o endereço antigo leva para lá.
export default async function AtendimentoComercialPage({ params }: { params: Promise<{ idEmpresa: string }> }) {
  const { idEmpresa } = await params;
  redirect(`/consolidacao-grupo/conciliacao/${idEmpresa}#etapa-intervencoes`);
}
