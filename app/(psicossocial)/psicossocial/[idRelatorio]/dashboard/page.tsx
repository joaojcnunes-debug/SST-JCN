"use client";

import { useMemo, use, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Check, Loader2 } from "lucide-react";
import DrpsFiltro from "@/components/drps/DrpsFiltro";
import ProfissionalSelect from "@/components/ui/ProfissionalSelect";
import MatrizRisco from "@/components/drps/MatrizRisco";
import { useDrpsStore } from "@/lib/drps/store";
import {
  useDrpsProbabilidades,
  useDrpsRelatorio,
  useDrpsRespondentes,
  useDrpsSalvarRelatorio,
} from "@/lib/hooks/useDrps";
import { useAtualizarEmpresa, useEmpresa } from "@/lib/hooks/useEmpresas";
import { useCanEdit } from "@/lib/hooks/useUsuario";
import {
  aplicarMatriz,
  calcularResumoCompleto,
  CORES_MATRIZ,
  filtrarPorSetor,
} from "@/lib/drps/calculos";
import { TOPICOS } from "@/lib/drps/topicos";
import type { NivelMatriz, StatusRelatorio } from "@/lib/drps/types";

const STATUS_OPCOES: { v: StatusRelatorio; label: string; cls: string }[] = [
  { v: "RASCUNHO",     label: "Rascunho",      cls: "bg-gray-100 text-gray-700" },
  { v: "EM_ANDAMENTO", label: "Em andamento",  cls: "bg-blue-100 text-blue-700" },
  { v: "CONCLUIDO",    label: "Concluído",      cls: "bg-green-100 text-green-700" },
];

const NIVEIS: NivelMatriz[] = ["Baixo", "Médio", "Alto", "Crítico"];

