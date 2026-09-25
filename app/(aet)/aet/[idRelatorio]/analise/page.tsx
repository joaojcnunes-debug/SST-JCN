"use client";

import { use } from "react";
import AetAnaliseEditor from "@/components/aet/AetAnaliseEditor";

// O editor mora em `components/aet/AetAnaliseEditor.tsx` para ser usado também na aba
// AET da inspeção (v259).
export default function Page({ params }: { params: Promise<{ idRelatorio: string }> }) {
  const { idRelatorio } = use(params);
  return <AetAnaliseEditor idRelatorio={idRelatorio} />;
}
