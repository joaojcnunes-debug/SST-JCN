"use client";

// 0.3.324 (pedido do João, 26/11/2026, desenho no Excel): a descrição do método fica no tópico 3, embaixo de cada
// intervenção — forma de realização, avaliação de aprendizado, duração e certificado. O texto padrão vem do catálogo
// (Métodos por modalidade) e o ajuste é daquela intervenção nesta empresa/grupo (comercial_planos.metodos,
// chave "<tema>::<modalidade>"). Grava ao sair do campo.

import { RotateCcw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { AlvoConciliacao } from "@/lib/hooks/useConciliacaoParecer";
import { useCatalogoIntervencoes, useMetodosModalidade, usePlanoIntervencoes, useSalvarPlanoIntervencoes } from "@/lib/hooks/useComercial";
import { chaveMetodo, metodoDe, planoVazio, type MetodoTexto, type PlanoIntervencoes } from "@/lib/comercial/plano";

/** Na ordem do desenho do pedido. */
const LINHAS: { campo: keyof MetodoTexto; rotulo: string }[] = [
  { campo: "forma", rotulo: "Forma de realização" },
  { campo: "avaliacao", rotulo: "Avaliação de aprendizado" },
  { campo: "duracao", rotulo: "Duração" },
  { campo: "certificado", rotulo: "Certificado" },
];

export default function MetodoDaIntervencao({
  alvo,
  tema,
  modalidade,
  podeAlterar,
}: {
  alvo: AlvoConciliacao;
  /** chaveTema da intervenção (lib/comercial/plano). */
  tema: string;
  modalidade: string | null;
  podeAlterar: boolean;
}) {
  const qc = useQueryClient();
  const { data: metodos = [] } = useMetodosModalidade();
  const { data: salvo } = usePlanoIntervencoes(alvo);
  // 0.3.330: o texto que a intervenção tem no catálogo vale antes do da modalidade (o tema é o id da intervenção).
  const { data: catalogo = [] } = useCatalogoIntervencoes();
  const doCatalogo = catalogo.find((c) => c.id_intervencao === tema)?.metodos ?? null;
  const salvar = useSalvarPlanoIntervencoes();
  const plano: PlanoIntervencoes = salvo ?? planoVazio(alvo.id, alvo.tipo);

  if (!modalidade) {
    return <p className="px-3 py-2 text-xs text-amber-700">Escolha a modalidade para aparecer a descrição do método.</p>;
  }

  const k = chaveMetodo(tema, modalidade);
  const texto = metodoDe(modalidade, metodos, plano, tema, doCatalogo);
  const ajustado = !!plano.metodos[k] || !!plano.metodos[modalidade];
  // Vários blocos gravam no mesmo plano: parte do que está no cache agora (a gravação é otimista), não do render.
  const atual = (): PlanoIntervencoes =>
    qc.getQueryData<PlanoIntervencoes | null>(["comercial-plano", alvo.tipo, alvo.id]) ?? plano;

  const ajustar = (c: keyof MetodoTexto, valor: string) => {
    const t = valor.trim();
    if (t === (texto[c] ?? "").trim()) return;
    const p = atual();
    salvar.mutate({ ...p, metodos: { ...p.metodos, [k]: { ...(p.metodos[k] ?? {}), [c]: t || null } } });
  };
  const voltar = () => {
    const p = atual();
    const resto = { ...p.metodos };
    delete resto[k];
    delete resto[modalidade];
    salvar.mutate({ ...p, metodos: resto });
  };

  return (
    <div className="divide-y divide-gray-200 border-t border-gray-200">
      {LINHAS.map(({ campo, rotulo }, n) => (
        <div key={campo} className="grid grid-cols-[11rem_1fr] items-stretch">
          <div className="flex items-start justify-between gap-1 border-r border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700">
            {rotulo}
            {n === 0 && ajustado && podeAlterar && (
              <button type="button" onClick={voltar} title="Volta ao texto do catálogo" className="inline-flex items-center gap-0.5 text-[10px] font-normal text-gray-500 hover:text-indigo-700">
                <RotateCcw className="size-3" /> padrão
              </button>
            )}
          </div>
          <textarea
            key={`${k}:${campo}:${texto[campo] ?? ""}`}
            rows={1}
            defaultValue={texto[campo] ?? ""}
            disabled={!podeAlterar}
            aria-label={`${rotulo} (${modalidade})`}
            placeholder={podeAlterar ? "Sem texto no catálogo — escreva aqui" : ""}
            onBlur={(e) => ajustar(campo, e.target.value)}
            className="field-sizing-content min-h-8 w-full resize-none bg-white px-3 py-1.5 text-sm text-gray-800 focus:bg-indigo-50/40 focus:outline-none disabled:bg-white disabled:text-gray-700"
          />
        </div>
      ))}
    </div>
  );
}
