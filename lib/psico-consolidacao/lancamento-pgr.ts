// Consolidação Psicossocial de Grupo — fase 8: a lista para o técnico LANÇAR no PGR.
//
// Decisão de 19/10/2026: o PGR mora no SGG e o painel NÃO envia sozinho. Para cada
// empresa que o cliente validou numa versão registrada, sai a lista do que precisa
// constar no PGR: setor (como está no documento da empresa), fator, o nome do agente
// no SGG, o nível e o que fazer (incluir, alterar o nível ou só conferir). O técnico
// lança no SGG e escolhe as medidas lá (o SGG valida medida × agente).
//
// Função pura sobre a FOTO do registro (fase 7) — não usa o que está na tela agora.

import type { NivelPresente, ResultadoMotor } from "./motor";
import type { Decisao } from "./registro";

/** Fator do catálogo → agente canônico do SGG (o mesmo dropdown do técnico). */
export const AGENTE_SGG: Record<string, string> = {
  assedio: "Assédio de qualquer natureza no trabalho",
  eventos_traumaticos: "Eventos violentos ou traumáticos",
  sobrecarga: "Excesso de demandas no trabalho (Sobrecarga)",
  recompensas: "Baixas recompensas e reconhecimento",
  falta_suporte: "Falta de suporte/apoio no trabalho",
  subcarga: "Baixa demanda no trabalho (Subcarga)",
  gestao_mudancas: "Má gestão de mudanças organizacionais",
  maus_relacionamentos: "Maus relacionamentos no local de trabalho",
  baixo_controle: "Baixo controle no trabalho/Falta de autonomia",
  clareza_papel: "Baixa clareza de papel/função",
  comunicacao_dificil: "Trabalho em condições de difícil comunicação",
  justica_organizacional: "Baixa justiça organizacional",
  trabalho_remoto: "Trabalho remoto e isolado",
};

export const CONDUTA: Record<NivelPresente, string> = {
  Crítico: "Prioridade máxima — ação urgente com a alta direção",
  Alto: "Prioridade máxima — intervenção imediata com plano estruturado",
  Médio: "Medidas preventivas e reavaliação em ciclo curto",
  Identificado: "Identificado na AEP — registrar e acompanhar",
};

export type AcaoPgr = "Incluir" | "Alterar nível" | "Conferir (já consta)";

export interface LinhaLancamento {
  idEmpresa: string;
  decisao: Decisao;
  setor: string;
  /** Como o setor está escrito nos documentos da empresa (é o nome no SGG/PGR dela). */
  setoresNoDocumento: string[];
  idFator: string;
  agenteSgg: string | null;
  nivel: NivelPresente;
  acao: AcaoPgr;
  ondeFoiIdentificado: string;
  setorDeUmaEmpresa: boolean;
}

export function linhasLancamento(p: {
  r: ResultadoMotor;
  itens: Array<{ id_empresa: string; setor_canonico: string | null; setor_original: string }>;
  /** Validação vigente de cada empresa no registro; empresa sem validação fica fora. */
  validacao: Map<string, Decisao>;
  nomeEmpresa: (id: string) => string;
}): LinhaLancamento[] {
  const { r } = p;
  const perfil = new Map([...r.perfil, ...r.avaliacaoPropria].map((x) => [`${x.setor}|${x.idFator}`, x]));
  const lacuna = new Map(r.lacunas.map((l) => [`${l.idEmpresa}|${l.setor}|${l.idFator}`, l]));
  const originais = new Map<string, Set<string>>();
  for (const i of p.itens) {
    const k = `${i.id_empresa}|${i.setor_canonico ?? ""}`;
    if (!originais.has(k)) originais.set(k, new Set());
    originais.get(k)!.add(i.setor_original);
  }
  const ordem = new Map(r.fatores.map((f) => [f.id_fator, f.ordem]));
  const fontes = (f: Array<{ idEmpresa: string; nivel: NivelPresente }>) =>
    f.map((x) => `${p.nomeEmpresa(x.idEmpresa)} (${x.nivel === "Identificado" ? "AEP" : x.nivel})`).join("; ");

  const out: LinhaLancamento[] = [];
  for (const l of r.simNaoEmpresa) {
    const decisao = p.validacao.get(l.idEmpresa);
    if (!decisao) continue;
    for (const f of r.fatores) {
      if (!l.fatores[f.id_fator]) continue;
      const pf = perfil.get(`${l.setor}|${f.id_fator}`);
      if (!pf) continue;
      const lac = lacuna.get(`${l.idEmpresa}|${l.setor}|${f.id_fator}`);
      const acao: AcaoPgr = !lac
        ? "Conferir (já consta)"
        : lac.acao === "Incluir"
          ? "Incluir"
          : lac.acao === "Revisar nível"
            ? "Alterar nível"
            : "Conferir (já consta)";
      out.push({
        idEmpresa: l.idEmpresa,
        decisao,
        setor: l.setor,
        setoresNoDocumento: [...(originais.get(`${l.idEmpresa}|${l.setor}`) ?? [])].sort((a, b) => a.localeCompare(b, "pt-BR")),
        idFator: f.id_fator,
        agenteSgg: AGENTE_SGG[f.id_fator] ?? null,
        nivel: pf.nivel,
        acao,
        ondeFoiIdentificado: fontes(pf.fontes),
        setorDeUmaEmpresa: l.unicaEmpresa,
      });
    }
  }
  return out.sort(
    (a, b) =>
      p.nomeEmpresa(a.idEmpresa).localeCompare(p.nomeEmpresa(b.idEmpresa), "pt-BR") ||
      a.setor.localeCompare(b.setor, "pt-BR") ||
      (ordem.get(a.idFator) ?? 0) - (ordem.get(b.idFator) ?? 0),
  );
}

