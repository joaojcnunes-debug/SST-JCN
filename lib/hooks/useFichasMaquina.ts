"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { gravar } from "@/lib/offline/gravar";
import { gerarId } from "@/lib/utils";
import { CATALOGO_NR12 } from "@/lib/apreciacao-maquinas/catalogo-nr12";
import type { FichaMaquina, OperadorFicha } from "@/lib/supabase/types";

/**
 * Fichas de máquina de um laudo (v148). Um laudo cobre N máquinas; cada ficha
 * carrega o snapshot da máquina, seus riscos HRN e seu checklist NR-12.
 */

const KEY = (idApreciacao: string | null | undefined) =>
  ["fichas-maquina", idApreciacao] as const;

/** Teto de fotos por máquina — o PDF imprime a ficha em uma página. */
export const MAX_FOTOS_FICHA = 6;

export function useFichasMaquina(idApreciacao: string | null | undefined) {
  return useQuery({
    queryKey: KEY(idApreciacao),
    enabled: !!idApreciacao,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("apreciacao_fichas_maquina")
        .select("*")
        .eq("id_apreciacao", idApreciacao!)
        .order("numero_ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as FichaMaquina[];
    },
  });
}

export interface FichaMaquinaInput {
  maquina_descricao?: string | null;
  equipamento?: string | null;
  tipo?: string | null;
  modelo?: string | null;
  fabricante?: string | null;
  serie?: string | null;
  ano?: string | null;
  capacidade?: string | null;
  setor?: string | null;
  id_maquina?: string | null;
  componentes_maquina?: string[] | null;
  limite_uso?: string | null;
  limite_espaco?: string | null;
  limite_tempo?: string | null;
  limite_produtividade?: string | null;
  npe?: string | null;
  sistemas_atual?: string[] | null;
  sistemas_necessario?: string[] | null;
  constatacoes_inspecao?: string | null;
  parecer_tecnico?: string | null;
  operadores?: OperadorFicha[] | null;
  prioridade_manual?: boolean;
  foto_urls?: string[];
  foto_storage_paths?: string[];
}

/**
 * Snapshot do checklist NR-12 para uma ficha recém-criada. É cópia de propósito:
 * mudar o catálogo depois NÃO altera laudo já emitido.
 */
async function snapshotChecklist(
  idApreciacao: string,
  idFicha: string,
  dependeDe?: string[],
) {
  const linhas = CATALOGO_NR12.map((item, i) => ({
    id_item: gerarId("APRI"),
    id_apreciacao: idApreciacao,
    id_ficha: idFicha,
    item_codigo: item.codigo,
    item_categoria: item.categoria,
    item_titulo: item.titulo,
    item_descricao: item.descricao ?? null,
    item_origem: "CATALOGO",
    situacao: "PENDENTE",
    ordem: i,
    foto_urls: [],
    foto_storage_paths: [],
    foto_legendas: [],
  }));
  // Os itens dependem da ficha: a FK aponta para ela, e mandar os 38 itens
  // primeiro faria o banco recusar um checklist perfeitamente correto.
  await gravar({
    tabela: "apreciacoes_maquinas_itens",
    tipo: "insert",
    linhas,
    filtro: null,
    modulo: "apreciacao-maquinas",
    id_documento: idApreciacao,
    depende_de: dependeDe,
  });
  return linhas;
}

