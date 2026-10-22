import React from "react";
import { CORES_MATRIZ } from "@/lib/drps/calculos";
import { COR_NIVEL_AIHA } from "@/lib/aep/aiha-organizacional";
import { dataBR, piorNivel, type AvaliacaoSinalizada, type LeituraQuestionario } from "@/lib/aep/sinalizacao";
import type { AvaliacaoRisco } from "@/lib/riscos-psicossociais/carregar";
import type { NivelMatriz } from "@/lib/drps/types";

// Templates server-side das páginas "Riscos Psicossociais › empresa" e
// "AEP › empresa" do Painel SST (renderToStaticMarkup + Puppeteer, 2026-10-09).
// O PDF é a TELA impressa: cabeçalho da empresa e, por avaliação, uma tabela
// por setor com o resultado final — as mesmas colunas, na mesma ordem. Nada é
// recalculado aqui; os dados chegam prontos das mesmas funções da tela.
//
// RETRATO, como o Resumo da Escala: paisagem tem o defeito conhecido da página
// em branco nos laudos. Cinco colunas de texto cabem em retrato com fonte 9–10px.
// Sem "use client"; só estilos inline + um bloco <style>.

const VERDE = "#0284c7";

export interface EmpresaPdf {
  nome: string;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  cnpj: string | null;
  cnae: string | null;
  grauRisco: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  unidade?: string | null;
  regiao?: string | null;
}

interface Comum {
  empresa: EmpresaPdf;
  geradoEm: string;
  logoUrl?: string | null;
}

const ESTILO = `
  .psi { font-family: Calibri, Arial, Helvetica, sans-serif; color: #111827; font-size: 10px; }
  .psi h1 { font-size: 16px; margin: 0; color: ${VERDE}; letter-spacing: .3px; }
  .psi h2 { font-size: 13px; margin: 0; color: #111827; }
  .psi h3 { font-size: 11px; margin: 0; color: ${VERDE}; }
  .psi .cadastro { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px 12px; border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px 10px; margin-bottom: 14px; }
  .psi .cadastro .rot { font-size: 8px; color: #6b7280; text-transform: uppercase; letter-spacing: .3px; }
  .psi .cadastro .val { font-size: 10px; }
  .psi .s2 { grid-column: span 2; }
  .psi .s3 { grid-column: span 3; }
  .psi .avaliacao { margin-bottom: 14px; }
  .psi .cab-av { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding-bottom: 4px; border-bottom: 1px solid #d1d5db; margin-bottom: 8px; }
  .psi .tag { font-size: 9px; font-weight: 700; border-radius: 3px; padding: 1px 5px; }
  .psi .meta { font-size: 9px; color: #6b7280; }
  .psi .blocos-aep { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; margin-bottom: 8px; }
  .psi .blocos-aep > div { border: 1px solid #e5e7eb; border-radius: 4px; padding: 3px 6px; }
  .psi .blocos-aep .alerta { border-color: #fcd34d; background: #fef3c7; }
  .psi .setor { margin-bottom: 10px; }
  .psi .cab-setor { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 3px; }
  .psi table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .psi th { background: ${VERDE}; color: #fff; font-size: 8px; text-transform: uppercase; letter-spacing: .3px; padding: 4px 5px; text-align: left; font-weight: 600; }
  .psi td { border: 1px solid #e5e7eb; padding: 4px 5px; font-size: 9px; vertical-align: top; }
  .psi ul { margin: 0; padding-left: 12px; }
  .psi li { margin: 0 0 1px; }
  .psi .selo { display: inline-block; border-radius: 9px; padding: 1px 7px; font-size: 8.5px; font-weight: 700; white-space: nowrap; border: 1px solid transparent; }
  .psi .vazio { color: #9ca3af; }
  .psi .obs { font-style: italic; color: #6b7280; margin-top: 2px; }
  /* Linha da tabela não parte ao meio na quebra de página; o cabeçalho da
     tabela se repete na folha seguinte (thead é table-header-group). */
  .psi tr { break-inside: avoid; page-break-inside: avoid; }
  .psi thead { display: table-header-group; }
  .psi .cab-setor, .psi .cab-av { break-after: avoid; page-break-after: avoid; }
`;

