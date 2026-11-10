/**
 * Endereço de uma tarefa da Gestão (/gestao?quadro=…&tarefa=…). Puro e sem dependência de servidor: a janela da
 * tarefa usa no "Copiar link" (Painel 0.3.914) e os e-mails de aviso usam o mesmo (lib/gestao/avisos-email.ts, que
 * carrega o nodemailer e por isso não pode ir para o navegador).
 */
export function linkTarefa(appUrl: string, a: { id_quadro: string | null; id_tarefa: string | null }): string {
  const qs = new URLSearchParams();
  if (a.id_quadro) qs.set("quadro", a.id_quadro);
  if (a.id_tarefa) qs.set("tarefa", a.id_tarefa);
  const q = qs.toString();
  return `${appUrl.replace(/\/+$/, "")}/gestao${q ? `?${q}` : ""}`;
}
