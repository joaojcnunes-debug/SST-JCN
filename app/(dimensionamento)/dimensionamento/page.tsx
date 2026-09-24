"use client";

import { useEffect, useMemo, useState } from "react";
import { Printer, TriangleAlert } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useCadastroDimensionamento } from "@/lib/hooks/useDimensionamento";
import { derivarHeadcount, equipeDoMes } from "@/lib/dimensionamento/derivar";
import { anosDisponiveis } from "@/lib/dimensionamento/mapear";
import Calculo from "@/lib/dimensionamento/calculo";
import type { ResultadoHeadcount } from "@/lib/dimensionamento/calculo";

/**
 * Headcount — a tela de resultado do Dimensionamento (DIM-01).
 *
 * Responde uma pergunta só: **quantas pessoas para eliminar os documentos vencidos
 * acumulados até o mês escolhido, dentro do prazo escolhido?**
 *
 * Todo número aqui sai de `derivarHeadcount`, que é porte fiel da derivação da
 * origem — inclusive a parte que não é óbvia: a fila atravessa os anos, então o
 * acumulado de setembro/2026 inclui o que ficou em aberto em 2025. Conferido contra
 * a origem em 23/09 (Teresópolis/setembro/3 meses: 510 · 227 · 8 pessoas / 7,3 · +16).
 *
 * As escolhas da barra (ano, mês, unidade, prazo) ficam só no navegador: são de quem
 * está olhando, não do cadastro.
 */

const PRAZOS = [1, 2, 3, 6, 12];
const CHAVE_PRAZO = "chabra:dimensionamento:prazo";

const nf = (v: unknown, casas = 0) =>
  Number.isFinite(Number(v))
    ? Number(v).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })
    : "—";
const moeda = (v: unknown) =>
  Number.isFinite(Number(v)) && Number(v) > 0
    ? Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
    : null;

