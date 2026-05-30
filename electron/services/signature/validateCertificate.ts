import * as forge from 'node-forge'
import fs from 'fs'

export interface CertificateInfo {
  valid: boolean
  nome?: string
  email?: string
  expiresAt?: Date
  daysUntilExpiry?: number
  issuer?: string
  error?: string
}

/**
 * Valida um certificado A1 (.pfx/.p12) verificando:
 * - senha correta
 * - não expirado
 * - presença de certificado no arquivo
 */
export function validarCertificado(pfxPath: string, password: string): CertificateInfo {
  try {
    const pfxBuffer = fs.readFileSync(pfxPath)
    const p12Der = forge.util.createBuffer(pfxBuffer.toString('binary'))
    const p12Asn1 = forge.asn1.fromDer(p12Der)
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password)

    const bags = p12.getBags({ bagType: forge.pki.oids.certBag })
    const certBags = bags[forge.pki.oids.certBag]

    if (!certBags?.length) {
      return { valid: false, error: 'Nenhum certificado encontrado no arquivo PFX' }
    }

    const cert = certBags[0].cert!
    const notAfter = cert.validity.notAfter
    const now = new Date()

    if (notAfter < now) {
      return {
        valid: false,
        error: `Certificado expirado em ${notAfter.toLocaleDateString('pt-BR')}`,
      }
    }

    const daysUntilExpiry = Math.ceil((notAfter.getTime() - now.getTime()) / 86_400_000)

    const cn = cert.subject.getField('CN')?.value as string | undefined
    const emailField =
      (cert.subject.getField('emailAddress')?.value ??
        cert.subject.getField('E')?.value) as string | undefined
    const issuerCn = cert.issuer.getField('CN')?.value as string | undefined

    return {
      valid: true,
      nome: cn,
      email: emailField,
      expiresAt: notAfter,
      daysUntilExpiry,
      issuer: issuerCn,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const isWrongPassword =
      /mac verify|password|pkcs12|integrity/i.test(msg)
    return {
      valid: false,
      error: isWrongPassword ? 'Senha incorreta ou arquivo corrompido' : msg,
    }
  }
}
