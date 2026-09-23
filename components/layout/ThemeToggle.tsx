"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTema } from "@/lib/store";

/**
 * Botão lua/sol na topbar. Alterna claro↔escuro. Só decide o ícone depois de
 * montar (evita divergência de hidratação, já que o tema vem do localStorage).
 */
export default function ThemeToggle() {
  const tema = useTema((s) => s.tema);
  const toggle = useTema((s) => s.toggle);
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  const escuro = montado && tema === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={escuro ? "Ativar modo claro" : "Ativar modo escuro"}
      title={escuro ? "Modo claro" : "Modo escuro"}
      className="flex size-8 shrink-0 items-center justify-center rounded-full text-white/70 transition hover:bg-white/[0.12] hover:text-white"
    >
      {escuro ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
    </button>
  );
}
