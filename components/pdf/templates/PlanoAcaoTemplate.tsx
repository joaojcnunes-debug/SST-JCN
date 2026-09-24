import React from "react";
import FolhaAssinaturas from "@/components/pdf/FolhaAssinaturas";
import type { Signatario } from "@/components/pdf/FolhaAssinaturas";
import { SecaoIdentificacaoEmpresa, SecaoSumario } from "@/components/pdf/SecoesComuns";
import { classeQuebraFixoNova, numerarCapitulos, numLabel, renderEditavelUm } from "@/components/pdf/templates/shared";
import type { Empresa } from "@/lib/supabase/types";
import type { TextoPadraoCapitulo } from "@/lib/textos-padrao/types";
import { substituirVariaveisTexto } from "@/lib/textos-padrao/variaveis";

/** Uma linha do plano, já resolvida pela rota (setor vira nome, não id). */
export interface PlanoAcaoItemLocal {
  id_acao: string;
  what_acao: string;
  why_justificativa: string | null;
  where_local: string | null;
  when_prazo: string | null;
  who_responsavel: string | null;
  how_metodo: string | null;
  how_much_custo: string | null;
  status: string;
  prioridade: string;
  setor_nome: string | null;
  /** Ação nascida de um risco de inspeção — vira nota na coluna "O quê". */
  vinculada_a_risco: boolean;
}

export interface PlanoAcaoTemplateProps {
  empresa?: Partial<Empresa> | null;
  acoes: PlanoAcaoItemLocal[];
  /** Recorte aplicado na tela, impresso abaixo do título (ex: "Status: Pendente"). */
  filtrosAplicados: string[];
  capitulos: TextoPadraoCapitulo[];
  valores: Record<string, string>;
  signatarios: Signatario[];
  folhaEmpresa: { razaoSocial: string; cnpj: string } | null;
  dataHoraAssinatura: string;
  identificadorDocumento: string;
}

const VERDE = "#0ea5e9";

const STYLE_BLOCK = `
/* Documento inteiro em PAISAGEM. A tabela 5W2H tem 9 colunas — em retrato
   sobravam ~177mm de largura útil e o texto de "O quê"/"Por quê" descia em
   coluna estreita; deitada, a folha dá ~267mm. Declarado aqui, e não na rota, porque só o CSS controla
   orientação (o \`format: 'A4'\` do Puppeteer sobrescreveria); a rota gera com
   capaFullBleed/preferCssPageSize, e este @page vence o injetado pelo gerarPdf
   por vir depois no documento — mesmo idioma do DRPS e do AEP. */
@page { size: A4 landscape; }
@page capa { size: A4 landscape; margin: 0; }
* { box-sizing: border-box; }
.textos-padrao-capitulo--nova-pagina { page-break-before: always; }
.textos-padrao-capitulo--continua { page-break-before: auto; }
.tp-cap { margin-bottom: 16pt; }
.tp-cap h2 { font-size: 13pt; font-weight: 700; color: ${VERDE}; border-bottom: 2px solid ${VERDE}; padding-bottom: 3px; margin: 0 0 8pt; }
.tp-cap .corpo { font-size: 11pt; color: #1f2937; line-height: 1.5; text-align: justify; }
.tp-cap .corpo p { margin: 0 0 8pt; }
.tp-cap .corpo table { border-collapse: collapse; width: 100%; margin: 8pt 0; font-size: 10pt; }
.tp-cap .corpo th, .tp-cap .corpo td { border: 1px solid #999; padding: 4px 6px; }
/* Capa deitada junto com o resto — 297x210mm, e não o 210x297mm dos outros laudos. */
.tp-capa { page: capa; position: relative; width: 297mm; height: 210mm; overflow: hidden; page-break-after: always; }
.tp-capa img.bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center; display: block; z-index: 0; }
.tp-capa .caixa { position: absolute; z-index: 1; white-space: pre-wrap; line-height: 1.3; }
.sec-titulo { font-size: 13pt; font-weight: 700; color: ${VERDE}; border-bottom: 2px solid ${VERDE}; padding-bottom: 3px; margin: 0 0 8pt; }
.pa-filtros { font-size: 9.5pt; color: #6b7280; margin: 0 0 8pt; }
.pa-vazio { border: 1px dashed #d1d5db; background: #f9fafb; border-radius: 6px; padding: 12px; text-align: center; font-size: 10pt; color: #6b7280; }
`;

