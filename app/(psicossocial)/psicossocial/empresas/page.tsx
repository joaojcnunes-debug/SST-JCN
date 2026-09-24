"use client";

// Psicossocial › Empresas — a busca de empresa que NÃO enxerga inspeção.
//
// Nasceu em 2026-09-10, do aviso dos psicólogos: ao puxar o documento de uma
// empresa pela tela de Empresas, a inspeção de segurança vinha junto. A tela de
// Empresas é a única área do painel sem checagem de módulo, e junta numa página
// o que existe de todos os módulos daquela empresa.
//
// 🔑 Aqui a limitação é por CONSTRUÇÃO, não por filtro que alguém pode
// desmarcar: `useEmpresasPsicossocial` só consulta `drps_relatorios` e
// `qps_aplicacoes`, e os PDFs passam pela régua de `lib/psicossocial/
// documentos.ts`, que RECUSA por padrão. Não existe caminho por onde uma
// inspeção apareça nesta página.
//
// A entrada no módulo já é barrada pelo layout (`useRequireModule
// ("psicossocial")`) — quem não tem o módulo não chega até aqui.

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  Loader2,
  MapPin,
  Search,
  ShieldOff,
  X,
} from "lucide-react";
import { useEmpresasPsicossocial, type EmpresaPsicossocial } from "@/lib/hooks/useEmpresasPsicossocial";
import { buscar } from "@/lib/busca/texto";
import AvisoBuscaAproximada from "@/components/ui/AvisoBuscaAproximada";
import { usePdfsPorEmpresa } from "@/lib/hooks/usePdfsGerados";
import { ehDocumentoPsicossocial } from "@/lib/psicossocial/documentos";
import { cn, fmtData, formatCNPJ } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  RASCUNHO: "Rascunho",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDO: "Concluído",
  ENVIADO_CLIENTE: "Enviado p/ cliente",
};

const STATUS_COR: Record<string, string> = {
  RASCUNHO: "bg-gray-100 text-gray-600",
  EM_ANDAMENTO: "bg-amber-100 text-amber-700",
  CONCLUIDO: "bg-green-100 text-green-700",
  ENVIADO_CLIENTE: "bg-indigo-100 text-indigo-700",
};

