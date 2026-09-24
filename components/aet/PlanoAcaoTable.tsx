"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Loader2, Plus, Send, Sparkles, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  useAetAcoes,
  useAetAcoesNoPlanoCentral,
  useCriarAetAcao,
  useAtualizarAetAcao,
  useEnviarAetAcoesParaPlanoAcao,
  useExcluirAetAcao,
} from "@/lib/hooks/useAetAcoes";
import {
  ACAO_PADRAO,
  ROTULO_ACOES_GERAIS,
  acoesEnviaveis,
  agruparAcoesPorSetor,
  contextoIaDaAcao,
  prazoIaParaTexto,
} from "@/lib/aet/acoes";
import { formatarPrazoAcao } from "@/lib/acoes/prazo";
import { htmlVazio } from "@/lib/texto-rico";
import { cn } from "@/lib/utils";
import type {
  AetAcao,
  AetSetor,
  StatusAcaoApreciacao,
  PrioridadeAcaoApreciacao,
} from "@/lib/supabase/types";

// Plano de Ação 5W2H do laudo AET. Espelho do da Investigação de Acidente
// (components/investigacao-acidente/PlanoAcaoTable), com três diferenças que
// vêm do próprio AET: as ações são AGRUPADAS POR SETOR do laudo (o técnico
// monta o plano setor a setor, e é assim que sai impresso); cada ação pode
// ser rascunhada pelo assistente de IA a partir da recomendação do setor; e o
// plano tem porta para o Plano de Ação do PGR (acoes_5w2h central, v208) —
// a NR-17, item 17.3.6 "b", manda incorporar as medidas da AET lá.

const STATUS_OPCOES: StatusAcaoApreciacao[] = ["Pendente", "Em Andamento", "Concluida", "Cancelada"];
const PRIORIDADE_OPCOES: PrioridadeAcaoApreciacao[] = ["Baixa", "Media", "Alta", "Critica"];

const STATUS_CORES: Record<StatusAcaoApreciacao, string> = {
  Pendente: "bg-amber-100 text-amber-700 border-amber-200",
  "Em Andamento": "bg-blue-100 text-blue-700 border-blue-200",
  Concluida: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Cancelada: "bg-gray-100 text-gray-500 border-gray-200",
};

const PRIORIDADE_CORES: Record<PrioridadeAcaoApreciacao, string> = {
  Critica: "bg-red-100 text-red-700",
  Alta: "bg-orange-100 text-orange-700",
  Media: "bg-amber-100 text-amber-700",
  Baixa: "bg-emerald-100 text-emerald-700",
};

type EmpresaLike = { nome_empresa?: string | null; cnpj?: string | null } | null;

