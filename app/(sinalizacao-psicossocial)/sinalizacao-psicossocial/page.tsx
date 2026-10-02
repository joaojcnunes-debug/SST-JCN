"use client";

import { useState } from "react";
import { AlertTriangle, Brain } from "lucide-react";
import { useAepRelatorios } from "@/lib/hooks/useAep";
import EmpresaSelect from "@/components/empresas/EmpresaSelect";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import type { AepChecklistOrganizacional } from "@/lib/supabase/types";
import { COR_NIVEL_AIHA } from "@/lib/aep/aiha-organizacional";

// Ordem de gravidade dos níveis da matriz (AIHA) — o mais grave primeiro.
const PESO_NIVEL: Record<string, number> = { "Muito Alto": 5, Alto: 4, Moderado: 3, Baixo: 2, Trivial: 1 };

interface AlertaFator {
  label: string;
  /** Nível na matriz AIHA (AEP de 2026-10-02 em diante; antes disso, ausente). */
  nivel?: string;
  probabilidade?: string;
  severidade?: string;
}

const ITENS_ORG: { key: keyof AepChecklistOrganizacional; label: string }[] = [
  { key: "assedio",               label: "Assédio de qualquer natureza no trabalho" },
  { key: "falta_suporte",         label: "Falta de suporte / apoio no trabalho" },
  { key: "gestao_mudancas",       label: "Má gestão de mudanças organizacionais" },
  { key: "clareza_papel",         label: "Baixa clareza de papel / função" },
  { key: "recompensas",           label: "Baixas recompensas e reconhecimento" },
  { key: "baixo_controle",        label: "Baixo controle no trabalho / Falta de autonomia" },
  { key: "justica_organizacional",label: "Baixa justiça organizacional" },
  { key: "eventos_traumaticos",   label: "Eventos violentos ou traumáticos" },
  { key: "subcarga",              label: "Baixa demanda no trabalho (Subcarga)" },
  { key: "sobrecarga",            label: "Excesso de demandas no trabalho (Sobrecarga)" },
  { key: "maus_relacionamentos",  label: "Maus relacionamentos no local de trabalho" },
  { key: "comunicacao_dificil",   label: "Trabalho em condições de difícil comunicação" },
  { key: "trabalho_remoto",       label: "Trabalho remoto e isolado" },
];

const LABEL_MAP = Object.fromEntries(ITENS_ORG.map(({ key, label }) => [key, label]));

function severidadeChip(count: number) {
  if (count >= 5) return "bg-red-100 text-red-700 border-red-200";
  if (count >= 3) return "bg-orange-100 text-orange-700 border-orange-200";
  return "bg-yellow-100 text-yellow-700 border-yellow-200";
}

