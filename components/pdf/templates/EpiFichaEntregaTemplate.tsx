import React from "react";

// Template server-side da Ficha de Entrega de EPI (renderToStaticMarkup + Puppeteer).
// Sem "use client"; só estilos inline + um bloco <style>. Tokens de marca: verde #0ea5e9.

export interface EpiFichaProps {
  empresa: { nome: string; cnpj?: string | null };
  colaborador: { nome: string; cpf?: string | null; matricula?: string | null; cargo?: string | null; setor?: string | null };
  entrega: { data_entrega: string; responsavel_entrega?: string | null; observacao?: string | null };
  itens: { nome_epi: string | null; ca_numero?: string | null; quantidade: number }[];
  logoUrl?: string | null;
  identificador: string;
  assinatura?: { nome?: string | null; assinatura_png?: string | null; assinado_em?: string | null; metodo?: string | null; codigo?: string | null } | null;
}

const fmtData = (iso: string) => (iso ? iso.split("T")[0].split("-").reverse().join("/") : "—");
const fmtDataHora = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

const VERDE = "#0ea5e9";

export default function EpiFichaEntregaTemplate({ empresa, colaborador, entrega, itens, logoUrl, identificador, assinatura }: EpiFichaProps) {
  const info = (label: string, val?: string | null) => (
    <div style={{ display: "flex", gap: 4, fontSize: 11 }}>
      <span style={{ color: "#6b7280", minWidth: 70 }}>{label}:</span>
      <span style={{ fontWeight: 600 }}>{val || "—"}</span>
    </div>
  );

  return (
    <div className="epi-ficha">
      <style>{`
        .epi-ficha { font-family: Calibri, Arial, Helvetica, sans-serif; color: #111827; font-size: 11px; }
        .epi-ficha h1 { font-size: 15px; margin: 0; color: ${VERDE}; letter-spacing: .3px; }
        .epi-ficha table { width: 100%; border-collapse: collapse; }
        .epi-ficha th { background: ${VERDE}; color: #fff; font-size: 10px; text-transform: uppercase; letter-spacing: .3px; padding: 6px 8px; text-align: left; }
        .epi-ficha td { border-bottom: 1px solid #e5e7eb; padding: 6px 8px; font-size: 11px; }
        .epi-ficha .box { border: 1px solid #d1d5db; border-radius: 6px; padding: 10px 12px; }
        .epi-ficha .termo { font-size: 10px; line-height: 1.5; color: #374151; text-align: justify; }
        .epi-ficha .assinatura-linha { border-top: 1px solid #111827; width: 320px; margin: 0 auto; padding-top: 4px; text-align: center; font-size: 10px; color: #374151; }
      `}</style>

      {/* Cabeçalho */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, borderBottom: `2px solid ${VERDE}`, paddingBottom: 10, marginBottom: 12 }}>
        {logoUrl ? <img src={logoUrl} alt="" style={{ height: 46, objectFit: "contain" }} /> : null}
        <div style={{ flex: 1 }}>
          <h1>Ficha de Controle de Entrega de EPI</h1>
          <div style={{ fontSize: 11, color: "#374151", marginTop: 2 }}>{empresa.nome}{empresa.cnpj ? ` · CNPJ ${empresa.cnpj}` : ""}</div>
        </div>
        <div style={{ textAlign: "right", fontSize: 9, color: "#6b7280" }}>{identificador}</div>
      </div>

      {/* Identificação do colaborador */}
      <div className="box" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, textTransform: "uppercase", color: VERDE, fontWeight: 700, marginBottom: 6 }}>Colaborador</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
          {info("Nome", colaborador.nome)}
          {info("CPF", colaborador.cpf)}
          {info("Matrícula", colaborador.matricula)}
          {info("Cargo", colaborador.cargo)}
          {info("Setor", colaborador.setor)}
          {info("Data", fmtData(entrega.data_entrega))}
        </div>
      </div>

      {/* Itens entregues */}
      <table style={{ marginBottom: 12 }}>
        <thead>
          <tr><th style={{ width: 28 }}>#</th><th>Equipamento (EPI/EPC)</th><th style={{ width: 90 }}>C.A.</th><th style={{ width: 60, textAlign: "right" }}>Qtd.</th></tr>
        </thead>
        <tbody>
          {itens.length === 0 ? (
            <tr><td colSpan={4} style={{ textAlign: "center", color: "#9ca3af" }}>Sem itens.</td></tr>
          ) : itens.map((it, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td style={{ fontWeight: 600 }}>{it.nome_epi || "—"}</td>
              <td>{it.ca_numero || "—"}</td>
              <td style={{ textAlign: "right" }}>{it.quantidade}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {entrega.observacao ? (
        <div style={{ fontSize: 11, marginBottom: 12 }}><span style={{ color: "#6b7280" }}>Observação: </span>{entrega.observacao}</div>
      ) : null}

      {/* Termo de responsabilidade */}
      <div className="box" style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 10, textTransform: "uppercase", color: VERDE, fontWeight: 700, marginBottom: 6 }}>Termo de Responsabilidade</div>
        <p className="termo" style={{ margin: 0 }}>
          Declaro ter recebido gratuitamente os Equipamentos de Proteção Individual (EPI) acima discriminados, em perfeitas
          condições de uso, e me comprometo a: usá-los apenas para a finalidade a que se destinam; responsabilizar-me por sua
          guarda e conservação; comunicar ao empregador qualquer alteração que os torne impróprios para uso; e devolvê-los
          quando solicitado. Estou ciente de que o uso é obrigatório (NR-06 do MTE) e de que, nos termos do art. 158 da CLT,
          constitui ato faltoso a recusa injustificada ao seu uso.
        </p>
      </div>

      {/* Assinatura */}
      <div style={{ marginTop: 8 }}>
        {assinatura?.metodo === "digital" ? (
          <div style={{ textAlign: "center" }}>
            {/* Card de assinatura biométrica verificada */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 12, textAlign: "left", border: `1px solid ${VERDE}`, background: "#f2faf7", borderRadius: 8, padding: "10px 16px", marginBottom: 8 }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={VERDE} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}>
                <path d="M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 8 4" />
                <path d="M5 19.5C5.5 18 6 15 6 12c0-.7.12-1.37.34-2" />
                <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" />
                <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" />
                <path d="M8.65 22c.21-.66.45-1.32.57-2" />
                <path d="M14 13.12c0 2.38 0 6.38-1 8.88" />
                <path d="M2 16h.01" />
                <path d="M21.8 16c.2-2 .131-5.354 0-6" />
                <path d="M9 6.8a6 6 0 0 1 9 5.2c0 .47 0 1.17-.02 2" />
              </svg>
              <div style={{ lineHeight: 1.4 }}>
                <div style={{ color: VERDE, fontWeight: 700, fontSize: 12 }}>Assinado biometricamente</div>
                <div style={{ fontSize: 10, color: "#374151" }}>{fmtDataHora(assinatura.assinado_em)}</div>
                <div style={{ fontSize: 10, color: "#059669", fontWeight: 600 }}>Identidade verificada</div>
                {assinatura.codigo ? <div style={{ fontSize: 9, color: "#9ca3af" }}>Cód. {assinatura.codigo}</div> : null}
              </div>
            </div>
            <div style={{ fontSize: 10 }}>
              <strong style={{ color: "#111827" }}>{colaborador.nome}</strong><br />
              <span style={{ color: "#6b7280" }}>Assinatura do colaborador (recebedor)</span><br />
              <span style={{ color: "#9ca3af", fontSize: 9 }}>Lei 14.063/2020</span>
            </div>
          </div>
        ) : (
          <>
            {assinatura?.assinatura_png ? (
              <img src={assinatura.assinatura_png} alt="assinatura" style={{ display: "block", height: 60, margin: "0 auto 2px", objectFit: "contain" }} />
            ) : (
              <div style={{ height: 40 }} />
            )}
            <div className="assinatura-linha">
              {colaborador.nome}<br />
              Assinatura do colaborador (recebedor)
              {assinatura?.assinado_em ? <><br /><span style={{ color: "#9ca3af" }}>Assinado em {fmtDataHora(assinatura.assinado_em)} · Lei 14.063/2020</span></> : null}
            </div>
          </>
        )}
      </div>

      {entrega.responsavel_entrega ? (
        <div style={{ marginTop: 24, textAlign: "center", fontSize: 10, color: "#6b7280" }}>
          Responsável pela entrega: <strong style={{ color: "#374151" }}>{entrega.responsavel_entrega}</strong>
        </div>
      ) : null}
    </div>
  );
}
