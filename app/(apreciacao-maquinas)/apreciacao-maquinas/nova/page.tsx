"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Cog, Download, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { mensagemErro } from "@/lib/errors";
import { useEmpresas } from "@/lib/hooks/useEmpresas";
import {
  useInventarioMaquinas,
  useMaquinasInspecaoPendentes,
  useImportarMaquinasInspecao,
} from "@/lib/hooks/useInventarioMaquinas";
import { useCriarApreciacaoMaquina } from "@/lib/hooks/useApreciacoesMaquinas";
import { useRequireCreate } from "@/lib/hooks/useUsuario";
import { useUserStore } from "@/lib/store";
import ProfissionalSelect from "@/components/ui/ProfissionalSelect";
import { CATALOGO_NR12 } from "@/lib/apreciacao-maquinas/catalogo-nr12";
import { formatCNPJ } from "@/lib/utils";

export default function NovaApreciacaoPage() {
  useRequireCreate("/apreciacao-maquinas");
  const router = useRouter();
  const user = useUserStore((s) => s.user);
  const { data: empresas = [] } = useEmpresas();
  const { data: maquinas = [] } = useInventarioMaquinas();
  const criar = useCriarApreciacaoMaquina();
  const importar = useImportarMaquinasInspecao();

  const [idEmpresa, setIdEmpresa] = useState<string>("");
  const [filtroSetor, setFiltroSetor] = useState<string>("");
  const [idMaquina, setIdMaquina] = useState<string>("");
  const [maquinaDescricao, setMaquinaDescricao] = useState("");
  const [titulo, setTitulo] = useState("");
  const [setor, setSetor] = useState("");
  const [responsavel, setResponsavel] = useState(user?.nome ?? "");
  const [responsavelEmpresa, setResponsavelEmpresa] = useState("");
  const [cidade, setCidade] = useState("");
  const [dataApreciacao, setDataApreciacao] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );

  const empresaSelecionada = empresas.find((e) => e.id_empresa === idEmpresa) ?? null;

  // Máquinas registradas em inspeções da empresa que ainda não estão no inventário
  const { data: pend } = useMaquinasInspecaoPendentes(idEmpresa || null);
  const pendentes = pend?.pendentes ?? [];

  async function handleImportarPendentes() {
    try {
      const r = await importar.mutateAsync(pendentes);
      toast.success(
        r.criadas > 0
          ? `${r.criadas} máquina${r.criadas > 1 ? "s" : ""} importada${r.criadas > 1 ? "s" : ""} — já disponíveis na lista abaixo`
          : "Nenhuma nova máquina pra importar."
      );
    } catch {
      // toast de erro já emitido pelo hook
    }
  }

  // Setores únicos das máquinas da empresa selecionada
  const setoresDisponiveis = useMemo(() => {
    if (!idEmpresa) return [] as string[];
    const s = new Set<string>();
    maquinas
      .filter((m) => m.id_empresa === idEmpresa || m.id_empresa === null)
      .forEach((m) => { if (m.setor) s.add(m.setor); });
    return Array.from(s).sort();
  }, [maquinas, idEmpresa]);

  // Máquinas filtradas por empresa + setor
  const maquinasFiltradas = useMemo(() => {
    if (!idEmpresa) return [] as typeof maquinas;
    return maquinas.filter((m) => {
      if (m.id_empresa !== idEmpresa && m.id_empresa !== null) return false;
      if (filtroSetor && m.setor !== filtroSetor) return false;
      return true;
    });
  }, [maquinas, idEmpresa, filtroSetor]);

  function handleEmpresaChange(v: string) {
    setIdEmpresa(v);
    setFiltroSetor("");
    setIdMaquina("");
    setSetor("");
  }

  function handleSetorFiltroChange(v: string) {
    setFiltroSetor(v);
    setIdMaquina("");
    setSetor(v); // auto-preenche o setor da apreciação
  }

  function handleMaquinaChange(v: string) {
    setIdMaquina(v);
    if (v) {
      const maq = maquinas.find((m) => m.id_maquina === v);
      if (maq?.setor) setSetor(maq.setor);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!idEmpresa) {
      toast.error("Selecione a empresa.");
      return;
    }
    if (!idMaquina && !maquinaDescricao.trim()) {
      toast.error("Selecione uma máquina do inventário ou descreva a máquina.");
      return;
    }
    try {
      const maquinaSel = idMaquina
        ? maquinas.find((m) => m.id_maquina === idMaquina)
        : null;
      const row = await criar.mutateAsync({
        id_empresa: idEmpresa,
        id_maquina: idMaquina || null,
        id_inspecao: maquinaSel?.id_inspecao ?? null,
        maquina_descricao: idMaquina ? null : maquinaDescricao.trim(),
        titulo: titulo.trim() || null,
        setor: setor.trim() || null,
        responsavel: responsavel.trim() || null,
        responsavel_empresa: responsavelEmpresa.trim() || null,
        cidade: cidade.trim() || null,
        data_apreciacao: dataApreciacao || null,
      });
      toast.success("Apreciação criada — checklist NR-12 snapshotado");
      router.push(`/apreciacao-maquinas/${row.id_apreciacao}`);
    } catch (err) {
      console.error(err);
      toast.error("Falha ao criar apreciação");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/apreciacao-maquinas"
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-verde-primary"
      >
        <ArrowLeft className="size-3.5" /> Voltar
      </Link>

      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
          <Cog className="size-5 text-orange-600" />
          Nova apreciação NR-12
        </h1>
        <p className="text-sm text-gray-600">
          Apreciação de risco em conformidade com o item 12.1.9 da NR-12 e
          normas ABNT NBR 12100, 14009, 14154 e ABNT ISO/TR 14121-2:2018.
          Ao criar, o checklist é gerado automaticamente com{" "}
          <strong>{CATALOGO_NR12.length}</strong> itens por categoria, além
          da análise de riscos HRN (POD × FEP × GPD), prontos para avaliação.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm reveal-up"
      >
        {/* 1 — Empresa */}
        <Campo label="Empresa *" htmlFor="empresa">
          <select
            id="empresa"
            value={idEmpresa}
            onChange={(e) => handleEmpresaChange(e.target.value)}
            required
            className={inputClass}
          >
            <option value="">Selecione...</option>
            {empresas.map((e) => (
              <option key={e.id_empresa} value={e.id_empresa}>
                {e.nome_empresa}{e.cnpj ? ` — ${formatCNPJ(e.cnpj)}` : ""}
              </option>
            ))}
          </select>
          {empresaSelecionada?.cnpj && (
            <p className="mt-1 text-xs text-gray-500">
              CNPJ {formatCNPJ(empresaSelecionada.cnpj)}
            </p>
          )}
        </Campo>

        {/* Banner: máquinas de inspeções ainda não importadas (v66) */}
        {idEmpresa && pendentes.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2.5">
            <p className="text-xs text-blue-800">
              <strong>{pendentes.length}</strong> máquina{pendentes.length > 1 ? "s" : ""} registrada{pendentes.length > 1 ? "s" : ""} em
              inspeções desta empresa ainda não {pendentes.length > 1 ? "estão" : "está"} no inventário.
            </p>
            <button
              type="button"
              onClick={handleImportarPendentes}
              disabled={importar.isPending}
              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {importar.isPending ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Download className="size-3" />
              )}
              Importar agora
            </button>
          </div>
        )}

        {/* 2 — Máquina (empresa → setor → máquina) */}
        <div className="rounded-md border border-gray-200 bg-gray-50 p-3 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-600">
            Máquina avaliada *
          </p>

          {/* 2a — Setor (cascata: só aparece após empresa selecionada com setores no inventário) */}
          {idEmpresa && setoresDisponiveis.length > 0 && (
            <Campo label="Setor" htmlFor="filtro-setor">
              <select
                id="filtro-setor"
                value={filtroSetor}
                onChange={(e) => handleSetorFiltroChange(e.target.value)}
                className={inputClass}
              >
                <option value="">— Todos os setores —</option>
                {setoresDisponiveis.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Campo>
          )}

          {/* 2b — Máquina do inventário */}
          <Campo label="Vincular do inventário" htmlFor="maquina">
            <select
              id="maquina"
              value={idMaquina}
              onChange={(e) => handleMaquinaChange(e.target.value)}
              disabled={!idEmpresa}
              className={inputClass}
            >
              <option value="">
                {idEmpresa
                  ? "— sem vínculo, descrever abaixo —"
                  : "Selecione uma empresa primeiro"}
              </option>
              {maquinasFiltradas.map((m) => (
                <option key={m.id_maquina} value={m.id_maquina}>
                  {m.nome}
                  {m.modelo ? ` (${m.modelo})` : ""}
                  {m.setor && !filtroSetor ? ` · ${m.setor}` : ""}
                  {m.id_empresa === null ? " — JCN Consultoria" : ""}
                </option>
              ))}
            </select>
          </Campo>

          {/* 2c — Descrição manual */}
          <Campo label="Ou descreva a máquina" htmlFor="desc">
            <input
              id="desc"
              type="text"
              value={maquinaDescricao}
              onChange={(e) => setMaquinaDescricao(e.target.value)}
              disabled={!!idMaquina}
              placeholder={
                idMaquina
                  ? "(máquina selecionada acima)"
                  : "Ex: Prensa Hidráulica 50t, marca XYZ, série 12345"
              }
              className={inputClass}
            />
          </Campo>
        </div>

        {/* 3 — Demais dados */}
        <Campo label="Título do laudo" htmlFor="titulo">
          <input
            id="titulo"
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex: Apreciação Prensa Hidráulica setor B - jan/2026"
            className={inputClass}
          />
        </Campo>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo label="Setor" htmlFor="setor">
            <input
              id="setor"
              type="text"
              value={setor}
              onChange={(e) => setSetor(e.target.value)}
              placeholder="Auto-preenchido ao selecionar máquina"
              className={inputClass}
            />
          </Campo>
          <Campo label="Cidade" htmlFor="cidade">
            <input
              id="cidade"
              type="text"
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              className={inputClass}
            />
          </Campo>
          <Campo label="Responsável técnico (JCN Consultoria)" htmlFor="resp">
            <ProfissionalSelect
              value={responsavel}
              onChange={(nome) => setResponsavel(nome)}
            />
          </Campo>
          <Campo label="Responsável da empresa" htmlFor="respe">
            <input
              id="respe"
              type="text"
              value={responsavelEmpresa}
              onChange={(e) => setResponsavelEmpresa(e.target.value)}
              className={inputClass}
            />
          </Campo>
          <Campo label="Data da apreciação" htmlFor="data">
            <input
              id="data"
              type="date"
              value={dataApreciacao}
              onChange={(e) => setDataApreciacao(e.target.value)}
              className={inputClass}
            />
          </Campo>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={criar.isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {criar.isPending && <Loader2 className="size-4 animate-spin" />}
            Criar apreciação
          </button>
        </div>
      </form>
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:bg-gray-50 disabled:text-gray-500";

function Campo({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-600">
        {label}
      </span>
      {children}
    </label>
  );
}
