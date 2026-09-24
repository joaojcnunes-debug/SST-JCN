"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { mensagemErro } from "@/lib/errors";
import { excluirComLixeiraPorId } from "@/lib/hooks/useLixeira";
import { useUserStore } from "@/lib/store";
import { gerarMiniatura } from "@/lib/imagem/redimensionar";
import { gerarId } from "@/lib/utils";
import { gravar, type ImagemPendente } from "@/lib/offline/gravar";
import { guardarDocumentoCache, lerDocumentoCache } from "@/lib/offline/operacoes";
import { ehErroDeRede } from "@/lib/offline/rede";
import type {
  Maquina,
  StatusMaquina,
  GrauRiscoMaquina,
  CategoriaInventario,
  InspecaoMaquina,
} from "@/lib/supabase/types";

const KEY_LISTA = (vinculos: string[] | null) =>
  ["inventario-maquinas", vinculos] as const;
const KEY_ITEM = (id: string | null | undefined) =>
  ["inventario-maquina", id] as const;

/**
 * Carrega máquinas do inventário respeitando filtro por empresas
 * vinculadas pra perfil Técnico. Máquinas sem `id_empresa` (patrimônio
 * interno da JCN Consultoria) aparecem pra todos.
 */
async function fetchLista(empresasVinculadas: string[] | null) {
  const supabase = createSupabaseBrowserClient();
  let q = supabase
    .from("inventario_maquinas")
    .select("*")
    .order("created_at", { ascending: false });
  if (empresasVinculadas && empresasVinculadas.length > 0) {
    q = q.or(
      `id_empresa.in.(${empresasVinculadas.join(",")}),id_empresa.is.null`
    );
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as Maquina[];
}

function vinculosDoUsuario(user: ReturnType<typeof useUserStore.getState>["user"]) {
  return user?.perfil === "Tecnico" &&
    user.empresas_vinculadas &&
    user.empresas_vinculadas.length > 0
    ? user.empresas_vinculadas
    : null;
}

export function useInventarioMaquinas() {
  const user = useUserStore((s) => s.user);
  const vinculos = vinculosDoUsuario(user);

  return useQuery({
    queryKey: KEY_LISTA(vinculos),
    queryFn: () => fetchLista(vinculos),
    // Sem isto a lista inteira era refeita a cada foco de janela — trocar de aba
    // e voltar recarregava as 136 linhas e todas as imagens. 60s é a faixa que o
    // resto do projeto usa (30s a 5min, ex.: useAcaoCatalogo).
    staleTime: 60_000,
  });
}

// As listagens de card (`useInventarioMaquinasLista`, `COLUNAS_LISTA`) e a
// exportação em XLSX (`useInventarioParaExport`) saíram em 2026-09-14 junto com
// o módulo /inventario-maquinas. O que fica aqui serve à Relação de Máquinas
// (Apreciação), à importação a partir da inspeção e ao vínculo legado do laudo.

export function useMaquina(id: string | null | undefined) {
  return useQuery({
    queryKey: KEY_ITEM(id),
    enabled: !!id,

    // Sem rede, insistir é perder tempo: o plano B está dentro da `queryFn`.
    retry: (falhas, erro) => !ehErroDeRede(erro) && falhas < 2,

    queryFn: async (): Promise<Maquina> => {
      const idMaq = id!;
      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("inventario_maquinas")
          .select("*")
          .eq("id_maquina", idMaq)
          .single();
        if (error) throw error;
        const linha = data as unknown as Maquina;
        // Mantém fresca só a cópia que o técnico levou — ver `LevarParaCampo`.
        void lerDocumentoCache(idMaq).then((ja) => {
          if (ja) void guardarDocumentoCache(idMaq, linha);
        });
        return linha;
      } catch (e) {
        // Recusa do banco e máquina inexistente continuam sendo erro.
        if (!ehErroDeRede(e)) throw e;
        const guardado = await lerDocumentoCache<Maquina>(idMaq);
        if (guardado) return guardado.dados;
        throw e;
      }
    },
  });
}

