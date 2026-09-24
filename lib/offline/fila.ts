"use client";

/**
 * A fila de sincronização das saídas capturadas offline.
 *
 * SEQUENCIAL E EM ORDEM DE CRIAÇÃO, nunca em paralelo. Isso não é preferência de
 * estilo, é exigência do banco: o CHECK de km regressivo recusa uma saída de
 * ontem que chegue depois da de hoje. Subir tudo de uma vez com `Promise.all`
 * seria mais rápido e perderia registro.
 *
 * DENTRO DE CADA SAÍDA a ordem também vem do banco:
 *   1. a linha do checklist (RASCUNHO)  — a FK das fotos aponta para ela
 *   2. as imagens no MinIO              — o caminho vai na linha da foto
 *   3. as linhas das fotos              — o trigger conta ESTAS linhas
 *   4. as rotas do trajeto
 *   5. o UPDATE para FINALIZADO         — só passa com as 4 fotos existindo
 *   6. o km do veículo                  — depois, porque é recuperável
 * Inverter 3 e 5 faz `frota_exige_4_fotos` recusar. Inverter 1 e 3 viola a FK.
 *
 * TUDO É RETOMÁVEL. O Android mata o app no meio do envio com naturalidade, e
 * `etapa` + os marcadores por foto guardam até onde chegou — reconectar não
 * re-sobe 1,3 MB de imagem que já está no MinIO.
 *
 * TUDO É IDEMPOTENTE. Uma resposta que se perde no caminho faz o aparelho achar
 * que falhou e reenviar. Como o id vem do celular (`gerarId("CHK")`, já era
 * assim antes deste trabalho), o reenvio bate na chave primária — e violação de
 * unicidade aqui é SUCESSO, não erro: significa que a tentativa anterior chegou.
 */

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { BUCKET } from "@/lib/frota/fotos";
import { atualizarKmVeiculo } from "@/lib/hooks/useFrotaVeiculos";
import { gerarId } from "@/lib/utils";
import {
  atualizarSaida,
  listarSaidas,
  offlineDisponivel,
  salvarSaida,
  type SaidaOffline,
} from "./db";
import { checarConexao, ehDuplicidade, ehErroDeRede } from "./rede";

/** Depois disto, para de tentar sozinho e passa a exigir uma pessoa. */
const MAX_TENTATIVAS = 5;

/** Registro já enviado só fica na lista para o técnico ver a confirmação. */
const DIAS_MANTER_ENVIADAS = 7;

export const EVENTO_FILA = "painel-sst:fila-mudou";

/** A tela de pendências e o contador do cabeçalho ouvem isto. */
export function aoMudarFila(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENTO_FILA, callback);
  return () => window.removeEventListener(EVENTO_FILA, callback);
}

function avisarMudanca() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENTO_FILA));
}

export type ResumoSync = {
  enviadas: number;
  recusadas: number;
  pendentes: number;
  motivoParada: "CONCLUIDO" | "SEM_REDE" | "REAUTENTICAR" | "JA_RODANDO";
};

/**
 * Trava de reentrância. A sincronização dispara em três gatilhos (abrir o app,
 * voltar a rede, botão manual) e nada impede que dois coincidam — dois envios
 * simultâneos da mesma saída trocariam a ordem que o banco exige.
 */
let rodando = false;

// ─── Classificação de erro ───────────────────────────────────────────────────
// De onde vem a distinção que a tela de pendências mostra. Errar aqui é o
// pecado capital deste módulo: chamar queda de rede de "recusado" faria o
// técnico achar que perdeu a saída.
//
// `ehDuplicidade` e `checarConexao` moraram aqui até a inspeção offline precisar
// das mesmas regras. Foram para `rede.ts`, junto de `ehErroDeRede`, para que a
// classificação de erro do offline seja uma só — duas cópias divergiriam no
// primeiro código de erro novo que aparecesse.

// ─── O envio de uma saída ────────────────────────────────────────────────────

