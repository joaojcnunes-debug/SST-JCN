"use client";

// Faixa do editor da AEP (2026-10-05): diz se a AEP já está na Sinalização
// Psicossocial e, se não, o que falta. A AEP só aparece lá quando está numa
// inspeção cujo documento o associado concluiu (entregue ao cliente).
// O botão "Alterar inspeção" registra a AEP numa inspeção realizada, numa
// inspeção nova em branco, ou a deixa sem inspeção.

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, Info, Link2 } from "lucide-react";
import { useSituacaoSinalizacaoAep } from "@/lib/hooks/useAep";
import { useInspecoesByEmpresa } from "@/lib/hooks/useInspecao";
import {
  useAlterarInspecaoAep,
  useInspecoesComAep,
  type VinculoInspecao,
} from "@/lib/hooks/useErgonomiaInspecao";
import { cn, fmtData } from "@/lib/utils";

function AlterarInspecao({
  idRelatorio,
  idEmpresa,
  idInspecaoAtual,
  onFechar,
}: {
  idRelatorio: string;
  idEmpresa: string;
  idInspecaoAtual: string | null;
  onFechar: () => void;
}) {
  const [vinculo, setVinculo] = useState<VinculoInspecao>("existente");
  const [idInspecao, setIdInspecao] = useState(idInspecaoAtual ?? "");
  const { data: inspecoes = [] } = useInspecoesByEmpresa(idEmpresa);
  const { data: comAep } = useInspecoesComAep(idEmpresa);
  const alterar = useAlterarInspecaoAep();
  const ativas = useMemo(() => inspecoes.filter((i) => i.status !== "DELETADA"), [inspecoes]);
  const proximaRevisao = useMemo(() => Math.max(0, ...inspecoes.map((i) => i.revisao ?? 0)) + 1, [inspecoes]);

  const opcoes: [VinculoInspecao, string, string][] = [
    ["existente", "Inspeção realizada", "Escolher uma inspeção da empresa"],
    ["nova", "Criar nova inspeção", `Inspeção em branco, Rev. ${proximaRevisao}`],
    ["nenhum", "Sem inspeção", "Não aparece na Sinalização"],
  ];

  const podeSalvar =
    !alterar.isPending &&
    (vinculo === "existente" ? !!idInspecao && idInspecao !== idInspecaoAtual : vinculo === "nova" || !!idInspecaoAtual);

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-gray-200 bg-white p-3 text-gray-700">
      <div className="grid gap-2 sm:grid-cols-3">
        {opcoes.map(([v, rotulo, dica]) => (
          <button
            key={v}
            type="button"
            onClick={() => setVinculo(v)}
            className={cn(
              "rounded-lg border px-3 py-2 text-left text-sm",
              vinculo === v
                ? "border-emerald-500 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500"
                : "border-gray-300 hover:bg-gray-50"
            )}
          >
            <div className="font-medium">{rotulo}</div>
            <div className="text-[11px] text-gray-500">{dica}</div>
          </button>
        ))}
      </div>

      {vinculo === "existente" &&
        (ativas.length === 0 ? (
          <p className="text-[11px] text-amber-700">Esta empresa não tem inspeção. Escolha &quot;Criar nova inspeção&quot;.</p>
        ) : (
          <select
            value={idInspecao}
            onChange={(e) => setIdInspecao(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="">Selecione a inspeção...</option>
            {ativas.map((i) => {
              const atual = i.id_inspecao === idInspecaoAtual;
              const ocupada = !atual && (comAep?.has(i.id_inspecao) ?? false);
              return (
                <option key={i.id_inspecao} value={i.id_inspecao} disabled={ocupada}>
                  {i.id_inspecao} · Rev. {i.revisao ?? 0} · {fmtData(i.data_inspecao)}
                  {i.status === "CONCLUIDA" ? " · Concluída" : i.status === "RASCUNHO" ? " · Rascunho" : " · Em andamento"}
                  {atual ? " · atual" : ocupada ? " · já tem AEP" : ""}
                </option>
              );
            })}
          </select>
        ))}
      {vinculo === "nenhum" && (
        <p className="text-[11px] text-amber-700">
          Sem inspeção, a AEP fica só no módulo e não aparece na Sinalização Psicossocial.
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onFechar} className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100">
          Cancelar
        </button>
        <button
          type="button"
          disabled={!podeSalvar}
          onClick={() =>
            alterar.mutate(
              {
                idRelatorio,
                idEmpresa,
                vinculo,
                id_inspecao: vinculo === "existente" ? idInspecao : null,
                revisao_nova: proximaRevisao,
              },
              { onSuccess: onFechar }
            )
          }
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {alterar.isPending ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </div>
  );
}

export default function SituacaoSinalizacaoAep({ idRelatorio }: { idRelatorio: string }) {
  const { data } = useSituacaoSinalizacaoAep(idRelatorio);
  const [editando, setEditando] = useState(false);
  if (!data) return null;

  const link = data.idInspecao ? (
    <Link href={`/inspecoes/${data.idInspecao}`} className="font-semibold underline">
      {data.idInspecao}
    </Link>
  ) : null;

  const [cls, Icone, texto] = !data.idInspecao
    ? ([
        "border-amber-200 bg-amber-50 text-amber-800",
        Info,
        <>
          Esta AEP não está registrada em nenhuma inspeção, por isso{" "}
          <strong>não aparece na Sinalização Psicossocial</strong>.
        </>,
      ] as const)
    : data.entregue
      ? ([
          "border-emerald-200 bg-emerald-50 text-emerald-800",
          CheckCircle2,
          <>
            <strong>Na Sinalização Psicossocial</strong>
            {data.entregueEm ? ` desde ${fmtData(data.entregueEm)}` : ""}: o documento da inspeção {link} foi entregue
            ao cliente.
          </>,
        ] as const)
      : ([
          "border-sky-200 bg-sky-50 text-sky-800",
          Clock,
          <>
            Registrada na inspeção {link}. Aparece na <strong>Sinalização Psicossocial</strong> quando o documento dessa
            inspeção for concluído pelo associado (entregue ao cliente).
          </>,
        ] as const);

  return (
    <div className={cn("rounded-lg border px-3 py-2 text-xs", cls)}>
      <div className="flex items-start gap-2">
        <Icone className="mt-0.5 size-4 shrink-0" />
        <span className="flex-1">{texto}</span>
        {data.idEmpresa && !editando && (
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-current/30 bg-white/70 px-2 py-1 font-semibold hover:bg-white"
          >
            <Link2 className="size-3.5" />
            {data.idInspecao ? "Alterar inspeção" : "Registrar em inspeção"}
          </button>
        )}
      </div>
      {editando && data.idEmpresa && (
        <AlterarInspecao
          idRelatorio={idRelatorio}
          idEmpresa={data.idEmpresa}
          idInspecaoAtual={data.idInspecao}
          onFechar={() => setEditando(false)}
        />
      )}
    </div>
  );
}