function Cabecalho({ titulo, subtitulo, empresa, geradoEm, logoUrl }: Comum & { titulo: string; subtitulo: string }) {
  const info = (rotulo: string, valor: string | null | undefined, cls?: string) => (
    <div className={cls}>
      <div className="rot">{rotulo}</div>
      <div className="val">{valor && valor.trim() ? valor : "—"}</div>
    </div>
  );
  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          borderBottom: `2px solid ${VERDE}`,
          paddingBottom: 8,
          marginBottom: 10,
        }}
      >
        {/* Fora do runtime do Next (renderToStaticMarkup): <img> puro, como nos laudos. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {logoUrl ? <img src={logoUrl} alt="" style={{ height: 42, objectFit: "contain" }} /> : null}
        <div style={{ flex: 1 }}>
          <h1>{titulo}</h1>
          <p style={{ margin: "2px 0 0", fontSize: 12, fontWeight: 700 }}>{empresa.nome}</p>
          <p style={{ margin: "1px 0 0", fontSize: 10, color: "#374151" }}>{subtitulo}</p>
        </div>
        <div style={{ fontSize: 9, color: "#6b7280", textAlign: "right" }}>
          Gerado em
          <br />
          {geradoEm}
        </div>
      </div>
      <div className="cadastro">
        {info("Razão social", empresa.razaoSocial, "s2")}
        {info("Nome fantasia", empresa.nomeFantasia)}
        {info("CNPJ", empresa.cnpj)}
        {info("CNAE principal", empresa.cnae, "s2")}
        {info("Grau de risco", empresa.grauRisco)}
        {info("Telefone", empresa.telefone)}
        {empresa.unidade !== undefined && info("Unidade", empresa.unidade)}
        {empresa.regiao !== undefined && info("Região (município/UF)", empresa.regiao)}
        {info("Endereço", empresa.endereco, "s3")}
        {info("E-mail", empresa.email)}
      </div>
    </>
  );
}

function Lista({ itens, vazio }: { itens: string[]; vazio: string }) {
  if (itens.length === 0) return <span className="vazio">{vazio}</span>;
  return (
    <ul>
      {itens.map((i) => (
        <li key={i}>{i}</li>
      ))}
    </ul>
  );
}

function Documento({ children }: { children: React.ReactNode }) {
  return (
    <div className="psi">
      <style>{ESTILO}</style>
      {children}
    </div>
  );
}

// ─── Riscos Psicossociais (DRPS / Questionário) ─────────────────────────────

const STATUS_RISCOS: Record<string, string> = { CONCLUIDO: "Concluído", ENVIADO_CLIENTE: "Enviado ao cliente" };

function SeloMatriz({ nivel }: { nivel: NivelMatriz }) {
  // Texto branco sobre a cor da matriz, como na tela.
  return (
    <span className="selo" style={{ backgroundColor: CORES_MATRIZ[nivel], color: "#fff" }}>
      {nivel}
    </span>
  );
}

export function RiscosPsicossociaisEmpresaTemplate({ avaliacoes, ...comum }: Comum & { avaliacoes: AvaliacaoRisco[] }) {
  return (
    <Documento>
      <Cabecalho
        {...comum}
        titulo="Riscos Psicossociais"
        subtitulo="Riscos psicossociais por setor — resultado final de cada risco."
      />
      {avaliacoes.length === 0 ? (
        <p className="meta">Esta empresa não tem avaliação do DRPS ou do Questionário concluída.</p>
      ) : (
        avaliacoes.map((a) => (
          <div className="avaliacao" key={a.id}>
            <div className="cab-av">
              <span
                className="tag"
                style={a.fonte === "DRPS" ? { background: "#ede9fe", color: "#6d28d9" } : { background: "#e0f2fe", color: "#0369a1" }}
              >
                {a.fonte}
              </span>
              <h2>{a.titulo}</h2>
              <span className="meta">
                {STATUS_RISCOS[a.status] ?? a.status}
                {a.data ? ` · ${dataBR(a.data)}` : ""}
                {a.responsavel ? ` · ${a.responsavel}` : ""}
              </span>
            </div>
            {a.setores.length === 0 ? (
              <p className="meta">Sem respondentes importados nesta avaliação.</p>
            ) : (
              a.setores.map((s) => (
                <div className="setor" key={s.setor}>
                  <div className="cab-setor">
                    <h3>{s.setor}</h3>
                    <span className="meta">
                      {s.respondentes} respondente{s.respondentes !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {s.fatores.length === 0 ? (
                    <p className="meta">Nenhum risco com resposta neste setor.</p>
                  ) : (
                    <table>
                      <colgroup>
                        <col style={{ width: "22%" }} />
                        <col style={{ width: "11%" }} />
                        <col style={{ width: "21%" }} />
                        <col style={{ width: "26%" }} />
                        <col style={{ width: "20%" }} />
                      </colgroup>
                      <thead>
                        <tr>
                          <th>Risco</th>
                          <th>Resultado final</th>
                          <th>Fonte geradora</th>
                          <th>Medidas de controle recomendadas</th>
                          <th>Possíveis agravos à saúde mental</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Medidas e agravos são do SETOR: uma célula só, em todas as linhas — como na tela e no laudo. */}
                        {s.fatores.map((f, i) => (
                          <tr key={f.nome}>
                            <td>{f.nome}</td>
                            <td>
                              <SeloMatriz nivel={f.nivel} />
                            </td>
                            <td style={{ color: "#4b5563" }}>{f.fonteGeradora ?? "—"}</td>
                            {i === 0 && (
                              <>
                                <td rowSpan={s.fatores.length}>
                                  <Lista itens={s.medidas} vazio="Não informado" />
                                </td>
                                <td rowSpan={s.fatores.length}>
                                  <Lista itens={s.agravos} vazio="Não informado" />
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ))
            )}
          </div>
        ))
      )}
    </Documento>
  );
}

