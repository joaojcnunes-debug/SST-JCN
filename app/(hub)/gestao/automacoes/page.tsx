"use client";

// 11/11/2026 — Página Automações: todas as automações de todos os quadros, cada uma em português simples.
// Só para a função T.I (pedido do usuário: "apenas a galera do TI e o João Jefferson" — ele é da função TI).
// Daqui: "Editar" abre a regra na janela de Automações do quadro dela; "Nova automação" cria a regra já ligada
// ao quadro e à situação escolhidos (nasce desligada, como na janela) e abre para completar.

import Link from "next/link";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { ArrowLeft, Pencil, Plus, Search, Workflow } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useUserStore } from "@/lib/store";
import Modal from "@/components/ui/Modal";
import AutomacoesManagerModal from "@/components/gestao/AutomacoesManagerModal";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { mensagemErro } from "@/lib/errors";
import { useCamposQuadro, useQuadros, useStatusQuadro, useUsuarios } from "@/lib/hooks/useGestao";
import { acoesDaRegra, regraCompleta } from "@/lib/gestao/automacao-completa";
import { GATILHOS, GRUPOS_GATILHO, descreverRegra } from "@/lib/gestao/automacao-descricao";
import { nomesDoQuadro, useNomesAutomacao, useTodasAutomacoes } from "@/lib/hooks/useAutomacoesTodas";
import { normalizarTexto } from "@/lib/busca/texto";

const sel = "rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm focus:border-marca-primary focus:outline-none";
const EMPTY: { nome: string; email: string }[] = [];

/** A janela de Automações precisa das etapas e campos do quadro: carrega aqui, só do quadro aberto. */
function EditorDoQuadro({ idQuadro, focoId, onClose }: { idQuadro: string; focoId: string | null; onClose: () => void }) {
  const { data: statuses = [] } = useStatusQuadro(idQuadro);
  const { data: campos = [] } = useCamposQuadro(idQuadro);
  return <AutomacoesManagerModal open onClose={onClose} idQuadro={idQuadro} statuses={statuses} campos={campos} podeEditar focoId={focoId} />;
}

