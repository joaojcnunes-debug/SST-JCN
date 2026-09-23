/**
 * IndexedDB da captura offline — onde a saída fica enquanto não há rede.
 *
 * POR QUE INDEXEDDB E NÃO localStorage: o `useRascunho` já avisa no próprio
 * comentário — localStorage tem ~5 MB e não serializa `File`/`Blob`. Uma saída
 * são oito imagens (thumb + vista dos quatro ângulos), ~1,3 MB. Três saídas
 * estouram o localStorage; no IndexedDB cabem com folga e como binário de
 * verdade, sem base64 inflando 33%.
 *
 * POR QUE SEM DEPENDÊNCIA NOVA (nada de `idb`): são ~120 linhas de wrapper
 * contra um pacote a mais no bundle de um app que já empacota para Electron e
 * para Docker standalone. O `package.json` fica intocado — e o
 * `npm install --ignore-scripts` de quem for buildar continua valendo.
 *
 * UM REGISTRO POR SAÍDA, não uma fila de operações soltas. A saída é a unidade
 * que o técnico entende ("a saída do Gol de ontem não subiu"), é a unidade que o
 * banco valida (o trigger olha o checklist inteiro) e é a unidade que a tela de
 * pendências mostra. Fila de operações soltas obrigaria a remontar esse contexto
 * a cada erro.
 */

import type { AnguloFoto } from "@/lib/frota/tipos";

const NOME_BANCO = "painel-sst-offline";
const VERSAO_BANCO = 4;
const LOJA_SAIDAS = "saidas";

/**
 * Cópia dos veículos, para o assistente ter o que mostrar em campo.
 *
 * Sem isto o offline não fecha: a tela do veículo lê `frota_veiculos` pela rede,
 * e sem rede ela abre vazia — o técnico não chega nem ao primeiro passo. É a
 * diferença entre "o app abre offline" e "dá para trabalhar offline".
 */
const LOJA_VEICULOS = "veiculos";

// ─── Lojas da inspeção offline (v3) ──────────────────────────────────────────
// Vizinhas das da Frota, no mesmo banco, porque compartilham o `abrirBanco` e a
// mesma cota de armazenamento — e porque um segundo banco significaria uma
// segunda chamada de `persist()` disputando a mesma permissão do navegador.
//
// Por que a inspeção NÃO copia o desenho da saída (um registro por unidade), ver
// `docs/inspecoes/DESENHO-OFFLINE.md`. Em uma linha: a saída é capturada offline,
// a inspeção é *incrementada* offline.

/** A fila de escrita: cada insert/update/delete que ainda não chegou ao banco. */
export const LOJA_OPERACOES = "operacoes";

/**
 * Os binários das fotos, separados das operações de propósito.
 *
 * Uma foto de risco é ~200 KB depois de reduzida; a operação que a referencia
 * são ~1 KB de JSON. Guardar juntos faria a fila carregar megabytes de imagem
 * na memória só para descobrir qual é a próxima linha a enviar.
 */
export const LOJA_IMAGENS = "imagens";

/**
 * Cópia local do que a tela de um documento lê — a inspeção inteira, o relatório
 * de não-conformidade com seus itens. Chave é `id_documento`.
 *
 * Gravado por ação explícita do técnico — "levar para o campo" — e não de forma
 * oportunista. Cache que se enche sozinho dá a ilusão de cobertura: o técnico sai
 * da base achando que está coberto e descobre no cliente que a tela de que
 * precisa nunca foi aberta.
 *
 * Nasceu como `inspecoes`, chaveado por `id_inspecao`. Virou genérico quando o
 * segundo módulo chegou — e como o keyPath de uma loja não muda depois de criada,
 * é uma loja nova, e a versão do banco subiu junto.
 */
export const LOJA_DOCUMENTOS = "documentos";

