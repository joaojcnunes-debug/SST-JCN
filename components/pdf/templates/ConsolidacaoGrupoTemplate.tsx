import React from "react";
import type { ResultadoMotor, NivelPresente } from "@/lib/psico-consolidacao/motor";
import type { GlossarioItem } from "@/lib/psico-consolidacao/consolidacao-grupo";

// Relatório ao cliente da Consolidação Psicossocial de Grupo (fase 6, 19/10/2026).
// renderToStaticMarkup + Puppeteer, A4 PAISAGEM no documento inteiro (o defeito da
// página em branco dos laudos é só na volta paisagem → retrato; aqui não há volta).
// Nada é calculado aqui: tudo vem do motor (`consolidar`), o mesmo da tela.
// Roteiro (pedido de 19/10, seção 6): para que serve · responsabilidades · glossário ·
// critério de conversão (régua do DRPS/QPS e da AIHA) · Sim/Não setor × fator ·
// lista por setor · empresa × setor × fator · o que cada empresa precisa fazer.

const VERDE = "#0284c7";

const COR: Record<NivelPresente, { fundo: string; texto: string }> = {
  Crítico: { fundo: "#dc2626", texto: "#fff" },
  Alto: { fundo: "#f97316", texto: "#fff" },
  Médio: { fundo: "#fcd34d", texto: "#451a03" },
  Identificado: { fundo: "#e0e7ff", texto: "#3730a3" },
};
const ORDEM: NivelPresente[] = ["Crítico", "Alto", "Médio", "Identificado"];

export interface EmpresaRelatorio {
  idEmpresa: string;
  nome: string;
  cnpj: string | null;
  documentos: string;
}

export interface ConsolidacaoGrupoProps {
  grupo: string;
  geradoEm: string;
  logoUrl?: string | null;
  empresas: EmpresaRelatorio[];
  r: ResultadoMotor;
  nomeEmpresa: (id: string) => string;
  nomeCurto: (id: string) => string;
  glossario: GlossarioItem[];
  /** Fase 7: versão registrada (o PDF sai da foto gravada). */
  registro?: { id: string; em: string };
}

const ESTILO = `
  @page { size: A4 landscape; margin: 10mm 10mm 14mm 10mm; }
  .cg { font-family: Calibri, Arial, Helvetica, sans-serif; color: #111827; font-size: 10px; }
  .cg h1 { font-size: 17px; margin: 0; color: ${VERDE}; }
  .cg h2 { font-size: 13px; margin: 10px 0 5px; color: ${VERDE}; border-bottom: 1px solid #d1d5db; padding-bottom: 2px; break-after: avoid; page-break-after: avoid; }
  .cg h3 { font-size: 11px; margin: 10px 0 4px; color: #111827; break-after: avoid; page-break-after: avoid; }
  .cg p { margin: 0 0 5px; line-height: 1.35; }
  .cg ul { margin: 0 0 6px; padding-left: 14px; }
  .cg li { margin: 0 0 2px; line-height: 1.3; }
  .cg table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
  .cg th { background: ${VERDE}; color: #fff; font-size: 8px; padding: 3px 4px; text-align: left; font-weight: 600; vertical-align: bottom; }
  .cg th.f { text-align: center; font-size: 7.5px; line-height: 1.15; }
  .cg td { border: 1px solid #e5e7eb; padding: 3px 4px; font-size: 9px; vertical-align: top; }
  .cg td.c { text-align: center; vertical-align: middle; padding: 2px; }
  .cg tr { break-inside: avoid; page-break-inside: avoid; }
  .cg thead { display: table-header-group; }
  .cg .sim { display: inline-block; background: #fee2e2; color: #991b1b; font-weight: 700; border-radius: 3px; padding: 0 4px; font-size: 8.5px; }
  .cg .nao { color: #c4c4c4; font-size: 8px; }
  .cg .nv { display: inline-block; border-radius: 3px; padding: 0 4px; font-weight: 700; font-size: 8.5px; white-space: nowrap; }
  .cg .sup { color: #4338ca; font-size: 7px; vertical-align: super; }
  .cg .bloco { break-inside: avoid; page-break-inside: avoid; }
  .cg .nova { break-before: page; page-break-before: always; }
  .cg .cx { border: 1px solid #e5e7eb; border-radius: 5px; padding: 6px 8px; margin-bottom: 6px; }
  .cg .dois { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; align-items: start; }
  .cg .meta { color: #6b7280; font-size: 9px; }
  .cg .emp { font-weight: 700; background: #f3f4f6; }
`;

