"use client";

import { CheckCircle2, AlertTriangle, FileText } from "lucide-react";
import type { FispqExtracted } from "@/lib/fispq/parser";

interface FispqReviewProps {
  dados: FispqExtracted;
  onChange: (novos: FispqExtracted) => void;
  disabled?: boolean;
}

const lblCls =
  "text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1 block";
const inputCls =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary";

/**
 * UI pra usuário revisar/corrigir os dados extraídos da FISPQ ANTES de
 * mandar pra IA. Tudo é editável — se o parser errou, o usuário corrige.
 *
 * Princípio: a IA só recebe dados que o usuário CONFIRMOU. Reduz alucinação
 * (a IA não está inferindo nada do PDF) e reduz tokens (mandamos campos
 * estruturados em vez do PDF inteiro).
 */
export default function FispqReview({
  dados,
  onChange,
  disabled,
}: FispqReviewProps) {
  const patch = (campo: keyof FispqExtracted, valor: string | undefined) => {
    onChange({ ...dados, [campo]: valor });
  };

  const confiancaInfo = {
    alta: {
      icon: <CheckCircle2 className="size-4 text-emerald-600" />,
      cor: "border-emerald-300 bg-emerald-50 text-emerald-900",
      texto:
        "Parser conseguiu extrair os campos principais. Confira os valores e corrija se necessário antes de analisar.",
    },
    media: {
      icon: <AlertTriangle className="size-4 text-amber-600" />,
      cor: "border-amber-300 bg-amber-50 text-amber-900",
      texto:
        "Parser extraiu parte dos dados. Complete os campos vazios com base no que está na FISPQ antes de analisar.",
    },
    baixa: {
      icon: <AlertTriangle className="size-4 text-red-600" />,
      cor: "border-red-300 bg-red-50 text-red-900",
      texto:
        "Parser teve dificuldade — a FISPQ pode estar fora do padrão NBR 14725 ou ser escaneada. Preencha manualmente os campos.",
    },
  };

  const info = confiancaInfo[dados.confianca];

  return (
    <div className="space-y-4">
      {/* Indicador de confiança */}
      <div className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${info.cor}`}>
        {info.icon}
        <div>
          <p className="font-semibold">
            Dados extraídos da FISPQ — confiança {dados.confianca.toUpperCase()}
          </p>
          <p className="mt-0.5 text-xs">{info.texto}</p>
        </div>
      </div>

      {/* Campos editáveis principais */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label className={lblCls}>
            Nome do Produto <span className="text-red-alert">*</span>
          </label>
          <input
            type="text"
            value={dados.nome_produto ?? ""}
            onChange={(e) => patch("nome_produto", e.target.value)}
            className={inputCls}
            placeholder="Ex: Tíner para esmalte"
            disabled={disabled}
          />
        </div>

        <div>
          <label className={lblCls}>Nome Químico</label>
          <input
            type="text"
            value={dados.nome_quimico ?? ""}
            onChange={(e) => patch("nome_quimico", e.target.value)}
            className={inputCls}
            placeholder="Ex: Tolueno"
            disabled={disabled}
          />
        </div>

        <div>
          <label className={lblCls}>Número CAS (principal)</label>
          <input
            type="text"
            value={dados.numero_cas ?? ""}
            onChange={(e) => patch("numero_cas", e.target.value)}
            className={inputCls}
            placeholder="Ex: 108-88-3"
            disabled={disabled}
          />
        </div>

        <div>
          <label className={lblCls}>Fórmula Química</label>
          <input
            type="text"
            value={dados.formula_quimica ?? ""}
            onChange={(e) => patch("formula_quimica", e.target.value)}
            className={inputCls}
            placeholder="Ex: C7H8"
            disabled={disabled}
          />
        </div>

        <div>
          <label className={lblCls}>Forma Física</label>
          <select
            value={dados.forma_fisica ?? ""}
            onChange={(e) => patch("forma_fisica", e.target.value || undefined)}
            className={inputCls}
            disabled={disabled}
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
            value={dados.concentracao ?? ""}
            onChange={(e) => patch("concentracao", e.target.value)}
            className={inputCls}
            placeholder="Ex: 100%, 50 ppm, > 90% peso"
            disabled={disabled}
          />
        </div>
      </div>

      {/* CAS componentes (somente leitura) */}
      {dados.cas_componentes && dados.cas_componentes.length > 0 && (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
          <p className={lblCls + " mb-1"}>
            Componentes adicionais detectados (CAS)
          </p>
          <p className="text-sm text-gray-800">
            {dados.cas_componentes.map((c) => c.cas).join(" · ")}
          </p>
        </div>
      )}

      {/* GHS — Frases H + Pictogramas */}
      {((dados.frases_h && dados.frases_h.length > 0) ||
        (dados.pictogramas_ghs && dados.pictogramas_ghs.length > 0)) && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
          <p className={lblCls + " text-amber-800 mb-2"}>
            Classificação GHS detectada
          </p>
          {dados.frases_h && dados.frases_h.length > 0 && (
            <div className="mb-1.5">
              <span className="text-xs font-semibold text-amber-900">
                Frases H:{" "}
              </span>
              <span className="text-sm text-amber-900">
                {dados.frases_h.join(", ")}
              </span>
            </div>
          )}
          {dados.pictogramas_ghs && dados.pictogramas_ghs.length > 0 && (
            <div>
              <span className="text-xs font-semibold text-amber-900">
                Pictogramas:{" "}
              </span>
              <span className="text-sm text-amber-900">
                {dados.pictogramas_ghs.join(", ")}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Snippets editáveis das seções relevantes */}
      <details className="rounded-lg border border-gray-200 bg-white">
        <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
          <FileText className="inline size-3.5 mr-1" />
          Trechos extraídos da FISPQ (avançado — só edite se souber)
        </summary>
        <div className="space-y-3 border-t border-gray-100 p-3">
          <SnippetField
            label="Seção 2 — Identificação de Perigos"
            value={dados.snippet_perigos}
            onChange={(v) => patch("snippet_perigos", v)}
            disabled={disabled}
          />
          <SnippetField
            label="Seção 8 — Controle de Exposição"
            value={dados.snippet_exposicao}
            onChange={(v) => patch("snippet_exposicao", v)}
            disabled={disabled}
          />
          <SnippetField
            label="Seção 11 — Informações Toxicológicas"
            value={dados.snippet_toxicologia}
            onChange={(v) => patch("snippet_toxicologia", v)}
            disabled={disabled}
          />
        </div>
      </details>
    </div>
  );
}

function SnippetField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className={lblCls}>{label}</label>
      <textarea
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        rows={3}
        className={inputCls + " resize-y"}
        placeholder="(não encontrado — opcional)"
        disabled={disabled}
      />
    </div>
  );
}
