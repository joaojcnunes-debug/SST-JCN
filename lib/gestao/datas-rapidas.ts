/**
 * Datas da janela da tarefa (item 3 da comparação Runrun × ClickUp × Notion, 10/11/2026): o Início e o Término
 * viram um campo só cada, com hora opcional e atalhos — Hoje, Amanhã, +3 dias e Próx. semana (a segunda-feira que
 * vem). Tudo em data LOCAL 'AAAA-MM-DD' (a mesma das colunas prazo/data_inicio), sem fuso no meio.
 */

/** 'AAAA-MM-DD' do dia local. */
export function isoLocal(d: Date): string {
  return d.toLocaleDateString("sv-SE");
}

function paraData(iso: string): Date {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, m - 1, d, 12); // meio-dia: troca de horário de verão não muda o dia
}

export function somarDias(iso: string, n: number): string {
  const x = paraData(iso);
  x.setDate(x.getDate() + n);
  return isoLocal(x);
}

/** A segunda-feira que vem (numa segunda, a da semana seguinte). */
export function proximaSegunda(iso: string): string {
  const dia = paraData(iso).getDay(); // 0 = domingo … 6 = sábado
  return somarDias(iso, (8 - dia) % 7 || 7);
}

export function atalhosData(hoje: string): { rotulo: string; data: string }[] {
  return [
    { rotulo: "Hoje", data: hoje },
    { rotulo: "Amanhã", data: somarDias(hoje, 1) },
    { rotulo: "+3 dias", data: somarDias(hoje, 3) },
    { rotulo: "Próx. semana", data: proximaSegunda(hoje) },
  ];
}

/** Dias de `de` até `ate` (negativo = antes). */
export function diasEntre(de: string, ate: string): number {
  return Math.round((paraData(ate).getTime() - paraData(de).getTime()) / 86_400_000);
}

/** "12/11/2026", com "(hoje)", "(amanhã)" ou "(ontem)" quando for o caso. */
export function rotuloData(iso: string, hoje: string): string {
  const [a, m, d] = iso.split("-");
  const base = `${d}/${m}/${a}`;
  const rel = ({ 0: "hoje", 1: "amanhã", [-1]: "ontem" } as Record<number, string>)[diasEntre(hoje, iso)];
  return rel ? `${base} (${rel})` : base;
}
