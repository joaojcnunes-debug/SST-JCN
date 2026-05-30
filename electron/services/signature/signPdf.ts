import { PDFDocument } from 'pdf-lib'
import { pdflibAddPlaceholder } from '@signpdf/placeholder-pdf-lib'
import { P12Signer } from '@signpdf/signer-p12'
import signpdf from '@signpdf/signpdf'
import fs from 'fs'

export interface SignOptions {
  pdfBuffer: Buffer
  pfxPath: string
  password: string
  signatoryName: string
  signatoryEmail: string
  reason?: string
  location?: string
}

/**
 * Assina digitalmente um PDF com certificado A1 (.pfx).
 * Fluxo: PDF original → placeholder → save (sem objectStreams) → signpdf.sign()
 * Compatível com validadores ICP-Brasil (ITI, Certisign, etc.)
 */
export async function assinarPdfLocal(opts: SignOptions): Promise<Buffer> {
  const pfxBuffer = fs.readFileSync(opts.pfxPath)

  const pdfDoc = await PDFDocument.load(opts.pdfBuffer)

  await pdflibAddPlaceholder({
    pdfDoc,
    reason: opts.reason ?? 'Assinatura digital ICP-Brasil',
    contactInfo: opts.signatoryEmail,
    name: opts.signatoryName,
    location: opts.location ?? 'Brasil',
  })

  const pdfWithPlaceholder = await pdfDoc.save({ useObjectStreams: false })

  const signer = new P12Signer(pfxBuffer, { passphrase: opts.password })
  return signpdf.sign(Buffer.from(pdfWithPlaceholder), signer)
}
