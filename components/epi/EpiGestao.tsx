"use client";

import { useMemo, useState } from "react";
import { HardHat, Boxes, FileText, ClipboardCheck, Users } from "lucide-react";
import EpiCatalogoTab from "./EpiCatalogoTab";
import EpiEstoqueTab from "./EpiEstoqueTab";
import EpiColaboradoresTab from "./EpiColaboradoresTab";
import EpiNfeTab from "./EpiNfeTab";
import EpiEntregasTab from "./EpiEntregasTab";

type Aba = "catalogo" | "estoque" | "nfe" | "entregas" | "colaboradores";

const ABAS = [
  { id: "catalogo", label: "Catálogo", icon: HardHat, soEdicao: false },
  { id: "estoque", label: "Estoque", icon: Boxes, soEdicao: false },
  { id: "nfe", label: "NF-e", icon: FileText, soEdicao: true },
  { id: "entregas", label: "Entregas", icon: ClipboardCheck, soEdicao: false },
  { id: "colaboradores", label: "Colaboradores", icon: Users, soEdicao: false },
] as const;

/**
 * Gerenciamento de EPI de UMA empresa — reutilizado pela equipe interna (com
 * seletor de empresa) e pelo Portal do Cliente (empresa implícita). A RLS já
 * garante o isolamento: o `empresaId` aqui é só o escopo de leitura/escrita.
 */
export default function EpiGestao({
  empresaId,
  canEdit,
  contexto = "interno",
}: {
  empresaId: string | null;
  canEdit: boolean;
  /** "interno" = equipe JCN (habilita selagem PAdES A1); "cliente" = Portal. */
  contexto?: "interno" | "cliente";
}) {
  const [aba, setAba] = useState<Aba>("catalogo");

  const abasVisiveis = useMemo(
    () => ABAS.filter((a) => canEdit || !a.soEdicao),
    [canEdit]
  );

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
        {abasVisiveis.map((a) => {
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
      {aba === "nfe" && canEdit && (
        <EpiNfeTab empresaId={empresaId} canEdit={canEdit} />
      )}
      {aba === "entregas" && (
        <EpiEntregasTab
          empresaId={empresaId}
          canEdit={canEdit}
          podeSelar={contexto === "interno"}
        />
      )}
      {aba === "colaboradores" && (
        <EpiColaboradoresTab empresaId={empresaId} canEdit={canEdit} />
      )}
    </div>
  );
}
