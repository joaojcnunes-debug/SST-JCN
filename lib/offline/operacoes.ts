"use client";

/**
 * A fila de escrita da inspeção offline.
 *
 * DIFERENÇA PARA `db.ts`: lá cada registro é uma SAÍDA, uma unidade de negócio
 * que o técnico reconhece. Aqui cada registro é uma OPERAÇÃO — "insere estas
 * linhas em `riscos`", "atualiza aquela em `setores`". A troca é deliberada e o
 * porquê está em `docs/inspecoes/DESENHO-OFFLINE.md`: a saída é capturada
 * offline do zero; a inspeção já existe no painel e é *incrementada* em campo.
 * Guardar "a inspeção inteira" no aparelho colocaria o técnico e o escritório
 * editando cópias do mesmo documento.
 *
 * POR QUE ISTO É BARATO: o painel já gera o id no cliente em toda parte
 * (`gerarId("RSC")`, `"SET"`, `"CGO"`, `"EPI"`, `"FOT"`). Não foi feito pensando
 * em offline, mas é a propriedade que a fila da Frota explora para ser
 * idempotente — reenviar bate na chave primária, e violação de unicidade é
 * SUCESSO, não erro. Sem isso, cada formulário precisaria de reconciliação
 * própria.
 *
 * O QUE ESTE ARQUIVO NÃO FAZ: enviar. Ele guarda, ordena e classifica. Quem fala
 * com o PostgREST é o motor de sincronização, pelo mesmo motivo que o service
 * worker não conhece checklist — regra de negócio fica onde o negócio está.
 */

import { gerarId } from "@/lib/utils";
import {
  comLoja,
  offlineDisponivel,
  LOJA_IMAGENS,
  LOJA_DOCUMENTOS,
  LOJA_OPERACOES,
} from "./db";

/**
 * PENDENTE e RECUSADA são estados de verdade; ENVIADA é recibo.
 *
 * Não existe "ENVIANDO" persistido de propósito: o Android mata o app no meio do
 * envio com naturalidade, e um estado transitório gravado em disco viraria
 * operação travada para sempre, esperando um processo que morreu. Quem está
 * sendo enviada é assunto da memória do motor, que recomeça do zero a cada
 * abertura.
 */
export type StatusOperacao = "PENDENTE" | "ENVIADA" | "RECUSADA";

/**
 * `upsert` não é luxo: `ExtintorForm` grava assim, com `onConflict` na chave, e
 * traduzir para insert-ou-update mudaria o comportamento em produção.
 *
 * De quebra é o tipo mais amigável à fila — já é idempotente por definição, sem
 * depender da regra de "violação de unicidade é sucesso".
 */
export type TipoOperacao = "insert" | "update" | "delete" | "upsert";

export type OperacaoOffline = {
  id: string;

  /** Nome da tabela no PostgREST, exatamente como o `.from()` recebe. */
  tabela: string;
  tipo: TipoOperacao;

  /**
   * As linhas do insert, ou o patch do update. Precisa ser serializável — o
   * IndexedDB usa clonagem estruturada, então `File`/`Blob` até caberiam, mas
   * imagem vai para `LOJA_IMAGENS` (ver o comentário lá).
   */
  linhas: Record<string, unknown>[] | Record<string, unknown> | null;

  /**
   * Para update e delete: `{ coluna: valor }` que vira `.eq()`. Sempre a chave
   * primária, nunca um filtro amplo — uma operação guardada no aparelho pode
   * demorar dias para subir, e `.eq("status", "RASCUNHO")` teria significado
   * diferente quando finalmente rodasse.
   */
  filtro: Record<string, string> | null;

  /** Coluna do `onConflict`, só para `upsert`. */
  conflito?: string | null;

  /**
   * A que documento esta operação pertence, e de que módulo ele é.
   *
   * Chamava-se `id_inspecao` enquanto só existia inspeção. Virou genérico quando
   * o segundo módulo chegou: um relatório de não-conformidade NÃO é uma
   * inspeção, e guardar o id dele num campo com aquele nome seria o tipo de
   * mentira que ninguém percebe até precisar debugar.
   *
   * `modulo` é o que permite a tela de pendências montar o link certo — sem ele,
   * toda pendência apontaria para `/inspecoes/...`.
   */
  modulo: string;
  id_documento: string;

  /**
   * Ids de imagens em `LOJA_IMAGENS` que precisam estar no MinIO ANTES desta
   * operação subir. `riscos.foto_path` guarda o caminho do arquivo: inserir a
   * linha antes do arquivo deixa referência quebrada apontando para o nada.
   */
  imagens: string[];

  /**
   * Ids de OUTRAS operações que precisam subir antes desta.
   *
   * Ordem cronológica não basta. O técnico cadastra um setor novo em campo e,
   * dez segundos depois, um risco apontando para ele — as duas operações nascem
   * em ordem, mas se a do setor for RECUSADA a do risco não pode ser tentada:
   * a FK falharia e o técnico veria "recusado pelo banco" num risco que está
   * perfeito. Melhor segurar do que mentir.
   */
  depende_de: string[];

  criado_em: string;
  status: StatusOperacao;
  tentativas: number;
  ultimo_erro: string | null;
  ultima_tentativa: string | null;
};

