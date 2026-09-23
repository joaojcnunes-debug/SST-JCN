// A régua do que é "documento do psicossocial" — e o que NÃO é.
//
// POR QUE ISTO EXISTE, em 2026-09-10: os psicólogos avisaram que, ao puxar o
// relatório de uma empresa, vinham as inspeções de segurança junto. Eles usam a
// tela de Empresas, que é a ÚNICA área do painel sem checagem de módulo — ela
// junta numa página o que existe de todos os módulos daquela empresa.
//
// A tela de Empresas continua como está (a Supervisora e a Analista precisam
// dela para o resto do trabalho, e as contas delas TÊM inspeção de propósito).
// O que nasceu foi uma tela no Psicossocial que não FILTRA inspeção: ela não
// sabe ler inspeção. Esta lista é o limite dela.
//
// ⚠️ ESTA LISTA É DE VALORES MEDIDOS, NÃO DE PALPITE. `pdfs_gerados.modulo`
// tem DOIS vocabulários no mesmo campo. Contagem dos 437 PDFs da base em
// 2026-09-10:
//
//     drps                247   ← o psicossocial mora AQUI
//     inspecoes            68
//     nao_conformidade     42
//     aep                  41
//     conformidade         20
//     aet                  15
//     apreciacao_maquinas   3
//     analises_quimicos     1
//
// Quem escrevesse `psicossocial` (o nome do módulo no menu e em
// `modulos_permitidos`) pegaria ZERO linha e a tela nasceria vazia parecendo
// funcionar. Por isso `drps` vem primeiro e os outros entram como reserva:
// `psicossocial` e `questionarios*` aparecem no código de outros usos
// (auditoria, textos padrão) e podem passar a ser gravados em `pdfs_gerados`
// sem ninguém avisar esta lista.
//
// Questionários hoje geram **zero** PDF — a aplicação vive na tela. O valor
// fica na lista para o dia em que gerar.

/** Módulos de `pdfs_gerados` que são documento do psicossocial. */
export const MODULOS_DOC_PSICOSSOCIAL = [
  "drps",
  "psicossocial",
  "questionarios",
  "questionarios_psicossociais",
] as const;

/**
 * Decide se um PDF de `pdfs_gerados` entra na área do psicossocial.
 *
 * Recusa por padrão: módulo desconhecido, vazio ou nulo fica FORA. É o
 * contrário do que a tela de Empresas faz (mostra tudo) e é o ponto da trava —
 * um módulo novo qualquer não vaza para dentro desta área só por existir.
 */
export function ehDocumentoPsicossocial(modulo: string | null | undefined): boolean {
  const m = (modulo ?? "").trim().toLowerCase();
  if (!m) return false;
  return (MODULOS_DOC_PSICOSSOCIAL as readonly string[]).includes(m);
}
