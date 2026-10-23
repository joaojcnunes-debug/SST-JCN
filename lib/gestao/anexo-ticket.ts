/**
 * Ticket de anexo do formulário público da Gestão (OS de T.I). O POST de /api/gestao/form cria a
 * tarefa e devolve um ticket assinado (HMAC-SHA256) amarrado ao id da tarefa e a um prazo; a rota
 * /api/gestao/form/anexo só aceita arquivo com ticket válido. Assim um anônimo só anexa na tarefa
 * que ele mesmo acabou de abrir — sem login e sem coluna nova no banco.
 * Puro (a chave vem por parâmetro), testável offline.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/** Janela para subir os anexos depois de abrir a solicitação. */
export const VALIDADE_TICKET_MS = 30 * 60 * 1000;
/** Teto de arquivos por solicitação vinda do formulário. */
export const MAX_ANEXOS_FORM = 10;
/** Teto por arquivo do formulário (fotos e vídeos de celular): no JCN, o limite de upload do Storage (50 MB). */
export const MAX_BYTES_ANEXO_FORM = 50 * 1024 * 1024;

/** Chave do HMAC no JCN (Vercel): a service role do Supabase, que só existe no servidor. */
export function chaveTicketAnexo(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
}

function assinar(chave: string, idTarefa: string, exp: number): string {
  return createHmac("sha256", chave).update(`gestao-form-anexo:${idTarefa}:${exp}`).digest("base64url");
}

export function gerarTicketAnexo(chave: string, idTarefa: string, agora = Date.now()): string {
  const exp = agora + VALIDADE_TICKET_MS;
  return `${exp}.${assinar(chave, idTarefa, exp)}`;
}

export function ticketAnexoValido(chave: string, idTarefa: string, ticket: string, agora = Date.now()): boolean {
  const [expStr, sig] = (ticket ?? "").split(".");
  const exp = Number(expStr);
  if (!chave || !sig || !Number.isFinite(exp) || exp < agora) return false;
  const esperado = Buffer.from(assinar(chave, idTarefa, exp));
  const recebido = Buffer.from(sig);
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido);
}
