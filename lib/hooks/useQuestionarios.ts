"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { TipoExcel } from "@/lib/qps/parsearExcel";
import type {
  QpsTipo,
  QpsCategoria,
  QpsPergunta,
  QpsAplicacao,
  QpsRespondente,
  QpsProbabilidade,
  QpsPlanoAcao,
  StatusQpsAplicacao,
  StatusQpsPlano,
} from "@/lib/supabase/types";

// The qps_* tables are not in the generated Database types yet (migration pending).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function qpsDb() { return createSupabaseBrowserClient() as any; }

// ─── Todas as perguntas de um tipo (busca categorias + perguntas em sequência) ─

export function useQpsAllPerguntas(idTipo: string | null | undefined) {
  return useQuery({
    queryKey: ["qps-all-perguntas", idTipo],
    enabled: !!idTipo,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<QpsPergunta[]> => {
      const sb = qpsDb();
      const { data: cats, error: catsErr } = await sb
        .from("qps_categorias")
        .select("id_categoria")
        .eq("id_tipo", idTipo!);
      if (catsErr) throw catsErr;
      const ids = (cats ?? []).map((c: { id_categoria: string }) => c.id_categoria);
      if (ids.length === 0) return [];
      const { data, error } = await sb
        .from("qps_perguntas")
        .select("*")
        .in("id_categoria", ids)
        .eq("ativo", true)
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as QpsPergunta[];
    },
  });
}

// ─── Tipos ───────────────────────────────────────────────────────────────────

export function useQpsTipos() {
  return useQuery({
    queryKey: ["qps-tipos"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<QpsTipo[]> => {
      const sb = qpsDb();
      const { data, error } = await sb
        .from("qps_tipos")
        .select("*")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export interface QpsTipoInput {
  nome: string;
  descricao: string | null;
  instrucoes: string | null;
  escala_min: number;
  escala_max: number;
  ativo: boolean;
}

export function useCreateQpsTipo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: QpsTipoInput) => {
      const sb = qpsDb();
      const { data, error } = await sb
        .from("qps_tipos")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as QpsTipo;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qps-tipos"] }),
  });
}

export function useUpdateQpsTipo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<QpsTipoInput> }) => {
      const sb = qpsDb();
      const { error } = await sb
        .from("qps_tipos")
        .update(input)
        .eq("id_tipo", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qps-tipos"] }),
  });
}

// ─── Categorias ───────────────────────────────────────────────────────────────

export function useQpsCategorias(idTipo: string | null | undefined) {
  return useQuery({
    queryKey: ["qps-categorias", idTipo],
    enabled: !!idTipo,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<QpsCategoria[]> => {
      const sb = qpsDb();
      const { data, error } = await sb
        .from("qps_categorias")
        .select("*")
        .eq("id_tipo", idTipo!)
        .order("ordem");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export interface QpsCategoriaInput {
  id_tipo: string;
  nome: string;
  descricao: string | null;
  ordem: number;
}

export function useCreateQpsCategoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: QpsCategoriaInput) => {
      const sb = qpsDb();
      const { data, error } = await sb
        .from("qps_categorias")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as QpsCategoria;
    },
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ["qps-categorias", vars.id_tipo] }),
  });
}

export function useUpdateQpsCategoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      idTipo,
      input,
    }: {
      id: string;
      idTipo: string;
      input: Partial<Omit<QpsCategoriaInput, "id_tipo">>;
    }) => {
      const sb = qpsDb();
      const { error } = await sb
        .from("qps_categorias")
        .update(input)
        .eq("id_categoria", id);
      if (error) throw error;
      return idTipo;
    },
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ["qps-categorias", vars.idTipo] }),
  });
}

export function useDeleteQpsCategoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, idTipo }: { id: string; idTipo: string }) => {
      const sb = qpsDb();
      const { error } = await sb
        .from("qps_categorias")
        .delete()
        .eq("id_categoria", id);
      if (error) throw error;
      return idTipo;
    },
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ["qps-categorias", vars.idTipo] }),
  });
}

// ─── Perguntas ───────────────────────────────────────────────────────────────

export function useQpsPerguntas(idCategoria: string | null | undefined) {
  return useQuery({
    queryKey: ["qps-perguntas", idCategoria],
    enabled: !!idCategoria,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<QpsPergunta[]> => {
      const sb = qpsDb();
      const { data, error } = await sb
        .from("qps_perguntas")
        .select("*")
        .eq("id_categoria", idCategoria!)
        .order("ordem");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export interface QpsPerguntaInput {
  id_categoria: string;
  texto: string;
  logica: "direta" | "invertida";
  ordem: number;
  ativo: boolean;
}

export function useCreateQpsPergunta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: QpsPerguntaInput) => {
      const sb = qpsDb();
      const { data, error } = await sb
        .from("qps_perguntas")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as QpsPergunta;
    },
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ["qps-perguntas", vars.id_categoria] }),
  });
}

