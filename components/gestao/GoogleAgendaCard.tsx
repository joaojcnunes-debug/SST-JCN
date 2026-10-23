"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck2, CalendarDays, Loader2, Unplug } from "lucide-react";
import toast from "react-hot-toast";
import { confirmar } from "@/components/ui/confirm";

type StatusGoogle = { configurado: boolean; conectado: boolean; desde: string | null; eventos: number; expirada: boolean };

const fmtData = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

/**
 * Cartão "Google Agenda" do Meu Espaço (Etapa 1). Mostra se a conta Google DO USUÁRIO está
 * conectada e oferece Conectar / Desconectar. Conectar é navegação (não fetch): a rota
 * /api/gestao/google/connect responde 302 para o consentimento do Google, que volta em
 * /gestao?google=<flag> (o aviso é dado pela página da Gestão).
 */
export default function GoogleAgendaCard() {
  const qc = useQueryClient();
  const { data: st, isLoading, isError } = useQuery<StatusGoogle>({
    queryKey: ["gestao-google-status"],
    queryFn: async () => {
      const r = await fetch("/api/gestao/google/status");
      if (!r.ok) throw new Error("status");
      return r.json();
    },
    staleTime: 60_000,
  });

  const desconectar = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/gestao/google/disconnect", { method: "POST" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "Não foi possível desconectar.");
      return j as { removidos: number; falhas: number };
    },
    onSuccess: (r) => {
      toast.success(
        r.falhas > 0
          ? `Google Agenda desconectada. ${r.falhas} evento(s) não puderam ser apagados da sua agenda — apague-os por lá, se quiser.`
          : "Google Agenda desconectada. As tarefas do painel foram tiradas da sua agenda.",
      );
      void qc.invalidateQueries({ queryKey: ["gestao-google-status"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível desconectar."),
  });

  async function onDesconectar() {
    if (await confirmar({
      title: "Desconectar a Google Agenda?",
      description: "As tarefas do painel saem da sua agenda do Google e param de sincronizar (os eventos que você mesmo criou lá ficam). Você pode conectar de novo quando quiser.",
      confirmLabel: "Desconectar",
      variant: "danger",
    })) desconectar.mutate();
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <p className="font-semibold">Google Agenda</p>
        <p className="text-xs">Não foi possível consultar a conexão com o Google. Se continuar, avise o administrador (configuração do servidor).</p>
      </div>
    );
  }

  if (isLoading || !st) {
    return <div className="h-[74px] animate-pulse rounded-xl border border-gray-200 bg-white" />;
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${st.conectado ? "bg-verde-light text-verde-primary" : "bg-gray-100 text-gray-500"}`}>
        {st.conectado ? <CalendarCheck2 className="size-5" /> : <CalendarDays className="size-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-800">Google Agenda</p>
        <p className="text-xs text-gray-500">
          {st.conectado
            ? `Conectada desde ${fmtData(st.desde!)} · ${st.eventos} tarefa(s) na sua agenda. As tarefas com prazo em que você é responsável ou seguidor aparecem lá, e o evento que você criar na agenda vira tarefa no seu Meu Quadro (convidados entram como responsáveis).`
            : "Conecte sua conta para ver na sua agenda do Google as tarefas com prazo em que você é responsável ou seguidor."}
        </p>
        {!st.configurado && (
          <p className="mt-0.5 text-xs font-medium text-amber-600">A integração com o Google ainda não está configurada neste ambiente.</p>
        )}
        {st.expirada && (
          <p className="mt-0.5 text-xs font-medium text-red-600">
            O Google não aceita mais a autorização do painel (acesso removido ou expirado). As tarefas não estão indo para a agenda — conecte de novo.
          </p>
        )}
      </div>
      {st.expirada && (
        <button
          type="button"
          onClick={() => { window.location.href = "/api/gestao/google/connect"; }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-verde-primary px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-verde-accent active:scale-95"
        >
          <CalendarDays className="size-4" /> Conectar de novo
        </button>
      )}
      {st.conectado ? (
        <button
          type="button"
          onClick={onDesconectar}
          disabled={desconectar.isPending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {desconectar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Unplug className="size-4" />} Desconectar
        </button>
      ) : (
        <button
          type="button"
          onClick={() => { window.location.href = "/api/gestao/google/connect"; }}
          disabled={!st.configurado}
          title={st.configurado ? undefined : "Integração com o Google não configurada neste ambiente"}
          className="inline-flex items-center gap-1.5 rounded-lg bg-verde-primary px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-verde-accent active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CalendarDays className="size-4" /> Conectar Google Agenda
        </button>
      )}
    </div>
  );
}
