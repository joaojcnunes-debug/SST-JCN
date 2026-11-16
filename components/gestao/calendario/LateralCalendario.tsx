"use client";

import SelectVerde from "@/components/gestao/SelectVerde";
import { CamposFiltro, FiltrosSalvos, type OpcoesFiltro } from "@/components/gestao/FiltrosPanel";
import { FILTRO_VAZIO, contarFiltros, type FiltrosGestao, type Pessoa } from "@/lib/gestao/filtros";
import { cn } from "@/lib/utils";

/** De quem é o calendário: a lista aberta, uma pessoa ou uma equipe (12/11/2026: as três só com tarefas da lista aberta). */
export type CalDe = { tipo: "lista" } | { tipo: "pessoa"; email: string } | { tipo: "equipe"; id: string };

/**
 * Lateral do calendário (etapa 2, como no Runrun): "Calendário de" no topo e, abaixo, os filtros e os filtros
 * salvos. Os filtros são os mesmos do botão "Filtros" das outras visões (o estado é um só).
 */
export default function LateralCalendario({
  calDe,
  onCalDe,
  eu,
  pessoas,
  equipes,
  filtros,
  onFiltros,
  opcoes,
  esconder,
  idQuadro,
  nomeLista,
}: {
  calDe: CalDe;
  onCalDe: (c: CalDe) => void;
  /** Meu e-mail (a pessoa que aparece primeiro ao escolher "Pessoa"). */
  eu: string | null;
  pessoas: Pessoa[];
  /** Só as equipes cujos membros eu vejo. */
  equipes: { id: string; nome: string }[];
  filtros: FiltrosGestao;
  onFiltros: (f: FiltrosGestao) => void;
  opcoes: OpcoesFiltro;
  esconder?: ReadonlySet<keyof FiltrosGestao>;
  idQuadro: string;
  nomeLista: string;
}) {
  const abas: { tipo: CalDe["tipo"]; label: string }[] = [
    { tipo: "lista", label: "Esta lista" },
    { tipo: "pessoa", label: "Pessoa" },
    ...(equipes.length ? [{ tipo: "equipe" as const, label: "Equipe" }] : []),
  ];

  function escolher(tipo: CalDe["tipo"]) {
    if (tipo === calDe.tipo) return;
    if (tipo === "lista") onCalDe({ tipo: "lista" });
    else if (tipo === "pessoa") {
      const meu = pessoas.find((p) => p.email.toLowerCase() === (eu ?? "").toLowerCase());
      onCalDe({ tipo: "pessoa", email: (meu ?? pessoas[0])?.email.toLowerCase() ?? "" });
    } else onCalDe({ tipo: "equipe", id: equipes[0]?.id ?? "" });
  }

  const n = contarFiltros(filtros);
  const nomePessoa = calDe.tipo === "pessoa" ? pessoas.find((p) => p.email.toLowerCase() === calDe.email)?.nome : undefined;
  const nomeEquipe = calDe.tipo === "equipe" ? equipes.find((e) => e.id === calDe.id)?.nome : undefined;

  return (
    <div className="space-y-4 text-sm">
      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Calendário de</p>
        <div className="flex rounded-lg border border-gray-200 p-0.5 text-xs font-medium">
          {abas.map((a) => (
            <button
              key={a.tipo}
              type="button"
              onClick={() => escolher(a.tipo)}
              aria-pressed={calDe.tipo === a.tipo}
              className={cn("flex-1 rounded-md px-2 py-1", calDe.tipo === a.tipo ? "bg-marca-primary text-white" : "text-gray-600 hover:bg-gray-100")}
            >
              {a.label}
            </button>
          ))}
        </div>
        {calDe.tipo === "pessoa" && (
          <div className="mt-2">
            <SelectVerde valor={calDe.email} onChange={(v) => onCalDe({ tipo: "pessoa", email: v })} busca placeholderBusca="Buscar pessoa…"
              opcoes={pessoas.map((p) => ({ value: p.email.toLowerCase(), label: p.nome }))} />
          </div>
        )}
        {calDe.tipo === "equipe" && (
          <div className="mt-2">
            <SelectVerde valor={calDe.id} onChange={(v) => onCalDe({ tipo: "equipe", id: v })} busca={equipes.length > 8} placeholderBusca="Buscar equipe…"
              opcoes={equipes.map((e) => ({ value: e.id, label: e.nome }))} />
          </div>
        )}
        <p className="mt-1.5 text-xs text-gray-500">
          {calDe.tipo === "lista"
            ? <>As tarefas de <span className="font-medium text-gray-700">{nomeLista}</span>.</>
            : <>
                Cartões desta lista em que {calDe.tipo === "pessoa" ? <span className="font-medium text-gray-700">{nomePessoa ?? "a pessoa"}</span> : <>alguém da equipe <span className="font-medium text-gray-700">{nomeEquipe ?? ""}</span></>} é
                responsável, seguidor ou criou o cartão.
              </>}
        </p>
      </div>

      <div className="border-t border-gray-100 pt-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Filtros{n > 0 && <span className="ml-1 rounded-full bg-marca-primary px-1.5 text-[10px] font-bold text-white">{n}</span>}</p>
          {n > 0 && <button type="button" onClick={() => onFiltros(FILTRO_VAZIO)} className="text-xs font-medium text-gray-500 hover:text-gray-800">Limpar</button>}
        </div>
        <CamposFiltro filtros={filtros} onChange={onFiltros} opcoes={opcoes} esconder={esconder} />
      </div>

      {idQuadro && (
        <div className="border-t border-gray-100 pt-3">
          <FiltrosSalvos filtros={filtros} onChange={onFiltros} idQuadro={idQuadro} />
        </div>
      )}
    </div>
  );
}
