import { redirect } from "next/navigation";

/**
 * O Catálogo deixou de ser uma tela (21/09/2026): o cadastro e a edição do
 * produto vivem dentro do "Dar entrada", na Movimentação. Quem tinha o link
 * salvo cai na área certa em vez de num 404.
 */
export default function CatalogoPage() {
  redirect("/equipamentos/movimentacao");
}