export interface MaquinaInput {
  id_empresa: string | null;
  // Identificação
  nome: string;
  tipo: string | null;
  categoria: string | null;
  categoria_inventario: CategoriaInventario | null;
  codigo_interno: string | null;
  tag: string | null;
  marca: string | null;
  modelo: string | null;
  numero_serie: string | null;
  ano_fabricacao: number | null;
  numero_patrimonio: string | null;
  status: StatusMaquina;
  // Localização
  id_unidade: string | null;   // base/unidade (FK unidades) — controla o isolamento e a transferência
  unidade: string | null;      // espelho em texto do nome da unidade (legado/exibição)
  setor: string | null;
  linha_processo: string | null;
  area: string | null;
  responsavel_setor: string | null;
  operacao_executada: string | null;
  operadores: string | null;
  localizacao: string | null;
  // Capacidade
  capacidade_operacional: string | null;
  producao_estimada: string | null;
  potencia: string | null;
  tensao: string | null;
  pressao: string | null;
  capacidade_carga: string | null;
  velocidade: string | null;
  dimensoes: string | null;
  finalidade: string | null;
  descricao_tecnica: string | null;
  // Segurança
  protecao_fixa: boolean | null;
  descricao_protecao_fixa: string | null;
  protecao_movel: boolean | null;
  descricao_protecao_movel: string | null;
  dispositivos_seguranca: string | null;
  intertravamento: boolean | null;
  botao_emergencia: boolean | null;
  sistema_bloqueio: boolean | null;
  possui_manual: boolean | null;
  possui_diagrama_eletrico: boolean | null;
  aterramento: boolean | null;
  sinalizacao: boolean | null;
  necessita_adequacao_nr12: boolean | null;
  grau_risco: GrauRiscoMaquina | null;
  observacoes_tecnicas: string | null;
  // Meta
  observacoes: string | null;
  foto_url: string | null;
  foto_storage_path: string | null;
  /** Miniatura (~320px) usada na LISTAGEM. A original fica em foto_storage_path
   *  e só é buscada quando o item é aberto. v173. */
  foto_thumb_path: string | null;
}

export function useCriarMaquina() {
  const qc = useQueryClient();
  const user = useUserStore((s) => s.user);

  return useMutation({
    mutationFn: async (params: {
      input: MaquinaInput;
      /** ID pré-gerado pra alinhar com o storage path da foto já enviada.
       *  Quando omitido, gera um novo. */
      idMaquina?: string;
      /** Arquivos que precisam chegar ao MinIO antes desta linha. */
      imagens?: ImagemPendente[];
    }): Promise<Maquina & { __destino: string }> => {
      const id_maquina = params.idMaquina ?? gerarId("MAQ");
      const row: Maquina = {
        id_maquina,
        id_inspecao: null,
        id_maquina_inspecao: null,
        ...params.input,
        usuario_email: user?.email ?? null,
        usuario_nome: user?.nome ?? null,
        created_at: new Date().toISOString(),
        updated_at: null,
      };
      const resultado = await gravar({
        tabela: "inventario_maquinas",
        tipo: "insert",
        linhas: [row as unknown as Record<string, unknown>],
        filtro: null,
        modulo: "inventario-maquinas",
        id_documento: id_maquina,
        imagens: params.imagens,
      });
      return { ...row, __destino: resultado.destino };
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["inventario-maquinas"] });
      if (row.__destino === "APARELHO") {
        toast.success("Máquina guardada no aparelho", { icon: "📵" });
      }
    },
    onError: (e: Error) =>
      toast.error(mensagemErro(e, "Não foi possível cadastrar.")),
  });
}

export function useAtualizarMaquina() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      id_maquina: string;
      patch: Partial<MaquinaInput>;
      /** Arquivos que precisam chegar ao MinIO antes desta linha. */
      imagens?: ImagemPendente[];
    }) => {
      const resultado = await gravar({
        tabela: "inventario_maquinas",
        tipo: "update",
        linhas: { ...params.patch, updated_at: new Date().toISOString() },
        filtro: { id_maquina: params.id_maquina },
        modulo: "inventario-maquinas",
        id_documento: params.id_maquina,
        imagens: params.imagens,
      });
      return { ...params, resultado };
    },
    onSuccess: (params) => {
      qc.invalidateQueries({ queryKey: ["inventario-maquinas"] });
      qc.invalidateQueries({ queryKey: KEY_ITEM(params.id_maquina) });
      if (params.resultado.destino === "APARELHO") {
        toast.success("Alteração guardada no aparelho", { icon: "📵" });
      }
    },
    onError: (e: Error) =>
      toast.error(mensagemErro(e, "Não foi possível salvar as alterações.")),
  });
}

