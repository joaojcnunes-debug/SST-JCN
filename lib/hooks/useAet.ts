"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUserStore } from "@/lib/store";
import type { Aet13FatorConfig, Aet13FatorPergunta, Aet13FatorSemaforo, AetCargo, AetChecklist, AetChecklistPergunta, AetLaudoFatorPsi, AetLaudoQpsMeta, AetLaudoQpsResposta, AetOwas, AetOwasCategoria, AetOwasSelectCampo, AetPerfilOwas, AetRelatorio, AetSetor, AetTextoPadraoCapitulo, RespostaChecklist, StatusAET, ZonaPsi } from "@/lib/supabase/types";

function normalizarCargos(raw: unknown): AetCargo[] {
  if (Array.isArray(raw))
    return (raw as AetCargo[]).map((c) => ({ ...c, quantidade: c.quantidade ?? 0 }));
  if (typeof raw === "string" && raw.trim())
    return raw.split("\n").filter(Boolean).map((nome) => ({ nome, descricao: "", quantidade: 0 }));
  return [];
}

function toResposta(v: unknown): RespostaChecklist {
  if (v === true || v === "sim") return "sim";
  if (v === "nao_aplica") return "nao_aplica";
  return "nao";
}

function normalizarChecklist(raw: unknown): AetChecklist {
  const c = (raw ?? {}) as Record<string, unknown>;
  return {
    levantamento_acima_limite: toResposta(c.levantamento_acima_limite),
    posturas_forcadas_tipo: (c.posturas_forcadas_tipo as string) ?? "Ocasionais",
    trabalho_predominante: (c.trabalho_predominante as string) ?? "Em pé",
    pausas_descanso: toResposta(c.pausas_descanso),
    uso_cadeira: toResposta(c.uso_cadeira),
    cadeira_adequada: toResposta(c.cadeira_adequada),
    monitor: toResposta(c.monitor),
    exigencia_levantamento: toResposta(c.exigencia_levantamento),
    ritmo_por_demanda: toResposta(c.ritmo_por_demanda),
    pausas_formais: toResposta(c.pausas_formais),
    rodizios_sistematizados: toResposta(c.rodizios_sistematizados),
  };
}

function normalizarSetor(s: unknown): AetSetor {
  const setor = s as Record<string, unknown>;
  return {
    ...setor,
    funcao: (setor.funcao as string) ?? "",
    cargos: normalizarCargos(setor.cargos),
    checklist: normalizarChecklist(setor.checklist),
    respostas_extras: (setor.respostas_extras as Record<string, RespostaChecklist>) ?? {},
    fotos: Array.isArray(setor.fotos) ? (setor.fotos as string[]) : [],
    demais_condicoes: (setor.demais_condicoes as string) ?? "",
  } as AetSetor;
}

function normalizarRelatorio(data: unknown): AetRelatorio {
  const rel = data as Record<string, unknown>;
  return {
    ...rel,
    setores: Array.isArray(rel.setores) ? rel.setores.map(normalizarSetor) : [],
  } as AetRelatorio;
}

// ─── Relatorios ───────────────────────────────────────────────────────────────

export function useAetRelatorios(empresaId?: string | null) {
  const user = useUserStore((s) => s.user);

  return useQuery({
    queryKey: ["aet-relatorios", empresaId ?? "todos"],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      let q = supabase
        .from("aet_relatorios")
        .select("*, empresas(nome_empresa, cnpj)")
        .order("created_at", { ascending: false });

      if (empresaId) {
        q = q.eq("id_empresa", empresaId);
      } else if (user?.perfil === "Tecnico" && user.empresas_vinculadas?.length) {
        q = q.in("id_empresa", user.empresas_vinculadas);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map(normalizarRelatorio);
    },
  });
}

export function useAetRelatorio(id: string | null | undefined) {
  return useQuery({
    queryKey: ["aet-relatorio", id],
    enabled: !!id,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("aet_relatorios")
        .select("*, empresas(nome_empresa, cnpj)")
        .eq("id_relatorio", id!)
        .single();
      if (error) throw error;
      return normalizarRelatorio(data);
    },
  });
}

export function useCriarAet() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id_empresa: string;
      responsavel_elaboracao: string;
      titulo_profissional: string;
      registro_profissional: string;
      endereco_empresa: string;
      data_elaboracao: string | null;
    }): Promise<AetRelatorio> => {
      const supabase = createSupabaseBrowserClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const row = {
        ...payload,
        status: "RASCUNHO" as StatusAET,
        setores: [],
        consideracoes_finais: "",
        usuario: authUser?.id ?? null,
      };
      const { data, error } = await supabase
        .from("aet_relatorios")
        .insert(row as never)
        .select("*, empresas(nome_empresa, cnpj)")
        .single();
      if (error) throw error;
      return data as unknown as AetRelatorio;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["aet-relatorios"] });
    },
    onError: (e: Error) => toast.error(`Erro ao criar: ${e.message}`),
  });
}

export function useSalvarAet() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<Omit<AetRelatorio, "id_relatorio" | "created_at" | "empresas">>;
    }) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("aet_relatorios")
        .update({ ...patch, updated_at: new Date().toISOString() } as never)
        .eq("id_relatorio", id);
      if (error) throw error;
    },
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ["aet-relatorio", id] });
      qc.invalidateQueries({ queryKey: ["aet-relatorios"] });
      toast.success("Salvo com sucesso!");
    },
    onError: (e: Error) => toast.error(`Erro ao salvar: ${e.message}`),
  });
}

export function useExcluirAet() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("aet_relatorios")
        .delete()
        .eq("id_relatorio", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["aet-relatorios"] });
    },
    onError: (e: Error) => toast.error(`Erro ao excluir: ${e.message}`),
  });
}

// ─── Texto Padrão ─────────────────────────────────────────────────────────────

export function useAetTextoPadrao() {
  return useQuery({
    queryKey: ["aet-textos-padrao"],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("aet_textos_padrao")
        .select("*")
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as unknown as AetTextoPadraoCapitulo[];
    },
  });
}

