"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUserStore } from "@/lib/store";
import { gerarId } from "@/lib/utils";
import type {
  AnaliseQuimico,
  CondicoesUsoQuimico,
  ConclusaoRapidaQuimico,
  ModoAnaliseQuimico,
} from "@/lib/supabase/types";

async function fetchLista(empresasVinculadas: string[] | null) {
  const supabase = createSupabaseBrowserClient();
  let q = supabase
    .from("analises_quimicos")
    .select("*")
    .order("created_at", { ascending: false });
  if (empresasVinculadas && empresasVinculadas.length > 0) {
    // Inclui análises da empresa OU sem empresa (geral)
    q = q.or(
      `id_empresa.in.(${empresasVinculadas.join(",")}),id_empresa.is.null`
    );
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as AnaliseQuimico[];
}

export function useAnalisesQuimicos() {
  const user = useUserStore((s) => s.user);
  const vinculos =
    user?.perfil === "Tecnico" &&
    user.empresas_vinculadas &&
    user.empresas_vinculadas.length > 0
      ? user.empresas_vinculadas
      : null;

  return useQuery({
    queryKey: ["analises-quimicos", vinculos],
    queryFn: () => fetchLista(vinculos),
  });
}

export function useAnaliseQuimico(id: string | null | undefined) {
  return useQuery({
    queryKey: ["analise-quimico", id],
    enabled: !!id,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("analises_quimicos")
        .select("*")
        .eq("id_analise", id!)
        .single();
      if (error) throw error;
      return data as unknown as AnaliseQuimico;
    },
  });
}

export interface GerarAnaliseInput {
  modo: ModoAnaliseQuimico;
  titulo: string;
  id_empresa: string | null;
  empresa_nome: string | null;

  // Modo PDF
  texto_documento?: string | null;
  fonte_arquivo?: string | null;

  // Modo Manual
  nome_produto?: string | null;
  nome_quimico?: string | null;
  numero_cas?: string | null;
  formula_quimica?: string | null;
  forma_fisica?: string | null;
  concentracao?: string | null;

  // Condições de uso (opcional)
  condicoes_uso?: CondicoesUsoQuimico | null;
}

/**
 * Mutation que:
 *  1. Chama a Edge Function `analisar-quimico-ia` com os dados do produto.
 *  2. Recebe `{ resultado, conclusao }` da IA.
 *  3. Persiste em `analises_quimicos` (com vínculo de empresa/usuário).
 *  4. Devolve o registro recém-criado.
 */
export function useGerarAnaliseQuimico() {
  const qc = useQueryClient();
  const user = useUserStore((s) => s.user);

  return useMutation({
    mutationFn: async (input: GerarAnaliseInput): Promise<AnaliseQuimico> => {
      const supabase = createSupabaseBrowserClient();

      // 1) Chama IA
      const payloadIA = {
        modo: input.modo,
        texto_documento: input.texto_documento ?? null,
        dados_manuais:
          input.modo === "Manual"
            ? {
                nome_produto: input.nome_produto ?? null,
                nome_quimico: input.nome_quimico ?? null,
                numero_cas: input.numero_cas ?? null,
                formula_quimica: input.formula_quimica ?? null,
                forma_fisica: input.forma_fisica ?? null,
                concentracao: input.concentracao ?? null,
              }
            : null,
        condicoes_uso: input.condicoes_uso ?? null,
        empresa_nome: input.empresa_nome ?? null,
      };

      const { data: iaData, error: iaErr } = await supabase.functions.invoke(
        "analisar-quimico-ia",
        { body: payloadIA }
      );
      if (iaErr) throw iaErr;
      const iaResult = (iaData as {
        data?: { resultado?: string; conclusao?: ConclusaoRapidaQuimico | null };
      } | null)?.data;
      if (!iaResult?.resultado) {
        throw new Error("Resposta vazia da IA — tente novamente em alguns segundos");
      }

      // 2) Persiste em analises_quimicos
      const id_analise = gerarId("ANQ");
      const row: AnaliseQuimico = {
        id_analise,
        id_empresa: input.id_empresa,
        titulo: input.titulo.trim() || "Análise sem título",
        nome_quimico: input.nome_quimico ?? null,
        numero_cas: input.numero_cas ?? null,
        formula_quimica: input.formula_quimica ?? null,
        forma_fisica: input.forma_fisica ?? null,
        concentracao: input.concentracao ?? null,
        modo: input.modo,
        fonte_arquivo: input.fonte_arquivo ?? null,
        texto_extraido:
          input.modo === "PDF"
            ? (input.texto_documento ?? "").slice(0, 60000)
            : null,
        condicoes_uso: input.condicoes_uso ?? null,
        resultado_texto: iaResult.resultado,
        conclusao_rapida: iaResult.conclusao ?? null,
        usuario_email: user?.email ?? null,
        usuario_nome: user?.nome ?? null,
        created_at: new Date().toISOString(),
        updated_at: null,
      };

      const { error: saveErr } = await supabase
        .from("analises_quimicos")
        .insert(row as never);
      if (saveErr) throw saveErr;

      return row;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["analises-quimicos"] });
    },
  });
}

export function useExcluirAnaliseQuimico() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id_analise: string) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("analises_quimicos")
        .delete()
        .eq("id_analise", id_analise);
      if (error) throw error;
      return id_analise;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["analises-quimicos"] });
    },
  });
}
