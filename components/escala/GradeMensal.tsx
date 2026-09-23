"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  usePodeEditarEscala,
  useEscalaSupervisores,
  useUnidadesDaEscala,
} from "@/lib/hooks/useEscalaCadastro";
import { useEscalaPadrao } from "@/lib/hooks/useEscalaPadrao";
import { useEscalaFeriados } from "@/lib/hooks/useEscalaFeriados";
import { indexarDias, useEscalaDias, useLimparDia, useSalvarDia } from "@/lib/hooks/useEscalaDias";
import { useGerarMes } from "@/lib/hooks/useEscalaGeracao";
import { gerarMes } from "@/lib/escala/gerar";
import { supervisoresDoRelatorio } from "@/lib/escala/relatorios";
import { useEscalaStore } from "@/lib/escala/store";
import { diaUtilDe, diasDoMes, paraDataLocal, rotuloMes } from "@/lib/escala/datas";
import { colunasParaAlocacao, type Alocacao } from "@/lib/escala/tipos";
import EditorDia, { type DiaEmEdicao } from "@/components/escala/EditorDia";

/**
 * Grade mensal (Fase 5) — as abas Jan…Dez da planilha, em uma tela só.
 *
 * A planilha resolvia doze meses com doze abas iguais. Aqui é uma tela que
 * troca de mês, e o mês **não persiste**: quem volta ao painel semanas depois
 * quer o mês de hoje, não o que estava aberto (a mesma decisão dos dashboards,
 * depois da queixa de "números enormes" em 27/08).
 *
 * Linha = dia, coluna = supervisor. É a orientação da planilha, e é a que
 * aguenta crescer: mais supervisores empurram para o lado, com rolagem, em vez
 * de espremer as colunas de dia.
 *
 * O que a tela deixa claro o tempo todo é a ORIGEM de cada célula: o que veio
 * do padrão e o que alguém mexeu à mão. Sem isso, "por que este dia está
 * assim?" não teria resposta — e é a pergunta que a planilha nunca soube
 * responder, porque sobrescrever a fórmula não deixava rastro.
 */

