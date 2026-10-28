"use client";

import Link from "next/link";
import { Pencil, ChartBar, Trash2, RefreshCw } from "lucide-react";
import StatusBadge from "./StatusBadge";
import SeloPrioridade from "./SeloPrioridade";
import { fmtData } from "@/lib/utils";
import { iniciais, corAvatar } from "@/lib/hooks/useGestao";
import { situacaoDocumento, type ChaveDocumento } from "@/lib/inspecoes/documento";
import { ehRenovacao } from "@/lib/dashboard/inspecoes";
import type { Inspecao, InspecaoAssociado } from "@/lib/supabase/types";

/** Pílula da coluna "Status Assoc." — uma por situação do documento. */
const PILULA_DOC: Record<ChaveDocumento, { label: string; classe: string }> = {
  ENTREGUE: { label: "Concluído", classe: "bg-emerald-100 text-emerald-800" },
  EM_ELABORACAO: { label: "Em elaboração", classe: "bg-sky-100 text-sky-800" },
  NINGUEM: { label: "Pendente", classe: "bg-gray-100 text-gray-500" },
};

/** Os nomes de campo são outros que não só quem lançou? */
function campoDiferente(insp: Inspecao): boolean {
  const campo = (insp.tecnicos_campo ?? "").trim();
  if (!campo) return false;
  const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  return norm(campo) !== norm(insp.responsavel ?? "");
}