export function useUpdateQpsPergunta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      idCategoria,
      input,
    }: {
      id: string;
      idCategoria: string;
      input: Partial<Omit<QpsPerguntaInput, "id_categoria">>;
    }) => {
      const sb = qpsDb();
      const { error } = await sb
        .from("qps_perguntas")
        .update(input)
        .eq("id_pergunta", id);
      if (error) throw error;
      return idCategoria;
    },
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ["qps-perguntas", vars.idCategoria] }),
  });
}

export function useDeleteQpsPergunta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, idCategoria }: { id: string; idCategoria: string }) => {
      const sb = qpsDb();
      const { error } = await sb
        .from("qps_perguntas")
        .delete()
        .eq("id_pergunta", id);
      if (error) throw error;
      return idCategoria;
    },
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ["qps-perguntas", vars.idCategoria] }),
  });
}

// ─── Aplicações ───────────────────────────────────────────────────────────────

export function useQpsAplicacoes(idEmpresa: string | null | undefined) {
  return useQuery({
    queryKey: ["qps-aplicacoes", idEmpresa],
    enabled: !!idEmpresa,
    staleTime: 60_000,
    queryFn: async (): Promise<QpsAplicacao[]> => {
      const sb = qpsDb();
      const { data, error } = await sb
        .from("qps_aplicacoes")
        .select("*")
        .eq("id_empresa", idEmpresa!)
        .neq("status", "DELETADO")
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useQpsAplicacao(id: string | null | undefined) {
  return useQuery({
    queryKey: ["qps-aplicacao", id],
    enabled: !!id,
    staleTime: 30_000,
    queryFn: async (): Promise<QpsAplicacao> => {
      const sb = qpsDb();
      const { data, error } = await sb
        .from("qps_aplicacoes")
        .select("*")
        .eq("id_aplicacao", id!)
        .single();
      if (error) throw error;
      return data as QpsAplicacao;
    },
  });
}

export interface QpsAplicacaoInput {
  id_tipo: string;
  id_empresa: string;
  titulo: string;
  responsavel: string | null;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  usuario_email: string | null;
  usuario_nome: string | null;
  observacoes_dimensoes?: Record<string, string> | null;
}

export function useCreateQpsAplicacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: QpsAplicacaoInput) => {
      const sb = qpsDb();
      const { data, error } = await sb
        .from("qps_aplicacoes")
        .insert({ ...input, status: "RASCUNHO" })
        .select()
        .single();
      if (error) throw error;
      return data as QpsAplicacao;
    },
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ["qps-aplicacoes", vars.id_empresa] }),
  });
}

export function useUpdateQpsAplicacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      idEmpresa,
      input,
    }: {
      id: string;
      idEmpresa: string;
      input: Partial<QpsAplicacaoInput & { status: StatusQpsAplicacao }>;
    }) => {
      const sb = qpsDb();
      const { error } = await sb
        .from("qps_aplicacoes")
        .update({ ...input, atualizado_em: new Date().toISOString() })
        .eq("id_aplicacao", id);
      if (error) throw error;
      return idEmpresa;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["qps-aplicacao", vars.id] });
      qc.invalidateQueries({ queryKey: ["qps-aplicacoes", vars.idEmpresa] });
    },
  });
}

export function useDeleteQpsAplicacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, idEmpresa }: { id: string; idEmpresa: string }) => {
      const sb = qpsDb();
      const { error } = await sb
        .from("qps_aplicacoes")
        .update({ status: "DELETADO", atualizado_em: new Date().toISOString() })
        .eq("id_aplicacao", id);
      if (error) throw error;
      return idEmpresa;
    },
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ["qps-aplicacoes", vars.idEmpresa] }),
  });
}

// ─── Respondentes ─────────────────────────────────────────────────────────────

