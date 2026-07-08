"use client";

import { HardHat } from "lucide-react";
import EpiGestao from "@/components/epi/EpiGestao";
import { useUserStore } from "@/lib/store";

export default function EpiCliente() {
  const user = useUserStore((s) => s.user);
  const empresaId = user?.empresas_vinculadas?.[0] ?? null;

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-verde-primary/10 text-verde-primary">
          <HardHat className="size-6" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Gestão de EPI</h1>
          <p className="text-sm text-gray-600">
            Gerencie o catálogo, o estoque e os colaboradores de EPI da sua
            empresa.
          </p>
        </div>
      </div>

      {!empresaId ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Sua conta ainda não está vinculada a uma empresa. Contate o suporte da
          JCN Consultoria.
        </div>
      ) : (
        <EpiGestao empresaId={empresaId} canEdit />
      )}
    </div>
  );
}
