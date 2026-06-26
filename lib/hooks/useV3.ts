"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { mensagemErro } from "@/lib/errors";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { excluirComLixeiraPorId } from "@/lib/hooks/useLixeira";
import type {
  CategoriaCatalogo,
  CategoriaModelo,
  ItemCatalogoTipo,
  ItemModeloRisco,
  MatrizRisco,
  ModeloRisco,
  PerguntaModeloRisco,
  PerguntaTipoRisco,
  TipoRiscoCustom,
  TriagemModeloRel,
  TriagemOpcao,
  TriagemTipoRisco,
} from "@/lib/supabase/types";

// =========================================================================
// TIPOS DE RISCO
// =========================================================================

export function useTiposRisco(opts?: { incluirInativos?: boolean }) {
  return useQuery({
    queryKey: ["tipos-risco", opts?.incluirInativos ?? false],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      let q = supabase.from("tipos_risco").select("*").order("ordem");
      if (!opts?.incluirInativos) q = q.eq("ativo", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as TipoRiscoCustom[];
    },
  });
}

export function useSaveTipoRisco() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (t: Partial<TipoRiscoCustom> & { id_tipo: string }) => {
      const supabase = createSupabaseBrowserClient();
      const { id_tipo, ...rest } = t;
      const payload = { ...rest, updated_at: new Date().toISOString() };

      // Update parcial (reordenar, ativar/desativar) não traz `nome` —
      // upsert tentaria a branch INSERT e violaria a NOT NULL constraint.
      // Diferenciamos: se `nome` veio no payload é create/edit completo
      // (upsert), senão é só patch de campos (update).
      if (rest.nome === undefined) {
        const { error } = await supabase
          .from("tipos_risco")
          .update(payload as never)
          .eq("id_tipo", id_tipo);
        if (error) throw error;
        return;
      }

      const { error } = await supabase
        .from("tipos_risco")
        .upsert({ id_tipo, ...payload } as never, { onConflict: "id_tipo" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tipos-risco"] });
      toast.success("Tipo salvo");
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

/**
 * Lookup nome → ícone derivado da tabela `tipos_risco`. Inclui
 * inativos pra que riscos antigos cujo tipo foi desativado ainda
 * exibam o ícone correto. Fallback "•" quando o tipo não está
 * cadastrado ou não tem ícone.
 *
 *   const iconeDe = useTipoIcone();
 *   <span>{iconeDe(risco.tipo_risco)}</span>
 */
export function useTipoIcone() {
  const { data: tipos = [] } = useTiposRisco({ incluirInativos: true });
  return useMemo(() => {
    const map = new Map<string, string>();
    for (const t of tipos) {
      if (t.icone) map.set(t.nome, t.icone);
    }
    return (nome: string | null | undefined) =>
      (nome && map.get(nome)) || "•";
  }, [tipos]);
}

export function useDeleteTipoRisco() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (idTipo: string) => {
      const supabase = createSupabaseBrowserClient();
      // Tipos de sistema: desativar em vez de apagar (evita perder histórico).
      const { data: existing } = await supabase
        .from("tipos_risco")
        .select("sistema")
        .eq("id_tipo", idTipo)
        .single();
      const isSistema = (existing as { sistema?: boolean } | null)?.sistema;
      if (isSistema) {
        const { error } = await supabase
          .from("tipos_risco")
          .update({ ativo: false } as never)
          .eq("id_tipo", idTipo);
        if (error) throw error;
        return "desativado";
      }
      await excluirComLixeiraPorId({
        tabela: "tipos_risco",
        chave: "id_tipo",
        id: idTipo,
        modulo: "config",
        rotuloCol: "nome",
      });
      return "removido";
    },
    onSuccess: (acao) => {
      qc.invalidateQueries({ queryKey: ["tipos-risco"] });
      toast.success(acao === "desativado" ? "Tipo desativado" : "Tipo removido");
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

// =========================================================================
// CATÁLOGO POR TIPO DE RISCO (V4)
// =========================================================================
// Lista de itens pré-cadastrados que populam selects/datalists do
// RiscoForm. 8 categorias por tipo: agente, fonte_geradora, EPI/EPC
// (utilizado/recomendado), medida (adotada/recomendada).

export function useCatalogoPorTipo(
  idTipo: string | null | undefined,
  opts?: { incluirInativos?: boolean }
) {
  const incluirInativos = opts?.incluirInativos ?? false;
  return useQuery({
    queryKey: ["catalogo-tipo", idTipo, incluirInativos],
    enabled: !!idTipo,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      let q = supabase
        .from("itens_catalogo_tipo")
        .select("*")
        .eq("id_tipo", idTipo!)
        .order("categoria")
        .order("ordem");
      if (!incluirInativos) q = q.eq("ativo", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as ItemCatalogoTipo[];
    },
  });
}

/**
 * Filtra o catálogo de um tipo por categoria, preservando ordem.
 * Use direto nas telas que precisam só de uma das listas (ex: agentes
 * no datalist do RiscoForm).
 */
export function useCatalogoCategoria(
  idTipo: string | null | undefined,
  categoria: CategoriaCatalogo
) {
  const { data: tudo = [], ...rest } = useCatalogoPorTipo(idTipo);
  const itens = useMemo(
    () => tudo.filter((i) => i.categoria === categoria),
    [tudo, categoria]
  );
  return { ...rest, data: itens };
}

export function useSaveItemCatalogo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      item: Partial<ItemCatalogoTipo> & {
        id_item: string;
        id_tipo: string;
        categoria: CategoriaCatalogo;
      }
    ) => {
      const supabase = createSupabaseBrowserClient();
      const { id_item, ...rest } = item;
      const payload = { ...rest, updated_at: new Date().toISOString() };

      // `texto` é NOT NULL — patches parciais (reordenar, ativar/desativar)
      // não trazem texto, então nesse caso usamos UPDATE em vez de UPSERT
      // (o UPSERT tentaria fase INSERT e violaria a constraint).
      if (rest.texto === undefined) {
        const { error } = await supabase
          .from("itens_catalogo_tipo")
          .update(payload as never)
          .eq("id_item", id_item);
        if (error) throw error;
        return;
      }

      const { error } = await supabase
        .from("itens_catalogo_tipo")
        .upsert({ id_item, ...payload } as never, { onConflict: "id_item" });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["catalogo-tipo", vars.id_tipo] });
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

export function useDeleteItemCatalogo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (idItem: string) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("itens_catalogo_tipo")
        .delete()
        .eq("id_item", idItem);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalogo-tipo"] });
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

// =========================================================================
// PERGUNTAS POR TIPO DE RISCO
// =========================================================================

export function usePerguntasPorTipo(idTipo: string | null | undefined) {
  return useQuery({
    queryKey: ["perguntas-tipo", idTipo],
    enabled: !!idTipo,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("perguntas_tipo_risco")
        .select("*")
        .eq("id_tipo", idTipo!)
        .eq("ativo", true)
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as unknown as PerguntaTipoRisco[];
    },
  });
}

export function useTodasPerguntas(idTipo: string | null | undefined) {
  return useQuery({
    queryKey: ["perguntas-tipo-todas", idTipo],
    enabled: !!idTipo,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("perguntas_tipo_risco")
        .select("*")
        .eq("id_tipo", idTipo!)
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as unknown as PerguntaTipoRisco[];
    },
  });
}

