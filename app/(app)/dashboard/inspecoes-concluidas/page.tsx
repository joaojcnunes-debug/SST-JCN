"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, TrendingUp, Users, X } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  LabelList,
  Legend,
} from "recharts";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { fetchAllRows } from "@/lib/supabase/fetchAllRows";
import { mesAbsAgoraSP, rotuloMesAbs } from "@/lib/dashboard/mes";
import {
  conclusaoEhAproximada,
  mesDeConclusao,
  porTecnico as agruparPorTecnico,
  resumoCredito,
  ehRenovacao,
  type InspecaoContavel,
  type TecnicoDeCampo,
  type TecnicoInspecoes,
} from "@/lib/dashboard/inspecoes";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { BalaoGrafico, BalaoUmValor, LinhaBalao } from "@/components/ui/BalaoGrafico";

// A régua (qual mês, o que é cópia) mora em lib/dashboard/inspecoes e é a MESMA
// do card do dashboard. Antes cada tela tinha a sua cópia da conta e as duas
// divergiam: julho aparecia 219 no card e 220 aqui.
async function fetchConcluidas(): Promise<InspecaoContavel[]> {
  const supabase = createSupabaseBrowserClient();
  const linhas = await fetchAllRows<InspecaoContavel>(
    (de, ate) =>
      supabase
        .from("inspecoes")
        .select("id_inspecao, status, data_inspecao, concluida_em, created_at, tipo_criacao, responsavel")
        .eq("status", "CONCLUIDA")
        .range(de, ate),
  );
  // Renovação de documento não é inspeção concluída (23/09) — nem no total do
  // topo, nem na barra de ninguém.
  return linhas.filter((i) => !ehRenovacao(i.tipo_criacao));
}

/**
 * Quem foi A CAMPO, por inspeção — a aba "Responsáveis".
 *
 * É outra tabela porque uma inspeção pode ter mais de um técnico: quando dois
 * se dividem numa visita grande, cada um tem a sua linha e o trabalho conta
 * para os dois.
 */
async function fetchTecnicosDeCampo(): Promise<Map<string, TecnicoDeCampo[]>> {
  const supabase = createSupabaseBrowserClient();
  const linhas = await fetchAllRows<{
    id_inspecao: string;
    tecnico_responsavel: string | null;
    id_usuario: string | null;
  }>((de, ate) =>
    supabase
      .from("responsaveis")
      // `id_usuario` é a v204 (Fase B, 10/09): quando está preenchido, quem é
      // a pessoa é fato gravado e não dedução em cima do texto digitado.
      .select("id_inspecao, tecnico_responsavel, id_usuario")
      .range(de, ate),
  );

  const mapa = new Map<string, TecnicoDeCampo[]>();
  for (const l of linhas) {
    const nome = (l.tecnico_responsavel ?? "").trim();
    // Linha em branco continua não creditando ninguém, mesmo que um dia tenha
    // vínculo: quem foi a campo é a pergunta da aba, e ela ficou sem resposta.
    if (!nome) continue;
    const item = { digitado: nome, idUsuario: l.id_usuario ?? null };
    const atual = mapa.get(l.id_inspecao);
    if (atual) atual.push(item);
    else mapa.set(l.id_inspecao, [item]);
  }
  return mapa;
}

/**
 * As contas do painel — id e nome.
 *
 * O nome serve de lista canônica para o tradutor de grafia; o id serve para a
 * Fase B traduzir o `id_usuario` gravado de volta ao nome, que é a chave da
 * barra do gráfico. Uma consulta só, para as duas coisas.
 */
async function fetchContasDoCadastro(): Promise<
  { id_usuario: string; nome: string }[]
> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("usuarios")
    .select("id_usuario, nome")
    .neq("perfil", "Cliente");
  if (error) throw error;
  return ((data ?? []) as { id_usuario: string | null; nome: string | null }[])
    .map((u) => ({
      id_usuario: (u.id_usuario ?? "").trim(),
      nome: (u.nome ?? "").trim(),
    }))
    .filter((u) => u.nome !== "");
}

/**
 * Bloco que aparece ao passar o mouse na barra da pessoa: UM número, o total
 * de inspeções concluídas dela no recorte.
 *
 * De 27/08 a 15/09 este balão tinha cinco linhas — visitas novas, cópias e o
 * destino de cada inspeção no administrativo (entregue / em elaboração /
 * ninguém pegou). Saiu a pedido de 15/09: era "diversos números e conclusões"
 * para quem só queria saber quantas fechou. A divisão visita nova × cópia
 * continua VISÍVEL na própria barra (duas cores, legenda embaixo); o destino
 * no administrativo, que é trabalho de outra equipe, saiu desta tela — o
 * cálculo (`docEntregue`/`docEmElaboracao`/`docNaoIniciado`) segue em
 * lib/dashboard/inspecoes, sem consumidor de tela por enquanto.
 */
