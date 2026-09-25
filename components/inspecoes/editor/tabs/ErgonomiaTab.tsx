"use client";

// Abas AEP e AET da inspeção (v259). O conteúdo é o editor do próprio módulo
// — mesmo laudo, mesmas telas — e o botão "Enviar para o módulo" o libera nas
// listas do AEP/AET. Ver `lib/hooks/useErgonomiaInspecao.ts`.

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, ExternalLink, Printer, Send, Sparkles } from "lucide-react";
import {
  NOME_ERGO,
  ROTULO_ERGO,
  useEnviarLaudoErgoModulo,
  useIniciarLaudoErgo,
  useLaudoErgoDaInspecao,
  type TipoErgo,
} from "@/lib/hooks/useErgonomiaInspecao";
import AepSetoresEditor from "@/components/aep/AepSetoresEditor";
import AepDadosEditor from "@/components/aep/AepDadosEditor";
import AetSetoresEditor from "@/components/aet/AetSetoresEditor";
import AetAnaliseEditor from "@/components/aet/AetAnaliseEditor";
import AetPsicossocialEditor from "@/components/aet/AetPsicossocialEditor";
import AetPlanoAcaoEditor from "@/components/aet/AetPlanoAcaoEditor";
import AetDadosEditor from "@/components/aet/AetDadosEditor";
import { ConfirmHost, confirmar } from "@/components/ui/confirm";
import { cn, fmtData } from "@/lib/utils";
import type { Cargo, Empresa, InspecaoMaquina, Setor } from "@/lib/supabase/types";

type Sub = { key: string; label: string; render: (id: string) => React.ReactNode };

const SUBABAS: Record<TipoErgo, Sub[]> = {
  aep: [
    { key: "setores", label: "Setores / Triagem", render: (id) => <AepSetoresEditor idRelatorio={id} /> },
    { key: "dados", label: "Dados / Conclusão", render: (id) => <AepDadosEditor idRelatorio={id} embutido /> },
  ],
  aet: [
    { key: "setores", label: "Setores", render: (id) => <AetSetoresEditor idRelatorio={id} /> },
    { key: "analise", label: "Análise", render: (id) => <AetAnaliseEditor idRelatorio={id} /> },
    { key: "psicossocial", label: "Psicossocial", render: (id) => <AetPsicossocialEditor idRelatorio={id} /> },
    { key: "plano", label: "Plano de Ação", render: (id) => <AetPlanoAcaoEditor idRelatorio={id} /> },
    { key: "dados", label: "Dados Gerais", render: (id) => <AetDadosEditor idRelatorio={id} /> },
  ],
};

interface Props {
  tipo: TipoErgo;
  idInspecao: string;
  idEmpresa: string;
  empresa: Empresa | null | undefined;
  setores: Setor[];
  cargos: Cargo[];
  maquinas: InspecaoMaquina[];
  readOnly: boolean;
}

export default function ErgonomiaTab({ tipo, idInspecao, idEmpresa, empresa, setores, cargos, maquinas, readOnly }: Props) {
  const { data: laudo, isLoading } = useLaudoErgoDaInspecao(tipo, idInspecao);
  const iniciar = useIniciarLaudoErgo(tipo);
  const enviar = useEnviarLaudoErgoModulo(tipo);
  const [sub, setSub] = useState(SUBABAS[tipo][0].key);
  const rotulo = ROTULO_ERGO[tipo];

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-xl bg-gray-100" />;
  }

  if (!laudo) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
        <Sparkles className="mx-auto size-8 text-sky-500" />
        <h3 className="mt-3 text-base font-semibold text-gray-900">
          {NOME_ERGO[tipo]} ({rotulo})
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Preencha a {rotulo} completa aqui, durante a inspeção. Ela já começa com{" "}
          <strong>{setores.length} setor{setores.length !== 1 ? "es" : ""}</strong> e{" "}
          <strong>{cargos.length} cargo{cargos.length !== 1 ? "s" : ""}</strong> desta inspeção. Quando terminar,
          use &quot;Enviar para o módulo {rotulo}&quot; para ela aparecer no módulo.
        </p>
        {readOnly ? (
          <p className="mt-4 text-xs text-gray-400">Seu perfil não pode iniciar a {rotulo}.</p>
        ) : (
          <button
            type="button"
            disabled={iniciar.isPending}
            onClick={() => iniciar.mutate({ idInspecao, idEmpresa, empresa, setores, cargos, maquinas })}
            className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-60"
          >
            {iniciar.isPending ? "Criando..." : `Iniciar ${rotulo} desta inspeção`}
          </button>
        )}
      </div>
    );
  }

  const enviado = !!laudo.enviado_modulo_em;
  const subAtual = SUBABAS[tipo].find((s) => s.key === sub) ?? SUBABAS[tipo][0];

  return (
    <div className="space-y-4">
      <ConfirmHost />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-gray-900">{rotulo}</span>
          <span className="rounded-full bg-white px-2 py-0.5 text-xs text-gray-600 ring-1 ring-gray-200">
            {laudo.status === "CONCLUIDO" ? "Concluída" : "Rascunho"}
          </span>
          {enviado ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
              <CheckCircle2 className="size-3.5" /> No módulo {rotulo} desde {fmtData(laudo.enviado_modulo_em)}
            </span>
          ) : (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
              Só nesta inspeção
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/${tipo}/${laudo.id_relatorio}/laudo`}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <Printer className="size-3.5" /> Laudo / Imprimir
          </Link>
          {enviado ? (
            <Link
              href={`/${tipo}/${laudo.id_relatorio}/setores`}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <ExternalLink className="size-3.5" /> Abrir no módulo {rotulo}
            </Link>
          ) : (
            !readOnly && (
              <button
                type="button"
                disabled={enviar.isPending}
                onClick={async () => {
                  const ok = await confirmar({
                    title: `Enviar para o módulo ${rotulo}?`,
                    description: `A ${rotulo} passa a aparecer na lista do módulo ${rotulo}. Continua sendo o mesmo laudo: o que for editado aqui ou lá vale para os dois.`,
                    confirmLabel: "Enviar",
                    variant: "primary",
                  });
                  if (ok) enviar.mutate({ idRelatorio: laudo.id_relatorio, idInspecao });
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-600 disabled:opacity-60"
              >
                <Send className="size-3.5" /> {enviar.isPending ? "Enviando..." : `Enviar para o módulo ${rotulo}`}
              </button>
            )
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-gray-200">
        {SUBABAS[tipo].map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setSub(s.key)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
              subAtual.key === s.key
                ? "border-sky-500 text-sky-600"
                : "border-transparent text-gray-500 hover:text-gray-800"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div key={subAtual.key}>{subAtual.render(laudo.id_relatorio)}</div>
    </div>
  );
}
