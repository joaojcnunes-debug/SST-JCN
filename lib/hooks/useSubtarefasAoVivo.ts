"use client";

// Lista de subtarefas "ao vivo" (11/11/2026). Pedido do usuário: criar a subtarefa numa janela igual à da Nova tarefa e
// "editar os itens sem precisar abrir a subtarefa". Na tarefa já salva, cada mudança na lista grava na hora (como o
// status da janela desde a 0.3.871); antes ia tudo junto no "Salvar" da tarefa. Na Nova tarefa a lista continua sendo
// rascunho até "Criar tarefa" (useSalvarSubtarefas).
//
// Etapa e datas da subtarefa criada na Gestão ficam na janela dela (tarefa filha, v300): status, data_inicio/hora_inicio
// e prazo/hora_fim. A linha sem janela ganha uma (gestao_subtarefa_abrir) na 1ª vez que alguém muda a etapa ou uma data
// — o mesmo que o duplo clique faz. Os gatilhos da v300 levam título/feito/responsável de um lado para o outro.

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { gerarId } from "@/lib/utils";
import { mensagemErro } from "@/lib/errors";
import type { GestaoSubtarefa } from "@/lib/hooks/useGestao";

/** O que a lista mostra da janela (tarefa filha) de cada subtarefa. Horas vêm 'HH:MM:SS' do banco. */
export interface JanelaSubtarefa {
  id_tarefa: string;
  status: string;
  data_inicio: string | null;
  hora_inicio: string | null;
  prazo: string | null;
  hora_fim: string | null;
  prioridade: string | null;
}

export type PatchJanela = Partial<Pick<JanelaSubtarefa, "status" | "data_inicio" | "hora_inicio" | "prazo" | "hora_fim" | "prioridade">>;
export type PatchLinha = Partial<Pick<GestaoSubtarefa, "texto" | "feito" | "responsavel_email">>;

const CHAVE_JANELAS = "gestao-subtarefas-janelas";
// Responsáveis das janelas: chave PRÓPRIA (12/11/2026). Debaixo de CHAVE_JANELAS o onMutate da data
// (useAtualizarJanelaSubtarefa) reescrevia este cache como se fosse de janelas e a lista quebrava ("not iterable").
const CHAVE_RESP_JANELAS = "gestao-subtarefas-responsaveis";

/** Depois de qualquer mudança: a lista, as janelas, o cartão (contagem pelo espelho jsonb), Meu espaço e Agenda. */
function recarregar(qc: QueryClient, idTarefa: string) {
  qc.invalidateQueries({ queryKey: ["gestao-subtarefas", idTarefa] });
  qc.invalidateQueries({ queryKey: [CHAVE_JANELAS] });
  qc.invalidateQueries({ queryKey: [CHAVE_RESP_JANELAS] });
  qc.invalidateQueries({ queryKey: ["gestao-tarefas"] });
  qc.invalidateQueries({ queryKey: ["gestao-minhas"] });
  qc.invalidateQueries({ queryKey: ["gestao-agenda-de"] });
}

/** Muda a lista em cache na hora (a tela não espera o servidor); devolve como estava, para desfazer se falhar. */
async function mexerNaLista(qc: QueryClient, idTarefa: string, f: (l: GestaoSubtarefa[]) => GestaoSubtarefa[]) {
  const chave = ["gestao-subtarefas", idTarefa];
  await qc.cancelQueries({ queryKey: chave });
  const antes = qc.getQueryData<GestaoSubtarefa[]>(chave);
  if (antes) qc.setQueryData<GestaoSubtarefa[]>(chave, f(antes));
  return antes;
}

async function proximaOrdem(idTarefa: string): Promise<number> {
  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb.from("gestao_subtarefas").select("ordem").eq("id_tarefa", idTarefa).order("ordem", { ascending: false }).limit(1);
  if (error) throw error;
  return (((data?.[0] as { ordem?: number } | undefined)?.ordem) ?? -1) + 1;
}

async function abrirJanela(idSubtarefa: string): Promise<string> {
  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb.rpc("gestao_subtarefa_abrir", { p_id_subtarefa: idSubtarefa } as never);
  if (error) throw error;
  return data as unknown as string;
}

/** Status, prioridade e datas das janelas, por id da tarefa filha. A RLS decide (quem vê a mãe vê as filhas). */
export function useJanelasDasSubtarefas(idsFilhas: string[]) {
  const chave = [...new Set(idsFilhas)].sort().join(",");
  return useQuery({
    queryKey: [CHAVE_JANELAS, chave],
    enabled: chave !== "",
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("gestao_tarefas")
        .select("id_tarefa,status,data_inicio,hora_inicio,prazo,hora_fim,prioridade")
        .in("id_tarefa", chave.split(","));
      if (error) throw error;
      const porId: Record<string, JanelaSubtarefa> = {};
      for (const t of (data ?? []) as unknown as JanelaSubtarefa[]) porId[t.id_tarefa] = t;
      return porId;
    },
  });
}

