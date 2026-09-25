"use client";

import FonteGeradoraCampo from "@/components/psicossocial/FonteGeradoraCampo";
import { useAdicionarFontesCatalogo, useCatalogoFontes } from "@/lib/hooks/useFontesGeradoras";
import { fontesEscolhidas, textoFontes } from "@/lib/psicossocial/fontes";
import { Fragment, use, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, Save, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import ComboTagInline from "@/components/drps/ComboTagInline";
import RichTextEditor from "@/components/drps/RichTextEditor";
import { mensagemErro } from "@/lib/errors";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useEmpresa } from "@/lib/hooks/useEmpresas";
import { useCanEdit } from "@/lib/hooks/useUsuario";
import { useAgravosOpcoes } from "@/lib/hooks/useAgravos";
import { useMedidasRecomendadasOpcoes } from "@/lib/hooks/useMedidasRecomendadas";
import {
  useDeleteQpsProbabilidade,
  useQpsAllPerguntas,
  useQpsAplicacao,
  useQpsCategorias,
  useQpsProbabilidades,
  useQpsRespondentes,
  useQpsTipos,
  useUpdateQpsAplicacao,
  useUpsertQpsProbabilidade,
} from "@/lib/hooks/useQuestionarios";
import {
  SETOR_TODA_APLICACAO,
  TODOS_OS_SETORES,
  calcularAnaliseSetor,
  listarSetoresQps,
} from "@/lib/qps/gravidade";
import type { CategoriaGravidade } from "@/lib/qps/gravidade";
import { rotuloProbabilidade } from "@/lib/drps/calculos";
import { formatCNPJ } from "@/lib/utils";

/**
 * Análise do questionário com a régua do DRPS (pedido do Sanmyo, 14/09/2026).
 *
 * É o espelho da tela "Análise" do DRPS: por setor (ou consolidado), a tabela
 * Fatores de Risco · Fontes Geradoras · Gravidade · Probabilidade · Matriz, os
 * agravos, as medidas e a conclusão com IA. A diferença de fundo para a tela
 * "Resultados / Matriz" é o papel da resposta: lá ela vira PROBABILIDADE com
 * severidade fixa; aqui ela vira GRAVIDADE (conta do DRPS, `lib/qps/gravidade.ts`)
 * e a probabilidade é a que o psicólogo informa — na linha da categoria.
 *
 * Onde cada coisa mora (v210):
 *   probabilidade  → qps_probabilidades (setor "*" = aplicação; setor real = ajuste)
 *   fonte geradora → qps_categorias.fonte_geradora (vale para o tipo inteiro)
 *   agravos/medidas/conclusão → qps_aplicacoes.*_por_setor (chave "*" = consolidado)
 */

// ─── Multi-seleção: o mesmo formato de texto do DRPS ("• item\n• item") ─────

function parseMultiSelect(
  texto: string | null | undefined,
  opcoes: string[],
): { selecionados: string[]; extras: string[] } {
  if (!texto) return { selecionados: [], extras: [] };
  const itens = texto
    .split("\n")
    .map((s) => s.replace(/^[•\-\s]+/, "").trim())
    .filter((s) => s.length > 0);
  const selecionados: string[] = [];
  const extras: string[] = [];
  for (const item of itens) {
    if (opcoes.includes(item)) selecionados.push(item);
    else extras.push(item);
  }
  return { selecionados, extras };
}

function serializeMultiSelect(selecionados: string[], extras: string[]): string | null {
  const all = [...selecionados, ...extras.filter((e) => e.trim().length > 0)];
  if (all.length === 0) return null;
  return all.map((s) => `• ${s}`).join("\n");
}

interface EditorSetor {
  agravosSel: string[];
  agravosExtras: string[];
  novoAgravo: string;
  medidasSel: string[];
  medidasExtras: string[];
  novaMedida: string;
  /** v262 — fontes geradoras escolhidas por categoria (só as que alguém mexeu). */
  fontes: Record<string, string[]>;
}

const editorVazio = (): EditorSetor => ({
  agravosSel: [],
  agravosExtras: [],
  novoAgravo: "",
  medidasSel: [],
  medidasExtras: [],
  novaMedida: "",
  fontes: {},
});

