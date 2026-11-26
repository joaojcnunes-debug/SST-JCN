"use client";

// 0.3.321 (pedido do João, 26/11/2026): a descrição de cada método (forma de realização, duração, avaliação de aprendizado
// e certificado), por modalidade. É o texto padrão que entra no Plano de intervenções; cada empresa pode ajustar o seu.

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { confirmar } from "@/components/ui/confirm";
import { useExcluirMetodoModalidade, useMetodosModalidade, useSalvarMetodoModalidade } from "@/lib/hooks/useComercial";
import { CAMPOS_METODO, rotuloModalidade, type MetodoModalidade } from "@/lib/comercial/plano";
import { acharNaLista } from "@/lib/comercial/liberacao";

const campo = "w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm focus:border-marca-primary focus:outline-none disabled:bg-gray-50";

export default function MetodosModalidade({ modalidades, podeEditar }: { modalidades: readonly string[]; podeEditar: boolean }) {
  const { data: metodos = [] } = useMetodosModalidade();
  const salvar = useSalvarMetodoModalidade();
  const excluir = useExcluirMetodoModalidade();
  const [nova, setNova] = useState("");
  const semDescricao = modalidades.filter((m) => acharNaLista(metodos.map((x) => x.modalidade), m) === undefined);

  const gravar = (m: MetodoModalidade, c: keyof MetodoModalidade, v: string) => {
    const t = v.trim() || null;
    if ((m[c] ?? null) === t) return;
    salvar.mutate({ ...m, [c]: t });
  };

  return (
    <section className="space-y-2 rounded-xl border border-gray-200 bg-white p-4">
      <div>
        <h2 className="text-base font-bold text-gray-900">Métodos por modalidade</h2>
        <p className="text-sm text-gray-500">
          Como cada modalidade é feita. Este texto entra na descrição dos métodos do Plano de intervenções da conciliação, e cada empresa
          pode ajustar o seu lá. Grava ao sair do campo.
        </p>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {metodos.map((m) => (
          <div key={m.modalidade} className="space-y-2 rounded-lg border border-gray-100 bg-gray-50/50 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-gray-800">{rotuloModalidade(m.modalidade)}</p>
              {podeEditar && (
                <button type="button" aria-label={`Excluir a descrição de ${m.modalidade}`} disabled={excluir.isPending}
                  onClick={async () => {
                    if (await confirmar({ title: `Excluir a descrição de ${rotuloModalidade(m.modalidade)}?`, description: "A modalidade continua; só o texto padrão sai.", confirmLabel: "Excluir", variant: "danger" })) excluir.mutate(m.modalidade);
                  }}
                  className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-700"><Trash2 className="size-4" /></button>
              )}
            </div>
            {CAMPOS_METODO.map(({ campo: c, rotulo }) => (
              <label key={c} className="block text-xs font-medium text-gray-600">
                {rotulo}
                <textarea key={`${m.modalidade}:${m[c] ?? ""}`} rows={2} defaultValue={m[c] ?? ""} disabled={!podeEditar}
                  onBlur={(e) => gravar(m, c, e.target.value)} className={campo} />
              </label>
            ))}
          </div>
        ))}
      </div>
      {podeEditar && semDescricao.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <select value={nova} onChange={(e) => setNova(e.target.value)} aria-label="Modalidade sem descrição" className="rounded-md border border-gray-200 px-2 py-1.5 text-sm">
            <option value="">Descrever outra modalidade…</option>
            {semDescricao.map((m) => <option key={m} value={m}>{rotuloModalidade(m)}</option>)}
          </select>
          <button type="button" disabled={!nova || salvar.isPending}
            onClick={() => { salvar.mutate({ modalidade: nova, forma: null, duracao: null, avaliacao: null, certificado: null, ordem: metodos.length + 1 }); setNova(""); }}
            className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-medium text-marca-primary ring-1 ring-marca-primary/30 hover:bg-marca-light/40 disabled:opacity-50">
            <Plus className="size-4" /> Adicionar
          </button>
        </div>
      )}
    </section>
  );
}
