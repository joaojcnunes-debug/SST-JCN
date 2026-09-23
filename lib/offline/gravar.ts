"use client";

/**
 * A porta única por onde um formulário da inspeção grava.
 *
 * O PROBLEMA QUE ELE RESOLVE: sem isto, cada formulário precisaria de um
 * `try/catch` decidindo sozinho o que fazer quando a rede cai — e cada um
 * decidiria um pouco diferente. Trinta e um componentes, trinta e uma regras.
 *
 * A REGRA, UMA SÓ:
 *   1. Sem rede declarada pelo aparelho → guarda direto, sem tentar. Tentar sem
 *      rede é esperar o `fetch` estourar sozinho, e o técnico fica olhando um
 *      botão girando por nada.
 *   2. Com rede → tenta ao vivo. Deu certo, acabou; nada é guardado, e o
 *      comportamento é exatamente o de antes deste trabalho existir.
 *   3. Falhou POR REDE → guarda no aparelho e devolve como sucesso, porque para
 *      o técnico foi sucesso: o trabalho dele está salvo.
 *   4. Falhou POR OUTRO MOTIVO → propaga. Campo obrigatório vazio, violação de
 *      regra do banco: isso é recusa de verdade, e enfileirar seria adiar um
 *      erro que só vai voltar igual daqui a três horas, longe do contexto.
 *
 * O passo 4 é o mais importante e o mais fácil de errar. Enfileirar tudo o que
 * falha parece robusto e é o oposto: transforma erro de digitação em pendência
 * fantasma que ninguém sabe resolver.
 */

import { enfileirar, guardarImagem, temOperacaoPendente } from "./operacoes";
import { ehErroDeRede } from "./rede";
import { executarOperacao, subirImagem, type Gravacao } from "./sincronizar";

export type ResultadoGravacao =
  /** Chegou ao banco agora. O caminho normal, com rede. */
  | { destino: "SERVIDOR" }
  /** Guardado no celular. Sobe sozinho quando a rede voltar. */
  | { destino: "APARELHO"; idOperacao: string };

/**
 * Uma imagem a caminho do MinIO, com o caminho já decidido.
 *
 * O caminho é definido pelo FORMULÁRIO, na captura, e não aqui. Tem que ser
 * assim porque a linha guarda a URL pública da foto, e essa URL é o caminho
 * concatenado ao host do storage — se o caminho só nascesse na hora de subir, a
 * linha teria que ser corrigida depois, e ela já pode ter subido.
 */
export type ImagemPendente = { blob: Blob; caminho: string };

type Pedido = Gravacao & {
  /** Módulo dono do documento — o que permite a tela de pendências linkar certo. */
  modulo: string;
  /** O documento a que esta gravação pertence: a inspeção, o relatório, etc. */
  id_documento: string;
  /** Arquivos que precisam estar no MinIO antes desta linha existir. */
  imagens?: ImagemPendente[];
  /** Ids de outras operações que precisam subir antes desta. */
  depende_de?: string[];
};

export async function gravar(pedido: Pedido): Promise<ResultadoGravacao> {
  const { modulo, id_documento, imagens, depende_de, ...gravacao } = pedido;

  const guardar = async (): Promise<ResultadoGravacao> => {
    // Os blobs primeiro: a operação guarda só os ids, e uma operação apontando
    // para imagem que não foi gravada subiria com a URL apontando para o nada.
    const ids: string[] = [];
    for (const imagem of imagens ?? []) {
      ids.push(await guardarImagem(imagem.blob, imagem.caminho));
    }
    return {
      destino: "APARELHO",
      idOperacao: await enfileirar({
        ...gravacao,
        modulo,
        id_documento,
        imagens: ids,
        depende_de,
      }),
    };
  };

  // `navigator.onLine` mente para cima (diz online num Wi-Fi de portaria que não
  // leva a lugar nenhum), mas nunca mente para baixo: quando diz offline, está
  // mesmo. Por isso serve para este atalho e não serve como prova de conexão.
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return guardar();
  }

  // FILA DESTE DOCUMENTO NÃO VAZIA: vai para a fila, mesmo com rede de volta.
  //
  // Se há operação esperando neste documento, a rede caiu há pouco. Mandar esta
  // ao vivo a colocaria no banco ANTES das que o técnico fez primeiro — e o
  // risco que ele acabou de lançar pode apontar para o setor que ainda está lá
  // atrás na fila. A FK recusaria um registro perfeito, e a tela diria "recusado
  // pelo painel" para um trabalho que não tem defeito nenhum.
  //
  // A verificação é por DOCUMENTO: ver `temOperacaoPendente`.
  if (await temOperacaoPendente(id_documento)) {
    return guardar();
  }

  try {
    // Arquivo antes da linha, sempre — mesma ordem que a fila usa. A linha
    // guarda a URL pública; gravá-la primeiro publicaria no painel uma foto
    // apontando para o nada, e o técnico veria imagem quebrada sem entender.
    for (const imagem of imagens ?? []) {
      await subirImagem(imagem.caminho, imagem.blob);
    }
    await executarOperacao(gravacao);
    return { destino: "SERVIDOR" };
  } catch (e) {
    // A rede pode ter caído no meio do upload, com parte das imagens já no
    // MinIO. Guardar tudo de novo é seguro: o caminho de cada arquivo é fixo
    // desde a captura, e o envio usa `upsert`, então reenviar sobrescreve o
    // idêntico em vez de duplicar.
    if (ehErroDeRede(e)) return guardar();
    throw e;
  }
}