export function useCriarFicha(idApreciacao: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: FichaMaquinaInput): Promise<FichaMaquina> => {
      /**
       * `numero_ordem` sai do que a TELA já tem, e não de uma consulta ao banco.
       *
       * A consulta anterior (`order desc limit 1`) não existe sem rede, e é
       * dispensável: a lista de fichas já está carregada — é ela que o técnico
       * está vendo. Com rede o resultado é o mesmo; sem rede continua havendo
       * um número, em vez de a máquina não poder ser cadastrada.
       */
      const jaNaTela = qc.getQueryData<FichaMaquina[]>(KEY(idApreciacao)) ?? [];
      const ultimo = jaNaTela.reduce((max, f) => Math.max(max, f.numero_ordem ?? 0), 0);

      const row = {
        id_ficha: gerarId("APF"),
        id_apreciacao: idApreciacao,
        numero_ordem: ultimo + 1,
        prioridade_manual: false,
        foto_urls: [],
        foto_storage_paths: [],
        ...input,
      };
      const resultado = await gravar({
        tabela: "apreciacao_fichas_maquina",
        tipo: "insert",
        linhas: [row],
        filtro: null,
        modulo: "apreciacao-maquinas",
        id_documento: idApreciacao,
      });

      await snapshotChecklist(
        idApreciacao,
        row.id_ficha,
        resultado.destino === "APARELHO" ? [resultado.idOperacao] : undefined,
      );

      return { ...row, __destino: resultado.destino } as unknown as FichaMaquina;
    },
    onSuccess: (ficha) => {
      const destino = (ficha as unknown as { __destino?: string }).__destino;
      if (destino === "APARELHO") {
        // Sem rede não há o que revalidar: a máquina entra na lista à mão,
        // senão o técnico a cadastraria e ela não apareceria para ser
        // preenchida.
        qc.setQueryData<FichaMaquina[]>(KEY(idApreciacao), (antigo) => [
          ...(antigo ?? []),
          ficha,
        ]);
        toast.success("Máquina guardada no aparelho", { icon: "📵" });
        return;
      }
      qc.invalidateQueries({ queryKey: KEY(idApreciacao) });
      qc.invalidateQueries({ queryKey: ["apreciacao-maquina", idApreciacao] });
    },
    onError: (e: Error) => toast.error(`Erro ao adicionar máquina: ${e.message}`),
  });
}

export function useAtualizarFicha(idApreciacao: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id_ficha: string } & FichaMaquinaInput) => {
      const { id_ficha, ...patch } = params;
      const completo = { ...patch, updated_at: new Date().toISOString() };
      const resultado = await gravar({
        tabela: "apreciacao_fichas_maquina",
        tipo: "update",
        linhas: completo,
        filtro: { id_ficha },
        modulo: "apreciacao-maquinas",
        id_documento: idApreciacao,
      });
      return { id_ficha, patch: completo, resultado };
    },
    onSuccess: ({ id_ficha, patch, resultado }) => {
      if (resultado.destino === "SERVIDOR") {
        qc.invalidateQueries({ queryKey: KEY(idApreciacao) });
        return;
      }
      // Sem rede não há o que revalidar: mescla o patch sobre a ficha na tela.
      qc.setQueryData<FichaMaquina[]>(KEY(idApreciacao), (antigo) =>
        (antigo ?? []).map((f) =>
          f.id_ficha === id_ficha ? ({ ...f, ...patch } as FichaMaquina) : f,
        ),
      );
    },
    onError: (e: Error) => toast.error(`Erro ao salvar máquina: ${e.message}`),
  });
}

export function useExcluirFicha(idApreciacao: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ficha: FichaMaquina) => {
      // Limpa as fotos do bucket antes — a linha some por cascata e levaria
      // junto a referência, deixando arquivo órfão no Storage. Só com rede:
      // sem ela o órfão acontece de qualquer jeito, e travar a exclusão por
      // causa disso seria pior.
      if (ficha.foto_storage_paths?.length && navigator.onLine) {
        try {
          const supabase = createSupabaseBrowserClient();
          await supabase.storage.from("fotos").remove(ficha.foto_storage_paths);
        } catch {
          /* silencioso de propósito */
        }
      }
      const resultado = await gravar({
        tabela: "apreciacao_fichas_maquina",
        tipo: "delete",
        linhas: null,
        filtro: { id_ficha: ficha.id_ficha },
        modulo: "apreciacao-maquinas",
        id_documento: idApreciacao,
      });
      return { id_ficha: ficha.id_ficha, resultado };
    },
    onSuccess: ({ id_ficha, resultado }) => {
      if (resultado.destino === "SERVIDOR") {
        qc.invalidateQueries({ queryKey: KEY(idApreciacao) });
        qc.invalidateQueries({ queryKey: ["apreciacao-maquina", idApreciacao] });
        return;
      }
      qc.setQueryData<FichaMaquina[]>(KEY(idApreciacao), (antigo) =>
        (antigo ?? []).filter((f) => f.id_ficha !== id_ficha),
      );
      toast.success("Remoção guardada no aparelho", { icon: "📵" });
    },
    onError: (e: Error) => toast.error(`Erro ao remover máquina: ${e.message}`),
  });
}

