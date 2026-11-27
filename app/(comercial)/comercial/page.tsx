"use client";

// Comercial › Oportunidades (2026-10-05). Para quem vende: cada empresa com
// serviços indicados pela AEP entregue (AET, DRPS/Questionário) ou pela última
// inspeção concluída (Apreciação NR-12, medição, químicos, DRPS,
// treinamentos), com a situação (aberta / em andamento / realizada), o que
// justifica cada uma e o contato da empresa. Regra em lib/comercial/oportunidades.ts.
// 0.3.246: primeiro a lista de empresas, recolhida; ao abrir, cada serviço numa linha com a origem
// (Inspeção, AEP, Conciliação), o que justifica, a situação e a venda.

import PessoaComFoto from "@/components/ui/PessoaComFoto";
import { Fragment, useId, useMemo, useState, type ReactNode } from "react";
import { rotuloMes, type MetodoTexto, type PlanoDoVendedor } from "@/lib/comercial/plano";
import { BadgeCheck, Building2, ChevronDown, ChevronRight, ClipboardCheck, Download, FilterX, Handshake, Info, Loader2, Mail, MapPin, Phone, Search, Undo2 } from "lucide-react";
import { useComercial, useDesfazerVenda, useRegistrarVenda } from "@/lib/hooks/useComercial";
import Modal from "@/components/ui/Modal";
import BotaoCadastroEmpresa from "@/components/comercial/BotaoCadastroEmpresa";
import { ConfirmHost, confirmar } from "@/components/ui/confirm";
import { useUserStore } from "@/lib/store";
import { useUnidades } from "@/lib/hooks/useUnidades";
import {
  A_VENDER,
  linhasCsv,
  NOME_PRODUTO,
  PRODUTOS,
  SETOR_EMPRESA_TODA,
  SETOR_NAO_INFORMADO,
  type EmpresaComercial,
  type LinhaIntervencaoOferta,
  type Oportunidade,
  type Origem,
  type Produto,
  type SituacaoOportunidade,
  type VendaFeita,
} from "@/lib/comercial/oportunidades";
import { opcoesDistintas } from "@/lib/aep/sinalizacao-filtros";
import SeloNivelAiha from "@/components/aep/SeloNivelAiha";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { buscar } from "@/lib/busca/texto";
import { useGruposEmpresas } from "@/lib/hooks/useGruposEmpresas";
import { cn, fmtData, formatCNPJ } from "@/lib/utils";
import { TABELA_GRADE } from "@/components/ui/tabela-grade";

const selectCls =
  "w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 focus:border-marca-primary focus:outline-none focus:ring-2 focus:ring-marca-primary/20";

/** De onde veio a indicação do serviço (0.3.246). */
const ORIGEM: Record<Origem, { cls: string; dica: string }> = {
  "Inspeção": { cls: "border-sky-200 bg-sky-50 text-sky-800", dica: "Indicado pela última inspeção concluída e liberada" },
  AEP: { cls: "border-violet-200 bg-violet-50 text-violet-800", dica: "Indicado pela AEP entregue e liberada" },
  "Conciliação": { cls: "border-indigo-200 bg-indigo-50 text-indigo-800", dica: "Indicado na Conciliação DRPS/QPS × AEP" },
};

const SITUACAO: Record<SituacaoOportunidade, { rotulo: string; cls: string; dica: string }> = {
  aberta: { rotulo: "Oportunidade aberta", cls: "border-amber-300 bg-amber-50 text-amber-900", dica: "Indicada e a empresa ainda não tem" },
  revisao: {
    rotulo: "Revisão recomendada",
    cls: "border-orange-300 bg-orange-50 text-orange-900",
    dica: "A empresa já tem, mas foi concluído antes da AEP/inspeção que indicou — vender a revisão",
  },
  andamento: { rotulo: "Em andamento", cls: "border-sky-200 bg-sky-50 text-sky-900", dica: "Já existe um documento em elaboração" },
  realizada: { rotulo: "Realizada", cls: "border-emerald-200 bg-emerald-50 text-emerald-900", dica: "Já existe um documento concluído" },
  vendida: { rotulo: "Vendida", cls: "border-violet-200 bg-violet-50 text-violet-900", dica: "O Comercial marcou como vendido; o documento ainda não começou" },
};

