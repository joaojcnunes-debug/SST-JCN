import { redirect } from "next/navigation";

// A antiga tela "Medição" foi descontinuada: seu conteúdo agora vive na
// Visão geral unificada do inventário (filtro de categoria "Medição").
// Mantemos o redirect para não quebrar links/atalhos antigos.
export default function MedicoesPage() {
  redirect("/inventario-maquinas");
}
