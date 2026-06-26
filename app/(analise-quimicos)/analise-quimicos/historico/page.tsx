"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  FlaskConical,
  Search,
  ArrowLeft,
  FileText,
  Pencil,
  Plus,
} from "lucide-react";
import { useAnalisesQuimicos } from "@/lib/hooks/useAnalisesQuimicos";
import { useCanCreate } from "@/lib/hooks/useUsuario";

export default function HistoricoAnalisesPage() {
  const canCreate = useCanCreate();
  const { data: analises = [], isLoading } = useAnalisesQuimicos();
  const [q, setQ] = useState("");

  const filtradas = useMemo(() => {
    const termo = q.trim().toLowerCase();
    if (!termo) return analises;
    return analises.filter((a) => {
      return (
        a.titulo.toLowerCase().includes(termo) ||
        (a.nome_quimico ?? "").toLowerCase().includes(termo) ||
        (a.numero_cas ?? "").toLowerCase().includes(termo) ||
        (a.usuario_nome ?? "").toLowerCase().includes(termo) ||
        (a.fonte_arquivo ?? "").toLowerCase().includes(termo)
      );
    });
  }, [analises, q]);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <Link
          href="/analise-quimicos"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-verde-primary"
        >
          <ArrowLeft className="size-3.5" /> Voltar
        </Link>
        {canCreate && (
          <Link
            href="/analise-quimicos/nova"
            className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-verde-accent"
          >
            <Plus className="size-4" /> Nova análise
          </Link>
        )}
      </div>

      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
          <FlaskConical className="size-5 text-sky-500" />
          Histórico de Análises de Químicos
        </h1>
        <p className="text-sm text-gray-600">
          {isLoading
            ? "Carregando..."
            : `${analises.length} análise(s) salva(s)`}
        </p>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por produto, CAS, usuário, arquivo..."
          className="w-full rounded-md border border-gray-300 bg-white pl-9 pr-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary"
        />
      </div>

      {/* Lista */}
      {filtradas.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-500">
          {q.trim()
            ? `Nenhuma análise encontrada para "${q}".`
            : "Nenhuma análise salva ainda."}
        </div>
      ) : (
        <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white shadow-sm reveal-up card-hover">
          {filtradas.map((a) => {
            const insalubre = (a.conclusao_rapida?.insalubridade_nr15 ?? "")
              .toUpperCase()
              .startsWith("SIM");
            const carc = (a.conclusao_rapida?.carcinogenico ?? "")
              .toUpperCase()
              .startsWith("SIM");
            return (
              <Link
                key={a.id_analise}
                href={`/analise-quimicos/${a.id_analise}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50"
              >
                <FlaskConical className="size-4 shrink-0 text-sky-500" />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {a.titulo}
                    </p>
                    {insalubre && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                        Insalubre {a.conclusao_rapida?.insalubridade_grau ?? ""}
                      </span>
                    )}
                    {carc && (
                      <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">
                        Carcinogênico
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
                    <span className="inline-flex items-center gap-1">
                      {a.modo === "PDF" ? (
                        <FileText className="size-3" />
                      ) : (
                        <Pencil className="size-3" />
                      )}
                      {a.modo === "PDF"
                        ? a.fonte_arquivo ?? "PDF"
                        : "Manual"}
                    </span>
                    {a.numero_cas && <span>CAS: {a.numero_cas}</span>}
                    {a.usuario_nome && <span>{a.usuario_nome}</span>}
                    <span>
                      {new Date(a.created_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                </div>
                <span className="shrink-0 text-xs text-sky-600">Abrir →</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