export function useAetCriarCapitulo() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      titulo: string;
      conteudo: string;
      ordem: number;
      posicao_pdf?: string;
      tipo?: "fixo" | "editavel";
      slug_fixo?: string | null;
      mostrar?: boolean;
      ordem_global?: number | null;
    }) => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("aet_textos_padrao")
        .insert({ tipo: "editavel", mostrar: true, ...payload } as never)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as AetTextoPadraoCapitulo;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["aet-textos-padrao"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAetSalvarCapitulo() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id_capitulo,
      ...patch
    }: Partial<AetTextoPadraoCapitulo> & { id_capitulo: string }) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("aet_textos_padrao")
        .update({ ...patch, updated_at: new Date().toISOString() } as never)
        .eq("id_capitulo", id_capitulo);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["aet-textos-padrao"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAetSeedCapitulosFixos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (capitulos: AetTextoPadraoCapitulo[]) => {
      const supabase = createSupabaseBrowserClient();
      const FIXOS: { titulo: string; slug_fixo: string; ordem_global: number }[] = [
        { titulo: "Agentes Ambientais por Setor",       slug_fixo: "aet_agentes_ambientais",    ordem_global: 2000 },
        { titulo: "Análise Ergonômica do Trabalho",     slug_fixo: "aet_analise_ergonomica",    ordem_global: 2500 },
        { titulo: "Fatores Psicossociais (QPS)",        slug_fixo: "aet_psicossocial",          ordem_global: 4000 },
        { titulo: "Considerações Finais",               slug_fixo: "aet_consideracoes_finais",  ordem_global: 5000 },
        { titulo: "Assinatura do Responsável Técnico",  slug_fixo: "aet_assinatura",            ordem_global: 5500 },
      ];
      const existentes = new Set(capitulos.map((c) => c.slug_fixo).filter(Boolean));
      const novas = FIXOS.filter((f) => !existentes.has(f.slug_fixo));
      if (novas.length === 0) return 0;
      const rows = novas.map((f) => ({
        titulo: f.titulo,
        conteudo: null,
        tipo: "fixo" as const,
        slug_fixo: f.slug_fixo,
        ordem_global: f.ordem_global,
        mostrar: true,
        ordem: 0,
        posicao_pdf: null,
      }));
      const { error } = await supabase.from("aet_textos_padrao").insert(rows as never);
      if (error) throw error;
      return novas.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["aet-textos-padrao"] });
      if (n === 0) toast("Todos os capítulos do sistema já estão cadastrados.", { icon: "ℹ️" });
      else toast.success(`${n} capítulo(s) do sistema adicionado(s).`);
    },
    onError: () => toast.error("Erro ao adicionar capítulos do sistema"),
  });
}

export function useAetExcluirCapitulo() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id_capitulo: string) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("aet_textos_padrao")
        .delete()
        .eq("id_capitulo", id_capitulo);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["aet-textos-padrao"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ─── Config OWAS Categorias ──────────────────────────────────────────────────

export const SLUG_TO_OWAS_FIELD: Record<string, keyof AetOwas> = {
  costas: "posturas_costas",
  bracos: "posturas_bracos",
  pernas: "posturas_pernas",
  esforco: "esforco",
};

export const SLUG_TO_DEFAULT_IMAGE: Record<string, string> = {
  costas: "/owas/costas.svg",
  bracos: "/owas/bracos.svg",
  pernas: "/owas/pernas.svg",
  esforco: "/owas/esforco.svg",
};

export const OWAS_CATEGORIAS_PADRAO: AetOwasCategoria[] = [
  {
    id: "padrao-costas", slug: "costas", titulo: "Postura das Costas", imagem_url: null, ordem: 0,
    opcoes: [
      { value: 1, label: "1 – Ereta" },
      { value: 2, label: "2 – Inclinada" },
      { value: 3, label: "3 – Ereta e Torcida" },
      { value: 4, label: "4 – Inclinada e Torcida" },
    ],
  },
  {
    id: "padrao-bracos", slug: "bracos", titulo: "Postura dos Braços", imagem_url: null, ordem: 1,
    opcoes: [
      { value: 1, label: "1 – Os dois braços abaixo dos ombros" },
      { value: 2, label: "2 – Um braço no nível ou acima dos ombros" },
      { value: 3, label: "3 – Ambos braços no nível ou acima dos ombros" },
    ],
  },
  {
    id: "padrao-pernas", slug: "pernas", titulo: "Postura das Pernas", imagem_url: null, ordem: 2,
    opcoes: [
      { value: 1, label: "1 – Sentado" },
      { value: 2, label: "2 – De pé com ambas as pernas esticadas" },
      { value: 3, label: "3 – De pé com o peso de uma das pernas esticada" },
      { value: 4, label: "4 – De pé ou agachado com ambos os joelhos flexionados" },
      { value: 5, label: "5 – De pé ou agachado com um dos joelhos dobrados" },
      { value: 6, label: "6 – Ajoelhado em um ou ambos os joelhos" },
      { value: 7, label: "7 – Andando ou se movendo" },
    ],
  },
  {
    id: "padrao-esforco", slug: "esforco", titulo: "Esforço", imagem_url: null, ordem: 3,
    opcoes: [
      { value: 1, label: "1 – Carga ≤ 10 kg" },
      { value: 2, label: "2 – Carga > 10 kg e ≤ 20 kg" },
      { value: 3, label: "3 – Carga > 20 kg" },
    ],
  },
];

export function useAetOwasConfig() {
  return useQuery({
    queryKey: ["aet-owas-config"],
    queryFn: async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("aet_owas_categorias")
          .select("*")
          .order("ordem");
        if (error) return OWAS_CATEGORIAS_PADRAO;
        return data.length > 0 ? (data as AetOwasCategoria[]) : OWAS_CATEGORIAS_PADRAO;
      } catch {
        return OWAS_CATEGORIAS_PADRAO;
      }
    },
    placeholderData: OWAS_CATEGORIAS_PADRAO,
    staleTime: 30_000,
  });
}

export function useAetSalvarOwasCategoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<AetOwasCategoria> & { id: string }) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("aet_owas_categorias")
        .update(patch as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["aet-owas-config"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAetInicializarOwasConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const supabase = createSupabaseBrowserClient();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const rows = OWAS_CATEGORIAS_PADRAO.map(({ id: _, ...rest }) => rest);
      const { error } = await supabase
        .from("aet_owas_categorias")
        .insert(rows as never);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["aet-owas-config"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

// ─── Config OWAS — Campos de Seleção ─────────────────────────────────────────

export const OWAS_SELECTS_PADRAO: AetOwasSelectCampo[] = [
  {
    slug: "trabalho_predominante",
    label: "O trabalho executado durante aos chamados decorrentes do dia-dia, são realizados preponderantemente de qual forma?",
    opcoes: ["Em pé", "Sentado", "Alternando entre postura em pé e sentado"],
  },
];

export function useAetOwasSelects() {
  return useQuery({
    queryKey: ["aet-owas-selects"],
    queryFn: async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("aet_owas_select_campos")
          .select("*");
        if (error) return OWAS_SELECTS_PADRAO;
        return data.length > 0 ? (data as AetOwasSelectCampo[]) : OWAS_SELECTS_PADRAO;
      } catch {
        return OWAS_SELECTS_PADRAO;
      }
    },
    placeholderData: OWAS_SELECTS_PADRAO,
    staleTime: 30_000,
  });
}

export function useAetSalvarOwasSelect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (campo: AetOwasSelectCampo) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("aet_owas_select_campos")
        .upsert(campo as never, { onConflict: "slug" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["aet-owas-selects"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAetInicializarOwasSelects() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const supabase = createSupabaseBrowserClient();
      await supabase.from("aet_owas_select_campos").delete().neq("slug", "");
      const { error } = await supabase
        .from("aet_owas_select_campos")
        .insert(OWAS_SELECTS_PADRAO as never);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["aet-owas-selects"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

// ─── Checklist — Perguntas configuráveis ─────────────────────────────────────

export const CHECKLIST_PERGUNTAS_PADRAO: AetChecklistPergunta[] = [
  { slug: "levantamento_acima_limite", secao: "Postura", tipo: "tristate", label: "Há registros de levantamento, transporte e descarga de materiais nesta atividade acima do limite recomendado?" },
  { slug: "pausas_descanso", secao: "Postura", tipo: "tristate", label: "Caso a resposta anterior seja \"em pé\" a empresa oferece pausas para descanso ou disponibiliza cadeiras do tipo semi-sentado?" },
  { slug: "uso_cadeira", secao: "Postura", tipo: "tristate", label: "Para execução das atividades do dia-dia é disponibilizado o uso de cadeira?" },
  { slug: "cadeira_adequada", secao: "Postura", tipo: "tristate", label: "A cadeira é estofada e revestida, possui conformação de base giratória, o assento possui altura ajustável, possui ajustes de altura e inclinação, bordas do assento e apoio de coluna arredondadas e em formato anatômico?" },
  { slug: "monitor", secao: "Postura", tipo: "tristate", label: "A Atividade necessita uso de monitor fixo sobre a mesa, caso positivo este apresenta regulagens de altura e inclinação?" },
  { slug: "organizacao_trabalho", secao: "Organização do Trabalho", tipo: "texto", label: "As normas de produção contemplando equipamentos, modo operatório, aspectos de segurança e qualidade deverão estar descritos nas instruções internas de trabalho, elaboradas pela empresa." },
  { slug: "exigencia_levantamento", secao: "Exigência de Tempo", tipo: "tristate", label: "Há registros de levantamento, transporte e descarga de materiais nesta atividade acima do limite recomendado?" },
  { slug: "ritmo_por_demanda", secao: "Ritmo de Trabalho", tipo: "tristate", label: "O ritmo de trabalho é determinado pela demanda de trabalho?" },
  { slug: "pausas_formais", secao: "Adoção de Rodízios - Ergonômico", tipo: "tristate", label: "Há pausas formais durante o ciclo de trabalho?" },
  { slug: "rodizios_sistematizados", secao: "Adoção de Rodízios - Ergonômico", tipo: "tristate", label: "Há rodízios sistematizados entre os postos de trabalho?" },
];

export function useAetChecklistPerguntas() {
  return useQuery({
    queryKey: ["aet-checklist-perguntas"],
    queryFn: async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase.from("aet_checklist_perguntas").select("*");
        if (error) return CHECKLIST_PERGUNTAS_PADRAO;
        return data.length > 0 ? (data as AetChecklistPergunta[]) : CHECKLIST_PERGUNTAS_PADRAO;
      } catch {
        return CHECKLIST_PERGUNTAS_PADRAO;
      }
    },
    placeholderData: CHECKLIST_PERGUNTAS_PADRAO,
    staleTime: 30_000,
  });
}

export function useAetSalvarChecklistPergunta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (pergunta: AetChecklistPergunta) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("aet_checklist_perguntas")
        .upsert(pergunta as never, { onConflict: "slug" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["aet-checklist-perguntas"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAetInicializarChecklistPerguntas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const supabase = createSupabaseBrowserClient();
      await supabase.from("aet_checklist_perguntas").delete().neq("slug", "");
      const { error } = await supabase
        .from("aet_checklist_perguntas")
        .insert(CHECKLIST_PERGUNTAS_PADRAO as never);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["aet-checklist-perguntas"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAetDeletarChecklistPergunta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (slug: string) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("aet_checklist_perguntas")
        .delete()
        .eq("slug", slug);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["aet-checklist-perguntas"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

// ─── Perfis OWAS ─────────────────────────────────────────────────────────────

export function useAetPerfisOwas() {
  return useQuery({
    queryKey: ["aet-perfis-owas"],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("aet_perfis_owas")
        .select("*")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as AetPerfilOwas[];
    },
  });
}

export function useAetCriarPerfilOwas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<AetPerfilOwas, "id" | "created_at">) => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("aet_perfis_owas")
        .insert(payload as never)
        .select()
        .single();
      if (error) throw error;
      return data as AetPerfilOwas;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["aet-perfis-owas"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAetSalvarPerfilOwas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<AetPerfilOwas> & { id: string }) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("aet_perfis_owas")
        .update(patch as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["aet-perfis-owas"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAetExcluirPerfilOwas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("aet_perfis_owas")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["aet-perfis-owas"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function setorVazio(): AetSetor {
  return {
    id: crypto.randomUUID(),
    nome_setor: "",
    funcao: "",
    maquinas_equipamentos: "",
    cargos: [],
    descricao_atividade: "",
    riscos: [],
    owas: { posturas_costas: [], posturas_bracos: [], posturas_pernas: [], esforco: [] },
    checklist: {
      levantamento_acima_limite: "nao",
      posturas_forcadas_tipo: "Ocasionais",
      trabalho_predominante: "Em pé",
      pausas_descanso: "nao",
      uso_cadeira: "nao",
      cadeira_adequada: "nao",
      monitor: "nao",
      exigencia_levantamento: "nao",
      ritmo_por_demanda: "nao",
      pausas_formais: "nao",
      rodizios_sistematizados: "nao",
    },
    respostas_extras: {},
    fotos: [],
    parecer_tecnico: "",
    recomendacoes: "",
    demais_condicoes: "",
  };
}

// ─── 13 Fatores PSI — Defaults ────────────────────────────────────────────────

export const FATORES_DEFAULT: Aet13FatorConfig[] = [
  { codigo: "F01", ordem: 1,  nome: "Assédio de qualquer natureza no trabalho",       descricao: "Comportamentos abusivos, repetitivos ou pontuais de natureza moral, sexual ou discriminatória que violam a dignidade do trabalhador.",                                 perigos_tipicos: "Cultura permissiva ao desrespeito; ausência de canal de denúncia; liderança despreparada; comunicação violenta.",                                  possiveis_danos: "Transtornos ansiosos, depressão, TEPT, afastamentos por transtornos mentais, adoecimento coletivo.",                       foco_plano: "Prevenção e combate ao assédio",           acao_plano: "Implantar canal de denúncia sigiloso (Lei 14.457/2022). Treinar CIPA e lideranças. Tolerância zero documentada. Protocolo de investigação.",                                            responsavel_plano: "Compliance + RH + CIPA", prazo_plano: "30 dias"      },
  { codigo: "F02", ordem: 2,  nome: "Falta de suporte / apoio no trabalho",            descricao: "Ausência de rede de apoio formal e informal — liderança ausente, RH pouco atuante, colegas sem solidariedade — que deixa o trabalhador sem amparo diante de dificuldades.", perigos_tipicos: "Liderança ausente; falta de escuta; cobrança sem acompanhamento; RH pouco atuante.",                                                                possiveis_danos: "Burnout, depressão, ansiedade, isolamento, absenteísmo elevado.",                                                       foco_plano: "Suporte e apoio ao trabalhador",           acao_plano: "Implantar PAE com atendimento psicológico sigiloso. Capacitar lideranças em escuta ativa e primeiros socorros psicológicos. Criar canais de suporte.",                                   responsavel_plano: "SESMT + RH",             prazo_plano: "90 dias"      },
  { codigo: "F03", ordem: 3,  nome: "Má gestão de mudanças organizacionais",           descricao: "Processos de reestruturação, implantação de sistemas ou alteração de processos comunicados de forma inadequada, sem participação dos trabalhadores ou sem suporte.",      perigos_tipicos: "Comunicação inadequada; mudanças abruptas; falta de planejamento; insegurança quanto à estabilidade do emprego.",                                 possiveis_danos: "Ansiedade crônica, insegurança, resistência, sobrecarga durante transições, síndrome do sobrevivente.",                  foco_plano: "Gestão participativa de mudanças",         acao_plano: "Comunicar mudanças com antecedência mínima de 7 dias. Consultar trabalhadores antes da implementação. Oferecer suporte e treinamento durante transições.",                          responsavel_plano: "Gestão + RH",            prazo_plano: "90 dias"      },
  { codigo: "F04", ordem: 4,  nome: "Baixa clareza de papel / função",                 descricao: "Falta de definição clara de responsabilidades, critérios de avaliação e nível de autoridade — o trabalhador não sabe exatamente o que se espera dele.",                   perigos_tipicos: "Ausência de descrição de cargo; ordens contraditórias de múltiplos gestores; comunicação confusa; atribuições mal definidas.",                   possiveis_danos: "Ansiedade, erros por ambiguidade, conflitos interpessoais, baixo desempenho.",                                           foco_plano: "Definição clara de papéis e funções",      acao_plano: "Formalizar descrições de cargo atualizadas. Onboarding estruturado. Reuniões semanais de alinhamento. Estabelecer canal único de instrução por tarefa.",                             responsavel_plano: "RH + Gestão",            prazo_plano: "90 dias"      },
  { codigo: "F05", ordem: 5,  nome: "Baixas recompensas e reconhecimento",             descricao: "Desequilíbrio entre o esforço investido e a recompensa recebida — financeira, simbólica, de status ou oportunidade de desenvolvimento.",                                  perigos_tipicos: "Ausência de feedback positivo; critérios de promoção opacos; reconhecimento desigual; falta de plano de crescimento.",                          possiveis_danos: "Desmotivação, ressentimento, depressão, queda de engajamento, turnover elevado.",                                        foco_plano: "Reconhecimento e recompensa",               acao_plano: "Ritual mensal de feedback (1:1). Programa de reconhecimento simbólico. Revisar critérios de progressão. Capacitar lideranças em feedback construtivo.",                               responsavel_plano: "RH",                     prazo_plano: "120 dias"     },
  { codigo: "F06", ordem: 6,  nome: "Baixo controle no trabalho / Falta de autonomia", descricao: "Grau insuficiente de controle sobre como, quando e com que métodos o trabalhador executa seu trabalho — relacionado ao modelo Demanda-Controle de Karasek.",               perigos_tipicos: "Microgestão; excesso de burocracia; centralização de decisões; prescrição total do método; baixa confiança na equipe.",                           possiveis_danos: "Estresse crônico, risco cardiovascular elevado (Karasek), perda de iniciativa, burnout.",                                foco_plano: "Autonomia e controle no trabalho",          acao_plano: "Ampliar margem de decisão por função. Reduzir burocracia em tarefas rotineiras. Abolir microgestão e controle minuto-a-minuto. Gestão por resultados.",                               responsavel_plano: "Gestão",                 prazo_plano: "90 dias"      },
  { codigo: "F07", ordem: 7,  nome: "Baixa justiça organizacional",                    descricao: "Percepção de injustiça nos processos decisórios, critérios de avaliação, promoção e desligamento — falta de transparência e equidade nas práticas organizacionais.",       perigos_tipicos: "Critérios pouco transparentes; favorecimento; desigualdade de tratamento entre áreas ou grupos; decisões pouco claras.",                         possiveis_danos: "Desmotivação, ressentimento coletivo, conflitos, depressão, síndrome de burnout.",                                       foco_plano: "Equidade e transparência organizacional",  acao_plano: "Publicar critérios claros de avaliação e progressão. Diagnóstico anual de clima com devolutiva. Aplicação equânime de regras.",                                                      responsavel_plano: "RH + Direção",           prazo_plano: "120 dias"     },
  { codigo: "F08", ordem: 8,  nome: "Eventos violentos ou traumáticos",                descricao: "Exposição a situações de violência física ou psicológica, acidentes graves, ameaças ou eventos com alto impacto emocional no ambiente de trabalho.",                       perigos_tipicos: "Falta de protocolos de segurança; exposição a risco sem preparo; ausência de treinamento; falta de suporte pós-evento.",                        possiveis_danos: "TEPT, depressão grave, ansiedade antecipatória, afastamentos prolongados.",                                              foco_plano: "Proteção contra violência e trauma",       acao_plano: "Protocolo de prevenção e resposta a eventos violentos. Treinamento para situações de conflito com clientes. Suporte psicológico imediato pós-incidente.",                            responsavel_plano: "SESMT + RH",             prazo_plano: "30 dias"      },
  { codigo: "F09", ordem: 9,  nome: "Baixa demanda no trabalho (Subcarga)",            descricao: "Condição em que o volume e a complexidade das tarefas ficam sistematicamente abaixo da capacidade do trabalhador — subutilização de competências e ociosidade.",          perigos_tipicos: "Subutilização de competências; ociosidade; má distribuição de tarefas; funções pouco desafiadoras.",                                             possiveis_danos: "Desmotivação, perda de sentido, ansiedade por inutilidade, turnover.",                                                   foco_plano: "Adequação da demanda e uso de competências", acao_plano: "Redistribuir tarefas equilibrando carga. Enriquecer funções com responsabilidades alinhadas ao perfil. Mapear competências e atribuir projetos compatíveis.",               responsavel_plano: "RH + Gestão",            prazo_plano: "90 dias"      },
  { codigo: "F10", ordem: 10, nome: "Excesso de demandas no trabalho (Sobrecarga)",    descricao: "Volume e complexidade de tarefas que regularmente excede a capacidade disponível — metas irrealistas, equipe insuficiente, jornadas prolongadas e acúmulo de funções.", perigos_tipicos: "Metas irrealistas; equipe insuficiente; jornadas prolongadas; acúmulo de funções não compensado.",                                                possiveis_danos: "Burnout, doenças cardiovasculares, distúrbios do sono, acidentes por fadiga, absenteísmo.",                             foco_plano: "Gestão de carga de trabalho",              acao_plano: "Revisar dimensionamento da equipe. Ajustar metas. Garantir pausas (NR-17). Política de horas extras com limite mensal. Redistribuir picos de demanda.",                              responsavel_plano: "RH + Gestão",            prazo_plano: "60 dias"      },
  { codigo: "F11", ordem: 11, nome: "Maus relacionamentos no local de trabalho",       descricao: "Padrões disfuncionais de interação — conflitos crônicos, rivalidade excessiva, comunicação agressiva ou ambiente de hostilidade entre colegas e/ou com a liderança.",    perigos_tipicos: "Comunicação agressiva; rivalidade interna; conflitos mal geridos; liderança despreparada para mediação.",                                         possiveis_danos: "Sofrimento psíquico, baixo desempenho, absenteísmo, ambiente tóxico, pedidos de demissão.",                             foco_plano: "Clima e relacionamentos saudáveis",         acao_plano: "Workshops de comunicação não-violenta. Protocolo de mediação de conflitos. Capacitar lideranças. Pesquisa de clima com ações de melhoria documentadas.",                           responsavel_plano: "RH + CIPA",              prazo_plano: "120 dias"     },
  { codigo: "F12", ordem: 12, nome: "Trabalho em condições de difícil comunicação",    descricao: "Condições estruturais de trabalho — turnos desalinhados, distância física, ruído intenso ou ausência de meios — que dificultam a troca de informações essenciais.",      perigos_tipicos: "Turnos desalinhados; distância física entre equipes; falha nos meios de comunicação; fluxo de informação inadequado.",                          possiveis_danos: "Erros operacionais, acidentes por falha de comunicação, isolamento, desinformação crônica.",                            foco_plano: "Comunicação eficaz em contexto de trabalho", acao_plano: "Implantar meios de comunicação adequados ao contexto. Procedimentos claros de repasse de informação em troca de turnos. Verifcar acessibilidade dos canais.",            responsavel_plano: "Gestão + SESMT",         prazo_plano: "60 dias"      },
  { codigo: "F13", ordem: 13, nome: "Trabalho remoto e isolado",                       descricao: "Trabalhadores que atuam predominantemente de forma remota ou fisicamente isolada, com reduzido contato presencial com colegas e liderança.",                              perigos_tipicos: "Isolamento social; falta de acompanhamento; comunicação exclusivamente digital; baixa integração da equipe remota.",                             possiveis_danos: "Ansiedade, solidão, desmotivação, falta de pertencimento, dificuldade de separação trabalho-vida pessoal.",              foco_plano: "Suporte ao trabalho remoto e isolado",      acao_plano: "Protocolo de check-in regular com trabalhadores remotos. Encontros presenciais periódicos. Ferramentas de comunicação adequadas. Suporte psicossocial específico para remotos.",  responsavel_plano: "RH + Gestão",            prazo_plano: "60 dias"      },
];

export const PERGUNTAS_DEFAULT: Omit<Aet13FatorPergunta, "id" | "updated_at">[] = [
  // F01 — Assédio de qualquer natureza no trabalho
  { codigo_fator: "F01", texto: "Você já presenciou ou sofreu comentários ofensivos, piadas ou insinuações inadequadas no ambiente de trabalho?", logica: "direta", ordem: 1 },
  { codigo_fator: "F01", texto: "Você se sente à vontade para relatar situações de assédio moral ou sexual na empresa sem medo de represálias?", logica: "invertida", ordem: 2 },
  { codigo_fator: "F01", texto: "Existe um canal seguro e sigiloso para denunciar assédio na empresa?", logica: "invertida", ordem: 3 },
  { codigo_fator: "F01", texto: "Há casos conhecidos de assédio moral ou sexual que não foram devidamente investigados ou punidos?", logica: "direta", ordem: 4 },
  { codigo_fator: "F01", texto: "O RH e os gestores demonstram comprometimento real com a prevenção do assédio?", logica: "invertida", ordem: 5 },
  // F02 — Falta de suporte / apoio no trabalho
  { codigo_fator: "F02", texto: "Você sente que pode contar com seus colegas em momentos de dificuldade?", logica: "invertida", ordem: 6 },
  { codigo_fator: "F02", texto: "Existe apoio da liderança para lidar com desafios relacionados ao trabalho?", logica: "invertida", ordem: 7 },
  { codigo_fator: "F02", texto: "O RH está presente e atuante quando surgem conflitos ou dificuldades no trabalho?", logica: "invertida", ordem: 8 },
  { codigo_fator: "F02", texto: "Os gestores promovem um ambiente saudável e respeitoso?", logica: "invertida", ordem: 9 },
  { codigo_fator: "F02", texto: "Você sente que pode expressar suas dificuldades no trabalho sem ser julgado(a)?", logica: "invertida", ordem: 10 },
  // F03 — Má gestão de mudanças organizacionais
  { codigo_fator: "F03", texto: "Mudanças organizacionais impactaram negativamente seu sentimento de segurança no trabalho?", logica: "direta", ordem: 11 },
  { codigo_fator: "F03", texto: "Há comunicação clara sobre mudanças que afetam a empresa ou os trabalhadores?", logica: "invertida", ordem: 12 },
  { codigo_fator: "F03", texto: "Você já sentiu que seu emprego estava ameaçado sem explicações claras durante períodos de mudança?", logica: "direta", ordem: 13 },
  { codigo_fator: "F03", texto: "Existe transparência na comunicação da empresa durante processos de mudança?", logica: "invertida", ordem: 14 },
  // F04 — Baixa clareza de papel / função
  { codigo_fator: "F04", texto: "Você recebe instruções claras sobre suas responsabilidades no trabalho?", logica: "invertida", ordem: 15 },
  { codigo_fator: "F04", texto: "A comunicação da empresa ajuda você a entender o que é esperado do seu trabalho?", logica: "invertida", ordem: 16 },
  { codigo_fator: "F04", texto: "A comunicação entre equipes e setores contribui para a clareza das suas tarefas?", logica: "invertida", ordem: 17 },
  { codigo_fator: "F04", texto: "Você se sente confortável para pedir esclarecimentos quando não entende suas funções ou prioridades?", logica: "invertida", ordem: 18 },
  // F05 — Baixas recompensas e reconhecimento
  { codigo_fator: "F05", texto: "Você sente que seu esforço e desempenho são reconhecidos pela liderança?", logica: "invertida", ordem: 19 },
  { codigo_fator: "F05", texto: "Você recebe feedback construtivo sobre o seu trabalho com regularidade?", logica: "invertida", ordem: 20 },
  { codigo_fator: "F05", texto: "Com que frequência você já se sentiu desmotivado(a) por falta de reconhecimento no trabalho?", logica: "direta", ordem: 21 },
  // F06 — Baixo controle no trabalho / Falta de autonomia
  { codigo_fator: "F06", texto: "Você tem liberdade para tomar decisões sobre como executar suas tarefas diárias?", logica: "invertida", ordem: 22 },
  { codigo_fator: "F06", texto: "A empresa confia na sua capacidade de organizar e gerenciar o próprio trabalho?", logica: "invertida", ordem: 23 },
  { codigo_fator: "F06", texto: "Existe excesso de controle ou burocracia que interfere no seu desempenho?", logica: "direta", ordem: 24 },
  { codigo_fator: "F06", texto: "Existe excesso de supervisão que impacte negativamente sua produtividade ou bem-estar?", logica: "direta", ordem: 25 },
  // F07 — Baixa justiça organizacional
  { codigo_fator: "F07", texto: "Você acha justas e claras as formas que a empresa usa para avaliar o seu trabalho?", logica: "invertida", ordem: 26 },
  { codigo_fator: "F07", texto: "Você sente que há igualdade no reconhecimento entre diferentes áreas ou equipes?", logica: "invertida", ordem: 27 },
  { codigo_fator: "F07", texto: "Você sente que há transparência nas decisões de desligamento na empresa?", logica: "invertida", ordem: 28 },
  { codigo_fator: "F07", texto: "Você já presenciou casos de demissões que considerasse injustas?", logica: "direta", ordem: 29 },
  // F08 — Eventos violentos ou traumáticos
  { codigo_fator: "F08", texto: "Você já vivenciou ou presenciou alguma situação de violência grave no trabalho (como agressão física, ameaça séria ou ataque)?", logica: "direta", ordem: 30 },
  { codigo_fator: "F08", texto: "Você já passou por algum evento grave no trabalho (como acidente sério, situação de risco extremo ou episódio muito impactante)?", logica: "direta", ordem: 31 },
  { codigo_fator: "F08", texto: "Alguma situação vivida no trabalho já foi tão marcante que deixou medo, choque ou forte abalo emocional?", logica: "direta", ordem: 32 },
  // F09 — Baixa demanda no trabalho (Subcarga)
  { codigo_fator: "F09", texto: "Você sente que, na maior parte do tempo, tem pouco trabalho a realizar durante sua jornada?", logica: "direta", ordem: 33 },
  { codigo_fator: "F09", texto: "Você costuma ficar com tempo ocioso no trabalho por falta de tarefas ou demandas claras?", logica: "direta", ordem: 34 },
  { codigo_fator: "F09", texto: "Você sente que suas habilidades ou conhecimentos são pouco utilizados no seu trabalho?", logica: "direta", ordem: 35 },
  { codigo_fator: "F09", texto: "Seu trabalho costuma ser pouco desafiador ou repetitivo a ponto de gerar desânimo?", logica: "direta", ordem: 36 },
  // F10 — Excesso de demandas no trabalho (Sobrecarga)
  { codigo_fator: "F10", texto: "Você sente que sua carga de trabalho diária é maior do que consegue realizar dentro do horário normal?", logica: "direta", ordem: 37 },
  { codigo_fator: "F10", texto: "Você frequentemente precisa fazer horas extras ou levar trabalho para casa?", logica: "direta", ordem: 38 },
  { codigo_fator: "F10", texto: "Você já teve sintomas físicos ou emocionais (como exaustão, ansiedade ou insônia) devido ao excesso de trabalho?", logica: "direta", ordem: 39 },
  { codigo_fator: "F10", texto: "A equipe é dimensionada corretamente para a demanda/quantidade de trabalho existente?", logica: "invertida", ordem: 40 },
  // F11 — Maus relacionamentos no local de trabalho
  { codigo_fator: "F11", texto: "Você já evitou colegas ou superiores por causa de desentendimentos frequentes?", logica: "direta", ordem: 41 },
  { codigo_fator: "F11", texto: "Você percebe rivalidade excessiva ou desnecessária entre colegas ou setores?", logica: "direta", ordem: 42 },
  { codigo_fator: "F11", texto: "Conflitos no trabalho costumam ser resolvidos de forma justa?", logica: "invertida", ordem: 43 },
  // F12 — Trabalho em condições de difícil comunicação
  { codigo_fator: "F12", texto: "Você trabalha em condições (como turnos diferentes, trabalho externo ou distância física) que dificultam a comunicação no trabalho?", logica: "direta", ordem: 44 },
  { codigo_fator: "F12", texto: "A distância física entre você e sua equipe ou liderança dificulta a troca de informações?", logica: "direta", ordem: 45 },
  { codigo_fator: "F12", texto: "Você já teve dificuldade para receber informações importantes no momento certo por causa da organização do trabalho?", logica: "direta", ordem: 46 },
  { codigo_fator: "F12", texto: "Você tem acesso fácil aos meios necessários para se comunicar com colegas e liderança durante o trabalho?", logica: "invertida", ordem: 47 },
  // F13 — Trabalho remoto e isolado
  { codigo_fator: "F13", texto: "Você trabalha grande parte do tempo de forma remota ou sozinho(a), com pouco contato presencial com colegas ou liderança?", logica: "direta", ordem: 48 },
  { codigo_fator: "F13", texto: "Você sente que o trabalho remoto ou isolado faz com que se sinta distante da equipe ou da empresa?", logica: "direta", ordem: 49 },
  { codigo_fator: "F13", texto: "Se você trabalha de forma remota ou isolada, você sente que recebe apoio e acompanhamento adequados da empresa?", logica: "invertida", ordem: 50 },
];

export const SEMAFORO_DEFAULT: Aet13FatorSemaforo[] = [
  { id: "verde",   label: "Verde — Satisfatório",  min_score: 4.0,  max_score: null, nivel_pgr: "Trivial",  prazo_texto: "Monitoramento", cor_fundo: "#E8F5E9", cor_texto: "#1B5E20" },
  { id: "amarela", label: "Amarela — Atenção",     min_score: 3.0,  max_score: 3.99, nivel_pgr: "Moderado", prazo_texto: "180 dias",      cor_fundo: "#FFF9C4", cor_texto: "#F57F17" },
  { id: "laranja", label: "Laranja — Elevado",     min_score: 2.0,  max_score: 2.99, nivel_pgr: "Alto",     prazo_texto: "90 dias",       cor_fundo: "#FFE0B2", cor_texto: "#E65100" },
  { id: "vermelha",label: "Vermelha — Crítico",    min_score: null, max_score: 1.99, nivel_pgr: "Crítico",  prazo_texto: "30 dias",       cor_fundo: "#FFEBEE", cor_texto: "#C62828" },
];

export function zonaFromMedia(media: number | null): ZonaPsi | null {
  if (media === null) return null;
  if (media >= 4.0) return "verde";
  if (media >= 3.0) return "amarela";
  if (media >= 2.0) return "laranja";
  return "vermelha";
}

export function nivelPgrFromZona(zona: ZonaPsi | null): string {
  if (zona === "vermelha") return "Crítico";
  if (zona === "laranja")  return "Alto";
  if (zona === "amarela")  return "Moderado";
  if (zona === "verde")    return "Trivial";
  return "—";
}

// ─── 13 Fatores PSI — Hooks: Config ──────────────────────────────────────────

export function useAet13FatoresConfig() {
  return useQuery({
    queryKey: ["aet-13fatores-config"],
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("aet_13fatores_config")
        .select("*")
        .order("ordem");
      if (error) throw error;
      if (!data || data.length === 0) return FATORES_DEFAULT;
      return data as Aet13FatorConfig[];
    },
  });
}

export function useAet13FatoresSalvarConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (fatores: Aet13FatorConfig[]) => {
      const sb = createSupabaseBrowserClient();
      const { error } = await sb.from("aet_13fatores_config").upsert(fatores as never, { onConflict: "codigo" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["aet-13fatores-config"] });
      toast.success("Configuração salva");
    },
    onError: () => toast.error("Erro ao salvar"),
  });
}

export function useAet13FatoresRestaurarConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { error } = await sb.from("aet_13fatores_config").upsert(FATORES_DEFAULT as never, { onConflict: "codigo" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["aet-13fatores-config"] });
      toast.success("Padrão restaurado");
    },
    onError: () => toast.error("Erro ao restaurar"),
  });
}

export function useAet13FatoresPerguntas() {
  return useQuery({
    queryKey: ["aet-13fatores-perguntas"],
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("aet_13fatores_perguntas")
        .select("*")
        .order("ordem");
      if (error) throw error;
      if (!data || data.length === 0) return PERGUNTAS_DEFAULT.map((p, i) => ({ ...p, id: String(i), updated_at: undefined })) as Aet13FatorPergunta[];
      return data as Aet13FatorPergunta[];
    },
  });
}

