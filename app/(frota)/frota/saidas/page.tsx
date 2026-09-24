import { redirect } from "next/navigation";

/**
 * /frota/saidas foi ABSORVIDA por /frota/movimentacoes em 2026-08-18.
 *
 * As duas telas liam o mesmo `useChecklists()`, com a mesma busca e o mesmo
 * card: esta listava rascunho e não sabia nada de retorno, a outra sabia do
 * retorno e escondia rascunho. A aba Viagens da Movimentação ganhou o filtro
 * "Rascunhos" e passou a cobrir tudo que existia aqui.
 *
 * O redirecionamento fica: o endereço está em links salvos, no histórico do
 * navegador e no atalho da tela inicial de quem instalou o PWA. Apagar a rota
 * daria 404 justamente para quem mais usa o módulo.
 */
export default function SaidasPage() {
  redirect("/frota/movimentacoes");
}
