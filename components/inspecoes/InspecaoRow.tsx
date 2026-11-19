"use client";

import Link from "next/link";
import { comVolta } from "@/lib/inspecoes/volta";
import { Pencil, ChartBar, Trash2, RefreshCw } from "lucide-react";
import { ResponsavelCelula, AssociadosCelula } from "./PessoasDaInspecao";
import StatusBadge from "./StatusBadge";
import { fmtData } from "@/lib/utils";
import { PrioridadeCelula } from "./PrioridadeInspecao";
import PrioridadeCalculada from "./PrioridadeCalculada";
import ComplexidadeCelula from "./ComplexidadeCelula";
import { situacaoDocumento, type ChaveDocumento } from "@/lib/inspecoes/documento";
import { ehRenovacao } from "@/lib/dashboard/inspecoes";
import type { Inspecao, InspecaoAssociado } from "@/lib/supabase/types";

/** Pílula da coluna "Status Assoc." — uma por situação do documento. */
const PILULA_DOC: Record<ChaveDocumento, { label: string; classe: string }> = {
  ENTREGUE: { label: "Concluído", classe: "bg-emerald-100 text-emerald-800" },
  EM_ELABORACAO: { label: "Em elaboração", classe: "bg-sky-100 text-sky-800" },
  // 28/10 (v309): tem associado, mas ninguém começou o documento.
  ATRIBUIDO: { label: "Atribuído", classe: "bg-amber-50 text-amber-800" },
  NINGUEM: { label: "Pendente", classe: "bg-gray-100 text-gray-500" },
};

