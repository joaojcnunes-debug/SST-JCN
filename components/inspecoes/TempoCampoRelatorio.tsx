"use client";

// Tempo de campo no relatório da inspeção (0.3.315, banco v365, 19/11/2026 — etapa 2 pedida pelo João): o mesmo painel,
// só para consulta (sem Iniciar/Pausar — isso é na tela da inspeção). A supervisão vê o de todos e corrige a sessão,
// com justificativa; o técnico vê o próprio. Só aparece quando há sessão de campo.

import PainelTempoDocumento from "@/components/inspecoes/PainelTempoDocumento";
import { useSessoesCampo } from "@/lib/hooks/useCampoSessoes";
import { ehTecnicoDeCampo } from "@/lib/inspecoes/campo";

export default function TempoCampoRelatorio({
  idInspecao,
  inspecao,
  responsaveis,
  usuario,
  supervisor,
}: {
  idInspecao: string;
  inspecao: { status?: string | null; responsavel?: string | null; usuario?: string | null; concluida_em?: string | null };
  responsaveis: readonly { id_usuario?: string | null; tecnico_responsavel?: string | null }[];
  usuario: { id_usuario?: string | null; nome?: string | null; email?: string | null } | null | undefined;
  supervisor: boolean;
}) {
  const { data: todas = [] } = useSessoesCampo(idInspecao);
  const tecnico = ehTecnicoDeCampo(inspecao, responsaveis, usuario);
  const sessoes = supervisor ? todas : tecnico ? todas.filter((s) => s.id_usuario === usuario?.id_usuario) : [];
  if (sessoes.length === 0) return null;
  return (
    <div className="no-print mt-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Tempo de campo</p>
      <PainelTempoDocumento
        fonte="campo"
        idInspecao={idInspecao}
        sessoes={sessoes}
        idUsuario={usuario?.id_usuario}
        podeApontar={false}
        podeCorrigir={supervisor}
        concluidaEm={inspecao.concluida_em}
        entregue={inspecao.status === "CONCLUIDA"}
      />
    </div>
  );
}
