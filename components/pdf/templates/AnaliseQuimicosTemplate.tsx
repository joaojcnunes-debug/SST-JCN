import React from "react";
import FolhaAssinaturas from "@/components/pdf/FolhaAssinaturas";
import type { Signatario } from "@/components/pdf/FolhaAssinaturas";
import { SecaoIdentificacaoEmpresa, SecaoSumario } from "@/components/pdf/SecoesComuns";
import type { Empresa } from "@/lib/supabase/types";
import type { TextoPadraoCapitulo } from "@/lib/textos-padrao/types";
import type { ConclusaoRapidaQuimico, CondicoesUsoQuimico } from "@/lib/supabase/types";
import { substituirVariaveisTexto } from "@/lib/textos-padrao/variaveis";
import { TP_STYLE, renderEditaveis, renderUnificado, temSecoesSistema, numerarCapitulos, numLabel } from "./shared";

export interface AnaliseQuimicosTemplateProps {
  analise: {
    titulo: string;
    nome_quimico: string | null;
    numero_cas: string | null;
    formula_quimica: string | null;
    forma_fisica: string | null;
    concentracao: string | null;
    modo: string;
    fonte_arquivo: string | null;
    condicoes_uso: CondicoesUsoQuimico | null;
    conclusao_rapida: ConclusaoRapidaQuimico | null;
    usuario_nome: string | null;
  };
  empresa?: Partial<Empresa> | null;
  capitulos: TextoPadraoCapitulo[];
  valores: Record<string, string>;
  signatarios: Signatario[];
  folhaEmpresa: { razaoSocial: string; cnpj: string } | null;
  dataHoraAssinatura: string;
  identificadorDocumento: string;
}

const VERDE = "#0ea5e9";

const STYLE_BLOCK = `
* { box-sizing: border-box; }
${TP_STYLE}
.q-sec { margin-bottom: 14pt; page-break-inside: avoid; }
.q-sec h3 { font-size: 12.5pt; font-weight: 700; color: ${VERDE}; border-bottom: 2px solid ${VERDE}; padding-bottom: 3px; margin: 0 0 6pt; }
.q-tbl { width: 100%; border-collapse: collapse; font-size: 10.5pt; margin: 4pt 0; }
.q-tbl td { border: 1px solid #e5e7eb; padding: 4px 8px; vertical-align: top; }
.q-tbl .rot { width: 40%; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; color: #4b5563; }
.q-tbl tr:nth-child(even) td { background: #f9fafb; }
.q-comp { width: 100%; border-collapse: collapse; font-size: 10pt; margin: 4pt 0; }
.q-comp th { border: 1px solid ${VERDE}; background: ${VERDE}; color: #fff; padding: 4px 8px; text-align: left; font-size: 9px; text-transform: uppercase; }
.q-comp td { border: 1px solid #e5e7eb; padding: 4px 8px; }
.q-comp tr:nth-child(even) td { background: #f9fafb; }
.q-card { border: 1px solid; border-radius: 6px; padding: 8px 10px; margin: 4pt 0; font-size: 10.5pt; }
.q-card .ct { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; margin: 0 0 3px; opacity: .8; }
.q-card ul { margin: 0; padding-left: 16px; }
.q-fund { border: 1px solid #bae6fd; background: #f0f9ff; color: #0c4a6e; border-radius: 6px; padding: 8px 10px; font-size: 10.5pt; margin: 4pt 0; }
.q-parecer { border-left: 4px solid ${VERDE}; background: #f0fdf9; padding: 10px 12px; font-size: 10.5pt; color: #111827; line-height: 1.5; margin: 4pt 0; }
.q-parecer p { margin: 0 0 8px; }
`;

function humanize(value: string): string {
  return value
    .replace(/CONSULTAR_TABELA_OFICIAL/gi, "Consultar tabela oficial")
    .replace(/CONSULTAR_DECRETO_VIGENTE/gi, "Consultar decreto vigente")
    .replace(/CONSULTAR_TABELA_GFIP/gi, "Consultar tabela GFIP")
    .replace(/\bINCONCLUSIVO\b/g, "Inconclusivo");
}

function corDestaque(v: string): string {
  const upper = v.toUpperCase();
  if (upper.startsWith("SIM")) return "#047857";
  if (upper.startsWith("NÃO") || upper.startsWith("NAO")) return "#b91c1c";
  if (upper.includes("INCONCLUSIVO") || upper.includes("CONSULTAR")) return "#b45309";
  return "#111827";
}

