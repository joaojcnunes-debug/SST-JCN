"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { excluirComLixeiraPorId } from "@/lib/hooks/useLixeira";
import { useUserStore } from "@/lib/store";
import { gravar, type ImagemPendente } from "@/lib/offline/gravar";
import { guardarDocumentoCache, lerDocumentoCache } from "@/lib/offline/operacoes";
import { ehErroDeRede } from "@/lib/offline/rede";
import type {
  AepCargoSetor,
  AepChecklistCognitiva,
  AepChecklistFisica,
  AepChecklistOrganizacional,
  AepRelatorio,
  AepRisco,
  AepSetor,
  AepTextoPadraoCapitulo,
  ClassificacaoRiscoAET,
  RespostaChecklist,
  RespostaChecklistAep,
  StatusAEP,
  TipoRiscoAET,
} from "@/lib/supabase/types";

// ─── Helpers de normalização ──────────────────────────────────────────────────

function toResposta(v: unknown): RespostaChecklist {
  if (v === true || v === "sim") return "sim";
  if (v === "nao_aplica") return "nao_aplica";
  return "nao";
}

/**
 * Só a Ergonomia Organizacional aceita "N/I — não identificável". Precisa de um
 * normalizador próprio: o `toResposta` acima derruba qualquer valor
 * desconhecido para "nao", e o N/I gravado no jsonb sumiria na leitura.
 */
function toRespostaOrg(v: unknown): RespostaChecklistAep {
  if (v === "nao_identificado") return "nao_identificado";
  return toResposta(v);
}

function normalizarChecklistFisica(raw: unknown): AepChecklistFisica {
  const c = (raw ?? {}) as Record<string, unknown>;
  return {
    postura: toResposta(c.postura),
    repetitividade: toResposta(c.repetitividade),
    levantamento_carga: toResposta(c.levantamento_carga),
    mobiliario: toResposta(c.mobiliario),
    esforco_fisico: toResposta(c.esforco_fisico),
    iluminacao: toResposta(c.iluminacao),
    ruido: toResposta(c.ruido),
    vibracao: toResposta(c.vibracao),
    desconforto_termico: toResposta(c.desconforto_termico),
  };
}

function normalizarChecklistCognitiva(raw: unknown): AepChecklistCognitiva {
  const c = (raw ?? {}) as Record<string, unknown>;
  return {
    atencao_continua: toResposta(c.atencao_continua),
    sobrecarga_mental: toResposta(c.sobrecarga_mental),
    pressao_psicologica: toResposta(c.pressao_psicologica),
    excesso_informacoes: toResposta(c.excesso_informacoes),
    ritmo_mental: toResposta(c.ritmo_mental),
  };
}

function normalizarChecklistOrganizacional(raw: unknown): AepChecklistOrganizacional {
  const c = (raw ?? {}) as Record<string, unknown>;
  return {
    assedio: toRespostaOrg(c.assedio),
    falta_suporte: toRespostaOrg(c.falta_suporte),
    gestao_mudancas: toRespostaOrg(c.gestao_mudancas),
    clareza_papel: toRespostaOrg(c.clareza_papel),
    recompensas: toRespostaOrg(c.recompensas),
    baixo_controle: toRespostaOrg(c.baixo_controle),
    justica_organizacional: toRespostaOrg(c.justica_organizacional),
    eventos_traumaticos: toRespostaOrg(c.eventos_traumaticos),
    subcarga: toRespostaOrg(c.subcarga),
    sobrecarga: toRespostaOrg(c.sobrecarga),
    maus_relacionamentos: toRespostaOrg(c.maus_relacionamentos),
    comunicacao_dificil: toRespostaOrg(c.comunicacao_dificil),
    trabalho_remoto: toRespostaOrg(c.trabalho_remoto),
  };
}

