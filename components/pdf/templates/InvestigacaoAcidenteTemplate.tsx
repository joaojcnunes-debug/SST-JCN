import React from "react";
import FolhaAssinaturas, { type Signatario } from "@/components/pdf/FolhaAssinaturas";
import { SecaoIdentificacaoEmpresa } from "@/components/pdf/SecoesComuns";
import BodyMapStatic from "@/components/investigacao/BodyMapStatic";
import { ISHIKAWA_CATS } from "@/lib/investigacao/ishikawa";
import type { Empresa, InvestigacaoAcidente } from "@/lib/supabase/types";

export interface InvestigacaoTemplateProps {
  inv: InvestigacaoAcidente;
  empresa?: Partial<Empresa> | null;
  signatarios: Signatario[];
  folhaEmpresa: { razaoSocial: string; cnpj: string } | null;
  dataHoraAssinatura: string;
  identificadorDocumento: string;
  /** URLs absolutas ou data URIs das silhuetas (para o Puppeteer). */
  silhuetaFrente?: string;
  silhuetaCostas?: string;
}

const VERDE = "#0ea5e9";

const STYLE_BLOCK = `
* { box-sizing: border-box; }
body { font-family: Arial, Helvetica, sans-serif; color: #111827; }
.ia-titulo { text-align: center; margin: 0 0 4px; }
.ia-titulo h1 { font-size: 16pt; font-weight: 700; color: ${VERDE}; margin: 0; text-transform: uppercase; letter-spacing: .03em; }
.ia-titulo p { font-size: 10pt; color: #6b7280; margin: 2px 0 0; }
.ia-sec { font-size: 13pt; font-weight: 700; color: ${VERDE}; border-bottom: 2px solid ${VERDE}; padding-bottom: 4px; margin: 18px 0 10px; text-transform: uppercase; letter-spacing: .03em; }
.ia-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; }
.ia-campo .rot { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #6b7280; margin: 0; }
.ia-campo .val { font-size: 11pt; color: #111827; margin: 1px 0 0; white-space: pre-wrap; }
.ia-full { grid-column: 1 / -1; }
.ia-bloco { margin-bottom: 8px; }
.ia-test { border: 1px solid #d1d5db; border-radius: 6px; padding: 8px 10px; margin-bottom: 8px; page-break-inside: avoid; }
.ia-test .nome { font-weight: 700; font-size: 11pt; color: #111827; }
.ia-test .dep { font-size: 10pt; color: #374151; white-space: pre-wrap; margin-top: 2px; }
.ia-pq { margin: 4px 0; padding-left: 0; list-style: none; }
.ia-pq li { font-size: 11pt; color: #111827; padding: 3px 0; border-bottom: 1px dotted #d1d5db; }
.ia-pq b { color: ${VERDE}; }
section { page-break-inside: avoid; }
`;

const TIPO_LABEL: Record<string, string> = {
  TIPICO: "Típico",
  TRAJETO: "Trajeto",
  DOENCA: "Doença ocupacional",
};
const GRAV_LABEL: Record<string, string> = {
  LEVE: "Leve",
  GRAVE: "Grave",
  FATAL: "Fatal",
};

function fmt(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = String(iso).slice(0, 10).split("-");
  return m.length === 3 ? `${m[2]}/${m[1]}/${m[0]}` : String(iso);
}

function Campo({ rot, val, full }: { rot: string; val: string | null | undefined; full?: boolean }) {
  return (
    <div className={`ia-campo${full ? " ia-full" : ""}`}>
      <p className="rot">{rot}</p>
      <p className="val">{val && String(val).trim() ? val : "—"}</p>
    </div>
  );
}

function Bloco({ rot, val }: { rot: string; val: string | null | undefined }) {
  if (!val || !val.trim()) return null;
  return (
    <div className="ia-bloco">
      <p className="rot" style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: "#6b7280", margin: "0 0 2px" }}>
        {rot}
      </p>
      <p className="val" style={{ fontSize: "11pt", color: "#111827", whiteSpace: "pre-wrap", margin: 0 }}>{val}</p>
    </div>
  );
}

function IshikawaPdf({ ishikawa }: { ishikawa: Record<string, string[]> }) {
  const temAlgo = ISHIKAWA_CATS.some((c) => (ishikawa?.[c] ?? []).length > 0);
  if (!temAlgo) return null;
  const top = ISHIKAWA_CATS.slice(0, 3);
  const bot = ISHIKAWA_CATS.slice(3);
  const Box = ({ cat }: { cat: string }) => (
    <div style={{ flex: 1, minWidth: 0, border: "1px solid #d1d5db", borderRadius: 6, padding: "5px 8px" }}>
      <p style={{ margin: 0, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".03em", color: VERDE }}>{cat}</p>
      <ul style={{ margin: "2px 0 0", paddingLeft: 13 }}>
        {(ishikawa?.[cat] ?? []).map((c, i) => (
          <li key={i} style={{ fontSize: "9.5pt", color: "#374151" }}>{c}</li>
        ))}
      </ul>
    </div>
  );
  return (
    <div style={{ marginTop: 6, pageBreakInside: "avoid" }}>
      <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: "#6b7280", margin: "0 0 4px" }}>
        Diagrama de Ishikawa (6M)
      </p>
      <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>{top.map((c) => <Box key={c} cat={c} />)}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "5px 0" }}>
        <div style={{ flex: 1, height: 3, background: VERDE, borderRadius: 2 }} />
        <div style={{ background: VERDE, color: "#fff", padding: "4px 12px", borderRadius: 6, fontWeight: 700, fontSize: 10, whiteSpace: "nowrap" }}>ACIDENTE</div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>{bot.map((c) => <Box key={c} cat={c} />)}</div>
    </div>
  );
}