export default function PlanoAcaoTable({
  idRelatorio,
  idEmpresa,
  referencia,
  setores,
  empresa,
  readOnly = false,
}: {
  idRelatorio: string;
  idEmpresa: string;
  /** Como o laudo é citado nas observações do plano central, ex.: "AET 6d2ef44c de 02/09/2026". */
  referencia: string;
  setores: AetSetor[];
  empresa: EmpresaLike;
  readOnly?: boolean;
}) {
  const { data: acoes = [], isLoading } = useAetAcoes(idRelatorio);
  const { data: noCentral = new Set<string>() } = useAetAcoesNoPlanoCentral(idRelatorio, acoes);
  const criar = useCriarAetAcao();
  const enviar = useEnviarAetAcoesParaPlanoAcao();
  const [expandida, setExpandida] = useState<string | null>(null);
  const [confirmarEnvio, setConfirmarEnvio] = useState(false);

  // O que o botão vai levar: não canceladas que ainda não estão lá.
  const faltamEnviar = useMemo(
    () => acoesEnviaveis(acoes).filter((a) => !noCentral.has(a.id_acao)),
    [acoes, noCentral],
  );

  async function handleEnviar() {
    try {
      const { enviadas, ignoradas } = await enviar.mutateAsync({
        id_relatorio: idRelatorio,
        idEmpresa,
        referencia,
        setores,
        acoes,
      });
      if (enviadas === 0 && ignoradas === 0) {
        toast("Nenhuma ação para enviar (canceladas não vão).", { icon: "ℹ️" });
      } else if (enviadas === 0) {
        toast(`Todas as ${ignoradas} já estão no Plano de Ação do PGR.`, { icon: "ℹ️" });
      } else {
        toast.success(
          `${enviadas} ação(ões) enviada(s) para o Plano de Ação do PGR` +
            (ignoradas > 0 ? ` · ${ignoradas} já estava(m) lá` : ""),
        );
      }
    } catch {
      // toast de erro já emitido pelo hook
    } finally {
      setConfirmarEnvio(false);
    }
  }

  // A MESMA regra do PDF e da prévia (lib/aet/acoes). Aqui a tela mostra
  // TODOS os setores, com ou sem ação — é onde o botão "Adicionar" mora.
  const porGrupo = useMemo(() => {
    const m = new Map<string | null, AetAcao[]>();
    for (const g of agruparAcoesPorSetor(acoes, setores)) m.set(g.setor?.id ?? null, g.acoes);
    return m;
  }, [acoes, setores]);

  const totalPorStatus = useMemo(() => {
    const r: Record<StatusAcaoApreciacao, number> = {
      Pendente: 0,
      "Em Andamento": 0,
      Concluida: 0,
      Cancelada: 0,
    };
    acoes.forEach((a) => {
      r[a.status] += 1;
    });
    return r;
  }, [acoes]);

  async function handleAdicionar(idSetor: string | null) {
    try {
      const row = await criar.mutateAsync({
        id_relatorio: idRelatorio,
        id_setor: idSetor,
        ordem: acoes.length,
      });
      setExpandida(row.id_acao);
    } catch {
      // toast de erro já emitido pelo hook
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-6 text-gray-400">
        <Loader2 className="size-4 animate-spin" />
      </div>
    );
  }

  const gerais = porGrupo.get(null) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[11px] text-gray-500">
          {acoes.length} ação(ões) · {totalPorStatus.Pendente} pendente(s) · {totalPorStatus["Em Andamento"]} em andamento · {totalPorStatus.Concluida} concluída(s)
          {noCentral.size > 0 && <> · {noCentral.size} no Plano de Ação do PGR</>}
        </p>
        {!readOnly && acoes.length > 0 && (
          <button
            type="button"
            onClick={() => setConfirmarEnvio(true)}
            disabled={enviar.isPending || faltamEnviar.length === 0}
            title={
              faltamEnviar.length === 0
                ? "Tudo que não foi cancelado já está no Plano de Ação do PGR"
                : "Copia as ações para o Plano de Ação da empresa (PGR e Portal do Cliente)"
            }
            className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-verde-primary/90 disabled:opacity-50"
          >
            {enviar.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
            Enviar para o Plano de Ação do PGR
            {faltamEnviar.length > 0 && (
              <span className="rounded-full bg-white/20 px-1.5 text-[10px]">{faltamEnviar.length}</span>
            )}
          </button>
        )}
      </div>

      <ConfirmDialog
        open={confirmarEnvio}
        title="Enviar para o Plano de Ação do PGR?"
        description={
          `${faltamEnviar.length} ação(ões) vão para o Plano de Ação da empresa — o mesmo que alimenta o PGR e o ` +
          `Portal do Cliente. Canceladas não vão, e o que já está lá não é duplicado. A partir do envio as ` +
          `cópias vivem separadas: editar aqui não muda o que foi para o PGR. Prazos escritos como ` +
          `"30 dias" viram data contada de hoje; os demais ficam registrados nas observações.`
        }
        confirmLabel="Enviar"
        variant="primary"
        loading={enviar.isPending}
        onConfirm={handleEnviar}
        onCancel={() => setConfirmarEnvio(false)}
      />

      {setores.length === 0 && gerais.length === 0 && (
        <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-6 text-center text-xs text-gray-500">
          Este laudo ainda não tem setores. Cadastre-os em <strong>Setores / Riscos</strong> — o plano é montado setor a setor.
          {!readOnly && " Ações gerais do laudo podem ser adicionadas abaixo."}
        </div>
      )}

      {setores.map((setor, idx) => (
        <GrupoSetor
          key={setor.id}
          titulo={`Setor ${idx + 1}: ${setor.nome_setor?.trim() || "(sem nome)"}`}
          recomendacoes={setor.recomendacoes}
          acoes={porGrupo.get(setor.id) ?? []}
          onAdicionar={() => handleAdicionar(setor.id)}
          adicionando={criar.isPending}
          readOnly={readOnly}
        >
          {(porGrupo.get(setor.id) ?? []).map((a) => (
            <AcaoRow
              key={a.id_acao}
              acao={a}
              setores={setores}
              setorAtual={setor}
              empresa={empresa}
              noCentral={noCentral.has(a.id_acao)}
              expandida={expandida === a.id_acao}
              onToggle={() => setExpandida((cur) => (cur === a.id_acao ? null : a.id_acao))}
              readOnly={readOnly}
            />
          ))}
        </GrupoSetor>
      ))}

      {/* Ações sem setor — e as de setor que foi apagado do laudo depois. */}
      {(gerais.length > 0 || !readOnly) && (
        <GrupoSetor
          titulo={ROTULO_ACOES_GERAIS}
          recomendacoes={null}
          acoes={gerais}
          onAdicionar={() => handleAdicionar(null)}
          adicionando={criar.isPending}
          readOnly={readOnly}
          discreto
        >
          {gerais.map((a) => (
            <AcaoRow
              key={a.id_acao}
              acao={a}
              setores={setores}
              setorAtual={null}
              empresa={empresa}
              noCentral={noCentral.has(a.id_acao)}
              expandida={expandida === a.id_acao}
              onToggle={() => setExpandida((cur) => (cur === a.id_acao ? null : a.id_acao))}
              readOnly={readOnly}
            />
          ))}
        </GrupoSetor>
      )}
    </div>
  );
}

