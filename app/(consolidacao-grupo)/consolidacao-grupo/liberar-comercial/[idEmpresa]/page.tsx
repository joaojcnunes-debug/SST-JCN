"use client";

// Consolidação › Liberar para o Comercial › atendimento de uma empresa (0.3.233, refeita na 0.3.235,
// banco v322). Iniciar conta o tempo (o mesmo painel da inspeção) e libera a edição; concluir manda ao
// vendedor; reabrir tira do vendedor até concluir de novo. As funções do banco conferem a sessão.

import { Fragment, useMemo, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { ArrowLeft, CheckCircle2, Loader2, Plus, RotateCcw, Search, Sparkles, Trash2 } from "lucide-react";
import Dica from "@/components/ui/Dica";
import Modal from "@/components/ui/Modal";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { ConfirmHost, confirmar } from "@/components/ui/confirm";
import PainelTempoDocumento from "@/components/inspecoes/PainelTempoDocumento";
import { DICAS_COMERCIAL_LIBERAR } from "@/lib/dicas/comercial";
import {
  useCatalogoIntervencoes,
  useConcluirAtendimento,
  useEventosAtendimento,
  useLiberacaoServicos,
  usePodeLiberarServicos,
  useReabrirAtendimento,
  useRetirarIntervencao,
  useSalvarIntervencaoIndicada,
  useSalvarParecerComercial,
  type IntervencaoCatalogo,
} from "@/lib/hooks/useComercial";
import { useAgora, useAtividadeSessao, useSessoesComercial } from "@/lib/hooks/useDocumentoSessoes";
import { useUserStore } from "@/lib/store";
import {
  MODALIDADES,
  chaveRisco,
  faltaParaConcluir,
  intervencoesDoRisco,
  riscosComIntervencoes,
  riscosDoFechamento,
  type IntervencaoIndicada,
  type RiscoConciliado,
} from "@/lib/comercial/liberacao";
import { minhaSessaoAberta } from "@/lib/inspecoes/sessoes";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { mensagemErro } from "@/lib/errors";
import { cn, fmtData, formatCNPJ } from "@/lib/utils";

const inputCls =
  "w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 focus:border-marca-primary focus:outline-none focus:ring-2 focus:ring-marca-primary/20";
const campoCls =
  "w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 focus:border-marca-primary focus:outline-none focus:ring-1 focus:ring-marca-primary/30 disabled:border-transparent disabled:bg-transparent disabled:text-gray-700";
const btnPrimario =
  "inline-flex items-center gap-1.5 rounded-lg bg-marca-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-marca-accent disabled:opacity-60";
const btnNeutro =
  "inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60";

export default function AtendimentoComercialPage() {
  const { idEmpresa } = useParams<{ idEmpresa: string }>();
  const { data, isLoading, error } = useLiberacaoServicos();
  const { data: sessoes = [] } = useSessoesComercial(idEmpresa);
  const { data: eventos = [] } = useEventosAtendimento(idEmpresa);
  const { data: catalogo = [] } = useCatalogoIntervencoes();
  const podeLiberar = usePodeLiberarServicos();
  const user = useUserStore((s) => s.user);
  const agora = useAgora(30_000);

  const minha = minhaSessaoAberta(sessoes, user?.id_usuario, agora);
  useAtividadeSessao(idEmpresa, !!minha, "comercial");

  const salvarParecer = useSalvarParecerComercial();
  const concluir = useConcluirAtendimento();

  const [reabrindo, setReabrindo] = useState(false);
  const [rascunho, setRascunho] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);

  const conciliacao = data?.conciliacoes.find((c) => c.id_empresa === idEmpresa);
  const indicadas = useMemo(() => (data?.indicadas ?? []).filter((i) => i.id_empresa === idEmpresa), [data, idEmpresa]);
  const riscos = useMemo(
    () =>
      riscosComIntervencoes(riscosDoFechamento(conciliacao?.itens ?? []), indicadas)
        // Conciliação reaberta: não há "última fechada" para comparar; o aviso do topo explica.
        .map((r) => (conciliacao ? r : { ...r, foraDaConciliacao: false })),
    [conciliacao, indicadas],
  );

  if (isLoading) return <LoadingSkeleton rows={6} />;
  if (error) {
    return <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">Não foi possível carregar o atendimento. Tente de novo.</p>;
  }
  if (!podeLiberar) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-10 text-center text-sm text-gray-600">
        A liberação para o Comercial é feita por quem edita (Admin ou Técnico).
      </p>
    );
  }

  const atendimento = (data?.atendimentos ?? []).find((a) => a.id_empresa === idEmpresa) ?? null;
  const concluido = atendimento?.status === "CONCLUIDO";
  const podeAlterar = !concluido && !!minha && !!conciliacao;
  const parecer = rascunho ?? atendimento?.parecer ?? "";
  const falta = faltaParaConcluir(parecer);
  const cadastro = conciliacao?.empresas ?? atendimento?.empresas;
  const nome = cadastro?.nome_empresa ?? "Empresa";

  if (!conciliacao && !atendimento) {
    return (
      <div className="space-y-3">
        <Link href="/consolidacao-grupo/liberar-comercial" className="inline-flex items-center gap-1 text-xs font-medium text-marca-primary hover:underline">
          <ArrowLeft className="size-3.5" /> Todos os atendimentos
        </Link>
        <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-10 text-center text-sm text-gray-600">
          Esta empresa ainda não tem conciliação fechada. Feche em Conciliação DRPS/QPS × AEP.
        </p>
      </div>
    );
  }

  const conciliacaoNova =
    concluido && !!atendimento?.concluido_em && !!conciliacao && new Date(conciliacao.fechado_em).getTime() > new Date(atendimento.concluido_em).getTime();

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
          empresa_nome: nome,
          municipio: cadastro?.municipio ?? null,
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

  async function concluirAtendimento() {
    const semItem = riscos.filter((r) => !indicadas.some((i) => chaveRisco(i.setor_chave, i.id_fator) === r.chave)).length;
    const ok = await confirmar({
      title: "Concluir o atendimento?",
      description: `${
        semItem > 0 ? `${semItem === 1 ? "1 risco está" : `${semItem} riscos estão`} sem intervenção. ` : ""
      }O vendedor passa a ver as intervenções, os riscos que pediram AET e o parecer. O tempo para de contar.`,
      confirmLabel: "Concluir",
      variant: "primary",
    });
    if (ok) concluir.mutate({ idEmpresa, parecer }, { onSuccess: () => setRascunho(null) });
  }

  return (
    <div className="space-y-4">
      <ConfirmHost />
      <Link href="/consolidacao-grupo/liberar-comercial" className="inline-flex items-center gap-1 text-xs font-medium text-marca-primary hover:underline">
        <ArrowLeft className="size-3.5" /> Todos os atendimentos
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{nome}</h1>
          <p className="text-sm text-gray-500">
            {cadastro?.cnpj ? formatCNPJ(cadastro.cnpj) : "—"}
            {cadastro?.municipio ? ` · ${cadastro.municipio}` : ""}
            {conciliacao ? ` · conciliação fechada em ${fmtData(conciliacao.fechado_em)}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/consolidacao-grupo/conciliacao/${idEmpresa}`} className={btnNeutro}>
            <Search className="size-4" /> Ver a conciliação
          </Link>
          {concluido && conciliacao && (
            <button type="button" onClick={() => setReabrindo(true)} className={btnNeutro}>
              <RotateCcw className="size-4" /> Reabrir
            </button>
          )}
        </div>
      </div>

      {concluido && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Concluído{atendimento?.concluido_em ? ` em ${fmtData(atendimento.concluido_em)}` : ""}
          {atendimento?.concluido_por ? ` por ${atendimento.concluido_por}` : ""}.{conciliacao ? " O vendedor já vê as intervenções e o parecer." : ""}
          {conciliacaoNova && " A conciliação foi fechada de novo depois disso: reabra para conferir."}
        </p>
      )}

      <PainelTempoDocumento
        fonte="comercial"
        idInspecao={idEmpresa}
        sessoes={sessoes}
        idUsuario={user?.id_usuario}
        podeApontar={!concluido && !!conciliacao}
        podeCorrigir={false}
        concluidaEm={atendimento?.concluido_em}
        entregue={concluido}
      />

      {!conciliacao && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          A conciliação desta empresa foi reaberta. O vendedor não vê este atendimento até ela ser fechada de novo.
        </p>
      )}

      {conciliacao && !concluido && !minha && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Clique em <strong>{sessoes.length > 0 ? "Retomar" : "Iniciar"}</strong> para indicar as intervenções e escrever o parecer.
        </p>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div>
          <h2 className="text-sm font-bold text-gray-900">Riscos e intervenções</h2>
          <p className="text-xs text-gray-500">
            Riscos confirmados na conciliação fechada. As opções vêm do{" "}
            <Link href="/consolidacao-grupo/intervencoes" className="font-medium text-marca-primary underline">
              catálogo de intervenções
            </Link>
            , e cada alteração é gravada na hora.
          </p>
        </div>
        {riscos.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">A última conciliação fechada não tem risco confirmado.</p>
        ) : (
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
              {[...new Set(catalogo.map((c) => c.responsavel).filter(Boolean))].map((v) => (
                <option key={v} value={v as string} />
              ))}
            </datalist>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="comercial-parecer" className="text-sm font-bold text-gray-900">
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
          className={cn(inputCls, "mt-2 disabled:bg-gray-50 disabled:text-gray-600")}
          placeholder={podeAlterar ? "O que o vendedor precisa saber sobre esta empresa" : ""}
        />
        {podeAlterar && (
          <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
            {falta && <span className="mr-auto text-xs text-amber-800">{falta}</span>}
            <button
              type="button"
              disabled={rascunho === null || salvarParecer.isPending}
              onClick={() => salvarParecer.mutate({ idEmpresa, parecer }, { onSuccess: () => setRascunho(null) })}
              className={btnNeutro}
            >
              {salvarParecer.isPending && <Loader2 className="size-4 animate-spin" />} Salvar parecer
            </button>
            <button type="button" disabled={!!falta || concluir.isPending} onClick={concluirAtendimento} className={btnPrimario}>
              {concluir.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Concluir atendimento
            </button>
          </div>
        )}
      </section>

      {eventos.length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900">Histórico</h2>
          <ul className="mt-2 space-y-1.5 text-xs text-gray-600">
            {eventos.map((e) => (
              <li key={e.id_evento}>
                <strong className="text-gray-800">{e.tipo === "CONCLUIDO" ? "Concluído" : "Reaberto"}</strong> em {fmtData(e.em)}
                {e.por ? ` por ${e.por}` : ""}
                {e.motivo ? `: ${e.motivo}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      {reabrindo && <JanelaReabrir idEmpresa={idEmpresa} onFechar={() => setReabrindo(false)} />}
    </div>
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
        <button type="button" onClick={() => setAdicionando(true)} className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-marca-primary hover:underline">
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

function JanelaReabrir({ idEmpresa, onFechar }: { idEmpresa: string; onFechar: () => void }) {
  const reabrir = useReabrirAtendimento();
  const [motivo, setMotivo] = useState("");
  return (
    <Modal
      open
      onClose={onFechar}
      title="Reabrir atendimento"
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
            {reabrir.isPending && <Loader2 className="size-4 animate-spin" />} Reabrir
          </button>
        </div>
      }
    >
      <div className="space-y-2 text-sm">
        <p className="text-gray-700">O vendedor deixa de ver as intervenções, os riscos que pediram AET e o parecer até você concluir de novo.</p>
        <label htmlFor="comercial-reabrir" className="block text-xs font-semibold text-gray-600">
          Motivo <span className="text-red-600">*</span>
        </label>
        <textarea id="comercial-reabrir" rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} className={inputCls} />
      </div>
    </Modal>
  );
}
