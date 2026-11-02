"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ChevronDown, Plus, Search, Trash2, X } from "lucide-react";
import UsuarioCombobox from "@/components/gestao/UsuarioCombobox";
import { confirmar } from "@/components/ui/confirm";
import {
  useExcluirProdutoResponsavel,
  usePessoasDoQuadro,
  useProdutoResponsaveis,
  useSalvarProdutoResponsavel,
  type GestaoAutomacao,
} from "@/lib/hooks/useGestao";
import { produtosComResponsavelProprio, produtosDoQuadro, produtosRepetidos } from "@/lib/gestao/produto-responsaveis";
type Usuario = { nome: string; email: string };
import { cn } from "@/lib/utils";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Aba "Funcionários por produto" das Automações (v315 — Painel v322, 28/10/2026): cada linha liga um funcionário a
 * vários produtos. Quando a automação de checklist do produto cria as subtarefas (sem responsável na
 * própria ação), elas nascem com esse funcionário e ele é avisado. Os produtos são os que têm
 * automação de checklist neste quadro.
 */
export default function ProdutoResponsaveisAba({
  idQuadro,
  automacoes,
  usuarios,
  podeEditar,
}: {
  idQuadro: string;
  automacoes: GestaoAutomacao[];
  usuarios: Usuario[];
  podeEditar: boolean;
}) {
  const { data: linhas = [], isLoading } = useProdutoResponsaveis(idQuadro);
  const salvar = useSalvarProdutoResponsavel();
  const excluir = useExcluirProdutoResponsavel();
  const [novoEmail, setNovoEmail] = useState("");
  // v315: só quem tem acesso a este quadro em Membros e acessos  + a equipe da base; "mostrar todos" libera.
  const membros = usePessoasDoQuadro(idQuadro);
  const [todos, setTodos] = useState(false);
  const temAcesso = useMemo(() => new Set((membros.data ?? []).map((m) => m.email.toLowerCase())), [membros.data]);
  const usarTodos = todos || membros.isError || (membros.isSuccess && temAcesso.size === 0);
  const opcoes = usarTodos ? usuarios : usuarios.filter((u) => temAcesso.has(u.email?.toLowerCase()));

  const produtos = useMemo(() => produtosDoQuadro(automacoes), [automacoes]);
  const repetidos = useMemo(() => produtosRepetidos(linhas), [linhas]);
  const proprios = useMemo(() => produtosComResponsavelProprio(automacoes), [automacoes]);
  const usados = useMemo(() => new Set(linhas.flatMap((l) => l.produtos)), [linhas]);
  const semNinguem = produtos.filter((p) => !usados.has(p) && !proprios.has(p));
  const nomeDe = (email: string) => usuarios.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.nome ?? email;

  function adicionar(email: string) {
    if (!email) return;
    salvar.mutate({ id_quadro: idQuadro, usuario_email: email, produtos: [], ordem: linhas.length });
    setNovoEmail("");
  }

  if (produtos.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">
        Este quadro não tem automações de checklist por produto (criar subtarefas a partir de modelo, com a condição
        &quot;Produtos contém …&quot;). Crie-as na aba Regras.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Escolha o <strong>funcionário</strong> e os <strong>produtos</strong> dele. Quando chegar uma tarefa com esses
        produtos, as subtarefas de cada um já nascem com o funcionário ligado, e ele é avisado. Vale para as tarefas
        novas.
      </p>

      <div className="space-y-2">
        {isLoading && <p className="text-sm text-gray-400">Carregando…</p>}
        {linhas.map((l) => (
          <div key={l.id} className="flex flex-wrap items-start gap-2 rounded-lg border border-gray-100 p-2">
            <div className="w-full min-w-[14rem] sm:w-64">
              <UsuarioCombobox
                // as opções de troca seguem o filtro; a pessoa atual entra sempre, para o nome aparecer
                usuarios={[...opcoes, ...usuarios.filter((u) => u.email?.toLowerCase() === l.usuario_email.toLowerCase() && !opcoes.includes(u))]}
                value={l.usuario_email}
                onChange={(email) => email && salvar.mutate({ id: l.id, id_quadro: idQuadro, usuario_email: email })}
                disabled={!podeEditar}
                placeholder="Funcionário"
                className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
              />
            </div>
            <div className="min-w-[14rem] flex-1">
              <ProdutosPicker
                opcoes={produtos}
                value={l.produtos}
                repetidos={repetidos}
                disabled={!podeEditar}
                onChange={(p) => salvar.mutate({ id: l.id, id_quadro: idQuadro, produtos: p })}
              />
            </div>
            {podeEditar && (
              <button
                type="button"
                title="Tirar este funcionário"
                onClick={async () => {
                  if (await confirmar({ title: `Tirar ${nomeDe(l.usuario_email)}?`, description: "As subtarefas novas desses produtos ficam sem responsável (as já criadas não mudam).", variant: "danger" })) excluir.mutate(l.id);
                }}
                className="flex size-8 shrink-0 items-center justify-center rounded-md text-gray-300 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </div>
        ))}

        {podeEditar && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-gray-300 p-2">
            <Plus className="size-4 text-gray-400" />
            <div className="w-full min-w-[14rem] sm:w-64">
              <UsuarioCombobox
                usuarios={opcoes.filter((u) => !linhas.some((l) => l.usuario_email.toLowerCase() === u.email?.toLowerCase()))}
                value={novoEmail}
                onChange={adicionar}
                placeholder="Adicionar funcionário…"
                className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
              />
            </div>
            <span className="text-[11px] text-gray-400">
              {usarTodos
                ? "todos os usuários"
                : `${opcoes.length} pessoa(s) desta base em Membros e acessos`}
              {" · "}
              {!membros.isError && temAcesso.size > 0 && (
                <button type="button" onClick={() => setTodos((v) => !v)} className="font-medium text-marca-primary hover:underline">
                  {todos ? "só quem tem acesso ao quadro" : "mostrar todos"}
                </button>
              )}
              {" · depois marque os produtos ao lado"}
            </span>
          </div>
        )}
      </div>

      {repetidos.size > 0 && (
        <p className="flex items-start gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {[...repetidos].join(", ")} {repetidos.size === 1 ? "está" : "estão"} em mais de um funcionário: vale o de cima.
        </p>
      )}
      {proprios.size > 0 && (
        <p className="text-[11px] text-gray-500">
          Com responsável marcado na própria automação (vale esse, não a tabela):{" "}
          {[...proprios].map(([p, e]) => `${p} → ${nomeDe(e)}`).join(" · ")}
        </p>
      )}
      {semNinguem.length > 0 && (
        <p className="text-[11px] text-gray-400">Sem funcionário: {semNinguem.join(", ")}.</p>
      )}
    </div>
  );
}

/** Vários produtos, com busca: os marcados viram etiquetas; a lista abre com caixinhas. */
function ProdutosPicker({
  opcoes,
  value,
  onChange,
  repetidos,
  disabled,
}: {
  opcoes: string[];
  value: string[];
  onChange: (v: string[]) => void;
  repetidos: Set<string>;
  disabled?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  const lista = opcoes.filter((o) => !busca.trim() || norm(o).includes(norm(busca.trim())));
  const alternar = (p: string) => onChange(value.includes(p) ? value.filter((x) => x !== p) : [...value, p]);

  return (
    <div
      ref={raiz}
      className="relative"
      // Esc fecha só a lista. O preventDefault avisa o Modal (components/ui/Modal) para não fechar junto.
      onKeyDown={(e) => {
        if (e.key === "Escape" && aberto) {
          e.preventDefault();
          setAberto(false);
        }
      }}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => setAberto((a) => !a)}
        className="flex min-h-[2.125rem] w-full flex-wrap items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-left text-sm disabled:opacity-60"
      >
        {value.length === 0 && <span className="text-gray-400">Produtos…</span>}
        {value.map((p) => (
          <span key={p} className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]", repetidos.has(p) ? "bg-amber-100 text-amber-800" : "bg-marca-light text-gray-800")}>
            {p}
            {!disabled && (
              <span
                role="button"
                aria-label={`Tirar ${p}`}
                onClick={(e) => {
                  e.stopPropagation();
                  alternar(p);
                }}
                className="text-gray-500 hover:text-gray-800"
              >
                <X className="size-3" />
              </span>
            )}
          </span>
        ))}
        <ChevronDown className="ml-auto size-4 shrink-0 text-gray-500" />
      </button>
      {aberto && (
        <div className="absolute left-0 z-30 mt-1 w-full min-w-[16rem] rounded-md border border-gray-200 bg-white p-1 shadow-lg">
          <div className="relative mb-1">
            <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" />
            <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produto…" className="w-full rounded border border-gray-200 py-1 pl-7 pr-2 text-sm focus:border-marca-primary focus:outline-none" />
          </div>
          <div className="max-h-56 overflow-auto">
            {lista.map((p) => (
              <label key={p} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-gray-700 hover:bg-gray-50">
                <input type="checkbox" checked={value.includes(p)} onChange={() => alternar(p)} className="size-4 rounded border-gray-300 text-marca-primary" />
                <span className="flex-1">{p}</span>
              </label>
            ))}
            {lista.length === 0 && <p className="px-2 py-2 text-xs text-gray-400">Nenhum produto.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
