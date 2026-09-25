"use client";

import { use } from "react";
import AetPsicossocialEditor from "@/components/aet/AetPsicossocialEditor";

// O editor mora em `components/aet/AetPsicossocialEditor.tsx` para ser usado também na aba
// AET da inspeção (v259).
export default function Page({ params }: { params: Promise<{ idRelatorio: string }> }) {
  const { idRelatorio } = use(params);
  return <AetPsicossocialEditor idRelatorio={idRelatorio} />;
}
