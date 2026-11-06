"use client";

// Etapas 3 e 4 da Conciliação DRPS/QPS × AEP (0.3.238): as intervenções por risco e a liberação
// para o Comercial. Antes eram a tela própria /consolidacao-grupo/liberar-comercial. A regra está em
// lib/comercial/liberacao.ts; as funções do banco conferem a sessão de quem grava (v321/v322).

import { Fragment, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { CheckCircle2, Handshake, Loader2, Plus, Sparkles, Trash2, Undo2 } from "lucide-react";
import Dica from "@/components/ui/Dica";
import Modal from "@/components/ui/Modal";
import { confirmar } from "@/components/ui/confirm";
import { DICAS_COMERCIAL_LIBERAR } from "@/lib/dicas/comercial";
import {
  useCatalogoIntervencoes,
  useConcluirAtendimento,
  useEventosAtendimento,
  useReabrirAtendimento,
  useRetirarIntervencao,
  useSalvarIntervencaoIndicada,
  useSalvarParecerComercial,
  type IntervencaoCatalogo,
} from "@/lib/hooks/useComercial";
import {
  MODALIDADES,
  chaveRisco,
  faltaParaConcluir,
  intervencoesDoRisco,
  type AtendimentoComercial,
  type IntervencaoIndicada,
  type RiscoConciliado,
} from "@/lib/comercial/liberacao";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
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
  idEmpresa,
  nomeEmpresa,
  municipio,
  fechada,
  riscos,
  indicadas,
  atendimento,
  podeAlterar,
  podeRetirar,
}: {
  idEmpresa: string;
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
  const { data: eventos = [] } = useEventosAtendimento(idEmpresa);
  const salvarParecer = useSalvarParecerComercial();
  const concluir = useConcluirAtendimento();

  const [retirando, setRetirando] = useState(false);
  const [rascunho, setRascunho] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);

  const liberado = atendimento?.status === "CONCLUIDO";
  const parecer = rascunho ?? atendimento?.parecer ?? "";
  const falta = faltaParaConcluir(parecer);
  const responsaveis = useMemo(() => [...new Set(catalogo.map((c) => c.responsavel).filter(Boolean))] as string[], [catalogo]);

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
    if (ok) concluir.mutate({ idEmpresa, parecer }, { onSuccess: () => setRascunho(null) });
  }

  return (
    <>
      <section id="etapa-intervencoes" className="scroll-mt-20">
        <TituloEtapa numero={3} titulo="Intervenções" />
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          {!fechada ? (
            <p className="text-sm text-gray-500">Feche a conciliação para indicar as intervenções.</p>
          ) : riscos.length === 0 ? (
            <p className="text-sm text-gray-500">A conciliação fechada não tem risco confirmado. Nada vai para o Comercial.</p>
          ) : (
            <>
              <p className="text-xs text-gray-500">
                Riscos confirmados na conciliação fechada. As opções vêm do{" "}
                <Link href="/consolidacao-grupo/intervencoes" className="font-medium text-indigo-700 underline">
                  catálogo de intervenções
                </Link>
                , e cada alteração é gravada na hora.
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[56rem] text-sm">
                  <thead className="border-b border-gray-200 text-left text-xs font-semibold text-gray-600">
                    <tr>
                      <th className="w-56 py-2 pr-3">Risco</th>
                      <th className="py-2 pr-2">Intervenção</th>
                      <th className="w-32 py-2 pr-2">Modalidade</th>
                      <th className="w-72 py-2 pr-2">Responsável</th>
                      <th className="w-24 py-2 pr-2">Prazo (dias)</th>
                      <th className="w-10 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {riscos.map((r) => (
                      <LinhasDoRisco
                        key={r.chave}
                        risco={r}
                        idEmpresa={idEmpresa}
                        itens={intervencoesDoRisco(indicadas, r.chave)}
                        catalogo={catalogo}
                        podeAlterar={podeAlterar}
                      />
                    ))}
                  </tbody>
                </table>
                <datalist id="comercial-responsaveis">
                  {responsaveis.map((v) => (
                    <option key={v} value={v} />
                  ))}
                </datalist>
              </div>
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
              {podeAlterar && riscos.length > 0 && (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {falta && <span className="mr-auto text-xs text-amber-800">{falta}</span>}
                  <button
                    type="button"
                    disabled={rascunho === null || salvarParecer.isPending}
                    onClick={() => salvarParecer.mutate({ idEmpresa, parecer }, { onSuccess: () => setRascunho(null) })}
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

      {retirando && <JanelaRetirar idEmpresa={idEmpresa} onFechar={() => setRetirando(false)} />}
    </>
  );
}

