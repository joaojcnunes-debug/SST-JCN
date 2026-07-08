/**
 * Template server-side da Ficha de Entrega de EPI (Puppeteer / renderToStaticMarkup).
 *
 * Restrições obrigatórias (iguais aos demais templates):
 *   - Sem "use client", sem hooks
 *   - Apenas estilos inline + um bloco <style>
 *   - Autocontido (imagens como URL acessível ao headless)
 *
 * Documento de 1 página (ou poucas): identificação do colaborador, itens
 * entregues (com CA), termo de responsabilidade NR-06 e área de assinatura.
 * A assinatura biométrica/não-repúdio entra na Fase 4 (campo reservado).
 */

import React from "react";
import type { Empresa } from "@/lib/supabase/types";
import type { EpiColaborador, EpiEntrega, EpiEntregaItem } from "@/lib/epi/types";
import { formatCNPJ, formatCPF, fmtData } from "@/lib/utils";

const VERDE = "#0ea5e9";
const ESCURO = "#0369a1";
const CINZA = "#374151";
const CINZA_LEVE = "#6b7280";
const VAZIO = "—";

export interface EpiFichaEntregaProps {
  entrega: EpiEntrega;
  itens: EpiEntregaItem[];
  colaborador: EpiColaborador | null;
  empresa: Partial<Empresa> | null;
  logoUrl: string | null;
  identificador: string;
}

function Campo({ label, valor }: { label: string; valor: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          fontSize: 8,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: CINZA_LEVE,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 11, color: CINZA }}>{valor || VAZIO}</div>
    </div>
  );
}