async function enviarSaida(original: SaidaOffline): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const reg: SaidaOffline = { ...original, fotos: original.fotos.map((f) => ({ ...f })) };

  // 1) A linha do checklist, como RASCUNHO.
  //
  // Nasce RASCUNHO e não FINALIZADO de propósito: o trigger `frota_exige_4_fotos`
  // é `before insert or update` (correção do commit a0f9fdc), então um insert já
  // finalizado seria recusado — as fotos ainda não existem neste instante.
  if (reg.etapa === "CHECKLIST") {
    const { error } = await supabase.from("frota_checklists").insert({
      id_checklist: reg.id_checklist,
      id_veiculo: reg.id_veiculo,
      id_unidade: reg.id_unidade,
      // A hora REAL da saída, do aparelho — não a hora em que a rede voltou.
      data_saida: reg.criado_em,
      status: "RASCUNHO",
      ...reg.checklist,
    } as never);

    if (error) {
      if (!ehDuplicidade(error)) throw error;

      /**
       * A linha já existe de uma tentativa anterior DESTA MESMA saída — o id
       * nasce no aparelho, então duplicidade aqui só pode ser isso.
       *
       * O UPDATE não é zelo: sem ele a CORREÇÃO morre em silêncio. Uma saída que
       * subiu a linha e falhou na foto volta como recusada; o técnico conserta o
       * km e manda de novo; o insert bate na chave primária, a duplicidade é
       * lida como sucesso — e o km errado fica no banco para sempre, com a tela
       * do celular dizendo "enviada". Regravar os campos é o que faz a correção
       * chegar.
       *
       * Sobrescrever é seguro porque uma saída CONFIRMADA nunca chega aqui: o
       * status `ENVIADO` sai da fila. Tudo o que passa por este ponto é uma
       * tentativa inacabada, e nela o registro do aparelho é a versão boa.
       *
       * `status` fica de fora de propósito — quem manda nele é o passo 5, e
       * empurrar RASCUNHO por cima de uma linha que já finalizou desfaria o
       * trabalho da tentativa anterior.
       */
      const { error: erroUpdate } = await supabase
        .from("frota_checklists")
        .update({
          data_saida: reg.criado_em,
          ...reg.checklist,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id_checklist", reg.id_checklist);
      if (erroUpdate) throw erroUpdate;
    }

    reg.etapa = "FOTOS";
    await salvarSaida(reg);
  }

  // 2 e 3) As imagens e suas linhas, foto a foto, gravando o progresso.
  if (reg.etapa === "FOTOS") {
    /**
     * Primeiro o que o técnico APAGOU numa correção, e antes de inserir o resto:
     * a foto sumiu do aparelho, mas a linha dela continua no painel se já tinha
     * subido. Apagar depois de inserir daria o mesmo resultado; apagar antes
     * mantém a leitura da lista igual à ordem em que as coisas acontecem.
     *
     * A imagem no MinIO fica — é a mesma regra da galeria: o storage guarda o
     * arquivo, quem manda no que aparece é a linha.
     */
    if (reg.fotos_removidas?.length) {
      const { error } = await supabase
        .from("frota_checklist_fotos")
        .delete()
        .in("id_foto", reg.fotos_removidas);
      if (error) throw error;
      reg.fotos_removidas = [];
      await salvarSaida(reg);
    }

    for (const foto of reg.fotos) {
      if (!foto.enviada_storage) {
        const [envThumb, envVista] = await Promise.all([
          supabase.storage.from(BUCKET).upload(foto.thumb_path, foto.thumb, {
            cacheControl: "3600",
            upsert: true,
            contentType: "image/jpeg",
          }),
          supabase.storage.from(BUCKET).upload(foto.vista_path, foto.vista, {
            cacheControl: "3600",
            upsert: true,
            contentType: "image/jpeg",
          }),
        ]);
        if (envThumb.error) throw envThumb.error;
        if (envVista.error) throw envVista.error;
        foto.enviada_storage = true;
        await salvarSaida(reg); // marca ANTES da linha: reenvio não re-sobe imagem
      }

      if (!foto.linha_criada) {
        // O índice único (id_checklist, angulo) recusaria a segunda "frente".
        // Apagar antes é o mesmo que o caminho online faz ao refazer uma foto.
        if (foto.angulo !== "EXTRA") {
          await supabase
            .from("frota_checklist_fotos")
            .delete()
            .eq("id_checklist", reg.id_checklist)
            .eq("angulo", foto.angulo);
        }
        const { error } = await supabase.from("frota_checklist_fotos").insert({
          id_foto: foto.id_foto,
          id_checklist: reg.id_checklist,
          angulo: foto.angulo,
          thumb_path: foto.thumb_path,
          vista_path: foto.vista_path,
          original_path: null,
        } as never);
        if (error && !ehDuplicidade(error)) throw error;
        foto.linha_criada = true;
        await salvarSaida(reg);
      }
    }
    reg.etapa = "ROTAS";
    await salvarSaida(reg);
  }

  // 4) Rotas. Substitui o conjunto inteiro, como o caminho online — e é o que
  //    torna o reenvio idempotente sem precisar comparar item a item.
  if (reg.etapa === "ROTAS") {
    if (reg.rotas.length > 0) {
      const { error: errDel } = await supabase
        .from("frota_rotas")
        .delete()
        .eq("id_checklist", reg.id_checklist);
      if (errDel) throw errDel;

      const { error } = await supabase.from("frota_rotas").insert(
        reg.rotas.map((r) => ({
          id_rota: gerarId("ROT"),
          id_checklist: reg.id_checklist,
          ordem: r.ordem,
          origem: r.origem,
          destino: r.destino,
          km_percorrido: r.km_percorrido,
          finalidade: r.finalidade,
          data: null,
          observacao: null,
        })) as never
      );
      if (error) throw error;
    }
    reg.etapa = "FINALIZAR";
    await salvarSaida(reg);
  }

  // 5) A transição que o trigger vigia. Neste ponto as quatro fotos existem.
  if (reg.etapa === "FINALIZAR") {
    const { error } = await supabase
      .from("frota_checklists")
      .update({
        status: "FINALIZADO",
        finalizado_em: reg.finalizado_em,
        finalizado_por: reg.checklist.criado_por,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id_checklist", reg.id_checklist);
    if (error) throw error;
    reg.etapa = "KM";
    await salvarSaida(reg);
  }

  // 6) O km do veículo, por último: se falhar, a saída já está registrada e o km
  //    se recupera. O contrário deixaria o veículo andando sem saída que
  //    justifique. A própria função só grava se o km for maior que o atual, o
  //    que a torna segura para repetir.
  if (reg.etapa === "KM") {
    await atualizarKmVeiculo({
      id_veiculo: reg.id_veiculo,
      km: reg.checklist.km_saida,
      origem: "SAIDA",
      id_origem: reg.id_checklist,
    });
    reg.etapa = "PRONTO";
    await salvarSaida(reg);
  }

  // Enviada. As imagens saem do aparelho agora — são 1,3 MB por saída que não
  // servem mais para nada, e espaço em celular de campo é finito. Os metadados
  // ficam para o técnico ver a confirmação na tela de pendências.
  await salvarSaida({
    ...reg,
    status: "ENVIADO",
    etapa: "PRONTO",
    ultimo_erro: null,
    ultima_tentativa: new Date().toISOString(),
    fotos: reg.fotos.map((f) => ({
      ...f,
      thumb: new Blob(),
      vista: new Blob(),
    })),
  });
}

// ─── A fila ──────────────────────────────────────────────────────────────────

/**
 * Tenta subir tudo o que está pendente.
 *
 * `forcar` é o botão manual da tela de pendências: ele reinclui os RECUSADOS,
 * que a rodada automática não toca. Um recusado pelo banco reenviado sozinho em
 * laço só produziria o mesmo erro para sempre.
 */
export async function sincronizar(opcoes?: { forcar?: boolean }): Promise<ResumoSync> {
  const resumo: ResumoSync = {
    enviadas: 0,
    recusadas: 0,
    pendentes: 0,
    motivoParada: "CONCLUIDO",
  };

  if (!offlineDisponivel()) return resumo;
  if (rodando) return { ...resumo, motivoParada: "JA_RODANDO" };
  rodando = true;

  try {
    const todas = await listarSaidas();
    const aEnviar = todas.filter((s) => {
      if (s.status === "ENVIADO" || s.status === "ENVIANDO") return false;
      /**
       * RASCUNHO nunca sobe, e são dois casos no mesmo status: a captura parada
       * no meio, e a saída que o técnico reabriu para CORRIGIR. Nos dois o dado
       * está incompleto por definição.
       *
       * Subir mesmo assim daria um registro que não finaliza: sem as quatro
       * fotos o trigger `frota_exige_4_fotos` recusa o passo 5, e a saída voltaria
       * ao técnico marcada como "recusada pelo painel" por um erro que é só dele
       * ainda não ter terminado. É também o que trava a corrida da correção — a
       * rede pode voltar no meio da edição, e a fila tem de passar direto.
       */
      if (s.status === "RASCUNHO") return false;
      if (s.status === "RECUSADO") return opcoes?.forcar === true;
      return true; // PENDENTE e REAUTENTICAR
    });

    resumo.pendentes = aEnviar.length;
    if (aEnviar.length === 0) {
      await limparEnviadasAntigas(todas);
      return resumo;
    }

    const conexao = await checarConexao();
    if (conexao !== "OK") {
      // Marca todas de uma vez para a tela explicar o motivo certo, e sai sem
      // tentar: nenhuma delas passaria.
      for (const s of aEnviar) {
        await atualizarSaida(s.id_checklist, {
          status: conexao === "REAUTENTICAR" ? "REAUTENTICAR" : "PENDENTE",
          ultimo_erro:
            conexao === "REAUTENTICAR"
              ? "Sua sessão expirou. Abra o Painel SST e entre de novo — nada foi perdido."
              : null,
        });
      }
      avisarMudanca();
      return { ...resumo, motivoParada: conexao };
    }

    for (const saida of aEnviar) {
      await atualizarSaida(saida.id_checklist, { status: "ENVIANDO" });
      avisarMudanca();

      try {
        await enviarSaida(saida);
        resumo.enviadas += 1;
        resumo.pendentes -= 1;
      } catch (erro) {
        const tentativas = saida.tentativas + 1;
        const mensagem = String((erro as Error)?.message ?? erro);

        if (ehErroDeRede(erro)) {
          // A rede caiu no meio. Não adianta tentar as próximas — para a fila
          // inteira e mantém a ordem para a próxima rodada.
          await atualizarSaida(saida.id_checklist, {
            status: "PENDENTE",
            tentativas,
            ultima_tentativa: new Date().toISOString(),
            ultimo_erro: null,
          });
          avisarMudanca();
          return { ...resumo, motivoParada: "SEM_REDE" };
        }

        // O servidor respondeu e disse não. Isso é do dado, não da rede.
        const desistir = tentativas >= MAX_TENTATIVAS;
        await atualizarSaida(saida.id_checklist, {
          status: desistir ? "RECUSADO" : "PENDENTE",
          tentativas,
          ultima_tentativa: new Date().toISOString(),
          ultimo_erro: mensagem,
        });
        if (desistir) resumo.recusadas += 1;
        avisarMudanca();
        // Segue para a próxima: uma saída travada não pode bloquear as outras.
      }
    }

    await limparEnviadasAntigas(await listarSaidas());
    return resumo;
  } finally {
    rodando = false;
    avisarMudanca();
  }
}

/** Só roda quando faz sentido tentar. Chamado ao abrir o app e ao voltar a rede. */
export async function sincronizarSeOnline(): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  await sincronizar();
}

/**
 * Some com o que já foi confirmado há mais de uma semana. O registro enviado só
 * existe para o técnico ver "subiu"; passada a semana, o lugar de consultar a
 * saída é o painel, não o cache do celular.
 */
async function limparEnviadasAntigas(todas: SaidaOffline[]): Promise<void> {
  const limite = Date.now() - DIAS_MANTER_ENVIADAS * 24 * 60 * 60 * 1000;
  const velhas = todas.filter(
    (s) => s.status === "ENVIADO" && new Date(s.ultima_tentativa ?? s.criado_em).getTime() < limite
  );
  if (velhas.length === 0) return;
  const { removerSaida } = await import("./db");
  for (const s of velhas) await removerSaida(s.id_checklist);
  avisarMudanca();
}
