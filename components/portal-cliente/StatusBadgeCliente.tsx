"use client";

import { cn } from "@/lib/utils";
import type {
  StatusDocumentoPortal,
  StatusPendenciaPortal,
  StatusSolicitacaoPortal,
  PrioridadePortal,
} from "@/lib/supabase/types";

const STATUS_DOC: Record<StatusDocumentoPortal, { label: string; className: string }> = {
  liberado:    { label: "Liberado",   className: "bg-blue-100 text-blue-800" },
  assinado:    { label: "Assinado",   className: "bg-green-100 text-green-800" },
  vencido:     { label: "Vencido",    className: "bg-red-100 text-red-800" },
  substituido: { label: "Substituído", className: "bg-gray-100 text-gray-600" },
};

const STATUS_PEND: Record<StatusPendenciaPortal, { label: string; className: string }> = {
  pendente:   { label: "Pendente",    className: "bg-amber-100 text-amber-800" },
  recebido:   { label: "Recebido",    className: "bg-blue-100 text-blue-800" },
  em_analise: { label: "Em análise",  className: "bg-purple-100 text-purple-800" },
  resolvido:  { label: "Resolvido",   className: "bg-green-100 text-green-800" },
};

const STATUS_SOL: Record<StatusSolicitacaoPortal, { label: string; className: string }> = {
  aberta:       { label: "Aberta",       className: "bg-amber-100 text-amber-800" },
  em_analise:   { label: "Em análise",   className: "bg-blue-100 text-blue-800" },
  em_execucao:  { label: "Em execução",  className: "bg-purple-100 text-purple-800" },
  concluida:    { label: "Concluída",    className: "bg-green-100 text-green-800" },
  cancelada:    { label: "Cancelada",    className: "bg-gray-100 text-gray-600" },
};

const PRIORIDADE: Record<PrioridadePortal, { label: string; className: string }> = {
  baixa: { label: "Baixa", className: "bg-gray-100 text-gray-700" },
  media: { label: "Média", className: "bg-yellow-100 text-yellow-800" },
  alta:  { label: "Alta",  className: "bg-red-100 text-red-700" },
};

export function StatusDocBadge({ status }: { status: StatusDocumentoPortal }) {
  const cfg = STATUS_DOC[status] ?? { label: status, className: "bg-gray-100 text-gray-700" };
  return <Badge {...cfg} />;
}

export function StatusPendBadge({ status }: { status: StatusPendenciaPortal }) {
  const cfg = STATUS_PEND[status] ?? { label: status, className: "bg-gray-100 text-gray-700" };
  return <Badge {...cfg} />;
}

export function StatusSolBadge({ status }: { status: StatusSolicitacaoPortal }) {
  const cfg = STATUS_SOL[status] ?? { label: status, className: "bg-gray-100 text-gray-700" };
  return <Badge {...cfg} />;
}

export function PrioridadeBadge({ prioridade }: { prioridade: PrioridadePortal }) {
  const cfg = PRIORIDADE[prioridade] ?? { label: prioridade, className: "bg-gray-100 text-gray-700" };
  return <Badge {...cfg} />;
}

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        className
      )}
    >
      {label}
    </span>
  );
}
