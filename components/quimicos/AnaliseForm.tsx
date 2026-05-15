"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FlaskConical,
  FileText,
  Pencil,
  Loader2,
  Sparkles,
  CheckCircle2,
  Database,
  Plus,
  Trash2,
} from "lucide-react";
import toast from "react-hot-toast";
import EmpresaSelect from "@/components/empresas/EmpresaSelect";
import PdfDropzone, { type PdfArquivo } from "./PdfDropzone";
import FispqReview from "./FispqReview";
import { useEmpresas } from "@/lib/hooks/useEmpresas";
import { useGerarAnaliseQuimico } from "@/lib/hooks/useAnalisesQuimicos";
import { useBaseReferenciaQuimicosMerged } from "@/lib/hooks/useBaseReferenciaQuimicos";
import { montarContextoFispq, type FispqExtracted } from "@/lib/fispq/parser";
import {
  buscarComponentes,
  piorCasoMistura,
  resumirAgente,
} from "@/lib/quimicos/lookup";
import type {
  CondicoesUsoQuimico,
  ComponenteQuimico,
} from "@/lib/supabase/types";

type Modo = "PDF" | "Manual";

/** Dados gerais do produto no modo Manual. Componentes ficam separados. */
interface DadosManuais {
  nome_produto: string;
  forma_fisica: string;
}

const DADOS_INIT: DadosManuais = {
  nome_produto: "",
  forma_fisica: "",
};

const COMPONENTE_VAZIO: ComponenteQuimico = {
  nome_quimico: "",
  numero_cas: "",
  formula_quimica: "",
  concentracao: "",
};

const CONDICOES_INIT: CondicoesUsoQuimico = {
  atividade: "",
  frequencia: "",
  duracao: "",
  ventilacao: "",
  geracao_nevoa_vapor: "",
  epis_utilizados: "",
};

const lblCls =
  "text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1 block";
const inputCls =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary";

