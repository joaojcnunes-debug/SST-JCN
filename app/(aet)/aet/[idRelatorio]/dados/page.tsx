"use client";

import { use } from "react";
import AetDadosEditor from "@/components/aet/AetDadosEditor";

// O editor mora em `components/aet/AetDadosEditor.tsx` para ser usado também na aba
// AET da inspeção (v259).
export default function Page({ params }: { params: Promise<{ idRelatorio: string }> }) {
  const { idRelatorio } = use(params);
  return <AetDadosEditor idRelatorio={idRelatorio} />;
}
