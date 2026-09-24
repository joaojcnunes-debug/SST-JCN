"use client";

import { useEffect, useState } from "react";

/**
 * Relógio que "tica" a cada N segundos. Serve para textos relativos ("há 29 min")
 * não envelhecerem entre uma consulta e outra. Nasceu com a Presença (v218).
 */
export function useAgora(intervaloMs = 30_000) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setAgora(Date.now()), intervaloMs);
    return () => window.clearInterval(t);
  }, [intervaloMs]);
  return agora;
}