/** Sábado e domingo continuam existindo como linha, vazios — igual à planilha. */
const DIAS_CURTOS = ["", "seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

export default function GradeMensal() {
  const ano = useEscalaStore((s) => s.ano);
  const mes = useEscalaStore((s) => s.mes);
  const mesAnterior = useEscalaStore((s) => s.mesAnterior);
  const proximoMes = useEscalaStore((s) => s.proximoMes);
  const irParaHoje = useEscalaStore((s) => s.irParaHoje);

  const { data: todosSupervisores = [], isLoading: carSup } = useEscalaSupervisores(false);
  const { data: unidades = [] } = useUnidadesDaEscala(true);
  const { data: padroes = [] } = useEscalaPadrao({ todas: true });
  const { data: feriados = [] } = useEscalaFeriados(ano);
  const { data: dias = [], isLoading: carDias } = useEscalaDias(ano, mes);

  const salvarDia = useSalvarDia();
  const limparDia = useLimparDia();
  const gerar = useGerarMes();
  const podeEditar = usePodeEditarEscala();

  const [emEdicao, setEmEdicao] = useState<DiaEmEdicao | null>(null);

  const porUnidade = useMemo(
    () => new Map(unidades.map((u) => [u.id_unidade, u])),
    [unidades]
  );
  /**
   * As colunas do mês: os ativos, MAIS quem tem dia gravado neste mês.
   *
   * 🐛 Achado no QA da Fase 8. Mostrar só os ativos fazia o mês ficar
   * inexplicável quando alguém era inativado no meio dele: os dias da primeira
   * quinzena continuavam no banco, mas sem coluna para aparecer. Quem olhasse
   * a grade não teria como saber quem cobriu o dia 5.
   */
  const supervisores = useMemo(
    () => supervisoresDoRelatorio(todosSupervisores, dias),
    [todosSupervisores, dias]
  );

  const indice = useMemo(() => indexarDias(dias), [dias]);
  const datas = useMemo(() => diasDoMes(ano, mes), [ano, mes]);

  /** Feriado de alcance geral na data — o que a coluna "Feriado" mostra. */
  const feriadoGeralPorData = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of feriados) {
      if (f.abrangencia === "municipal") continue;
      m.set(f.data, f.descricao);
    }
    return m;
  }, [feriados]);

  /**
   * O que uma geração faria AGORA. Calculado na tela, com a mesma função pura
   * que grava — assim o botão promete exatamente o que vai acontecer, em vez de
   * um "Gerar" cego que a pessoa clica sem saber o tamanho.
   */
  const previsao = useMemo(
    () =>
      gerarMes({
        ano,
        mes,
        // A GERAÇÃO só recebe os ATIVOS. A grade mostra quem saiu para o mês
        // continuar explicável, mas criar dia novo para quem saiu da equipe
        // seria escalar um ausente.
        supervisores: todosSupervisores.filter((s) => s.ativo),
        padroes,
        feriados,
        unidades,
        existentes: dias,
      }),
    [ano, mes, todosSupervisores, padroes, feriados, unidades, dias]
  );

  const manuais = dias.filter((d) => d.origem === "manual").length;
  const nadaAFazer = previsao.aCriar.length === 0 && previsao.aAtualizar.length === 0;

  function abrir(id_supervisor: string, data: string) {
    if (!podeEditar) return;
    if (diaUtilDe(data) === null) return; // fim de semana não se edita
    const supervisor = supervisores.find((s) => s.id_supervisor === id_supervisor);
    if (!supervisor) return;
    const existente = indice.get(`${id_supervisor}|${data}`) ?? null;
    setEmEdicao({
      supervisor,
      data,
      existente,
      alocacao: existente ? colunasParaAlocacao(existente) : null,
    });
  }

  if (carSup || carDias) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-gray-500">
        <Loader2 className="size-4 animate-spin" />
        Carregando a grade...
      </div>
    );
  }

  if (supervisores.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-10 text-center">
        <Users className="mx-auto mb-2 size-7 text-gray-300" />
        <p className="font-medium text-gray-700">Nenhum supervisor ativo</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
          A grade se monta sobre a equipe e o padrão semanal. Comece pela aba Supervisores da{" "}
          <Link href="/escala/configuracao" className="font-medium text-[#0E7490] underline">
            Configuração
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Navegação do mês ─────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={mesAnterior}
            className="rounded border border-gray-300 p-1 text-gray-600 hover:bg-gray-50"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="min-w-[10rem] text-center text-lg font-bold text-gray-900 first-letter:uppercase">
            {rotuloMes(ano, mes)}
          </span>
          <button
            type="button"
            onClick={proximoMes}
            className="rounded border border-gray-300 p-1 text-gray-600 hover:bg-gray-50"
            aria-label="Próximo mês"
          >
            <ChevronRight className="size-4" />
          </button>
          <button
            type="button"
            onClick={irParaHoje}
            className="ml-1 rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
          >
            Hoje
          </button>
        </div>

        {podeEditar && (
          <button
            type="button"
            onClick={() =>
              gerar.mutate({
                ano,
                mes,
                supervisores: todosSupervisores.filter((s) => s.ativo),
                padroes,
                feriados,
                unidades,
                existentes: dias,
              })
            }
            disabled={gerar.isPending || nadaAFazer}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0891B2] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#0E7490] disabled:opacity-50"
            title={
              nadaAFazer
                ? "O mês já está de acordo com o padrão semanal"
                : "Preenche o mês a partir do padrão semanal"
            }
          >
            {gerar.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            Gerar o mês
          </button>
        )}
      </div>

      {/* ── O que a geração faria ────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
        <span>
          <strong className="text-gray-900 tabular-nums">{previsao.diasDeSemana}</strong> dias de
          semana
        </span>
        <span>
          <strong className="text-gray-900 tabular-nums">{previsao.diasComFeriadoGeral}</strong> com
          feriado
        </span>
        <span className="text-gray-300">|</span>
        {nadaAFazer ? (
          <span className="font-medium text-emerald-700">
            O mês está de acordo com o padrão semanal.
          </span>
        ) : (
          <span>
            A geração criaria{" "}
            <strong className="text-gray-900 tabular-nums">{previsao.aCriar.length}</strong> e
            atualizaria{" "}
            <strong className="text-gray-900 tabular-nums">{previsao.aAtualizar.length}</strong>.
          </span>
        )}
        {manuais > 0 && (
          <>
            <span className="text-gray-300">|</span>
            <span className="font-medium text-amber-700">
              {manuais === 1 ? "1 exceção preservada" : `${manuais} exceções preservadas`}
            </span>
          </>
        )}
        {previsao.semPadrao > 0 && (
          <>
            <span className="text-gray-300">|</span>
            <span title="Pares (supervisor, dia da semana) sem padrão definido">
              <strong className="tabular-nums">{previsao.semPadrao}</strong> sem padrão
            </span>
          </>
        )}
      </div>

      {/* ── A grade ──────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-600">
            <tr>
              <th className="w-20 px-3 py-2">Data</th>
              <th className="min-w-[9rem] px-3 py-2">Feriado</th>
              {supervisores.map((s) => (
                <th key={s.id_supervisor} className="min-w-[9rem] px-3 py-2">
                  {s.nome_resumido || s.nome}
                  {!s.ativo && (
                    <span className="block text-[10px] font-normal text-gray-400">
                      saiu da equipe
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {datas.map((data) => {
              const d = paraDataLocal(data);
              const iso = diaUtilDe(data);
              const fimDeSemana = iso === null;
              const feriadoTxt = feriadoGeralPorData.get(data) ?? null;

              return (
                <tr key={data} className={cn(fimDeSemana && "bg-gray-50/70")}>
                  <td className="px-3 py-1.5 tabular-nums">
                    <span
                      className={cn(
                        "font-medium",
                        fimDeSemana ? "text-gray-400" : "text-gray-900"
                      )}
                    >
                      {String(d.getDate()).padStart(2, "0")}
                    </span>{" "}
                    <span className="text-xs text-gray-400">
                      {DIAS_CURTOS[fimDeSemana ? (d.getDay() === 6 ? 6 : 7) : iso]}
                    </span>
                  </td>

                  <td className="px-3 py-1.5 text-xs">
                    {feriadoTxt && <span className="text-red-700">{feriadoTxt}</span>}
                  </td>

                  {supervisores.map((s) => {
                    if (fimDeSemana) return <td key={s.id_supervisor} className="px-2 py-1.5" />;

                    const linha = indice.get(`${s.id_supervisor}|${data}`);
                    const a: Alocacao | null = linha ? colunasParaAlocacao(linha) : null;
                    const manual = linha?.origem === "manual";

                    return (
                      <td key={s.id_supervisor} className="px-2 py-1">
                        <button
                          type="button"
                          onClick={() => abrir(s.id_supervisor, data)}
                          disabled={!podeEditar}
                          title={linha?.observacao ?? undefined}
                          className={cn(
                            "flex min-h-[1.9rem] w-full flex-wrap items-center gap-1 rounded border px-1.5 py-0.5 text-left",
                            podeEditar
                              ? "border-transparent hover:border-[#0891B2] hover:bg-gray-50"
                              : "cursor-default border-transparent",
                            manual && "border-amber-300 bg-amber-50/60"
                          )}
                        >
                          {a === null ? (
                            <span className="text-xs text-gray-300">—</span>
                          ) : a.tipo === "unidades" ? (
                            a.unidade_ids.map((id) => {
                              const u = porUnidade.get(id);
                              return (
                                <span
                                  key={id}
                                  className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[11px] font-medium text-gray-700"
                                >
                                  <span
                                    className="inline-block size-2 shrink-0 rounded-full"
                                    style={{ backgroundColor: u?.cor_hex ?? "#0ea5e9" }}
                                  />
                                  {u?.nome ?? "removida"}
                                </span>
                              );
                            })
                          ) : (
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full border px-1.5 py-0.5 text-[11px] font-medium",
                                a.situacao === "Feriado"
                                  ? "border-red-200 bg-red-50 text-red-700"
                                  : "border-slate-200 bg-slate-100 text-slate-600"
                              )}
                            >
                              {a.situacao}
                            </span>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-3 rounded border border-amber-300 bg-amber-50" />
          exceção mexida à mão — a geração não desfaz
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="size-3.5" />
          célula sem borda veio do padrão semanal
        </span>
      </div>

      {emEdicao && (
        <EditorDia
          dia={emEdicao}
          unidades={unidades}
          feriado={feriadoGeralPorData.get(emEdicao.data) ?? null}
          salvando={salvarDia.isPending || limparDia.isPending}
          onFechar={() => setEmEdicao(null)}
          onSalvar={async (alocacao, observacao) => {
            try {
              await salvarDia.mutateAsync({
                id_supervisor: emEdicao.supervisor.id_supervisor,
                data: emEdicao.data,
                alocacao,
                observacao,
                // Explícito, ainda que seja o default do hook: é a linha que faz
                // a exceção sobreviver à regeração, e ela não pode depender de
                // um default mudar sem ninguém notar.
                origem: "manual",
              });
              setEmEdicao(null);
            } catch {
              // toast já saiu no hook; o modal fica aberto com o que foi escolhido
            }
          }}
          onVoltarAoPadrao={async () => {
            try {
              await limparDia.mutateAsync({
                id_supervisor: emEdicao.supervisor.id_supervisor,
                data: emEdicao.data,
              });
              setEmEdicao(null);
            } catch {
              // idem
            }
          }}
        />
      )}
    </div>
  );
}