export function useAet13FatoresSalvarPerguntas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (perguntas: Omit<Aet13FatorPergunta, "updated_at">[]) => {
      const sb = createSupabaseBrowserClient();
      const rows = perguntas.map(({ id: _id, ...p }, i) => ({ ...p, ordem: i + 1 }));
      // RPC executa delete+insert em uma única transação — evita perda de dados se o insert falhar
      const { error } = await sb.rpc("salvar_aet13fatores_perguntas" as never, { p_rows: rows } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["aet-13fatores-perguntas"] });
      toast.success("Perguntas salvas");
    },
    onError: () => toast.error("Erro ao salvar perguntas"),
  });
}

export function useAet13FatoresRestaurarPerguntas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { error } = await sb.rpc("salvar_aet13fatores_perguntas" as never, { p_rows: PERGUNTAS_DEFAULT } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["aet-13fatores-perguntas"] });
      toast.success("Perguntas restauradas ao padrão");
    },
    onError: () => toast.error("Erro ao restaurar"),
  });
}

export function useAet13FatoresSemaforo() {
  return useQuery({
    queryKey: ["aet-13fatores-semaforo"],
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb.from("aet_13fatores_semaforo").select("*");
      if (error) throw error;
      if (!data || data.length === 0) return SEMAFORO_DEFAULT;
      return data as Aet13FatorSemaforo[];
    },
  });
}

