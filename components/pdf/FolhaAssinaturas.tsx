/**
 * Componente reutilizável de folha de assinaturas para todos os laudos do sistema.
 *
 * Desenhado para funcionar em dois contextos:
 *   1. Server-side via renderToStaticMarkup() (template Puppeteer)
 *   2. Browser (preview do documento antes da assinatura)
 *
 * Por isso usa APENAS estilos inline — não depende de Tailwind, CSS modules
 * nem de nenhum arquivo CSS externo. Também não usa hooks ou estado.
 *
 * Verde JCN Consultoria: #0ea5e9  |  Verde claro: #E6F2EF
 */

import React from "react";
import { formatCNPJ } from "@/lib/utils";

// ── Tipos públicos ────────────────────────────────────────────────────────────

export interface Signatario {
  /** Nome completo idêntico ao CN do certificado digital. */
  nomeCompleto: string;
  /** Cargo do profissional (ex: "Ergonomista", "Técnico em SST"). */
  cargo: string | null;
  /**
   * Registro profissional já formatado pelo chamador (ex: "Reg. MTE 12345-SP/RJ",
   * "CRP 06/12345", "CREA 123456-D/SP"). Null se não aplicável.
   */
  registroProfissional: string | null;
  /**
   * CPF do profissional (qualquer formato — será substituído por máscara).
   * Se null, a linha do CPF não é renderizada.
   */
  cpf: string | null;
  /**
   * Função do profissional neste documento específico
   * (ex: "Responsável Técnico — JCN Consultoria SST").
   */
  funcaoNoDocumento?: string;
  /**
   * Quando `false`, renderiza um espaço de assinatura MANUAL (retângulo em
   * branco + nome/cargo embaixo) em vez do selo "ASSINADO DIGITALMENTE A1".
   * O selo só deve aparecer quando o documento foi de fato assinado com
   * certificado A1. Default (undefined/true) mantém o selo — compatível com
   * chamadores existentes.
   */
  assinadoDigitalmente?: boolean;
  /**
   * URL da imagem de assinatura cadastrada do profissional. Quando presente,
   * renderiza a IMAGEM da assinatura (assinatura eletrônica por imagem) em vez
   * do selo A1 ou da linha manual. Tem prioridade sobre os demais modos.
   */
  assinaturaImagemUrl?: string;
}

export interface FolhaAssinaturasProps {
  signatarios: Signatario[];
  /** Dados da empresa para campo de assinatura física. Null omite o campo. */
  empresa: { razaoSocial: string; cnpj: string } | null;
  /**
   * Data e hora da assinatura no formato "DD/MM/AAAA HH:mm:ss -03:00".
   * Deve ser idêntica ao signingTime criptográfico do certificado.
   */
  dataHoraAssinatura: string;
  /** Identificador único exibido no rodapé (ex: "AEP-2026-d3f9a1b2"). */
  identificadorDocumento: string;
  /**
   * Força quebra de página antes da folha (default true). No DRPS a quebra é
   * controlada pelo capítulo "Assinatura Técnica" (Nova página/Continuação),
   * então é passado false para respeitar o toggle.
   */
  quebraAntes?: boolean;
  /** Número do capítulo no Sumário (prefixa o título "Folha de Assinaturas"). */
  numero?: number;
}

// ── Paleta ───────────────────────────────────────────────────────────────────

const VERDE = "#0ea5e9";
const VERDE_CLARO = "#E6F2EF";
const CINZA_TEXTO = "#374151";
const CINZA_LEVE = "#6B7280";

// ── Ícones SVG inline ─────────────────────────────────────────────────────────

function IconeVerificacao() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }}
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

function IconeCertificado() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke={VERDE}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="8" r="5" />
      <path d="M9 21l3-4 3 4" />
      <path d="M7 14.5C4.5 13 3 10.7 3 8a9 9 0 0 1 18 0c0 2.7-1.5 5-4 6.5" />
    </svg>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Sempre retorna "***.***.***-**" independente do valor — LGPD. */
