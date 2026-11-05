"use client";

// Consolidação › Liberar para o Comercial › atendimento de uma empresa (0.3.233, banco v321).
// Iniciar conta o tempo (o mesmo painel da inspeção) e libera a edição; concluir manda ao vendedor;
// reabrir tira do vendedor até concluir de novo. As funções do banco conferem a sessão aberta.

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, ClipboardCheck, Hand, Loader2, Plus, RotateCcw, Sparkles, Trash2, Undo2 } from "lucide-react";
import Dica from "@/components/ui/Dica";
import Modal from "@/components/ui/Modal";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { ConfirmHost, confirmar } from "@/components/ui/confirm";
import PainelTempoDocumento from "@/components/inspecoes/PainelTempoDocumento";
import { DICAS_COMERCIAL_LIBERAR } from "@/lib/dicas/comercial";
import {
  useCatalogoIntervencoes,
  useConcluirAtendimento,
  useDecidirServico,
  useDesfazerDecisao,
  useEventosAtendimento,
  useIndicarIntervencao,
  useLiberacaoServicos,
  usePodeLiberarServicos,
  useReabrirAtendimento,
  useRetirarIntervencao,
  useSalvarParecerComercial,
} from "@/lib/hooks/useComercial";
import { useAgora, useAtividadeSessao, useSessoesComercial } from "@/lib/hooks/useDocumentoSessoes";
import { useEmpresa } from "@/lib/hooks/useEmpresas";
import { useUserStore } from "@/lib/store";
import {
  MODALIDADES,
  PRODUTOS_COM_MODALIDADE,
  faltaParaConcluir,
  type IntervencaoIndicada,
  type ServicoNaFila,
  type StatusDecisao,
} from "@/lib/comercial/liberacao";
import { NOME_PRODUTO } from "@/lib/comercial/oportunidades";
import { minhaSessaoAberta } from "@/lib/inspecoes/sessoes";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { mensagemErro } from "@/lib/errors";
import { cn, fmtData, formatCNPJ } from "@/lib/utils";
import toast from "react-hot-toast";

const inputCls =
  "w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 focus:border-marca-primary focus:outline-none focus:ring-2 focus:ring-marca-primary/20";
const btnPrimario =
  "inline-flex items-center gap-1.5 rounded-lg bg-marca-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-marca-accent disabled:opacity-60";
const btnNeutro =
  "inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60";

const ROTULO_ESTADO = { pendente: "Na fila", liberado: "Liberado", segurado: "Segurado", legado: "Liberado antes da fila" } as const;
const COR_ESTADO = {
  pendente: "border-amber-300 bg-amber-50 text-amber-900",
  liberado: "border-emerald-200 bg-emerald-50 text-emerald-900",
  segurado: "border-gray-300 bg-gray-100 text-gray-700",
  legado: "border-sky-200 bg-sky-50 text-sky-900",
} as const;

interface JanelaDecisao {
  servicos: ServicoNaFila[];
  status: StatusDecisao;
}

