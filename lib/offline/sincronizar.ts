"use client";

/**
 * O motor que esvazia a fila de operações da inspeção.
 *
 * IRMÃO DE `fila.ts`, NÃO SUBSTITUTO. A Frota tem uma sequência fixa de seis
 * etapas ditadas por trigger e FK (`ORDEM_ETAPAS` em `db.ts`); a inspeção tem
 * operações independentes cuja ordem é a que o técnico produziu. Fundir os dois
 * daria um motor com um `if` no topo decidindo qual metade de si mesmo executar.
 *
 * SEQUENCIAL, uma operação por vez. Não é cautela genérica: o técnico cadastra
 * um setor e um risco que aponta para ele em poucos segundos. Subir em paralelo
 * inverteria a ordem e a FK recusaria o risco — que estaria perfeito.
 *
 * PARA NA PRIMEIRA FALHA DE REDE, em vez de varrer o resto. Se a rede caiu na
 * operação 3, as operações 4 a 40 vão falhar igual; insistir só gastaria as
 * cinco tentativas de cada uma por culpa da mesma queda.
 */

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  atualizarOperacao,
  lerImagem,
  limparEnviadas,
  listarProntasParaEnviar,
  marcarImagemEnviada,
  MAX_TENTATIVAS,
  type OperacaoOffline,
} from "./operacoes";
import { checarConexao, ehDuplicidade, ehErroDeRede } from "./rede";

/** O mesmo bucket do caminho online — ver `RiscoForm.tsx:1438`. */
const BUCKET_FOTOS = "fotos";

export type ResumoSyncInspecao = {
  enviadas: number;
  recusadas: number;
  pendentes: number;
  motivoParada: "CONCLUIDO" | "SEM_REDE" | "REAUTENTICAR" | "JA_RODANDO";
};

/**
 * Trava de reentrância. A sincronização dispara em três gatilhos (abrir o app,
 * voltar a rede, botão manual) e nada impede que dois coincidam — dois envios
 * simultâneos da mesma operação disputariam a ordem que o banco exige.
 */
let rodando = false;

/**
 * Sobe um arquivo ao MinIO.
 *
 * `upsert: true` de propósito, ao contrário do caminho online original, que
 * usava `false`. Online, dois uploads no mesmo caminho seriam um bug a
 * denunciar; aqui são a retentativa normal de um envio interrompido. O caminho
 * carrega um id novo a cada foto, então colisão de verdade não acontece — o que
 * o `false` pegaria seria só o reenvio legítimo.
 */
export async function subirImagem(caminho: string, blob: Blob): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.storage.from(BUCKET_FOTOS).upload(caminho, blob, {
    cacheControl: "3600",
    upsert: true,
    contentType: blob.type || "image/jpeg",
  });
  if (error) throw error;
}

/**
 * Sobe as imagens que a operação referencia.
 *
 * SEMPRE ANTES da linha. A linha guarda a URL pública do arquivo; gravar a linha
 * primeiro publicaria no painel uma foto que aponta para o nada — e o técnico
 * veria o registro criado com imagem quebrada, sem entender por quê.
 */
async function subirImagens(operacao: OperacaoOffline): Promise<void> {
  if (operacao.imagens.length === 0) return;

  for (const idImagem of operacao.imagens) {
    const imagem = await lerImagem(idImagem);
    // Sumiu do aparelho (faxina, storage do navegador estourado). Não dá para
    // recuperar, e travar a operação para sempre seria pior: a linha sobe com a
    // URL apontando para um arquivo ausente, e isso a tela mostra.
    if (!imagem) continue;
    if (imagem.enviada) continue;

    await subirImagem(imagem.caminho, imagem.blob);
    await marcarImagemEnviada(idImagem);
  }
}

/**
 * O que basta para executar uma gravação — sem os campos de controle da fila.
 *
 * Existe porque `gravar.ts` usa o MESMO caminho para tentar direto no servidor,
 * antes de decidir enfileirar. Se fossem dois códigos, a operação enfileirada
 * subiria diferente da que foi tentada ao vivo — e a diferença só apareceria no
 * campo, sem rede, que é o pior lugar possível para descobrir.
 */
export type Gravacao = Pick<
  OperacaoOffline,
  "tabela" | "tipo" | "linhas" | "filtro" | "conflito"
>;

/**
 * Executa uma operação contra o PostgREST.
 *
 * Duplicidade é SUCESSO e não erro: o id nasce no aparelho, então bater na
 * chave primária significa que a tentativa anterior chegou — a resposta é que
 * se perdeu no caminho. Ver `ehDuplicidade` em `rede.ts`.
 */
