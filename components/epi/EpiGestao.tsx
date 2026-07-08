"use client";

import { useState } from "react";
import { HardHat, Boxes, Users } from "lucide-react";
import EpiCatalogoTab from "./EpiCatalogoTab";
import EpiEstoqueTab from "./EpiEstoqueTab";
import EpiColaboradoresTab from "./EpiColaboradoresTab";

type Aba = "catalogo" | "estoque" | "colaboradores";

const ABAS = [
  { id: "catalogo", label: "Catálogo", icon: HardHat },
  { id: "estoque", label: "Estoque", icon: Boxes },
  { id: "colaboradores", label: "Colaboradores", icon: Users },
] as const;

/**
 * Gerenciamento de EPI de UMA empresa — reutilizado pela equipe interna (com
 * seletor de empresa) e pelo Portal do Cliente (empresa implícita). A RLS já
 * garante o isolamento: o `empresaId` aqui é só o escopo de leitura/escrita.
 */
export default function EpiGestao({
  empresaId,
  canEdit,
}: {
  empresaId: string | null;
  canEdit: boolean;
}) {
  const [aba, setAba] = useState<Aba>("catalogo");

  if (!empresaId) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Selecione uma empresa para gerenciar o EPI.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="inline-flex flex-wrap rounded-lg border border-gray-200 bg-white p-0.5 text-sm font-medium">
        {ABAS.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => setAba(a.id)}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 ${
                aba === a.id
                  ? "bg-verde-primary text-white"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              <Icon className="size-4" /> {a.label}
            </button>
          );
        })}
      </div>

      {aba === "catalogo" && (
        <EpiCatalogoTab empresaId={empresaId} canEdit={canEdit} />
      )}
      {aba === "estoque" && (
        <EpiEstoqueTab empresaId={empresaId} canEdit={canEdit} />
      )}
      {aba === "colaboradores" && (
        <EpiColaboradoresTab empresaId={empresaId} canEdit={canEdit} />
      )}
    </div>
  );
}
