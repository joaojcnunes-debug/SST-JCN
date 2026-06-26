/**
 * Template server-side do Laudo AET (NR-17) para geração via Puppeteer.
 * FRAME (passos 1-2): capa, identificação, sumário, capítulos editáveis,
 * considerações e assinatura — com numeração e quebra de página corretas.
 * Os blocos de setor (Agentes Ambientais / Análise Ergonômica / Psicossocial)
 * estão como PLACEHOLDER e serão portados nos passos 3-4.
 *
 * Restrições: sem "use client", sem hooks; apenas inline styles + um <style>.
 */

import React from "react";
import FolhaAssinaturas from "@/components/pdf/FolhaAssinaturas";
import type { Signatario } from "@/components/pdf/FolhaAssinaturas";
import { SecaoIdentificacaoEmpresa, SecaoSumario } from "@/components/pdf/SecoesComuns";
import { classeQuebraFixo, numerarCapitulos, numLabel } from "@/components/pdf/templates/shared";
import type { Empresa } from "@/lib/supabase/types";
import type { TextoPadraoCapitulo } from "@/lib/textos-padrao/types";
import { substituirVariaveis, substituirVariaveisTexto } from "@/lib/textos-padrao/variaveis";

interface AetRiscoLike {
  id: string;
  tipo?: string | null;
  risco?: string | null;
  intensidade_concentracao?: string | null;
  tecnica_metodologia?: string | null;
  epi_ca?: string | null;
  epi_eficaz?: string | null;
  classificacao_risco?: string | null;
}
interface AetCargoLike { nome?: string | null; descricao?: string | null }
export interface AetSetorLike {
  id: string;
  nome_setor?: string | null;
  maquinas_equipamentos?: string | null;
  descricao_atividade?: string | null;
  cargos?: AetCargoLike[];
  riscos?: AetRiscoLike[];
  owas?: Record<string, number[]> | null;
  checklist?: Record<string, string> | null;
  respostas_extras?: Record<string, string> | null;
  parecer_tecnico?: string | null;
  recomendacoes?: string | null;
}

interface AetOwasOpcao { value: number; label: string }
/** Config de OWAS já com a imagem resolvida (absoluta/assinada) pela rota. */
export interface AetOwasCfg { id: string; slug: string; titulo: string; opcoes: AetOwasOpcao[]; imagem: string | null }

const SLUG_TO_OWAS_FIELD: Record<string, string> = {
  costas: "posturas_costas",
  bracos: "posturas_bracos",
  pernas: "posturas_pernas",
  esforco: "esforco",
};

export interface AetChecklistPerguntaLike { slug: string; secao?: string | null; label: string }

// Labels padrão do checklist (fallback quando não há custom no banco). Espelha
// CHECKLIST_PERGUNTAS_PADRAO de useAet.ts (que é "use client").
const CHECKLIST_PADRAO: AetChecklistPerguntaLike[] = [
  { slug: "levantamento_acima_limite", secao: "Postura", label: "Há registros de levantamento, transporte e descarga de materiais nesta atividade acima do limite recomendado?" },
  { slug: "pausas_descanso", secao: "Postura", label: 'Caso a resposta anterior seja "em pé" a empresa oferece pausas para descanso ou disponibiliza cadeiras do tipo semi-sentado?' },
  { slug: "uso_cadeira", secao: "Postura", label: "Para execução das atividades do dia-dia é disponibilizado o uso de cadeira?" },
  { slug: "cadeira_adequada", secao: "Postura", label: "A cadeira é estofada e revestida, possui base giratória, assento com altura ajustável, ajustes de altura e inclinação, bordas arredondadas e formato anatômico?" },
  { slug: "monitor", secao: "Postura", label: "A atividade necessita uso de monitor fixo sobre a mesa; caso positivo, este apresenta regulagens de altura e inclinação?" },
  { slug: "organizacao_trabalho", secao: "Organização do Trabalho", label: "As normas de produção (equipamentos, modo operatório, segurança e qualidade) devem estar descritas nas instruções internas de trabalho, elaboradas pela empresa." },
  { slug: "exigencia_levantamento", secao: "Exigência de Tempo", label: "Há registros de levantamento, transporte e descarga de materiais nesta atividade acima do limite recomendado?" },
  { slug: "ritmo_por_demanda", secao: "Ritmo de Trabalho", label: "O ritmo de trabalho é determinado pela demanda de trabalho?" },
  { slug: "pausas_formais", secao: "Adoção de Rodízios - Ergonômico", label: "Há pausas formais durante o ciclo de trabalho?" },
  { slug: "rodizios_sistematizados", secao: "Adoção de Rodízios - Ergonômico", label: "Há rodízios sistematizados entre os postos de trabalho?" },
];

const SLUGS_PADRAO = new Set([
  "levantamento_acima_limite", "trabalho_predominante", "pausas_descanso",
  "uso_cadeira", "cadeira_adequada", "monitor", "organizacao_trabalho",
  "exigencia_levantamento", "ritmo_por_demanda", "pausas_formais", "rodizios_sistematizados",
]);

