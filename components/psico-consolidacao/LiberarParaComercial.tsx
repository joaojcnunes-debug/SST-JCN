"use client";

// Etapas 3 e 4 da Conciliação DRPS/QPS × AEP (0.3.238): as intervenções por risco e a liberação
// para o Comercial. Antes eram a tela própria /consolidacao-grupo/liberar-comercial. A regra está em
// lib/comercial/liberacao.ts; as funções do banco conferem a sessão de quem grava (v321/v322).
// 0.3.240 (banco v327): Intervenção, Modalidade e Responsável aceitam valor novo, que entra no
// catálogo, e nenhum campo espera a intervenção ser escolhida.
// 0.3.290 (banco v356): serve também à Conciliação por grupo (`alvo`). No grupo, cada intervenção leva as empresas do
// setor (`empresasDoRisco`), e é nelas que o vendedor a vê; `aviso` mostra, antes de liberar, quem o grupo substitui.

import { Fragment, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { CheckCircle2, Handshake, Loader2, Plus, Sparkles, Trash2, Undo2 } from "lucide-react";
import Dica from "@/components/ui/Dica";
import Modal from "@/components/ui/Modal";
import { confirmar } from "@/components/ui/confirm";
import { DICAS_COMERCIAL_LIBERAR } from "@/lib/dicas/comercial";
import {
  useAtualizarListasDoCatalogo,
  useCatalogoIntervencoes,
  useTopicosIntervencao,
  useConcluirAtendimento,
  useCriarIntervencaoNoCatalogo,
  useEventosAtendimento,
  useReabrirAtendimento,
  useRetirarIntervencao,
  useSalvarIntervencaoIndicada,
  useSalvarParecerComercial,
  type IntervencaoCatalogo,
} from "@/lib/hooks/useComercial";
import PlanoIntervencoes from "@/components/psico-consolidacao/PlanoIntervencoes";
import MetodoDaIntervencao from "@/components/psico-consolidacao/MetodoDaIntervencao";
import { chaveTema } from "@/lib/comercial/plano";
import {
  acharIntervencao,
  acharNaLista,
  agruparPorRisco,
  chaveRisco,
  comOpcao,
  faltaParaConcluir,
  normalizarOpcao,
  opcoesDoCatalogo,
  type AtendimentoComercial,
  type IntervencaoIndicada,
  type RiscoConciliado,
  type RiscoPorFator,
} from "@/lib/comercial/liberacao";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AlvoConciliacao } from "@/lib/hooks/useConciliacaoParecer";
import { mensagemErro } from "@/lib/errors";
import { cn, fmtData } from "@/lib/utils";

const inputCls =
  "w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";
const campoCls =
  "w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 disabled:border-transparent disabled:bg-transparent disabled:text-gray-700";
const btnPrimario =
  "inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60";
const btnNeutro =
  "inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60";

export function TituloEtapa({ numero, titulo, children }: { numero: number; titulo: string; children?: ReactNode }) {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <span className="flex size-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">{numero}</span>
      <h2 className="text-base font-bold text-gray-900">{titulo}</h2>
      {children}
    </div>
  );
}