/**
 * Onde a sincronização parou. Serve para RETOMAR, não para relatório: o Android
 * mata o app no meio do envio com naturalidade, e recomeçar do zero re-subiria
 * 1,3 MB de foto que já está no MinIO.
 *
 * A ordem das etapas é a ordem obrigatória, e ela vem do banco, não de gosto:
 * a FK `frota_checklist_fotos.id_checklist` exige a linha do checklist ANTES da
 * foto, e o trigger `frota_exige_4_fotos` exige as fotos ANTES do FINALIZADO.
 */
export type EtapaSync = "CHECKLIST" | "FOTOS" | "ROTAS" | "FINALIZAR" | "KM" | "PRONTO";

export const ORDEM_ETAPAS: readonly EtapaSync[] = [
  "CHECKLIST",
  "FOTOS",
  "ROTAS",
  "FINALIZAR",
  "KM",
  "PRONTO",
] as const;

/**
 * RECUSADO e REAUTENTICAR são coisas diferentes e a distinção é o coração da
 * tela de pendências:
 *   • RECUSADO     — o banco disse não (km regressivo, trava de foto). Reenviar
 *                    do mesmo jeito vai falhar de novo; precisa de gente.
 *   • REAUTENTICAR — o Cloudflare Access derrubou a sessão e devolveu HTML de
 *                    login no lugar de JSON. O dado está inteiro; basta abrir o
 *                    app e entrar de novo. Tratar isto como "recusado" faria o
 *                    técnico achar que perdeu a saída.
 */
export type StatusPendencia =
  /**
   * Capturada pela metade — o técnico está no meio do assistente. A fila IGNORA
   * este status: subir meia saída criaria no painel um registro que nunca vai
   * finalizar. Ela grava a cada passo pelo mesmo motivo que o rascunho online
   * grava: fechar o app no meio da captura não pode perder as fotos já tiradas.
   * E, como manda o `useRascunho`, ela nunca volta sozinha — quem retoma é o
   * técnico, pela tela de pendências.
   */
  | "RASCUNHO"
  | "PENDENTE"
  | "ENVIANDO"
  | "ENVIADO"
  | "RECUSADO"
  | "REAUTENTICAR";

export type FotoOffline = {
  id_foto: string;
  angulo: AnguloFoto;
  /** Já reduzidas no aparelho pela `prepararImagem` — nunca o arquivo da câmera. */
  thumb: Blob;
  vista: Blob;
  thumb_path: string;
  vista_path: string;
  /** Marcadores de retomada: o que já subiu não sobe de novo. */
  enviada_storage: boolean;
  linha_criada: boolean;
};

export type RotaOffline = {
  ordem: number;
  origem: string;
  destino: string;
  km_percorrido: number | null;
  finalidade: string | null;
};

export type SaidaOffline = {
  id_checklist: string;
  id_veiculo: string;
  id_unidade: string;
  /** Só para a tela de pendências ter o que mostrar sem consultar o servidor. */
  placa: string;
  modelo: string;

  /**
   * Define a ORDEM DA FILA, e isso é uma trava do banco, não estética: o CHECK
   * de km regressivo recusa uma saída de ontem que chegue depois da de hoje.
   * Enviar em paralelo perderia registro; enviar do mais antigo para o mais
   * novo é a única ordem que o banco aceita.
   */
  criado_em: string;

  status: StatusPendencia;
  etapa: EtapaSync;
  tentativas: number;
  ultimo_erro: string | null;
  ultima_tentativa: string | null;

  /**
   * Quando o técnico apertou "finalizar" NO APARELHO. Não é a hora do sync, e a
   * diferença não é detalhe: a saída aconteceu ontem às 7h no pátio; deixar o
   * banco carimbar `now()` na hora em que a rede voltou registraria a saída às
   * 15h de hoje. O relatório de quilometragem sairia mentindo.
   */
  finalizado_em: string;

  /** Os campos da linha `frota_checklists`, prontos para o insert. */
  checklist: {
    condutor_nome: string;
    km_saida: number;
    avarias_constatadas: string | null;
    observacoes: string | null;
    endereco_cep: string | null;
    endereco_logradouro: string;
    endereco_numero: string | null;
    endereco_complemento: string | null;
    endereco_bairro: string | null;
    endereco_cidade: string;
    endereco_uf: string;
    endereco_ponto_referencia: string | null;
    maps_url: string | null;
    criado_por: string | null;
  };

  fotos: FotoOffline[];
  rotas: RotaOffline[];

  /**
   * Fotos que o técnico apagou DEPOIS de a linha delas já ter subido — só
   * acontece numa correção de saída que sincronizou pela metade.
   *
   * Sem esta lista a foto sumiria do aparelho e ficaria no painel: apagar do
   * array local não conta nada ao servidor, e a fila só sabe inserir o que
   * existe. Os quatro ângulos obrigatórios não precisam disto (a fila apaga por
   * `(id_checklist, angulo)` antes de inserir, então refazer já substitui); quem
   * precisa é a EXTRA, que não tem ângulo para servir de chave.
   *
   * Opcional porque registro gravado antes desta versão não a tem — e o
   * IndexedDB não valida forma, então um `undefined` aqui não pode quebrar a
   * leitura de uma saída que já estava guardada no celular.
   */
  fotos_removidas?: string[];
};