export function useExcluirMaquina() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id_maquina: string) => {
      // Vai para a lixeira (snapshot + auditoria). A foto no storage é mantida
      // para que a restauração reabra a imagem.
      await excluirComLixeiraPorId({
        tabela: "inventario_maquinas",
        chave: "id_maquina",
        id: id_maquina,
        modulo: "inventario_maquinas",
        rotuloCol: "descricao",
      });
      return id_maquina;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventario-maquinas"] });
    },
    onError: (e: Error) =>
      toast.error(mensagemErro(e, "Não foi possível excluir.")),
  });
}

/** Caminho da miniatura de um item. Derivado do id, nunca do nome do arquivo:
 *  a original pode ser .png, .jpeg, .heic — a miniatura é SEMPRE .jpg. */
export const thumbPathMaquina = (id_maquina: string) =>
  `inventario-maquinas/thumbs/${id_maquina}.jpg`;

/**
 * DECIDE os caminhos e monta a URL,
 * sem subir nada. Quem sobe é o `gravar()`, junto da linha e na ordem certa.
 *
 * A miniatura continua sendo gerada aqui — é canvas, funciona sem rede, e adiar
 * significaria guardar a foto original inteira só para reduzir depois. Se o
 * canvas falhar, `thumbPath` volta null: ficar sem miniatura custa velocidade na
 * lista, perder a foto custaria o trabalho de campo.
 */
export async function prepararFotoMaquina(
  id_maquina: string,
  file: File
): Promise<{
  publicUrl: string;
  storagePath: string;
  thumbPath: string | null;
  imagens: { blob: Blob; caminho: string }[];
}> {
  const supabase = createSupabaseBrowserClient();
  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
  const storagePath = `inventario-maquinas/${id_maquina}.${ext}`;
  const imagens: { blob: Blob; caminho: string }[] = [
    { blob: file, caminho: storagePath },
  ];

  let thumbPath: string | null = null;
  const miniatura = await gerarMiniatura(file);
  if (miniatura) {
    thumbPath = thumbPathMaquina(id_maquina);
    imagens.push({ blob: miniatura, caminho: thumbPath });
  }

  const { data: pub } = supabase.storage.from("fotos").getPublicUrl(storagePath);
  return { publicUrl: pub.publicUrl, storagePath, thumbPath, imagens };
}


/** Remove a foto do storage sem mexer na linha. Útil quando o usuário troca a foto.
 *  Leva a miniatura junto quando o `id_maquina` é informado — senão ela ficaria
 *  órfã no bucket e, pior, a lista continuaria desenhando a foto antiga. */
export async function removerFotoMaquinaStorage(
  storagePath: string,
  id_maquina?: string
) {
  const supabase = createSupabaseBrowserClient();
  const alvos = [storagePath];
  if (id_maquina) alvos.push(thumbPathMaquina(id_maquina));
  await supabase.storage.from("fotos").remove(alvos);
}

// ═════════════════════════════════════════════════════════════════════════════
// Importação de máquinas registradas em INSPEÇÕES (v66)
//
// Máquinas da aba "Máquinas/NR-12" de uma inspeção (inspecao_maquinas) podem
// ser importadas pro inventário, ficando disponíveis pra Apreciação NR-12.
// Dedupe: id_maquina_inspecao (marcador de origem) → numero_serie na mesma
// empresa → nome+setor na mesma inspeção (regra NR-12 do prompt).
// ═════════════════════════════════════════════════════════════════════════════

/** Chaves de dedupe compartilhadas entre pendentes e importação — os dois
 *  lados PRECISAM usar exatamente as mesmas regras, senão uma máquina
 *  bloqueada na importação fica "pendente" pra sempre. */
/** Preenchimentos que o técnico usa em campo para dizer "não tem/não achei".
 *  Não são número de série e não podem valer como chave de duplicata. */
const SERIE_VAZIA = new Set([
  "", "na", "nd", "ni", "sn", "semnumero", "semserie", "seminformacao",
  "naoinformado", "naoinformada", "naoidentificado", "naoidentificada",
  "naolocalizado", "naolocalizada", "naoconsta", "naoaplicavel", "ilegivel",
]);

