import React from "react";
import FolhaAssinaturas from "@/components/pdf/FolhaAssinaturas";
import type { Signatario } from "@/components/pdf/FolhaAssinaturas";
import { SecaoIdentificacaoEmpresa } from "@/components/pdf/SecoesComuns";
import type { Empresa, QpsMonitoramento, QpsPlanoMedidas, QpsRevisao } from "@/lib/supabase/types";
import type { TextoPadraoCapitulo } from "@/lib/textos-padrao/types";
import { substituirVariaveisTexto } from "@/lib/textos-padrao/variaveis";
import { renderEditaveis, renderEditavelUm, classeQuebraFixoNova } from "./shared";
import { MEDIDAS_CONTROLE, MESES } from "@/lib/drps/topicos";
import { acoesObrigatoriasQps, EQUIPE_REVISAO, INSTRUMENTO_QPS, type InstrumentoQps } from "@/lib/qps/gestao";
import {
  ancoraCapitulo,
  linhasPlanoComConteudo,
  marcarTabelasLargas,
  paragrafosDoTexto,
  type DadosLaudoQps,
  type BlocoSetorLaudo,
  type PlanoAcaoLinhaLaudo,
} from "@/lib/qps/laudo";
import { formatCNPJ, formatCPF, formatCEI, formatCAEPF, formatCNO } from "@/lib/utils";

/**
 * Laudo da QAP — "igual ao DRPS" (v226). Estrutura, classes e quebras copiadas
 * de `DrpsTemplate.tsx`; o que muda é a fonte do dado: `lib/qps/laudo.ts`
 * (blocos por setor com a régua do DRPS aplicada às categorias do
 * questionário). Renderizado no servidor pelo Puppeteer (rota /api/pdf/qps)
 * E no navegador como prévia da tela Laudo — por isso não usa hook nenhum.
 */

export interface QpsTemplateProps {
  laudo: DadosLaudoQps;
  empresa: Partial<Empresa> | null;
  planoMedidas: QpsPlanoMedidas | null;
  monitoramentos: QpsMonitoramento[];
  revisao: QpsRevisao | null;
  anoMedidas: number;
  capitulos: TextoPadraoCapitulo[];
  valores: Record<string, string>;
  signatarios: Signatario[];
  folhaEmpresa: { razaoSocial: string; cnpj: string } | null;
  dataHoraAssinatura: string;
  identificadorDocumento: string;
  planoAcao: PlanoAcaoLinhaLaudo[];
  instrumento?: InstrumentoQps;
  /**
   * v263 — página de cada capítulo (âncora → número do rodapé), medida pela
   * rota numa 1ª geração do PDF. Ausente (prévia da tela, 1ª passada) o
   * Sumário sai sem a coluna de página.
   */
  paginasSumario?: Record<string, number>;
}