/** Recebe os ids na ordem desejada e regrava `numero_ordem`. */
export function useReordenarFichas(idApreciacao: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (idsNaOrdem: string[]) => {
      // Uma operação por ficha, sem dependência entre elas: são linhas
      // diferentes, e a ordem entre os updates não muda o resultado.
      let destino = "SERVIDOR";
      for (let i = 0; i < idsNaOrdem.length; i++) {
        const r = await gravar({
          tabela: "apreciacao_fichas_maquina",
          tipo: "update",
          linhas: { numero_ordem: i + 1 },
          filtro: { id_ficha: idsNaOrdem[i] },
          modulo: "apreciacao-maquinas",
          id_documento: idApreciacao,
        });
        if (r.destino === "APARELHO") destino = "APARELHO";
      }
      return { idsNaOrdem, destino };
    },
    onSuccess: ({ idsNaOrdem, destino }) => {
      if (destino === "SERVIDOR") {
        qc.invalidateQueries({ queryKey: KEY(idApreciacao) });
        return;
      }
      // Sem rede não há o que revalidar: a ordem nova é aplicada à mão, senão
      // o arrasto voltaria sozinho para a posição anterior.
      qc.setQueryData<FichaMaquina[]>(KEY(idApreciacao), (antigo) =>
        (antigo ?? [])
          .map((f) => {
            const pos = idsNaOrdem.indexOf(f.id_ficha);
            return pos < 0 ? f : ({ ...f, numero_ordem: pos + 1 } as FichaMaquina);
          })
          .sort((a, b) => (a.numero_ordem ?? 0) - (b.numero_ordem ?? 0)),
      );
    },
    onError: (e: Error) => toast.error(`Erro ao reordenar: ${e.message}`),
  });
}

export function useUploadFotoFicha(idApreciacao: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { ficha: FichaMaquina; file: File }) => {
      const supabase = createSupabaseBrowserClient();
      const atuaisUrls = params.ficha.foto_urls ?? [];
      const atuaisPaths = params.ficha.foto_storage_paths ?? [];
      if (atuaisPaths.length >= MAX_FOTOS_FICHA) {
        throw new Error(`Limite de ${MAX_FOTOS_FICHA} fotos por máquina atingido.`);
      }

      const ext = (params.file.name.split(".").pop() ?? "jpg").toLowerCase();
      const sufixo = gerarId("F").slice(2);
      const path = `apreciacao-maquinas/${idApreciacao}/ficha-${params.ficha.id_ficha}-${sufixo}.${ext}`;

      // O arquivo não sobe aqui: `getPublicUrl` é montagem de string, então a
      // URL já é conhecida e o `gravar()` leva o arquivo junto da linha.
      const { data: pub } = supabase.storage.from("fotos").getPublicUrl(path);

      const patch = {
        foto_urls: [...atuaisUrls, pub.publicUrl],
        foto_storage_paths: [...atuaisPaths, path],
        updated_at: new Date().toISOString(),
      };

      const resultado = await gravar({
        tabela: "apreciacao_fichas_maquina",
        tipo: "update",
        linhas: patch,
        filtro: { id_ficha: params.ficha.id_ficha },
        modulo: "apreciacao-maquinas",
        id_documento: idApreciacao,
        imagens: [{ blob: params.file, caminho: path }],
      });
      return { path, patch, resultado, idFicha: params.ficha.id_ficha };
    },
    onSuccess: ({ patch, resultado, idFicha }) => {
      if (resultado.destino === "SERVIDOR") {
        qc.invalidateQueries({ queryKey: KEY(idApreciacao) });
        return;
      }
      qc.setQueryData<FichaMaquina[]>(KEY(idApreciacao), (antigo) =>
        (antigo ?? []).map((f) =>
          f.id_ficha === idFicha ? ({ ...f, ...patch } as FichaMaquina) : f,
        ),
      );
      toast.success("Foto guardada no aparelho", { icon: "📵" });
    },
    onError: (e: Error) => toast.error(`Erro ao enviar foto: ${e.message}`),
  });
}

