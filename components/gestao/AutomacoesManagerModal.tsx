"use client";

import Dica from "@/components/ui/Dica";
import { DICAS_GESTAO_AUTOMACAO } from "@/lib/dicas/gestao";
import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { AlertTriangle, ArrowDown, ArrowUp, BookOpen, ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, Filter, History, Plus, Trash2, UserCog, Workflow, X } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { confirmar } from "@/components/ui/confirm";
import AutomacaoCondicaoBuilder from "@/components/gestao/AutomacaoCondicaoBuilder";
import AutomacaoAcaoEditor from "@/components/gestao/AutomacaoAcaoEditor";
import ProdutoResponsaveisAba from "@/components/gestao/ProdutoResponsaveisAba";
import AutomacoesHistorico from "@/components/gestao/AutomacoesHistorico";
import { AgendaEditor, ModeloTarefaEditor, ParadaEditor } from "@/components/gestao/AutomacaoGatilhoTempo";
import { acoesDaRegra, regraCompleta, GATILHOS_SST } from "@/lib/gestao/automacao-completa";
import { useUnidades } from "@/lib/hooks/useUnidades";
import { receitasDoQuadro } from "@/lib/gestao/receitas-automacao";
import { GATILHOS, GRUPOS_GATILHO, DIAS_PADRAO, descreverAcao, descreverRegra, ehGatilhoSubtarefa } from "@/lib/gestao/automacao-descricao";
import { nomesDoQuadro, useNomesAutomacao, useReordenarAutomacoes } from "@/lib/hooks/useAutomacoesTodas";
import {
  useAutomacoes, useSalvarAutomacao, useExcluirAutomacao, useUsuariosLista, useUsuarios,
  useModelos, useQuadros, useEtiquetasQuadro,
  type GestaoAutomacao, type GestaoStatus, type GatilhoAutomacao,
  type GestaoCampo, type CondicaoAutomacao, type AcaoAutomacao,
} from "@/lib/hooks/useGestao";

// v298 (Pacote A do levantamento Jira/Trello/ClickUp/Notion): a regra tem VÁRIAS ações, em ordem;
// cada ação pode ter a sua condição ("só se…") — é o se/senão. Gatilhos e condições novos e a aba
// Histórico, que mostra cada execução (rodou, pulou, falhou e por quê).

const NO_RELOGIO = new Set<string>(["agendado", "tarefa_parada", "data_inicio_chega", "subtarefa_inicio_chega"]);
const NAS_7H = new Set<string>(["prazo_proximo", "prazo_vencido", "subtarefa_entrega_proxima", "subtarefa_entrega_vencida"]);

/** Variáveis aceitas nos textos (comentário, e-mail, aviso, título, valor de campo). */
const VARIAVEIS: Partial<Record<GatilhoAutomacao | "sempre", string[]>> = {
  sempre: ["{titulo}", "{responsavel}", "{prazo}", "{status}", "{prioridade}", "{quadro}", "{data}"],
  comentario_adicionado: ["{comentario}", "{autor_comentario}"],
  etiqueta_adicionada: ["{etiqueta}"],
  responsavel_adicionado: ["{novo_responsavel}"],
  tarefa_parada: ["{dias_parada}"],
  dependencia_liberada: ["{bloqueadora}"],
  manual: ["{executado_por}"],
  sst_inspecao_concluida: ["{empresa}", "{unidade}", "{tecnico}", "{data_inspecao}", "{id_inspecao}"],
  sst_documento_concluido: ["{empresa}", "{unidade}", "{tecnico}", "{responsavel_elaboracao}", "{id_inspecao}"],
  sst_vencimento: ["{empresa}", "{unidade}", "{item}", "{validade}", "{dias_para_vencer}", "{id_inspecao}"],
};
/** 11/11: nos gatilhos de subtarefa, os textos aceitam também a subtarefa que disparou. */
const VARIAVEIS_SUBTAREFA = ["{subtarefa}", "{subtarefa_antes}", "{responsavel_subtarefa}", "{entrega_subtarefa}", "{inicio_subtarefa}"];

