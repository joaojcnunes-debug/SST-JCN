"use client";

import { EditorSkeleton } from "@/components/ui/PageSkeletons";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  useAepRelatorio,
  useSalvarAep,
  setorVazioAep,
  riscoVazioAep,
  calcNecessitaAet,
  CLASS_COLOR_AEP,
  TIPOS_RISCO_AEP,
  CLASSIFICACOES_AEP,
} from "@/lib/hooks/useAep";
import { useCanEdit } from "@/lib/hooks/useUsuario";
import {
  AlcaReordenar,
  MarcaDrop,
  StatusOrdem,
  useListaReordenavel,
  type StatusOrdemSalva,
} from "@/components/ui/ListaReordenavel";
import { cn } from "@/lib/utils";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { mensagemErro } from "@/lib/errors";
import {
  SINAIS_ORGANIZACIONAL,
  type SinalOrganizacional,
} from "@/lib/aep/sinais-organizacional";
import {
  AJUDA_RESPOSTA,
  ITENS_COGNITIVA,
  ITENS_FISICA,
  ITENS_ORGANIZACIONAL,
  LEGENDA_RESPOSTA,
  METODOS_COLETA,
  OPCOES_COM_NI,
  OPCOES_TRISTATE,
  ROTULO_RESPOSTA,
} from "@/lib/aep/checklist-itens";
import type {
  AepCargoSetor,
  AepSetor,
  AepRisco,
  AepChecklistFisica,
  AepChecklistCognitiva,
  AepChecklistOrganizacional,
  ClassificacaoRiscoAET,
  RespostaChecklist,
  RespostaChecklistAep,
  TipoRiscoAET,
} from "@/lib/supabase/types";

// ─── Catálogo das respostas ───────────────────────────────────────────────────
// Itens, respostas e legendas vivem em lib/aep/checklist-itens.ts — fonte única
// com o Formulário em Branco. Aqui fica só o que é da tela: a cor de cada botão.

const COR_RESPOSTA: Record<RespostaChecklistAep, string> = {
  sim: "bg-red-500 text-white",
  nao: "bg-green-500 text-white",
  nao_aplica: "bg-gray-400 text-white",
  // Âmbar, não vermelho: N/I é lacuna de avaliação, não risco confirmado.
  nao_identificado: "bg-amber-600 text-white",
};

// ─── Tristate com campo de observação ────────────────────────────────────────

function Tristate({
  label,
  value,
  opcoes = OPCOES_TRISTATE,
  observacao,
  onChange,
  onObservacaoChange,
  disabled,
  children,
}: {
  label: string;
  value: RespostaChecklistAep;
  /** Respostas do item. Só a Ergonomia Organizacional passa as quatro. */
  opcoes?: RespostaChecklistAep[];
  observacao?: string;
  onChange: (v: RespostaChecklistAep) => void;
  onObservacaoChange?: (text: string) => void;
  disabled?: boolean;
  /** Conteúdo extra do item — usado pelos sinais da Ergonomia Organizacional. */
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-gray-700">{label}</span>
        <div className="flex gap-1 shrink-0">
          {opcoes.map((opt) => (
            <button
              key={opt}
              type="button"
              disabled={disabled}
              title={AJUDA_RESPOSTA[opt]}
              onClick={() => onChange(opt)}
              className={cn(
                // px-1.5 (era px-2) nos quatro blocos: o botão a mais da
                // organizacional entra na linha sem empurrar o rótulo.
                "rounded px-1.5 py-0.5 text-[10px] font-semibold transition",
                value === opt
                  ? COR_RESPOSTA[opt]
                  : "bg-white border border-gray-200 text-gray-500 hover:bg-gray-100"
              )}
            >
              {ROTULO_RESPOSTA[opt]}
            </button>
          ))}
        </div>
      </div>
      <textarea
        disabled={disabled}
        value={observacao ?? ""}
        onChange={(e) => onObservacaoChange?.(e.target.value)}
        rows={1}
        placeholder="Observação de campo..."
        className="w-full resize-none rounded border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-700 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300 disabled:bg-gray-50"
      />
      {children}
    </div>
  );
}

// ─── Sinais observáveis (Ergonomia Organizacional) ───────────────────────────
// Só aparecem quando o fator é marcado "Sim" — decisão do usuário em 2026-08-06,
// para a tela não inchar e os laudos antigos não mudarem em nada.

