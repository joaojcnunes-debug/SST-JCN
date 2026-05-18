"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, AlertTriangle, ListChecks } from "lucide-react";
import toast from "react-hot-toast";
import EmpresaSelect from "@/components/empresas/EmpresaSelect";
import { useCriarRelatorioNaoConformidade } from "@/lib/hooks/useRelatoriosNaoConformidade";
import { listarNRs, getChecklistNR } from "@/lib/conformidade/checklists";
import { useRequireCreate } from "@/lib/hooks/useUsuario";

export default function NovoNaoConformidadePage() {
  useRequireCreate("/relatorio-nao-conformidade");
  const router = useRouter();
  const [titulo, setTitulo] = useState("");
  const [nrCodigo, setNrCodigo] = useState<string>("");
  const [idEmpresa, setIdEmpresa] = useState<string | null>(null);
  const [setor, setSetor] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [responsavelEmpresa, setResponsavelEmpresa] = useState("");
  const [cidade, setCidade] = useState("");
  const [dataInspecao, setDataInspecao] = useState(() => {
    const hoje = new Date();
    return hoje.toISOString().slice(0, 10);
  });

  const nrs = useMemo(() => listarNRs(), []);
  const checklistPreview = useMemo(
    () => (nrCodigo ? getChecklistNR(nrCodigo) : null),
    [nrCodigo]
  );

  const criar = useCriarRelatorioNaoConformidade();

  function handleCriar() {
    if (!titulo.trim()) {
      toast.error("Informe um título pro relatório");
      return;
    }
    if (!idEmpresa) {
      toast.error("Selecione a empresa");
      return;
    }
    criar.mutate(
      {
        id_empresa: idEmpresa,
        titulo: titulo.trim(),
        nr_codigo: nrCodigo || null,
        setor: setor.trim() || null,
        responsavel: responsavel.trim() || null,
        responsavel_empresa: responsavelEmpresa.trim() || null,
        cidade: cidade.trim() || null,
        data_inspecao: dataInspecao || null,
      },
      {
        onSuccess: (r) => {
          toast.success("Relatório criado");
          router.push(`/relatorio-nao-conformidade/${r.id_relatorio}`);
        },
        onError: (e: Error) =>
          toast.error(e.message || "Falha ao criar relatório"),
      }
    );
  }

  const lblCls =
    "text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1 block";
  const inputCls =
    "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500";

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link
          href="/relatorio-nao-conformidade"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-verde-primary"
        >
          <ArrowLeft className="size-3.5" /> Voltar
        </Link>
      </div>

      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
          <AlertTriangle className="size-5 text-red-600" />
          Novo Relatório de Não Conformidade
        </h1>
        <p className="text-sm text-gray-600">
          Cabeçalho do relatório. As NCs encontradas em campo serão adicionadas
          na próxima tela.
        </p>
      </div>

      <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div>
          <label className={lblCls}>Título do relatório *</label>
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex: Auditoria pré-NR-12 — janeiro/2026"
            className={inputCls}
            disabled={criar.isPending}
          />
        </div>

        <div>
          <label className={lblCls}>
            NR vinculada{" "}
            <span className="font-normal normal-case text-gray-400">
              (opcional — libera quick-pick de itens do checklist)
            </span>
          </label>
          <select
            value={nrCodigo}
            onChange={(e) => setNrCodigo(e.target.value)}
            className={inputCls}
            disabled={criar.isPending}
          >
            <option value="">— Sem NR vinculada (NCs 100% livres) —</option>
            {nrs.map((nr) => (
              <option key={nr.codigo} value={nr.codigo}>
                {nr.codigo} — {nr.titulo}
              </option>
            ))}
          </select>
          {checklistPreview && (
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-red-700">
              <ListChecks className="size-3" />
              {checklistPreview.itens.length} itens disponíveis pra inserção
              rápida no detalhe.
            </p>
          )}
        </div>

        <div>
          <label className={lblCls}>Empresa *</label>
          <EmpresaSelect
            value={idEmpresa}
            onChange={setIdEmpresa}
            placeholder="Selecione a empresa auditada..."
            disabled={criar.isPending}
            modulo="nao_conformidade"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={lblCls}>Setor / Local auditado</label>
            <input
              type="text"
              value={setor}
              onChange={(e) => setSetor(e.target.value)}
              placeholder="Ex: Produção, Refeitório, Almoxarifado..."
              className={inputCls}
              disabled={criar.isPending}
            />
          </div>
          <div>
            <label className={lblCls}>Responsável técnico (Chabra)</label>
            <input
              type="text"
              value={responsavel}
              onChange={(e) => setResponsavel(e.target.value)}
              placeholder="Quem assina pela Chabra"
              className={inputCls}
              disabled={criar.isPending}
            />
          </div>
          <div>
            <label className={lblCls}>Responsável da empresa</label>
            <input
              type="text"
              value={responsavelEmpresa}
              onChange={(e) => setResponsavelEmpresa(e.target.value)}
              placeholder="Quem acompanhou a auditoria"
              className={inputCls}
              disabled={criar.isPending}
            />
          </div>
          <div>
            <label className={lblCls}>Cidade</label>
            <input
              type="text"
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              placeholder="Ex: Catanduva - SP"
              className={inputCls}
              disabled={criar.isPending}
            />
          </div>
        </div>

        <div>
          <label className={lblCls}>Data da inspeção</label>
          <input
            type="date"
            value={dataInspecao}
            onChange={(e) => setDataInspecao(e.target.value)}
            className={inputCls}
            disabled={criar.isPending}
          />
        </div>

        <div className="flex justify-end border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={handleCriar}
            disabled={criar.isPending || !titulo.trim() || !idEmpresa}
            className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
          >
            {criar.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Criando...
              </>
            ) : (
              <>Criar Relatório</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
