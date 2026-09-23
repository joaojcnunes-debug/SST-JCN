"use client";

import { useEffect, useState, use } from "react";
import { Save } from "lucide-react";
import { useQpsAplicacao } from "@/lib/hooks/useQuestionarios";
import { useQpsRevisao, useQpsSalvarRevisao } from "@/lib/hooks/useQpsGestao";
import { useCanEdit } from "@/lib/hooks/useUsuario";
import { acoesObrigatoriasQps, EQUIPE_REVISAO } from "@/lib/qps/gestao";

/**
 * Revisão e Melhoria Contínua — espelho de `psicossocial/[idRelatorio]/revisao`
 * (v225, "igual ao DRPS"). Checklist e equipe são os do DRPS com o nome do
 * instrumento no texto (`acoesObrigatoriasQps`); os ids gravados são os mesmos.
 */

export default function RevisaoQpsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const canEdit = useCanEdit();
  const { data: ap } = useQpsAplicacao(id);
  const { data: revisao, isLoading } = useQpsRevisao(id);
  const salvar = useQpsSalvarRevisao();
  const acoes = acoesObrigatoriasQps();

  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [equipe, setEquipe] = useState<Record<string, boolean>>({});
  const [anotacoes, setAnotacoes] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    setChecklist(revisao?.checklist ?? {});
    setEquipe(revisao?.equipe ?? {});
    setAnotacoes(revisao?.anotacoes ?? "");
    setDirty(false);
  }, [revisao, isLoading]);

  function toggle(
    setter: (fn: (s: Record<string, boolean>) => Record<string, boolean>) => void,
    chave: string,
  ) {
    setter((s) => ({ ...s, [chave]: !s[chave] }));
    setDirty(true);
  }

  function onSalvar() {
    if (!ap) return;
    salvar.mutate(
      { id_aplicacao: id, checklist, equipe, anotacoes: anotacoes.trim() || null },
      { onSuccess: () => setDirty(false) },
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Revisão e Melhoria Contínua</h1>
        <p className="text-sm text-gray-600">
          {ap?.titulo ?? "Carregando..."} · checklist de ações recorrentes e equipe multidisciplinar.
        </p>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onSalvar}
          disabled={!canEdit || !dirty || salvar.isPending || !ap}
          className="inline-flex items-center gap-2 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-verde-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="size-4" />
          {salvar.isPending ? "Salvando..." : "Salvar Revisão"}
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Ações obrigatórias de revisão</h2>
        <div className="space-y-2">
          {acoes.map((a) => (
            <label
              key={a.id}
              className="flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={!!checklist[a.id]}
                onChange={() => toggle(setChecklist, a.id)}
                disabled={!canEdit}
                className="mt-0.5 rounded border-gray-300 text-verde-primary focus:ring-verde-primary/30 disabled:cursor-not-allowed"
              />
              <span className="text-sm text-gray-800">{a.texto}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Equipe multidisciplinar envolvida</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {EQUIPE_REVISAO.map((m) => (
            <label
              key={m.id}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={!!equipe[m.id]}
                onChange={() => toggle(setEquipe, m.id)}
                disabled={!canEdit}
                className="rounded border-gray-300 text-verde-primary focus:ring-verde-primary/30 disabled:cursor-not-allowed"
              />
              <span className="text-sm text-gray-800">{m.texto}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-gray-900">Anotações</h2>
        <textarea
          value={anotacoes}
          onChange={(e) => {
            setAnotacoes(e.target.value);
            setDirty(true);
          }}
          disabled={!canEdit}
          rows={6}
          placeholder="Registros, observações, próximos passos..."
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30 disabled:cursor-not-allowed disabled:bg-gray-50"
        />
      </div>
    </div>
  );
}
