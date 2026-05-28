"use client";

import { useMemo, useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";
import EmpresaSelect from "@/components/empresas/EmpresaSelect";
import ProfissionalSelect from "@/components/ui/ProfissionalSelect";
import { listarNRs, getChecklistNR } from "@/lib/conformidade/checklists";
import { useCriarRelatorioConformidade } from "@/lib/hooks/useRelatoriosConformidade";
import { useRequireCreate } from "@/lib/hooks/useUsuario";

function NovoConformidadeInner() {
  useRequireCreate("/relatorio-conformidade");
  const router = useRouter();
  const searchParams = useSearchParams();
  const nrPreselecionada = searchParams.get("nr");

  const nrs = useMemo(() => listarNRs(), []);
  const [nrCodigo, setNrCodigo] = useState<string>(
    nrPreselecionada ?? ""
  );
  const [idEmpresa, setIdEmpresa] = useState<string | null>(null);
  const [setor, setSetor] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [responsavelEmpresa, setResponsavelEmpresa] = useState("");
  const [cidade, setCidade] = useState("");
  const [dataInspecao, setDataInspecao] = useState(() => {
    const hoje = new Date();
    return hoje.toISOString().slice(0, 10);
  });

  useEffect(() => {
    if (nrPreselecionada && nrPreselecionada !== nrCodigo) {
      setNrCodigo(nrPreselecionada);
    }
  }, [nrPreselecionada, nrCodigo]);

  const checklist = useMemo(
    () => (nrCodigo ? getChecklistNR(nrCodigo) : null),
    [nrCodigo]
  );

  const criar = useCriarRelatorioConformidade();

  function handleCriar() {
    if (!nrCodigo) {
      toast.error("Selecione uma NR");
      return;
    }
    if (!idEmpresa) {
      toast.error("Selecione a empresa");
      return;
    }
    criar.mutate(
      {
        id_empresa: idEmpresa,
        nr_codigo: nrCodigo,
        setor: setor.trim() || null,
        responsavel: responsavel.trim() || null,
        responsavel_empresa: responsavelEmpresa.trim() || null,
        cidade: cidade.trim() || null,
        data_inspecao: dataInspecao || null,
      },
      {
        onSuccess: (r) => {
          toast.success(`Relatório ${r.nr_codigo} criado`);
          router.push(`/relatorio-conformidade/${r.id_relatorio}`);
        },
        onError: (e: Error) =>
          toast.error(e.message || "Falha ao criar relatório"),
      }
    );
  }

  const lblCls =
    "text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1 block";
  const inputCls =
    "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary";

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link
          href="/relatorio-conformidade"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-verde-primary"
        >
          <ArrowLeft className="size-3.5" /> Voltar
        </Link>
      </div>

      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
          <ShieldCheck className="size-5 text-teal-600" />
          Novo Relatório de Conformidade
        </h1>
        <p className="text-sm text-gray-600">
          Escolha a NR e a empresa. O checklist será criado automaticamente com
          base no catálogo Chabra.
        </p>
      </div>

      <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div>
          <label className={lblCls}>Norma Regulamentadora *</label>
          <select
            value={nrCodigo}
            onChange={(e) => setNrCodigo(e.target.value)}
            className={inputCls}
            disabled={criar.isPending}
          >
            <option value="">— Selecione a NR —</option>
            {nrs.map((nr) => (
              <option key={nr.codigo} value={nr.codigo}>
                {nr.codigo} — {nr.titulo}
              </option>
            ))}
          </select>
          {checklist && (
            <p className="mt-1 text-xs text-teal-700">
              <ShieldCheck className="mr-1 inline size-3" />
              Checklist com {checklist.itens.length} itens será criado.
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
            modulo="conformidade"
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
            <ProfissionalSelect
              value={responsavel}
              onChange={(nome) => setResponsavel(nome)}
              className={criar.isPending ? "pointer-events-none opacity-60" : ""}
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

        {/* Preview do checklist */}
        {checklist && (
          <div className="rounded-md border border-teal-200 bg-teal-50/30 p-3">
            <p className="text-xs font-bold uppercase tracking-wider text-teal-700">
              Pré-visualização ({checklist.itens.length} itens)
            </p>
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-gray-700">
              {checklist.itens.slice(0, 8).map((it) => (
                <li key={it.codigo}>
                  <span className="font-mono text-teal-700">{it.codigo}</span>{" "}
                  · {it.titulo}
                </li>
              ))}
              {checklist.itens.length > 8 && (
                <li className="italic text-gray-500">
                  ... e mais {checklist.itens.length - 8} itens
                </li>
              )}
            </ul>
          </div>
        )}

        <div className="flex justify-end border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={handleCriar}
            disabled={criar.isPending || !nrCodigo || !idEmpresa}
            className="inline-flex items-center gap-2 rounded-md bg-verde-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-verde-accent disabled:opacity-50"
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

export default function NovoConformidadePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20 text-gray-500">
          <Loader2 className="size-5 animate-spin" />
        </div>
      }
    >
      <NovoConformidadeInner />
    </Suspense>
  );
}
