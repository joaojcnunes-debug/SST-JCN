"use client";

import toast from "react-hot-toast";
import { useUserStore } from "@/lib/store";
import { usePreferenciasAviso, useSalvarPreferenciasAviso, type PreferenciasAviso } from "@/lib/hooks/useGestao";

/**
 * v336 (Painel v335) — cada pessoa liga/desliga os avisos da Gestão no sistema e por e-mail. Vale para todos os avisos (atribuição,
 * comentário, prazo, coluna que segue, automação…): o banco aplica a escolha do destinatário no momento em que o aviso
 * é gravado (gatilho v335), então não depende de qual tela gerou o aviso.
 * Desde 10/11/2026 as duas chaves ficam no menu da foto, logo abaixo de Notificações (antes: cartão no topo do Meu
 * Espaço). Cada linha é um menuitemcheckbox: o clique grava e o menu continua aberto para a pessoa ver a chave mudar.
 */
function ChaveVisual({ ligado }: { ligado: boolean }) {
  return (
    <span aria-hidden className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${ligado ? "bg-marca-primary" : "bg-gray-300"}`}>
      <span className={`inline-block size-4 rounded-full bg-white shadow transition-transform ${ligado ? "translate-x-[18px]" : "translate-x-0.5"}`} />
    </span>
  );
}

export function PreferenciasAvisoMenu() {
  const meuEmail = useUserStore((s) => s.user?.email ?? null);
  const { data: pref, isLoading } = usePreferenciasAviso();
  const salvar = useSalvarPreferenciasAviso();

  if (isLoading || !pref) {
    return <div className="my-1 ml-[42px] mr-4 h-[60px] animate-pulse rounded-lg bg-gray-100" />;
  }

  function mudar(novo: PreferenciasAviso, aviso: string) {
    salvar.mutate(novo, { onSuccess: () => toast.success(aviso) });
  }
  const nenhum = !pref.painel && !pref.email;
  const linha = "flex w-full items-center gap-3 py-1.5 pl-[42px] pr-4 text-left transition hover:bg-gray-50 disabled:cursor-wait disabled:opacity-60";

  return (
    <div>
      <button
        type="button"
        role="menuitemcheckbox"
        aria-checked={pref.painel}
        disabled={salvar.isPending}
        onClick={() => mudar({ ...pref, painel: !pref.painel }, pref.painel ? "Notificações no sistema desligadas." : "Notificações no sistema ligadas.")}
        className={linha}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-gray-700">No sistema</span>
          <span className="block truncate text-xs text-gray-500">Bolinha na foto e lista de avisos</span>
        </span>
        <ChaveVisual ligado={pref.painel} />
      </button>
      <button
        type="button"
        role="menuitemcheckbox"
        aria-checked={pref.email}
        disabled={salvar.isPending}
        onClick={() => mudar({ ...pref, email: !pref.email }, pref.email ? "Notificações por e-mail desligadas." : "Notificações por e-mail ligadas.")}
        title={meuEmail ? `Uma cópia de cada aviso chega em ${meuEmail}.` : undefined}
        className={linha}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-gray-700">Por e-mail</span>
          <span className="block truncate text-xs text-gray-500">Cópia de cada aviso</span>
        </span>
        <ChaveVisual ligado={pref.email} />
      </button>
      {nenhum && (
        <p className="mb-1 ml-[42px] mr-4 mt-0.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700">
          Com as duas desligadas, você não recebe nenhum aviso da Gestão.
        </p>
      )}
    </div>
  );
}
