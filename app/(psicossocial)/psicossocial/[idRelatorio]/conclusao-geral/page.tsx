"use client";

import { use, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  Save,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useEmpresa } from "@/lib/hooks/useEmpresas";
import RichTextEditor from "@/components/drps/RichTextEditor";
import { useCanEdit } from "@/lib/hooks/useUsuario";
import {
  useDrpsProbabilidades,
  useDrpsRelatorio,
  useDrpsRespondentes,
  useDrpsSalvarRelatorio,
} from "@/lib/hooks/useDrps";
import {
  aplicarMatriz,
  calcularResumoCompleto,
  filtrarPorSetor,
  listarSetores,
} from "@/lib/drps/calculos";
import { TOPICOS } from "@/lib/drps/topicos";
import type {
  DrpsProbabilidade,
  TopicoComMatriz,
} from "@/lib/drps/types";

function montarMapaProb(
  probabilidades: DrpsProbabilidade[],
  setor: string
): Record<number, 1 | 2 | 3> {
  const m: Record<number, 1 | 2 | 3> = {};
  for (let i = 0; i < TOPICOS.length; i++) m[i] = 1;
  for (const p of probabilidades) {
    if (p.setor === setor) {
      m[p.topico_idx] = p.probabilidade as 1 | 2 | 3;
    }
  }
  return m;
}

/** Pior caso da matriz por tópico — usado pra agregação consolidada do relatório. */
function piorMatriz(a: string | null, b: string | null): string | null {
  const ordem = ["Crítico", "Alto", "Médio", "Baixo"];
  const ia = a ? ordem.indexOf(a) : -1;
  const ib = b ? ordem.indexOf(b) : -1;
  if (ia === -1) return b;
  if (ib === -1) return a;
  return ia < ib ? a : b;
}

