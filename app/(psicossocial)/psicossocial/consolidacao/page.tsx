import { redirect } from "next/navigation";

// A Consolidação de Grupo saiu do DRPS em 19/10/2026 e virou módulo próprio da
// Segurança do Trabalho. Link antigo continua funcionando.
export default function ConsolidacaoMudouDeLugar() {
  redirect("/consolidacao-grupo");
}