/**
 * Responsáveis (vínculo tipo "responsavel") de cada janela, por id da tarefa filha — a linha guarda um só, a janela pode
 * ter vários (11/11/2026: a lista mostra todos). Chave própria (ver CHAVE_RESP_JANELAS); `recarregar` atualiza as duas.
 */
export function useResponsaveisDasJanelas(idsFilhas: string[]) {
  const chave = [...new Set(idsFilhas)].sort().join(",");
  return useQuery({
    queryKey: [CHAVE_RESP_JANELAS, chave],
    enabled: chave !== "",
    queryFn: async () => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("gestao_tarefa_vinculados")
        .select("id_tarefa,usuario_email,created_at")
        .eq("tipo", "responsavel")
        .in("id_tarefa", chave.split(","))
        .order("created_at", { ascending: true });
      if (error) throw error;
      const porId: Record<string, string[]> = {};
      for (const v of (data ?? []) as unknown as { id_tarefa: string; usuario_email: string }[]) {
        (porId[v.id_tarefa] ??= []).push(v.usuario_email.toLowerCase());
      }
      return porId;
    },
  });
}

/** Mensagem da recusa do banco (gestao_vincular/desvincular) para a pessoa. */
function mensagemAlocar(e: unknown, tirar: boolean): string {
  const raw = String((e as { message?: string } | null)?.message ?? "");
  if (/so pode (des)?vincular a si mesmo/i.test(raw)) {
    return tirar
      ? "Você só pode tirar a si mesmo. Para tirar outra pessoa, é preciso nível Completo nesta lista."
      : "Você só pode se alocar. Para alocar outra pessoa, é preciso nível Completo nesta lista.";
  }
  if (/sem edicao/i.test(raw)) return "Você não pode editar esta lista.";
  return mensagemErro(e, tirar ? "Não foi possível tirar a pessoa." : "Não foi possível alocar a pessoa.");
}

/**
 * Põe ou tira uma pessoa da subtarefa pela própria lista (11/11/2026, pedido do usuário: "acrescentar alguém pelo lado
 * de fora, sem abrir a subtarefa"). Vale nos responsáveis da janela (tarefa filha) pelas mesmas RPCs da janela
 * (gestao_vincular / gestao_desvincular — mesmas regras: pessoa comum só a si mesma; nível Completo, qualquer um).
 * Sem janela: a 1ª pessoa vai no responsável da linha; a 2ª abre a janela (gestao_subtarefa_abrir leva o da linha) e
 * vincula. O banco espelha o 1º responsável da janela no da linha (gestao_vinculo_sync_subtarefa_trg).
 */
export function useAlocarNaSubtarefa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { idTarefa: string; idSubtarefa: string; idFilha: string | null; responsavelLinha: string | null; email: string; tirar?: boolean }) => {
      const sb = createSupabaseBrowserClient();
      const email = p.email.trim().toLowerCase();
      const daLinha = (p.responsavelLinha ?? "").trim().toLowerCase();
      if (!p.idFilha) {
        // sem janela: só existe o responsável da linha
        if (p.tirar) {
          if (daLinha !== email) return;
          const { error } = await sb.from("gestao_subtarefas").update({ responsavel_email: null } as never).eq("id", p.idSubtarefa);
          if (error) throw error;
          return;
        }
        if (!daLinha) {
          const { error } = await sb.from("gestao_subtarefas").update({ responsavel_email: email } as never).eq("id", p.idSubtarefa);
          if (error) throw error;
          return;
        }
        if (daLinha === email) return;
      }
      const filha = p.idFilha ?? (await abrirJanela(p.idSubtarefa));
      const { error } = await sb.rpc((p.tirar ? "gestao_desvincular" : "gestao_vincular") as never,
        { p_id_tarefa: filha, p_email: email, p_tipo: "responsavel" } as never);
      if (error) throw error;
    },
    onSuccess: (_r, p) => recarregar(qc, p.idTarefa),
    onError: (e, p) => {
      toast.error(mensagemAlocar(e, !!p.tirar));
      recarregar(qc, p.idTarefa);
    },
  });
}

/** Título, feito ou responsável de uma linha, na hora. */
export function useAtualizarSubtarefa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id: string; id_tarefa: string; patch: PatchLinha }) => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb.from("gestao_subtarefas").update(p.patch as never).eq("id", p.id).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("Sem permissão para alterar esta subtarefa (ou ela foi apagada).");
    },
    onMutate: async (p) => ({
      antes: await mexerNaLista(qc, p.id_tarefa, (l) => l.map((s) => (s.id === p.id ? { ...s, ...p.patch } : s))),
    }),
    onError: (e, p, ctx) => {
      if (ctx?.antes) qc.setQueryData(["gestao-subtarefas", p.id_tarefa], ctx.antes);
      toast.error(mensagemErro(e, "Não foi possível salvar a subtarefa."));
    },
    onSettled: (_d, _e, p) => recarregar(qc, p.id_tarefa),
  });
}