export default function EpiFichaEntregaTemplate({
  entrega,
  itens,
  colaborador,
  empresa,
  logoUrl,
  identificador,
}: EpiFichaEntregaProps) {
  const empresaNome = empresa?.nome_empresa ?? empresa?.razao_social ?? VAZIO;
  const empresaDoc = empresa?.cnpj ? formatCNPJ(empresa.cnpj) : "";

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
* { box-sizing: border-box; }
body { font-family: Arial, Helvetica, sans-serif; color: ${CINZA}; }
table { border-collapse: collapse; width: 100%; }
`,
        }}
      />

      {/* Cabeçalho */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          borderBottom: `3px solid ${VERDE}`,
          paddingBottom: 12,
          marginBottom: 16,
        }}
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt=""
            style={{ height: 46, width: "auto", maxWidth: 120, objectFit: "contain" }}
          />
        ) : null}
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: ESCURO,
              textTransform: "uppercase",
              letterSpacing: "0.03em",
            }}
          >
            Ficha de Entrega de EPI
          </div>
          <div style={{ fontSize: 10, color: CINZA_LEVE }}>
            {empresaNome}
            {empresaDoc ? ` · CNPJ ${empresaDoc}` : ""}
          </div>
        </div>
        <div style={{ textAlign: "right", fontSize: 9, color: CINZA_LEVE }}>
          <div style={{ fontWeight: 700, color: CINZA }}>{identificador}</div>
          <div>Data: {fmtData(entrega.data_entrega)}</div>
        </div>
      </div>

      {/* Identificação do colaborador */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "8px 20px",
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          padding: "12px 14px",
          marginBottom: 16,
        }}
      >
        <div style={{ gridColumn: "1 / -1" }}>
          <Campo label="Colaborador" valor={colaborador?.nome ?? VAZIO} />
        </div>
        <Campo label="CPF" valor={colaborador?.cpf ? formatCPF(colaborador.cpf) : VAZIO} />
        <Campo label="Matrícula" valor={colaborador?.matricula ?? VAZIO} />
        <Campo label="Cargo" valor={colaborador?.cargo ?? VAZIO} />
        <Campo label="Setor" valor={colaborador?.setor ?? VAZIO} />
        <Campo
          label="Responsável pela entrega"
          valor={entrega.responsavel_entrega ?? VAZIO}
        />
        <Campo label="Data da entrega" valor={fmtData(entrega.data_entrega)} />
      </div>

      {/* Itens entregues */}
      <table style={{ fontSize: 11, marginBottom: 8, border: "1px solid #e5e7eb" }}>
        <thead>
          <tr style={{ backgroundColor: "#f0f9ff", color: ESCURO, textAlign: "left" }}>
            <th style={{ padding: "7px 9px", fontWeight: 700, width: 34 }}>#</th>
            <th style={{ padding: "7px 9px", fontWeight: 700 }}>Equipamento (EPI)</th>
            <th style={{ padding: "7px 9px", fontWeight: 700, width: 120 }}>C.A.</th>
            <th style={{ padding: "7px 9px", fontWeight: 700, width: 90, textAlign: "right" }}>
              Quantidade
            </th>
          </tr>
        </thead>
        <tbody>
          {itens.map((it, i) => (
            <tr key={it.id} style={{ borderTop: "1px solid #f0f0f0" }}>
              <td style={{ padding: "6px 9px", color: CINZA_LEVE }}>{i + 1}</td>
              <td style={{ padding: "6px 9px", fontWeight: 600, color: CINZA }}>
                {it.nome_epi ?? VAZIO}
              </td>
              <td style={{ padding: "6px 9px" }}>{it.ca_numero || VAZIO}</td>
              <td style={{ padding: "6px 9px", textAlign: "right", fontWeight: 600 }}>
                {it.quantidade}
              </td>
            </tr>
          ))}
          {itens.length === 0 && (
            <tr>
              <td colSpan={4} style={{ padding: "10px", textAlign: "center", color: CINZA_LEVE }}>
                Sem itens.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {entrega.observacao ? (
        <p style={{ fontSize: 10, color: CINZA_LEVE, margin: "4px 0 16px" }}>
          <strong>Observação:</strong> {entrega.observacao}
        </p>
      ) : (
        <div style={{ height: 12 }} />
      )}

      {/* Termo de responsabilidade (NR-06) */}
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          padding: "12px 14px",
          marginBottom: 26,
          backgroundColor: "#fafafa",
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: ESCURO,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            marginBottom: 6,
          }}
        >
          Termo de Responsabilidade
        </div>
        <p style={{ fontSize: 10, lineHeight: 1.6, margin: 0, textAlign: "justify", color: CINZA }}>
          Declaro, para os devidos fins, que recebi gratuitamente os Equipamentos
          de Proteção Individual (EPIs) discriminados nesta ficha, em perfeitas
          condições de uso, e que fui orientado(a) e treinado(a) quanto ao uso
          correto, guarda e conservação. Comprometo-me a utilizá-los durante toda
          a jornada de trabalho para a finalidade a que se destinam, a comunicar
          qualquer alteração que os torne impróprios para uso e a devolvê-los
          quando solicitado, responsabilizando-me por sua guarda, nos termos da
          NR-06 e do art. 158 da CLT.
        </p>
      </div>

      {/* Assinaturas */}
      <div style={{ display: "flex", gap: 40, marginTop: 30 }}>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ borderTop: "1px solid #9ca3af", paddingTop: 5 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: CINZA }}>
              {colaborador?.nome ?? "Colaborador"}
            </div>
            <div style={{ fontSize: 9, color: CINZA_LEVE }}>
              Assinatura do colaborador (recebedor)
            </div>
          </div>
        </div>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ borderTop: "1px solid #9ca3af", paddingTop: 5 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: CINZA }}>
              {entrega.responsavel_entrega ?? "Responsável"}
            </div>
            <div style={{ fontSize: 9, color: CINZA_LEVE }}>
              Responsável pela entrega
            </div>
          </div>
        </div>
      </div>

      {/* Rodapé */}
      <div
        style={{
          marginTop: 34,
          borderTop: "1px solid #e5e7eb",
          paddingTop: 8,
          fontSize: 8,
          color: CINZA_LEVE,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>JCN Consultoria em Segurança do Trabalho</span>
        <span>{identificador}</span>
      </div>
    </>
  );
}
