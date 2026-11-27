"use client";

// Consolidação › Intervenções (0.3.233, banco v321): o catálogo da etapa Intervenções da Conciliação.
// Nasceu da planilha do setor Psicossocial. Quem libera altera, insere e exclui.
// 0.3.240 (banco v327): modalidades e responsáveis são listas abertas. O que for inserido na etapa
// Intervenções da Conciliação também aparece aqui.

// 0.3.241: cada coluna se edita na própria linha. Nome e observação viram campo ao clicar;
// Modalidades e Responsável são listas suspensas para marcar, desmarcar ou inserir, gravando na hora.
// 0.3.242 (banco v328): o título de cada coluna é uma lista com todos os tópicos dela, onde se insere
// outro. Modalidade e responsável inseridos ali ficam guardados mesmo antes de entrar numa intervenção.

import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { BookOpenText, ChevronDown, FilterX, HeartHandshake, Loader2, Pencil, Plus, Search, Star, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";
import Badge from "@/components/ui/Badge";
import Dica from "@/components/ui/Dica";
import Modal from "@/components/ui/Modal";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { ConfirmHost, confirmar } from "@/components/ui/confirm";
import { DICAS_COMERCIAL_INTERVENCAO } from "@/lib/dicas/comercial";
import {
  MODALIDADES,
  acharNaLista,
  comOpcao,
  contarUsos,
  normalizarOpcao,
  opcoesDoCatalogo,
  type ColunaTopico,
  type TopicoIntervencao,
} from "@/lib/comercial/liberacao";
import {
  useAtualizarIntervencaoNaLinha,
  useCatalogoIntervencoes,
  useCriarIntervencaoNoCatalogo,
  useExcluirTopico,
  useInserirTopico,
  useTopicosIntervencao,
  useExcluirIntervencao,
  useMetodosModalidade,
  usePodeLiberarServicos,
  useSalvarIntervencao,
  type IntervencaoCatalogo,
} from "@/lib/hooks/useComercial";
import { cn } from "@/lib/utils";
import MetodosModalidade from "@/components/psico-consolidacao/MetodosModalidade";
import { CAMPOS_METODO, metodoDe, rotuloModalidade, type MetodoTexto } from "@/lib/comercial/plano";
import { buscar } from "@/lib/busca/texto";
import { TABELA_GRADE } from "@/components/ui/tabela-grade";

const inputCls =
  "w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 focus:border-marca-primary focus:outline-none focus:ring-2 focus:ring-marca-primary/20";

type Forma = Omit<IntervencaoCatalogo, "id_intervencao"> & { id_intervencao?: string };

export default function IntervencoesPage() {
  const { data: catalogo = [], isLoading, error } = useCatalogoIntervencoes();
  const excluir = useExcluirIntervencao();
  const pode = usePodeLiberarServicos();
  const atualizar = useAtualizarIntervencaoNaLinha();
  const criar = useCriarIntervencaoNoCatalogo();
  const { data: topicos = [] } = useTopicosIntervencao();
  const inserirTopico = useInserirTopico();
  const excluirTopico = useExcluirTopico();
  const [forma, setForma] = useState<Forma | null>(null);
  const opcoes = opcoesDoCatalogo(catalogo, topicos);
  // 0.3.330 (pedido do João): busca e filtros, para o catálogo crescer sem se perder.
  const [busca, setBusca] = useState("");
  const [filtroModalidade, setFiltroModalidade] = useState("");
  const [filtroResponsavel, setFiltroResponsavel] = useState("");
  const [situacao, setSituacao] = useState<"todas" | "ativas" | "inativas">("todas");
  // 0.3.330: as intervenções com o método aberto.
  const [abertas, setAbertas] = useState<Set<string>>(new Set());
  const { data: metodosModalidade = [] } = useMetodosModalidade();
  const achadas = busca.trim() ? new Set(buscar(catalogo, busca, (i) => [i.nome, i.observacao]).itens.map((i) => i.id_intervencao)) : null;
  const visiveis = catalogo.filter(
    (i) =>
      (!achadas || achadas.has(i.id_intervencao)) &&
      (!filtroModalidade || acharNaLista(i.modalidades, filtroModalidade) !== undefined) &&
      (!filtroResponsavel || acharNaLista(i.responsaveis, filtroResponsavel) !== undefined) &&
      (situacao === "todas" || (situacao === "ativas" ? i.ativo : !i.ativo)),
  );
  const filtrando = !!(busca.trim() || filtroModalidade || filtroResponsavel || situacao !== "todas");
  const alternar = (id: string) =>
    setAbertas((a) => {
      const n = new Set(a);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  /** Os itens da lista do título: cada opção com o uso nas intervenções e o tópico guardado, se houver. */
  const itensDaColuna = (coluna: ColunaTopico, valores: string[], listas: string[][]): ItemColuna[] =>
    valores.map((valor) => ({
      valor,
      usos: contarUsos(listas, valor),
      topico: topicos.find((t) => t.coluna === coluna && acharNaLista([t.valor], valor) !== undefined),
      fixo: coluna === "MODALIDADE" && acharNaLista(MODALIDADES, valor) !== undefined,
    }));

  if (!pode) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-10 text-center text-sm text-gray-600">
        O catálogo de intervenções é mantido por quem edita (Admin ou Técnico).
      </p>
    );
  }
  if (isLoading) return <LoadingSkeleton rows={6} />;
  if (error) {
    return <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">Não foi possível carregar o catálogo. Tente de novo.</p>;
  }

  async function remover(i: IntervencaoCatalogo) {
    const ok = await confirmar({
      title: "Excluir esta intervenção?",
      description: `${i.nome} sai do catálogo. Os riscos em que ela já foi indicada continuam com o nome gravado.`,
      confirmLabel: "Excluir",
      variant: "danger",
    });
    if (ok) excluir.mutate(i.id_intervencao);
  }

  const proximaOrdem = catalogo.reduce((m, i) => Math.max(m, i.ordem), 0) + 1;

  return (
    <div className="space-y-4">
      <ConfirmHost />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <HeartHandshake className="size-5 text-marca-primary" /> Intervenções
          </h1>
          <p className="max-w-3xl text-sm text-gray-500">
            O que pode ser indicado aos riscos na Conciliação DRPS/QPS × AEP, com as modalidades e os responsáveis de cada uma. O título de
            cada coluna abre a lista dela, para inserir um tópico novo. Na linha, clique no nome ou na observação para alterar, e abra
            Modalidades ou Responsável para marcar, desmarcar ou inserir. Tudo grava na hora, e o que for inserido na Conciliação também
            aparece aqui.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setForma({ nome: "", modalidades: [], observacao: "", responsaveis: [], ativo: true, ordem: proximaOrdem })}
          className="inline-flex items-center gap-1.5 rounded-lg bg-marca-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-marca-accent"
        >
          <Plus className="size-4" /> Nova intervenção
        </button>
      </div>

      {/* 0.3.330: busca e filtros. */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-3">
        <label className="min-w-[16rem] flex-1 text-xs font-semibold text-gray-600">
          Buscar
          <span className="relative mt-1 block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou observação da intervenção…" className={cn(inputCls, "pl-8")} />
          </span>
        </label>
        <label className="w-44 text-xs font-semibold text-gray-600">
          Modalidade
          <select value={filtroModalidade} onChange={(e) => setFiltroModalidade(e.target.value)} className={cn(inputCls, "mt-1")}>
            <option value="">Todas</option>
            {opcoes.modalidades.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <label className="w-56 text-xs font-semibold text-gray-600">
          Responsável
          <select value={filtroResponsavel} onChange={(e) => setFiltroResponsavel(e.target.value)} className={cn(inputCls, "mt-1")}>
            <option value="">Todos</option>
            {opcoes.responsaveis.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label className="w-36 text-xs font-semibold text-gray-600">
          Situação
          <select value={situacao} onChange={(e) => setSituacao(e.target.value as typeof situacao)} className={cn(inputCls, "mt-1")}>
            <option value="todas">Todas</option>
            <option value="ativas">Ativas</option>
            <option value="inativas">Inativas</option>
          </select>
        </label>
        <div className="flex items-center gap-3 pb-1.5 text-xs text-gray-500">
          <span>{visiveis.length} de {catalogo.length}</span>
          {filtrando && (
            <button type="button" onClick={() => { setBusca(""); setFiltroModalidade(""); setFiltroResponsavel(""); setSituacao("todas"); }}
              className="inline-flex items-center gap-1 font-medium text-marca-primary hover:underline">
              <FilterX className="size-3.5" /> Limpar
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className={cn(TABELA_GRADE, "w-full min-w-[760px] text-sm")}>
          <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-600">
            <tr>
              <th className="px-3 py-2">
                <ListaDaColuna
                  titulo="Intervenção"
                  itens={catalogo.map((i) => ({ valor: i.nome }))}
                  rotuloNovo="Nova intervenção"
                  onInserir={(nome) => criar.mutateAsync({ nome, modalidades: [], responsaveis: [], ordem: proximaOrdem })}
                />
              </th>
              <th className="w-48 px-3 py-2">
                <ListaDaColuna
                  titulo="Modalidades"
                  itens={itensDaColuna("MODALIDADE", opcoes.modalidades, catalogo.map((i) => i.modalidades))}
                  rotuloNovo="Nova modalidade"
                  onInserir={(valor) => inserirTopico.mutateAsync({ coluna: "MODALIDADE", valor })}
                  onExcluir={(t) => excluirTopico.mutateAsync(t)}
                />
              </th>
              <th className="w-64 px-3 py-2">
                <ListaDaColuna
                  titulo="Responsável"
                  itens={itensDaColuna("RESPONSAVEL", opcoes.responsaveis, catalogo.map((i) => i.responsaveis))}
                  rotuloNovo="Novo responsável"
                  onInserir={(valor) => inserirTopico.mutateAsync({ coluna: "RESPONSAVEL", valor })}
                  onExcluir={(t) => excluirTopico.mutateAsync(t)}
                />
              </th>
              <th className="w-44 px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visiveis.map((i) => (
              <Fragment key={i.id_intervencao}>
              <tr className={cn("align-top", !i.ativo && "opacity-60")}>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <TextoNaLinha
                      valor={i.nome}
                      obrigatorio
                      ariaLabel={`Nome da intervenção ${i.nome}`}
                      className="font-medium text-gray-900"
                      onGravar={(nome) => atualizar.mutate({ idIntervencao: i.id_intervencao, campos: { nome } })}
                    />
                    {!i.ativo && <Badge variant="muted">inativa</Badge>}
                  </div>
                  <TextoNaLinha
                    valor={i.observacao ?? ""}
                    vazio="+ observação"
                    ariaLabel={`Observação de ${i.nome}`}
                    className="text-xs text-gray-500"
                    onGravar={(obs) => atualizar.mutate({ idIntervencao: i.id_intervencao, campos: { observacao: obs || null } })}
                  />
                  {/* 0.3.330: o texto do método desta intervenção (por modalidade). */}
                  <button type="button" onClick={() => alternar(i.id_intervencao)} aria-expanded={abertas.has(i.id_intervencao)}
                    className="mt-1 inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-800 hover:bg-indigo-100">
                    <BookOpenText className="size-3" /> Método
                    <span className="text-indigo-600">· {resumoMetodo(i)}</span>
                    <ChevronDown className={cn("size-3 transition", abertas.has(i.id_intervencao) && "rotate-180")} />
                  </button>
                </td>
                <td className="px-3 py-2">
                  <ListaNaLinha
                    marcadas={i.modalidades}
                    opcoes={opcoes.modalidades}
                    rotuloNovo="Nova modalidade"
                    ariaLabel={`Modalidades de ${i.nome}`}
                    onMudar={(modalidades) => atualizar.mutateAsync({ idIntervencao: i.id_intervencao, campos: { modalidades } })}
                  />
                </td>
                <td className="px-3 py-2">
                  <ListaNaLinha
                    marcadas={i.responsaveis}
                    opcoes={opcoes.responsaveis}
                    rotuloNovo="Novo responsável"
                    ariaLabel={`Responsáveis de ${i.nome}`}
                    comPadrao
                    onMudar={(responsaveis) => atualizar.mutateAsync({ idIntervencao: i.id_intervencao, campos: { responsaveis } })}
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setForma({ ...i, observacao: i.observacao ?? "" })}
                      className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                    >
                      <Pencil className="size-3.5" /> Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => remover(i)}
                      disabled={excluir.isPending}
                      className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-60"
                    >
                      <Trash2 className="size-3.5" /> Excluir
                    </button>
                  </div>
                </td>
              </tr>
              {abertas.has(i.id_intervencao) && (
                <tr>
                  <td colSpan={4} className="bg-indigo-50/30 px-3 py-3 !text-left">
                    <MetodoNoCatalogo i={i} padroes={metodosModalidade}
                      onGravar={(metodos) => atualizar.mutate({ idIntervencao: i.id_intervencao, campos: { metodos } })} />
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
            {visiveis.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-10 text-center text-sm text-gray-500">
                  {catalogo.length === 0 ? "Nenhuma intervenção no catálogo." : "Nenhuma intervenção com esses filtros."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 0.3.321: o texto padrão de cada método, para o Plano de intervenções da conciliação. */}
      <MetodosModalidade modalidades={opcoes.modalidades} podeEditar={pode} />

      {forma && <JanelaIntervencao inicial={forma} catalogo={catalogo} onFechar={() => setForma(null)} />}
    </div>
  );
}

/** Texto que vira campo ao clicar. Enter ou sair do campo grava; Esc desiste. */
function TextoNaLinha({
  valor,
  vazio,
  obrigatorio,
  ariaLabel,
  className,
  onGravar,
}: {
  valor: string;
  vazio?: string;
  obrigatorio?: boolean;
  ariaLabel: string;
  className?: string;
  onGravar: (v: string) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(valor);
  const terminou = useRef(false);

  function terminar(gravar: boolean) {
    if (terminou.current) return;
    terminou.current = true;
    setEditando(false);
    const t = texto.trim();
    if (gravar && t !== valor.trim() && (t || !obrigatorio)) onGravar(t);
  }

  if (editando) {
    return (
      <input
        autoFocus
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={() => terminar(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") terminar(true);
          if (e.key === "Escape") terminar(false);
        }}
        aria-label={ariaLabel}
        className={cn(inputCls, "py-1")}
      />
    );
  }
  return (
    <button
      type="button"
      title="Clique para alterar"
      aria-label={ariaLabel}
      onClick={() => {
        terminou.current = false;
        setTexto(valor);
        setEditando(true);
      }}
      className={cn("block max-w-full rounded px-1 -mx-1 text-left hover:bg-gray-100", !valor && "text-marca-primary", className)}
    >
      {valor || vazio}
    </button>
  );
}

/**
 * Caixa que abre abaixo do botão (ou acima, sem espaço embaixo) em posição fixa: a tabela tem rolagem
 * própria e cortaria uma caixa absoluta. Fecha ao clicar fora, rolar a página, mudar o tamanho ou com Esc.
 */
function useCaixaFixa() {
  const [aberto, setAberto] = useState(false);
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number }>({ left: 0 });
  const botao = useRef<HTMLButtonElement>(null);
  const caixa = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!aberto || !botao.current) return;
    const r = botao.current.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.left, window.innerWidth - 296));
    setPos(window.innerHeight - r.bottom < 320 && r.top > 320 ? { left, bottom: window.innerHeight - r.top + 4 } : { left, top: r.bottom + 4 });
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (!caixa.current?.contains(alvo) && !botao.current?.contains(alvo)) setAberto(false);
    };
    const fechar = (e: Event) => {
      if (!caixa.current?.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    window.addEventListener("scroll", fechar, true);
    window.addEventListener("resize", fechar);
    return () => {
      document.removeEventListener("mousedown", fora);
      window.removeEventListener("scroll", fechar, true);
      window.removeEventListener("resize", fechar);
    };
  }, [aberto]);

  const estilo: React.CSSProperties = { position: "fixed", left: pos.left, top: pos.top, bottom: pos.bottom };
  const teclas = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setAberto(false);
      botao.current?.focus();
    }
  };
  return { aberto, setAberto, botao, caixa, estilo, teclas };
}

