"use client";

import { useEffect, useState, use } from "react";
import { Save } from "lucide-react";
import {
  useDrpsRelatorio,
  useDrpsRevisao,
  useDrpsSalvarRevisao,
} from "@/lib/hooks/useDrps";
import { useCanEdit } from "@/lib/hooks/useUsuario";
import {
  ACOES_OBRIGATORIAS,
  EQUIPE_REVISAO,
} from "@/lib/drps/gestao";

export default function RevisaoPage({
  params,
}: {
  params: Promise<{ idRelatorio: string }>;
}) {
  const { idRelatorio } = use(params);
  const canEdit = useCanEdit();
  const { data: relatorio } = useDrpsRelatorio(idRelatorio);
  const { data: revisao, isLoading } = useDrpsRevisao(idRelatorio);
  const salvar = useDrpsSalvarRevisao();

  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [equipe, setEquipe] = useState<Record<string, boolean>>({});
  const [anotacoes, setAnotacoes] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    setChecklist((revisao?.checklist as Record<string, boolean>) ?? {});
    setEquipe((revisao?.equipe as Record<string, boolean>) ?? {});
    setAnotacoes(revisao?.anotacoes ?? "");
    setDirty(false);
  }, [revisao, isLoading]);

  function toggle(
    setter: (
      fn: (s: Record<string, boolean>) => Record<string, boolean>
    ) => void,
    id: string
  ) {
    setter((s) => ({ ...s, [id]: !s[id] }));
    setDirty(true);
  }

  function onSalvar() {
    if (!relatorio) return;
    salvar.mutate(
      {
        id_relatorio: idRelatorio,
        id_empresa: relatorio.id_empresa,
        checklist,
        equipe,
        anotacoes: anotacoes.trim() || null,
      },
      { onSuccess: () => setDirty(false) }
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">
          Revisão e Melhoria Contínua
        </h1>
        <p className="text-sm text-gray-600">
          Checklist de ações recorrentes e equipe multidisciplinar.
        </p>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onSalvar}
          disabled={!canEdit || !dirty || salvar.isPending || !relatorio}
          className="inline-flex items-center gap-2 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-verde-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="size-4" />
          {salvar.isPending ? "Salvando..." : "Salvar Revisão"}
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">
          Ações obrigatórias de revisão
        </h2>
        <div className="space-y-2">
          {ACOES_OBRIGATORIAS.map((a) => (
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
        <h2 className="mb-3 text-sm font-semibold text-gray-900">
          Equipe multidisciplinar envolvida
        </h2>
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