export function useQpsRespondentes(idAplicacao: string | null | undefined) {
  return useQuery({
    queryKey: ["qps-respondentes", idAplicacao],
    enabled: !!idAplicacao,
    staleTime: 30_000,
    queryFn: async (): Promise<QpsRespondente[]> => {
      const sb = qpsDb();
      const { data, error } = await sb
        .from("qps_respondentes")
        .select("*")
        .eq("id_aplicacao", idAplicacao!)
        .order("importado_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export interface QpsRespondenteInput {
  id_aplicacao: string;
  setor: string;
  cargo: string | null;
  respostas: Record<string, number>;
  lote: string | null;
}

export function useCreateQpsRespondente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: QpsRespondenteInput) => {
      const sb = qpsDb();
      const { data, error } = await sb
        .from("qps_respondentes")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as QpsRespondente;
    },
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ["qps-respondentes", vars.id_aplicacao] }),
  });
}

export function useDeleteQpsRespondente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      idAplicacao,
    }: {
      id: string;
      idAplicacao: string;
    }) => {
      const sb = qpsDb();
      const { error } = await sb
        .from("qps_respondentes")
        .delete()
        .eq("id_respondente", id);
      if (error) throw error;
      return idAplicacao;
    },
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ["qps-respondentes", vars.idAplicacao] }),
  });
}

export function useImportarQpsLote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      idAplicacao,
      linhas,
    }: {
      idAplicacao: string;
      linhas: Array<{ setor: string; cargo: string | null; respostas: Record<string, number> }>;
    }) => {
      const sb = qpsDb();
      const lote = crypto.randomUUID();
      const rows = linhas.map((l) => ({
        id_aplicacao: idAplicacao,
        setor: l.setor,
        cargo: l.cargo,
        respostas: l.respostas,
        lote,
      }));
      const { error } = await sb.from("qps_respondentes").insert(rows);
      if (error) throw error;
      return { count: rows.length, lote };
    },
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ["qps-respondentes", vars.idAplicacao] }),
  });
}

export function useLimparQpsRespondentes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (idAplicacao: string) => {
      const sb = qpsDb();
      const { error } = await sb
        .from("qps_respondentes")
        .delete()
        .eq("id_aplicacao", idAplicacao);
      if (error) throw error;
    },
    onSuccess: (_d, idAplicacao) =>
      qc.invalidateQueries({ queryKey: ["qps-respondentes", idAplicacao] }),
  });
}

// ─── Probabilidades (ajuste manual da matriz) ─────────────────────────────────

export function useQpsProbabilidades(idAplicacao: string | null | undefined) {
  return useQuery({
    queryKey: ["qps-probabilidades", idAplicacao],
    enabled: !!idAplicacao,
    staleTime: 30_000,
    queryFn: async (): Promise<QpsProbabilidade[]> => {
      const sb = qpsDb();
      const { data, error } = await sb
        .from("qps_probabilidades")
        .select("*")
        .eq("id_aplicacao", idAplicacao!);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useUpsertQpsProbabilidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: QpsProbabilidade) => {
      const sb = qpsDb();
      const { error } = await sb
        .from("qps_probabilidades")
        .upsert(
          { ...input, atualizado_em: new Date().toISOString() },
          { onConflict: "id_aplicacao,setor,id_categoria" }
        );
      if (error) throw error;
    },
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ["qps-probabilidades", vars.id_aplicacao] }),
  });
}

// ─── Planos de Ação ───────────────────────────────────────────────────────────

export function useQpsPlanos(idAplicacao: string | null | undefined) {
  return useQuery({
    queryKey: ["qps-planos", idAplicacao],
    enabled: !!idAplicacao,
    staleTime: 30_000,
    queryFn: async (): Promise<QpsPlanoAcao[]> => {
      const sb = qpsDb();
      const { data, error } = await sb
        .from("qps_planos_acao")
        .select("*")
        .eq("id_aplicacao", idAplicacao!)
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export interface QpsPlanoInput {
  id_aplicacao: string;
  setor: string | null;
  id_categoria: string | null;
  descricao: string;
  responsavel: string | null;
  prazo: string | null;
}

export function useCreateQpsPlano() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: QpsPlanoInput) => {
      const sb = qpsDb();
      const { data, error } = await sb
        .from("qps_planos_acao")
        .insert({ ...input, status: "PENDENTE" })
        .select()
        .single();
      if (error) throw error;
      return data as QpsPlanoAcao;
    },
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ["qps-planos", vars.id_aplicacao] }),
  });
}

export function useUpdateQpsPlano() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      idAplicacao,
      input,
    }: {
      id: string;
      idAplicacao: string;
      input: Partial<Omit<QpsPlanoInput, "id_aplicacao"> & { status: StatusQpsPlano }>;
    }) => {
      const sb = qpsDb();
      const { error } = await sb
        .from("qps_planos_acao")
        .update({ ...input, atualizado_em: new Date().toISOString() })
        .eq("id_plano", id);
      if (error) throw error;
      return idAplicacao;
    },
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ["qps-planos", vars.idAplicacao] }),
  });
}