function Contador({ rotulo, valor, cor, ativo, onClick }: { rotulo: string; valor: ReactNode; cor: string; ativo?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      disabled={!onClick}
      onClick={onClick}
      className={cn("rounded-xl border p-3 text-left transition", cor, onClick && "hover:shadow-sm", ativo && "ring-2 ring-marca-primary ring-offset-1")}
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
  const { nomeGrupoDe } = useGruposEmpresas();
  const [produto, setProduto] = useState<"" | Produto>("");
  // "vender" = aberta + revisão recomendada (o padrão da tela).
  const [situacao, setSituacao] = useState<"" | "vender" | SituacaoOportunidade>("vender");
  const casaSituacao = (s: SituacaoOportunidade) =>
    !situacao || (situacao === "vender" ? A_VENDER.includes(s) : s === situacao);
  const [unidade, setUnidade] = useState("");
  const [nivel, setNivel] = useState("");
  // Empresas abertas na lista (0.3.246): todas começam recolhidas.
  const [abertas, setAbertas] = useState<Set<string>>(new Set());
  const alternar = (id: string) =>
    setAbertas((a) => {
      const n = new Set(a);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

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
          nomeGrupoDe(c.empresa.idEmpresa),
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
        oportunidades: c.oportunidades.filter((o) => (!produto || o.produto === produto) && casaSituacao(o.situacao)),
      }))
      .filter((c) => c.oportunidades.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lista, busca, produto, situacao, unidade, nivel, nomeUnidade, nomeGrupoDe]);

  const todas = lista.flatMap((c) => c.oportunidades.map((o) => ({ c, o })));
  const aVender = (p: Produto) => todas.filter(({ o }) => o.produto === p && A_VENDER.includes(o.situacao));
  const kpi = {
    abertas: todas.filter(({ o }) => A_VENDER.includes(o.situacao)).length,
    aet: aVender("AET").length,
    expostos: aVender("AET").reduce((n, { c }) => n + c.expostosAet, 0),
    andamento: todas.filter(({ o }) => o.situacao === "andamento").length,
  };
  // Abertas por produto — os chips embaixo dos contadores.
  const porProduto = PRODUTOS.map((p) => ({ p, n: aVender(p).length })).filter((x) => x.n > 0);
  const nAtivos = [busca.trim(), produto, situacao !== "vender" ? situacao || "todas" : "", unidade, nivel].filter(Boolean).length;
  const limpar = () => {
    setBusca("");
    setProduto("");
    setSituacao("vender");
    setUnidade("");
    setNivel("");
  };

  return (
    <div className="space-y-5">
      <ConfirmHost />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <Handshake className="size-5 text-amber-700" /> Oportunidades comerciais
          </h1>
          <p className="max-w-3xl text-sm text-gray-500">
            Só entram inspeções e AEPs <strong>liberadas para o Comercial</strong> pela equipe, e as intervenções que a
            Conciliação indicou. Serviços que a JCN já
            identificou no cliente e que a empresa ainda não contratou: pela{" "}
            <strong>AEP entregue</strong> (AET e DRPS/Questionário) e pela <strong>última inspeção concluída</strong>{" "}
            (Apreciação NR-12, medição quantitativa, Análise de Químicos, DRPS/Questionário e treinamentos NR).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* 0.3.276 (= Painel 0.3.926): formulário de cadastro de empresa numa janela. */}
          <BotaoCadastroEmpresa />
          <button
            type="button"
            disabled={filtradas.length === 0}
            onClick={() => baixarCsv(linhasCsv(filtradas, unidadeDe))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <Download className="size-4" /> Exportar (Excel)
          </button>
        </div>
      </div>

      {/* Contadores */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Contador
          rotulo="A vender (abertas + revisões)"
          valor={kpi.abertas}
          cor="border-amber-300 bg-amber-50 text-amber-900"
          ativo={!produto && situacao === "vender"}
          onClick={() => {
            setProduto("");
            setSituacao("vender");
          }}
        />
        <Contador
          rotulo="AET em aberto"
          valor={kpi.aet}
          cor="border-amber-300 bg-amber-50 text-amber-900"
          ativo={produto === "AET" && situacao === "vender"}
          onClick={() => {
            setProduto("AET");
            setSituacao("vender");
          }}
        />
        <Contador
          rotulo="Trabalhadores expostos (AET em aberto)"
          valor={kpi.expostos}
          cor="border-orange-200 bg-orange-50 text-orange-900"
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

      {porProduto.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {porProduto.map(({ p, n }) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setProduto(produto === p ? "" : p);
                setSituacao("vender");
              }}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold transition",
                produto === p ? "border-amber-500 bg-amber-500 text-white" : "border-amber-200 bg-white text-amber-800 hover:bg-amber-50"
              )}
            >
              {p} · {n}
            </button>
          ))}
        </div>
      )}

      {/* Busca + filtros */}
      <div className="space-y-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar empresa, CNPJ, unidade ou município..."
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pl-8 text-sm text-gray-900 focus:border-marca-primary focus:outline-none focus:ring-2 focus:ring-marca-primary/20"
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-[11px] font-medium text-gray-500">
            Produto
            <select value={produto} onChange={(e) => setProduto(e.target.value as "" | Produto)} className={selectCls}>
              <option value="">Todos</option>
              {PRODUTOS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[11px] font-medium text-gray-500">
            Situação
            <select
              value={situacao}
              onChange={(e) => setSituacao(e.target.value as "" | "vender" | SituacaoOportunidade)}
              className={selectCls}
            >
              <option value="">Todas</option>
              <option value="vender">A vender (aberta + revisão)</option>
              <option value="aberta">Oportunidade aberta</option>
              <option value="revisao">Revisão recomendada</option>
              <option value="andamento">Em andamento</option>
              <option value="vendida">Vendida</option>
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
          <span className="flex flex-wrap items-center gap-3">
            {filtradas.length > 0 && (
              <>
                <button type="button" onClick={() => setAbertas(new Set(filtradas.map((c) => c.empresa.idEmpresa)))} className="font-semibold text-marca-primary hover:underline">
                  Abrir todas
                </button>
                <button type="button" onClick={() => setAbertas(new Set())} className="font-semibold text-marca-primary hover:underline">
                  Recolher todas
                </button>
              </>
            )}
            {nAtivos > 0 && (
              <button type="button" onClick={limpar} className="inline-flex items-center gap-1 font-semibold text-marca-primary hover:underline">
                <FilterX className="size-3.5" /> Voltar ao padrão (a vender)
              </button>
            )}
          </span>
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
            ? "Nenhuma AEP entregue ou inspeção concluída indicou serviços até agora."
            : "Nenhuma oportunidade com esses filtros."}
        </p>
      ) : (
        // Um cartão por empresa, separados (0.3.250).
        <ul className="space-y-3">
          {filtradas.map((c) => (
            <CartaoEmpresa
              key={c.empresa.idEmpresa}
              c={c}
              unidade={unidadeDe(c.empresa.idUnidade)}
              aberta={abertas.has(c.empresa.idEmpresa)}
              onAlternar={() => alternar(c.empresa.idEmpresa)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function CartaoEmpresa({ c, unidade, aberta, onAlternar }: { c: EmpresaComercial; unidade: string; aberta: boolean; onAlternar: () => void }) {
  const e = c.empresa;
  const regiao = [e.municipio, e.uf].filter(Boolean).join("/");
  const nVender = c.oportunidades.filter((o) => A_VENDER.includes(o.situacao)).length;
  return (
    <li
      className={cn(
        "overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow",
        aberta ? "border-gray-200 bg-gray-50/50 shadow-md" : "border-gray-100 hover:shadow-md"
      )}
    >
      {/* Linha da empresa: clicar abre os serviços. */}
      <button
        type="button"
        onClick={onAlternar}
        aria-expanded={aberta}
        className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
      >
        {aberta ? <ChevronDown className="size-4 shrink-0 text-gray-500" /> : <ChevronRight className="size-4 shrink-0 text-gray-500" />}
        <Building2 className="size-5 shrink-0 text-amber-700" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-gray-900">{e.nome}</span>
          <span className="flex flex-wrap items-center gap-x-3 text-xs text-gray-500">
            <span>{e.cnpj ? formatCNPJ(e.cnpj) : "—"}</span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" />
              {unidade || "Sem unidade"}
              {regiao && <span className="text-gray-400">· {regiao}</span>}
            </span>
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-1.5">
          {c.oportunidades.map((o) => (
            <span key={o.produto} title={`${NOME_PRODUTO[o.produto]} · ${SITUACAO[o.situacao].rotulo}`} className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", SITUACAO[o.situacao].cls)}>
              {o.produto}
            </span>
          ))}
        </span>
        <span className="flex items-center gap-2 text-xs text-gray-600">
          {e.pior && <SeloNivelAiha nivel={e.pior} />}
          <span className="whitespace-nowrap">
            <strong className="text-gray-900">{c.oportunidades.length}</strong> serviço{c.oportunidades.length !== 1 ? "s" : ""}
            {nVender > 0 && (
              <>
                {" "}· <strong className="text-amber-700">{nVender}</strong> a vender
              </>
            )}
          </span>
        </span>
      </button>

      {aberta && (
        <div className="space-y-3 px-4 pb-4 pl-11">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
            {c.telefone && (
              <a href={`tel:${c.telefone}`} className="inline-flex items-center gap-1 hover:text-marca-primary">
                <Phone className="size-3" /> {c.telefone}
              </a>
            )}
            {c.email && (
              <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 hover:text-marca-primary">
                <Mail className="size-3" /> {c.email}
              </a>
            )}
            {c.temAep && <span>AEP entregue {e.ultimaData ? fmtData(e.ultimaData) : "—"}</span>}
            {c.inspecao && (
              <span className="inline-flex items-center gap-1">
                <ClipboardCheck className="size-3.5" />
                Inspeção {c.inspecao.idInspecao} concluída {c.inspecao.concluidaEm ? fmtData(c.inspecao.concluidaEm) : ""}
              </span>
            )}
          </div>

          {/* Um serviço por linha, com a origem da indicação. */}
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className={cn(TABELA_GRADE, "w-full min-w-[64rem] text-sm")}>
              <thead className={CLS_THEAD}>
                <FaixaGrupos indicacao="O que indicamos" colunas={4} />
                <tr>
                  <Titulo className="w-56" dica="Serviço que a empresa ainda não contratou">Serviço</Titulo>
                  <Titulo className="w-44" dica="Setores a que o serviço se refere; treinamentos NR valem para a empresa toda">Setor</Titulo>
                  <Titulo className="w-40" dica="De onde veio a indicação: Inspeção, AEP ou Conciliação">Origem</Titulo>
                  <Titulo dica="Os itens que levaram à indicação; o nome de cada um em negrito">O que justifica</Titulo>
                  <Titulo className="w-40" comercial dica="Aberta, revisão recomendada, em andamento, realizada ou vendida">Situação</Titulo>
                  <Titulo className="w-52" comercial dica="Marque quando o cliente fechar; quem marcou, ou um Admin, pode desfazer">Venda</Titulo>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {/* As intervenções psicossociais ficam só na tabela própria, embaixo (0.3.247). */}
                {c.oportunidades.filter((o) => !(o.produto === "Intervenção psicossocial" && o.intervencoes?.length)).map((o) => {
                  const st = SITUACAO[o.situacao];
                  return (
                    <tr key={o.produto} className="align-top">
                      <td className="px-3 py-2.5 font-semibold text-gray-900">{NOME_PRODUTO[o.produto]}</td>
                      <td className="px-3 py-2.5">
                        <SetoresDoServico nomes={o.setoresIndicados ?? []} />
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {o.origens.map((og) => (
                            <span
                              key={og}
                              title={og === "Inspeção" && c.inspecao ? `${ORIGEM[og].dica}: ${c.inspecao.idInspecao}` : ORIGEM[og].dica}
                              className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", ORIGEM[og].cls)}
                            >
                              {og}
                            </span>
                          ))}
                        </div>
                        {o.origens.includes("Inspeção") && c.inspecao && (
                          <p className="mt-1 text-[11px] text-gray-500">
                            {c.inspecao.idInspecao}
                            {c.inspecao.concluidaEm ? ` · ${fmtData(c.inspecao.concluidaEm)}` : ""}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-700">
                        <Justificativa c={c} o={o} />
                      </td>
                      <td className={cn("px-3 py-2.5", CLS_COL_COMERCIAL)}>
                        <span title={st.dica} className={cn("inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold", st.cls)}>
                          {st.rotulo}
                        </span>
                      </td>
                      <td className={cn("px-3 py-2.5", CLS_COL_COMERCIAL)}>
                        <VendaDoServico idEmpresa={e.idEmpresa} oportunidade={o} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Intervenções psicossociais numa tabela própria: uma linha por intervenção (0.3.246). */}
          {c.oportunidades
            .filter((o) => o.produto === "Intervenção psicossocial" && o.intervencoes?.length)
            .map((o) => (
              <TabelaIntervencoes key={o.produto} idEmpresa={e.idEmpresa} o={o} />
            ))}

      {c.liberadaPeloGrupo && (
        // 0.3.290 (banco v356): a Conciliação foi feita e liberada pelo grupo de empresas; aqui ficam só os setores desta.
        <p className="mt-3 inline-flex rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[11px] font-medium text-violet-900">
          Liberada pelo grupo {c.liberadaPeloGrupo}
        </p>
      )}
      {c.parecerEquipe && (
        <p className="mt-3 whitespace-pre-line rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
          <strong>Parecer da equipe{c.liberadaPeloGrupo ? " (grupo)" : ""}:</strong> {c.parecerEquipe}
        </p>
      )}

      <div className="mt-2 flex flex-wrap gap-x-4 text-[11px] text-gray-500">
        {c.temAep && (
          <span>
            {/* 0.3.310: foto (ou iniciais) antes de cada nome, como no resto do sistema. */}
            AEP realizada por <PessoaComFoto nome={e.realizadaPor} tamanho="size-4 text-[7px]" className="align-middle font-semibold text-gray-700" />
            {e.temInspecao ? (
              <>
                {" "}· enviada por <PessoaComFoto nome={e.enviadoPor} tamanho="size-4 text-[7px]" className="align-middle font-semibold text-gray-700" />
              </>
            ) : (
              " · sem inspeção"
            )}
          </span>
        )}
        {c.inspecao && (
          <span>
            Inspeção feita por <PessoaComFoto nome={c.inspecao.responsavel} tamanho="size-4 text-[7px]" className="align-middle font-semibold text-gray-700" />
          </span>
        )}
        {c.inspecao?.liberadoEm && (
          <span>
            Inspeção liberada para o Comercial em {fmtData(c.inspecao.liberadoEm)}
            {c.inspecao.liberadoPor && <> por <PessoaComFoto nome={c.inspecao.liberadoPor} tamanho="size-4 text-[7px]" className="align-middle" /></>}
          </span>
        )}
        {c.temAep && c.aepLiberadaEm && (
          <span>
            AEP liberada em {fmtData(c.aepLiberadaEm)}
            {c.aepLiberadaPor && <> por <PessoaComFoto nome={c.aepLiberadaPor} tamanho="size-4 text-[7px]" className="align-middle" /></>}
          </span>
        )}
      </div>
        </div>
      )}
    </li>
  );
}

/*
 * Títulos das tabelas em 2 níveis (0.3.247): uma faixa agrupa as colunas em "o que a JCN indicou" (azul)
 * e "Comercial" (âmbar, com Situação e Venda, que têm fundo leve nas linhas). Cada título tem a explicação
 * ao passar o mouse. As duas tabelas usam as mesmas larguras para Situação e Venda, e ficam alinhadas.
 */
const CLS_THEAD = "bg-gray-100 text-left text-[11px] font-bold uppercase tracking-wide text-gray-700 [&_tr:last-child]:border-b-2 [&_tr:last-child]:border-gray-300";
const CLS_COL_COMERCIAL = "bg-amber-50/40";

function FaixaGrupos({ indicacao, colunas }: { indicacao: string; colunas: number }) {
  return (
    <tr className="text-[10px] tracking-wider">
      <th colSpan={colunas} className="border-b border-sky-200 bg-sky-50 px-3 py-1 text-sky-800">
        {indicacao}
      </th>
      <th colSpan={2} className="border-b border-amber-200 bg-amber-100/70 px-3 py-1 text-amber-900">
        Comercial
      </th>
    </tr>
  );
}

function Titulo({ children, dica, className, comercial }: { children: ReactNode; dica: string; className?: string; comercial?: boolean }) {
  return (
    <th title={dica} className={cn("px-3 py-2", comercial && "bg-amber-50", className)}>
      <span className="inline-flex cursor-help items-center gap-1">
        {children}
        <Info className="size-3 text-gray-400" aria-hidden />
      </span>
    </th>
  );
}

/** Coluna Setor (0.3.248): um setor por linha; "Empresa toda" e "Setor não informado" em cinza. */
function SetoresDoServico({ nomes }: { nomes: string[] }) {
  if (nomes.length === 0) return <span className="text-xs text-gray-400">—</span>;
  return (
    <ul className="space-y-0.5 text-xs">
      {nomes.map((n) => (
        <li key={n} className={n === SETOR_EMPRESA_TODA || n === SETOR_NAO_INFORMADO ? "italic text-gray-500" : "font-semibold text-gray-900"}>
          {n}
        </li>
      ))}
    </ul>
  );
}

/** Observação sobre a situação (documento antigo, rascunho parado), não item a vender. */
const ehNota = (d: string) => /antes da indicação|não conta como|^Há \d/.test(d);

/**
 * Um item com o título em destaque para quem vende (0.3.246): o nome antes de " – ", " (", " · " ou ": "
 * fica em negrito e o resto em cinza; número no começo fica em negrito; observação vira nota.
 */
function ItemJustificativa({ texto }: { texto: string }) {
  if (ehNota(texto)) return <span className="italic text-gray-500">{texto}</span>;
  const num = /^(\d+)(\s.*)$/.exec(texto);
  if (num) {
    return (
      <span>
        <strong className="text-gray-900">{num[1]}</strong>
        {num[2]}
      </span>
    );
  }
  const corte = [" – ", " (", " · ", ": "].map((sep) => texto.indexOf(sep)).filter((i) => i > 0);
  const i = corte.length ? Math.min(...corte) : -1;
  if (i < 0) return <strong className="font-semibold text-gray-900">{texto}</strong>;
  return (
    <span>
      <strong className="font-semibold text-gray-900">{texto.slice(0, i)}</strong>
      <span className="text-gray-500">{texto.slice(i)}</span>
    </span>
  );
}

/**
 * As intervenções que a Conciliação indicou: Setor, Risco, Intervenção, Modalidade, Responsável, Prazo e,
 * desde a 0.3.247, a Situação e a Venda de cada uma.
 */
/** 0.3.329: as intervenções agrupadas pelo setor ou pelo risco; dentro do grupo, pelo outro lado e pela intervenção. */
function agruparLinhas(linhas: readonly LinhaIntervencaoOferta[], por: "setor" | "risco") {
  const grupo = (l: LinhaIntervencaoOferta) => (por === "setor" ? l.setor : l.risco);
  const outro = (l: LinhaIntervencaoOferta) => (por === "setor" ? l.risco : l.setor);
  const mapa = new Map<string, LinhaIntervencaoOferta[]>();
  for (const l of linhas) mapa.set(grupo(l), [...(mapa.get(grupo(l)) ?? []), l]);
  return [...mapa.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
    .map(([nome, ls]) => ({
      nome,
      outro,
      linhas: [...ls].sort((x, y) => outro(x).localeCompare(outro(y), "pt-BR") || x.intervencao.localeCompare(y.intervencao, "pt-BR")),
      outros: [...new Set(ls.map(outro))].sort((x, y) => x.localeCompare(y, "pt-BR")),
    }));
}

function TabelaIntervencoes({ idEmpresa, o }: { idEmpresa: string; o: Oportunidade }) {
  // 0.3.329 (pedido do João): ver por setor ou por risco, como na Conciliação por grupo.
  const [por, setPor] = useState<"setor" | "risco">("setor");
  const grupos = agruparLinhas(o.intervencoes ?? [], por);
  return (
    <div className="overflow-x-auto rounded-xl border border-indigo-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100 bg-indigo-50 px-3 py-2">
        <p className="text-xs font-bold uppercase tracking-wide text-indigo-900">Intervenções psicossociais</p>
        <div className="inline-flex rounded-lg border border-indigo-200 bg-white p-0.5 text-xs font-medium" role="group" aria-label="Mostrar as intervenções">
          {(["setor", "risco"] as const).map((k) => (
            <button key={k} type="button" onClick={() => setPor(k)} aria-pressed={por === k}
              className={cn("rounded-md px-2.5 py-1", por === k ? "bg-indigo-600 text-white shadow-sm" : "text-gray-600 hover:text-gray-900")}>
              {k === "setor" ? "Por setor" : "Por risco"}
            </button>
          ))}
        </div>
      </div>
      {o.venda && (
        // Venda do serviço inteiro, de antes da venda por intervenção. O desfazer fica aqui, porque a linha do
        // serviço saiu da tabela de cima.
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 border-b border-violet-200 bg-violet-50 px-3 py-2">
          <p className="text-xs text-violet-900">
            <strong>Vendida como serviço inteiro.</strong> A venda cobre todas as intervenções abaixo. Para vender uma a uma, desfaça-a.
          </p>
          <Venda idEmpresa={idEmpresa} produto={o.produto} nome="O serviço Intervenção psicossocial" venda={o.venda} podeVender={false} />
        </div>
      )}
      <table className={cn(TABELA_GRADE, "w-full min-w-[64rem] text-sm")}>
        <thead className={CLS_THEAD}>
          <FaixaGrupos indicacao="Indicado na Conciliação" colunas={4} />
        </thead>
        <tbody className="divide-y divide-gray-100 text-gray-700">
          {grupos.map((g) => (
            <Fragment key={g.nome}>
              {/* O título do grupo: o setor (com quantas intervenções) ou o risco (com os setores em que aparece). */}
              {/* 0.3.329 (pedido do João): a faixa do grupo vem primeiro e os títulos das colunas logo abaixo, em cada grupo. */}
              <tr className="bg-indigo-50/60">
                <td colSpan={6} className="border-t-2 border-indigo-200 px-3 py-2">
                  <div className="flex flex-wrap items-baseline justify-center gap-x-2 gap-y-0.5">
                    <span className="text-xs font-semibold text-indigo-700">{por === "setor" ? "Setor:" : "Risco:"}</span>
                    <span className="font-bold text-gray-900">{g.nome}</span>
                    <span className="text-xs text-gray-500">
                      ·{" "}
                      {por === "setor"
                        ? `${g.linhas.length} ${g.linhas.length === 1 ? "intervenção" : "intervenções"}`
                        : `${g.outros.length === 1 ? "Setor" : `Setores (${g.outros.length})`}: ${g.outros.join(", ")}`}
                    </span>
                  </div>
                </td>
              </tr>
              <tr className={cn(CLS_THEAD, "border-b-2 border-gray-300")}>
                {por === "setor"
                  ? <Titulo className="w-44" dica="Fator de risco psicossocial confirmado na Conciliação">Risco</Titulo>
                  : <Titulo className="w-44" dica="Setor onde o risco foi confirmado">Setor</Titulo>}
                <Titulo dica="Ação indicada para o risco">Intervenção</Titulo>
                <Titulo className="w-28" dica="Como é feita: EAD, presencial ou ao vivo">Modalidade</Titulo>
                <Titulo className="w-48" dica="Quem executa a intervenção">Responsável</Titulo>
                <Titulo className="w-40" comercial dica="Aberta ou vendida, por intervenção">Situação</Titulo>
                <Titulo className="w-52" comercial dica="Cada intervenção se vende sozinha; quem marcou, ou um Admin, pode desfazer">Venda</Titulo>
              </tr>
              {g.linhas.map((l, n) => {
                const novoOutro = n === 0 || g.outro(g.linhas[n - 1]) !== g.outro(l);
                // A intervenção com método ocupa 2 linhas (a dela e a faixa do método embaixo).
                const altura = novoOutro ? somarAltura(g.linhas, n, (x) => g.outro(x) === g.outro(l)) : 0;
                const st = SITUACAO[l.venda || o.venda ? "vendida" : "aberta"];
                return (
                  <Fragment key={l.idItem}>
                    <tr className="align-top">
                      {novoOutro && (
                        // No meio do bloco (largura e altura).
                        <td rowSpan={altura} className="border-l-0 px-3 py-2 align-middle font-semibold text-gray-800">
                          {g.outro(l)}
                        </td>
                      )}
                      <td className="px-3 py-2 font-semibold text-gray-900">{l.intervencao}</td>
                      <td className="px-3 py-2">{l.modalidade ?? "—"}</td>
                      <td className="px-3 py-2">{l.responsavel ?? "—"}</td>
                      <td className={cn("px-3 py-2", CLS_COL_COMERCIAL)}>
                        <span title={st.dica} className={cn("inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold", st.cls)}>
                          {st.rotulo}
                        </span>
                      </td>
                      <td className={cn("px-3 py-2", CLS_COL_COMERCIAL)}>
                        {!l.venda && o.venda ? (
                          <span className="text-xs text-violet-900">Coberta pela venda do serviço inteiro (acima)</span>
                        ) : (
                          <Venda idEmpresa={idEmpresa} produto={o.produto} idItem={l.idItem} nome={l.intervencao} venda={l.venda} podeVender />
                        )}
                      </td>
                    </tr>
                    {temMetodo(l) && (
                      // O método que a equipe descreveu, numa faixa embaixo da intervenção (texto à esquerda).
                      <tr>
                        <td colSpan={5} className="bg-gray-50/60 p-0">
                          <MetodoNaVenda m={l.metodo!} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
      {o.plano && <PlanoNaVenda p={o.plano} />}
    </div>
  );
}

const LINHAS_METODO: { campo: keyof MetodoTexto; rotulo: string }[] = [
  { campo: "forma", rotulo: "Forma de realização" },
  { campo: "avaliacao", rotulo: "Avaliação de aprendizado" },
  { campo: "duracao", rotulo: "Duração" },
  { campo: "certificado", rotulo: "Certificado" },
];

const temMetodo = (l: { metodo?: MetodoTexto | null }) => !!l.metodo && LINHAS_METODO.some((x) => l.metodo![x.campo]);

/** Quantas linhas da tabela as intervenções seguidas do mesmo grupo ocupam (com método, 2 cada). */
function somarAltura<T extends { metodo?: MetodoTexto | null }>(linhas: readonly T[], inicio: number, igual: (x: T) => boolean): number {
  let total = 0;
  for (let k = inicio; k < linhas.length && igual(linhas[k]); k++) total += temMetodo(linhas[k]) ? 2 : 1;
  return total;
}

/** 0.3.328: o método da intervenção (o que a equipe preparou na Conciliação), só leitura: os 4 campos lado a lado. */
function MetodoNaVenda({ m }: { m: MetodoTexto }) {
  return (
    // 0.3.329 (pedido do João): os 4 campos separados por linhas verticais.
    <dl className="grid grid-cols-4 divide-x divide-dashed divide-gray-300 text-left text-xs [&_*]:!text-left">
      {LINHAS_METODO.map((x) => (
        <div key={x.campo} className="px-3 py-2">
          <dt className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{x.rotulo}</dt>
          <dd className="mt-0.5 text-gray-800">{m[x.campo] || <span className="text-gray-400">—</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

/** 0.3.328: o Plano de intervenções da Conciliação (planejamento e cronograma), só leitura. */
function PlanoNaVenda({ p }: { p: PlanoDoVendedor }) {
  return (
    <div className="border-t border-indigo-100 px-3 py-3">
      <p className="text-xs font-bold uppercase tracking-wide text-indigo-900">Plano de intervenções</p>
      <p className="mt-0.5 text-xs text-gray-600">
        {p.planejamento === "ead_continuo" ? "EAD disponível o período todo, com ações online e presenciais todo mês" : "Um tema por mês"}
        {" · "}
        {p.meses} {p.meses === 1 ? "mês" : "meses"}
        {p.inicio ? ` a partir de ${rotuloMes(p.inicio, 1)}` : ""}
        {!p.gravado && <span className="text-gray-400"> (sugestão padrão: a equipe ainda não ajustou o plano)</span>}
      </p>
      {p.linhas.length > 0 && (
        <table className="mt-2 w-full max-w-3xl text-sm">
          <thead className="text-left text-xs font-semibold text-gray-600">
            <tr><th className="py-1 pr-3">Intervenção</th><th className="w-40 py-1 pr-3">Método</th><th className="w-28 py-1">Mês</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-gray-700">
            {p.linhas.map((l) => (
              <tr key={l.intervencao}><td className="py-1 pr-3 font-medium text-gray-900">{l.intervencao}</td><td className="py-1 pr-3">{l.metodo}</td><td className="py-1">{l.mes}</td></tr>
            ))}
          </tbody>
        </table>
      )}
      {p.continuos.length > 0 && (
        <p className="mt-2 text-sm text-gray-700"><span className="font-medium">Todo o período (EAD):</span> {p.continuos.join(", ")}</p>
      )}
      <ul className="mt-2 grid gap-0.5 text-sm text-gray-700 sm:grid-cols-2 lg:grid-cols-3">
        {p.cronograma.map((m) => (
          <li key={m.rotulo}><span className="font-medium">{m.rotulo}:</span> {m.intervencoes.length ? m.intervencoes.join(", ") : <span className="text-gray-400">—</span>}</li>
        ))}
      </ul>
    </div>
  );
}

/** O que justifica o serviço: na AET, setores e expostos (e o que a Conciliação mandou aprofundar); nos demais, os itens. */
function Justificativa({ c, o }: { c: EmpresaComercial; o: Oportunidade }) {
  const notas = o.detalhes.filter(ehNota);
  if (o.produto === "Intervenção psicossocial" && o.intervencoes?.length) {
    const riscos = new Set(o.intervencoes.map((i) => `${i.setor}|${i.risco}`)).size;
    return (
      <span>
        <strong className="text-gray-900">{o.intervencoes.length}</strong> intervenç{o.intervencoes.length !== 1 ? "ões" : "ão"} em{" "}
        <strong className="text-gray-900">{riscos}</strong> risco{riscos !== 1 ? "s" : ""} · <span className="text-indigo-700">tabela abaixo</span>
      </span>
    );
  }
  if (o.produto === "AET" && o.setores.length > 0) {
    const conciliacao = o.detalhes.filter((d) => d.includes("(Conciliação:"));
    return (
      <div className="space-y-1">
        <div>
          <strong className="text-gray-900">{o.setores.length}</strong> setor{o.setores.length !== 1 ? "es" : ""} indicado{o.setores.length !== 1 ? "s" : ""} ·{" "}
          <strong className="text-gray-900">{c.expostosAet}</strong> trabalhador{c.expostosAet !== 1 ? "es" : ""} exposto{c.expostosAet !== 1 ? "s" : ""}
        </div>
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wide text-gray-600">Setores: </span>
          {o.setores.map((st, n) => (
            <span key={st.nome}>
              {n > 0 && <span className="text-gray-400"> · </span>}
              <strong className="font-semibold text-gray-900">{st.nome}</strong>
              {st.expostos ? <span className="text-gray-500"> ({st.expostos})</span> : null}
            </span>
          ))}
        </div>
        {conciliacao.length > 0 && (
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wide text-indigo-800">Aprofundar (Conciliação): </span>
            {conciliacao.map((d, n) => (
              <span key={d}>
                {n > 0 && <span className="text-gray-400"> · </span>}
                <strong className="font-semibold text-gray-900">{d.replace(/\s*\(Conciliação:.*\)$/, "")}</strong>
              </span>
            ))}
          </div>
        )}
        {notas.map((d) => (
          <p key={d} className="italic text-gray-500">
            {d}
          </p>
        ))}
      </div>
    );
  }
  const itens = o.detalhes.filter((d) => !ehNota(d));
  return (
    <div className="space-y-1">
      <ul className="list-disc space-y-0.5 pl-4 marker:text-gray-400">
        {itens.slice(0, 6).map((d) => (
          <li key={d}>
            <ItemJustificativa texto={d} />
          </li>
        ))}
        {itens.length > 6 && <li className="list-none text-gray-500">+ {itens.length - 6} item(ns)</li>}
      </ul>
      {notas.map((d) => (
        <p key={d} className="italic text-gray-500">
          {d}
        </p>
      ))}
    </div>
  );
}

/**
 * Coluna Venda da linha do serviço. Nas intervenções psicossociais a venda é por intervenção, na tabela
 * de baixo (0.3.247); aqui fica a contagem. Uma venda antiga do serviço inteiro continua aparecendo aqui.
 */
function VendaDoServico({ idEmpresa, oportunidade: o }: { idEmpresa: string; oportunidade: Oportunidade }) {
  if (!o.venda && o.intervencoes?.length) {
    const n = o.intervencoes.filter((l) => l.venda).length;
    return (
      <p className="text-xs text-gray-600">
        <strong className="text-gray-900">{n}</strong> de <strong className="text-gray-900">{o.intervencoes.length}</strong> vendida
        {o.intervencoes.length !== 1 ? "s" : ""} · <span className="text-indigo-700">na tabela abaixo</span>
      </p>
    );
  }
  return (
    <Venda idEmpresa={idEmpresa} produto={o.produto} nome={NOME_PRODUTO[o.produto]} venda={o.venda} podeVender={A_VENDER.includes(o.situacao)} />
  );
}

/** "Marcar como vendido"; depois da venda, quem vendeu e o desfazer (v323). Com idItem, uma intervenção só (v329). */
function Venda({
  idEmpresa,
  produto,
  idItem,
  nome,
  venda,
  podeVender,
}: {
  idEmpresa: string;
  produto: Produto;
  idItem?: string;
  nome: string;
  venda?: VendaFeita;
  podeVender: boolean;
}) {
  const registrar = useRegistrarVenda();
  const desfazer = useDesfazerVenda();
  const user = useUserStore((s) => s.user);
  const [aberta, setAberta] = useState(false);
  const [observacao, setObservacao] = useState("");
  const idObs = useId();

  if (venda) {
    const podeDesfazer = user?.perfil === "Admin" || user?.email?.toLowerCase() === venda.porEmail;
    return (
      <div className="text-xs text-violet-900">
        <p className="flex items-center gap-1 font-semibold">
          <BadgeCheck className="size-3.5 shrink-0" /> Vendido em {fmtData(venda.em)} por{" "}
          <PessoaComFoto nome={venda.por} email={venda.porEmail} tamanho="size-4 text-[7px]" />
        </p>
        {venda.observacao && <p className="mt-0.5">{venda.observacao}</p>}
        {podeDesfazer && (
          <button
            type="button"
            disabled={desfazer.isPending}
            onClick={async () => {
              const ok = await confirmar({
                title: "Desfazer a venda?",
                description: `${nome} volta a ficar a vender, e a venda sai da lista da Consolidação.`,
                confirmLabel: "Desfazer",
                variant: "danger",
              });
              if (ok) desfazer.mutate({ idEmpresa, produto, idItem });
            }}
            className="mt-1 inline-flex items-center gap-1 font-medium underline disabled:opacity-60"
          >
            <Undo2 className="size-3" /> Desfazer
          </button>
        )}
      </div>
    );
  }
  if (!podeVender) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setAberta(true)}
        className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100"
      >
        <BadgeCheck className="size-3.5" /> Marcar como vendido
      </button>
      {aberta && (
        <Modal
          open
          onClose={() => setAberta(false)}
          title="Marcar como vendido"
          footer={
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setAberta(false)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                Cancelar
              </button>
              <button
                type="button"
                disabled={registrar.isPending}
                onClick={() => registrar.mutate({ idEmpresa, produto, idItem, observacao: observacao.trim() || null }, { onSuccess: () => setAberta(false) })}
                className="inline-flex items-center gap-1.5 rounded-lg bg-marca-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-marca-accent disabled:opacity-60"
              >
                {registrar.isPending && <Loader2 className="size-4 animate-spin" />} Registrar venda
              </button>
            </div>
          }
        >
          <div className="space-y-2 text-sm">
            <p className="text-gray-700">
              <strong>{nome}</strong> sai do &quot;a vender&quot; e aparece para a equipe técnica em Consolidação › Vendas.
            </p>
            <label htmlFor={idObs} className="block text-xs font-semibold text-gray-600">
              Observação para a equipe (opcional)
            </label>
            <textarea
              id={idObs}
              rows={3}
              value={observacao}
              onChange={(ev) => setObservacao(ev.target.value)}
              className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm text-gray-900 focus:border-marca-primary focus:outline-none focus:ring-2 focus:ring-marca-primary/20"
            />
          </div>
        </Modal>
      )}
    </>
  );
}
