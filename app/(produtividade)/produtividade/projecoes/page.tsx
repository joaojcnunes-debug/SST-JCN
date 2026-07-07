"use client";

import { useState, useMemo, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  AlertTriangle, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
  FileText, Globe, Info, MapPin, Save, Users, Wrench, Download, Printer, Building2,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  useProdUnidades,
  useProdColaboradores,
  useProdAlocacoes,
  useProdSnapshots,
  useSalvarProjecao,
} from "@/lib/hooks/useProdutividade";
import { useCanEdit } from "@/lib/hooks/useUsuario";
import {
  DIAS_UTEIS_MES, num, addDiasUteis, fmtDataCurta, calcularProjecao, calcularUnidade,
} from "@/lib/produtividade/projecao";

const MESES_LABEL = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// ── Helpers de UI ──────────────────────────────────────────────────────────

function Field({
  label, sub, value, onChange, small, disabled,
}: {
  label: string; sub?: string; value: string;
  onChange: (v: string) => void; small?: boolean; disabled?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-gray-700">{label}</label>
      {sub && <p className="mb-1.5 text-[11px] text-gray-400 leading-tight">{sub}</p>}
      <input
        type="number" min={0} value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-label={label}
        className={`rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 ${small ? "w-28" : "w-full"}`}
      />
    </div>
  );
}

// ── Tipos ──────────────────────────────────────────────────────────────────

interface DadosUnidade {
  totalClientes: string;
  pendInspecao:  string;
  pendDocs:      string;
}

const VAZIO: DadosUnidade = { totalClientes: "0", pendInspecao: "0", pendDocs: "0" };

type Tipo = "geral" | "por_unidade";

// ── Página ─────────────────────────────────────────────────────────────────