export function useDeleteQpsPlano() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, idAplicacao }: { id: string; idAplicacao: string }) => {
      const sb = qpsDb();
      const { error } = await sb
        .from("qps_planos_acao")
        .delete()
        .eq("id_plano", id);
      if (error) throw error;
      return idAplicacao;
    },
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ["qps-planos", vars.idAplicacao] }),
  });
}

// ─── Importação em lote via Excel ─────────────────────────────────────────────

export function useImportarExcelQps() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tipos: TipoExcel[]) => {
      const sb = qpsDb();
      let totalPerguntas = 0;
      let totalTiposCriados = 0;
      let totalCatsCriadas = 0;

      for (const tipoData of tipos) {
        // 1. Find or create Tipo by name (case-insensitive)
        const { data: existentes } = await sb
          .from("qps_tipos")
          .select("id_tipo")
          .ilike("nome", tipoData.nomeSheet)
          .limit(1);

        let idTipo: string;
        if (existentes?.length > 0) {
          idTipo = existentes[0].id_tipo;
        } else {
          const { data: novo, error } = await sb
            .from("qps_tipos")
            .insert({ nome: tipoData.nomeSheet, escala_min: 1, escala_max: 5, ativo: true })
            .select("id_tipo")
            .single();
          if (error) throw error;
          idTipo = novo.id_tipo;
          totalTiposCriados++;
        }

        // 2. Load existing categorias for this tipo
        const { data: catsExistentes } = await sb
          .from("qps_categorias")
          .select("id_categoria, nome, ordem")
          .eq("id_tipo", idTipo);

        const catMapNome = new Map<string, string>();
        let maxOrdemCat = 0;
        for (const c of catsExistentes ?? []) {
          catMapNome.set(c.nome.toLowerCase().trim(), c.id_categoria);
          if (c.ordem > maxOrdemCat) maxOrdemCat = c.ordem;
        }

        // 3. Create missing categorias
        const catIdMap = new Map<string, string>();
        for (const catNome of tipoData.categorias) {
          const key = catNome.toLowerCase().trim();
          if (catMapNome.has(key)) {
            catIdMap.set(catNome, catMapNome.get(key)!);
          } else {
            maxOrdemCat++;
            const { data: nova, error } = await sb
              .from("qps_categorias")
              .insert({ id_tipo: idTipo, nome: catNome, ordem: maxOrdemCat })
              .select("id_categoria")
              .single();
            if (error) throw error;
            catIdMap.set(catNome, nova.id_categoria);
            catMapNome.set(key, nova.id_categoria);
            totalCatsCriadas++;
          }
        }

        // 4. Get current max ordem per categoria
        const allCatIds = [...catIdMap.values()];
        const { data: pergsExistentes } = await sb
          .from("qps_perguntas")
          .select("id_categoria, ordem")
          .in("id_categoria", allCatIds);

        const maxOrdPerg = new Map<string, number>();
        for (const p of pergsExistentes ?? []) {
          const cur = maxOrdPerg.get(p.id_categoria) ?? 0;
          if (p.ordem > cur) maxOrdPerg.set(p.id_categoria, p.ordem);
        }

        // 5. Build and insert pergunta rows
        const pergRows = [];
        const localOrdem = new Map<string, number>();
        for (const perg of tipoData.perguntas) {
          const idCategoria = catIdMap.get(perg.categoria);
          if (!idCategoria) continue;
          const base = maxOrdPerg.get(idCategoria) ?? 0;
          const local = localOrdem.get(idCategoria) ?? 0;
          localOrdem.set(idCategoria, local + 1);
          pergRows.push({
            id_categoria: idCategoria,
            texto: perg.texto,
            logica: perg.logica,
            ordem: base + local + 1,
            ativo: true,
          });
        }

        if (pergRows.length > 0) {
          const { error } = await sb.from("qps_perguntas").insert(pergRows);
          if (error) throw error;
          totalPerguntas += pergRows.length;
        }
      }

      return { totalPerguntas, totalTiposCriados, totalCatsCriadas };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["qps-tipos"] });
      qc.invalidateQueries({ queryKey: ["qps-categorias"] });
      qc.invalidateQueries({ queryKey: ["qps-perguntas"] });
      qc.invalidateQueries({ queryKey: ["qps-all-perguntas"] });
    },
  });
}
