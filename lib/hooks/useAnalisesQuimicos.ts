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
  ComponenteQuimico,
} from "@/lib/supabase/types";
import type { AgenteReferencia } from "@/lib/quimicos/base_referencia";
import { gerarConclusaoTemplate } from "@/lib/quimicos/gerarTemplate";

/**
 * Fallback de extração de campos via IA — chama a edge function
 * `extrair-campos-fispq` pra preencher lacunas do parser regex local.
 *
 * Uso: quando parser + base Chabra falharam em extrair nome_produto,
 * fabricante ou forma_fisica de uma FISPQ, OU quando componentes da
 * Seção 3 ficaram sem nome/concentração. Manda um snippet curto + listas
 * de campos/CAS pendentes; recebe valores extraídos. 0-1 chamada por
 * upload de PDF.
 */
export type CampoFispqFaltante = "nome_produto" | "fabricante" | "forma_fisica";

export interface ComponenteFispqExtraido {
  cas: string;
  nome?: string | null;
  concentracao?: string | null;
}

export interface CamposFispqExtraidos {
  nome_produto?: string | null;
  fabricante?: string | null;
  forma_fisica?: string | null;
  componentes?: ComponenteFispqExtraido[];
}

export async function extrairCamposFispqViaIA(input: {
  snippet: string;
  campos_faltantes?: CampoFispqFaltante[];
  componentes_pendentes?: string[];
}): Promise<CamposFispqExtraidos> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.functions.invoke(
    "extrair-campos-fispq",
    { body: input }
  );
  if (error) throw error;
  return (data ?? {}) as CamposFispqExtraidos;
}

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

  // Modo PDF: texto bruto extraído (audit) + contexto compacto pra IA
  texto_documento?: string | null;
  fonte_arquivo?: string | null;
  /** Snippets resumidos das seções 2/8/11 da FISPQ + CAS/H/GHS extraídos.
   *  Substitui o envio do PDF inteiro à IA — economiza ~3-5k tokens. */
  contexto_fispq?: string | null;
  /** Agente "representativo" da mistura — pior caso agregado dos componentes
   *  catalogados. Quando presente, contém os dados regulatórios DETERMINÍSTICOS
   *  (insalubridade, eSocial, Decreto, IARC, etc.) que a IA NÃO deve contradizer
   *  — só preencher os campos que faltam (EPIs, medidas, fundamentação). */
  dados_base?: AgenteReferencia | null;
  /** Lista de TODOS os componentes da mistura catalogados na base. A IA recebe
   *  cada um separadamente pra poder fundamentar o parecer citando cada componente
   *  individualmente. */
  dados_base_componentes?: AgenteReferencia[] | null;
  /** Componentes da mistura (modo Manual com 2+ químicos). No PDF, vem do
   *  parser FISPQ (principal + cas_componentes). */
  componentes?: ComponenteQuimico[] | null;

  // Dados do produto (preenchido manualmente OU pelo parser FISPQ revisado)
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
 * Avalia se TODOS os componentes submetidos estão catalogados na base
 * Chabra. Quando sim, podemos pular a IA e gerar a conclusão via
 * template client-side (campos regulatórios da base + prosa templatizada
 * por forma física/flags).
 */
function todosCatalogados(
  componentes: ComponenteQuimico[] | null | undefined,
  catalogados: AgenteReferencia[] | null | undefined
): boolean {
  if (!componentes || componentes.length === 0) return false;
  if (!catalogados || catalogados.length === 0) return false;
  const setCatalogados = new Set(
    catalogados
      .map((d) => d.cas)
      .filter((c): c is string => !!c)
  );
  return componentes.every((c) => !!c.numero_cas && setCatalogados.has(c.numero_cas));
}

/**
 * Mutation que:
 *  1. SE todos os componentes catalogados → gera Conclusão via TEMPLATE
 *     client-side (sem chamada IA — economiza tokens, é instantâneo).
 *  2. SENÃO chama a Edge Function `analisar-quimico-ia` com os dados.
 *  3. Persiste em `analises_quimicos`.
 *  4. Devolve o registro recém-criado.
 *
 * O resultado_texto carrega um JSON serializado da conclusao + um marcador
 * `_fonte` ("template" ou "ia") que a UI usa pra mostrar badge de origem.
 */
export function useGerarAnaliseQuimico() {
  const qc = useQueryClient();
  const user = useUserStore((s) => s.user);

  return useMutation({
    mutationFn: async (input: GerarAnaliseInput): Promise<AnaliseQuimico> => {
      const supabase = createSupabaseBrowserClient();

      const dadosProduto = {
        nome_produto: input.nome_produto ?? null,
        nome_quimico: input.nome_quimico ?? null,
        numero_cas: input.numero_cas ?? null,
        formula_quimica: input.formula_quimica ?? null,
        forma_fisica: input.forma_fisica ?? null,
        concentracao: input.concentracao ?? null,
      };

      // ===== Decisão template vs IA =====
      const usarTemplate =
        !!input.dados_base &&
        !!input.dados_base_componentes &&
        input.dados_base_componentes.length > 0 &&
        todosCatalogados(input.componentes, input.dados_base_componentes);

      let conclusao: ConclusaoRapidaQuimico | null = null;
      let resultadoTexto = "";

      if (usarTemplate) {
        // === Caminho TEMPLATE: gera client-side, zero token na IA ===
        conclusao = {
          ...gerarConclusaoTemplate({
            dadosBase: input.dados_base!,
            componentes: input.dados_base_componentes!,
            formaFisica: input.forma_fisica,
            condicoesUso: input.condicoes_uso,
          }),
          _fonte: "template",
        };
        resultadoTexto = JSON.stringify(conclusao, null, 2);
      } else {
        // === Caminho IA: chama edge function como antes ===
        const payloadIA = {
          modo: input.modo,
          dados_manuais: dadosProduto,
          contexto_fispq: input.contexto_fispq ?? null,
          dados_base: input.dados_base ?? null,
          dados_base_componentes: input.dados_base_componentes ?? null,
          componentes: input.componentes ?? null,
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
        conclusao = iaResult.conclusao
          ? { ...iaResult.conclusao, _fonte: "ia" }
          : null;
        resultadoTexto = iaResult.resultado;
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
        resultado_texto: resultadoTexto,
        conclusao_rapida: conclusao,
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
