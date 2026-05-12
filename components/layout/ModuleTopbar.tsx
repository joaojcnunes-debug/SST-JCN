"use client";

import { useUserStore } from "@/lib/store";
import Badge from "@/components/ui/Badge";

export default function ModuleTopbar({ title }: { title: string }) {
  const user = useUserStore((s) => s.user);
  const perfilVariant: "info" | "success" | "muted" =
    user?.perfil === "Admin"
      ? "info"
      : user?.perfil === "Tecnico"
      ? "success"
      : "muted";

  return (
    <header className="sticky top-0 z-20 flex h-[54px] items-center justify-between border-b border-black/10 bg-verde-primary px-4 md:px-6 text-white shadow-sm">
      <h1 className="ml-12 md:ml-0 text-base font-semibold">{title}</h1>
      <div className="flex items-center gap-3">
        {user ? (
          <>
            <span className="hidden sm:block text-sm text-white/90">
              {user.nome}
            </span>
            <Badge variant={perfilVariant} className="hidden sm:inline-flex">
              {user.perfil}
            </Badge>
          </>
        ) : (
          <span className="text-sm text-white/70">Carregando...</span>
        )}
      </div>
    </header>
  );
}
