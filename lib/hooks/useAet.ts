"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUserStore } from "@/lib/store";
import type { Aet13FatorConfig, Aet13FatorPergunta, Aet13FatorSemaforo, AetCargo, AetChecklist, AetChecklistPergunta, AetLaudoFatorPsi, AetLaudoQpsMeta, AetLaudoQpsResposta, AetOwas, AetOwasCategoria, AetOwasSelectCampo, AetPerfilOwas, AetRelatorio, AetSetor, AetTextoPadraoCapitulo, RespostaChecklist, StatusAET, ZonaPsi } from "@/lib/supabase/types";

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
  { codigo: "F01", ordem: 1, nome: "Cultura organizacional", descricao: "Conjunto de valores, crenças e práticas compartilhadas — confiança, honestidade, justiça.", perigos_tipicos: "Regras aplicadas de forma desigual; falta de transparência; valores declarados x praticados.", possiveis_danos: "Desmotivação, conflitos, síndrome de burnout, rotatividade elevada.", foco_plano: "Cultura organizacional", acao_plano: "Publicar e disseminar código de conduta. Diagnóstico anual de clima. Aplicação equânime de regras. Rituais que reforcem valores.", responsavel_plano: "RH + Direção", prazo_plano: "120 dias" },
  { codigo: "F02", ordem: 2, nome: "Suporte psicológico e social", descricao: "Rede de apoio formal e informal que reconhece a saúde mental.", perigos_tipicos: "Ausência de PAE; lideranças sem preparo para acolher; estigma sobre saúde mental.", possiveis_danos: "Depressão, ansiedade, isolamento, absenteísmo.", foco_plano: "Suporte psicológico e social", acao_plano: "Implantar PAE com atendimento psicológico sigiloso. Capacitar lideranças em primeiros socorros psicológicos.", responsavel_plano: "SESMT + RH", prazo_plano: "90 dias" },
  { codigo: "F03", ordem: 3, nome: "Liderança clara e expectativas", descricao: "Liderança que comunica e define metas factíveis.", perigos_tipicos: "Metas confusas; mudanças sem comunicação prévia; ausência de feedback.", possiveis_danos: "Ansiedade, erro humano, perda de produtividade.", foco_plano: "Liderança clara", acao_plano: "Formalizar descrição de cargos. Onboarding estruturado. Comunicação de mudanças com 7 dias de antecedência. Reuniões semanais de alinhamento.", responsavel_plano: "Gestão + RH", prazo_plano: "90 dias" },
  { codigo: "F04", ordem: 4, nome: "Civilidade e respeito", descricao: "Trabalhadores respeitosos uns com os outros e com clientes.", perigos_tipicos: "Microagressões; comentários depreciativos; diferenças de tratamento.", possiveis_danos: "Trauma psicológico, queda de desempenho, pedidos de demissão.", foco_plano: "Civilidade e respeito", acao_plano: "Código de conduta atualizado. Workshops sobre respeito e diversidade. Protocolo de mediação. Tolerância zero para microagressões.", responsavel_plano: "RH + CIPA", prazo_plano: "180 dias" },
  { codigo: "F05", ordem: 5, nome: "Demandas psicológicas", descricao: "Equilíbrio entre exigências cognitivas/emocionais e capacidade.", perigos_tipicos: "Volume de trabalho excessivo; prazos impossíveis; trabalho emocional intenso.", possiveis_danos: "Burnout, doenças cardiovasculares, distúrbios de sono.", foco_plano: "Demandas psicológicas", acao_plano: "Medir objetivamente a carga. Ajustar metas. Garantir pausas conforme NR-17. Redesenhar processos para reduzir picos.", responsavel_plano: "Gestão + SESMT", prazo_plano: "60 dias" },
  { codigo: "F06", ordem: 6, nome: "Crescimento e desenvolvimento", descricao: "Apoio para desenvolver habilidades.", perigos_tipicos: "Ausência de plano de carreira; trabalho repetitivo sem aprendizado.", possiveis_danos: "Desmotivação, estagnação, turnover.", foco_plano: "Crescimento e desenvolvimento", acao_plano: "Plano de capacitação anual. Mentoria interna. Trilhas de carreira documentadas. PDI.", responsavel_plano: "RH", prazo_plano: "180 dias" },
  { codigo: "F07", ordem: 7, nome: "Reconhecimento e recompensa", descricao: "Reconhecimento adequado e apreciação justa.", perigos_tipicos: "Ausência de feedback positivo; critérios de promoção opacos.", possiveis_danos: "Desmotivação, ressentimento, queda de engajamento.", foco_plano: "Reconhecimento e recompensa", acao_plano: "Ritual mensal de feedback (1:1). Capacitar lideranças em feedback. Programa de reconhecimento simbólico. Revisar critérios de progressão.", responsavel_plano: "RH", prazo_plano: "120 dias" },
  { codigo: "F08", ordem: 8, nome: "Envolvimento e influência", descricao: "Trabalhadores incluídos em discussões e decisões.", perigos_tipicos: "Centralização excessiva; decisões top-down sem consulta.", possiveis_danos: "Alienação, baixo engajamento, resistência a mudanças.", foco_plano: "Envolvimento e influência", acao_plano: "Reuniões periódicas para co-construção de metas. Ampliar margem de decisão. Canal de sugestões com retorno em 15 dias.", responsavel_plano: "Gestão", prazo_plano: "90 dias" },
  { codigo: "F09", ordem: 9, nome: "Gestão de carga de trabalho", descricao: "Quantidade compatível com jornada, pessoas e recursos.", perigos_tipicos: "Subdimensionamento de equipe; horas extras habituais; picos sem redistribuição.", possiveis_danos: "Exaustão física e mental, acidentes, absenteísmo.", foco_plano: "Gestão de carga de trabalho", acao_plano: "Revisar dimensionamento da equipe. Política de horas extras com limite mensal. Banco de horas transparente. Redistribuir picos.", responsavel_plano: "RH + Gestão", prazo_plano: "60 dias" },
  { codigo: "F10", ordem: 10, nome: "Engajamento", descricao: "Conexão e motivação com o trabalho.", perigos_tipicos: "Falta de propósito percebido; baixo pertencimento.", possiveis_danos: "Presenteísmo, baixa qualidade, turnover.", foco_plano: "Engajamento", acao_plano: "Pesquisa de engajamento semestral. Reuniões de devolutiva. Plano de ação participativo. Reconhecimento de contribuições.", responsavel_plano: "RH", prazo_plano: "180 dias" },
  { codigo: "F11", ordem: 11, nome: "Equilíbrio (trabalho-vida)", descricao: "Reconhecimento da necessidade de equilíbrio.", perigos_tipicos: "Contato fora do horário; cobrança por WhatsApp; férias interrompidas.", possiveis_danos: "Burnout, conflitos familiares, doenças psicossomáticas.", foco_plano: "Equilíbrio trabalho-vida", acao_plano: "Política de direito à desconexão. Vedar contato fora do horário (exceto emergência). Banir cobranças por WhatsApp pessoal. Respeitar férias.", responsavel_plano: "RH + Jurídico", prazo_plano: "30 dias" },
  { codigo: "F12", ordem: 12, nome: "Proteção psicológica", descricao: "Segurança psicológica para reportar problemas (inclui assédio).", perigos_tipicos: "Assédio moral/sexual; ausência de canal de denúncia; retaliação a denunciantes.", possiveis_danos: "TEPT, depressão grave, adoecimento coletivo.", foco_plano: "Proteção psicológica", acao_plano: "Canal de denúncia sigiloso e independente (Lei 14.457/2022). Treinar CIPA. Proteção a denunciantes. Tolerância zero ao assédio.", responsavel_plano: "Compliance + RH + CIPA", prazo_plano: "30 dias" },
  { codigo: "F13", ordem: 13, nome: "Proteção da segurança física", descricao: "Proteção contra perigos físicos.", perigos_tipicos: "Riscos físicos, químicos, biológicos e ergonômicos do ambiente de trabalho.", possiveis_danos: "Acidentes, doenças ocupacionais, lesões musculoesqueléticas.", foco_plano: "Segurança física", acao_plano: "Implementar/atualizar plano dos riscos ergonômicos físicos do PGR. Manter EPC/EPI. Treinamentos. Inspeções periódicas.", responsavel_plano: "SESMT", prazo_plano: "Conforme PGR" },
];