export default function DashboardPage({
  params,
}: {
  params: Promise<{ idRelatorio: string }>;
}) {
  const { idRelatorio } = use(params);
  const setor    = useDrpsStore((s) => s.setor);
  const canEdit  = useCanEdit();
  const { data: relatorio } = useDrpsRelatorio(idRelatorio);
  const { data: empresa   } = useEmpresa(relatorio?.id_empresa);
  const { data: respondentes  = [] } = useDrpsRespondentes(idRelatorio);
  const { data: probabilidades = [] } = useDrpsProbabilidades(idRelatorio);
  const salvar        = useDrpsSalvarRelatorio();
  const salvarEmpresa = useAtualizarEmpresa();

  const [responsavel, setResponsavel] = useState("");
  const [crp,         setCrp]         = useState("");
  const [data,        setData]        = useState("");
  const [status,      setStatus]      = useState<StatusRelatorio>("EM_ANDAMENTO");
  const [cnpj,        setCnpj]        = useState("");
  const [dirty,       setDirty]       = useState(false);

  useEffect(() => {
    if (!relatorio) return;
    setResponsavel(relatorio.responsavel_tecnico ?? "");
    setCrp(relatorio.crp         ?? "");
    setData(relatorio.data_elaboracao ?? "");
    setStatus(relatorio.status);
    setDirty(false);
  }, [relatorio]);

  useEffect(() => {
    if (!empresa) return;
    setCnpj(empresa.cnpj ?? "");
  }, [empresa]);

  function handleSalvar() {
    if (!relatorio) return;
    const promises: Promise<unknown>[] = [];

    const salvarRelPromise = new Promise<void>((resolve, reject) => {
      salvar.mutate(
        {
          id_relatorio: idRelatorio,
          id_empresa:   relatorio.id_empresa,
          responsavel_tecnico: responsavel.trim() || null,
          crp:          crp.trim()  || null,
          data_elaboracao: data     || null,
          status,
        },
        { onSuccess: () => resolve(), onError: (e) => reject(e) }
      );
    });
    promises.push(salvarRelPromise);

    const cnpjAtual = empresa?.cnpj ?? "";
    if (cnpj.trim() !== cnpjAtual && relatorio.id_empresa) {
      const salvarEmpPromise = new Promise<void>((resolve, reject) => {
        salvarEmpresa.mutate(
          { id_empresa: relatorio.id_empresa, cnpj: cnpj.trim() || null },
          { onSuccess: () => resolve(), onError: (e) => reject(e) }
        );
      });
      promises.push(salvarEmpPromise);
    }

    Promise.all(promises).then(() => setDirty(false)).catch(() => {});
  }

  const statusAtual = STATUS_OPCOES.find((s) => s.v === status);

  const filtrados = useMemo(
    () => filtrarPorSetor(respondentes, setor),
    [respondentes, setor]
  );

  const topicos = useMemo(
    () => calcularResumoCompleto(filtrados),
    [filtrados]
  );

  const mapaProb = useMemo(() => {
    const m: Record<number, 1 | 2 | 3> = {};
    for (let i = 0; i < TOPICOS.length; i++) m[i] = 1;
    if (setor === "Todos") return m;
    for (const p of probabilidades) {
      if (p.setor === setor) {
        m[p.topico_idx] = p.probabilidade as 1 | 2 | 3;
      }
    }
    return m;
  }, [probabilidades, setor]);

  const topicosComMatriz = useMemo(
    () => aplicarMatriz(topicos, mapaProb),
    [topicos, mapaProb]
  );

  const contagem = useMemo(() => {
    const c: Record<NivelMatriz, number> = {
      Baixo: 0,
      Médio: 0,
      Alto: 0,
      Crítico: 0,
    };
    for (const t of topicosComMatriz) c[t.matriz]++;
    return c;
  }, [topicosComMatriz]);

  const dadosBarras = useMemo(
    () =>
      topicosComMatriz.map((t) => ({
        nome: t.nome.replace(/^Tópico \d+ - /, ""),
        nomeCompleto: t.nome,
        gravidade: Number(t.mediaGravidade.toFixed(2)),
        cor: t.classificacaoGravidade.cor,
      })),
    [topicosComMatriz]
  );

  const dadosRosca = useMemo(
    () =>
      NIVEIS.map((n) => ({
        nome: n,
        valor: contagem[n],
        cor: CORES_MATRIZ[n],
      })).filter((d) => d.valor > 0),
    [contagem]
  );

  return (
    <div className="space-y-4">
      {/* ── Barra de metadados inline ─────────────────────────── */}
      <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">

          {/* Empresa + revisão */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm font-bold text-gray-900">
              {empresa?.nome_empresa ?? "—"}
            </span>
            {relatorio && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                Rev. {relatorio.revisao}
              </span>
            )}
          </div>

          <div className="h-4 w-px bg-gray-200 shrink-0 hidden sm:block" />

          {/* CNPJ */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">CNPJ</span>
            <input
              type="text"
              value={cnpj}
              disabled={!canEdit}
              onChange={(e) => { setCnpj(e.target.value); setDirty(true); }}
              placeholder="00.000.000/0000-00"
              className="w-36 rounded-md border border-gray-200 px-2 py-0.5 text-xs text-gray-700 placeholder-gray-300 focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary/30 disabled:bg-transparent disabled:border-transparent disabled:cursor-default"
            />
          </div>

          <div className="h-4 w-px bg-gray-200 shrink-0 hidden sm:block" />

          {/* Status */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Status</span>
            <select
              value={status}
              disabled={!canEdit}
              onChange={(e) => { setStatus(e.target.value as StatusRelatorio); setDirty(true); }}
              className={`rounded-full border-0 px-2 py-0.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-verde-primary/30 disabled:cursor-default ${statusAtual?.cls ?? ""}`}
            >
              {STATUS_OPCOES.map((s) => (
                <option key={s.v} value={s.v}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className="h-4 w-px bg-gray-200 shrink-0 hidden sm:block" />

          {/* Data */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 shrink-0">Data</span>
            <input
              type="date"
              value={data}
              disabled={!canEdit}
              onChange={(e) => { setData(e.target.value); setDirty(true); }}
              className="rounded-md border border-gray-200 px-2 py-0.5 text-xs text-gray-700 focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary/30 disabled:bg-transparent disabled:border-transparent disabled:cursor-default"
            />
          </div>

          <div className="h-4 w-px bg-gray-200 shrink-0 hidden sm:block" />

          {/* Responsável */}
          <div className="flex flex-1 items-center gap-1.5 min-w-[200px]">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 shrink-0">Responsável</span>
            <ProfissionalSelect
              value={responsavel}
              onChange={(nome, _cargo, _cert, crpProfissional) => {
                setResponsavel(nome);
                if (crpProfissional) setCrp(crpProfissional);
                setDirty(true);
              }}
              className={`flex-1 border-gray-200 py-0.5 text-xs ${!canEdit ? "pointer-events-none opacity-60 border-transparent bg-transparent" : ""}`}
              placeholder="Selecione o psicólogo..."
            />
          </div>

          {/* CRP */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">CRP</span>
            <input
              type="text"
              value={crp}
              disabled={!canEdit}
              onChange={(e) => { setCrp(e.target.value); setDirty(true); }}
              placeholder="00/00000"
              className="w-24 rounded-md border border-gray-200 px-2 py-0.5 text-xs text-gray-700 placeholder-gray-300 focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary/30 disabled:bg-transparent disabled:border-transparent disabled:cursor-default"
            />
          </div>

          {/* Botão salvar */}
          {canEdit && dirty && (
            <button
              type="button"
              onClick={handleSalvar}
              disabled={salvar.isPending || salvarEmpresa.isPending}
              className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-verde-accent disabled:opacity-50 shrink-0"
            >
              {(salvar.isPending || salvarEmpresa.isPending)
                ? <Loader2 className="size-3 animate-spin" />
                : <Check className="size-3" />}
              Salvar
            </button>
          )}
        </div>
      </div>

      <div>
        <h1 className="text-xl font-semibold text-gray-900">
          Painel Resumo NR-1
        </h1>
        <p className="text-sm text-gray-600">
          {relatorio ? (
            <>
              Relatório <strong>Rev. {relatorio.revisao}</strong> ·{" "}
              {relatorio.responsavel_tecnico ?? "Sem responsável definido"}
            </>
          ) : (
            "Carregando..."
          )}
        </p>
      </div>

      <DrpsFiltro idRelatorio={idRelatorio} />

      {respondentes.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Nenhum respondente importado neste relatório. Vá em{" "}
          <strong>Dados do Forms</strong> para começar.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {NIVEIS.map((n) => (
              <div
                key={n}
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div
                  className="mb-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
                  style={{ backgroundColor: CORES_MATRIZ[n] }}
                >
                  {n}
                </div>
                <p className="text-3xl font-bold text-gray-900">
                  {contagem[n]}
                </p>
                <p className="text-xs text-gray-500">
                  tópico{contagem[n] !== 1 ? "s" : ""}
                </p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-gray-900">
                Matriz de Risco
              </h2>
              <MatrizRisco topicos={topicosComMatriz} mostrarTopicos={false} />
              <p className="mt-2 text-[11px] text-gray-500">
                {filtrados.length} respondente(s) considerado(s)
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-gray-900">
                Distribuição do Risco Final
              </h2>
              {dadosRosca.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={dadosRosca}
                      dataKey="valor"
                      nameKey="nome"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      label={(props) => {
                        const p = props as unknown as {
                          nome: string;
                          valor: number;
                        };
                        return `${p.nome}: ${p.valor}`;
                      }}
                    >
                      {dadosRosca.map((d, i) => (
                        <Cell key={i} fill={d.cor} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="py-10 text-center text-sm text-gray-500">
                  Sem dados
                </p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">
              Gravidade Média por Tópico
            </h2>
            <ResponsiveContainer width="100%" height={420}>
              <BarChart
                data={dadosBarras}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 8, bottom: 5 }}
              >
                <XAxis
                  type="number"
                  domain={[0, 3]}
                  ticks={[0, 1, 1.5, 2, 2.5, 3]}
                />
                <YAxis
                  type="category"
                  dataKey="nome"
                  width={220}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={(v) =>
                    typeof v === "number" ? v.toFixed(2) : String(v)
                  }
                  labelFormatter={(_, payload) =>
                    (
                      payload?.[0]?.payload as
                        | { nomeCompleto?: string }
                        | undefined
                    )?.nomeCompleto ?? ""
                  }
                />
                <Bar dataKey="gravidade">
                  {dadosBarras.map((d, i) => (
                    <Cell key={i} fill={d.cor} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="mt-1 text-[11px] text-gray-500">
              Escala: 0–3 (Baixa &lt; 1,66 &lt; Média ≤ 2,32 &lt; Alta)
            </p>
          </div>
        </>
      )}
    </div>
  );
}