export function useSavePergunta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      p: Partial<PerguntaTipoRisco> & { id_pergunta: string; id_tipo: string }
    ) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("perguntas_tipo_risco")
        .upsert(p as never, { onConflict: "id_pergunta" });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["perguntas-tipo"] });
      qc.invalidateQueries({ queryKey: ["perguntas-tipo-todas"] });
      qc.invalidateQueries({
        queryKey: ["perguntas-tipo-todas", vars.id_tipo],
      });
      toast.success("Pergunta salva");
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

export function useDeletePergunta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (idPergunta: string) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("perguntas_tipo_risco")
        .delete()
        .eq("id_pergunta", idPergunta);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["perguntas-tipo"] });
      qc.invalidateQueries({ queryKey: ["perguntas-tipo-todas"] });
      toast.success("Pergunta removida");
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

// =========================================================================
// MATRIZES DE RISCO
// =========================================================================

export function useMatrizes() {
  return useQuery({
    queryKey: ["matrizes"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("matrizes_risco")
        .select("*")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as MatrizRisco[];
    },
  });
}

export function useMatrizAtiva() {
  return useQuery({
    queryKey: ["matriz-ativa"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("matrizes_risco")
        .select("*")
        .eq("ativa", true)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as MatrizRisco | null;
    },
  });
}

