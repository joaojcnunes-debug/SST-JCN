"use client";

import { use } from "react";
import AetPlanoAcaoEditor from "@/components/aet/AetPlanoAcaoEditor";

// O editor mora em `components/aet/AetPlanoAcaoEditor.tsx` para ser usado também na aba
// AET da inspeção (v259).
export default function Page({ params }: { params: Promise<{ idRelatorio: string }> }) {
  const { idRelatorio } = use(params);
  return <AetPlanoAcaoEditor idRelatorio={idRelatorio} />;
}
