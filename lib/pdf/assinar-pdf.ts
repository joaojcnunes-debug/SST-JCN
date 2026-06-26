/**
 * Núcleo de assinatura digital ICP-Brasil A1.
 *
 * ORDEM CRÍTICA — nunca alterar:
 *   1. Normalizar PDF via pdf-lib (remove linearização do Chromium)
 *   2. Adicionar placeholder @signpdf/placeholder-pdf-lib
 *   3. Assinar com @signpdf/signpdf + P12Signer
 *
 * Qualquer modificação no buffer após a assinatura invalida criptograficamente
 * o documento. Não encadeie transformações após a chamada a assinarPdf().
 *
 * A validação do certificado (validade temporal, conferência de senha) é
 * responsabilidade do chamador (sign-pdf/route.ts) para que as mensagens de
 * erro cheguem ao usuário antes de tentar a assinatura.
 */

import { PDFDocument } from "pdf-lib";
import { pdflibAddPlaceholder } from "@signpdf/placeholder-pdf-lib";
import { P12Signer } from "@signpdf/signer-p12";
import signpdf from "@signpdf/signpdf";

export interface AssinarPdfOpts {
  /** Buffer do arquivo .pfx carregado do bucket privado do Supabase. */
  pfxBuffer: Buffer;
  /** Senha do certificado, digitada pelo usuário no modal (nunca persiste). */
  passphrase: string;
  /** Nome completo do signatário — deve ser idêntico ao CN do certificado. */
  signatoryName: string;
  /** E-mail do signatário (campo contactInfo do placeholder). */
  signatoryEmail: string;
  /** Motivo da assinatura — varia por tipo de documento. */
  reason: string;
  /** Local da assinatura. Padrão: "Brasil". */
  location?: string;
}

/**
 * Assina digitalmente um PDF com certificado A1 ICP-Brasil e retorna o buffer
 * assinado. Lança exceção se qualquer passo falhar — o chamador deve tratar
 * e mapear para mensagens de erro amigáveis ao usuário.
 */
export async function assinarPdf(
  pdfBuffer: Buffer,
  opts: AssinarPdfOpts,
): Promise<Buffer> {
  // Passo 1 — normalização
  // PDFs gerados pelo Chromium (Puppeteer ou Electron) são linearizados.
  // O @signpdf calcula ByteRange sobre a estrutura canônica; sem normalizar,
  // o ByteRange fica errado e a assinatura é inválida no validador ITI.
  const pdfDoc = await PDFDocument.load(pdfBuffer, {
    ignoreEncryption: true,
    updateMetadata: false,
  });
  const pdfNormalizado = Buffer.from(
    await pdfDoc.save({ useObjectStreams: false, addDefaultPage: false }),
  );
  const pdfDocNorm = await PDFDocument.load(pdfNormalizado, {
    ignoreEncryption: true,
    updateMetadata: false,
  });

  // Passo 2 — placeholder
  // signatureLength: 65536 (64 KB) — cobre cadeias ICP-Brasil completas
  // (AC-Raiz → AC intermediárias → certificado folha somam ~40-55 KB).
  pdflibAddPlaceholder({
    pdfDoc: pdfDocNorm,
    reason: opts.reason,
    name: opts.signatoryName,
    location: opts.location ?? "Brasil",
    contactInfo: opts.signatoryEmail,
    signatureLength: 65536,
  });

  const pdfComPlaceholder = Buffer.from(
    await pdfDocNorm.save({ useObjectStreams: false, addDefaultPage: false }),
  );

  // Passo 3 — assinatura
  const signer = new P12Signer(opts.pfxBuffer, { passphrase: opts.passphrase });
  const pdfAssinado = await signpdf.sign(pdfComPlaceholder, signer);

  return Buffer.from(pdfAssinado);
}
