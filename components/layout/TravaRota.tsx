"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { useUserStore } from "@/lib/store";
import { rotaNaLista } from "@/lib/acesso/rotas-protegidas";

/** O que aparece no lugar da tela enquanto o acesso não está confirmado. */
export function AcessoVerificando() {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin" />
      Verificando acesso...
    </div>
  );
}

/**
 * Trava por endereço: nas `rotas`, a tela só é desenhada para quem tem
 * `permitido`. Enquanto o usuário carrega, mostra o aviso de verificação;
 * sem permissão, avisa e manda para `destino`. Fora das `rotas`, não faz nada.
 */
export default function TravaRota({
  rotas,
  permitido,
  destino,
  aviso = "Só quem supervisiona o módulo abre as telas de configuração",
  children,
}: {
  rotas: readonly string[];
  permitido: boolean;
  destino: string;
  aviso?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useUserStore((s) => s.user);
  const avisouRef = useRef(false);
  const protegida = rotaNaLista(pathname, rotas);
  const bloqueado = protegida && !!user && !permitido;

  useEffect(() => {
    if (!bloqueado) return;
    if (!avisouRef.current) {
      avisouRef.current = true;
      toast.error(aviso);
    }
    router.replace(destino);
  }, [bloqueado, aviso, destino, router]);

  if (!protegida) return <>{children}</>;
  if (!user || !permitido) return <AcessoVerificando />;
  return <>{children}</>;
}