export const PERGUNTAS_DEFAULT: Omit<Aet13FatorPergunta, "id" | "updated_at">[] = [
  { codigo_fator: "F03", texto: "Você recebe instruções claras sobre a sua responsabilidade no trabalho?", logica: "invertida", ordem: 1 },
  { codigo_fator: "F03", texto: "A comunicação da empresa ajuda você a entender o que é esperado do seu trabalho?", logica: "invertida", ordem: 2 },
  { codigo_fator: "F03", texto: "Você recebe orientações adequadas quando ocorrem mudanças no trabalho?", logica: "invertida", ordem: 3 },
  { codigo_fator: "F03", texto: "Quando necessário, você recebe orientação da liderança para executar o seu trabalho?", logica: "invertida", ordem: 4 },
  { codigo_fator: "F01", texto: "As orientações e regras da empresa facilitam a execução das atividades?", logica: "invertida", ordem: 5 },
  { codigo_fator: "F01", texto: "As regras da empresa são aplicadas da mesma forma para todos?", logica: "invertida", ordem: 6 },
  { codigo_fator: "F01", texto: "Os setores conseguem trabalhar em conjunto de forma adequada?", logica: "invertida", ordem: 7 },
  { codigo_fator: "F01", texto: "As informações entre os setores ajudam na rotina de trabalho?", logica: "invertida", ordem: 8 },
  { codigo_fator: "F02", texto: "Você se sente confortável para pedir esclarecimentos e ajuda quando não entende suas funções ou tarefas?", logica: "invertida", ordem: 9 },
  { codigo_fator: "F02", texto: "Você sente que pode contar com seus colegas em momentos de dificuldade?", logica: "invertida", ordem: 10 },
  { codigo_fator: "F02", texto: "Existe apoio da liderança para lidar com desafios relacionados ao trabalho?", logica: "invertida", ordem: 11 },
  { codigo_fator: "F02", texto: "Quando necessário, os colaboradores conseguem buscar apoio nos canais da empresa?", logica: "invertida", ordem: 12 },
  { codigo_fator: "F04", texto: "Situações de desrespeito acontecem no ambiente de trabalho?", logica: "direta", ordem: 13 },
  { codigo_fator: "F04", texto: "O relacionamento no ambiente de trabalho ocorre de forma respeitosa?", logica: "invertida", ordem: 14 },
  { codigo_fator: "F04", texto: "Você percebe respeito na comunicação entre as pessoas na equipe?", logica: "invertida", ordem: 15 },
  { codigo_fator: "F04", texto: "A liderança mantém um relacionamento profissional adequado com a equipe?", logica: "invertida", ordem: 16 },
  { codigo_fator: "F05", texto: "A quantidade de atividades costuma ocupar adequadamente a sua jornada?", logica: "invertida", ordem: 17 },
  { codigo_fator: "F05", texto: "Ao final da jornada, você costuma se sentir cansado mentalmente?", logica: "direta", ordem: 18 },
  { codigo_fator: "F06", texto: "Você consegue utilizar os seus conhecimentos nas atividades do dia a dia?", logica: "invertida", ordem: 19 },
  { codigo_fator: "F07", texto: "A liderança reconhece o trabalho realizado pelos colaboradores?", logica: "invertida", ordem: 20 },
  { codigo_fator: "F07", texto: "Você recebe feedback construtivo sobre o seu trabalho com regularidade?", logica: "invertida", ordem: 21 },
  { codigo_fator: "F08", texto: "Você consegue realizar suas atividades com certa independência?", logica: "invertida", ordem: 22 },
  { codigo_fator: "F08", texto: "A equipe consegue opinar sobre melhorias no trabalho?", logica: "invertida", ordem: 23 },
  { codigo_fator: "F08", texto: "A rotina do trabalho permite boa comunicação entre equipe e liderança?", logica: "invertida", ordem: 24 },
  { codigo_fator: "F08", texto: "O acompanhamento da liderança ajuda na realização do trabalho?", logica: "invertida", ordem: 25 },
  { codigo_fator: "F09", texto: "Você consegue concluir suas atividades dentro do horário de trabalho?", logica: "invertida", ordem: 26 },
  { codigo_fator: "F09", texto: "A quantidade de pessoas no setor é suficiente para o trabalho do dia a dia?", logica: "invertida", ordem: 27 },
  { codigo_fator: "F10", texto: "Você se sente tranquilo em relação ao seu trabalho na empresa?", logica: "invertida", ordem: 28 },
  { codigo_fator: "F11", texto: "Você precisa estender a sua jornada para concluir as atividades?", logica: "direta", ordem: 29 },
  { codigo_fator: "F12", texto: "Você se sente à vontade para comunicar situações inadequadas no ambiente de trabalho?", logica: "invertida", ordem: 30 },
  { codigo_fator: "F12", texto: "Existe um canal seguro e sigiloso para denunciar assédio na empresa?", logica: "invertida", ordem: 31 },
  { codigo_fator: "F12", texto: "Quando situações inadequadas são relatadas, você percebe que são tratadas pela empresa?", logica: "invertida", ordem: 32 },
  { codigo_fator: "F12", texto: "Conflitos entre colegas dificultam o trabalho do dia a dia?", logica: "direta", ordem: 33 },
  { codigo_fator: "F12", texto: "Os conflitos no trabalho costumam ser tratados de forma adequada?", logica: "invertida", ordem: 34 },
  { codigo_fator: "F12", texto: "Alguma situação no trabalho já causou desconforto emocional para você?", logica: "direta", ordem: 35 },
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
      // Delete all and re-insert to handle reordering
      await sb.from("aet_13fatores_perguntas").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      const rows = perguntas.map(({ id: _id, ...p }, i) => ({ ...p, ordem: i + 1 }));
      const { error } = await sb.from("aet_13fatores_perguntas").insert(rows as never);
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
      await sb.from("aet_13fatores_perguntas").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      const { error } = await sb.from("aet_13fatores_perguntas").insert(PERGUNTAS_DEFAULT as never);
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
