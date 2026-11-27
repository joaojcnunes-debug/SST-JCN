"use client";

// Consolidação › Dashboard (0.3.335, pedido do usuário em 27/11/2026). A tela de entrada do módulo: a situação da
// consolidação das empresas e dos grupos, o andamento até a venda, os riscos e as intervenções, as vendas e o tempo das
// pessoas. Só LÊ — as contas moram em lib/consolidacao/dashboard.ts (testadas) e as regras são as das listas.

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { BadgeCheck, ChevronRight, Clock, GitMerge, HeartHandshake, LayoutDashboard, ShieldAlert, Users } from "lucide-react";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { BalaoUmValor } from "@/components/ui/BalaoGrafico";
import { useFontesConciliacao } from "@/lib/hooks/usePsicoConsolidacao";
import { useRegistrosConciliacao, useRegistrosConciliacaoGrupo } from "@/lib/hooks/useConciliacaoParecer";
import { useGruposEmpresas } from "@/lib/hooks/useGruposEmpresas";
import { useLiberacaoServicos, useVendasComercial } from "@/lib/hooks/useComercial";
import { useAgora, useTempoComercial, useTempoComercialGrupo } from "@/lib/hooks/useDocumentoSessoes";
import { chaveRisco } from "@/lib/comercial/liberacao";
import { NOME_PRODUTO } from "@/lib/comercial/oportunidades";
import { hojeSP } from "@/lib/inspecoes/prioridade";
import {
  ETAPAS,
  ROTULO_SITUACAO_CONSOLIDACAO,
  contarPor,
  contarValores,
  etapaDoAlvo,
  fatoresConfirmados,
  fmtHoras,
  montarAlvo,
  porMes,
  resumirTempo,
  tempoMedioAteLiberar,
  topo,
  type AlvoDashboard,
  type Contagem,
  type EtapaAndamento,
  type FechamentoResumo,
  type SessaoComAlvo,
  type SituacaoConsolidacao,
} from "@/lib/consolidacao/dashboard";
import { cn, fmtData } from "@/lib/utils";

type Periodo = "30" | "90" | "365" | "tudo";
const PERIODOS: { k: Periodo; rotulo: string }[] = [
  { k: "30", rotulo: "30 dias" },
  { k: "90", rotulo: "90 dias" },
  { k: "365", rotulo: "12 meses" },
  { k: "tudo", rotulo: "Tudo" },
];

const SITUACOES: SituacaoConsolidacao[] = ["sem", "pendente", "concluida"];
const COR_SITUACAO: Record<SituacaoConsolidacao, string> = {
  sem: "border-gray-200 bg-gray-50 text-gray-700",
  pendente: "border-amber-200 bg-amber-50 text-amber-800",
  concluida: "border-emerald-200 bg-emerald-50 text-emerald-800",
};
const COR_BARRA = "#4f46e5"; // indigo-600: uma série só por gráfico

