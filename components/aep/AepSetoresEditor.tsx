"use client";

import { recomendaQuestionario, totalAlertasOrganizacionais } from "@/lib/aep/sinalizacao";
import {
  DRPS_POR_RECEIO,
  MOTIVOS_NI,
  SINAIS_INIBICAO,
  SINAIS_SUGERIDOS_INIBICAO,
  fraseCondicoesColeta,
  limitacoesDaAvaliacao,
  niSemMotivo,
  participantesExcedem,
  temReceioManifestacao,
  type CondicoesColeta,
  type MotivoNi,
  type MotivoNiFator,
} from "@/lib/aep/coleta";
import { ROTEIRO_CAMPO, type RoteiroFator } from "@/lib/aep/roteiro-campo";
import { ORIGENS_EVIDENCIA, COR_CONFIANCA, confiancaDoFator } from "@/lib/aep/evidencia";
import { lacunasDoFator, rotuloLacuna, type ChecklistGestao } from "@/lib/aep/checklist-gestao";
import { detalhesDoSetor, idsSelecionados, type DetalheFator } from "@/lib/aep/inventario";
import { medidasExistentesDoFator } from "@/lib/aep/checklist-gestao";
import {
  ROTULO_TOPICO,
  existeNaBiblioteca,
  itensDe,
  type Biblioteca,
  rotuloItem,
  type TopicoBib,
} from "@/lib/aep/biblioteca";
import { useBibliotecaPsi, useIncluirItemBiblioteca } from "@/lib/hooks/useBibliotecaPsi";
import { useIsAdmin } from "@/lib/hooks/useUsuario";
import { registrarAuditoria } from "@/lib/auditoria/registrar";
import { chaveNome, type CargoCatalogo, type SetorCatalogo } from "@/lib/aep/catalogo-setores";
import SituacaoSinalizacaoAep from "@/components/aep/SituacaoSinalizacaoAep";
import { EditorSkeleton } from "@/components/ui/PageSkeletons";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BookPlus,
  ChevronDown,
  Compass,
  ChevronUp,
  Check,
  ExternalLink,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Trash2,
  X,
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
  useCatalogoSetoresEmpresa,
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
import { useMatrizAtiva } from "@/lib/hooks/useV3";
import {
  COR_NIVEL_AIHA,
  indiceProbabilidadeSugerida,
  recalcularAihaOrganizacional,
  SEVERIDADE_PADRAO_IDX,
  type AihaFator,
  type AihaOrganizacional,
  type FatorOrganizacional,
} from "@/lib/aep/aiha-organizacional";
import toast from "react-hot-toast";
import { mensagemErro } from "@/lib/errors";
import {
  SINAIS_ORGANIZACIONAL,
  rotulosDosSinais,
  sinaisValidos,
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
  MatrizRisco,
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
  topo,
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
  /** Entre o título e a observação (roteiro de campo e origem da evidência). */
  topo?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold text-gray-900">{label}</span>
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
      {topo}
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

// ─── Matriz AIHA do fator (Ergonomia Organizacional) ─────────────────────────
// Probabilidade sugerida pelos sinais, severidade padrão do fator; o técnico
// pode trocar as duas. Nível = mesma conta da inspeção (pesos × faixas da
// matriz ativa). Regra em lib/aep/aiha-organizacional.ts.

function AihaDoFator({
  fator,
  valor,
  matriz,
  sinaisMarcados,
  sinaisTotal,
  onChange,
  disabled,
}: {
  fator: string;
  valor: AihaFator | undefined;
  matriz: MatrizRisco;
  sinaisMarcados: number;
  sinaisTotal: number;
  onChange: (patch: Partial<AihaFator>) => void;
  disabled?: boolean;
}) {
  if (!valor) return null;
  const probSug = matriz.probabilidades[indiceProbabilidadeSugerida(sinaisMarcados, matriz.probabilidades.length)];
  const sevSug = matriz.severidades[
    Math.min(SEVERIDADE_PADRAO_IDX[fator as FatorOrganizacional] ?? 1, matriz.severidades.length - 1)
  ];
  const semSinal = sinaisMarcados <= 0;
  const cor = valor.nivel ? COR_NIVEL_AIHA[valor.nivel] : undefined;
  const selectCls =
    "w-full rounded border border-gray-200 bg-white px-1.5 py-1 text-[11px] text-gray-700 focus:border-gray-400 focus:outline-none disabled:bg-gray-50";
  return (
    <div className="rounded-md border border-gray-200 bg-white p-2">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-600">
          Matriz de risco {matriz.nome}
        </span>
        {valor.nivel ? (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{ backgroundColor: cor?.bg, color: cor?.cor, border: "1px solid " + (cor?.borda ?? "transparent") }}
            title="Peso da probabilidade × peso da severidade, nas faixas da matriz"
          >
            {valor.nivel}
            {semSinal && <span className="ml-1 font-normal">· sem sinais marcados</span>}
          </span>
        ) : (
          <span className="rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-[10px] font-medium text-gray-500">
            Não calculado — marque os sinais observados
          </span>
        )}
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <label className="block space-y-0.5">
          <span className="flex items-center justify-between text-[10px] text-gray-500">
            Probabilidade
            {valor.prob_manual ? (
              !disabled && (
                <button type="button" className="text-sky-600 hover:underline" onClick={() => onChange({ prob_manual: false })}>
                  usar sugerida
                </button>
              )
            ) : (
              <span className="text-gray-400">sugerida pelos sinais ({sinaisMarcados} de {sinaisTotal})</span>
            )}
          </span>
          <select
            className={selectCls}
            disabled={disabled || semSinal}
            value={valor.probabilidade}
            onChange={(e) => onChange({ probabilidade: e.target.value, prob_manual: e.target.value !== probSug })}
          >
            {matriz.probabilidades.map((p) => (
              <option key={p} value={p}>{p}{p === probSug ? " (sugerida)" : ""}</option>
            ))}
          </select>
        </label>
        <label className="block space-y-0.5">
          <span className="flex items-center justify-between text-[10px] text-gray-500">
            Severidade
            {valor.sev_manual ? (
              !disabled && (
                <button type="button" className="text-sky-600 hover:underline" onClick={() => onChange({ sev_manual: false })}>
                  usar padrão
                </button>
              )
            ) : (
              <span className="text-gray-400">{semSinal ? "aguardando sinais" : "padrão do fator"}</span>
            )}
          </span>
          <select
            className={selectCls}
            disabled={disabled || semSinal}
            value={valor.severidade}
            onChange={(e) => onChange({ severidade: e.target.value, sev_manual: e.target.value !== sevSug })}
          >
            {matriz.severidades.map((sv) => (
              <option key={sv} value={sv}>{sv}{sv === sevSug ? " (padrão)" : ""}</option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

// ─── Motivo do N/I (Ergonomia Organizacional, 2026-10-06) ─────────────────────
// Obrigatório: o Salvar recusa N/I sem motivo. N/I continua fora da matriz e
// do "Necessita AET"; o motivo vai para o laudo ("Limitações da avaliação").

function MotivoNiCampo({
  valor,
  onChange,
  disabled,
}: {
  valor: MotivoNiFator | undefined;
  onChange: (v: MotivoNiFator) => void;
  disabled?: boolean;
}) {
  const motivo = valor?.motivo ?? "";
  const faltaTexto = motivo === "outro" && !(valor?.texto ?? "").trim();
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50/70 p-2 space-y-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-800">
        Motivo do N/I <span className="text-red-600">*</span>
      </span>
      <select
        disabled={disabled}
        value={motivo}
        onChange={(e) => onChange({ ...valor, motivo: e.target.value as MotivoNi | "" })}
        className={cn(
          "w-full rounded border bg-white px-1.5 py-1 text-[11px] text-gray-700 focus:outline-none disabled:bg-gray-50",
          motivo ? "border-gray-200" : "border-red-300",
        )}
      >
        <option value="">Selecione o motivo…</option>
        {MOTIVOS_NI.map((m) => (
          <option key={m.key} value={m.key}>
            {m.label}
          </option>
        ))}
      </select>
      {motivo && (
        <input
          type="text"
          disabled={disabled}
          value={valor?.texto ?? ""}
          onChange={(e) => onChange({ motivo, texto: e.target.value })}
          placeholder={motivo === "outro" ? "Descreva o motivo (obrigatório)" : "Detalhe (opcional)"}
          className={cn(
            "w-full rounded border bg-white px-1.5 py-1 text-[11px] text-gray-700 focus:outline-none disabled:bg-gray-50",
            faltaTexto ? "border-red-300" : "border-gray-200",
          )}
        />
      )}
    </div>
  );
}

// ─── Roteiro de campo do fator (2026-10-06) ──────────────────────────────────
// Perguntas indiretas e o que observar — só orientação, não grava nada.

function RoteiroDoFator({ roteiro }: { roteiro: RoteiroFator }) {
  return (
    <details open className="group rounded-md border border-teal-100 bg-teal-50/40 px-2 py-1">
      <summary className="flex cursor-pointer list-none items-center gap-1 text-[10px] font-semibold text-teal-800">
        <Compass className="size-3" /> Roteiro de campo
        <ChevronDown className="size-3 transition group-open:rotate-180" />
      </summary>
      <div className="mt-1 grid gap-2 text-[11px] leading-snug text-gray-700 md:grid-cols-2">
        <div>
          <p className="font-semibold text-teal-800">Pergunte (de forma indireta)</p>
          <ul className="list-disc pl-4">
            {roteiro.perguntas.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-semibold text-teal-800">Observe</p>
          <ul className="list-disc pl-4">
            {roteiro.observar.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  );
}

// ─── Condições da coleta (2026-10-06) ────────────────────────────────────────

function CondicoesColetaCampos({
  valor,
  onChange,
  disabled,
  assedioSim,
  sinaisAssedio,
  onMarcarSugeridos,
}: {
  valor: CondicoesColeta | undefined;
  onChange: (v: CondicoesColeta) => void;
  disabled?: boolean;
  /** O fator Assédio está marcado "Sim"? (os sinais só abrem com Sim) */
  assedioSim: boolean;
  sinaisAssedio: string[];
  onMarcarSugeridos: () => void;
}) {
  const c = valor ?? {};
  const set = (patch: Partial<CondicoesColeta>) => onChange({ ...c, ...patch });
  const numero = (v: string) => (v === "" ? null : Math.max(0, Math.floor(Number(v))));
  const inibicao = c.sinais_inibicao ?? [];
  const faltamSugeridos = SINAIS_SUGERIDOS_INIBICAO.filter((k) => !sinaisAssedio.includes(k));
  const inputCls =
    "w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-gray-50";
  return (
    <div className="space-y-2 border-t border-emerald-100 pt-3">
      <p className="text-xs font-semibold text-emerald-800">Condições da coleta</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Trabalhadores abordados</label>
          <input type="number" min={0} disabled={disabled} value={c.trab_abordados ?? ""}
            onChange={(e) => set({ trab_abordados: numero(e.target.value) })} className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Participaram</label>
          <input type="number" min={0} disabled={disabled} value={c.trab_participantes ?? ""}
            onChange={(e) => set({ trab_participantes: numero(e.target.value) })}
            className={cn(inputCls, participantesExcedem(c) && "border-red-300")} />
          {participantesExcedem(c) && (
            <p className="mt-0.5 text-[11px] text-red-600">Mais participantes que abordados.</p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Recusas / respostas evasivas <span className="font-normal text-gray-400">(só o número)</span>
          </label>
          <input type="number" min={0} disabled={disabled} value={c.recusas_evasivas ?? ""}
            onChange={(e) => set({ recusas_evasivas: numero(e.target.value) })} className={inputCls} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-xs text-gray-700">
        <input type="checkbox" disabled={disabled} checked={c.lideranca_presente === true}
          onChange={(e) => set({ lideranca_presente: e.target.checked })}
          className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
        Liderança presente durante a coleta
      </label>
      <div>
        <p className="mb-1 text-xs font-medium text-gray-600">Sinais de inibição observados</p>
        <div className="grid gap-1 sm:grid-cols-2">
          {SINAIS_INIBICAO.map((s) => (
            <label key={s.key} className="flex items-start gap-1.5 text-[11px] leading-snug text-gray-700">
              <input
                type="checkbox"
                disabled={disabled}
                checked={inibicao.includes(s.key)}
                onChange={() =>
                  set({ sinais_inibicao: inibicao.includes(s.key) ? inibicao.filter((k) => k !== s.key) : [...inibicao, s.key] })
                }
                className="mt-0.5 size-3 shrink-0 accent-amber-600"
              />
              {s.label}
            </label>
          ))}
        </div>
      </div>
      <textarea
        disabled={disabled}
        rows={2}
        value={c.obs_coleta ?? ""}
        onChange={(e) => set({ obs_coleta: e.target.value })}
        placeholder="Observações sobre a coleta (sem identificar trabalhadores)"
        className={inputCls}
      />
      {/* Sugestão, nunca marcação automática: o técnico decide. */}
      {inibicao.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] leading-snug text-amber-900">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
          <div className="space-y-1">
            {assedioSim ? (
              faltamSugeridos.length > 0 ? (
                <p>
                  Sinais de inibição costumam acompanhar, no fator <strong>Assédio</strong>, os sinais “Falta de abertura
                  para escuta” e “Ambiente de tensão ou silêncio excessivo”. Avalie se eles se aplicam.
                  {!disabled && (
                    <button type="button" onClick={onMarcarSugeridos} className="ml-1 font-semibold text-amber-800 underline">
                      Marcar esses sinais
                    </button>
                  )}
                </p>
              ) : (
                <p>Os sinais de escuta e de tensão já estão marcados no fator Assédio.</p>
              )
            ) : (
              <p>
                Sinais de inibição observados: avalie o fator <strong>Assédio</strong> na Ergonomia Organizacional (sinais
                “Falta de abertura para escuta” e “Ambiente de tensão ou silêncio excessivo”).
              </p>
            )}
            <p>
              Recomenda-se complementar com instrumento anônimo (DRPS/Questionário Psicossocial), em que os trabalhadores
              possam responder sem exposição.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Evidência do fator "Sim" (Fase 2, 2026-10-06) ───────────────────────────
// Origem por FATOR (decisão do usuário) → confiança Baixa/Média/Alta; lacuna
// do checklist de gestão conta como "documental". Fontes geradoras: as
// lacunas de gestão aparecem sozinhas; o técnico marca outras da biblioteca.
// Nada aqui mexe na matriz AIHA.

function EvidenciaDoFator({
  fator,
  origens,
  onOrigens,
  gestao,
  disabled,
}: {
  fator: string;
  origens: string[];
  onOrigens: (v: string[]) => void;
  gestao: ChecklistGestao | undefined;
  disabled?: boolean;
}) {
  const lacunas = lacunasDoFator(gestao, fator);
  const conf = confiancaDoFator(origens, lacunas.length > 0);
  const alternar = (lista: string[], k: string) => (lista.includes(k) ? lista.filter((x) => x !== k) : [...lista, k]);
  return (
    <div className="rounded-md border border-sky-200 bg-sky-50/50 p-2 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-sky-800">Origem da evidência</span>
        {conf ? (
          <span
            className="rounded px-1.5 py-px text-[10px] font-bold"
            style={{ backgroundColor: COR_CONFIANCA[conf].bg, color: COR_CONFIANCA[conf].cor }}
            title="1 tipo de origem = Baixa · 2 = Média · 3 ou mais = Alta (lacuna de gestão conta como documental)"
          >
            Confiança {conf}
          </span>
        ) : (
          <span className="text-[10px] text-gray-500">marque de onde veio a evidência</span>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {ORIGENS_EVIDENCIA.map((o) => {
          const auto = o.key === "documental" && lacunas.length > 0 && !origens.includes(o.key);
          const on = origens.includes(o.key) || auto;
          return (
            <button
              key={o.key}
              type="button"
              disabled={disabled || auto}
              title={auto ? "Conta sozinha: há lacuna no checklist de gestão ligada a este fator" : undefined}
              onClick={() => onOrigens(alternar(origens, o.key))}
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 transition",
                on ? "bg-sky-600 text-white ring-sky-600" : "bg-white text-gray-600 ring-gray-200 hover:bg-gray-50",
                auto && "opacity-80",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Inventário de risco do fator "Sim" (2026-10-06) ─────────────────────────
// As mesmas colunas do inventário psicossocial exportado (lib/aep/inventario.ts),
// só leitura: vêm da biblioteca, do checklist de gestão, dos sinais, da matriz
// e da origem da evidência. Muda conforme o técnico preenche o resto.

/** Opção do campo de seleção múltipla (biblioteca ou sinal do catálogo). */
interface OpcaoMulti {
  id: string;
  rotulo: string;
  marcado: boolean;
  alternar: () => void;
  /** "sinal" = sinal do catálogo (conta na matriz), em vermelho. */
  tom?: "sinal";
}

/**
 * Campo de seleção múltipla com criação (2026-10-06): as escolhidas ficam
 * como etiquetas dentro do campo; ao clicar abre a lista para marcar várias;
 * digitar filtra; texto que não existe vira item MANUAL no mesmo campo
 * (Enter ou "Incluir"). Itens fixos (checklist de gestão) aparecem como
 * etiquetas sem remover.
 */
function MultiSelectCriavel({
  opcoes,
  fixos = [],
  manuais,
  onManuais,
  acaoItem,
  placeholder,
  disabled,
}: {
  opcoes: OpcaoMulti[];
  fixos?: { key: string; rotulo: string; cor: "amber" | "emerald" }[];
  manuais: string[];
  onManuais: (v: string[]) => void;
  /** Ação extra por item manual (salvar/sugerir na biblioteca). */
  acaoItem?: (texto: string) => React.ReactNode;
  placeholder: string;
  disabled?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  const q = busca.trim().toLowerCase();
  const filtradas = q ? opcoes.filter((o) => o.rotulo.toLowerCase().includes(q)) : opcoes;
  const exata = q ? opcoes.find((o) => o.rotulo.toLowerCase() === q) : undefined;
  const jaManual = q ? manuais.some((m) => m.trim().toLowerCase() === q) : false;
  const podeCriar = !!q && !exata && !jaManual;

  const incluir = () => {
    const t = busca.trim();
    if (!t) return;
    if (exata) {
      if (!exata.marcado) exata.alternar();
    } else if (!jaManual) {
      onManuais([...manuais, t]);
    }
    setBusca("");
  };

  const marcadas = opcoes.filter((o) => o.marcado);
  const vazio = fixos.length === 0 && marcadas.length === 0 && manuais.length === 0;

  return (
    <div ref={ref} className="relative">
      <div
        onClick={() => {
          if (disabled) return;
          setAberto(true);
          inputRef.current?.focus();
        }}
        className={cn(
          "flex min-h-[30px] flex-wrap items-center gap-1 rounded border bg-white px-1.5 py-1",
          aberto ? "border-emerald-500 ring-1 ring-emerald-200" : "border-gray-200",
          disabled ? "bg-gray-50" : "cursor-text",
        )}
      >
        {fixos.map((f) => (
          <span
            key={f.key}
            title="Automático do checklist de gestão"
            className={cn(
              "inline-flex items-start gap-1 rounded px-1.5 py-0.5 text-[10px]",
              f.cor === "amber" ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-900",
            )}
          >
            <span className={cn("rounded px-1 text-[9px] font-semibold", f.cor === "amber" ? "bg-amber-200" : "bg-emerald-200")}>gestão</span>
            {f.rotulo}
          </span>
        ))}
        {marcadas.map((o) => (
          <span
            key={o.id}
            className={cn(
              "inline-flex items-start gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium",
              o.tom === "sinal" ? "bg-red-50 text-red-800 ring-1 ring-red-200" : "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200",
            )}
            title={o.tom === "sinal" ? "Sinal do catálogo — conta na matriz" : undefined}
          >
            {o.rotulo}
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  o.alternar();
                }}
                className="text-gray-400 hover:text-red-500"
                title="Remover"
              >
                <X className="size-3" />
              </button>
            )}
          </span>
        ))}
        {manuais.map((m) => (
          <span key={m} className="inline-flex items-start gap-1 rounded bg-violet-50 px-1.5 py-0.5 text-[10px] text-violet-900 ring-1 ring-violet-200">
            <span className="rounded bg-violet-200 px-1 text-[9px] font-semibold">manual</span>
            {m}
            <span onClick={(e) => e.stopPropagation()}>{acaoItem?.(m)}</span>
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onManuais(manuais.filter((x) => x !== m));
                }}
                className="text-gray-400 hover:text-red-500"
                title="Remover"
              >
                <X className="size-3" />
              </button>
            )}
          </span>
        ))}
        {disabled ? (
          vazio && <span className="text-[10px] text-gray-400">—</span>
        ) : (
          <input
            ref={inputRef}
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setAberto(true);
            }}
            onFocus={() => setAberto(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                incluir();
              } else if (e.key === "Escape") {
                setAberto(false);
              } else if (e.key === "Backspace" && !busca && manuais.length) {
                onManuais(manuais.slice(0, -1));
              }
            }}
            placeholder={vazio ? placeholder : "Selecionar ou digitar…"}
            className="min-w-[8rem] flex-1 border-0 bg-transparent p-0 text-[11px] focus:outline-none focus:ring-0"
          />
        )}
        {!disabled && <ChevronDown className={cn("ml-auto size-3 shrink-0 text-gray-400 transition", aberto && "rotate-180")} />}
      </div>
      {aberto && !disabled && (
        <div className="absolute left-0 right-0 z-30 mt-1 max-h-64 overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg">
          {podeCriar && (
            <button
              type="button"
              onClick={incluir}
              className="flex w-full items-center gap-1.5 px-2 py-1 text-left text-[11px] font-semibold text-violet-700 hover:bg-violet-50"
            >
              <Plus className="size-3" /> Incluir «{busca.trim()}»
            </button>
          )}
          {filtradas.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => o.alternar()}
              className={cn(
                "flex w-full items-start gap-1.5 px-2 py-1 text-left text-[11px] hover:bg-gray-50",
                o.marcado && "bg-emerald-50/60",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-3 shrink-0 items-center justify-center rounded-sm border",
                  o.marcado ? (o.tom === "sinal" ? "border-red-600 bg-red-600 text-white" : "border-emerald-600 bg-emerald-600 text-white") : "border-gray-300",
                )}
              >
                {o.marcado && <Check className="size-2.5" />}
              </span>
              <span className="flex-1">
                {o.rotulo}
                {o.tom === "sinal" && <span className="ml-1 text-[9px] text-red-700">(sinal — conta na matriz)</span>}
              </span>
            </button>
          ))}
          {filtradas.length === 0 && !podeCriar && (
            <p className="px-2 py-1 text-[11px] text-gray-400">{q ? "Já incluído." : "Sem opções na biblioteca — digite para incluir."}</p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Inventário de risco do fator "Sim" (2026-10-06): cada tópico é uma lista de
 * opções da BIBLIOTECA para marcar, mais itens manuais. Item manual pode ir
 * para a biblioteca: o Admin salva direto (vira opção marcada); o técnico
 * SUGERE (fica pendente até o Admin aprovar). A seleção fica em
 * `setor.inventario[fator]` e segue para laudo, PDF, planilha e IA.
 */
function InventarioDoFator({
  d,
  fator,
  biblioteca,
  marcados,
  extra,
  onSel,
  onExtra,
  sinaisCatalogo,
  sinaisMarcados,
  onSinais,
  gestao,
  isAdmin,
  onIncluirBiblioteca,
  disabled,
}: {
  d: DetalheFator;
  fator: string;
  biblioteca: Biblioteca | undefined;
  /** Ids marcados por tópico (seleção do técnico ou padrão). */
  marcados: (t: TopicoBib) => string[];
  extra: Partial<Record<TopicoBib, string[]>>;
  onSel: (t: TopicoBib, ids: string[]) => void;
  onExtra: (t: TopicoBib, itens: string[]) => void;
  sinaisCatalogo: SinalOrganizacional[];
  sinaisMarcados: string[];
  onSinais: (keys: string[]) => void;
  gestao: ChecklistGestao | undefined;
  isAdmin: boolean;
  onIncluirBiblioteca: (t: TopicoBib, texto: string) => void;
  disabled?: boolean;
}) {
  const [aberto, setAberto] = useState(true);
  const lacunas = lacunasDoFator(gestao, fator);
  const medidasGestao = medidasExistentesDoFator(gestao, fator);

  const acaoBiblioteca = (t: TopicoBib) =>
    function AcaoBiblioteca(texto: string) {
    if (disabled) return null;
    const ja = existeNaBiblioteca(biblioteca, fator, t, texto);
    if (ja?.status === "pendente") return <span className="text-[9px] font-semibold text-amber-700">sugerido</span>;
    if (ja?.status === "ativo") return <span className="text-[9px] text-gray-400">já na biblioteca</span>;
    return (
      <button
        type="button"
        onClick={() => onIncluirBiblioteca(t, texto)}
        className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-sky-700 hover:underline"
        title={isAdmin ? "Incluir esta opção na biblioteca (fica disponível para todas as AEPs)" : "Sugerir ao Admin incluir esta opção na biblioteca"}
      >
        <BookPlus className="size-3" /> {isAdmin ? "salvar na biblioteca" : "sugerir"}
      </button>
    );
    };

  const topico = (
    t: TopicoBib,
    placeholder: string,
    opts: {
      fixos?: { key: string; rotulo: string; cor: "amber" | "emerald" }[];
      antes?: OpcaoMulti[];
      dica?: string;
      /** Só leitura (evidências: vêm dos sinais marcados acima). */
      leitura?: boolean;
    } = {},
  ) => {
    const ids = marcados(t);
    const opcoes: OpcaoMulti[] = [
      ...(opts.antes ?? []),
      ...itensDe(biblioteca, fator, t).map((i) => ({
        id: i.id_item,
        rotulo: rotuloItem(i),
        marcado: ids.includes(i.id_item),
        alternar: () => onSel(t, ids.includes(i.id_item) ? ids.filter((x) => x !== i.id_item) : [...ids, i.id_item]),
      })),
    ];
    return (
      <>
        <MultiSelectCriavel
          opcoes={opcoes}
          fixos={opts.fixos}
          manuais={extra[t] ?? []}
          onManuais={(v) => onExtra(t, v)}
          acaoItem={acaoBiblioteca(t)}
          placeholder={placeholder}
          disabled={disabled || opts.leitura}
        />
        {opts.dica && <p className="mt-0.5 text-[10px] text-gray-400">{opts.dica}</p>}
      </>
    );
  };

  const linhas: [string, React.ReactNode][] = [
    [ROTULO_TOPICO.perigo, topico("perigo", "Selecione ou digite o perigo…")],
    [
      ROTULO_TOPICO.fonte,
      topico("fonte", "Selecione ou digite uma fonte geradora…", {
        fixos: lacunas.map((l) => ({ key: l.codigo, rotulo: rotuloLacuna(l), cor: "amber" as const })),
      }),
    ],
    [
      "Evidências (sinais)",
      topico("evidencia", "Selecione ou digite uma evidência…", {
        antes: sinaisCatalogo.map((s) => ({
          id: `sinal:${s.key}`,
          rotulo: s.label,
          tom: "sinal" as const,
          marcado: sinaisMarcados.includes(s.key),
          alternar: () => onSinais(sinaisMarcados.includes(s.key) ? sinaisMarcados.filter((k) => k !== s.key) : [...sinaisMarcados, s.key]),
        })),
        dica: "Preenchido pelos sinais observados marcados acima (em vermelho, contam na matriz). Não se edita aqui.",
        leitura: true,
      }),
    ],
    [ROTULO_TOPICO.meio, topico("meio", "Selecione ou digite o meio de propagação…")],
    [ROTULO_TOPICO.situacao, topico("situacao", "Selecione ou digite a situação…")],
    [ROTULO_TOPICO.tempo, topico("tempo", "Selecione ou digite o tempo de exposição…")],
    [
      "Medidas de controle existentes",
      topico("medida", "Selecione ou digite uma medida existente…", {
        fixos: medidasGestao.map((m) => ({ key: m.codigo, rotulo: `${m.codigo} — ${m.label}`, cor: "emerald" as const })),
        dica: "Só as medidas constatadas em campo.",
      }),
    ],
    [
      ROTULO_TOPICO.medida_recomendada,
      topico("medida_recomendada", "Selecione ou digite uma medida recomendada…", {
        dica: "O que a empresa ainda precisa implantar.",
      }),
    ],
    [ROTULO_TOPICO.descricao, topico("descricao", "Selecione ou digite a descrição do risco…")],
    [ROTULO_TOPICO.danos, topico("danos", "Selecione ou digite um dano à saúde…")],
    [
      "Probabilidade × Severidade",
      <span key="pxs">
        {d.nivel ? `${d.probabilidade} × ${d.severidade} → ${d.nivel}` : "sem nível (marque os sinais observados)"}
        <span className="ml-1 text-gray-400">· ajuste na Matriz de risco AIHA acima</span>
      </span>,
    ],
    [
      "Confiança",
      <span key="conf">
        {d.confianca ?? "—"} <span className="text-gray-400">· pela origem da evidência</span>
      </span>,
    ],
    [ROTULO_TOPICO.sugestao, topico("sugestao", "Selecione ou digite uma sugestão…")],
    [ROTULO_TOPICO.acao, topico("acao", "Selecione ou digite uma ação…")],
  ];
  return (
    <div className="rounded-md border border-gray-300 bg-white">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center gap-2 bg-gray-50 px-2 py-1.5 text-left hover:bg-gray-100"
        aria-expanded={aberto}
      >
        <span className="text-xs font-bold uppercase tracking-wide text-gray-900">Inventário de risco</span>
        <span className="hidden text-[10px] text-gray-400 sm:inline">
          marque as opções da biblioteca ou inclua; vale para laudo, PDF, planilha e IA
        </span>
        <span className="ml-auto inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-gray-700">
          {aberto ? "Recolher" : "Expandir"}
          <ChevronDown className={cn("size-3 transition", aberto && "rotate-180")} />
        </span>
      </button>
      {aberto && (
      <table className="w-full border-t border-gray-100 text-[11px] leading-snug text-gray-700">
        <tbody>
          {linhas.map(([rotulo, valor]) => (
            <tr key={rotulo} className="border-b border-gray-100 last:border-0 align-top">
              <th className="w-52 bg-gray-50 px-2 py-1 text-left font-bold text-gray-900">{rotulo}</th>
              <td className="space-y-0.5 px-2 py-1">{valor}</td>
            </tr>
          ))}
        </tbody>
      </table>
      )}
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
  colunasItens = "md:grid-cols-2 xl:grid-cols-3",
  sinais,
  sinaisMarcados,
  onSinaisChange,
  matriz,
  aiha,
  onAihaChange,
  motivosNi,
  onMotivoNiChange,
  roteiro,
  extraSim,
  inventarioSim,
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
  /** Colunas dos itens dentro do bloco (blocos empilhados na largura toda, 2026-10-06). */
  colunasItens?: string;
  /** Só a Ergonomia Organizacional passa isto; física e cognitiva ignoram. */
  sinais?: Record<string, SinalOrganizacional[]>;
  sinaisMarcados?: Record<string, string[]>;
  onSinaisChange?: (fator: string, keys: string[]) => void;
  /** Matriz AIHA — só a Ergonomia Organizacional passa estes três. */
  matriz?: MatrizRisco | null;
  aiha?: AihaOrganizacional;
  onAihaChange?: (fator: string, patch: Partial<AihaFator>) => void;
  /** Motivo do N/I e roteiro de campo — só a Ergonomia Organizacional (2026-10-06). */
  motivosNi?: Record<string, MotivoNiFator>;
  onMotivoNiChange?: (fator: string, v: MotivoNiFator) => void;
  roteiro?: Record<string, RoteiroFator>;
  /** Conteúdo extra do fator marcado "Sim" (origem da evidência, fontes). */
  extraSim?: (fator: string) => React.ReactNode;
  /** Inventário de risco do fator "Sim" (por último, depois do roteiro). */
  inventarioSim?: (fator: string) => React.ReactNode;
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
      <div className={cn("grid items-start gap-2 p-2", colunasItens)}>
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
              topo={
                roteiro?.[key] || valores[key] === "sim" ? (
                  <>
                    {roteiro?.[key] && <RoteiroDoFator roteiro={roteiro[key]} />}
                    {valores[key] === "sim" && extraSim?.(key)}
                  </>
                ) : undefined
              }
            >
              {valores[key] === "sim" && doFator && doFator.length > 0 && (
                <SinaisDoFator
                  sinais={doFator}
                  marcados={sinaisMarcados?.[key] ?? []}
                  onChange={(keys) => onSinaisChange?.(key, keys)}
                  disabled={disabled}
                />
              )}
              {valores[key] === "sim" && matriz && aiha && (
                <AihaDoFator
                  fator={key}
                  valor={aiha[key]}
                  matriz={matriz}
                  sinaisMarcados={sinaisValidos(key, sinaisMarcados?.[key]).length}
                  sinaisTotal={doFator?.length ?? 0}
                  onChange={(patch) => onAihaChange?.(key, patch)}
                  disabled={disabled}
                />
              )}
              {valores[key] === "nao_identificado" && onMotivoNiChange && (
                <MotivoNiCampo
                  valor={motivosNi?.[key]}
                  onChange={(v) => onMotivoNiChange(key, v)}
                  disabled={disabled}
                />
              )}
              {valores[key] === "sim" && inventarioSim?.(key)}
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
  // Matriz de risco ativa (a mesma da inspeção) — classifica a Ergonomia Organizacional.
  const { data: matriz } = useMatrizAtiva();
  // Biblioteca psicossocial e checklist de gestão (Fase 2, 2026-10-06).
  const { data: biblioteca } = useBibliotecaPsi();
  const gestao = rel?.checklist_gestao;
  // Inclusão na biblioteca a partir do inventário: Admin salva, técnico sugere.
  const incluirBiblioteca = useIncluirItemBiblioteca();
  const isAdmin = useIsAdmin();
  // Setores e cargos que a empresa já tem no sistema (das inspeções) — o
  // editor sugere, e o técnico continua podendo digitar à mão (2026-10-05).
  const { data: catalogo = [] } = useCatalogoSetoresEmpresa(
    (rel as { id_empresa?: string } | undefined)?.id_empresa ?? null
  );

  /** Recalcula a matriz AIHA dos fatores organizacionais e o "Necessita AET". */
  function comAiha(s: AepSetor): AepSetor {
    if (!matriz) return s;
    const aiha = recalcularAihaOrganizacional({
      checklist: s.checklist_organizacional as unknown as Record<string, string>,
      sinaisMarcados: s.sinais_organizacional,
      contarSinais: (f, marcados) => sinaisValidos(f, marcados).length,
      anterior: s.aiha_organizacional,
      matriz,
    }) as AepSetor["aiha_organizacional"];
    const novo = { ...s, aiha_organizacional: aiha };
    return { ...novo, necessita_aet: calcNecessitaAet(novo) };
  }

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

  // Laudos anteriores (ou matriz alterada em Configurações): ao abrir, a matriz
  // AIHA dos fatores é recalculada na tela; vai para o banco no próximo Salvar.
  useEffect(() => {
    if (!matriz) return;
    setSetores((prev) => prev.map(comAiha));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matriz, rel]);

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

  /** Setores do catálogo que ainda não estão nesta AEP. */
  const setoresFaltando = catalogo.filter(
    (c) => !setores.some((s) => chaveNome(s.nome_setor) === chaveNome(c.nome))
  );

  function cargosDoCatalogo(lista: CargoCatalogo[]): AepCargoSetor[] {
    return lista.map((c) => ({ id: crypto.randomUUID(), cargo: c.cargo, descricao: c.descricao, quantidade: 0 }));
  }

  function importarSetores(lista: SetorCatalogo[]) {
    if (lista.length === 0) return;
    const novos = lista.map((c) => {
      const cargos = cargosDoCatalogo(c.cargos);
      return {
        ...setorVazioAep(),
        nome_setor: c.nome,
        descricao_atividade: c.descricao,
        cargos,
        cargo: cargos.map((x) => x.cargo).join(", "),
        funcao: cargos.map((x) => x.cargo).join(", "),
      } as AepSetor;
    });
    setSetores((s) => [...s, ...novos]);
    setAbertos((prev) => new Set([...prev, ...novos.map((n) => n.id)]));
    toast.success(
      `${novos.length} setor${novos.length !== 1 ? "es" : ""} da empresa adicionado${novos.length !== 1 ? "s" : ""} — salve para gravar.`
    );
  }

  function addCargosCatalogo(setorId: string, lista: CargoCatalogo[]) {
    const setor = setores.find((s) => s.id === setorId);
    if (!setor || lista.length === 0) return;
    const novos = [...(setor.cargos ?? []), ...cargosDoCatalogo(lista)];
    updateSetor(setorId, {
      cargos: novos,
      funcao: novos.map((c) => c.cargo).filter(Boolean).join(", "),
      trabalhadores_consultados: buildTrabalhadores(novos),
    });
  }

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
        const updated = comAiha({ ...x, ...patch });
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
          // Fatores organizacionais "Sim" com o nível AIHA e os sinais (2026-10-05).
          fatores_organizacionais: ITENS_ORGANIZACIONAL.filter(
            ({ key }) => (setor.checklist_organizacional as unknown as Record<string, string>)?.[key] === "sim"
          ).map(({ key, label }) => {
            const a = setor.aiha_organizacional?.[key];
            return {
              fator: label,
              nivel: a?.nivel ?? null,
              probabilidade: a?.probabilidade ?? null,
              severidade: a?.severidade ?? null,
              sinais: rotulosDosSinais(key as keyof AepChecklistOrganizacional, setor.sinais_organizacional),
            };
          }),
          necessita_aet: !!setor.necessita_aet,
          // Limitações (N/I com motivo) e condições da coleta (2026-10-06).
          limitacoes: limitacoesDaAvaliacao(
            setor,
            (k) => ITENS_ORGANIZACIONAL.find((i) => i.key === k)?.label ?? k,
          ),
          condicoes_coleta: fraseCondicoesColeta(setor.condicoes_coleta),
          receio_manifestacao: temReceioManifestacao(setor),
          // Fontes, origem e confiança + sugestões/ações da biblioteca (Fase 2).
          evidencias_fatores: detalhesDoSetor(setor, gestao, biblioteca).map((d) => ({
            fator: d.label,
            fontes: d.fontes,
            medidas_existentes: d.medidasExistentes,
            origens: d.origens,
            confianca: d.confianca,
            sugestoes: d.sugestoes,
            // Medidas recomendadas (v277) também valem como ações escolhidas.
            acoes: [...d.acoes, ...d.medidasRecomendadas],
          })),
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
    // N/I exige motivo (2026-10-06): sem ele o laudo não explica a lacuna.
    const pendentes = setores.flatMap((s) =>
      niSemMotivo(s).map(
        (k) => `${s.nome_setor || "Setor sem nome"} · ${ITENS_ORGANIZACIONAL.find((i) => i.key === k)?.label ?? k}`,
      ),
    );
    if (pendentes.length > 0) {
      toast.error(
        `Informe o motivo do N/I antes de salvar:\n${pendentes.slice(0, 5).join("\n")}${pendentes.length > 5 ? `\n… e mais ${pendentes.length - 5}` : ""}`,
        { duration: 7000 },
      );
      return;
    }
    setSalvando(true);
    try {
      await salvar.mutateAsync({ id: idRelatorio, setores: setores as unknown as AepSetor[] });
      // Rastro da origem da evidência (quem marcou, quando, o quê) na
      // auditoria append-only — só quando mudou.
      const antes = JSON.stringify((rel?.setores ?? []).map((s) => [s.id, s.origem_evidencia ?? {}]));
      const depois = JSON.stringify(setores.map((s) => [s.id, s.origem_evidencia ?? {}]));
      if (antes !== depois) {
        void registrarAuditoria({
          modulo: "aep",
          id_referencia: idRelatorio,
          acao: "origem_evidencia",
          descricao: "Origem da evidência dos fatores organizacionais atualizada",
          metadata: {
            setores: setores
              .filter((s) => Object.keys(s.origem_evidencia ?? {}).length > 0)
              .map((s) => ({ setor: s.nome_setor, origem_evidencia: s.origem_evidencia })),
          },
        });
      }
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
      <SituacaoSinalizacaoAep idRelatorio={idRelatorio} />
      {/* Sugestões do campo Setor: setores que a empresa já tem no sistema. */}
      <datalist id="aep-setores-empresa">
        {catalogo.map((c) => (
          <option key={c.nome} value={c.nome} />
        ))}
      </datalist>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Setores / Triagem Ergonômica</h1>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-gray-500">{empresa?.nome_empresa}</p>
            <StatusOrdem status={statusOrdem} />
          </div>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            {setoresFaltando.length > 0 && (
              <button
                type="button"
                onClick={() => importarSetores(setoresFaltando)}
                title={setoresFaltando.map((c) => c.nome).join(", ")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-100"
              >
                <Plus className="size-4" /> Setores da empresa ({setoresFaltando.length})
              </button>
            )}
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
                          list={key === "nome_setor" && catalogo.length > 0 ? "aep-setores-empresa" : undefined}
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
                    {(() => {
                      if (!canEdit) return null;
                      const doCatalogo = catalogo.find((c) => chaveNome(c.nome) === chaveNome(setor.nome_setor));
                      const sugestoes = (doCatalogo?.cargos ?? []).filter(
                        (c) => !(setor.cargos ?? []).some((x) => chaveNome(x.cargo) === chaveNome(c.cargo))
                      );
                      if (sugestoes.length === 0) return null;
                      return (
                        <div className="mb-2 rounded-md border border-sky-100 bg-sky-50/60 px-2 py-1.5">
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <span className="text-[11px] text-sky-800">
                              Cargos cadastrados para &quot;{doCatalogo?.nome}&quot; na empresa:
                            </span>
                            {sugestoes.length > 1 && (
                              <button
                                type="button"
                                onClick={() => addCargosCatalogo(setor.id, sugestoes)}
                                className="text-[11px] font-semibold text-sky-700 underline"
                              >
                                Adicionar todos
                              </button>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {sugestoes.map((c) => (
                              <button
                                key={c.cargo}
                                type="button"
                                onClick={() => addCargosCatalogo(setor.id, [c])}
                                title={c.descricao || undefined}
                                className="inline-flex items-center gap-0.5 rounded-full border border-sky-200 bg-white px-2 py-0.5 text-[11px] text-sky-800 hover:bg-sky-100"
                              >
                                <Plus className="size-3" /> {c.cargo}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
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
                    <CondicoesColetaCampos
                      valor={setor.condicoes_coleta}
                      disabled={!canEdit}
                      onChange={(v) => updateSetor(setor.id, { condicoes_coleta: v })}
                      assedioSim={setor.checklist_organizacional?.assedio === "sim"}
                      sinaisAssedio={setor.sinais_organizacional?.assedio ?? []}
                      onMarcarSugeridos={() => {
                        const atuais = setor.sinais_organizacional?.assedio ?? [];
                        updateSetor(setor.id, {
                          sinais_organizacional: {
                            ...(setor.sinais_organizacional ?? {}),
                            assedio: [...atuais, ...SINAIS_SUGERIDOS_INIBICAO.filter((k) => !atuais.includes(k))],
                          },
                        });
                      }}
                    />
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
                  {/* Um bloco embaixo do outro, cada um na largura toda, com os
                      itens em colunas (2026-10-06): lado a lado, a Organizacional
                      (sinais + matriz) ficava espremida. */}
                  <div className="space-y-3">
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
                        // Idem para o motivo do N/I de um fator que deixou de ser N/I.
                        const motivos = { ...(setor.motivo_ni ?? {}) };
                        // E a origem da evidência / fontes de quem deixou de ser Sim.
                        const origens = { ...(setor.origem_evidencia ?? {}) };
                        const fontes = { ...(setor.fontes_geradoras ?? {}) };
                        const inventario = { ...(setor.inventario ?? {}) };
                        for (const [k, v] of Object.entries(p)) {
                          if (v !== "sim") {
                            delete sinais[k];
                            delete origens[k];
                            delete fontes[k];
                            delete inventario[k];
                          }
                          if (v !== "nao_identificado") delete motivos[k];
                        }
                        updateSetor(setor.id, {
                          checklist_organizacional: { ...setor.checklist_organizacional, ...p } as AepChecklistOrganizacional,
                          sinais_organizacional: sinais,
                          motivo_ni: motivos,
                          origem_evidencia: origens,
                          fontes_geradoras: fontes,
                          inventario,
                        });
                      }}
                      onObservacaoChange={(key, text) =>
                        updateSetor(setor.id, { observacoes_checklist: { ...setor.observacoes_checklist, [key]: text } })
                      }
                      disabled={!canEdit}
                      opcoes={OPCOES_COM_NI}
                      colunasItens=""
                      legenda={["nao_aplica", "nao_identificado"]}
                      sinais={SINAIS_ORGANIZACIONAL}
                      sinaisMarcados={setor.sinais_organizacional ?? {}}
                      onSinaisChange={(fator, keys) =>
                        updateSetor(setor.id, {
                          sinais_organizacional: { ...(setor.sinais_organizacional ?? {}), [fator]: keys },
                        })
                      }
                      motivosNi={setor.motivo_ni}
                      onMotivoNiChange={(fator, v) =>
                        updateSetor(setor.id, { motivo_ni: { ...(setor.motivo_ni ?? {}), [fator]: v } })
                      }
                      roteiro={ROTEIRO_CAMPO}
                      extraSim={(fator) => (
                        <EvidenciaDoFator
                          fator={fator}
                          origens={setor.origem_evidencia?.[fator] ?? []}
                          onOrigens={(v) =>
                            updateSetor(setor.id, { origem_evidencia: { ...(setor.origem_evidencia ?? {}), [fator]: v } })
                          }
                          gestao={gestao}
                          disabled={!canEdit}
                        />
                      )}
                      inventarioSim={(fator) => {
                        const d = detalhesDoSetor(setor, gestao, biblioteca).find((x) => x.key === fator);
                        if (!d) return null;
                        const inv = setor.inventario?.[fator] ?? {};
                        const salvarInv = (patch: { sel?: Partial<Record<TopicoBib, string[]>>; extra?: Partial<Record<TopicoBib, string[]>> }) =>
                          updateSetor(setor.id, {
                            inventario: {
                              ...(setor.inventario ?? {}),
                              [fator]: {
                                sel: { ...(inv.sel ?? {}), ...(patch.sel ?? {}) },
                                extra: { ...(inv.extra ?? {}), ...(patch.extra ?? {}) },
                              },
                            },
                          });
                        return (
                          <InventarioDoFator
                            d={d}
                            fator={fator}
                            biblioteca={biblioteca}
                            marcados={(t) => idsSelecionados(setor, fator, t, biblioteca)}
                            extra={inv.extra ?? {}}
                            onSel={(t, ids) => salvarInv({ sel: { [t]: ids } })}
                            onExtra={(t, itens) => salvarInv({ extra: { [t]: itens } })}
                            sinaisCatalogo={SINAIS_ORGANIZACIONAL[fator as FatorOrganizacional] ?? []}
                            sinaisMarcados={setor.sinais_organizacional?.[fator] ?? []}
                            onSinais={(keys) =>
                              updateSetor(setor.id, {
                                sinais_organizacional: { ...(setor.sinais_organizacional ?? {}), [fator]: keys },
                              })
                            }
                            gestao={gestao}
                            isAdmin={isAdmin}
                            onIncluirBiblioteca={(t, texto) =>
                              incluirBiblioteca.mutate(
                                { fator: ["meio", "situacao", "tempo"].includes(t) ? null : fator, topico: t, texto },
                                {
                                  // Admin: vira opção marcada e sai dos manuais.
                                  onSuccess: (item) => {
                                    if (item.status !== "ativo") return;
                                    salvarInv({
                                      sel: { [t]: [...idsSelecionados(setor, fator, t, biblioteca), item.id_item] },
                                      extra: { [t]: (inv.extra?.[t] ?? []).filter((x) => x !== texto) },
                                    });
                                  },
                                },
                              )
                            }
                            disabled={!canEdit}
                          />
                        );
                      }}
                      matriz={matriz}
                      aiha={setor.aiha_organizacional}
                      onAihaChange={(fator, patch) => {
                        const atual = setor.aiha_organizacional?.[fator];
                        if (!atual) return;
                        updateSetor(setor.id, {
                          aiha_organizacional: { ...(setor.aiha_organizacional ?? {}), [fator]: { ...atual, ...patch } },
                        });
                      }}
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
                        Foram identificados fatores psicossociais organizacionais Alto ou Muito Alto na matriz AIHA, ou múltiplos fatores Moderados. Recomenda-se aprofundamento pela Análise Ergonômica do Trabalho (NR-17).
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

      {/* Banner AEP → QPS — mesma regra da Sinalização e do Comercial. */}
      {(() => {
        if (!recomendaQuestionario(setores)) return null;
        const totalAlertasOrg = totalAlertasOrganizacionais(setores);
        const porReceio = DRPS_POR_RECEIO && setores.some((s) => temReceioManifestacao(s));
        return (
          <div className="flex items-start gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
            <AlertTriangle className="size-5 shrink-0 text-indigo-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-indigo-900">
                {totalAlertasOrg > 0 &&
                  `${totalAlertasOrg} alerta${totalAlertasOrg > 1 ? "s" : ""} de risco organizacional identificado${totalAlertasOrg > 1 ? "s" : ""}`}
                {totalAlertasOrg > 0 && porReceio && " · "}
                {porReceio && "receio dos trabalhadores em se manifestar"}
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