export default function SinalizacaoPsicossocialPage() {
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const { data: relatorios = [], isLoading } = useAepRelatorios(empresaId);

  const dados = relatorios
    .map((rel) => {
      const empresa = rel.empresas as { nome_empresa?: string } | null;
      const setoresComAlerta = rel.setores
        .map((setor) => {
          const cl = setor.checklist_organizacional as unknown as Record<string, string>;
          const alertas: AlertaFator[] = ITENS_ORG
            .filter(({ key }) => cl?.[key] === "sim")
            .map(({ key }) => {
              const a = setor.aiha_organizacional?.[key];
              return { label: LABEL_MAP[key], nivel: a?.nivel, probabilidade: a?.probabilidade, severidade: a?.severidade };
            })
            .sort((x, y) => (PESO_NIVEL[y.nivel ?? ""] ?? 0) - (PESO_NIVEL[x.nivel ?? ""] ?? 0));
          const pior = alertas[0]?.nivel;
          return { id: setor.id, nome: setor.nome_setor || "Setor sem nome", alertas, pior };
        })
        .filter((s) => s.alertas.length > 0);

      return {
        id: rel.id_relatorio,
        empresa: empresa?.nome_empresa ?? "Empresa não informada",
        data: rel.data_elaboracao,
        setores: setoresComAlerta,
        totalAlertas: setoresComAlerta.reduce((a, s) => a + s.alertas.length, 0),
      };
    })
    .filter((d) => d.setores.length > 0);

  const totalEmpresas = dados.length;
  const totalSetores  = dados.reduce((a, d) => a + d.setores.length, 0);
  const totalAlertas  = dados.reduce((a, d) => a + d.totalAlertas, 0);
  const totalAltos    = dados.reduce(
    (a, d) => a + d.setores.reduce((b, s) => b + s.alertas.filter((x) => x.nivel === "Alto" || x.nivel === "Muito Alto").length, 0),
    0,
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Sinalização de Fatores Psicossociais</h1>
          <p className="text-sm text-gray-500">
            Empresas e setores com riscos organizacionais identificados nas triagens AEP, com o nível na matriz AIHA — priorize os mais graves para aplicação do questionário
          </p>
        </div>
        <div className="w-60">
          <EmpresaSelect value={empresaId} onChange={setEmpresaId} placeholder="Todas as empresas" modulo="aep" allowAll />
        </div>
      </div>

      {/* Stats */}
      {!isLoading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Empresas c/ alertas",  value: totalEmpresas, color: "bg-indigo-50 border-indigo-200 text-indigo-700" },
            { label: "Setores afetados",      value: totalSetores,  color: "bg-violet-50 border-violet-200 text-violet-700" },
            { label: "Alertas psicossociais", value: totalAlertas,  color: "bg-red-50 border-red-200 text-red-700" },
            { label: "Fatores Alto / Muito Alto (AIHA)", value: totalAltos, color: "bg-pink-50 border-pink-200 text-pink-700" },
          ].map(({ label, value, color }) => (
            <div key={label} className={`rounded-xl border p-4 text-center ${color}`}>
              <p className="text-3xl font-bold">{value}</p>
              <p className="text-xs font-medium mt-1">{label}</p>
            </div>
          ))}
        </div>
      )}

      {isLoading && <LoadingSkeleton rows={3} />}

      {!isLoading && dados.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
          <Brain className="mx-auto size-8 text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">Nenhum fator psicossocial sinalizado nas análises.</p>
        </div>
      )}

      {/* Cards por empresa */}
      <div className="space-y-4">
        {dados.map((d) => (
          <div key={d.id} className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            {/* Cabeçalho empresa */}
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/60 px-5 py-3">
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle className="size-4 shrink-0 text-indigo-500" />
                <span className="font-semibold text-gray-900 truncate">{d.empresa}</span>
                {d.data && (
                  <span className="text-xs text-gray-400 shrink-0">
                    {new Date(d.data).toLocaleDateString("pt-BR")}
                  </span>
                )}
              </div>
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${severidadeChip(d.totalAlertas)}`}>
                {d.totalAlertas} alerta{d.totalAlertas > 1 ? "s" : ""}
              </span>
            </div>

            {/* Setores */}
            <div className="divide-y divide-gray-100">
              {d.setores.map((setor) => (
                <div key={setor.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-start">
                  <div className="flex items-center gap-2 shrink-0 min-w-[180px]">
                    <span className={`inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold border ${severidadeChip(setor.alertas.length)}`}>
                      {setor.alertas.length}
                    </span>
                    <span className="text-sm font-medium text-gray-800">{setor.nome}</span>
                    {setor.pior && (
                      <span
                        className="rounded-full border px-2 py-0.5 text-[10px] font-bold"
                        style={{
                          backgroundColor: COR_NIVEL_AIHA[setor.pior as keyof typeof COR_NIVEL_AIHA]?.bg,
                          color: COR_NIVEL_AIHA[setor.pior as keyof typeof COR_NIVEL_AIHA]?.cor,
                          borderColor: COR_NIVEL_AIHA[setor.pior as keyof typeof COR_NIVEL_AIHA]?.borda,
                        }}
                        title="Maior nível AIHA entre os fatores do setor"
                      >
                        {setor.pior}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {setor.alertas.map((a) => {
                      const c = a.nivel ? COR_NIVEL_AIHA[a.nivel as keyof typeof COR_NIVEL_AIHA] : undefined;
                      return (
                        <span
                          key={a.label}
                          className="rounded-full border px-2.5 py-0.5 text-[11px] font-medium"
                          style={
                            c
                              ? { backgroundColor: c.bg, color: c.cor, borderColor: c.borda }
                              : { backgroundColor: "#eef2ff", color: "#4338ca", borderColor: "#c7d2fe" }
                          }
                          title={
                            a.nivel
                              ? "Probabilidade: " + a.probabilidade + " · Severidade: " + a.severidade
                              : "AEP ainda sem classificação AIHA — abra e salve a análise"
                          }
                        >
                          {a.label}
                          {a.nivel && <strong className="ml-1">· {a.nivel}</strong>}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
