import { redirect } from "next/navigation";

export default function Home() {
  // Landing pós-login: a "Visão geral" por unidade. Os módulos continuam em /inicio.
  redirect("/visao-geral");
}
