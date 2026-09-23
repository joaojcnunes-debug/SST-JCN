/**
 * Detecta o tipo de registro profissional com base no cargo.
 * Retorna label, placeholder e o campo correspondente em `usuarios`.
 */

export type CampoRegistro = "crp" | "crm" | "registro_mte";

export interface RegistroInfo {
  label: string;
  placeholder: string;
  campo: CampoRegistro;
}

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function detectRegistroTipo(cargo: string | null | undefined): RegistroInfo {
  const c = norm(cargo ?? "");
  if (/psicol/.test(c))
    return { label: "CRP", placeholder: "Ex: 05/41807", campo: "crp" };
  if (/medic/.test(c))
    return { label: "CRM", placeholder: "Ex: 123456/SP", campo: "crm" };
  if (/segur|tec.*seg/.test(c))
    return { label: "Registro MTE", placeholder: "Ex: 123456", campo: "registro_mte" };
  return { label: "Registro Profissional", placeholder: "CRP / CRM / Registro MTE...", campo: "crp" };
}

/**
 * Formata o registro para a folha de assinaturas com o PREFIXO do conselho
 * que o cargo pede: "CRM 52-27712-0" para médico, "CRP 05/41807" para
 * psicólogo, "Reg. MTE 123456" para técnico de segurança. Cargo que não casa
 * com nenhum sai como sempre saiu: "Reg. <número>".
 *
 * Se o valor gravado já vem com o prefixo (alguém digitou "CRM 52-..." no
 * campo), não duplica.
 */
export function formatarRegistro(
  cargo: string | null | undefined,
  valor: string | null | undefined,
): string | null {
  const v = (valor ?? "").trim();
  if (!v) return null;
  const c = norm(cargo ?? "");
  const prefixo = /psicol/.test(c)
    ? "CRP"
    : /medic/.test(c)
      ? "CRM"
      : /segur|tec.*seg/.test(c)
        ? "Reg. MTE"
        : "Reg.";
  if (v.toLowerCase().startsWith(prefixo.toLowerCase())) return v;
  return `${prefixo} ${v}`;
}

/**
 * Compara dois nomes ignorando acento, caixa e espaço repetido.
 *
 * Usado como trava do preenchimento retroativo (`onMatchFound`): o match do
 * ProfissionalSelect é DIFUSO de propósito — casa por substring e por palavra,
 * então "Ana" casa com "Mariana" — o que serve para pré-selecionar o combo, mas
 * NÃO serve para escolher de quem é o registro profissional que vai para o
 * laudo. Registro de outro profissional num documento assinado é pior do que
 * campo em branco, então aqui a exigência é nome idêntico.
 */
export function mesmoNome(a: string | null | undefined, b: string | null | undefined): boolean {
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  if (!a || !b) return false;
  return norm(a) === norm(b);
}

/** Retorna o primeiro valor de registro preenchido para o usuário. */
export function getRegistroValue(user: {
  cargo?: string | null;
  crp?: string | null;
  crm?: string | null;
  registro_mte?: string | null;
}): string {
  const info = detectRegistroTipo(user.cargo);
  // Prioriza o campo mapeado pelo cargo; cai para outros se vazio
  return (
    user[info.campo] ??
    user.crp ??
    user.crm ??
    user.registro_mte ??
    ""
  );
}
