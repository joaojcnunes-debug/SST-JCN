"use client";

// Tempo de campo na tela da inspeção (0.3.314, banco v364, 19/11/2026 — pedido do João). É o MESMO painel do tempo do
// documento no relatório (PainelTempoDocumento, fonte "campo"): faixa com a situação e o cronômetro, Iniciar/Retomar
// e Pausar com motivo, indicadores (com o deslocamento à parte), Detalhes e o "Levar para o canto". O técnico vê o
// próprio tempo; a supervisão vê o de todos. Regras em lib/inspecoes/campo.ts.

import PainelTempoDocumento from "@/components/inspecoes/PainelTempoDocumento";
import type { CampoDaInspecao } from "@/lib/hooks/useCampoSessoes";

export default function TempoCampo({
  idInspecao,
  campo,
  idUsuario,
  supervisor,
  podeEditar,
  concluidaEm,
}: {
  idInspecao: string;
  campo: CampoDaInspecao;
  idUsuario: string | null | undefined;
  supervisor: boolean;
  podeEditar: boolean;
  concluidaEm: string | null | undefined;
}) {
  if (campo.carregando || (!campo.tecnico && !supervisor)) return null;
  // Concluída e sem nenhuma sessão: nada a mostrar.
  if (campo.concluida && campo.sessoes.length === 0) return null;
  const sessoes = supervisor ? campo.sessoes : campo.sessoes.filter((s) => s.id_usuario === idUsuario);
  return (
    <PainelTempoDocumento
      fonte="campo"
      idInspecao={idInspecao}
      sessoes={sessoes}
      idUsuario={idUsuario}
      podeApontar={campo.tecnico && podeEditar && !campo.concluida}
      // 0.3.315 (banco v365): o supervisor corrige a sessão de campo, com justificativa (como no documento).
      podeCorrigir={supervisor}
      concluidaEm={concluidaEm}
      entregue={campo.concluida}
    />
  );
}
