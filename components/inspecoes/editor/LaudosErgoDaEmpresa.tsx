"use client";

// AEP/AET que a empresa já tem, na aba da inspeção sem laudo próprio (0.3.307, 19/11/2026 — pedido do João).
// Consultar abre o laudo; "Trazer para esta inspeção" faz dele o laudo da aba (sai da outra inspeção, se estava).

import Link from "next/link";
import { ArrowDownToLine, Eye } from "lucide-react";
import { ROTULO_ERGO, useLaudosErgoDaEmpresa, useTrazerLaudoErgo, type TipoErgo } from "@/lib/hooks/useErgonomiaInspecao";
import { laudosParaOferecer, vinculoAtual } from "@/lib/ergonomia/laudos-empresa";
import { confirmar } from "@/components/ui/confirm";
import PessoaComFoto from "@/components/ui/PessoaComFoto";
import { fmtData } from "@/lib/utils";

const STATUS: Record<string, string> = { CONCLUIDO: "Concluída", EM_ANDAMENTO: "Em andamento", RASCUNHO: "Rascunho" };

export default function LaudosErgoDaEmpresa({
  tipo,
  idInspecao,
  idEmpresa,
  cnpj,
  readOnly,
}: {
  tipo: TipoErgo;
  idInspecao: string;
  idEmpresa: string;
  cnpj: string | null | undefined;
  readOnly: boolean;
}) {
  const { data, isLoading } = useLaudosErgoDaEmpresa(tipo, idEmpresa, cnpj);
  const trazer = useTrazerLaudoErgo(tipo);
  const rotulo = ROTULO_ERGO[tipo];

  if (isLoading) return <div className="mx-auto h-24 max-w-3xl animate-pulse rounded-xl bg-gray-100" />;
  const laudos = laudosParaOferecer(data?.laudos ?? [], idInspecao);
  if (laudos.length === 0) return null;

  return (
    <div className="mx-auto max-w-3xl rounded-2xl border border-sky-200 bg-sky-50/40 p-4">
      <h3 className="text-sm font-semibold text-gray-900">
        {laudos.length === 1 ? `Esta empresa já tem uma ${rotulo}` : `Esta empresa já tem ${laudos.length} ${rotulo}s`}
      </h3>
      <p className="mt-0.5 text-xs text-gray-500">
        Feita{laudos.length === 1 ? "" : "s"} à parte, fora desta inspeção. Consulte ou traga para cá: ela passa a ser a {rotulo} desta inspeção.
      </p>
      <ul className="mt-3 divide-y divide-sky-100 overflow-hidden rounded-xl border border-sky-100 bg-white">
        {laudos.map((l) => {
          const v = vinculoAtual(l, idEmpresa);
          const onde =
            v === "sem_inspecao"
              ? "Sem inspeção"
              : v === "outra_inspecao"
                ? `Na inspeção ${l.id_inspecao}`
                : `Em outro cadastro: ${data?.nomes[l.id_empresa] ?? l.id_empresa}${l.id_inspecao ? ` · inspeção ${l.id_inspecao}` : ""}`;
          return (
            <li key={l.id_relatorio} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-gray-900">{rotulo} de {l.data_elaboracao ? fmtData(l.data_elaboracao) : "data não informada"}</span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">{STATUS[l.status ?? ""] ?? l.status ?? "—"}</span>
                  <span className={v === "sem_inspecao" ? "text-[11px] text-gray-500" : "text-[11px] text-amber-700"}>{onde}</span>
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  <PessoaComFoto nome={l.responsavel_elaboracao} tamanho="size-5 text-[8px]" vazio="Sem responsável" />
                </div>
              </div>
              <Link
                href={`/${tipo}/${l.id_relatorio}/laudo`}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                <Eye className="size-3.5" /> Consultar
              </Link>
              {!readOnly && (
                <button
                  type="button"
                  disabled={trazer.isPending}
                  onClick={async () => {
                    const avisos = [
                      v === "outra_inspecao" || (v === "outro_cadastro" && l.id_inspecao)
                        ? `Ela sai da inspeção ${l.id_inspecao} (uma inspeção tem uma ${rotulo} só).`
                        : null,
                      v === "outro_cadastro"
                        ? `Ela passa do cadastro "${data?.nomes[l.id_empresa] ?? l.id_empresa}" (mesmo CNPJ) para o cadastro desta inspeção.`
                        : null,
                      "O conteúdo da " + rotulo + " não muda e ela continua no módulo " + rotulo + ".",
                    ].filter(Boolean);
                    const ok = await confirmar({
                      title: `Trazer esta ${rotulo} para a inspeção?`,
                      description: avisos.join(" "),
                      confirmLabel: "Trazer",
                      variant: "primary",
                    });
                    if (ok) {
                      trazer.mutate({
                        idRelatorio: l.id_relatorio,
                        idInspecao,
                        idEmpresa,
                        idEmpresaAntes: l.id_empresa,
                        idInspecaoAntes: l.id_inspecao,
                      });
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-600 disabled:opacity-60"
                >
                  <ArrowDownToLine className="size-3.5" /> Trazer para esta inspeção
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
