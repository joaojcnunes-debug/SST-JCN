"use client";

import { type ReactNode } from "react";
import ModuleTopbar from "@/components/layout/ModuleTopbar";
import { useAuth } from "@/lib/hooks/useAuth";

/**
 * Grupo próprio, e SEM `useRequireModule` — de propósito.
 *
 * A tela de pendências serve os sete módulos de campo. Enquanto viveu dentro do
 * grupo `(app)`, herdava a exigência do módulo "painel": um técnico com
 * permissão só de conformidade seria expulso para `/modulos` ao tocar no selo
 * da barra superior, e nunca conseguiria enviar o próprio trabalho guardado no
 * celular. Exatamente quem mais precisa da tela era quem não podia abri-la.
 *
 * O que ela mostra já é filtrado por natureza: são as operações do PRÓPRIO
 * aparelho, gravadas por quem está logado nele. Não há dado de terceiro para
 * proteger aqui — e o envio continua passando pela RLS do PostgREST, que é onde
 * a permissão de verdade mora.
 *
 * Sem barra lateral: a tela é um destino de passagem, alcançado pelo selo e
 * abandonado assim que a fila esvazia. O menu de qual módulo apareceria?
 */
export default function PendenciasLayout({ children }: { children: ReactNode }) {
  useAuth();

  return (
    <div className="app-aurora min-h-screen print:bg-white">
      <ModuleTopbar />
      <main className="mx-auto max-w-[1400px] px-4 py-6 md:px-6">{children}</main>
    </div>
  );
}