export default function InvestigacaoAcidenteTemplate({
  inv,
  empresa,
  signatarios,
  folhaEmpresa,
  dataHoraAssinatura,
  identificadorDocumento,
  silhuetaFrente,
  silhuetaCostas,
}: InvestigacaoTemplateProps) {
  const afast = inv.houve_afastamento
    ? `Sim${inv.dias_afastamento != null ? ` — ${inv.dias_afastamento} dia(s)` : ""}`
    : "Não";
  const porques = (inv.cinco_porques ?? []).filter((p) => p && p.trim());
  const testemunhas = (inv.testemunhas ?? []).filter((t) => (t.nome ?? "").trim() || (t.depoimento ?? "").trim());

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLE_BLOCK }} />

      <div className="ia-titulo">
        <h1>Investigação de Acidente de Trabalho</h1>
        <p>{empresa?.nome_empresa ?? ""}{inv.data_acidente ? ` · Acidente em ${fmt(inv.data_acidente)}` : ""}</p>
      </div>

      <SecaoIdentificacaoEmpresa empresa={empresa} />

      <section>
        <p className="ia-sec">1. Dados gerais</p>
        <div className="ia-grid">
          <Campo rot="Data do acidente" val={fmt(inv.data_acidente)} />
          <Campo rot="Hora" val={inv.hora_acidente} />
          <Campo rot="Local" val={inv.local_acidente} />
          <Campo rot="Setores" val={(inv.setores ?? []).join(", ")} />
          <Campo rot="Data da investigação" val={fmt(inv.data_investigacao)} />
          <Campo rot="Responsável técnico" val={inv.responsavel_tecnico} />
          <Campo rot="Nº da CAT" val={inv.numero_cat} />
          <Campo rot="Data da CAT" val={fmt(inv.data_cat)} />
        </div>
      </section>

      <section>
        <p className="ia-sec">2. Acidentado</p>
        <div className="ia-grid">
          <Campo rot="Nome" val={inv.acidentado_nome} />
          <Campo rot="Cargo / função" val={(inv.acidentado_funcoes ?? []).join(", ")} />
          <Campo rot="Admissão" val={fmt(inv.acidentado_admissao)} />
          <Campo rot="Tipo de acidente" val={inv.tipo_acidente ? TIPO_LABEL[inv.tipo_acidente] : "—"} />
          <Campo rot="Gravidade" val={inv.gravidade ? GRAV_LABEL[inv.gravidade] : "—"} />
          <Campo rot="Houve afastamento" val={afast} />
        </div>
      </section>

      <section>
        <p className="ia-sec">3. Descrição do acidente</p>
        <Bloco rot="Relato do ocorrido" val={inv.descricao} />
        <div className="ia-grid" style={{ marginTop: 8 }}>
          <Campo rot="Agente causador" val={inv.agente_causador} />
          <Campo rot="Natureza da lesão" val={inv.natureza_lesao} />
          <Campo rot="CID" val={inv.cid} />
        </div>
        {(inv.partes_corpo ?? []).length > 0 && (
          <div style={{ marginTop: 10, display: "flex", gap: 16, alignItems: "center" }}>
            {silhuetaFrente && silhuetaCostas && (
              <BodyMapStatic value={inv.partes_corpo} imgFrente={silhuetaFrente} imgCostas={silhuetaCostas} />
            )}
            <div>
              <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: "#6b7280", margin: "0 0 2px" }}>
                Partes do corpo atingidas
              </p>
              <p style={{ fontSize: "11pt", color: "#111827", margin: 0 }}>{inv.partes_corpo.join(" · ")}</p>
            </div>
          </div>
        )}
      </section>

      {testemunhas.length > 0 && (
        <section>
          <p className="ia-sec">4. Testemunhas</p>
          {testemunhas.map((t, i) => (
            <div key={i} className="ia-test">
              <div className="nome">{t.nome || "—"}</div>
              {t.depoimento && <div className="dep">{t.depoimento}</div>}
            </div>
          ))}
        </section>
      )}

      <section>
        <p className="ia-sec">5. Análise de causas</p>
        <Bloco rot="Causas imediatas (atos e condições inseguras)" val={inv.causas_imediatas} />
        <Bloco rot="Causas básicas (fatores pessoais e do trabalho)" val={inv.causas_basicas} />
        {porques.length > 0 && (
          <div className="ia-bloco">
            <p className="rot" style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: "#6b7280", margin: "0 0 2px" }}>
              5 Porquês
            </p>
            <ul className="ia-pq">
              {porques.map((p, i) => (
                <li key={i}><b>{i + 1}º Por quê?</b> {p}</li>
              ))}
            </ul>
          </div>
        )}
        <IshikawaPdf ishikawa={inv.ishikawa} />
      </section>

      {(inv.medidas?.trim() || inv.conclusao?.trim()) && (
        <section>
          <p className="ia-sec">6. Medidas e conclusão</p>
          <Bloco rot="Medidas corretivas e preventivas" val={inv.medidas} />
          <Bloco rot="Conclusão / parecer técnico" val={inv.conclusao} />
        </section>
      )}

      <FolhaAssinaturas
        signatarios={signatarios}
        empresa={folhaEmpresa}
        dataHoraAssinatura={dataHoraAssinatura}
        identificadorDocumento={identificadorDocumento}
      />
    </>
  );
}