/** Chave de dedupe por nº de série. Devolve null quando não há série de fato.
 *  Antes, `-` (e afins) contava como série real: bastava UMA máquina sem série
 *  no inventário para TODAS as outras sem série da mesma empresa serem tidas
 *  como duplicadas, e a importação de inspeção travava inteira sem explicação. */
const chaveSerie = (emp: string | null, serie: string | null | undefined) => {
  const bruta = serie?.trim().toLowerCase() ?? "";
  const normalizada = bruta
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
  if (SERIE_VAZIA.has(normalizada)) return null;
  return `${emp ?? ""}::${bruta}`;
};
const chaveNome = (
  emp: string | null,
  nome: string,
  setor: string | null,
  insp: string | null
) =>
  `${emp ?? ""}::${nome.trim().toLowerCase()}::${(setor ?? "")
    .trim()
    .toLowerCase()}::${insp ?? ""}`;

interface InventarioDedupeRow {
  id_maquina_inspecao: string | null;
  numero_serie: string | null;
  nome: string;
  setor: string | null;
  id_inspecao: string | null;
  id_empresa: string | null;
}

function montarSetsDedupe(inventario: InventarioDedupeRow[]) {
  return {
    jaImportadas: new Set(
      inventario.map((r) => r.id_maquina_inspecao).filter(Boolean) as string[]
    ),
    seriesExistentes: new Set(
      inventario
        .map((r) => chaveSerie(r.id_empresa, r.numero_serie))
        .filter(Boolean) as string[]
    ),
    nomesExistentes: new Set(
      inventario.map((r) =>
        chaveNome(r.id_empresa, r.nome, r.setor, r.id_inspecao)
      )
    ),
  };
}

/** Resolve id_setor → nome (setores.setor_ghe) pras máquinas de inspeção. */
async function resolverSetores(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  maquinas: InspecaoMaquina[]
) {
  const idsSetor = Array.from(
    new Set(maquinas.map((m) => m.id_setor).filter(Boolean))
  ) as string[];
  const setorNome = new Map<string, string>();
  if (idsSetor.length > 0) {
    const { data } = await supabase
      .from("setores")
      .select("id_setor, setor_ghe")
      .in("id_setor", idsSetor);
    (data as { id_setor: string; setor_ghe: string }[] | null)?.forEach((s) =>
      setorNome.set(s.id_setor, s.setor_ghe)
    );
  }
  return setorNome;
}

/**
 * Máquinas de inspeções da empresa que ainda NÃO foram importadas pro
 * inventário. Alimenta o banner da nova apreciação e o modal de importação.
 * Ignora inspeções soft-deletadas e aplica as MESMAS regras de dedupe da
 * importação (id origem → nº de série → nome+setor+inspeção).
 */
export function useMaquinasInspecaoPendentes(idEmpresa: string | null | undefined) {
  return useQuery({
    queryKey: ["inspecao-maquinas-pendentes", idEmpresa],
    enabled: !!idEmpresa,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const [maqRes, invRes, inspRes] = await Promise.all([
        supabase
          .from("inspecao_maquinas")
          .select("*")
          .eq("id_empresa", idEmpresa!)
          .order("created_at", { ascending: false }),
        supabase
          .from("inventario_maquinas")
          .select("id_maquina_inspecao, numero_serie, nome, setor, id_inspecao, id_empresa")
          .eq("id_empresa", idEmpresa!),
        supabase
          .from("inspecoes")
          .select("id_inspecao")
          .eq("id_empresa", idEmpresa!)
          .neq("status", "DELETADA"),
      ]);
      if (maqRes.error) throw maqRes.error;
      if (invRes.error) throw invRes.error;
      if (inspRes.error) throw inspRes.error;

      const inspecoesValidas = new Set(
        ((inspRes.data ?? []) as { id_inspecao: string }[]).map(
          (r) => r.id_inspecao
        )
      );
      const todas = (
        (maqRes.data ?? []) as unknown as InspecaoMaquina[]
      ).filter((m) => inspecoesValidas.has(m.id_inspecao));

      const { jaImportadas, seriesExistentes, nomesExistentes } =
        montarSetsDedupe((invRes.data ?? []) as InventarioDedupeRow[]);
      const setorNome = await resolverSetores(supabase, todas);

      const pendentes = todas.filter((m) => {
        if (jaImportadas.has(m.id_maquina_inspecao)) return false;
        const kSerie = chaveSerie(m.id_empresa, m.numero_serie);
        if (kSerie && seriesExistentes.has(kSerie)) return false;
        const setor = m.id_setor ? setorNome.get(m.id_setor) ?? null : null;
        const kNome = chaveNome(m.id_empresa, m.nome, setor, m.id_inspecao);
        if (nomesExistentes.has(kNome)) return false;
        // dedupe intra-lote: duas idênticas na mesma inspeção contam como 1
        if (kSerie) seriesExistentes.add(kSerie);
        nomesExistentes.add(kNome);
        return true;
      });
      return { todas, pendentes, importadas: jaImportadas };
    },
  });
}