const sel = "rounded-md border border-gray-200 px-2 py-1 text-sm focus:border-marca-primary focus:outline-none";
const EMPTY_USUARIOS: { nome: string; email: string }[] = [];

const novoId = () => crypto.randomUUID().slice(0, 8);

export default function AutomacoesManagerModal({
  open, onClose, idQuadro, statuses, campos, podeEditar, focoId = null,
}: {
  open: boolean;
  onClose: () => void;
  idQuadro: string;
  statuses: GestaoStatus[];
  campos: GestaoCampo[];
  podeEditar: boolean;
  /** 11/11: abre já com esta regra aberta e rolada até ela (botão "Editar" da página Automações). */
  focoId?: string | null;
}) {
  const [aba, setAba] = useState<"regras" | "produtos" | "historico">("regras");
  const { data: automacoes = [] } = useAutomacoes(idQuadro);
  const { data: usuarios = [] } = useUsuariosLista();
  const { data: usuariosFull = EMPTY_USUARIOS } = useUsuarios();
  const { data: modelos = [] } = useModelos(idQuadro);
  const { data: quadros = [] } = useQuadros();
  const { data: etiquetas = [] } = useEtiquetasQuadro(idQuadro);
  const { data: unidades = [] } = useUnidades();
  const salvar = useSalvarAutomacao();
  const excluir = useExcluirAutomacao();
  // ação com o "só se…" aberto (chave: id da regra + id da ação)
  const [condAberta, setCondAberta] = useState<string | null>(null);
  const [receitasAbertas, setReceitasAbertas] = useState(false);
  const receitas = receitasDoQuadro(statuses);
  // 11/11: cada regra recolhida mostra só número, nome e resumo; abre ao clicar.
  const [abertas, setAbertas] = useState<Set<string>>(() => new Set(focoId ? [focoId] : []));
  const alternar = (id: string) => setAbertas((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const [abrirNova, setAbrirNova] = useState(false);
  const { data: nomesBase } = useNomesAutomacao(open);
  const reordenar = useReordenarAutomacoes();
  const refFoco = useRef<HTMLDivElement | null>(null);

  const outrosQuadros = quadros.filter((q) => q.id_quadro !== idQuadro);
  // Ordem em que o motor roda: `ordem` (empate: nome, para o número não pular de lugar).
  const ordenadas = useMemo(() => [...automacoes].sort((x, y) => (x.ordem - y.ordem) || x.nome.localeCompare(y.nome, "pt-BR")), [automacoes]);
  const nomes = useMemo(() => nomesDoQuadro(
    idQuadro, nomesBase,
    Object.fromEntries(quadros.map((q) => [q.id_quadro, q.nome])),
    Object.fromEntries(usuariosFull.map((u) => [u.email.toLowerCase(), u.nome])),
  ), [idQuadro, nomesBase, quadros, usuariosFull]);
  // nova automação: abre a que acabou de nascer (a de maior ordem)
  const qtdAntes = useRef(automacoes.length);
  useEffect(() => {
    if (abrirNova && automacoes.length > qtdAntes.current) {
      const nova = [...automacoes].sort((x, y) => y.ordem - x.ordem)[0];
      if (nova) setAbertas((s) => new Set(s).add(nova.id));
      setAbrirNova(false);
    }
    qtdAntes.current = automacoes.length;
  }, [automacoes, abrirNova]);
  useEffect(() => {
    if (!open || !focoId) return;
    setAbertas((s) => new Set(s).add(focoId));
    const t = setTimeout(() => refFoco.current?.scrollIntoView({ block: "start", behavior: "smooth" }), 200);
    return () => clearTimeout(t);
  }, [open, focoId]);
  // Sobe/desce a regra inteira: regrava 10, 20, 30… só nas que mudaram (empates viram ordens distintas).
  const moverRegra = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= ordenadas.length) return;
    const nova = [...ordenadas];
    [nova[i], nova[j]] = [nova[j], nova[i]];
    const mudou = nova.map((r, k) => ({ id: r.id, ordem: (k + 1) * 10 })).filter((x, k) => nova[k].ordem !== x.ordem);
    reordenar.mutate(mudou, { onError: (e) => toast.error(String((e as Error)?.message ?? e)) });
  };

  // v315: o banco pausa a regra ATIVA que fica incompleta e a religa quando ela completa de novo.
  // Aqui só avisa na hora, para ninguém fechar a janela sem perceber.
  const avisarPausa = (a: GestaoAutomacao, depois: { gatilho?: string; condicao?: CondicaoAutomacao; acoes?: AcaoAutomacao[] }) => {
    const completaDepois = regraCompleta(depois.gatilho ?? a.gatilho, depois.condicao ?? a.condicao, depois.acoes ?? acoesDaRegra(a));
    if (a.ativo && !completaDepois) {
      toast(`"${a.nome}" foi pausada porque ficou incompleta. Ela volta a rodar sozinha quando você completar as ações.`, { icon: "⏸️", duration: 6000 });
    } else if (!a.ativo && a.pausada_em && completaDepois) {
      toast.success(`"${a.nome}" está completa de novo e voltou a rodar.`);
    }
  };
  const setCampo = (a: GestaoAutomacao, patch: Partial<GestaoAutomacao>) => {
    if (patch.gatilho) avisarPausa(a, { gatilho: patch.gatilho });
    salvar.mutate({ id: a.id, id_quadro: idQuadro, ...patch });
  };
  // Merge preserva a condição PLANA legada (de/para/dias_antes) — não zera o que não foi tocado.
  const setCond = (a: GestaoAutomacao, patch: Partial<CondicaoAutomacao>) => {
    avisarPausa(a, { condicao: { ...a.condicao, ...patch } });
    salvar.mutate({ id: a.id, id_quadro: idQuadro, condicao: { ...a.condicao, ...patch } });
  };
  // Substitui a condição inteira (construtor E/OU e troca de modo).
  // Mantém a configuração do gatilho (prazo, agenda, modelo, parada) — só troca o E/OU.
  const setCondFull = (a: GestaoAutomacao, cond: CondicaoAutomacao) => {
    const { dias_antes, agenda, modo, modelo_tarefa, parada, fonte } = a.condicao ?? {};
    const manter = Object.fromEntries(Object.entries({ dias_antes, agenda, modo, modelo_tarefa, parada, fonte }).filter(([, v]) => v !== undefined));
    avisarPausa(a, { condicao: { ...manter, ...cond } });
    salvar.mutate({ id: a.id, id_quadro: idQuadro, condicao: { ...manter, ...cond } });
  };
  const setAcoes = (a: GestaoAutomacao, acoes: AcaoAutomacao[]) => {
    avisarPausa(a, { acoes });
    salvar.mutate({ id: a.id, id_quadro: idQuadro, acoes });
  };
  const pausadas = automacoes.filter((a) => !a.ativo && a.pausada_em);
  const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const dia = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

  return (
    <Modal open={open} onClose={onClose} title="Automações" size="quadrado">
      <div className="mb-3 flex gap-1 border-b border-gray-100">
        {([["regras", "Regras", Workflow], ["produtos", "Funcionários por produto", UserCog], ["historico", "Histórico", History]] as const).map(([k, rot, Icone]) => (
          <button key={k} type="button" onClick={() => setAba(k)}
            className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-sm font-medium ${aba === k ? "border-marca-primary text-marca-primary" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            <Icone className="size-4" /> {rot}
          </button>
        ))}
      </div>

      {aba === "historico" ? (
        <AutomacoesHistorico idQuadro={idQuadro} />
      ) : aba === "produtos" ? (
        <ProdutoResponsaveisAba idQuadro={idQuadro} automacoes={automacoes} usuarios={usuariosFull} podeEditar={podeEditar} />
      ) : (
      <div className="space-y-3">
        {ordenadas.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
            <span>{ordenadas.length} automações · o número é a ordem em que elas rodam (a 1 primeiro)</span>
            <span className="flex gap-1">
              <button type="button" onClick={() => setAbertas(new Set(ordenadas.map((r) => r.id)))} className="inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-gray-100"><ChevronsUpDown className="size-3.5" /> Expandir todas</button>
              <button type="button" onClick={() => setAbertas(new Set())} className="inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-gray-100"><ChevronsDownUp className="size-3.5" /> Recolher todas</button>
            </span>
          </div>
        )}
        {pausadas.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-semibold">
                {pausadas.length === 1 ? "1 regra está pausada" : `${pausadas.length} regras estão pausadas`} porque ficou incompleta e não está rodando:
              </p>
              <p className="text-xs">{pausadas.map((a) => `${a.nome} (desde ${dia(a.pausada_em!)} ${hora(a.pausada_em!)})`).join(" · ")}</p>
              <p className="mt-0.5 text-xs text-amber-800">Complete as ações dela — ela volta a rodar sozinha. Se ficar mais de 15 min assim, quem mexeu recebe um aviso.</p>
            </div>
          </div>
        )}
        {ordenadas.map((a, idx) => {
          const usaEou = !!(a.condicao?.all || a.condicao?.any);
          const acoes = acoesDaRegra(a);
          const completa = regraCompleta(a.gatilho, a.condicao, acoes);
          const ehSst = (GATILHOS_SST as readonly string[]).includes(a.gatilho);
          const criaTarefa = ehSst || (a.gatilho === "agendado" && a.condicao?.modo === "criar_tarefa");
          const variaveis = [...(VARIAVEIS.sempre ?? []), ...(VARIAVEIS[a.gatilho] ?? []), ...(ehGatilhoSubtarefa(a.gatilho) ? VARIAVEIS_SUBTAREFA : [])];
          const trocarAcao = (i: number, patch: Partial<AcaoAutomacao> | null, substituir = false) => {
            const nova = acoes.map((x, j) => (j === i ? (substituir ? { id: x.id ?? novoId(), ...patch } : { ...x, ...patch }) : x));
            setAcoes(a, nova);
          };
          const mover = (i: number, d: -1 | 1) => {
            const j = i + d;
            if (j < 0 || j >= acoes.length) return;
            const nova = [...acoes];
            [nova[i], nova[j]] = [nova[j], nova[i]];
            setAcoes(a, nova);
          };
          const aberta = abertas.has(a.id);
          const resumo = descreverRegra({ gatilho: a.gatilho, condicao: a.condicao as never, acoes: acoes as never }, nomes);
          const cabecalho = (
            <div className="flex items-start gap-2">
              <span className="mt-0.5 inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 px-1.5 text-xs font-bold text-gray-600" title="Ordem em que roda">{idx + 1}</span>
              <button type="button" onClick={() => alternar(a.id)} className="min-w-0 flex-1 text-left">
                <span className="flex items-center gap-1 text-sm font-semibold text-gray-800">
                  {aberta ? <ChevronDown className="size-4 shrink-0 text-gray-400" /> : <ChevronRight className="size-4 shrink-0 text-gray-400" />}
                  <span className="truncate">{a.nome}</span>
                  {!completa && <AlertTriangle className="size-3.5 shrink-0 text-amber-600" />}
                </span>
                {!aberta && <span className="mt-0.5 line-clamp-2 pl-5 text-xs text-gray-500">{resumo}</span>}
              </button>
              <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${a.ativo && completa ? "bg-marca-light text-marca-primary" : "bg-gray-100 text-gray-500"}`}>{a.ativo && completa ? "Ativa" : "Desligada"}</span>
              {podeEditar && (
                <span className="flex shrink-0 items-center">
                  <button type="button" title="Rodar antes" disabled={idx === 0 || reordenar.isPending} onClick={() => moverRegra(idx, -1)} className="rounded p-1 text-gray-300 hover:text-gray-600 disabled:opacity-30"><ArrowUp className="size-3.5" /></button>
                  <button type="button" title="Rodar depois" disabled={idx === ordenadas.length - 1 || reordenar.isPending} onClick={() => moverRegra(idx, 1)} className="rounded p-1 text-gray-300 hover:text-gray-600 disabled:opacity-30"><ArrowDown className="size-3.5" /></button>
                </span>
              )}
            </div>
          );
          if (!aberta) {
            return (
              <div key={a.id} ref={a.id === focoId ? refFoco : undefined} className={`rounded-lg border p-2.5 ${completa ? "border-gray-200" : "border-amber-300 bg-amber-50/40"}`}>{cabecalho}</div>
            );
          }
          return (
          <div key={a.id} ref={a.id === focoId ? refFoco : undefined} className={`space-y-3 rounded-lg border p-3 ${completa ? "border-gray-200" : "border-amber-300 bg-amber-50/40"}`}>
            {cabecalho}
            <p className="rounded-md bg-gray-50 px-2.5 py-1.5 text-xs text-gray-600"><span className="font-semibold text-gray-700">Em resumo: </span>{resumo}</p>
            {!completa && (a.pausada_em ? (
              <p className="flex items-center gap-1 text-xs font-semibold text-amber-800">
                <AlertTriangle className="size-3.5" /> Pausada desde {dia(a.pausada_em)} {hora(a.pausada_em)} porque ficou incompleta. Complete as ações e ela volta a rodar sozinha.
              </p>
            ) : (
              <p className="text-xs font-medium text-amber-700">Incompleta — toda ação precisa do destino/valor dela; depois marque “Ativa”. Enquanto isso ela não roda.</p>
            ))}
            <div className="flex items-center gap-2">
              <input defaultValue={a.nome} disabled={!podeEditar} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== a.nome) setCampo(a, { nome: v }); }}
                className="min-w-0 flex-1 rounded-md border border-gray-200 px-2 py-1 text-sm font-medium focus:border-marca-primary focus:outline-none" />
              <label className="inline-flex items-center gap-1 text-xs text-gray-500" title={completa ? undefined : "Complete as ações para poder ativar"}>
                <input type="checkbox" disabled={!podeEditar || !completa} checked={a.ativo && completa} onChange={(e) => setCampo(a, { ativo: e.target.checked })} className="size-3.5 rounded accent-marca-primary" /> <Dica texto={DICAS_GESTAO_AUTOMACAO.ativa}>Ativa</Dica>
              </label>
              {podeEditar && <button type="button" onClick={async () => { if (await confirmar({ title: `Excluir automação "${a.nome}"?` })) excluir.mutate(a.id); }} className="rounded p-1 text-gray-300 hover:text-red-600"><Trash2 className="size-4" /></button>}
            </div>

            {/* QUANDO — gatilho */}
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">1. Quando <span className="font-normal normal-case tracking-normal text-gray-400">— o que faz a automação começar</span></p>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <select value={a.gatilho} disabled={!podeEditar} onChange={(e) => setCampo(a, { gatilho: e.target.value as GatilhoAutomacao })} className={sel}>
                {GRUPOS_GATILHO.map((g) => (
                  <optgroup key={g} label={g}>
                    {GATILHOS.filter((x) => x.grupo === g).map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                  </optgroup>
                ))}
              </select>
              {/* condição PLANA legada (status_muda) — só no modo simples */}
              {a.gatilho === "status_muda" && !usaEou && (
                <>
                  <span className="text-gray-400"><Dica texto={DICAS_GESTAO_AUTOMACAO.de}>de</Dica></span>
                  <select value={a.condicao?.de ?? ""} disabled={!podeEditar} onChange={(e) => setCond(a, { de: e.target.value || undefined })} className={sel}>
                    <option value="">qualquer</option>
                    {statuses.map((s) => <option key={s.slug} value={s.slug}>{s.nome}</option>)}
                  </select>
                  <span className="text-gray-400"><Dica texto={DICAS_GESTAO_AUTOMACAO.para}>para</Dica></span>
                  <select value={a.condicao?.para ?? ""} disabled={!podeEditar} onChange={(e) => setCond(a, { para: e.target.value || undefined })} className={sel}>
                    <option value="">qualquer</option>
                    {statuses.map((s) => <option key={s.slug} value={s.slug}>{s.nome}</option>)}
                  </select>
                </>
              )}
              {a.gatilho === "sst_vencimento" && (
                <>
                  <select value={a.condicao?.fonte ?? ""} disabled={!podeEditar} onChange={(e) => setCond(a, { fonte: (e.target.value || undefined) as never })} className={sel}>
                    <option value="">o quê…</option>
                    <option value="documento">documento (validade da inspeção)</option>
                    <option value="extintor">extintor</option>
                  </select>
                  <span className="text-gray-400"><Dica texto={DICAS_GESTAO_AUTOMACAO.vence_em}>vence em até</Dica></span>
                  {/* Dias: grava ao sair do campo (como o nome). Gravando a cada tecla sem estado
                      otimista, o valor voltava ao do servidor enquanto a pessoa digitava. */}
                  <input type="number" min={0} max={365} defaultValue={a.condicao?.dias_antes ?? ""} disabled={!podeEditar}
                    onBlur={(e) => { const v = e.target.value.trim() || undefined; if (v !== a.condicao?.dias_antes) setCond(a, { dias_antes: v }); }} placeholder="30" className={`${sel} w-20`} />
                  <span className="text-gray-400">dias</span>
                </>
              )}
              {a.gatilho === "tarefa_parada" && <ParadaEditor condicao={a.condicao ?? {}} onChange={(p) => setCond(a, p)} disabled={!podeEditar} />}
              {a.gatilho === "data_inicio_chega" && (
                <>
                  <input type="number" min={0} max={90} defaultValue={a.condicao?.dias_antes ?? "0"} disabled={!podeEditar}
                    onBlur={(e) => { const v = e.target.value.trim() || undefined; if (v !== a.condicao?.dias_antes) setCond(a, { dias_antes: v }); }} className={`${sel} w-16`} />
                  <span className="text-gray-400">dia(s) antes (0 = no dia)</span>
                </>
              )}
              {a.gatilho === "prazo_proximo" && (
                <>
                  <input type="number" min={0} max={90} defaultValue={a.condicao?.dias_antes ?? "3"} disabled={!podeEditar}
                    onBlur={(e) => { const v = e.target.value.trim() || undefined; if (v !== a.condicao?.dias_antes) setCond(a, { dias_antes: v }); }} className={`${sel} w-16`} />
                  <span className="text-gray-400"><Dica texto={DICAS_GESTAO_AUTOMACAO.dias_antes_prazo}>dia(s) antes do prazo</Dica></span>
                </>
              )}
              {(a.gatilho === "subtarefa_entrega_proxima" || a.gatilho === "subtarefa_inicio_chega") && (
                <>
                  <input type="number" min={0} max={90} value={a.condicao?.dias_antes ?? DIAS_PADRAO[a.gatilho]} disabled={!podeEditar}
                    onChange={(e) => setCond(a, { dias_antes: e.target.value || undefined })} className={`${sel} w-16`} />
                  <span className="text-gray-400">{a.gatilho === "subtarefa_entrega_proxima" ? "dia(s) antes da entrega desejada" : "dia(s) antes do início desejado (0 = no dia)"}</span>
                </>
              )}
            </div>

            {ehSst && (
              <ModeloTarefaEditor key={`${a.id}-sst`} modelo={a.condicao?.modelo_tarefa ?? {}} onChange={(m) => setCond(a, { modelo_tarefa: m })}
                etiquetas={etiquetas} usuariosFull={usuariosFull} disabled={!podeEditar} variaveis={(VARIAVEIS[a.gatilho] ?? []).join(" ")} />
            )}

            {a.gatilho === "agendado" && (
              <div className="space-y-2 pl-1">
                <AgendaEditor condicao={a.condicao ?? {}} onChange={(p) => setCond(a, p)} disabled={!podeEditar} />
                {criaTarefa && (
                  <ModeloTarefaEditor key={a.id} modelo={a.condicao?.modelo_tarefa ?? {}} onChange={(m) => setCond(a, { modelo_tarefa: m })}
                    etiquetas={etiquetas} usuariosFull={usuariosFull} disabled={!podeEditar} variaveis="{data}" />
                )}
              </div>
            )}

            {/* SE — condição E/OU da regra (todos os gatilhos) */}
            {(!criaTarefa || ehSst) && <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">2. Se <span className="font-normal normal-case tracking-normal text-gray-400">— só roda quando estas condições baterem (opcional)</span></p>
              <label className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                <input type="checkbox" disabled={!podeEditar} checked={usaEou}
                  onChange={(e) => setCondFull(a, e.target.checked ? { all: [] } : {})} className="size-3.5 rounded accent-marca-primary" />
                <Dica texto={DICAS_GESTAO_AUTOMACAO.condicao}>Só rodar se… (condição E/OU)</Dica>
              </label>
              {usaEou && (
                <AutomacaoCondicaoBuilder key={a.id} condicao={a.condicao} statuses={statuses} campos={campos} quadros={quadros}
                  etiquetas={etiquetas} unidades={unidades} sst={ehSst} disabled={!podeEditar} onAplicar={(cond) => setCondFull(a, cond)} />
              )}
            </div>}

            {/* ENTÃO — ações, em ordem */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">3. Então <span className="font-normal normal-case tracking-normal text-gray-400">— {criaTarefa ? "depois, na tarefa criada (opcional)" : "o que ela faz, nesta ordem"}</span></p>
              {acoes.map((x, i) => {
                const chave = `${a.id}:${x.id ?? i}`;
                const temCond = !!(x.condicao?.all || x.condicao?.any);
                return (
                  <div key={x.id ?? i} className="rounded-md border border-gray-100 bg-white p-2">
                    <div className="flex items-start gap-2">
                      <span className="mt-1 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-marca-light text-[11px] font-bold text-marca-primary">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="mb-1.5 text-xs font-medium text-gray-700">{descreverAcao(x as never, nomes)}</p>
                        <AutomacaoAcaoEditor
                          acao={x}
                          onChange={(patch) => trocarAcao(i, patch)}
                          onTrocarTipo={(tipo) => trocarAcao(i, { tipo, ...(x.condicao ? { condicao: x.condicao } : {}) }, true)}
                          statuses={statuses} campos={campos} etiquetas={etiquetas} quadros={quadros} outrosQuadros={outrosQuadros}
                          modelos={modelos} usuarios={usuarios} usuariosFull={usuariosFull} disabled={!podeEditar}
                        />
                      </div>
                      {podeEditar && (
                        <div className="flex shrink-0 items-center gap-0.5">
                          <button type="button" title="Só executar esta ação se…" onClick={() => setCondAberta(condAberta === chave ? null : chave)}
                            className={`rounded p-1 ${temCond ? "text-marca-primary" : "text-gray-300 hover:text-gray-600"}`}><Filter className="size-3.5" /></button>
                          <button type="button" title="Subir" disabled={i === 0} onClick={() => mover(i, -1)} className="rounded p-1 text-gray-300 hover:text-gray-600 disabled:opacity-30"><ArrowUp className="size-3.5" /></button>
                          <button type="button" title="Descer" disabled={i === acoes.length - 1} onClick={() => mover(i, 1)} className="rounded p-1 text-gray-300 hover:text-gray-600 disabled:opacity-30"><ArrowDown className="size-3.5" /></button>
                          <button type="button" title="Remover ação" onClick={() => setAcoes(a, acoes.filter((_, j) => j !== i))} className="rounded p-1 text-gray-300 hover:text-red-600"><X className="size-3.5" /></button>
                        </div>
                      )}
                    </div>
                    {temCond && condAberta !== chave && (
                      <p className="mt-1 pl-7 text-[11px] text-marca-primary">Só executa se a condição da ação casar.</p>
                    )}
                    {condAberta === chave && (
                      <div className="mt-2 space-y-1 pl-7">
                        <p className="text-[11px] text-gray-500">Só executa esta ação se… (as outras ações seguem normalmente). Para um “senão”, crie outra ação com a condição oposta.</p>
                        <AutomacaoCondicaoBuilder key={chave} condicao={x.condicao ?? {}} statuses={statuses} campos={campos} quadros={quadros}
                          etiquetas={etiquetas} disabled={!podeEditar}
                          onAplicar={(cond) => trocarAcao(i, { condicao: (cond.all?.length || cond.any?.length) ? cond : undefined })} />
                      </div>
                    )}
                  </div>
                );
              })}
              {podeEditar && (
                <button type="button" onClick={() => setAcoes(a, [...acoes, { id: novoId() }])}
                  className="inline-flex items-center gap-1 text-xs font-medium text-marca-primary hover:underline">
                  <Plus className="size-3.5" /> Adicionar ação
                </button>
              )}
            </div>

            <p className="text-[11px] text-gray-400">
              Variáveis nos textos: {variaveis.join(" ")}
              {NAS_7H.has(a.gatilho) && " · Verificada todo dia às 7h pelo servidor."}
              {NO_RELOGIO.has(a.gatilho) && " · Verificada pelo servidor a cada 10 minutos (não precisa estar com o quadro aberto)."}
              {a.gatilho === "manual" && " · Aparece no ⚡ da tarefa e das ações em massa (quando ativa)."}
              {ehSst && " · Cria a tarefa neste quadro uma vez por evento (reabrir e concluir de novo não repete)."}
              {a.gatilho === "sst_vencimento" && " Verificado pelo servidor a partir das 7h."}
            </p>
          </div>
        );})}
        {podeEditar && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { setAbrirNova(true); salvar.mutate({ id_quadro: idQuadro, nome: "Nova automação", gatilho: "status_muda", ordem: Math.max(0, ...automacoes.map((r) => r.ordem)) + 10, ativo: false, acoes: [{ id: novoId() }] }); }} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-marca-primary ring-1 ring-dashed ring-marca-primary/40 hover:bg-marca-light/40">
              <Plus className="size-4" /> Nova automação
            </button>
            <button type="button" onClick={() => setReceitasAbertas((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50">
              <BookOpen className="size-4" /> {receitasAbertas ? "Fechar receitas" : "Usar uma receita pronta"}
            </button>
          </div>
        )}
        {podeEditar && receitasAbertas && (
          <ul className="grid gap-2 sm:grid-cols-2">
            {receitas.map((r) => (
              <li key={r.id}>
                <button type="button"
                  onClick={() => {
                    // nasce desligada: a pessoa revisa e liga (a que precisa de pessoas não liga sem elas)
                    setAbrirNova(true);
                    salvar.mutate({ id_quadro: idQuadro, nome: r.titulo, gatilho: r.gatilho, condicao: r.condicao, acoes: r.acoes, ordem: Math.max(0, ...automacoes.map((x) => x.ordem)) + 10, ativo: false });
                    setReceitasAbertas(false);
                  }}
                  className="h-full w-full rounded-lg border border-gray-200 bg-white p-2.5 text-left hover:border-marca-primary/50 hover:bg-marca-light/20">
                  <p className="text-sm font-semibold text-gray-800">{r.titulo}</p>
                  <p className="mt-0.5 text-xs text-gray-500">{r.descricao}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
        {automacoes.length === 0 && !podeEditar && <p className="text-sm text-gray-400">Nenhuma automação.</p>}
        <p className="pt-1 text-xs text-gray-400">As automações rodam no servidor: os gatilhos da tarefa disparam na hora; os de prazo, todo dia às 7h; agenda, tarefa parada e data de início, a cada 10 minutos. Veja o que rodou na aba Histórico.</p>
      </div>
      )}
    </Modal>
  );
}