/** Linhas novas no fim da lista (o "Adicionar rápido" e as sugeridas pela IA). */
export function useAdicionarSubtarefas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id_tarefa: string; textos: string[] }) => {
      const textos = p.textos.map((t) => t.trim()).filter(Boolean);
      if (!textos.length) return;
      const base = await proximaOrdem(p.id_tarefa);
      const sb = createSupabaseBrowserClient();
      const linhas = textos.map((texto, i) => ({ id: gerarId("SUB"), id_tarefa: p.id_tarefa, texto, feito: false, responsavel_email: null, ordem: base + i }));
      const { error } = await sb.from("gestao_subtarefas").insert(linhas as never);
      if (error) throw error;
    },
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível adicionar a subtarefa.")),
    onSettled: (_d, _e, p) => recarregar(qc, p.id_tarefa),
  });
}

/** Exclui a subtarefa. Com janela: exclui a janela (tarefa filha), que vai para a Lixeira (v361) levando a linha junto
 *  pela FK — o mesmo caminho do Excluir de dentro da subtarefa. Apagar a LINHA faria o gatilho da v300 apagar a janela
 *  em cascata, e a Lixeira não guarda exclusão em cascata. Sem janela: só a linha, de vez (é só o título).
 *  Quem chama confirma antes. */
export function useExcluirSubtarefa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id: string; id_tarefa: string; id_filha?: string | null }) => {
      const sb = createSupabaseBrowserClient();
      const { data, error } = p.id_filha
        ? await sb.from("gestao_tarefas").delete().eq("id_tarefa", p.id_filha).select("id_tarefa")
        : await sb.from("gestao_subtarefas").delete().eq("id", p.id).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("Sem permissão para excluir esta subtarefa (ou ela já foi apagada).");
    },
    onMutate: async (p) => ({ antes: await mexerNaLista(qc, p.id_tarefa, (l) => l.filter((s) => s.id !== p.id)) }),
    onError: (e, p, ctx) => {
      if (ctx?.antes) qc.setQueryData(["gestao-subtarefas", p.id_tarefa], ctx.antes);
      toast.error(mensagemErro(e, "Não foi possível excluir a subtarefa."));
    },
    onSettled: (_d, _e, p) => {
      recarregar(qc, p.id_tarefa);
      qc.invalidateQueries({ queryKey: ["gestao-comentarios-subtarefas"] });
      if (p.id_filha) qc.invalidateQueries({ queryKey: ["gestao-lixeira"] });
    },
  });
}

/** Janela "Nova subtarefa": a linha no fim da lista + a janela dela (devolve o id da tarefa filha, que a tela completa
 *  com descrição, datas, etapa, responsáveis…). O 1º responsável vai na linha: é ele que recebe o aviso da subtarefa. */
export function useCriarSubtarefaComJanela() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id_tarefa: string; texto: string; responsavel_email: string | null }) => {
      const sb = createSupabaseBrowserClient();
      const id = gerarId("SUB");
      const ordem = await proximaOrdem(p.id_tarefa);
      const { error } = await sb.from("gestao_subtarefas").insert({
        id, id_tarefa: p.id_tarefa, texto: p.texto.trim(), feito: false, responsavel_email: p.responsavel_email, ordem,
      } as never);
      if (error) throw error;
      return abrirJanela(id);
    },
    onError: (e) => toast.error(mensagemErro(e, "Não foi possível criar a subtarefa.")),
    onSettled: (_d, _e, p) => recarregar(qc, p.id_tarefa),
  });
}

/** Etapa ou datas direto na lista: grava na janela (cria a janela se a linha ainda não tem). Devolve o id da filha. */
export function useAtualizarJanelaSubtarefa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id_subtarefa: string; id_tarefa: string; id_filha: string | null; patch: PatchJanela }) => {
      const id = p.id_filha ?? (await abrirJanela(p.id_subtarefa));
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("gestao_tarefas")
        .update({ ...p.patch, updated_at: new Date().toISOString() } as never)
        .eq("id_tarefa", id)
        .select("id_tarefa");
      if (error) throw error;
      if (!data?.length) throw new Error("Sem permissão para alterar esta subtarefa.");
      return id;
    },
    onMutate: async (p) => {
      await qc.cancelQueries({ queryKey: [CHAVE_JANELAS] });
      const antes = qc.getQueriesData<Record<string, JanelaSubtarefa>>({ queryKey: [CHAVE_JANELAS] });
      if (p.id_filha) {
        for (const [chave, porId] of antes) {
          const j = porId?.[p.id_filha];
          if (j) qc.setQueryData(chave, { ...porId, [p.id_filha]: { ...j, ...p.patch } });
        }
      }
      return { antes };
    },
    onError: (e, _p, ctx) => {
      for (const [chave, porId] of ctx?.antes ?? []) qc.setQueryData(chave, porId);
      toast.error(mensagemErro(e, "Não foi possível salvar a subtarefa."));
    },
    onSettled: (_d, _e, p) => {
      recarregar(qc, p.id_tarefa);
      qc.invalidateQueries({ queryKey: ["gestao-tarefa-timeline"] });
    },
  });
}