function BlocoTecnico({
  active, payload, label,
}: {
  active?: boolean;
  payload?: { payload?: TecnicoInspecoes }[];
  label?: string;
}) {
  const d = active ? payload?.[0]?.payload : undefined;
  if (!d) return null;
  return (
    <BalaoGrafico titulo={label}>
      <LinhaBalao texto="Concluídas" valor={d.total} cor="#0ea5e9" />
    </BalaoGrafico>
  );
}

const ROTULO_TOTAL = { fontSize: 12, fontWeight: 700, fill: "var(--text-strong)" } as const;

export default function InspecoesConcluidasDashboard() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["dashboard-concluidas-detalhe"],
    queryFn: fetchConcluidas,
  });
  const { data: tecnicosDeCampo } = useQuery({
    queryKey: ["dashboard-tecnicos-campo"],
    queryFn: fetchTecnicosDeCampo,
    staleTime: 5 * 60 * 1000,
  });
  const { data: contas = [] } = useQuery({
    queryKey: ["dashboard-contas-cadastro"],
    queryFn: fetchContasDoCadastro,
    staleTime: 5 * 60 * 1000,
  });
  const cadastro = useMemo(() => contas.map((c) => c.nome), [contas]);

  /**
   * Começa no MÊS CORRENTE — mesma correção das telas de documentos (27/08).
   * Aberta no acumulado, a barra soma todos os meses e é lida como produção do
   * mês: a primeira colocada aparecia com 76 onde o mês dela é ~20.
   */
  const [mesSel, setMesSel] = useState<string | null>(String(mesAbsAgoraSP()));

  const mesAtual = mesAbsAgoraSP();

  // Por mês — últimos 12 meses (cada barra tem sua chave = mês absoluto)
  const porMes = Array.from({ length: 12 }, (_, i) => {
    const abs = mesAtual - (11 - i);
    return { chave: String(abs), mes: rotuloMesAbs(abs, true), total: 0 };
  });
  rows.forEach((r) => {
    const abs = mesDeConclusao(r);
    if (abs == null) return;
    const item = porMes.find((m) => m.chave === String(abs));
    if (item) item.total++;
  });

  const mesSelLabel = mesSel ? porMes.find((m) => m.chave === mesSel)?.mes ?? null : null;

  // Por pessoa — filtrado pelo mês selecionado (ou todos)
  const rowsTec = mesSel ? rows.filter((r) => String(mesDeConclusao(r)) === mesSel) : rows;
  const porTecnico = agruparPorTecnico(rowsTec, {
    tecnicosDeCampo,
    cadastro,
    contas,
  });
  const totalCopias = porTecnico.reduce((s, t) => s + t.copias, 0);
  const credito = resumoCredito(rowsTec, tecnicosDeCampo);

  /**
   * Quanto a soma das barras passa do número de inspeções.
   *
   * Quando dois técnicos dividem uma visita, a inspeção conta inteira para cada
   * um — é a regra de 25/08, e está certa. O que faltava era DIZER isso: hoje
   * são 12 inspeções, e quem soma as barras acha 12 a mais do que existe.
   */
  const somaBarras = porTecnico.reduce((s, t) => s + t.total, 0);
  const excedenteDupla = somaBarras - rowsTec.length;

  // Conclusões do recorte cuja data é ESTIMADA (backfill da v154). Julho inteiro
  // é estimado — o card do dashboard já avisa, esta tela não avisava.
  const estimadas = rowsTec.filter(conclusaoEhAproximada).length;

  const total = rows.length;

  return (
    <div className="space-y-5">
      <div>
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-verde-primary">
          <ArrowLeft className="size-4" /> Voltar ao dashboard
        </Link>
        <h1 className="mt-1 flex items-center gap-2 text-xl font-bold text-gray-900">
          <CheckCircle2 className="size-5 text-verde-primary" />
          Inspeções Concluídas
        </h1>
        <p className="text-sm text-gray-500">
          {isLoading ? "Carregando…" : `${total} inspeç${total !== 1 ? "ões" : "ão"} concluída${total !== 1 ? "s" : ""} no total`}
        </p>
      </div>

      {/* Por mês */}
      <div className="reveal-up card-hover rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-4 text-verde-primary" />
            <h2 className="text-sm font-semibold text-gray-800">Por mês (últimos 12 meses)</h2>
          </div>
          <p className="text-xs text-gray-400">Clique num mês para filtrar abaixo</p>
        </div>
        {isLoading ? (
          <div className="h-56 animate-pulse rounded-xl bg-gray-100" />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            {/* `left: -16` + `width={28}` cortava os números do eixo (15/09). */}
            <BarChart data={porMes} barSize={26} margin={{ top: 16, right: 4, left: 0, bottom: 0 }}>
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
              <Tooltip cursor={{ fill: "var(--grafico-cursor)" }} content={<BalaoUmValor rotulo="Concluídas" />} />
              <Bar
                dataKey="total"
                radius={[6, 6, 0, 0]}
                cursor="pointer"
                onClick={(d: { chave?: string; payload?: { chave?: string } }) => {
                  // Usa a chave do próprio dado clicado (o index do recharts não é confiável).
                  const k = d?.chave ?? d?.payload?.chave ?? null;
                  if (!k) return;
                  setMesSel((atual) => (atual === k ? null : k));
                }}
              >
                {porMes.map((m) => (
                  <Cell key={m.chave} fill={mesSel === m.chave ? "#0ea5e9" : "#0ea5e960"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Por técnico */}
      <div className="reveal-up card-hover rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-verde-primary" />
            <div>
              <h2 className="text-sm font-semibold text-gray-800">
                Por pessoa {mesSelLabel ? `— ${mesSelLabel}` : "— acumulado de todos os meses"}
              </h2>
              {/* Desde 25/08 conta QUEM FOI A CAMPO (aba Responsáveis), e os
                  dois quando foram dois. Só cai em "quem lançou no sistema"
                  quando a inspeção não tem técnico registrado — e nesse caso o
                  aviso abaixo mostra quantas são, de propósito: o buraco de
                  preenchimento tem de chegar em quem preenche. */}
              <p className="text-xs text-gray-400">
                {mesSelLabel
                  ? "Quem fez a visita"
                  : "Soma de todos os meses — não é a produção de um mês"}
                {totalCopias > 0 && <> · {totalCopias} cópia(s)/revisão(ões) no recorte</>}
              </p>
            </div>
          </div>
          {mesSel ? (
            <button
              type="button"
              onClick={() => setMesSel(null)}
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              Ver todos os meses
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setMesSel(String(mesAbsAgoraSP()))}
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              <X className="size-3" /> Voltar ao mês atual
            </button>
          )}
        </div>
        {!isLoading && excedenteDupla > 0 && (
          <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
            A soma das barras dá <strong>{somaBarras}</strong> para{" "}
            <strong>{rowsTec.length}</strong> inspeç{rowsTec.length !== 1 ? "ões" : "ão"}:{" "}
            {excedenteDupla} {excedenteDupla !== 1 ? "foram feitas" : "foi feita"} por dois
            técnicos, e visita dividida conta inteira para cada um.
          </div>
        )}
        {!isLoading && estimadas > 0 && (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <strong>{estimadas}</strong> {estimadas !== 1 ? "destas conclusões têm" : "desta conclusão tem"}{" "}
            data <strong>estimada</strong>: o painel só passou a registrar o momento da
            finalização em 04/08/2026, e o que é anterior herdou a data da última alteração
            da inspeção.
          </div>
        )}
        {!isLoading && credito.semRegistro > 0 && (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <strong>{credito.semRegistro}</strong> inspeç{credito.semRegistro !== 1 ? "ões" : "ão"} do recorte
            não {credito.semRegistro !== 1 ? "têm" : "tem"} técnico registrado na aba
            Responsáveis; {credito.semRegistro !== 1 ? "elas contam" : "ela conta"} para quem lançou no
            sistema. Preencher a aba corrige a contagem e faz o técnico assinar o relatório.
          </div>
        )}
        {isLoading ? (
          <LoadingSkeleton rows={4} />
        ) : porTecnico.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">
            Nenhuma inspeção concluída{mesSelLabel ? ` em ${mesSelLabel}` : ""}.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(160, porTecnico.length * 38)}>
            <BarChart
              data={porTecnico}
              layout="vertical"
              barSize={22}
              margin={{ top: 4, right: 40, left: 8, bottom: 0 }}
            >
              <XAxis type="number" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="tecnico"
                tick={{ fontSize: 11, fill: "#374151" }}
                axisLine={false}
                tickLine={false}
                width={150}
              />
              <Tooltip cursor={{ fill: "var(--grafico-cursor)" }} content={<BlocoTecnico />} />
              <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
              {/* Empilhado: o total continua o mesmo, mas dá para ver quanto
                  dele é cópia/revisão em vez de visita nova. */}
              {/* O total no fim da barra. O recharts 3 DESCARTA o retângulo de
                  valor zero antes de desenhar os rótulos (Bar.js: "Filter out
                  0-dimension rectangles"), então um LabelList só na barra das
                  cópias sumia para quem não tem cópia — em 15/09, 10 das 12
                  pessoas do mês estavam sem número. Cada barra rotula os seus:
                  a das visitas quem não tem cópia, a das cópias quem tem. */}
              <Bar dataKey="novas" name="Visitas novas" stackId="t" fill="#0ea5e9" radius={[0, 0, 0, 0]}>
                <LabelList
                  valueAccessor={(e) => ((e.payload as TecnicoInspecoes).copias > 0 ? null : (e.payload as TecnicoInspecoes).total)}
                  position="right"
                  style={ROTULO_TOTAL}
                />
              </Bar>
              <Bar dataKey="copias" name="Cópias/revisões" stackId="t" fill="#94a3b8" radius={[0, 6, 6, 0]}>
                <LabelList dataKey="total" position="right" style={ROTULO_TOTAL} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
