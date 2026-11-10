"use client";

import { useMemo } from "react";
import { useAtividades, useUsuarios, formatarDuracao, type GestaoAtividade, type GestaoStatus } from "@/lib/hooks/useGestao";
import { useTarefaHistorico, descreverMovimentacao } from "@/lib/hooks/useTarefaHistorico";
import AvatarPessoa from "@/components/gestao/AvatarPessoa";

function quando(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function texto(a: GestaoAtividade): string {
  const p = a.payload ?? {};
  const de = (p.de as string) || "—";
  const para = (p.para as string) || "—";
  switch (a.acao) {
    case "criada": return "criou a tarefa";
    case "status": return `mudou o status: ${de} → ${para}`;
    case "responsavel": return `responsável: ${de} → ${para}`;
    case "prazo": return `prazo: ${de} → ${para}`;
    case "prioridade": return `prioridade: ${de} → ${para}`;
    case "titulo": return `renomeou: "${de}" → "${para}"`;
    case "tempo_iniciado": return "iniciou o cronômetro";
    case "tempo_parado": return `parou o cronômetro (${formatarDuracao(Number(p.segundos) || 0)})`;
    case "tempo_manual": return `lançou tempo (${formatarDuracao(Number(p.segundos) || 0)})`;
    case "tempo_excluido": return `excluiu um apontamento de tempo (${formatarDuracao(Number(p.segundos) || 0)})`;
    default: return a.acao;
  }
}

// Mesmo evento gravado nas duas fontes (o modal registra em gestao_atividades e o gatilho do
// banco em gestao_tarefa_historico) cai a segundos de distância: dentro desta janela é repetido.
const JANELA_MESMO_EVENTO_MS = 2 * 60 * 1000;

interface Linha { key: string; ator: string; texto: string; created_at: string }

/**
 * Aba "Histórico" do TarefaModal: junta as movimentações gravadas pelo banco
 * (gestao_tarefa_historico — pegam também o arrasto no quadro) com o histórico do modal
 * (gestao_atividades — o único que tem responsável e tempo). Quando os dois têm o mesmo
 * tipo de evento a menos de 2 min, fica só o do banco.
 */
export default function HistoricoTarefa({ idTarefa, statuses }: { idTarefa: string; statuses: GestaoStatus[] }) {
  const { data: atividades = [], isLoading: carregandoAtiv } = useAtividades(idTarefa);
  const { data: timeline = [], isLoading: carregandoMov } = useTarefaHistorico(idTarefa);
  const { data: usuarios } = useUsuarios();

  const linhas = useMemo(() => {
    const m = new Map(statuses.map((s) => [s.slug, s.nome]));
    // Os apontamentos de tempo antigos gravaram o e-mail como autor: mostra o nome de quem fez.
    const nomePorEmail = new Map((usuarios ?? []).map((u) => [u.email.toLowerCase(), u.nome]));
    const nomeAtor = (ator: string | null) => (ator ? nomePorEmail.get(ator.toLowerCase()) ?? ator : "Alguém");
    const nomeStatus = (slug: string | null) => (slug ? m.get(slug) ?? slug : "—");
    const movs = timeline.filter((i) => i.kind === "movimentacao");
    const out: Linha[] = [];
    for (const i of movs) {
      if (i.kind !== "movimentacao") continue;
      out.push({ key: i.key, ator: i.ator || "Alguém", texto: descreverMovimentacao(i, nomeStatus), created_at: i.created_at });
    }
    for (const a of atividades) {
      const t = new Date(a.created_at).getTime();
      const repetido = movs.some(
        (i) => i.kind === "movimentacao" && i.tipo === a.acao && Math.abs(new Date(i.created_at).getTime() - t) < JANELA_MESMO_EVENTO_MS,
      );
      if (!repetido) out.push({ key: `atv:${a.id}`, ator: nomeAtor(a.ator), texto: texto(a), created_at: a.created_at });
    }
    return out.sort((x, y) => new Date(y.created_at).getTime() - new Date(x.created_at).getTime());
  }, [atividades, timeline, statuses, usuarios]);

  if (carregandoAtiv || carregandoMov) return <p className="text-xs text-gray-400">Carregando…</p>;
  if (linhas.length === 0) return <p className="text-xs text-gray-400">Sem atividades registradas ainda.</p>;

  return (
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
  );
}
