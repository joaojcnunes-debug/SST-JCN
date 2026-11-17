"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X, Check, Loader2 } from "lucide-react";
import {
  PRIORIDADES,
  type ClausulaCondicao, type CondicaoAutomacao, type GestaoStatus, type GestaoCampo, type GestaoQuadro,
} from "@/lib/hooks/useGestao";
import { clausulaPronta, condicaoParaGravar, SEM_VALOR } from "@/lib/gestao/automacao-condicao";

// Construtor de condição E/OU. Buffer LOCAL (useState) para não bater no servidor a
// cada tecla e não perder o caret; o pai remonta este componente por automação
// (key={a.id}), então a inicialização é por-automação e um re-render de fundo do
// modal NUNCA zera o rascunho (lição C13/F2.1.2).
// 0.3.294 (17/11/2026): grava SOZINHA, como o resto da janela — sem o botão "Aplicar condição", que ficava
// esquecido (a condição se perdia ao fechar). Listas e seleções gravam logo; o texto grava 0,6 s depois da última
// tecla e ao sair do campo. Cláusula que ainda precisa de valor e está vazia não é gravada (uma regra ativa não
// roda com a condição pela metade) e a tela avisa.

const OPS: { value: string; label: string }[] = [
  { value: "=", label: "é igual a" },
  { value: "!=", label: "é diferente de" },
  { value: "in", label: "está em (lista, vírgula)" },
  { value: "contains", label: "contém" },
  // v298
  { value: "nao_contem", label: "não contém" },
  { value: "vazio", label: "está vazio" },
  { value: "nao_vazio", label: "não está vazio" },
];