const PRIO_COR: Record<string, string> = {
  Critica: "#b91c1c",
  Alta: "#c2410c",
  Media: "#b45309",
  Baixa: "#047857",
};
const PRIO_LABEL: Record<string, string> = {
  Critica: "Crítica",
  Alta: "Alta",
  Media: "Média",
  Baixa: "Baixa",
};
const STATUS_COR: Record<string, string> = {
  Pendente: "#b45309",
  "Em Andamento": "#1d4ed8",
  Concluida: "#047857",
  Cancelada: "#6b7280",
};
const STATUS_LABEL: Record<string, string> = {
  Pendente: "Pendente",
  "Em Andamento": "Em Andamento",
  Concluida: "Concluída",
  Cancelada: "Cancelada",
};

function fmtPrazo(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso + "T00:00").toLocaleDateString("pt-BR");
}

/** Contadores por status — dão a leitura rápida do andamento do plano. */
function ResumoCards({ acoes }: { acoes: PlanoAcaoItemLocal[] }) {
  const total = acoes.length;
  const conta = (s: string) => acoes.filter((a) => a.status === s).length;
  const concluidas = conta("Concluida");
  const pct = total > 0 ? Math.round((concluidas / total) * 100) : 0;
  const card = (label: string, valor: string, bg: string, fg: string) => (
    <div style={{ flex: 1, border: `1px solid ${fg}33`, background: bg, borderRadius: 8, padding: 8, textAlign: "center" }}>
      <p style={{ margin: 0, fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: fg }}>{label}</p>
      <p style={{ margin: "2px 0 0", fontSize: 20, fontWeight: 700, color: fg }}>{valor}</p>
    </div>
  );
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
      {card("Pendentes", String(conta("Pendente")), "#fffbeb", "#b45309")}
      {card("Em andamento", String(conta("Em Andamento")), "#eff6ff", "#1d4ed8")}
      {card("Concluídas", String(concluidas), "#ecfdf5", "#047857")}
      {card("Execução", `${pct}%`, "#f0fdfa", VERDE)}
    </div>
  );
}

