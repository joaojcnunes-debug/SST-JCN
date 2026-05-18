"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Sparkles, Loader2 } from "lucide-react";
import EmpresaSelect from "@/components/empresas/EmpresaSelect";
import { useDrpsCriarRelatorio, useDrpsRelatorios } from "@/lib/hooks/useDrps";
import { useUserStore } from "@/lib/store";
import { useRequireCreate } from "@/lib/hooks/useUsuario";

export default function NovoRelatorioDrpsPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  useRequireCreate("/psicossocial");
  const router = useRouter();
  const params = useSearchParams();
  const user = useUserStore((s) => s.user);
  const criar = useDrpsCriarRelatorio();

  const [idEmpresa, setIdEmpresa] = useState<string | null>(
    params.get("empresa")
  );
  const [dataElaboracao, setDataElaboracao] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [responsavel, setResponsavel] = useState("");
  const [crp, setCrp] = useState("");

  const { data: relatorios = [] } = useDrpsRelatorios(idEmpresa);
  const proximaRevisao =
    Math.max(0, ...relatorios.map((r) => r.revisao ?? 0)) + 1;

  function onCriar() {
    if (!idEmpresa) return;
    criar.mutate(
      {
        id_empresa: idEmpresa,
        data_elaboracao: dataElaboracao || null,
        responsavel_tecnico: responsavel.trim() || null,
        crp: crp.trim() || null,
        usuario_email: user?.email ?? null,
      },
      {
        onSuccess: (idRelatorio) => {
          router.replace(`/psicossocial/${idRelatorio}/dashboard`);
        },
      }
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded p-1 hover:bg-white"
        >
          <ArrowLeft className="size-4" />
        </button>
        <span>Voltar</span>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <Sparkles className="size-6 text-verde-primary" />
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              Novo Relatório DRPS
            </h1>
            <p className="text-sm text-gray-600">
              Diagnóstico de Riscos Psicossociais — NR-01.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Empresa <span className="text-red-alert">*</span>
            </label>
            <EmpresaSelect value={idEmpresa} onChange={setIdEmpresa} modulo="psicossocial" />
          </div>

          {idEmpresa && (
            <div className="rounded-md border border-verde-primary/30 bg-verde-light/50 px-3 py-2 text-sm text-gray-700">
              Este será o relatório{" "}
              <strong>Rev. {proximaRevisao}</strong> da empresa selecionada.
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-gray-700">
                Data da elaboração
              </label>
              <input
                type="date"
                value={dataElaboracao}
                onChange={(e) => setDataElaboracao(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-gray-700">
                Responsável Técnico (Psicólogo)
              </label>
              <input
                type="text"
                value={responsavel}
                onChange={(e) => setResponsavel(e.target.value)}
                placeholder="Ex: Maria da Silva"
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700">CRP</label>
              <input
                type="text"
                value={crp}
                onChange={(e) => setCrp(e.target.value)}
                placeholder="Ex: 06/12345"
                className={inputCls}
              />
            </div>
          </div>

          <p className="text-xs text-gray-500">
            Você pode preencher mais metadados (funções, qtd. trabalhadores,
            agravos, medidas existentes) depois, na aba <strong>Metadados</strong>{" "}
            do relatório.
          </p>

          <div className="flex justify-end gap-2 border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onCriar}
              disabled={!idEmpresa || criar.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-verde-accent disabled:opacity-50"
            >
              {criar.isPending && <Loader2 className="size-4 animate-spin" />}
              Criar Relatório →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30";