function Nivel({ n }: { n: NivelPresente | string }) {
  const c = COR[n as NivelPresente] ?? { fundo: "#f3f4f6", texto: "#374151" };
  return (
    <span className="nv" style={{ background: c.fundo, color: c.texto }}>
      {n}
    </span>
  );
}

const SimNao = ({ sim }: { sim: boolean }) => (sim ? <span className="sim">Sim</span> : <span className="nao">Não</span>);

export function ConsolidacaoGrupoTemplate(p: ConsolidacaoGrupoProps) {
  const { r, nomeEmpresa, nomeCurto } = p;
  const fatores = r.fatores;
  const nomeFator = new Map(fatores.map((f) => [f.id_fator, f.nome]));
  const unica = new Set(r.setores.filter((s) => !s.comum).map((s) => s.setor));
  const perfil = [...r.perfil, ...r.avaliacaoPropria];
  const empresasSimNao = [...new Set(r.simNaoEmpresa.map((l) => l.idEmpresa))];
  const ajustes = (id: string) => r.lacunas.filter((l) => l.idEmpresa === id && l.acao !== "OK");
  const fontesTexto = (f: { idEmpresa: string; nivel: NivelPresente }[]) =>
    f.map((x) => `${nomeEmpresa(x.idEmpresa)} (${x.nivel === "Identificado" ? "AEP" : x.nivel})`).join("; ");
  const ordemFator = new Map(fatores.map((f) => [f.id_fator, f.ordem]));

  return (
    <div className="cg">
      <style>{ESTILO}</style>

      {/* ── Cabeçalho ─────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, borderBottom: `2px solid ${VERDE}`, paddingBottom: 8, marginBottom: 8 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {p.logoUrl ? <img src={p.logoUrl} alt="" style={{ height: 42, objectFit: "contain" }} /> : null}
        <div style={{ flex: 1 }}>
          <h1>Consolidação dos Riscos Psicossociais do Grupo</h1>
          <p style={{ margin: "2px 0 0", fontSize: 12, fontWeight: 700 }}>{p.grupo}</p>
          {p.registro && (
            <p style={{ margin: "1px 0 0", fontSize: 10, color: "#374151" }}>
              Versão registrada {p.registro.id} em {p.registro.em}
            </p>
          )}
        </div>
        <div style={{ fontSize: 9, color: "#6b7280", textAlign: "right" }}>
          Gerado em
          <br />
          {p.geradoEm}
        </div>
      </div>

      <h2>Para que serve este relatório</h2>
      <p>
        As empresas do grupo compartilham trabalhadores: quem atua num setor de uma empresa também atua no mesmo setor das
        outras. Por isso, o risco psicossocial identificado num setor de qualquer empresa do grupo passa a constar nesse
        mesmo setor em todas as empresas que o têm. Este relatório junta as Análises Ergonômicas Preliminares (AEP) e os
        Diagnósticos/Questionários Psicossociais (DRPS/QPS) concluídos, padroniza os nomes dos setores e define, setor por
        setor, quais fatores de risco psicossocial devem constar no PGR de cada empresa.
      </p>
      <div className="dois">
        <div className="cx">
          <h3 style={{ marginTop: 0 }}>Responsabilidades</h3>
          <ul>
            <li><strong>JCN Consultoria:</strong> define os riscos de cada setor e atualiza o inventário do PGR de cada empresa.</li>
            <li><strong>Cliente:</strong> valida a lista por setor.</li>
            <li>
              <strong>Médico responsável pelo PCMSO:</strong> recebe o inventário atualizado e define, dentro da sua
              responsabilidade técnica, como os riscos entram no PCMSO e nos ASOs.
            </li>
          </ul>
        </div>
        <div className="cx">
          <h3 style={{ marginTop: 0 }}>Empresas e documentos considerados</h3>
          <table>
            <tbody>
              {p.empresas.map((e) => (
                <tr key={e.idEmpresa}>
                  <td style={{ width: "48%" }}>
                    {e.nome}
                    {e.cnpj ? <span className="meta"> · {e.cnpj}</span> : null}
                  </td>
                  <td className="meta">{e.documentos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="nova" />
      <h2 style={{ marginTop: 0 }}>Glossário de siglas</h2>
      <table>
        <thead>
          <tr>
            <th style={{ width: "8%" }}>Sigla</th>
            <th style={{ width: "32%" }}>Significado</th>
            <th>O que é</th>
          </tr>
        </thead>
        <tbody>
          {p.glossario.map((g) => (
            <tr key={g.sigla}>
              <td><strong>{g.sigla}</strong></td>
              <td>{g.significado}</td>
              <td>{g.explicacao ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Critério ──────────────────────────────────────────────────────── */}
      <h2>Critério de conversão em risco no PGR</h2>
      <ul>
        <li><Nivel n="Crítico" /> ou <Nivel n="Alto" /> no questionário: entra no PGR com prioridade máxima.</li>
        <li><Nivel n="Médio" /> no questionário: entra com medidas preventivas e reavaliação em ciclo mais curto.</li>
        <li>Baixo no questionário: não entra; fica em monitoramento.</li>
        <li>Fator marcado &quot;Sim&quot; na AEP da obra: entra como <Nivel n="Identificado" />.</li>
        <li>
          Setor presente em 2 ou mais empresas: o fator encontrado em qualquer uma delas vale para todas, no maior nível
          encontrado. Setor de uma empresa só (marcado com <span className="sup">1</span>) mantém a avaliação da própria
          empresa.
        </li>
      </ul>
      <div className="dois">
        <div className="cx bloco">
          <h3 style={{ marginTop: 0 }}>Como o questionário (DRPS/QPS) vira nível de risco</h3>
          <ul>
            <li>
              <strong>Gravidade da pergunta:</strong> média das respostas do setor, arredondada para cima (perguntas
              invertidas usam 4 − valor): até 1 Baixa, 2 Média, 3 ou mais Alta.
            </li>
            <li><strong>Gravidade do tópico:</strong> média das gravidades das perguntas: até 1,66 Baixa · 1,67 a 2,32 Média · acima de 2,32 Alta.</li>
            <li>
              <strong>Probabilidade (1 a 3):</strong> definida pelo psicólogo por setor e tópico (frequência, histórico,
              recursos). Sem probabilidade informada, vale Baixa (1).
            </li>
          </ul>
          <table style={{ width: "auto" }}>
            <thead>
              <tr>
                <th>Gravidade ↓ / Probabilidade →</th>
                <th>Baixa (1)</th>
                <th>Média (2)</th>
                <th>Alta (3)</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Alta (3)", "Médio", "Alto", "Crítico"],
                ["Média (2)", "Baixo", "Médio", "Alto"],
                ["Baixa (1)", "Baixo", "Baixo", "Médio"],
              ].map(([g, ...n]) => (
                <tr key={g}>
                  <td><strong>{g}</strong></td>
                  {n.map((x, i) => (
                    <td key={i} className="c">{x === "Baixo" ? <span className="nv" style={{ background: "#dcfce7", color: "#166534" }}>Baixo</span> : <Nivel n={x} />}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="meta">
            Conduta: Baixo = monitoramento · Médio = medidas preventivas e reavaliação em ciclo curto · Alto = intervenção
            imediata com plano estruturado · Crítico = ação urgente com envolvimento da alta direção.
          </p>
        </div>
        <div className="cx bloco">
          <h3 style={{ marginTop: 0 }}>Como a AEP classifica o fator (matriz AIHA)</h3>
          <ul>
            <li>
              <strong>Probabilidade:</strong> nº de sinais observados no setor (0 a 3; 4 ou 5 sinais = 4).
            </li>
            <li>
              <strong>Severidade:</strong> Irreversíveis (3) = Assédio, Eventos violentos · Severos (2) = Falta de suporte,
              Baixo controle, Baixa justiça, Sobrecarga, Maus relacionamentos · Preocupantes (1) = os demais.
            </li>
            <li>
              <strong>Nível = probabilidade × severidade:</strong> 0 Trivial · 1–2 Baixo · 3–6 Moderado · 7–10 Alto · 11 ou
              mais Muito Alto.
            </li>
          </ul>
          <p className="meta">
            Na consolidação, todo fator marcado na AEP conta como &quot;Identificado&quot;; o nível AIHA orienta a
            prioridade dentro da própria AEP.
          </p>
        </div>
      </div>

      {/* ── Sim/Não setor × fator ─────────────────────────────────────────── */}
      <div className="nova" />
      <h2>Visão geral: fatores por setor</h2>
      <p className="meta">&quot;Sim&quot; = o fator consta no PGR das empresas que têm o setor. <span className="sup">1</span> = setor de uma empresa só.</p>
      <table>
        <thead>
          <tr>
            <th style={{ width: "16%" }}>Setor</th>
            {fatores.map((f) => (
              <th key={f.id_fator} className="f">{nomeCurto(f.id_fator)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {r.simNaoSetor.map((s) => (
            <tr key={s.setor}>
              <td>
                <strong>{s.setor}</strong>
                {s.unicaEmpresa && <span className="sup">1</span>}
              </td>
              {fatores.map((f) => (
                <td key={f.id_fator} className="c"><SimNao sim={!!s.fatores[f.id_fator]} /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Lista por setor ───────────────────────────────────────────────── */}
      <div className="nova" />
      <h2>Fatores de cada setor, por nível</h2>
      <table>
        <thead>
          <tr>
            <th style={{ width: "16%" }}>Setor</th>
            {ORDEM.map((n) => (
              <th key={n} style={{ width: "21%" }}>{n}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {r.setores
            .filter((s) => perfil.some((x) => x.setor === s.setor))
            .map((s) => (
              <tr key={s.setor}>
                <td>
                  <strong>{s.setor}</strong>
                  {unica.has(s.setor) && <span className="sup">1</span>}
                </td>
                {ORDEM.map((n) => (
                  <td key={n}>
                    {perfil
                      .filter((x) => x.setor === s.setor && x.nivel === n)
                      .sort((a, b) => (ordemFator.get(a.idFator) ?? 0) - (ordemFator.get(b.idFator) ?? 0))
                      .map((x) => nomeFator.get(x.idFator))
                      .join("; ")}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>

      {/* ── Empresa × setor × fator ───────────────────────────────────────── */}
      <div className="nova" />
      <h2>Por empresa: fatores que devem constar no PGR, setor por setor</h2>
      <table>
        <thead>
          <tr>
            <th style={{ width: "16%" }}>Setor</th>
            {fatores.map((f) => (
              <th key={f.id_fator} className="f">{nomeCurto(f.id_fator)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {empresasSimNao.map((e) => (
            <React.Fragment key={e}>
              <tr>
                <td className="emp" colSpan={fatores.length + 1}>{nomeEmpresa(e)}</td>
              </tr>
              {r.simNaoEmpresa
                .filter((l) => l.idEmpresa === e)
                .map((l) => (
                  <tr key={l.setor}>
                    <td>
                      {l.setor}
                      {l.unicaEmpresa && <span className="sup">1</span>}
                    </td>
                    {fatores.map((f) => (
                      <td key={f.id_fator} className="c"><SimNao sim={!!l.fatores[f.id_fator]} /></td>
                    ))}
                  </tr>
                ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>

      {/* ── O que cada empresa precisa fazer ──────────────────────────────── */}
      <div className="nova" />
      <h2>O que cada empresa precisa fazer</h2>
      <p className="meta">
        <strong>Incluir</strong> = o fator faz parte do perfil do setor, mas não consta (ou consta só como Baixo) na
        avaliação da empresa. <strong>Revisar nível</strong> = consta, mas num nível abaixo do perfil. A última coluna mostra
        em quais empresas o risco foi identificado.
      </p>
      {empresasSimNao.map((e) => {
        const lista = ajustes(e).sort(
          (a, b) => a.setor.localeCompare(b.setor, "pt-BR") || (ordemFator.get(a.idFator) ?? 0) - (ordemFator.get(b.idFator) ?? 0),
        );
        return (
          <div key={e}>
            <h3>
              {nomeEmpresa(e)}{" "}
              <span className="meta">
                — {lista.filter((l) => l.acao === "Incluir").length} a incluir, {lista.filter((l) => l.acao === "Revisar nível").length} a revisar
              </span>
            </h3>
            {lista.length === 0 ? (
              <p className="meta">Nenhum ajuste: a avaliação da empresa já cobre o perfil dos seus setores.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th style={{ width: "14%" }}>Setor</th>
                    <th style={{ width: "24%" }}>Fator</th>
                    <th style={{ width: "9%" }}>Ação</th>
                    <th style={{ width: "8%" }}>Na empresa</th>
                    <th style={{ width: "8%" }}>Perfil</th>
                    <th>Onde foi identificado</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((l) => (
                    <tr key={`${l.setor}|${l.idFator}`}>
                      <td>{l.setor}</td>
                      <td>{nomeFator.get(l.idFator)}</td>
                      <td><strong>{l.acao}</strong></td>
                      <td>{l.situacao ? <Nivel n={l.situacao} /> : <span className="meta">ausente</span>}</td>
                      <td><Nivel n={l.perfil} /></td>
                      <td>{fontesTexto(l.fontes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </div>
  );
}
