/**
 * Quem deixa de ver a empresa quando a unidade dela muda.
 *
 * Não-Admin só enxerga empresa de unidade que tem (RLS
 * `caller_pode_ver_empresa`) — e, com ela, as inspeções. Em 02/10/2026 um
 * Admin passou a DUNA de Nova Friburgo para Teresópolis 6 minutos depois de o
 * técnico concluir a inspeção; para ele, empresa e inspeção "sumiram". Esta
 * função lista as pessoas que trabalharam na empresa e ficam sem acesso, para
 * a tela avisar ANTES de salvar.
 */

export type UsuarioAcesso = {
  nome: string | null;
  email: string | null;
  perfil: string | null;
  ativo_sistema: boolean | null;
  unidades: string[] | null;
};

export type PerdeAcesso = { nome: string; email: string; inspecoes: number };

export function quemPerdeAcesso(
  /** E-mails de quem criou as inspeções vivas da empresa (uma entrada por inspeção). */
  autoresInspecoes: (string | null)[],
  usuarios: UsuarioAcesso[],
  unidadeNova: string,
): PerdeAcesso[] {
  const porEmail = new Map<string, number>();
  for (const e of autoresInspecoes) {
    const k = e?.trim().toLowerCase();
    if (k) porEmail.set(k, (porEmail.get(k) ?? 0) + 1);
  }
  const saida: PerdeAcesso[] = [];
  for (const u of usuarios) {
    const k = u.email?.trim().toLowerCase();
    if (!k || !porEmail.has(k)) continue;
    if (u.ativo_sistema === false || u.perfil === "Admin") continue;
    if ((u.unidades ?? []).includes(unidadeNova)) continue;
    saida.push({ nome: u.nome || k, email: k, inspecoes: porEmail.get(k)! });
  }
  return saida.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
