import { redirect } from "next/navigation";

// A liberação para o Comercial virou etapa da Conciliação (0.3.238); o endereço antigo leva para lá.
export default function LiberarComercialPage() {
  redirect("/consolidacao-grupo/conciliacao");
}
