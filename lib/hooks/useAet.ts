"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUserStore } from "@/lib/store";
import type { AetCargo, AetChecklist, AetChecklistPergunta, AetOwas, AetOwasCategoria, AetOwasSelectCampo, AetPerfilOwas, AetRelatorio, AetSetor, AetTextoPadraoCapitulo, RespostaChecklist, StatusAET } from "@/lib/supabase/types";

function normalizarCargos(raw: unknown): AetCargo[] {
  if (Array.isArray(raw)) return raw as AetCargo[];
  if (typeof raw === "string" && raw.trim())
    return raw.split("\n").filter(Boolean).map((nome) => ({ nome, descricao: "" }));
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
    },
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
    }) => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("aet_textos_padrao")
        .insert(payload as never)
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
      const rows = OWAS_CATEGORIAS_PADRAO.map(({ id: _id, ...rest }) => rest);
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
