"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { mensagemErro } from "@/lib/errors";
import { excluirComLixeiraPorId } from "@/lib/hooks/useLixeira";
import { useUserStore } from "@/lib/store";
import { gerarMiniatura, reduzirParaEnvio } from "@/lib/imagem/redimensionar";
import { gerarId } from "@/lib/utils";
import { gravar, type ImagemPendente } from "@/lib/offline/gravar";
import { guardarDocumentoCache, lerDocumentoCache } from "@/lib/offline/operacoes";
import { ehErroDeRede } from "@/lib/offline/rede";
import type { Equipamento } from "@/lib/supabase/types";

/**
 * Dados do módulo Equipamentos JCN Consultoria (patrimônio interno) — tabela `equipamentos`,
 * criada pela v163 e aplicada em produção em 2026-08-11.
 *
 * DIFERENÇA CENTRAL para `useInventarioMaquinas`: aqui NÃO há filtro por empresa
 * cliente. Patrimônio da JCN Consultoria não pertence a cliente nenhum — o recorte é por
 * BASE, e quem faz esse recorte é a RLS do banco (`caller_unidades()`), não uma
 * cláusula montada aqui. Foi essa diferença que motivou a tabela separada: no
 * inventário, "equipamento interno" era `id_empresa is null`, e era justamente
 * esse NULL que fazia máquina interna vazar em consulta de cliente.
 */

const KEY_LISTA = ["equipamentos"] as const;
const KEY_ITEM = (id: string | null | undefined) => ["equipamento", id] as const;

/**
 * Colunas que a LISTAGEM realmente usa. Mesma disciplina do inventário: a
 * listagem não puxa `select("*")` porque a tabela carrega valor de aquisição,
 * nota fiscal e observações que a lista nunca desenha.
 *
 * Tupla `as const` de propósito — `EquipamentoLista` sai daqui, então uma tela
 * que leia campo fora desta lista não compila. Sem isso, esquecer uma coluna
 * faria o campo virar `undefined` em silêncio, e um filtro que compara
 * `undefined` para de achar sem dar erro nenhum.
 */
export const COLUNAS_LISTA_EQUIP = [
  "id_equipamento",
  "nome",
  "tipo",
  "status",
  "id_unidade",
  // desenhados no card
  "fabricante",
  "modelo",
  "setor",
  "localizacao",
  "foto_url",
  "foto_thumb_path",
  // com quem está: a posse vem da retirada (`id_colaborador`, v166) e o nome
  // do colaborador chega pelo embed abaixo; `responsavel` é o texto livre do
  // cadastro e só aparece quando não há retirada em aberto
  "id_colaborador",
  "entregue_em",
  "responsavel",
  // usados só pela busca — invisíveis no card, mas a busca quebra sem eles
  "numero_serie",
  "numero_patrimonio",
  "codigo_interno",
  "tag",
  // ordenação
  "criado_em",
] as const;

/**
 * Nome de quem está com o item, pela FK `equipamentos_id_colaborador_fkey`.
 * Vem `null` quando o item está na base — e também quando a RLS de
 * `colaboradores_chabra` esconde a pessoa (colaborador de base que o usuário não
 * acessa); o card cai no texto livre nesse caso.
 */
const EMBED_COLABORADOR = "colaborador:colaboradores_chabra(nome)";

export type EquipamentoLista = Pick<Equipamento, (typeof COLUNAS_LISTA_EQUIP)[number]> & {
  colaborador: { nome: string } | null;
};

/** Lista enxuta, para a tela de visão geral. */
export function useEquipamentosLista() {
  return useQuery({
    queryKey: [...KEY_LISTA, "lista"] as const,
    // Mesma faixa do resto do projeto. Sem isto a lista é refeita a cada foco de
    // janela — foi o que pesava no inventário antes da Fase 1.
    staleTime: 60_000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("equipamentos")
        .select([...COLUNAS_LISTA_EQUIP, EMBED_COLABORADOR].join(","))
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as EquipamentoLista[];
    },
  });
}

/** Lista completa — usada pela exportação, que precisa das colunas de aquisição. */
export function useEquipamentosCompleto(habilitado = false) {
  return useQuery({
    queryKey: [...KEY_LISTA, "completo"] as const,
    enabled: habilitado,
    staleTime: 60_000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("equipamentos")
        .select("*")
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Equipamento[];
    },
  });
}

