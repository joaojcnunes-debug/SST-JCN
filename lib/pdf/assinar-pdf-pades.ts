/**
 * Assinatura digital PAdES (CAdES-BES) ICP-Brasil — caminho NOVO e ISOLADO.
 *
 * Por que existe separado de `assinar-pdf.ts`:
 *   O signer antigo (@signpdf/signer-p12) produz PKCS#7 `adbe.pkcs7.detached`
 *   SEM os atributos de conformidade ICP-Brasil → o Verificador do ITI não
 *   reconhece como assinatura aderente. Este módulo gera uma assinatura
 *   PAdES (`ETSI.CAdES.detached`) com os atributos assinados exigidos:
 *     - content-type, message-digest, signing-time
 *     - signing-certificate-v2 (ESS, OID 1.2.840.113549.1.9.16.2.47)
 *   e embute a cadeia de certificados presente no .pfx. A política de
 *   assinatura (signature-policy-identifier AD-RB) entra na fase S2.2.
 *
 * ORDEM CRÍTICA (idêntica ao signer antigo): normalizar (pdf-lib) → placeholder
 * → assinar. Nada pode alterar o buffer após a assinatura.
 *
 * Mantido fora do fluxo dos demais laudos: a rota só usa este signer para o
 * DRPS enquanto validamos no validar.iti.gov.br (não-regressão).
 */

import { PDFDocument } from "pdf-lib";
import { pdflibAddPlaceholder } from "@signpdf/placeholder-pdf-lib";
import { SUBFILTER_ETSI_CADES_DETACHED, Signer } from "@signpdf/utils";
import { SignPdf } from "@signpdf/signpdf";
import * as pkijs from "pkijs";
import * as asn1js from "asn1js";
import forge from "node-forge";
import { webcrypto } from "crypto";

export interface AssinarPdfPadesOpts {
  pfxBuffer: Buffer;
  passphrase: string;
  signatoryName: string;
  signatoryEmail: string;
  reason: string;
  location?: string;
}

const ENGINE_NAME = "nodeEngine";
let engineSet = false;
function garantirEngine() {
  if (engineSet) return;
  pkijs.setEngine(
    ENGINE_NAME,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    new pkijs.CryptoEngine({ name: ENGINE_NAME, crypto: webcrypto as any }),
  );
  engineSet = true;
}

/** Converte um certificado forge em pkijs.Certificate (via DER). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function forgeCertParaPkijs(cert: any): { pki: pkijs.Certificate; der: ArrayBuffer } {
  const derBin = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  const der = Uint8Array.from(derBin, (c: string) => c.charCodeAt(0)).buffer;
  return { pki: pkijs.Certificate.fromBER(der), der };
}

/**
 * Signer @signpdf que monta o CMS PAdES com pkijs. Recebe os bytes do ByteRange
 * e devolve o DER do ContentInfo (SignedData) detached.
 */
class PadesSigner extends Signer {
  private pkcs8: ArrayBuffer;
  private leaf: pkijs.Certificate;
  private leafDer: ArrayBuffer;
  private chain: pkijs.Certificate[];

  constructor(pfxBuffer: Buffer, passphrase: string) {
    super();
    const p12Der = forge.util.createBuffer(pfxBuffer.toString("binary"));
    const p12Asn1 = forge.asn1.fromDer(p12Der);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, passphrase);

    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? [];
    const keyBags =
      p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const privateKey: any = keyBags[0]?.key;
    if (!privateKey) throw new Error("Chave privada não encontrada no .pfx");

    // Chave → PKCS#8 DER (importável no WebCrypto).
    const pkcs8Bin = forge.asn1
      .toDer(forge.pki.wrapRsaPrivateKey(forge.pki.privateKeyToAsn1(privateKey)))
      .getBytes();
    this.pkcs8 = Uint8Array.from(pkcs8Bin, (c: string) => c.charCodeAt(0)).buffer;