export function useSaveMatriz() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (m: Partial<MatrizRisco> & { id_matriz: string }) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("matrizes_risco")
        .upsert(
          {
            ...m,
            updated_at: new Date().toISOString(),
          } as never,
          { onConflict: "id_matriz" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["matrizes"] });
      qc.invalidateQueries({ queryKey: ["matriz-ativa"] });
      toast.success("Matriz salva");
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

export function useAtivarMatriz() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (idMatriz: string) => {
      const supabase = createSupabaseBrowserClient();
      // Desativa todas e ativa só a escolhida — a constraint do banco
      // garante que nunca duas fiquem ativas ao mesmo tempo.
      const { error: errDes } = await supabase
        .from("matrizes_risco")
        .update({ ativa: false } as never)
        .neq("id_matriz", idMatriz);
      if (errDes) throw errDes;
      const { error } = await supabase
        .from("matrizes_risco")
        .update({ ativa: true } as never)
        .eq("id_matriz", idMatriz);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["matrizes"] });
      qc.invalidateQueries({ queryKey: ["matriz-ativa"] });
      toast.success("Matriz ativada");
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

export function useDeleteMatriz() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (idMatriz: string) => {
      await excluirComLixeiraPorId({
        tabela: "matrizes_risco",
        chave: "id_matriz",
        id: idMatriz,
        modulo: "config",
        rotuloCol: "nome",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["matrizes"] });
      qc.invalidateQueries({ queryKey: ["matriz-ativa"] });
      toast.success("Matriz removida");
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

// =========================================================================
// MODELOS DE RISCO (V5)
// =========================================================================
// Cada modelo é um "kit" centrado num agente: fonte geradora + 6 listas
// (EPIs/EPCs/medidas) + perguntas. Coexiste com itens_catalogo_tipo (V4),
// que vira "biblioteca compartilhada" do tipo.

export function useModelosPorTipo(
  idTipo: string | null | undefined,
  opts?: { incluirInativos?: boolean }
) {
  const incluirInativos = opts?.incluirInativos ?? false;
  return useQuery({
    queryKey: ["modelos-tipo", idTipo, incluirInativos],
    enabled: !!idTipo,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      let q = supabase
        .from("modelos_risco")
        .select("*")
        .eq("id_tipo", idTipo!)
        .order("ordem");
      if (!incluirInativos) q = q.eq("ativo", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as ModeloRisco[];
    },
  });
}

export function useSaveModeloRisco() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      m: Partial<ModeloRisco> & { id_modelo: string; id_tipo: string }
    ) => {
      const supabase = createSupabaseBrowserClient();
      const { id_modelo, ...rest } = m;
      const payload = { ...rest, updated_at: new Date().toISOString() };

      // `agente` é NOT NULL — patches parciais (ordem/ativo) não trazem
      // agente, então UPDATE em vez de UPSERT (mesma estratégia de V3/V4).
      if (rest.agente === undefined) {
        const { error } = await supabase
          .from("modelos_risco")
          .update(payload as never)
          .eq("id_modelo", id_modelo);
        if (error) throw error;
        return;
      }

      const { error } = await supabase
        .from("modelos_risco")
        .upsert({ id_modelo, ...payload } as never, { onConflict: "id_modelo" });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["modelos-tipo", vars.id_tipo] });
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