export default function ProjecoesPage() {
  const canEdit                       = useCanEdit();
  const { data: unidades = [], isLoading: loadUnid } = useProdUnidades();
  const { data: colaboradores = [] }  = useProdColaboradores();
  const { data: alocacoes = [] }      = useProdAlocacoes();
  const salvarMutation                = useSalvarProjecao();

  // Lookup: unidadeId → { adms, tecs } CADASTRADOS, rateados pelas alocações (mesmo
  // modelo do cálculo geral) — colaborador sem rateio conta 100% na unidade-sede.
  // Assim o breakdown por unidade bate com o total mesmo com equipe compartilhada.
  const cadPorUnidade = useMemo(() => {
    const porColab = new Map<string, { id_unidade: string; percentual: number }[]>();
    for (const a of alocacoes) {
      if (!porColab.has(a.id_colaborador)) porColab.set(a.id_colaborador, []);
      porColab.get(a.id_colaborador)!.push({ id_unidade: a.id_unidade, percentual: a.percentual });
    }
    const map: Record<string, { adms: number; tecs: number }> = {};
    const add = (uid: string, tipo: string, frac: number) => {
      if (!map[uid]) map[uid] = { adms: 0, tecs: 0 };
      if (tipo === "documentos") map[uid].adms += frac;
      if (tipo === "tecnico_campo") map[uid].tecs += frac;
    };
    for (const c of colaboradores) {
      if (!c.ativo) continue;
      const rateio = porColab.get(c.id);
      if (rateio && rateio.length > 0) for (const r of rateio) add(r.id_unidade, c.tipo, r.percentual / 100);
      else add(c.id_unidade, c.tipo, 1);
    }
    return map;
  }, [colaboradores, alocacoes]);

  // Tipo de projeção
  const [tipo, setTipo]                               = useState<Tipo>("geral");
  const [idUnidadeSel, setIdUnidadeSel]               = useState<string>("");

  // Parâmetros
  const [diasUteis,   setDiasUteis]   = useState("60");
  const [admsAtuais,  setAdmsAtuais]  = useState("15");
  const [tecsAtuais,  setTecsAtuais]  = useState("9");
  const [docsPorAdm,  setDocsPorAdm]  = useState("5");
  const [inspPorTec,  setInspPorTec]  = useState("3");

  // Mês de referência (dados vêm do Controle Mensal / snapshot)
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());
  const { data: snapshots = [] } = useProdSnapshots(mes, ano);

  // Dados por unidade (semeados do snapshot do mês; editáveis para simulação)
  const [dados, setDados] = useState<Record<string, DadosUnidade>>({});
  // Baseline = dados originais do snapshot (para detectar edição e restaurar).
  const [baselineDados, setBaselineDados] = useState<Record<string, DadosUnidade>>({});

  // Semeia/atualiza os dados por unidade a partir do snapshot do mês selecionado.
  // Carga de documentos = vencidos + vencendo; pend. inspeção = inspeção pendente;
  // total de clientes = pagantes + cortesia.
  useEffect(() => {
    const next: Record<string, DadosUnidade> = {};
    for (const s of snapshots) {
      next[s.id_unidade] = {
        totalClientes: String(s.clientes_pagantes + s.clientes_cortesia),
        pendInspecao:  String(s.inspecao_pendente),
        pendDocs:      String(s.vencidos + s.vencendo),
      };
    }
    setDados(next);
    setBaselineDados(next);
  }, [snapshots, mes, ano]);

  // True quando o usuário editou os dados em relação ao snapshot do mês.
  const dadosEditados = useMemo(
    () => JSON.stringify(dados) !== JSON.stringify(baselineDados),
    [dados, baselineDados],
  );
  function restaurarDadosDoMes() { setDados(baselineDados); }

  function prevMes() { if (mes === 1) { setMes(12); setAno((a) => a - 1); } else setMes((m) => m - 1); }
  function nextMes() { if (mes === 12) { setMes(1); setAno((a) => a + 1); } else setMes((m) => m + 1); }

  // Identificação para salvar
  const [titulo,      setTitulo]      = useState("");
  const [observacao,  setObservacao]  = useState("");
  const [comentarios, setComentarios] = useState("");

  // UI
  const [showCalc, setShowCalc] = useState(false);

  function getDados(id: string): DadosUnidade { return dados[id] ?? VAZIO; }
  function setDado(id: string, campo: keyof DadosUnidade, val: string) {
    setDados((prev) => ({ ...prev, [id]: { ...(prev[id] ?? VAZIO), [campo]: val } }));
  }

  // Unidades visíveis conforme o tipo. Em "por unidade", expande para o GRUPO que
  // compartilha equipe (mesma "dona de equipe") — ex.: Piabetá puxa Guapimirim
  // junto, pois a equipe é a mesma e a demanda é somada.
  const unidadesVisiveis = useMemo(() => {
    if (tipo === "por_unidade" && idUnidadeSel) {
      const sel = unidades.find((u) => u.id === idUnidadeSel);
      if (!sel) return [];
      const donaId = sel.id_unidade_equipe ?? sel.id;
      return unidades.filter((u) => (u.id_unidade_equipe ?? u.id) === donaId);
    }
    return unidades;
  }, [tipo, idUnidadeSel, unidades]);

  // Rótulo do grupo (quando há equipe compartilhada).
  const grupoLabel = useMemo(
    () => unidadesVisiveis.map((u) => u.nome).join(" + "),
    [unidadesVisiveis],
  );

  // Equipe e capacidades CADASTRADAS, rateadas por unidade. Para cada colaborador,
  // a fração nas unidades visíveis = soma dos % de dedicação lá (sem rateio = 100%
  // na unidade dele). Headcount e capacidade entram pela fração → no Geral a pessoa
  // conta uma vez; por unidade entra a parcela certa.
  const equipeVisivel = useMemo(() => {
    const ids = new Set(unidadesVisiveis.map((u) => u.id));
    const porColab = new Map<string, { id_unidade: string; percentual: number }[]>();
    for (const a of alocacoes) {
      if (!porColab.has(a.id_colaborador)) porColab.set(a.id_colaborador, []);
      porColab.get(a.id_colaborador)!.push({ id_unidade: a.id_unidade, percentual: a.percentual });
    }
    let admsCount = 0, tecsCount = 0, capDocsMes = 0, capInspMes = 0;
    for (const c of colaboradores) {
      if (!c.ativo) continue;
      const rateio = porColab.get(c.id);
      const fracao = rateio && rateio.length > 0
        ? rateio.filter((r) => ids.has(r.id_unidade)).reduce((s, r) => s + r.percentual / 100, 0)
        : (ids.has(c.id_unidade) ? 1 : 0);
      if (fracao <= 0) continue;
      if (c.tipo === "documentos") { admsCount += fracao; capDocsMes += (c.capacidade_docs_mes || 0) * fracao; }
      if (c.tipo === "tecnico_campo") { tecsCount += fracao; capInspMes += (c.capacidade_visitas_mes || 0) * fracao; }
    }
    return { admsCount, tecsCount, capDocsMes, capInspMes };
  }, [colaboradores, alocacoes, unidadesVisiveis]);

  // Sincroniza Equipe atual e Produtividade diária a partir do cadastro.
  // Produtividade = capacidade média por colaborador ÷ 22 dias úteis (editável depois).
  useEffect(() => {
    const { admsCount, tecsCount, capDocsMes, capInspMes } = equipeVisivel;
    setAdmsAtuais(String(Math.round(admsCount * 10) / 10));
    setTecsAtuais(String(Math.round(tecsCount * 10) / 10));
    if (admsCount > 0 && capDocsMes > 0) setDocsPorAdm(String(Math.round((capDocsMes / admsCount / DIAS_UTEIS_MES) * 10) / 10));
    if (tecsCount > 0 && capInspMes > 0) setInspPorTec(String(Math.round((capInspMes / tecsCount / DIAS_UTEIS_MES) * 10) / 10));
  }, [equipeVisivel]);

  // ── Totais ────────────────────────────────────────────────────────────────
  const totais = useMemo(() => {
    const ids = unidadesVisiveis.length > 0
      ? unidadesVisiveis.map((u) => u.id)
      : Object.keys(dados);
    const totalClientes = ids.reduce((s, id) => s + num(getDados(id).totalClientes), 0);
    const pendInsp      = ids.reduce((s, id) => s + num(getDados(id).pendInspecao),  0);
    const pendDocs      = ids.reduce((s, id) => s + num(getDados(id).pendDocs),      0);
    return {
      totalClientes,
      pendInsp,
      pendDocs,
      totalPend: pendInsp + pendDocs,
      emDia: Math.max(0, totalClientes - pendInsp - pendDocs),
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dados, unidadesVisiveis]);

  // ── Cálculos ──────────────────────────────────────────────────────────────
  // O cálculo "puro" vive em lib/produtividade/projecao.ts (testável). Aqui só
  // montamos os inputs e juntamos os metadados de equipe (cadastro vs. simulação).
  const calc = useMemo(() => {
    const dias = num(diasUteis, 60);
    const dpa  = num(docsPorAdm, 5);
    const ipa  = num(inspPorTec, 3);

    // Equipe EFETIVA = campos editáveis (simulação). Por padrão valem o cadastro
    // (sincronizado pelo useEffect); o usuário pode sobrescrever para simular cenários.
    const cadAdms  = Math.round(equipeVisivel.admsCount * 10) / 10;
    const cadTecs  = Math.round(equipeVisivel.tecsCount * 10) / 10;
    const admsEfet = num(admsAtuais);
    const tecsEfet = num(tecsAtuais);

    const r = calcularProjecao({
      pendDocs: totais.pendDocs,
      pendInsp: totais.pendInsp,
      admsEfet, tecsEfet, dpa, ipa, dias,
    });

    return {
      ...r,
      admsEfet, tecsEfet, cadAdms, cadTecs,
      simAdms: Math.abs(admsEfet - cadAdms) > 0.05,
      simTecs: Math.abs(tecsEfet - cadTecs) > 0.05,
    };
  }, [totais, diasUteis, admsAtuais, tecsAtuais, docsPorAdm, inspPorTec, equipeVisivel]);

  // Breakdown por unidade (modo Geral) — ordenado pela unidade mais crítica (maior déficit).
  const linhasBreakdown = useMemo(() => {
    const dpa = num(docsPorAdm, 5), ipa = num(inspPorTec, 3), diasN = num(diasUteis, 60);
    return unidades
      .map((u) => {
        const d = getDados(u.id);
        const pInsp = num(d.pendInspecao), pDocs = num(d.pendDocs);
        const cadADMs = cadPorUnidade[u.id]?.adms ?? 0;
        const cadTecs = cadPorUnidade[u.id]?.tecs ?? 0;
        const r = calcularUnidade(pDocs, pInsp, cadADMs, cadTecs, dpa, ipa, diasN);
        return {
          id: u.id, nome: u.nome,
          totalClientes: num(d.totalClientes), pInsp, pDocs,
          cadADMsFmt: Math.round(cadADMs * 10) / 10,
          cadTecsFmt: Math.round(cadTecs * 10) / 10,
          ...r,
        };
      })
      .sort((a, b) => b.critico - a.critico || a.nome.localeCompare(b.nome, "pt-BR"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unidades, dados, cadPorUnidade, docsPorAdm, inspPorTec, diasUteis]);

  const dias    = num(diasUteis, 60);
  const semanas = Math.round(dias / 5);

  // Datas-alvo (em vez de "X dias úteis" abstrato).
  const dataAlvo = useMemo(() => addDiasUteis(new Date(), dias), [dias]);
  const dataDocs = Number.isFinite(calc.diasNecDocs) ? addDiasUteis(new Date(), calc.diasNecDocs) : null;
  const dataInsp = Number.isFinite(calc.diasNecInsp) ? addDiasUteis(new Date(), calc.diasNecInsp) : null;
  // Conclusão real = a mais tardia das duas frentes (quando ambas zeram).
  const dataConclusao = dataDocs && dataInsp ? (dataDocs > dataInsp ? dataDocs : dataInsp) : (dataDocs ?? dataInsp ?? dataAlvo);
  const faltaAdm = Math.ceil(calc.admsAdd);
  const faltaTec = Math.ceil(calc.tecsAdd);
  const partesDeficit = [
    faltaAdm > 0 ? `+${faltaAdm} ADM${faltaAdm > 1 ? "s" : ""}` : null,
    faltaTec > 0 ? `+${faltaTec} técnico${faltaTec > 1 ? "s" : ""}` : null,
  ].filter(Boolean) as string[];

  // ── Salvar ────────────────────────────────────────────────────────────────
  async function handleSalvar() {
    if (!titulo.trim()) {
      toast.error("Informe um título para salvar a projeção.");
      return;
    }
    const unidadeSel = unidades.find((u) => u.id === idUnidadeSel);
    await salvarMutation.mutateAsync({
      titulo:            titulo.trim(),
      tipo,
      id_unidade:        tipo === "por_unidade" ? idUnidadeSel || null : null,
      nome_unidade:      tipo === "por_unidade" ? (unidadeSel?.nome ?? null) : null,
      dias_uteis:        num(diasUteis, 60),
      adms_atuais:       num(admsAtuais),
      tecnicos_atuais:   num(tecsAtuais),
      docs_por_adm_dia:  num(docsPorAdm, 5),
      insp_por_tec_dia:  num(inspPorTec, 3),
      dados_unidades:    dados,
      observacao:        observacao.trim() || null,
      comentarios:       comentarios.trim() || null,
      total_clientes:    totais.totalClientes,
      pend_inspecao:     totais.pendInsp,
      pend_docs:         totais.pendDocs,
      adms_necessarios:  calc.admsNec,
      tecs_necessarios:  calc.tecsNec,
      adms_adicionais:   calc.admsAdd,
      tecs_adicionais:   calc.tecsAdd,
      mes,
      ano,
    });
    toast.success("Projeção salva com sucesso!");
    setTitulo("");
    setObservacao("");
    setComentarios("");
  }

  // ── Exportar CSV (independente do pipeline de laudo) ────────────────────────
  function exportarCSV() {
    const dpa = num(docsPorAdm, 5), ipa = num(inspPorTec, 3), diasN = num(diasUteis, 60);
    const linhas: (string | number)[][] = [
      ["Projeção", titulo || `${MESES_LABEL[mes - 1]}/${ano}`],
      ["Mês de referência", `${MESES_LABEL[mes - 1]}/${ano}`],
      ["Janela (dias úteis)", diasN],
      ["Conclui até", fmtDataCurta(dataAlvo)],
      ["Equipe (ADMs / Técnicos)", `${calc.admsEfet} / ${calc.tecsEfet}${calc.simAdms || calc.simTecs ? " (simulado)" : ""}`],
      [],
      ["Unidade", "Clientes", "Pend. Inspeção", "Pend. Docs", "ADMs Nec.", "ADMs Cad.", "Déficit ADM", "Técs Nec.", "Técs Cad.", "Déficit Téc."],
    ];
    const baseUnidades = unidades.length > 0 ? unidades : [];
    for (const u of baseUnidades) {
      const d = getDados(u.id);
      const pInsp = num(d.pendInspecao), pDocs = num(d.pendDocs);
      const admsNec = dpa * diasN > 0 ? Math.ceil(pDocs / (dpa * diasN)) : 0;
      const tecsNec = ipa * diasN > 0 ? Math.ceil(pInsp / (ipa * diasN)) : 0;
      const cadA = Math.round((cadPorUnidade[u.id]?.adms ?? 0) * 10) / 10;
      const cadT = Math.round((cadPorUnidade[u.id]?.tecs ?? 0) * 10) / 10;
      linhas.push([u.nome, num(d.totalClientes), pInsp, pDocs, admsNec, cadA, Math.max(0, Math.ceil(admsNec - cadA - 0.05)), tecsNec, cadT, Math.max(0, Math.ceil(tecsNec - cadT - 0.05))]);
    }
    linhas.push(["TOTAL", totais.totalClientes, totais.pendInsp, totais.pendDocs, calc.admsNec, calc.cadAdms, faltaAdm, calc.tecsNec, calc.cadTecs, faltaTec]);
    const csv = linhas.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `projecao-${String(mes).padStart(2, "0")}-${ano}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── JSX ───────────────────────────────────────────────────────────────────

  const cabecalho = (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Projeção de Necessidade de Equipe</h1>
      <p className="mt-0.5 text-sm text-gray-500">
        Calcule quantos ADMs e técnicos são necessários para zerar as pendências dentro da janela de trabalho
      </p>
    </div>
  );

  // Estados de carregando / vazio.
  if (loadUnid) {
    return (
      <div className="space-y-8">
        {cabecalho}
        <div className="space-y-3 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-gray-100" />)}
        </div>
      </div>
    );
  }
  if (unidades.length === 0) {
    return (
      <div className="space-y-8">
        {cabecalho}
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <Building2 className="size-8 text-gray-300" />
          <p className="text-sm font-medium text-gray-700">Nenhuma unidade cadastrada</p>
          <p className="max-w-md text-xs text-gray-500">Cadastre as unidades e a equipe para a projeção calcular a necessidade de ADMs e técnicos.</p>
          {canEdit && (
            <Link href="/produtividade/unidades" className="mt-1 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">
              Ir para Unidades e Equipe
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">

      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projeção de Necessidade de Equipe</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Calcule quantos ADMs e técnicos são necessários para zerar as pendências dentro da janela de trabalho
          </p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <button type="button" onClick={exportarCSV} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
            <Download className="size-4" /> Exportar CSV
          </button>
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
            <Printer className="size-4" /> Imprimir / PDF
          </button>
        </div>
      </div>

      {/* ── Resumo executivo ─────────────────────────────────────────────────── */}
      {totais.totalPend > 0 && (
        partesDeficit.length > 0 ? (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-5">
            <AlertTriangle className="mt-0.5 size-6 shrink-0 text-red-600" />
            <p className="text-base text-red-900">
              Para zerar as <strong>{totais.totalPend.toLocaleString()}</strong> pendências em{" "}
              <strong>{dias} dias úteis</strong> (até <strong>{fmtDataCurta(dataAlvo)}</strong>),
              faltam <strong className="text-red-700">{partesDeficit.join(" e ")}</strong> além da equipe atual.
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-2xl border border-green-200 bg-green-50 p-5">
            <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-green-600" />
            <p className="text-base text-green-900">
              A equipe atual zera as <strong>{totais.totalPend.toLocaleString()}</strong> pendências
              dentro da janela — conclusão prevista até <strong>{fmtDataCurta(dataConclusao)}</strong>.
            </p>
          </div>
        )
      )}

      {/* ── Tipo de projeção ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">Tipo de Projeção</h2>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setTipo("geral")}
            className={`flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all ${tipo === "geral" ? "bg-teal-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            <Globe className="size-4" /> Geral (todas as unidades)
          </button>
          <button
            type="button"
            onClick={() => setTipo("por_unidade")}
            className={`flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all ${tipo === "por_unidade" ? "bg-teal-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            <MapPin className="size-4" /> Por Unidade
          </button>
        </div>

        {tipo === "por_unidade" && (
          <div className="mt-4">
            <label className="mb-1 block text-xs font-semibold text-gray-600">Selecione a unidade</label>
            <select
              value={idUnidadeSel}
              onChange={(e) => setIdUnidadeSel(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">— selecione —</option>
              {unidades.map((u) => (
                <option key={u.id} value={u.id}>{u.nome}{u.cidade ? ` (${u.cidade})` : ""}</option>
              ))}
            </select>
            {idUnidadeSel && (
              <p className="mt-1.5 text-xs text-teal-600 font-medium">
                {unidadesVisiveis.length > 1
                  ? `Equipe compartilhada — projeção combinada: ${grupoLabel}`
                  : `Cálculos filtrados apenas para: ${unidades.find((u) => u.id === idUnidadeSel)?.nome}`}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Step 1: Parâmetros ───────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5 space-y-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">1. Parâmetros</h2>

        <div>
          <p className="mb-3 text-xs font-semibold text-gray-600">Janela de trabalho</p>
          <div>
            <Field label="Dias úteis disponíveis" value={diasUteis} onChange={setDiasUteis} small disabled={!canEdit} />
            <p className="mt-1.5 text-xs text-gray-400">
              ≈ <strong className="text-gray-600">{semanas} semanas</strong> / <strong className="text-gray-600">{Math.round(dias / DIAS_UTEIS_MES)} meses</strong> — calculado com 5 dias úteis/semana e {DIAS_UTEIS_MES} dias úteis/mês · conclui em <strong className="text-gray-600">{fmtDataCurta(dataAlvo)}</strong>
            </p>
          </div>
        </div>

        <div>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold text-gray-600">Equipe atual (edite para simular)</p>
            {(calc.simAdms || calc.simTecs) && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">simulação</span>
            )}
          </div>
          <p className="mb-3 text-[11px] text-gray-400">
            Pré-preenchida do cadastro em <strong>Unidades e Equipe</strong>
            {tipo === "por_unidade"
              ? (unidadesVisiveis.length > 1 ? " (grupo de equipe compartilhada)" : " (apenas a unidade selecionada)")
              : " (todas as unidades)"} — altere os valores para simular cenários de contratação.
          </p>
          <div className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="ADMs (geradores de docs)" sub={`Cadastrados: ${calc.cadAdms}`} value={admsAtuais} onChange={setAdmsAtuais} disabled={!canEdit} />
            <Field label="Técnicos de campo" sub={`Cadastrados: ${calc.cadTecs}`} value={tecsAtuais} onChange={setTecsAtuais} disabled={!canEdit} />
            {canEdit && (calc.simAdms || calc.simTecs) && (
              <button
                type="button"
                onClick={() => { setAdmsAtuais(String(calc.cadAdms)); setTecsAtuais(String(calc.cadTecs)); }}
                className="h-fit rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                Restaurar do cadastro
              </button>
            )}
          </div>
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold text-gray-600">Produtividade diária</p>
          <p className="mb-3 text-[11px] text-gray-400">
            Pré-preenchida pela capacidade média cadastrada por colaborador ÷ {DIAS_UTEIS_MES} dias úteis — ajuste se quiser
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Docs por ADM por dia"         sub="Documentos finalizados em 1 dia útil"    value={docsPorAdm} onChange={setDocsPorAdm} disabled={!canEdit} />
            <Field label="Inspeções por técnico por dia" sub="Inspeções realizadas em 1 dia útil"     value={inspPorTec} onChange={setInspPorTec} disabled={!canEdit} />
          </div>
        </div>
      </div>

      {/* ── Step 2: Dados por unidade ────────────────────────────────────────── */}
      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-6 py-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">2. Clientes por Unidade</h2>
              {dadosEditados && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">editado</span>
              )}
              {canEdit && dadosEditados && (
                <button type="button" onClick={restaurarDadosDoMes} className="text-[11px] font-medium text-teal-600 hover:underline">
                  Restaurar dados do mês
                </button>
              )}
            </div>
            <p className="mt-0.5 text-xs text-gray-400">
              Carregado do <strong>Controle Mensal</strong> de {MESES_LABEL[mes - 1]}/{ano} — edite para simular cenários
            </p>
            {snapshots.length === 0 && (
              <p className="mt-0.5 text-xs font-medium text-amber-600">
                Sem dados no Controle Mensal de {MESES_LABEL[mes - 1]}/{ano} — preencha lá ou edite os valores manualmente abaixo.
              </p>
            )}
            {tipo === "por_unidade" && idUnidadeSel && (
              <p className="mt-0.5 text-xs text-teal-600 font-medium">
                {unidadesVisiveis.length > 1 ? `Grupo (equipe compartilhada): ${grupoLabel}` : `Exibindo apenas: ${unidades.find((u) => u.id === idUnidadeSel)?.nome}`}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-1.5 ring-1 ring-black/5">
            <button type="button" onClick={prevMes} aria-label="Mês anterior" className="rounded p-1 hover:bg-gray-200">
              <ChevronLeft className="size-4 text-gray-500" />
            </button>
            <p className="min-w-[120px] text-center text-xs font-bold text-gray-700">
              {MESES_LABEL[mes - 1]} de {ano}
            </p>
            <button type="button" onClick={nextMes} aria-label="Próximo mês" className="rounded p-1 hover:bg-gray-200">
              <ChevronRight className="size-4 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-gray-100 bg-gray-50 text-[11px] uppercase text-gray-400 [&>th]:bg-gray-50">
                <th className="px-5 py-3 text-left">Unidade</th>
                <th className="px-5 py-3 text-center">Total de Clientes</th>
                <th className="px-5 py-3 text-center">
                  <span className="flex items-center justify-center gap-1 text-orange-600">
                    <Wrench className="size-3" /> Pend. Inspeção
                  </span>
                </th>
                <th className="px-5 py-3 text-center">
                  <span className="flex items-center justify-center gap-1 text-blue-600">
                    <FileText className="size-3" /> Pend. Documentos
                  </span>
                </th>
                <th className="px-5 py-3 text-center text-green-600">Em Dia</th>
                <th className="px-5 py-3 text-center">% Concluído</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(unidadesVisiveis.length > 0
                ? unidadesVisiveis
                : [{ id: "__geral__", nome: "Total Geral" }]
              ).map((u) => {
                const d     = getDados(u.id);
                const total = num(d.totalClientes);
                const pInsp = num(d.pendInspecao);
                const pDocs = num(d.pendDocs);
                const emDia = Math.max(0, total - pInsp - pDocs);
                const pct   = total > 0 ? Math.round((emDia / total) * 100) : 0;
                return (
                  <tr key={u.id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3 font-semibold text-gray-800">{u.nome}</td>
                    <td className="px-5 py-3 text-center">
                      <input type="number" min={0} value={d.totalClientes}
                        onChange={(e) => setDado(u.id, "totalClientes", e.target.value)}
                        disabled={!canEdit}
                        aria-label={`Total de clientes — ${u.nome}`}
                        className="w-24 rounded border border-gray-200 px-2 py-1.5 text-center text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                      />
                    </td>
                    <td className="px-5 py-3 text-center">
                      <input type="number" min={0} value={d.pendInspecao}
                        onChange={(e) => setDado(u.id, "pendInspecao", e.target.value)}
                        disabled={!canEdit}
                        aria-label={`Pendências de inspeção — ${u.nome}`}
                        className="w-24 rounded border border-orange-200 bg-orange-50/50 px-2 py-1.5 text-center text-sm font-mono text-orange-800 focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                      />
                    </td>
                    <td className="px-5 py-3 text-center">
                      <input type="number" min={0} value={d.pendDocs}
                        onChange={(e) => setDado(u.id, "pendDocs", e.target.value)}
                        disabled={!canEdit}
                        aria-label={`Pendências de documentos — ${u.nome}`}
                        className="w-24 rounded border border-blue-200 bg-blue-50/50 px-2 py-1.5 text-center text-sm font-mono text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                      />
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${emDia > 0 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {emDia}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100">
                          <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-mono text-gray-500">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* Totais (fixo no rodapé da tabela rolável) */}
              <tr className="sticky bottom-0 z-10 border-t-2 border-gray-200 bg-gray-50 text-xs font-bold [&>td]:bg-gray-50">
                <td className="px-5 py-3 uppercase tracking-wide text-gray-500">Total</td>
                <td className="px-5 py-3 text-center text-gray-900">{totais.totalClientes}</td>
                <td className="px-5 py-3 text-center text-orange-700">{totais.pendInsp}</td>
                <td className="px-5 py-3 text-center text-blue-700">{totais.pendDocs}</td>
                <td className="px-5 py-3 text-center text-green-700">{totais.emDia}</td>
                <td className="px-5 py-3 text-center text-gray-600">
                  {totais.totalClientes > 0
                    ? `${Math.round((totais.emDia / totais.totalClientes) * 100)}%`
                    : "—"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Step 3: Resultado ───────────────────────────────────────────────── */}
      <div>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">
          3. Resultado — Janela de {diasUteis} dias úteis (até {fmtDataCurta(dataAlvo)})
          {tipo === "por_unidade" && idUnidadeSel && (
            <span className="ml-2 normal-case font-normal text-teal-600">
              · {unidades.find((u) => u.id === idUnidadeSel)?.nome}
            </span>
          )}
        </h2>

        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total Clientes",       value: totais.totalClientes, color: "text-gray-900" },
            { label: "Em Dia",               value: totais.emDia,         color: "text-green-600" },
            { label: "Pend. Inspeção",       value: totais.pendInsp,      color: "text-orange-600" },
            { label: "Pend. Documentos",     value: totais.pendDocs,      color: "text-blue-600" },
          ].map((k) => (
            <div key={k.label} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{k.label}</p>
              <p className={`mt-1 text-2xl font-bold ${k.color}`}>{k.value}</p>
            </div>
          ))}
        </div>

        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Docs */}
          <div className={`rounded-xl p-5 shadow-sm ring-1 ${calc.okDocs ? "bg-green-50 ring-green-200" : "bg-white ring-black/5"}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <FileText className="size-3.5 text-blue-600" /> Documentos SST (ADMs)
                </p>
                <p className="mt-3 text-3xl font-bold text-blue-700">{totais.pendDocs}</p>
                <p className="text-xs text-gray-400">pendências de documentos</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">Capacidade atual em {diasUteis}d</p>
                <p className="mt-1 text-xl font-bold text-gray-800">{calc.capDocs.toLocaleString()}</p>
                <p className="text-xs text-gray-400">
                  {calc.admsEfet} ADMs{calc.simAdms ? " (simulado)" : " (cadastro)"} × {num(docsPorAdm, 5)} docs/dia × {diasUteis}d
                </p>
              </div>
            </div>
            <div className="mt-3">
              <div className="mb-1 flex justify-between text-[11px] text-gray-400">
                <span>Cobertura com equipe atual</span>
                <span className="font-semibold">{calc.pctDocs}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                <div
                  className={`h-full rounded-full transition-all ${calc.pctDocs >= 100 ? "bg-green-500" : calc.pctDocs >= 70 ? "bg-yellow-500" : "bg-red-500"}`}
                  style={{ width: `${Math.min(100, calc.pctDocs)}%` }}
                />
              </div>
            </div>
            <div className="mt-3 border-t border-gray-100 pt-3">
              {calc.okDocs ? (
                <p className="flex items-center gap-1.5 text-sm font-semibold text-green-700">
                  <CheckCircle2 className="size-4" /> Equipe atual suficiente
                </p>
              ) : (
                <p className="text-sm text-red-700">
                  Leva <strong>{calc.diasNecDocs === Infinity ? "∞" : `${calc.diasNecDocs} dias`}</strong> com equipe atual{dataDocs ? ` (conclui em ${fmtDataCurta(dataDocs)})` : ""} — necessário <strong className="text-red-800">{calc.admsNec} ADMs</strong> (+{faltaAdm} a contratar)
                </p>
              )}
            </div>
          </div>

          {/* Inspeções */}
          <div className={`rounded-xl p-5 shadow-sm ring-1 ${calc.okInsp ? "bg-green-50 ring-green-200" : "bg-white ring-black/5"}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <Wrench className="size-3.5 text-orange-600" /> Inspeções (Técnicos)
                </p>
                <p className="mt-3 text-3xl font-bold text-orange-700">{totais.pendInsp}</p>
                <p className="text-xs text-gray-400">pendências de inspeção</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">Capacidade atual em {diasUteis}d</p>
                <p className="mt-1 text-xl font-bold text-gray-800">{calc.capInsp.toLocaleString()}</p>
                <p className="text-xs text-gray-400">
                  {calc.tecsEfet} técs{calc.simTecs ? " (simulado)" : " (cadastro)"} × {num(inspPorTec, 3)} insp/dia × {diasUteis}d
                </p>
              </div>
            </div>
            <div className="mt-3">
              <div className="mb-1 flex justify-between text-[11px] text-gray-400">
                <span>Cobertura com equipe atual</span>
                <span className="font-semibold">{calc.pctInsp}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                <div
                  className={`h-full rounded-full transition-all ${calc.pctInsp >= 100 ? "bg-green-500" : calc.pctInsp >= 70 ? "bg-yellow-500" : "bg-red-500"}`}
                  style={{ width: `${Math.min(100, calc.pctInsp)}%` }}
                />
              </div>
            </div>
            <div className="mt-3 border-t border-gray-100 pt-3">
              {calc.okInsp ? (
                <p className="flex items-center gap-1.5 text-sm font-semibold text-green-700">
                  <CheckCircle2 className="size-4" /> Equipe atual suficiente
                </p>
              ) : (
                <p className="text-sm text-red-700">
                  Leva <strong>{calc.diasNecInsp === Infinity ? "∞" : `${calc.diasNecInsp} dias`}</strong> com equipe atual{dataInsp ? ` (conclui em ${fmtDataCurta(dataInsp)})` : ""} — necessário <strong className="text-red-800">{calc.tecsNec} técnicos</strong> (+{faltaTec} a contratar)
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Déficit */}
        {(calc.admsAdd > 0 || calc.tecsAdd > 0) && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-600" />
              <div className="flex-1">
                <p className="font-bold text-red-800">Déficit de equipe para zerar em {diasUteis} dias úteis</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {calc.admsAdd > 0 && (
                    <div className="rounded-lg bg-white px-4 py-3 shadow-sm">
                      <p className="text-xs text-gray-500">ADMs necessários</p>
                      <p className="mt-0.5 text-2xl font-bold text-blue-700">{calc.admsNec} <span className="text-sm font-normal text-gray-500">total</span></p>
                      <p className="mt-0.5 text-sm">
                        <span className="font-semibold text-gray-700">{calc.admsEfet} atual{calc.simAdms ? " (simulado)" : " (cad.)"}</span>
                        <span className="mx-1 text-gray-400">+</span>
                        <span className="font-bold text-red-700">{faltaAdm} a contratar</span>
                      </p>
                    </div>
                  )}
                  {calc.tecsAdd > 0 && (
                    <div className="rounded-lg bg-white px-4 py-3 shadow-sm">
                      <p className="text-xs text-gray-500">Técnicos necessários</p>
                      <p className="mt-0.5 text-2xl font-bold text-orange-700">{calc.tecsNec} <span className="text-sm font-normal text-gray-500">total</span></p>
                      <p className="mt-0.5 text-sm">
                        <span className="font-semibold text-gray-700">{calc.tecsEfet} atual{calc.simTecs ? " (simulado)" : " (cad.)"}</span>
                        <span className="mx-1 text-gray-400">+</span>
                        <span className="font-bold text-red-700">{faltaTec} a contratar</span>
                      </p>
                    </div>
                  )}
                </div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => { setAdmsAtuais(String(calc.admsNec)); setTecsAtuais(String(calc.tecsNec)); }}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                  >
                    Simular com a equipe necessária →
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {calc.admsAdd === 0 && calc.tecsAdd === 0 && totais.totalPend > 0 && (
          <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-green-600" />
              <p className="font-semibold text-green-800">
                Equipe atual suficiente para zerar todas as pendências em {diasUteis} dias úteis!
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Breakdown por unidade (só em geral) ──────────────────────────────── */}
      {tipo === "geral" && unidades.length > 0 && (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5">
          <div className="border-b border-gray-100 px-5 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Users className="size-4 text-teal-600" /> Necessidade por Unidade
            </h2>
          </div>
          <p className="px-5 pb-2 text-[11px] text-gray-400">
            &ldquo;Cadastrados&rdquo; = colaboradores ativos do tipo <em>Geração de documentos SST</em> (ADMs) e <em>Técnico de campo</em> (técnicos) registrados em Unidades e Equipe. Ordenado pela unidade mais crítica.
          </p>
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-gray-100 bg-gray-50 text-[11px] uppercase text-gray-400">
                  <th className="bg-gray-50 px-5 py-3 text-left">Unidade</th>
                  <th className="bg-gray-50 px-5 py-3 text-right">Clientes</th>
                  <th className="bg-gray-50 px-5 py-3 text-right text-orange-600">Pend. Inspeção</th>
                  <th className="bg-gray-50 px-5 py-3 text-right text-blue-600">Pend. Docs</th>
                  <th className="bg-gray-50 px-4 py-3 text-right text-blue-700">ADMs Nec.</th>
                  <th className="bg-gray-50 px-4 py-3 text-right text-gray-500">ADMs Cad.</th>
                  <th className="bg-gray-50 px-4 py-3 text-right">Déficit ADM</th>
                  <th className="bg-gray-50 px-4 py-3 text-right text-orange-700">Técs. Nec.</th>
                  <th className="bg-gray-50 px-4 py-3 text-right text-gray-500">Técs. Cad.</th>
                  <th className="bg-gray-50 px-4 py-3 text-right">Déficit Téc.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {linhasBreakdown.map((row) => (
                  <tr key={row.id} className={row.critico > 0 ? "bg-red-50/40 hover:bg-red-50/70" : "hover:bg-gray-50/50"}>
                    <td className="px-5 py-3 font-medium text-gray-800">{row.nome}</td>
                    <td className="px-5 py-3 text-right text-gray-600">{row.totalClientes}</td>
                    <td className="px-5 py-3 text-right">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${row.pInsp > 0 ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-400"}`}>{row.pInsp}</span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${row.pDocs > 0 ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-400"}`}>{row.pDocs}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-blue-700">{row.admsNec}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{row.cadADMsFmt}</td>
                    <td className="px-4 py-3 text-right">
                      {row.defADM > 0
                        ? <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">+{row.defADM}</span>
                        : <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700" title={row.cadADMsFmt - row.admsNec > 0 ? `${Math.round((row.cadADMsFmt - row.admsNec) * 10) / 10} de folga` : undefined}>ok</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-orange-700">{row.tecsNec}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{row.cadTecsFmt}</td>
                    <td className="px-4 py-3 text-right">
                      {row.defTec > 0
                        ? <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">+{row.defTec}</span>
                        : <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700" title={row.cadTecsFmt - row.tecsNec > 0 ? `${Math.round((row.cadTecsFmt - row.tecsNec) * 10) / 10} de folga` : undefined}>ok</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Gráfico burn-down ────────────────────────────────────────────────── */}
      {calc.admsEfet > 0 && totais.pendDocs > 0 && (
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <h2 className="mb-1 text-sm font-semibold text-gray-700">Progresso semanal — Documentos pendentes</h2>
          <p className="mb-4 text-xs text-gray-400">Com {calc.admsEfet} ADMs{calc.simAdms ? " (simulado)" : " (cadastro)"} fazendo {num(docsPorAdm, 5)} docs/dia</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={calc.graficoDocs} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
              <XAxis dataKey="semana" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <ReferenceLine y={0} stroke="#22c55e" strokeWidth={2}
                label={{ value: "zerado", position: "insideTopRight", fontSize: 10, fill: "#22c55e" }} />
              <Bar dataKey="processado" name="Processados"     fill="#22c55e" radius={[2, 2, 0, 0]} />
              <Bar dataKey="restante"   name="Ainda Pendentes" fill="#3b82f6" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Como calculamos ─────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl bg-blue-50 ring-1 ring-blue-200">
        <button
          type="button"
          onClick={() => setShowCalc((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-3 text-left"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-blue-800">
            <Info className="size-4" /> Como os cálculos funcionam
          </span>
          {showCalc ? <ChevronUp className="size-4 text-blue-600" /> : <ChevronDown className="size-4 text-blue-600" />}
        </button>
        {showCalc && (
          <div className="border-t border-blue-200 px-5 py-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-white/80 p-3">
                <p className="font-bold text-blue-800 mb-1">📄 ADMs necessários</p>
                <code className="block rounded bg-blue-100 px-3 py-2 text-xs font-mono text-blue-900 whitespace-pre">
{`⌈Pend.docs ÷ (Docs/ADM/dia × Dias úteis)⌉
= ⌈${totais.pendDocs} ÷ (${num(docsPorAdm, 5)} × ${num(diasUteis, 60)})⌉
= ${calc.admsNec} ADMs`}
                </code>
              </div>
              <div className="rounded-lg bg-white/80 p-3">
                <p className="font-bold text-blue-800 mb-1">🔧 Técnicos necessários</p>
                <code className="block rounded bg-blue-100 px-3 py-2 text-xs font-mono text-blue-900 whitespace-pre">
{`⌈Pend.insp ÷ (Insp/téc/dia × Dias úteis)⌉
= ⌈${totais.pendInsp} ÷ (${num(inspPorTec, 3)} × ${num(diasUteis, 60)})⌉
= ${calc.tecsNec} técnicos`}
                </code>
              </div>
              <div className="rounded-lg bg-white/80 p-3">
                <p className="font-bold text-blue-800 mb-1">📊 Capacidade atual</p>
                <code className="block rounded bg-blue-100 px-3 py-2 text-xs font-mono text-blue-900 whitespace-pre">
{`Docs: ${calc.admsEfet} × ${num(docsPorAdm, 5)} × ${num(diasUteis, 60)} = ${calc.capDocs}
Insp: ${calc.tecsEfet} × ${num(inspPorTec, 3)} × ${num(diasUteis, 60)} = ${calc.capInsp}`}
                </code>
              </div>
              <div className="rounded-lg bg-white/80 p-3">
                <p className="font-bold text-blue-800 mb-1">➕ A contratar</p>
                <code className="block rounded bg-blue-100 px-3 py-2 text-xs font-mono text-blue-900 whitespace-pre">
{`ADMs: max(0, ${calc.admsNec} − ${calc.admsEfet}) = ${calc.admsAdd}
Técs: max(0, ${calc.tecsNec} − ${calc.tecsEfet}) = ${calc.tecsAdd}`}
                </code>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Salvar Projeção (apenas quem pode editar) ────────────────────────── */}
      {canEdit && (
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5 space-y-4 print:hidden">
        <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">Salvar Projeção</h2>

        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-700">
            Título <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            placeholder="Ex.: Projeção Jun/2026 — Geral"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-700">Observação</label>
          <textarea
            rows={2}
            placeholder="Contexto, premissas, cenário..."
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-700">Comentários</label>
          <textarea
            rows={3}
            placeholder="Notas internas, decisões tomadas, próximos passos..."
            value={comentarios}
            onChange={(e) => setComentarios(e.target.value)}
            className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-gray-400">
            Será salvo em <strong>Projeções Salvas</strong> com data e hora automáticas
          </p>
          <button
            type="button"
            onClick={handleSalvar}
            disabled={salvarMutation.isPending || !titulo.trim()}
            className="flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-50"
          >
            <Save className="size-4" />
            {salvarMutation.isPending ? "Salvando..." : "Salvar Projeção"}
          </button>
        </div>
      </div>
      )}

    </div>
  );
}