export default function ConclusaoGeralPage({
  params,
}: {
  params: Promise<{ idRelatorio: string }>;
}) {
  const { idRelatorio } = use(params);
  const canEdit = useCanEdit();

  const { data: relatorio, isLoading: loadRelatorio } =
    useDrpsRelatorio(idRelatorio);
  const { data: respondentes = [], isLoading: loadResp } =
    useDrpsRespondentes(idRelatorio);
  const { data: probabilidades = [], isLoading: loadProb } =
    useDrpsProbabilidades(idRelatorio);
  const { data: empresa } = useEmpresa(relatorio?.id_empresa);
  const salvar = useDrpsSalvarRelatorio();

  const [conclusao, setConclusao] = useState("");
  const [gerandoIA, setGerandoIA] = useState(false);

  // Sincroniza com o que vem do banco
  useEffect(() => {
    if (!relatorio) return;
    setConclusao(relatorio.conclusao_geral ?? "");
  }, [relatorio]);

  const setores = useMemo(() => listarSetores(respondentes), [respondentes]);

  // Agregação consolidada — tópicos com matriz "pior caso" entre setores
  const topicosConsolidados = useMemo<TopicoComMatriz[]>(() => {
    if (respondentes.length === 0) return [];
    // Calcula por setor, depois acha o pior matriz por tópico
    const porSetor = setores.map((s) => {
      const filtrados = filtrarPorSetor(respondentes, s);
      const resumo = calcularResumoCompleto(filtrados);
      const mapa = montarMapaProb(probabilidades, s);
      return aplicarMatriz(resumo, mapa);
    });
    if (porSetor.length === 0) return [];
    // Agrega: pega o pior matriz por índice de tópico
    return TOPICOS.map((_, idx) => {
      let pior: TopicoComMatriz | null = null;
      for (const arr of porSetor) {
        const t = arr[idx];
        if (!t) continue;
        if (!pior) {
          pior = t;
          continue;
        }
        const piorMat = piorMatriz(pior.matriz, t.matriz);
        if (piorMat === t.matriz && piorMat !== pior.matriz) pior = t;
      }
      return pior ?? porSetor[0]?.[idx] ?? null;
    }).filter((t): t is TopicoComMatriz => t !== null);
  }, [respondentes, setores, probabilidades]);

  const stats = useMemo(() => {
    const totalRespondentes = respondentes.length;
    const totalSetores = setores.length;
    const criticos = topicosConsolidados.filter(
      (t) => t.matriz === "Crítico"
    ).length;
    const altos = topicosConsolidados.filter((t) => t.matriz === "Alto").length;
    const medios = topicosConsolidados.filter(
      (t) => t.matriz === "Médio"
    ).length;
    const baixos = topicosConsolidados.filter(
      (t) => t.matriz === "Baixo"
    ).length;
    return { totalRespondentes, totalSetores, criticos, altos, medios, baixos };
  }, [respondentes, setores, topicosConsolidados]);

  function handleSalvar() {
    if (!relatorio || !canEdit) return;
    salvar.mutate({
      id_relatorio: idRelatorio,
      id_empresa: relatorio.id_empresa,
      conclusao_geral: conclusao.trim() || null,
    });
  }

  async function handleGerarIA() {
    if (!relatorio) return;
    if (topicosConsolidados.length === 0) {
      toast.error("Sem tópicos avaliados — adicione respondentes e avalie probabilidades antes.");
      return;
    }
    setGerandoIA(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.functions.invoke(
        "gerar-conclusao-drps-ia",
        {
          body: {
            empresa: empresa
              ? { nome: empresa.nome_empresa, cnpj: empresa.cnpj ?? null }
              : null,
            setor: {
              nome: "Todos os setores",
              funcoes: relatorio.funcoes ?? null,
              totalRespondentes: stats.totalRespondentes,
            },
            ehConsolidado: true,
            responsavelTecnico: relatorio.responsavel_tecnico ?? null,
            crp: relatorio.crp ?? null,
            topicos: topicosConsolidados.map((t) => ({
              nome: t.nome.replace(/^Tópico \d+ - /, ""),
              fonteGeradora: t.fonteGeradora,
              gravidade: t.classificacaoGravidade.texto,
              probabilidade: t.classificacaoProbabilidade,
              matriz: t.matriz,
            })),
            agravos: relatorio.agravos_saude_mental ?? null,
            medidasExistentes: relatorio.medidas_existentes ?? null,
            textoAtual: conclusao.trim() || null,
          },
        }
      );
      if (error) throw error;
      const result = (data as { data?: { conclusao?: string } } | null)?.data;
      if (!result?.conclusao) {
        throw new Error("Resposta inválida da IA — tente novamente");
      }
      setConclusao(result.conclusao);
      toast.success("Conclusão gerada — revise e salve antes de finalizar");
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Falha ao gerar conclusão"
      );
    } finally {
      setGerandoIA(false);
    }
  }

  const carregando = loadRelatorio || loadResp || loadProb;

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  if (!relatorio) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <AlertTriangle className="size-4" />
        Relatório não encontrado.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
          <CheckCircle2 className="size-5 text-verde-primary" />
          Conclusão Geral do Relatório
        </h1>
        <p className="text-sm text-gray-600">
          Síntese técnica consolidada do diagnóstico DRPS — agrega todos os
          setores avaliados, agravos potenciais e medidas existentes. Usada
          como fechamento do PDF do relatório.
        </p>
      </div>

      {/* Resumo agregado */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ResumoCard label="Setores" valor={stats.totalSetores} cor="emerald" />
        <ResumoCard
          label="Respondentes"
          valor={stats.totalRespondentes}
          cor="blue"
        />
        <ResumoCard label="Críticos" valor={stats.criticos} cor="red" />
        <ResumoCard label="Altos" valor={stats.altos} cor="orange" />
      </div>

      {/* Distribuição secundária — opcional, info-only */}
      <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
        Distribuição completa por matriz: <strong>{stats.criticos}</strong> crítico(s),{" "}
        <strong>{stats.altos}</strong> alto(s), <strong>{stats.medios}</strong>{" "}
        médio(s), <strong>{stats.baixos}</strong> baixo(s) — pior caso entre
        setores por tópico.
      </div>

      {/* Editor da conclusão */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700">
            Texto da conclusão
          </h2>
          {canEdit && (
            <button
              type="button"
              onClick={handleGerarIA}
              disabled={gerandoIA || topicosConsolidados.length === 0}
              title="IA gera conclusão consolidada com base nos tópicos avaliados de todos os setores, agravos e medidas existentes"
              className="inline-flex items-center gap-1.5 rounded-md border border-purple-300 bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 disabled:opacity-50"
            >
              {gerandoIA ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              {gerandoIA ? "Gerando..." : "Gerar com IA"}
            </button>
          )}
        </div>
        {canEdit && (
          <p className="rounded-md border border-purple-100 bg-purple-50/40 px-2 py-1.5 text-[11px] text-purple-800">
            <Sparkles className="mr-1 inline size-3" />
            A IA analisa os tópicos de TODOS os setores (matriz pior-caso) +
            agravos + medidas existentes. Revise antes de salvar — a
            responsabilidade técnica é do psicólogo.
          </p>
        )}
        <RichTextEditor
          value={conclusao}
          onChange={setConclusao}
          readOnly={!canEdit}
          uploadPathPrefix="drps-conclusao-geral"
          placeholder="Conclusão técnica consolidada do diagnóstico DRPS. Mencione os tópicos com maior matriz de risco entre os setores avaliados, articule com os agravos potenciais e cite as medidas de controle existentes. Cite NR-01 (item 1.5 - GRO/PGR) e NR-17 quando pertinente."
        />
        {canEdit && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSalvar}
              disabled={salvar.isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-50"
            >
              {salvar.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Salvar conclusão geral
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ResumoCard({
  label,
  valor,
  cor,
}: {
  label: string;
  valor: number;
  cor: "emerald" | "blue" | "red" | "orange";
}) {
  const cores: Record<string, string> = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    red: "border-red-200 bg-red-50 text-red-700",
    orange: "border-orange-200 bg-orange-50 text-orange-700",
  };
  return (
    <div className={`flex flex-col rounded-lg border bg-white p-3 shadow-sm`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
        {label}
      </p>
      <p
        className={`mt-1 inline-flex w-fit rounded-md px-2 py-0.5 text-xl font-bold ${cores[cor]}`}
      >
        {valor}
      </p>
    </div>
  );
}
