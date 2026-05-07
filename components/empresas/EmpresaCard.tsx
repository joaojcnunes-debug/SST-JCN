"use client";

import Link from "next/link";
import { Building2, Pencil, ClipboardList } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Empresa } from "@/lib/supabase/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatCNPJ } from "@/lib/utils";
import { GRAU_RISCO_CONFIG } from "@/lib/constants";

function useInspCount(idEmpresa: string) {
  return useQuery({
    queryKey: ["empresa-insp-count", idEmpresa],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { count, error } = await supabase
        .from("inspecoes")
        .select("id_inspecao", { count: "exact", head: true })
        .eq("id_empresa", idEmpresa);
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export default function EmpresaCard({
  empresa,
  onEdit,
  canEdit = true,
}: {
  empresa: Empresa;
  onEdit: () => void;
  canEdit?: boolean;
}) {
  const { data: count } = useInspCount(empresa.id_empresa);
  const grau = empresa.grau_risco ?? 1;
  const grauCfg = GRAU_RISCO_CONFIG[grau] ?? GRAU_RISCO_CONFIG[1];

  return (
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-verde-light text-verde-primary">
            <Building2 className="size-5" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-gray-900">
              {empresa.nome_empresa}
            </h3>
            <p className="truncate text-xs text-gray-500">
              {formatCNPJ(empresa.cnpj)}
            </p>
          </div>
        </div>
        <span
          className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
          style={{
            color: grauCfg.cor,
            backgroundColor: grauCfg.bg,
            borderColor: grauCfg.cor + "30",
          }}
        >
          {grauCfg.label}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-600">
        <ClipboardList className="size-3.5 text-gray-400" />
        <span>
          {count ?? "..."} {count === 1 ? "inspeção" : "inspeções"}
        </span>
        {empresa.status === "Inativa" && (
          <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
            Inativa
          </span>
        )}
      </div>

      <div className="mt-4 flex gap-2 border-t border-gray-100 pt-3">
        <Link
          href={`/inspecoes?empresa=${empresa.id_empresa}`}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-verde-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-verde-accent"
        >
          <ClipboardList className="size-3.5" />
          Inspeções
        </Link>
        {canEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="flex items-center justify-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <Pencil className="size-3.5" />
            Editar
          </button>
        )}
      </div>
    </div>
  );
}
