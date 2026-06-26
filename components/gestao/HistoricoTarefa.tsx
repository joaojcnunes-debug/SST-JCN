"use client";

import { useAtividades, formatarDuracao, iniciais, corAvatar, type GestaoAtividade } from "@/lib/hooks/useGestao";

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
    default: return a.acao;
  }
}

export default function HistoricoTarefa({ idTarefa }: { idTarefa: string }) {
  const { data: itens = [], isLoading } = useAtividades(idTarefa);

  if (isLoading) return <p className="text-xs text-gray-400">Carregando…</p>;
  if (itens.length === 0) return <p className="text-xs text-gray-400">Sem atividades registradas ainda.</p>;

  return (
    <ul className="space-y-2">
      {itens.map((a) => {
        const ator = a.ator || "Alguém";
        return (
          <li key={a.id} className="flex items-start gap-2 text-sm">
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: corAvatar(ator) }}>{iniciais(ator)}</span>
            <div className="min-w-0 flex-1">
              <p className="text-gray-700"><span className="font-medium text-gray-900">{ator}</span> {texto(a)}</p>
              <p className="text-[11px] text-gray-400">{quando(a.created_at)}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