function mascaraCPF(): string {
  return "***.***.***-**";
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function CarimboSignatario({
  signatario,
  dataHora,
}: {
  signatario: Signatario;
  dataHora: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Quadro principal do carimbo */}
      <div
        style={{
          border: `1.5px solid ${VERDE}`,
          borderRadius: 6,
          overflow: "hidden",
          fontSize: 11,
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        {/* Faixa superior */}
        <div
          style={{
            backgroundColor: VERDE,
            color: "white",
            padding: "4px 8px",
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.03em",
          }}
        >
          <IconeVerificacao />
          ASSINADO DIGITALMENTE · ICP-BRASIL A1
        </div>

        {/* Corpo */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            padding: "8px 10px",
            backgroundColor: "white",
          }}
        >
          {/* Bloco ícone */}
          <div
            style={{
              backgroundColor: VERDE_CLARO,
              borderRadius: 4,
              padding: 6,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <IconeCertificado />
          </div>

          {/* Dados do signatário */}
          <div style={{ flex: 1, lineHeight: 1.5 }}>
            <div
              style={{
                fontWeight: 700,
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                color: CINZA_TEXTO,
              }}
            >
              {signatario.nomeCompleto}
            </div>

            {(signatario.cargo || signatario.registroProfissional) && (
              <div style={{ color: CINZA_TEXTO, fontSize: 10 }}>
                {[signatario.cargo, signatario.registroProfissional]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            )}

            {signatario.cpf && (
              <div style={{ color: CINZA_TEXTO, fontSize: 10 }}>
                CPF {mascaraCPF()}
              </div>
            )}

            <div style={{ color: CINZA_TEXTO, fontSize: 10 }}>{dataHora}</div>

            <div
              style={{
                color: VERDE,
                fontSize: 9,
                marginTop: 2,
                fontStyle: "italic",
              }}
            >
              Verifique a autenticidade em validar.iti.gov.br
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

function CampoAssinaturaImagem({
  signatario,
}: {
  signatario: Signatario;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      {/* Imagem da assinatura sobre a linha */}
      <div
        style={{
          minHeight: 110,
          width: "100%",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          paddingBottom: 2,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={signatario.assinaturaImagemUrl}
          alt="Assinatura"
          style={{ maxHeight: 108, maxWidth: 300, objectFit: "contain" }}
        />
      </div>

      {/* Linha + identificação */}
      <div
        style={{
          width: "100%",
          borderTop: "1px solid #9CA3AF",
          paddingTop: 6,
          textAlign: "center",
          lineHeight: 1.4,
        }}
      >
        <div
          style={{
            fontWeight: 700,
            fontSize: 11,
            color: CINZA_TEXTO,
            textTransform: "uppercase",
          }}
        >
          {signatario.nomeCompleto}
        </div>
        {signatario.cargo && (
          <div style={{ fontSize: 10, color: CINZA_LEVE }}>{signatario.cargo}</div>
        )}
        {signatario.registroProfissional && (
          <div style={{ fontSize: 10, color: CINZA_LEVE }}>
            {signatario.registroProfissional}
          </div>
        )}
      </div>
    </div>
  );
}

function CampoManualSignatario({
  signatario,
}: {
  signatario: Signatario;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Retângulo tracejado para assinatura física do profissional */}
      <div
        style={{
          border: "1.5px dashed #9CA3AF",
          borderRadius: 6,
          minHeight: 90,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#9CA3AF",
          fontSize: 11,
          fontFamily: "Arial, Helvetica, sans-serif",
          fontStyle: "italic",
          padding: "12px 16px",
        }}
      >
        (assinatura)
      </div>

      {/* Identificação do profissional */}
      <div
        style={{
          textAlign: "center",
          lineHeight: 1.4,
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <div
          style={{
            fontWeight: 700,
            fontSize: 11,
            color: CINZA_TEXTO,
            textTransform: "uppercase",
          }}
        >
          {signatario.nomeCompleto}
        </div>
        {(signatario.cargo || signatario.registroProfissional) && (
          <div style={{ fontSize: 10, color: CINZA_LEVE }}>
            {[signatario.cargo, signatario.registroProfissional]
              .filter(Boolean)
              .join(" · ")}
          </div>
        )}
      </div>
    </div>
  );
}

function CampoEmpresa({
  empresa,
}: {
  empresa: { razaoSocial: string; cnpj: string };
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Retângulo tracejado para assinatura física */}
      <div
        style={{
          border: "1.5px dashed #9CA3AF",
          borderRadius: 6,
          minHeight: 90,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#9CA3AF",
          fontSize: 11,
          fontFamily: "Arial, Helvetica, sans-serif",
          fontStyle: "italic",
          padding: "12px 16px",
        }}
      >
        (carimbo e assinatura)
      </div>

      {/* Identificação da empresa */}
      <div
        style={{
          textAlign: "center",
          lineHeight: 1.4,
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <div
          style={{
            fontWeight: 700,
            fontSize: 11,
            color: CINZA_TEXTO,
            textTransform: "uppercase",
          }}
        >
          {empresa.razaoSocial}
        </div>
        <div style={{ fontSize: 10, color: CINZA_LEVE }}>
          CNPJ {formatCNPJ(empresa.cnpj)}
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function FolhaAssinaturas({
  signatarios,
  empresa,
  dataHoraAssinatura,
  identificadorDocumento,
  quebraAntes = true,
  numero,
}: FolhaAssinaturasProps) {
  const totalColunas = signatarios.length + (empresa ? 1 : 0);

  return (
    <div
      style={{
        fontFamily: "Arial, Helvetica, sans-serif",
        pageBreakBefore: quebraAntes ? "always" : "auto",
        breakBefore: quebraAntes ? "page" : "auto",
        padding: "32px 0 16px",
      }}
    >
      {/* Título — quando é capítulo numerado (DRPS), segue o estilo das demais
          seções (alinhado à esquerda); senão, fica centralizado (demais laudos). */}
      <h2
        style={
          numero
            ? {
                textAlign: "left",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontSize: 16,
                fontWeight: 700,
                color: "#1e4d28",
                marginBottom: 14,
                borderBottom: `2px solid ${VERDE}`,
                paddingBottom: 6,
              }
            : {
                textAlign: "center",
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                fontSize: 14,
                fontWeight: 700,
                color: CINZA_TEXTO,
                marginBottom: 24,
                borderBottom: `2px solid ${VERDE}`,
                paddingBottom: 10,
              }
        }
      >
        {numero ? `${numero}. ` : ""}Folha de Assinaturas
      </h2>

      {/* Grid de colunas: signatários + empresa */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${totalColunas}, 1fr)`,
          gap: 20,
          marginBottom: 24,
        }}
      >
        {signatarios.map((s, i) =>
          s.assinaturaImagemUrl ? (
            <CampoAssinaturaImagem key={i} signatario={s} />
          ) : s.assinadoDigitalmente === false ? (
            <CampoManualSignatario key={i} signatario={s} />
          ) : (
            <CarimboSignatario
              key={i}
              signatario={s}
              dataHora={dataHoraAssinatura}
            />
          )
        )}

        {empresa && <CampoEmpresa empresa={empresa} />}
      </div>

      {/* Rodapé legal */}
      <div
        style={{
          borderTop: "1px solid #E5E7EB",
          paddingTop: 10,
          textAlign: "center",
          fontSize: 8,
          color: "#9CA3AF",
          lineHeight: 1.6,
        }}
      >
        <div>
          Documento assinado eletronicamente nos termos da MP n.º 2.200-2/2001,
          que instituiu a Infraestrutura de Chaves Públicas Brasileira — ICP-Brasil.
        </div>
        <div style={{ marginTop: 2 }}>
          Identificador do documento:{" "}
          <span style={{ fontWeight: 600, color: CINZA_LEVE }}>
            {identificadorDocumento}
          </span>
        </div>
      </div>
    </div>
  );
}
