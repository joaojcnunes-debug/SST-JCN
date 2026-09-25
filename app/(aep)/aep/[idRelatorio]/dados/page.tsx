"use client";

import { use } from "react";
import AepDadosEditor from "@/components/aep/AepDadosEditor";

// O editor mora em `components/aep/AepDadosEditor.tsx` para ser usado também na aba
// AEP da inspeção (v259).
export default function Page({ params }: { params: Promise<{ idRelatorio: string }> }) {
  const { idRelatorio } = use(params);
  return <AepDadosEditor idRelatorio={idRelatorio} />;
}
