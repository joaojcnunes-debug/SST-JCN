"use client";

import { use } from "react";
import AepSetoresEditor from "@/components/aep/AepSetoresEditor";

// O editor mora em `components/aep/AepSetoresEditor.tsx` para ser usado também na aba
// AEP da inspeção (v259).
export default function Page({ params }: { params: Promise<{ idRelatorio: string }> }) {
  const { idRelatorio } = use(params);
  return <AepSetoresEditor idRelatorio={idRelatorio} />;
}
