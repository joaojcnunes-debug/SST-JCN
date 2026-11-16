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
import type { Criador, MostrarItens, PapelPessoa, Pessoa, PrazoFiltro, SituacaoFiltro } from "@/lib/gestao/filtros";

const MOSTRAR: { value: MostrarItens; label: string }[] = [
  { value: "tarefas", label: "Só tarefas" },
  { value: "subtarefas", label: "Só subtarefas" },
  { value: "ambas", label: "Tarefas e subtarefas" },
];

// 12/11/2026: Responsável, Seguidor e Criada por eram três campos que se somavam (um zerava o outro). Agora é um
// campo só, "Pessoa", e o papel se escolhe nos botões — como o Mostrar.
const PAPEIS: { value: PapelPessoa; label: string; ajuda: string }[] = [
  { value: "responsavel", label: "Responsável", ajuda: "Cartões em que a pessoa é responsável." },
  { value: "seguidor", label: "Seguidor", ajuda: "Cartões que a pessoa segue." },
  { value: "criou", label: "Criada por", ajuda: "Cartões que a pessoa criou." },
  { value: "todos", label: "Os três", ajuda: "Cartões em que a pessoa é responsável, seguidora ou criou." },
];
/** Valor da opção "Sem responsável" na lista de pessoas (vira `semResponsavel`). */
const SEM_RESPONSAVEL = "__sem__";

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
  /** As pessoas do campo Pessoa (nome + e-mail). */
  pessoas?: Pessoa[];
  /** Só as equipes cujos membros eu vejo (gestor, supervisor). */
  equipes?: { id: string; nome: string }[];
  /** Quem criou as tarefas da lista (em "Criada por" entram também os do Runrun sem conta e os formulários). */
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
  const { statuses, etiquetas, pessoas = [], equipes = [], criadores = [], produtos = [] } = opcoes;

  // ── Pessoa + papel ──
  const papel = filtros.papel ?? "responsavel";
  const ajudaPapel = PAPEIS.find((p) => p.value === papel)?.ajuda;
  /** Filtro salvo antigo guardava o Responsável pelo nome ("n:<nome>"): na tela, a pessoa com esse nome. */
  const emailDoNome = (k: string) => {
    if (!k.startsWith("n:")) return k;
    const p = pessoas.find((x) => x.nome.trim() === k.slice(2).trim());
    return p ? `e:${p.email.toLowerCase()}` : k;
  };
  const criaSemConta = papel === "criou" || papel === "todos";
  const emailsPessoas = new Set(pessoas.map((p) => `e:${p.email.toLowerCase()}`));
  const opcoesPessoa = [
    { value: "", label: "Qualquer pessoa" },
    ...(papel === "responsavel" && ve("semResponsavel") ? [{ value: SEM_RESPONSAVEL, label: "Sem responsável" }] : []),
    ...pessoas.map((p) => ({ value: `e:${p.email.toLowerCase()}`, label: p.nome })),
    // Runrun sem conta no painel e formulários só criam cartão.
    ...(criaSemConta ? criadores.filter((c) => !emailsPessoas.has(c.chave)).map((c) => ({ value: c.chave, label: c.nome })) : []),
  ];
  const valorPessoa = filtros.semResponsavel ? SEM_RESPONSAVEL : emailDoNome(filtros.pessoa ?? "");
  if (valorPessoa && !opcoesPessoa.some((o) => o.value === valorPessoa)) {
    opcoesPessoa.push({ value: valorPessoa, label: valorPessoa.replace(/^[a-z]:/, "") }); // ex.: nome que saiu da lista
  }
  function escolherPessoa(v: string) {
    if (v === SEM_RESPONSAVEL) set({ semResponsavel: true, pessoa: "" });
    else set({ pessoa: v, semResponsavel: false });
  }
  function trocarPapel(novo: PapelPessoa) {
    let pessoa = emailDoNome(filtros.pessoa ?? "");
    // Runrun sem conta e formulário não são responsáveis nem seguem: a escolha sai.
    if ((novo === "responsavel" || novo === "seguidor") && /^[rf]:/.test(pessoa)) pessoa = "";
    set({ papel: novo, pessoa, semResponsavel: novo === "responsavel" && filtros.semResponsavel });
  }

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

      {ve("pessoa") && (
        <div>
          <Rotulo>Pessoa</Rotulo>
          <div className="mb-1.5 flex flex-wrap gap-1.5" role="group" aria-label="Papel da pessoa">
            {PAPEIS.map((p) => <Chip key={p.value} on={papel === p.value} onClick={() => trocarPapel(p.value)}>{p.label}</Chip>)}
          </div>
          {/* Lista verde (o <select> nativo abria com o destaque azul do sistema). */}
          <SelectVerde valor={valorPessoa} onChange={escolherPessoa} busca={opcoesPessoa.length > 8} placeholderBusca="Buscar pessoa…" opcoes={opcoesPessoa} />
          {(filtros.pessoa || filtros.semResponsavel) && (
            <p className="mt-1 text-[11px] text-gray-500">{filtros.semResponsavel ? "Cartões sem ninguém responsável." : ajudaPapel}</p>
          )}
        </div>
      )}

      {ve("equipe") && equipes.length > 0 && (
        <div>
          <Rotulo>Equipe do responsável</Rotulo>
          <SelectVerde valor={filtros.equipe} onChange={(v) => set({ equipe: v })} busca={equipes.length > 8} placeholderBusca="Buscar equipe…"
            opcoes={[{ value: "", label: "Todas" }, ...equipes.map((e) => ({ value: e.id, label: e.nome }))]} />
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
