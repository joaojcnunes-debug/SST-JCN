/**
 * Situação por colaborador (pedido de 28/10/2026: "o Dashboard tem que representar de fato o que
 * está acontecendo com o colaborador e com as empresas").
 *
 * Uma linha por pessoa, com o que está NA MÃO dela agora e o que ela entregou no mês — pelas MESMAS
 * réguas do resto do Dashboard, para nenhum número divergir:
 *
 *  - CAMPO: inspeções abertas (Rascunho / Em andamento) creditadas pela regra de
 *    `tecnicosCreditados` (aba Responsáveis; sem ninguém, quem abriu). Renovação não é campo.
 *  - DOCUMENTO (situacao_documento, v309):
 *      atribuídos  = tem associado, inspeção já concluída em campo, ninguém começou — cada associado;
 *      em elaboração = começou de verdade — quem está com ele (elaboracao_responsavel), senão os associados;
 *  - ENTREGUES NO MÊS: documentos concluídos no mês corrente, na pessoa da 1ª conclusão (`admDoDoc`),
 *    o mesmo número do "Documentos por Mês (ADM)".
 *  - CRÍTICAS/URGENTES e PRAZO VENCIDO: entre os itens abertos da pessoa (campo ou documento),
 *    pela prioridade EFETIVA e pelo prazo — cada inspeção conta uma vez por pessoa.
 *
 * Puro: testado em colaboradores.test.ts.
 */

import { chaveNome, admDoDoc, concluidosValidos, dataConclusaoDoc, SEM_RESPONSAVEL, type DocumentoConcluido } from "./documentos";
import { ehRenovacao, tecnicosCreditados, type InspecaoContavel, type OpcoesPorTecnico } from "./inspecoes";

/** Uma inspeção com o que o quadro precisa (as colunas calculadas vêm do banco). */
export interface InspecaoColaborador extends InspecaoContavel {
  id_inspecao: string;
  situacao_documento?: string | null;
  dias_espera?: number | null;
  prioridade_efetiva?: string | null;
  prazo?: string | null;
  elaboracao_responsavel?: string | null;
}

export interface LinhaColaborador {
  pessoa: string;
  /** Inspeções abertas em campo. */
  campoAbertas: number;
  /** Das abertas em campo, as paradas há mais de `LIMITE_PARADA` dias. */
  campoParadas: number;
  /** Documentos atribuídos e não iniciados (com a inspeção já concluída em campo). */
  docAtribuidos: number;
  docEmElaboracao: number;
  entreguesMes: number;
  /** Itens abertos (campo ou documento) com prioridade efetiva Crítica ou Urgente. */
  criticas: number;
  /** Itens abertos com prazo vencido. */
  prazoVencido: number;
}

/** "Parada": aberta há mais de 30 dias — o mesmo limite da prioridade calculada Urgente. */
export const LIMITE_PARADA = 30;

const ABERTA = new Set(["RASCUNHO", "EM_ANDAMENTO"]);

/**
 * @param associados id_inspecao → nomes no documento (inspecao_associados).
 * @param documentos documentos concluídos (para "entregues no mês").
 * @param mesAtual / mesDe mês corrente e conversor de instante → mês (lib/dashboard/mes).
 * @param hoje "AAAA-MM-DD" em São Paulo (prazo vencido).
 */
export function situacaoPorColaborador(entrada: {
  inspecoes: readonly InspecaoColaborador[];
  associados: ReadonlyMap<string, readonly string[]>;
  documentos: readonly DocumentoConcluido[];
  opcoes: OpcoesPorTecnico;
  mesAtual: number;
  mesDe: (iso: string) => number;
  hoje: string;
}): LinhaColaborador[] {
  const { inspecoes, associados, documentos, opcoes, mesAtual, mesDe, hoje } = entrada;
  const linhas = new Map<string, LinhaColaborador & { grafias: Map<string, number>; urgentes: Set<string>; vencidos: Set<string> }>();

  const linha = (nome: string) => {
    const pessoa = nome.replace(/\s+/g, " ").trim();
    // "Sem responsável" não é colaborador: é o buraco de preenchimento (as telas de detalhe o mostram).
    if (!pessoa || pessoa === SEM_RESPONSAVEL) return null;
    const k = chaveNome(pessoa);
    const l =
      linhas.get(k) ??
      {
        pessoa,
        campoAbertas: 0,
        campoParadas: 0,
        docAtribuidos: 0,
        docEmElaboracao: 0,
        entreguesMes: 0,
        criticas: 0,
        prazoVencido: 0,
        grafias: new Map<string, number>(),
        urgentes: new Set<string>(),
        vencidos: new Set<string>(),
      };
    l.grafias.set(pessoa, (l.grafias.get(pessoa) ?? 0) + 1);
    linhas.set(k, l);
    return l;
  };

  /** Marca crítica/urgente e prazo vencido — uma vez por inspeção e pessoa. */
  const alertas = (l: ReturnType<typeof linha>, i: InspecaoColaborador) => {
    if (!l) return;
    if (i.prioridade_efetiva === "CRITICA" || i.prioridade_efetiva === "GRAVE") l.urgentes.add(i.id_inspecao);
    if (i.prazo && i.prazo < hoje) l.vencidos.add(i.id_inspecao);
  };

  for (const i of inspecoes) {
    if (i.status === "DELETADA") continue;

    // Campo
    if (ABERTA.has(i.status) && !ehRenovacao(i.tipo_criacao)) {
      for (const nome of tecnicosCreditados(i, opcoes).nomes) {
        const l = linha(nome);
        if (!l) continue;
        l.campoAbertas++;
        if ((i.dias_espera ?? 0) > LIMITE_PARADA) l.campoParadas++;
        alertas(l, i);
      }
    }

    // Documento
    const nomesDoc = associados.get(i.id_inspecao) ?? [];
    if (i.situacao_documento === "ATRIBUIDO" && i.status === "CONCLUIDA") {
      for (const nome of nomesDoc) {
        const l = linha(nome);
        if (!l) continue;
        l.docAtribuidos++;
        alertas(l, i);
      }
    } else if (i.situacao_documento === "EM_ELABORACAO") {
      const resp = (i.elaboracao_responsavel ?? "").trim();
      for (const nome of resp ? [resp] : nomesDoc) {
        const l = linha(nome);
        if (!l) continue;
        l.docEmElaboracao++;
        alertas(l, i);
      }
    }
  }

  for (const d of concluidosValidos(documentos)) {
    if (mesDe(dataConclusaoDoc(d)!) !== mesAtual) continue;
    const l = linha(admDoDoc(d));
    if (l) l.entreguesMes++;
  }

  return [...linhas.values()]
    .map(({ grafias, urgentes, vencidos, ...l }) => ({
      ...l,
      pessoa: [...grafias.entries()].reduce((a, b) => (b[1] > a[1] ? b : a))[0],
      criticas: urgentes.size,
      prazoVencido: vencidos.size,
    }))
    .filter((l) => l.campoAbertas + l.docAtribuidos + l.docEmElaboracao + l.entreguesMes > 0)
    .sort(
      (a, b) =>
        b.criticas - a.criticas ||
        b.prazoVencido - a.prazoVencido ||
        b.campoAbertas + b.docAtribuidos + b.docEmElaboracao - (a.campoAbertas + a.docAtribuidos + a.docEmElaboracao) ||
        a.pessoa.localeCompare(b.pessoa, "pt-BR"),
    );
}