export function useAet13FatoresSalvarSemaforo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: Aet13FatorSemaforo[]) => {
      const sb = createSupabaseBrowserClient();
      const { error } = await sb.from("aet_13fatores_semaforo").upsert(rows as never, { onConflict: "id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["aet-13fatores-semaforo"] });
      toast.success("Semáforo salvo");
    },
    onError: () => toast.error("Erro ao salvar semáforo"),
  });
}

// ─── 13 Fatores PSI — Hooks: Laudo ───────────────────────────────────────────

export function useAetLaudoQpsMeta(idRelatorio: string | null) {
  return useQuery({
    queryKey: ["aet-laudo-qps-meta", idRelatorio],
    enabled: !!idRelatorio,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data } = await sb
        .from("aet_laudo_qps_meta")
        .select("*")
        .eq("id_relatorio", idRelatorio!)
        .maybeSingle();
      return (data ?? null) as AetLaudoQpsMeta | null;
    },
  });
}

export function useAetSalvarQpsMeta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (meta: AetLaudoQpsMeta) => {
      const sb = createSupabaseBrowserClient();
      const { error } = await sb
        .from("aet_laudo_qps_meta")
        .upsert(meta as never, { onConflict: "id_relatorio" });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["aet-laudo-qps-meta", v.id_relatorio] });
      toast.success("Metadados QPS salvos");
    },
    onError: () => toast.error("Erro ao salvar"),
  });
}

