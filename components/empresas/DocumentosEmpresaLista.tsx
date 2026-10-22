"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, BadgeCheck, FileText, Lock, AlertTriangle, Search, ChevronRight } from "lucide-react";
import { FONTES_DOCUMENTOS, type DocumentoEmpresa, type DocumentosEmpresaResultado } from "@/lib/hooks/useDocumentosEmpresa";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { fmtData, cn } from "@/lib/utils";
import { buscar } from "@/lib/busca/texto";

/** Status crus das 10 tabelas, como a pessoa lê. */
const STATUS_LABEL: Record<string, string> = {
  RASCUNHO: "Rascunho",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDA: "Concluída",
  CONCLUIDO: "Concluído",
  FINALIZADO: "Finalizado",
  ENVIADO_CLIENTE: "Enviado ao cliente",
};
const statusLabel = (s: string) =>
  STATUS_LABEL[s] ?? s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");

/**
 * Aba "Documentos & Laudos" da ficha da empresa (08/10): todos os documentos
 * da empresa, um bloco por tipo (o visual da antiga aba "Registros por
 * módulo", que saiu — pedido dele) e, dentro do bloco, em sequência de data,
 * com Abrir e PDF. Os dados vêm de
 * `useDocumentosEmpresa`, chamado pela página (o KPI da Visão geral usa o
 * mesmo resultado).
 */
export default function DocumentosEmpresaLista({
  data,
  carregando,
}: {
  data: DocumentosEmpresaResultado | undefined;
  carregando: boolean;
}) {
  const [tipo, setTipo] = useState("");
  const [busca, setBusca] = useState("");

  const documentos = useMemo(() => data?.documentos ?? [], [data]);
  const avulsos = data?.pdfsAvulsos ?? [];
  const porTipo = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of documentos) m.set(d.tipo, (m.get(d.tipo) ?? 0) + 1);
    // Mesma ordem dos blocos abaixo.
    return FONTES_DOCUMENTOS.filter((f) => m.has(f.tipo)).map((f) => [f.tipo, m.get(f.tipo)!] as const);
  }, [documentos]);

  const filtrados = useMemo(() => {
    const doTipo = tipo ? documentos.filter((d) => d.tipo === tipo) : documentos;
    return buscar(doTipo, busca, (d) => [d.tipo, d.titulo, d.responsavel, d.id], { manterOrdem: true }).itens;
  }, [documentos, tipo, busca]);

  // Um bloco por tipo, na ordem fixa das fontes (Inspeção primeiro). A lista já
  // vem do mais recente para o mais antigo, e o agrupamento mantém essa ordem.
  const blocos = useMemo(() => {
    const m = new Map<string, DocumentoEmpresa[]>();
    for (const d of filtrados) m.set(d.tipo, [...(m.get(d.tipo) ?? []), d]);
    return FONTES_DOCUMENTOS.map((f) => ({ tipo: f.tipo, docs: m.get(f.tipo) ?? [] })).filter((b) => b.docs.length > 0);
  }, [filtrados]);

  return (
    <div className="space-y-4">
      {/* Sem permissão: avisa, não esconde calado (decisão dele, 08/10). */}
      {data && data.semPermissao.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Lock className="mt-0.5 size-4 shrink-0" />
          <p>
            Você não tem permissão para visualizar os documentos de{" "}
            <strong>{data.semPermissao.join(", ")}</strong>. Se precisar, fale com o administrador.
          </p>
        </div>
      )}
      {data && data.comErro.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>Não foi possível carregar: <strong>{data.comErro.join(", ")}</strong>. Recarregue a página.</p>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        {/* Filtros */}
        <div className="space-y-3 border-b border-gray-100 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-900">
              {filtrados.length} documento{filtrados.length !== 1 ? "s" : ""}
              {filtrados.length !== documentos.length && <span className="font-normal text-gray-400"> de {documentos.length}</span>}
            </h2>
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar título, responsável, ID…"
                className="w-full rounded-md border border-gray-300 bg-white py-1.5 pl-8 pr-2 text-xs focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
              />
            </div>
          </div>
          {porTipo.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              <Chip ativo={!tipo} onClick={() => setTipo("")}>Todos ({documentos.length})</Chip>
              {porTipo.map(([t, n]) => (
                <Chip key={t} ativo={tipo === t} onClick={() => setTipo(t)}>{t} ({n})</Chip>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Um bloco por tipo; dentro, do mais recente para o mais antigo. */}
      {carregando || !data ? (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"><LoadingSkeleton rows={6} /></div>
      ) : blocos.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 shadow-sm">
          <FileText className="size-8 text-gray-400" />
          <p className="mt-2">
            {documentos.length === 0 ? "Nenhum documento para esta empresa ainda." : "Nenhum documento com esse filtro."}
          </p>
        </div>
      ) : (
        blocos.map((b) => (
          <div key={b.tipo} className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-gray-900">{b.tipo}</h3>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">{b.docs.length}</span>
            </div>
            <ul>
              {b.docs.map((d) => (
                <li key={d.chave} className="flex flex-col gap-2 border-b border-gray-100 px-4 py-3 last:border-b-0 hover:bg-gray-50 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="w-20 shrink-0 pt-0.5 text-xs tabular-nums text-gray-500">
                      {d.data ? fmtData(d.data) : "sem data"}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">{d.titulo || d.tipo}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-gray-500">
                        {d.daInspecao && (
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 font-medium text-gray-600" title="Preenchida na aba da inspeção, ainda não enviada ao módulo">
                            da inspeção
                          </span>
                        )}
                        {d.status && <span>{statusLabel(d.status)}</span>}
                        {d.responsavel && <span>· {d.responsavel}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 pl-[5.75rem] sm:pl-0">
                    {d.pdfAssinado && <SeloAssinado />}
                    {d.pdfUrl && <LinkPdf href={d.pdfUrl} />}
                    <Link href={d.rota} className="text-xs font-medium text-verde-primary hover:underline">
                      Abrir →
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}

      {/* PDFs cujo documento saiu da lista (excluído) — a aba antiga os mostrava. */}
      {avulsos.length > 0 && (
        <details className="group rounded-xl border border-gray-200 bg-white shadow-sm">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm text-gray-600 hover:bg-gray-50">
            <ChevronRight className="size-4 transition-transform group-open:rotate-90" />
            PDFs de documentos que foram excluídos ({avulsos.length})
          </summary>
          <ul className="border-t border-gray-100">
            {avulsos.map((p) => (
              <li key={p.id} className="flex flex-col gap-2 border-b border-gray-100 px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="w-20 shrink-0 pt-0.5 text-xs tabular-nums text-gray-500">{fmtData(p.data)}</span>
                  <div className="min-w-0">
                    <p className="truncate text-sm text-gray-700">{p.titulo || p.tipo}</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {p.titulo ? p.tipo : "PDF"}{p.responsavel ? ` · ${p.responsavel}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3 pl-[5.75rem] sm:pl-0">
                  {p.assinado && <SeloAssinado />}
                  {p.url ? <LinkPdf href={p.url} /> : <span className="text-xs text-gray-300">—</span>}
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function SeloAssinado() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
      <BadgeCheck className="size-3" /> Assinado
    </span>
  );
}

function LinkPdf({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-verde-primary hover:underline"
    >
      <Download className="size-3.5" /> PDF
    </a>
  );
}

function Chip({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        ativo
          ? "border-verde-primary bg-verde-primary text-white"
          : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
      )}
    >
      {children}
    </button>
  );
}