export function useEquipamento(id: string | null | undefined) {
  return useQuery({
    queryKey: KEY_ITEM(id),
    enabled: !!id,

    // Sem rede, insistir é perder tempo: o plano B está dentro da `queryFn`.
    retry: (falhas, erro) => !ehErroDeRede(erro) && falhas < 2,

    queryFn: async (): Promise<Equipamento | null> => {
      const idEq = id as string;
      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("equipamentos")
          .select("*")
          .eq("id_equipamento", idEq)
          .maybeSingle();
        if (error) throw error;
        const linha = (data ?? null) as unknown as Equipamento | null;
        // Mantém fresca só a cópia que a pessoa levou — ver `LevarParaCampo`.
        if (linha) {
          void lerDocumentoCache(idEq).then((ja) => {
            if (ja) void guardarDocumentoCache(idEq, linha);
          });
        }
        return linha;
      } catch (e) {
        // Recusa do banco continua sendo erro: cair no cache aqui esconderia o
        // problema e mostraria dado velho como se fosse o atual.
        if (!ehErroDeRede(e)) throw e;
        const guardado = await lerDocumentoCache<Equipamento>(idEq);
        if (guardado) return guardado.dados;
        throw e;
      }
    },
  });
}

/** O que o formulário preenche. `status` fica de fora de propósito: mudar
 *  situação passa pela RPC da v167, que exige motivo — a trava é do banco e
 *  recusa `update` direto, inclusive de admin. */
/**
 * O que o formulário de cadastro escreve.
 *
 * `id_colaborador` e `entregue_em` (posse, v166) ficam de fora junto com
 * `status`: nenhum dos três é campo de formulário. Posse muda por
 * `equipamento_registrar_entrega`/`_devolucao` e status por
 * `equipamento_mudar_status` — RPCs transacionais que também escrevem o
 * histórico. Deixar a posse editável na tela seria um caminho para o cadastro
 * dizer que o aparelho está com alguém sem que exista entrega nenhuma por trás.
 */
export type EquipamentoInput = Omit<
  Equipamento,
  | "id_equipamento"
  | "status"
  | "criado_por"
  | "criado_em"
  | "updated_at"
  | "id_inventario_origem"
  | "id_colaborador"
  | "entregue_em"
>;

/**
 * Traduz a recusa do índice `uniq_equipamentos_patrimonio` (v163).
 *
 * A tela já consulta antes de salvar para dar a mensagem amigável dizendo QUAL
 * equipamento usa o número — mas essa consulta passa pela RLS: um equipamento
 * numa base que a pessoa não acessa é invisível para ela, e aí só o índice pega.
 * Sem esta tradução o que chega é "Já existe um registro com esses dados" —
 * verdadeiro e inútil, porque não diz em qual campo.
 */
function erroDeEquipamento(e: unknown, fallback: string): string {
  const erro = e as { message?: string; details?: string };
  const cru = `${erro?.message ?? ""} ${erro?.details ?? ""}`;
  if (/uniq_equipamentos_patrimonio|numero_patrimonio/i.test(cru)) {
    return "Este número de patrimônio já está em uso por outro equipamento — possivelmente numa base que você não acessa.";
  }
  return mensagemErro(e, fallback);
}

export function useCriarEquipamento() {
  const qc = useQueryClient();
  const user = useUserStore((s) => s.user);

  return useMutation({
    mutationFn: async (params: {
      input: EquipamentoInput;
      /** ID pré-gerado para casar com o caminho da foto já enviada. */
      idEquipamento?: string;
      /** Arquivos que precisam chegar ao MinIO antes desta linha. */
      imagens?: ImagemPendente[];
    }): Promise<{ id_equipamento: string; destino: string }> => {
      const id_equipamento = params.idEquipamento ?? gerarId("EQP");
      const resultado = await gravar({
        tabela: "equipamentos",
        tipo: "insert",
        linhas: [
          {
            id_equipamento,
            ...params.input,
            criado_por: user?.email ?? null,
            criado_em: new Date().toISOString(),
          },
        ],
        filtro: null,
        modulo: "equipamentos",
        id_documento: id_equipamento,
        imagens: params.imagens,
      });
      return { id_equipamento, destino: resultado.destino };
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: KEY_LISTA });
      if (r.destino === "APARELHO") {
        toast.success("Equipamento guardado no aparelho", { icon: "📵" });
      }
    },
    onError: (e: Error) =>
      toast.error(erroDeEquipamento(e, "Não foi possível cadastrar o equipamento.")),
  });
}