/** Depois disto para de tentar sozinha e passa a exigir uma pessoa. Mesmo teto da Frota. */
export const MAX_TENTATIVAS = 5;

export const EVENTO_OPERACOES = "painel-sst:operacoes-mudou";

export function aoMudarOperacoes(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENTO_OPERACOES, callback);
  return () => window.removeEventListener(EVENTO_OPERACOES, callback);
}

function avisarMudanca() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENTO_OPERACOES));
}

// ─── Escrita na fila ─────────────────────────────────────────────────────────

type NovaOperacao = {
  tabela: string;
  tipo: TipoOperacao;
  linhas?: OperacaoOffline["linhas"];
  filtro?: Record<string, string> | null;
  conflito?: string | null;
  modulo: string;
  id_documento: string;
  imagens?: string[];
  depende_de?: string[];
};

/**
 * Enfileira e devolve o id da operação — quem chama precisa dele para declarar
 * dependência na operação seguinte.
 */
export async function enfileirar(nova: NovaOperacao): Promise<string> {
  const operacao: OperacaoOffline = {
    id: gerarId("OPR"),
    tabela: nova.tabela,
    tipo: nova.tipo,
    linhas: nova.linhas ?? null,
    filtro: nova.filtro ?? null,
    conflito: nova.conflito ?? null,
    modulo: nova.modulo,
    id_documento: nova.id_documento,
    imagens: nova.imagens ?? [],
    depende_de: nova.depende_de ?? [],
    criado_em: new Date().toISOString(),
    status: "PENDENTE",
    tentativas: 0,
    ultimo_erro: null,
    ultima_tentativa: null,
  };
  await comLoja("readwrite", (loja) => loja.put(operacao), LOJA_OPERACOES);
  avisarMudanca();
  return operacao.id;
}

/**
 * Lê, aplica o patch e regrava.
 *
 * Não é atômico entre leitura e escrita, e está tudo bem pela mesma razão de
 * `atualizarSaida`: o motor é sequencial de propósito, uma operação por vez.
 */
export async function atualizarOperacao(
  id: string,
  patch: Partial<OperacaoOffline>
): Promise<OperacaoOffline | null> {
  const atual = await comLoja<OperacaoOffline | undefined>(
    "readonly",
    (loja) => loja.get(id),
    LOJA_OPERACOES
  );
  if (!atual) return null;
  const nova = { ...atual, ...patch };
  await comLoja("readwrite", (loja) => loja.put(nova), LOJA_OPERACOES);
  avisarMudanca();
  return nova;
}

// ─── Leitura ─────────────────────────────────────────────────────────────────

/** Sempre em ordem de criação — a ordem em que o técnico fez as coisas. */
export async function listarOperacoes(): Promise<OperacaoOffline[]> {
  if (!offlineDisponivel()) return [];
  const todas = await comLoja<OperacaoOffline[]>(
    "readonly",
    (loja) => loja.getAll(),
    LOJA_OPERACOES
  );
  return todas.sort((a, b) => a.criado_em.localeCompare(b.criado_em));
}

/**
 * O que o motor deve tentar agora.
 *
 * Uma operação PENDENTE cuja dependência ainda não subiu fica de fora: tentar
 * violaria FK e gastaria uma das cinco tentativas dela por culpa alheia.
 */
