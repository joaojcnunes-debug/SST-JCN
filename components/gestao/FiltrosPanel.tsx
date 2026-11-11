"use client";

import type React from "react";
import { useState } from "react";
import { Filter, ChevronDown, Trash2, Bookmark } from "lucide-react";
import SelectVerde from "@/components/gestao/SelectVerde";
import {
  useFiltrosSalvos, useSalvarFiltro, useExcluirFiltro, contarFiltros,
  PRIORIDADES, FILTRO_VAZIO,
  type FiltrosGestao, type GestaoStatus, type GestaoEtiqueta,
} from "@/lib/hooks/useGestao";
import { REGIOES } from "@/lib/gestao/regiao-produtos";
import type { Criador, MostrarItens, Pessoa, PrazoFiltro, SituacaoFiltro } from "@/lib/gestao/filtros";

const MOSTRAR: { value: MostrarItens; label: string }[] = [
  { value: "tarefas", label: "Só tarefas" },
  { value: "subtarefas", label: "Só subtarefas" },
  { value: "ambas", label: "Tarefas e subtarefas" },
];

const PRAZOS: { value: PrazoFiltro; label: string }[] = [
  { value: "", label: "Qualquer" },
  { value: "atrasadas", label: "Atrasadas" },
  { value: "hoje", label: "Vence hoje" },
  { value: "amanha", label: "Amanhã" },
  { value: "semana", label: "Esta semana" },
  { value: "mes", label: "Este mês" },
  { value: "sem", label: "Sem prazo" },
  { value: "periodo", label: "Período…" },
];

const SITUACOES: { value: SituacaoFiltro; label: string }[] = [
  { value: "", label: "Todas" },
  { value: "abertas", label: "Em aberto" },
  { value: "concluidas", label: "Concluídas" },
];

/** O que cada campo pode oferecer. Lista vazia = o campo não aparece. */
export interface OpcoesFiltro {
  statuses: GestaoStatus[];
  etiquetas: GestaoEtiqueta[];
  /** Nomes (Responsável). */
  usuarios: string[];
  /** Seguidor (por e-mail). */
  pessoas?: Pessoa[];
  /** Só as equipes cujos membros eu vejo (gestor, supervisor). */
  equipes?: { id: string; nome: string }[];
  /** Quem criou as tarefas da lista. */
  criadores?: Criador[];
  /** Produtos marcados nas tarefas da lista. */
  produtos?: string[];
}