export function useAtualizarEquipamento() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      id_equipamento: string;
      patch: Partial<EquipamentoInput>;
      /** Arquivos que precisam chegar ao MinIO antes desta linha. */
      imagens?: ImagemPendente[];
    }) => {
      const resultado = await gravar({
        tabela: "equipamentos",
        tipo: "update",
        linhas: { ...params.patch, updated_at: new Date().toISOString() },
        filtro: { id_equipamento: params.id_equipamento },
        modulo: "equipamentos",
        id_documento: params.id_equipamento,
        imagens: params.imagens,
      });
      return { ...params, resultado };
    },
    onSuccess: (params) => {
      qc.invalidateQueries({ queryKey: KEY_LISTA });
      qc.invalidateQueries({ queryKey: KEY_ITEM(params.id_equipamento) });
      if (params.resultado.destino === "APARELHO") {
        toast.success("Alteração guardada no aparelho", { icon: "📵" });
      }
    },
    onError: (e: Error) =>
      toast.error(erroDeEquipamento(e, "Não foi possível salvar as alterações.")),
  });
}

export function useExcluirEquipamento() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id_equipamento: string) => {
      // Vai para a lixeira, com retrato do registro. A foto no storage fica —
      // é o que permite a restauração reabrir a imagem.
      await excluirComLixeiraPorId({
        tabela: "equipamentos",
        chave: "id_equipamento",
        id: id_equipamento,
        modulo: "equipamentos",
        rotuloCol: "nome",
      });
      return id_equipamento;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY_LISTA }),
    onError: (e: Error) =>
      toast.error(mensagemErro(e, "Não foi possível excluir.")),
  });
}

/**
 * Teto do que aceitamos mandar para o MinIO QUANDO A REDUÇÃO NÃO ACONTECEU.
 *
 * Não é o teto do arquivo que a pessoa escolhe — esse é maior e mora no
 * formulário. Este existe só para o caso em que o navegador não soube desenhar
 * a imagem: sem ele, um arquivo de 30 MB iria inteiro para a rede e o
 * "Salvando…" voltaria a girar sem fim.
 */
export const LIMITE_ENVIO_BYTES = 10 * 1024 * 1024;

/** Caminho da miniatura. Derivado do id, nunca do nome do arquivo: a original
 *  pode ser .png, .jpeg ou .heic — a miniatura é SEMPRE .jpg. */
export const thumbPathEquipamento = (id_equipamento: string) =>
  `equipamentos/thumbs/${id_equipamento}.jpg`;

/**
 * Sobe a foto para o bucket `fotos` em `equipamentos/{id}.{ext}` e, junto, a
 * miniatura em `equipamentos/thumbs/{id}.jpg`.
 *
 * A ORIGINAL sobe PRIMEIRO; a miniatura é o passo opcional. Se o canvas falhar
 * (formato exótico, imagem corrompida, navegador antigo), a foto está salva do
 * mesmo jeito e `thumbPath` volta null. Ficar sem miniatura custa velocidade na
 * lista; perder a foto custaria o trabalho de campo.
 *
 * ⚠️ O prefixo é `equipamentos/`, diferente do inventário. As credenciais do
 * navegador têm escopo do bucket `fotos` inteiro, então isto não exige mexer na
 * permissão do MinIO — conferido em 2026-08-11. Os 99 itens migrados continuam
 * apontando para `inventario-maquinas/thumbs/`, e é por isso que
 * `foto_thumb_path` é lido da linha em vez de ser recalculado a partir do id.
 */
/**
 * DECIDE os caminhos e monta a URL, sem subir nada. Quem sobe é o `gravar()`,
 * junto da linha e na ordem certa.
 *
 * A miniatura continua sendo gerada aqui, no navegador — é canvas, funciona sem
 * rede, e adiar isso significaria guardar a foto original inteira só para
 * reduzir depois. Se o canvas falhar, `thumbPath` volta null e a lista fica sem
 * miniatura: perder velocidade custa menos que perder o trabalho de campo.
 *
 * Substituiu o `uploadFotoEquipamento`, que subia o arquivo no momento da
 * escolha. Aquele foi removido em vez de mantido ao lado: uma função que sobe
 * cedo demais, esquecida no arquivo, é convite para alguém usá-la sem perceber
 * que está contornando o offline.
 */
