/**
 * Seções de sistema COMUNS a todos os laudos (renderizadas server-side via
 * renderToStaticMarkup no pipeline Puppeteer). Usam apenas estilos inline para
 * não depender do CSS de cada template.
 *
 *  - SecaoIdentificacaoEmpresa: bloco de identificação da empresa (substitui o
 *    antigo cabeçalho fixo; agora é um capítulo reposicionável).
 *  - SecaoSumario: índice com os títulos dos capítulos na ordem do laudo.
 */

import React from "react";
import type { Empresa } from "@/lib/supabase/types";
import {
  formatCNPJ,
  formatCPF,
  formatCEI,
  formatCAEPF,
  formatCNO,
  formatCEP,
  formatTelefone,
} from "@/lib/utils";
import { montarEnderecoEmpresa } from "@/lib/textos-padrao/variaveis";

const VERDE = "#0ea5e9";
const CINZA_TEXTO = "#374151";
const CINZA_LEVE = "#6B7280";
const VAZIO = "—";

function tituloSecao(texto: string) {
  return (
    <h2
      style={{
        fontSize: 14,
        fontWeight: 700,
        color: VERDE,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        borderBottom: `2px solid ${VERDE}`,
        paddingBottom: 6,
        marginBottom: 12,
      }}
    >
      {texto}
    </h2>
  );
}

function identificadorPrincipal(e: Partial<Empresa>): { label: string; valor: string } {
  if (e.cnpj) return { label: "CNPJ", valor: formatCNPJ(e.cnpj) };
  if (e.cpf) return { label: "CPF", valor: formatCPF(e.cpf) };
  if (e.cei) return { label: "CEI", valor: formatCEI(e.cei) };
  if (e.caepf) return { label: "CAEPF", valor: formatCAEPF(e.caepf) };
  if (e.cno) return { label: "CNO", valor: formatCNO(e.cno) };
  return { label: "CNPJ", valor: VAZIO };
}

function Campo({ label, valor }: { label: string; valor: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: CINZA_LEVE,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 11, color: CINZA_TEXTO }}>{valor || VAZIO}</div>
    </div>
  );
}

export function SecaoIdentificacaoEmpresa({
  empresa,
  numero,
}: {
  empresa: Partial<Empresa> | null | undefined;
  numero?: number;
}) {
  const titulo = numero ? `${numero}. Identificação da Empresa` : "Identificação da Empresa";
  if (!empresa) {
    return (
      <section style={{ marginBottom: 18, fontFamily: "Arial, Helvetica, sans-serif" }}>
        {tituloSecao(titulo)}
        <p style={{ fontSize: 11, color: CINZA_LEVE }}>Empresa não informada.</p>
      </section>
    );
  }

  const ident = identificadorPrincipal(empresa);
  const cnae = [empresa.cnae_principal, empresa.cnae_descricao].filter(Boolean).join(" — ");
  const endereco = montarEnderecoEmpresa(empresa as Empresa);
  const municipioUf = [empresa.municipio, empresa.uf].filter(Boolean).join(" / ");

  return (
    <section style={{ marginBottom: 18, fontFamily: "Arial, Helvetica, sans-serif" }}>
      {tituloSecao(titulo)}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "8px 24px",
        }}
      >
        <Campo label="Razão social" valor={empresa.razao_social ?? VAZIO} />
        <Campo label="Nome fantasia" valor={empresa.nome_empresa ?? VAZIO} />
        <Campo label={ident.label} valor={ident.valor} />
        <Campo label="CNAE / atividade" valor={cnae || VAZIO} />
        <Campo
          label="Grau de risco"
          valor={empresa.grau_risco != null ? String(empresa.grau_risco) : VAZIO}
        />
        <Campo label="Município / UF" valor={municipioUf || VAZIO} />
        <div style={{ gridColumn: "1 / -1" }}>
          <Campo label="Endereço" valor={endereco || VAZIO} />
        </div>
        <Campo label="CEP" valor={formatCEP(empresa.cep)} />
        <Campo label="Telefone" valor={formatTelefone(empresa.telefone)} />
        <Campo label="E-mail" valor={empresa.email ?? VAZIO} />
      </div>
    </section>
  );
}

export function SecaoSumario({ titulos }: { titulos: string[] }) {
  if (!titulos.length) return null;
  return (
    <section style={{ marginBottom: 18, fontFamily: "Arial, Helvetica, sans-serif" }}>
      {tituloSecao("Sumário")}
      <ol style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
        {titulos.map((t, i) => (
          <li
            key={i}
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 8,
              fontSize: 11,
              color: CINZA_TEXTO,
              padding: "3px 0",
              borderBottom: "1px dotted #D1D5DB",
            }}
          >
            <span style={{ fontWeight: 700, color: VERDE, minWidth: 18 }}>{i + 1}.</span>
            <span>{t}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
