import { redirect } from "next/navigation";

// A antiga tela "Máquinas" foi descontinuada: seu conteúdo agora vive na
// Visão geral unificada do inventário (filtro de categoria "Máquinas").
// Mantemos o redirect para não quebrar links/atalhos antigos.
export default function MaquinasPage() {
  redirect("/inventario-maquinas");
}
