"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2, TriangleAlert } from "lucide-react";
import { useCadastroDimensionamento } from "@/lib/hooks/useDimensionamento";
import { useMutacoesDimensionamento } from "@/lib/hooks/useDimensionamentoMutacoes";
import Calculo from "@/lib/dimensionamento/calculo";
import type { ColaboradorCadastro } from "@/lib/dimensionamento/mapear";
import { BotoesModal, Cabecalho, Campo, Carregando, Modal, Vazio } from "@/components/dimensionamento/ui";

/**
 * Colaboradores — quem produz, quanto e onde.
 *
 * Três campos mudam o número e não parecem:
 *
 *  • **Produção diária zerada** com função que produz: a pessoa conta no quadro e não
 *    entrega nada. O Headcount avisa, e aqui a linha fica marcada — foi assim que o
 *    "Issac Melo" apareceu na conferência do C7.
 *  • **Data de admissão**: quem entrou no meio do mês não trabalha o mês inteiro, e ainda
 *    passa pelo período de adaptação. Foi isso que fez a equipe de Teresópolis ser 8
 *    pessoas mas 7,3 em tempo integral.
 *  • **Alocação**: a capacidade entra em cada unidade multiplicada pelo percentual. A soma
 *    pode ser menor que 100 (o resto é tempo não alocado), nunca maior — o banco tem um
 *    gatilho, e o formulário avisa antes de tentar.
 */
