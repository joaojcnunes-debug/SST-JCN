"use client";

import Link from "next/link";
import { FlaskConical, Plus, History, AlertTriangle, Sparkles } from "lucide-react";
import { useAnalisesQuimicos } from "@/lib/hooks/useAnalisesQuimicos";
import { useCanCreate } from "@/lib/hooks/useUsuario";

export default function AnaliseQuimicosOverviewPage() {
  const canCreate = useCanCreate();
  const { data: analises = [], isLoading } = useAnalisesQuimicos();

  const total = analises.length;
  const ultimas = analises.slice(0, 5);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
          <FlaskConical className="size-5 text-sky-500" />
          Análise de Químicos JCN
        </h1>
        <p className="text-sm text-gray-600">
          Análise técnica de agentes químicos a partir de FDS/FISPQ ou entrada
          manual, com parecer de insalubridade, aposentadoria especial e
          enquadramento previdenciário.
        </p>
      </div>

      {/* Aviso */}
      <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        <AlertTriangle className="size-4 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">
            Análises geradas por IA — revisão técnica obrigatória
          </p>
          <p className="mt-0.5 text-xs">
            Códigos eSocial, Decreto 3.048, GFIP e classificações IARC devem
            ser confirmados em tabela oficial vigente antes de emissão de
            PPP/LTCAT/eSocial S-2240. A IA pode marcar como
            &ldquo;CONSULTAR_TABELA_OFICIAL&rdquo; quando não tiver certeza —
            isso é proposital.
          </p>
        </div>
      </div>

      {/* Ações principais */}
      <div className={`grid grid-cols-1 gap-4 ${canCreate ? "md:grid-cols-2" : "md:grid-cols-1"}`}>
        {canCreate && (
          <Link
            href="/analise-quimicos/nova"
            className="group flex flex-col gap-2 rounded-xl border-2 border-sky-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-sky-400 hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-xl bg-sky-100 text-sky-600">
                <Plus className="size-6" />
              </div>
              <div>
                <p className="text-base font-bold text-gray-900">Nova Análise</p>
                <p className="text-xs text-gray-500">
                  Upload de PDF ou entrada manual
                </p>
              </div>
            </div>
            <p className="mt-1 text-xs text-gray-600">
              Faça upload da FDS/FISPQ ou preencha os dados do produto manualmente.
              A IA gera parecer técnico em ~10-30 segundos.
            </p>
            <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-sky-600 group-hover:text-sky-700">
              Começar <Sparkles className="size-3" />
            </span>
          </Link>
        )}

        <Link
          href="/analise-quimicos/historico"
          className="group flex flex-col gap-2 rounded-xl border-2 border-gray-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-gray-400 hover:shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-gray-100 text-gray-600">
              <History className="size-6" />
            </div>
            <div>
              <p className="text-base font-bold text-gray-900">Histórico</p>
              <p className="text-xs text-gray-500">
                {isLoading ? "Carregando..." : `${total} análise(s) salvas`}
              </p>
            </div>
          </div>
          <p className="mt-1 text-xs text-gray-600">
            Consulte análises anteriores, baixe em PDF ou imprima diretamente
            do navegador.
          </p>
          <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-gray-600 group-hover:text-gray-800">
            Ver lista →
          </span>
        </Link>
      </div>

      {/* Últimas análises */}
      {ultimas.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Últimas análises
          </h2>
          <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white shadow-sm">
            {ultimas.map((a) => (
              <Link
                key={a.id_analise}
                href={`/analise-quimicos/${a.id_analise}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50"
              >
                <FlaskConical className="size-4 text-sky-500" />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900">
                    {a.titulo}
                  </p>
                  <p className="text-xs text-gray-500">
                    {a.usuario_nome ?? "—"} ·{" "}
                    {new Date(a.created_at).toLocaleString("pt-BR")} ·{" "}
                    {a.modo === "PDF"
                      ? `PDF: ${a.fonte_arquivo ?? ""}`
                      : "Manual"}
                  </p>
                </div>
                <span className="text-xs text-sky-600">Abrir →</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
