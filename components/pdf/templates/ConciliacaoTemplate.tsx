import React from "react";
import { REGUA, ROTULO_DECISAO, type ItemFechamento } from "@/lib/psico-consolidacao/conciliacao";
import type { EmpresaPdf } from "@/components/pdf/templates/PsicossocialEmpresaTemplate";

// PDF de uma Conciliação DRPS/QPS × AEP FECHADA (v0.3.178) — o anexo do PGR (NR-01).
// Sai da foto gravada em psico_conciliacao_fechamentos (v310): nada é recalculado, então o
// PDF de um fechamento é sempre o mesmo. Só a situação das ações vem de hoje (Plano de Ação).
// renderToStaticMarkup + Puppeteer (lib/pdf/psicossocial-empresa.ts › responderPdf), A4 retrato.
// v0.3.285 (banco v354): também o fechamento de um GRUPO (`grupo`): empresas do grupo, documento de cada
// empresa, as empresas de cada setor e uma ação por empresa.

const AZUL = "#4338ca";

export interface AcaoConciliacaoPdf {
  id_acao: string;
  what_acao: string;
  who_responsavel: string | null;
  when_prazo: string | null;
  status: string;
}

export interface ConciliacaoPdfProps {
  empresa: EmpresaPdf;
  /** Fechamento de um grupo (v0.3.285): as empresas, com o rótulo curto usado nos itens. */
  grupo?: { nome: string; empresas: Array<{ nome: string; cnpj: string | null; rotulo: string }> };
  logoUrl?: string | null;
  geradoEm: string;
  fechamento: {
    id: string;
    em: string;
    por: string;
    observacao: string | null;
    documentos: Array<{ origem: string; titulo: string; data: string | null; empresa?: string }>;
    /** A régua gravada no fechamento (`REGUA` de conciliacao.ts). */
    regua: Record<string, unknown>;
    totais: Record<string, Record<string, number>>;
    /** Os questionários comparados (resumo.questionarios); sem ele, todas as chaves de `totais`. */
    questionarios?: string[];
    pareceres: { pendentes: number; semAcao: number; desatualizados: number; comParecer: number } | null;
    itens: Array<ItemFechamento & { empresas?: string[]; id_acoes?: string[] }>;
  };
  acoes: Record<string, AcaoConciliacaoPdf>;
}

const ESTILO = `
  .cc { font-family: Calibri, Arial, Helvetica, sans-serif; color: #111827; font-size: 10px; }
  .cc h1 { font-size: 16px; margin: 0; color: ${AZUL}; }
  .cc h2 { font-size: 12.5px; margin: 12px 0 5px; color: ${AZUL}; border-bottom: 1px solid #d1d5db; padding-bottom: 2px; break-after: avoid; page-break-after: avoid; }
  .cc p { margin: 0 0 5px; line-height: 1.4; }
  .cc ul { margin: 0 0 6px; padding-left: 14px; }
  .cc li { margin: 0 0 2px; line-height: 1.35; }
  .cc table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
  .cc th { background: ${AZUL}; color: #fff; font-size: 8px; padding: 3px 4px; text-align: left; font-weight: 600; vertical-align: bottom; }
  .cc td { border: 1px solid #e5e7eb; padding: 3px 4px; font-size: 8.5px; vertical-align: top; }
  .cc td.n { text-align: center; }
  .cc tr { break-inside: avoid; page-break-inside: avoid; }
  .cc thead { display: table-header-group; }
  .cc .meta { color: #6b7280; font-size: 8px; }
  .cc .cx { border: 1px solid #e5e7eb; border-radius: 5px; padding: 6px 8px; margin-bottom: 6px; }
  .cc .setor td { background: #eef2ff; font-weight: 700; font-size: 9px; }
  .cc .aviso { color: #b45309; }
`;

const STATUS: Record<string, string> = { Pendente: "Pendente", "Em Andamento": "Em andamento", Concluida: "Concluída", Cancelada: "Cancelada" };
const CLASSES_RESUMO = ["Nível divergente", "Só questionário", "Só AEP", "Convergente", "Sem indicação", "Sem par"];

const dataBr = (s: string | null) => (s ? s.slice(0, 10).split("-").reverse().join("/") : "—");