export default function InspecaoRow({
  insp,
  associados = [],
  onDelete,
  onEditResponsavel,
  onEditarPrioridade,
  showEmpresa,
}: {
  insp: Inspecao;
  /** Associados à elaboração do Documento SGG desta inspeção. */
  associados?: InspecaoAssociado[];
  onDelete?: (insp: Inspecao) => void;
  /** Quando fornecido (apenas Admin), mostra o lápis para editar o responsável. */
  onEditResponsavel?: (insp: Inspecao) => void;
  /** v306: supervisor define prioridade e prazo. */
  onEditarPrioridade?: (insp: Inspecao) => void;
  showEmpresa?: boolean;
}) {
  return (
    <tr className="border-b border-gray-50 transition-colors hover:bg-verde-light/25 last:border-b-0">
      <td className="px-4 py-3 font-mono text-xs text-gray-400">
        {insp.id_inspecao}
      </td>
      {showEmpresa && (
        <td className="px-4 py-3 font-medium text-gray-800">
          {insp.empresas?.nome_empresa ?? "—"}
        </td>
      )}
      <td className="px-4 py-3 text-center">
        <span className="inline-flex size-6 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600">
          {insp.revisao}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">
        {fmtData(insp.data_inspecao)}
        {/* Concluída entra no período pela data da conclusão (07/10) — sem
            mostrar essa data, a linha parecia estar no mês errado. */}
        {insp.status === "CONCLUIDA" && insp.concluida_em && (
          <span className="block text-[11px] text-gray-400">
            concluída {new Date(insp.concluida_em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-gray-700">
        <span className="inline-flex items-center gap-1.5">
          <span>
            {insp.responsavel ?? "—"}
            {/* Quem foi a campo, quando não é quem lançou (07/10): é por ele que
                o filtro Técnico acha a inspeção. */}
            {campoDiferente(insp) && (
              <span className="block text-[11px] text-gray-400">campo: {insp.tecnicos_campo}</span>
            )}
          </span>
          {onEditResponsavel && (
            <button
              type="button"
              onClick={() => onEditResponsavel(insp)}
              className="flex size-6 items-center justify-center rounded-md text-gray-300 transition hover:bg-verde-light hover:text-verde-primary"
              title="Editar responsável (Admin)"
            >
              <Pencil className="size-3" />
            </button>
          )}
        </span>
      </td>
      {/* Status antes de Associados (pedido dele, 22/09): a pílula fica mais
          perto do responsável e os avatares encostam nas Ações. O cabeçalho da
          lista (app/(app)/inspecoes/page.tsx) segue esta mesma ordem. */}
      <td className="px-4 py-3">
        <span className="inline-flex flex-wrap items-center gap-1">
          <StatusBadge status={insp.status} />
          {/* Renovação de documento (23/09): está na lista, mas não conta nos
              gráficos de inspeção — o selo avisa de onde vem a diferença. */}
          {ehRenovacao(insp.tipo_criacao) && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-800"
              title="Registro de documento — não conta nos gráficos de inspeção"
            >
              <RefreshCw className="size-3" /> Renovação
            </span>
          )}
        </span>
      </td>
      {/* v306: prioridade efetiva, espera e prazo (o porquê no balão). */}
      <td className="px-4 py-3">
        <SeloPrioridade insp={insp} onEditar={onEditarPrioridade} />
      </td>
      {(() => {
          // Une os associados (tabela nova) com quem assumiu a elaboração pelo fluxo
          // de status (elaboracao_responsavel) — assim inspeções antigas também mostram.
          const pessoas: { key: string; nome: string }[] = associados.map((a) => ({ key: a.id, nome: a.nome }));
          const nomes = new Set(pessoas.map((p) => p.nome.trim().toLowerCase()));
          const resp = insp.elaboracao_responsavel?.trim();
          if (resp && !nomes.has(resp.toLowerCase())) {
            pessoas.push({ key: `resp-${insp.id_inspecao}`, nome: resp });
          }
          // Situação do documento — a frase mora em lib/inspecoes/documento, a
          // mesma que o card "Documento (SGG)" da tela do relatório usa.
          // Inspeção ainda em campo não tem documento: o rótulo some.
          const doc = situacaoDocumento(insp, pessoas.map((p) => p.nome), "curto");
          return (
            <>
            <td className="px-4 py-3">
            {pessoas.length === 0 ? (
              <span className="text-xs text-gray-300">—</span>
            ) : (
            <div className="flex items-center -space-x-1.5">
              {pessoas.slice(0, 4).map((p) => (
                <span
                  key={p.key}
                  title={p.nome}
                  className="flex size-6 items-center justify-center rounded-full border-2 border-white text-[9px] font-bold text-white"
                  style={{ backgroundColor: corAvatar(p.nome) }}
                >
                  {iniciais(p.nome)}
                </span>
              ))}
              {pessoas.length > 4 && (
                <span
                  title={pessoas.slice(4).map((p) => p.nome).join(", ")}
                  className="flex size-6 items-center justify-center rounded-full border-2 border-white bg-gray-200 text-[9px] font-bold text-gray-600"
                >
                  +{pessoas.length - 4}
                </span>
              )}
            </div>
            )}
            </td>
            {/* Status dos associados em coluna própria (pedido dele, 21/10): antes
                era a letrinha embaixo dos avatares. Entregue = Concluído. */}
            <td className="px-4 py-3">
              {!doc ? (
                <span className="text-xs text-gray-300">—</span>
              ) : (
                <span className="inline-flex flex-col items-start gap-0.5">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${PILULA_DOC[doc.chave].classe}`}
                  >
                    {PILULA_DOC[doc.chave].label}
                  </span>
                  {doc.chave === "ENTREGUE" && insp.elaboracao_concluida_em && (
                    <span className="text-[11px] text-gray-400">em {fmtData(insp.elaboracao_concluida_em)}</span>
                  )}
                  {doc.chave === "EM_ELABORACAO" && (
                    <span className="text-[11px] text-gray-400">{doc.texto.replace(/^Em elaboração( · )?/, "")}</span>
                  )}
                </span>
              )}
            </td>
            </>
          );
        })()}
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <Link
            href={`/inspecoes/${insp.id_inspecao}`}
            className="flex size-7 items-center justify-center rounded-lg text-gray-400 transition hover:bg-verde-light hover:text-verde-primary"
            title="Editar inspeção"
          >
            <Pencil className="size-3.5" />
          </Link>
          <Link
            href={`/inspecoes/${insp.id_inspecao}/relatorio`}
            className="flex size-7 items-center justify-center rounded-lg text-gray-400 transition hover:bg-sky-50 hover:text-sky-600"
            title="Ver relatório"
          >
            <ChartBar className="size-3.5" />
          </Link>
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(insp)}
              className="flex size-7 items-center justify-center rounded-lg text-gray-400 transition hover:bg-red-50 hover:text-red-500"
              title="Excluir inspeção"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
