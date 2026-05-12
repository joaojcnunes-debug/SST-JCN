"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import DrpsFiltro from "@/components/drps/DrpsFiltro";
import { useDrpsStore } from "@/lib/drps/store";
import {
  useDrpsRevisao,
  useDrpsSalvarRevisao,
} from "@/lib/hooks/useDrps";

const ACOES_OBRIGATORIAS: Array<{ id: string; texto: string }> = [
  {
    id: "reuniao_mensal",
    texto:
      "Reunião mensal com gestão e RH para análise dos indicadores psicossociais",
  },
  {
    id: "reaplicar_drps",
    texto: "Reaplicação do DRPS (conforme prazo definido no monitoramento)",
  },
  {
    id: "auditoria_interna",
    texto: "Auditoria interna do sistema de gestão psicossocial",
  },
  {
    id: "treinamento_lideres",
    texto:
      "Treinamento de líderes, gestores e RH sobre saúde mental no trabalho",
  },
  {
    id: "atualizar_pgr",
    texto: "Atualização do inventário de riscos psicossociais no PGR",
  },
];

const EQUIPE: Array<{ id: string; texto: string }> = [
  { id: "tst", texto: "Técnico de Segurança do Trabalho (TST)" },
  { id: "engseg", texto: "Engenheiro de Segurança" },
  { id: "medtrab", texto: "Médico do Trabalho" },
  { id: "enftrab", texto: "Enfermagem do Trabalho" },
  { id: "rh", texto: "Recursos Humanos (RH)" },
  { id: "compras", texto: "Compras (para recursos de programas)" },
  { id: "cipa", texto: "CIPA" },
  { id: "sipat", texto: "SIPAT" },
  { id: "ergonomista", texto: "Ergonomista" },
];

export default function DrpsRevisaoPage() {
  const idEmpresa = useDrpsStore((s) => s.idEmpresa);
  const { data: revisao, isLoading } = useDrpsRevisao(idEmpresa);
  const salvar = useDrpsSalvarRevisao();

  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [equipe, setEquipe] = useState<Record<string, boolean>>({});
  const [anotacoes, setAnotacoes] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!idEmpresa) {
      setChecklist({});
      setEquipe({});
      setAnotacoes("");
      setDirty(false);
      return;
    }
    if (isLoading) return;
    setChecklist((revisao?.checklist as Record<string, boolean>) ?? {});
    setEquipe((revisao?.equipe as Record<string, boolean>) ?? {});
    setAnotacoes(revisao?.anotacoes ?? "");
    setDirty(false);
  }, [revisao, idEmpresa, isLoading]);

  function toggle(
    setter: (fn: (s: Record<string, boolean>) => Record<string, boolean>) => void,
    id: string
  ) {
    setter((s) => ({ ...s, [id]: !s[id] }));
    setDirty(true);
  }

  function onSalvar() {
    if (!idEmpresa) return;
    salvar.mutate(
      {
        id_empresa: idEmpresa,
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
          Checklist de ações de revisão recorrente do diagnóstico
          psicossocial e equipe multidisciplinar envolvida.
        </p>
      </div>

      <DrpsFiltro obrigatorio />

      {!idEmpresa ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Selecione uma empresa.
        </div>
      ) : (
        <>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onSalvar}
              disabled={!dirty || salvar.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-verde-accent disabled:opacity-50"
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
                    className="mt-0.5 rounded border-gray-300 text-verde-primary focus:ring-verde-primary/30"
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
              {EQUIPE.map((m) => (
                <label
                  key={m.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={!!equipe[m.id]}
                    onChange={() => toggle(setEquipe, m.id)}
                    className="rounded border-gray-300 text-verde-primary focus:ring-verde-primary/30"
                  />
                  <span className="text-sm text-gray-800">{m.texto}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold text-gray-900">
              Anotações
            </h2>
            <textarea
              value={anotacoes}
              onChange={(e) => {
                setAnotacoes(e.target.value);
                setDirty(true);
              }}
              rows={6}
              placeholder="Registros, observações, próximos passos..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
            />
          </div>
        </>
      )}
    </div>
  );
}