export interface ResultadoImportacaoMaquinas {
  criadas: number;
  ignoradas: number;
}

/**
 * Importa máquinas de inspeção pro inventário. Idempotente: re-verifica o
 * dedupe no banco na hora do insert (id_maquina_inspecao + numero_serie +
 * nome/setor/inspeção), então pode receber a lista completa sem duplicar.
 * A 1ª foto da máquina é COPIADA no storage (não compartilhada), pra exclusão
 * no inventário nunca apagar a foto original da inspeção.
 */
export function useImportarMaquinasInspecao() {
  const qc = useQueryClient();
  const user = useUserStore((s) => s.user);

  return useMutation({
    mutationFn: async (
      maquinasInspecao: InspecaoMaquina[]
    ): Promise<ResultadoImportacaoMaquinas> => {
      const supabase = createSupabaseBrowserClient();
      if (maquinasInspecao.length === 0) return { criadas: 0, ignoradas: 0 };

      // ── Relê as máquinas FRESCAS do banco (o caller pode estar com cache
      //    stale de até 5min: máquina deletada/editada na inspeção, ou
      //    inspeção soft-deletada nesse meio-tempo) ────────────────────────
      const idsOrigem = maquinasInspecao.map((m) => m.id_maquina_inspecao);
      const { data: frescasData, error: frescasErr } = await supabase
        .from("inspecao_maquinas")
        .select("*")
        .in("id_maquina_inspecao", idsOrigem);
      if (frescasErr) throw frescasErr;
      let frescas = (frescasData ?? []) as unknown as InspecaoMaquina[];

      const idsInspecao = Array.from(
        new Set(frescas.map((m) => m.id_inspecao).filter(Boolean))
      ) as string[];
      if (idsInspecao.length > 0) {
        const { data: inspData } = await supabase
          .from("inspecoes")
          .select("id_inspecao")
          .in("id_inspecao", idsInspecao)
          .neq("status", "DELETADA");
        const validas = new Set(
          ((inspData ?? []) as { id_inspecao: string }[]).map((r) => r.id_inspecao)
        );
        frescas = frescas.filter((m) => validas.has(m.id_inspecao));
      }
      // deletadas/inválidas no meio do caminho contam como ignoradas
      let ignoradas = maquinasInspecao.length - frescas.length;

      const setorNome = await resolverSetores(supabase, frescas);

      // ── Dedupe contra o inventário atual das empresas envolvidas ──────────
      const idsEmpresa = Array.from(
        new Set(frescas.map((m) => m.id_empresa).filter(Boolean))
      ) as string[];
      let invQ = supabase
        .from("inventario_maquinas")
        .select("id_maquina_inspecao, numero_serie, nome, setor, id_inspecao, id_empresa");
      if (idsEmpresa.length > 0) invQ = invQ.in("id_empresa", idsEmpresa);
      const { data: invData, error: invErr } = await invQ;
      if (invErr) throw invErr;
      const { jaImportadas, seriesExistentes, nomesExistentes } =
        montarSetsDedupe((invData ?? []) as InventarioDedupeRow[]);

      let criadas = 0;

      for (const m of frescas) {
        const setor = m.id_setor ? setorNome.get(m.id_setor) ?? null : null;
        const kSerie = chaveSerie(m.id_empresa, m.numero_serie);
        const kNome = chaveNome(m.id_empresa, m.nome, setor, m.id_inspecao);
        if (
          jaImportadas.has(m.id_maquina_inspecao) ||
          (kSerie && seriesExistentes.has(kSerie)) ||
          nomesExistentes.has(kNome)
        ) {
          ignoradas++;
          continue;
        }

        const id_maquina = gerarId("MAQ");

        // Copia a 1ª foto no storage — best-effort, importação não falha por foto.
        let foto_url: string | null = null;
        let foto_storage_path: string | null = null;
        const srcPath = m.foto_storage_paths?.[0];
        if (srcPath) {
          const ext = (srcPath.split(".").pop() ?? "jpg").toLowerCase();
          const destPath = `inventario-maquinas/${id_maquina}.${ext}`;
          const { error: copyErr } = await supabase.storage
            .from("fotos")
            .copy(srcPath, destPath);
          if (!copyErr) {
            const { data: pub } = supabase.storage
              .from("fotos")
              .getPublicUrl(destPath);
            foto_url = pub.publicUrl;
            foto_storage_path = destPath;
          }
        }

        const row: Maquina = {
          id_maquina,
          id_empresa: m.id_empresa,
          id_inspecao: m.id_inspecao,
          id_maquina_inspecao: m.id_maquina_inspecao,
          nome: m.nome,
          tipo: m.tipo,
          categoria: null,
          // Máquinas importadas de inspeções são de clientes.
          categoria_inventario: "maquinas",
          codigo_interno: null,
          tag: m.tag,
          marca: m.marca,
          modelo: m.modelo,
          numero_serie: m.numero_serie,
          ano_fabricacao: m.ano_fabricacao,
          numero_patrimonio: null,
          status: "OPERANTE",
          id_unidade: null,
          unidade: null,
          setor,
          linha_processo: null,
          area: null,
          responsavel_setor: null,
          operacao_executada: null,
          operadores: null,
          localizacao: null,
          capacidade_operacional: null,
          producao_estimada: null,
          potencia: m.potencia,
          tensao: m.tensao,
          pressao: null,
          capacidade_carga: null,
          velocidade: null,
          dimensoes: null,
          finalidade: null,
          descricao_tecnica: null,
          protecao_fixa: m.protecao_fixa,
          descricao_protecao_fixa: null,
          protecao_movel: m.protecao_movel,
          descricao_protecao_movel: null,
          dispositivos_seguranca: null,
          intertravamento: m.intertravamento,
          botao_emergencia: m.botao_emergencia,
          sistema_bloqueio: m.sistema_bloqueio,
          possui_manual: m.possui_manual,
          possui_diagrama_eletrico: null,
          aterramento: m.aterramento,
          sinalizacao: m.sinalizacao,
          necessita_adequacao_nr12: m.necessita_adequacao_nr12,
          grau_risco: m.grau_risco,
          observacoes_tecnicas: null,
          observacoes: m.observacoes,
          foto_url,
          foto_storage_path,
          // A foto vem COPIADA da inspeção, não passa por upload no navegador —
          // então não há canvas aqui para gerar a miniatura. Fica null e a lista
          // cai na original; o mutirão da v173 alcança estes itens depois.
          foto_thumb_path: null,
          usuario_email: user?.email ?? null,
          usuario_nome: user?.nome ?? null,
          created_at: new Date().toISOString(),
          updated_at: null,
        };

        const { error } = await supabase
          .from("inventario_maquinas")
          .insert(row as never);
        if (error) {
          // unique violation = outra aba/usuário importou a mesma máquina
          // em paralelo (índice único da v69) — trata como já existente
          if ((error as { code?: string }).code === "23505") {
            if (foto_storage_path) {
              await supabase.storage.from("fotos").remove([foto_storage_path]);
            }
            ignoradas++;
            continue;
          }
          throw error;
        }

        // marca como existente pra dedupe dentro do próprio lote
        jaImportadas.add(m.id_maquina_inspecao);
        if (kSerie) seriesExistentes.add(kSerie);
        nomesExistentes.add(kNome);
        criadas++;
      }

      return { criadas, ignoradas };
    },
    // onSettled (não onSuccess): numa falha parcial as linhas já inseridas
    // precisam aparecer na UI e sair do banner de pendentes
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["inventario-maquinas"] });
      qc.invalidateQueries({ queryKey: ["inspecao-maquinas-pendentes"] });
    },
    onError: (e: Error) =>
      toast.error(mensagemErro(e, "Não foi possível importar as máquinas.")),
  });
}