export default function AutomacoesPage() {
  const user = useUserStore((s) => s.user);
  // JCN: além da função TI (do Painel), o perfil Admin também abre.
  const ehTi = (user?.funcao ?? "") === "TI" || user?.perfil === "Admin";
  const qc = useQueryClient();
  const { data: quadros = [] } = useQuadros();
  const { data: regras = [], isLoading } = useTodasAutomacoes(ehTi);
  const { data: nomesBase } = useNomesAutomacao(ehTi);
  const { data: usuarios = EMPTY } = useUsuarios();

  const [quadroFiltro, setQuadroFiltro] = useState("");
  const [grupoFiltro, setGrupoFiltro] = useState("");
  const [soAtivas, setSoAtivas] = useState(false);
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<{ idQuadro: string; focoId: string | null } | null>(null);
  const [nova, setNova] = useState<{ idQuadro: string; gatilho: string; nome: string } | null>(null);
  const [criando, setCriando] = useState(false);

  const nomeQuadro = useMemo(() => Object.fromEntries(quadros.map((q) => [q.id_quadro, q.nome])), [quadros]);
  const pessoas = useMemo(() => Object.fromEntries(usuarios.map((u) => [u.email.toLowerCase(), u.nome])), [usuarios]);
  const grupoDe = useMemo(() => Object.fromEntries(GATILHOS.map((g) => [g.value, g.grupo])), []);

  // Por quadro, na ordem em que rodam (ordem; empate: nome) — o número é o mesmo da janela do quadro.
  const blocos = useMemo(() => {
    const porQuadro = new Map<string, typeof regras>();
    for (const r of regras) {
      const l = porQuadro.get(r.id_quadro) ?? [];
      l.push(r);
      porQuadro.set(r.id_quadro, l);
    }
    const termos = normalizarTexto(busca).split(/\s+/).filter(Boolean);
    return [...porQuadro.entries()]
      .map(([id, l]) => {
        const ordenadas = [...l].sort((x, y) => (x.ordem - y.ordem) || x.nome.localeCompare(y.nome, "pt-BR"));
        const nomes = nomesDoQuadro(id, nomesBase, nomeQuadro, pessoas);
        const itens = ordenadas.map((r, i) => {
          const acoes = acoesDaRegra(r);
          const completa = regraCompleta(r.gatilho, r.condicao, acoes);
          const resumo = descreverRegra({ gatilho: r.gatilho, condicao: r.condicao as never, acoes: acoes as never }, nomes);
          return { r, numero: i + 1, ativa: r.ativo && completa, completa, resumo };
        }).filter((x) => (!soAtivas || x.ativa)
          && (!grupoFiltro || grupoDe[x.r.gatilho] === grupoFiltro)
          && (termos.length === 0 || termos.every((t) => normalizarTexto(`${x.r.nome} ${x.resumo}`).includes(t))));
        return { id, nome: nomeQuadro[id] ?? id, total: l.length, itens };
      })
      .filter((b) => (!quadroFiltro || b.id === quadroFiltro) && b.itens.length > 0)
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [regras, busca, nomesBase, nomeQuadro, pessoas, soAtivas, grupoFiltro, grupoDe, quadroFiltro]);

  const totalVisiveis = blocos.reduce((s, b) => s + b.itens.length, 0);

  const criar = async () => {
    if (!nova?.idQuadro || !nova.gatilho) return;
    setCriando(true);
    try {
      const sb = createSupabaseBrowserClient();
      const id = crypto.randomUUID();
      const maior = Math.max(0, ...regras.filter((r) => r.id_quadro === nova.idQuadro).map((r) => r.ordem));
      const { error } = await sb.from("gestao_automacoes").insert({
        id, id_quadro: nova.idQuadro, nome: nova.nome.trim() || "Nova automação", ativo: false,
        gatilho: nova.gatilho, condicao: {}, acoes: [{ id: crypto.randomUUID().slice(0, 8) }], ordem: maior + 10,
      } as never);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["gestao-automacoes"] });
      setEditando({ idQuadro: nova.idQuadro, focoId: id });
      setNova(null);
      toast.success("Automação criada — complete as ações e marque Ativa.");
    } catch (e) {
      toast.error(mensagemErro(e));
    } finally {
      setCriando(false);
    }
  };

  if (!ehTi) {
    return (
      <div className="min-h-screen bg-app-bg">
        <div className="mx-auto max-w-3xl px-5 py-10">
          <Link href="/gestao" className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"><ArrowLeft className="size-4" /> Gestão</Link>
          <p className="text-sm text-gray-600">Esta página é só da equipe de T.I.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app-bg">
      <div className="mx-auto max-w-6xl px-5 py-7 sm:px-8">
        <Link href="/gestao" className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
          <ArrowLeft className="size-4" /> Gestão
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-marca-light text-marca-primary"><Workflow className="size-6" /></span>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Automações</h1>
              <p className="text-sm text-gray-500">O que cada automação faz, em todos os quadros — {regras.length} automações em {new Set(regras.map((r) => r.id_quadro)).size} quadros</p>
            </div>
          </div>
          <button type="button" onClick={() => setNova({ idQuadro: quadroFiltro, gatilho: "", nome: "" })}
            className="inline-flex items-center gap-1.5 rounded-lg bg-marca-primary px-3 py-2 text-sm font-semibold text-white hover:bg-marca-primary/90">
            <Plus className="size-4" /> Nova automação
          </button>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <label className="relative min-w-[14rem] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pelo nome ou pelo que ela faz…" className={`${sel} w-full pl-8`} />
          </label>
          <select value={quadroFiltro} onChange={(e) => setQuadroFiltro(e.target.value)} className={sel}>
            <option value="">Todos os quadros</option>
            {[...quadros].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).filter((q) => regras.some((r) => r.id_quadro === q.id_quadro)).map((q) => <option key={q.id_quadro} value={q.id_quadro}>{q.nome}</option>)}
          </select>
          <select value={grupoFiltro} onChange={(e) => setGrupoFiltro(e.target.value)} className={sel}>
            <option value="">Todas as situações</option>
            {GRUPOS_GATILHO.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <label className="inline-flex items-center gap-1.5 text-sm text-gray-600">
            <input type="checkbox" checked={soAtivas} onChange={(e) => setSoAtivas(e.target.checked)} className="size-4 rounded accent-marca-primary" /> Só ativas
          </label>
        </div>
        {(busca || quadroFiltro || grupoFiltro || soAtivas) && <p className="mt-2 text-xs text-gray-500">{totalVisiveis} automações com esse filtro</p>}

        {isLoading ? (
          <p className="mt-8 text-sm text-gray-500">Carregando…</p>
        ) : blocos.length === 0 ? (
          <p className="mt-8 text-sm text-gray-500">Nenhuma automação com esse filtro.</p>
        ) : (
          <div className="mt-5 space-y-6">
            {blocos.map((b) => (
              <section key={b.id}>
                <h2 className="mb-2 flex items-center gap-2 border-b border-gray-200 pb-1 text-sm font-bold uppercase tracking-wide text-gray-600">
                  {b.nome} <span className="font-normal normal-case tracking-normal text-gray-400">({b.total})</span>
                </h2>
                <ul className="space-y-1.5">
                  {b.itens.map(({ r, numero, ativa, completa, resumo }) => (
                    <li key={r.id} className={`flex items-start gap-3 rounded-lg border bg-white px-3 py-2 ${completa ? "border-gray-200" : "border-amber-300"}`}>
                      <span className="mt-0.5 inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 px-1.5 text-xs font-bold text-gray-600" title="Ordem em que roda neste quadro">{numero}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-800">{r.nome}</p>
                        <p className="mt-0.5 text-sm text-gray-600">{resumo}</p>
                        <p className="mt-0.5 text-[11px] text-gray-400">{grupoDe[r.gatilho] ?? "Outro"}{!completa ? " · incompleta (não roda)" : ""}</p>
                      </div>
                      <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${ativa ? "bg-marca-light text-marca-primary" : "bg-gray-100 text-gray-500"}`}>{ativa ? "Ativa" : "Desligada"}</span>
                      <button type="button" onClick={() => setEditando({ idQuadro: r.id_quadro, focoId: r.id })}
                        className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-marca-primary ring-1 ring-marca-primary/30 hover:bg-marca-light/40">
                        <Pencil className="size-3.5" /> Editar
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      {editando && <EditorDoQuadro idQuadro={editando.idQuadro} focoId={editando.focoId} onClose={() => setEditando(null)} />}

      <Modal open={!!nova} onClose={() => setNova(null)} title="Nova automação" size="md">
        {nova && (
          <div className="space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">Quadro</span>
              <select value={nova.idQuadro} onChange={(e) => setNova({ ...nova, idQuadro: e.target.value })} className={`${sel} w-full`}>
                <option value="">Escolha o quadro…</option>
                {[...quadros].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map((q) => <option key={q.id_quadro} value={q.id_quadro}>{q.nome}</option>)}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">Situação — quando ela começa</span>
              <select value={nova.gatilho} onChange={(e) => setNova({ ...nova, gatilho: e.target.value })} className={`${sel} w-full`}>
                <option value="">Escolha a situação…</option>
                {GRUPOS_GATILHO.map((g) => (
                  <optgroup key={g} label={g}>
                    {GATILHOS.filter((x) => x.grupo === g).map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">Nome</span>
              <input value={nova.nome} onChange={(e) => setNova({ ...nova, nome: e.target.value })} placeholder="Ex.: Procuração concluída · vai para Aguardando Agendamento" className={`${sel} w-full`} />
            </label>
            <p className="text-xs text-gray-500">Ela nasce desligada. A janela de Automações do quadro abre em seguida para você escolher as condições e o que ela faz, e marcar Ativa.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setNova(null)} className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancelar</button>
              <button type="button" disabled={!nova.idQuadro || !nova.gatilho || criando} onClick={criar}
                className="rounded-lg bg-marca-primary px-3 py-2 text-sm font-semibold text-white hover:bg-marca-primary/90 disabled:opacity-50">
                {criando ? "Criando…" : "Criar e abrir"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
