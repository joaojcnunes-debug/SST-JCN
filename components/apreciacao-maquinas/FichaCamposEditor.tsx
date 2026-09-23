"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import toast from "react-hot-toast";
import { useAtualizarFicha } from "@/lib/hooks/useFichasMaquina";
import OperadoresEditor from "@/components/apreciacao-maquinas/OperadoresEditor";
import type { FichaMaquina, OperadorFicha } from "@/lib/supabase/types";

const areaClass =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-xs focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:bg-gray-50 disabled:text-gray-500";

/**
 * Campos de texto da MÁQUINA (não do laudo): constatações de campo, parecer
 * técnico e operadores. São o que a ficha imprime acima e abaixo da tabela HRN.
 *
 * O estado é re-sincronizado quando a máquina ativa muda — sem isso, trocar de
 * máquina no painel deixaria o texto da anterior na tela e o salvamento
 * gravaria na máquina errada.
 */
export default function FichaCamposEditor({
  ficha,
  idApreciacao,
  disabled = false,
}: {
  ficha: FichaMaquina;
  idApreciacao: string;
  disabled?: boolean;
}) {
  const atualizar = useAtualizarFicha(idApreciacao);
  const [constatacoes, setConstatacoes] = useState("");
  const [parecer, setParecer] = useState("");
  const [operadores, setOperadores] = useState<OperadorFicha[] | null>(null);

  useEffect(() => {
    setConstatacoes(ficha.constatacoes_inspecao ?? "");
    setParecer(ficha.parecer_tecnico ?? "");
    setOperadores(ficha.operadores ?? null);
  }, [ficha]);

  const sujo =
    constatacoes !== (ficha.constatacoes_inspecao ?? "")
    || parecer !== (ficha.parecer_tecnico ?? "")
    || JSON.stringify(operadores ?? null) !== JSON.stringify(ficha.operadores ?? null);

  async function salvar() {
    try {
      await atualizar.mutateAsync({
        id_ficha: ficha.id_ficha,
        constatacoes_inspecao: constatacoes.trim() || null,
        parecer_tecnico: parecer.trim() || null,
        // Descarta linha em branco deixada pelo botão "Adicionar operador".
        operadores:
          operadores?.filter((o) => (o.nome ?? "").trim() || (o.cargo ?? "").trim()) ?? null,
      });
      toast.success("Máquina salva");
    } catch {
      // erro tratado no hook
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-gray-600">
          Operadores / Responsáveis
        </label>
        <OperadoresEditor valor={operadores} onChange={setOperadores} disabled={disabled} />
      </div>

      <div>
        <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-gray-600">
          Constatações da inspeção
        </label>
        <textarea
          rows={3}
          value={constatacoes}
          onChange={(e) => setConstatacoes(e.target.value)}
          disabled={disabled}
          placeholder="O que foi verificado em campo nesta máquina (proteções, sinalização, estado de conservação...)"
          className={areaClass}
        />
      </div>

      <div>
        <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-gray-600">
          Parecer técnico desta máquina
        </label>
        <textarea
          rows={3}
          value={parecer}
          onChange={(e) => setParecer(e.target.value)}
          disabled={disabled}
          placeholder="Conclusão sobre esta máquina, citando o maior risco residual..."
          className={areaClass}
        />
        <p className="mt-0.5 text-[10px] text-gray-400">
          Sai no fim da ficha. A conclusão GERAL do laudo é outra, na seção de conclusão.
        </p>
      </div>

      {!disabled && sujo && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={salvar}
            disabled={atualizar.isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {atualizar.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            Salvar máquina
          </button>
        </div>
      )}
    </div>
  );
}