export async function prepararFotoEquipamento(
  id_equipamento: string,
  file: File
): Promise<{
  publicUrl: string;
  storagePath: string;
  thumbPath: string | null;
  imagens: { blob: Blob; caminho: string }[];
}> {
  const supabase = createSupabaseBrowserClient();

  // A FOTO NÃO SOBE MAIS COMO SAIU DO APARELHO.
  //
  // Celular de hoje produz 8, 12, às vezes 20 MB por foto. Isso subindo pela
  // rede de dados é o que deixava o botão "Salvando…" girando por minutos — e
  // era também o que o teto de 10 MB do formulário recusava de saída, mandando
  // "tire uma foto menor". Daí a impressão de que o painel só aceitava foto
  // tirada por ele mesmo: a da câmera do site passava no teto, a da galeria não.
  //
  // É a mesma decisão já tomada na Frota (`lib/frota/fotos.ts`), pelo mesmo
  // motivo escrito lá. O que muda é o tamanho: 2048 px em vez dos 1600 da vista,
  // porque aqui a foto costuma ter a plaqueta do patrimônio dentro dela.
  const reduzida = await reduzirParaEnvio(file);
  const paraEnviar: Blob = reduzida ?? file;

  // Não reduziu = o navegador não decodificou o arquivo. Seguir com o original é
  // o certo em quase todo caso, MENOS nestes dois — em que guardar seria guardar
  // algo que ninguém vai conseguir abrir, ou que não vai terminar de subir.
  if (!reduzida) {
    if (/heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name)) {
      throw new Error(
        "Esta foto está em HEIC, formato que o navegador não abre — ela subiria e depois apareceria em branco. " +
          "No iPhone: Ajustes › Câmera › Formatos › Mais Compatível. Ou tire a foto pelo próprio painel."
      );
    }
    if (paraEnviar.size > LIMITE_ENVIO_BYTES) {
      throw new Error(
        "Não consegui reduzir esta imagem e ela é grande demais para enviar. " +
          "Envie um JPG ou PNG, ou tire a foto pelo próprio painel."
      );
    }
  }

  // Reduziu = o que sobe é JPEG, então a extensão é .jpg. O nome do arquivo de
  // origem não diz mais nada sobre o conteúdo; mantê-lo faria um .png reduzido
  // subir com a extensão mentindo sobre o formato.
  const ext = reduzida ? "jpg" : (file.name.split(".").pop() ?? "jpg").toLowerCase();
  const storagePath = `equipamentos/${id_equipamento}.${ext}`;
  const imagens: { blob: Blob; caminho: string }[] = [
    { blob: paraEnviar, caminho: storagePath },
  ];

  // A miniatura sai da REDUZIDA, e não da original: são dois desenhos em canvas,
  // e decodificar 20 MB duas vezes é o tipo de coisa que derruba o navegador de
  // um celular mais simples. Visualmente dá no mesmo — 320 px saindo de 2048 px
  // não tem perda que o olho pegue.
  let thumbPath: string | null = null;
  const miniatura = await gerarMiniatura(paraEnviar);
  if (miniatura) {
    thumbPath = thumbPathEquipamento(id_equipamento);
    imagens.push({ blob: miniatura, caminho: thumbPath });
  }

  const { data: pub } = supabase.storage.from("fotos").getPublicUrl(storagePath);
  return { publicUrl: pub.publicUrl, storagePath, thumbPath, imagens };
}

/** Remove foto e miniatura do storage sem mexer na linha. Usado quando a pessoa
 *  troca a foto: sem levar a miniatura junto, a lista continuaria desenhando a
 *  imagem antiga. */
export async function removerFotoEquipamentoStorage(
  storagePath: string,
  id_equipamento?: string
) {
  const supabase = createSupabaseBrowserClient();
  const alvos = [storagePath];
  if (id_equipamento) alvos.push(thumbPathEquipamento(id_equipamento));
  const { error } = await supabase.storage.from("fotos").remove(alvos);
  if (error) console.warn("Foto não removida do storage:", error.message);
}
