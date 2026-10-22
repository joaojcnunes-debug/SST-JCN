"use client";

import Link from "next/link";
import { Pencil, ClipboardList, Trash2, ArrowRight, MapPin, FolderOpen } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Empresa } from "@/lib/supabase/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatCNPJ, cn } from "@/lib/utils";
import { fantasiaDistinto } from "@/lib/busca/empresas";
import SeloGrupo from "@/components/empresas/SeloGrupo";
import type { InfoGrupoDaEmpresa } from "@/lib/hooks/useGruposEmpresas";

function useInspCount(idEmpresa: string) {
  return useQuery({
    queryKey: ["empresa-insp-count", idEmpresa],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { count, error } = await supabase
        .from("inspecoes")
        .select("id_inspecao", { count: "exact", head: true })
        .eq("id_empresa", idEmpresa)
        .neq("status", "DELETADA");
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
  grupo,
  contratanteNome,
}: {
  empresa: Empresa;
  /** Grupo da empresa (v278), se tiver. */
  grupo?: InfoGrupoDaEmpresa;
  /**
   * Nome da contratante (só TERCEIROS). Vem da página, de um Map montado uma vez:
   * até a v0.3.732 cada card chamava useEmpresas() e fazia `find` nas 6.465
   * empresas (EMPRESAS-PERF-01).
   */
  contratanteNome?: string | null;
  onEdit: () => void;
  onDelete?: (e: Empresa) => void;
  canEdit?: boolean;
}) {
  // Uma contagem por card MONTADO: a página monta em janela (useListaProgressiva),
  // então isto não roda para as empresas fora da vista.
  const { data: count } = useInspCount(empresa.id_empresa);
  const inativa = empresa.status === "Inativa";
  const initials = getInitials(empresa.nome_empresa);
  const ehTerceiros = empresa.tipo_estabelecimento === "TERCEIROS";

  return (
    <div
      className={cn(
        "group relative flex flex-col rounded-2xl border bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
        // Foco do teclado no link do nome contorna o card inteiro.
        "has-[[data-card-link]:focus-visible]:outline-2 has-[[data-card-link]:focus-visible]:outline-offset-2 has-[[data-card-link]:focus-visible]:outline-emerald-500",
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
              : "linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)",
          }}
        >
          {initials}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            {/* 08/10: o card inteiro abre a ficha (Visão geral). O link é o
                nome; o ::before estica a área de clique sobre o card, e os
                outros links/botões ficam por cima com `relative z-10`. */}
            <h3 className="line-clamp-2 text-sm font-bold leading-tight text-gray-900">
              <Link
                href={`/empresas/${empresa.id_empresa}`}
                data-card-link
                title="Abrir a ficha da empresa"
                className="before:absolute before:inset-0 before:rounded-2xl before:content-[''] focus-visible:outline-none group-hover:text-verde-primary"
              >
                {empresa.nome_empresa}
              </Link>
            </h3>
            {/* Bate o olho e vê que este cadastro não é um cliente, e sim um
                local de terceiros — senão ele se confunde com os outros 474. */}
            {ehTerceiros && (
              <span
                title={
                  contratanteNome
                    ? `Estabelecimento de terceiros de ${contratanteNome}`
                    : "Estabelecimento de terceiros"
                }
                className="relative z-10 inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800"
              >
                <MapPin className="size-2.5" /> Terceiros
              </span>
            )}
            {inativa && (
              <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
                Inativa
              </span>
            )}
          </div>
          {fantasiaDistinto(empresa) && (
            <p className="mt-0.5 truncate text-xs text-gray-600" title="Nome fantasia">
              {fantasiaDistinto(empresa)}
            </p>
          )}
          <p className="mt-0.5 text-xs text-gray-400 font-mono">
            {formatCNPJ(empresa.cnpj) || "CNPJ não informado"}
          </p>
          {grupo && (
            <Link href={`/empresas/grupos?grupo=${grupo.id_grupo}`} className="relative z-10 mt-1.5 block w-fit max-w-full">
              <SeloGrupo info={grupo} />
            </Link>
          )}
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
        {/* 08/10: o botão Inspeções deu lugar a Documentos, que abre a ficha
            já na aba Documentos & Laudos (as inspeções estão lá também). */}
        <Link
          title="Todos os documentos desta empresa"
          href={`/empresas/${empresa.id_empresa}?aba=documentos`}
          className="relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-verde-primary px-3 py-2 text-xs font-semibold text-white transition hover:bg-verde-accent active:scale-95"
        >
          <FolderOpen className="size-3.5" />
          Documentos
          <ArrowRight className="ml-auto size-3 opacity-60 transition-transform group-hover:translate-x-0.5" />
        </Link>
        {canEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="relative z-10 flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 transition hover:border-gray-300 hover:bg-gray-50 active:scale-95"
            title="Editar empresa"
          >
            <Pencil className="size-3.5" />
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(empresa)}
            className="relative z-10 flex items-center justify-center rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 active:scale-95"
            title="Excluir empresa"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
