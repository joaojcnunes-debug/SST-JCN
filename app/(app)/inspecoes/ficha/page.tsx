"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardEdit, ArrowRight, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import EmpresaSelect from "@/components/empresas/EmpresaSelect";
import { useInspecoesByEmpresa } from "@/lib/hooks/useInspecao";
import { useUserStore } from "@/lib/store";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { gerarId } from "@/lib/utils";

export default function FichaSelecionarPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const user = useUserStore((s) => s.user);
  const [idEmpresa, setIdEmpresa] = useState<string | null>(null);

  // Carrega inspeções existentes só para calcular a próxima revisão
  // sequencial (mesma logica usada em /inspecoes/nova).
  const { data: inspecoes = [] } = useInspecoesByEmpresa(idEmpresa ?? undefined);

  const proximaRevisao = useMemo(
    () => Math.max(0, ...inspecoes.map((i) => i.revisao ?? 0)) + 1,
    [inspecoes]
  );

  const criar = useMutation({
    mutationFn: async () => {
      if (!idEmpresa) throw new Error("Selecione a empresa");
      const supabase = createSupabaseBrowserClient();
      const novaId = gerarId("INS");
      const row = {
        id_inspecao: novaId,
        id_empresa: idEmpresa,
        data_inspecao: null,
        status: "EM_ANDAMENTO" as const,
        revisao: proximaRevisao,
        responsavel: user?.nome ?? null,
        observacoes: null,
        tipo_criacao: "BRANCO" as const,
        id_inspecao_base: null,
        usuario: user?.email ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("inspecoes").insert(row as never);
      if (error) throw error;
      return novaId;
    },
    onSuccess: (novaId) => {
      qc.invalidateQueries({ queryKey: ["inspecoes", idEmpresa] });
      toast.success(`Inspeção em branco criada (Rev. ${proximaRevisao})`);
      router.push(`/inspecoes/${novaId}/ficha`);
    },
    onError: (e: Error) =>
      toast.error(e.message || "Falha ao criar inspeção em branco"),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
          <ClipboardEdit className="size-5 text-verde-primary" />
          Ficha em Branco
        </h1>
        <p className="text-sm text-gray-600">
          Cria uma <strong>inspeção zerada</strong> para a empresa escolhida,
          vinculada ao seu usuário e com revisão sequencial. Em seguida, abre a
          ficha pronta para o técnico levar a campo e preencher manualmente.
        </p>
      </div>

      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Empresa
          </label>
          <EmpresaSelect value={idEmpresa} onChange={setIdEmpresa} />
        </div>

        {idEmpresa && (
          <div className="rounded-md border border-verde-border bg-verde-light/40 p-3 text-xs text-gray-700">
            <p>
              Próxima revisão para esta empresa:{" "}
              <strong className="text-verde-primary">
                Rev. {proximaRevisao}
              </strong>
            </p>
            {user?.nome && (
              <p className="mt-1">
                Responsável: <strong>{user.nome}</strong>
                {user.email && (
                  <span className="text-gray-500"> ({user.email})</span>
                )}
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end border-t border-gray-100 pt-3">
          <button
            type="button"
            onClick={() => criar.mutate()}
            disabled={!idEmpresa || criar.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-verde-accent disabled:opacity-50"
          >
            {criar.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowRight className="size-4" />
            )}
            {criar.isPending ? "Criando inspeção..." : "Gerar Ficha em Branco"}
          </button>
        </div>
      </div>
    </div>
  );
}
