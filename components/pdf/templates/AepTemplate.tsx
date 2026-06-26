/**
 * Template server-side do Laudo AEP para geração via Puppeteer.
 *
 * Restrições obrigatórias:
 *   - Sem "use client", sem hooks, sem imports "use client"
 *   - Apenas inline styles + um bloco <style> com as classes ABNT
 *   - Compatível com renderToStaticMarkup()
 */

import React from "react";
import FolhaAssinaturas from "@/components/pdf/FolhaAssinaturas";
import type { Signatario } from "@/components/pdf/FolhaAssinaturas";
import { SecaoIdentificacaoEmpresa, SecaoSumario } from "@/components/pdf/SecoesComuns";
import { classeQuebraFixo, numerarCapitulos, numLabel } from "@/components/pdf/templates/shared";
import type { Empresa } from "@/lib/supabase/types";
import type { TextoPadraoCapitulo } from "@/lib/textos-padrao/types";
import {
  substituirVariaveis,
  substituirVariaveisTexto,
} from "@/lib/textos-padrao/variaveis";

// ── Tipos locais (não importa de useAep.ts — é "use client") ──────────────────

type RespostaChecklist = "sim" | "nao" | "nao_aplica";

interface AepChecklistFisica {
  postura: RespostaChecklist;
  repetitividade: RespostaChecklist;
  levantamento_carga: RespostaChecklist;
  mobiliario: RespostaChecklist;
  esforco_fisico: RespostaChecklist;
  iluminacao: RespostaChecklist;
  ruido: RespostaChecklist;
  vibracao: RespostaChecklist;
  desconforto_termico: RespostaChecklist;
}

interface AepChecklistCognitiva {
  atencao_continua: RespostaChecklist;
  sobrecarga_mental: RespostaChecklist;
  pressao_psicologica: RespostaChecklist;
  excesso_informacoes: RespostaChecklist;
  ritmo_mental: RespostaChecklist;
}

interface AepChecklistOrganizacional {
  assedio: RespostaChecklist;
  falta_suporte: RespostaChecklist;
  gestao_mudancas: RespostaChecklist;
  clareza_papel: RespostaChecklist;
  recompensas: RespostaChecklist;
  baixo_controle: RespostaChecklist;
  justica_organizacional: RespostaChecklist;
  eventos_traumaticos: RespostaChecklist;
  subcarga: RespostaChecklist;
  sobrecarga: RespostaChecklist;
  maus_relacionamentos: RespostaChecklist;
  comunicacao_dificil: RespostaChecklist;
  trabalho_remoto: RespostaChecklist;
}

interface AepRisco {
  id: string;
  tipo: string;
  risco: string;
  classificacao_risco: string;
  medida_preventiva: string;
}

export interface AepSetorLocal {
  id: string;
  nome_setor: string;
  unidade: string;
  ghe: string;
  cargo: string;
  funcao: string;
  jornada: string;
  qtd_expostos: number;
  descricao_atividade: string;
  metodo_coleta?: string;
  trabalhadores_consultados?: string;
  observacoes_checklist?: Record<string, string>;
  cargos?: { id: string; cargo: string; descricao: string; quantidade: number }[];
  riscos: AepRisco[];
  checklist_fisica: AepChecklistFisica;
  checklist_cognitiva: AepChecklistCognitiva;
  checklist_organizacional: AepChecklistOrganizacional;
  parecer_tecnico: string;
  recomendacoes: string;
  necessita_aet: boolean;
}

export interface AepRelatorioLocal {
  id_relatorio: string;
  responsavel_elaboracao: string | null;
  titulo_profissional: string | null;
  registro_profissional: string | null;
  data_elaboracao: string | null;
  endereco_empresa: string | null;
  setores: AepSetorLocal[];
  conclusao: string | null;
  empresas?: { nome_empresa: string; cnpj: string | null } | null;
}