export function useDeleteModeloRisco() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (idModelo: string) => {
      await excluirComLixeiraPorId({
        tabela: "modelos_risco",
        chave: "id_modelo",
        id: idModelo,
        modulo: "config",
        rotuloCol: "nome",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["modelos-tipo"] });
      toast.success("Modelo removido");
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

// ITENS DO MODELO ---------------------------------------------------------

export function useItensModelo(
  idModelo: string | null | undefined,
  opts?: { incluirInativos?: boolean }
) {
  const incluirInativos = opts?.incluirInativos ?? false;
  return useQuery({
    queryKey: ["itens-modelo", idModelo, incluirInativos],
    enabled: !!idModelo,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      let q = supabase
        .from("itens_modelo_risco")
        .select("*")
        .eq("id_modelo", idModelo!)
        .order("categoria")
        .order("ordem");
      if (!incluirInativos) q = q.eq("ativo", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as ItemModeloRisco[];
    },
  });
}

export function useSaveItemModelo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      item: Partial<ItemModeloRisco> & {
        id_item: string;
        id_modelo: string;
        categoria: CategoriaModelo;
      }
    ) => {
      const supabase = createSupabaseBrowserClient();
      const { id_item, ...rest } = item;
      const payload = { ...rest, updated_at: new Date().toISOString() };

      if (rest.texto === undefined) {
        const { error } = await supabase
          .from("itens_modelo_risco")
          .update(payload as never)
          .eq("id_item", id_item);
        if (error) throw error;
        return;
      }

      const { error } = await supabase
        .from("itens_modelo_risco")
        .upsert({ id_item, ...payload } as never, { onConflict: "id_item" });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["itens-modelo", vars.id_modelo] });
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

export function useDeleteItemModelo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (idItem: string) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("itens_modelo_risco")
        .delete()
        .eq("id_item", idItem);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["itens-modelo"] });
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

// PERGUNTAS DO MODELO -----------------------------------------------------

export function usePerguntasDoModelo(
  idModelo: string | null | undefined,
  opts?: { somenteAtivas?: boolean }
) {
  const somenteAtivas = opts?.somenteAtivas ?? false;
  return useQuery({
    queryKey: ["perguntas-modelo", idModelo, somenteAtivas],
    enabled: !!idModelo,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      let q = supabase
        .from("perguntas_modelo_risco")
        .select("*")
        .eq("id_modelo", idModelo!)
        .order("ordem");
      if (somenteAtivas) q = q.eq("ativo", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as PerguntaModeloRisco[];
    },
  });
}

export function useSavePerguntaModelo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      p: Partial<PerguntaModeloRisco> & { id_pergunta: string; id_modelo: string }
    ) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("perguntas_modelo_risco")
        .upsert(p as never, { onConflict: "id_pergunta" });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["perguntas-modelo", vars.id_modelo] });
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

export function useDeletePerguntaModelo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (idPergunta: string) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("perguntas_modelo_risco")
        .delete()
        .eq("id_pergunta", idPergunta);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["perguntas-modelo"] });
      toast.success("Pergunta removida");
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

// =========================================================================
// TRIAGENS (V7)
// =========================================================================
// Perguntas que aparecem ANTES do agente no RiscoForm. Cada pergunta tem
// opções multi-selecionáveis; cada opção pode estar vinculada a um modelo.
// O save replica o risco por opção marcada.

export function useTriagensPorTipo(
  idTipo: string | null | undefined,
  opts?: { incluirInativas?: boolean }
) {
  const incluirInativas = opts?.incluirInativas ?? false;
  return useQuery({
    queryKey: ["triagens-tipo", idTipo, incluirInativas],
    enabled: !!idTipo,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      let q = supabase
        .from("triagens_tipo")
        .select("*")
        .eq("id_tipo", idTipo!)
        .order("ordem");
      if (!incluirInativas) q = q.eq("ativo", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as TriagemTipoRisco[];
    },
  });
}

export function useSaveTriagem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      t: Partial<TriagemTipoRisco> & { id_triagem: string; id_tipo: string }
    ) => {
      const supabase = createSupabaseBrowserClient();
      const { id_triagem, ...rest } = t;
      const payload = { ...rest, updated_at: new Date().toISOString() };
      // texto NOT NULL: patches parciais (ordem/ativo) usam UPDATE
      if (rest.texto === undefined) {
        const { error } = await supabase
          .from("triagens_tipo")
          .update(payload as never)
          .eq("id_triagem", id_triagem);
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from("triagens_tipo")
        .upsert({ id_triagem, ...payload } as never, {
          onConflict: "id_triagem",
        });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["triagens-tipo", vars.id_tipo] });
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

export function useDeleteTriagem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (idTriagem: string) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("triagens_tipo")
        .delete()
        .eq("id_triagem", idTriagem);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["triagens-tipo"] });
      toast.success("Triagem removida");
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

// OPÇÕES DA TRIAGEM -------------------------------------------------------

