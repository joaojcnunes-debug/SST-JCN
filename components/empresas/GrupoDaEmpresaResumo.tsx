"use client";

import Link from "next/link";
import { EyeOff } from "lucide-react";
import SeloGrupo from "@/components/empresas/SeloGrupo";
import { ordenarMembros, ROTULO_PAPEL } from "@/lib/empresas/grupos";
import { useGruposEmpresas } from "@/lib/hooks/useGruposEmpresas";

/**
 * Cabeçalho da empresa: o grupo dela (v278) e as outras empresas do grupo.
 * As de outra unidade aparecem sem link — sem acesso aos documentos delas.
 */
export default function GrupoDaEmpresaResumo({ idEmpresa }: { idEmpresa: string }) {
  const { porEmpresa, membrosPorGrupo } = useGruposEmpresas();
  const info = porEmpresa.get(idEmpresa);
  if (!info) return null;
  const outros = ordenarMembros((membrosPorGrupo.get(info.id_grupo) ?? []).filter((m) => m.id_empresa !== idEmpresa));

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-gray-600">
      <Link href={`/empresas/grupos?grupo=${info.id_grupo}`} title="Abrir o grupo">
        <SeloGrupo info={info} />
      </Link>
      {outros.length > 0 && <span className="text-gray-400">com</span>}
      {outros.map((m) =>
        m.visivel ? (
          <Link
            key={m.id_empresa}
            href={`/empresas/${m.id_empresa}`}
            className="rounded-full border border-gray-200 px-2 py-0.5 hover:border-verde-primary hover:text-verde-primary"
          >
            {m.nome_empresa} <span className="text-gray-400">· {ROTULO_PAPEL[m.papel_grupo]}</span>
          </Link>
        ) : (
          <span
            key={m.id_empresa}
            title={`Empresa de outra unidade (${m.unidade_nome ?? "sem unidade"}) — sem acesso aos documentos dela`}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-gray-500"
          >
            <EyeOff className="size-3" />
            {m.nome_empresa} <span className="text-gray-400">· {ROTULO_PAPEL[m.papel_grupo]} · {m.unidade_nome ?? "outra unidade"}</span>
          </span>
        ),
      )}
    </div>
  );
}
