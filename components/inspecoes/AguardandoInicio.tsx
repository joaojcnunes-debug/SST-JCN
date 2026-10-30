"use client";

// Associado só abre o documento depois de Iniciar (pedido dele, 30/10/2026).
//
// Vale no relatório e na Versão PGR — os dois caminhos do documento (SGG). Quem
// está associado à inspeção e não é supervisor/admin, com o documento ainda
// PENDENTE (atribuído, ninguém começou), vê este aviso no lugar do documento,
// com o botão ▶ Iniciar. Iniciar grava o início pelo mesmo RPC da tela Minhas
// inspeções (set_elaboracao_documento, origem BOTAO) e o documento abre na hora.
// Supervisor/admin e quem não é associado abrem como antes.

import Link from "next/link";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Play } from "lucide-react";
import { useSalvarElaboracao } from "@/lib/hooks/useInspecao";
import { useInspecaoAssociados } from "@/lib/hooks/useInspecaoAssociados";
import { ehSupervisor, useCurrentUser } from "@/lib/hooks/useUsuario";
import { associadoAguardandoInicio } from "@/lib/inspecoes/inicio";

/**
 * O documento desta inspeção está esperando o associado iniciar?
 * `carregando` enquanto a lista de associados não chega — a página espera, para
 * não mostrar o documento por um instante e depois escondê-lo.
 */
export function useAguardandoInicio(
  idInspecao: string,
  elaboracaoStatus: string | null | undefined,
): { carregando: boolean; aguardando: boolean } {
  const user = useCurrentUser();
  const { data: associados, isLoading } = useInspecaoAssociados(idInspecao);
  if (!user || ehSupervisor(user)) return { carregando: false, aguardando: false };
  if (isLoading) return { carregando: true, aguardando: false };
  return { carregando: false, aguardando: associadoAguardandoInicio(user, false, associados ?? [], elaboracaoStatus) };
}

export default function AguardandoInicio({ idInspecao, empresa }: { idInspecao: string; empresa?: string | null }) {
  const user = useCurrentUser();
  const qc = useQueryClient();
  const salvar = useSalvarElaboracao(idInspecao);

  const iniciar = () =>
    salvar.mutate(
      { elaboracao_status: "EM_ELABORACAO", elaboracao_responsavel: user?.nome ?? null },
      {
        onSuccess: () => {
          for (const k of ["inspecoes-atribuidas", "inspecoes-lista", "inspecoes-counts"]) qc.invalidateQueries({ queryKey: [k] });
          toast.success("Elaboração iniciada");
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );

  return (
    <div className="mx-auto mt-8 max-w-lg rounded-xl border border-amber-200 bg-white p-6 text-center shadow-sm">
      <p className="text-base font-semibold text-gray-900">Inicie a elaboração para abrir o documento</p>
      <p className="mt-1 text-sm text-gray-600">
        Você está associado a esta inspeção{empresa ? ` (${empresa})` : ""}, mas o documento ainda não foi iniciado. Ao
        apertar Iniciar, fica registrado que você começou a trabalhar nele.
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          disabled={salvar.isPending || !user?.nome}
          onClick={iniciar}
          className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-50"
        >
          {salvar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} Iniciar
        </button>
        <Link
          href="/inspecoes/minhas"
          className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          <ArrowLeft className="size-4" /> Minhas inspeções
        </Link>
      </div>
    </div>
  );
}