export async function listarProntasParaEnviar(): Promise<OperacaoOffline[]> {
  const todas = await listarOperacoes();
  const enviadas = new Set(todas.filter((o) => o.status === "ENVIADA").map((o) => o.id));

  /**
   * Dependência que NÃO EXISTE MAIS conta como satisfeita.
   *
   * `limparEnviadas` apaga da loja o que já subiu há mais de uma semana — e só o
   * que já subiu. Sem esta segunda condição, uma operação que dependesse de algo
   * faxinado nunca mais seria elegível: ficaria PENDENTE para sempre, invisível
   * na conta de "prontas", e o técnico veria uma pendência que jamais sobe sem
   * nenhuma explicação na tela.
   */
  const existentes = new Set(todas.map((o) => o.id));
  const dependenciaResolvida = (id: string) => enviadas.has(id) || !existentes.has(id);

  return todas.filter(
    (o) =>
      o.status === "PENDENTE" &&
      o.tentativas < MAX_TENTATIVAS &&
      o.depende_de.every(dependenciaResolvida)
  );
}

/**
 * Existe algo esperando para subir NESTE documento?
 *
 * POR DOCUMENTO, e não global. A ordem só importa dentro do mesmo documento —
 * as chaves estrangeiras que a fila protege são internas a ele (o risco aponta
 * para o setor da mesma inspeção, o item aponta para o seu relatório). Uma
 * inspeção com pendência não tem motivo para empurrar para a fila o cadastro de
 * um equipamento que nada tem a ver.
 *
 * A versão global disto era pior do que parecia: bastava UMA operação travada
 * esperando algo recusado para o painel inteiro passar a trabalhar offline
 * indefinidamente, sem que ninguém entendesse por quê.
 *
 * Conta só PENDENTE: uma RECUSADA fica parada até alguém resolver, e incluí-la
 * faria o documento inteiro cair na fila por causa de um erro de digitação de
 * três dias atrás.
 */
export async function temOperacaoPendente(idDocumento: string): Promise<boolean> {
  if (!offlineDisponivel()) return false;
  const todas = await listarOperacoes();
  return todas.some((o) => o.status === "PENDENTE" && o.id_documento === idDocumento);
}

/** `linhas` aceita objeto ou lista; quem percorre não deveria se importar com qual. */
function linhasDe(o: OperacaoOffline): Record<string, unknown>[] {
  if (!o.linhas) return [];
  return Array.isArray(o.linhas) ? o.linhas : [o.linhas];
}

/**
 * Qual operação ainda na fila é a que cria esta linha?
 *
 * Serve para o formulário declarar dependência sem precisar guardar nada por
 * fora: o cargo pergunta "quem cria o setor `SET-1A2B3C4D`?" e recebe o id da
 * operação, ou `null` se o setor já existe no banco.
 *
 * POR QUE NÃO BASTA A ORDEM CRONOLÓGICA. A fila é sequencial, então o setor
 * criado antes já subiria antes do cargo — na maioria das vezes. O caso que
 * quebra é o setor ser RECUSADO: sem a dependência declarada, o cargo seria
 * tentado assim mesmo, a FK falharia, e a tela diria "recusado pelo painel"
 * sobre um cargo que não tem defeito nenhum. O técnico procuraria o erro no
 * lugar errado.
 */
export async function operacaoPendenteQueCria(
  tabela: string,
  coluna: string,
  valor: string
): Promise<string | null> {
  if (!offlineDisponivel()) return null;
  const todas = await listarOperacoes();
  const achada = todas.find(
    (o) =>
      o.status === "PENDENTE" &&
      o.tabela === tabela &&
      o.tipo === "insert" &&
      linhasDe(o).some((l) => l[coluna] === valor)
  );
  return achada?.id ?? null;
}

/**
 * Faxina do que já subiu. Recibo antigo não ajuda ninguém, e as FOTOS vão junto
 * — sem esta limpeza os binários ficariam no aparelho para sempre, e um técnico
 * com quarenta fotos por dia encheria o celular em algumas semanas.
 *
 * Sete dias é o mesmo prazo da Frota (`DIAS_MANTER_ENVIADAS`), e pela mesma
 * razão: tempo de o técnico voltar ao escritório e conferir se o que ele fez em
 * campo apareceu no painel.
 *
 * A idade conta a partir do ENVIO (`ultima_tentativa`), não da criação. Medir
 * pela criação apagaria imediatamente o recibo de uma operação capturada há dez
 * dias e enviada agora — justo a que o técnico mais quer ver confirmada.
 */
