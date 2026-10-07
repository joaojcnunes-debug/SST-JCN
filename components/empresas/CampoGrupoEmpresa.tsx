"use client";

import { useState } from "react";
import { Network, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { grupoDaMesmaRaiz, ordenarMembros, papelPeloCnpj, ROTULO_PAPEL } from "@/lib/empresas/grupos";
import { useCriarGrupo, useGruposEmpresas } from "@/lib/hooks/useGruposEmpresas";
import type { MembroGrupo, PapelGrupo } from "@/lib/supabase/types";

export interface ValorGrupo {
  id_grupo: string | null;
  papel: PapelGrupo | null;
}

/**
 * Campo "Grupo de empresas" do cadastro (v278): em que grupo a empresa está e
 * se ela é a MATRIZ ou uma FILIAL. Dá para criar o grupo ali mesmo. O CNPJ
 * ajuda: a raiz igual à de uma empresa que já está num grupo vira sugestão, e
 * a ordem 0001 indica a matriz.
 */
export default function CampoGrupoEmpresa({
  valor,
  onChange,
  cnpj,
  idEmpresa,
  matrizAtual,
}: {
  valor: ValorGrupo;
  onChange: (v: ValorGrupo) => void;
  cnpj: string;
  idEmpresa: string | null;
  matrizAtual: MembroGrupo | null;
}) {
  const { grupos, membros, membrosPorGrupo } = useGruposEmpresas();
  const criar = useCriarGrupo();
  const [criando, setCriando] = useState(false);
  const [nomeNovo, setNomeNovo] = useState("");

  const papelCnpj = papelPeloCnpj(cnpj);
  const sugestao = !valor.id_grupo ? grupoDaMesmaRaiz(cnpj, membros, idEmpresa) : null;
  const grupoSugerido = sugestao ? grupos.find((g) => g.id_grupo === sugestao.id_grupo) : null;

  /** Ao escolher o grupo: matriz se ele ainda não tem uma, senão filial. */
  function escolher(id_grupo: string | null) {
    if (!id_grupo) return onChange({ id_grupo: null, papel: null });
    const temMatriz = (membrosPorGrupo.get(id_grupo) ?? []).some(
      (m) => m.papel_grupo === "MATRIZ" && m.id_empresa !== idEmpresa,
    );
    onChange({ id_grupo, papel: temMatriz ? "FILIAL" : "MATRIZ" });
  }

  async function criarGrupo() {
    const nome = nomeNovo.trim();
    if (!nome) return;
    const id = await criar.mutateAsync({ nome }).catch(() => null);
    if (!id) return;
    setCriando(false);
    setNomeNovo("");
    onChange({ id_grupo: id, papel: "MATRIZ" });
  }

  const outros = valor.id_grupo
    ? ordenarMembros((membrosPorGrupo.get(valor.id_grupo) ?? []).filter((m) => m.id_empresa !== idEmpresa))
    : [];

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
        <Network className="size-3.5" /> Grupo de empresas (opcional)
      </p>

      {sugestao && grupoSugerido && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-900">
          <span>
            O CNPJ tem a mesma raiz de <strong>{sugestao.nome_empresa}</strong>, do grupo{" "}
            <strong>{grupoSugerido.nome}</strong>.
          </span>
          <button
            type="button"
            onClick={() => escolher(sugestao.id_grupo)}
            className="rounded-md bg-indigo-600 px-2.5 py-1 font-semibold text-white hover:bg-indigo-700"
          >
            Colocar neste grupo
          </button>
        </div>
      )}

      {!criando ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={valor.id_grupo ?? ""}
            onChange={(e) => escolher(e.target.value || null)}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
          >
            <option value="">Não pertence a um grupo</option>
            {grupos.map((g) => (
              <option key={g.id_grupo} value={g.id_grupo}>
                {g.nome}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setCriando(true)}
            className="inline-flex shrink-0 items-center justify-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            <Plus className="size-4" /> Novo grupo
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            autoFocus
            value={nomeNovo}
            onChange={(e) => setNomeNovo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                criarGrupo();
              }
              if (e.key === "Escape") setCriando(false);
            }}
            placeholder="Nome do grupo (ex.: Grupo Mad Brew)"
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
          />
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={criarGrupo}
              disabled={!nomeNovo.trim() || criar.isPending}
              className="rounded-md bg-verde-primary px-3 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-60"
            >
              {criar.isPending ? "Criando…" : "Criar grupo"}
            </button>
            <button
              type="button"
              onClick={() => setCriando(false)}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {valor.id_grupo && (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {(["MATRIZ", "FILIAL"] as const).map((p) => (
              <label
                key={p}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm transition-colors",
                  valor.papel === p ? "border-verde-primary bg-verde-light" : "border-gray-200 bg-white hover:border-gray-300",
                )}
              >
                <input
                  type="radio"
                  name="papel-grupo"
                  checked={valor.papel === p}
                  onChange={() => onChange({ ...valor, papel: p })}
                  className="text-verde-primary focus:ring-verde-primary/30"
                />
                <span>
                  <span className="block font-semibold text-gray-900">{ROTULO_PAPEL[p]}</span>
                  <span className="block text-[11px] text-gray-500">
                    {p === "MATRIZ" ? "A empresa principal do grupo" : "Outro CNPJ do grupo"}
                  </span>
                </span>
              </label>
            ))}
          </div>

          {papelCnpj && valor.papel && papelCnpj !== valor.papel && (
            <p className="text-xs text-gray-500">
              Pelo CNPJ (ordem {papelCnpj === "MATRIZ" ? "0001" : "diferente de 0001"}), esta empresa parece ser{" "}
              {papelCnpj === "MATRIZ" ? "uma matriz" : "uma filial"}.
            </p>
          )}

          {valor.papel === "MATRIZ" && matrizAtual && (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Hoje a matriz é <strong>{matrizAtual.nome_empresa}</strong>. Ao salvar, ela passa a ser filial.
            </p>
          )}

          {outros.length > 0 && (
            <div className="text-xs text-gray-600">
              <span className="font-medium text-gray-700">
                Também no grupo ({outros.length}):
              </span>{" "}
              {outros.slice(0, 4).map((m, i) => (
                <span key={m.id_empresa}>
                  {i > 0 && ", "}
                  {m.nome_empresa}
                  <span className="text-gray-400">
                    {" "}
                    ({ROTULO_PAPEL[m.papel_grupo]}
                    {!m.visivel && ` · ${m.unidade_nome ?? "outra unidade"}`})
                  </span>
                </span>
              ))}
              {outros.length > 4 && <span className="text-gray-400"> e mais {outros.length - 4}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