function TabelaSection({
  acoes,
  filtrosAplicados,
  titulo,
}: {
  acoes: PlanoAcaoItemLocal[];
  filtrosAplicados: string[];
  titulo: string;
}) {
  const TH: React.CSSProperties = {
    borderBottom: `1.5px solid ${VERDE}`,
    borderRight: "1px solid #e5e7eb",
    padding: "5px 6px",
    textAlign: "left",
    color: VERDE,
    fontSize: 8,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: ".02em",
    background: "#f0fdf4",
  };
  const TD: React.CSSProperties = {
    borderBottom: "1px solid #eef0f2",
    borderRight: "1px solid #f3f4f6",
    padding: "5px 6px",
    color: "#111827",
    fontSize: 8.5,
    verticalAlign: "top",
    wordBreak: "break-word",
  };
  const cols = ["7%", "20%", "16%", "13%", "11%", "10%", "8%", "8%", "7%"];
  const heads = ["Prior.", "O quê", "Por quê", "Como", "Onde", "Quem", "Quando", "Quanto", "Status"];

  return (
    <div style={{ marginBottom: 16 }}>
      <p className="sec-titulo">{titulo} ({acoes.length})</p>
      {filtrosAplicados.length > 0 && (
        <p className="pa-filtros">Recorte: {filtrosAplicados.join(" · ")}</p>
      )}
      {acoes.length === 0 ? (
        <p className="pa-vazio">Nenhuma ação cadastrada para este recorte.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <colgroup>{cols.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
          <thead>
            <tr>{heads.map((h) => <th key={h} style={TH}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {acoes.map((a) => (
              <tr key={a.id_acao} style={{ pageBreakInside: "avoid" }}>
                <td style={{ ...TD, color: PRIO_COR[a.prioridade] ?? "#b45309", fontWeight: 700 }}>
                  {PRIO_LABEL[a.prioridade] ?? a.prioridade}
                </td>
                <td style={{ ...TD, fontWeight: 600 }}>
                  {a.what_acao}
                  {a.vinculada_a_risco && (
                    <span style={{ display: "block", fontWeight: 400, fontSize: 7, color: "#6b7280" }}>
                      Risco vinculado
                    </span>
                  )}
                </td>
                <td style={TD}>{a.why_justificativa || "—"}</td>
                <td style={TD}>{a.how_metodo || "—"}</td>
                <td style={TD}>
                  {a.where_local || "—"}
                  {a.setor_nome && (
                    <span style={{ display: "block", fontSize: 7.5, color: "#6b7280" }}>{a.setor_nome}</span>
                  )}
                </td>
                <td style={TD}>{a.who_responsavel || "—"}</td>
                <td style={TD}>{fmtPrazo(a.when_prazo)}</td>
                <td style={TD}>{a.how_much_custo || "—"}</td>
                <td style={{ ...TD, color: STATUS_COR[a.status] ?? "#b45309", fontWeight: 700 }}>
                  {STATUS_LABEL[a.status] ?? a.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function PlanoAcaoTemplate({
  empresa,
  acoes,
  filtrosAplicados,
  capitulos,
  valores,
  signatarios,
  folhaEmpresa,
  dataHoraAssinatura,
  identificadorDocumento,
}: PlanoAcaoTemplateProps) {
  const blocos = [...capitulos]
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
      case "identificacao_empresa":  return true;
      case "plano_acao_tabela":      return true;
      case "plano_acao_assinatura":  return true;
      // sumário não numera.
      default:                       return false;
    }
  }

  const { numPorSlug, numPorId } = numerarCapitulos(capitulos, renderizaNumerado);

  const sumarioTitulos = blocos
    .filter((c) => renderizaNumerado(c))
    .map((c) => (c.tipo === "fixo" ? c.titulo : substituirVariaveisTexto(c.titulo, valores)))
    .filter((t) => t && t.trim());

  const temAssinaturaFixo = capitulos.some(
    (c) => c.tipo === "fixo" && c.slug_fixo === "plano_acao_assinatura" && c.ativo !== false,
  );

  const secoes: Record<string, React.ReactNode> = {
    identificacao_empresa: <SecaoIdentificacaoEmpresa empresa={empresa} numero={numPorSlug["identificacao_empresa"]} />,
    sumario: <SecaoSumario titulos={sumarioTitulos} />,
    plano_acao_tabela: (
      <TabelaSection
        acoes={acoes}
        filtrosAplicados={filtrosAplicados}
        titulo={numLabel(numPorSlug["plano_acao_tabela"], tituloPorSlug["plano_acao_tabela"] ?? "Plano de Ação 5W2H")}
      />
    ),
    plano_acao_assinatura: (
      <FolhaAssinaturas
        signatarios={signatarios}
        empresa={folhaEmpresa}
        dataHoraAssinatura={dataHoraAssinatura}
        identificadorDocumento={identificadorDocumento}
        quebraAntes={false}
        numero={numPorSlug["plano_acao_assinatura"]}
      />
    ),
  };

  function renderBloco(c: TextoPadraoCapitulo) {
    if (c.tipo === "fixo") {
      const s = secoes[c.slug_fixo ?? ""];
      return s ? (
        <div key={c.id_capitulo} className={classeQuebraFixoNova(c)} data-slug={c.slug_fixo ?? undefined}>{s}</div>
      ) : null;
    }
    const cNum = numPorId[c.id_capitulo]
      ? { ...c, titulo: `${numPorId[c.id_capitulo]}. ${c.titulo}` }
      : c;
    return renderEditavelUm(cNum, valores);
  }

  // Módulo recém-criado costuma não ter capítulo nenhum cadastrado. Sem este
  // fallback o PDF sairia em branco — aqui ele sai completo (identificação,
  // resumo, tabela e assinatura), e passa a respeitar o Texto Padrão assim
  // que alguém cadastrar capítulos.
  const semCapitulos = blocos.length === 0;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLE_BLOCK }} />

      {semCapitulos ? (
        <>
          <SecaoIdentificacaoEmpresa empresa={empresa} numero={1} />
          <ResumoCards acoes={acoes} />
          <TabelaSection acoes={acoes} filtrosAplicados={filtrosAplicados} titulo="2. Plano de Ação 5W2H" />
        </>
      ) : (
        blocos.map((c) => renderBloco(c))
      )}

      {/* Sem capítulo de assinatura ativo, a folha entra no fim assim mesmo. */}
      {(semCapitulos || !temAssinaturaFixo) && (
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
