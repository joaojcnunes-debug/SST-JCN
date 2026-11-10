"use client";

import toast from "react-hot-toast";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { useUserStore } from "@/lib/store";
import { usePreferenciasAviso, useSalvarPreferenciasAviso, type PreferenciasAviso } from "@/lib/hooks/useGestao";

/**
 * v336 (Painel v335) — Meu espaço › Notificações: cada pessoa liga/desliga os avisos da Gestão no sino e por e-mail.
 * Vale para todos os avisos (atribuição, comentário, prazo, coluna que segue, automação…): o banco aplica a escolha
 * do destinatário no momento em que o aviso é gravado (gatilho v335), então não depende de qual tela gerou o aviso.
 */
function Chave({ ligado, onChange, disabled, rotulo }: { ligado: boolean; onChange: (v: boolean) => void; disabled?: boolean; rotulo: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      aria-label={rotulo}
      disabled={disabled}
      onClick={() => onChange(!ligado)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-marca-primary/40 disabled:cursor-not-allowed disabled:opacity-50 ${ligado ? "bg-marca-primary" : "bg-gray-300"}`}
    >
      <span className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${ligado ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
}

export default function PreferenciasAvisoCard() {
  const meuEmail = useUserStore((s) => s.user?.email ?? null);
  const { data: pref, isLoading } = usePreferenciasAviso();
  const salvar = useSalvarPreferenciasAviso();

  if (isLoading || !pref) {
    return <div className="h-[118px] animate-pulse rounded-xl border border-gray-200 bg-white" />;
  }

  function mudar(novo: PreferenciasAviso, aviso: string) {
    salvar.mutate(novo, { onSuccess: () => toast.success(aviso) });
  }
  const nenhum = !pref.painel && !pref.email;

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${nenhum ? "bg-gray-100 text-gray-500" : "bg-marca-light text-marca-primary"}`}>
          {nenhum ? <BellOff className="size-5" /> : <Bell className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-800">Notificações</p>
          <p className="text-xs text-gray-500">Avisos de tarefas atribuídas, comentários, prazos, colunas que você segue e automações.</p>
        </div>
        {salvar.isPending && <Loader2 className="size-4 animate-spin text-gray-400" />}
      </div>
      <div className="mt-3 space-y-2.5 border-t border-gray-100 pt-3">
        <label className="flex items-center justify-between gap-3">
          <span className="min-w-0">
            <span className="block text-sm font-medium text-gray-700">No sistema</span>
            <span className="block text-xs text-gray-500">Os avisos aparecem no sino da Gestão.</span>
          </span>
          <Chave
            ligado={pref.painel}
            disabled={salvar.isPending}
            rotulo="Notificações no sistema"
            onChange={(v) => mudar({ ...pref, painel: v }, v ? "Notificações no sistema ligadas." : "Notificações no sistema desligadas.")}
          />
        </label>
        <label className="flex items-center justify-between gap-3">
          <span className="min-w-0">
            <span className="block text-sm font-medium text-gray-700">Por e-mail</span>
            <span className="block truncate text-xs text-gray-500">Uma cópia de cada aviso chega em {meuEmail ?? "seu e-mail"}.</span>
          </span>
          <Chave
            ligado={pref.email}
            disabled={salvar.isPending}
            rotulo="Notificações por e-mail"
            onChange={(v) => mudar({ ...pref, email: v }, v ? "Notificações por e-mail ligadas." : "Notificações por e-mail desligadas.")}
          />
        </label>
        {nenhum && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
            Com as duas desligadas, você não recebe nenhum aviso da Gestão.
          </p>
        )}
      </div>
    </div>
  );
}
