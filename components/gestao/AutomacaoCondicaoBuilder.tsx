"use client";

import { useState } from "react";
import { Plus, X, Check } from "lucide-react";
import {
  PRIORIDADES,
  type ClausulaCondicao, type CondicaoAutomacao, type GestaoStatus, type GestaoCampo, type GestaoQuadro,
} from "@/lib/hooks/useGestao";

// Construtor de condição E/OU. Buffer LOCAL (useState) para não bater no servidor a
// cada tecla e não perder o caret; o pai remonta este componente por automação
// (key={a.id}), então a inicialização é por-automação e um re-render de fundo do
// modal NUNCA zera o rascunho (lição C13/F2.1.2). Commit explícito via "Aplicar".

const OPS: { value: string; label: string }[] = [
  { value: "=", label: "é igual a" },
  { value: "!=", label: "é diferente de" },
  { value: "in", label: "está em (lista, vírgula)" },
  { value: "contains", label: "contém" },
];

const sel = "rounded-md border border-gray-200 px-2 py-1 text-sm focus:border-verde-primary focus:outline-none";

function clausulaVazia(): ClausulaCondicao {
  return { campo: "status", op: "=", valor: "" };
}

export default function AutomacaoCondicaoBuilder({
  condicao, statuses, campos, quadros, disabled, onAplicar,
}: {
  condicao: CondicaoAutomacao;
  statuses: GestaoStatus[];
  campos: GestaoCampo[];
  quadros: GestaoQuadro[];
  disabled: boolean;
  onAplicar: (cond: CondicaoAutomacao) => void;
}) {
  const [all, setAll] = useState<ClausulaCondicao[]>(() => condicao.all ?? []);
  const [any, setAny] = useState<ClausulaCondicao[]>(() => condicao.any ?? []);
  const [sujo, setSujo] = useState(false);

  const camposCond: { value: string; label: string }[] = [
    { value: "status", label: "Status atual" },
    { value: "status_de", label: "Status de (origem)" },
    { value: "status_para", label: "Status para (destino)" },
    { value: "prioridade", label: "Prioridade" },
    { value: "quadro", label: "Quadro" },
    { value: "etiqueta", label: "Etiqueta" },
    ...campos.map((c) => ({ value: `campo:${c.id}`, label: `Campo: ${c.nome}` })),
  ];

  function editar(
    grupo: "all" | "any",
    i: number,
    patch: Partial<ClausulaCondicao>,
  ) {
    const set = grupo === "all" ? setAll : setAny;
    set((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));
    setSujo(true);
  }
  function adicionar(grupo: "all" | "any") {
    (grupo === "all" ? setAll : setAny)((cs) => [...cs, clausulaVazia()]);
    setSujo(true);
  }
  function remover(grupo: "all" | "any", i: number) {
    (grupo === "all" ? setAll : setAny)((cs) => cs.filter((_, j) => j !== i));
    setSujo(true);
  }

  function aplicar() {
    const limpa = (cs: ClausulaCondicao[]) =>
      cs.filter((c) => c.campo).map((c) => ({ campo: c.campo, op: c.op || "=", valor: c.valor ?? "" }));
    const allL = limpa(all);
    const anyL = limpa(any);
    const cond: CondicaoAutomacao = {};
    if (allL.length) cond.all = allL;
    if (anyL.length) cond.any = anyL;
    // sem cláusulas: mantém o caminho E/OU ligado (all vazio = casa sempre no motor)
    if (!allL.length && !anyL.length) cond.all = [];
    onAplicar(cond);
    setSujo(false);
  }

  function valorWidget(grupo: "all" | "any", i: number, c: ClausulaCondicao) {
    if (c.campo === "prioridade") {
      return (
        <select value={c.valor} disabled={disabled} onChange={(e) => editar(grupo, i, { valor: e.target.value })} className={sel}>
          <option value="">valor…</option>
          {PRIORIDADES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      );
    }
    if (c.campo === "status" || c.campo === "status_de" || c.campo === "status_para") {
      return (
        <select value={c.valor} disabled={disabled} onChange={(e) => editar(grupo, i, { valor: e.target.value })} className={sel}>
          <option value="">valor…</option>
          {statuses.map((s) => <option key={s.slug} value={s.slug}>{s.nome}</option>)}
        </select>
      );
    }
    if (c.campo === "quadro") {
      return (
        <select value={c.valor} disabled={disabled} onChange={(e) => editar(grupo, i, { valor: e.target.value })} className={sel}>
          <option value="">quadro…</option>
          {quadros.map((q) => <option key={q.id_quadro} value={q.id_quadro}>{q.nome}</option>)}
        </select>
      );
    }
    return (
      <input value={c.valor} disabled={disabled} onChange={(e) => editar(grupo, i, { valor: e.target.value })}
        placeholder={c.op === "in" ? "a, b, c" : "valor"} className={`${sel} min-w-[8rem]`} />
    );
  }

  function grupoUI(grupo: "all" | "any", clausulas: ClausulaCondicao[], titulo: string, hint: string) {
    return (
      <div className="rounded-md border border-gray-100 bg-gray-50/60 p-2">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{titulo} <span className="font-normal normal-case text-gray-400">— {hint}</span></p>
        <div className="space-y-1.5">
          {clausulas.map((c, i) => (
            <div key={i} className="flex flex-wrap items-center gap-1.5">
              <select value={c.campo} disabled={disabled} onChange={(e) => editar(grupo, i, { campo: e.target.value, valor: "" })} className={sel}>
                {camposCond.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
              <select value={c.op} disabled={disabled} onChange={(e) => editar(grupo, i, { op: e.target.value })} className={sel}>
                {OPS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {valorWidget(grupo, i, c)}
              {!disabled && (
                <button type="button" onClick={() => remover(grupo, i)} className="rounded p-1 text-gray-300 hover:text-red-600" aria-label="Remover cláusula"><X className="size-4" /></button>
              )}
            </div>
          ))}
          {clausulas.length === 0 && <p className="text-[11px] text-gray-400">Nenhuma cláusula.</p>}
          {!disabled && (
            <button type="button" onClick={() => adicionar(grupo)} className="inline-flex items-center gap-1 text-[11px] font-medium text-verde-primary hover:underline">
              <Plus className="size-3.5" /> Adicionar cláusula
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {grupoUI("all", all, "TODAS (E)", "todas as cláusulas precisam casar")}
      {grupoUI("any", any, "QUALQUER (OU)", "ao menos uma precisa casar")}
      {!disabled && (
        <div className="flex items-center gap-2">
          <button type="button" onClick={aplicar} disabled={!sujo} className="inline-flex items-center gap-1 rounded-md bg-verde-primary px-2.5 py-1 text-xs font-semibold text-white hover:bg-verde-dark disabled:opacity-50">
            <Check className="size-3.5" /> Aplicar condição
          </button>
          {sujo && <span className="text-[11px] text-amber-600">alterações não aplicadas</span>}
        </div>
      )}
    </div>
  );
}
