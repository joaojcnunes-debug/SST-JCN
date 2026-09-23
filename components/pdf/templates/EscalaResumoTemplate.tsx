import React from "react";

// Template server-side do Resumo da Escala de Supervisores (renderToStaticMarkup
// + Puppeteer). Sem "use client"; só estilos inline + um bloco <style>.
// Tokens de marca: verde #0ea5e9, fonte Calibri.
//
// RETRATO, não paisagem. A matriz é larga por natureza (uma coluna por
// supervisor), mas paisagem tem um defeito conhecido e não resolvido nos laudos
// deste painel — página em branco antes da folha de assinaturas. Não vale
// arrastar esse problema para um relatório novo por causa de largura: com a
// equipe de hoje o retrato acomoda bem, e a fonte reduzida cobre o resto.

export interface LinhaResumo {
  rotulo: string;
  valores: number[];
  total: number;
}

export interface TabelaResumo {
  titulo: string;
  nota?: string;
  primeiraColuna: string;
  linhas: LinhaResumo[];
  totais: number[];
  totalGeral: number;
}

export interface EscalaResumoProps {
  periodo: string;
  supervisores: string[];
  tabelas: TabelaResumo[];
  situacoes: { situacao: string; dias: number }[];
  geradoEm: string;
  logoUrl?: string | null;
}

const VERDE = "#0ea5e9";

export default function EscalaResumoTemplate({
  periodo,
  supervisores,
  tabelas,
  situacoes,
  geradoEm,
  logoUrl,
}: EscalaResumoProps) {
  return (
    <div className="escala-resumo">
      <style>{`
        .escala-resumo { font-family: Calibri, Arial, Helvetica, sans-serif; color: #111827; font-size: 11px; }
        .escala-resumo h1 { font-size: 16px; margin: 0; color: ${VERDE}; letter-spacing: .3px; }
        .escala-resumo h2 { font-size: 12px; margin: 0 0 2px; color: ${VERDE}; }
        .escala-resumo table { width: 100%; border-collapse: collapse; }
        .escala-resumo th { background: ${VERDE}; color: #fff; font-size: 9px; text-transform: uppercase; letter-spacing: .3px; padding: 5px 6px; text-align: right; }
        .escala-resumo th.rot { text-align: left; }
        .escala-resumo td { border-bottom: 1px solid #e5e7eb; padding: 4px 6px; font-size: 10px; text-align: right; font-variant-numeric: tabular-nums; }
        .escala-resumo td.rot { text-align: left; font-weight: 600; }
        .escala-resumo tr.total td { border-top: 2px solid ${VERDE}; border-bottom: none; font-weight: 700; background: #f3f7f5; }
        .escala-resumo .nota { font-size: 9px; color: #6b7280; margin: 0 0 5px; }
        .escala-resumo .bloco { margin-bottom: 16px; }
        /* Um bloco que abre no pé da folha vai inteiro para a próxima — a mesma
           regra dos laudos, pedida em 17/08. Tabela partida ao meio entrega um
           cabeçalho órfão numa página e números soltos na outra. */
        .escala-resumo .bloco { break-inside: avoid; page-break-inside: avoid; }
      `}</style>

      {/* ── Cabeçalho ─────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          borderBottom: `2px solid ${VERDE}`,
          paddingBottom: 8,
          marginBottom: 12,
        }}
      >
        {/* `next/image` não existe aqui: este HTML é montado por
            renderToStaticMarkup e servido ao Chromium do Puppeteer, fora do
            runtime do Next. Mesma escolha dos outros templates de laudo. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {logoUrl ? <img src={logoUrl} alt="" style={{ height: 42, objectFit: "contain" }} /> : null}
        <div style={{ flex: 1 }}>
          <h1>Escala de Supervisores — Resumo</h1>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: "#374151" }}>
            Grupo JCN Consultoria — Segurança e Medicina do Trabalho · {periodo}
          </p>
        </div>
        <div style={{ fontSize: 9, color: "#6b7280", textAlign: "right" }}>
          Gerado em
          <br />
          {geradoEm}
        </div>
      </div>

      {/* ── As matrizes ───────────────────────────────────── */}
      {tabelas.map((t) => (
        <div className="bloco" key={t.titulo}>
          <h2>{t.titulo}</h2>
          {t.nota ? <p className="nota">{t.nota}</p> : null}
          <table>
            <thead>
              <tr>
                <th className="rot">{t.primeiraColuna}</th>
                {supervisores.map((s) => (
                  <th key={s}>{s}</th>
                ))}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {t.linhas.map((l) => (
                <tr key={l.rotulo}>
                  <td className="rot">{l.rotulo}</td>
                  {l.valores.map((v, i) => (
                    <td key={i} style={v === 0 ? { color: "#9ca3af" } : undefined}>
                      {v}
                    </td>
                  ))}
                  <td style={{ fontWeight: 600 }}>{l.total}</td>
                </tr>
              ))}
              <tr className="total">
                <td className="rot">Total geral</td>
                {t.totais.map((v, i) => (
                  <td key={i}>{v}</td>
                ))}
                <td>{t.totalGeral}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ))}

      {/* ── Situações ─────────────────────────────────────── */}
      <div className="bloco">
        <h2>Dias fora de unidade</h2>
        {situacoes.length === 0 ? (
          <p className="nota">Nenhum dia fora de unidade no período.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th className="rot">Situação</th>
                <th>Dias</th>
              </tr>
            </thead>
            <tbody>
              {situacoes.map((s) => (
                <tr key={s.situacao}>
                  <td className="rot">{s.situacao}</td>
                  <td>{s.dias}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
