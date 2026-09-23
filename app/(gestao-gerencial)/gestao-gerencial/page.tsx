"use client";

import Link from "next/link";
import { Building2, CalendarDays, ChevronRight, Lock } from "lucide-react";
import { useUnidades } from "@/lib/hooks/useUnidades";
import { useUserStore } from "@/lib/store";

/**
 * Gestão Gerencial — porta do módulo (01/09).
 *
 * Antes esta rota ABRIA DIRETO na lista de unidades de "Escalas e
 * Substituições". Agora ela separa por card, porque o painel passou a ter DUAS
 * coisas chamadas escala e quem chegava aqui não sabia qual era qual:
 *
 *  - "Escalas e Substituições" — profissionais, escala padrão e ausências POR
 *    UNIDADE (`gg_*`, v122–v126). A lista de unidades mudou para
 *    `/gestao-gerencial/unidades`.
 *  - "Escala de Supervisores" — quem cobre qual unidade em cada dia útil
 *    (`escala_*`, v190). Mora no módulo próprio, em `/escala`.
 *
 * ⚠️ O card da Escala de Supervisores SÓ APARECE para quem tem o módulo. Os
 * dois têm permissão independente: em 01/09, 55 contas tinham a Escala e só 8
 * tinham a Gestão Gerencial. Mostrar o card a quem não tem o módulo daria um
 * clique que quica de volta para /modulos com "sem permissão".
 */
export default function GestaoGerencialPage() {
  const { data: unidades = [], isLoading } = useUnidades();
  const user = useUserStore((s) => s.user);
  const temEscala = (user?.modulos_permitidos ?? []).includes("escala_supervisores");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Gestão Gerencial</h1>
        <p className="mt-1 text-sm text-gray-600">
          Escolha o que você quer gerenciar.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/gestao-gerencial/unidades"
          className="group flex flex-col rounded-lg border border-gray-200 bg-white p-5 transition hover:border-verde-primary hover:shadow-sm"
        >
          <span className="flex size-11 items-center justify-center rounded-lg bg-verde-light text-verde-primary">
            <Building2 className="size-6" />
          </span>
          <p className="mt-3 font-semibold text-gray-900">Escalas e Substituições</p>
          <p className="mt-1 flex-1 text-sm text-gray-600">
            Profissionais, escala padrão, ausências e substituições — organizados por
            unidade.
          </p>
          <p className="mt-3 flex items-center gap-1 text-xs font-medium text-gray-500">
            {isLoading
              ? "Carregando unidades…"
              : unidades.length === 1
                ? "1 unidade"
                : `${unidades.length} unidades`}
            <ChevronRight className="size-3.5 transition group-hover:translate-x-0.5" />
          </p>
        </Link>

        {temEscala ? (
          <Link
            href="/escala"
            className="group flex flex-col rounded-lg border border-gray-200 bg-white p-5 transition hover:border-verde-primary hover:shadow-sm"
          >
            <span className="flex size-11 items-center justify-center rounded-lg bg-cyan-50 text-[#0891B2]">
              <CalendarDays className="size-6" />
            </span>
            <p className="mt-3 font-semibold text-gray-900">Escala de Supervisores</p>
            <p className="mt-1 flex-1 text-sm text-gray-600">
              Quem cobre qual unidade em cada dia útil: configuração, padrão semanal,
              grade mensal e feriados.
            </p>
            <p className="mt-3 flex items-center gap-1 text-xs font-medium text-gray-500">
              Abrir módulo
              <ChevronRight className="size-3.5 transition group-hover:translate-x-0.5" />
            </p>
          </Link>
        ) : (
          <div className="flex flex-col rounded-lg border border-dashed border-gray-300 bg-gray-50 p-5">
            <span className="flex size-11 items-center justify-center rounded-lg bg-gray-100 text-gray-400">
              <Lock className="size-6" />
            </span>
            <p className="mt-3 font-semibold text-gray-500">Escala de Supervisores</p>
            <p className="mt-1 flex-1 text-sm text-gray-500">
              Você não tem esse módulo liberado. Peça ao admin do sistema.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
