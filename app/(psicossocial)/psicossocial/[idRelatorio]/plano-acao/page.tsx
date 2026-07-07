"use client";

import { EditorSkeleton } from "@/components/ui/PageSkeletons";

import { use, useState, useEffect, useRef } from "react";
import { Loader2, Save, Trash2, Plus, Workflow, AlertTriangle, ChevronDown, Check } from "lucide-react";
import { useCanEdit } from "@/lib/hooks/useUsuario";
import { useDrpsRelatorio, useDrpsRespondentes } from "@/lib/hooks/useDrps";
import { listarSetores } from "@/lib/drps/calculos";
import {
  useDrpsPlanoAcao,
  useSalvarLinhaPlanoAcao,
  useRemoverLinhaPlanoAcao,
  type DrpsPlanoAcao5w2h,
  type StatusPlanoAcao,
} from "@/lib/hooks/useDrpsPlanoAcao";
import {
  useAcaoOque,
  useAcaoComo,
  comoOpcoesDeTitulo,
  type AcaoOque,
  type AcaoComo,
} from "@/lib/hooks/useAcaoCatalogo";
import ComboTagInline from "@/components/drps/ComboTagInline";

const STATUS_OPCOES: { valor: StatusPlanoAcao; label: string; classe: string }[] = [
  { valor: "PENDENTE", label: "Pendente", classe: "border-amber-200 bg-amber-50 text-amber-700" },
  { valor: "EM_ANDAMENTO", label: "Em andamento", classe: "border-blue-200 bg-blue-50 text-blue-700" },
  { valor: "CONCLUIDA", label: "Concluída", classe: "border-emerald-200 bg-emerald-50 text-emerald-700" },
];

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
function ordenarMeses(set: Set<string>): string {
  const idx = (m: string) => { const i = MESES.indexOf(m); return i < 0 ? 99 : i; };
  return Array.from(set).sort((a, b) => idx(a) - idx(b) || a.localeCompare(b)).join(", ");
}
const splitCSV = (s: string | null | undefined) => (s ?? "").split(",").map((x) => x.trim()).filter(Boolean);

export default function PlanoAcaoPage({
  params,
}: {
  params: Promise<{ idRelatorio: string }>;
}) {
  const { idRelatorio } = use(params);
  const canEdit = useCanEdit();

  const { data: relatorio, isLoading: loadRel } = useDrpsRelatorio(idRelatorio);
  const { data: linhas = [], isLoading: loadLinhas } = useDrpsPlanoAcao(idRelatorio);
  const { data: respondentes = [], isLoading: loadResp } = useDrpsRespondentes(idRelatorio);
  const { data: oques = [] } = useAcaoOque();
  const { data: comos = [] } = useAcaoComo();
  const salvar = useSalvarLinhaPlanoAcao();

  // Setores avaliados neste DRPS (origem dos respondentes) p/ o select "Onde".
  const setores = listarSetores(respondentes);

  function handleAdicionar() {
    if (!relatorio || !canEdit) return;
    const proximaOrdem = linhas.reduce((m, l) => Math.max(m, l.ordem ?? 0), 0) + 1;
    salvar.mutate({
      id_relatorio: idRelatorio,
      id_empresa: relatorio.id_empresa,
      ordem: proximaOrdem,
      status: "PENDENTE",
      _silent: true,
    });
  }

  if (loadRel || loadLinhas || loadResp) return <EditorSkeleton />;

  if (!relatorio) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <AlertTriangle className="size-4" />
        Relatório não encontrado.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
          <Workflow className="size-5 text-verde-primary" />
          Plano de Ação 5W2H
        </h1>
        <p className="text-sm text-gray-600">
          Ações de gerenciamento dos riscos psicossociais no formato 5W2H (O quê,
          Por quê, Onde, Quando, Quem, Como, Quanto custa). Compõe um capítulo
          próprio do laudo DRPS.
        </p>
      </div>

      {linhas.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
          Nenhuma ação cadastrada ainda.
          {canEdit ? " Clique em “Adicionar ação” para começar." : ""}
        </div>
      )}

      <div className="space-y-4">
        {linhas.map((linha, i) => (
          <LinhaCard
            key={linha.id}
            numero={i + 1}
            linha={linha}
            idRelatorio={idRelatorio}
            idEmpresa={relatorio.id_empresa}
            setores={setores}
            oques={oques}
            comos={comos}
            canEdit={canEdit}
          />
        ))}
      </div>

      {canEdit && (
        <button
          type="button"
          onClick={handleAdicionar}
          disabled={salvar.isPending}
          className="inline-flex items-center gap-1.5 rounded-md border border-verde-primary/40 bg-white px-4 py-2 text-sm font-semibold text-verde-primary hover:bg-verde-primary/5 disabled:opacity-50"
        >
          {salvar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Adicionar ação
        </button>
      )}
    </div>
  );
}

