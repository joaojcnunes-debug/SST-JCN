"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical, FileText, Pencil, Loader2, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import EmpresaSelect from "@/components/empresas/EmpresaSelect";
import PdfDropzone from "./PdfDropzone";
import { useEmpresas } from "@/lib/hooks/useEmpresas";
import { useGerarAnaliseQuimico } from "@/lib/hooks/useAnalisesQuimicos";
import type { CondicoesUsoQuimico } from "@/lib/supabase/types";

type Modo = "PDF" | "Manual";

interface DadosManuais {
  nome_produto: string;
  nome_quimico: string;
  numero_cas: string;
  formula_quimica: string;
  forma_fisica: string;
  concentracao: string;
}

const DADOS_INIT: DadosManuais = {
  nome_produto: "",
  nome_quimico: "",
  numero_cas: "",
  formula_quimica: "",
  forma_fisica: "",
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
  const [pdfFile, setPdfFile] = useState<{ nome: string; texto: string } | null>(
    null
  );
  const [dados, setDados] = useState<DadosManuais>(DADOS_INIT);
  const [condicoes, setCondicoes] = useState<CondicoesUsoQuimico>(CONDICOES_INIT);
  const [showCondicoes, setShowCondicoes] = useState(false);

  const gerar = useGerarAnaliseQuimico();

  const empresaSel = empresas.find((e) => e.id_empresa === idEmpresa) ?? null;

  function handleSubmit() {
    if (modo === "PDF" && !pdfFile) {
      toast.error("Faça upload de um PDF antes de analisar");
      return;
    }
    if (modo === "Manual" && !dados.nome_produto.trim() && !dados.nome_quimico.trim()) {
      toast.error("Informe ao menos o Nome do Produto ou Nome Químico");
      return;
    }

    const titulo =
      modo === "Manual"
        ? dados.nome_produto.trim() ||
          dados.nome_quimico.trim() ||
          "Análise química"
        : pdfFile?.nome.replace(/\.pdf$/i, "") || "Análise química";

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

    gerar.mutate(
      {
        modo,
        titulo,
        id_empresa: idEmpresa,
        empresa_nome: empresaSel?.nome_empresa ?? null,
        texto_documento: modo === "PDF" ? pdfFile?.texto ?? null : null,
        fonte_arquivo: modo === "PDF" ? pdfFile?.nome ?? null : null,
        nome_produto: modo === "Manual" ? dados.nome_produto.trim() || null : null,
        nome_quimico: modo === "Manual" ? dados.nome_quimico.trim() || null : null,
        numero_cas: modo === "Manual" ? dados.numero_cas.trim() || null : null,
        formula_quimica:
          modo === "Manual" ? dados.formula_quimica.trim() || null : null,
        forma_fisica: modo === "Manual" ? dados.forma_fisica.trim() || null : null,
        concentracao: modo === "Manual" ? dados.concentracao.trim() || null : null,
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

      {/* Modo PDF */}
      {modo === "PDF" && (
        <div>
          <label className={lblCls}>Arquivo da FDS/FISPQ</label>
          <PdfDropzone
            file={pdfFile}
            onChange={setPdfFile}
            disabled={gerar.isPending}
          />
        </div>
      )}

      {/* Modo Manual */}
      {modo === "Manual" && (
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
              placeholder="Ex: Tíner para esmalte"
              disabled={gerar.isPending}
            />
          </div>
          <div>
            <label className={lblCls}>Nome Químico</label>
            <input
              type="text"
              value={dados.nome_quimico}
              onChange={(e) =>
                setDados((d) => ({ ...d, nome_quimico: e.target.value }))
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
              value={dados.numero_cas}
              onChange={(e) =>
                setDados((d) => ({ ...d, numero_cas: e.target.value }))
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
              value={dados.formula_quimica}
              onChange={(e) =>
                setDados((d) => ({ ...d, formula_quimica: e.target.value }))
              }
              className={inputCls}
              placeholder="Ex: C7H8"
              disabled={gerar.isPending}
            />
          </div>
          <div>
            <label className={lblCls}>Forma Física</label>
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
          <div>
            <label className={lblCls}>Concentração</label>
            <input
              type="text"
              value={dados.concentracao}
              onChange={(e) =>
                setDados((d) => ({ ...d, concentracao: e.target.value }))
              }
              className={inputCls}
              placeholder="Ex: 100%, 50 ppm, > 90% peso"
              disabled={gerar.isPending}
            />
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

      {/* Aviso */}
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
        <p>
          <strong>⚠️ Lembrete:</strong> a IA usa modelo open-source sem busca
          web. Códigos eSocial, Decreto 3.048 e GFIP devem ser confirmados em
          tabela oficial antes de emissão de PPP/LTCAT.
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
              Analisando produto... (10-30s)
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
