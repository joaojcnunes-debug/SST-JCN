import React from "react";
import FolhaAssinaturas from "@/components/pdf/FolhaAssinaturas";
import type { Signatario } from "@/components/pdf/FolhaAssinaturas";
import { SecaoIdentificacaoEmpresa, SecaoSumario } from "@/components/pdf/SecoesComuns";
import type { Empresa } from "@/lib/supabase/types";
import type { TextoPadraoCapitulo } from "@/lib/textos-padrao/types";
import { substituirVariaveisTexto } from "@/lib/textos-padrao/variaveis";
import { renderEditaveis, renderEditavelUm, classeQuebraFixo } from "./shared";
import {
  aplicarMatriz,
  calcularResumoCompleto,
  filtrarPorSetor,
  listarSetores,
} from "@/lib/drps/calculos";
import { MEDIDAS_CONTROLE, MESES, TOPICOS } from "@/lib/drps/topicos";
import { ACOES_OBRIGATORIAS, EQUIPE_REVISAO } from "@/lib/drps/gestao";
import { formatCNPJ, formatCPF, formatCEI, formatCAEPF, formatCNO } from "@/lib/utils";
import type {
  DrpsMonitoramento,
  DrpsPlanoMedidas,
  DrpsProbabilidade,
  DrpsRespondente,
  DrpsRevisao,
  NivelMatriz,
  TopicoComMatriz,
} from "@/lib/drps/types";

export interface PlanoAcaoLinha {
  ordem: number;
  acao: string | null;
  justificativa: string | null;
  onde: string | null;
  prazo: string | null;
  responsavel: string | null;
  como: string | null;
  quanto_custa: string | null;
  status: string;
}

export interface DrpsTemplateProps {
  relatorio: {
    revisao: number;
    responsavel_tecnico: string | null;
    crp: string | null;
    data_elaboracao: string | null;
    agravos_por_setor: Record<string, string> | null;
    medidas_por_setor: Record<string, string> | null;
    conclusoes_por_setor: Record<string, string> | null;
    conclusao_geral: string | null;
  };
  empresa: Partial<Empresa> | null;
  respondentes: DrpsRespondente[];
  probabilidades: DrpsProbabilidade[];
  planoMedidas: DrpsPlanoMedidas | null;
  monitoramentos: DrpsMonitoramento[];
  revisao: DrpsRevisao | null;
  anoMedidas: number;
  capitulos: TextoPadraoCapitulo[];
  valores: Record<string, string>;
  signatarios: Signatario[];
  folhaEmpresa: { razaoSocial: string; cnpj: string } | null;
  dataHoraAssinatura: string;
  identificadorDocumento: string;
  planoAcao: PlanoAcaoLinha[];
}

