"use client";

import Link from "next/link";
import { Building2, Pencil, ClipboardList, Trash2, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Empresa } from "@/lib/supabase/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatCNPJ, cn } from "@/lib/utils";

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

function getInitials(nome: string): string {
  const words = nome.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "??";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export default function EmpresaCard({
  empresa,
  onEdit,
  onDelete,
  canEdit = true,
}: {
  empresa: Empresa;
  onEdit: () => void;
  onDelete?: (e: Empresa) => void;
  canEdit?: boolean;
}) {
  const { data: count } = useInspCount(empresa.id_empresa);
  const inativa = empresa.status === "Inativa";
  const initials = getInitials(empresa.nome_empresa);

  return (
    <div
      className={cn(
        "group flex flex-col rounded-2xl border bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
        inativa ? "border-gray-200 opacity-75" : "border-gray-100"
      )}
    >
      {/* ── Cabeçalho ─────────────────────────────── */}
      <div className="flex items-start gap-3 p-4">
        {/* Avatar com iniciais */}
        <div
          className="flex size-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm"
          style={{
            background: inativa
              ? "#9ca3af"
              : "linear-gradient(135deg, #006B54 0%, #00835A 100%)",
          }}
        >
          {initials}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 text-sm font-bold leading-tight text-gray-900">
              {empresa.nome_empresa}
            </h3>
            {inativa && (
              <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
                Inativa
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-gray-400 font-mono">
            {formatCNPJ(empresa.cnpj) || "CNPJ não informado"}
          </p>
        </div>
      </div>

      {/* ── Contadores ────────────────────────────── */}
      <div className="mx-4 flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600">
        <ClipboardList className="size-3.5 shrink-0 text-verde-primary" />
        <span>
          <span className="font-semibold text-gray-800">{count ?? "—"}</span>
          {" "}
          {count === 1 ? "inspeção" : "inspeções"}
        </span>
        {!inativa && (
          <span className="ml-auto flex items-center gap-1 text-verde-primary">
            <span className="size-1.5 rounded-full bg-verde-accent" />
            Ativa
          </span>
        )}
      </div>

      {/* ── Ações ─────────────────────────────────── */}
      <div className="mt-3 flex gap-2 border-t border-gray-100 px-4 pb-4 pt-3">
        <Link
          href={`/inspecoes?empresa=${empresa.id_empresa}`}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-verde-primary px-3 py-2 text-xs font-semibold text-white transition hover:bg-verde-accent active:scale-95"
        >
          <ClipboardList className="size-3.5" />
          Inspeções
          <ArrowRight className="ml-auto size-3 opacity-60 transition-transform group-hover:translate-x-0.5" />
        </Link>
        {canEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 transition hover:border-gray-300 hover:bg-gray-50 active:scale-95"
            title="Editar empresa"
          >
            <Pencil className="size-3.5" />
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(empresa)}
            className="flex items-center justify-center rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 active:scale-95"
            title="Excluir empresa"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