export default function AnaliseForm() {
  const router = useRouter();
  const { data: empresas = [] } = useEmpresas();
  const [modo, setModo] = useState<Modo>("PDF");
  const [idEmpresa, setIdEmpresa] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<PdfArquivo | null>(null);
  const [fispqDados, setFispqDados] = useState<FispqExtracted | null>(null);
  const [dados, setDados] = useState<DadosManuais>(DADOS_INIT);
  const [componentes, setComponentes] = useState<ComponenteQuimico[]>([
    { ...COMPONENTE_VAZIO },
  ]);
  const [condicoes, setCondicoes] = useState<CondicoesUsoQuimico>(CONDICOES_INIT);
  const [showCondicoes, setShowCondicoes] = useState(false);

  const gerar = useGerarAnaliseQuimico();
  const baseRef = useBaseReferenciaQuimicosMerged();

  const empresaSel = empresas.find((e) => e.id_empresa === idEmpresa) ?? null;

  // ----- Lista de componentes consolidada (modo PDF: principal + adicionais) -----
  const componentesMistura = useMemo(() => {
    if (modo === "PDF" && fispqDados) {
      const lista: Array<{ nome: string | null; cas: string | null; concentracao: string | null }> = [];
      if (fispqDados.numero_cas || fispqDados.nome_quimico) {
        lista.push({
          nome: fispqDados.nome_quimico ?? null,
          cas: fispqDados.numero_cas ?? null,
          concentracao: fispqDados.concentracao ?? null,
        });
      }
      for (const c of fispqDados.cas_componentes ?? []) {
        lista.push({
          nome: c.nome ?? null,
          cas: c.cas ?? null,
          concentracao: c.concentracao ?? null,
        });
      }
      return lista;
    }
    return componentes.map((c) => ({
      nome: c.nome_quimico ?? null,
      cas: c.numero_cas ?? null,
      concentracao: c.concentracao ?? null,
    }));
  }, [modo, fispqDados, componentes]);

  // ----- Lookup determinístico na base de referência -----
  // Procura TODOS os componentes da mistura na base. Se 2+ casarem, agrega
  // pior caso pra mandar pra IA como "ground truth".
  const hitsBase = useMemo(
    () =>
      buscarComponentes(
        componentesMistura.map((c) => ({ cas: c.cas, nome: c.nome })),
        baseRef
      ),
    [componentesMistura, baseRef]
  );

  const dadosBase = useMemo(() => {
    if (hitsBase.length > 0) return piorCasoMistura(hitsBase);
    // Fallback final: nome do produto inteiro (Manual mode)
    if (modo === "Manual" && dados.nome_produto.trim()) {
      const hit = buscarComponentes(
        [{ cas: null, nome: dados.nome_produto }],
        baseRef
      );
      return piorCasoMistura(hit);
    }
    return null;
  }, [hitsBase, modo, dados.nome_produto, baseRef]);

  const dadosBaseLista = useMemo(
    () => hitsBase.map((h) => h.agente),
    [hitsBase]
  );

  // Quando upload do PDF acontece, pre-popula os dados FispqReview
  function handlePdfChange(novo: PdfArquivo | null) {
    setPdfFile(novo);
    setFispqDados(novo ? novo.parsed : null);
  }

  function handleSubmit() {
    // PDF mode: usa dados revisados do FispqReview
    if (modo === "PDF") {
      if (!pdfFile || !fispqDados) {
        toast.error("Faça upload de um PDF antes de analisar");
        return;
      }
      if (!fispqDados.nome_produto?.trim() && !fispqDados.nome_quimico?.trim()) {
        toast.error(
          "Os dados do produto estão vazios. Preencha pelo menos Nome do Produto ou Nome Químico antes de analisar."
        );
        return;
      }
    } else {
      // Manual mode: pelo menos o nome do produto OU 1 componente com nome
      const algumComponente = componentes.some(
        (c) => (c.nome_quimico ?? "").trim()
      );
      if (!dados.nome_produto.trim() && !algumComponente) {
        toast.error(
          "Informe o Nome do Produto ou pelo menos 1 componente com Nome Químico"
        );
        return;
      }
    }

    // Limpa componentes (remove os totalmente vazios + trim)
    const componentesLimpos: ComponenteQuimico[] = componentes
      .map((c) => ({
        nome_quimico: (c.nome_quimico ?? "").trim() || null,
        numero_cas: (c.numero_cas ?? "").trim() || null,
        formula_quimica: (c.formula_quimica ?? "").trim() || null,
        concentracao: (c.concentracao ?? "").trim() || null,
      }))
      .filter(
        (c) =>
          c.nome_quimico || c.numero_cas || c.formula_quimica || c.concentracao
      );

    // Monta título
    const titulo = (() => {
      if (modo === "PDF" && fispqDados) {
        return (
          fispqDados.nome_produto ||
          fispqDados.nome_quimico ||
          pdfFile?.nome.replace(/\.pdf$/i, "") ||
          "Análise química"
        );
      }
      return (
        dados.nome_produto.trim() ||
        componentesLimpos[0]?.nome_quimico ||
        "Análise química"
      );
    })();

    // Limpa condições vazias
    const condClean: CondicoesUsoQuimico | null = (() => {
      const c: CondicoesUsoQuimico = {};
      let temAlgo = false;
      (Object.keys(condicoes) as (keyof CondicoesUsoQuimico)[]).forEach((k) => {
        const v = (condicoes[k] ?? "").trim();
        if (v) {
          c[k] = v;
          temAlgo = true;
        }
      });
      return temAlgo ? c : null;
    })();

    // Monta payload pra mutation.
    // Para misturas (2+ componentes), os campos singulares (nome_quimico,
    // numero_cas, formula_quimica, concentracao) viram strings "; "-joined
    // que o RelatorioEstruturado reconstrói como tabela.
    const payloadDados = (() => {
      if (modo === "PDF" && fispqDados) {
        // Junta principal + cas_componentes adicionais
        const todos = [
          ...(fispqDados.numero_cas || fispqDados.nome_quimico
            ? [
                {
                  nome: fispqDados.nome_quimico ?? null,
                  cas: fispqDados.numero_cas ?? null,
                  formula: fispqDados.formula_quimica ?? null,
                  concentracao: fispqDados.concentracao ?? null,
                },
              ]
            : []),
          ...(fispqDados.cas_componentes ?? []).map((c) => ({
            nome: c.nome ?? null,
            cas: c.cas ?? null,
            formula: null as string | null,
            concentracao: c.concentracao ?? null,
          })),
        ];
        const joinKey = (k: "nome" | "cas" | "formula" | "concentracao") => {
          const vals = todos
            .map((c) => c[k])
            .filter((v): v is string => !!v && v.trim().length > 0);
          if (vals.length === 0) return null;
          if (vals.length === 1) return vals[0];
          return vals.join("; ");
        };
        return {
          nome_produto: fispqDados.nome_produto?.trim() || null,
          nome_quimico: joinKey("nome"),
          numero_cas: joinKey("cas"),
          formula_quimica: joinKey("formula"),
          forma_fisica: fispqDados.forma_fisica?.trim() || null,
          concentracao: joinKey("concentracao"),
        };
      }
      // Manual mode
      const primeiro = componentesLimpos[0];
      const juntar = (k: keyof ComponenteQuimico): string | null => {
        const vals = componentesLimpos
          .map((c) => c[k])
          .filter((v): v is string => !!v);
        if (vals.length === 0) return null;
        if (vals.length === 1) return vals[0];
        return vals.join("; ");
      };
      return {
        nome_produto: dados.nome_produto.trim() || null,
        nome_quimico: juntar("nome_quimico") ?? primeiro?.nome_quimico ?? null,
        numero_cas: juntar("numero_cas") ?? primeiro?.numero_cas ?? null,
        formula_quimica:
          juntar("formula_quimica") ?? primeiro?.formula_quimica ?? null,
        forma_fisica: dados.forma_fisica.trim() || null,
        concentracao:
          juntar("concentracao") ?? primeiro?.concentracao ?? null,
      };
    })();

    // Contexto FISPQ compacto (só no modo PDF, com snippets de seções relevantes)
    const contextoFispq =
      modo === "PDF" && fispqDados ? montarContextoFispq(fispqDados) : null;

    gerar.mutate(
      {
        modo,
        titulo,
        id_empresa: idEmpresa,
        empresa_nome: empresaSel?.nome_empresa ?? null,
        // No modo PDF nao mandamos mais o texto inteiro - usamos os dados
        // extraidos + snippets curtos das secoes relevantes (contexto_fispq).
        // Mantemos o texto bruto so para gravar em texto_extraido (auditoria).
        texto_documento: modo === "PDF" ? pdfFile?.texto ?? null : null,
        fonte_arquivo: modo === "PDF" ? pdfFile?.nome ?? null : null,
        contexto_fispq: contextoFispq,
        // Dados da BASE LOCAL — campos regulatórios determinísticos. A IA
        // recebe esses dados como "ground truth" e não pode contradizer.
        // `dados_base` = pior-caso da mistura (agregado).
        // `dados_base_componentes` = lista completa, item a item — pra IA
        //  poder citar cada componente individualmente na fundamentação.
        dados_base: dadosBase ?? null,
        dados_base_componentes:
          dadosBaseLista.length > 0 ? dadosBaseLista : null,
        // Array de componentes (mistura). No PDF, vem do parser/review;
        // no Manual, vem do form múltiplo.
        componentes:
          modo === "PDF" && fispqDados
            ? [
                // 1o componente vem do principal (numero_cas/nome_quimico)
                ...(fispqDados.numero_cas || fispqDados.nome_quimico
                  ? [
                      {
                        nome_quimico: fispqDados.nome_quimico ?? null,
                        numero_cas: fispqDados.numero_cas ?? null,
                        formula_quimica: fispqDados.formula_quimica ?? null,
                        concentracao: fispqDados.concentracao ?? null,
                      },
                    ]
                  : []),
                // Adicionais vêm de cas_componentes
                ...(fispqDados.cas_componentes ?? []).map((c) => ({
                  nome_quimico: c.nome ?? null,
                  numero_cas: c.cas ?? null,
                  formula_quimica: null,
                  concentracao: c.concentracao ?? null,
                })),
              ]
            : componentesLimpos.length > 0
            ? componentesLimpos
            : null,
        ...payloadDados,
        condicoes_uso: condClean,
      },
      {
        onSuccess: (registro) => {
          toast.success("Análise gerada");
          router.push(`/analise-quimicos/${registro.id_analise}`);
        },
        onError: (e: Error) =>
          toast.error(e.message || "Falha ao gerar análise"),
      }
    );
  }

  return (
    <div className="space-y-5">
      {/* Empresa (opcional) */}
      <div>
        <label className={lblCls}>Empresa (opcional)</label>
        <EmpresaSelect
          value={idEmpresa}
          onChange={setIdEmpresa}
          placeholder="Análise geral (sem empresa) ou selecione..."
          disabled={gerar.isPending}
        />
      </div>

      {/* Seletor de modo */}
      <div>
        <label className={lblCls}>Modo de entrada</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setModo("PDF")}
            disabled={gerar.isPending}
            className={`flex items-center justify-center gap-2 rounded-md border-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
              modo === "PDF"
                ? "border-verde-primary bg-verde-light/30 text-verde-primary"
                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            <FileText className="size-4" />
            FDS / FISPQ (PDF)
          </button>
          <button
            type="button"
            onClick={() => setModo("Manual")}
            disabled={gerar.isPending}
            className={`flex items-center justify-center gap-2 rounded-md border-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
              modo === "Manual"
                ? "border-verde-primary bg-verde-light/30 text-verde-primary"
                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Pencil className="size-4" />
            Entrada Manual
          </button>
        </div>
      </div>

      {/* Modo PDF: upload → revisão dos dados extraídos */}
      {modo === "PDF" && (
        <div className="space-y-4">
          <div>
            <label className={lblCls}>Arquivo da FDS/FISPQ</label>
            <PdfDropzone
              file={pdfFile}
              onChange={handlePdfChange}
              disabled={gerar.isPending}
            />
          </div>

          {fispqDados && (
            <div className="rounded-xl border-2 border-sky-200 bg-sky-50/30 p-4">
              <FispqReview
                dados={fispqDados}
                onChange={setFispqDados}
                disabled={gerar.isPending}
              />
            </div>
          )}
        </div>
      )}

      {/* Modo Manual: dados gerais do produto + array de componentes químicos */}
      {modo === "Manual" && (
        <div className="space-y-4">
          {/* Dados gerais (uma instância por análise) */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className={lblCls}>
                Nome do Produto <span className="text-red-alert">*</span>
              </label>
              <input
                type="text"
                value={dados.nome_produto}
                onChange={(e) =>
                  setDados((d) => ({ ...d, nome_produto: e.target.value }))
                }
                className={inputCls}
                placeholder="Ex: Tíner para esmalte (produto comercial)"
                disabled={gerar.isPending}
              />
            </div>
            <div>
              <label className={lblCls}>Forma Física (do produto)</label>
              <select
                value={dados.forma_fisica}
                onChange={(e) =>
                  setDados((d) => ({ ...d, forma_fisica: e.target.value }))
                }
                className={inputCls}
                disabled={gerar.isPending}
              >
                <option value="">—</option>
                <option value="Líquido">Líquido</option>
                <option value="Sólido">Sólido</option>
                <option value="Gás">Gás</option>
                <option value="Vapor">Vapor</option>
                <option value="Aerossol">Aerossol</option>
                <option value="Pó">Pó</option>
                <option value="Pasta">Pasta</option>
              </select>
            </div>
          </div>

          {/* Componentes químicos — 1 ou mais (mistura) */}
          <div className="rounded-lg border border-sky-200 bg-sky-50/30 p-3">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-sky-800">
                  Componentes Químicos
                </p>
                <p className="text-[11px] text-gray-600">
                  Adicione um por componente da mistura (ex: tíner pode ter
                  tolueno + acetona + xileno).
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-800">
                {componentes.length}
              </span>
            </div>

            <div className="space-y-2">
              {componentes.map((c, idx) => (
                <div
                  key={idx}
                  className="rounded-md border border-sky-100 bg-white p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-700">
                      Componente {idx + 1}
                    </p>
                    {componentes.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setComponentes((arr) =>
                            arr.filter((_, i) => i !== idx)
                          )
                        }
                        disabled={gerar.isPending}
                        className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-alert disabled:opacity-50"
                        title="Remover componente"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <div>
                      <label className={lblCls}>Nome Químico</label>
                      <input
                        type="text"
                        value={c.nome_quimico ?? ""}
                        onChange={(e) =>
                          setComponentes((arr) =>
                            arr.map((it, i) =>
                              i === idx
                                ? { ...it, nome_quimico: e.target.value }
                                : it
                            )
                          )
                        }
                        className={inputCls}
                        placeholder="Ex: Tolueno"
                        disabled={gerar.isPending}
                      />
                    </div>
                    <div>
                      <label className={lblCls}>Número CAS</label>
                      <input
                        type="text"
                        value={c.numero_cas ?? ""}
                        onChange={(e) =>
                          setComponentes((arr) =>
                            arr.map((it, i) =>
                              i === idx
                                ? { ...it, numero_cas: e.target.value }
                                : it
                            )
                          )
                        }
                        className={inputCls}
                        placeholder="Ex: 108-88-3"
                        disabled={gerar.isPending}
                      />
                    </div>
                    <div>
                      <label className={lblCls}>Fórmula Química</label>
                      <input
                        type="text"
                        value={c.formula_quimica ?? ""}
                        onChange={(e) =>
                          setComponentes((arr) =>
                            arr.map((it, i) =>
                              i === idx
                                ? { ...it, formula_quimica: e.target.value }
                                : it
                            )
                          )
                        }
                        className={inputCls}
                        placeholder="Ex: C7H8"
                        disabled={gerar.isPending}
                      />
                    </div>
                    <div>
                      <label className={lblCls}>Concentração</label>
                      <input
                        type="text"
                        value={c.concentracao ?? ""}
                        onChange={(e) =>
                          setComponentes((arr) =>
                            arr.map((it, i) =>
                              i === idx
                                ? { ...it, concentracao: e.target.value }
                                : it
                            )
                          )
                        }
                        className={inputCls}
                        placeholder="Ex: 60%, 25-50%, > 90% peso"
                        disabled={gerar.isPending}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                setComponentes((arr) => [...arr, { ...COMPONENTE_VAZIO }])
              }
              disabled={gerar.isPending}
              className="mt-2 inline-flex items-center gap-1 rounded-md bg-verde-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-verde-accent disabled:opacity-50"
            >
              <Plus className="size-3.5" />
              Adicionar componente
            </button>
          </div>
        </div>
      )}

      {/* Condições de uso (opcional, colapsável) */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
        <button
          type="button"
          onClick={() => setShowCondicoes((v) => !v)}
          className="flex w-full items-center justify-between text-left text-sm font-semibold text-gray-700"
        >
          <span>Condições de Uso (opcional)</span>
          <span className="text-xs text-gray-500">
            {showCondicoes ? "Ocultar ▲" : "Expandir ▼"}
          </span>
        </button>

        {showCondicoes && (
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className={lblCls}>Atividade / Processo</label>
              <input
                type="text"
                value={condicoes.atividade ?? ""}
                onChange={(e) =>
                  setCondicoes((c) => ({ ...c, atividade: e.target.value }))
                }
                className={inputCls}
                placeholder="Ex: Pintura por pistola"
                disabled={gerar.isPending}
              />
            </div>
            <div>
              <label className={lblCls}>Frequência de exposição</label>
              <input
                type="text"
                value={condicoes.frequencia ?? ""}
                onChange={(e) =>
                  setCondicoes((c) => ({ ...c, frequencia: e.target.value }))
                }
                className={inputCls}
                placeholder="Ex: Diária, 3x por semana"
                disabled={gerar.isPending}
              />
            </div>
            <div>
              <label className={lblCls}>Duração por turno</label>
              <input
                type="text"
                value={condicoes.duracao ?? ""}
                onChange={(e) =>
                  setCondicoes((c) => ({ ...c, duracao: e.target.value }))
                }
                className={inputCls}
                placeholder="Ex: 4 horas / turno"
                disabled={gerar.isPending}
              />
            </div>
            <div>
              <label className={lblCls}>Tipo de ventilação</label>
              <input
                type="text"
                value={condicoes.ventilacao ?? ""}
                onChange={(e) =>
                  setCondicoes((c) => ({ ...c, ventilacao: e.target.value }))
                }
                className={inputCls}
                placeholder="Ex: Natural, exaustão local"
                disabled={gerar.isPending}
              />
            </div>
            <div>
              <label className={lblCls}>Geração de névoa/vapor</label>
              <input
                type="text"
                value={condicoes.geracao_nevoa_vapor ?? ""}
                onChange={(e) =>
                  setCondicoes((c) => ({
                    ...c,
                    geracao_nevoa_vapor: e.target.value,
                  }))
                }
                className={inputCls}
                placeholder="Ex: Alta, baixa, eventual"
                disabled={gerar.isPending}
              />
            </div>
            <div>
              <label className={lblCls}>EPIs já utilizados</label>
              <input
                type="text"
                value={condicoes.epis_utilizados ?? ""}
                onChange={(e) =>
                  setCondicoes((c) => ({
                    ...c,
                    epis_utilizados: e.target.value,
                  }))
                }
                className={inputCls}
                placeholder="Ex: Respirador PFF2, luva nitrílica"
                disabled={gerar.isPending}
              />
            </div>
          </div>
        )}
      </div>

      {/* Banner — Encontrado(s) na base de referência */}
      {hitsBase.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
          <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-emerald-600" />
          <div className="flex-1">
            <p className="font-semibold">
              <Database className="inline size-3.5 mr-1" />
              {hitsBase.length === 1
                ? "Encontrado na base de referência Chabra"
                : `${hitsBase.length} componentes encontrados na base de referência Chabra`}
            </p>
            <ul className="mt-1 space-y-0.5 text-xs">
              {hitsBase.map((h, i) => (
                <li key={i}>
                  <strong>{h.agente.agente}</strong>
                  <span className="text-emerald-700">
                    {" "}
                    ({h.fonte === "cas" ? "por CAS" : "por nome"})
                  </span>
                  {" — "}
                  {resumirAgente(h.agente)}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-[11px] text-emerald-700">
              {hitsBase.length === 1
                ? "Os campos regulatórios (insalubridade, grau, eSocial, Decreto, IARC) virão da nossa base oficial."
                : "Os campos regulatórios virão da base oficial — em mistura, o pior caso é o critério de enquadramento, e os códigos eSocial/Decreto/GFIP são listados por componente."}{" "}
              A IA só preenche EPIs, medidas, emergência e fundamentação técnica.
            </p>
          </div>
        </div>
      )}

      {/* Aviso geral */}
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
        <p>
          <strong>⚠️ Lembrete:</strong> a IA usa modelo open-source sem busca
          web. Para químicos fora da base interna, códigos eSocial, Decreto
          3.048 e GFIP devem ser confirmados em tabela oficial antes de emissão
          de PPP/LTCAT.
        </p>
      </div>

      {/* Ação */}
      <div className="flex justify-end border-t border-gray-100 pt-4">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={gerar.isPending}
          className="inline-flex items-center gap-2 rounded-md bg-verde-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-verde-accent disabled:opacity-50"
        >
          {gerar.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Analisando produto... (5-15s)
            </>
          ) : (
            <>
              <Sparkles className="size-4" />
              <FlaskConical className="size-4" />
              Analisar Produto Químico
            </>
          )}
        </button>
      </div>
    </div>
  );
}