const STYLE_BLOCK = `
@page { size: A4 portrait; }
@page paisagem { size: A4 landscape; }
.drps-cap-paisagem { page: paisagem; break-before: page; }
* { box-sizing: border-box; }
.drps-tabela { border-collapse: collapse; width: 100%; font-size: 11px; margin-bottom: 0; }
.drps-tabela td, .drps-tabela th { border: 1px solid #cbd5e1; padding: 6px 9px; vertical-align: top; }
.drps-label { background: #f0f9f4; font-weight: 600; color: #1e4d28; font-size: 10.5px; width: 30%; }
.drps-header-section { background: #d4edda; color: #1e4d28; font-weight: 700; text-align: center; font-size: 11.5px; letter-spacing: 0.06em; text-transform: uppercase; padding: 7px 9px; }
.drps-title { background: #0ea5e9; color: white; font-weight: 700; font-size: 13px; text-align: center; letter-spacing: 0.06em; text-transform: uppercase; padding: 9px 11px; }
/* v263 — o setor segue na mesma folha quando cabe (antes: 1 setor por folha,
   com meia página em branco). O que não pode é abrir no pé da folha: o topo
   (identificação + classificação) e cada quadro (agravos, medidas, conclusão)
   são indivisíveis — se não cabem, vão inteiros para a próxima. */
.drps-setor-bloco { margin-top: 22px; }
.drps-setor-bloco:first-of-type { margin-top: 0; }
.qps-setor-topo { break-inside: avoid; page-break-inside: avoid; }
.qps-setor-topo + .qps-setor-topo > table:first-child { margin-top: -1px; }
.qps-quadro { margin-top: 8px; border: 1px solid #cbd5e1; break-inside: avoid; page-break-inside: avoid; }
.qps-quadro-titulo { background: #d4edda; color: #1e4d28; font-weight: 700; text-align: center; font-size: 11.5px; letter-spacing: 0.06em; text-transform: uppercase; padding: 7px 9px; }
.qps-quadro-corpo { padding: 8px 10px; }
div.qps-paragrafos p { font-size: 11.5px; line-height: 1.55; text-align: justify; text-indent: 0; color: #1f2937; margin: 0 0 6px; }
div.qps-paragrafos p:last-child { margin-bottom: 0; }
/* Na Conclusão Consolidada (dentro de .drps-sec, que é Times 12pt) a tabela e os
   quadros ficam iguais aos dos setores. */
.drps-sec .qps-setor-topo, .drps-sec .qps-quadro { font-family: Inter, Arial, Helvetica, sans-serif; }
.drps-badge { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 10px; font-weight: 700; color: #fff; }
.drps-conc { font-size: 11.5px; line-height: 1.55; color: #1f2937; }
.drps-conc p { text-align: justify; margin: 0 0 6px; orphans: 3; widows: 3; }
.drps-conc p:last-child { margin-bottom: 0; }
.drps-conc table { border-collapse: collapse; width: 100% !important; min-width: 0 !important; margin: 6px 0; font-size: 10px; table-layout: fixed; }
.drps-conc th, .drps-conc td { border: 1px solid #999; padding: 4px 6px; vertical-align: top; text-align: left; overflow-wrap: break-word; word-break: normal; }
.drps-conc th { background: #d4edda; color: #1e4d28; font-weight: 700; }
.drps-conc td p, .drps-conc th p { text-align: left; margin: 0 0 3pt; line-height: 1.35; }
.drps-conc colgroup col { width: auto !important; }
.drps-conc ul { margin: 0; padding-left: 1.1em; }
.drps-conc li { margin: 1px 0; }
.drps-conc img { max-width: 100%; height: auto; }
/* Tabela larga colada na conclusão vai para a folha deitada (marcarTabelasLargas). */
.qps-tabela-paisagem { page: paisagem; }
/* div.… vence .drps-conc-geral table (declarada depois, mesma força). 9pt: com
   8 colunas iguais na folha deitada, "dimensionamento" em negrito cabe inteira. */
div.qps-tabela-paisagem table { margin-top: 0; font-size: 9pt; }
div.qps-tabela-paisagem th, div.qps-tabela-paisagem td { padding: 3pt 4pt; }
div.qps-tabela-paisagem td p, div.qps-tabela-paisagem th p { font-size: 9pt; }
/* Sumário com a página de cada capítulo. */
.qps-sumario { width: 100%; border-collapse: collapse; font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #374151; }
.qps-sumario td { padding: 4px 0; border-bottom: 1px dotted #D1D5DB; vertical-align: baseline; }
.qps-sumario td.num { width: 26px; font-weight: 700; color: #0ea5e9; }
.qps-sumario td.pag { width: 40px; text-align: right; font-weight: 700; color: #0ea5e9; }
.qps-sumario a { color: inherit; text-decoration: none; }
.textos-padrao-capitulo--nova-pagina { page-break-before: always; }
.textos-padrao-capitulo--continua { page-break-before: auto; }
.tp-cap { margin-bottom: 16pt; }
.tp-cap h2 { font-size: 13pt; font-weight: 700; color: #1e4d28; border-bottom: 2px solid #0ea5e9; padding-bottom: 3px; margin: 0 0 8pt; }
/* v263 — título de capítulo nunca fica sozinho no pé da folha ("3. Objetivo"
   saía na última linha e o texto na página seguinte — no DRPS também). */
.tp-cap h2, .drps-sec h2, .drps-sec h3 { break-after: avoid; page-break-after: avoid; }
.tp-cap .corpo > :first-child { break-before: avoid; }
.tp-cap .corpo p, .drps-sec p { orphans: 3; widows: 3; }
.tp-cap .corpo { font-size: 11pt; color: #1f2937; line-height: 1.5; text-align: justify; }
.tp-cap .corpo p { margin: 0 0 8pt; }
.tp-cap .corpo table { border-collapse: collapse; width: 100%; margin: 8pt 0; font-size: 10pt; }
.tp-cap .corpo th, .tp-cap .corpo td { border: 1px solid #999; padding: 4px 6px; }
.tp-cap .corpo th { background: #d4edda; color: #1e4d28; }
.tp-capa { page: capa; position: relative; width: 210mm; height: 297mm; overflow: hidden; page-break-after: always; }
.tp-capa img.bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center; display: block; z-index: 0; }
.tp-capa .caixa { position: absolute; z-index: 1; white-space: pre-wrap; line-height: 1.3; }
.drps-sec { font-family: 'Times New Roman', Times, serif; }
.drps-sec h2 { font-size: 16pt; font-weight: 700; color: #1e4d28; border-bottom: 2px solid #0ea5e9; padding-bottom: 6px; margin: 0 0 14pt; text-transform: uppercase; letter-spacing: .05em; }
.drps-sec h3 { font-size: 13pt; font-weight: 700; color: #1e4d28; margin: 14pt 0 6pt; }
.drps-sec p { font-size: 12pt; line-height: 1.6; text-align: justify; color: #1f2937; margin: 0 0 12pt; }
.drps-ex-table { width: 100%; border-collapse: collapse; font-size: 10pt; margin: 8pt 0 14pt; }
.drps-ex-table th, .drps-ex-table td { border: 1px solid #b5b5b5; padding: 4pt 6pt; vertical-align: top; }
.drps-ex-table th { background: #d4edda; color: #1e4d28; font-weight: 700; text-align: left; }
.drps-ex-table td.mes { text-align: center; font-weight: 700; color: #0ea5e9; }
.drps-ex-table tr { break-inside: avoid; page-break-inside: avoid; }
.drps-ex-table thead { display: table-header-group; }
.drps-ex-list { margin: 6pt 0 12pt 1.5em; padding: 0; font-size: 11pt; line-height: 1.6; }
.drps-ex-list li { margin: 3pt 0; }
.drps-conc-geral p { font-size: 12pt; line-height: 1.6; text-align: justify; color: #1f2937; margin: 0 0 12pt; text-indent: 1.25cm; }
.drps-conc-geral ul, .drps-conc-geral ol { margin: 0 0 12pt 1.5em; font-size: 12pt; line-height: 1.6; }
/* v263 — as palavras partiam em qualquer letra ("enfrentam|ento",
   "Psicossocia|l"): era o overflow-wrap:anywhere com 8 colunas espremidas em pé.
   Agora a palavra só parte se sozinha for maior que a coluna (break-word), e a
   tabela de 5+ colunas vai para a folha deitada (marcarTabelasLargas).
   O layout continua FIXED de propósito: com "auto" a largura mínima da tabela
   deitada (8 colunas) passava a da folha em pé e o Chromium recalculava o
   documento inteiro — as páginas em pé saíam cortadas na margem direita. */
.drps-conc-geral table { border-collapse: collapse; width: 100% !important; min-width: 0 !important; table-layout: fixed; margin: 10pt 0; font-size: 10pt; }
.drps-conc-geral th, .drps-conc-geral td { border: 1px solid #999; padding: 4px 6px; vertical-align: top; text-align: left; overflow-wrap: break-word; word-break: normal; }
.drps-conc-geral th { background: #d4edda; color: #1e4d28; font-weight: 700; }
.drps-conc-geral td p, .drps-conc-geral th p { text-indent: 0; text-align: left; margin: 0 0 3pt; line-height: 1.35; }
.drps-conc-geral td p:last-child, .drps-conc-geral th p:last-child { margin-bottom: 0; }
.drps-conc-geral td ul, .drps-conc-geral td ol { margin: 0 0 0 1.1em; font-size: 10pt; }
.drps-conc-geral tr, .drps-conc-geral thead { break-inside: avoid; page-break-inside: avoid; }
.drps-conc-geral thead { display: table-header-group; }
.drps-conc-geral colgroup col { width: auto !important; }
.drps-conc-geral img { max-width: 100%; height: auto; }
`;