function CheckSep({ title }: { title: string }) {
  return <div className="aet-chk-sep"><p>{title}</p></div>;
}
function CheckRow({ label, value }: { label: string; value: string }) {
  const sim = value === "sim";
  const na = value === "nao_aplica";
  return (
    <div className="aet-chk-row">
      <span className="lbl">{label}</span>
      <span className={sim ? "aet-chk-tag aet-chk-tag--sim" : "aet-chk-tag aet-chk-tag--off"}>
        {sim ? "Sim" : na ? "N/A" : "Não"}
      </span>
    </div>
  );
}
function CheckSelect({ label, value }: { label: string; value: string }) {
  return (
    <div className="aet-chk-row">
      <span className="lbl">{label}</span>
      <span className="aet-chk-tag aet-chk-tag--sim">{value || "—"}</span>
    </div>
  );
}

const CLASS_COLOR_HEX: Record<string, { bg: string; cor: string }> = {
  "Trivial": { bg: "#dcfce7", cor: "#166534" },
  "De Atenção": { bg: "#fef9c3", cor: "#854d0e" },
  "Moderado": { bg: "#ffedd5", cor: "#9a3412" },
  "Alto": { bg: "#fee2e2", cor: "#991b1b" },
  "Crítico": { bg: "#fecaca", cor: "#7f1d1d" },
};

export interface AetTemplateProps {
  relatorio: {
    setores: AetSetorLike[];
    consideracoes_finais: string | null;
  };
  empresa: Partial<Empresa> | null;
  capitulos: TextoPadraoCapitulo[];
  owasConfig: AetOwasCfg[];
  checklistPerguntas: AetChecklistPerguntaLike[];
  fatoresConfig: AetFatorConfigLike[];
  fatoresPerguntas: AetFatorPerguntaLike[];
  qpsRespostas: AetQpsRespostaLike[];
  fatoresPsi: AetFatorPsiLike[];
  qpsMeta: AetQpsMetaLike | null;
  valoresVars: Record<string, string>;
  signatarios: Signatario[];
  folhaEmpresa: { razaoSocial: string; cnpj: string } | null;
  dataHoraAssinatura: string;
  identificadorDocumento: string;
}