    // Identifica o certificado folha (o que casa com a chave) e a cadeia.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let leafForge: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const outros: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    certBags.forEach((b: any) => {
      const pub = b.cert.publicKey;
      if (pub?.n && privateKey.n.compareTo(pub.n) === 0 && privateKey.e.compareTo(pub.e) === 0) {
        leafForge = b.cert;
      } else {
        outros.push(b.cert);
      }
    });
    if (!leafForge) leafForge = certBags[0]?.cert;
    if (!leafForge) throw new Error("Certificado do signatário não encontrado no .pfx");

    const leaf = forgeCertParaPkijs(leafForge);
    this.leaf = leaf.pki;
    this.leafDer = leaf.der;
    this.chain = outros.map((c) => forgeCertParaPkijs(c).pki);
  }

  async sign(pdfBuffer: Buffer, signingTime?: Date): Promise<Buffer> {
    garantirEngine();
    const data = Uint8Array.from(pdfBuffer).buffer;

    // O pkijs NÃO preenche o message-digest com signedAttrs presentes — ele só
    // assina os atributos. Então calculamos o digest do conteúdo (ByteRange) aqui.
    const messageDigest = await webcrypto.subtle.digest("SHA-256", data);

    const privateKey = await webcrypto.subtle.importKey(
      "pkcs8",
      this.pkcs8,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"],
    );

    // ── signing-certificate-v2 (ESS) ──────────────────────────────────────────
    // SigningCertificateV2 ::= SEQ { certs SEQ OF ESSCertIDv2 }
    // ESSCertIDv2 ::= SEQ { certHash OCTET STRING, issuerSerial IssuerSerial }
    //   (hashAlgorithm omitido = sha256 default)
    const certHash = await webcrypto.subtle.digest("SHA-256", this.leafDer);
    const issuerSerial = new asn1js.Sequence({
      value: [
        new asn1js.Sequence({
          // GeneralNames ::= SEQ OF GeneralName ; [4] directoryName (issuer)
          value: [
            new asn1js.Constructed({
              idBlock: { tagClass: 3, tagNumber: 4 },
              value: [this.leaf.issuer.toSchema()],
            }),
          ],
        }),
        this.leaf.serialNumber,
      ],
    });
    const essCertIDv2 = new asn1js.Sequence({
      value: [new asn1js.OctetString({ valueHex: certHash }), issuerSerial],
    });
    const signingCertificateV2 = new asn1js.Sequence({
      value: [new asn1js.Sequence({ value: [essCertIDv2] })],
    });

    const signedAttrs = new pkijs.SignedAndUnsignedAttributes({
      type: 0,
      attributes: [
        // content-type = id-data
        new pkijs.Attribute({
          type: "1.2.840.113549.1.9.3",
          values: [new asn1js.ObjectIdentifier({ value: "1.2.840.113549.1.7.1" })],
        }),
        // signing-time
        new pkijs.Attribute({
          type: "1.2.840.113549.1.9.5",
          values: [new asn1js.UTCTime({ valueDate: signingTime ?? new Date() })],
        }),
        // message-digest = sha256(conteúdo do ByteRange)
        new pkijs.Attribute({
          type: "1.2.840.113549.1.9.4",
          values: [new asn1js.OctetString({ valueHex: messageDigest })],
        }),
        // signing-certificate-v2
        new pkijs.Attribute({
          type: "1.2.840.113549.1.9.16.2.47",
          values: [signingCertificateV2],
        }),
      ],
    });

    const signedData = new pkijs.SignedData({
      version: 1,
      encapContentInfo: new pkijs.EncapsulatedContentInfo({
        eContentType: "1.2.840.113549.1.7.1", // id-data, detached (sem eContent)
      }),
      signerInfos: [
        new pkijs.SignerInfo({
          version: 1,
          sid: new pkijs.IssuerAndSerialNumber({
            issuer: this.leaf.issuer,
            serialNumber: this.leaf.serialNumber,
          }),
          signedAttrs,
        }),
      ],
      certificates: [this.leaf, ...this.chain],
    });

    await signedData.sign(privateKey, 0, "SHA-256", data);

    const cmsContentInfo = new pkijs.ContentInfo({
      contentType: "1.2.840.113549.1.7.2", // signedData
      content: signedData.toSchema(true),
    });
    const der = cmsContentInfo.toSchema().toBER(false);
    return Buffer.from(new Uint8Array(der));
  }
}

/**
 * Assina um PDF no padrão PAdES ICP-Brasil (CAdES-BES). Mesma assinatura de
 * `assinarPdf`, mas com SubFilter ETSI.CAdES.detached + signing-certificate-v2.
 */
export async function assinarPdfPades(
  pdfBuffer: Buffer,
  opts: AssinarPdfPadesOpts,
): Promise<Buffer> {
  // Passo 1 — normalização (remove linearização do Chromium; ByteRange correto).
  const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true, updateMetadata: false });
  const pdfNorm = Buffer.from(await pdfDoc.save({ useObjectStreams: false, addDefaultPage: false }));
  const pdfDocNorm = await PDFDocument.load(pdfNorm, { ignoreEncryption: true, updateMetadata: false });

  // Passo 2 — placeholder PAdES (SubFilter ETSI.CAdES.detached).
  pdflibAddPlaceholder({
    pdfDoc: pdfDocNorm,
    reason: opts.reason,
    name: opts.signatoryName,
    location: opts.location ?? "Brasil",
    contactInfo: opts.signatoryEmail,
    signatureLength: 65536,
    subFilter: SUBFILTER_ETSI_CADES_DETACHED,
  });
  const pdfComPlaceholder = Buffer.from(await pdfDocNorm.save({ useObjectStreams: false, addDefaultPage: false }));

  // Passo 3 — assinatura.
  const signer = new PadesSigner(opts.pfxBuffer, opts.passphrase);
  const assinado = await new SignPdf().sign(pdfComPlaceholder, signer);
  return Buffer.from(assinado);
}