/** As linhas de um risco: uma por intervenção, a de adicionar e, sem nenhuma, o aviso. */
function LinhasDoRisco({
  risco,
  idEmpresa,
  itens,
  catalogo,
  podeAlterar,
}: {
  risco: RiscoConciliado;
  idEmpresa: string;
  itens: IntervencaoIndicada[];
  catalogo: IntervencaoCatalogo[];
  podeAlterar: boolean;
}) {
  const [adicionando, setAdicionando] = useState(false);
  const mostrarNova = podeAlterar && (adicionando || itens.length === 0);
  const linhas = itens.length + (mostrarNova ? 1 : 0) || 1;

  const celulaRisco = (
    <td rowSpan={linhas} className="py-2 pr-3 align-top">
      <span className="font-medium text-gray-900">{risco.setor}</span>
      <span className="block text-gray-700">{risco.fator}</span>
      <div className="mt-1 flex flex-wrap gap-1">
        {risco.aet && (
          <span className="rounded-full border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-800">Aprofundar com AET</span>
        )}
        {risco.foraDaConciliacao && (
          <span className="rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">Fora da última conciliação</span>
        )}
      </div>
      {podeAlterar && itens.length > 0 && !adicionando && (
        <button type="button" onClick={() => setAdicionando(true)} className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-indigo-700 hover:underline">
          <Plus className="size-3.5" /> Adicionar intervenção
        </button>
      )}
    </td>
  );

  return (
    <Fragment>
      {itens.map((i, n) => (
        <LinhaIntervencao key={i.id_item} risco={risco} idEmpresa={idEmpresa} item={i} catalogo={catalogo} podeAlterar={podeAlterar} celulaRisco={n === 0 ? celulaRisco : null} />
      ))}
      {mostrarNova && (
        <LinhaIntervencao
          risco={risco}
          idEmpresa={idEmpresa}
          item={null}
          catalogo={catalogo}
          podeAlterar
          celulaRisco={itens.length === 0 ? celulaRisco : null}
          onCriada={() => setAdicionando(false)}
          onCancelar={itens.length > 0 ? () => setAdicionando(false) : undefined}
        />
      )}
      {itens.length === 0 && !mostrarNova && (
        <tr>
          {celulaRisco}
          <td colSpan={5} className="py-2 pr-2 text-xs text-gray-400">
            Nenhuma intervenção indicada.
          </td>
        </tr>
      )}
    </Fragment>
  );
}