export default function ConsolidacaoDashboardPage() {
  const fontes = useFontesConciliacao();
  const registros = useRegistrosConciliacao();
  const registrosGrupo = useRegistrosConciliacaoGrupo();
  const { grupos, membrosPorGrupo, isLoading: carregandoGrupos } = useGruposEmpresas();
  const liberacao = useLiberacaoServicos();
  const vendas = useVendasComercial();
  const tempoEmpresas = useTempoComercial();
  const tempoGrupos = useTempoComercialGrupo();
  const agora = useAgora(60_000);
  const [periodo, setPeriodo] = useState<Periodo>("90");
  const [tipoAndamento, setTipoAndamento] = useState<"empresa" | "grupo">("empresa");
  const [etapaAberta, setEtapaAberta] = useState<EtapaAndamento | null>(null);
  const [situacaoAberta, setSituacaoAberta] = useState<{ tipo: "empresa" | "grupo"; s: SituacaoConsolidacao } | null>(null);

  const desde = periodo === "tudo" ? null : agora - Number(periodo) * 86_400_000;

  const dados = useMemo(() => {
    if (!fontes.data || !registros.data || !registrosGrupo.data || !liberacao.data || !vendas.data) return null;
    const lib = liberacao.data;
    const listaVendas = vendas.data;

    // Empresas: as que têm AEP ou DRPS/QPS concluídos (o universo da Conciliação por empresa).
    // Na lista os fechamentos vêm sem os itens: os riscos saem da conciliação fechada que a liberação já carrega (como na
    // lista da Conciliação por empresa).
    const itensEmp = new Map(lib.conciliacoes.map((c) => [c.id_empresa, c.itens]));
    const ultimoEmp = new Map<string, FechamentoResumo>();
    for (const f of registros.data.fechamentos) {
      if (!ultimoEmp.has(f.id_empresa)) {
        ultimoEmp.set(f.id_empresa, { id: f.id_fechamento, fechado_em: f.fechado_em, reaberta: !!f.reabertura, itens: f.reabertura ? [] : itensEmp.get(f.id_empresa) ?? [] });
      }
    }
    const comecouEmp = new Set<string>([
      ...registros.data.pareceres.map((p) => p.id_empresa),
      ...registros.data.ligacoes.map((l) => l.id_empresa ?? ""),
    ]);
    const intervEmp = new Map<string, Set<string>>();
    for (const i of lib.indicadas) {
      const s = intervEmp.get(i.id_empresa) ?? new Set<string>();
      s.add(chaveRisco(i.setor_chave, i.id_fator));
      intervEmp.set(i.id_empresa, s);
    }
    const vendasPorEmpresa = new Map<string, string[]>();
    for (const v of listaVendas) vendasPorEmpresa.set(v.id_empresa, [...(vendasPorEmpresa.get(v.id_empresa) ?? []), v.vendido_em]);
    const vendeuDepois = (ids: string[], desdeIso: string | null) =>
      ids.some((id) => (vendasPorEmpresa.get(id) ?? []).some((d) => !desdeIso || d >= desdeIso));

    const empresas: AlvoDashboard[] = fontes.data.empresas.map((e) => {
      const at = lib.atendimentos.find((a) => a.id_empresa === e.idEmpresa) ?? null;
      return montarAlvo({
        tipo: "empresa",
        id: e.idEmpresa,
        nome: e.nome,
        href: `/consolidacao-grupo/conciliacao/${e.idEmpresa}`,
        ultimo: ultimoEmp.get(e.idEmpresa) ?? null,
        comecou: comecouEmp.has(e.idEmpresa),
        atendimento: at,
        comIntervencao: intervEmp.get(e.idEmpresa) ?? new Set(),
        vendido: at?.status === "CONCLUIDO" && vendeuDepois([e.idEmpresa], at.concluido_em),
      });
    });

    // Grupos: os que têm empresa.
    const ultimoGrp = new Map<string, FechamentoResumo>();
    for (const f of registrosGrupo.data.fechamentos) {
      if (!ultimoGrp.has(f.id_grupo)) ultimoGrp.set(f.id_grupo, { id: f.id_fechamento, fechado_em: f.fechado_em, reaberta: !!f.reabertura, itens: (f.itens ?? []) as never });
    }
    const comecouGrp = new Set<string>([
      ...registrosGrupo.data.pareceres.map((p) => p.id_empresa),
      ...(registrosGrupo.data.ligacoes as Array<{ id_grupo?: string }>).map((l) => l.id_grupo ?? ""),
    ]);
    const gruposAlvo: AlvoDashboard[] = grupos
      .filter((g) => (membrosPorGrupo.get(g.id_grupo) ?? []).length > 0)
      .map((g) => {
        const at = lib.grupos.find((x) => x.id_grupo === g.id_grupo) ?? null;
        const membros = (membrosPorGrupo.get(g.id_grupo) ?? []).map((m) => m.id_empresa);
        return montarAlvo({
          tipo: "grupo",
          id: g.id_grupo,
          nome: g.nome,
          href: `/consolidacao-grupo/conciliacao-grupo/${g.id_grupo}`,
          ultimo: ultimoGrp.get(g.id_grupo) ?? null,
          comecou: comecouGrp.has(g.id_grupo),
          atendimento: at,
          comIntervencao: new Set((at?.intervencoes ?? []).map((i) => chaveRisco(i.setor_chave, i.id_fator))),
          vendido: at?.status === "CONCLUIDO" && vendeuDepois(membros, at.concluido_em),
        });
      });

    const todasIndicadas = [...lib.indicadas, ...lib.grupos.flatMap((g) => g.intervencoes)];
    const fat = fatoresConfirmados([...ultimoEmp.values(), ...ultimoGrp.values()]);
    const nomeAlvo = new Map([...empresas, ...gruposAlvo].map((a) => [`${a.tipo}:${a.id}`, a.nome]));
    const liberados = new Set([...empresas, ...gruposAlvo].filter((a) => a.comercial === "liberado").map((a) => `${a.tipo}:${a.id}`));
    return { empresas, grupos: gruposAlvo, todasIndicadas, fat, listaVendas, nomeAlvo, liberados };
  }, [fontes.data, registros.data, registrosGrupo.data, liberacao.data, vendas.data, grupos, membrosPorGrupo]);

  const sessoes = useMemo<SessaoComAlvo[]>(
    () => [
      ...(tempoEmpresas.data ?? []).map((s) => ({ ...s, alvoTipo: "empresa" as const })),
      ...(tempoGrupos.data ?? []).map((s) => ({ ...s, alvoTipo: "grupo" as const })),
    ],
    [tempoEmpresas.data, tempoGrupos.data],
  );

  const carregando =
    fontes.isLoading || registros.isLoading || registrosGrupo.isLoading || carregandoGrupos || liberacao.isLoading || vendas.isLoading;
  const erro = fontes.error ?? registros.error ?? registrosGrupo.error ?? liberacao.error ?? vendas.error;
  if (carregando) return <LoadingSkeleton />;
  if (erro || !dados) {
    return <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Não foi possível carregar: {(erro as Error)?.message ?? "sem dados"}</p>;
  }

  const { empresas, grupos: gruposAlvo, todasIndicadas, fat, listaVendas, nomeAlvo, liberados } = dados;
  const sitEmp = contarPor(empresas, (a) => a.situacao, SITUACOES);
  const sitGrp = contarPor(gruposAlvo, (a) => a.situacao, SITUACOES);
  const alvosAndamento = tipoAndamento === "empresa" ? empresas : gruposAlvo;
  const porEtapa = contarPor(alvosAndamento, etapaDoAlvo, ETAPAS.map((e) => e.etapa));
  const maxEtapa = Math.max(1, ...Object.values(porEtapa));

  const naoLiberados = [...empresas, ...gruposAlvo].filter((a) => a.situacao === "concluida" && a.comercial !== "liberado");
  const semIntervencao = naoLiberados.filter((a) => a.riscosSemIntervencao > 0).sort((a, b) => b.riscosSemIntervencao - a.riscosSemIntervencao);
  const totalSemIntervencao = semIntervencao.reduce((s, a) => s + a.riscosSemIntervencao, 0);

  const desdeIso = desde == null ? null : new Date(desde).toISOString();
  const vendasPeriodo = listaVendas.filter((v) => !desdeIso || v.vendido_em >= desdeIso);
  const alvosLiberados = [...empresas, ...gruposAlvo].filter((a) => a.comercial === "liberado");
  const convertidos = alvosLiberados.filter((a) => a.vendido).length;
  const aguardando = alvosLiberados.filter((a) => !a.vendido);

  const tempo = resumirTempo(sessoes, agora, desde);
  const media = tempoMedioAteLiberar(sessoes, liberados, agora);
  const horasPorPessoa: Contagem[] = topo(new Map([...tempo.porPessoa].map(([k, v]) => [k, Math.round(v / 60_000)])), 10);
  const horasPorAlvo: Contagem[] = topo(new Map([...tempo.porAlvo].map(([k, v]) => [nomeAlvo.get(k) ?? k.split(":")[1], Math.round(v / 60_000)])), 8);
  const rotuloPeriodo = PERIODOS.find((p) => p.k === periodo)!.rotulo.toLowerCase();

  const listaSituacao = situacaoAberta ? (situacaoAberta.tipo === "empresa" ? empresas : gruposAlvo).filter((a) => a.situacao === situacaoAberta.s) : [];
  const listaEtapa = etapaAberta ? alvosAndamento.filter((a) => etapaDoAlvo(a) === etapaAberta) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <LayoutDashboard className="size-5 text-indigo-600" />
            Dashboard da Consolidação
          </h1>
          <p className="mt-0.5 max-w-3xl text-sm text-gray-500">
            Como estão as consolidações das empresas e dos grupos, o caminho até a venda, os riscos e as intervenções, as vendas e
            o tempo da equipe. Clique num número para ver quem está nele.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>Vendas e tempo:</span>
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 font-medium" role="group" aria-label="Período">
            {PERIODOS.map((p) => (
              <button key={p.k} type="button" onClick={() => setPeriodo(p.k)} aria-pressed={periodo === p.k}
                className={cn("rounded-md px-2.5 py-1", periodo === p.k ? "bg-white text-indigo-700 shadow-sm" : "text-gray-600 hover:text-gray-900")}>
                {p.rotulo}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Números principais */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Numero rotulo="Empresas com AEP/DRPS/QPS" valor={empresas.length} />
        <Numero rotulo="Empresas concluídas" valor={sitEmp.concluida} sub={pct(sitEmp.concluida, empresas.length)} />
        <Numero rotulo="Grupos concluídos" valor={`${sitGrp.concluida} de ${gruposAlvo.length}`} />
        <Numero rotulo="Riscos sem intervenção" valor={totalSemIntervencao} sub={`em ${semIntervencao.length} conciliações fechadas`} alerta={totalSemIntervencao > 0} />
        <Numero rotulo={`Vendas · ${rotuloPeriodo}`} valor={vendasPeriodo.length} />
        <Numero rotulo={`Horas da equipe · ${rotuloPeriodo}`} valor={fmtHoras(tempo.total)} />
      </div>

      {/* Situação da consolidação */}
      <Secao icone={<GitMerge className="size-4" />} titulo="Situação da consolidação" sub="Sem consolidação: nada começado. Pendente: pareceres começados ou conciliação reaberta. Concluída: conciliação fechada.">
        <div className="grid gap-4 lg:grid-cols-2">
          {(["empresa", "grupo"] as const).map((tipo) => {
            const c = tipo === "empresa" ? sitEmp : sitGrp;
            const total = tipo === "empresa" ? empresas.length : gruposAlvo.length;
            return (
              <div key={tipo} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <p className="mb-3 text-sm font-semibold text-gray-800">{tipo === "empresa" ? `Empresas (${total})` : `Grupos (${total})`}</p>
                <div className="grid grid-cols-3 gap-2">
                  {SITUACOES.map((s) => {
                    const ativo = situacaoAberta?.tipo === tipo && situacaoAberta.s === s;
                    return (
                      <button key={s} type="button" aria-pressed={ativo}
                        onClick={() => setSituacaoAberta(ativo ? null : { tipo, s })}
                        className={cn("rounded-lg border px-3 py-2 text-left transition hover:shadow-md", COR_SITUACAO[s], ativo && "ring-2 ring-indigo-400")}>
                        <span className="block text-2xl font-bold tabular-nums">{c[s]}</span>
                        <span className="block text-xs font-medium">{ROTULO_SITUACAO_CONSOLIDACAO[s]}</span>
                        <span className="block text-[11px] opacity-75">{pct(c[s], total)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        {situacaoAberta && (
          <ListaAlvos titulo={`${situacaoAberta.tipo === "empresa" ? "Empresas" : "Grupos"} · ${ROTULO_SITUACAO_CONSOLIDACAO[situacaoAberta.s]}`} alvos={listaSituacao} onFechar={() => setSituacaoAberta(null)} />
        )}
      </Secao>

      {/* Andamento até a venda */}
      <Secao icone={<ChevronRight className="size-4" />} titulo="Andamento até a venda" sub="Em que etapa cada um está, da consolidação à venda. Clique na etapa para ver a lista."
        acao={
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-xs font-medium" role="group" aria-label="Mostrar">
            {(["empresa", "grupo"] as const).map((t) => (
              <button key={t} type="button" onClick={() => { setTipoAndamento(t); setEtapaAberta(null); }} aria-pressed={tipoAndamento === t}
                className={cn("rounded-md px-2.5 py-1", tipoAndamento === t ? "bg-white text-indigo-700 shadow-sm" : "text-gray-600 hover:text-gray-900")}>
                {t === "empresa" ? "Empresas" : "Grupos"}
              </button>
            ))}
          </div>
        }>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <ol className="space-y-1.5">
            {ETAPAS.map((e, i) => {
              const n = porEtapa[e.etapa];
              const ativo = etapaAberta === e.etapa;
              return (
                <li key={e.etapa}>
                  <button type="button" onClick={() => setEtapaAberta(ativo ? null : e.etapa)} aria-pressed={ativo} title={e.dica}
                    className={cn("grid w-full grid-cols-[1.5rem_12rem_1fr_3rem] items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-gray-50", ativo && "bg-indigo-50")}>
                    <span className="text-xs font-semibold text-gray-400">{i + 1}</span>
                    <span className="font-medium text-gray-800">{e.rotulo}</span>
                    <span className="h-3 rounded-full bg-gray-100">
                      <span className="block h-3 rounded-full" style={{ width: `${(n / maxEtapa) * 100}%`, minWidth: n ? 6 : 0, background: COR_BARRA }} />
                    </span>
                    <span className="text-right font-semibold tabular-nums text-gray-900">{n}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
        {etapaAberta && (
          <ListaAlvos titulo={`${tipoAndamento === "empresa" ? "Empresas" : "Grupos"} · ${ETAPAS.find((e) => e.etapa === etapaAberta)!.rotulo}`} alvos={listaEtapa} onFechar={() => setEtapaAberta(null)} />
        )}
      </Secao>

      {/* Riscos e intervenções */}
      <Secao icone={<ShieldAlert className="size-4" />} titulo="Riscos e intervenções" sub="Das últimas conciliações fechadas (empresas e grupos). Cada setor × fator conta 1.">
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Numero rotulo="Riscos confirmados" valor={fat.total} />
          <Numero rotulo="Pediram aprofundar com AET" valor={fat.aet} />
          <Numero rotulo="Intervenções indicadas" valor={todasIndicadas.length} />
          <Numero rotulo="Riscos sem intervenção" valor={totalSemIntervencao} sub="nas ainda não liberadas" alerta={totalSemIntervencao > 0} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Barras titulo="Fatores mais confirmados" unidade="riscos" dados={topo(fat.fatores, 10)} />
          <Barras titulo="Intervenções mais indicadas" unidade="indicações" dados={topo(contarValores(todasIndicadas.map((i) => i.nome)), 10)} />
          <Barras titulo="Modalidades" unidade="indicações" dados={topo(contarValores(todasIndicadas.map((i) => i.modalidade)), 6)} />
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-gray-800">Conciliações fechadas com risco sem intervenção</p>
            <p className="mb-2 text-xs text-gray-400">As que ainda não foram liberadas ao Comercial.</p>
            {semIntervencao.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">Nenhuma: todos os riscos têm intervenção.</p>
            ) : (
              <ul className="divide-y divide-gray-100 text-sm">
                {semIntervencao.slice(0, 8).map((a) => (
                  <li key={`${a.tipo}:${a.id}`}>
                    <Link href={a.href} className="flex items-center justify-between gap-2 py-1.5 hover:text-indigo-700">
                      <span className="truncate">{a.nome} <span className="text-xs text-gray-400">· {a.tipo === "grupo" ? "grupo" : "empresa"}</span></span>
                      <span className="shrink-0 text-xs font-semibold text-amber-700">{a.riscosSemIntervencao} de {a.riscos}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Secao>

      {/* Vendas */}
      <Secao icone={<BadgeCheck className="size-4" />} titulo="Vendas" sub="O que o Comercial registrou como vendido.">
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Numero rotulo={`Vendas · ${rotuloPeriodo}`} valor={vendasPeriodo.length} />
          <Numero rotulo="Liberados ao Comercial" valor={alvosLiberados.length} sub="empresas e grupos" />
          <Numero rotulo="Liberados que viraram venda" valor={convertidos} sub={pct(convertidos, alvosLiberados.length)} />
          <Numero rotulo="Liberados aguardando venda" valor={aguardando.length} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-gray-800">Vendas por mês</p>
            <p className="mb-2 text-xs text-gray-400">Últimos 12 meses</p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porMes(listaVendas.map((v) => v.vendido_em), hojeSP(), 12)} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "var(--text-muted, #6b7280)" }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: "var(--surface-3)" }} content={<BalaoUmValor rotulo="Vendas" cor={COR_BARRA} />} />
                  <Bar dataKey="valor" fill={COR_BARRA} radius={[4, 4, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <Barras titulo={`Por serviço · ${rotuloPeriodo}`} unidade="vendas" dados={topo(contarValores(vendasPeriodo.map((v) => NOME_PRODUTO[v.produto] ?? v.produto)), 7)} />
          <Barras titulo={`Por vendedor · ${rotuloPeriodo}`} unidade="vendas" dados={topo(contarValores(vendasPeriodo.map((v) => v.vendido_por)), 8)} />
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-gray-800">Liberados aguardando venda</p>
            <p className="mb-2 text-xs text-gray-400">Já no Comercial, sem venda registrada depois da liberação.</p>
            {aguardando.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">Nenhum.</p>
            ) : (
              <ul className="divide-y divide-gray-100 text-sm">
                {aguardando.slice(0, 8).map((a) => (
                  <li key={`${a.tipo}:${a.id}`}>
                    <Link href={a.href} className="flex items-center justify-between gap-2 py-1.5 hover:text-indigo-700">
                      <span className="truncate">{a.nome}</span>
                      <span className="shrink-0 text-xs text-gray-400">{a.tipo === "grupo" ? "grupo" : "empresa"}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Secao>

      {/* Tempo e pessoas */}
      <Secao icone={<Clock className="size-4" />} titulo="Tempo e pessoas" sub="O tempo apontado na conciliação e na liberação (empresas e grupos).">
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Numero rotulo={`Horas · ${rotuloPeriodo}`} valor={fmtHoras(tempo.total)} />
          <Numero rotulo={`Pessoas · ${rotuloPeriodo}`} valor={tempo.porPessoa.size} />
          <Numero rotulo="Trabalhando agora" valor={tempo.abertas.length} />
          <Numero rotulo="Tempo médio até liberar" valor={media == null ? "—" : fmtHoras(media)} sub="por empresa/grupo liberado" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Barras titulo={`Horas por pessoa · ${rotuloPeriodo}`} unidade="min" dados={horasPorPessoa} formatar={(v) => fmtHoras(v * 60_000)} />
          <Barras titulo={`Onde o tempo foi · ${rotuloPeriodo}`} unidade="min" dados={horasPorAlvo} formatar={(v) => fmtHoras(v * 60_000)} />
        </div>
        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-800"><Users className="size-4 text-gray-400" /> Trabalhando agora</p>
          {tempo.abertas.length === 0 ? (
            <p className="text-sm text-gray-400">Ninguém com o tempo rodando.</p>
          ) : (
            <ul className="divide-y divide-gray-100 text-sm">
              {tempo.abertas.map((s) => (
                <li key={s.id_sessao} className="flex items-center justify-between gap-2 py-1.5">
                  <span>{s.nome} <span className="text-gray-400">em</span> {nomeAlvo.get(`${s.alvoTipo}:${s.id_inspecao}`) ?? s.id_inspecao}</span>
                  <span className="text-xs text-gray-400">desde {fmtData(s.inicio)} · {fmtHoras(agora - new Date(s.inicio).getTime())}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Secao>

      <p className="flex items-center gap-1.5 text-xs text-gray-400">
        <HeartHandshake className="size-3.5" /> Os números seguem as mesmas regras das listas de Conciliação e de Vendas.
      </p>
    </div>
  );
}

const pct = (n: number, total: number) => (total ? `${Math.round((n / total) * 100)}%` : "—");

function Numero({ rotulo, valor, sub, alerta }: { rotulo: string; valor: ReactNode; sub?: string; alerta?: boolean }) {
  return (
    <div className={cn("rounded-xl border bg-white px-4 py-3 shadow-sm", alerta ? "border-amber-200" : "border-gray-200")}>
      <p className="text-xs font-medium text-gray-500">{rotulo}</p>
      <p className={cn("mt-1 text-2xl font-bold tabular-nums", alerta ? "text-amber-700" : "text-gray-900")}>{valor}</p>
      {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
    </div>
  );
}

function Secao({ icone, titulo, sub, acao, children }: { icone: ReactNode; titulo: string; sub?: string; acao?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900"><span className="text-indigo-600">{icone}</span>{titulo}</h2>
          {sub && <p className="text-xs text-gray-500">{sub}</p>}
        </div>
        {acao}
      </div>
      {children}
    </section>
  );
}

/** Barras horizontais de uma série só (sem legenda: o título diz o que é); o número fica escrito ao lado de cada barra. */
function Barras({ titulo, unidade, dados, formatar }: { titulo: string; unidade: string; dados: Contagem[]; formatar?: (v: number) => string }) {
  const max = Math.max(1, ...dados.map((d) => d.valor));
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="mb-3 text-sm font-semibold text-gray-800">{titulo}</p>
      {dados.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">Sem dados.</p>
      ) : (
        <ul className="space-y-1.5">
          {dados.map((d) => {
            const texto = formatar ? formatar(d.valor) : `${d.valor}`;
            return (
              <li key={d.nome} className="grid grid-cols-[minmax(0,11rem)_1fr_4rem] items-center gap-2 text-xs" title={`${d.nome}: ${texto}${formatar ? "" : ` ${unidade}`}`}>
                <span className="truncate text-gray-700">{d.nome}</span>
                <span className="h-2.5 rounded-full bg-gray-100">
                  <span className="block h-2.5 rounded-full" style={{ width: `${(d.valor / max) * 100}%`, minWidth: d.valor ? 4 : 0, background: COR_BARRA }} />
                </span>
                <span className="text-right font-semibold tabular-nums text-gray-900">{texto}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ListaAlvos({ titulo, alvos, onFechar }: { titulo: string; alvos: AlvoDashboard[]; onFechar: () => void }) {
  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900">{titulo} ({alvos.length})</p>
        <button type="button" onClick={onFechar} className="text-xs font-medium text-indigo-700 hover:underline">Fechar</button>
      </div>
      {alvos.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhum.</p>
      ) : (
        <ul className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
          {[...alvos].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map((a) => (
            <li key={`${a.tipo}:${a.id}`}>
              <Link href={a.href} className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm hover:border-indigo-300 hover:text-indigo-700">
                <span className="truncate">{a.nome}</span>
                <ChevronRight className="size-4 shrink-0 text-gray-400" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