function toggle(arr: string[], v: string): string[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

function Chip({ on, cor, children, onClick }: { on: boolean; cor?: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${on ? "text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
      style={on ? { background: cor ?? "#0ea5e9" } : undefined}>
      {children}
    </button>
  );
}

function Rotulo({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">{children}</label>;
}

/**
 * Os campos do filtro — os mesmos no botão "Filtros" (todas as visões) e na lateral do calendário.
 * `esconder`: campos que não valem no contexto (ex.: status no calendário de uma pessoa, que junta várias listas).
 */
export function CamposFiltro({
  filtros,
  onChange,
  opcoes,
  esconder,
}: {
  filtros: FiltrosGestao;
  onChange: (f: FiltrosGestao) => void;
  opcoes: OpcoesFiltro;
  esconder?: ReadonlySet<keyof FiltrosGestao>;
}) {
  const set = (patch: Partial<FiltrosGestao>) => onChange({ ...filtros, ...patch });
  const ve = (k: keyof FiltrosGestao) => !esconder?.has(k);
  const { statuses, etiquetas, usuarios, pessoas = [], equipes = [], criadores = [], produtos = [] } = opcoes;

  return (
    <div className="space-y-3">
      {/* 11/11/2026: tarefas, subtarefas ou as duas (v0.3.931: o seletor da barra saiu, fica só aqui). */}
      {ve("mostrar") && (
        <div>
          <Rotulo>Mostrar</Rotulo>
          <div className="flex flex-wrap gap-1.5">
            {MOSTRAR.map((m) => <Chip key={m.value} on={(filtros.mostrar ?? "tarefas") === m.value} onClick={() => set({ mostrar: m.value })}>{m.label}</Chip>)}
          </div>
        </div>
      )}

      {ve("responsavel") && (
        <div>
          <Rotulo>Responsável</Rotulo>
          {/* Lista verde (o <select> nativo abria com o destaque azul do sistema). */}
          <SelectVerde valor={filtros.responsavel} desabilitado={filtros.semResponsavel} onChange={(v) => set({ responsavel: v })}
            busca={usuarios.length > 8} placeholderBusca="Buscar pessoa…"
            opcoes={[{ value: "", label: "Todos" }, ...usuarios.map((u) => ({ value: u, label: u }))]} />
          <label className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-gray-600">
            <input type="checkbox" checked={filtros.semResponsavel} onChange={(e) => set({ semResponsavel: e.target.checked, responsavel: e.target.checked ? "" : filtros.responsavel })} className="size-3.5 rounded accent-marca-primary" /> Sem responsável
          </label>
        </div>
      )}

      {ve("equipe") && equipes.length > 0 && (
        <div>
          <Rotulo>Equipe do responsável</Rotulo>
          <SelectVerde valor={filtros.equipe} onChange={(v) => set({ equipe: v })} busca={equipes.length > 8} placeholderBusca="Buscar equipe…"
            opcoes={[{ value: "", label: "Todas" }, ...equipes.map((e) => ({ value: e.id, label: e.nome }))]} />
        </div>
      )}

      {ve("seguidor") && pessoas.length > 0 && (
        <div>
          <Rotulo>Seguidor</Rotulo>
          <SelectVerde valor={filtros.seguidor} onChange={(v) => set({ seguidor: v })} busca={pessoas.length > 8} placeholderBusca="Buscar pessoa…"
            opcoes={[{ value: "", label: "Qualquer" }, ...pessoas.map((p) => ({ value: p.email.toLowerCase(), label: p.nome }))]} />
        </div>
      )}

      {ve("criadoPor") && criadores.length > 0 && (
        <div>
          <Rotulo>Criada por</Rotulo>
          <SelectVerde valor={filtros.criadoPor} onChange={(v) => set({ criadoPor: v })} busca={criadores.length > 8} placeholderBusca="Buscar pessoa…"
            opcoes={[{ value: "", label: "Qualquer pessoa" }, ...criadores.map((c) => ({ value: c.chave, label: c.nome }))]} />
        </div>
      )}

      {ve("situacao") && (
        <div>
          <Rotulo>Situação</Rotulo>
          <div className="flex flex-wrap gap-1.5">
            {SITUACOES.map((s) => <Chip key={s.value} on={filtros.situacao === s.value} onClick={() => set({ situacao: s.value })}>{s.label}</Chip>)}
          </div>
        </div>
      )}

      {ve("prazo") && (
        <div>
          <Rotulo>Prazo</Rotulo>
          <div className="flex flex-wrap gap-1.5">
            {PRAZOS.map((p) => <Chip key={p.value} on={filtros.prazo === p.value} onClick={() => set({ prazo: p.value })}>{p.label}</Chip>)}
          </div>
          {filtros.prazo === "periodo" && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
              de
              <input type="date" value={filtros.prazoDe} onChange={(e) => set({ prazoDe: e.target.value })} className="min-w-0 flex-1 rounded-md border border-gray-200 px-1.5 py-1 text-xs text-gray-700 focus:border-marca-primary focus:outline-none" />
              até
              <input type="date" value={filtros.prazoAte} onChange={(e) => set({ prazoAte: e.target.value })} className="min-w-0 flex-1 rounded-md border border-gray-200 px-1.5 py-1 text-xs text-gray-700 focus:border-marca-primary focus:outline-none" />
            </div>
          )}
        </div>
      )}

      {ve("prioridades") && (
        <div>
          <Rotulo>Prioridade</Rotulo>
          <div className="flex flex-wrap gap-1.5">
            {PRIORIDADES.map((p) => <Chip key={p.value} on={filtros.prioridades.includes(p.value)} cor={p.cor} onClick={() => set({ prioridades: toggle(filtros.prioridades, p.value) })}>{p.label}</Chip>)}
          </div>
        </div>
      )}

      {ve("status") && statuses.length > 0 && (
        <div>
          <Rotulo>Status</Rotulo>
          <div className="flex flex-wrap gap-1.5">
            {statuses.map((s) => <Chip key={s.slug} on={filtros.status.includes(s.slug)} cor={s.cor} onClick={() => set({ status: toggle(filtros.status, s.slug) })}>{s.nome}</Chip>)}
          </div>
        </div>
      )}

      {ve("etiquetas") && etiquetas.length > 0 && (
        <div>
          <Rotulo>Etiquetas</Rotulo>
          <div className="flex flex-wrap gap-1.5">
            {etiquetas.map((e) => <Chip key={e.id} on={filtros.etiquetas.includes(e.nome)} cor={e.cor} onClick={() => set({ etiquetas: toggle(filtros.etiquetas, e.nome) })}>{e.nome}</Chip>)}
          </div>
        </div>
      )}

      {ve("regiao") && (
        <div>
          <Rotulo>Região</Rotulo>
          <div className="flex flex-wrap gap-1.5">
            {REGIOES.map((r) => <Chip key={r.tag} on={filtros.regiao === r.tag} onClick={() => set({ regiao: filtros.regiao === r.tag ? "" : r.tag })}>{r.label}</Chip>)}
          </div>
        </div>
      )}

      {ve("produtos") && produtos.length > 0 && (
        <div>
          <Rotulo>Produtos</Rotulo>
          <div className="flex flex-wrap gap-1.5">
            {produtos.map((p) => <Chip key={p} on={filtros.produtos.includes(p)} onClick={() => set({ produtos: toggle(filtros.produtos, p) })}>{p}</Chip>)}
          </div>
        </div>
      )}
    </div>
  );
}

/** Filtros salvos da pessoa nesta lista: aplicar, excluir e salvar o atual. */
export function FiltrosSalvos({
  filtros,
  onChange,
  idQuadro,
  onAplicado,
}: {
  filtros: FiltrosGestao;
  onChange: (f: FiltrosGestao) => void;
  idQuadro: string;
  onAplicado?: () => void;
}) {
  const [nomeNovo, setNomeNovo] = useState("");
  const { data: salvos = [] } = useFiltrosSalvos(idQuadro);
  const salvarFiltro = useSalvarFiltro();
  const excluirFiltro = useExcluirFiltro();
  const n = contarFiltros(filtros);
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Filtros salvos</p>
      <div className="space-y-1">
        {salvos.map((f) => (
          <div key={f.id} className="group flex items-center gap-2">
            <button type="button" onClick={() => { onChange(f.criterios); onAplicado?.(); }} className="flex min-w-0 flex-1 items-center gap-1.5 rounded px-1.5 py-1 text-sm text-gray-700 hover:bg-gray-50">
              <Bookmark className="size-3.5 text-marca-primary" /> <span className="truncate">{f.nome}</span>
            </button>
            <button type="button" onClick={() => excluirFiltro.mutate(f.id)} aria-label={`Excluir o filtro ${f.nome}`} className="text-gray-300 opacity-0 transition group-hover:opacity-100 hover:text-red-600 focus:opacity-100"><Trash2 className="size-3.5" /></button>
          </div>
        ))}
        {salvos.length === 0 && <p className="px-1.5 text-xs text-gray-400">Nenhum filtro salvo.</p>}
      </div>
      {n > 0 && (
        <div className="mt-2 flex items-center gap-1.5">
          <input value={nomeNovo} onChange={(e) => setNomeNovo(e.target.value)} placeholder="Nome do filtro…" className="min-w-0 flex-1 rounded-md border border-gray-200 px-2 py-1 text-sm focus:border-marca-primary focus:outline-none" />
          <button type="button" disabled={!nomeNovo.trim()} onClick={() => { salvarFiltro.mutate({ id_quadro: idQuadro, nome: nomeNovo.trim(), criterios: filtros }); setNomeNovo(""); }} className="rounded-md bg-marca-primary px-2.5 py-1 text-sm font-medium text-white disabled:opacity-50">Salvar</button>
        </div>
      )}
    </div>
  );
}

/** Botão "Filtros" da barra da lista (todas as visões, menos o calendário, que tem a lateral). */
export default function FiltrosPanel({
  filtros,
  onChange,
  opcoes,
  idQuadro,
}: {
  filtros: FiltrosGestao;
  onChange: (f: FiltrosGestao) => void;
  opcoes: OpcoesFiltro;
  idQuadro: string;
}) {
  const [aberto, setAberto] = useState(false);
  const n = contarFiltros(filtros);

  return (
    <div className="relative">
      <button type="button" onClick={() => setAberto((v) => !v)} className={`relative z-40 inline-flex items-center gap-1 rounded-lg border px-2.5 py-2 text-sm font-medium ${n > 0 ? "border-marca-primary bg-marca-light/60 text-marca-primary" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}>
        <Filter className="size-4" /> Filtros{n > 0 && <span className="ml-0.5 rounded-full bg-marca-primary px-1.5 text-[11px] font-bold text-white">{n}</span>}
        <ChevronDown className="size-3.5 text-gray-400" />
      </button>

      {aberto && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setAberto(false)} />
          <div className="absolute left-0 z-40 mt-1 max-h-[80vh] w-80 overflow-y-auto rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
            <CamposFiltro filtros={filtros} onChange={onChange} opcoes={opcoes} />

            <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-2">
              <button type="button" onClick={() => onChange(FILTRO_VAZIO)} className="text-xs font-medium text-gray-500 hover:text-gray-800">Limpar filtros</button>
            </div>

            <div className="mt-2 border-t border-gray-100 pt-2">
              <FiltrosSalvos filtros={filtros} onChange={onChange} idQuadro={idQuadro} onAplicado={() => setAberto(false)} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
