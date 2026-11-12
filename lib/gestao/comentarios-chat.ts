// Aba Comentários no jeito do Runrun (12/11/2026, pedido do usuário com print do Runrun): conversa com as minhas
// mensagens à direita, as dos outros à esquerda, um balão do robô com a criação da tarefa e o horário curto
// ("agora", "há 5 min", "hoje 09:19") no topo de cada balão.

import { nomeNormalizado } from "@/lib/gestao/mencoes";

const doisDigitos = (n: number) => String(n).padStart(2, "0");
const hora = (d: Date) => `${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}`;
const mesmoDia = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** "11/11/2026 09:19" (hora local). */
export function dataHora(iso: string): string {
  const d = new Date(iso);
  return `${doisDigitos(d.getDate())}/${doisDigitos(d.getMonth() + 1)}/${d.getFullYear()} ${hora(d)}`;
}

/** Horário do balão: "agora", "há 12 min", "hoje 09:19", "ontem 17:40" ou "11/11/2026 09:19". */
export function quandoComentario(iso: string, agora: Date = new Date()): string {
  const d = new Date(iso);
  const diff = agora.getTime() - d.getTime();
  // Até 1 min para trás ou para frente (relógio do computador um pouco adiantado/atrasado): "agora".
  if (Math.abs(diff) < 60_000) return "agora";
  if (diff > 0 && diff < 3_600_000) return `há ${Math.floor(diff / 60_000)} min`;
  if (mesmoDia(d, agora)) return `hoje ${hora(d)}`;
  const ontem = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 1);
  if (mesmoDia(d, ontem)) return `ontem ${hora(d)}`;
  return dataHora(iso);
}

/** O comentário é meu? O autor é gravado pelo NOME de quem comentou (gestao_comentarios.autor). */
export function ehMeuComentario(autor: string | null | undefined, meuNome: string | null | undefined): boolean {
  if (!autor?.trim() || !meuNome?.trim()) return false;
  return nomeNormalizado(autor) === nomeNormalizado(meuNome);
}

/** Texto do balão do robô com a criação da tarefa (mesma origem do "Criada por…" do cabeçalho do cartão). */
export function textoCriacao(p: { criadaPor: string | null; peloFormulario: boolean; createdBy: string | null | undefined }): string {
  if (p.peloFormulario) return p.criadaPor ? `Tarefa criada a partir do formulário ${p.criadaPor}.` : "Tarefa criada a partir de um formulário.";
  if (p.criadaPor) return `Tarefa criada por ${p.criadaPor}.`;
  switch (p.createdBy) {
    case "importador": return "Tarefa trazida do Runrun para a Gestão.";
    case "recorrencia": return "Tarefa criada pela recorrência.";
    case "automacao": return "Tarefa criada por uma automação.";
    default: return "Tarefa criada.";
  }
}
