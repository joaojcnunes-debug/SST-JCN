// Quem pode assinar (ou validar certificado) EM NOME DE OUTRO profissional.
//
// A regra vivia copiada em três rotas — /api/sign-pdf, /api/sign-image e
// /api/cert/validar — cada uma com seu próprio `!== "Admin"`. Passou a morar
// aqui em 2026-08-10, quando os Técnicos foram incluídos: com a regra em três
// lugares, liberar em dois e esquecer o terceiro deixaria a tela pedindo a
// senha e o servidor recusando depois.
//
// ⚠️ Peso diferente por caminho de assinatura:
//   - Imagem (/api/sign-image): não pede segredo nenhum. Quem está nesta lista
//     carimba a assinatura de outra pessoa direto.
//   - Certificado A1 (/api/sign-pdf): continua exigindo a SENHA do .pfx do
//     titular. A lista abre a porta; a senha do colega segue sendo o que de
//     fato impede assinar sem o consentimento dele.
//
// Toda assinatura fica registrada em `pdfs_assinados.assinado_por` e em
// `document_audit_logs` com a ação `assinou_pdf`.
//
// Quando a área de permissões do SGG for portada para o painel, é este arquivo
// que deve ser trocado por uma permissão granular por usuário — não os `if`
// espalhados pelas rotas.

import type { PerfilUsuario } from "@/lib/supabase/types";

/** Perfis autorizados a assinar em nome de outro profissional. */
export const PERFIS_ASSINAM_POR_OUTRO: readonly PerfilUsuario[] = [
  "Admin",
  "Tecnico",
] as const;

/** `true` quando o perfil informado pode assinar em nome de outro profissional. */
export function perfilPodeAssinarPorOutro(perfil: string | null | undefined): boolean {
  if (!perfil) return false;
  return (PERFIS_ASSINAM_POR_OUTRO as readonly string[]).includes(perfil);
}
