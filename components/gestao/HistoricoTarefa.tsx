"use client";

import { useMemo, useState } from "react";
import { Zap } from "lucide-react";
import { useAtividades, useUsuarios, useAutomacaoLogTarefa, formatarDuracao, type GestaoAtividade, type GestaoStatus } from "@/lib/hooks/useGestao";
import { useTarefaHistorico, descreverMovimentacao } from "@/lib/hooks/useTarefaHistorico";
import { tempoPorEtapa, formatarTempoLongo, type MudancaStatus } from "@/lib/gestao/tempo-etapas";
import AvatarPessoa from "@/components/gestao/AvatarPessoa";

function quando(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function texto(a: GestaoAtividade, nomeStatus: (slug: string | null) => string): string {
  const p = a.payload ?? {};
  const de = (p.de as string) || "—";
  const para = (p.para as string) || "—";
  switch (a.acao) {
    case "criada": return "criou a tarefa";
    case "status": return `mudou o status: ${de} → ${para}`;
    case "responsavel": return `responsável: ${de} → ${para}`;
    case "prazo": return `prazo: ${de} → ${para}`;
    case "empresa": return `empresa: ${de} → ${para}`;
    case "prioridade": return `prioridade: ${de} → ${para}`;
    case "titulo": return `renomeou: "${de}" → "${para}"`;
    case "empresa": return `empresa: ${de} → ${para}`;
    case "tempo_iniciado": return "iniciou o cronômetro";
    case "tempo_parado": return `parou o cronômetro (${formatarDuracao(Number(p.segundos) || 0)})`;
    case "tempo_manual": return `lançou tempo (${formatarDuracao(Number(p.segundos) || 0)})`;
    case "tempo_excluido": return `excluiu um apontamento de tempo (${formatarDuracao(Number(p.segundos) || 0)})`;
    case "requisito_forcado": {
      const faltava = Array.isArray(p.faltava) ? (p.faltava as string[]).join(" e ") : "";
      return `forçou a entrada em "${nomeStatus(p.para as string)}" (Admin)${faltava ? ` sem ${faltava}` : ""}`;
    }
    default: return a.acao;
  }
}

const RESULTADO: Record<string, { rotulo: string; cls: string }> = {
  ok: { rotulo: "rodou", cls: "bg-marca-light text-marca-primary" },
  skip: { rotulo: "não se aplicou", cls: "bg-gray-100 text-gray-500" },
  erro: { rotulo: "erro", cls: "bg-red-50 text-red-600" },
};

const GATILHO: Record<string, string> = {
  tarefa_criada: "tarefa criada", status_muda: "mudança de status", comentario: "comentário", prazo: "prazo",
  campo_muda: "campo alterado", subtarefa: "subtarefa", manual: "manual",
};

// Mesmo evento gravado nas duas fontes (o modal registra em gestao_atividades e o gatilho do
// banco em gestao_tarefa_historico) cai a segundos de distância: dentro desta janela é repetido.
const JANELA_MESMO_EVENTO_MS = 2 * 60 * 1000;

interface Linha { key: string; ator: string; texto: string; created_at: string }

/**
 * Aba "Histórico" do TarefaModal: junta as movimentações gravadas pelo banco
 * (gestao_tarefa_historico — pegam também o arrasto no quadro) com o histórico do modal
 * (gestao_atividades — o único que tem responsável e tempo). Quando os dois têm o mesmo
 * tipo de evento a menos de 2 min, fica só o do banco.
 * v353: no topo, o tempo em cada coluna (item 7); e a troca "Alterações | Automações" mostra o que as
 * automações fizeram nesta tarefa (item 9, gestao_automacao_log).
 */
export default function HistoricoTarefa({ idTarefa, statuses, statusAtual, criadaEm }: {
  idTarefa: string;
  statuses: GestaoStatus[];
  statusAtual?: string;
  criadaEm?: string;
}) {
  const [vista, setVista] = useState<"alteracoes" | "automacoes">("alteracoes");
  const { data: atividades = [], isLoading: carregandoAtiv } = useAtividades(idTarefa);
  const { data: timeline = [], isLoading: carregandoMov } = useTarefaHistorico(idTarefa);
  const { data: logAutom = [], isLoading: carregandoAutom } = useAutomacaoLogTarefa(idTarefa, vista === "automacoes");
  const { data: usuarios } = useUsuarios();

  const nomesStatus = useMemo(() => new Map(statuses.map((s) => [s.slug, s.nome])), [statuses]);
  const nomeStatus = (slug: string | null) => (slug ? nomesStatus.get(slug) ?? slug : "—");

  const etapas = useMemo(() => {
    if (!statusAtual || !criadaEm) return [];
    const mudancas: MudancaStatus[] = timeline
      .filter((i) => i.kind === "movimentacao" && i.tipo === "status")
      .map((i) => (i.kind === "movimentacao" ? { de: i.de ?? null, para: i.para ?? null, em: i.created_at } : null))
      .filter((x): x is MudancaStatus => !!x);
    return tempoPorEtapa(criadaEm, statusAtual, mudancas);
  }, [timeline, statusAtual, criadaEm]);
  const maiorEtapa = Math.max(1, ...etapas.map((e) => e.ms));

  const linhas = useMemo(() => {
    // Os apontamentos de tempo antigos gravaram o e-mail como autor: mostra o nome de quem fez.
    const nomePorEmail = new Map((usuarios ?? []).map((u) => [u.email.toLowerCase(), u.nome]));
    const nomeAtor = (ator: string | null) => (ator ? nomePorEmail.get(ator.toLowerCase()) ?? ator : "Alguém");
    const nome = (slug: string | null) => (slug ? nomesStatus.get(slug) ?? slug : "—");
    const movs = timeline.filter((i) => i.kind === "movimentacao");
    const out: Linha[] = [];
    for (const i of movs) {
      if (i.kind !== "movimentacao") continue;
      out.push({ key: i.key, ator: nomeAtor(i.ator), texto: descreverMovimentacao(i, nome), created_at: i.created_at });
    }
    for (const a of atividades) {
      const t = new Date(a.created_at).getTime();
      const repetido = movs.some(
        (i) => i.kind === "movimentacao" && i.tipo === a.acao && Math.abs(new Date(i.created_at).getTime() - t) < JANELA_MESMO_EVENTO_MS,
      );
      if (!repetido) out.push({ key: `atv:${a.id}`, ator: nomeAtor(a.ator), texto: texto(a, nome), created_at: a.created_at });
    }
    return out.sort((x, y) => new Date(y.created_at).getTime() - new Date(x.created_at).getTime());
  }, [atividades, timeline, nomesStatus, usuarios]);

  return (
    <div className="space-y-4">
      {etapas.length > 0 && (
        <section>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Tempo em cada coluna</p>
          <ul className="space-y-1">
            {etapas.map((e) => (
              <li key={e.slug} className="flex items-center gap-2 text-sm">
                <span className={`w-40 shrink-0 truncate ${e.atual ? "font-semibold text-gray-900" : "text-gray-700"}`} title={nomeStatus(e.slug)}>
                  {nomeStatus(e.slug)}{e.atual ? " (agora)" : ""}
                </span>
                <span className="h-1.5 flex-1 rounded-full bg-gray-100" aria-hidden>
                  <span className={`block h-full rounded-full ${e.atual ? "bg-marca-primary" : "bg-gray-400"}`} style={{ width: `${Math.max(2, Math.round((e.ms / maiorEtapa) * 100))}%` }} />
                </span>
                <span className="w-20 shrink-0 text-right text-xs text-gray-500">{formatarTempoLongo(e.ms)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="inline-flex rounded-lg border border-gray-200 p-0.5 text-xs font-medium" role="tablist" aria-label="O que mostrar">
        {(["alteracoes", "automacoes"] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={vista === v}
            onClick={() => setVista(v)}
            className={`rounded-md px-3 py-1 ${vista === v ? "bg-marca-primary text-white" : "text-gray-600 hover:bg-gray-100"}`}
          >
            {v === "alteracoes" ? "Alterações" : "Automações"}
          </button>
        ))}
      </div>

      {vista === "alteracoes" && (
        carregandoAtiv || carregandoMov ? <p className="text-xs text-gray-400">Carregando…</p>
        : linhas.length === 0 ? <p className="text-xs text-gray-400">Sem atividades registradas ainda.</p>
        : (
          <ul className="max-h-[45vh] space-y-2 overflow-y-auto pr-1">
            {linhas.map((l) => (
              <li key={l.key} className="flex items-start gap-2 text-sm">
                <AvatarPessoa nome={l.ator} className="mt-0.5 size-6 text-[10px]" />
                <div className="min-w-0 flex-1">
                  <p className="text-gray-700"><span className="font-medium text-gray-900">{l.ator}</span> {l.texto}</p>
                  <p className="text-[11px] text-gray-400">{quando(l.created_at)}</p>
                </div>
              </li>
            ))}
          </ul>
        )
      )}

      {vista === "automacoes" && (
        carregandoAutom ? <p className="text-xs text-gray-400">Carregando…</p>
        : logAutom.length === 0 ? <p className="text-xs text-gray-400">Nenhuma automação rodou nesta tarefa.</p>
        : (
          <ul className="max-h-[45vh] space-y-2 overflow-y-auto pr-1">
            {logAutom.map((l) => {
              const r = RESULTADO[l.resultado] ?? { rotulo: l.resultado, cls: "bg-gray-100 text-gray-500" };
              return (
                <li key={l.id} className="flex items-start gap-2 text-sm">
                  <Zap className="mt-0.5 size-4 shrink-0 text-amber-500" />
                  <div className="min-w-0 flex-1">
                    <p className="text-gray-700">
                      <span className="font-medium text-gray-900">{l.gestao_automacoes?.nome ?? "Automação apagada"}</span>
                      <span className={`ml-2 rounded px-1.5 py-0.5 text-[11px] font-semibold ${r.cls}`}>{r.rotulo}</span>
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {quando(l.created_at)} · por {GATILHO[l.gatilho] ?? l.gatilho}{l.detalhe ? ` · ${l.detalhe}` : ""}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )
      )}
    </div>
  );
}