function normalizarSetor(s: unknown): AepSetor {
  const setor = (s ?? {}) as Record<string, unknown>;
  return {
    id: (setor.id as string) ?? crypto.randomUUID(),
    nome_setor: (setor.nome_setor as string) ?? "",
    unidade: (setor.unidade as string) ?? "",
    ghe: (setor.ghe as string) ?? "",
    cargo: (setor.cargo as string) ?? "",
    funcao: (setor.funcao as string) ?? "",
    jornada: (setor.jornada as string) ?? "",
    qtd_expostos: typeof setor.qtd_expostos === "number" ? setor.qtd_expostos : 0,
    descricao_atividade: (setor.descricao_atividade as string) ?? "",
    metodo_coleta: (setor.metodo_coleta as string) ?? "",
    trabalhadores_consultados: (setor.trabalhadores_consultados as string) ?? "",
    cargos: Array.isArray(setor.cargos) ? (setor.cargos as AepCargoSetor[]) : [],
    observacoes_checklist: (typeof setor.observacoes_checklist === "object" && setor.observacoes_checklist !== null)
      ? (setor.observacoes_checklist as Record<string, string>)
      : {},
    riscos: Array.isArray(setor.riscos) ? (setor.riscos as AepRisco[]) : [],
    checklist_fisica: normalizarChecklistFisica(setor.checklist_fisica),
    checklist_cognitiva: normalizarChecklistCognitiva(setor.checklist_cognitiva),
    checklist_organizacional: normalizarChecklistOrganizacional(setor.checklist_organizacional),
    // ⚠️ Este normalizador reconstrói o setor campo a campo — o que não estiver
    // aqui é DESCARTADO em toda leitura. Foi por isso que os sinais precisaram
    // entrar explicitamente. Só aceita array de string, para lixo no jsonb não
    // virar erro de tela.
    sinais_organizacional: (() => {
      const bruto = setor.sinais_organizacional;
      if (typeof bruto !== "object" || bruto === null) return {};
      const out: Record<string, string[]> = {};
      for (const [k, v] of Object.entries(bruto as Record<string, unknown>)) {
        if (Array.isArray(v)) out[k] = v.filter((x): x is string => typeof x === "string");
      }
      return out;
    })(),
    parecer_tecnico: (setor.parecer_tecnico as string) ?? "",
    recomendacoes: (setor.recomendacoes as string) ?? "",
    necessita_aet: Boolean(setor.necessita_aet),
  };
}

function normalizarRelatorio(data: unknown): AepRelatorio {
  const rel = data as Record<string, unknown>;
  return {
    ...rel,
    setores: Array.isArray(rel.setores) ? rel.setores.map(normalizarSetor) : [],
  } as AepRelatorio;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function setorVazioAep(): AepSetor {
  return {
    id: crypto.randomUUID(),
    nome_setor: "",
    unidade: "",
    ghe: "",
    cargo: "",
    funcao: "",
    jornada: "",
    qtd_expostos: 0,
    descricao_atividade: "",
    metodo_coleta: "",
    trabalhadores_consultados: "",
    cargos: [],
    observacoes_checklist: {},
    sinais_organizacional: {},
    riscos: [],
    checklist_fisica: {
      postura: "nao",
      repetitividade: "nao",
      levantamento_carga: "nao",
      mobiliario: "nao",
      esforco_fisico: "nao",
      iluminacao: "nao",
      ruido: "nao",
      vibracao: "nao",
      desconforto_termico: "nao",
    },
    checklist_cognitiva: {
      atencao_continua: "nao",
      sobrecarga_mental: "nao",
      pressao_psicologica: "nao",
      excesso_informacoes: "nao",
      ritmo_mental: "nao",
    },
    checklist_organizacional: {
      assedio: "nao",
      falta_suporte: "nao",
      gestao_mudancas: "nao",
      clareza_papel: "nao",
      recompensas: "nao",
      baixo_controle: "nao",
      justica_organizacional: "nao",
      eventos_traumaticos: "nao",
      subcarga: "nao",
      sobrecarga: "nao",
      maus_relacionamentos: "nao",
      comunicacao_dificil: "nao",
      trabalho_remoto: "nao",
    },
    parecer_tecnico: "",
    recomendacoes: "",
    necessita_aet: false,
  };
}

export function riscoVazioAep(): AepRisco {
  return {
    id: crypto.randomUUID(),
    tipo: "Ergonômico" as TipoRiscoAET,
    risco: "",
    classificacao_risco: "Trivial" as ClassificacaoRiscoAET,
    medida_preventiva: "",
  };
}

// ─── Lógica de escalonamento ──────────────────────────────────────────────────

export function calcNecessitaAet(setor: AepSetor): boolean {
  const altos = setor.riscos.filter(
    (r) => r.classificacao_risco === "Alto" || r.classificacao_risco === "Crítico"
  );
  const moderados = setor.riscos.filter((r) => r.classificacao_risco === "Moderado");
  // "Múltiplos riscos Moderados" — o texto da tarja e do laudo diz múltiplos, que
  // é 2 ou mais. O limiar era 3 e contradizia a própria redação (pedido 10/08).
  return altos.length > 0 || moderados.length >= 2;
}

export function riscoMaximoAep(setor: AepSetor): ClassificacaoRiscoAET | null {
  const ordem: ClassificacaoRiscoAET[] = ["Crítico", "Alto", "Moderado", "De Atenção", "Trivial"];
  for (const c of ordem) {
    if (setor.riscos.some((r) => r.classificacao_risco === c)) return c;
  }
  return null;
}

export function riscoMaximoSetor(setor: AepSetor): ClassificacaoRiscoAET | null {
  const ordem: ClassificacaoRiscoAET[] = ["Crítico", "Alto", "Moderado", "De Atenção", "Trivial"];
  for (const c of ordem) {
    if (setor.riscos.some((r) => r.classificacao_risco === c)) return c;
  }
  return null;
}

export function riscoMaximoRelatorio(rel: AepRelatorio): ClassificacaoRiscoAET | null {
  const ordem: ClassificacaoRiscoAET[] = ["Crítico", "Alto", "Moderado", "De Atenção", "Trivial"];
  for (const c of ordem) {
    if (rel.setores.some((s) => s.riscos.some((r) => r.classificacao_risco === c))) return c;
  }
  return null;
}

// ─── Relatórios ───────────────────────────────────────────────────────────────

export function useAepRelatorios(empresaId?: string | null) {
  const user = useUserStore((s) => s.user);

  return useQuery({
    queryKey: ["aep-relatorios", empresaId ?? "todos"],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      let q = supabase
        .from("aep_relatorios")
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
    enabled: !!user,
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function useAepRelatorio(id: string) {
  return useQuery({
    queryKey: ["aep-relatorio", id],

    // Sem rede, insistir é perder tempo: o plano B está dentro da `queryFn`.
    retry: (falhas, erro) => !ehErroDeRede(erro) && falhas < 2,

    queryFn: async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("aep_relatorios")
          .select("*, empresas(nome_empresa, cnpj)")
          .eq("id_relatorio", id)
          .single();
        if (error) throw error;
        const relatorio = normalizarRelatorio(data);
        // Mantém fresca só a cópia que o técnico levou — ver `LevarParaCampo`.
        void lerDocumentoCache(id).then((ja) => {
          if (ja) void guardarDocumentoCache(id, relatorio);
        });
        return relatorio;
      } catch (e) {
        // Recusa do banco e laudo inexistente continuam sendo erro.
        if (!ehErroDeRede(e)) throw e;
        const guardado =
          await lerDocumentoCache<ReturnType<typeof normalizarRelatorio>>(id);
        if (guardado) return guardado.dados;
        throw e;
      }
    },
    enabled: !!id && UUID_RE.test(id),
  });
}

export function useCriarAep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      id_empresa: string;
      responsavel_elaboracao: string;
      titulo_profissional: string;
      registro_profissional: string;
      /** Uma linha, montada do cadastro da empresa na tela de criação.
       *  Alimenta {{endereco_empresa}} dos Textos Padrão do laudo. */
      endereco_empresa?: string | null;
      data_elaboracao?: string | null;
    }) => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("aep_relatorios")
        .insert(payload as never)
        .select("id_relatorio")
        .single();
      if (error) throw error;
      return data as unknown as AepRelatorio;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["aep-relatorios"] });
      toast.success("AEP criada com sucesso!");
    },
    onError: (e: Error) => toast.error(`Erro: ${e.message}`),
  });
}