const STYLE_BLOCK = `
* { box-sizing: border-box; }
.textos-padrao-capitulo { margin-bottom: 18pt; page-break-inside: auto; }
.textos-padrao-capitulo--nova-pagina { page-break-before: always; }
.textos-padrao-capitulo--continua    { page-break-before: auto; margin-top: 16pt; }
/* Capa no estilo DRPS (img 100%, sem full-bleed → não corta caixas na borda) */
.tp-capa { page: capa; position: relative; width: 210mm; height: 297mm; overflow: hidden; page-break-after: always; }
.tp-capa img.bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center; display: block; z-index: 0; }
.tp-capa .caixa { position: absolute; z-index: 1; white-space: pre-wrap; line-height: 1.3; }
.textos-padrao-capitulo-titulo {
  font-size: 14pt; font-weight: 700; color: #1e4d28;
  border-bottom: 2px solid #0ea5e9; padding-bottom: 4px; margin-bottom: 12pt;
}
.textos-padrao-capitulo-conteudo { font-size: 12pt; color: #1f2937; line-height: 1.5; text-align: justify; }
.textos-padrao-capitulo-conteudo p { margin: 0 0 12pt; text-indent: 1.25cm; text-align: justify; }
.textos-padrao-capitulo-conteudo h1 { font-size: 14pt; font-weight: 700; color: #1e4d28; margin: 18pt 0 6pt; }
.textos-padrao-capitulo-conteudo h2 { font-size: 13pt; font-weight: 700; color: #1e4d28; margin: 14pt 0 6pt; }
.textos-padrao-capitulo-conteudo h3 { font-size: 12pt; font-weight: 700; color: #1e4d28; margin: 12pt 0 4pt; }
.textos-padrao-capitulo-conteudo ul, .textos-padrao-capitulo-conteudo ol { margin: 0 0 12pt 1.25cm; padding: 0; }
.textos-padrao-capitulo-conteudo li { margin: 2pt 0; }
.textos-padrao-capitulo-conteudo img { max-width: 100%; height: auto; border-radius: 4px; margin: 8pt 0; }
.textos-padrao-capitulo-conteudo table { border-collapse: collapse; width: 100%; margin: 12pt 0; font-size: 10pt; }
.textos-padrao-capitulo-conteudo th, .textos-padrao-capitulo-conteudo td { border: 1px solid #999; padding: 5px 7px; vertical-align: top; }
.textos-padrao-capitulo-conteudo th { background: #d4edda; color: #1e4d28; font-weight: 700; text-align: left; }
/* Seções AET */
.aet-sec-titulo { font-size: 14pt; font-weight: 700; color: #1e4d28; border-bottom: 2px solid #0ea5e9; padding-bottom: 4px; margin: 0 0 12pt; }
.aet-sub { font-size: 12pt; font-weight: 700; color: #1e4d28; margin: 14pt 0 6pt; }
.aet-fixo { page-break-before: always; }
.aet-fixo--continua { page-break-before: auto; }
.aet-conc p { font-size: 12pt; line-height: 1.6; text-align: justify; color: #1f2937; margin: 0 0 12pt; white-space: pre-line; }
/* Blocos de setor */
.aet-setor-bloco { border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; margin-bottom: 14pt; page-break-inside: auto; }
.aet-setor-head { background: #374151; padding: 7px 12px; }
.aet-setor-head .t { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #fff; margin: 0; }
.aet-setor-head .s { font-size: 10px; color: #d1d5db; margin: 2px 0 0; }
.aet-setor-tab { width: 100%; border-collapse: collapse; font-size: 11px; }
.aet-setor-tab td, .aet-setor-tab th { border: 1px solid #e5e7eb; padding: 4px 8px; vertical-align: top; color: #374151; }
.aet-setor-info td.k { width: 160px; background: #f9fafb; font-weight: 600; color: #4b5563; }
.aet-riscos th { background: #f3f4f6; font-size: 10px; font-weight: 700; text-transform: uppercase; color: #4b5563; text-align: left; }
.aet-riscos tr:nth-child(even) { background: #f9fafb; }
.aet-placeholder { border: 1px dashed #cbd5e1; background: #f8fafc; color: #64748b; padding: 16px; border-radius: 8px; font-size: 11px; }
/* OWAS */
.aet-analise { border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; margin-bottom: 14pt; page-break-inside: auto; }
.aet-owas-wrap { padding: 10px 14px; }
.aet-owas-tit { margin: 0 0 8px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #9ca3af; }
.aet-owas-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.aet-owas-card { border: 1px solid #e5e7eb; background: #f9fafb; border-radius: 6px; padding: 10px; }
.aet-owas-card h4 { margin: 0 0 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #6b7280; }
.aet-owas-row { display: flex; gap: 10px; }
.aet-owas-opts { flex: 1; }
.aet-owas-opt { display: flex; align-items: flex-start; gap: 6px; margin: 3px 0; }
.aet-owas-chk { display: inline-flex; align-items: center; justify-content: center; width: 13px; height: 13px; border-radius: 3px; border: 1px solid #9ca3af; font-size: 9px; line-height: 1; }
.aet-owas-chk--on { background: #374151; border-color: #374151; color: #fff; }
.aet-owas-img { width: 96px; flex-shrink: 0; }
.aet-owas-img img { width: 100%; height: auto; border: 1px solid #e5e7eb; border-radius: 4px; }
/* Checklist */
.aet-chk-wrap { padding: 10px 14px; border-top: 1px solid #f3f4f6; }
.aet-chk-box { border: 1px solid #e5e7eb; background: #f9fafb; border-radius: 8px; padding: 12px; }
.aet-chk-tit { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #6b7280; margin: 0 0 6px; }
.aet-chk-sep { border-top: 1px solid #e5e7eb; padding-top: 8px; margin-top: 8px; }
.aet-chk-sep:first-of-type { border-top: 0; padding-top: 0; margin-top: 0; }
.aet-chk-sep p { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #9ca3af; margin: 0 0 4px; }
.aet-chk-row { display: flex; align-items: center; gap: 8px; margin: 3px 0; }
.aet-chk-row .lbl { flex: 1; font-size: 11px; line-height: 1.35; color: #374151; }
.aet-chk-tag { flex-shrink: 0; border-radius: 4px; padding: 1px 8px; font-size: 10px; font-weight: 600; }
.aet-chk-tag--sim { background: #1f2937; color: #fff; }
.aet-chk-tag--off { background: #fff; border: 1px solid #e5e7eb; color: #9ca3af; }
.aet-rich { font-size: 11px; line-height: 1.55; color: #374151; }
.aet-rich p { margin: 0 0 6px; }
.aet-rich ul, .aet-rich ol { margin: 0 0 6px 1.2em; padding: 0; }
.aet-rich table { border-collapse: collapse; width: 100%; font-size: 10px; margin: 6px 0; }
.aet-rich th, .aet-rich td { border: 1px solid #cbd5e1; padding: 4px 6px; }
`;

function SectionTitulo({ titulo }: { titulo: string }) {
  return <h2 className="aet-sec-titulo">{titulo}</h2>;
}