export function useRemoverFotoFicha(idApreciacao: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { ficha: FichaMaquina; indice: number }) => {
      const urls = [...(params.ficha.foto_urls ?? [])];
      const paths = [...(params.ficha.foto_storage_paths ?? [])];
      const path = paths[params.indice];

      urls.splice(params.indice, 1);
      paths.splice(params.indice, 1);

      // Apagar o arquivo só com rede — sem ela fica órfão no MinIO, que é
      // desperdício de espaço e não erro.
      if (path && navigator.onLine) {
        try {
          const supabase = createSupabaseBrowserClient();
          await supabase.storage.from("fotos").remove([path]);
        } catch {
          /* silencioso de propósito */
        }
      }

      const patch = {
        foto_urls: urls,
        foto_storage_paths: paths,
        updated_at: new Date().toISOString(),
      };

      const resultado = await gravar({
        tabela: "apreciacao_fichas_maquina",
        tipo: "update",
        linhas: patch,
        filtro: { id_ficha: params.ficha.id_ficha },
        modulo: "apreciacao-maquinas",
        id_documento: idApreciacao,
      });
      return { patch, resultado, idFicha: params.ficha.id_ficha };
    },
    onSuccess: ({ patch, resultado, idFicha }) => {
      if (resultado.destino === "SERVIDOR") {
        qc.invalidateQueries({ queryKey: KEY(idApreciacao) });
        return;
      }
      qc.setQueryData<FichaMaquina[]>(KEY(idApreciacao), (antigo) =>
        (antigo ?? []).map((f) =>
          f.id_ficha === idFicha ? ({ ...f, ...patch } as FichaMaquina) : f,
        ),
      );
      toast.success("Remoção guardada no aparelho", { icon: "📵" });
    },
    onError: (e: Error) => toast.error(`Erro ao remover foto: ${e.message}`),
  });
}

/** Nº de máquinas por laudo — alimenta o badge "N máq." da Visão Geral. */
export interface ApreciacaoDashboard {
  /** nº de máquinas (fichas) por laudo */
  fichasCount: Record<string, number>;
  /** classificação de cada linha HRN (residual quando houver, senão inicial) */
  riscos: { id_apreciacao: string; classe: string | null }[];
}

/** Resumo p/ a Visão Geral: contagem de máquinas por laudo + classes de risco. */
export function useApreciacaoDashboard() {
  return useQuery({
    queryKey: ["apreciacao-dashboard"],
    queryFn: async (): Promise<ApreciacaoDashboard> => {
      const supabase = createSupabaseBrowserClient();
      const [fichasRes, riscosRes] = await Promise.all([
        supabase.from("apreciacao_fichas_maquina").select("id_apreciacao"),
        supabase
          .from("apreciacao_riscos_hrn")
          .select("id_apreciacao, classificacao_risco, classificacao_residual"),
      ]);
      if (fichasRes.error) throw fichasRes.error;
      if (riscosRes.error) throw riscosRes.error;

      const fichasCount: Record<string, number> = {};
      for (const f of (fichasRes.data ?? []) as { id_apreciacao: string }[]) {
        fichasCount[f.id_apreciacao] = (fichasCount[f.id_apreciacao] ?? 0) + 1;
      }
      const riscos = (
        (riscosRes.data ?? []) as {
          id_apreciacao: string;
          classificacao_risco: string | null;
          classificacao_residual: string | null;
        }[]
      ).map((r) => ({
        id_apreciacao: r.id_apreciacao,
        classe: r.classificacao_residual || r.classificacao_risco,
      }));

      return { fichasCount, riscos };
    },
    staleTime: 30 * 1000,
  });
}

/**
 * Auto-import: traz as máquinas da INSPEÇÃO da empresa como fichas do laudo,
 * agrupadas por setor.
 *
 * ⚠️ O nome do setor vem de `setores.setor_ghe` — a tabela NÃO tem coluna
 * `nome`. Ler `nome` devolve vazio e todas as máquinas caem em "Sem setor".
 */