/** Chave de gravação: o consolidado usa "*", igual à probabilidade geral. */
const chaveSetor = (setor: string) => (setor === TODOS_OS_SETORES ? SETOR_TODA_APLICACAO : setor);

const INSTRUMENTO_PADRAO = { sigla: "QAP", nome: "Questionário de Avaliação Psicossocial" };

/**
 * O que o select de probabilidade mostra selecionado:
 *  - consolidado: a geral (ou "padrao", desabilitado, enquanto não informada);
 *  - setor: o ajuste do setor se houver; senão "geral" (herda a da aplicação).
 */
function valorSelectProbabilidade(c: CategoriaGravidade, ehConsolidado: boolean): string {
  if (ehConsolidado) return c.probabilidadeOrigem === "padrao" ? "padrao" : String(c.probabilidade);
  return c.probabilidadeOrigem === "setor" ? String(c.probabilidade) : "geral";
}

// ─── Página ──────────────────────────────────────────────────────────────────

export default function AnaliseQpsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const canEdit = useCanEdit();

  const { data: ap } = useQpsAplicacao(id);
  const { data: empresa } = useEmpresa(ap?.id_empresa);
  const { data: tipos = [] } = useQpsTipos();
  const { data: categorias = [] } = useQpsCategorias(ap?.id_tipo ?? null);
  const { data: perguntas = [] } = useQpsAllPerguntas(ap?.id_tipo ?? null);
  const { data: respondentes = [], isLoading: carregandoResp } = useQpsRespondentes(id);
  const { data: probabilidades = [] } = useQpsProbabilidades(id);
  const upsertProb = useUpsertQpsProbabilidade();
  const deleteProb = useDeleteQpsProbabilidade();
  const updateAp = useUpdateQpsAplicacao();
  const agravosOpcoes = useAgravosOpcoes();
  const medidasOpcoes = useMedidasRecomendadasOpcoes();

  const tipo = tipos.find((t) => t.id_tipo === ap?.id_tipo);
  const setores = useMemo(() => listarSetoresQps(respondentes), [respondentes]);
  const [setor, setSetor] = useState<string>(TODOS_OS_SETORES);
  const opcoesSetor = [TODOS_OS_SETORES, ...setores];

  // Pedido 3 do Sanmyo (17/09/2026): em "Todos os setores" a página empilha o
  // consolidado (no topo — decisão dele) e um bloco por setor, cada um com seus
  // agravos, medidas e conclusão, como a Análise do DRPS. Num setor só, um bloco.
  const setoresExibidos = useMemo<string[]>(
    () => (setor === TODOS_OS_SETORES ? [TODOS_OS_SETORES, ...setores] : [setor]),
    [setor, setores],
  );

  const analisePorSetor = useMemo<Record<string, CategoriaGravidade[]>>(() => {
    if (!tipo || categorias.length === 0) return {};
    const out: Record<string, CategoriaGravidade[]> = {};
    for (const s of setoresExibidos) {
      out[s] = calcularAnaliseSetor(
        s,
        categorias,
        perguntas,
        respondentes,
        probabilidades,
        tipo.escala_min,
        tipo.escala_max,
      );
    }
    return out;
  }, [tipo, setoresExibidos, categorias, perguntas, respondentes, probabilidades]);

  const contarRespondentes = (s: string) =>
    s === TODOS_OS_SETORES
      ? respondentes.length
      : respondentes.filter((r) => (r.setor ?? "").trim() === s).length;

  // ── agravos / medidas (por setor, salvos no botão, como no DRPS) ──────────
  const [editores, setEditores] = useState<Record<string, EditorSetor>>({});
  const [editoresIniciados, setEditoresIniciados] = useState(false);
  useEffect(() => {
    if (!ap || editoresIniciados || agravosOpcoes.length === 0) return;
    const inicial: Record<string, EditorSetor> = {};
    for (const s of [TODOS_OS_SETORES, ...setores]) {
      const k = chaveSetor(s);
      const a = parseMultiSelect(ap.agravos_por_setor?.[k], agravosOpcoes);
      const m = parseMultiSelect(ap.medidas_por_setor?.[k], medidasOpcoes);
      inicial[s] = {
        ...editorVazio(),
        agravosSel: a.selecionados,
        agravosExtras: a.extras,
        medidasSel: m.selecionados,
        medidasExtras: m.extras,
        fontes: { ...(ap.fontes_por_setor?.[k] ?? {}) },
      };
    }
    setEditores(inicial);
    setEditoresIniciados(true);
  }, [ap, setores, agravosOpcoes, medidasOpcoes, editoresIniciados]);

  const patchEditor = (s: string, p: Partial<EditorSetor>) =>
    setEditores((e) => ({ ...e, [s]: { ...(e[s] ?? editorVazio()), ...p } }));

  async function salvarAgravosMedidas() {
    if (!ap) return;
    const agravos: Record<string, string> = { ...(ap.agravos_por_setor ?? {}) };
    const medidas: Record<string, string> = { ...(ap.medidas_por_setor ?? {}) };
    // v262: fontes geradoras por setor ("*" = consolidado), mescladas.
    const fontes: Record<string, Record<string, string[]>> = { ...(ap.fontes_por_setor ?? {}) };
    for (const [s, ed] of Object.entries(editores)) {
      if (Object.keys(ed.fontes).length > 0) fontes[chaveSetor(s)] = ed.fontes;
    }
    for (const [s, ed] of Object.entries(editores)) {
      const k = chaveSetor(s);
      const a = serializeMultiSelect(ed.agravosSel, ed.agravosExtras);
      const m = serializeMultiSelect(ed.medidasSel, ed.medidasExtras);
      if (a) agravos[k] = a;
      else delete agravos[k];
      if (m) medidas[k] = m;
      else delete medidas[k];
    }
    try {
      await updateAp.mutateAsync({
        id: ap.id_aplicacao,
        idEmpresa: ap.id_empresa,
        input: { agravos_por_setor: agravos, medidas_por_setor: medidas, fontes_por_setor: fontes },
      });
      toast.success("Agravos e medidas salvos");
    } catch (e) {
      toast.error(mensagemErro(e, "Erro ao salvar"));
    }
  }

  // ── conclusão (por setor, salva ao sair do editor) ────────────────────────
  async function salvarConclusao(setorAlvo: string, texto: string) {
    if (!ap) return;
    const conclusoes: Record<string, string> = { ...(ap.conclusoes_por_setor ?? {}) };
    const k = chaveSetor(setorAlvo);
    if (texto.trim()) conclusoes[k] = texto;
    else delete conclusoes[k];
    try {
      await updateAp.mutateAsync({
        id: ap.id_aplicacao,
        idEmpresa: ap.id_empresa,
        input: { conclusoes_por_setor: conclusoes },
      });
    } catch (e) {
      toast.error(mensagemErro(e, "Erro ao salvar a conclusão"));
    }
  }

  // ── probabilidade (a linha da categoria) ──────────────────────────────────
  async function mudarProbabilidade(setorAlvo: string, idCategoria: string, valor: string) {
    if (!ap) return;
    try {
      if (valor === "geral") {
        // Só existe fora do consolidado: apaga o ajuste do setor.
        await deleteProb.mutateAsync({ id_aplicacao: ap.id_aplicacao, setor: setorAlvo, id_categoria: idCategoria });
        toast.success("Setor volta a usar a probabilidade geral");
        return;
      }
      const prob = Number(valor) as 1 | 2 | 3;
      await upsertProb.mutateAsync({
        id_aplicacao: ap.id_aplicacao,
        setor: chaveSetor(setorAlvo),
        id_categoria: idCategoria,
        probabilidade: prob,
        atualizado_em: new Date().toISOString(),
      });
      toast.success(
        setorAlvo === TODOS_OS_SETORES
          ? `Probabilidade ${rotuloProbabilidade(prob)} para toda a aplicação`
          : `Probabilidade ${rotuloProbabilidade(prob)} só no setor ${setorAlvo}`,
      );
    } catch (e) {
      toast.error(mensagemErro(e, "Erro ao gravar a probabilidade"));
    }
  }

  const salvando = updateAp.isPending;

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-20 -mx-1 flex flex-wrap items-start justify-between gap-3 border-b border-gray-200 bg-white/95 px-1 py-2 backdrop-blur">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Análise — régua do DRPS</h1>
          <p className="text-sm text-gray-600">
            {ap?.titulo ?? "Carregando..."}
            {tipo ? ` · ${tipo.nome} · escala ${tipo.escala_min}–${tipo.escala_max}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            Setor
            <select
              id="qps-analise-setor"
              value={setor}
              onChange={(e) => setSetor(e.target.value)}
              className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-verde-primary focus:outline-none"
            >
              {opcoesSetor.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={salvarAgravosMedidas}
            disabled={!canEdit || salvando}
            className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-verde-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            {salvando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Salvar agravos e medidas
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
        Aqui a resposta define a <b>gravidade</b> (conta do DRPS: média → arredonda para cima → inverte
        se a pergunta é invertida; por categoria, cortes 1,66 e 2,32) e <b>você informa a
        probabilidade</b> na linha da categoria — no consolidado ela vale para a aplicação inteira; num
        setor, só para ele. A matriz 3×3 é a do DRPS (Baixo / Médio / Alto / Crítico). Em
        &ldquo;Todos os setores&rdquo; a página mostra o consolidado e, abaixo dele, um bloco por
        setor — cada um com seus agravos, medidas e conclusão. A tela &ldquo;Resultados /
        Matriz&rdquo; continua com a régua antiga (resposta → probabilidade em %).
      </div>

      {carregandoResp ? (
        <p className="text-sm text-gray-500">Carregando respondentes...</p>
      ) : respondentes.length === 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Esta aplicação ainda não tem respondentes — importe as respostas antes de analisar.
        </p>
      ) : (
        setoresExibidos.map((s, idx) => (
          <BlocoSetor
            key={s}
            instrumento={INSTRUMENTO_PADRAO}
            tituloTipo={tipo?.nome ?? ""}
            empresaNome={empresa?.nome_empresa ?? "—"}
            empresaCnpj={empresa?.cnpj ? formatCNPJ(empresa.cnpj) : "—"}
            responsavel={ap?.responsavel ?? ""}
            setor={s}
            ehConsolidado={s === TODOS_OS_SETORES}
            posicao={setoresExibidos.length > 1 ? { indice: idx + 1, total: setoresExibidos.length } : null}
            totalRespondentes={contarRespondentes(s)}
            analise={analisePorSetor[s] ?? []}
            canEdit={canEdit}
            agravosOpcoes={agravosOpcoes}
            medidasOpcoes={medidasOpcoes}
            editor={editores[s] ?? editorVazio()}
            patch={(p) => patchEditor(s, p)}
            onProbabilidade={(idCategoria, valor) => mudarProbabilidade(s, idCategoria, valor)}
            conclusao={ap?.conclusoes_por_setor?.[chaveSetor(s)] ?? ""}
            onSalvarConclusao={(texto) => salvarConclusao(s, texto)}
          />
        ))
      )}
    </div>
  );
}

// ─── Bloco do setor: a tabela do DRPS, agravos, medidas e conclusão ──────────

function BlocoSetor({
  instrumento,
  tituloTipo,
  empresaNome,
  empresaCnpj,
  responsavel,
  setor,
  ehConsolidado,
  posicao,
  totalRespondentes,
  analise,
  canEdit,
  agravosOpcoes,
  medidasOpcoes,
  editor,
  patch,
  onProbabilidade,
  conclusao,
  onSalvarConclusao,
}: {
  instrumento: { sigla: string; nome: string };
  tituloTipo: string;
  empresaNome: string;
  empresaCnpj: string;
  responsavel: string;
  setor: string;
  ehConsolidado: boolean;
  /** "n/total" no título quando a página empilha vários blocos (null = bloco único). */
  posicao: { indice: number; total: number } | null;
  totalRespondentes: number;
  analise: CategoriaGravidade[];
  canEdit: boolean;
  agravosOpcoes: string[];
  medidasOpcoes: string[];
  editor: EditorSetor;
  patch: (p: Partial<EditorSetor>) => void;
  onProbabilidade: (idCategoria: string, valor: string) => void;
  conclusao: string;
  onSalvarConclusao: (texto: string) => void;
}) {
  const [textoLocal, setTextoLocal] = useState(conclusao);
  const [gerandoIA, setGerandoIA] = useState(false);
  const [aberta, setAberta] = useState<Record<string, boolean>>({});
  // v262 — catálogo de fontes digitadas (vale para todas as aplicações).
  const { data: catalogoFontes = {} } = useCatalogoFontes("qps");
  const guardarFontesCatalogo = useAdicionarFontesCatalogo("qps");
  const fontesDaCategoria = (c: CategoriaGravidade) =>
    fontesEscolhidas(editor.fontes[c.id_categoria], c.fonteGeradora);

  useEffect(() => {
    setTextoLocal(conclusao);
  }, [conclusao, setor]);

  const comBase = analise.filter((c) => !c.semBase);

  async function gerarConclusaoIA() {
    if (comBase.length === 0) {
      toast.error("Sem categoria com resposta — não é possível gerar conclusão.");
      return;
    }
    setGerandoIA(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.functions.invoke("gerar-conclusao-drps-ia", {
        body: {
          instrumento,
          empresa: { nome: empresaNome, cnpj: empresaCnpj !== "—" ? empresaCnpj : null },
          setor: { nome: setor, funcoes: null, totalRespondentes },
          ehConsolidado,
          responsavelTecnico: responsavel || null,
          crp: null,
          topicos: comBase.map((c) => ({
            nome: c.nome,
            fonteGeradora: textoFontes(fontesDaCategoria(c)),
            gravidade: c.gravidade?.texto ?? null,
            probabilidade: c.classificacaoProbabilidade,
            matriz: c.matriz,
          })),
          agravos: serializeMultiSelect(editor.agravosSel, editor.agravosExtras),
          medidasExistentes: serializeMultiSelect(editor.medidasSel, editor.medidasExtras),
          textoAtual: textoLocal || null,
        },
      });
      if (error) throw error;
      const novo = (data as { data?: { conclusao?: string } } | null)?.data?.conclusao;
      if (!novo) throw new Error("Resposta vazia da IA");
      setTextoLocal(novo);
      onSalvarConclusao(novo);
      toast.success("Conclusão gerada pela IA — revise antes de assinar.");
    } catch (e) {
      toast.error(mensagemErro(e, "Erro ao gerar conclusão com IA"));
    } finally {
      setGerandoIA(false);
    }
  }

  return (
    <section className="qps-analise" id={`qps-analise-${ehConsolidado ? "consolidado" : setor}`}>
      <style>{`
        .qps-analise { font-size: 11px; line-height: 1.55; color: var(--text-strong); }
        .qps-analise + .qps-analise { margin-top: 24px; }
        .qps-analise .drps-tabela { border-collapse: collapse; width: 100%; font-size: 11px; }
        .qps-analise .drps-tabela td, .qps-analise .drps-tabela th { border: 1px solid var(--psi-borda); padding: 7px 10px; vertical-align: top; }
        .qps-analise .drps-label { background: var(--psi-label-bg); font-weight: 600; color: var(--psi-verde); font-size: 10.5px; letter-spacing: 0.02em; }
        .qps-analise .drps-header-section { background: var(--psi-faixa-bg); color: var(--psi-verde); font-weight: 700; text-align: center; font-size: 11.5px; letter-spacing: 0.06em; text-transform: uppercase; padding: 8px 10px; }
        .qps-analise .drps-title { background: linear-gradient(180deg, #0ea5e9 0%, #00563f 100%); color: white; font-weight: 700; font-size: 13px; text-align: center; letter-spacing: 0.08em; text-transform: uppercase; padding: 10px 12px; }
        .qps-analise .drps-tabela + .drps-tabela { margin-top: 0; }
        .qps-analise select.prob { font-size: 10.5px; padding: 2px 4px; border: 1px solid var(--psi-borda); border-radius: 4px; background: var(--surface, #fff); color: inherit; max-width: 100%; }
        .qps-analise textarea.fonte { width: 100%; font: inherit; font-size: 10px; border: 1px dashed var(--psi-borda); border-radius: 4px; padding: 3px 5px; background: transparent; color: inherit; resize: vertical; min-height: 34px; }
        .qps-analise .sub { background: var(--psi-label-bg); }
        .qps-analise .sub td { font-size: 10px; padding: 4px 8px; }
      `}</style>

      <table className="drps-tabela mb-0">
        <tbody>
          <tr>
            <td className="drps-title" colSpan={4}>
              {instrumento.sigla} — {instrumento.nome}
              {tituloTipo ? <span className="ml-2 text-[10px] font-normal normal-case tracking-normal opacity-80">({tituloTipo})</span> : null}
              {posicao ? (
                <span className="ml-3 text-[10px] font-normal opacity-80">
                  {ehConsolidado ? "consolidado" : `setor ${posicao.indice - 1}/${posicao.total - 1}`}
                </span>
              ) : null}
            </td>
          </tr>
          <tr>
            <td className="drps-label" style={{ width: "30%" }}>
              Responsável Técnico pela Avaliação (Psicólogo)
            </td>
            <td colSpan={3}>{responsavel || "—"}</td>
          </tr>
          <tr>
            <td className="drps-header-section" colSpan={4}>Identificação</td>
          </tr>
          <tr>
            <td className="drps-label">CNPJ</td>
            <td>{empresaCnpj}</td>
            <td className="drps-label" style={{ width: "20%" }}>Respondentes</td>
            <td style={{ width: "15%" }}>{totalRespondentes}</td>
          </tr>
          <tr>
            <td className="drps-label">Empresa</td>
            <td colSpan={3}>{empresaNome}</td>
          </tr>
          <tr>
            <td className="drps-label">Setor</td>
            <td colSpan={3}>{ehConsolidado ? "Todos os setores (consolidado)" : setor}</td>
          </tr>
          <tr>
            <td className="drps-header-section" colSpan={4}>Classificação de Risco Psicossocial</td>
          </tr>
          <tr>
            <td colSpan={4} className="text-center text-[11px] font-semibold uppercase tracking-wider" style={{ background: "var(--psi-label-bg)", color: "var(--psi-verde)" }}>
              Quantitativo e Qualitativo
            </td>
          </tr>
        </tbody>
      </table>

      <table className="drps-tabela mt-0">
        <thead>
          <tr>
            <th className="drps-label" style={{ width: "27%", textAlign: "left" }}>Fatores de Risco</th>
            <th className="drps-label" style={{ width: "35%", textAlign: "left" }}>Fontes Geradoras do Risco</th>
            <th className="drps-label" style={{ width: "11%" }}>
              Gravidade<br /><span className="text-[9px] font-normal italic">(Severidade)</span>
            </th>
            <th className="drps-label" style={{ width: "15%" }}>
              Probabilidade<br /><span className="text-[9px] font-normal italic">de Ocorrência</span>
            </th>
            <th className="drps-label" style={{ width: "12%" }}>Matriz de Risco</th>
          </tr>
        </thead>
        <tbody>
          {analise.map((c) => {
            const abertaCat = !!aberta[c.id_categoria];
            return (
              <Fragment key={c.id_categoria}>
                <tr>
                  <td className="text-[11px] text-gray-900">
                    <button
                      type="button"
                      onClick={() => setAberta((a) => ({ ...a, [c.id_categoria]: !abertaCat }))}
                      className="inline-flex items-start gap-1 text-left hover:underline"
                      title="Ver pergunta a pergunta"
                    >
                      {abertaCat ? <ChevronDown className="mt-0.5 size-3 shrink-0" /> : <ChevronRight className="mt-0.5 size-3 shrink-0" />}
                      <span>{c.nome}</span>
                    </button>
                  </td>
                  <td className="text-[10px] text-gray-700">
                    {canEdit ? (
                      <div className="print:hidden">
                        <FonteGeradoraCampo
                          padrao={c.fonteGeradora}
                          catalogo={catalogoFontes[c.id_categoria] ?? []}
                          valor={fontesDaCategoria(c)}
                          onChange={(lista) =>
                            patch({ fontes: { ...editor.fontes, [c.id_categoria]: lista } })
                          }
                          onNovas={(novas) => guardarFontesCatalogo.mutate({ chave: c.id_categoria, textos: novas })}
                        />
                      </div>
                    ) : null}
                    <div className={canEdit ? "hidden print:block" : undefined}>
                      {textoFontes(fontesDaCategoria(c)) || "—"}
                    </div>
                  </td>
                  <td className="text-center">
                    {c.gravidade ? (
                      <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ backgroundColor: c.gravidade.cor }} title={`média das gravidades ${c.mediaGravidade.toFixed(2)}`}>
                        {c.gravidade.texto}
                      </span>
                    ) : (
                      <span className="text-[10px] italic text-gray-400">sem resposta</span>
                    )}
                  </td>
                  <td className="text-center text-[10px] text-gray-700">
                    {canEdit ? (
                      <select
                        className="prob"
                        value={valorSelectProbabilidade(c, ehConsolidado)}
                        onChange={(e) => onProbabilidade(c.id_categoria, e.target.value)}
                        title={
                          c.probabilidadeOrigem === "setor"
                            ? "Ajuste deste setor"
                            : c.probabilidadeOrigem === "aplicacao"
                              ? "Probabilidade geral da aplicação"
                              : "Ainda não informada — vale Baixa"
                        }
                      >
                        {!ehConsolidado && (
                          <option value="geral" disabled={c.probabilidadeOrigem === "padrao"}>
                            = geral ({c.probabilidadeGeral == null ? "não informada" : rotuloProbabilidade(c.probabilidadeGeral)})
                          </option>
                        )}
                        {ehConsolidado && c.probabilidadeOrigem === "padrao" && (
                          <option value="padrao" disabled>não informada (vale Baixa)</option>
                        )}
                        <option value="1">Baixa</option>
                        <option value="2">Média</option>
                        <option value="3">Alta</option>
                      </select>
                    ) : (
                      c.classificacaoProbabilidade
                    )}
                    {c.probabilidadeOrigem === "padrao" && (
                      <div className="text-[9px] italic text-amber-700">não informada</div>
                    )}
                    {c.probabilidadeOrigem === "setor" && !ehConsolidado && (
                      <div className="text-[9px] italic text-gray-500">ajuste do setor</div>
                    )}
                  </td>
                  <td className="text-center">
                    {c.matriz ? (
                      <span className="inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold text-white" style={{ backgroundColor: c.corMatriz ?? undefined }}>
                        {c.matriz}
                      </span>
                    ) : (
                      <span className="text-[10px] italic text-gray-400">—</span>
                    )}
                  </td>
                </tr>
                {abertaCat && (
                  <tr className="sub">
                    <td colSpan={5}>
                      <table className="w-full">
                        <thead>
                          <tr className="text-left text-[9px] uppercase tracking-wide text-gray-500">
                            <th className="pr-2">#</th>
                            <th className="pr-2">Pergunta</th>
                            <th className="pr-2">Lógica</th>
                            <th className="pr-2 text-right">n</th>
                            <th className="pr-2 text-right">Média</th>
                            <th className="pr-2 text-right">Corrigida</th>
                            <th>Gravidade</th>
                          </tr>
                        </thead>
                        <tbody>
                          {c.perguntas.map((p) => (
                            <tr key={p.id_pergunta}>
                              <td className="pr-2 tabular-nums">{p.ordem}</td>
                              <td className="pr-2">{p.texto}</td>
                              <td className="pr-2 text-gray-500">{p.logica}</td>
                              <td className="pr-2 text-right tabular-nums">{p.n}</td>
                              <td className="pr-2 text-right tabular-nums">{p.n ? p.mediaBruta.toFixed(2) : "—"}</td>
                              <td className="pr-2 text-right tabular-nums">{p.n ? p.corrigida : "—"}</td>
                              <td>
                                {p.n ? (
                                  <span className="inline-flex rounded-full px-1.5 py-0 text-[9px] font-bold text-white" style={{ backgroundColor: p.gravidade.cor }}>
                                    {p.gravidade.texto}
                                  </span>
                                ) : (
                                  <span className="italic text-gray-400">sem resposta</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      <div className="mt-2 text-[9px] text-gray-500">
        {totalRespondentes} respondente(s) · {analise.length} categoria(s) · {comBase.length} com resposta
      </div>

      <table className="drps-tabela mt-2">
        <tbody>
          <tr>
            <td className="drps-header-section">Possíveis Agravos à Saúde Mental</td>
          </tr>
          <tr>
            <td className="align-top">
              <div className="mb-1 text-[9px] italic text-gray-600">
                Ex: tudo aquilo que pode acontecer com colaboradores se os riscos psicossociais não forem identificados e controlados.
              </div>
              <ComboTagInline
                opcoes={agravosOpcoes}
                selecionados={editor.agravosSel}
                extras={editor.agravosExtras}
                novoValor={editor.novoAgravo}
                onToggle={(item) =>
                  patch({ agravosSel: editor.agravosSel.includes(item) ? editor.agravosSel.filter((a) => a !== item) : [...editor.agravosSel, item] })
                }
                onAdd={() => {
                  const v = editor.novoAgravo.trim();
                  if (v) patch({ agravosExtras: [...editor.agravosExtras, v], novoAgravo: "" });
                }}
                onRemoveExtra={(i) => patch({ agravosExtras: editor.agravosExtras.filter((_, idx) => idx !== i) })}
                onNovoValor={(v) => patch({ novoAgravo: v })}
                placeholder="Buscar agravo na lista ou digitar e adicionar..."
                disabled={!canEdit}
              />
            </td>
          </tr>
          <tr>
            <td className="drps-header-section">Medidas de controle recomendadas (medidas que a empresa deve adotar)</td>
          </tr>
          <tr>
            <td className="align-top">
              <div className="mb-1 text-[9px] italic text-gray-600">
                Ex: medidas que a empresa deve adotar para controlar os riscos psicossociais identificados.
              </div>
              <ComboTagInline
                opcoes={medidasOpcoes}
                selecionados={editor.medidasSel}
                extras={editor.medidasExtras}
                novoValor={editor.novaMedida}
                onToggle={(item) =>
                  patch({ medidasSel: editor.medidasSel.includes(item) ? editor.medidasSel.filter((a) => a !== item) : [...editor.medidasSel, item] })
                }
                onAdd={() => {
                  const v = editor.novaMedida.trim();
                  if (v) patch({ medidasExtras: [...editor.medidasExtras, v], novaMedida: "" });
                }}
                onRemoveExtra={(i) => patch({ medidasExtras: editor.medidasExtras.filter((_, idx) => idx !== i) })}
                onNovoValor={(v) => patch({ novaMedida: v })}
                placeholder="Buscar medida na lista ou digitar e adicionar..."
                disabled={!canEdit}
              />
            </td>
          </tr>
        </tbody>
      </table>

      <table className="drps-tabela mt-2">
        <tbody>
          <tr>
            <td className="drps-header-section">
              <div className="flex items-center justify-between gap-2">
                <span>Conclusão</span>
                <button
                  type="button"
                  onClick={gerarConclusaoIA}
                  disabled={!canEdit || gerandoIA || comBase.length === 0}
                  title="Gerar conclusão técnica com IA a partir das categorias avaliadas, agravos e medidas"
                  className="inline-flex items-center gap-1 rounded-md bg-verde-primary px-2 py-1 text-[10px] font-semibold normal-case tracking-normal text-white shadow-sm hover:bg-verde-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {gerandoIA ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
                  {gerandoIA ? "Gerando..." : "Gerar com IA"}
                </button>
              </div>
            </td>
          </tr>
          <tr>
            <td className="align-top">
              <RichTextEditor
                value={textoLocal}
                onChange={(html) => setTextoLocal(html)}
                onBlur={() => {
                  if (canEdit && textoLocal !== conclusao) onSalvarConclusao(textoLocal);
                }}
                readOnly={!canEdit}
                uploadPathPrefix="qps-conclusao"
                placeholder={
                  canEdit
                    ? "Conclusão do psicólogo para o setor — clique para editar ou use 'Gerar com IA'."
                    : "Você não tem permissão para editar a conclusão."
                }
              />
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