function LinhaIntervencao({
  risco,
  idEmpresa,
  item,
  catalogo,
  podeAlterar,
  celulaRisco,
  onCriada,
  onCancelar,
}: {
  risco: RiscoConciliado;
  idEmpresa: string;
  item: IntervencaoIndicada | null;
  catalogo: IntervencaoCatalogo[];
  podeAlterar: boolean;
  celulaRisco: ReactNode;
  onCriada?: () => void;
  onCancelar?: () => void;
}) {
  const salvar = useSalvarIntervencaoIndicada();
  const retirar = useRetirarIntervencao();
  const [responsavel, setResponsavel] = useState(item?.responsavel ?? "");
  const [prazo, setPrazo] = useState(item?.prazo_dias ? String(item.prazo_dias) : "");

  const noCatalogo = catalogo.find((c) => c.id_intervencao === item?.id_intervencao);
  const opcoesIntervencao = catalogo.filter((c) => c.ativo || c.id_intervencao === item?.id_intervencao);
  const bloqueado = !podeAlterar || salvar.isPending;

  const gravar = (mudanca: { idIntervencao?: string | null; nome?: string; modalidade?: string | null; responsavel?: string | null; prazoDias?: number | null }) =>
    salvar.mutate(
      {
        idItem: item?.id_item ?? null,
        idEmpresa,
        setorChave: risco.setorChave,
        setorNome: risco.setor,
        idFator: risco.idFator,
        fatorNome: risco.fator,
        idIntervencao: item?.id_intervencao ?? null,
        nome: item?.nome ?? "",
        modalidade: item?.modalidade ?? null,
        responsavel: item?.responsavel ?? null,
        prazoDias: item?.prazo_dias ?? null,
        ...mudanca,
      },
      { onSuccess: () => onCriada?.() },
    );

  function escolherIntervencao(id: string) {
    const c = catalogo.find((x) => x.id_intervencao === id);
    if (!c) return;
    // Trocar a intervenção traz a modalidade e o responsável dela; depois dá para mudar.
    setResponsavel(c.responsavel ?? "");
    gravar({ idIntervencao: c.id_intervencao, nome: c.nome, modalidade: c.modalidades[0] ?? null, responsavel: c.responsavel ?? null });
  }

  function gravarPrazo() {
    const dias = prazo.trim() ? Math.max(1, Math.floor(Number(prazo))) : null;
    if (dias !== null && !Number.isFinite(dias)) return;
    if (dias === (item?.prazo_dias ?? null)) return;
    setPrazo(dias ? String(dias) : "");
    gravar({ prazoDias: dias });
  }

  async function remover() {
    if (!item) return;
    const ok = await confirmar({ title: "Retirar esta intervenção?", description: `${item.nome} sai de ${risco.setor} · ${risco.fator}.`, confirmLabel: "Retirar", variant: "danger" });
    if (ok) retirar.mutate({ idEmpresa, idItem: item.id_item });
  }

  return (
    <tr className="align-top">
      {celulaRisco}
      <td className="py-2 pr-2">
        <select
          value={item?.id_intervencao ?? ""}
          disabled={bloqueado}
          onChange={(e) => escolherIntervencao(e.target.value)}
          aria-label={`Intervenção para ${risco.setor}, ${risco.fator}`}
          className={campoCls}
        >
          {!item && <option value="">Escolha a intervenção...</option>}
          {item && !noCatalogo && <option value={item.id_intervencao ?? ""}>{item.nome}</option>}
          {opcoesIntervencao.map((c) => (
            <option key={c.id_intervencao} value={c.id_intervencao}>
              {c.nome}
            </option>
          ))}
        </select>
      </td>
      <td className="py-2 pr-2">
        <select
          value={item?.modalidade ?? ""}
          disabled={bloqueado || !item}
          onChange={(e) => gravar({ modalidade: e.target.value || null })}
          aria-label="Modalidade"
          className={campoCls}
        >
          <option value="">—</option>
          {MODALIDADES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </td>
      <td className="py-2 pr-2">
        <input
          list="comercial-responsaveis"
          value={responsavel}
          disabled={bloqueado || !item}
          onChange={(e) => setResponsavel(e.target.value)}
          onBlur={() => responsavel.trim() !== (item?.responsavel ?? "") && item && gravar({ responsavel: responsavel.trim() || null })}
          aria-label="Responsável"
          className={campoCls}
        />
      </td>
      <td className="py-2 pr-2">
        <input
          type="number"
          min={1}
          value={prazo}
          disabled={bloqueado || !item}
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

function JanelaRetirar({ idEmpresa, onFechar }: { idEmpresa: string; onFechar: () => void }) {
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
            onClick={() => reabrir.mutate({ idEmpresa, motivo }, { onSuccess: onFechar })}
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
