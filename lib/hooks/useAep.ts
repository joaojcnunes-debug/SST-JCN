"use client";

import { normalizarRelatorio } from "@/lib/aep/normalizar-relatorio";
import type { SituacaoQuestionario } from "@/lib/aep/sinalizacao";
import { buscarAepsEntregues, buscarSituacaoQuestionario } from "@/lib/aep/sinalizacao-dados";
import { montarCatalogoSetores } from "@/lib/aep/catalogo-setores";
import { contagemParaAet } from "@/lib/aep/aiha-organizacional";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { excluirComLixeiraPorId } from "@/lib/hooks/useLixeira";
import { useUserStore } from "@/lib/store";
import { gravar, type ImagemPendente } from "@/lib/offline/gravar";
import { guardarDocumentoCache, lerDocumentoCache } from "@/lib/offline/operacoes";
import { ehErroDeRede } from "@/lib/offline/rede";
import type {
  AepRelatorio,
  AepRisco,
  AepSetor,
  AepTextoPadraoCapitulo,
  ClassificacaoRiscoAET,
  StatusAEP,
  TipoRiscoAET,
} from "@/lib/supabase/types";

export { normalizarRelatorio };

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

/**
 * Sugestão de AET completa (2026-10-02): SÓ os fatores da Ergonomia
 * Organizacional na matriz AIHA contam — 1 fator Alto/Muito Alto, ou 2+
 * Moderados. A lista "Matriz de Riscos" do setor (`setor.riscos`) NÃO entra
 * mais no critério, a pedido do usuário; ela continua no laudo como registro.
 */