const STYLE_BLOCK = `
/* Orientação por capítulo (requer gerarPdf com preferCssPageSize:true). Só size
   aqui; a margem vem do option do Puppeteer (igual p/ retrato e paisagem). */
@page { size: A4 portrait; }
@page paisagem { size: A4 landscape; }
.drps-cap-paisagem { page: paisagem; break-before: page; }
* { box-sizing: border-box; }
.drps-tabela { border-collapse: collapse; width: 100%; font-size: 11px; margin-bottom: 0; }
.drps-tabela td, .drps-tabela th { border: 1px solid #cbd5e1; padding: 6px 9px; vertical-align: top; }
.drps-label { background: #f0f9f4; font-weight: 600; color: #1e4d28; font-size: 10.5px; width: 30%; }
.drps-header-section { background: #d4edda; color: #1e4d28; font-weight: 700; text-align: center; font-size: 11.5px; letter-spacing: 0.06em; text-transform: uppercase; padding: 7px 9px; }
.drps-title { background: #0ea5e9; color: white; font-weight: 700; font-size: 13px; text-align: center; letter-spacing: 0.06em; text-transform: uppercase; padding: 9px 11px; }
.drps-setor-bloco { margin-bottom: 22px; page-break-before: always; page-break-inside: auto; }
.drps-setor-bloco:first-of-type { page-break-before: auto; }
.drps-badge { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 10px; font-weight: 700; color: #fff; }
.drps-conc { font-size: 11px; line-height: 1.5; color: #1f2937; }
.drps-conc table { border-collapse: collapse; width: 100%; margin: 6px 0; font-size: 10px; table-layout: fixed; }
.drps-conc th, .drps-conc td { border: 1px solid #999; padding: 4px 6px; vertical-align: top; text-align: left; word-wrap: break-word; }
.drps-conc th { background: #d4edda; color: #1e4d28; font-weight: 700; }
.drps-conc ul { margin: 0; padding-left: 1.1em; }
.drps-conc li { margin: 1px 0; }
.textos-padrao-capitulo--nova-pagina { page-break-before: always; }
.textos-padrao-capitulo--continua { page-break-before: auto; }
.tp-cap { margin-bottom: 16pt; }
.tp-cap h2 { font-size: 13pt; font-weight: 700; color: #1e4d28; border-bottom: 2px solid #0ea5e9; padding-bottom: 3px; margin: 0 0 8pt; }
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
/* Tabelas coladas (Word/Excel/TipTap) na Conclusão Geral — sem estas regras as
   tabelas saíam sem bordas/largura no PDF (texto "vazando"). */
.drps-conc-geral table { border-collapse: collapse; width: 100%; table-layout: fixed; margin: 10pt 0; font-size: 10pt; }
.drps-conc-geral th, .drps-conc-geral td { border: 1px solid #999; padding: 4px 6px; vertical-align: top; text-align: left; word-wrap: break-word; overflow-wrap: anywhere; }
.drps-conc-geral th { background: #d4edda; color: #1e4d28; font-weight: 700; }
/* O TipTap embrulha o conteúdo da célula em <p>; sem isto eles herdam o
   justify + text-indent 1.25cm da Conclusão (texto com buracos e recuado). */
.drps-conc-geral td p, .drps-conc-geral th p { text-indent: 0; text-align: left; margin: 0 0 3pt; line-height: 1.35; }
.drps-conc-geral td p:last-child, .drps-conc-geral th p:last-child { margin-bottom: 0; }
.drps-conc-geral td ul, .drps-conc-geral td ol { margin: 0 0 0 1.1em; font-size: 10pt; }
.drps-conc-geral tr, .drps-conc-geral thead { break-inside: avoid; page-break-inside: avoid; }
.drps-conc-geral thead { display: table-header-group; }
/* TipTap resizable grava col widths em px que estouram a página; neutraliza p/ caber em 100%. */
.drps-conc-geral colgroup col { width: auto !important; }
`;

function corMatriz(m: NivelMatriz): string {
  if (m === "Crítico") return "#111827";
  if (m === "Alto") return "#dc2626";
  if (m === "Médio") return "#d97706";
  if (m === "Baixo") return "#16a34a";
  return "#6b7280";
}

function fmtData(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso + (iso.includes("T") ? "" : "T00:00")).toLocaleDateString("pt-BR");
  } catch {
    return "—";
  }
}

function montarMapaProb(probabilidades: DrpsProbabilidade[], setor: string): Record<number, 1 | 2 | 3> {
  const m: Record<number, 1 | 2 | 3> = {};
  for (let i = 0; i < TOPICOS.length; i++) m[i] = 1;
  for (const p of probabilidades) {
    if (p.setor === setor) m[p.topico_idx] = p.probabilidade as 1 | 2 | 3;
  }
  return m;
}

