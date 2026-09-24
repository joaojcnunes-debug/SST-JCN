import { redirect } from "next/navigation";

export default function Home() {
  // Landing pós-login: a "Visão geral" por unidade é a HOME (/inicio). O hub de módulos vive em /modulos.
  redirect("/inicio");
}
