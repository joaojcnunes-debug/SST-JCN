/**
 * A situação do DOCUMENTO (SGG) de uma inspeção — a frase, num lugar só.
 *
 * Dois lugares dizem a mesma coisa: a coluna "Associados" da lista
 * (components/inspecoes/InspecaoRow) e o card "Documento (SGG)" da tela do
 * relatório. Cada um montava a sua frase, e elas podiam discordar.
 *
 * Decisão dele em 22/09 ("meu chefe gostaria de colocar a informação de
 * concluído na parte do associado"): **quem está no chip conta como tendo
 * assumido**. Até aqui o rótulo saía só de `elaboracao_status`, que muda
 * apenas pelos botões "Assumir elaboração (eu)" e "Concluir" — associar
 * alguém (o Admin põe a pessoa no documento) não mexe nele. Medido na
 * produção de 22/09: 72 inspeções mostravam gente no chip e, embaixo,
 * "Ninguém assumiu" — o caso do print, INS-EACA3D71, com uma associada.
 *
 * Então "Ninguém assumiu" passa a ser o que a frase diz: ninguém mesmo, nem
 * associado nem responsável.
 *
 * ⚠️ Isto é rótulo de TELA. O Dashboard › Documentos por Associado segue
 * contando por `elaboracao_status`: as 72 aparecem como "em elaboração" aqui
 * e continuam fora do gráfico de lá.
 */

import { fmtData, fmtDataHora } from "@/lib/utils";

/** O que a frase lê da inspeção — o resto (quem está no documento) vem de fora. */
export interface LinhaDocumento {
  /** Status da INSPEÇÃO (campo), não do documento. */
  status: string;
  elaboracao_status: "PENDENTE" | "EM_ELABORACAO" | "CONCLUIDO" | null;
  elaboracao_responsavel: string | null;
  elaboracao_concluida_em: string | null;
}

export type ChaveDocumento = "ENTREGUE" | "EM_ELABORACAO" | "NINGUEM";

export interface SituacaoDocumento {
  chave: ChaveDocumento;
  texto: string;
  /** Classe de cor do texto, para as duas telas pintarem igual. */
  cor: string;
}

/** "Emilia dos Reis" → "Emilia" (a coluna da lista é estreita). */
function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? "";
}

/**
 * A frase da situação do documento.
 *
 * @param pessoas  quem está no documento: associados + responsável, sem
 *                 repetir — a mesma união da coluna e de `pessoasDaLinha`.
 * @param formato  "curto" para a coluna da lista (nome só de batismo, some
 *                 quando a inspeção ainda está em campo); "longo" para o card
 *                 do relatório, que sempre tem uma frase.
 */
export function situacaoDocumento(
  insp: LinhaDocumento,
  pessoas: readonly string[],
  formato: "curto" | "longo" = "curto",
): SituacaoDocumento | null {
  const curto = formato === "curto";
  const resp = (insp.elaboracao_responsavel ?? "").trim();

  // Quem aparece na frase: o responsável na frente, senão o primeiro associado.
  const outros = pessoas.map((p) => p.trim()).filter((p) => p && p.toLowerCase() !== resp.toLowerCase());
  const fila = resp ? [resp, ...outros] : outros;
  const principal = fila[0] ?? "";
  const quem = !principal
    ? ""
    : curto
      ? primeiroNome(principal) + (fila.length > 1 ? ` +${fila.length - 1}` : "")
      : principal;

  if (insp.elaboracao_status === "CONCLUIDO") {
    const data = insp.elaboracao_concluida_em;
    return {
      chave: "ENTREGUE",
      texto: curto
        ? data
          ? `Entregue em ${fmtData(data)}`
          : "Entregue"
        : `Concluído por ${principal || "—"}${data ? " · " + fmtDataHora(data) : ""}`,
      cor: "text-emerald-700",
    };
  }

  // Assumido pelo fluxo de status OU simplesmente com gente no documento.
  if (insp.elaboracao_status === "EM_ELABORACAO" || fila.length > 0) {
    return {
      chave: "EM_ELABORACAO",
      texto: quem ? `Em elaboração · ${quem}` : "Em elaboração",
      cor: "text-sky-700",
    };
  }

  // Ninguém no documento. Na lista isso só vira rótulo quando a inspeção já
  // saiu do campo — antes disso não há documento para cobrar.
  if (curto && insp.status !== "CONCLUIDA") return null;
  return {
    chave: "NINGUEM",
    texto: curto ? "Ninguém assumiu" : "Pendente — ninguém assumiu a elaboração",
    cor: "text-gray-400",
  };
}
