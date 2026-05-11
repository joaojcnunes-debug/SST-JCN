"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Loader2, Sparkles } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { useEmpresas } from "@/lib/hooks/useEmpresas";
import { useSaveAcao } from "@/lib/hooks/useAcoes";
import { useCurrentUser, useIsAdmin } from "@/lib/hooks/useUsuario";
import { useTipoIcone } from "@/lib/hooks/useV3";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { gerarId } from "@/lib/utils";
import type {
  Acao5W2H,
  AcaoPrioridade,
  AcaoStatus,
  Risco,
  Setor,
} from "@/lib/supabase/types";

interface Props {
  open: boolean;
  onClose: () => void;
  editing: Acao5W2H | null;
}

const STATUSES: AcaoStatus[] = [
  "Pendente",
  "Em Andamento",
  "Concluida",
  "Cancelada",
];

const PRIORIDADES: AcaoPrioridade[] = ["Baixa", "Media", "Alta", "Critica"];

// Carrega setores e riscos da empresa selecionada (cross-inspeções)
function useSetoresPorEmpresa(idEmpresa: string | null) {
  return useQuery({
    queryKey: ["acao-setores", idEmpresa],
    enabled: !!idEmpresa,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("setores")
        .select("*")
        .eq("id_empresa", idEmpresa!)
        .order("setor_ghe");
      if (error) throw error;
      return (data ?? []) as unknown as Setor[];
    },
  });
}

function useRiscosPorEmpresa(idEmpresa: string | null) {
  return useQuery({
    queryKey: ["acao-riscos", idEmpresa],
    enabled: !!idEmpresa,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("riscos")
        .select("*")
        .eq("id_empresa", idEmpresa!)
        .order("agente");
      if (error) throw error;
      return (data ?? []) as unknown as Risco[];
    },
  });
}