/** Planilha "Lançamento no PGR": uma aba de resumo e uma por empresa validada. */
export async function planilhaLancamento(p: {
  grupo: string;
  idExecucao: string;
  linhas: LinhaLancamento[];
  nomeEmpresa: (id: string) => string;
  nomeFator: (id: string) => string;
  pendentes: string[];
}): Promise<ArrayBuffer> {
  const { aba, novo } = await import("./exportar-xlsx");
  const wb = await novo();
  const empresas = [...new Set(p.linhas.map((l) => l.idEmpresa))];

  const res = aba(
    wb,
    "Resumo",
    ["Empresa", "Validação", "Incluir", "Alterar nível", "Conferir (já consta)", "Total no PGR"],
    empresas.map((e) => {
      const ls = p.linhas.filter((l) => l.idEmpresa === e);
      const n = (a: AcaoPgr) => ls.filter((l) => l.acao === a).length;
      return [p.nomeEmpresa(e), ls[0].decisao === "VALIDADO" ? "Validado" : "Com ressalva", n("Incluir"), n("Alterar nível"), n("Conferir (já consta)"), ls.length];
    }),
    { larguras: [48, 14, 10, 13, 18, 12], colorir: [3] },
  );
  res.addRow([]);
  res.addRow([`Versão registrada ${p.idExecucao} — ${p.grupo}. Lançar no SGG, no PGR de cada empresa, com o agente da coluna "Agente no SGG".`]);
  if (p.pendentes.length) {
    res.addRow([`Ainda sem validação do cliente (fora desta lista): ${p.pendentes.map(p.nomeEmpresa).join("; ")}`]);
  }

  const usados = new Set<string>();
  for (const e of empresas) {
    // Nome de aba: até 31 caracteres, sem : \ / ? * [ ] e sem repetir.
    let nome = p.nomeEmpresa(e).replace(/[:\\/?*[\]]/g, " ").slice(0, 28).trim();
    for (let i = 2; usados.has(nome); i++) nome = `${nome.slice(0, 26)} ${i}`;
    usados.add(nome);
    aba(
      wb,
      nome,
      ["Setor no documento", "Setor padronizado", "Fator", "Agente no SGG", "Nível", "Ação no PGR", "Conduta", "Onde foi identificado"],
      p.linhas
        .filter((l) => l.idEmpresa === e)
        .map((l) => [
          l.setoresNoDocumento.join("\n"),
          l.setor + (l.setorDeUmaEmpresa ? " ¹" : ""),
          p.nomeFator(l.idFator),
          l.agenteSgg ?? "(sem agente no SGG — cadastrar)",
          l.nivel,
          l.acao,
          CONDUTA[l.nivel],
          l.ondeFoiIdentificado,
        ]),
      { larguras: [30, 24, 34, 40, 13, 18, 40, 60], colorir: [5, 6] },
    );
  }
  return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}
