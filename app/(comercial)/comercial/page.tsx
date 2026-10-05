"use client";

// Comercial › Oportunidades (2026-10-05). Para quem vende: cada empresa cuja
// AEP entregue indicou um serviço vendido à parte (AET) ou o DRPS/Questionário
// Psicossocial, com a situação (aberta / em andamento / realizada), os setores
// indicados, trabalhadores expostos (base do orçamento) e o contato da empresa.
// Regra em lib/comercial/oportunidades.ts.

import { useMemo, useState, type ReactNode } from "react";
import { Building2, Download, FilterX, Handshake, Mail, MapPin, Phone, Search } from "lucide-react";
import { useComercial } from "@/lib/hooks/useComercial";
import { useUnidades } from "@/lib/hooks/useUnidades";
import { linhasCsv, type EmpresaComercial, type Produto, type SituacaoOportunidade } from "@/lib/comercial/oportunidades";
import { opcoesDistintas } from "@/lib/aep/sinalizacao-filtros";
import SeloNivelAiha from "@/components/aep/SeloNivelAiha";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { buscar } from "@/lib/busca/texto";
import { cn, fmtData, formatCNPJ } from "@/lib/utils";

const selectCls =
  "w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/20";

const SITUACAO: Record<SituacaoOportunidade, { rotulo: string; cls: string; dica: string }> = {
  aberta: { rotulo: "Oportunidade aberta", cls: "border-amber-300 bg-amber-50 text-amber-900", dica: "Indicada na AEP e a empresa ainda não tem" },
  andamento: { rotulo: "Em andamento", cls: "border-sky-200 bg-sky-50 text-sky-900", dica: "Já existe um documento em elaboração" },
  realizada: { rotulo: "Realizada", cls: "border-emerald-200 bg-emerald-50 text-emerald-900", dica: "Já existe um documento concluído" },
};

function Contador({ rotulo, valor, cor, ativo, onClick }: { rotulo: string; valor: ReactNode; cor: string; ativo?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      disabled={!onClick}
      onClick={onClick}
      className={cn("rounded-xl border p-3 text-left transition", cor, onClick && "hover:shadow-sm", ativo && "ring-2 ring-verde-primary ring-offset-1")}
    >
      <div className="text-2xl font-bold">{valor}</div>
      <div className="text-xs font-medium">{rotulo}</div>
    </button>
  );
}

