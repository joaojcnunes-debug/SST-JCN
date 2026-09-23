import React from "react";

/**
 * Comprovante em PDF de transferências de equipamentos selecionadas.
 * Self-contained: um bloco <style> (extraído pelo route) + conteúdo inline.
 */

export interface TransferenciaPdf {
  id_transferencia: string;
  de_unidade: string | null;
  de_localizacao: string | null;
  de_responsavel: string | null;
  para_unidade: string | null;
  para_localizacao: string | null;
  para_responsavel: string | null;
  motivo: string | null;
  observacoes: string | null;
  maquina_nome: string | null;
  maquina_codigo_interno: string | null;
  maquina_tag: string | null;
  maquina_marca: string | null;
  maquina_modelo: string | null;
  maquina_numero_serie: string | null;
  maquina_numero_patrimonio: string | null;
  responsavel_nome: string | null;
  data_hora: string | null;
}

function fmtDataHora(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const junta = (...vs: (string | null | undefined)[]) => vs.filter(Boolean).join(" · ") || "—";

const STYLE = `
* { box-sizing: border-box; }
body { font-family: Arial, Helvetica, sans-serif; color: #1f2937; }
.cab { border-bottom: 3px solid #2563eb; padding-bottom: 12px; margin-bottom: 16px; }
.cab .rotulo { font-size: 10pt; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #2563eb; margin: 0; }
.cab h1 { font-size: 18pt; font-weight: 700; color: #111827; margin: 4px 0 0; }
.cab .meta { margin-top: 6px; font-size: 9.5pt; color: #6b7280; }
.trf { border: 1px solid #e5e7eb; border-left: 4px solid #2563eb; border-radius: 6px; padding: 10px 12px; margin-bottom: 10px; page-break-inside: avoid; }
.trf .titulo { font-size: 11.5pt; font-weight: 700; color: #111827; margin: 0; }
.trf .ident { font-size: 9pt; color: #6b7280; margin: 2px 0 8px; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; font-size: 9.5pt; }
.grid .k { font-weight: 700; color: #374151; }
.seta { color: #2563eb; font-weight: 700; }
.rodape-linha { margin-top: 6px; font-size: 9pt; color: #4b5563; }
`;

export default function TransferenciasTemplate({
  transferencias,
  geradoEm,
}: {
  transferencias: TransferenciaPdf[];
  geradoEm: string;
}) {
  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: STYLE }} />

      <div className="cab">
        <p className="rotulo">JCN Consultoria · Inventário</p>
        <h1>Registro de Transferências de Equipamentos</h1>
        <div className="meta">
          Gerado em {geradoEm} · {transferencias.length} transferência
          {transferencias.length !== 1 ? "s" : ""} selecionada
          {transferencias.length !== 1 ? "s" : ""}
        </div>
      </div>

      {transferencias.map((t) => (
        <div className="trf" key={t.id_transferencia}>
          <p className="titulo">{t.maquina_nome ?? "Equipamento"}</p>
          <p className="ident">
            {junta(
              t.maquina_codigo_interno && `Cód. ${t.maquina_codigo_interno}`,
              t.maquina_tag && `TAG ${t.maquina_tag}`,
              t.maquina_marca,
              t.maquina_modelo,
              t.maquina_numero_serie && `Série ${t.maquina_numero_serie}`,
              t.maquina_numero_patrimonio && `Patrim. ${t.maquina_numero_patrimonio}`,
            )}
          </p>

          <div className="grid">
            <span>
              <span className="k">De:</span> {junta(t.de_unidade, t.de_localizacao, t.de_responsavel)}
            </span>
            <span>
              <span className="k seta">Para:</span> {junta(t.para_unidade, t.para_localizacao, t.para_responsavel)}
            </span>
            <span>
              <span className="k">Responsável pela transferência:</span> {t.responsavel_nome ?? "—"}
            </span>
            <span>
              <span className="k">Data / hora:</span> {fmtDataHora(t.data_hora)}
            </span>
          </div>

          {(t.motivo || t.observacoes) && (
            <div className="rodape-linha">
              {t.motivo && (
                <div>
                  <strong>Motivo:</strong> {t.motivo}
                </div>
              )}
              {t.observacoes && (
                <div>
                  <strong>Observações:</strong> {t.observacoes}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