/** Tabela de riscos por setor (portado do laudo, com estilo inline/CSS). */
function SetorRiscosBlock({ setor, idx }: { setor: AetSetorLike; idx: number }) {
  const cargos = setor.cargos ?? [];
  const riscos = setor.riscos ?? [];
  const COLS = ["Tipo", "Agente / Risco", "Intensidade / Conc.", "Técnica / Metodologia", "EPI (CA)", "EPI Eficaz", "Classificação"];
  return (
    <div className="aet-setor-bloco">
      <div className="aet-setor-head">
        <p className="t">Setor {idx + 1}: {setor.nome_setor || "—"}</p>
        {cargos.length > 0 && (
          <p className="s">{cargos.map((c) => c.nome).filter(Boolean).join(" · ")}</p>
        )}
      </div>
      <table className="aet-setor-tab aet-setor-info">
        <tbody>
          {setor.maquinas_equipamentos && (
            <tr><td className="k">Máquinas e Equipamentos</td><td>{setor.maquinas_equipamentos.split("\n").filter(Boolean).join(" · ")}</td></tr>
          )}
          {setor.descricao_atividade && (
            <tr><td className="k">Descrição da Atividade</td><td>{setor.descricao_atividade}</td></tr>
          )}
          {cargos.filter((c) => c.descricao).map((cargo, i) => (
            <tr key={i}><td className="k">{cargo.nome}</td><td>{cargo.descricao}</td></tr>
          ))}
        </tbody>
      </table>
      {riscos.length > 0 ? (
        <table className="aet-setor-tab aet-riscos">
          <thead><tr>{COLS.map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {riscos.map((r) => {
              const cls = CLASS_COLOR_HEX[r.classificacao_risco ?? ""] ?? { bg: "#f3f4f6", cor: "#374151" };
              return (
                <tr key={r.id}>
                  <td>{r.tipo}</td>
                  <td>{r.risco}</td>
                  <td>{r.intensidade_concentracao}</td>
                  <td>{r.tecnica_metodologia}</td>
                  <td>{r.epi_ca}</td>
                  <td>{r.epi_eficaz}</td>
                  <td className="aet-class" style={{ background: cls.bg, color: cls.cor }}>{r.classificacao_risco}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p style={{ padding: "8px 12px", fontSize: 11, fontStyle: "italic", color: "#9ca3af", margin: 0 }}>
          Nenhum agente / risco identificado neste setor.
        </p>
      )}
    </div>
  );
}

/** Cards OWAS de um setor (posturas selecionadas + imagem de referência). */
function BlocoOwas({ setor, owasConfig }: { setor: AetSetorLike; owasConfig: AetOwasCfg[] }) {
  const owas = setor.owas ?? {};
  const temOwas = owasConfig.some((cat) => {
    const field = SLUG_TO_OWAS_FIELD[cat.slug];
    return field && (owas[field] ?? []).length > 0;
  });
  if (!temOwas) return null;
  return (
    <div className="aet-owas-wrap">
      <p className="aet-owas-tit">OWAS — Análise de Posturas</p>
      <div className="aet-owas-grid">
        {owasConfig.map((cat) => {
          const field = SLUG_TO_OWAS_FIELD[cat.slug];
          if (!field) return null;
          const selected = (owas[field] ?? []) as number[];
          return (
            <div key={cat.id} className="aet-owas-card">
              <h4>{cat.titulo}</h4>
              <div className="aet-owas-row">
                <div className="aet-owas-opts">
                  {cat.opcoes.map((opt) => {
                    const on = selected.includes(opt.value);
                    return (
                      <div key={opt.value} className="aet-owas-opt">
                        <span className={on ? "aet-owas-chk aet-owas-chk--on" : "aet-owas-chk"}>{on ? "✓" : ""}</span>
                        <span style={{ fontSize: 11, color: on ? "#111827" : "#9ca3af", lineHeight: 1.3 }}>{opt.label}</span>
                      </div>
                    );
                  })}
                </div>
                {cat.imagem && (
                  <div className="aet-owas-img">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={cat.imagem} alt={`Referência OWAS: ${cat.titulo}`} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Checklist ergonômico de um setor (Postura, Tempo, Ritmo, Rodízios, Organização). */
function BlocoChecklist({ setor, perguntas }: { setor: AetSetorLike; perguntas: AetChecklistPerguntaLike[] }) {
  const checklist = setor.checklist ?? {};
  const pergunta = (slug: string) =>
    perguntas.find((p) => p.slug === slug)?.label ?? CHECKLIST_PADRAO.find((p) => p.slug === slug)?.label ?? slug;
  const lbl = (slug: string) => perguntas.find((p) => p.slug === slug)?.label ?? slug;
  const secaoDe = (slug: string) => perguntas.find((p) => p.slug === slug)?.secao ?? "";
  const customExtras = Object.entries(setor.respostas_extras ?? {}).filter(([slug]) => !SLUGS_PADRAO.has(slug));
  const extrasDeSecao = (secao: string) => customExtras.filter(([slug]) => secaoDe(slug) === secao);
  const extrasAdocao = customExtras.filter(([slug]) => secaoDe(slug).startsWith("Adoção"));
  const extrasSemSecao = customExtras.filter(([slug]) => {
    const s = secaoDe(slug);
    return s !== "Postura" && s !== "Exigência de Tempo" && s !== "Ritmo de Trabalho" && !s.startsWith("Adoção") && s !== "Organização do Trabalho";
  });
  return (
    <div className="aet-chk-wrap">
      <div className="aet-chk-box">
        <p className="aet-chk-tit">Checklist Ergonômico</p>
        <CheckSep title="Postura" />
        <CheckRow label={pergunta("levantamento_acima_limite")} value={checklist.levantamento_acima_limite ?? ""} />
        <CheckSelect label={pergunta("trabalho_predominante")} value={checklist.trabalho_predominante ?? ""} />
        <CheckRow label={pergunta("pausas_descanso")} value={checklist.pausas_descanso ?? ""} />
        <CheckRow label={pergunta("uso_cadeira")} value={checklist.uso_cadeira ?? ""} />
        <CheckRow label={pergunta("cadeira_adequada")} value={checklist.cadeira_adequada ?? ""} />
        <CheckRow label={pergunta("monitor")} value={checklist.monitor ?? ""} />
        {extrasDeSecao("Postura").map(([slug, val]) => <CheckRow key={slug} label={lbl(slug)} value={val} />)}
        <CheckSep title="Exigência de Tempo" />
        <CheckRow label={pergunta("exigencia_levantamento")} value={checklist.exigencia_levantamento ?? ""} />
        {extrasDeSecao("Exigência de Tempo").map(([slug, val]) => <CheckRow key={slug} label={lbl(slug)} value={val} />)}
        <CheckSep title="Ritmo de Trabalho" />
        <CheckRow label={pergunta("ritmo_por_demanda")} value={checklist.ritmo_por_demanda ?? ""} />
        {extrasDeSecao("Ritmo de Trabalho").map(([slug, val]) => <CheckRow key={slug} label={lbl(slug)} value={val} />)}
        <CheckSep title="Adoção de Rodízios — Ergonômico" />
        <CheckRow label={pergunta("pausas_formais")} value={checklist.pausas_formais ?? ""} />
        <CheckRow label={pergunta("rodizios_sistematizados")} value={checklist.rodizios_sistematizados ?? ""} />
        {extrasAdocao.map(([slug, val]) => <CheckRow key={slug} label={lbl(slug)} value={val} />)}
        <CheckSep title="Organização do Trabalho" />
        <p style={{ fontSize: 11, fontStyle: "italic", lineHeight: 1.5, color: "#4b5563", margin: 0 }}>{pergunta("organizacao_trabalho")}</p>
        {extrasSemSecao.length > 0 && (
          <>
            <CheckSep title="Perguntas Adicionais" />
            {extrasSemSecao.map(([slug, val]) => <CheckRow key={slug} label={lbl(slug)} value={val} />)}
          </>
        )}
      </div>
    </div>
  );
}

// ── 13 Fatores Psicossociais (QPS) ───────────────────────────────────────────
type ZonaPsi = "verde" | "amarela" | "laranja" | "vermelha";
export interface AetFatorConfigLike { codigo: string; nome: string }
export interface AetFatorPerguntaLike { codigo_fator: string; ordem: number; logica?: string | null }
export interface AetQpsRespostaLike { id_setor: string; codigo_fator: string; pergunta_ordem: number; resposta: number }
export interface AetFatorPsiLike { codigo_fator: string; avaliado?: boolean; zona?: ZonaPsi | null; media?: number | null; observacao?: string | null; pergunta_critica?: string | null }
export interface AetQpsMetaLike {
  n_respondentes?: number | null; total_elegivel?: number | null;
  periodo_inicio?: string | null; periodo_fim?: string | null;
  modo_aplicacao?: string | null; tecnico_aplicador?: string | null; observacao_geral?: string | null;
}

const ZONA_BG: Record<string, string> = { verde: "#E8F5E9", amarela: "#FFF9C4", laranja: "#FFE0B2", vermelha: "#FFEBEE" };
const ZONA_FG: Record<string, string> = { verde: "#1B5E20", amarela: "#F57F17", laranja: "#E65100", vermelha: "#C62828" };

function zonaFromMedia(media: number | null): ZonaPsi | null {
  if (media === null) return null;
  if (media >= 4.0) return "verde";
  if (media >= 3.0) return "amarela";
  if (media >= 2.0) return "laranja";
  return "vermelha";
}
function nivelPgrFromZona(zona: ZonaPsi | null | undefined): string {
  if (zona === "vermelha") return "Crítico";
  if (zona === "laranja") return "Alto";
  if (zona === "amarela") return "Moderado";
  if (zona === "verde") return "Trivial";
  return "—";
}
function calcMediaSetor(perguntas: AetFatorPerguntaLike[], respostas: AetQpsRespostaLike[], idSetor: string, codigoFator: string): number | null {
  const rSetor = respostas.filter((r) => r.id_setor === idSetor && r.codigo_fator === codigoFator);
  if (rSetor.length === 0) return null;
  const scores = rSetor.map((r) => {
    const perg = perguntas.find((p) => p.codigo_fator === codigoFator && p.ordem === r.pergunta_ordem);
    return perg?.logica === "direta" ? 6 - r.resposta : r.resposta;
  });
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}
function ZonaTag({ zona }: { zona: ZonaPsi | null | undefined }) {
  if (!zona) return <>—</>;
  return (
    <span style={{ borderRadius: 4, padding: "1px 8px", fontSize: 10, fontWeight: 700, background: ZONA_BG[zona], color: ZONA_FG[zona] }}>
      {zona.charAt(0).toUpperCase() + zona.slice(1)}
    </span>
  );
}

/** Tabela de 13 fatores psicossociais de UM setor (médias QPS + zona + nível PGR). */
function BlocoFatoresSetor({
  setor, fatoresConfig, fatoresPerguntas, qpsRespostas, fatoresPsi,
}: {
  setor: AetSetorLike;
  fatoresConfig: AetFatorConfigLike[];
  fatoresPerguntas: AetFatorPerguntaLike[];
  qpsRespostas: AetQpsRespostaLike[];
  fatoresPsi: AetFatorPsiLike[];
}) {
  const psiRows = fatoresConfig
    .filter((f) => f.codigo !== "F13")
    .map((f) => {
      const media = calcMediaSetor(fatoresPerguntas, qpsRespostas, setor.id, f.codigo);
      if (media === null) return null;
      return { f, media, zona: zonaFromMedia(media) };
    })
    .filter((x): x is { f: AetFatorConfigLike; media: number; zona: ZonaPsi | null } => x !== null);
  const f13 = fatoresPsi.find((fp) => fp.codigo_fator === "F13" && fp.avaliado && fp.zona);
  if (psiRows.length === 0 && !f13) return null;
  return (
    <div className="aet-chk-wrap">
      <p className="aet-owas-tit">Fatores Psicossociais — QPS</p>
      <table className="aet-setor-tab aet-riscos">
        <thead><tr>{["Cód.", "Fator", "Média", "Zona", "Nível PGR"].map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {psiRows.map(({ f, media, zona }) => (
            <tr key={f.codigo}>
              <td style={{ fontWeight: 700 }}>{f.codigo}</td>
              <td>{f.nome}</td>
              <td style={{ textAlign: "center" }}>{media.toFixed(2)}</td>
              <td><ZonaTag zona={zona} /></td>
              <td>{nivelPgrFromZona(zona)}</td>
            </tr>
          ))}
          {f13 && (
            <tr>
              <td style={{ fontWeight: 700 }}>F13</td>
              <td>{fatoresConfig.find((fc) => fc.codigo === "F13")?.nome ?? "Proteção da segurança física"}</td>
              <td style={{ textAlign: "center" }}>—</td>
              <td><ZonaTag zona={f13.zona} /></td>
              <td>{nivelPgrFromZona(f13.zona)}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Parecer técnico + recomendações (HTML do editor) de um setor. */
function BlocoParecerRecom({ setor }: { setor: AetSetorLike }) {
  if (!setor.parecer_tecnico && !setor.recomendacoes) return null;
  return (
    <>
      {setor.parecer_tecnico && (
        <div className="aet-chk-wrap">
          <p className="aet-owas-tit">Parecer Técnico</p>
          <div className="aet-rich" dangerouslySetInnerHTML={{ __html: setor.parecer_tecnico }} />
        </div>
      )}
      {setor.recomendacoes && (
        <div className="aet-chk-wrap">
          <p className="aet-owas-tit">Recomendações</p>
          <div className="aet-rich" dangerouslySetInnerHTML={{ __html: setor.recomendacoes }} />
        </div>
      )}
    </>
  );
}

export default function AetTemplate({
  relatorio: rel,
  empresa,
  capitulos,
  owasConfig,
  checklistPerguntas,
  fatoresConfig,
  fatoresPerguntas,
  qpsRespostas,
  fatoresPsi,
  qpsMeta,
  valoresVars,
  signatarios,
  folhaEmpresa,
  dataHoraAssinatura,
  identificadorDocumento,
}: AetTemplateProps) {
  const temSetores = (rel.setores?.length ?? 0) > 0;
  const consideracoes = (rel.consideracoes_finais ?? "").trim();

  const blocosOrdenados = [...capitulos]
    .filter((c) => c.ativo !== false)
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

  const tituloPorSlug: Record<string, string> = {};
  for (const c of capitulos) if (c.slug_fixo) tituloPorSlug[c.slug_fixo] = c.titulo;

  function renderizaNumerado(c: TextoPadraoCapitulo): boolean {
    if (c.ativo === false) return false;
    const ehCapa = !!c.bg_imagem_url || (c.titulo ?? "").trim().toLowerCase() === "capa";
    if (ehCapa) return false;
    if (c.tipo !== "fixo") return true;
    switch (c.slug_fixo) {
      case "identificacao_empresa": return true;
      case "aet_agentes_ambientais": return temSetores;
      case "aet_analise_ergonomica": return temSetores;
      case "aet_psicossocial": return fatoresPsi.some((f) => f.avaliado);
      case "aet_consideracoes_finais": return !!consideracoes;
      case "aet_assinatura": return true;
      default: return false; // sumario
    }
  }

  const { numPorSlug, numPorId } = numerarCapitulos(capitulos, renderizaNumerado);

  const sumarioTitulos = blocosOrdenados
    .filter((c) => renderizaNumerado(c))
    .map((c) => (c.tipo === "fixo" ? c.titulo : substituirVariaveisTexto(c.titulo, valoresVars)))
    .filter((t) => t && t.trim());

  function renderEditavel(c: TextoPadraoCapitulo) {
    const ehCapa = !!c.bg_imagem_url || (c.titulo ?? "").trim().toLowerCase() === "capa";

    // Capa: estilo DRPS (img 100% + caixas posicionadas), evita o corte da borda.
    if (ehCapa) {
      return (
        <div key={c.id_capitulo} className="tp-capa">
          {c.bg_imagem_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="bg" src={c.bg_imagem_url} alt="" />
          )}
          {(c.caixas_texto ?? []).map((cx) => (
            <div
              key={cx.id}
              className="caixa"
              style={{
                left: `${cx.x}%`,
                top: `${cx.y}%`,
                width: `${cx.w ?? 40}%`,
                fontSize: cx.fontSize ?? 16,
                fontWeight: cx.bold ? 700 : 400,
                color: cx.color ?? "#ffffff",
                textAlign: (cx.align ?? "left") as React.CSSProperties["textAlign"],
              }}
            >
              {substituirVariaveisTexto(cx.conteudo, valoresVars)}
            </div>
          ))}
        </div>
      );
    }

    const orientacao = c.orientacao ?? "retrato";
    const novaPagina = (c.quebra_pagina ?? "nova") === "nova";
    const conteudo = substituirVariaveis(c.conteudo, valoresVars);
    const titulo = numLabel(numPorId[c.id_capitulo], substituirVariaveisTexto(c.titulo, valoresVars));
    const classes = [
      "textos-padrao-capitulo",
      orientacao === "paisagem" ? "textos-padrao-capitulo--paisagem" : "textos-padrao-capitulo--retrato",
      novaPagina ? "textos-padrao-capitulo--nova-pagina" : "textos-padrao-capitulo--continua",
    ].join(" ");
    return (
      <article key={c.id_capitulo} className={classes}>
        <h2 className="textos-padrao-capitulo-titulo">{titulo}</h2>
        <div className="textos-padrao-capitulo-conteudo" dangerouslySetInnerHTML={{ __html: conteudo }} />
      </article>
    );
  }

  // Seção por setor: tabela de riscos (passo 3, real) + análise OWAS/checklist
  // (passo 4, ainda placeholder). comAnalise controla o sub-bloco de análise.
  function secaoSetores(slug: string, rotulo: string, intro: string | null, comAnalise: boolean) {
    return (
      <>
        <SectionTitulo titulo={numLabel(numPorSlug[slug], tituloPorSlug[slug] ?? rotulo)} />
        {intro && (
          <p style={{ marginBottom: 12, fontSize: 11, color: "#374151", borderLeft: "2px solid #cbd5e1", paddingLeft: 12 }}>
            {intro}
          </p>
        )}
        {rel.setores.map((s, i) => (
          <div key={s.id} style={{ marginBottom: 16 }}>
            <SetorRiscosBlock setor={s} idx={i} />
            {comAnalise && (
              <div className="aet-analise" style={{ marginTop: 8 }}>
                <BlocoOwas setor={s} owasConfig={owasConfig} />
                <BlocoChecklist setor={s} perguntas={checklistPerguntas} />
                <BlocoParecerRecom setor={s} />
                <BlocoFatoresSetor
                  setor={s}
                  fatoresConfig={fatoresConfig}
                  fatoresPerguntas={fatoresPerguntas}
                  qpsRespostas={qpsRespostas}
                  fatoresPsi={fatoresPsi}
                />
              </div>
            )}
          </div>
        ))}
      </>
    );
  }

  function secaoPsicossocial(intro: string | null) {
    const avaliados = fatoresPsi.filter((f) => f.avaliado);
    const comAnalise = avaliados.filter((f) => f.observacao || f.pergunta_critica);
    const temDados = qpsMeta && (qpsMeta.n_respondentes != null || qpsMeta.periodo_inicio || qpsMeta.modo_aplicacao || qpsMeta.tecnico_aplicador);
    const fmtData = (d?: string | null) => (d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—");
    return (
      <>
        <SectionTitulo titulo={numLabel(numPorSlug["aet_psicossocial"], tituloPorSlug["aet_psicossocial"] ?? "Fatores Psicossociais (QPS)")} />
        {intro && (
          <p style={{ marginBottom: 10, fontSize: 11, color: "#374151", borderLeft: "2px solid #cbd5e1", paddingLeft: 12 }}>{intro}</p>
        )}
        <p style={{ fontSize: 11, lineHeight: 1.55, color: "#374151", margin: "0 0 12px", textAlign: "justify" }}>
          A avaliação dos fatores psicossociais foi realizada por meio do instrumento QPS Nordic (Questionário de
          Fatores Psicossociais no Trabalho), que contempla 13 fatores classificados em zonas de risco: verde
          (baixo), amarela (moderado), laranja (elevado) e vermelha (crítico).
        </p>

        {temDados && (
          <>
            <h3 className="aet-sub">Dados da Aplicação</h3>
            <table className="aet-setor-tab aet-setor-info" style={{ marginBottom: 12 }}>
              <tbody>
                {qpsMeta!.n_respondentes != null && (
                  <tr><td className="k">Respondentes</td><td>{qpsMeta!.n_respondentes}{qpsMeta!.total_elegivel ? ` de ${qpsMeta!.total_elegivel} elegíveis` : ""}</td></tr>
                )}
                {(qpsMeta!.periodo_inicio || qpsMeta!.periodo_fim) && (
                  <tr><td className="k">Período</td><td>{fmtData(qpsMeta!.periodo_inicio)}{qpsMeta!.periodo_fim ? ` a ${fmtData(qpsMeta!.periodo_fim)}` : ""}</td></tr>
                )}
                {qpsMeta!.modo_aplicacao && <tr><td className="k">Modo de Aplicação</td><td>{qpsMeta!.modo_aplicacao}</td></tr>}
                {qpsMeta!.tecnico_aplicador && <tr><td className="k">Técnico Aplicador</td><td>{qpsMeta!.tecnico_aplicador}</td></tr>}
                {qpsMeta!.observacao_geral && <tr><td className="k">Observações</td><td>{qpsMeta!.observacao_geral}</td></tr>}
              </tbody>
            </table>
          </>
        )}

        {avaliados.length > 0 && (
          <>
            <h3 className="aet-sub">Resultado Geral por Fator</h3>
            <table className="aet-setor-tab aet-riscos" style={{ marginBottom: 12 }}>
              <thead><tr>{["Cód.", "Fator", "Média", "Zona de Risco", "Nível PGR"].map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {avaliados.map((fp) => {
                  const cfg = fatoresConfig.find((f) => f.codigo === fp.codigo_fator);
                  return (
                    <tr key={fp.codigo_fator}>
                      <td style={{ fontWeight: 700 }}>{fp.codigo_fator}</td>
                      <td>{cfg?.nome ?? fp.codigo_fator}</td>
                      <td style={{ textAlign: "center" }}>{fp.codigo_fator === "F13" ? "—" : fp.media != null ? fp.media.toFixed(2) : "—"}</td>
                      <td><ZonaTag zona={fp.zona} /></td>
                      <td>{nivelPgrFromZona(fp.zona)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}

        {comAnalise.length > 0 && (
          <>
            <h3 className="aet-sub">Análise Detalhada por Fator</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {comAnalise.map((fp) => {
                const cfg = fatoresConfig.find((f) => f.codigo === fp.codigo_fator);
                return (
                  <div key={fp.codigo_fator} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: 10 }}>
                    <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "#374151" }}>
                      {fp.codigo_fator} — {cfg?.nome ?? fp.codigo_fator} <ZonaTag zona={fp.zona} />
                    </p>
                    {fp.pergunta_critica && <p style={{ margin: "0 0 4px", fontSize: 11, fontStyle: "italic", color: "#4b5563" }}>“{fp.pergunta_critica}”</p>}
                    {fp.observacao && <p style={{ margin: 0, fontSize: 11, lineHeight: 1.5, color: "#374151" }}>{fp.observacao}</p>}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </>
    );
  }

  const temAssinaturaFixo = capitulos.some(
    (c) => c.tipo === "fixo" && c.slug_fixo === "aet_assinatura" && c.ativo !== false,
  );

  const folhaNode = (
    <FolhaAssinaturas
      signatarios={signatarios}
      empresa={folhaEmpresa}
      dataHoraAssinatura={dataHoraAssinatura}
      identificadorDocumento={identificadorDocumento}
      quebraAntes={false}
      numero={numPorSlug["aet_assinatura"]}
    />
  );

  function renderBloco(c: TextoPadraoCapitulo) {
    if (c.tipo !== "fixo") return renderEditavel(c);

    const intro = c.conteudo ? substituirVariaveisTexto(c.conteudo, valoresVars) : null;
    let conteudoFixo: React.ReactNode = null;
    switch (c.slug_fixo) {
      case "identificacao_empresa":
        conteudoFixo = <SecaoIdentificacaoEmpresa empresa={empresa} numero={numPorSlug["identificacao_empresa"]} />;
        break;
      case "sumario":
        conteudoFixo = <SecaoSumario titulos={sumarioTitulos} />;
        break;
      case "aet_agentes_ambientais":
        conteudoFixo = temSetores ? secaoSetores("aet_agentes_ambientais", "Agentes Ambientais para as Áreas Operacionais", intro, false) : null;
        break;
      case "aet_analise_ergonomica":
        conteudoFixo = temSetores ? secaoSetores("aet_analise_ergonomica", "Análises Ergonômicas do Trabalho", intro, true) : null;
        break;
      case "aet_psicossocial":
        conteudoFixo = fatoresPsi.some((f) => f.avaliado) ? secaoPsicossocial(intro) : null;
        break;
      case "aet_consideracoes_finais":
        conteudoFixo = consideracoes ? (
          <div className="aet-conc">
            <SectionTitulo titulo={numLabel(numPorSlug["aet_consideracoes_finais"], tituloPorSlug["aet_consideracoes_finais"] ?? "Considerações Finais")} />
            <p>{consideracoes}</p>
          </div>
        ) : null;
        break;
      case "aet_assinatura":
        conteudoFixo = folhaNode;
        break;
      default:
        conteudoFixo = null;
    }
    return conteudoFixo ? (
      <div key={c.id_capitulo} className={classeQuebraFixo(c)} data-slug={c.slug_fixo ?? undefined}>
        {conteudoFixo}
      </div>
    ) : null;
  }

  return (
    <>
      {/* eslint-disable-next-line react/no-danger */}
      <style dangerouslySetInnerHTML={{ __html: STYLE_BLOCK }} />
      {blocosOrdenados.map((c) => renderBloco(c))}
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