function GrupoSetor({
  titulo,
  recomendacoes,
  acoes,
  onAdicionar,
  adicionando,
  readOnly,
  discreto,
  children,
}: {
  titulo: string;
  recomendacoes: string | null | undefined;
  acoes: AetAcao[];
  onAdicionar: () => void;
  adicionando: boolean;
  readOnly: boolean;
  discreto?: boolean;
  children: React.ReactNode;
}) {
  const [verRecom, setVerRecom] = useState(false);
  const temRecom = !htmlVazio(recomendacoes);
  return (
    <section className={cn("overflow-hidden rounded-lg border bg-white", discreto ? "border-dashed border-gray-300" : "border-gray-200")}>
      <header className={cn("flex flex-wrap items-center gap-2 px-3 py-2", discreto ? "bg-gray-50/60" : "bg-gray-700")}>
        <h3 className={cn("text-[11px] font-bold uppercase tracking-wider", discreto ? "text-gray-600" : "text-white")}>
          {titulo}
        </h3>
        <span className={cn("text-[10px]", discreto ? "text-gray-500" : "text-gray-300")}>
          {acoes.length} ação(ões)
        </span>
        <div className="ml-auto flex items-center gap-2">
          {temRecom && (
            <button
              type="button"
              onClick={() => setVerRecom((v) => !v)}
              className={cn("text-[10px] underline-offset-2 hover:underline", discreto ? "text-gray-600" : "text-gray-200")}
            >
              {verRecom ? "Ocultar recomendações" : "Ver recomendações do setor"}
            </button>
          )}
          {!readOnly && (
            <button
              type="button"
              onClick={onAdicionar}
              disabled={adicionando}
              className="inline-flex items-center gap-1 rounded-md border border-verde-primary/40 bg-white px-2 py-1 text-[11px] font-semibold text-verde-primary hover:bg-verde-primary/5 disabled:opacity-50"
            >
              {adicionando ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
              Adicionar ação
            </button>
          )}
        </div>
      </header>

      {verRecom && temRecom && (
        // A recomendação que o ergonomista escreveu no setor (Setores / Riscos).
        // É a referência para escrever as ações — e o que a IA lê.
        <div className="border-b border-gray-100 bg-amber-50/40 px-3 py-2">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">Recomendações registradas no setor</p>
          <div
            className="prose prose-xs max-w-none text-xs leading-relaxed text-gray-700 [&_p]:my-1"
            dangerouslySetInnerHTML={{ __html: recomendacoes ?? "" }}
          />
        </div>
      )}

      {acoes.length === 0 ? (
        <p className="px-3 py-4 text-center text-xs text-gray-400">
          Nenhuma ação {discreto ? "geral" : "neste setor"}.
        </p>
      ) : (
        <div>{children}</div>
      )}
    </section>
  );
}

function AcaoRow({
  acao,
  setores,
  setorAtual,
  empresa,
  noCentral,
  expandida,
  onToggle,
  readOnly,
}: {
  acao: AetAcao;
  setores: AetSetor[];
  setorAtual: AetSetor | null;
  empresa: EmpresaLike;
  /** Já foi copiada para o acoes_5w2h central (Plano de Ação do PGR). */
  noCentral: boolean;
  expandida: boolean;
  onToggle: () => void;
  readOnly: boolean;
}) {
  const atualizar = useAtualizarAetAcao();
  const excluir = useExcluirAetAcao();

  const [whatAcao, setWhatAcao] = useState(acao.what_acao);
  const [whyJust, setWhyJust] = useState(acao.why_justificativa ?? "");
  const [whereLocal, setWhereLocal] = useState(acao.where_local ?? "");
  const [whenPrazo, setWhenPrazo] = useState(acao.when_prazo ?? "");
  const [whoResp, setWhoResp] = useState(acao.who_responsavel ?? "");
  const [howMetodo, setHowMetodo] = useState(acao.how_metodo ?? "");
  const [howMuch, setHowMuch] = useState(acao.how_much_custo ?? "");
  const [gerandoIA, setGerandoIA] = useState(false);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);

  function salvarStatusOuPrioridade(campo: "status" | "prioridade", valor: string) {
    atualizar.mutate({
      id_relatorio: acao.id_relatorio,
      id_acao: acao.id_acao,
      [campo]: valor,
    } as never);
  }

  function salvarCampos(over: Partial<Record<"what" | "why" | "where" | "when" | "who" | "how" | "howMuch", string>> = {}) {
    atualizar.mutate({
      id_relatorio: acao.id_relatorio,
      id_acao: acao.id_acao,
      what_acao: (over.what ?? whatAcao).trim() || ACAO_PADRAO,
      why_justificativa: (over.why ?? whyJust) || null,
      where_local: (over.where ?? whereLocal) || null,
      when_prazo: (over.when ?? whenPrazo) || null,
      who_responsavel: (over.who ?? whoResp) || null,
      how_metodo: (over.how ?? howMetodo) || null,
      how_much_custo: (over.howMuch ?? howMuch) || null,
    });
  }

  function moverParaSetor(idSetor: string) {
    atualizar.mutate({
      id_relatorio: acao.id_relatorio,
      id_acao: acao.id_acao,
      id_setor: idSetor || null,
    });
  }

  // Mesmo assistente do /acoes central (gerar-acao-ia, Groq). A diferença é o
  // contexto: aqui o "risco" é o setor do AET, e o que pesa é a recomendação
  // do ergonomista. Preenche SÓ o que está vazio e grava na hora — se ficasse
  // só no estado local, fechar a linha sem sair do campo perderia o texto.
  async function gerarComIA() {
    setGerandoIA(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const whatVazio = whatAcao.trim() === "" || whatAcao.trim() === ACAO_PADRAO;
      const { data, error } = await supabase.functions.invoke("gerar-acao-ia", {
        body: contextoIaDaAcao({
          empresa: empresa ? { nome: empresa.nome_empresa, cnpj: empresa.cnpj } : null,
          setor: setorAtual,
          parcial: {
            what_acao: whatVazio ? "" : whatAcao,
            why_justificativa: whyJust,
            where_local: whereLocal,
            who_responsavel: whoResp,
            how_metodo: howMetodo,
            how_much_custo: howMuch,
          },
        }),
      });
      if (error) throw error;
      const ai = (data as { data?: Record<string, unknown> } | null)?.data;
      if (!ai) throw new Error("Resposta vazia da IA");

      const str = (v: unknown) => (typeof v === "string" ? v : "");
      const novo = {
        what: whatVazio ? str(ai.what_acao) || whatAcao : whatAcao,
        why: whyJust || str(ai.why_justificativa),
        where: whereLocal || str(ai.where_local) || (setorAtual?.nome_setor ?? ""),
        who: whoResp || str(ai.who_responsavel),
        how: howMetodo || str(ai.how_metodo),
        howMuch: howMuch || str(ai.how_much_custo),
        when: whenPrazo || prazoIaParaTexto(ai.when_prazo_dias),
      };
      setWhatAcao(novo.what);
      setWhyJust(novo.why);
      setWhereLocal(novo.where);
      setWhoResp(novo.who);
      setHowMetodo(novo.how);
      setHowMuch(novo.howMuch);
      setWhenPrazo(novo.when);
      salvarCampos(novo);
      // Prioridade: só substitui se ainda é o padrão "Media"
      const prio = str(ai.prioridade) as PrioridadeAcaoApreciacao;
      if (acao.prioridade === "Media" && PRIORIDADE_OPCOES.includes(prio) && prio !== "Media") {
        salvarStatusOuPrioridade("prioridade", prio);
      }
      toast.success("Rascunho gerado pela IA — revise o texto");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar com IA");
    } finally {
      setGerandoIA(false);
    }
  }

  async function handleExcluir() {
    try {
      await excluir.mutateAsync({ id_relatorio: acao.id_relatorio, id_acao: acao.id_acao });
      toast.success("Ação excluída");
    } catch {
      // toast de erro já emitido pelo hook
    } finally {
      setConfirmarExclusao(false);
    }
  }

  const concluida = acao.status === "Concluida";
  // Setor que não existe mais no laudo: a ação aparece nas gerais, e aqui
  // dizemos por quê, em vez de deixar o seletor vazio em silêncio.
  const setorSumiu = !!acao.id_setor && !setores.some((s) => s.id === acao.id_setor);

  return (
    <div className={cn("border-b border-gray-100 last:border-b-0", concluida && "bg-emerald-50/30")}>
      <div className="flex items-start gap-2 px-3 py-2">
        <button
          type="button"
          onClick={onToggle}
          className="mt-0.5 shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-100"
          aria-label={expandida ? "Recolher" : "Expandir"}
        >
          <ChevronRight className={cn("size-3.5 transition-transform", expandida && "rotate-90")} />
        </button>
        <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold", PRIORIDADE_CORES[acao.prioridade])}>
          {acao.prioridade}
        </span>
        {noCentral && (
          <span
            title="Já está no Plano de Ação do PGR (cópia feita no envio; editar aqui não muda lá)"
            className="shrink-0 rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700"
          >
            PGR
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className={cn("truncate text-sm font-medium text-gray-900", concluida && "line-through opacity-70")}>
            {acao.what_acao}
          </p>
          {setorSumiu && (
            <p className="text-[10px] text-amber-700">O setor desta ação foi removido do laudo — escolha outro abaixo.</p>
          )}
        </div>
        <div className="hidden shrink-0 items-center gap-2 text-[11px] text-gray-500 sm:flex">
          {acao.who_responsavel && <span title="Responsável">{acao.who_responsavel}</span>}
          {acao.when_prazo && (
            <span title="Prazo" className="max-w-[10rem] truncate">
              {formatarPrazoAcao(acao.when_prazo)}
            </span>
          )}
        </div>
        {readOnly ? (
          <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold", STATUS_CORES[acao.status])}>
            {acao.status}
          </span>
        ) : (
          <select
            value={acao.status}
            onChange={(e) => salvarStatusOuPrioridade("status", e.target.value)}
            className={cn(
              "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold focus:outline-none focus:ring-1 focus:ring-verde-primary",
              STATUS_CORES[acao.status],
            )}
          >
            {STATUS_OPCOES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}
      </div>

      {expandida && (
        <div className="space-y-2 border-t border-gray-100 bg-gray-50/40 px-3 py-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1">
              <Campo label="O quê (ação)">
                <input
                  type="text"
                  value={whatAcao}
                  onChange={(e) => setWhatAcao(e.target.value)}
                  onBlur={() => salvarCampos()}
                  disabled={readOnly}
                  className={inputClass}
                />
              </Campo>
            </div>
            {!readOnly && (
              <button
                type="button"
                onClick={gerarComIA}
                disabled={gerandoIA}
                title="Rascunha os campos vazios a partir da recomendação do setor. Revise antes de usar."
                className="inline-flex items-center gap-1 rounded-md border border-violet-200 bg-white px-2 py-1 text-[11px] font-medium text-violet-700 hover:bg-violet-50 disabled:opacity-50"
              >
                {gerandoIA ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
                Gerar com IA
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Campo label="Por quê (justificativa)">
              <textarea
                rows={2}
                value={whyJust}
                onChange={(e) => setWhyJust(e.target.value)}
                onBlur={() => salvarCampos()}
                disabled={readOnly}
                className={inputClass}
              />
            </Campo>
            <Campo label="Como (método)">
              <textarea
                rows={2}
                value={howMetodo}
                onChange={(e) => setHowMetodo(e.target.value)}
                onBlur={() => salvarCampos()}
                disabled={readOnly}
                className={inputClass}
              />
            </Campo>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
            <Campo label="Onde">
              <input
                type="text"
                value={whereLocal}
                onChange={(e) => setWhereLocal(e.target.value)}
                onBlur={() => salvarCampos()}
                disabled={readOnly}
                className={inputClass}
              />
            </Campo>
            <Campo label="Quem (responsável)">
              <input
                type="text"
                value={whoResp}
                onChange={(e) => setWhoResp(e.target.value)}
                onBlur={() => salvarCampos()}
                disabled={readOnly}
                className={inputClass}
              />
            </Campo>
            <Campo label="Quando (prazo)">
              <textarea
                rows={2}
                value={whenPrazo}
                onChange={(e) => setWhenPrazo(e.target.value)}
                onBlur={() => salvarCampos()}
                disabled={readOnly}
                className={inputClass}
                placeholder="Ex.: 30 dias após a entrega das cadeiras"
              />
            </Campo>
            <Campo label="Quanto (custo)">
              <input
                type="text"
                value={howMuch}
                onChange={(e) => setHowMuch(e.target.value)}
                onBlur={() => salvarCampos()}
                disabled={readOnly}
                className={inputClass}
                placeholder="R$ ..."
              />
            </Campo>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="flex flex-wrap items-end gap-2">
              <Campo label="Prioridade">
                <select
                  value={acao.prioridade}
                  onChange={(e) => salvarStatusOuPrioridade("prioridade", e.target.value)}
                  disabled={readOnly}
                  className={cn(inputClass, "w-auto")}
                >
                  {PRIORIDADE_OPCOES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </Campo>
              <Campo label="Setor">
                <select
                  value={setorSumiu ? "" : (acao.id_setor ?? "")}
                  onChange={(e) => moverParaSetor(e.target.value)}
                  disabled={readOnly}
                  className={cn(inputClass, "w-auto max-w-[16rem]")}
                >
                  <option value="">{ROTULO_ACOES_GERAIS}</option>
                  {setores.map((s, i) => (
                    <option key={s.id} value={s.id}>
                      Setor {i + 1}: {s.nome_setor?.trim() || "(sem nome)"}
                    </option>
                  ))}
                </select>
              </Campo>
            </div>
            {!readOnly && (
              <button
                type="button"
                onClick={() => setConfirmarExclusao(true)}
                disabled={excluir.isPending}
                className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="size-3" /> Excluir
              </button>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmarExclusao}
        title="Excluir esta ação?"
        description={`"${acao.what_acao}" sai do plano e do laudo. Não dá para desfazer.`}
        confirmLabel="Excluir"
        variant="danger"
        loading={excluir.isPending}
        onConfirm={handleExcluir}
        onCancel={() => setConfirmarExclusao(false)}
      />
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-xs focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary/30 disabled:bg-gray-50";

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-gray-600">{label}</span>
      {children}
    </label>
  );
}