export default function ColaboradoresPage() {
  const { data: cadastro, isLoading } = useCadastroDimensionamento();
  const { salvarColaborador, excluirColaborador } = useMutacoesDimensionamento();
  const [editando, setEditando] = useState<Partial<ColaboradorCadastro> | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroUnidade, setFiltroUnidade] = useState("");

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return (cadastro?.colaboradores ?? []).filter((c) => {
      if (t && !c.nome.toLowerCase().includes(t)) return false;
      if (filtroUnidade && !c.alocacoes.some((a) => a.unidadeId === filtroUnidade)) return false;
      return true;
    });
  }, [cadastro, busca, filtroUnidade]);

  if (isLoading || !cadastro) return <Carregando />;

  const funcaoDe = (id: string | null) => cadastro.funcoes.find((f) => f.id === id);
  const nomeUnidade = (id: string) => cadastro.unidades.find((u) => u.id === id)?.nome ?? "?";

  /** v257 — marcado a mão: sai do cálculo de propósito, não por cadastro incompleto. */
  const foraDoCalculo = (c: ColaboradorCadastro) => c.semProducaoDiaria === true || c.gestao === true;

  const semProducao = (c: ColaboradorCadastro) => {
    // quem foi marcado tem RESPOSTA, não lacuna — o alerta de "informe a produção" some
    if (foraDoCalculo(c)) return false;
    const f = funcaoDe(c.funcaoId);
    if (!f || f.tipoProducao === "nenhuma") return false;
    return f.tipoProducao === "tecnico"
      ? c.inspecoesDia <= 0 && c.relatoriosDia <= 0
      : c.empresasDia <= 0;
  };

  const somaAloc = (alocacoes: Array<{ percentual: number }>) =>
    alocacoes.reduce((s, a) => s + (Number(a.percentual) || 0), 0);

  return (
    <div className="space-y-5">
      <Cabecalho
        titulo="Colaboradores"
        descricao="O ritmo declarado por dia, a vigência e o percentual em cada unidade — os três números que o cálculo usa."
        acao={
          <button
            type="button"
            onClick={() => setEditando({
              nome: "", funcaoId: cadastro.funcoes[0]?.id ?? null,
              inspecoesDia: 2, relatoriosDia: 2, empresasDia: 2,
              dataAdmissao: null, dataDesligamento: null, custoMensal: null,
              semProducaoDiaria: false, gestao: false, alocacoes: [],
            })}
            className="flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
          >
            <Plus className="size-4" /> Novo colaborador
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <label className="flex flex-1 items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5">
          <Search className="size-4 text-slate-400" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome…" className="min-w-0 flex-1 text-sm outline-none" />
        </label>
        <select value={filtroUnidade} onChange={(e) => setFiltroUnidade(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
          <option value="">Todas as unidades</option>
          {cadastro.unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
        </select>
        <span className="text-sm text-slate-500 tabular-nums">{lista.length} de {cadastro.colaboradores.length}</span>
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 font-semibold">Nome</th>
                <th className="px-4 py-2 font-semibold">Função</th>
                <th className="px-4 py-2 font-semibold">Produção diária</th>
                <th className="px-4 py-2 font-semibold">Vigência</th>
                <th className="px-4 py-2 font-semibold">Unidades</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lista.map((c) => {
                const f = funcaoDe(c.funcaoId);
                const alerta = semProducao(c);
                const fora = foraDoCalculo(c);
                return (
                  <tr key={c.id} className={alerta ? "bg-amber-50/60" : fora ? "bg-slate-50/80 text-slate-500" : undefined}>
                    <td className="px-4 py-2 font-medium text-slate-900">
                      <span className="flex items-center gap-2">
                        {c.nome}
                        {alerta && <TriangleAlert className="size-4 text-amber-600" aria-label="produção diária zerada" />}
                        {fora && (
                          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                            {c.gestao ? "gestão" : "sem produção diária"}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-600">{f?.nome ?? "—"}</td>
                    <td className="px-4 py-2 text-slate-600">
                      {fora ? (
                        <span className="text-slate-500">fora do cálculo — não entra no quadro da equipe</span>
                      ) : (
                        <>
                          {Calculo.ritmoTexto({ ...c, tipoProducao: f?.tipoProducao ?? "nenhuma" } as never)}
                          {alerta && <span className="ml-2 text-xs text-amber-700">conta no quadro e não produz</span>}
                        </>
                      )}
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {c.dataAdmissao ? `desde ${new Date(c.dataAdmissao + "T12:00").toLocaleDateString("pt-BR")}` : "—"}
                      {c.dataDesligamento && ` · saiu em ${new Date(c.dataDesligamento + "T12:00").toLocaleDateString("pt-BR")}`}
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {c.alocacoes.length
                        ? c.alocacoes.map((a) => `${nomeUnidade(a.unidadeId)} ${a.percentual}%`).join(" · ")
                        : <span className="text-amber-700">sem alocação — fora do cálculo</span>}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <button type="button" onClick={() => setEditando({ ...c, alocacoes: c.alocacoes.map((a) => ({ ...a })) })} className="rounded p-1.5 text-slate-500 hover:bg-slate-100" title="Editar">
                          <Pencil className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => confirm(`Excluir "${c.nome}"? As alocações dele saem junto.`) && excluirColaborador.mutate(c.id)}
                          className="rounded p-1.5 text-rose-600 hover:bg-rose-50"
                          title="Excluir"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!lista.length && <Vazio colSpan={6} texto={busca || filtroUnidade ? "Nada com esses filtros." : "Nenhum colaborador cadastrado."} />}
            </tbody>
          </table>
        </div>
      </div>

      {editando && (() => {
        const f = funcaoDe(editando.funcaoId ?? null);
        const tipo = f?.tipoProducao ?? "nenhuma";
        const soma = somaAloc(editando.alocacoes ?? []);
        const excedeu = soma > 100;
        return (
          <Modal titulo={editando.id ? "Editar colaborador" : "Novo colaborador"} aoFechar={() => setEditando(null)}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!editando.nome?.trim() || excedeu) return;
                salvarColaborador.mutate(editando as ColaboradorCadastro & { nome: string }, { onSuccess: () => setEditando(null) });
              }}
              className="max-h-[70vh] space-y-4 overflow-y-auto pr-1"
            >
              <Campo rotulo="Nome">
                <input autoFocus value={editando.nome ?? ""} onChange={(e) => setEditando({ ...editando, nome: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </Campo>

              <Campo rotulo="Função" ajuda={tipo === "nenhuma" ? "Esta função não produz — a pessoa fica fora das contas." : undefined}>
                <select value={editando.funcaoId ?? ""} onChange={(e) => setEditando({ ...editando, funcaoId: e.target.value || null })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  {cadastro.funcoes.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
                </select>
              </Campo>

              {/* v257 — as duas marcações que tiram a pessoa do cálculo. Ficam ANTES dos
                  campos de produção porque, marcadas, elas tornam aqueles campos inertes:
                  deixar o operador digitar "2 por dia" e o número não mudar seria pior
                  que esconder o campo. */}
              <div className="space-y-2 rounded-lg bg-slate-50 p-4">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Fora do cálculo
                </span>
                <label className="flex items-start gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={editando.semProducaoDiaria === true}
                    onChange={(e) => setEditando({ ...editando, semProducaoDiaria: e.target.checked })}
                    className="mt-0.5 size-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                  />
                  <span>
                    Sem produção diária
                    <span className="block text-xs text-slate-500">
                      Está em treinamento ou atuando em outra área — não entrega no período.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={editando.gestao === true}
                    onChange={(e) => setEditando({ ...editando, gestao: e.target.checked })}
                    className="mt-0.5 size-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                  />
                  <span>
                    Gestão
                    <span className="block text-xs text-slate-500">
                      Faz parte da gestão dos times; a produção diária é zerada por natureza.
                    </span>
                  </span>
                </label>
                {(editando.semProducaoDiaria === true || editando.gestao === true) && (
                  <p className="rounded-md bg-white px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-200">
                    Esta pessoa <strong>sai do quadro da equipe</strong> (o &ldquo;equivale a&rdquo; vai a
                    zero). O quadro necessário não muda — ele nunca usou quem não produz —, mas o{" "}
                    <strong>déficit aumenta</strong>, porque o déficit é o necessário menos a equipe.
                    É a falta que já existia aparecendo.
                  </p>
                )}
              </div>

              {tipo !== "nenhuma" && editando.semProducaoDiaria !== true && editando.gestao !== true && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {tipo === "tecnico" ? (
                    <>
                      <Campo rotulo="Inspeções por dia">
                        <input type="number" min={0} step="0.1" value={editando.inspecoesDia ?? 0} onChange={(e) => setEditando({ ...editando, inspecoesDia: Number(e.target.value) })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums" />
                      </Campo>
                      <Campo rotulo="Relatórios por dia">
                        <input type="number" min={0} step="0.1" value={editando.relatoriosDia ?? 0} onChange={(e) => setEditando({ ...editando, relatoriosDia: Number(e.target.value) })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums" />
                      </Campo>
                    </>
                  ) : (
                    <Campo rotulo="Empresas finalizadas por dia">
                      <input type="number" min={0} step="0.1" value={editando.empresasDia ?? 0} onChange={(e) => setEditando({ ...editando, empresasDia: Number(e.target.value) })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums" />
                    </Campo>
                  )}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-3">
                <Campo rotulo="Admissão" ajuda="Entra no cálculo: presença e adaptação.">
                  <input type="date" value={editando.dataAdmissao ?? ""} onChange={(e) => setEditando({ ...editando, dataAdmissao: e.target.value || null })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </Campo>
                <Campo rotulo="Desligamento">
                  <input type="date" value={editando.dataDesligamento ?? ""} onChange={(e) => setEditando({ ...editando, dataDesligamento: e.target.value || null })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </Campo>
                <Campo rotulo="Custo mensal" ajuda="Vazio usa o custo da função.">
                  <input type="number" min={0} step="0.01" value={editando.custoMensal ?? ""} onChange={(e) => setEditando({ ...editando, custoMensal: e.target.value ? Number(e.target.value) : null })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums" />
                </Campo>
              </div>

              <div className="rounded-lg bg-slate-50 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Alocação por unidade</span>
                  <span className={`text-sm tabular-nums ${excedeu ? "font-semibold text-rose-700" : "text-slate-500"}`}>
                    soma: {soma}%{excedeu && " — passa de 100%"}
                  </span>
                </div>
                <div className="space-y-2">
                  {cadastro.unidades.map((u) => {
                    const atual = (editando.alocacoes ?? []).find((a) => a.unidadeId === u.id);
                    return (
                      <div key={u.id} className="flex items-center gap-3">
                        <span className="flex-1 text-sm text-slate-700">{u.nome}</span>
                        <input
                          type="number" min={0} max={100} step={1}
                          value={atual?.percentual ?? 0}
                          onChange={(e) => {
                            const pct = Math.max(0, Math.min(100, Number(e.target.value)));
                            const outras = (editando.alocacoes ?? []).filter((a) => a.unidadeId !== u.id);
                            setEditando({ ...editando, alocacoes: pct > 0 ? [...outras, { unidadeId: u.id, percentual: pct }] : outras });
                          }}
                          className="w-24 rounded-lg border border-slate-300 px-3 py-1.5 text-right text-sm tabular-nums"
                        />
                        <span className="w-4 text-sm text-slate-400">%</span>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  A soma pode ser menor que 100 — o resto é tempo não alocado e não conta em
                  unidade nenhuma. Maior que 100 o banco recusa.
                </p>
              </div>

              <BotoesModal aoCancelar={() => setEditando(null)} salvando={salvarColaborador.isPending} />
            </form>
          </Modal>
        );
      })()}
    </div>
  );
}
