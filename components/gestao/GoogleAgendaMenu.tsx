"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarCheck2, CalendarDays, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

type StatusGoogle = { configurado: boolean; conectado: boolean; desde: string | null; eventos: number; expirada: boolean };

const fmtData = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");
const tarefas = (n: number) => (n === 1 ? "1 tarefa" : `${n} tarefas`);

/**
 * Conectar é navegação (não fetch): a rota /api/gestao/google/connect responde 302 para o consentimento do Google, que
 * volta em /gestao?google=<flag> — a página da Gestão dá o aviso e abre o Meu Espaço (vale também quando a pessoa
 * conecta pelo menu da foto de outro módulo).
 */
function conectar() {
  window.location.href = "/api/gestao/google/connect";
}

function useGoogleAgendaStatus() {
  return useQuery<StatusGoogle>({
    queryKey: ["gestao-google-status"],
    queryFn: async () => {
      const r = await fetch("/api/gestao/google/status");
      if (!r.ok) throw new Error("status");
      return r.json();
    },
    staleTime: 60_000,
  });
}

/**
 * Google Agenda no menu da foto (pedido de 10/11/2026: saiu do topo do Meu Espaço, ao lado de Notificações e das OS).
 * Mostra se a conta Google DO USUÁRIO está conectada e oferece Conectar / Desconectar. A confirmação de Desconectar
 * fica dentro do próprio menu: fora da Gestão a página não monta o ConfirmHost (o confirmar() cairia no window.confirm),
 * e uma janela por cima fecharia o menu no clique.
 */
export function GoogleAgendaMenu() {
  const qc = useQueryClient();
  const { data: st, isLoading, isError } = useGoogleAgendaStatus();
  const [confirmando, setConfirmando] = useState(false);

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
      setConfirmando(false);
      void qc.invalidateQueries({ queryKey: ["gestao-google-status"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível desconectar."),
  });

  // JCN: sem a configuração do Google no servidor a consulta falha — avisa em vez de ficar carregando.
  if (isError) {
    return (
      <div className="flex items-start gap-2.5 px-4 py-2 text-xs text-amber-700">
        <CalendarDays className="mt-0.5 size-4 shrink-0 text-amber-500" />
        <span>Google Agenda: não foi possível consultar a conexão. Se continuar, avise o administrador.</span>
      </div>
    );
  }
  if (isLoading || !st) {
    return (
      <div className="flex items-center gap-2.5 px-4 py-2">
        <CalendarDays className="size-4 shrink-0 text-gray-300" />
        <span className="h-4 flex-1 animate-pulse rounded bg-gray-100" />
      </div>
    );
  }

  let detalhe: string;
  let corDetalhe = "text-gray-500";
  let explica: string;
  if (!st.configurado) {
    detalhe = "Não configurada neste ambiente";
    corDetalhe = "text-amber-600";
    explica = "A integração com o Google ainda não está configurada neste ambiente.";
  } else if (st.expirada) {
    detalhe = "Autorização expirada";
    corDetalhe = "text-red-600";
    explica = "O Google não aceita mais a autorização do painel (acesso removido ou expirado). As tarefas não estão indo para a agenda — conecte de novo.";
  } else if (st.conectado) {
    detalhe = "Conectada"; // o número de tarefas fica no title: com o botão ao lado, a linha quebrava
    explica = `Conectada desde ${fmtData(st.desde!)} · ${tarefas(st.eventos)} na sua agenda. As tarefas com prazo em que você é responsável ou seguidor aparecem lá, e o evento que você criar na agenda vira tarefa no seu Meu Quadro (convidados entram como responsáveis).`;
  } else {
    detalhe = "Não conectada";
    explica = "Conecte sua conta para ver na sua agenda do Google as tarefas com prazo em que você é responsável ou seguidor.";
  }

  const botaoMarca = "shrink-0 rounded-md bg-marca-primary px-2.5 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-marca-accent disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="px-4 py-2">
      <div className="flex items-center gap-2.5">
        {st.conectado && !st.expirada
          ? <CalendarCheck2 className="size-4 shrink-0 text-marca-primary" />
          : <CalendarDays className="size-4 shrink-0 text-gray-400" />}
        <span className="min-w-0 flex-1" title={explica}>
          <span className="block whitespace-nowrap text-sm text-gray-700">Google Agenda</span>
          <span className={`block text-xs leading-snug ${corDetalhe}`}>{detalhe}</span>
        </span>
        {st.expirada ? (
          <button type="button" role="menuitem" onClick={conectar} className={botaoMarca}>Reconectar</button>
        ) : st.conectado ? (
          !confirmando && (
            <button
              type="button"
              role="menuitem"
              onClick={() => setConfirmando(true)}
              className="shrink-0 rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              Desconectar
            </button>
          )
        ) : (
          <button
            type="button"
            role="menuitem"
            onClick={conectar}
            disabled={!st.configurado}
            title={st.configurado ? undefined : "Integração com o Google não configurada neste ambiente"}
            className={botaoMarca}
          >
            Conectar
          </button>
        )}
      </div>
      {confirmando && (
        <div className="mt-2 rounded-lg bg-red-50 px-3 py-2">
          <p className="text-xs text-red-700">
            As tarefas do painel saem da sua agenda do Google e param de sincronizar. Os eventos que você mesmo criou lá ficam.
          </p>
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              disabled={desconectar.isPending}
              className="rounded-md px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-white disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => desconectar.mutate()}
              disabled={desconectar.isPending}
              className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {desconectar.isPending && <Loader2 className="size-3 animate-spin" />} Desconectar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Meu Espaço: com a Google Agenda no menu da foto, aqui fica só o alerta de autorização expirada — sem ele a pessoa
 * não perceberia que as tarefas pararam de ir para a agenda.
 */
export function GoogleAgendaExpirada() {
  const { data: st } = useGoogleAgendaStatus();
  if (!st?.expirada) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
      <AlertTriangle className="size-5 shrink-0 text-red-600" />
      <p className="min-w-0 flex-1 text-sm text-red-700">
        O Google não aceita mais a autorização do painel (acesso removido ou expirado). As tarefas não estão indo para a sua agenda.
      </p>
      <button
        type="button"
        onClick={conectar}
        className="inline-flex items-center gap-1.5 rounded-lg bg-marca-primary px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-marca-accent active:scale-95"
      >
        <CalendarDays className="size-4" /> Conectar de novo
      </button>
    </div>
  );
}