export function useOpcoesDaTriagem(
  idTriagem: string | null | undefined,
  opts?: { incluirInativas?: boolean }
) {
  const incluirInativas = opts?.incluirInativas ?? false;
  return useQuery({
    queryKey: ["triagem-opcoes", idTriagem, incluirInativas],
    enabled: !!idTriagem,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      let q = supabase
        .from("triagens_opcao")
        .select("*")
        .eq("id_triagem", idTriagem!)
        .order("ordem");
      if (!incluirInativas) q = q.eq("ativo", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as TriagemOpcao[];
    },
  });
}

/**
 * Carrega TODAS as opções ativas de uma lista de triagens (1 query batch).
 * Mais robusto do que tentar inner-join no PostgREST: aqui só passamos
 * os IDs e usamos um IN simples.
 */
export function useOpcoesDeTriagens(idsTriagens: string[]) {
  const idsKey = idsTriagens.slice().sort().join(",");
  return useQuery({
    queryKey: ["triagem-opcoes-multi", idsKey],
    enabled: idsTriagens.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("triagens_opcao")
        .select("*")
        .in("id_triagem", idsTriagens)
        .eq("ativo", true)
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as unknown as TriagemOpcao[];
    },
  });
}

export function useSaveOpcaoTriagem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      o: Partial<TriagemOpcao> & { id_opcao: string; id_triagem: string }
    ) => {
      const supabase = createSupabaseBrowserClient();
      const { id_opcao, ...rest } = o;
      if (rest.texto === undefined) {
        const { error } = await supabase
          .from("triagens_opcao")
          .update(rest as never)
          .eq("id_opcao", id_opcao);
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from("triagens_opcao")
        .upsert({ id_opcao, ...rest } as never, { onConflict: "id_opcao" });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["triagem-opcoes", vars.id_triagem] });
      qc.invalidateQueries({ queryKey: ["triagem-opcoes-tipo"] });
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

export function useDeleteOpcaoTriagem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (idOpcao: string) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("triagens_opcao")
        .delete()
        .eq("id_opcao", idOpcao);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["triagem-opcoes"] });
      qc.invalidateQueries({ queryKey: ["triagem-opcoes-tipo"] });
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}

// =========================================================================
// V8: Triagem ↔ Modelos (M:N direto)
// =========================================================================
// Cada triagem aponta diretamente pra modelos do tipo. No RiscoForm,
// cada modelo da triagem vira um checkbox cujo label é o agente do
// modelo. Substitui o sistema antigo de TriagemOpcao (texto livre).

export function useModelosDaTriagem(idTriagem: string | null | undefined) {
  return useQuery({
    queryKey: ["triagem-modelos", idTriagem],
    enabled: !!idTriagem,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("triagens_modelo")
        .select("*")
        .eq("id_triagem", idTriagem!)
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as unknown as TriagemModeloRel[];
    },
  });
}

/**
 * Carrega TODAS as relações triagem→modelo de uma lista de triagens.
 * Usado pelo RiscoForm pra evitar N+1.
 */
export function useRelacoesDeTriagens(idsTriagens: string[]) {
  const idsKey = idsTriagens.slice().sort().join(",");
  return useQuery({
    queryKey: ["triagem-modelos-multi", idsKey],
    enabled: idsTriagens.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("triagens_modelo")
        .select("*")
        .in("id_triagem", idsTriagens)
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as unknown as TriagemModeloRel[];
    },
  });
}

export function useToggleModeloTriagem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      id_triagem: string;
      id_modelo: string;
      ativar: boolean;
      ordem?: number;
    }) => {
      const supabase = createSupabaseBrowserClient();
      if (vars.ativar) {
        const { error } = await supabase
          .from("triagens_modelo")
          .upsert(
            {
              id_triagem: vars.id_triagem,
              id_modelo: vars.id_modelo,
              ordem: vars.ordem ?? 0,
            } as never,
            { onConflict: "id_triagem,id_modelo" }
          );
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("triagens_modelo")
          .delete()
          .eq("id_triagem", vars.id_triagem)
          .eq("id_modelo", vars.id_modelo);
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["triagem-modelos", vars.id_triagem] });
      qc.invalidateQueries({ queryKey: ["triagem-modelos-multi"] });
    },
    onError: (e: Error) => toast.error(mensagemErro(e)),
  });
}
