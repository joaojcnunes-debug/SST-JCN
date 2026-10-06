"use client";

// Checklist de gestão da AEP (Fase 2, 2026-10-06). Respondido uma vez por
// AEP, com gestor/RH, por observação ou documento — não depende dos
// trabalhadores. "Não existe" e "Existe, sem evidência" viram fonte geradora
// dos fatores mapeados; "Existe e evidenciado" vira medida de controle
// existente. Não muda a matriz AIHA. Regras em lib/aep/checklist-gestao.ts.
// Usado na rota /aep/[id]/gestao e na aba AEP da inspeção.

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { useAepRelatorio, useSalvarAep } from "@/lib/hooks/useAep";
import { useCanEdit } from "@/lib/hooks/useUsuario";
import { useUserStore } from "@/lib/store";
import { registrarAuditoria } from "@/lib/auditoria/registrar";
import { EditorSkeleton } from "@/components/ui/PageSkeletons";
import { ITENS_ORGANIZACIONAL } from "@/lib/aep/checklist-itens";
import {
  ITENS_GESTAO,
  ORIGENS_GESTAO,
  RESPOSTAS_GESTAO,
  normalizarChecklistGestao,
  respondidosGestao,
  type ChecklistGestao,
  type OrigemGestao,
  type RespostaGestao,
  type RespostaItemGestao,
} from "@/lib/aep/checklist-gestao";
import { cn, fmtData } from "@/lib/utils";

const COR: Record<RespostaGestao, string> = {
  existe_evidenciado: "bg-emerald-600 text-white",
  existe_sem_evidencia: "bg-amber-500 text-white",
  nao_existe: "bg-red-500 text-white",
  na: "bg-gray-400 text-white",
};

const rotuloFator = (k: string) => ITENS_ORGANIZACIONAL.find((i) => i.key === k)?.label ?? k;

export default function AepChecklistGestao({ idRelatorio }: { idRelatorio: string }) {
  const { data: rel, isLoading } = useAepRelatorio(idRelatorio);
  const salvar = useSalvarAep();
  const canEdit = useCanEdit();
  const user = useUserStore((s) => s.user);
  const [g, setG] = useState<ChecklistGestao>({ itens: {} });
  const [sujo, setSujo] = useState(false);
  const carregado = useRef<string | null>(null);

  useEffect(() => {
    if (!rel || carregado.current === idRelatorio) return;
    carregado.current = idRelatorio;
    setG(normalizarChecklistGestao(rel.checklist_gestao));
  }, [rel, idRelatorio]);

  const respondidos = useMemo(() => respondidosGestao(g), [g]);

  function setItem(codigo: string, patch: Partial<RespostaItemGestao>) {
    setG((prev) => ({
      ...prev,
      itens: { ...(prev.itens ?? {}), [codigo]: { resposta: "", ...(prev.itens?.[codigo] ?? {}), ...patch } },
    }));
    setSujo(true);
  }

  async function handleSalvar() {
    const novo: ChecklistGestao = {
      ...g,
      atualizado_em: new Date().toISOString(),
      atualizado_por: user?.nome ?? user?.email ?? null,
    };
    try {
      await salvar.mutateAsync({ id: idRelatorio, checklist_gestao: novo });
      setG(novo);
      setSujo(false);
      // Rastro de quem respondeu o quê (a auditoria é append-only).
      void registrarAuditoria({
        modulo: "aep",
        id_referencia: idRelatorio,
        acao: "checklist_gestao",
        descricao: `Checklist de gestão salvo (${respondidosGestao(novo)} de ${ITENS_GESTAO.length} itens)`,
        metadata: { itens: novo.itens },
      });
    } catch {
      // erro já tratado pelo hook
    }
  }

  if (isLoading) return <EditorSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Checklist de gestão</h1>
          <p className="max-w-3xl text-sm text-gray-500">
            Respondido uma vez por AEP, com o gestor ou o RH, por observação ou por documento — não depende dos
            trabalhadores. <strong>Não existe</strong> e <strong>Existe, sem evidência</strong> viram fonte geradora dos
            fatores ligados ao item; <strong>Existe e evidenciado</strong> vira medida de controle existente. Não altera a
            matriz AIHA. Documentos comprobatórios podem ir em Laudo › Anexos.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">
            {respondidos} de {ITENS_GESTAO.length} respondidos
            {g.atualizado_em && ` · salvo em ${fmtData(g.atualizado_em)}${g.atualizado_por ? ` por ${g.atualizado_por}` : ""}`}
          </span>
          {canEdit && (
            <button
              type="button"
              onClick={handleSalvar}
              disabled={salvar.isPending || !sujo}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-50"
            >
              {salvar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Salvar
            </button>
          )}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">Respondido com (gestor, RH…)</label>
        <input
          type="text"
          disabled={!canEdit}
          value={g.respondido_com ?? ""}
          onChange={(e) => {
            setG((p) => ({ ...p, respondido_com: e.target.value }));
            setSujo(true);
          }}
          placeholder="Ex.: Supervisora de RH e gerente de produção"
          className="w-full max-w-xl rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-gray-50"
        />
      </div>

      <div className="space-y-2">
        {ITENS_GESTAO.map((item) => {
          const r = g.itens?.[item.codigo];
          return (
            <div key={item.codigo} className="rounded-xl border border-gray-200 bg-white p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    <span className="mr-1.5 font-mono text-xs text-gray-500">{item.codigo}</span>
                    {item.label}
                  </p>
                  <p className="mt-0.5 text-[11px] text-gray-500">{item.fatores.map(rotuloFator).join(" · ")}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {RESPOSTAS_GESTAO.map((o) => (
                    <button
                      key={o.key}
                      type="button"
                      disabled={!canEdit}
                      title={o.label}
                      onClick={() => setItem(item.codigo, { resposta: r?.resposta === o.key ? "" : o.key })}
                      className={cn(
                        "rounded px-2 py-0.5 text-[11px] font-semibold transition",
                        r?.resposta === o.key ? COR[o.key] : "border border-gray-200 bg-white text-gray-500 hover:bg-gray-100",
                      )}
                    >
                      {o.curto}
                    </button>
                  ))}
                </div>
              </div>
              {r?.resposta && r.resposta !== "na" && (
                <div className="mt-2 grid gap-2 sm:grid-cols-[220px_1fr]">
                  <select
                    disabled={!canEdit}
                    value={r.origem ?? ""}
                    onChange={(e) => setItem(item.codigo, { origem: e.target.value as OrigemGestao | "" })}
                    className="rounded border border-gray-200 bg-white px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none disabled:bg-gray-50"
                  >
                    <option value="">Origem…</option>
                    {ORIGENS_GESTAO.map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={r.evidencia ?? ""}
                    onChange={(e) => setItem(item.codigo, { evidencia: e.target.value })}
                    placeholder="Evidência: nome do documento, data, responsável…"
                    className="rounded border border-gray-200 bg-white px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none disabled:bg-gray-50"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