function fmtData(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso + (iso.includes("T") ? "" : "T00:00")).toLocaleDateString("pt-BR");
  } catch {
    return "—";
  }
}

function identificadoresDaEmpresa(empresa: QpsTemplateProps["empresa"]) {
  const ids: { label: string; valor: string }[] = [];
  if (empresa?.cnpj) ids.push({ label: "CNPJ", valor: formatCNPJ(empresa.cnpj) });
  if (empresa?.cpf) ids.push({ label: "CPF", valor: formatCPF(empresa.cpf) });
  if (empresa?.cei) ids.push({ label: "CEI", valor: formatCEI(empresa.cei) });
  if (empresa?.caepf) ids.push({ label: "CAEPF", valor: formatCAEPF(empresa.caepf) });
  if (empresa?.cno) ids.push({ label: "CNO", valor: formatCNO(empresa.cno) });
  if (ids.length === 0) ids.push({ label: "CNPJ", valor: "—" });
  return ids;
}

/** Tabela "Classificação de Risco Psicossocial" de um bloco (setor ou consolidado). */
function TabelaClassificacao({ bloco }: { bloco: BlocoSetorLaudo }) {
  const comBase = bloco.categorias.filter((c) => !c.semBase);
  return (
    <>
      <table className="drps-tabela">
        <thead>
          <tr>
            <th className="drps-label" style={{ width: "30%", textAlign: "left" }}>Fatores de Risco</th>
            <th className="drps-label" style={{ width: "35%", textAlign: "left" }}>Fontes Geradoras do Risco</th>
            <th className="drps-label" style={{ width: "11%", textAlign: "center" }}>Gravidade</th>
            <th className="drps-label" style={{ width: "12%", textAlign: "center" }}>Probabilidade</th>
            <th className="drps-label" style={{ width: "12%", textAlign: "center" }}>Matriz de Risco</th>
          </tr>
        </thead>
        <tbody>
          {bloco.categorias.map((c) => (
            <tr key={c.id_categoria}>
              <td>{c.nome}</td>
              <td style={{ fontSize: "10px", color: "#374151" }}>{c.fonteGeradora ?? ""}</td>
              <td style={{ textAlign: "center" }}>
                {c.gravidade ? (
                  <span className="drps-badge" style={{ backgroundColor: c.gravidade.cor }}>{c.gravidade.texto}</span>
                ) : (
                  <span style={{ fontSize: "9px", color: "#9ca3af" }}>sem resposta</span>
                )}
              </td>
              <td style={{ textAlign: "center", fontSize: "10px" }}>{c.classificacaoProbabilidade}</td>
              <td style={{ textAlign: "center" }}>
                {c.matriz ? (
                  <span className="drps-badge" style={{ backgroundColor: c.corMatriz ?? undefined }}>{c.matriz}</span>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 6, fontSize: "9px", color: "#6b7280" }}>
        {bloco.totalRespondentes} respondente(s) · {bloco.categorias.length} categoria(s) · {comBase.length} com resposta
      </div>
    </>
  );
}

function BlocoSetor({
  bloco,
  laudo,
  empresa,
  instrumento,
  abertura,
}: {
  bloco: BlocoSetorLaudo;
  laudo: DadosLaudoQps;
  empresa: QpsTemplateProps["empresa"];
  instrumento: InstrumentoQps;
  /** Título "Análise por Setor" — vai grudado no 1º setor para não ficar sozinho no pé da folha. */
  abertura?: React.ReactNode;
}) {
  const ap = laudo.aplicacao;
  const ids = identificadoresDaEmpresa(empresa);
  return (
    <section className="drps-setor-bloco">
      <div className="qps-setor-topo">
      {abertura}
      <table className="drps-tabela">
        <tbody>
          <tr>
            <td className="drps-title" colSpan={4}>
              {instrumento.sigla} — {instrumento.nome}
            </td>
          </tr>
          <tr>
            <td className="drps-label" style={{ width: "30%" }}>Responsável Técnico pela Avaliação (Psicólogo)</td>
            <td>{ap.responsavel ?? ""}</td>
            <td className="drps-label" style={{ width: "10%" }}>CRP</td>
            <td style={{ width: "20%" }}>{ap.crp ?? ""}</td>
          </tr>
          <tr><td className="drps-header-section" colSpan={4}>IDENTIFICAÇÃO</td></tr>
          <tr>
            <td className="drps-label">{ids[0].label}</td>
            <td>{ids[0].valor}</td>
            <td className="drps-label">Data da Elaboração</td>
            <td>{fmtData(ap.data_elaboracao)}</td>
          </tr>
          {ids.slice(1).map((id) => (
            <tr key={id.label}>
              <td className="drps-label">{id.label}</td>
              <td colSpan={3}>{id.valor}</td>
            </tr>
          ))}
          <tr><td className="drps-label">Empresa</td><td colSpan={3}>{empresa?.nome_empresa ?? "—"}</td></tr>
          {ap.unidade_cliente && (
            <tr><td className="drps-label">Unidade / Filial</td><td colSpan={3}>{ap.unidade_cliente}</td></tr>
          )}
          <tr><td className="drps-label">Setor</td><td colSpan={3}>{bloco.ehConsolidado ? "Todos os setores (consolidado)" : bloco.setor}</td></tr>
          <tr><td className="drps-label">Funções</td><td colSpan={3}>{bloco.cargos || "—"}</td></tr>
          <tr><td className="drps-label">Quantidade de Trabalhadores Respondentes</td><td colSpan={3}>{bloco.totalRespondentes}</td></tr>
        </tbody>
      </table>
      </div>

      {/* A classificação é um bloco próprio: o setor pode começar no fim de uma
          folha (identificação) e a tabela seguir inteira na próxima. */}
      <div className="qps-setor-topo">
        <table className="drps-tabela">
          <tbody>
            <tr><td className="drps-header-section">Classificação de Risco Psicossocial</td></tr>
          </tbody>
        </table>
        <TabelaClassificacao bloco={bloco} />
      </div>

      <QuadroParagrafos titulo="Possíveis Agravos à Saúde Mental" texto={bloco.agravos} />
      <QuadroParagrafos
        titulo="Medidas de controle recomendadas (medidas que a empresa deve adotar)"
        texto={bloco.medidas}
      />

      <div className="qps-quadro">
        <div className="qps-quadro-titulo">Conclusão</div>
        <div
          className="qps-quadro-corpo drps-conc"
          dangerouslySetInnerHTML={{
            __html: bloco.conclusao
              ? marcarTabelasLargas(bloco.conclusao)
              : "<em style=\"color:#9ca3af\">(Conclusão não preenchida)</em>",
          }}
        />
      </div>
    </section>
  );
}

/** Agravos / medidas: um parágrafo por item selecionado na Análise (v263). */
function QuadroParagrafos({ titulo, texto }: { titulo: string; texto: string | null }) {
  const paragrafos = paragrafosDoTexto(texto);
  return (
    <div className="qps-quadro">
      <div className="qps-quadro-titulo">{titulo}</div>
      <div className="qps-quadro-corpo qps-paragrafos">
        {paragrafos.length > 0 ? (
          paragrafos.map((p, i) => <p key={i}>{p}</p>)
        ) : (
          <p style={{ color: "#9ca3af", fontStyle: "italic" }}>(Não preenchido)</p>
        )}
      </div>
    </div>
  );
}

/** Sumário do QPS: número, título (link para o capítulo) e a página (v263). */
function SumarioQps({
  itens,
  paginas,
}: {
  itens: { titulo: string; ancora: string }[];
  paginas?: Record<string, number>;
}) {
  if (itens.length === 0) return null;
  // A coluna da página existe sempre (vazia na 1ª passada): assim nenhuma linha
  // do Sumário muda de altura entre as duas gerações e as páginas medidas valem.
  return (
    <section style={{ marginBottom: 18, fontFamily: "Arial, Helvetica, sans-serif" }}>
      <h2
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: "#0ea5e9",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          borderBottom: "2px solid #0ea5e9",
          paddingBottom: 6,
          marginBottom: 12,
        }}
      >
        Sumário
      </h2>
      <table className="qps-sumario">
        <tbody>
          {itens.map((it, i) => (
            <tr key={it.ancora}>
              <td className="num">{i + 1}.</td>
              <td><a href={`#${it.ancora}`}>{it.titulo}</a></td>
              <td className="pag">{paginas?.[it.ancora] ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default function QpsTemplate({
  laudo,
  empresa,
  planoMedidas,
  monitoramentos,
  revisao,
  anoMedidas,
  capitulos,
  valores,
  signatarios,
  folhaEmpresa,
  dataHoraAssinatura,
  identificadorDocumento,
  planoAcao,
  instrumento = INSTRUMENTO_QPS,
  paginasSumario,
}: QpsTemplateProps) {
  const { blocos, consolidado } = laudo;

  const planoEntries = planoMedidas?.plano ? Object.entries(planoMedidas.plano) : [];
  const planoComConteudo = planoEntries.filter(
    ([, p]) => p.meses.some((m) => m) || (p.responsavel ?? "").trim().length > 0,
  );
  const planoAcaoComConteudo = linhasPlanoComConteudo(planoAcao);
  const checklist = revisao?.checklist ?? {};
  const equipe = revisao?.equipe ?? {};
  const anotacoes = revisao?.anotacoes ?? "";
  const acoesObrigatorias = acoesObrigatoriasQps(instrumento);
  // A conclusão consolidada só vira capítulo se o psicólogo a escreveu na tela
  // Análise ("Todos os setores"); a tabela do consolidado vai junto.
  const temConclusaoConsolidada = !!consolidado?.conclusao;

  // Um capítulo só entra no Sumário e na numeração se renderiza uma SEÇÃO
  // NUMERADA de fato no corpo (mesma regra do DRPS).
  function renderizaNumerado(c: TextoPadraoCapitulo): boolean {
    if (c.ativo === false) return false;
    const ehCapa = !!c.bg_imagem_url || (c.titulo ?? "").trim().toLowerCase() === "capa";
    if (ehCapa) return false;
    if (c.tipo !== "fixo") return true;
    switch (c.slug_fixo) {
      case "identificacao_empresa": return true;
      case "qps_caracterizacao":    return blocos.length > 0;
      case "qps_analise_setor":     return blocos.length > 0;
      case "qps_conclusao":         return temConclusaoConsolidada;
      case "qps_plano_medidas":     return planoComConteudo.length > 0;
      case "qps_plano_acao_5w2h":   return planoAcaoComConteudo.length > 0;
      // Monitoramento imprime só depois de alguém preencher uma linha: sem isso
      // eram ~6 páginas de "Pendente / —" (11 setores × 12 categorias na FLOC).
      case "qps_revisao":           return monitoramentos.length > 0 || !!revisao;
      case "qps_assinatura":        return true;
      default:                      return false; // sumário
    }
  }

  const numPorSlug: Record<string, number> = {};
  const numPorId: Record<string, number> = {};
  {
    const ordenadosNum = [...capitulos]
      .filter((c) => c.ativo !== false)
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
    let nSeq = 0;
    for (const c of ordenadosNum) {
      if (!renderizaNumerado(c)) continue;
      nSeq += 1;
      if (c.tipo === "fixo" && c.slug_fixo) numPorSlug[c.slug_fixo] = nSeq;
      numPorId[c.id_capitulo] = nSeq;
    }
  }
  const numLabel = (num: number | undefined, txt: string) => (num ? `${num}. ${txt}` : txt);

  const aberturaAnalise = (
    <div className="drps-sec">
      <h2>{numLabel(numPorSlug["qps_analise_setor"], "Análise por Setor")}</h2>
      <p style={{ textIndent: "1.25cm" }}>
        Classificação dos fatores de risco psicossocial por setor avaliado, com gravidade
        (calculada a partir das respostas), probabilidade e matriz de risco conforme a NR-01.
      </p>
    </div>
  );
  const setoresNode = blocos.map((b, i) => (
    <BlocoSetor
      key={b.setor}
      bloco={b}
      laudo={laudo}
      empresa={empresa}
      instrumento={instrumento}
      abertura={i === 0 ? aberturaAnalise : undefined}
    />
  ));

  const conclusaoNode = temConclusaoConsolidada && consolidado ? (
    <section className="drps-sec">
      <h2>{numLabel(numPorSlug["qps_conclusao"], "Conclusão Técnica Consolidada")}</h2>
      <p style={{ textIndent: "1.25cm" }}>
        Classificação consolidada de todos os respondentes ({consolidado.totalRespondentes}), com a
        conclusão técnica do responsável.
      </p>
      <div className="qps-setor-topo">
        <TabelaClassificacao bloco={consolidado} />
      </div>
      {consolidado.agravos && <QuadroParagrafos titulo="Possíveis Agravos à Saúde Mental" texto={consolidado.agravos} />}
      {consolidado.medidas && <QuadroParagrafos titulo="Medidas de controle recomendadas" texto={consolidado.medidas} />}
      <div
        className="drps-conc-geral"
        style={{ marginTop: 10 }}
        dangerouslySetInnerHTML={{ __html: marcarTabelasLargas(consolidado.conclusao) }}
      />
    </section>
  ) : null;

  const caracterizacaoNode = blocos.length > 0 ? (
    <section className="drps-sec">
      <h2>{numLabel(numPorSlug["qps_caracterizacao"], "Caracterização dos Trabalhadores")}</h2>
      <p style={{ textIndent: "1.25cm" }}>
        Distribuição quantitativa dos trabalhadores avaliados por setor e função, conforme os
        respondentes da aplicação ({instrumento.sigla} — {instrumento.nome}).
      </p>
      <table className="drps-ex-table">
        <thead>
          <tr>
            <th style={{ width: "32%" }}>Setor</th>
            <th>Funções</th>
            <th style={{ width: "16%", textAlign: "center" }}>Trabalhadores</th>
          </tr>
        </thead>
        <tbody>
          {blocos.map((b) => (
            <tr key={b.setor}>
              <td>{b.setor}</td>
              <td>{b.cargos || "—"}</td>
              <td style={{ textAlign: "center" }}>{b.totalRespondentes}</td>
            </tr>
          ))}
          <tr>
            <td style={{ fontWeight: 700 }}>Total</td>
            <td />
            <td style={{ textAlign: "center", fontWeight: 700 }}>{laudo.totalRespondentes}</td>
          </tr>
        </tbody>
      </table>
      {laudo.aplicacao.trabalhadores_previstos ? (
        <p style={{ fontSize: "10pt", fontStyle: "italic", textIndent: 0 }}>
          Trabalhadores previstos: {laudo.aplicacao.trabalhadores_previstos} — participação de{" "}
          {Math.round((laudo.totalRespondentes / laudo.aplicacao.trabalhadores_previstos) * 100)}%.
        </p>
      ) : null}
    </section>
  ) : null;

  const medidasNode = planoComConteudo.length > 0 ? (
    <section className="drps-sec">
      <h2>{numLabel(numPorSlug["qps_plano_medidas"], `Medidas de Controle — Plano Anual ${anoMedidas}`)}</h2>
      <p style={{ textIndent: "1.25cm" }}>
        Cronograma das ações de controle dos riscos psicossociais identificados, com indicação dos meses de execução e responsáveis.
      </p>
      <table className="drps-ex-table">
        <thead>
          <tr>
            <th style={{ width: "44%" }}>Ação</th>
            <th style={{ width: "20%" }}>Responsável</th>
            {MESES.map((m) => <th key={m} style={{ textAlign: "center", padding: "4pt 2pt" }}>{m.slice(0, 3)}</th>)}
          </tr>
        </thead>
        <tbody>
          {planoComConteudo.map(([acao, p]) => (
            <tr key={acao}>
              <td>{acao}</td>
              <td>{p.responsavel || "—"}</td>
              {p.meses.map((marcado, idx) => <td key={idx} className="mes">{marcado ? "✓" : ""}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: "10pt", fontStyle: "italic", textIndent: 0 }}>
        Total de ações catalogadas: {MEDIDAS_CONTROLE.length}. Foram cronogramadas {planoComConteudo.length} ação(ões) para este período.
      </p>
    </section>
  ) : null;

  const monitNode = blocos.length > 0 && monitoramentos.length > 0 ? (
    <section className="drps-sec">
      <h2>{numLabel(numPorSlug["qps_revisao"], "Monitoramento do Desempenho")}</h2>
      <p style={{ textIndent: "1.25cm" }}>
        Acompanhamento das intervenções por categoria psicossocial, por setor, com status de execução e data da próxima reavaliação.
      </p>
      {blocos.map((b) => (
        <div key={b.setor}>
          <h3>Setor: {b.setor}</h3>
          <table className="drps-ex-table">
            <thead>
              <tr>
                <th style={{ width: "32%" }}>Categoria</th>
                <th style={{ width: "10%" }}>Matriz</th>
                <th>Responsável</th>
                <th>Status</th>
                <th>Data interv.</th>
                <th>Próxima reaval.</th>
              </tr>
            </thead>
            <tbody>
              {b.categorias.map((c) => {
                const mon = monitoramentos.find((m) => m.setor === b.setor && m.id_categoria === c.id_categoria);
                return (
                  <tr key={c.id_categoria}>
                    <td>{c.nome}</td>
                    <td>
                      {c.matriz ? (
                        <span className="drps-badge" style={{ backgroundColor: c.corMatriz ?? undefined }}>{c.matriz}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{mon?.responsavel || "—"}</td>
                    <td>{mon?.status || "Pendente"}</td>
                    <td>{fmtData(mon?.data_intervencao ?? null)}</td>
                    <td>{fmtData(mon?.proxima_avaliacao ?? null)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </section>
  ) : null;

  const STATUS_PLANO: Record<string, string> = { PENDENTE: "Pendente", EM_ANDAMENTO: "Em andamento", CONCLUIDA: "Concluída" };
  // O 5W2H tem 8 colunas: sai sempre na folha deitada, sem depender da
  // orientação marcada no Texto Padrão (em pé o texto empilhava).
  const planoAcaoNode = planoAcaoComConteudo.length > 0 ? (
    <section className="drps-sec drps-cap-paisagem">
      <h2>{numLabel(numPorSlug["qps_plano_acao_5w2h"], "Plano de Ação 5W2H")}</h2>
      <p style={{ textIndent: "1.25cm" }}>
        Ações de gerenciamento dos riscos psicossociais no formato 5W2H — o quê, por quê, onde, quando,
        quem, como e quanto custa — com status de execução.
      </p>
      <table className="drps-ex-table">
        <thead>
          <tr>
            <th style={{ width: "16%" }}>O quê (ação)</th>
            <th style={{ width: "15%" }}>Por quê</th>
            <th style={{ width: "12%" }}>Onde</th>
            <th style={{ width: "9%" }}>Quando</th>
            <th style={{ width: "11%" }}>Quem</th>
            <th style={{ width: "16%" }}>Como</th>
            <th style={{ width: "11%" }}>Quanto custa</th>
            <th style={{ width: "10%", textAlign: "center" }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {planoAcaoComConteudo.map((l, i) => (
            <tr key={i}>
              <td>{l.acao || "—"}</td>
              <td>{l.justificativa || "—"}</td>
              <td>{l.onde || "—"}</td>
              <td>{l.prazo || "—"}</td>
              <td>{l.responsavel || "—"}</td>
              <td>{l.como || "—"}</td>
              <td>{l.quanto_custa || "—"}</td>
              <td style={{ textAlign: "center" }}>{STATUS_PLANO[l.status] ?? l.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  ) : null;

  const revisaoNode = revisao ? (
    <section className="drps-sec">
      {/* Sem monitoramento, é ela que abre o capítulo — e leva o número dele. */}
      <h2>{monitNode ? "Revisão e Melhoria Contínua" : numLabel(numPorSlug["qps_revisao"], "Revisão e Melhoria Contínua")}</h2>
      <p style={{ textIndent: "1.25cm" }}>
        Compromissos de gestão para manter o ciclo PDCA do programa de riscos psicossociais ativo, com equipe técnica designada e anotações da coordenação.
      </p>
      <h3>Ações de revisão obrigatórias</h3>
      <ul className="drps-ex-list">
        {acoesObrigatorias.map((a) => <li key={a.id}>{checklist[a.id] ? "☑" : "☐"} {a.texto}</li>)}
      </ul>
      <h3>Equipe técnica designada</h3>
      <ul className="drps-ex-list">
        {EQUIPE_REVISAO.map((e) => <li key={e.id}>{equipe[e.id] ? "☑" : "☐"} {e.texto}</li>)}
      </ul>
      {anotacoes && (
        <>
          <h3>Anotações da coordenação</h3>
          <p style={{ textIndent: 0, whiteSpace: "pre-wrap" }}>{anotacoes}</p>
        </>
      )}
    </section>
  ) : null;

  const blocosOrdenados = [...capitulos]
    .filter((c) => c.ativo !== false)
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

  // v263 — o Sumário mostra o título que a seção IMPRIME. Três seções do sistema
  // imprimem um título diferente do nome do capítulo no Texto Padrão (a Folha de
  // Assinaturas é componente comum a todos os laudos), e o Sumário dizia
  // "Assinatura Técnica" para uma página que diz "Folha de Assinaturas".
  const tituloNoCorpo: Record<string, string> = {
    qps_assinatura: "Folha de Assinaturas",
    qps_plano_medidas: `Medidas de Controle — Plano Anual ${anoMedidas}`,
    qps_revisao: monitNode ? "Monitoramento do Desempenho" : "Revisão e Melhoria Contínua",
  };
  const sumarioItens = blocosOrdenados
    .filter((c) => renderizaNumerado(c))
    .map((c) => ({
      titulo:
        c.tipo === "fixo"
          ? (tituloNoCorpo[c.slug_fixo ?? ""] ?? c.titulo)
          : substituirVariaveisTexto(c.titulo, valores),
      ancora: ancoraCapitulo(c.id_capitulo),
    }))
    .filter((it) => it.titulo && it.titulo.trim());

  const folhaNode = (
    <FolhaAssinaturas
      signatarios={signatarios}
      empresa={folhaEmpresa}
      dataHoraAssinatura={dataHoraAssinatura}
      identificadorDocumento={identificadorDocumento}
      quebraAntes={false}
      numero={numPorSlug["qps_assinatura"]}
    />
  );

  function renderSecao(slug: string): React.ReactNode {
    switch (slug) {
      case "identificacao_empresa": return <SecaoIdentificacaoEmpresa empresa={empresa} numero={numPorSlug["identificacao_empresa"]} />;
      case "sumario":               return <SumarioQps itens={sumarioItens} paginas={paginasSumario} />;
      case "qps_caracterizacao":    return caracterizacaoNode;
      // O título vai DENTRO do 1º setor (aberturaAnalise): solto, ele ficava
      // sozinho no pé da folha com o setor começando na seguinte.
      case "qps_analise_setor":     return <>{setoresNode}</>;
      case "qps_conclusao":         return conclusaoNode;
      case "qps_plano_acao_5w2h":   return planoAcaoNode;
      case "qps_plano_medidas":     return medidasNode;
      case "qps_revisao":           return monitNode || revisaoNode ? <>{monitNode}{revisaoNode}</> : null;
      case "qps_assinatura":        return folhaNode;
      default:                      return null;
    }
  }

  const temFixos = capitulos.some((c) => c.tipo === "fixo");
  const temAssinaturaFixo = capitulos.some(
    (c) => c.tipo === "fixo" && c.slug_fixo === "qps_assinatura" && c.ativo !== false,
  );

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLE_BLOCK }} />

      {temFixos ? (
        blocosOrdenados.map((c) => {
          if (c.tipo === "fixo") {
            // v263 — seção que não imprime nada (Plano de Medidas / Revisão sem
            // dado, Conclusão sem texto) NÃO deixa o invólucro: ele carrega a
            // quebra de página, e duas quebras seguidas davam a folha em branco
            // antes da Folha de Assinaturas.
            const secao = renderSecao(c.slug_fixo ?? "");
            if (secao == null) return null;
            return (
              <div
                key={c.id_capitulo}
                id={ancoraCapitulo(c.id_capitulo)}
                className={`${classeQuebraFixoNova(c)}${c.orientacao === "paisagem" ? " drps-cap-paisagem" : ""}`}
                data-slug={c.slug_fixo ?? undefined}
              >{secao}</div>
            );
          }
          return (
            <div key={c.id_capitulo} id={ancoraCapitulo(c.id_capitulo)}>
              {renderEditavelUm(
                numPorId[c.id_capitulo]
                  ? { ...c, titulo: `${numPorId[c.id_capitulo]}. ${c.titulo}` }
                  : c,
                valores,
              )}
            </div>
          );
        })
      ) : (
        <>
          {renderEditaveis(capitulos, valores, "inicio")}
          {renderEditaveis(capitulos, valores, "apos_sumario")}
          {caracterizacaoNode}
          {setoresNode}
          {renderEditaveis(capitulos, valores, "apos_setores")}
          {conclusaoNode}
          {renderEditaveis(capitulos, valores, "apos_conclusao")}
          {planoAcaoNode}
          {medidasNode}
          {monitNode}
          {revisaoNode}
          {renderEditaveis(capitulos, valores, "apos_medidas")}
          {renderEditaveis(capitulos, valores, "fim")}
        </>
      )}

      {!temAssinaturaFixo && (
        <FolhaAssinaturas
          signatarios={signatarios}
          empresa={folhaEmpresa}
          dataHoraAssinatura={dataHoraAssinatura}
          identificadorDocumento={identificadorDocumento}
        />
      )}
    </>
  );
}