type Item = { label: string; value?: string | null; destaque?: boolean };

function DataGrid({ items }: { items: Item[] }) {
  const vis = items.filter((i) => i.value && i.value.trim().length > 0);
  if (vis.length === 0) return null;
  return (
    <table className="q-tbl">
      <tbody>
        {vis.map((it, i) => {
          const v = humanize((it.value ?? "").trim());
          return (
            <tr key={i}>
              <td className="rot">{it.label}</td>
              <td style={{ fontWeight: it.destaque ? 700 : 400, color: it.destaque ? corDestaque(v) : "#111827" }}>{v}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function CardLista({ titulo, texto, cor }: { titulo: string; texto?: string | null; cor: string }) {
  if (!texto || !texto.trim() || texto.toUpperCase() === "N/A") return null;
  const itens = texto.split(/[;•]\s*/).map((s) => humanize(s.trim())).filter(Boolean);
  return (
    <div className="q-card" style={{ borderColor: `${cor}55`, background: `${cor}11`, color: cor }}>
      <p className="ct">{titulo}</p>
      {itens.length > 1 ? (
        <ul>{itens.map((it, i) => <li key={i}>{it}</li>)}</ul>
      ) : (
        <p style={{ margin: 0 }}>{humanize(texto)}</p>
      )}
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="q-sec">
      <h3>{titulo}</h3>
      {children}
    </div>
  );
}

function reconstruirComponentes(a: AnaliseQuimicosTemplateProps["analise"]) {
  const split = (s: string | null) => (s ? s.split(/;\s*/).map((x) => x.trim()).filter(Boolean) : []);
  const nomes = split(a.nome_quimico);
  const cass = split(a.numero_cas);
  const formulas = split(a.formula_quimica);
  const concs = split(a.concentracao);
  const max = Math.max(nomes.length, cass.length, formulas.length, concs.length);
  if (max <= 1) return null;
  return Array.from({ length: max }, (_, i) => ({
    nome: nomes[i] || "—", cas: cass[i] || "—", formula: formulas[i] || "—", concentracao: concs[i] || "—",
  }));
}

export default function AnaliseQuimicosTemplate({
  analise,
  empresa,
  capitulos,
  valores,
  signatarios,
  folhaEmpresa,
  dataHoraAssinatura,
  identificadorDocumento,
}: AnaliseQuimicosTemplateProps) {
  const c = analise.conclusao_rapida ?? {};
  const componentes = reconstruirComponentes(analise);
  const cu = analise.condicoes_uso;

  const quadro = [
    { item: "Precisa de medição?", valor: c.medicao_necessaria },
    { item: "É insalubre (NR-15)?", valor: c.insalubridade_nr15 },
    { item: "Grau de insalubridade", valor: c.insalubridade_grau },
    { item: "Aposentadoria especial", valor: c.aposentadoria_especial },
    { item: "Tempo de exposição (aposentadoria)", valor: c.aposentadoria_tempo },
    { item: "Decreto 3.048 (Anexo IV)", valor: c.decreto_3048 },
    { item: "Código GFIP", valor: c.codigo_gfip },
    { item: "Código eSocial Tab.24", valor: c.esocial_tab24 },
    { item: "Carcinogenicidade", valor: c.carcinogenico },
    { item: "Periculosidade NR-16", valor: c.periculosidade_nr16 },
    { item: "Óleo mineral (se aplicável)", valor: c.oleo_mineral },
    { item: "Metodologia de medição", valor: c.metodologia },
  ].filter((l) => l.valor && l.valor.trim().length > 0);

  // Blocos ordenados (mesma regra de renderUnificado) p/ montar o sumário.
  const blocos = [...capitulos]
    .filter((c) => c.ativo !== false)
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

  // Título cadastrado de cada seção fixa (p/ cabeçalho numerado no corpo).
  const tituloPorSlug: Record<string, string> = {};
  for (const cap of capitulos) if (cap.slug_fixo) tituloPorSlug[cap.slug_fixo] = cap.titulo;

  // Um capítulo só entra no Sumário/numeração se renderiza seção numerada.
  // A folha de assinaturas é hardcoded no fim — não há capítulo de assinatura.
  function renderizaNumerado(cap: TextoPadraoCapitulo): boolean {
    if (cap.ativo === false) return false;
    const ehCapa = !!cap.bg_imagem_url || (cap.titulo ?? "").trim().toLowerCase() === "capa";
    if (ehCapa) return false;
    if (cap.tipo !== "fixo") return true;
    switch (cap.slug_fixo) {
      case "identificacao_empresa": return true;
      case "quimicos_analise":      return true;
      case "quimicos_assinatura":   return true;
      default:                      return false; // sumário não numera
    }
  }

  const { numPorSlug, numPorId } = numerarCapitulos(capitulos, renderizaNumerado);

  // Títulos do sumário — só capítulos que viram seção numerada (mesmo predicado).
  const sumarioTitulos = blocos
    .filter((cap) => renderizaNumerado(cap))
    .map((cap) =>
      cap.tipo === "fixo" ? cap.titulo : substituirVariaveisTexto(cap.titulo, valores),
    )
    .filter((t) => t && t.trim());

  // Corpo da análise (seção do sistema "quimicos_analise"): o laudo técnico
  // completo gerado automaticamente.
  const analiseBodyNode = (
    <>
      <Secao titulo="1. Identificação do Agente Químico">
        <DataGrid
          items={[
            { label: "Empresa", value: empresa?.nome_empresa },
            { label: "CNPJ", value: empresa?.cnpj },
            { label: "Produto / Título da análise", value: analise.titulo },
            { label: "Forma física", value: analise.forma_fisica },
            ...(componentes ? [] : [
              { label: "Nome químico", value: analise.nome_quimico },
              { label: "Número CAS", value: analise.numero_cas },
              { label: "Fórmula química", value: analise.formula_quimica },
              { label: "Concentração", value: analise.concentracao },
            ]),
          ]}
        />
        {componentes && (
          <div style={{ marginTop: 6 }}>
            <p style={{ margin: "0 0 3px", fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: "#4b5563" }}>
              Componentes da mistura ({componentes.length})
            </p>
            <table className="q-comp">
              <thead>
                <tr><th>#</th><th>Nome Químico</th><th>Número CAS</th><th>Fórmula</th><th>Concentração</th></tr>
              </thead>
              <tbody>
                {componentes.map((row, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600, color: "#6b7280" }}>{idx + 1}</td>
                    <td>{row.nome}</td>
                    <td style={{ fontFamily: "monospace" }}>{row.cas}</td>
                    <td>{row.formula}</td>
                    <td>{row.concentracao}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Secao>

      {cu && (
        <Secao titulo="2. Condições de Uso Informadas">
          <DataGrid
            items={[
              { label: "Atividade / Processo", value: cu.atividade },
              { label: "Frequência de exposição", value: cu.frequencia },
              { label: "Duração por turno", value: cu.duracao },
              { label: "Tipo de ventilação", value: cu.ventilacao },
              { label: "Geração de névoa/vapor", value: cu.geracao_nevoa_vapor },
              { label: "EPIs já utilizados", value: cu.epis_utilizados },
            ]}
          />
        </Secao>
      )}

      <Secao titulo="3. Análise de Insalubridade (NR-15)">
        <DataGrid
          items={[
            { label: "É insalubre?", value: c.insalubridade_nr15, destaque: true },
            { label: "Grau", value: c.insalubridade_grau, destaque: true },
            { label: "Anexo aplicável", value: c.insalubridade_anexo },
            { label: "Limite de exposição", value: c.limite_exposicao },
          ]}
        />
        {c.insalubridade_fundamentacao && c.insalubridade_fundamentacao.trim() && (
          <div className="q-fund">
            <p style={{ margin: "0 0 3px", fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: "#0369a1" }}>Fundamentação</p>
            <p style={{ margin: 0 }}>{humanize(c.insalubridade_fundamentacao)}</p>
          </div>
        )}
      </Secao>

      <Secao titulo="4. Análise de Periculosidade (NR-16)">
        <DataGrid items={[{ label: "Caracteriza periculosidade?", value: c.periculosidade_nr16, destaque: true }]} />
      </Secao>

      <Secao titulo="5. Aposentadoria Especial e Enquadramento Previdenciário">
        <DataGrid
          items={[
            { label: "Contempla aposentadoria especial?", value: c.aposentadoria_especial, destaque: true },
            { label: "Tempo de exposição", value: c.aposentadoria_tempo },
            { label: "Decreto 3.048 (Anexo IV)", value: c.decreto_3048 },
            { label: "Código GFIP", value: c.codigo_gfip },
            { label: "eSocial Tab.24 (S-2240)", value: c.esocial_tab24 },
          ]}
        />
      </Secao>

      <Secao titulo="6. Carcinogenicidade">
        <DataGrid items={[{ label: "Classificado como carcinogênico?", value: c.carcinogenico, destaque: true }]} />
      </Secao>

      {c.oleo_mineral && c.oleo_mineral.toUpperCase() !== "N/A" && (
        <Secao titulo="7. Óleo Mineral — Classificação">
          <p style={{ fontSize: "10.5pt", color: "#111827", whiteSpace: "pre-wrap" }}>{humanize(c.oleo_mineral)}</p>
        </Secao>
      )}

      <Secao titulo="8. Medidas de Controle Indicadas">
        <CardLista titulo="EPIs Necessários" texto={c.epi_necessarios} cor="#0284c7" />
        <CardLista titulo="EPCs Necessários" texto={c.epc_necessarios} cor="#0284c7" />
        <CardLista titulo="Medidas de Controle (administrativas e de engenharia)" texto={c.medidas_controle} cor="#047857" />
      </Secao>

      <Secao titulo="9. Procedimentos de Emergência e Primeiros Socorros">
        {c.emergencia_acidente && c.emergencia_acidente.trim() ? (
          <div className="q-parecer">{humanize(c.emergencia_acidente)}</div>
        ) : (
          <p style={{ fontSize: "10.5pt", fontStyle: "italic", color: "#9ca3af" }}>Não informado pela análise.</p>
        )}
      </Secao>

      <Secao titulo="10. Avaliação Quantitativa / Medição Ambiental">
        <DataGrid
          items={[
            { label: "Necessita medição?", value: c.medicao_necessaria, destaque: true },
            { label: "Metodologia", value: c.metodologia },
          ]}
        />
        <CardLista titulo="Procedimento de medição" texto={c.como_medir} cor="#7c3aed" />
      </Secao>

      <Secao titulo="11. Parecer Técnico (PPP / LTCAT / PGR)">
        {c.resumo_tecnico && c.resumo_tecnico.trim() ? (
          <div className="q-parecer">
            {humanize(c.resumo_tecnico.trim()).split(/\n\s*\n+/).map((p, i) => <p key={i}>{p.trim()}</p>)}
          </div>
        ) : (
          <p style={{ fontSize: "10.5pt", fontStyle: "italic", color: "#9ca3af" }}>Parecer técnico não disponível para esta análise.</p>
        )}
      </Secao>

      {quadro.length > 0 && (
        <Secao titulo="12. Quadro Decisório (Resumo Geral)">
          <table className="q-comp">
            <thead><tr><th>Item</th><th>Conclusão</th></tr></thead>
            <tbody>
              {quadro.map((l, idx) => {
                const v = humanize((l.valor ?? "").trim());
                return (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600, color: "#374151" }}>{l.item}</td>
                    <td style={{ fontWeight: 600, color: corDestaque(v) }}>{v}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Secao>
      )}
    </>
  );

  const temAssinaturaFixo = capitulos.some(
    (cap) => cap.tipo === "fixo" && cap.slug_fixo === "quimicos_assinatura" && cap.ativo !== false,
  );
  const folhaNode = (
    <FolhaAssinaturas
      signatarios={signatarios}
      empresa={folhaEmpresa}
      dataHoraAssinatura={dataHoraAssinatura}
      identificadorDocumento={identificadorDocumento}
      quebraAntes={false}
      numero={numPorSlug["quimicos_assinatura"]}
    />
  );

  function renderSecaoQ(slug: string): React.ReactNode {
    switch (slug) {
      case "identificacao_empresa": return <SecaoIdentificacaoEmpresa empresa={empresa} numero={numPorSlug["identificacao_empresa"]} />;
      case "sumario":               return <SecaoSumario titulos={sumarioTitulos} />;
      case "quimicos_analise":      return (
        <div className="tp-cap">
          <h2>{numLabel(numPorSlug["quimicos_analise"], tituloPorSlug["quimicos_analise"] ?? "Análise Técnica")}</h2>
          {analiseBodyNode}
        </div>
      );
      case "quimicos_assinatura":   return folhaNode;
      default:                      return null;
    }
  }

  const corpo = temSecoesSistema(capitulos)
    ? renderUnificado(capitulos, valores, renderSecaoQ, { numPorId })
    : (
      <>
        {renderEditaveis(capitulos, valores, "inicio")}
        {analiseBodyNode}
        {renderEditaveis(capitulos, valores, "fim")}
      </>
    );

  return (
    <>
      {/* eslint-disable-next-line react/no-danger */}
      <style dangerouslySetInnerHTML={{ __html: STYLE_BLOCK }} />

      {corpo}

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