export default function LiberarParaComercial({
  alvo,
  empresasDoRisco,
  aviso,
  nomeEmpresa,
  municipio,
  fechada,
  riscos,
  indicadas,
  atendimento,
  podeAlterar,
  podeRetirar,
  avisoRiscos,
}: {
  /** 0.3.321: aviso acima da tabela (ex.: fechamento antigo sem os convergentes). */
  avisoRiscos?: ReactNode;
  alvo: AlvoConciliacao;
  /** Só no grupo: as empresas do setor de cada risco (chaveRisco). */
  empresasDoRisco?: (chave: string) => string[];
  /** Aviso acima do Liberar (no grupo: as empresas que já tinham liberação própria e que o grupo substitui). */
  aviso?: ReactNode;
  nomeEmpresa: string;
  municipio: string | null;
  /** A última conciliação está fechada. */
  fechada: boolean;
  riscos: RiscoConciliado[];
  indicadas: IntervencaoIndicada[];
  atendimento: AtendimentoComercial | null;
  /** Sessão aberta, conciliação fechada e ainda não liberada. */
  podeAlterar: boolean;
  podeRetirar: boolean;
}) {
  const { data: catalogo = [] } = useCatalogoIntervencoes();
  const { data: eventos = [] } = useEventosAtendimento(alvo);
  const salvarParecer = useSalvarParecerComercial();
  const concluir = useConcluirAtendimento();

  const [retirando, setRetirando] = useState(false);
  const [rascunho, setRascunho] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);

  const liberado = atendimento?.status === "CONCLUIDO";
  const parecer = rascunho ?? atendimento?.parecer ?? "";
  const falta = faltaParaConcluir(parecer);
  const { data: topicos } = useTopicosIntervencao();
  const opcoes = useMemo(() => opcoesDoCatalogo(catalogo, topicos), [catalogo, topicos]);
  // 0.3.321 (pedido do João, 26/11): mostrar por setor (padrão) ou por risco — por risco, o tema vale para todos os setores.
  const [agrupar, setAgrupar] = useState<"setor" | "risco">("setor");
  const porFator = useMemo(() => agruparPorRisco(riscos, indicadas), [riscos, indicadas]);

  async function sugerirParecer() {
    if (parecer.trim()) {
      const ok = await confirmar({
        title: "Trocar o texto pela sugestão?",
        description: "A IA parte do que está escrito e devolve um texto novo. Confira antes de salvar.",
        confirmLabel: "Sugerir",
        variant: "primary",
      });
      if (!ok) return;
    }
    setGerando(true);
    try {
      const { data: r, error: e } = await createSupabaseBrowserClient().functions.invoke("gerar-parecer-comercial-ia", {
        body: {
          empresa_nome: nomeEmpresa,
          municipio,
          rascunho: parecer,
          riscos: riscos.filter((x) => !x.foraDaConciliacao).map((x) => ({ setor: x.setor, fator: x.fator, aet: x.aet })),
          intervencoes: indicadas.map((i) => ({
            setor: i.setor_nome,
            fator: i.fator_nome,
            nome: i.nome,
            modalidade: i.modalidade,
            responsavel: i.responsavel,
            prazo_dias: i.prazo_dias,
          })),
        },
      });
      if (e) throw e;
      const texto = (r as { data?: { texto?: string } })?.data?.texto;
      if (!texto) throw new Error("A IA não devolveu texto.");
      setRascunho(texto);
    } catch (err) {
      toast.error(mensagemErro(err as Error, "Não foi possível gerar a sugestão"));
    } finally {
      setGerando(false);
    }
  }

  async function liberar() {
    const semItem = riscos.filter((r) => !indicadas.some((i) => chaveRisco(i.setor_chave, i.id_fator) === r.chave)).length;
    const ok = await confirmar({
      title: "Liberar para o Comercial?",
      description: `${
        semItem > 0 ? `${semItem === 1 ? "1 risco está" : `${semItem} riscos estão`} sem intervenção. ` : ""
      }O vendedor passa a ver as intervenções, os riscos que pediram AET e o parecer. O tempo para de contar e a tela fica só leitura.`,
      confirmLabel: "Liberar",
      variant: "primary",
    });
    if (ok) concluir.mutate({ alvo, parecer }, { onSuccess: () => setRascunho(null) });
  }

  return (
    <>
      <section id="etapa-intervencoes" className="scroll-mt-20">
        <TituloEtapa numero={3} titulo="Intervenções" />
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          {fechada && avisoRiscos && <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">{avisoRiscos}</div>}
          {!fechada ? (
            <p className="text-sm text-gray-500">Feche a conciliação para indicar as intervenções.</p>
          ) : riscos.length === 0 ? (
            <p className="text-sm text-gray-500">A conciliação fechada não tem risco confirmado. Nada vai para o Comercial.</p>
          ) : (
            <>
              <p className="text-xs text-gray-500">
                Riscos da conciliação fechada: os confirmados, os de AET e os convergentes (questionário e AEP concordam). As opções vêm do{" "}
                <Link href="/consolidacao-grupo/intervencoes" className="font-medium text-indigo-700 underline">
                  catálogo de intervenções
                </Link>
                , e cada alteração é gravada na hora. O que você inserir em &quot;+ Inserir novo&quot; também entra no catálogo.
              </p>
              <div className="mt-2 inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-xs font-medium" role="group" aria-label="Mostrar">
                {(["setor", "risco"] as const).map((k) => (
                  <button key={k} type="button" onClick={() => setAgrupar(k)} aria-pressed={agrupar === k}
                    className={cn("rounded-md px-2.5 py-1", agrupar === k ? "bg-white text-indigo-700 shadow-sm" : "text-gray-600 hover:text-gray-900")}>
                    {k === "setor" ? "Por setor" : "Por risco"}
                  </button>
                ))}
              </div>
              {agrupar === "risco" && (
                <p className="mt-1 text-xs text-gray-500">Por risco, a intervenção escolhida vale para todos os setores com aquele risco: escolher, mudar ou retirar muda em todos.</p>
              )}
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[48rem] text-sm">
                  <thead className="border-b border-gray-200 text-left text-xs font-semibold text-gray-600">
                    <tr>
                      <th className="py-2 pr-2">Intervenção</th>
                      <th className="w-32 py-2 pr-2">Modalidade</th>
                      <th className="w-72 py-2 pr-2">Responsável</th>
                      <th className="w-24 py-2 pr-2">Prazo (dias)</th>
                      <th className="w-10 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {agrupar === "risco" && porFator.map((g) => (
                      <LinhasDoFator key={g.idFator} grupo={g} alvo={alvo} empresasDoRisco={empresasDoRisco} catalogo={catalogo} opcoes={opcoes} podeAlterar={podeAlterar} />
                    ))}
                    {/* 0.3.324: por setor, cada risco (setor × fator) é um bloco igual ao do por risco, com um setor só. */}
                    {agrupar === "setor" && riscos.map((r) => (
                      <LinhasDoFator key={r.chave} grupo={agruparPorRisco([r], indicadas)[0]} alvo={alvo} empresasDoRisco={empresasDoRisco} catalogo={catalogo} opcoes={opcoes} podeAlterar={podeAlterar} />
                    ))}
                  </tbody>
                </table>
              </div>
              <PlanoIntervencoes alvo={alvo} indicadas={indicadas} podeAlterar={podeAlterar} />
            </>
          )}
        </div>
      </section>

      <section id="etapa-liberar" className="scroll-mt-20">
        <TituloEtapa numero={4} titulo="Liberar para o Comercial" />
        <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          {liberado && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              <span className="inline-flex items-center gap-1.5">
                <Handshake className="size-4" />
                Liberado{atendimento?.concluido_em ? ` em ${fmtData(atendimento.concluido_em)}` : ""}
                {atendimento?.concluido_por ? ` por ${atendimento.concluido_por}` : ""}. A tela fica só leitura.
              </span>
              {podeRetirar && (
                <button type="button" onClick={() => setRetirando(true)} className={btnNeutro}>
                  <Undo2 className="size-4" /> Retirar do Comercial
                </button>
              )}
            </div>
          )}
          {!fechada ? (
            <p className="text-sm text-gray-500">Feche a conciliação para liberar.</p>
          ) : riscos.length === 0 && !atendimento?.parecer ? null : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label htmlFor="comercial-parecer" className="text-sm font-semibold text-gray-800">
                  <Dica texto={DICAS_COMERCIAL_LIBERAR.parecer}>Parecer para o Comercial</Dica>
                </label>
                {podeAlterar && (
                  <button type="button" onClick={sugerirParecer} disabled={gerando} className={btnNeutro}>
                    {gerando ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Sugerir com IA
                  </button>
                )}
              </div>
              <textarea
                id="comercial-parecer"
                rows={5}
                value={parecer}
                disabled={!podeAlterar}
                onChange={(e) => setRascunho(e.target.value)}
                className={cn(inputCls, "disabled:bg-gray-50 disabled:text-gray-600")}
                placeholder={podeAlterar ? "O que o vendedor precisa saber sobre esta empresa" : ""}
              />
              {aviso && !liberado && <div className="text-sm">{aviso}</div>}
              {podeAlterar && riscos.length > 0 && (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {falta && <span className="mr-auto text-xs text-amber-800">{falta}</span>}
                  <button
                    type="button"
                    disabled={rascunho === null || salvarParecer.isPending}
                    onClick={() => salvarParecer.mutate({ alvo, parecer }, { onSuccess: () => setRascunho(null) })}
                    className={btnNeutro}
                  >
                    {salvarParecer.isPending && <Loader2 className="size-4 animate-spin" />} Salvar parecer
                  </button>
                  <button type="button" disabled={!!falta || concluir.isPending} onClick={liberar} className={btnPrimario}>
                    {concluir.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Liberar para o Comercial
                  </button>
                </div>
              )}
            </>
          )}
          {eventos.length > 0 && (
            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs font-semibold text-gray-600">Histórico da liberação</p>
              <ul className="mt-1 space-y-1 text-xs text-gray-600">
                {eventos.map((e) => (
                  <li key={e.id_evento}>
                    <strong className="text-gray-800">{e.tipo === "CONCLUIDO" ? "Liberado" : "Retirado do Comercial"}</strong> em {fmtData(e.em)}
                    {e.por ? ` por ${e.por}` : ""}
                    {e.motivo ? `: ${e.motivo}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {retirando && <JanelaRetirar alvo={alvo} onFechar={() => setRetirando(false)} />}
    </>
  );
}

/**
 * 0.3.321: as linhas de um risco agrupado (um fator em vários setores): um tema por linha, valendo para todos.
 * 0.3.322 (pedido do João): o risco e os setores ficam numa linha própria, em cima, e as intervenções vêm embaixo,
 * com a largura toda (antes, a lista de setores numa coluna esticava a linha da intervenção).
 * 0.3.324 (pedido do João, desenho no Excel): vale também para o Por setor (um setor só), e embaixo de cada intervenção
 * vêm as 4 linhas da descrição do método (MetodoDaIntervencao).
 */
function LinhasDoFator({
  grupo,
  alvo,
  empresasDoRisco,
  catalogo,
  opcoes,
  podeAlterar,
}: {
  grupo: RiscoPorFator;
  alvo: AlvoConciliacao;
  empresasDoRisco?: (chave: string) => string[];
  catalogo: IntervencaoCatalogo[];
  opcoes: OpcoesCatalogo;
  podeAlterar: boolean;
}) {
  const [adicionando, setAdicionando] = useState(false);
  const { temas, riscos } = grupo;
  const mostrarNova = podeAlterar && (adicionando || temas.length === 0);
  const rotulo: RiscoConciliado = { ...riscos[0], setor: riscos.map((r) => r.setor).join(", "), fator: grupo.fator };
  const algumAet = riscos.some((r) => r.aet);
  const algumConvergente = riscos.some((r) => r.convergente);
  const algumFora = riscos.some((r) => r.foraDaConciliacao);

  return (
    <Fragment>
      <tr className="border-t-2 border-gray-200 bg-gray-50/70">
        <td colSpan={5} className="px-2 py-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-xs font-semibold text-gray-500">Risco:</span>
            <span className="font-semibold text-gray-900">{grupo.fator}</span>
            {algumAet && <span className="rounded-full border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-800">Aprofundar com AET</span>}
            {algumConvergente && !algumAet && <span title="O questionário e a AEP concordam que há este risco" className="rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">Convergente</span>}
            {algumFora && <span className="rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">Fora da última conciliação</span>}
            {podeAlterar && temas.length > 0 && !adicionando && (
              <button type="button" onClick={() => setAdicionando(true)} className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-indigo-700 hover:underline">
                <Plus className="size-3.5" /> Adicionar intervenção
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-gray-600">
            <span className="font-semibold text-gray-700">{riscos.length === 1 ? "Setor" : `Setores (${riscos.length})`}: </span>
            {riscos.map((r, k) => (
              <Fragment key={r.chave}>
                {k > 0 && ", "}
                {r.setor}
                {r.aet && <span className="ml-0.5 text-[10px] font-semibold text-indigo-700" title="Este setor pediu AET">AET</span>}
              </Fragment>
            ))}
          </p>
        </td>
      </tr>
      {temas.map((t) => {
        const representante = [...t.itens.values()][0];
        const faltam = riscos.length - t.itens.size;
        return (
          <Fragment key={t.chave}>
            <LinhaIntervencao risco={rotulo} alvo={alvo} item={representante} catalogo={catalogo} opcoes={opcoes} podeAlterar={podeAlterar}
              celulaRisco={null}
              grupo={{ riscos, itens: t.itens, empresasDe: empresasDoRisco }}
              nota={faltam > 0 ? `Em ${t.itens.size} de ${riscos.length} setores — qualquer mudança aplica em todos.` : undefined} />
            <tr>
              <td colSpan={5} className="pb-3 pr-2">
                <div className="overflow-hidden rounded-md border border-gray-200">
                  <MetodoDaIntervencao alvo={alvo} tema={chaveTema(representante)} modalidade={representante.modalidade} podeAlterar={podeAlterar} />
                </div>
              </td>
            </tr>
          </Fragment>
        );
      })}
      {mostrarNova && (
        <LinhaIntervencao risco={rotulo} alvo={alvo} item={null} catalogo={catalogo} opcoes={opcoes} podeAlterar
          celulaRisco={null}
          grupo={{ riscos, itens: new Map(), empresasDe: empresasDoRisco }}
          onCriada={() => setAdicionando(false)}
          onCancelar={temas.length > 0 ? () => setAdicionando(false) : undefined} />
      )}
      {temas.length === 0 && !mostrarNova && (
        <tr>
          <td colSpan={5} className="py-2 pr-2 text-xs text-gray-400">Nenhuma intervenção indicada.</td>
        </tr>
      )}
    </Fragment>
  );
}

type OpcoesCatalogo = ReturnType<typeof opcoesDoCatalogo>;

const INSERIR_NOVO = "__inserir_novo__";

/**
 * Lista com tudo o que já existe e, no fim, "+ Inserir novo", que troca o campo por um de digitar.
 * Enter ou sair do campo grava; Esc desiste. É uma lista do navegador, e não um menu próprio, porque a
 * tabela rola na horizontal e cortaria um menu aberto.
 */
function CampoOpcoes({
  valor,
  opcoes,
  vazio,
  rotuloNovo,
  textoInicial = "",
  disabled,
  ariaLabel,
  onEscolher,
  onNovo,
}: {
  valor: string;
  opcoes: { valor: string; rotulo: string }[];
  /** O rótulo da opção sem valor; sem ele, a opção não aparece. */
  vazio?: string;
  rotuloNovo: string;
  textoInicial?: string;
  disabled: boolean;
  ariaLabel: string;
  onEscolher: (valor: string) => void;
  onNovo: (texto: string) => void;
}) {
  const [digitando, setDigitando] = useState(false);
  const [texto, setTexto] = useState("");
  const terminou = useRef(false);

  function terminar(gravar: boolean) {
    if (terminou.current) return;
    terminou.current = true;
    setDigitando(false);
    const t = normalizarOpcao(texto);
    if (gravar && t && t !== textoInicial) onNovo(t);
  }

  if (digitando) {
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
        placeholder={rotuloNovo}
        aria-label={ariaLabel}
        className={campoCls}
      />
    );
  }
  return (
    <select
      value={valor}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(e) => {
        if (e.target.value !== INSERIR_NOVO) return onEscolher(e.target.value);
        terminou.current = false;
        setTexto(textoInicial);
        setDigitando(true);
      }}
      className={campoCls}
    >
      {vazio !== undefined && <option value="">{vazio}</option>}
      {opcoes.map((o) => (
        <option key={o.valor} value={o.valor}>
          {o.rotulo}
        </option>
      ))}
      <option value={INSERIR_NOVO}>+ Inserir novo...</option>
    </select>
  );
}

/** A intervenção gravada sem ligação com o catálogo: aparece na lista só nesta linha. */
const ITEM_FORA_DO_CATALOGO = "__fora_do_catalogo__";

const paraOpcoes = (lista: readonly string[]) => lista.map((v) => ({ valor: v, rotulo: v }));

function LinhaIntervencao({
  risco,
  alvo,
  empresas,
  item,
  catalogo,
  opcoes,
  podeAlterar,
  celulaRisco,
  onCriada,
  onCancelar,
  grupo,
  nota,
}: {
  /** 0.3.321 (por risco): grava e retira em todos os setores do risco; `item` é o de um deles (o que a linha mostra). */
  grupo?: { riscos: RiscoConciliado[]; itens: Map<string, IntervencaoIndicada>; empresasDe?: (chave: string) => string[] };
  nota?: string;
  risco: RiscoConciliado;
  alvo: AlvoConciliacao;
  empresas?: string[];
  item: IntervencaoIndicada | null;
  catalogo: IntervencaoCatalogo[];
  opcoes: OpcoesCatalogo;
  podeAlterar: boolean;
  celulaRisco: ReactNode;
  onCriada?: () => void;
  onCancelar?: () => void;
}) {
  const salvar = useSalvarIntervencaoIndicada();
  const retirar = useRetirarIntervencao();
  const criarNoCatalogo = useCriarIntervencaoNoCatalogo();
  const atualizarCatalogo = useAtualizarListasDoCatalogo();
  // Na linha nova, o que foi preenchido antes de escolher a intervenção espera aqui, e vai junto.
  const [rascunhoModalidade, setRascunhoModalidade] = useState<string | null>(null);
  const [rascunhoResponsavel, setRascunhoResponsavel] = useState<string | null>(null);
  const [prazo, setPrazo] = useState(item?.prazo_dias ? String(item.prazo_dias) : "");

  const modalidade = item ? item.modalidade : rascunhoModalidade;
  const responsavel = item ? item.responsavel : rascunhoResponsavel;
  const noCatalogo = catalogo.find((c) => c.id_intervencao === item?.id_intervencao);
  const opcoesIntervencao = catalogo.filter((c) => c.ativo || c.id_intervencao === item?.id_intervencao);
  const bloqueado = !podeAlterar || salvar.isPending || criarNoCatalogo.isPending;

  const diasDoPrazo = () => {
    const dias = prazo.trim() ? Math.max(1, Math.floor(Number(prazo))) : null;
    return dias !== null && !Number.isFinite(dias) ? null : dias;
  };

  // Uma linha grava um item; por risco (0.3.321), um em cada setor do risco — cria onde ainda não há.
  const destinos = grupo
    ? grupo.riscos.map((r) => ({ r, it: grupo.itens.get(r.chave) ?? null, emp: grupo.empresasDe?.(r.chave) }))
    : [{ r: risco, it: item, emp: empresas }];
  const gravar = async (mudanca: { idIntervencao?: string | null; nome?: string; modalidade?: string | null; responsavel?: string | null; prazoDias?: number | null }) => {
    try {
      await Promise.all(
        destinos.map(({ r, it, emp }) =>
          salvar.mutateAsync({
            idItem: it?.id_item ?? null,
            alvo,
            empresas: emp,
            setorChave: r.setorChave,
            setorNome: r.setor,
            idFator: r.idFator,
            fatorNome: r.fator,
            idIntervencao: it?.id_intervencao ?? item?.id_intervencao ?? null,
            nome: it?.nome ?? item?.nome ?? "",
            modalidade,
            responsavel,
            prazoDias: item ? item.prazo_dias : diasDoPrazo(),
            ...mudanca,
          }),
        ),
      );
      onCriada?.();
    } catch {
      // O aviso já saiu no hook.
    }
  };

  function aplicarIntervencao(c: IntervencaoCatalogo) {
    // Trocar a intervenção traz a modalidade e o responsável dela; o que já foi preenchido na linha nova vale mais.
    const mod = (item ? null : rascunhoModalidade) ?? c.modalidades[0] ?? null;
    const resp = (item ? null : rascunhoResponsavel) ?? c.responsaveis[0] ?? null;
    // O que foi digitado antes de escolher a intervenção entra no catálogo agora.
    const modNova = !item && mod && !acharNaLista(opcoes.modalidades, mod);
    const respNovo = !item && resp && !acharNaLista(opcoes.responsaveis, resp);
    if (modNova || respNovo) {
      atualizarCatalogo.mutate({
        idIntervencao: c.id_intervencao,
        modalidades: modNova ? comOpcao(c.modalidades, mod) : c.modalidades,
        responsaveis: respNovo ? comOpcao(c.responsaveis, resp) : c.responsaveis,
      });
    }
    gravar({ idIntervencao: c.id_intervencao, nome: c.nome, modalidade: mod, responsavel: resp });
  }

  function escolherIntervencao(id: string) {
    const c = catalogo.find((x) => x.id_intervencao === id);
    if (c) aplicarIntervencao(c);
  }

  async function novaIntervencao(nome: string) {
    const existente = acharIntervencao(catalogo, nome);
    if (existente) return aplicarIntervencao(existente);
    try {
      const c = await criarNoCatalogo.mutateAsync({
        nome,
        modalidades: modalidade ? [modalidade] : [],
        responsaveis: responsavel ? [responsavel] : [],
        ordem: catalogo.reduce((m, i) => Math.max(m, i.ordem), 0) + 1,
      });
      gravar({ idIntervencao: c.id_intervencao, nome: c.nome });
    } catch {
      // O aviso já saiu no hook, e a linha continua como estava.
    }
  }

  function escolherModalidade(v: string | null) {
    if (item) gravar({ modalidade: v });
    else setRascunhoModalidade(v);
  }

  function escolherResponsavel(v: string | null) {
    if (item) gravar({ responsavel: v });
    else setRascunhoResponsavel(v);
  }

  /** Valor digitado com a intervenção já escolhida: vai para a linha e para a lista dela no catálogo. */
  function registrarNaIntervencao(mudanca: { modalidade?: string; responsavel?: string }) {
    if (!noCatalogo) return;
    const modalidades = mudanca.modalidade ? comOpcao(noCatalogo.modalidades, mudanca.modalidade) : noCatalogo.modalidades;
    const responsaveis = mudanca.responsavel ? comOpcao(noCatalogo.responsaveis, mudanca.responsavel) : noCatalogo.responsaveis;
    if (modalidades.length === noCatalogo.modalidades.length && responsaveis.length === noCatalogo.responsaveis.length) return;
    atualizarCatalogo.mutate({ idIntervencao: noCatalogo.id_intervencao, modalidades, responsaveis });
  }

  function novaModalidade(texto: string) {
    const v = acharNaLista(opcoes.modalidades, texto) ?? texto;
    escolherModalidade(v);
    registrarNaIntervencao({ modalidade: v });
  }

  function novoResponsavel(texto: string) {
    const v = acharNaLista(opcoes.responsaveis, texto) ?? texto;
    escolherResponsavel(v);
    registrarNaIntervencao({ responsavel: v });
  }

  function gravarPrazo() {
    const dias = diasDoPrazo();
    if (dias === (item?.prazo_dias ?? null)) return;
    setPrazo(dias ? String(dias) : "");
    gravar({ prazoDias: dias });
  }

  async function remover() {
    if (!item) return;
    const itens = destinos.map((d) => d.it).filter((x): x is IntervencaoIndicada => !!x);
    const ok = await confirmar({ title: "Retirar esta intervenção?", description: `${item.nome} sai de ${risco.setor} · ${risco.fator}.`, confirmLabel: "Retirar", variant: "danger" });
    if (ok) for (const it of itens) retirar.mutate({ alvo, idItem: it.id_item });
  }

  return (
    <tr className="align-top">
      {celulaRisco}
      <td className="py-2 pr-2">
        <CampoOpcoes
          valor={item ? (item.id_intervencao ?? ITEM_FORA_DO_CATALOGO) : ""}
          vazio={item ? undefined : "Escolha a intervenção..."}
          opcoes={[
            ...(item && !noCatalogo ? [{ valor: item.id_intervencao ?? ITEM_FORA_DO_CATALOGO, rotulo: item.nome }] : []),
            ...opcoesIntervencao.map((c) => ({ valor: c.id_intervencao, rotulo: c.nome })),
          ]}
          rotuloNovo="Nome da nova intervenção"
          disabled={bloqueado}
          ariaLabel={`Intervenção para ${risco.setor}, ${risco.fator}`}
          onEscolher={escolherIntervencao}
          onNovo={novaIntervencao}
        />
        {nota && <p className="mt-0.5 text-[11px] text-amber-700">{nota}</p>}
      </td>
      <td className="py-2 pr-2">
        <CampoOpcoes
          valor={modalidade ?? ""}
          vazio="—"
          opcoes={paraOpcoes(modalidade ? comOpcao(opcoes.modalidades, modalidade) : opcoes.modalidades)}
          rotuloNovo="Nova modalidade"
          disabled={bloqueado}
          ariaLabel="Modalidade"
          onEscolher={(v) => escolherModalidade(v || null)}
          onNovo={novaModalidade}
        />
      </td>
      <td className="py-2 pr-2">
        <CampoOpcoes
          valor={responsavel ?? ""}
          vazio="—"
          opcoes={paraOpcoes(responsavel ? comOpcao(opcoes.responsaveis, responsavel) : opcoes.responsaveis)}
          rotuloNovo="Novo responsável"
          textoInicial={responsavel ?? ""}
          disabled={bloqueado}
          ariaLabel="Responsável"
          onEscolher={(v) => escolherResponsavel(v || null)}
          onNovo={novoResponsavel}
        />
      </td>
      <td className="py-2 pr-2">
        <input
          type="number"
          min={1}
          value={prazo}
          disabled={bloqueado}
          onChange={(e) => setPrazo(e.target.value)}
          onBlur={() => item && gravarPrazo()}
          aria-label="Prazo em dias"
          className={cn(campoCls, "tabular-nums")}
        />
      </td>
      <td className="py-2 text-right">
        {podeAlterar && item && (
          <button type="button" onClick={remover} disabled={retirar.isPending} aria-label={`Retirar ${item.nome}`} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-700 disabled:opacity-60">
            <Trash2 className="size-4" />
          </button>
        )}
        {!item && onCancelar && (
          <button type="button" onClick={onCancelar} className="text-xs text-gray-500 hover:underline">
            Cancelar
          </button>
        )}
      </td>
    </tr>
  );
}

function JanelaRetirar({ alvo, onFechar }: { alvo: AlvoConciliacao; onFechar: () => void }) {
  const reabrir = useReabrirAtendimento();
  const [motivo, setMotivo] = useState("");
  return (
    <Modal
      open
      onClose={onFechar}
      title="Retirar do Comercial"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onFechar} className={btnNeutro}>
            Cancelar
          </button>
          <button
            type="button"
            disabled={!motivo.trim() || reabrir.isPending}
            onClick={() => reabrir.mutate({ alvo, motivo }, { onSuccess: onFechar })}
            className={btnPrimario}
          >
            {reabrir.isPending && <Loader2 className="size-4 animate-spin" />} Retirar
          </button>
        </div>
      }
    >
      <div className="space-y-2 text-sm">
        <p className="text-gray-700">
          Para ajustar intervenção ou parecer, sem criar outro fechamento. O vendedor deixa de ver as intervenções, os riscos que pediram AET e o
          parecer até você liberar de novo.
        </p>
        <label htmlFor="comercial-retirar" className="block text-xs font-semibold text-gray-600">
          Motivo <span className="text-red-600">*</span>
        </label>
        <textarea id="comercial-retirar" rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} className={inputCls} />
      </div>
    </Modal>
  );
}