export function useSalvarAep() {
  const qc = useQueryClient();
  return useMutation({
    // `silencioso` não vai para o banco: serve para o auto-save da ordem dos
    // setores não cuspir um toast "Salvo com sucesso!" a cada arrasto.
    mutationFn: async ({
      id,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- lido no onSuccess; aqui só precisa ficar de fora do patch que vai pro banco.
      silencioso,
      imagens,
      ...patch
    }: Partial<AepRelatorio> & {
      id: string;
      silencioso?: boolean;
      /**
       * Fotos dos setores que ainda não subiram. Vão junto do patch porque a
       * URL delas já está dentro do jsonb — gravar o jsonb antes do arquivo
       * publicaria no laudo uma foto apontando para o nada.
       */
      imagens?: ImagemPendente[];
    }) => {
      return gravar({
        tabela: "aep_relatorios",
        tipo: "update",
        linhas: { ...patch, updated_at: new Date().toISOString() },
        filtro: { id_relatorio: id },
        modulo: "aep",
        id_documento: id,
        imagens,
      });
    },
    onSuccess: (resultado, vars) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- os arquivos já foram entregues ao gravar(); aqui só precisam ficar de fora do patch aplicado ao cache.
      const { id, silencioso, imagens, ...patch } = vars;
      // Sem rede o patch é aplicado no cache do mesmo jeito que o auto-save já
      // fazia: não há o que revalidar, e a tela precisa continuar mostrando o
      // que o técnico acabou de digitar.
      if (silencioso || resultado.destino === "APARELHO") {
        // Auto-save da ordem: atualiza o cache no lugar de invalidar. Um
        // refetch aqui devolveria um objeto novo, a tela remontaria o estado
        // local a cada arrasto e o setor aberto se fecharia sozinho.
        qc.setQueryData(["aep-relatorio", id], (antigo: AepRelatorio | undefined) =>
          antigo ? { ...antigo, ...patch } : antigo,
        );
        if (!silencioso) toast.success("Guardado no aparelho", { icon: "📵" });
        return;
      }
      qc.invalidateQueries({ queryKey: ["aep-relatorio", id] });
      qc.invalidateQueries({ queryKey: ["aep-relatorios"] });
      toast.success("Salvo com sucesso!");
    },
    onError: (e: Error, vars) => {
      if (!vars.silencioso) toast.error(`Erro ao salvar: ${e.message}`);
    },
  });
}