/** Coluna Ações fixa à direita — o cabeçalho (app/(app)/inspecoes/page.tsx) usa a mesma, com o fundo dele. */
export const ACOES_FIXAS = "sticky right-0 z-[1] px-3 py-3 shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.15)]";
/** Fundo opaco da célula; no hover, o verde da linha (marca-light 25%) por cima do branco. */
const FUNDO_ACOES =
  "bg-white group-hover:bg-[linear-gradient(rgb(232_245_233/0.25),rgb(232_245_233/0.25))] dark:group-hover:bg-none";

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
  podeEditarPessoas = false,
  showEmpresa,
  podeEditarPrioridade,
  comAcoes = true,
  comEditar = true,
  volta,
}: {
  insp: Inspecao;
  /** Endereço da lista (com os filtros): o documento aberto daqui oferece voltar para ele. */
  volta?: string;
  /** 30/10: coluna Ações (Editar, Relatório, Excluir) — supervisor/admin, Técnico (10/11) e quem tem a marca da v332; o cabeçalho segue a mesma regra. */
  comAcoes?: boolean;
  /** v332: quem tem só a marca (e o Técnico, 10/11) vê a coluna com o Ver relatório, sem o Editar. */
  comEditar?: boolean;
  /** v308: quem edita inspeção troca a prioridade direto na coluna. */
  podeEditarPrioridade?: boolean;
  /** Associados à elaboração do Documento SGG desta inspeção. */
  associados?: InspecaoAssociado[];
  onDelete?: (insp: Inspecao) => void;
  /** Supervisor: troca o responsável e associa/tira quem elabora direto nos círculos (0.3.304; antes, lápis + janela). */
  podeEditarPessoas?: boolean;
  showEmpresa?: boolean;
}) {
  return (
    <tr className="group border-b border-gray-50 transition-colors hover:bg-marca-light/25 last:border-b-0">
      <td className="px-3 py-3 font-mono text-xs text-gray-400">
        {insp.id_inspecao}
      </td>
      {showEmpresa && (
        <td className="px-3 py-3 font-medium text-gray-800">
          {insp.empresas?.nome_empresa ?? "—"}
        </td>
      )}
      <td className="px-3 py-3 text-center">
        <span className="inline-flex size-6 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600">
          {insp.revisao}
        </span>
      </td>
      {/* v308: a prioridade se edita AQUI; dentro da inspeção ela só aparece. */}
      <td className="px-3 py-3">
        <PrioridadeCelula id={insp.id_inspecao} valor={insp.prioridade} podeEditar={!!podeEditarPrioridade} />
        {/* 28/10: a calculada (quando passa a marcada), a espera e o prazo — mesma regra de quem edita. */}
        <PrioridadeCalculada insp={insp} podeEditarPrazo={!!podeEditarPrioridade} />
      </td>
      {/* v308 (JCN): complexidade — mesma mecânica e mesma regra de quem edita da prioridade. */}
      <td className="px-3 py-3">
        <ComplexidadeCelula id={insp.id_inspecao} valor={insp.complexidade} podeEditar={!!podeEditarPrioridade} />
      </td>
      <td className="px-3 py-3 text-sm text-gray-600">
        {fmtData(insp.data_inspecao)}
        {/* Concluída entra no período pela data da conclusão (07/10) — sem
            mostrar essa data, a linha parecia estar no mês errado. */}
        {insp.status === "CONCLUIDA" && insp.concluida_em && (
          <span className="block text-[11px] text-gray-400">
            concluída {new Date(insp.concluida_em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
          </span>
        )}
      </td>
      {/* 0.3.304: o responsável num círculo (nome ao passar o mouse), como os alocados da Gestão. Quem foi a campo,
          quando não é quem lançou (07/10), segue escrito embaixo: é por ele que o filtro Técnico acha a inspeção. */}
      <td className="px-3 py-3 text-sm text-gray-700">
        <ResponsavelCelula insp={insp} podeEditar={podeEditarPessoas} campo={campoDiferente(insp) ? insp.tecnicos_campo : null} />
        {campoDiferente(insp) && (
          <span className="block max-w-36 truncate text-[11px] text-gray-400" title={`campo: ${insp.tecnicos_campo}`}>campo: {insp.tecnicos_campo}</span>
        )}
      </td>
      {/* Status antes de Associados (pedido dele, 22/09): a pílula fica mais
          perto do responsável e os avatares encostam nas Ações. O cabeçalho da
          lista (app/(app)/inspecoes/page.tsx) segue esta mesma ordem. */}
      <td className="px-3 py-3">
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
            <td className="px-3 py-3">
              <AssociadosCelula insp={insp} associados={associados} podeEditar={podeEditarPessoas} />
            </td>
            {/* Status dos associados em coluna própria (pedido dele, 21/10): antes
                era a letrinha embaixo dos avatares. Entregue = Concluído. */}
            <td className="px-3 py-3">
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
                    <span className="text-[11px] text-gray-400" title={insp.elaboracao_iniciada_em ? `Iniciado em ${fmtData(insp.elaboracao_iniciada_em)}${insp.elaboracao_inicio_origem === "AUTOMATICO" ? " (pela 1ª edição)" : ""}` : undefined}>
                      {doc.texto.replace(/^Em elaboração( · )?/, "")}
                    </span>
                  )}
                  {doc.chave === "ATRIBUIDO" && (
                    <span className="text-[11px] text-amber-700/80">{doc.texto.replace(/^Atribuído( · )?/, "")} · não iniciado</span>
                  )}
                </span>
              )}
            </td>
            </>
          );
        })()}
      {/* Ações presas à direita (30/10): com nome de empresa longo ou zoom no
          navegador a tabela rola de lado, e os botões sumiam no fim da rolagem.
          Fundo opaco para o conteúdo não passar por baixo. */}
      {comAcoes && (
        <td className={`${ACOES_FIXAS} ${FUNDO_ACOES}`}>
          <div className="flex items-center justify-end gap-1">
            {comEditar && (
              <Link
                href={comVolta(`/inspecoes/${insp.id_inspecao}`, volta)}
                className="flex size-7 items-center justify-center rounded-lg text-gray-400 transition hover:bg-marca-light hover:text-marca-primary"
                title="Editar inspeção"
              >
                <Pencil className="size-3.5" />
              </Link>
            )}
            <Link
              href={comVolta(`/inspecoes/${insp.id_inspecao}/relatorio`, volta)}
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
      )}
    </tr>
  );
}