/** Fora do browser (SSR, build) não existe IndexedDB — e não deve existir. */
export function offlineDisponivel(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

let promessaBanco: Promise<IDBDatabase> | null = null;

function abrirBanco(): Promise<IDBDatabase> {
  if (!offlineDisponivel()) return Promise.reject(new Error("IndexedDB indisponível."));
  if (promessaBanco) return promessaBanco;

  promessaBanco = new Promise((resolve, reject) => {
    const req = indexedDB.open(NOME_BANCO, VERSAO_BANCO);

    // Idempotente por loja, e não por versão: assim subir a versão do banco no
    // futuro não obriga a lembrar o que cada degrau criou.
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(LOJA_SAIDAS)) {
        const loja = db.createObjectStore(LOJA_SAIDAS, { keyPath: "id_checklist" });
        loja.createIndex("por_status", "status", { unique: false });
        loja.createIndex("por_criado_em", "criado_em", { unique: false });
      }
      if (!db.objectStoreNames.contains(LOJA_VEICULOS)) {
        db.createObjectStore(LOJA_VEICULOS, { keyPath: "id_veiculo" });
      }
      if (!db.objectStoreNames.contains(LOJA_OPERACOES)) {
        const loja = db.createObjectStore(LOJA_OPERACOES, { keyPath: "id" });
        // `criado_em` é o índice que importa: a fila envia em ordem de criação,
        // e não em ordem de chave — a chave é aleatória de propósito.
        loja.createIndex("por_criado_em", "criado_em", { unique: false });
        loja.createIndex("por_status", "status", { unique: false });
      }
      if (!db.objectStoreNames.contains(LOJA_IMAGENS)) {
        db.createObjectStore(LOJA_IMAGENS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(LOJA_DOCUMENTOS)) {
        db.createObjectStore(LOJA_DOCUMENTOS, { keyPath: "id_documento" });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Falha ao abrir o banco local."));
    // O usuário abriu outra aba com versão nova do app: a antiga precisa soltar.
    req.onblocked = () => reject(new Error("Feche as outras abas do Painel SST e tente de novo."));
  });

  return promessaBanco;
}

/**
 * Exportada a partir da v3 para `operacoes.ts` reaproveitar a mesma conexão.
 * Abrir um segundo `indexedDB.open` para as lojas da inspeção funcionaria, mas
 * duplicaria o tratamento de `onblocked` — e é justamente ali que mora o bug
 * chato de duas abas com versões diferentes do app.
 */
export function comLoja<T>(
  modo: IDBTransactionMode,
  fn: (loja: IDBObjectStore) => IDBRequest<T>,
  nomeLoja: string = LOJA_SAIDAS
): Promise<T> {
  return abrirBanco().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(nomeLoja, modo);
        const req = fn(tx.objectStore(nomeLoja));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error("Falha no banco local."));
        tx.onabort = () => reject(tx.error ?? new Error("Transação abortada."));
      })
  );
}