export default function AtendimentoComercialPage() {
  const { idEmpresa } = useParams<{ idEmpresa: string }>();
  const { data, isLoading, error } = useLiberacaoServicos();
  const { data: sessoes = [] } = useSessoesComercial(idEmpresa);
  const { data: empresa } = useEmpresa(idEmpresa);
  const { data: eventos = [] } = useEventosAtendimento(idEmpresa);
  const podeLiberar = usePodeLiberarServicos();
  const user = useUserStore((s) => s.user);
  const agora = useAgora(30_000);

  const minha = minhaSessaoAberta(sessoes, user?.id_usuario, agora);
  useAtividadeSessao(idEmpresa, !!minha, "comercial");

  const desfazer = useDesfazerDecisao();
  const retirar = useRetirarIntervencao();
  const salvarParecer = useSalvarParecerComercial();
  const concluir = useConcluirAtendimento();

  const [janela, setJanela] = useState<JanelaDecisao | null>(null);
  const [indicando, setIndicando] = useState(false);
  const [reabrindo, setReabrindo] = useState(false);
  const [rascunho, setRascunho] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);

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

  const servicos = (data?.fila ?? []).filter((s) => s.empresa.empresa.idEmpresa === idEmpresa);
  const indicadas = (data?.indicadas ?? []).filter((i) => i.id_empresa === idEmpresa);
  const atendimento = (data?.atendimentos ?? []).find((a) => a.id_empresa === idEmpresa) ?? null;
  const concluido = atendimento?.status === "CONCLUIDO";
  const podeAlterar = !concluido && !!minha;
  const pendentes = servicos.filter((s) => s.estado === "pendente");
  const parecer = rascunho ?? atendimento?.parecer ?? "";
  const falta = faltaParaConcluir(pendentes.length, parecer);

  const cadastro = servicos[0]?.empresa.empresa;
  const nome = cadastro?.nome ?? atendimento?.empresas?.nome_empresa ?? empresa?.nome_empresa ?? "Empresa";
  const cnpj = cadastro?.cnpj ?? atendimento?.empresas?.cnpj ?? empresa?.cnpj ?? null;
  const municipio = cadastro?.municipio ?? atendimento?.empresas?.municipio ?? empresa?.municipio ?? null;

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
          municipio,
          rascunho: parecer,
          servicos: servicos.map((s) => ({
            nome: NOME_PRODUTO[s.oportunidade.produto],
            estado: ROTULO_ESTADO[s.estado],
            origens: s.oportunidade.origens,
            detalhes: s.oportunidade.detalhes,
            modalidades: s.decisao?.modalidades,
            orientacao: s.decisao?.orientacao,
            motivo: s.decisao?.motivo,
          })),
          intervencoes: indicadas.map((i) => ({ nome: i.nome, modalidades: i.modalidades, orientacao: i.orientacao })),
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
    const ok = await confirmar({
      title: "Concluir o atendimento?",
      description: "O vendedor passa a ver os serviços liberados, as intervenções e o parecer. O tempo para de contar.",
      confirmLabel: "Concluir",
      variant: "primary",
    });
    if (ok) concluir.mutate({ idEmpresa, parecer }, { onSuccess: () => setRascunho(null) });
  }

  async function voltarParaFila(s: ServicoNaFila) {
    const ok = await confirmar({
      title: "Voltar para a fila?",
      description: `${NOME_PRODUTO[s.oportunidade.produto]} volta a esperar decisão. A decisão atual é apagada.`,
      confirmLabel: "Voltar para a fila",
      variant: "primary",
    });
    if (ok) desfazer.mutate({ idEmpresa, produto: s.oportunidade.produto });
  }

  async function retirarIntervencao(i: IntervencaoIndicada) {
    const ok = await confirmar({ title: "Retirar esta intervenção?", description: i.nome, confirmLabel: "Retirar", variant: "danger" });
    if (ok) retirar.mutate({ idEmpresa, idIntervencao: i.id_intervencao });
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
            {cnpj ? formatCNPJ(cnpj) : "—"}
            {municipio ? ` · ${municipio}` : ""}
          </p>
        </div>
        {concluido && (
          <button type="button" onClick={() => setReabrindo(true)} className={btnNeutro}>
            <RotateCcw className="size-4" /> Reabrir
          </button>
        )}
      </div>

      {concluido && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Concluído{atendimento?.concluido_em ? ` em ${fmtData(atendimento.concluido_em)}` : ""}
          {atendimento?.concluido_por ? ` por ${atendimento.concluido_por}` : ""}. O vendedor já vê os serviços liberados.
          {pendentes.length > 0 && " Chegou serviço novo: reabra para decidir."}
        </p>
      )}

      <PainelTempoDocumento
        fonte="comercial"
        idInspecao={idEmpresa}
        sessoes={sessoes}
        idUsuario={user?.id_usuario}
        podeApontar={!concluido}
        podeCorrigir={false}
        concluidaEm={atendimento?.concluido_em}
        entregue={concluido}
      />

      {!concluido && !minha && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Clique em <strong>Iniciar</strong> para decidir os serviços, indicar intervenções e escrever o parecer.
        </p>
      )}

      {/* Serviços indicados */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-gray-900">Serviços indicados</h2>
          {podeAlterar && pendentes.length > 1 && (
            <button type="button" onClick={() => setJanela({ servicos: pendentes, status: "LIBERADO" })} className={btnPrimario}>
              <CheckCircle2 className="size-4" /> Liberar os {pendentes.length} da fila
            </button>
          )}
        </div>
        {servicos.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">Nenhum serviço a decidir. Envie uma inspeção concluída ou uma AEP entregue, ou indique uma intervenção abaixo.</p>
        ) : (
          <ul className="mt-2 divide-y divide-gray-100">
            {servicos.map((s) => (
              <li key={s.oportunidade.produto} className="flex flex-wrap items-start gap-3 py-3">
                <LinhaServico s={s} />
                {podeAlterar && (
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {s.estado !== "liberado" && s.estado !== "legado" && (
                      <button type="button" onClick={() => setJanela({ servicos: [s], status: "LIBERADO" })} className={btnPrimario}>
                        <CheckCircle2 className="size-4" /> Liberar
                      </button>
                    )}
                    {s.estado === "liberado" && (
                      <button type="button" onClick={() => setJanela({ servicos: [s], status: "LIBERADO" })} className={btnNeutro}>
                        Editar
                      </button>
                    )}
                    {s.estado !== "segurado" && (
                      <button type="button" onClick={() => setJanela({ servicos: [s], status: "SEGURADO" })} className={btnNeutro}>
                        <Hand className="size-4" /> Segurar
                      </button>
                    )}
                    {(s.estado === "liberado" || s.estado === "segurado") && (
                      <button type="button" onClick={() => voltarParaFila(s)} disabled={desfazer.isPending} className={btnNeutro}>
                        <Undo2 className="size-4" /> Voltar para a fila
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Intervenções */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Intervenções psicossociais</h2>
            <p className="text-xs text-gray-500">
              As opções vêm do{" "}
              <Link href="/consolidacao-grupo/intervencoes" className="font-medium text-marca-primary underline">
                catálogo de intervenções
              </Link>
              .
            </p>
          </div>
          {podeAlterar && (
            <button type="button" onClick={() => setIndicando(true)} className={btnNeutro}>
              <Plus className="size-4" /> Indicar intervenção
            </button>
          )}
        </div>
        {indicadas.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">Nenhuma intervenção indicada.</p>
        ) : (
          <ul className="mt-2 divide-y divide-gray-100">
            {indicadas.map((i) => (
              <li key={i.id_intervencao} className="flex flex-wrap items-start justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-[16rem] flex-1">
                  <p className="font-medium text-gray-900">{i.nome}</p>
                  <p className="text-xs text-gray-500">
                    {[i.modalidades.join(", ") || "Sem modalidade", i.responsavel, i.orientacao].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {podeAlterar && (
                  <button type="button" onClick={() => retirarIntervencao(i)} disabled={retirar.isPending} className={btnNeutro} aria-label={`Retirar ${i.nome}`}>
                    <Trash2 className="size-4" /> Retirar
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Parecer */}
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

      {janela && <JanelaDecidir key={`${janela.status}-${janela.servicos.length}`} janela={janela} idEmpresa={idEmpresa} onFechar={() => setJanela(null)} />}
      {indicando && <JanelaIndicar idEmpresa={idEmpresa} jaIndicadas={indicadas} onFechar={() => setIndicando(false)} />}
      {reabrindo && <JanelaReabrir idEmpresa={idEmpresa} onFechar={() => setReabrindo(false)} />}
    </div>
  );
}

function LinhaServico({ s }: { s: ServicoNaFila }) {
  const { oportunidade: o, decisao, estado, empresa: c } = s;
  const detalhes = o.produto === "AET" ? o.setores.map((st) => `${st.nome}${st.expostos ? ` (${st.expostos})` : ""}`) : o.detalhes;
  return (
    <div className="min-w-[16rem] flex-1 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-gray-900">{NOME_PRODUTO[o.produto]}</span>
        <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", COR_ESTADO[estado])}>{ROTULO_ESTADO[estado]}</span>
        {o.situacao === "revisao" && (
          <span className="rounded-full border border-orange-300 bg-orange-50 px-2 py-0.5 text-[11px] font-semibold text-orange-900">Revisão</span>
        )}
        {s.reenviado && (
          <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-900">Documento reenviado</span>
        )}
      </div>
      <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-gray-500">
        <ClipboardCheck className="size-3.5" /> Indicado por {o.origens.join(" + ")}
        {s.enviadoEm ? ` · enviado em ${fmtData(s.enviadoEm)}` : ""}
        {o.produto === "AET" && c.expostosAet > 0 ? ` · ${c.expostosAet} trabalhadores expostos` : ""}
      </p>
      {detalhes.length > 0 && (
        <p className="mt-1 text-xs text-gray-700">
          {detalhes.slice(0, 6).join(" · ")}
          {detalhes.length > 6 ? ` · + ${detalhes.length - 6}` : ""}
        </p>
      )}
      {estado === "liberado" && decisao && (
        <p className="mt-1 text-xs text-emerald-800">
          Em {fmtData(decisao.decidido_em)}
          {decisao.decidido_por ? ` por ${decisao.decidido_por}` : ""}
          {decisao.modalidades?.length ? ` · ${decisao.modalidades.join(", ")}` : ""}
          {decisao.orientacao ? ` · ${decisao.orientacao}` : ""}
        </p>
      )}
      {estado === "segurado" && decisao && (
        <p className="mt-1 text-xs text-gray-600">
          Em {fmtData(decisao.decidido_em)}
          {decisao.decidido_por ? ` por ${decisao.decidido_por}` : ""}: {decisao.motivo}
        </p>
      )}
    </div>
  );
}

function CaixasModalidade({ opcoes, valor, onChange }: { opcoes: readonly string[]; valor: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-3">
      {opcoes.map((m) => (
        <label key={m} className="inline-flex cursor-pointer items-center gap-1.5 text-gray-700">
          <input
            type="checkbox"
            checked={valor.includes(m)}
            onChange={(e) => onChange(e.target.checked ? [...valor, m] : valor.filter((x) => x !== m))}
            className="size-4 accent-marca-primary"
          />
          {m}
        </label>
      ))}
    </div>
  );
}

function JanelaDecidir({ janela, idEmpresa, onFechar }: { janela: JanelaDecisao; idEmpresa: string; onFechar: () => void }) {
  const decidir = useDecidirServico();
  const liberar = janela.status === "LIBERADO";
  // Um serviço só: começa com a decisão anterior, para reenvio e edição não perderem o que foi escrito.
  const anterior = janela.servicos.length === 1 ? janela.servicos[0].decisao : null;
  const [modalidades, setModalidades] = useState<string[]>(anterior?.modalidades ?? []);
  const [orientacao, setOrientacao] = useState(anterior?.orientacao ?? "");
  const [motivo, setMotivo] = useState(anterior?.motivo ?? "");
  const comModalidade = janela.servicos.some((s) => PRODUTOS_COM_MODALIDADE.includes(s.oportunidade.produto));
  const podeGravar = liberar || motivo.trim().length > 0;

  const gravar = () =>
    decidir.mutate(
      {
        idEmpresa,
        produtos: janela.servicos.map((s) => s.oportunidade.produto),
        status: janela.status,
        modalidades: comModalidade ? modalidades : [],
        orientacao: orientacao.trim() || null,
        motivo: motivo.trim() || null,
      },
      { onSuccess: onFechar },
    );

  return (
    <Modal
      open
      onClose={onFechar}
      title={liberar ? "Liberar para o vendedor" : "Segurar serviço"}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onFechar} className={btnNeutro}>
            Cancelar
          </button>
          <button type="button" onClick={gravar} disabled={!podeGravar || decidir.isPending} className={btnPrimario}>
            {decidir.isPending && <Loader2 className="size-4 animate-spin" />}
            {liberar ? "Liberar" : "Segurar"}
          </button>
        </div>
      }
    >
      <div className="space-y-4 text-sm">
        <ul className="text-xs text-gray-600">
          {janela.servicos.map((s) => (
            <li key={s.oportunidade.produto}>{NOME_PRODUTO[s.oportunidade.produto]}</li>
          ))}
        </ul>
        {liberar ? (
          <>
            {comModalidade && (
              <fieldset>
                <legend className="mb-1 text-xs font-semibold text-gray-600">
                  <Dica texto={DICAS_COMERCIAL_LIBERAR.modalidades}>Modalidades possíveis</Dica>
                </legend>
                <CaixasModalidade opcoes={MODALIDADES} valor={modalidades} onChange={setModalidades} />
              </fieldset>
            )}
            <div>
              <label htmlFor="comercial-orientacao" className="mb-1 block text-xs font-semibold text-gray-600">
                <Dica texto={DICAS_COMERCIAL_LIBERAR.orientacao}>Orientação para o vendedor (opcional)</Dica>
              </label>
              <textarea id="comercial-orientacao" rows={3} value={orientacao} onChange={(e) => setOrientacao(e.target.value)} className={inputCls} />
            </div>
          </>
        ) : (
          <div>
            <label htmlFor="comercial-motivo" className="mb-1 block text-xs font-semibold text-gray-600">
              <Dica texto={DICAS_COMERCIAL_LIBERAR.motivo}>Motivo</Dica> <span className="text-red-600">*</span>
            </label>
            <textarea id="comercial-motivo" rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} className={inputCls} />
          </div>
        )}
      </div>
    </Modal>
  );
}

function JanelaIndicar({ idEmpresa, jaIndicadas, onFechar }: { idEmpresa: string; jaIndicadas: IntervencaoIndicada[]; onFechar: () => void }) {
  const { data: catalogo = [], isLoading } = useCatalogoIntervencoes();
  const indicar = useIndicarIntervencao();
  const [id, setId] = useState("");
  const [modalidades, setModalidades] = useState<string[]>([]);
  const [orientacao, setOrientacao] = useState("");

  const ja = new Set(jaIndicadas.map((i) => i.id_intervencao));
  const opcoes = catalogo.filter((c) => c.ativo && !ja.has(c.id_intervencao));
  const escolhida = catalogo.find((c) => c.id_intervencao === id);

  return (
    <Modal
      open
      onClose={onFechar}
      title="Indicar intervenção"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onFechar} className={btnNeutro}>
            Cancelar
          </button>
          <button
            type="button"
            disabled={!id || indicar.isPending}
            onClick={() => indicar.mutate({ idEmpresa, idIntervencao: id, modalidades, orientacao: orientacao.trim() || null }, { onSuccess: onFechar })}
            className={btnPrimario}
          >
            {indicar.isPending && <Loader2 className="size-4 animate-spin" />} Indicar
          </button>
        </div>
      }
    >
      <div className="space-y-4 text-sm">
        <div>
          <label htmlFor="comercial-intervencao" className="mb-1 block text-xs font-semibold text-gray-600">
            Intervenção
          </label>
          <select
            id="comercial-intervencao"
            value={id}
            disabled={isLoading}
            onChange={(e) => {
              const c = catalogo.find((x) => x.id_intervencao === e.target.value);
              setId(e.target.value);
              setModalidades(c?.modalidades ?? []);
            }}
            className={inputCls}
          >
            <option value="">{isLoading ? "Carregando..." : "Escolha..."}</option>
            {opcoes.map((c) => (
              <option key={c.id_intervencao} value={c.id_intervencao}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
        {escolhida && (
          <>
            {escolhida.modalidades.length > 0 && (
              <fieldset>
                <legend className="mb-1 text-xs font-semibold text-gray-600">
                  <Dica texto={DICAS_COMERCIAL_LIBERAR.modalidades}>Modalidades possíveis</Dica>
                </legend>
                <CaixasModalidade opcoes={escolhida.modalidades} valor={modalidades} onChange={setModalidades} />
              </fieldset>
            )}
            {(escolhida.observacao || escolhida.responsavel) && (
              <p className="text-xs text-gray-500">{[escolhida.observacao, escolhida.responsavel && `Responsável: ${escolhida.responsavel}`].filter(Boolean).join(" ")}</p>
            )}
            <div>
              <label htmlFor="comercial-orientacao-int" className="mb-1 block text-xs font-semibold text-gray-600">
                <Dica texto={DICAS_COMERCIAL_LIBERAR.orientacao}>Orientação para o vendedor (opcional)</Dica>
              </label>
              <textarea id="comercial-orientacao-int" rows={2} value={orientacao} onChange={(e) => setOrientacao(e.target.value)} className={inputCls} />
            </div>
          </>
        )}
      </div>
    </Modal>
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
        <p className="text-gray-700">O vendedor deixa de ver os serviços liberados e as intervenções até você concluir de novo.</p>
        <label htmlFor="comercial-reabrir" className="block text-xs font-semibold text-gray-600">
          Motivo <span className="text-red-600">*</span>
        </label>
        <textarea id="comercial-reabrir" rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} className={inputCls} />
      </div>
    </Modal>
  );
}
