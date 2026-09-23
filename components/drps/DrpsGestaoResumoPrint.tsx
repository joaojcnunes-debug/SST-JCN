"use client";

import {
  useDrpsMonitoramento,
  useDrpsPlanoMedidas,
  useDrpsRevisao,
} from "@/lib/hooks/useDrps";
import { calcularResumoGestao } from "@/lib/drps/gestao";
import GestaoResumoPrint from "@/components/gestao-psicossocial/GestaoResumoPrint";

/**
 * Página executiva impressa: indicadores consolidados das 3 frentes da gestão
 * (Medidas / Monitoramento / Revisão) num quadro só. Pensada pra entrar logo
 * após a Conclusão Geral e antes do detalhamento de cada frente.
 *
 * v226: o quadro em si mora em `components/gestao-psicossocial/GestaoResumoPrint`
 * (a QAP imprime o mesmo); aqui ficam só os hooks do DRPS.
 */
export default function DrpsGestaoResumoPrint({
  idRelatorio,
  anoMedidas,
  numero,
}: {
  idRelatorio: string;
  anoMedidas?: number;
  numero?: number;
}) {
  const ano = anoMedidas ?? new Date().getFullYear();
  const { data: planoDB } = useDrpsPlanoMedidas(idRelatorio, ano);
  const { data: monitoramentos = [] } = useDrpsMonitoramento(idRelatorio);
  const { data: revisao } = useDrpsRevisao(idRelatorio);
  const resumo = calcularResumoGestao({
    planoDB,
    monitoramentos,
    revisaoDB: revisao,
  });
  return <GestaoResumoPrint resumo={resumo} ano={ano} numero={numero} />;
}