export default function AcaoForm({ open, onClose, editing }: Props) {
  const { data: empresas = [] } = useEmpresas();
  const save = useSaveAcao();
  const user = useCurrentUser();
  const isAdmin = useIsAdmin();
  const iconeDe = useTipoIcone();
  const [gerandoIA, setGerandoIA] = useState(false);

  const [form, setForm] = useState({
    id_empresa: "",
    id_setor: "",
    id_risco: "",
    what_acao: "",
    why_justificativa: "",
    where_local: "",
    when_prazo: "",
    who_responsavel: "",
    how_metodo: "",
    how_much_custo: "",
    status: "Pendente" as AcaoStatus,
    prioridade: "Media" as AcaoPrioridade,
    data_conclusao: "",
    observacoes: "",
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      id_empresa: editing?.id_empresa ?? "",
      id_setor: editing?.id_setor ?? "",
      id_risco: editing?.id_risco ?? "",
      what_acao: editing?.what_acao ?? "",
      why_justificativa: editing?.why_justificativa ?? "",
      where_local: editing?.where_local ?? "",
      when_prazo: editing?.when_prazo ?? "",
      who_responsavel: editing?.who_responsavel ?? "",
      how_metodo: editing?.how_metodo ?? "",
      how_much_custo: editing?.how_much_custo ?? "",
      status: editing?.status ?? "Pendente",
      prioridade: editing?.prioridade ?? "Media",
      data_conclusao: editing?.data_conclusao ?? "",
      observacoes: editing?.observacoes ?? "",
    });
  }, [open, editing]);

  const { data: setores = [] } = useSetoresPorEmpresa(form.id_empresa || null);
  const { data: riscos = [] } = useRiscosPorEmpresa(form.id_empresa || null);

  // Filtra riscos do setor escolhido (se houver) — senão lista todos
  const riscosFiltrados = form.id_setor
    ? riscos.filter((r) => r.id_setor === form.id_setor || !r.id_setor)
    : riscos;

  async function gerarComIA() {
    if (!form.id_empresa) {
      toast.error("Selecione a empresa antes de gerar com IA");
      return;
    }
    setGerandoIA(true);
    try {
      const empresaSel = empresas.find((e) => e.id_empresa === form.id_empresa);
      const setorSel = setores.find((s) => s.id_setor === form.id_setor);
      const riscoSel = riscos.find((r) => r.id_risco === form.id_risco);

      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.functions.invoke(
        "gerar-acao-ia",
        {
          body: {
            empresa: {
              nome: empresaSel?.nome_empresa ?? null,
              cnpj: empresaSel?.cnpj ?? null,
            },
            setor: setorSel
              ? {
                  nome: setorSel.setor_ghe,
                  descricao: setorSel.descricao ?? null,
                }
              : null,
            risco: riscoSel
              ? {
                  tipo: riscoSel.tipo_risco,
                  agente: riscoSel.agente,
                  fonte: riscoSel.fonte_geradora,
                  severidade: riscoSel.severidade,
                  probabilidade: riscoSel.probabilidade,
                  nivel: riscoSel.nivel_risco,
                  medidasRecomendadas: riscoSel.medidas_recomendadas,
                }
              : null,
            parcial: {
              what_acao: form.what_acao,
              why_justificativa: form.why_justificativa,
              where_local: form.where_local,
              who_responsavel: form.who_responsavel,
              how_metodo: form.how_metodo,
              how_much_custo: form.how_much_custo,
            },
          },
        }
      );

      if (error) throw error;
      const ai = (data as { data?: Record<string, unknown> } | null)?.data;
      if (!ai) throw new Error("Resposta vazia da IA");

      // Converte prazo em dias para data ISO (hoje + N dias)
      let prazoData = "";
      const prazoDias = ai.when_prazo_dias;
      if (typeof prazoDias === "number" && prazoDias > 0) {
        const d = new Date();
        d.setDate(d.getDate() + prazoDias);
        prazoData = d.toISOString().split("T")[0];
      }

      // Aplica IA só nos campos vazios (preserva o que usuário digitou)
      setForm((f) => ({
        ...f,
        what_acao: f.what_acao || String(ai.what_acao ?? ""),
        why_justificativa:
          f.why_justificativa || String(ai.why_justificativa ?? ""),
        where_local:
          f.where_local ||
          String(ai.where_local ?? "") ||
          (setorSel?.setor_ghe ?? ""),
        who_responsavel:
          f.who_responsavel || String(ai.who_responsavel ?? ""),
        how_metodo: f.how_metodo || String(ai.how_metodo ?? ""),
        how_much_custo:
          f.how_much_custo || String(ai.how_much_custo ?? ""),
        when_prazo: f.when_prazo || prazoData,
        // Prioridade: só substitui se ainda é o default "Media"
        prioridade:
          f.prioridade !== "Media"
            ? f.prioridade
            : (ai.prioridade as AcaoPrioridade) ?? "Media",
      }));
      toast.success("Plano gerado pela IA — revise antes de salvar");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Erro ao gerar com IA"
      );
    } finally {
      setGerandoIA(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.id_empresa) {
      toast.error("Selecione a empresa");
      return;
    }
    if (!form.what_acao.trim()) {
      toast.error("Descreva a ação (O quê)");
      return;
    }
    save.mutate(
      {
        id_acao: editing?.id_acao ?? gerarId("ACA"),
        id_empresa: form.id_empresa,
        id_setor: form.id_setor || null,
        id_risco: form.id_risco || null,
        id_inspecao: editing?.id_inspecao ?? null,
        what_acao: form.what_acao.trim(),
        why_justificativa: form.why_justificativa.trim() || null,
        where_local: form.where_local.trim() || null,
        when_prazo: form.when_prazo || null,
        who_responsavel: form.who_responsavel.trim() || null,
        how_metodo: form.how_metodo.trim() || null,
        how_much_custo: form.how_much_custo.trim() || null,
        status: form.status,
        prioridade: form.prioridade,
        data_conclusao: form.data_conclusao || null,
        observacoes: form.observacoes.trim() || null,
        created_by: editing?.created_by ?? user?.email ?? null,
      },
      { onSuccess: onClose }
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Editar Ação" : "Nova Ação (5W2H)"}
      size="xl"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {/* Identificação */}
        <section className="space-y-3 rounded-lg border border-gray-200 bg-gray-50/40 p-3">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-600">
            Identificação
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Empresa *">
              <select
                value={form.id_empresa}
                onChange={(e) =>
                  setForm({
                    ...form,
                    id_empresa: e.target.value,
                    id_setor: "",
                    id_risco: "",
                  })
                }
                required
                className={inputCls}
              >
                <option value="">— Selecione —</option>
                {empresas.map((e) => (
                  <option key={e.id_empresa} value={e.id_empresa}>
                    {e.nome_empresa}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Setor (opcional)">
              <select
                value={form.id_setor}
                onChange={(e) =>
                  setForm({ ...form, id_setor: e.target.value, id_risco: "" })
                }
                disabled={!form.id_empresa}
                className={inputCls}
              >
                <option value="">— Não vincular —</option>
                {setores.map((s) => (
                  <option key={s.id_setor} value={s.id_setor}>
                    {s.setor_ghe}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Risco (opcional)">
              <select
                value={form.id_risco}
                onChange={(e) => setForm({ ...form, id_risco: e.target.value })}
                disabled={!form.id_empresa}
                className={inputCls}
              >
                <option value="">— Não vincular —</option>
                {riscosFiltrados.map((r) => (
                  <option key={r.id_risco} value={r.id_risco}>
                    {iconeDe(r.tipo_risco)} {r.agente ?? r.tipo_risco}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </section>

        {/* 5W2H */}
        <section className="space-y-3 rounded-lg border-l-4 border-verde-primary bg-verde-light/30 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-verde-primary">
              5W2H — Plano de Ação
            </p>
            {isAdmin && (
              <button
                type="button"
                onClick={gerarComIA}
                disabled={gerandoIA || !form.id_empresa}
                className="inline-flex items-center gap-1.5 rounded-md border border-purple-300 bg-gradient-to-r from-purple-50 to-pink-50 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:from-purple-100 hover:to-pink-100 disabled:cursor-not-allowed disabled:opacity-50"
                title={
                  !form.id_empresa
                    ? "Selecione a empresa primeiro"
                    : "Preenche os 7 campos com sugestão da IA (Groq · Llama 3.3)"
                }
              >
                {gerandoIA ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5" />
                )}
                {gerandoIA ? "Gerando..." : "Gerar com IA"}
              </button>
            )}
          </div>

          <Field label="O QUÊ (What) — ação a ser executada *">
            <textarea
              value={form.what_acao}
              onChange={(e) => setForm({ ...form, what_acao: e.target.value })}
              required
              rows={2}
              placeholder="Ex: Instalar exaustores no setor de pintura"
              className={inputCls}
            />
          </Field>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="POR QUÊ (Why) — justificativa">
              <textarea
                value={form.why_justificativa}
                onChange={(e) =>
                  setForm({ ...form, why_justificativa: e.target.value })
                }
                rows={2}
                placeholder="Ex: Reduzir exposição a vapores químicos"
                className={inputCls}
              />
            </Field>
            <Field label="ONDE (Where) — local">
              <input
                type="text"
                value={form.where_local}
                onChange={(e) =>
                  setForm({ ...form, where_local: e.target.value })
                }
                placeholder="Ex: Setor de pintura, galpão B"
                className={inputCls}
              />
            </Field>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="QUEM (Who) — responsável">
              <input
                type="text"
                value={form.who_responsavel}
                onChange={(e) =>
                  setForm({ ...form, who_responsavel: e.target.value })
                }
                placeholder="Ex: João Silva — Gerente de Manutenção"
                className={inputCls}
              />
            </Field>
            <Field label="QUANDO (When) — prazo">
              <input
                type="date"
                value={form.when_prazo}
                onChange={(e) =>
                  setForm({ ...form, when_prazo: e.target.value })
                }
                className={inputCls}
              />
            </Field>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="COMO (How) — método">
              <textarea
                value={form.how_metodo}
                onChange={(e) =>
                  setForm({ ...form, how_metodo: e.target.value })
                }
                rows={2}
                placeholder="Ex: Contratar empresa especializada e instalar conforme NR-09"
                className={inputCls}
              />
            </Field>
            <Field label="QUANTO (How much) — custo estimado">
              <input
                type="text"
                value={form.how_much_custo}
                onChange={(e) =>
                  setForm({ ...form, how_much_custo: e.target.value })
                }
                placeholder="Ex: R$ 15.000,00"
                className={inputCls}
              />
            </Field>
          </div>
        </section>

        {/* Gestão */}
        <section className="space-y-3 rounded-lg border border-gray-200 p-3">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-600">
            Gestão
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Status">
              <select
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as AcaoStatus })
                }
                className={inputCls}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s === "Concluida" ? "Concluída" : s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Prioridade">
              <select
                value={form.prioridade}
                onChange={(e) =>
                  setForm({
                    ...form,
                    prioridade: e.target.value as AcaoPrioridade,
                  })
                }
                className={inputCls}
              >
                {PRIORIDADES.map((p) => (
                  <option key={p} value={p}>
                    {p === "Media"
                      ? "Média"
                      : p === "Critica"
                      ? "Crítica"
                      : p}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Data de conclusão">
              <input
                type="date"
                value={form.data_conclusao}
                onChange={(e) =>
                  setForm({ ...form, data_conclusao: e.target.value })
                }
                className={inputCls}
              />
            </Field>
          </div>
          <Field label="Observações">
            <textarea
              value={form.observacoes}
              onChange={(e) =>
                setForm({ ...form, observacoes: e.target.value })
              }
              rows={2}
              className={inputCls}
            />
          </Field>
        </section>

        <div className="flex justify-end gap-2 border-t border-gray-200 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={save.isPending}
            className="rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-60"
          >
            {save.isPending ? "Salvando..." : editing ? "Salvar" : "Criar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const inputCls =
  "mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30 disabled:bg-gray-100 disabled:text-gray-500";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}