export interface AepTemplateProps {
  relatorio: AepRelatorioLocal;
  /** Empresa completa para a seção de sistema "Identificação da Empresa". */
  empresa?: Partial<Empresa> | null;
  /** Capítulos do módulo "aep" da tabela textos_padrao. */
  capitulos: TextoPadraoCapitulo[];
  /** Valores das variáveis {{...}} gerados por montarValoresAep(). */
  valoresVars: Record<string, string>;
  signatarios: Signatario[];
  /** Empresa para o campo de assinatura física (null → omite). */
  folhaEmpresa: { razaoSocial: string; cnpj: string } | null;
  dataHoraAssinatura: string;
  identificadorDocumento: string;
}

// ── Constantes ────────────────────────────────────────────────────────────────

const CHECKLIST_FISICA_LABELS: [keyof AepChecklistFisica, string][] = [
  ["postura", "Posturas inadequadas"],
  ["repetitividade", "Movimentos repetitivos"],
  ["levantamento_carga", "Levantamento de cargas"],
  ["mobiliario", "Mobiliário inadequado"],
  ["esforco_fisico", "Esforço físico elevado"],
  ["iluminacao", "Iluminação inadequada"],
  ["ruido", "Ruído adverso"],
  ["vibracao", "Vibração"],
  ["desconforto_termico", "Desconforto térmico"],
];

const CHECKLIST_COG_LABELS: [keyof AepChecklistCognitiva, string][] = [
  ["atencao_continua", "Atenção contínua"],
  ["sobrecarga_mental", "Sobrecarga mental"],
  ["pressao_psicologica", "Pressão psicológica"],
  ["excesso_informacoes", "Excesso de informações"],
  ["ritmo_mental", "Ritmo mental acelerado"],
];

const CHECKLIST_ORG_LABELS: [keyof AepChecklistOrganizacional, string][] = [
  ["assedio", "Assédio de qualquer natureza no trabalho"],
  ["falta_suporte", "Falta de suporte / apoio no trabalho"],
  ["gestao_mudancas", "Má gestão de mudanças organizacionais"],
  ["clareza_papel", "Baixa clareza de papel / função"],
  ["recompensas", "Baixas recompensas e reconhecimento"],
  ["baixo_controle", "Baixo controle no trabalho / Falta de autonomia"],
  ["justica_organizacional", "Baixa justiça organizacional"],
  ["eventos_traumaticos", "Eventos violentos ou traumáticos"],
  ["subcarga", "Baixa demanda no trabalho (Subcarga)"],
  ["sobrecarga", "Excesso de demandas no trabalho (Sobrecarga)"],
  ["maus_relacionamentos", "Maus relacionamentos no local de trabalho"],
  ["comunicacao_dificil", "Trabalho em condições de difícil comunicação"],
  ["trabalho_remoto", "Trabalho remoto e isolado"],
];

const RISCO_CORES: Record<string, { bg: string; text: string }> = {
  Trivial: { bg: "#dcfce7", text: "#166534" },
  "De Atenção": { bg: "#fef9c3", text: "#854d0e" },
  Moderado: { bg: "#ffedd5", text: "#c2410c" },
  Alto: { bg: "#fee2e2", text: "#991b1b" },
  Crítico: { bg: "#fecaca", text: "#7f1d1d" },
};