interface ItemColuna {
  valor: string;
  /** Em quantas intervenções aparece; sem número, não se aplica (a própria intervenção). */
  usos?: number;
  /** Só o tópico inserido pelo título e fora de qualquer intervenção pode sair daqui. */
  topico?: TopicoIntervencao;
  /** Das três modalidades de partida: fica sempre. */
  fixo?: boolean;
}

/**
 * Lista suspensa no título da coluna (0.3.242): todos os tópicos daquela coluna e o campo para inserir
 * outro. Em Modalidades e Responsável o tópico novo fica guardado mesmo antes de estar em alguma
 * intervenção (banco v328); em Intervenção, inserir cria a linha no catálogo.
 */
function ListaDaColuna({
  titulo,
  itens,
  rotuloNovo,
  onInserir,
  onExcluir,
}: {
  titulo: string;
  itens: ItemColuna[];
  rotuloNovo: string;
  onInserir: (valor: string) => Promise<unknown>;
  onExcluir?: (t: TopicoIntervencao) => Promise<unknown>;
}) {
  const { aberto, setAberto, botao, caixa, estilo, teclas } = useCaixaFixa();
  const [gravando, setGravando] = useState(false);
  const [novo, setNovo] = useState("");

  async function rodar(f: () => Promise<unknown>) {
    setGravando(true);
    try {
      await f();
    } catch {
      // o hook já avisou o erro
    } finally {
      setGravando(false);
    }
  }

  const inserir = () => {
    const v = normalizarOpcao(novo);
    if (!v) return;
    const igual = acharNaLista(itens.map((i) => i.valor), v);
    if (igual) {
      toast.error(`${igual} já está na lista.`);
      return;
    }
    setNovo("");
    void rodar(() => onInserir(v));
  };

  return (
    <>
      <button
        ref={botao}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={aberto}
        title={`Ver e inserir ${titulo.toLowerCase()}`}
        onClick={() => setAberto((a) => !a)}
        className={cn(
          "inline-flex items-center gap-1 rounded px-1 -mx-1 py-0.5 text-xs font-semibold text-gray-600 hover:bg-gray-200",
          aberto && "bg-gray-200",
        )}
      >
        {titulo}
        <span className="font-normal text-gray-400">({itens.length})</span>
        <ChevronDown className="size-3.5" />
      </button>
      {aberto && (
        <div
          ref={caixa}
          role="listbox"
          aria-label={titulo}
          style={estilo}
          className="z-50 w-72 rounded-lg border border-gray-200 bg-white py-1 text-left font-normal shadow-lg"
          onKeyDown={teclas}
        >
          <p className="px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">{titulo}</p>
          <div className="max-h-60 overflow-y-auto">
            {itens.map((i) => (
              <div key={i.valor} className="flex items-center gap-2 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50">
                <span className="flex-1">{i.valor}</span>
                {i.usos !== undefined && (
                  <span className="text-[11px] text-gray-400" title="Em quantas intervenções aparece">
                    {i.usos === 0 ? "sem uso" : `em ${i.usos}`}
                  </span>
                )}
                {onExcluir && i.topico && !i.usos && !i.fixo && (
                  <button
                    type="button"
                    disabled={gravando}
                    onClick={() => void rodar(() => onExcluir(i.topico!))}
                    title="Tirar da lista"
                    aria-label={`Tirar ${i.valor} da lista`}
                    className="rounded p-0.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            ))}
            {itens.length === 0 && <p className="px-3 py-2 text-xs text-gray-500">Nada cadastrado ainda.</p>}
          </div>
          <div className="mt-1 flex gap-2 border-t border-gray-100 px-3 pt-2 pb-1">
            <input
              value={novo}
              onChange={(e) => setNovo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  inserir();
                }
              }}
              placeholder={rotuloNovo}
              aria-label={rotuloNovo}
              disabled={gravando}
              className={cn(inputCls, "py-1")}
            />
            <button
              type="button"
              onClick={inserir}
              disabled={!novo.trim() || gravando}
              className="shrink-0 rounded-lg border border-gray-300 px-2.5 py-1 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              {gravando ? <Loader2 className="size-4 animate-spin" /> : "Inserir"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Lista suspensa da linha: marca e desmarca entre tudo o que já existe no catálogo, ou insere outro.
 * Cada mudança grava na hora; enquanto grava, a lista espera, para dois cliques não se atropelarem.
 * Com `comPadrao`, o primeiro marcado é o que a Conciliação traz preenchido, e a estrela troca o padrão.
 * A lista abre em posição fixa porque a tabela tem rolagem própria e a cortaria.
 */
function ListaNaLinha({
  marcadas,
  opcoes,
  rotuloNovo,
  ariaLabel,
  comPadrao,
  onMudar,
}: {
  marcadas: string[];
  opcoes: string[];
  rotuloNovo: string;
  ariaLabel: string;
  comPadrao?: boolean;
  onMudar: (lista: string[]) => Promise<unknown>;
}) {
  const { aberto, setAberto, botao, caixa, estilo, teclas } = useCaixaFixa();
  const [gravando, setGravando] = useState(false);
  const [novo, setNovo] = useState("");

  async function mudar(lista: string[]) {
    setGravando(true);
    try {
      await onMudar(lista);
    } catch {
      // o hook já avisou o erro
    } finally {
      setGravando(false);
    }
  }

  const inserir = () => {
    const v = normalizarOpcao(novo);
    setNovo("");
    if (v) void mudar(comOpcao(marcadas, v));
  };

  const todas = marcadas.reduce((acc, v) => comOpcao(acc, v), opcoes);
  const texto = marcadas.length === 0 ? "—" : marcadas.join(", ");

  return (
    <>
      <button
        ref={botao}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-label={ariaLabel}
        onClick={() => setAberto((a) => !a)}
        className={cn(
          "inline-flex w-full items-center justify-between gap-2 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-left text-sm text-gray-800 hover:border-gray-400 focus:border-marca-primary focus:outline-none focus:ring-2 focus:ring-marca-primary/30",
          aberto && "border-marca-primary",
        )}
      >
        <span className="line-clamp-2">{texto}</span>
        {gravando ? <Loader2 className="size-4 shrink-0 animate-spin text-gray-400" /> : <ChevronDown className="size-4 shrink-0 text-gray-500" />}
      </button>
      {aberto && (
        <div
          ref={caixa}
          role="listbox"
          aria-multiselectable
          aria-label={ariaLabel}
          style={estilo}
          className="z-50 w-72 rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
          onKeyDown={teclas}
        >
          <div className="max-h-60 overflow-y-auto">
            {todas.map((o) => {
              const on = marcadas.includes(o);
              const padrao = comPadrao && marcadas[0] === o;
              return (
                <div key={o} className="flex items-center gap-1 px-3 py-1 hover:bg-gray-50">
                  <label className="flex flex-1 cursor-pointer items-center gap-2 py-0.5 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={gravando}
                      onChange={() => void mudar(on ? marcadas.filter((x) => x !== o) : [...marcadas, o])}
                      className="size-4 accent-marca-primary"
                    />
                    <span className="flex-1">{o}</span>
                  </label>
                  {comPadrao && on && (
                    <button
                      type="button"
                      disabled={gravando || padrao}
                      onClick={() => void mudar([o, ...marcadas.filter((x) => x !== o)])}
                      title={padrao ? "Vem preenchido na Conciliação" : "Tornar o padrão da Conciliação"}
                      aria-label={padrao ? `${o} é o padrão` : `Tornar ${o} o padrão`}
                      className={cn("rounded p-1", padrao ? "text-amber-500" : "text-gray-300 hover:text-amber-500")}
                    >
                      <Star className={cn("size-3.5", padrao && "fill-current")} />
                    </button>
                  )}
                </div>
              );
            })}
            {todas.length === 0 && <p className="px-3 py-2 text-xs text-gray-500">Nada cadastrado ainda.</p>}
          </div>
          <div className="mt-1 flex gap-2 border-t border-gray-100 px-3 pt-2 pb-1">
            <input
              value={novo}
              onChange={(e) => setNovo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  inserir();
                }
              }}
              placeholder={rotuloNovo}
              aria-label={rotuloNovo}
              disabled={gravando}
              className={cn(inputCls, "py-1")}
            />
            <button
              type="button"
              onClick={inserir}
              disabled={!novo.trim() || gravando}
              className="shrink-0 rounded-lg border border-gray-300 px-2.5 py-1 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              Inserir
            </button>
          </div>
          {comPadrao && <p className="px-3 pb-1 pt-1 text-[11px] text-gray-500">A estrela marca o que vem preenchido na Conciliação.</p>}
        </div>
      )}
    </>
  );
}

/** Marcar as que valem aqui, entre tudo o que já existe, ou inserir outra. */
function ListaAberta({
  opcoes,
  marcadas,
  rotuloNovo,
  onMudar,
}: {
  opcoes: string[];
  marcadas: string[];
  rotuloNovo: string;
  onMudar: (lista: string[]) => void;
}) {
  const [novo, setNovo] = useState("");
  const inserir = () => {
    const v = normalizarOpcao(novo);
    if (v) onMudar(comOpcao(marcadas, v));
    setNovo("");
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3">
        {marcadas.reduce((acc, v) => comOpcao(acc, v), opcoes).map((m) => (
          <label key={m} className="inline-flex cursor-pointer items-center gap-1.5 text-gray-700">
            <input
              type="checkbox"
              checked={marcadas.includes(m)}
              onChange={(e) => onMudar(e.target.checked ? [...marcadas, m] : marcadas.filter((x) => x !== m))}
              className="size-4 accent-marca-primary"
            />
            {m}
          </label>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              inserir();
            }
          }}
          placeholder={rotuloNovo}
          aria-label={rotuloNovo}
          className={inputCls}
        />
        <button type="button" onClick={inserir} disabled={!novo.trim()} className="shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60">
          Inserir
        </button>
      </div>
    </div>
  );
}

/** 0.3.330: quantos campos do método a intervenção tem de próprio (o resto vem da modalidade). */
function resumoMetodo(i: IntervencaoCatalogo): string {
  const n = Object.values(i.metodos ?? {}).reduce((t, m) => t + Object.values(m ?? {}).filter((v) => (v ?? "").trim()).length, 0);
  return n === 0 ? "texto da modalidade" : `${n} ${n === 1 ? "campo próprio" : "campos próprios"}`;
}

/**
 * 0.3.330 (pedido do João): o texto do método desta intervenção, por modalidade — forma de realização, duração, avaliação e
 * certificado. Em branco vale o texto da modalidade (que aparece de sugestão no campo). É o que a Conciliação e o vendedor
 * veem, e cada empresa ainda pode ajustar o seu na Conciliação. Grava ao sair do campo.
 */
function MetodoNoCatalogo({ i, padroes, onGravar }: {
  i: IntervencaoCatalogo;
  padroes: Parameters<typeof metodoDe>[1];
  onGravar: (metodos: Record<string, Partial<MetodoTexto>>) => void;
}) {
  if (i.modalidades.length === 0) {
    return <p className="text-xs text-amber-700">Marque ao menos uma modalidade para descrever o método desta intervenção.</p>;
  }
  const gravar = (modalidade: string, campo: keyof MetodoTexto, valor: string) => {
    const atual = (i.metodos?.[modalidade]?.[campo] ?? "").trim();
    const t = valor.trim();
    if (t === atual) return;
    const daMod = { ...(i.metodos?.[modalidade] ?? {}) };
    if (t) daMod[campo] = t;
    else delete daMod[campo];
    const todos = { ...(i.metodos ?? {}) };
    if (Object.keys(daMod).length) todos[modalidade] = daMod;
    else delete todos[modalidade];
    onGravar(todos);
  };
  return (
    <div className="space-y-2 text-left [&_*]:!text-left">
      <p className="text-xs text-gray-500">
        O texto do método desta intervenção. Em branco vale o da modalidade (em cinza, de sugestão), que fica em Métodos por modalidade, no
        fim da página.
      </p>
      <div className={cn("grid gap-3", i.modalidades.length > 1 && "xl:grid-cols-2")}>
        {i.modalidades.map((m) => {
          const padrao = metodoDe(m, padroes, null);
          return (
            <div key={m} className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-indigo-700">{rotuloModalidade(m)}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {CAMPOS_METODO.map(({ campo, rotulo }) => (
                  <label key={campo} className="block text-xs font-medium text-gray-600">
                    {rotulo}
                    <textarea key={`${i.id_intervencao}:${m}:${campo}:${i.metodos?.[m]?.[campo] ?? ""}`} rows={2}
                      defaultValue={i.metodos?.[m]?.[campo] ?? ""} placeholder={padrao[campo] ?? "Sem texto na modalidade"}
                      onBlur={(e) => gravar(m, campo, e.target.value)}
                      className={cn(inputCls, "mt-0.5 resize-y placeholder:text-gray-400")} />
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function JanelaIntervencao({ inicial, catalogo, onFechar }: { inicial: Forma; catalogo: IntervencaoCatalogo[]; onFechar: () => void }) {
  const salvar = useSalvarIntervencao();
  const [f, setF] = useState(inicial);
  const { data: topicos } = useTopicosIntervencao();
  const opcoes = opcoesDoCatalogo(catalogo, topicos);

  const gravar = () =>
    salvar.mutate(
      { ...f, nome: f.nome.trim(), observacao: f.observacao?.trim() || null },
      { onSuccess: onFechar },
    );

  return (
    <Modal
      open
      onClose={onFechar}
      title={f.id_intervencao ? "Editar intervenção" : "Nova intervenção"}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onFechar} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
            Cancelar
          </button>
          <button
            type="button"
            onClick={gravar}
            disabled={!f.nome.trim() || salvar.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-marca-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-marca-accent disabled:opacity-60"
          >
            {salvar.isPending && <Loader2 className="size-4 animate-spin" />} Salvar
          </button>
        </div>
      }
    >
      <div className="space-y-4 text-sm">
        <div>
          <label htmlFor="intervencao-nome" className="mb-1 block text-xs font-semibold text-gray-600">
            Nome <span className="text-red-600">*</span>
          </label>
          <input id="intervencao-nome" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} className={inputCls} />
        </div>
        <fieldset>
          <legend className="mb-1 text-xs font-semibold text-gray-600">
            <Dica texto={DICAS_COMERCIAL_INTERVENCAO.modalidades}>Modalidades</Dica>
          </legend>
          <ListaAberta opcoes={opcoes.modalidades} marcadas={f.modalidades} rotuloNovo="Nova modalidade" onMudar={(modalidades) => setF({ ...f, modalidades })} />
        </fieldset>
        <div>
          <label htmlFor="intervencao-obs" className="mb-1 block text-xs font-semibold text-gray-600">
            <Dica texto={DICAS_COMERCIAL_INTERVENCAO.observacao}>Observação</Dica>
          </label>
          <textarea id="intervencao-obs" rows={2} value={f.observacao ?? ""} onChange={(e) => setF({ ...f, observacao: e.target.value })} className={inputCls} />
        </div>
        <fieldset>
          <legend className="mb-1 text-xs font-semibold text-gray-600">Responsáveis (o primeiro marcado vem preenchido na Conciliação)</legend>
          <ListaAberta opcoes={opcoes.responsaveis} marcadas={f.responsaveis} rotuloNovo="Novo responsável" onMudar={(responsaveis) => setF({ ...f, responsaveis })} />
        </fieldset>
        <label className="inline-flex cursor-pointer items-center gap-2 text-gray-700">
          <input type="checkbox" checked={f.ativo} onChange={(e) => setF({ ...f, ativo: e.target.checked })} className="size-4 accent-marca-primary" />
          <Dica texto={DICAS_COMERCIAL_INTERVENCAO.ativo}>Ativa</Dica>
        </label>
      </div>
    </Modal>
  );
}