export function calcNecessitaAet(setor: AepSetor): boolean {
  const org = contagemParaAet(setor.aiha_organizacional);
  // "Múltiplos Moderados" = 2 ou mais (pedido de 10/08).
  return org.altos > 0 || org.moderados >= 2;
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

// v259: AEP/AET preenchida na aba da inspeção só aparece no módulo depois
// do "Enviar para o módulo".
export const FILTRO_VISIVEL_NO_MODULO = "id_inspecao.is.null,enviado_modulo_em.not.is.null";

export function useAepRelatorios(empresaId?: string | null) {
  const user = useUserStore((s) => s.user);

  return useQuery({
    queryKey: ["aep-relatorios", empresaId ?? "todos"],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      let q = supabase
        .from("aep_relatorios")
        .select("*, empresas(nome_empresa, cnpj)")
        .or(FILTRO_VISIVEL_NO_MODULO)
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

/**
 * AEPs ENTREGUES ao cliente (2026-10-05) — as que vão para a Sinalização
 * Psicossocial e para a página AEP do Painel SST:
 *   • COM inspeção: o documento da inspeção foi concluído pelo associado
 *     (`inspecoes.elaboracao_status = 'CONCLUIDO'`, o "Entregue" da lista de
 *     inspeções); data = `elaboracao_concluida_em`. O status da AEP não conta.
 *   • SEM inspeção: a própria AEP está Concluída (= enviada ao cliente);
 *     data = `concluido_em` (v265).
 * Documento reaberto / AEP de volta a rascunho sai da Sinalização.
 */
export function useAepsEntregues(empresaId?: string | null) {
  const user = useUserStore((s) => s.user);
  return useQuery({
    queryKey: ["aep-entregues", empresaId ?? "todos"],
    queryFn: () =>
      buscarAepsEntregues(createSupabaseBrowserClient(), {
        idEmpresa: empresaId,
        empresasVinculadas: user?.perfil === "Tecnico" ? user.empresas_vinculadas : null,
      }),
    enabled: !!user,
  });
}

/**
 * Situação do DRPS e do Questionário Psicossocial (QPS) de cada empresa — para
 * a Sinalização dizer se o que a AEP recomenda já foi feito.
 */
export function useSituacaoQuestionarioEmpresas(idsEmpresas: string[]) {
  const ids = [...new Set(idsEmpresas)].sort();
  return useQuery({
    queryKey: ["situacao-questionario-empresas", ids],
    enabled: ids.length > 0,
    staleTime: 60_000,
    queryFn: (): Promise<Record<string, SituacaoQuestionario>> =>
      buscarSituacaoQuestionario(createSupabaseBrowserClient(), ids),
  });
}

/**
 * Em que pé a AEP está em relação à Sinalização Psicossocial — para a faixa
 * do editor explicar por que ela aparece ou não.
 */
export function useSituacaoSinalizacaoAep(idRelatorio: string) {
  return useQuery({
    queryKey: ["aep-situacao-sinalizacao", idRelatorio],
    enabled: !!idRelatorio,
    // Sem o cache de 5 min global: depende do status, que muda em outra tela.
    staleTime: 0,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("aep_relatorios")
        .select(
          "id_empresa, id_inspecao, status, concluido_em, liberado_comercial_em, liberado_comercial_por, inspecoes(id_inspecao, status, elaboracao_status, elaboracao_concluida_em)"
        )
        .eq("id_relatorio", idRelatorio)
        .maybeSingle();
      if (error) throw error;
      const r = data as {
        id_empresa: string;
        id_inspecao: string | null;
        status: string;
        concluido_em: string | null;
        liberado_comercial_em: string | null;
        liberado_comercial_por: string | null;
        inspecoes: {
          id_inspecao: string;
          status: string;
          elaboracao_status: string | null;
          elaboracao_concluida_em: string | null;
        } | null;
      } | null;
      return {
        idEmpresa: r?.id_empresa ?? null,
        idInspecao: r?.id_inspecao ?? null,
        entregue: r?.id_inspecao
          ? r?.inspecoes?.elaboracao_status === "CONCLUIDO" && r?.inspecoes?.status !== "DELETADA"
          : r?.status === "CONCLUIDO",
        entregueEm: r?.id_inspecao ? (r?.inspecoes?.elaboracao_concluida_em ?? null) : (r?.concluido_em ?? null),
        liberadoComercialEm: r?.liberado_comercial_em ?? null,
        liberadoComercialPor: r?.liberado_comercial_por ?? null,
      };
    },
  });
}

/**
 * Setores e cargos que a empresa já tem no sistema (das inspeções não
 * deletadas), para o editor da AEP sugerir — ver `montarCatalogoSetores`.
 */
export function useCatalogoSetoresEmpresa(idEmpresa: string | null | undefined) {
  return useQuery({
    queryKey: ["catalogo-setores-empresa", idEmpresa],
    enabled: !!idEmpresa,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const [s, c] = await Promise.all([
        supabase
          .from("setores")
          .select("id_setor, setor_ghe, descricao, inspecoes!inner(status)")
          .eq("id_empresa", idEmpresa!)
          .neq("inspecoes.status", "DELETADA"),
        supabase
          .from("cargos")
          .select("id_setor, cargo, descricao, inspecoes!inner(status)")
          .eq("id_empresa", idEmpresa!)
          .neq("inspecoes.status", "DELETADA"),
      ]);
      if (s.error) throw s.error;
      if (c.error) throw c.error;
      return montarCatalogoSetores(
        (s.data ?? []) as unknown as { id_setor: string; setor_ghe: string | null; descricao: string | null }[],
        (c.data ?? []) as unknown as { id_setor: string | null; cargo: string | null; descricao: string | null }[],
      );
    },
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
      // Status mudou (ex.: Concluído) → a faixa da Sinalização/Comercial
      // precisa mostrar "Liberar para o Comercial" na hora.
      qc.invalidateQueries({ queryKey: ["aep-situacao-sinalizacao", id] });
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
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDO: "Concluído",
};

/** Ordem do fluxo e cor do selo de cada status (v266). */
export const STATUS_ORDEM_AEP: StatusAEP[] = ["RASCUNHO", "EM_ANDAMENTO", "CONCLUIDO"];
export const STATUS_COR_AEP: Record<StatusAEP, string> = {
  RASCUNHO: "bg-gray-100 text-gray-700",
  EM_ANDAMENTO: "bg-yellow-100 text-yellow-700",
  CONCLUIDO: "bg-emerald-100 text-emerald-700",
};