export async function executarOperacao(operacao: Gravacao): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const tabela = supabase.from(operacao.tabela);

  try {
    if (operacao.tipo === "insert") {
      const { error } = await tabela.insert(operacao.linhas as never);
      if (error) throw error;
      return;
    }

    if (operacao.tipo === "upsert") {
      const { error } = await tabela.upsert(
        operacao.linhas as never,
        operacao.conflito ? { onConflict: operacao.conflito } : undefined,
      );
      if (error) throw error;
      return;
    }

    if (!operacao.filtro || Object.keys(operacao.filtro).length === 0) {
      // Sem filtro, um update viraria "atualize a tabela inteira" e um delete
      // apagaria o módulo. Recusar aqui é a única resposta possível.
      throw new Error(`Operação ${operacao.tipo} sem filtro — recusada por segurança.`);
    }

    let consulta =
      operacao.tipo === "update"
        ? tabela.update(operacao.linhas as never)
        : tabela.delete();

    for (const [coluna, valor] of Object.entries(operacao.filtro)) {
      consulta = consulta.eq(coluna, valor);
    }

    const { error } = await consulta;
    if (error) throw error;
  } catch (e) {
    // DUPLICIDADE É SUCESSO SÓ NA ESCRITA QUE CRIA LINHA.
    //
    // No insert/upsert o id nasce no cliente: bater na chave primária significa
    // que a tentativa anterior chegou e só a resposta se perdeu no caminho —
    // aceitar é o que torna a fila idempotente.
    //
    // No UPDATE esse caso não existe. Reenviar o mesmo update dá o mesmo
    // resultado e nunca colide consigo mesmo; um 23505 aqui só pode vir de OUTRA
    // linha ocupando um índice único — e então o update NÃO foi aplicado.
    // Engolir fazia a tela dizer "atualizado" sobre algo que continuou como
    // estava. Apareceu no /equipamentos: patrimônio repetido numa base que o
    // usuário não enxerga passa pela checagem da tela e só o índice recusa.
    // DELETE entra junto pela mesma razão — não há duplicidade que o justifique.
    if (ehDuplicidade(e) && (operacao.tipo === "insert" || operacao.tipo === "upsert")) return;
    throw e;
  }
}

/**
 * Esvazia a fila até acabar ou até a rede/sessão cair.
 *
 * Devolve o resumo que a tela de pendências mostra. `motivoParada` é o campo que
 * importa: é ele que separa "acabou" de "parou porque não dá", e o técnico
 * precisa dessa diferença para saber se pode fechar o app.
 */
export async function sincronizarInspecoes(): Promise<ResumoSyncInspecao> {
  if (rodando) {
    return { enviadas: 0, recusadas: 0, pendentes: 0, motivoParada: "JA_RODANDO" };
  }
  rodando = true;

  let enviadas = 0;
  let recusadas = 0;

  try {
    const conexao = await checarConexao();
    if (conexao !== "OK") {
      const restantes = await listarProntasParaEnviar();
      return {
        enviadas: 0,
        recusadas: 0,
        pendentes: restantes.length,
        motivoParada: conexao === "SEM_REDE" ? "SEM_REDE" : "REAUTENTICAR",
      };
    }

    /**
     * RODADAS, e não uma passada só.
     *
     * `listarProntasParaEnviar` exclui quem ainda depende de operação não
     * enviada. Numa passada única, os EPIs de um risco recém-criado ficariam de
     * fora da lista — porque no instante da leitura o risco ainda não tinha
     * subido — e só iriam no próximo gatilho de sincronização. O técnico veria
     * "riscos enviados, EPIs pendentes" sem entender por quê.
     *
     * Cada rodada relê a fila. O laço para quando uma rodada não envia nada:
     * ou acabou, ou o que sobrou está travado esperando algo recusado, e
     * insistir só gastaria as tentativas.
     */
    let pendentes = await listarProntasParaEnviar();

    while (pendentes.length > 0) {
      const enviadasAntes = enviadas;

      for (const operacao of pendentes) {
        try {
          await subirImagens(operacao);
          await executarOperacao(operacao);
          await atualizarOperacao(operacao.id, {
            status: "ENVIADA",
            ultimo_erro: null,
            ultima_tentativa: new Date().toISOString(),
          });
          enviadas++;
        } catch (e) {
          const mensagem = e instanceof Error ? e.message : String(e);

          if (ehErroDeRede(e)) {
            // A rede caiu no meio. As seguintes falhariam igual — parar preserva
            // as tentativas delas. A tentativa desta TAMBÉM não é contada: não foi
            // culpa do dado.
            const restantes = await listarProntasParaEnviar();
            return { enviadas, recusadas, pendentes: restantes.length, motivoParada: "SEM_REDE" };
          }

          // Pode ser o Cloudflare Access tendo derrubado a sessão no meio da
          // rodada. A sonda distingue isso de recusa do banco — e a distinção é o
          // que evita dizer ao técnico que ele perdeu o trabalho.
          if ((await checarConexao()) === "REAUTENTICAR") {
            const restantes = await listarProntasParaEnviar();
            return {
              enviadas,
              recusadas,
              pendentes: restantes.length,
              motivoParada: "REAUTENTICAR",
            };
          }

          const tentativas = operacao.tentativas + 1;
          await atualizarOperacao(operacao.id, {
            tentativas,
            ultimo_erro: mensagem,
            ultima_tentativa: new Date().toISOString(),
            // Só vira RECUSADA no teto. Antes disso continua PENDENTE, porque
            // muita coisa que falha uma vez passa na seguinte.
            status: tentativas >= MAX_TENTATIVAS ? "RECUSADA" : "PENDENTE",
          });
          if (tentativas >= MAX_TENTATIVAS) recusadas++;
        }
        }

      // Rodada sem nenhum envio: ou acabou, ou o que resta está travado à
      // espera de algo que foi recusado. Continuar seria laço infinito.
      if (enviadas === enviadasAntes) break;

      pendentes = await listarProntasParaEnviar();
    }

    // Faxina ao fim da rodada, como a Frota faz. Sem isto o que já subiu — e as
    // FOTOS junto — ficaria no aparelho para sempre: um técnico com quarenta
    // fotos por dia encheria o celular em algumas semanas, e o offline morreria
    // por falta de espaço justamente em quem mais o usa.
    await limparEnviadas();

    const restantes = await listarProntasParaEnviar();
    return { enviadas, recusadas, pendentes: restantes.length, motivoParada: "CONCLUIDO" };
  } finally {
    rodando = false;
  }
}
