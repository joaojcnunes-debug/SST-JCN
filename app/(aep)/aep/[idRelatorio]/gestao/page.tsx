"use client";

import { use } from "react";
import AepChecklistGestao from "@/components/aep/AepChecklistGestao";

// O checklist mora em `components/aep/AepChecklistGestao.tsx` para ser usado
// também na aba AEP da inspeção.
export default function Page({ params }: { params: Promise<{ idRelatorio: string }> }) {
  const { idRelatorio } = use(params);
  return <AepChecklistGestao idRelatorio={idRelatorio} />;
}
