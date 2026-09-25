"use client";

import { use } from "react";
import AetSetoresEditor from "@/components/aet/AetSetoresEditor";

// O editor mora em `components/aet/AetSetoresEditor.tsx` para ser usado também na aba
// AET da inspeção (v259).
export default function Page({ params }: { params: Promise<{ idRelatorio: string }> }) {
  const { idRelatorio } = use(params);
  return <AetSetoresEditor idRelatorio={idRelatorio} />;
}