const ORIGENS = [
  { value: "manual", label: "Criada à mão" },
  { value: "formulario", label: "Formulário" },
  { value: "recorrencia", label: "Recorrência" },
  { value: "automacao", label: "Automação" },
];
const DIAS = ["", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const PRAZO_ESTADOS = [
  { value: "vazio", label: "Sem prazo" },
  { value: "vencido", label: "Vencido" },
  { value: "hoje", label: "Vence hoje" },
  { value: "futuro", label: "No futuro" },
];

const sel = "rounded-md border border-gray-200 px-2 py-1 text-sm focus:border-marca-primary focus:outline-none";

function clausulaVazia(sst = false): ClausulaCondicao {
  return { campo: sst ? "empresa" : "status", op: sst ? "contains" : "=", valor: "" };
}

export default function AutomacaoCondicaoBuilder({
  condicao, statuses, campos, quadros, etiquetas = [], unidades = [], sst = false, disabled, onAplicar,
}: {
  condicao: CondicaoAutomacao;
  etiquetas?: { id: string; nome: string }[];
  /** v301: para a condição "Unidade (SST)". */
  unidades?: { id_unidade: string; nome: string }[];
  /** v301: gatilho do SST — oferece só os campos do evento (empresa, unidade, técnico, fonte). */
  sst?: boolean;
  statuses: GestaoStatus[];
  campos: GestaoCampo[];
  quadros: GestaoQuadro[];
  disabled: boolean;
  onAplicar: (cond: CondicaoAutomacao) => void;
}) {
  const [all, setAll] = useState<ClausulaCondicao[]>(() => condicao.all ?? []);
  const [any, setAny] = useState<ClausulaCondicao[]>(() => condicao.any ?? []);
  const [sujo, setSujo] = useState(false);
  // Quanto esperar para gravar depois da última mudança: 0 nas listas, 600 ms no texto.
  const espera = useRef(0);

  const camposSst: { value: string; label: string }[] = [
    { value: "empresa", label: "Empresa (nome)" },
    { value: "unidade", label: "Unidade" },
    { value: "tecnico", label: "Técnico" },
    { value: "fonte", label: "O que vence (documento/extintor)" },
  ];
  const camposTarefa: { value: string; label: string }[] = [
    { value: "status", label: "Status atual" },
    { value: "status_de", label: "Status de (origem)" },
    { value: "status_para", label: "Status para (destino)" },
    { value: "prioridade", label: "Prioridade" },
    { value: "quadro", label: "Quadro" },
    { value: "etiqueta", label: "Etiqueta" },
    // v298
    { value: "responsavel", label: "Responsável (nome)" },
    { value: "titulo", label: "Título" },
    { value: "origem", label: "Origem da tarefa" },
    { value: "prazo_estado", label: "Prazo" },
    { value: "dia_semana", label: "Dia da semana (hoje)" },
    { value: "etiqueta_nova", label: "Etiqueta adicionada (gatilho)" },
    { value: "campo_alterado", label: "Campo alterado (gatilho)" },
    { value: "comentario", label: "Texto do comentário (gatilho)" },
    { value: "responsavel_email", label: "E-mail do responsável adicionado (gatilho)" },
    { value: "prioridade_de", label: "Prioridade anterior (gatilho)" },
    ...campos.map((c) => ({ value: `campo:${c.id}`, label: `Campo: ${c.nome}` })),
  ];
  const camposCond = sst ? camposSst : camposTarefa;

  function editar(
    grupo: "all" | "any",
    i: number,
    patch: Partial<ClausulaCondicao>,
  ) {
    const set = grupo === "all" ? setAll : setAny;
    set((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));
    setSujo(true);
  }
  /** Mudança vinda de digitação: espera a pessoa parar de digitar. */
  function digitar(grupo: "all" | "any", i: number, valor: string) {
    espera.current = 600;
    editar(grupo, i, { valor });
  }
  function adicionar(grupo: "all" | "any") {
    (grupo === "all" ? setAll : setAny)((cs) => [...cs, clausulaVazia(sst)]);
    setSujo(true);
  }
  function remover(grupo: "all" | "any", i: number) {
    (grupo === "all" ? setAll : setAny)((cs) => cs.filter((_, j) => j !== i));
    setSujo(true);
  }

  // Só grava quando o que vai para o banco mudou (completar o valor de uma cláusula vazia, por exemplo).
  const gravada = useRef(JSON.stringify(condicaoParaGravar(condicao.all ?? [], condicao.any ?? [])));
  function aplicar() {
    const cond = condicaoParaGravar(all, any);
    const json = JSON.stringify(cond);
    if (json !== gravada.current) {
      gravada.current = json;
      onAplicar(cond);
    }
    setSujo(false);
  }
  const refAplicar = useRef(aplicar);
  refAplicar.current = aplicar;
  useEffect(() => {
    if (!sujo || disabled) return;
    const t = setTimeout(() => refAplicar.current(), espera.current);
    espera.current = 0;
    return () => clearTimeout(t);
  }, [all, any, sujo, disabled]);
  const faltaValor = [...all, ...any].some((c) => !clausulaPronta(c));

  function valorWidget(grupo: "all" | "any", i: number, c: ClausulaCondicao) {
    if (SEM_VALOR.has(c.op)) return null;
    const opcoes = (lista: { value: string; label: string }[], vazio = "valor…") => (
      <select value={c.valor} disabled={disabled} onChange={(e) => editar(grupo, i, { valor: e.target.value })} className={sel}>
        <option value="">{vazio}</option>
        {lista.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
    if (c.campo === "origem") return opcoes(ORIGENS);
    if (c.campo === "unidade") return opcoes(unidades.map((u) => ({ value: u.id_unidade, label: u.nome })), "unidade…");
    if (c.campo === "fonte") return opcoes([{ value: "documento", label: "Documento" }, { value: "extintor", label: "Extintor" }]);
    if (c.campo === "prazo_estado") return opcoes(PRAZO_ESTADOS);
    if (c.campo === "dia_semana") return opcoes(DIAS.slice(1).map((d, k) => ({ value: String(k + 1), label: d })), "dia…");
    if (c.campo === "campo_alterado") return opcoes(campos.map((x) => ({ value: x.id, label: x.nome })), "campo…");
    if ((c.campo === "etiqueta" || c.campo === "etiqueta_nova") && etiquetas.length > 0 && c.op !== "in") {
      return opcoes(etiquetas.map((x) => ({ value: x.nome, label: x.nome })), "etiqueta…");
    }
    if (c.campo === "prioridade" || c.campo === "prioridade_de") {
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
      <input value={c.valor} disabled={disabled} onChange={(e) => digitar(grupo, i, e.target.value)}
        onBlur={() => { if (sujo) aplicar(); }}
        placeholder={c.op === "in" ? "a, b, c" : "valor"} className={`${sel} min-w-[8rem] ${!clausulaPronta(c) ? "border-amber-300" : ""}`} />
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
            <button type="button" onClick={() => adicionar(grupo)} className="inline-flex items-center gap-1 text-[11px] font-medium text-marca-primary hover:underline">
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
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
          {sujo ? (
            <span className="inline-flex items-center gap-1 text-gray-500"><Loader2 className="size-3.5 animate-spin" /> Salvando…</span>
          ) : (
            <span className="inline-flex items-center gap-1 text-marca-primary"><Check className="size-3.5" /> Condição salva automaticamente</span>
          )}
          {faltaValor && <span className="text-amber-700">Cláusula sem valor ainda não vale: escolha ou digite o valor.</span>}
        </p>
      )}
    </div>
  );
}