function baixarCsv(linhas: string[][]) {
  const esc = (v: string) => (/[;"\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  // BOM para o Excel abrir com acento; separador ";".
  const csv = "﻿" + linhas.map((l) => l.map(esc).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `oportunidades-comerciais-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ComercialPage() {
  const { data: lista = [], isLoading, error } = useComercial();
  const { data: unidades = [] } = useUnidades();
  const nomeUnidade = useMemo(() => new Map(unidades.map((u) => [u.id_unidade, u.nome])), [unidades]);
  const unidadeDe = (id: string | null) => (id && nomeUnidade.get(id)) || "";

  const [busca, setBusca] = useState("");
  const [produto, setProduto] = useState<"" | Produto>("");
  const [situacao, setSituacao] = useState<"" | SituacaoOportunidade>("aberta");
  const [unidade, setUnidade] = useState("");
  const [nivel, setNivel] = useState("");

  const opcoesUnidade = useMemo(
    () =>
      opcoesDistintas(lista.map((c) => c.empresa.idUnidade))
        .map((id) => ({ id, nome: nomeUnidade.get(id) ?? id }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [lista, nomeUnidade]
  );

  // Filtra as OPORTUNIDADES dentro de cada empresa; empresa sem nenhuma sai.
  const filtradas = useMemo(() => {
    const porBusca = busca.trim()
      ? buscar(lista, busca, (c) => [
          c.empresa.nome,
          c.empresa.cnpj ?? "",
          unidadeDe(c.empresa.idUnidade),
          c.empresa.municipio ?? "",
        ]).itens
      : lista;
    return porBusca
      .filter((c) => (!unidade || c.empresa.idUnidade === unidade))
      .filter((c) => {
        if (!nivel) return true;
        if (nivel === "altos") return c.empresa.pior === "Alto" || c.empresa.pior === "Muito Alto";
        return c.empresa.pior === nivel;
      })
      .map((c) => ({
        ...c,
        oportunidades: c.oportunidades.filter((o) => (!produto || o.produto === produto) && (!situacao || o.situacao === situacao)),
      }))
      .filter((c) => c.oportunidades.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lista, busca, produto, situacao, unidade, nivel, nomeUnidade]);

  const todas = lista.flatMap((c) => c.oportunidades.map((o) => ({ c, o })));
  const abertas = (p: Produto) => todas.filter(({ o }) => o.produto === p && o.situacao === "aberta");
  const kpi = {
    aet: abertas("AET").length,
    drps: abertas("DRPS/Questionário").length,
    expostos: abertas("AET").reduce((n, { c }) => n + c.expostosAet, 0),
    andamento: todas.filter(({ o }) => o.situacao === "andamento").length,
  };
  const nAtivos = [busca.trim(), produto, situacao !== "aberta" ? situacao || "todas" : "", unidade, nivel].filter(Boolean).length;
  const limpar = () => {
    setBusca("");
    setProduto("");
    setSituacao("aberta");
    setUnidade("");
    setNivel("");
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <Handshake className="size-5 text-amber-700" /> Oportunidades comerciais
          </h1>
          <p className="max-w-3xl text-sm text-gray-500">
            Serviços que as AEPs <strong>já entregues ao cliente</strong> indicaram e que a empresa ainda não contratou:
            a <strong>AET</strong> (vendida à parte), quando algum setor tem indicação de análise completa (NR-17), e o{" "}
            <strong>DRPS / Questionário Psicossocial</strong>, quando a AEP aponta 3 ou mais fatores organizacionais
            (NR-01).
          </p>
        </div>
        <button
          type="button"
          disabled={filtradas.length === 0}
          onClick={() => baixarCsv(linhasCsv(filtradas, unidadeDe))}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <Download className="size-4" /> Exportar (Excel)
        </button>
      </div>

      {/* Contadores */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Contador
          rotulo="AET em aberto"
          valor={kpi.aet}
          cor="border-amber-300 bg-amber-50 text-amber-900"
          ativo={produto === "AET" && situacao === "aberta"}
          onClick={() => {
            setProduto("AET");
            setSituacao("aberta");
          }}
        />
        <Contador
          rotulo="Trabalhadores expostos (AET em aberto)"
          valor={kpi.expostos}
          cor="border-orange-200 bg-orange-50 text-orange-900"
        />
        <Contador
          rotulo="DRPS/Questionário em aberto"
          valor={kpi.drps}
          cor="border-violet-200 bg-violet-50 text-violet-900"
          ativo={produto === "DRPS/Questionário" && situacao === "aberta"}
          onClick={() => {
            setProduto("DRPS/Questionário");
            setSituacao("aberta");
          }}
        />
        <Contador
          rotulo="Em andamento"
          valor={kpi.andamento}
          cor="border-sky-200 bg-sky-50 text-sky-900"
          ativo={!produto && situacao === "andamento"}
          onClick={() => {
            setProduto("");
            setSituacao("andamento");
          }}
        />
      </div>

      {/* Busca + filtros */}
      <div className="space-y-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar empresa, CNPJ, unidade ou município..."
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pl-8 text-sm text-gray-900 focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/20"
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-[11px] font-medium text-gray-500">
            Produto
            <select value={produto} onChange={(e) => setProduto(e.target.value as "" | Produto)} className={selectCls}>
              <option value="">Todos</option>
              <option value="AET">AET</option>
              <option value="DRPS/Questionário">DRPS/Questionário</option>
            </select>
          </label>
          <label className="text-[11px] font-medium text-gray-500">
            Situação
            <select value={situacao} onChange={(e) => setSituacao(e.target.value as "" | SituacaoOportunidade)} className={selectCls}>
              <option value="">Todas</option>
              <option value="aberta">Oportunidade aberta</option>
              <option value="andamento">Em andamento</option>
              <option value="realizada">Realizada</option>
            </select>
          </label>
          <label className="text-[11px] font-medium text-gray-500">
            Unidade
            <select value={unidade} onChange={(e) => setUnidade(e.target.value)} className={selectCls}>
              <option value="">Todas</option>
              {opcoesUnidade.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[11px] font-medium text-gray-500">
            Nível AIHA
            <select value={nivel} onChange={(e) => setNivel(e.target.value)} className={selectCls}>
              <option value="">Todos</option>
              <option value="altos">Alto ou Muito Alto</option>
              {["Muito Alto", "Alto", "Moderado", "Baixo", "Trivial"].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            {filtradas.length} empresa{filtradas.length !== 1 ? "s" : ""} ·{" "}
            {filtradas.reduce((n, c) => n + c.oportunidades.length, 0)} oportunidade(s)
          </span>
          {nAtivos > 0 && (
            <button type="button" onClick={limpar} className="inline-flex items-center gap-1 font-semibold text-verde-primary hover:underline">
              <FilterX className="size-3.5" /> Voltar ao padrão (abertas)
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <LoadingSkeleton rows={6} />
      ) : error ? (
        <p className="rounded-2xl border border-red-100 bg-red-50 p-5 text-sm text-red-700">
          Não foi possível carregar as oportunidades: {(error as Error).message}
        </p>
      ) : filtradas.length === 0 ? (
        <p className="rounded-2xl border border-gray-100 bg-white p-10 text-center text-sm text-gray-500 shadow-sm">
          {lista.length === 0
            ? "Nenhuma AEP entregue indicou AET ou DRPS/Questionário até agora."
            : "Nenhuma oportunidade com esses filtros."}
        </p>
      ) : (
        <ul className="space-y-3">
          {filtradas.map((c) => (
            <CartaoEmpresa key={c.empresa.idEmpresa} c={c} unidade={unidadeDe(c.empresa.idUnidade)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function CartaoEmpresa({ c, unidade }: { c: EmpresaComercial; unidade: string }) {
  const e = c.empresa;
  const regiao = [e.municipio, e.uf].filter(Boolean).join("/");
  return (
    <li className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start gap-3">
        <Building2 className="mt-0.5 size-5 shrink-0 text-amber-700" />
        <div className="min-w-0 flex-1">
          <div className="text-base font-semibold text-gray-900">{e.nome}</div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
            <span>{e.cnpj ? formatCNPJ(e.cnpj) : "—"}</span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" />
              <span className="font-medium text-gray-700">{unidade || "Sem unidade"}</span>
              {regiao && <span className="text-gray-400">· {regiao}</span>}
            </span>
            {c.telefone && (
              <a href={`tel:${c.telefone}`} className="inline-flex items-center gap-1 hover:text-verde-primary">
                <Phone className="size-3" /> {c.telefone}
              </a>
            )}
            {c.email && (
              <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 hover:text-verde-primary">
                <Mail className="size-3" /> {c.email}
              </a>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {e.pior && <SeloNivelAiha nivel={e.pior} />}
          <span>AEP entregue {e.ultimaData ? fmtData(e.ultimaData) : "—"}</span>
        </div>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {c.oportunidades.map((o) => {
          const s = SITUACAO[o.situacao];
          return (
            <div key={o.produto} className={cn("rounded-xl border p-3", s.cls)} title={s.dica}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold">{o.produto === "AET" ? "AET – Análise Ergonômica do Trabalho" : "DRPS / Questionário Psicossocial"}</span>
                <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-semibold">{s.rotulo}</span>
              </div>
              {o.produto === "AET" ? (
                <div className="mt-1 text-xs">
                  <div>
                    <strong>{o.setores.length}</strong> setor{o.setores.length !== 1 ? "es" : ""} indicado{o.setores.length !== 1 ? "s" : ""} ·{" "}
                    <strong>{c.expostosAet}</strong> trabalhador{c.expostosAet !== 1 ? "es" : ""} exposto{c.expostosAet !== 1 ? "s" : ""}
                  </div>
                  <div className="mt-0.5 opacity-80">
                    {o.setores.map((st) => `${st.nome}${st.expostos ? ` (${st.expostos})` : ""}`).join(" · ")}
                  </div>
                </div>
              ) : (
                <div className="mt-1 text-xs">
                  A AEP apontou <strong>{e.totalAlertas}</strong> fator{e.totalAlertas !== 1 ? "es" : ""} organizacional
                  {e.totalAlertas !== 1 ? "is" : ""} em {e.totalSetores} setor{e.totalSetores !== 1 ? "es" : ""}.
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-2 text-[11px] text-gray-500">
        AEP realizada por <strong className="text-gray-700">{e.realizadaPor ?? "—"}</strong>
        {e.temInspecao ? (
          <>
            {" "}· enviada por <strong className="text-gray-700">{e.enviadoPor ?? "—"}</strong>
          </>
        ) : (
          " · sem inspeção"
        )}
      </div>
    </li>
  );
}