// ─── AEP (fatores psicossociais na matriz AIHA) ──────────────────────────────

const STATUS_AEP: Record<string, string> = { RASCUNHO: "Rascunho", EM_ANDAMENTO: "Em andamento", CONCLUIDO: "Concluída" };

function SeloAiha({ nivel }: { nivel: string | null }) {
  if (!nivel) {
    return (
      <span className="selo" style={{ borderColor: "#d1d5db", borderStyle: "dashed", color: "#6b7280", fontWeight: 400 }}>
        Não calculado
      </span>
    );
  }
  const c = COR_NIVEL_AIHA[nivel as keyof typeof COR_NIVEL_AIHA];
  return (
    <span className="selo" style={{ backgroundColor: c?.bg, color: c?.cor, borderColor: c?.borda }}>
      {nivel}
    </span>
  );
}

export interface AvaliacaoAepPdf extends AvaliacaoSinalizada {
  /** Leitura do DRPS/Questionário diante desta AEP (a mesma da tela). */
  questionario: LeituraQuestionario;
}

export function AepPsicossocialEmpresaTemplate({ avaliacoes, ...comum }: Comum & { avaliacoes: AvaliacaoAepPdf[] }) {
  const bloco = (rotulo: string, valor: React.ReactNode, alerta = false, detalhe?: string | null) => (
    <div className={alerta ? "alerta" : undefined}>
      <div style={{ fontSize: 7.5, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".3px" }}>
        {rotulo}
      </div>
      <div style={{ fontSize: 9.5, fontWeight: 700, color: alerta ? "#78350f" : "#111827" }}>{valor}</div>
      {detalhe ? <div style={{ fontSize: 8, color: "#4b5563" }}>{detalhe}</div> : null}
    </div>
  );
  return (
    <Documento>
      <Cabecalho
        {...comum}
        titulo="AEP — Fatores Psicossociais"
        subtitulo="Fatores psicossociais por setor nas triagens AEP — resultado na matriz AIHA."
      />
      {avaliacoes.length === 0 ? (
        <p className="meta">Esta empresa não tem fator psicossocial sinalizado em AEP entregue ao cliente.</p>
      ) : (
        avaliacoes.map((a) => (
          <div className="avaliacao" key={a.idRelatorio}>
            <div className="cab-av">
              <span className="tag" style={{ background: "#f59e0b", color: "#fff" }}>
                AEP
              </span>
              <h2>Análise Ergonômica Preliminar</h2>
              <SeloAiha nivel={piorNivel(a.setores.map((s) => s.pior))} />
            </div>
            <div className="blocos-aep">
              {bloco("Entregue ao cliente", a.data ? dataBR(a.data) : (STATUS_AEP[a.status] ?? a.status))}
              {bloco("Inspeção", a.idInspecao ?? "Sem inspeção")}
              {bloco("Realizada por", a.responsavel ?? "—")}
              {bloco("Enviada por", a.idInspecao ? (a.enviadoPor ?? "—") : "Sem inspeção")}
              {bloco("DRPS/Questionário", a.questionario.rotulo, a.questionario.pendente, a.questionario.detalhe)}
              {bloco("AET", a.precisaAet ? "Necessária" : "Não", a.precisaAet)}
            </div>
            {a.setores.map((s) => {
              const c = s.pior ? COR_NIVEL_AIHA[s.pior as keyof typeof COR_NIVEL_AIHA] : undefined;
              return (
                <div className="setor" key={s.id}>
                  <div className="cab-setor">
                    <h3>{s.nome}</h3>
                    <span
                      className="selo"
                      style={{
                        backgroundColor: c?.bg ?? "#f9fafb",
                        color: c?.cor ?? "#4b5563",
                        borderColor: c?.borda ?? "#e5e7eb",
                      }}
                    >
                      {s.fatores.length} fator{s.fatores.length !== 1 ? "es" : ""} · maior nível {s.pior ?? "—"}
                    </span>
                  </div>
                  <table>
                    <colgroup>
                      <col style={{ width: "24%" }} />
                      <col style={{ width: "13%" }} />
                      <col style={{ width: "15%" }} />
                      <col style={{ width: "14%" }} />
                      <col style={{ width: "34%" }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>Fator de risco</th>
                        <th>Resultado final</th>
                        <th>Probabilidade</th>
                        <th>Severidade</th>
                        <th>Sinais observados</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.fatores.map((f) => (
                        <tr key={f.key}>
                          <td>
                            {f.label}
                            {f.observacao ? <div className="obs">Obs.: {f.observacao}</div> : null}
                          </td>
                          <td>
                            <SeloAiha nivel={f.nivel} />
                          </td>
                          <td>{f.probabilidade ?? "—"}</td>
                          <td>{f.severidade ?? "—"}</td>
                          <td>
                            <Lista itens={f.sinais} vazio="Nenhum sinal marcado" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        ))
      )}
    </Documento>
  );
}