export function useAetLaudoFatoresPsi(idRelatorio: string | null) {
  return useQuery({
    queryKey: ["aet-laudo-fatores-psi", idRelatorio],
    enabled: !!idRelatorio,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("aet_laudo_fatores_psi")
        .select("*")
        .eq("id_relatorio", idRelatorio!)
        .order("codigo_fator");
      if (error) throw error;
      return (data ?? []) as AetLaudoFatorPsi[];
    },
  });
}

export function useAetSalvarFatorPsi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: Omit<AetLaudoFatorPsi, "updated_at">) => {
      const sb = createSupabaseBrowserClient();
      const { error } = await sb
        .from("aet_laudo_fatores_psi")
        .upsert(row as never, { onConflict: "id_relatorio,codigo_fator" });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["aet-laudo-fatores-psi", v.id_relatorio] });
    },
    onError: () => toast.error("Erro ao salvar fator"),
  });
}

// ─── QPS Respostas por Setor ──────────────────────────────────────────────────

export function useAetQpsRespostas(idRelatorio: string | null) {
  return useQuery({
    queryKey: ["aet-qps-respostas", idRelatorio],
    enabled: !!idRelatorio,
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("aet_laudo_qps_respostas")
        .select("*")
        .eq("id_relatorio", idRelatorio!);
      if (error) throw error;
      return (data ?? []) as AetLaudoQpsResposta[];
    },
  });
}

export function useAetSalvarRespostasFator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: AetLaudoQpsResposta[]) => {
      if (rows.length === 0) return;
      const sb = createSupabaseBrowserClient();
      const { error } = await sb
        .from("aet_laudo_qps_respostas")
        .upsert(rows as never, { onConflict: "id_relatorio,id_setor,codigo_fator,pergunta_ordem" });
      if (error) throw error;
    },
    onSuccess: (_d, rows) => {
      if (rows.length > 0)
        qc.invalidateQueries({ queryKey: ["aet-qps-respostas", rows[0].id_relatorio] });
    },
    onError: () => toast.error("Erro ao salvar respostas"),
  });
}
