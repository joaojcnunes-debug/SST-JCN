"use client";

import {
  CheckCircle2,
  AlertTriangle,
  FileText,
  Plus,
  Trash2,
} from "lucide-react";
import type { FispqExtracted, ComponenteQuimico } from "@/lib/fispq/parser";

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
 * Mudança importante: componentes da mistura ficam em TABELA editável
 * (1 linha por componente, com nome + CAS + fórmula + concentração
 * visualmente ligados).
 */
export default function FispqReview({
  dados,
  onChange,
  disabled,
}: FispqReviewProps) {
  const patch = (campo: keyof FispqExtracted, valor: unknown) => {
    onChange({ ...dados, [campo]: valor });
  };

  // Lista TODOS os componentes (principal + adicionais) num único array
  // pra render. O 1º item é o "principal" (numero_cas/nome_quimico/etc.),
  // os demais vêm de cas_componentes.
  const componentes: ComponenteQuimico[] = [
    {
      cas: dados.numero_cas || "",
      nome: dados.nome_quimico,
      concentracao: dados.concentracao,
    },
    ...(dados.cas_componentes ?? []),
  ];

  const setComponente = (idx: number, patch: Partial<ComponenteQuimico>) => {
    const novos = componentes.map((c, i) =>
      i === idx ? { ...c, ...patch } : c
    );
    aplicarComponentes(novos);
  };

  const adicionarComponente = () => {
    aplicarComponentes([
      ...componentes,
      { cas: "", nome: undefined, concentracao: undefined },
    ]);
  };

  const removerComponente = (idx: number) => {
    aplicarComponentes(componentes.filter((_, i) => i !== idx));
  };

  /** Sincroniza o array `componentes` de volta em dados.numero_cas /
   *  nome_quimico / concentracao (principal) + dados.cas_componentes (resto). */
  const aplicarComponentes = (lista: ComponenteQuimico[]) => {
    const sem = lista.filter((c) => c.cas || c.nome || c.concentracao);
    const [principal, ...resto] = sem.length > 0 ? sem : [{ cas: "" }];
    onChange({
      ...dados,
      numero_cas: principal?.cas || undefined,
      nome_quimico: principal?.nome || undefined,
      concentracao: principal?.concentracao || undefined,
      cas_componentes: resto.length > 0 ? resto : undefined,
    });
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

      {/* Dados gerais do produto (1 por análise) */}
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
          <label className={lblCls}>Fórmula Química (do produto)</label>
          <input
            type="text"
            value={dados.formula_quimica ?? ""}
            onChange={(e) => patch("formula_quimica", e.target.value)}
            className={inputCls}
            placeholder="Ex: C7H8 (opcional)"
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
          <label className={lblCls}>Fabricante</label>
          <input
            type="text"
            value={dados.fabricante ?? ""}
            onChange={(e) => patch("fabricante", e.target.value || undefined)}
            className={inputCls}
            placeholder="(extraído da FISPQ)"
            disabled={disabled}
          />
        </div>
      </div>

      {/* Componentes — tabela editável */}
      <div className="rounded-lg border border-sky-200 bg-sky-50/30 p-3">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-sky-800">
              Componentes Químicos
            </p>
            <p className="text-[11px] text-gray-600">
              Cada linha = um componente da mistura. Nome, CAS e concentração
              ficam ligados visualmente.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-800">
            {componentes.length}
          </span>
        </div>

        <div className="overflow-x-auto rounded-md border border-sky-100 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-sky-100/60 text-left text-[10px] font-bold uppercase tracking-wider text-sky-800">
                <th className="px-2 py-1.5">Nome Químico</th>
                <th className="px-2 py-1.5 w-[160px]">Número CAS</th>
                <th className="px-2 py-1.5 w-[140px]">Concentração</th>
                <th className="px-2 py-1.5 w-[40px]"></th>
              </tr>
            </thead>
            <tbody>
              {componentes.map((c, idx) => (
                <tr
                  key={idx}
                  className={
                    idx % 2 === 0 ? "bg-white" : "bg-sky-50/30"
                  }
                >
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={c.nome ?? ""}
                      onChange={(e) =>
                        setComponente(idx, { nome: e.target.value || undefined })
                      }
                      className="w-full rounded border border-gray-200 px-2 py-1 text-sm focus:border-verde-primary focus:outline-none"
                      placeholder={idx === 0 ? "Ex: Tolueno" : ""}
                      disabled={disabled}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={c.cas}
                      onChange={(e) => setComponente(idx, { cas: e.target.value })}
                      className="w-full rounded border border-gray-200 px-2 py-1 font-mono text-sm focus:border-verde-primary focus:outline-none"
                      placeholder={idx === 0 ? "Ex: 108-88-3" : ""}
                      disabled={disabled}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={c.concentracao ?? ""}
                      onChange={(e) =>
                        setComponente(idx, {
                          concentracao: e.target.value || undefined,
                        })
                      }
                      className="w-full rounded border border-gray-200 px-2 py-1 text-sm focus:border-verde-primary focus:outline-none"
                      placeholder={idx === 0 ? "Ex: 60%" : ""}
                      disabled={disabled}
                    />
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {componentes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removerComponente(idx)}
                        disabled={disabled}
                        className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-alert disabled:opacity-50"
                        title="Remover componente"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button
          type="button"
          onClick={adicionarComponente}
          disabled={disabled}
          className="mt-2 inline-flex items-center gap-1 rounded-md bg-verde-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-verde-accent disabled:opacity-50"
        >
          <Plus className="size-3.5" />
          Adicionar componente
        </button>
      </div>

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