function LinhaCard({
  numero,
  linha,
  idRelatorio,
  idEmpresa,
  setores,
  oques,
  comos,
  canEdit,
}: {
  numero: number;
  linha: DrpsPlanoAcao5w2h;
  idRelatorio: string;
  idEmpresa: string | null;
  setores: string[];
  oques: AcaoOque[];
  comos: AcaoComo[];
  canEdit: boolean;
}) {
  const salvar = useSalvarLinhaPlanoAcao();
  const remover = useRemoverLinhaPlanoAcao();
  const [comoNovo, setComoNovo] = useState("");

  const [form, setForm] = useState({
    acao: linha.acao ?? "",
    justificativa: linha.justificativa ?? "",
    onde: linha.onde ?? "",
    prazo: linha.prazo ?? "",
    responsavel: linha.responsavel ?? "",
    como: linha.como ?? "",
    quanto_custa: linha.quanto_custa ?? "",
    status: (linha.status ?? "PENDENTE") as StatusPlanoAcao,
  });

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function handleSalvar() {
    salvar.mutate({
      id: linha.id,
      id_relatorio: idRelatorio,
      id_empresa: idEmpresa,
      ordem: linha.ordem,
      acao: form.acao.trim() || null,
      justificativa: form.justificativa.trim() || null,
      onde: form.onde.trim() || null,
      prazo: form.prazo.trim() || null,
      responsavel: form.responsavel.trim() || null,
      como: form.como.trim() || null,
      quanto_custa: form.quanto_custa.trim() || null,
      status: form.status,
    });
  }

  const statusInfo = STATUS_OPCOES.find((s) => s.valor === form.status) ?? STATUS_OPCOES[0];

  // "Onde" guarda múltiplos setores separados por vírgula no mesmo campo texto.
  const selecionadosOnde = new Set(
    form.onde.split(",").map((s) => s.trim()).filter(Boolean),
  );
  // Opções: Todos os setores + setores avaliados + já selecionados (preserva legado).
  const opcoesOnde = Array.from(
    new Set(["Todos os setores", ...setores, ...selecionadosOnde].filter(Boolean)),
  );
  function toggleOnde(s: string) {
    if (!canEdit) return;
    const next = new Set(selecionadosOnde);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    set("onde", Array.from(next).join(", "));
  }

  // "O Quê" — opções do catálogo (ativas) para o combo (datalist).
  const oqueOpcoes = oques.filter((o) => o.ativo).map((o) => o.titulo);
  const oqueListId = `oque-${linha.id}`;

  // "Como" — opções vêm do "O Quê" selecionado; valores guardados por vírgula (catálogo + extras).
  const comoOpcoes = comoOpcoesDeTitulo(oques, comos, form.acao);
  const comoArr = splitCSV(form.como);
  const comoOptSet = new Set(comoOpcoes.map((o) => o.toLowerCase()));
  const comoSelecionados = comoArr.filter((x) => comoOptSet.has(x.toLowerCase()));
  const comoExtras = comoArr.filter((x) => !comoOptSet.has(x.toLowerCase()));
  const comoSet = (sel: string[], ext: string[]) => set("como", [...sel, ...ext].join(", "));
  function comoToggle(item: string) {
    if (!canEdit) return;
    const has = comoSelecionados.some((s) => s.toLowerCase() === item.toLowerCase());
    const nextSel = has
      ? comoSelecionados.filter((s) => s.toLowerCase() !== item.toLowerCase())
      : [...comoSelecionados, item];
    comoSet(nextSel, comoExtras);
  }
  function comoAdd() {
    const v = comoNovo.trim();
    if (!v) return;
    const dup = [...comoSelecionados, ...comoExtras].some((x) => x.toLowerCase() === v.toLowerCase());
    if (!dup) comoSet(comoSelecionados, [...comoExtras, v]);
    setComoNovo("");
  }
  function comoRemoveExtra(i: number) {
    comoSet(comoSelecionados, comoExtras.filter((_, j) => j !== i));
  }

  // "Quando" — checklist de meses (Jan–Dez); guarda por vírgula (preserva legado).
  const selecionadosQuando = new Set(splitCSV(form.prazo));
  const opcoesQuando = Array.from(new Set([...MESES, ...selecionadosQuando]));
  function toggleQuando(m: string) {
    if (!canEdit) return;
    const next = new Set(selecionadosQuando);
    if (next.has(m)) next.delete(m);
    else next.add(m);
    set("prazo", ordenarMeses(next));
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="inline-flex size-7 items-center justify-center rounded-full bg-verde-primary/10 text-sm font-bold text-verde-primary">
          {numero}
        </span>
        <span className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${statusInfo.classe}`}>
          {statusInfo.label}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Campo label="O quê (ação)" full>
          {!canEdit ? (
            <p className="py-1.5 text-sm text-gray-700">{form.acao || "—"}</p>
          ) : (
            <>
              <input
                list={oqueListId}
                value={form.acao}
                onChange={(e) => set("acao", e.target.value)}
                className={inputCls}
                placeholder="Escolha do catálogo ou digite a ação"
              />
              <datalist id={oqueListId}>
                {oqueOpcoes.map((o) => (
                  <option key={o} value={o} />
                ))}
              </datalist>
            </>
          )}
        </Campo>
        <Campo label="Por quê (justificativa)" full>
          <textarea
            value={form.justificativa}
            onChange={(e) => set("justificativa", e.target.value)}
            readOnly={!canEdit}
            rows={2}
            className={inputCls}
            placeholder="Objetivo / motivo da ação"
          />
        </Campo>
        <Campo label="Onde (setores — pode escolher vários)">
          {!canEdit ? (
            <p className="py-1.5 text-sm text-gray-700">
              {selecionadosOnde.size ? Array.from(selecionadosOnde).join(", ") : "—"}
            </p>
          ) : (
            <MultiSelectSetores
              opcoes={opcoesOnde}
              selecionados={selecionadosOnde}
              onToggle={toggleOnde}
            />
          )}
        </Campo>
        <Campo label="Quando (meses — pode marcar vários)">
          {!canEdit ? (
            <p className="py-1.5 text-sm text-gray-700">
              {selecionadosQuando.size ? ordenarMeses(selecionadosQuando) : "—"}
            </p>
          ) : (
            <MultiSelectSetores
              opcoes={opcoesQuando}
              selecionados={selecionadosQuando}
              onToggle={toggleQuando}
            />
          )}
        </Campo>
        <Campo label="Quem (responsável)">
          <input value={form.responsavel} onChange={(e) => set("responsavel", e.target.value)} readOnly={!canEdit} className={inputCls} placeholder="Responsável" />
        </Campo>
        <Campo label="Quanto custa">
          <input value={form.quanto_custa} onChange={(e) => set("quanto_custa", e.target.value)} readOnly={!canEdit} className={inputCls} placeholder="Custo estimado" />
        </Campo>
        <Campo label="Como (formas de execução — uma ou mais)" full>
          {!canEdit ? (
            <p className="py-1.5 text-sm text-gray-700">
              {[...comoSelecionados, ...comoExtras].join(", ") || "—"}
            </p>
          ) : (
            <ComboTagInline
              opcoes={comoOpcoes}
              selecionados={comoSelecionados}
              extras={comoExtras}
              novoValor={comoNovo}
              onToggle={comoToggle}
              onAdd={comoAdd}
              onRemoveExtra={comoRemoveExtra}
              onNovoValor={setComoNovo}
              placeholder={form.acao.trim() ? "Escolha um 'Como' ou digite" : "Escolha o 'O quê' primeiro, ou digite"}
              vazioLabel={comoOpcoes.length === 0 ? "Sem 'Como' no catálogo p/ esta ação — digite um personalizado." : "Já adicionado."}
              disabled={!canEdit}
            />
          )}
        </Campo>
      </div>

      {canEdit && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
          <label className="flex items-center gap-2 text-xs text-gray-600">
            Status:
            <select
              value={form.status}
              onChange={(e) => set("status", e.target.value as StatusPlanoAcao)}
              className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-verde-primary focus:outline-none"
            >
              {STATUS_OPCOES.map((s) => (
                <option key={s.valor} value={s.valor}>{s.label}</option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => remover.mutate({ id: linha.id, id_relatorio: idRelatorio })}
              disabled={remover.isPending}
              className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {remover.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              Excluir
            </button>
            <button
              type="button"
              onClick={handleSalvar}
              disabled={salvar.isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-4 py-1.5 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-50"
            >
              {salvar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Salvar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary/30 read-only:bg-gray-50 read-only:text-gray-600";

/** Dropdown de múltipla escolha de setores (checkboxes, fecha ao clicar fora). */
function MultiSelectSetores({
  opcoes,
  selecionados,
  onToggle,
}: {
  opcoes: string[];
  selecionados: Set<string>;
  onToggle: (s: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [aberto]);

  const label = selecionados.size === 0 ? "Selecione os setores…" : Array.from(selecionados).join(", ");

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className={`${inputCls} flex items-center justify-between gap-2 text-left`}
      >
        <span className={`truncate ${selecionados.size ? "text-gray-800" : "text-gray-400"}`}>{label}</span>
        <ChevronDown className={`size-4 shrink-0 text-gray-400 transition-transform ${aberto ? "rotate-180" : ""}`} />
      </button>
      {aberto && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-gray-200 bg-white p-1 shadow-lg">
          {opcoes.map((s) => {
            const ativo = selecionados.has(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => onToggle(s)}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                <span
                  className={`flex size-4 shrink-0 items-center justify-center rounded border ${
                    ativo ? "border-verde-primary bg-verde-primary text-white" : "border-gray-300 bg-white"
                  }`}
                >
                  {ativo && <Check className="size-3" />}
                </span>
                {s}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Campo({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </label>
      {children}
    </div>
  );
}