export async function limparEnviadas(dias = 7): Promise<number> {
  const corte = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();
  const todas = await listarOperacoes();
  const alvos = todas.filter(
    (o) => o.status === "ENVIADA" && (o.ultima_tentativa ?? o.criado_em) < corte
  );
  for (const o of alvos) {
    for (const idImagem of o.imagens) await removerImagem(idImagem);
    await comLoja("readwrite", (loja) => loja.delete(o.id), LOJA_OPERACOES);
  }
  if (alvos.length > 0) avisarMudanca();
  return alvos.length;
}

// ─── Imagens ─────────────────────────────────────────────────────────────────
// Separadas das operações porque a fila precisa varrer a lista inteira para
// decidir a próxima, e carregar o Blob junto faria essa varredura arrastar
// dezenas de MB para a memória.

export type ImagemOffline = {
  id: string;
  blob: Blob;

  /**
   * Onde o arquivo deve nascer no MinIO. Definido na CAPTURA, não no envio.
   *
   * Tem que ser assim: a linha guarda a URL pública da foto, e essa URL é o
   * caminho concatenado ao host do storage — pura montagem de string, que
   * funciona sem rede. Decidir o caminho só na hora de subir obrigaria a voltar
   * na linha depois para corrigir a URL, e essa linha já pode ter subido.
   */
  caminho: string;

  /**
   * Já está no MinIO. Marcado ANTES de a linha subir, igual à Frota faz em
   * `fila.ts:183` — o Android mata o app no meio do envio com naturalidade, e
   * sem esta marca a retentativa re-subiria a imagem inteira de novo.
   */
  enviada: boolean;

  criado_em: string;
};

export async function guardarImagem(blob: Blob, caminho: string): Promise<string> {
  const registro: ImagemOffline = {
    id: gerarId("IMG"),
    blob,
    caminho,
    enviada: false,
    criado_em: new Date().toISOString(),
  };
  await comLoja("readwrite", (loja) => loja.put(registro), LOJA_IMAGENS);
  return registro.id;
}

export async function marcarImagemEnviada(id: string): Promise<void> {
  const atual = await lerImagem(id);
  if (!atual) return;
  await comLoja("readwrite", (loja) => loja.put({ ...atual, enviada: true }), LOJA_IMAGENS);
}

export async function lerImagem(id: string): Promise<ImagemOffline | null> {
  if (!offlineDisponivel()) return null;
  const r = await comLoja<ImagemOffline | undefined>(
    "readonly",
    (loja) => loja.get(id),
    LOJA_IMAGENS
  );
  return r ?? null;
}

export async function removerImagem(id: string): Promise<void> {
  if (!offlineDisponivel()) return;
  await comLoja("readwrite", (loja) => loja.delete(id), LOJA_IMAGENS);
}

// ─── Cache de leitura do documento ───────────────────────────────────────────

export type DocumentoCache<T = unknown> = {
  id_documento: string;
  /** O pacote que a tela precisa, seja qual for o módulo. */
  dados: T;
  /** Quando o técnico levou o documento para o campo. A tela mostra isto. */
  baixado_em: string;
};

export async function guardarDocumentoCache<T>(
  idDocumento: string,
  dados: T
): Promise<void> {
  if (!offlineDisponivel()) return;
  try {
    const registro: DocumentoCache<T> = {
      id_documento: idDocumento,
      dados,
      baixado_em: new Date().toISOString(),
    };
    await comLoja("readwrite", (loja) => loja.put(registro), LOJA_DOCUMENTOS);
  } catch {
    // Cache é conforto, não contrato — mesma postura de `guardarVeiculosCache`.
    // Falhar aqui não pode derrubar a tela que acabou de receber os dados bons.
  }
}

export async function lerDocumentoCache<T>(
  idDocumento: string
): Promise<DocumentoCache<T> | null> {
  if (!offlineDisponivel()) return null;
  try {
    const r = await comLoja<DocumentoCache<T> | undefined>(
      "readonly",
      (loja) => loja.get(idDocumento),
      LOJA_DOCUMENTOS
    );
    return r ?? null;
  } catch {
    return null;
  }
}

