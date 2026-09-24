"use client";

import { useEffect, useState } from "react";
import { RotateCcw, Save } from "lucide-react";
import { useCadastroDimensionamento } from "@/lib/hooks/useDimensionamento";
import { useMutacoesDimensionamento } from "@/lib/hooks/useDimensionamentoMutacoes";
import { PARAMETROS_PADRAO } from "@/lib/dimensionamento/mapear";
import Calculo from "@/lib/dimensionamento/calculo";
import { Cabecalho, Campo, Carregando } from "@/components/dimensionamento/ui";

/**
 * Calendário e parâmetros — os números que valem para TODA a equipe.
 *
 * Ao contrário do ano/mês/unidade da barra do Headcount (que são de quem olha), estes
 * ficam no banco e mudam o cálculo de todo mundo. Por isso a tela é explícita sobre o
 * efeito de cada um, em vez de só mostrar o campo.
 *
 * A "folga para imprevistos" é a `ocupacao_alvo` vista pelo avesso: 15% de folga = 85 de
 * ocupação-alvo. Guardar um e mostrar o outro evita a pergunta "85 é bom ou ruim?".
 */
export default function CalendarioPage() {
  const { data: cadastro, isLoading } = useCadastroDimensionamento();
  const { salvarParametros, salvarPorte } = useMutacoesDimensionamento();

  const [dias, setDias] = useState<number[]>(PARAMETROS_PADRAO.diasUteis);
  const [folga, setFolga] = useState(15);
  const [prazoDias, setPrazoDias] = useState(60);
  const [rampup, setRampup] = useState<number[]>([50, 80]);

  useEffect(() => {
    if (!cadastro) return;
    setDias(cadastro.parametros.diasUteis.slice());
    setFolga(Math.round(100 - cadastro.parametros.ocupacaoAlvo));
    setPrazoDias(cadastro.parametros.prazoDias);
    setRampup((cadastro.parametros.rampup ?? [50, 80]).slice());
  }, [cadastro]);

  if (isLoading || !cadastro) return <Carregando />;

  const totalDias = dias.reduce((s, d) => s + d, 0);
  const salvar = () =>
    salvarParametros.mutate({
      diasUteis: dias.map((d) => Math.max(0, Math.min(31, Math.round(d)))),
      ocupacaoAlvo: Math.max(1, Math.min(100, 100 - folga)),
      prazoDias: Math.max(1, Math.min(365, Math.round(prazoDias))),
      rampup: rampup.map((r) => Math.max(0, Math.min(100, Math.round(r)))),
    });

  return (
    <div className="space-y-5">
      <Cabecalho
        titulo="Calendário e parâmetros"
        descricao="Estes números são compartilhados: mudar aqui muda o cálculo de toda a equipe, em todas as unidades."
        acao={
          <button
            type="button"
            onClick={salvar}
            disabled={salvarParametros.isPending}
            className="flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
          >
            <Save className="size-4" /> {salvarParametros.isPending ? "Salvando…" : "Salvar"}
          </button>
        }
      />

      <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold text-slate-900">Dias úteis de cada mês</h2>
            <p className="mt-1 text-sm text-slate-600">
              A produção de uma pessoa no mês é o ritmo diário × estes dias. Total no ano:{" "}
              <strong>{totalDias}</strong> dias.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDias(PARAMETROS_PADRAO.diasUteis.slice())}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            <RotateCcw className="size-4" /> Restaurar padrão
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {Calculo.MESES.map((m, i) => (
            <label key={m} className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">{m}</span>
              <input
                type="number" min={0} max={31}
                value={dias[i] ?? 0}
                onChange={(e) => setDias(dias.map((d, j) => (j === i ? Number(e.target.value) : d)))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
              />
            </label>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <h2 className="font-semibold text-slate-900">Folga para imprevistos</h2>
          <p className="mb-4 mt-1 text-sm text-slate-600">
            Parte do tempo que o cálculo <em>não</em> conta como produção: reunião, deslocamento,
            retrabalho, falta. Com {folga}% de folga, a equipe entrega {100 - folga}% do que
            entregaria num mês perfeito.
          </p>
          <Campo rotulo="Folga (%)">
            <input
              type="number" min={0} max={99}
              value={folga}
              onChange={(e) => setFolga(Number(e.target.value))}
              className="w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
            />
          </Campo>
        </section>

        <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <h2 className="font-semibold text-slate-900">Prazo de atendimento</h2>
          <p className="mb-4 mt-1 text-sm text-slate-600">
            Em quantos dias um documento vencido deveria ser resolvido. Vira o prazo padrão do
            Headcount ({Math.max(1, Math.round(prazoDias / 30))}{" "}
            {Math.max(1, Math.round(prazoDias / 30)) === 1 ? "mês" : "meses"}).
          </p>
          <Campo rotulo="Prazo (dias)">
            <input
              type="number" min={1} max={365}
              value={prazoDias}
              onChange={(e) => setPrazoDias(Number(e.target.value))}
              className="w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
            />
          </Campo>
        </section>
      </div>

      <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <h2 className="font-semibold text-slate-900">Período de adaptação</h2>
        <p className="mb-4 mt-1 text-sm text-slate-600">
          Quanto uma pessoa recém-admitida produz nos primeiros meses, em % do ritmo declarado.
          Depois da lista, produz 100%. É o que faz uma contratação de hoje não aparecer como
          capacidade cheia amanhã.
        </p>
        <div className="flex flex-wrap gap-3">
          {rampup.map((r, i) => (
            <label key={i} className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {i + 1}º mês
              </span>
              <input
                type="number" min={0} max={100}
                value={r}
                onChange={(e) => setRampup(rampup.map((v, j) => (j === i ? Number(e.target.value) : v)))}
                className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
              />
            </label>
          ))}
          <div className="flex items-end gap-2 pb-1">
            <button
              type="button"
              onClick={() => setRampup([...rampup, 100])}
              disabled={rampup.length >= 12}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              + mês
            </button>
            <button
              type="button"
              onClick={() => setRampup(rampup.slice(0, -1))}
              disabled={rampup.length <= 1}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              − mês
            </button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5">
        <div className="border-b border-slate-100 p-5">
          <h2 className="font-semibold text-slate-900">Peso de cada porte</h2>
          <p className="mt-1 text-sm text-slate-600">
            Quanto trabalho um cliente de cada porte representa. É o que converte contagem de
            clientes em <strong>UEP</strong> — um cliente grande com peso 2 vale dois pequenos.
            Salva ao sair do campo.
          </p>
        </div>
        <table className="w-full min-w-[32rem] text-sm">
          <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 font-semibold">Código</th>
              <th className="px-4 py-2 font-semibold">Nome</th>
              <th className="px-4 py-2 text-right font-semibold">Peso</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cadastro.portes.map((p) => (
              <tr key={p.codigo}>
                <td className="px-4 py-2 font-medium text-slate-900">{p.codigo}</td>
                <td className="px-4 py-2 text-slate-600">{p.nome}</td>
                <td className="px-4 py-2 text-right">
                  <input
                    type="number" min={0.01} step="0.01"
                    defaultValue={p.peso}
                    onBlur={(e) => {
                      const peso = Number(e.target.value);
                      if (peso > 0 && peso !== p.peso) salvarPorte.mutate({ ...p, peso });
                    }}
                    className="w-28 rounded-lg border border-slate-300 px-3 py-1.5 text-right text-sm tabular-nums"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