const ORDEM_RISCO = ["Crítico", "Alto", "Moderado", "De Atenção", "Trivial"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function riscoMaximoSetor(setor: AepSetorLocal): string | null {
  for (const c of ORDEM_RISCO) {
    if (setor.riscos.some((r) => r.classificacao_risco === c)) return c;
  }
  return null;
}

function labelResposta(v: RespostaChecklist) {
  if (v === "sim") return { label: "Sim", color: "#dc2626", fontWeight: 700 as const };
  if (v === "nao") return { label: "Não", color: "#15803d", fontWeight: 400 as const };
  return { label: "N/A", color: "#9ca3af", fontWeight: 400 as const };
}

// ── Bloco CSS inline ──────────────────────────────────────────────────────────

const STYLE_BLOCK = `
@page {
  size: A4 portrait;
}
@page textopadrao-paisagem {
  size: A4 landscape;
  margin: 2cm 3cm 3cm 2cm;
}
* { box-sizing: border-box; }
body {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 12px;
  line-height: 1.5;
  color: #111827;
  background: #fff;
  margin: 0;
  padding: 0;
}
/* ABNT — textos padrão */
.textos-padrao-capitulo {
  margin-bottom: 18pt;
  page-break-inside: auto;
}
.textos-padrao-capitulo--nova-pagina { page-break-before: always; }
.textos-padrao-capitulo--continua    { page-break-before: auto; margin-top: 16pt; }
.textos-padrao-capitulo--paisagem { page: textopadrao-paisagem; }
.textos-padrao-capitulo:last-child { page-break-after: always; }
.textos-padrao-capitulo--capa {
  page: capa;
  position: relative;
  margin: 0;
  padding: 0;
  height: 297mm;
  width: 210mm;
  overflow: hidden;
}
.textos-padrao-capitulo--paisagem.textos-padrao-capitulo--capa {
  margin: 0;
  height: 210mm;
  width: 297mm;
}
.textos-padrao-capitulo-bg-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  z-index: 0;
}
.textos-padrao-capitulo--capa .textos-padrao-capitulo-titulo { display: none; }
.textos-padrao-capitulo--capa .textos-padrao-caixa-texto { position: absolute; z-index: 1; }
.textos-padrao-capitulo-titulo {
  font-size: 14pt;
  font-weight: 700;
  color: #1e4d28;
  border-bottom: 2px solid #0ea5e9;
  padding-bottom: 4px;
  margin-bottom: 12pt;
}
.textos-padrao-capitulo-conteudo {
  font-size: 12pt;
  color: #1f2937;
  line-height: 1.5;
  text-align: justify;
}
.textos-padrao-capitulo-conteudo p       { margin: 0 0 12pt; text-indent: 1.25cm; text-align: justify; }
.textos-padrao-capitulo-conteudo h1      { font-size: 14pt; font-weight: 700; color: #1e4d28; margin: 18pt 0 6pt; }
.textos-padrao-capitulo-conteudo h2      { font-size: 13pt; font-weight: 700; color: #1e4d28; margin: 14pt 0 6pt; }
.textos-padrao-capitulo-conteudo h3      { font-size: 12pt; font-weight: 700; color: #1e4d28; margin: 12pt 0 4pt; }
.textos-padrao-capitulo-conteudo ul,
.textos-padrao-capitulo-conteudo ol      { margin: 0 0 12pt 1.25cm; padding: 0; }
.textos-padrao-capitulo-conteudo li      { margin: 2pt 0; }
.textos-padrao-capitulo-conteudo a       { color: #0ea5e9; text-decoration: underline; }
.textos-padrao-capitulo-conteudo img     { max-width: 100%; height: auto; border-radius: 4px; margin: 8pt 0; }
.textos-padrao-capitulo-conteudo table   { border-collapse: collapse; width: 100%; margin: 12pt 0; font-size: 10pt; }
.textos-padrao-capitulo-conteudo th,
.textos-padrao-capitulo-conteudo td      { border: 1px solid #999; padding: 5px 7px; vertical-align: top; }
.textos-padrao-capitulo-conteudo th      { background: #d4edda; color: #1e4d28; font-weight: 700; text-align: left; }
/* Break rules para o laudo */
.setor-block { break-inside: auto; }
`;

// ── Sub-componentes ───────────────────────────────────────────────────────────

function SectionTitulo({
  num,
  titulo,
}: {
  num?: string;
  titulo: string;
}) {
  return (
    <h2
      style={{
        marginBottom: 8,
        marginTop: 0,
        borderBottom: "2px solid #047857",
        paddingBottom: 4,
        fontSize: 14,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        color: "#065f46",
      }}
    >
      {num ? `${num} – ` : ""}
      {titulo}
    </h2>
  );
}

function SetorBlock({
  setor,
  idx,
}: {
  setor: AepSetorLocal;
  idx: number;
}) {
  const rMax = riscoMaximoSetor(setor);
  const rMaxCores = rMax ? RISCO_CORES[rMax] : null;

  return (
    <div className="setor-block" style={{ marginBottom: 24 }}>
      {/* Header do setor */}
      <div
        style={{
          marginBottom: 12,
          display: "flex",
          alignItems: "center",
          gap: 8,
          borderRadius: 8,
          backgroundColor: "#ecfdf5",
          padding: "8px 12px",
          border: "1px solid #a7f3d0",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            width: 24,
            height: 24,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "50%",
            backgroundColor: "#047857",
            fontSize: 11,
            fontWeight: 700,
            color: "#fff",
            flexShrink: 0,
          }}
        >
          {idx + 1}
        </span>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontWeight: 700, color: "#064e3b", fontSize: 13 }}>
            {setor.nome_setor || "—"}
          </p>
          <p style={{ margin: 0, fontSize: 10, color: "#047857" }}>
            {[setor.unidade, setor.ghe].filter(Boolean).join(" · ")}
          </p>
        </div>
        {rMax && rMaxCores && (
          <span
            style={{
              borderRadius: 9999,
              padding: "2px 8px",
              fontSize: 11,
              fontWeight: 700,
              backgroundColor: rMaxCores.bg,
              color: rMaxCores.text,
            }}
          >
            {rMax}
          </span>
        )}
        {setor.necessita_aet && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              borderRadius: 9999,
              backgroundColor: "#ffedd5",
              padding: "2px 8px",
              fontSize: 10,
              fontWeight: 700,
              color: "#c2410c",
            }}
          >
            ⚠ AET necessária
          </span>
        )}
      </div>

      {/* Tabela de identificação */}
      <table
        style={{
          marginBottom: 12,
          width: "100%",
          fontSize: 11,
          borderCollapse: "collapse",
          border: "1px solid #e5e7eb",
        }}
      >
        <tbody>
          <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
            <td
              style={{
                backgroundColor: "#f9fafb",
                padding: "4px 8px",
                fontWeight: 600,
                width: "25%",
              }}
            >
              Jornada
            </td>
            <td style={{ padding: "4px 8px" }}>{setor.jornada || "—"}</td>
            <td
              style={{
                backgroundColor: "#f9fafb",
                padding: "4px 8px",
                fontWeight: 600,
                width: "25%",
              }}
            >
              Qtd. Expostos
            </td>
            <td style={{ padding: "4px 8px" }}>{setor.qtd_expostos || "—"}</td>
          </tr>
          {setor.metodo_coleta && (
            <tr>
              <td style={{ backgroundColor: "#f9fafb", padding: "4px 8px", fontWeight: 600, verticalAlign: "top" }}>
                Método de coleta (NR-1)
              </td>
              <td style={{ padding: "4px 8px" }} colSpan={3}>
                {setor.metodo_coleta.split(/,\s*/).filter(Boolean).map((m, i) => (
                  <div key={i}>{m}</div>
                ))}
              </td>
            </tr>
          )}
          {setor.trabalhadores_consultados && (
            <tr>
              <td style={{ backgroundColor: "#f9fafb", padding: "4px 8px", fontWeight: 600, verticalAlign: "top" }}>
                Trabalhadores consultados
              </td>
              <td style={{ padding: "4px 8px" }} colSpan={3}>
                {setor.trabalhadores_consultados.split(/,\s*/).filter(Boolean).map((t, i) => (
                  <div key={i}>{t}</div>
                ))}
              </td>
            </tr>
          )}
          {setor.descricao_atividade && (
            <tr>
              <td
                style={{
                  backgroundColor: "#f9fafb",
                  padding: "4px 8px",
                  fontWeight: 600,
                  verticalAlign: "top",
                }}
              >
                Atividades
              </td>
              <td
                style={{ padding: "4px 8px" }}
                colSpan={3}
              >
                {setor.descricao_atividade}
              </td>
            </tr>
          )}
          {setor.cargos && setor.cargos.length > 0 && (
            <tr>
              <td style={{ backgroundColor: "#f9fafb", padding: "4px 8px", fontWeight: 600, verticalAlign: "top" }}>
                Cargos do setor
              </td>
              <td style={{ padding: "4px 8px" }} colSpan={3}>
                {setor.cargos
                  .filter((c) => c.cargo?.trim())
                  .map((c) => (
                    <div key={c.id}>
                      {c.cargo}
                      {c.quantidade ? ` (${c.quantidade})` : ""}
                      {c.descricao ? ` — ${c.descricao}` : ""}
                    </div>
                  ))}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Checklists — uma ergonomia embaixo da outra */}
      <div
        style={{
          marginBottom: 12,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          fontSize: 11,
        }}
      >
        {/* Física */}
        <div style={{ borderRadius: 4, border: "1px solid #bfdbfe" }}>
          <div
            style={{
              backgroundColor: "#eff6ff",
              padding: "4px 8px",
              fontWeight: 600,
              color: "#1e40af",
              fontSize: 10,
              textTransform: "uppercase",
            }}
          >
            Ergonomia Física
          </div>
          {CHECKLIST_FISICA_LABELS.map(([k, l]) => {
            const r = labelResposta(setor.checklist_fisica[k]);
            const obs = setor.observacoes_checklist?.[k];
            return (
              <div key={k} style={{ borderTop: "1px solid #f3f4f6", padding: "2px 8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#4b5563", flex: 1, minWidth: 0, wordBreak: "break-word", marginRight: 4 }}>{l}</span>
                  <span style={{ color: r.color, fontWeight: r.fontWeight, flexShrink: 0 }}>{r.label}</span>
                </div>
                {obs && <p style={{ margin: "2px 0 0", fontSize: 9, fontStyle: "italic", color: "#6b7280" }}>Obs.: {obs}</p>}
              </div>
            );
          })}
        </div>

        {/* Cognitiva */}
        <div style={{ borderRadius: 4, border: "1px solid #e9d5ff" }}>
          <div
            style={{
              backgroundColor: "#faf5ff",
              padding: "4px 8px",
              fontWeight: 600,
              color: "#6b21a8",
              fontSize: 10,
              textTransform: "uppercase",
            }}
          >
            Ergonomia Cognitiva
          </div>
          {CHECKLIST_COG_LABELS.map(([k, l]) => {
            const r = labelResposta(setor.checklist_cognitiva[k]);
            const obs = setor.observacoes_checklist?.[k];
            return (
              <div key={k} style={{ borderTop: "1px solid #f3f4f6", padding: "2px 8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#4b5563", flex: 1, minWidth: 0, wordBreak: "break-word", marginRight: 4 }}>{l}</span>
                  <span style={{ color: r.color, fontWeight: r.fontWeight, flexShrink: 0 }}>{r.label}</span>
                </div>
                {obs && <p style={{ margin: "2px 0 0", fontSize: 9, fontStyle: "italic", color: "#6b7280" }}>Obs.: {obs}</p>}
              </div>
            );
          })}
        </div>

        {/* Organizacional */}
        <div style={{ borderRadius: 4, border: "1px solid #fde68a" }}>
          <div
            style={{
              backgroundColor: "#fffbeb",
              padding: "4px 8px",
              fontWeight: 600,
              color: "#92400e",
              fontSize: 10,
              textTransform: "uppercase",
            }}
          >
            Ergonomia Organizacional
          </div>
          {CHECKLIST_ORG_LABELS.map(([k, l]) => {
            const r = labelResposta(setor.checklist_organizacional[k]);
            const obs = setor.observacoes_checklist?.[k];
            return (
              <div key={k} style={{ borderTop: "1px solid #f3f4f6", padding: "2px 8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#4b5563", flex: 1, minWidth: 0, wordBreak: "break-word", marginRight: 4 }}>{l}</span>
                  <span style={{ color: r.color, fontWeight: r.fontWeight, flexShrink: 0 }}>{r.label}</span>
                </div>
                {obs && <p style={{ margin: "2px 0 0", fontSize: 9, fontStyle: "italic", color: "#6b7280" }}>Obs.: {obs}</p>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Matriz de riscos */}
      {setor.riscos.length > 0 && (
        <table
          style={{
            marginBottom: 12,
            width: "100%",
            border: "1px solid #e5e7eb",
            fontSize: 11,
            borderCollapse: "collapse",
          }}
        >
          <thead>
            <tr style={{ backgroundColor: "#f3f4f6", textAlign: "left" }}>
              <th style={{ padding: "6px 8px", fontWeight: 600 }}>Tipo</th>
              <th style={{ padding: "6px 8px", fontWeight: 600 }}>Agente / Risco</th>
              <th style={{ padding: "6px 8px", fontWeight: 600 }}>Classificação</th>
              <th style={{ padding: "6px 8px", fontWeight: 600 }}>Medida Preventiva</th>
            </tr>
          </thead>
          <tbody>
            {setor.riscos.map((r) => {
              const cores = RISCO_CORES[r.classificacao_risco] ?? { bg: "transparent", text: "#374151" };
              return (
                <tr key={r.id} style={{ borderTop: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "4px 8px" }}>{r.tipo}</td>
                  <td style={{ padding: "4px 8px" }}>{r.risco}</td>
                  <td
                    style={{
                      padding: "4px 8px",
                      fontWeight: 600,
                      backgroundColor: cores.bg,
                      color: cores.text,
                    }}
                  >
                    {r.classificacao_risco}
                  </td>
                  <td style={{ padding: "4px 8px", color: "#4b5563" }}>
                    {r.medida_preventiva || "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Recomendações + Parecer — um embaixo do outro */}
      {(setor.parecer_tecnico || setor.recomendacoes) && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            fontSize: 11,
          }}
        >
          {setor.recomendacoes && (
            <div>
              <p style={{ margin: "0 0 4px", fontWeight: 600, color: "#374151" }}>
                Recomendações
              </p>
              <p style={{ margin: 0, color: "#4b5563", lineHeight: 1.6 }}>
                {setor.recomendacoes}
              </p>
            </div>
          )}
          {setor.parecer_tecnico && (
            <div>
              <p style={{ margin: "0 0 4px", fontWeight: 600, color: "#374151" }}>
                Parecer Técnico Preliminar
              </p>
              <p style={{ margin: 0, color: "#4b5563", lineHeight: 1.6 }}>
                {setor.parecer_tecnico}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function AepTemplate({
  relatorio: rel,
  empresa,
  capitulos,
  valoresVars,
  signatarios,
  folhaEmpresa,
  dataHoraAssinatura,
  identificadorDocumento,
}: AepTemplateProps) {
  const setoresComAet = rel.setores.filter((s) => s.necessita_aet);

  // Laudo montado como LISTA ÚNICA de blocos, na ordem definida em
  // textos_padrao(modulo='aep'). Cada bloco é um texto editável ou uma seção
  // do sistema (despachada pelo slug_fixo).
  const blocosOrdenados = [...capitulos]
    .filter((c) => c.ativo !== false)
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

  // Título cadastrado de cada seção fixa (p/ cabeçalho numerado no corpo).
  const tituloPorSlug: Record<string, string> = {};
  for (const c of capitulos) if (c.slug_fixo) tituloPorSlug[c.slug_fixo] = c.titulo;

  // Um capítulo só entra no Sumário/numeração se renderiza seção numerada.
  // Quando há capítulo "aep_assinatura", a FolhaAssinaturas é renderizada na
  // posição dele (numerada); senão, cai no fim como fallback, sem número.
  function renderizaNumerado(c: TextoPadraoCapitulo): boolean {
    if (c.ativo === false) return false;
    const ehCapa = !!c.bg_imagem_url || (c.titulo ?? "").trim().toLowerCase() === "capa";
    if (ehCapa) return false;
    if (c.tipo !== "fixo") return true;
    switch (c.slug_fixo) {
      case "identificacao_empresa": return true;
      case "aep_escalonamento":     return true;
      case "aep_triagem":           return true;
      // aep_consideracoes só renderiza seção quando há conclusão preenchida.
      case "aep_consideracoes":     return !!rel.conclusao?.trim();
      case "aep_assinatura":        return true;
      default:                      return false; // sumario
    }
  }

  const { numPorSlug, numPorId } = numerarCapitulos(capitulos, renderizaNumerado);

  // Títulos para o sumário — só capítulos que viram seção numerada.
  const sumarioTitulos = blocosOrdenados
    .filter((c) => renderizaNumerado(c))
    .map((c) =>
      c.tipo === "fixo" ? c.titulo : substituirVariaveisTexto(c.titulo, valoresVars),
    )
    .filter((t) => t && t.trim());

  function renderEditavel(c: TextoPadraoCapitulo) {
    const ehCapa = !!c.bg_imagem_url;
    const orientacao = c.orientacao ?? "retrato";
    const novaPagina = ehCapa || (c.quebra_pagina ?? "nova") === "nova";
    const conteudo = substituirVariaveis(c.conteudo, valoresVars);
    const titulo = numLabel(numPorId[c.id_capitulo], substituirVariaveisTexto(c.titulo, valoresVars));
    const classes = [
      "textos-padrao-capitulo",
      orientacao === "paisagem"
        ? "textos-padrao-capitulo--paisagem"
        : "textos-padrao-capitulo--retrato",
      novaPagina
        ? "textos-padrao-capitulo--nova-pagina"
        : "textos-padrao-capitulo--continua",
      ehCapa ? "textos-padrao-capitulo--capa" : "",
    ]
      .filter(Boolean)
      .join(" ");
    return (
      <article key={c.id_capitulo} className={classes}>
        {ehCapa && c.bg_imagem_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.bg_imagem_url} alt="" className="textos-padrao-capitulo-bg-img" />
        )}
        {!ehCapa && <h2 className="textos-padrao-capitulo-titulo">{titulo}</h2>}
        {ehCapa && c.caixas_texto && c.caixas_texto.length > 0 ? (
          c.caixas_texto.map((cx) => (
            <div
              key={cx.id}
              className="textos-padrao-caixa-texto"
              style={{
                left: `${cx.x}%`,
                top: `${cx.y}%`,
                width: `${cx.w ?? 40}%`,
                fontSize: cx.fontSize ?? 16,
                fontWeight: cx.bold ? 700 : 400,
                color: cx.color ?? "#ffffff",
                textAlign: (cx.align ?? "left") as React.CSSProperties["textAlign"],
                whiteSpace: "pre-wrap",
                lineHeight: 1.3,
              }}
            >
              {substituirVariaveisTexto(cx.conteudo, valoresVars)}
            </div>
          ))
        ) : !ehCapa ? (
          <div
            className="textos-padrao-capitulo-conteudo"
            dangerouslySetInnerHTML={{ __html: conteudo }}
          />
        ) : null}
      </article>
    );
  }

  const secaoIndicadores = (
    <div style={{ marginBottom: 24 }}>
      <SectionTitulo titulo={numLabel(numPorSlug["aep_escalonamento"], tituloPorSlug["aep_escalonamento"] ?? "Indicadores de Necessidade de AET Completa")} />
      {setoresComAet.length > 0 ? (
        <>
          <div
            style={{
              borderRadius: 12,
              border: "1px solid #fed7aa",
              backgroundColor: "#fff7ed",
              padding: 16,
              marginBottom: 12,
            }}
          >
            <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600, color: "#9a3412" }}>
              ⚠ Os setores abaixo apresentaram riscos que justificam elaboração de AET completa (NR-17):
            </p>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 11, color: "#c2410c", lineHeight: 1.8 }}>
              {setoresComAet.map((s) => (
                <li key={s.id}>
                  <strong>{s.nome_setor}</strong>
                  {s.cargo && ` — ${s.cargo}`}
                  {" — "}Risco máximo:{" "}
                  <span style={{ fontWeight: 600 }}>{riscoMaximoSetor(s)}</span>
                </li>
              ))}
            </ul>
          </div>
          <p style={{ margin: 0, fontSize: 11, color: "#4b5563", lineHeight: 1.7 }}>
            Conforme NR-17 e NR-01 (GRO/PGR), a presença de riscos classificados como Alto ou Crítico, ou a convergência de múltiplos riscos Moderados, indica a necessidade de aprofundamento por meio da Análise Ergonômica do Trabalho completa, com avaliação postural (OWAS), análise biomecânica, medições ambientais e elaboração de laudo técnico detalhado.
          </p>
        </>
      ) : (
        <p style={{ margin: 0, fontSize: 11, color: "#4b5563", lineHeight: 1.7 }}>
          Nenhum setor analisado apresentou riscos que justifiquem a elaboração de AET completa (NR-17) nesta avaliação.
        </p>
      )}
    </div>
  );

  const secaoTriagem = (
    <div style={{ marginBottom: 24 }}>
      <SectionTitulo titulo={numLabel(numPorSlug["aep_triagem"], tituloPorSlug["aep_triagem"] ?? "Triagem Ergonômica por Setor")} />
      {rel.setores.map((setor, idx) => (
        <SetorBlock key={setor.id} setor={setor} idx={idx} />
      ))}
    </div>
  );

  const secaoConsideracoes = rel.conclusao?.trim() ? (
    <div style={{ marginBottom: 24 }}>
      <SectionTitulo titulo={numLabel(numPorSlug["aep_consideracoes"], tituloPorSlug["aep_consideracoes"] ?? "Considerações Finais e Encaminhamentos")} />
      <p style={{ margin: 0, fontSize: 11, lineHeight: 1.7, color: "#374151", whiteSpace: "pre-line" }}>
        {rel.conclusao}
      </p>
    </div>
  ) : null;

  const temAssinaturaFixo = capitulos.some(
    (c) => c.tipo === "fixo" && c.slug_fixo === "aep_assinatura" && c.ativo !== false,
  );

  // Folha de assinaturas: quando há capítulo "aep_assinatura", renderiza na
  // posição dele (numerada, quebra controlada pelo wrapper); senão, cai no fim.
  const folhaNode = (
    <FolhaAssinaturas
      signatarios={signatarios}
      empresa={folhaEmpresa}
      dataHoraAssinatura={dataHoraAssinatura}
      identificadorDocumento={identificadorDocumento}
      quebraAntes={false}
      numero={numPorSlug["aep_assinatura"]}
    />
  );

  function renderBloco(c: TextoPadraoCapitulo) {
    if (c.tipo === "fixo") {
      let conteudoFixo: React.ReactNode = null;
      switch (c.slug_fixo) {
        case "identificacao_empresa":
          conteudoFixo = <SecaoIdentificacaoEmpresa empresa={empresa} numero={numPorSlug["identificacao_empresa"]} />;
          break;
        case "sumario":
          conteudoFixo = <SecaoSumario titulos={sumarioTitulos} />;
          break;
        case "aep_escalonamento":
          conteudoFixo = secaoIndicadores;
          break;
        case "aep_triagem":
          conteudoFixo = secaoTriagem;
          break;
        case "aep_consideracoes":
          conteudoFixo = secaoConsideracoes;
          break;
        case "aep_assinatura":
          conteudoFixo = folhaNode;
          break;
        default:
          conteudoFixo = null;
      }
      return conteudoFixo ? (
        <div key={c.id_capitulo} className={classeQuebraFixo(c)} data-slug={c.slug_fixo ?? undefined}>{conteudoFixo}</div>
      ) : null;
    }
    return renderEditavel(c);
  }

  return (
    <>
      {/* eslint-disable-next-line react/no-danger */}
      <style dangerouslySetInnerHTML={{ __html: STYLE_BLOCK }} />

      {/* Corpo do laudo — blocos na ordem definida (textos editáveis +
          seções do sistema). O laudo começa pela capa (capítulo editável),
          como no Não-Conformidade. */}
      {blocosOrdenados.map((c) => renderBloco(c))}

      {/* Fallback: sem capítulo de assinatura ativo, renderiza a folha no fim. */}
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
