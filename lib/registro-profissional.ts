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