export function ConciliacaoTemplate({ empresa, grupo, logoUrl, geradoEm, fechamento: f, acoes }: ConciliacaoPdfProps) {
  // A régua sempre grava DRPS e QPS em `totais`; o resumo diz quais existiam (12/11: sem isto saía "QPS × AEP" zerado).
  const questionarios = f.questionarios?.length ? f.questionarios.filter((q) => q in f.totais) : Object.keys(f.totais);
  const porSetor = new Map<string, ConciliacaoPdfProps["fechamento"]["itens"]>();
  for (const i of [...f.itens].sort((a, b) => a.setor.localeCompare(b.setor, "pt-BR") || a.fator.localeCompare(b.fator, "pt-BR"))) {
    const lista = porSetor.get(i.setor);
    if (lista) lista.push(i);
    else porSetor.set(i.setor, [i]);
  }
  const conta = (d: ItemFechamento["decisao"]) => f.itens.filter((i) => i.decisao === d).length;
  const regua = (k: keyof typeof REGUA) => (typeof f.regua[k] === "number" ? (f.regua[k] as number) : (REGUA[k] as number));
  const minResp = regua("minRespondentes");
  const adesao = Math.round(regua("adesaoMinima") * 100);

  return (
    <div className="cc">
      <style>{ESTILO}</style>

      <div style={{ display: "flex", alignItems: "center", gap: 12, borderBottom: `2px solid ${AZUL}`, paddingBottom: 8, marginBottom: 8 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {logoUrl ? <img src={logoUrl} alt="" style={{ height: 40, objectFit: "contain" }} /> : null}
        <div style={{ flex: 1 }}>
          <h1>Conciliação dos questionários psicossociais com a AEP{grupo ? " — grupo de empresas" : ""}</h1>
          <p style={{ margin: "2px 0 0", fontSize: 12, fontWeight: 700 }}>{grupo ? `Grupo ${grupo.nome}` : empresa.razaoSocial || empresa.nome}</p>
          <p style={{ margin: "1px 0 0", fontSize: 9.5, color: "#374151" }}>
            {grupo
              ? `${grupo.empresas.length} empresa(s)`
              : [empresa.cnpj ? `CNPJ ${empresa.cnpj}` : null, empresa.endereco].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div style={{ fontSize: 8.5, color: "#6b7280", textAlign: "right" }}>
          Registro {f.id}
          <br />
          Fechada em {f.em}
          <br />
          por {f.por}
        </div>
      </div>

      <h2>Para que serve</h2>
      <p>
        Este documento registra a comparação, setor por setor e fator por fator, entre o que os trabalhadores apontaram nos
        questionários de riscos psicossociais (DRPS/QPS — a percepção de quem trabalha) e o que a Análise Ergonômica Preliminar
        (AEP — a observação técnica) identificou. Cada divergência recebeu um parecer: confirmar o risco no inventário do PGR,
        aprofundar com Análise Ergonômica do Trabalho (AET, NR-17) ou descartar com justificativa. É parte do processo de
        identificação e avaliação dos riscos do PGR (NR-01), que inclui a consulta aos trabalhadores sobre a percepção dos riscos.
      </p>
      {grupo && (
        <p>
          A comparação foi feita com o <b>grupo de empresas</b> inteiro, porque os trabalhadores transitam entre elas: entraram a
          AEP e o questionário mais recentes de cada empresa. Quando o mesmo setor e fator aparecem em mais de uma empresa, vale o
          pior nível de cada fonte. As ações de cada risco confirmado foram criadas no Plano de Ação de cada empresa em que o setor
          aparece.
        </p>
      )}

      {grupo && (
        <>
          <h2>Empresas do grupo</h2>
          <table>
            <thead>
              <tr>
                <th>Empresa</th>
                <th style={{ width: "24%" }}>CNPJ</th>
                <th style={{ width: "12%" }}>Rótulo</th>
              </tr>
            </thead>
            <tbody>
              {grupo.empresas.map((e) => (
                <tr key={`${e.nome}|${e.cnpj ?? ""}`}>
                  <td>{e.nome}</td>
                  <td>{e.cnpj ?? "—"}</td>
                  <td>{e.rotulo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h2>Documentos comparados</h2>
      <table>
        <thead>
          <tr>
            <th style={{ width: "14%" }}>Origem</th>
            {grupo && <th style={{ width: "12%" }}>Empresa</th>}
            <th>Documento</th>
            <th style={{ width: "16%" }}>Data</th>
          </tr>
        </thead>
        <tbody>
          {f.documentos.map((d, i) => (
            <tr key={`${d.origem}|${i}`}>
              <td>{d.origem === "QPS" ? "QPS (Questionário)" : d.origem}</td>
              {grupo && <td>{d.empresa ?? "—"}</td>}
              <td>{d.titulo}</td>
              <td>{dataBr(d.data)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Como comparamos</h2>
      <ul>
        <li>
          Escala comum de 4 degraus. Questionário: Baixo 1 · Médio 2 · Alto 3 · Crítico 4. AEP (nível AIHA): Trivial/Baixo 1 ·
          Moderado 2 · Alto 3 · Muito Alto 4. Cada fonte aponta o fator a partir do degrau 2.
        </li>
        <li>
          <b>Convergente:</b> as duas apontam, com até 1 degrau de diferença. <b>Nível divergente:</b> as duas apontam, com{" "}
          {regua("degrausDivergencia")} degraus ou mais de diferença. <b>Só questionário</b> / <b>Só AEP:</b> só uma aponta.{" "}
          <b>Sem indicação:</b> nenhuma aponta. <b>Sem par:</b> o setor não existe numa das fontes.
        </li>
        <li>
          <b>Representatividade:</b> o questionário do setor é só indicativo com menos de {minResp} respondentes ou adesão abaixo
          de {adesao}% dos expostos informados na AEP.
        </li>
      </ul>

      <h2>Resumo</h2>
      <table>
        <thead>
          <tr>
            <th>Comparação</th>
            {CLASSES_RESUMO.map((c) => (
              <th key={c} style={{ textAlign: "center" }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {questionarios.map((q) => (
            <tr key={q}>
              <td><b>{q} × AEP</b></td>
              {CLASSES_RESUMO.map((c) => (
                <td key={c} className="n">{f.totais[q]?.[c] ?? 0}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="cx">
        <p style={{ margin: 0 }}>
          Pareceres: <b>{conta("CONFIRMAR")}</b> confirmado(s) no inventário do PGR · <b>{conta("AET")}</b> para aprofundar com
          AET · <b>{conta("DESCARTAR")}</b> descartado(s) com justificativa
          {f.pareceres && f.pareceres.semAcao > 0 && (
            <span className="aviso"> · {f.pareceres.semAcao} sem ação no Plano de Ação no momento do fechamento</span>
          )}
          .
        </p>
        {f.observacao && <p style={{ margin: "4px 0 0" }}>Observação: {f.observacao}</p>}
      </div>

      <h2>Cruzamentos e pareceres</h2>
      {f.itens.length === 0 ? (
        <p className="meta">Nenhuma divergência nem parecer nesta conciliação.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th style={{ width: "17%" }}>Fator</th>
              <th style={{ width: "10%" }}>AEP</th>
              <th style={{ width: "13%" }}>Questionário</th>
              <th style={{ width: "11%" }}>Resultado</th>
              <th style={{ width: "24%" }}>Parecer</th>
              <th>Ação no Plano de Ação</th>
            </tr>
          </thead>
          <tbody>
            {[...porSetor.entries()].map(([setor, itens]) => (
              <React.Fragment key={setor}>
                <tr className="setor">
                  <td colSpan={6}>
                    {setor}
                    {itens[0].expostos != null && <span className="meta" style={{ fontWeight: 400 }}> · {itens[0].expostos} expostos</span>}
                    {itens[0].empresas && itens[0].empresas.length > 0 && (
                      <span className="meta" style={{ fontWeight: 400 }}> · empresa(s) {itens[0].empresas.join(", ")}</span>
                    )}
                  </td>
                </tr>
                {itens.map((i) => {
                  const a = i.id_acao ? acoes[i.id_acao] : undefined;
                  const varias = (i.id_acoes ?? []).length > 1 ? i.id_acoes! : null;
                  return (
                    <tr key={`${i.setor_chave}|${i.id_fator}|${i.questionario}`}>
                      <td>{i.fator}</td>
                      <td>{i.aep ?? "Não"}</td>
                      <td>
                        {i.questionario} {i.nivel_questionario ?? "—"}
                        {i.respondentes != null && (
                          <span className="meta" style={{ display: "block" }}>
                            {i.respondentes}
                            {i.expostos ? ` de ${i.expostos}` : ""} resp.
                          </span>
                        )}
                      </td>
                      <td>{i.classe}</td>
                      <td>
                        {i.decisao ? <b>{ROTULO_DECISAO[i.decisao]}</b> : <span className="aviso">Sem parecer</span>}
                        {i.justificativa && <span style={{ display: "block" }}>{i.justificativa}</span>}
                      </td>
                      <td>
                        {varias ? (
                          <>
                            {acoes[varias[0]]?.what_acao ?? ""}
                            {varias.map((id) => {
                              const x = acoes[id];
                              return (
                                <span key={id} className="meta" style={{ display: "block" }}>
                                  {x
                                    ? [x.id_acao, x.who_responsavel, x.when_prazo ? `prazo ${dataBr(x.when_prazo)}` : null, `hoje: ${STATUS[x.status] ?? x.status}`].filter(Boolean).join(" · ")
                                    : `${id} (não encontrada no plano)`}
                                </span>
                              );
                            })}
                          </>
                        ) : a ? (
                          <>
                            {a.what_acao}
                            <span className="meta" style={{ display: "block" }}>
                              {[a.id_acao, a.who_responsavel, a.when_prazo ? `prazo ${dataBr(a.when_prazo)}` : null, `hoje: ${STATUS[a.status] ?? a.status}`]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </>
                        ) : i.id_acao ? (
                          <span className="meta">{i.id_acao} (não encontrada no plano)</span>
                        ) : i.decisao && i.decisao !== "DESCARTAR" ? (
                          <span className="aviso">Sem ação</span>
                        ) : (
                          <span className="meta">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      )}

      <h2>Limitações</h2>
      <ul>
        <li>Os questionários refletem a percepção de quem respondeu; com baixa representatividade, o resultado do setor é indicativo.</li>
        <li>
          A avaliação de riscos é revista a cada 2 anos ou quando houver mudança nas condições de trabalho, acidente, doença ou
          medida de prevenção implantada (NR-01, 1.5.4.4.6). Nova conciliação gera novo registro; este não muda.
        </li>
      </ul>
      <p className="meta" style={{ marginTop: 10 }}>
        Registro {f.id} · gerado em {geradoEm} a partir da foto gravada no fechamento. A situação das ações é a do dia da geração.
      </p>
    </div>
  );
}