export default function HeadcountPage() {
  const { data: cadastro, isLoading, error } = useCadastroDimensionamento();

  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth()); // 0..11, como o motor conta
  const [unidadeId, setUnidadeId] = useState("");
  const [prazo, setPrazo] = useState(3);

  // o prazo é preferência de quem olha — fica no navegador, não no cadastro
  useEffect(() => {
    try {
      const salvo = Number(localStorage.getItem(CHAVE_PRAZO));
      if (PRAZOS.includes(salvo)) setPrazo(salvo);
    } catch {
      /* navegador sem storage: segue com o padrão */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(CHAVE_PRAZO, String(prazo));
    } catch {
      /* idem */
    }
  }, [prazo]);

  const derivado = useMemo(
    () => (cadastro ? derivarHeadcount(cadastro, { ano, mesAtual: mes, unidadeId, prazos: PRAZOS }) : null),
    [cadastro, ano, mes, unidadeId],
  );
  const equipe = useMemo(
    () => (cadastro ? equipeDoMes(cadastro, { ano, mesAtual: mes, unidadeId }) : []),
    [cadastro, ano, mes, unidadeId],
  );
  const anos = useMemo(() => (cadastro ? anosDisponiveis(cadastro.unidades, ano) : [ano]), [cadastro, ano]);

  const hc = derivado?.headcount ?? null;
  const cenario = hc?.cenarios?.find((c) => c.prazoMeses === prazo) ?? null;

  if (isLoading) {
    return <div className="rounded-xl bg-white p-10 text-center text-slate-500 shadow-sm ring-1 ring-black/5">Carregando o dimensionamento…</div>;
  }
  if (error) {
    return (
      <div className="rounded-xl bg-white p-10 text-center shadow-sm ring-1 ring-black/5">
        <p className="font-medium text-rose-700">Não foi possível carregar o dimensionamento.</p>
        <p className="mt-1 text-sm text-slate-500">{(error as Error).message}</p>
      </div>
    );
  }
  // Cadastro vazio é estado legítimo: para quem não é Admin a RLS devolve VAZIO, não erro.
  if (!cadastro || !cadastro.unidades.length) {
    return (
      <div className="rounded-xl bg-white p-10 text-center shadow-sm ring-1 ring-black/5">
        <p className="font-medium text-slate-700">Nenhuma unidade cadastrada.</p>
        <p className="mt-1 text-sm text-slate-500">Cadastre as unidades e os lançamentos mensais para o cálculo aparecer.</p>
      </div>
    );
  }

  const semProducao = equipe.filter((p) => p.semProducao);
  const foraDoCalculo = equipe.filter((p) => p.foraDoCalculo);
  // A quebra por unidade só faz sentido quando o alvo é o TOTAL. Com uma unidade
  // escolhida, os blocos abaixo repetiriam a tabela e os gráficos que já estão no topo.
  const porUnidade = unidadeId ? [] : (derivado?.porUnidade ?? []);

  return (
    <div className="space-y-5">
      <header className="print:mb-4">
        <h1 className="text-2xl font-semibold text-slate-900">Headcount</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          {derivado?.titulo} · {hc?.nomeMes} de {ano} — quantos colaboradores são necessários para
          eliminar os documentos vencidos acumulados até esse mês.
        </p>
      </header>

      {/* ── barra de opções ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5 print:hidden">
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Ano</span>
          <select value={ano} onChange={(e) => setAno(Number(e.target.value))} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
            {anos.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>

        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Mês atual</span>
          <select value={mes} onChange={(e) => setMes(Number(e.target.value))} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
            {Calculo.MESES_LONGO.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
        </label>

        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Unidade</span>
          <select value={unidadeId} onChange={(e) => setUnidadeId(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
            <option value="">Todas as unidades</option>
            {cadastro.unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </label>

        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Prazo de eliminação</span>
          <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
            {PRAZOS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPrazo(p)}
                className={`rounded-md px-3 py-1 text-sm transition ${
                  p === prazo ? "bg-teal-700 font-medium text-white shadow-sm" : "text-slate-600 hover:bg-white"
                }`}
              >
                {p} {p === 1 ? "mês" : "meses"}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          <Printer className="size-4" /> Imprimir
        </button>
      </div>

      {/* Cadastro incompleto: conta no quadro e não produz — a origem avisava, e o aviso
          viaja junto com o dado. Quem decide contratação precisa saber disso. */}
      {semProducao.length > 0 && (
        <div className="flex gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-amber-600" />
          <p>
            <strong>Cadastro incompleto:</strong>{" "}
            {semProducao.map((p) => p.nome).join(", ")}{" "}
            {semProducao.length === 1 ? "está alocado" : "estão alocados"} nesta unidade com{" "}
            <strong>produção diária zerada</strong>. Conta no quadro, mas não produz — informe a
            produção diária em Colaboradores. Se a pessoa realmente não entrega no período
            (treinamento, outra área) ou é da gestão, marque isso na ficha dela: ela sai do quadro
            em vez de contar como capacidade que não existe.
          </p>
        </div>
      )}

      {/* Marcados a mão: não é alerta, é informação de leitura. Quem confere o número
          precisa saber que a equipe exibida já exclui essas pessoas. */}
      {foraDoCalculo.length > 0 && (
        <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600 ring-1 ring-slate-200">
          <strong className="font-semibold text-slate-700">
            {foraDoCalculo.length} {foraDoCalculo.length === 1 ? "pessoa está" : "pessoas estão"} fora
            do cálculo
          </strong>{" "}
          ({foraDoCalculo.map((p) => p.nome).join(", ")}) — não entram no quadro da equipe nem na
          régua de produtividade.
        </p>
      )}

      {/* ── cartões ────────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Cartao
          rotulo={`Vencido acumulado até ${hc?.nomeMes}`}
          valor={nf(hc?.backlog?.total)}
          sufixo="UEP"
          cor="text-rose-700"
          borda="border-l-rose-500"
        />
        <Cartao
          rotulo={`Vence em ${hc?.nomeMes}`}
          valor={nf(hc?.demandaDoMes)}
          sufixo="UEP"
          nota={`${nf(hc?.clientesDoMes)} clientes no mês`}
          cor="text-teal-800"
          borda="border-l-teal-500"
        />
        <Cartao
          rotulo="Equipe atual"
          valor={nf(hc?.cabecasAtual)}
          sufixo={Number(hc?.cabecasAtual) === 1 ? "pessoa" : "pessoas"}
          nota={`equivalem a ${nf(hc?.quadroAtual, 1)} em tempo integral`}
          cor="text-slate-900"
          borda="border-l-slate-400"
        />
        <Cartao
          rotulo={`Faltam para eliminar em ${prazo} ${prazo === 1 ? "mês" : "meses"}`}
          valor={`+${nf(cenario?.deficit)}`}
          nota={`quadro necessário: ${nf(cenario?.pessoas)} pessoas`}
          cor="text-rose-700"
          borda="border-l-rose-500"
        />
      </div>

      {/* ── equipe, pessoa por pessoa ──────────────────────────────────── */}
      <section className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5">
        <div className="border-b border-slate-100 p-5">
          <h2 className="font-semibold text-slate-900">
            Equipe de {derivado?.titulo} em {hc?.nomeMes}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {equipe.length} {equipe.length === 1 ? "pessoa" : "pessoas"} com alocação aqui. O cálculo
            usa o equivalente em tempo integral — {nf(hc?.quadroAtual, 1)} — porque quem divide a
            jornada com outra unidade, ou entrou no meio do mês, não trabalha o mês inteiro aqui.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 font-semibold">Nome</th>
                <th className="px-4 py-2 font-semibold">Função</th>
                <th className="px-4 py-2 text-right font-semibold">Alocação aqui</th>
                <th className="px-4 py-2 text-right font-semibold">Presença no mês</th>
                <th className="px-4 py-2 font-semibold">Produção diária declarada</th>
                <th className="px-4 py-2 text-right font-semibold">Equivale a</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {equipe.map((p) => (
                <tr
                  key={p.id}
                  className={p.semProducao ? "bg-rose-50/60" : p.foraDoCalculo ? "bg-slate-50/80" : undefined}
                >
                  <td className="px-4 py-2 font-medium text-slate-900">{p.nome}</td>
                  <td className="px-4 py-2 text-slate-600">{p.funcao || "—"}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{nf(p.alocacao)}%</td>
                  <td className="px-4 py-2 text-right tabular-nums">{nf(p.presenca * 100)}%</td>
                  <td className="px-4 py-2 text-slate-600">
                    {/* Marcado a mão (v257) é uma RESPOSTA; o alerta vermelho é uma lacuna.
                        Nunca os dois: `semProducao` exige que a pessoa produza por função. */}
                    {p.foraDoCalculo ? (
                      <span className="text-slate-500">
                        {p.motivoFora === "gestao" ? "gestão" : "sem produção diária"} · fora do cálculo
                      </span>
                    ) : (
                      <>
                        {p.ritmo}
                        {p.semProducao && <span className="ml-2 text-xs text-rose-600">— informe a produção</span>}
                      </>
                    )}
                  </td>
                  <td className={`px-4 py-2 text-right tabular-nums ${p.foraDoCalculo ? "text-slate-400" : ""}`}>
                    {nf(p.equivalente, 1)}
                  </td>
                </tr>
              ))}
              {!equipe.length && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Ninguém alocado nesta unidade.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── quadro necessário no prazo escolhido ───────────────────────── */}
      <TabelaQuadro
        titulo={`Quadro necessário para eliminar em ${prazo} ${prazo === 1 ? "mês" : "meses"}`}
        cenario={cenario}
      />

      {/* ── gráficos ───────────────────────────────────────────────────── */}
      <div className="grid gap-4 xl:grid-cols-2">
        <GraficoPrazos hc={hc} prazo={prazo} />
        <GraficoIdade hc={hc} />
      </div>

      {/* ── a mesma conta, aberta por unidade ──────────────────────────────
          Só aparece com "Todas as unidades" escolhido. Os blocos saem do MESMO
          `fluxo` que produziu o total (ver `porUnidade` em derivar.js), então não
          existe a possibilidade de o topo e a quebra discordarem.

          Somar os déficits das unidades NÃO dá o déficit do total: cada conta
          arredonda para cima na sua unidade, e sobra numa não cobre falta em outra.
          Está escrito na tela para ninguém "corrigir" a diferença. */}
      {porUnidade.length > 0 && (
        <section className="space-y-4">
          <div className="border-t border-slate-200 pt-5">
            <h2 className="text-lg font-semibold text-slate-900">Por unidade</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              A mesma conta do topo, aberta unidade a unidade — é aqui que se vê{" "}
              <em>onde</em> falta gente. A soma dos déficits por unidade não fecha com o
              total ({nf(cenario?.deficit)}): cada unidade arredonda a sua necessidade para
              cima, e a folga de uma não cobre a falta de outra.
            </p>
          </div>

          {porUnidade.map((u) => {
            // Sem headcount não há o que mostrar, e a tabela renderizaria um "+—" que
            // parece déficit zero. Unidade sem lançamento no mês some do bloco em vez
            // de virar uma linha ambígua.
            if (!u.headcount) return null;
            const cenarioU = u.headcount.cenarios?.find((c) => c.prazoMeses === prazo) ?? null;
            return (
              // `break-inside-avoid`: a página tem botão de imprimir, e sem isto cada
              // bloco parte no meio de um gráfico. Foi apontado antes de ir ao ar.
              <div
                key={u.id}
                className="space-y-4 break-inside-avoid rounded-xl bg-slate-50/70 p-4 ring-1 ring-slate-200"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-base font-semibold text-slate-900">{u.nome}</h3>
                  <p className="text-sm text-slate-600">
                    equipe de hoje <strong>{nf(u.headcount.quadroAtual, 1)}</strong> em tempo
                    integral · vencido acumulado{" "}
                    <strong>{nf(u.headcount.backlog?.total)} UEP</strong>
                  </p>
                </div>
                <TabelaQuadro
                  titulo={`Quadro necessário em ${prazo} ${prazo === 1 ? "mês" : "meses"}`}
                  cenario={cenarioU}
                />
                <div className="grid gap-4 xl:grid-cols-2">
                  <GraficoPrazos hc={u.headcount} prazo={prazo} />
                  <GraficoIdade hc={u.headcount} />
                </div>
              </div>
            );
          })}
        </section>
      )}

    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Os três blocos de resultado, extraídos para serem usados DUAS vezes: uma para o
   total e uma por unidade. Extrair em vez de duplicar não é preferência de estilo —
   é o que garante que a quebra por unidade e o topo não possam divergir em formato,
   rótulo ou arredondamento. Se um dia a régua mudar, muda nos dois ao mesmo tempo.
   ────────────────────────────────────────────────────────────────────────── */

type Cenario = ResultadoHeadcount["cenarios"][number];

function TabelaQuadro({ titulo, cenario }: { titulo: string; cenario: Cenario | null }) {
  return (
    <section className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5">
      <div className="border-b border-slate-100 p-5">
        <h2 className="font-semibold text-slate-900">{titulo}</h2>
        <p className="mt-1 text-sm text-slate-600">
          Trabalho total do período: <strong>{nf(cenario?.trabalhoTotal)} UEP</strong> (o vencido
          acumulado mais o que vence durante o prazo).
          {cenario?.mesesEstimados ? " Prazos que passam de dezembro usam a média do ano — são estimativas." : ""}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 font-semibold">Área</th>
              <th className="px-4 py-2 text-right font-semibold">Quadro necessário</th>
              <th className="px-4 py-2 text-right font-semibold">Déficit</th>
              <th className="px-4 py-2 font-semibold">Etapa que manda</th>
              <th className="px-4 py-2 text-right font-semibold">Custo do déficit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(["tecnico", "administrativo"] as const).map((area) => {
              const a = cenario?.areas?.[area];
              if (!a) return null;
              return (
                <tr key={area}>
                  <td className="px-4 py-2 font-medium text-slate-900">{Calculo.FUNCAO_CURTA[area]}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{nf(a.pessoas)}</td>
                  <td className={`px-4 py-2 text-right tabular-nums ${Number(a.deficit) > 0 ? "font-semibold text-rose-700" : "text-slate-500"}`}>
                    {Number(a.deficit) > 0 ? `+${nf(a.deficit)}` : "—"}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{a.etapaCritica}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-600">{moeda(a.custoDeficit) ?? "—"}</td>
                </tr>
              );
            })}
            <tr className="bg-slate-50 font-semibold">
              <td className="px-4 py-2">Total</td>
              <td className="px-4 py-2 text-right tabular-nums">{nf(cenario?.pessoas)}</td>
              <td className="px-4 py-2 text-right tabular-nums text-rose-700">+{nf(cenario?.deficit)}</td>
              <td className="px-4 py-2" />
              <td className="px-4 py-2 text-right tabular-nums">{moeda(cenario?.custoDeficit) ?? "—"}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function GraficoPrazos({ hc, prazo }: { hc: ResultadoHeadcount | null; prazo: number }) {
  const dados = (hc?.cenarios ?? []).map((c) => ({
    prazo: `${c.prazoMeses} ${c.prazoMeses === 1 ? "mês" : "meses"}`,
    prazoMeses: c.prazoMeses,
    tecnico: Number(c.areas?.tecnico?.pessoas ?? 0),
    administrativo: Number(c.areas?.administrativo?.pessoas ?? 0),
  }));
  return (
    <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <h2 className="font-semibold text-slate-900">Quadro necessário em cada prazo</h2>
      <p className="mb-3 mt-1 text-sm text-slate-600">
        A linha é a equipe de hoje ({nf(hc?.quadroAtual, 1)} em tempo integral). O prazo escolhido
        aparece em cor cheia.
      </p>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={dados} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="prazo" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
          <Tooltip />
          <Legend />
          <Bar dataKey="tecnico" name="Técnicos" stackId="q">
            {dados.map((d) => (
              <Cell key={`t-${d.prazoMeses}`} fill={d.prazoMeses === prazo ? "#0f766e" : "#99f6e4"} />
            ))}
          </Bar>
          <Bar dataKey="administrativo" name="Administrativos" stackId="q">
            {dados.map((d) => (
              <Cell key={`a-${d.prazoMeses}`} fill={d.prazoMeses === prazo ? "#1d4ed8" : "#bfdbfe"} />
            ))}
          </Bar>
          <ReferenceLine
            y={Number(hc?.quadroAtual ?? 0)}
            stroke="#334155"
            strokeDasharray="4 4"
            label={{ value: "equipe de hoje", position: "insideTopRight", fontSize: 11, fill: "#334155" }}
          />
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}

function GraficoIdade({ hc }: { hc: ResultadoHeadcount | null }) {
  // `idade.faixas` do motor e um OBJETO indexado por faixa (`faixas[id] += uep`), nao um
  // array. Testar `.length` nele da `undefined` -- e foi assim que a tela anunciou "sem
  // vencido acumulado" tendo 510 UEP no cartao ao lado, no primeiro deploy. Converter
  // pela ordem de FAIXAS_IDADE mantem o eixo em ordem cronologica.
  const faixas = (hc?.backlog?.idade?.faixas ?? {}) as Record<string, number>;
  const idade = (Calculo.FAIXAS_IDADE as Array<{ id: string; rotulo: string }>).map((f) => ({
    rotulo: f.rotulo,
    quantidade: Number(faixas[f.id] ?? 0),
  }));
  const tem = idade.some((f) => f.quantidade > 0);
  return (
    <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <h2 className="font-semibold text-slate-900">Há quanto tempo está vencido</h2>
      <p className="mb-3 mt-1 text-sm text-slate-600">
        Idade do vencido acumulado, por faixa. Quanto mais à direita, mais tempo o cliente espera.
      </p>
      {tem ? (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={idade} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="rotulo" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="quantidade" name="UEP" fill="#b45309" />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p className="py-10 text-center text-sm text-slate-500">Sem vencido acumulado neste mês.</p>
      )}
    </section>
  );
}

function Cartao({
  rotulo,
  valor,
  sufixo,
  nota,
  cor,
  borda,
}: {
  rotulo: string;
  valor: string;
  sufixo?: string;
  nota?: string;
  cor: string;
  borda: string;
}) {
  return (
    <div className={`rounded-xl border-l-4 bg-white p-5 shadow-sm ring-1 ring-black/5 ${borda}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{rotulo}</p>
      <p className={`mt-2 text-3xl font-bold tabular-nums ${cor}`}>
        {valor}
        {sufixo && <span className="ml-1.5 text-sm font-medium text-slate-500">{sufixo}</span>}
      </p>
      {nota && <p className="mt-1 text-xs text-slate-500">{nota}</p>}
    </div>
  );
}