export function useExcluirAep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await excluirComLixeiraPorId({
        tabela: "aep_relatorios",
        chave: "id_relatorio",
        id,
        modulo: "aep",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["aep-relatorios"] });
      toast.success("AEP excluída.");
    },
    onError: (e: Error) => toast.error(`Erro ao excluir: ${e.message}`),
  });
}

// ─── Textos Padrão ────────────────────────────────────────────────────────────

export function useAepTextoPadrao() {
  return useQuery({
    queryKey: ["aep-textos-padrao"],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("aep_textos_padrao")
        .select("*")
        .order("ordem_global", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AepTextoPadraoCapitulo[];
    },
  });
}

export function useAepCriarCapitulo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { titulo: string; tipo: "fixo" | "editavel" } & Partial<Omit<AepTextoPadraoCapitulo, "id_capitulo" | "created_at" | "updated_at">>) => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("aep_textos_padrao")
        .insert(payload as never)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["aep-textos-padrao"] }),
    onError: (e: Error) => toast.error(`Erro: ${e.message}`),
  });
}

export function useAepSalvarCapitulo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id_capitulo,
      ...patch
    }: Partial<AepTextoPadraoCapitulo> & { id_capitulo: string }) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("aep_textos_padrao")
        .update(patch as never)
        .eq("id_capitulo", id_capitulo);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["aep-textos-padrao"] }),
    onError: (e: Error) => toast.error(`Erro ao salvar: ${e.message}`),
  });
}

export function useAepExcluirCapitulo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id_capitulo: string) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("aep_textos_padrao")
        .delete()
        .eq("id_capitulo", id_capitulo);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["aep-textos-padrao"] }),
    onError: (e: Error) => toast.error(`Erro ao excluir: ${e.message}`),
  });
}

export function useAepSeedCapitulosFixos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const fixos = [
        { titulo: "Identificação e Triagem Ergonômica", tipo: "fixo" as const, slug_fixo: "aep_triagem", mostrar: true, ordem_global: 2000 },
        { titulo: "Matriz de Riscos Ergonômicos", tipo: "fixo" as const, slug_fixo: "aep_matriz_riscos", mostrar: true, ordem_global: 2500 },
        { titulo: "Indicadores de Escalonamento AET", tipo: "fixo" as const, slug_fixo: "aep_escalonamento", mostrar: true, ordem_global: 3000 },
        { titulo: "Considerações Finais e Encaminhamentos", tipo: "fixo" as const, slug_fixo: "aep_consideracoes", mostrar: true, ordem_global: 5000 },
        { titulo: "Assinatura Técnica", tipo: "fixo" as const, slug_fixo: "aep_assinatura", mostrar: true, ordem_global: 5500 },
      ];
      const { data: exist } = await supabase
        .from("aep_textos_padrao")
        .select("slug_fixo")
        .eq("tipo", "fixo");
      const existSlugs = new Set((exist ?? []).map((r: { slug_fixo: string | null }) => r.slug_fixo));
      const novos = fixos.filter((f) => !existSlugs.has(f.slug_fixo));
      if (!novos.length) { toast("Seções do sistema já existem."); return; }
      const { error } = await supabase.from("aep_textos_padrao").insert(novos as never);
      if (error) throw error;
      toast.success(`${novos.length} seção(ões) do sistema criada(s).`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["aep-textos-padrao"] }),
    onError: (e: Error) => toast.error(`Erro: ${e.message}`),
  });
}

// ─── Status helpers ───────────────────────────────────────────────────────────

export const CLASS_COLOR_AEP: Record<string, string> = {
  Trivial: "bg-green-100 text-green-800",
  "De Atenção": "bg-yellow-100 text-yellow-800",
  Moderado: "bg-orange-100 text-orange-800",
  Alto: "bg-red-100 text-red-800",
  Crítico: "bg-red-200 text-red-900",
};

export const TIPOS_RISCO_AEP: TipoRiscoAET[] = ["Acidentes", "Ergonômico", "Físico", "Químico", "Biológico"];
export const CLASSIFICACOES_AEP: ClassificacaoRiscoAET[] = ["Trivial", "De Atenção", "Moderado", "Alto", "Crítico"];

export const STATUS_LABEL_AEP: Record<StatusAEP, string> = {
  RASCUNHO: "Rascunho",
  CONCLUIDO: "Concluído",
};