export async function salvarSaida(saida: SaidaOffline): Promise<void> {
  await comLoja("readwrite", (loja) => loja.put(saida));
}

export async function lerSaida(id: string): Promise<SaidaOffline | null> {
  const r = await comLoja<SaidaOffline | undefined>("readonly", (loja) => loja.get(id));
  return r ?? null;
}

/** Sempre em ordem de criação — ver o comentário de `criado_em`. */
export async function listarSaidas(): Promise<SaidaOffline[]> {
  const todas = await comLoja<SaidaOffline[]>("readonly", (loja) => loja.getAll());
  return todas.sort((a, b) => a.criado_em.localeCompare(b.criado_em));
}

export async function removerSaida(id: string): Promise<void> {
  await comLoja("readwrite", (loja) => loja.delete(id));
}

/**
 * Lê, aplica o patch e regrava. Não é atômico entre a leitura e a escrita, e
 * está tudo bem: a fila é sequencial de propósito (uma saída por vez), então
 * não há dois escritores disputando o mesmo registro.
 */
export async function atualizarSaida(
  id: string,
  patch: Partial<SaidaOffline>
): Promise<SaidaOffline | null> {
  const atual = await lerSaida(id);
  if (!atual) return null;
  const nova = { ...atual, ...patch };
  await salvarSaida(nova);
  return nova;
}

/** O que ainda não chegou ao servidor. Alimenta o contador do cabeçalho. */
export async function listarNaoEnviadas(): Promise<SaidaOffline[]> {
  const todas = await listarSaidas();
  return todas.filter((s) => s.status !== "ENVIADO");
}

// ─── Cópia local dos veículos ────────────────────────────────────────────────
// Guardada toda vez que a lista chega do servidor com o técnico ainda na base.
// É por isso que a regra "faça login e abra a frota ANTES de sair" não é
// burocracia: é o momento em que o aparelho copia o que vai precisar depois.

/** Aceita a lista resumida e o veículo completo — os dois têm `id_veiculo`. */
export async function guardarVeiculosCache<T extends { id_veiculo: string }>(
  veiculos: T[]
): Promise<void> {
  if (!offlineDisponivel() || veiculos.length === 0) return;
  try {
    for (const v of veiculos) {
      await comLoja("readwrite", (loja) => loja.put(v), LOJA_VEICULOS);
    }
  } catch {
    // Cache é conforto, não contrato: falhar aqui não pode derrubar a tela que
    // acabou de receber os dados de verdade.
  }
}

export async function lerVeiculosCache<T>(): Promise<T[]> {
  if (!offlineDisponivel()) return [];
  try {
    return await comLoja<T[]>("readonly", (loja) => loja.getAll(), LOJA_VEICULOS);
  } catch {
    return [];
  }
}

export async function lerVeiculoCache<T>(id: string): Promise<T | null> {
  if (!offlineDisponivel()) return null;
  try {
    const r = await comLoja<T | undefined>("readonly", (loja) => loja.get(id), LOJA_VEICULOS);
    return r ?? null;
  } catch {
    return null;
  }
}

/**
 * Pede ao browser para NÃO descartar este armazenamento sob pressão de espaço.
 *
 * Importa mais no iOS, onde o Safari limpa dados de site sem uso por ~7 dias —
 * e uma saída registrada na sexta que some na segunda seria pior que não ter
 * offline nenhum. Em site INSTALADO o iOS já poupa; esta chamada cobre também
 * quem usa pela aba. Falhar aqui não é erro: é só o browser dizendo não.
 */
export async function pedirArmazenamentoPersistente(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/** Quanto ainda cabe. A tela de pendências avisa antes de o espaço acabar. */
export async function espacoDisponivel(): Promise<{ usado: number; total: number } | null> {
  try {
    if (!navigator.storage?.estimate) return null;
    const { usage, quota } = await navigator.storage.estimate();
    if (usage == null || quota == null) return null;
    return { usado: usage, total: quota };
  } catch {
    return null;
  }
}