export function useImportarInspecaoParaLaudo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id_apreciacao: string; id_empresa: string }) => {
      const supabase = createSupabaseBrowserClient();

      const { data: rawMaqs, error: maqErr } = await supabase
        .from("inspecao_maquinas")
        .select("*")
        .eq("id_empresa", params.id_empresa)
        .eq("ativo", true)
        .order("ordem", { ascending: true });
      if (maqErr) throw maqErr;
      const maquinas = (rawMaqs ?? []) as Record<string, unknown>[];
      if (!maquinas.length) return { importadas: 0 };

      // Resolve o nome do setor de cada máquina (setor_ghe, fallback descricao).
      const idsSetor = Array.from(
        new Set(maquinas.map((m) => m.id_setor).filter(Boolean) as string[]),
      );
      const nomePorSetor = new Map<string, string>();
      if (idsSetor.length) {
        const { data: rawSetores } = await supabase
          .from("setores")
          .select("id_setor, setor_ghe, descricao")
          .in("id_setor", idsSetor);
        for (const s of (rawSetores ?? []) as {
          id_setor: string;
          setor_ghe: string | null;
          descricao: string | null;
        }[]) {
          nomePorSetor.set(s.id_setor, (s.setor_ghe ?? s.descricao ?? "").trim());
        }
      }

      // Não reimporta o que já está no laudo (usa nome+série como chave).
      const { data: rawExistentes } = await supabase
        .from("apreciacao_fichas_maquina")
        .select("maquina_descricao, serie, numero_ordem")
        .eq("id_apreciacao", params.id_apreciacao);
      const existentes = (rawExistentes ?? []) as {
        maquina_descricao: string | null;
        serie: string | null;
        numero_ordem: number;
      }[];
      const chave = (nome: string | null, serie: string | null) =>
        `${(nome ?? "").trim().toLowerCase()}|${(serie ?? "").trim().toLowerCase()}`;
      const jaTem = new Set(existentes.map((e) => chave(e.maquina_descricao, e.serie)));
      let ordem = existentes.reduce((max, e) => Math.max(max, e.numero_ordem ?? 0), 0);

      // Ordena por setor para as fichas nascerem agrupadas.
      const ordenadas = [...maquinas].sort((a, b) => {
        const sa = nomePorSetor.get(String(a.id_setor ?? "")) ?? "";
        const sb = nomePorSetor.get(String(b.id_setor ?? "")) ?? "";
        if (sa !== sb) return sa.localeCompare(sb, "pt-BR");
        return Number(a.ordem ?? 0) - Number(b.ordem ?? 0);
      });

      const novas: Record<string, unknown>[] = [];
      const itensChecklist: Record<string, unknown>[] = [];

      for (const m of ordenadas) {
        const nome = (m.nome as string) ?? null;
        if (jaTem.has(chave(nome, (m.numero_serie as string) ?? null))) continue;
        jaTem.add(chave(nome, (m.numero_serie as string) ?? null));

        const idFicha = gerarId("APF");
        ordem += 1;
        novas.push({
          id_ficha: idFicha,
          id_apreciacao: params.id_apreciacao,
          numero_ordem: ordem,
          maquina_descricao: nome,
          equipamento: nome,
          tipo: (m.tipo as string) ?? null,
          modelo: (m.modelo as string) ?? null,
          fabricante: (m.marca as string) ?? null,
          serie: (m.numero_serie as string) ?? null,
          ano: m.ano_fabricacao ? String(m.ano_fabricacao) : null,
          capacidade: null,
          setor: nomePorSetor.get(String(m.id_setor ?? "")) ?? null,
          constatacoes_inspecao: (m.observacoes as string) ?? null,
          parecer_tecnico: (m.parecer_ia as string) ?? null,
          operadores: (m.operadores as OperadorFicha[]) ?? null,
          prioridade_manual: false,
          foto_urls: Array.isArray(m.foto_urls) ? (m.foto_urls as string[]) : [],
          // Os arquivos seguem sendo da inspeção: não copiamos os paths, senão
          // excluir a ficha apagaria a foto da inspeção de origem.
          foto_storage_paths: [],
        });

        CATALOGO_NR12.forEach((item, i) => {
          itensChecklist.push({
            id_item: gerarId("APRI"),
            id_apreciacao: params.id_apreciacao,
            id_ficha: idFicha,
            item_codigo: item.codigo,
            item_categoria: item.categoria,
            item_titulo: item.titulo,
            item_descricao: item.descricao ?? null,
            item_origem: "CATALOGO",
            situacao: "PENDENTE",
            ordem: i,
            foto_urls: [],
            foto_storage_paths: [],
            foto_legendas: [],
          });
        });
      }

      if (!novas.length) return { importadas: 0 };

      const { error: insErr } = await supabase
        .from("apreciacao_fichas_maquina")
        .insert(novas as never);
      if (insErr) throw insErr;

      const { error: itErr } = await supabase
        .from("apreciacoes_maquinas_itens")
        .insert(itensChecklist as never);
      if (itErr) throw itErr;

      return { importadas: novas.length };
    },
    onSuccess: (r, vars) => {
      qc.invalidateQueries({ queryKey: KEY(vars.id_apreciacao) });
      qc.invalidateQueries({ queryKey: ["apreciacao-maquina", vars.id_apreciacao] });
      qc.invalidateQueries({ queryKey: ["apreciacao-dashboard"] });
      if (r.importadas > 0) {
        toast.success(`${r.importadas} máquina(s) importada(s) da inspeção`);
      }
    },
    onError: (e: Error) => toast.error(`Erro ao importar da inspeção: ${e.message}`),
  });
}