function Chip({ status }: { status: string | null }) {
  if (!status) return null;
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
        STATUS_COR[status] ?? "bg-gray-100 text-gray-600",
      )}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export default function EmpresasPsicossocialPage() {
  const { data: empresas = [], isLoading, isError } = useEmpresasPsicossocial();
  const [busca, setBusca] = useState("");
  const [aberta, setAberta] = useState<string | null>(null);

  // Busca tolerante (acento, ordem das palavras, erro de digitação, CNPJ sem
  // máscara). Relatório DRPS não tem título no banco — quem tem é a aplicação
  // de questionário. Por isso a busca por texto só olha o título dela.
  const { itens: visiveis, aproximado } = useMemo(
    () =>
      buscar(
        empresas,
        busca,
        (e) => [e.nome, e.municipio, ...e.questionarios.map((a) => a.titulo)],
        { codigos: (e) => [e.cnpj] },
      ),
    [empresas, busca],
  );

  const totais = useMemo(
    () => ({
      relatorios: empresas.reduce((n, e) => n + e.drps.length, 0),
      aplicacoes: empresas.reduce((n, e) => n + e.questionarios.length, 0),
    }),
    [empresas],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-gray-500">
        <Loader2 className="size-4 animate-spin" /> Carregando empresas...
      </div>
    );
  }

  if (isError) {
    return (
      <p className="py-24 text-center text-sm text-red-600">
        Erro ao carregar as empresas do psicossocial.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
          <Building2 className="size-5 text-indigo-600" />
          Empresas
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Só o que é do psicossocial: relatórios DRPS, aplicações de questionário
          e os documentos desses dois.
        </p>
        <p className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs text-indigo-800">
          <ShieldOff className="size-3.5 shrink-0" />
          Inspeção de segurança não aparece nesta tela — ela não é consultada aqui.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar empresa, CNPJ, cidade ou título da aplicação…"
            aria-label="Buscar empresa"
            className="w-full rounded-lg border border-gray-300 py-2 pl-8 pr-8 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
          />
          {busca && (
            <button
              type="button"
              onClick={() => setBusca("")}
              aria-label="Limpar busca"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <p className="text-xs text-gray-500">
          {busca.trim() ? `${visiveis.length} de ` : ""}
          <strong>{empresas.length}</strong> empresa(s) · {totais.relatorios}{" "}
          relatório(s) DRPS · {totais.aplicacoes} aplicação(ões)
        </p>
      </div>

      <AvisoBuscaAproximada aproximado={aproximado} busca={busca} total={visiveis.length} />

      {visiveis.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500 shadow-sm">
          <Building2 className="size-8 text-gray-400" />
          <p className="mt-2">
            {empresas.length === 0
              ? "Nenhuma empresa tem relatório DRPS ou aplicação de questionário ainda."
              : `Nenhuma empresa encontrada para "${busca.trim()}".`}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {visiveis.map((e) => (
            <li key={e.idEmpresa}>
              <Linha
                empresa={e}
                aberta={aberta === e.idEmpresa}
                onAlternar={() =>
                  setAberta((atual) => (atual === e.idEmpresa ? null : e.idEmpresa))
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Linha({
  empresa,
  aberta,
  onAlternar,
}: {
  empresa: EmpresaPsicossocial;
  aberta: boolean;
  onAlternar: () => void;
}) {
  const Seta = aberta ? ChevronDown : ChevronRight;
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={onAlternar}
        aria-expanded={aberta}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
      >
        <Seta className="size-4 shrink-0 text-gray-400" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900">{empresa.nome}</p>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
            {empresa.cnpj && <span className="font-mono">{formatCNPJ(empresa.cnpj)}</span>}
            {empresa.municipio && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3" />
                {[empresa.municipio, empresa.uf].filter(Boolean).join(" / ")}
              </span>
            )}
            {empresa.ultimaAtividade && <span>Atualizado em {fmtData(empresa.ultimaAtividade)}</span>}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {empresa.drps.length > 0 && (
            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-semibold text-purple-700">
              {empresa.drps.length} DRPS
            </span>
          )}
          {empresa.questionarios.length > 0 && (
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
              {empresa.questionarios.length} quest.
            </span>
          )}
        </div>
      </button>

      {aberta && (
        <div className="border-t border-gray-100 bg-gray-50/60 px-4 py-3">
          <div className="grid gap-4 lg:grid-cols-2">
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Relatórios DRPS
              </h2>
              {empresa.drps.length === 0 ? (
                <p className="mt-2 text-xs text-gray-400">Nenhum relatório DRPS.</p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {empresa.drps.map((r) => (
                    <li key={r.id}>
                      <Link
                        href={`/psicossocial/${r.id}/dashboard`}
                        className="flex items-start justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 hover:bg-gray-50"
                      >
                        <div className="min-w-0">
                          {/* O relatório DRPS não tem título: a identidade dele
                              é REVISÃO + data, como no Dashboard Geral. */}
                          <p className="truncate text-xs font-medium text-gray-900">
                            Rev. {r.revisao ?? 1}
                            {r.dataElaboracao &&
                              ` · ${new Date(r.dataElaboracao + "T00:00:00").toLocaleDateString("pt-BR")}`}
                          </p>
                          {(r.responsavel || r.atualizadoEm) && (
                            <p className="truncate text-[11px] text-gray-500">
                              {r.responsavel ?? ""}
                              {r.responsavel && r.atualizadoEm ? " · " : ""}
                              {r.atualizadoEm ? `atualizado em ${fmtData(r.atualizadoEm)}` : ""}
                            </p>
                          )}
                        </div>
                        <Chip status={r.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Aplicações de questionário
              </h2>
              {empresa.questionarios.length === 0 ? (
                <p className="mt-2 text-xs text-gray-400">Nenhuma aplicação.</p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {empresa.questionarios.map((a) => (
                    <li key={a.id}>
                      <Link
                        href={`/questionarios-psicossociais/${a.id}`}
                        className="flex items-start justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 hover:bg-gray-50"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-gray-900">{a.titulo}</p>
                          {a.atualizadoEm && (
                            <p className="text-[11px] text-gray-500">
                              Atualizado em {fmtData(a.atualizadoEm)}
                            </p>
                          )}
                        </div>
                        <Chip status={a.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <DocumentosDoPsicossocial idEmpresa={empresa.idEmpresa} />
        </div>
      )}
    </div>
  );
}

/**
 * Os PDFs da empresa, passados pela régua.
 *
 * Componente separado de propósito: o hook só roda para a empresa ABERTA, e
 * não para as ~140 da lista.
 */
function DocumentosDoPsicossocial({ idEmpresa }: { idEmpresa: string }) {
  const { data: pdfs = [], isLoading } = usePdfsPorEmpresa(idEmpresa);

  const doPsico = pdfs.filter((p) => ehDocumentoPsicossocial(p.modulo));
  const deFora = pdfs.length - doPsico.length;

  return (
    <section className="mt-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Documentos emitidos
      </h2>
      {isLoading ? (
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-gray-400">
          <Loader2 className="size-3 animate-spin" /> Carregando documentos...
        </p>
      ) : doPsico.length === 0 ? (
        <p className="mt-2 text-xs text-gray-400">
          Nenhum documento do psicossocial emitido para esta empresa.
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {doPsico.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-gray-900">
                  {p.tipo_documento || "DRPS — Psicossocial"}
                </p>
                <p className="text-[11px] text-gray-500">
                  {fmtData(p.data_geracao)}
                  {p.responsavel_tecnico ? ` · ${p.responsavel_tecnico}` : ""}
                  {p.assinado ? " · assinado" : ""}
                </p>
              </div>
              {p.pdf_assinado_url || p.pdf_url ? (
                <a
                  href={(p.pdf_assinado_url || p.pdf_url)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-verde-primary hover:underline"
                >
                  <Download className="size-3.5" /> Abrir
                </a>
              ) : (
                <span className="shrink-0 text-xs text-gray-300">—</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {/* Dizer QUANTOS ficaram fora evita a dúvida "está faltando documento?".
          O que ficou fora não é nomeado nem contado por módulo — não é assunto
          desta tela. */}
      {!isLoading && deFora > 0 && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-gray-400">
          <FileText className="size-3 shrink-0" />
          {deFora} documento(s) de outros módulos desta empresa não aparecem aqui.
        </p>
      )}
    </section>
  );
}