function SinaisDoFator({
  sinais,
  marcados,
  onChange,
  disabled,
}: {
  sinais: SinalOrganizacional[];
  marcados: string[];
  onChange: (keys: string[]) => void;
  disabled?: boolean;
}) {
  function alternar(key: string) {
    onChange(
      marcados.includes(key)
        ? marcados.filter((k) => k !== key)
        : [...marcados, key],
    );
  }
  return (
    <div className="rounded-md border border-red-200 bg-red-50/60 p-2">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-red-800">
          Sinais observados
        </span>
        <span className="text-[10px] text-red-700">
          {marcados.length} de {sinais.length}
        </span>
      </div>
      <div className="grid gap-x-3 gap-y-1 md:grid-cols-2">
        {sinais.map((s) => (
          <label
            key={s.key}
            className={cn(
              "flex cursor-pointer items-start gap-1.5 text-[11px] leading-snug text-gray-700",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            <input
              type="checkbox"
              disabled={disabled}
              checked={marcados.includes(s.key)}
              onChange={() => alternar(s.key)}
              className="mt-0.5 size-3 shrink-0 accent-red-600"
            />
            <span>
              {s.label}
              {s.fonte && (
                <span
                  className="ml-1 rounded-full bg-white px-1.5 py-px text-[9px] font-medium text-gray-500 ring-1 ring-gray-200"
                  title={
                    s.fonte === "colaborador"
                      ? "Sinal que costuma vir do relato do colaborador"
                      : "Sinal avaliado pela percepção do técnico"
                  }
                >
                  {s.fonte === "colaborador" ? "colaborador" : "técnico"}
                </span>
              )}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

// ─── Bloco de checklist ───────────────────────────────────────────────────────

function ChecklistBloco({
  titulo,
  cor,
  itens,
  valores,
  observacoes,
  onChange,
  onObservacaoChange,
  disabled,
  opcoes,
  legenda,
  sinais,
  sinaisMarcados,
  onSinaisChange,
}: {
  titulo: string;
  cor: string;
  itens: { key: string; label: string }[];
  valores: Record<string, RespostaChecklistAep>;
  observacoes: Record<string, string>;
  onChange: (patch: Record<string, RespostaChecklistAep>) => void;
  onObservacaoChange: (key: string, text: string) => void;
  disabled?: boolean;
  /** Respostas oferecidas — o padrão é o tristate de sempre. */
  opcoes?: RespostaChecklistAep[];
  /** Siglas explicadas no pé do bloco, na ordem dada. */
  legenda?: RespostaChecklistAep[];
  /** Só a Ergonomia Organizacional passa isto; física e cognitiva ignoram. */
  sinais?: Record<string, SinalOrganizacional[]>;
  sinaisMarcados?: Record<string, string[]>;
  onSinaisChange?: (fator: string, keys: string[]) => void;
}) {
  const positivos = itens.filter((i) => valores[i.key] === "sim").length;
  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <div className={cn("px-4 py-2.5 font-semibold text-sm flex items-center justify-between", cor)}>
        <span>{titulo}</span>
        {positivos > 0 && (
          <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-bold text-red-600">
            {positivos} alerta{positivos > 1 ? "s" : ""}
          </span>
        )}
      </div>
      <div className="divide-y divide-gray-100 p-2 space-y-1">
        {itens.map(({ key, label }) => {
          const doFator = sinais?.[key];
          return (
            <Tristate
              key={key}
              label={label}
              value={valores[key]}
              opcoes={opcoes}
              observacao={observacoes[key]}
              onChange={(v) => onChange({ [key]: v })}
              onObservacaoChange={(text) => onObservacaoChange(key, text)}
              disabled={disabled}
            >
              {valores[key] === "sim" && doFator && doFator.length > 0 && (
                <SinaisDoFator
                  sinais={doFator}
                  marcados={sinaisMarcados?.[key] ?? []}
                  onChange={(keys) => onSinaisChange?.(key, keys)}
                  disabled={disabled}
                />
              )}
            </Tristate>
          );
        })}
      </div>
      {/* Legenda das siglas — no pé do próprio bloco, para não roubar linha de
          cada item nem empurrar a lista para baixo. */}
      {legenda && legenda.length > 0 && (
        <div className="space-y-1 border-t border-gray-100 bg-gray-50/70 px-3 py-2">
          {legenda.map((opt) => {
            const l = LEGENDA_RESPOSTA[opt];
            if (!l) return null;
            return (
              <p key={opt} className="flex items-start gap-1.5 text-[10px] leading-snug text-gray-500">
                <span
                  className={cn(
                    "mt-px shrink-0 rounded px-1 py-px text-[9px] font-bold",
                    COR_RESPOSTA[opt],
                  )}
                >
                  {ROTULO_RESPOSTA[opt]}
                </span>
                <span>
                  <span className="font-semibold text-gray-600">{l.titulo}</span> — {l.texto}
                </span>
              </p>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function AepSetoresPage({ idRelatorio }: { idRelatorio: string }) {
  const { data: rel, isLoading } = useAepRelatorio(idRelatorio);
  const salvar = useSalvarAep();
  const canEdit = useCanEdit();

  const [setores, setSetores] = useState<AepSetor[]>([]);
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [salvando, setSalvando] = useState(false);
  const [gerandoIA, setGerandoIA] = useState<string | null>(null);
  const [statusOrdem, setStatusOrdem] = useState<StatusOrdemSalva>("parado");

  // Só carrega o estado local UMA vez por relatório. Antes isso rodava a cada
  // objeto novo vindo do cache — com o auto-save da ordem, cada arrasto
  // remontaria a lista e fecharia o setor que estivesse aberto.
  const carregado = useRef<string | null>(null);
  useEffect(() => {
    if (!rel || carregado.current === idRelatorio) return;
    carregado.current = idRelatorio;
    setSetores(rel.setores ?? []);
    if (rel.setores?.length) setAbertos(new Set([rel.setores[0].id]));
  }, [rel, idRelatorio]);

  function toggle(id: string) {
    setAbertos((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ─── Ordem dos setores ──────────────────────────────────────────────────────
  // A ordem é a posição no array `setores` (jsonb): a tela, a prévia do laudo e
  // o PDF percorrem o mesmo array. Decisão de 12/08/2026: salva sozinho, sem
  // depender do botão Salvar.

  const limparStatus = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function salvarOrdem(novos: AepSetor[]) {
    if (limparStatus.current) clearTimeout(limparStatus.current);
    setStatusOrdem("salvando");
    try {
      await salvar.mutateAsync({ id: idRelatorio, setores: novos, silencioso: true });
      setStatusOrdem("salvo");
      limparStatus.current = setTimeout(() => setStatusOrdem("parado"), 2500);
    } catch {
      // A ordem nova CONTINUA na tela — o arrasto não se perde. O aviso vermelho
      // é para o usuário saber que ainda precisa apertar Salvar.
      setStatusOrdem("erro");
    }
  }

  const reordenar = useListaReordenavel({
    itens: setores,
    aoReordenar: setSetores,
    aoSalvar: salvarOrdem,
    habilitado: canEdit,
  });

  function addSetor() {
    const novo = setorVazioAep();
    setSetores((s) => [...s, novo]);
    setAbertos((prev) => new Set([...prev, novo.id]));
  }

  function removeSetor(id: string) {
    setSetores((s) => s.filter((x) => x.id !== id));
  }

  function updateSetor(id: string, patch: Partial<AepSetor>) {
    setSetores((s) =>
      s.map((x) => {
        if (x.id !== id) return x;
        const updated = { ...x, ...patch };
        updated.necessita_aet = calcNecessitaAet(updated);
        return updated;
      })
    );
  }

  function addRisco(setorId: string) {
    const novo = riscoVazioAep();
    updateSetor(setorId, {
      riscos: [...(setores.find((s) => s.id === setorId)?.riscos ?? []), novo],
    });
  }

  function updateRisco(setorId: string, riscoId: string, patch: Partial<AepRisco>) {
    const setor = setores.find((s) => s.id === setorId);
    if (!setor) return;
    updateSetor(setorId, {
      riscos: setor.riscos.map((r) => (r.id === riscoId ? { ...r, ...patch } : r)),
    });
  }

  function removeRisco(setorId: string, riscoId: string) {
    const setor = setores.find((s) => s.id === setorId);
    if (!setor) return;
    updateSetor(setorId, { riscos: setor.riscos.filter((r) => r.id !== riscoId) });
  }

  function buildTrabalhadores(cargos: AepCargoSetor[]): string {
    return cargos
      .filter((c) => c.cargo)
      .map((c) => c.quantidade > 0 ? `${c.quantidade} ${c.cargo}` : c.cargo)
      .join(", ");
  }

  function addCargo(setorId: string) {
    const setor = setores.find((s) => s.id === setorId);
    if (!setor) return;
    const novo: AepCargoSetor = { id: crypto.randomUUID(), cargo: "", descricao: "", quantidade: 0 };
    const novos = [...(setor.cargos ?? []), novo];
    updateSetor(setorId, {
      cargos: novos,
      funcao: novos.map((c) => c.cargo).filter(Boolean).join(", "),
      trabalhadores_consultados: buildTrabalhadores(novos),
    });
  }

  function updateCargo(setorId: string, cargoId: string, patch: Partial<AepCargoSetor>) {
    const setor = setores.find((s) => s.id === setorId);
    if (!setor) return;
    const novos = (setor.cargos ?? []).map((c) => (c.id === cargoId ? { ...c, ...patch } : c));
    const syncCargo = "cargo" in patch;
    const syncQtd = "quantidade" in patch || syncCargo;
    updateSetor(setorId, {
      cargos: novos,
      ...(syncCargo && { funcao: novos.map((c) => c.cargo).filter(Boolean).join(", ") }),
      ...(syncQtd && { trabalhadores_consultados: buildTrabalhadores(novos) }),
    });
  }

  function removeCargo(setorId: string, cargoId: string) {
    const setor = setores.find((s) => s.id === setorId);
    if (!setor) return;
    const novos = (setor.cargos ?? []).filter((c) => c.id !== cargoId);
    updateSetor(setorId, {
      cargos: novos,
      funcao: novos.map((c) => c.cargo).filter(Boolean).join(", "),
      trabalhadores_consultados: buildTrabalhadores(novos),
    });
  }

  async function gerarTextoIA(setorId: string, campo: "parecer_tecnico" | "recomendacoes") {
    const setor = setores.find((s) => s.id === setorId);
    if (!setor) return;
    const key = `${setorId}:${campo}`;
    setGerandoIA(key);
    try {
      const sb = createSupabaseBrowserClient();
      const empresa = rel?.empresas as { nome_empresa?: string } | null;
      const { data, error } = await sb.functions.invoke("gerar-parecer-aep-ia", {
        body: {
          campo,
          empresa_nome: empresa?.nome_empresa ?? null,
          setor_nome: setor.nome_setor || "Setor",
          cargos: (setor.cargos ?? []).filter((c) => c.cargo),
          jornada: setor.jornada || null,
          qtd_expostos: setor.qtd_expostos || null,
          checklist_fisica: setor.checklist_fisica as unknown as Record<string, string>,
          checklist_cognitiva: setor.checklist_cognitiva as unknown as Record<string, string>,
          checklist_organizacional: setor.checklist_organizacional as unknown as Record<string, string>,
          observacoes: setor.observacoes_checklist ?? {},
          textoAtual: (setor[campo] as string) || null,
        },
      });
      if (error) { toast.error(mensagemErro(error, "Erro ao gerar texto")); return; }
      updateSetor(setorId, { [campo]: data.data.texto });
      toast.success("Texto gerado com sucesso");
    } catch {
      toast.error("Falha na conexão com a IA");
    } finally {
      setGerandoIA(null);
    }
  }

  async function handleSalvar() {
    setSalvando(true);
    try {
      await salvar.mutateAsync({ id: idRelatorio, setores: setores as unknown as AepSetor[] });
    } catch {
      // erro já tratado pelo hook
    } finally {
      setSalvando(false);
    }
  }

  if (isLoading) return <EditorSkeleton />;

  const empresa = rel?.empresas as { nome_empresa?: string } | null;

  return (
    <div className="space-y-5" {...reordenar.propsContainer()}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Setores / Triagem Ergonômica</h1>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-gray-500">{empresa?.nome_empresa}</p>
            <StatusOrdem status={statusOrdem} />
          </div>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={addSetor}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
            >
              <Plus className="size-4" /> Adicionar setor
            </button>
            <button
              type="button"
              onClick={handleSalvar}
              disabled={salvando}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-50"
            >
              {salvando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Salvar
            </button>
          </div>
        )}
      </div>

      {setores.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center">
          <p className="text-sm text-gray-500">Nenhum setor cadastrado.</p>
          {canEdit && (
            <button
              onClick={addSetor}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
            >
              <Plus className="size-4" /> Adicionar setor
            </button>
          )}
        </div>
      )}

      {setores.map((setor, idx) => {
        // Setor aberto fecha enquanto se arrasta: um cartão expandido passa de
        // mil pixels de altura e fica impossível de arrastar.
        const open = abertos.has(setor.id) && !reordenar.arrastandoId;
        const marca = reordenar.marcaDrop(setor.id);
        const aletaFisica = Object.values(setor.checklist_fisica).filter((v) => v === "sim").length;
        const alertaCog = Object.values(setor.checklist_cognitiva).filter((v) => v === "sim").length;
        const alertaOrg = Object.values(setor.checklist_organizacional).filter((v) => v === "sim").length;
        const totalAlertas = aletaFisica + alertaCog + alertaOrg;
        const displayCargo = setor.cargos?.[0]?.cargo || setor.cargo;

        return (
          <div
            key={setor.id}
            {...reordenar.propsItem(setor.id)}
            className={cn(
              "group/setor relative rounded-xl border border-gray-200 bg-white shadow-sm transition",
              reordenar.arrastandoId === setor.id && "border-dashed border-emerald-400 opacity-40",
              reordenar.recemMovidoId === setor.id && "ring-2 ring-emerald-400",
            )}
          >
            {marca && <MarcaDrop lado={marca} posicao={reordenar.posicaoDaMarca(setor.id)} />}

            {/* Header */}
            <div
              className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50"
              onClick={() => toggle(setor.id)}
            >
              <div className="flex items-center gap-3 min-w-0">
                <AlcaReordenar
                  numero={idx + 1}
                  total={setores.length}
                  nome={setor.nome_setor || "setor sem nome"}
                  desabilitado={!canEdit}
                  onMover={(passo) => reordenar.moverTeclado(setor.id, passo)}
                  {...reordenar.propsAlca(setor.id)}
                />
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">
                    {setor.nome_setor || "Setor sem nome"}
                  </p>
                  {displayCargo && <p className="text-xs text-gray-500 truncate">{displayCargo}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {setor.necessita_aet && (
                  <span className="flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">
                    <AlertTriangle className="size-3" /> AET
                  </span>
                )}
                {totalAlertas > 0 && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">
                    {totalAlertas} alerta{totalAlertas > 1 ? "s" : ""}
                  </span>
                )}
                {canEdit && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeSetor(setor.id); }}
                    className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
                {open ? <ChevronUp className="size-4 text-gray-400" /> : <ChevronDown className="size-4 text-gray-400" />}
              </div>
            </div>

            {open && (
              <div className="border-t border-gray-100 p-4 space-y-5">

                {/* ── Identificação ─────────────────────────────────── */}
                <section>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    Identificação
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {[
                      { key: "nome_setor", label: "Setor *",  placeholder: "Nome do setor" },
                      { key: "unidade",    label: "Unidade",  placeholder: "Unidade / filial" },
                      { key: "ghe",        label: "GHE",      placeholder: "Grupo Homogêneo de Exposição" },
                      { key: "jornada",    label: "Jornada",  placeholder: "Ex: 8h/dia, 44h/semana" },
                    ].map(({ key, label, placeholder }) => (
                      <div key={key}>
                        <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
                        <input
                          type="text"
                          disabled={!canEdit}
                          value={(setor as unknown as Record<string, unknown>)[key] as string ?? ""}
                          onChange={(e) => updateSetor(setor.id, { [key]: e.target.value })}
                          placeholder={placeholder}
                          className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-gray-50"
                        />
                      </div>
                    ))}
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Qtd. expostos</label>
                      <input
                        type="number"
                        min={0}
                        disabled={!canEdit}
                        value={setor.qtd_expostos || ""}
                        onChange={(e) => updateSetor(setor.id, { qtd_expostos: Number(e.target.value) })}
                        placeholder="0"
                        className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-gray-50"
                      />
                    </div>
                  </div>

                  {/* ── Cargos do setor ──────────────────────────── */}
                  <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50/50 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-gray-700">Cargos do setor</label>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => addCargo(setor.id)}
                          className="inline-flex items-center gap-1 rounded border border-emerald-300 bg-white px-2 py-0.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                        >
                          <Plus className="size-3" /> Cargo
                        </button>
                      )}
                    </div>
                    {(setor.cargos ?? []).length === 0 ? (
                      <p className="text-xs text-gray-400 italic">Nenhum cargo adicionado.</p>
                    ) : (
                      <div className="space-y-2">
                        {(setor.cargos ?? []).map((c) => (
                          <div key={c.id} className="grid grid-cols-[1fr_2fr_64px_auto] gap-2 items-center">
                            <input
                              type="text"
                              disabled={!canEdit}
                              value={c.cargo}
                              onChange={(e) => updateCargo(setor.id, c.id, { cargo: e.target.value })}
                              placeholder="Cargo"
                              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-gray-50"
                            />
                            <input
                              type="text"
                              disabled={!canEdit}
                              value={c.descricao}
                              onChange={(e) => updateCargo(setor.id, c.id, { descricao: e.target.value })}
                              placeholder="Descrição da atividade do cargo"
                              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-gray-50"
                            />
                            <input
                              type="number"
                              min={0}
                              disabled={!canEdit}
                              value={c.quantidade || ""}
                              onChange={(e) => updateCargo(setor.id, c.id, { quantidade: Number(e.target.value) })}
                              placeholder="Qtd"
                              title="Quantidade de pessoas neste cargo"
                              className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-center focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-gray-50"
                            />
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => removeCargo(setor.id, c.id)}
                                className="rounded p-1.5 text-gray-400 hover:text-red-500"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Participação dos trabalhadores (NR-1 / Fundacentro) */}
                  <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50/50 p-3 space-y-3">
                    <p className="text-xs font-semibold text-emerald-800">
                      Participação dos trabalhadores — NR-1
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">Método de coleta</label>
                        <MetodoColetaSelect
                          value={setor.metodo_coleta}
                          disabled={!canEdit}
                          onChange={(v) => updateSetor(setor.id, { metodo_coleta: v })}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">
                          Trabalhadores consultados <span className="text-gray-400 font-normal">(auto)</span>
                        </label>
                        <input
                          type="text"
                          disabled={!canEdit}
                          value={setor.trabalhadores_consultados}
                          onChange={(e) => updateSetor(setor.id, { trabalhadores_consultados: e.target.value })}
                          placeholder="Ex: 3 operadores, 1 supervisor"
                          className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-gray-50"
                        />
                      </div>
                    </div>
                  </div>
                </section>

                {/* ── Triagem Ergonômica ────────────────────────────── */}
                <section>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    Triagem Ergonômica
                  </h3>
                  <p className="mb-2 text-[11px] text-gray-500">
                    Ao marcar <strong>Sim</strong>, um campo de observação aparece para registrar o que foi observado.
                  </p>
                  <div className="grid gap-3 lg:grid-cols-3">
                    <ChecklistBloco
                      titulo="Ergonomia Física"
                      cor="bg-blue-50 text-blue-800"
                      itens={ITENS_FISICA}
                      valores={setor.checklist_fisica as unknown as Record<string, RespostaChecklist>}
                      observacoes={setor.observacoes_checklist ?? {}}
                      onChange={(p) => updateSetor(setor.id, { checklist_fisica: { ...setor.checklist_fisica, ...p } as AepChecklistFisica })}
                      onObservacaoChange={(key, text) =>
                        updateSetor(setor.id, { observacoes_checklist: { ...setor.observacoes_checklist, [key]: text } })
                      }
                      disabled={!canEdit}
                    />
                    <ChecklistBloco
                      titulo="Ergonomia Cognitiva"
                      cor="bg-purple-50 text-purple-800"
                      itens={ITENS_COGNITIVA}
                      valores={setor.checklist_cognitiva as unknown as Record<string, RespostaChecklist>}
                      observacoes={setor.observacoes_checklist ?? {}}
                      onChange={(p) => updateSetor(setor.id, { checklist_cognitiva: { ...setor.checklist_cognitiva, ...p } as AepChecklistCognitiva })}
                      onObservacaoChange={(key, text) =>
                        updateSetor(setor.id, { observacoes_checklist: { ...setor.observacoes_checklist, [key]: text } })
                      }
                      disabled={!canEdit}
                    />
                    <ChecklistBloco
                      titulo="Ergonomia Organizacional"
                      cor="bg-amber-50 text-amber-800"
                      itens={ITENS_ORGANIZACIONAL}
                      valores={setor.checklist_organizacional as unknown as Record<string, RespostaChecklistAep>}
                      observacoes={setor.observacoes_checklist ?? {}}
                      onChange={(p) => {
                        // Voltar um fator para Não/N-A limpa os sinais dele: deixar
                        // sinal marcado sob fator negado sairia contraditório no laudo.
                        const sinais = { ...(setor.sinais_organizacional ?? {}) };
                        for (const [k, v] of Object.entries(p)) {
                          if (v !== "sim") delete sinais[k];
                        }
                        updateSetor(setor.id, {
                          checklist_organizacional: { ...setor.checklist_organizacional, ...p } as AepChecklistOrganizacional,
                          sinais_organizacional: sinais,
                        });
                      }}
                      onObservacaoChange={(key, text) =>
                        updateSetor(setor.id, { observacoes_checklist: { ...setor.observacoes_checklist, [key]: text } })
                      }
                      disabled={!canEdit}
                      opcoes={OPCOES_COM_NI}
                      legenda={["nao_aplica", "nao_identificado"]}
                      sinais={SINAIS_ORGANIZACIONAL}
                      sinaisMarcados={setor.sinais_organizacional ?? {}}
                      onSinaisChange={(fator, keys) =>
                        updateSetor(setor.id, {
                          sinais_organizacional: { ...(setor.sinais_organizacional ?? {}), [fator]: keys },
                        })
                      }
                    />
                  </div>
                </section>

                {/* ── Matriz de Riscos ──────────────────────────────── */}
                <section>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                      Matriz de Riscos
                    </h3>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => addRisco(setor.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                      >
                        <Plus className="size-3" /> Risco
                      </button>
                    )}
                  </div>

                  {setor.riscos.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">Nenhum risco identificado.</p>
                  ) : (
                    <div className="space-y-2">
                      {setor.riscos.map((risco) => (
                        <div key={risco.id} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 rounded-lg border border-gray-100 bg-gray-50 p-2 sm:grid-cols-[140px_1fr_160px_180px_auto]">
                          <select
                            disabled={!canEdit}
                            value={risco.tipo}
                            onChange={(e) => updateRisco(setor.id, risco.id, { tipo: e.target.value as TipoRiscoAET })}
                            className="rounded border border-gray-200 bg-white px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none disabled:bg-gray-50"
                          >
                            {TIPOS_RISCO_AEP.map((t) => (
                              <option key={t}>{t}</option>
                            ))}
                          </select>
                          <input
                            disabled={!canEdit}
                            type="text"
                            value={risco.risco}
                            onChange={(e) => updateRisco(setor.id, risco.id, { risco: e.target.value })}
                            placeholder="Agente / risco"
                            className="rounded border border-gray-200 bg-white px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none disabled:bg-gray-50"
                          />
                          <select
                            disabled={!canEdit}
                            value={risco.classificacao_risco}
                            onChange={(e) => updateRisco(setor.id, risco.id, { classificacao_risco: e.target.value as ClassificacaoRiscoAET })}
                            className={`rounded border px-2 py-1 text-xs font-semibold focus:outline-none disabled:bg-gray-50 ${CLASS_COLOR_AEP[risco.classificacao_risco]}`}
                          >
                            {CLASSIFICACOES_AEP.map((c) => (
                              <option key={c}>{c}</option>
                            ))}
                          </select>
                          <input
                            disabled={!canEdit}
                            type="text"
                            value={risco.medida_preventiva}
                            onChange={(e) => updateRisco(setor.id, risco.id, { medida_preventiva: e.target.value })}
                            placeholder="Medida preventiva"
                            className="rounded border border-gray-200 bg-white px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none disabled:bg-gray-50"
                          />
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => removeRisco(setor.id, risco.id)}
                              className="rounded p-1 text-gray-400 hover:text-red-500"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* ── Indicador AET ─────────────────────────────────── */}
                {setor.necessita_aet && (
                  <div className="flex items-start gap-2 rounded-xl border border-orange-200 bg-orange-50 p-3">
                    <AlertTriangle className="size-4 shrink-0 text-orange-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-orange-800">
                        Este setor requer elaboração de AET completa
                      </p>
                      <p className="text-xs text-orange-700 mt-0.5">
                        Foram identificados riscos Alto ou Crítico, ou múltiplos riscos Moderados. Recomenda-se aprofundamento pela Análise Ergonômica do Trabalho (NR-17).
                      </p>
                    </div>
                  </div>
                )}

                {/* ── Parecer e Recomendações ───────────────────────── */}
                <section className="grid gap-3 lg:grid-cols-2">
                  {(["parecer_tecnico", "recomendacoes"] as const).map((campo) => {
                    const isGerandoEste = gerandoIA === `${setor.id}:${campo}`;
                    const label = campo === "parecer_tecnico" ? "Parecer Técnico Preliminar" : "Recomendações";
                    const placeholder = campo === "parecer_tecnico"
                      ? "Descreva as condições de trabalho, práticas de gestão e fatores organizacionais observados que podem estar gerando risco. Foque nas condições e processos — não em características individuais dos trabalhadores."
                      : "Liste as recomendações ergonômicas preliminares...";
                    return (
                      <div key={campo}>
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <label className="text-xs font-semibold text-gray-700">{label}</label>
                          {canEdit && (
                            <button
                              type="button"
                              disabled={!!gerandoIA}
                              onClick={() => gerarTextoIA(setor.id, campo)}
                              className="inline-flex items-center gap-1 rounded-md border border-violet-300 bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-50 transition-colors"
                            >
                              {isGerandoEste
                                ? <Loader2 className="size-3 animate-spin" />
                                : <Sparkles className="size-3" />}
                              {isGerandoEste ? "Gerando..." : "Gerar IA"}
                            </button>
                          )}
                        </div>
                        <textarea
                          disabled={!canEdit}
                          value={(setor[campo] as string) ?? ""}
                          onChange={(e) => updateSetor(setor.id, { [campo]: e.target.value })}
                          rows={4}
                          placeholder={placeholder}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-gray-50"
                        />
                      </div>
                    );
                  })}
                </section>

              </div>
            )}
          </div>
        );
      })}

      {/* Banner AEP → QPS */}
      {(() => {
        const totalAlertasOrg = setores.reduce(
          (acc, s) =>
            acc + Object.values(s.checklist_organizacional).filter((v) => v === "sim").length,
          0
        );
        if (totalAlertasOrg < 3) return null;
        return (
          <div className="flex items-start gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
            <AlertTriangle className="size-5 shrink-0 text-indigo-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-indigo-900">
                {totalAlertasOrg} alerta{totalAlertasOrg > 1 ? "s" : ""} de risco organizacional identificado{totalAlertasOrg > 1 ? "s" : ""}
              </p>
              <p className="mt-0.5 text-xs text-indigo-700 leading-relaxed">
                A NR-1 e a Fundacentro recomendam aprofundar a avaliação de riscos psicossociais com um
                questionário estruturado (DRPS, Copsoq ou equivalente) aplicado diretamente aos trabalhadores.
              </p>
            </div>
            <Link
              href="/questionarios-psicossociais"
              className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
            >
              Abrir QPS <ExternalLink className="size-3" />
            </Link>
          </div>
        );
      })()}

      {setores.length > 0 && canEdit && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSalvar}
            disabled={salvando}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-50"
          >
            {salvando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Salvar tudo
          </button>
        </div>
      )}
    </div>
  );
}

// ─── MetodoColetaSelect ───────────────────────────────────────────────────────

function MetodoColetaSelect({ value, disabled, onChange }: { value: string; disabled: boolean; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selecionados = value
    ? value.split(", ").map((s) => s.trim()).filter(Boolean)
    : [];

  function toggle(metodo: string) {
    const novos = selecionados.includes(metodo)
      ? selecionados.filter((m) => m !== metodo)
      : [...selecionados, metodo];
    onChange(novos.join(", "));
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-left focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-gray-50"
      >
        <span className={selecionados.length === 0 ? "text-gray-400 truncate" : "text-gray-800 truncate"}>
          {selecionados.length === 0 ? "Selecione…" : selecionados.join(", ")}
        </span>
        <ChevronDown className="size-3.5 text-gray-400 shrink-0" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
          {METODOS_COLETA.map((metodo) => (
            <label key={metodo} className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-emerald-50 first:rounded-t-lg last:rounded-b-lg">
              <input
                type="checkbox"
                checked={selecionados.includes(metodo)}
                onChange={() => toggle(metodo)}
                className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              {metodo}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