function BlocoSetor({
  setor,
  totalRespondentes,
  funcoes,
  topicos,
  rel,
  empresa,
}: {
  setor: string;
  totalRespondentes: number;
  funcoes: string;
  topicos: TopicoComMatriz[];
  rel: DrpsTemplateProps["relatorio"];
  empresa: DrpsTemplateProps["empresa"];
}) {
  const identificadores: { label: string; valor: string }[] = [];
  if (empresa?.cnpj) identificadores.push({ label: "CNPJ", valor: formatCNPJ(empresa.cnpj) });
  if (empresa?.cpf) identificadores.push({ label: "CPF", valor: formatCPF(empresa.cpf) });
  if (empresa?.cei) identificadores.push({ label: "CEI", valor: formatCEI(empresa.cei) });
  if (empresa?.caepf) identificadores.push({ label: "CAEPF", valor: formatCAEPF(empresa.caepf) });
  if (empresa?.cno) identificadores.push({ label: "CNO", valor: formatCNO(empresa.cno) });
  if (identificadores.length === 0) identificadores.push({ label: "CNPJ", valor: "—" });

  const conclusao = rel.conclusoes_por_setor?.[setor] ?? "";

  return (
    <section className="drps-setor-bloco">
      <table className="drps-tabela">
        <tbody>
          <tr>
            <td className="drps-title" colSpan={4}>
              DRPS — Diagnóstico de Riscos Psicossociais · Rev. {rel.revisao}
            </td>
          </tr>
          <tr>
            <td className="drps-label" style={{ width: "30%" }}>Responsável Técnico pela Avaliação (Psicólogo)</td>
            <td>{rel.responsavel_tecnico ?? ""}</td>
            <td className="drps-label" style={{ width: "10%" }}>CRP</td>
            <td style={{ width: "20%" }}>{rel.crp ?? ""}</td>
          </tr>
          <tr><td className="drps-header-section" colSpan={4}>IDENTIFICAÇÃO</td></tr>
          <tr>
            <td className="drps-label">{identificadores[0].label}</td>
            <td>{identificadores[0].valor}</td>
            <td className="drps-label">Data da Elaboração</td>
            <td>{fmtData(rel.data_elaboracao)}</td>
          </tr>
          {identificadores.slice(1).map((id) => (
            <tr key={id.label}>
              <td className="drps-label">{id.label}</td>
              <td colSpan={3}>{id.valor}</td>
            </tr>
          ))}
          <tr><td className="drps-label">Empresa</td><td colSpan={3}>{empresa?.nome_empresa ?? "—"}</td></tr>
          <tr><td className="drps-label">Setor</td><td colSpan={3}>{setor}</td></tr>
          <tr><td className="drps-label">Funções</td><td colSpan={3}>{funcoes || "—"}</td></tr>
          <tr><td className="drps-label">Quantidade de Trabalhadores na Função</td><td colSpan={3}>{totalRespondentes}</td></tr>
          <tr><td className="drps-header-section" colSpan={4}>Classificação de Risco Psicossocial</td></tr>
        </tbody>
      </table>

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
          {topicos.map((t) => (
            <tr key={t.idx}>
              <td>{t.nome.replace(/^Tópico \d+ - /, "")}</td>
              <td style={{ fontSize: "10px", color: "#374151" }}>{t.fonteGeradora}</td>
              <td style={{ textAlign: "center" }}>
                <span className="drps-badge" style={{ backgroundColor: t.classificacaoGravidade.cor }}>{t.classificacaoGravidade.texto}</span>
              </td>
              <td style={{ textAlign: "center", fontSize: "10px" }}>{t.classificacaoProbabilidade}</td>
              <td style={{ textAlign: "center" }}>
                <span className="drps-badge" style={{ backgroundColor: t.corMatriz }}>{t.matriz}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 6, fontSize: "9px", color: "#6b7280" }}>
        {totalRespondentes} respondente(s) · {topicos.length} tópico(s)
      </div>

      <table className="drps-tabela" style={{ marginTop: 8 }}>
        <tbody>
          <tr><td className="drps-header-section" colSpan={2}>Possíveis Agravos à Saúde Mental</td></tr>
          <tr>
            <td colSpan={2} style={{ whiteSpace: "pre-wrap" }}>
              {rel.agravos_por_setor?.[setor] ?? ""}
            </td>
          </tr>
          <tr><td className="drps-header-section" colSpan={2}>Medidas de controle recomendadas (medidas que a empresa deve adotar)</td></tr>
          <tr>
            <td colSpan={2} style={{ whiteSpace: "pre-wrap" }}>
              {rel.medidas_por_setor?.[setor] ?? ""}
            </td>
          </tr>
        </tbody>
      </table>

      <table className="drps-tabela" style={{ marginTop: 8 }}>
        <tbody>
          <tr><td className="drps-header-section">Conclusão</td></tr>
          <tr>
            <td>
              <div className="drps-conc" dangerouslySetInnerHTML={{ __html: conclusao || "<em style=\"color:#9ca3af\">(Conclusão não preenchida)</em>" }} />
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

export default function DrpsTemplate({
  relatorio,
  empresa,
  respondentes,
  probabilidades,
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
}: DrpsTemplateProps) {
  const setores = listarSetores(respondentes);
  const blocos = setores.map((s) => {
    const filtrados = filtrarPorSetor(respondentes, s);
    const topicos = aplicarMatriz(calcularResumoCompleto(filtrados), montarMapaProb(probabilidades, s));
    const cargos = Array.from(new Set(filtrados.map((r) => r.cargo?.trim()).filter(Boolean) as string[]))
      .sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }))
      .join(", ");
    return { setor: s, totalRespondentes: filtrados.length, funcoes: cargos, topicos };
  });

  // Monitoramento: matriz (pior caso) por tópico por setor
  const topicosPorSetorMon = setores.map((s) => {
    const filtrados = filtrarPorSetor(respondentes, s);
    const topicos = aplicarMatriz(calcularResumoCompleto(filtrados), montarMapaProb(probabilidades, s));
    return { setor: s, topicos };
  });

  const planoEntries = planoMedidas?.plano ? Object.entries(planoMedidas.plano) : [];
  const planoComConteudo = planoEntries.filter(
    ([, p]) => p.meses.some((m) => m) || (p.responsavel ?? "").trim().length > 0,
  );
  const checklist = (revisao?.checklist as Record<string, boolean>) ?? {};
  const equipe = (revisao?.equipe as Record<string, boolean>) ?? {};
  const anotacoes = revisao?.anotacoes ?? "";

  // Seções do sistema como nós nomeados (reutilizados nos dois modos).
  const setoresNode = blocos.map((b) => (
    <BlocoSetor key={b.setor} {...b} rel={relatorio} empresa={empresa} />
  ));

  // Um capítulo só entra no Sumário e na numeração se renderiza uma SEÇÃO
  // NUMERADA de fato no corpo. Evita itens fantasmas (ex.: Plano de Medidas
  // vazio) e lacunas (capa/sumário/assinatura não numerados).
  function renderizaNumerado(c: TextoPadraoCapitulo): boolean {
    if (c.ativo === false) return false;
    const ehCapa = !!c.bg_imagem_url || (c.titulo ?? "").trim().toLowerCase() === "capa";
    if (ehCapa) return false;
    if (c.tipo !== "fixo") return true; // editável sempre tem título
    switch (c.slug_fixo) {
      case "identificacao_empresa": return true;
      case "drps_caracterizacao":   return blocos.length > 0;
      case "drps_analise_setor":    return blocos.length > 0;
      case "drps_conclusao":        return !!relatorio.conclusao_geral;
      case "drps_plano_medidas":    return planoComConteudo.length > 0;
      case "drps_plano_acao_5w2h":  return planoAcao.length > 0;
      case "drps_revisao":          return topicosPorSetorMon.length > 0 || !!revisao;
      case "drps_assinatura":       return true; // folha de assinaturas é capítulo numerado
      // sumário não é seção numerada
      default:                      return false;
    }
  }

  // Numeração dos capítulos para casar com o Sumário (mesma ordem/predicado).
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

  // Conclusão Geral é editada em RichTextEditor (HTML). Renderiza como HTML —
  // antes saía como texto puro, exibindo as tags <p style="..."> literalmente.
  const conclusaoNode = relatorio.conclusao_geral ? (
    <section className="drps-sec">
      <h2>{numLabel(numPorSlug["drps_conclusao"], "Conclusão Geral")}</h2>
      <div
        className="drps-conc-geral"
        dangerouslySetInnerHTML={{ __html: relatorio.conclusao_geral }}
      />
    </section>
  ) : null;

  // Caracterização dos Trabalhadores — distribuição quantitativa por setor/função
  // (capítulo do sistema "drps_caracterizacao", antes não renderizado no corpo).
  const totalTrabalhadores = blocos.reduce((s, b) => s + b.totalRespondentes, 0);
  const caracterizacaoNode = blocos.length > 0 ? (
    <section className="drps-sec">
      <h2>{numLabel(numPorSlug["drps_caracterizacao"], "Caracterização dos Trabalhadores")}</h2>
      <p style={{ textIndent: "1.25cm" }}>
        Distribuição quantitativa dos trabalhadores avaliados por setor e função,
        conforme os respondentes do Diagnóstico de Riscos Psicossociais.
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
              <td>{b.funcoes || "—"}</td>
              <td style={{ textAlign: "center" }}>{b.totalRespondentes}</td>
            </tr>
          ))}
          <tr>
            <td style={{ fontWeight: 700 }}>Total</td>
            <td />
            <td style={{ textAlign: "center", fontWeight: 700 }}>{totalTrabalhadores}</td>
          </tr>
        </tbody>
      </table>
    </section>
  ) : null;

  const medidasNode = planoComConteudo.length > 0 ? (
    <section className="drps-sec">
      <h2>{numLabel(numPorSlug["drps_plano_medidas"], `Medidas de Controle — Plano Anual ${anoMedidas}`)}</h2>
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

  const monitNode = topicosPorSetorMon.length > 0 ? (
    <section className="drps-sec">
      <h2>{numLabel(numPorSlug["drps_revisao"], "Monitoramento do Desempenho")}</h2>
      <p style={{ textIndent: "1.25cm" }}>
        Acompanhamento das intervenções por tópico psicossocial, por setor, com status de execução e data da próxima reavaliação.
      </p>
      {topicosPorSetorMon.map((grupo) => (
        <div key={grupo.setor}>
          <h3>Setor: {grupo.setor}</h3>
          <table className="drps-ex-table">
            <thead>
              <tr>
                <th style={{ width: "32%" }}>Tópico</th>
                <th style={{ width: "10%" }}>Matriz</th>
                <th>Responsável</th>
                <th>Status</th>
                <th>Data interv.</th>
                <th>Próxima reaval.</th>
              </tr>
            </thead>
            <tbody>
              {grupo.topicos.map((t) => {
                const mon = monitoramentos.find((m) => m.setor === grupo.setor && m.topico_idx === t.idx);
                return (
                  <tr key={t.idx}>
                    <td>{t.nome.replace(/^Tópico \d+ - /, "")}</td>
                    <td><span className="drps-badge" style={{ backgroundColor: corMatriz(t.matriz) }}>{t.matriz}</span></td>
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

  const STATUS_PLANO: Record<string, string> = {
    PENDENTE: "Pendente",
    EM_ANDAMENTO: "Em andamento",
    CONCLUIDA: "Concluída",
  };
  const planoAcaoNode = planoAcao.length > 0 ? (
    <section className="drps-sec">
      <h2>{numLabel(numPorSlug["drps_plano_acao_5w2h"], "Plano de Ação 5W2H")}</h2>
      <p style={{ textIndent: "1.25cm" }}>
        Ações de gerenciamento dos riscos psicossociais no formato 5W2H — o quê,
        por quê, onde, quando, quem, como e quanto custa — com status de execução.
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
          {planoAcao.map((l, i) => (
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
      <h2>Revisão e Melhoria Contínua</h2>
      <p style={{ textIndent: "1.25cm" }}>
        Compromissos de gestão para manter o ciclo PDCA do programa de riscos psicossociais ativo, com equipe técnica designada e anotações da coordenação.
      </p>
      <h3>Ações de revisão obrigatórias</h3>
      <ul className="drps-ex-list">
        {ACOES_OBRIGATORIAS.map((a) => <li key={a.id}>{checklist[a.id] ? "☑" : "☐"} {a.texto}</li>)}
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

  // Blocos ordenados (mesma regra do modo unificado) p/ montar o sumário.
  const blocosOrdenados = [...capitulos]
    .filter((c) => c.ativo !== false)
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

  // Títulos para o sumário — só capítulos que viram seção numerada (mesmo
  // predicado da numeração), garantindo Sumário ↔ corpo sem fantasmas/lacunas.
  const sumarioTitulos = blocosOrdenados
    .filter((c) => renderizaNumerado(c))
    .map((c) =>
      c.tipo === "fixo" ? c.titulo : substituirVariaveisTexto(c.titulo, valores),
    )
    .filter((t) => t && t.trim());

  // quebraAntes=false: a quebra da folha é controlada pelo wrapper do capítulo
  // "Assinatura Técnica" (classeQuebraFixo), respeitando Nova página/Continuação.
  const folhaNode = (
    <FolhaAssinaturas
      signatarios={signatarios}
      empresa={folhaEmpresa}
      dataHoraAssinatura={dataHoraAssinatura}
      identificadorDocumento={identificadorDocumento}
      quebraAntes={false}
      numero={numPorSlug["drps_assinatura"]}
    />
  );

  // Mapeia um slug fixo do DRPS (DRPS_FIXOS) para o nó de seção correspondente.
  function renderSecao(slug: string): React.ReactNode {
    switch (slug) {
      case "identificacao_empresa": return <SecaoIdentificacaoEmpresa empresa={empresa} numero={numPorSlug["identificacao_empresa"]} />;
      case "sumario":               return <SecaoSumario titulos={sumarioTitulos} />;
      case "drps_caracterizacao": return caracterizacaoNode;
      case "drps_analise_setor": return (
        <>
          <div className="drps-sec" style={{ pageBreakAfter: "avoid" }}>
            <h2>{numLabel(numPorSlug["drps_analise_setor"], "Análise por Setor")}</h2>
            <p style={{ textIndent: "1.25cm" }}>
              Classificação dos fatores de risco psicossocial por setor avaliado, com
              gravidade, probabilidade e matriz de risco conforme a NR-01.
            </p>
          </div>
          {setoresNode}
        </>
      );
      case "drps_conclusao":     return conclusaoNode;
      case "drps_plano_acao_5w2h": return planoAcaoNode;
      case "drps_plano_medidas": return medidasNode;
      case "drps_revisao":       return <>{monitNode}{revisaoNode}</>;
      case "drps_assinatura":    return folhaNode;
      default:                   return null;
    }
  }

  // Modo unificado: se houver seções do sistema (fixo) cadastradas em
  // drps_texto_padrao, o corpo é montado por `ordem` (editáveis + seções
  // intercalados). Sem fixos, usa o layout posicional legado (fallback que
  // garante que o PDF nunca perca as seções do sistema).
  const temFixos = capitulos.some((c) => c.tipo === "fixo");
  // Se o capítulo "Assinatura Técnica" estiver ativo, a folha é renderizada na
  // posição dele (via renderSecao); senão, cai no fim como fallback.
  const temAssinaturaFixo = capitulos.some(
    (c) => c.tipo === "fixo" && c.slug_fixo === "drps_assinatura" && c.ativo !== false,
  );
  const ordenados = [...capitulos]
    .filter((c) => c.ativo !== false)
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

  return (
    <>
      {/* eslint-disable-next-line react/no-danger */}
      <style dangerouslySetInnerHTML={{ __html: STYLE_BLOCK }} />

      {temFixos ? (
        ordenados.map((c) =>
          c.tipo === "fixo" ? (
            <div
              key={c.id_capitulo}
              className={`${classeQuebraFixo(c)}${c.orientacao === "paisagem" ? " drps-cap-paisagem" : ""}`}
              data-slug={c.slug_fixo ?? undefined}
            >{renderSecao(c.slug_fixo ?? "")}</div>
          ) : (
            <React.Fragment key={c.id_capitulo}>
              {renderEditavelUm(
                numPorId[c.id_capitulo]
                  ? { ...c, titulo: `${numPorId[c.id_capitulo]}. ${c.titulo}` }
                  : c,
                valores,
              )}
            </React.Fragment>
          ),
        )
      ) : (
        <>
          {renderEditaveis(capitulos, valores, "inicio")}
          {renderEditaveis(capitulos, valores, "apos_sumario")}
          {setoresNode}
          {renderEditaveis(capitulos, valores, "apos_setores")}
          {conclusaoNode}
          {renderEditaveis(capitulos, valores, "apos_conclusao")}
          {medidasNode}
          {monitNode}
          {revisaoNode}
          {renderEditaveis(capitulos, valores, "apos_medidas")}
          {renderEditaveis(capitulos, valores, "fim")}
        </>
      )}

      {/* Fallback: sem capítulo de assinatura ativo, renderiza a folha no fim
          (com quebra de página própria, já que não há wrapper controlando). */}
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
