import React from "react";
import FolhaAssinaturas from "@/components/pdf/FolhaAssinaturas";
import type { Signatario } from "@/components/pdf/FolhaAssinaturas";
import { SecaoIdentificacaoEmpresa, SecaoSumario } from "@/components/pdf/SecoesComuns";
import type { Empresa } from "@/lib/supabase/types";
import {
  POD_HRN_LABELS,
  FEP_HRN_LABELS,
  GPD_HRN_LABELS,
  NPE_HRN_LABELS,
  CLASSIFICACAO_HRN_LABELS,
} from "@/lib/supabase/types";
import type { TextoPadraoCapitulo } from "@/lib/textos-padrao/types";
import { substituirVariaveisTexto } from "@/lib/textos-padrao/variaveis";
import { TP_STYLE, renderEditaveis, temSecoesSistema, renderUnificado, numerarCapitulos, numLabel } from "./shared";
import {
  CATEGORIAS_NR12_LABELS,
  CATEGORIAS_NR12_ORDEM,
  type CategoriaNR12,
} from "@/lib/apreciacao-maquinas/catalogo-nr12";

export interface ApreciacaoItemLocal {
  id_item: string;
  item_codigo: string;
  item_categoria: string;
  item_titulo: string;
  item_descricao: string | null;
  item_origem: string | null;
  situacao: string;
  observacao: string | null;
  recomendacao: string | null;
  probabilidade: string | null;
  severidade: string | null;
  nivel_risco_calculado: string | null;
  foto_urls: string[];
  foto_legendas: string[];
}

export interface ApreciacaoRiscoLocal {
  tipo_perigo: string;
  origem: string | null;
  potenciais_consequencias: string | null;
  pod: string | null;
  fep: string | null;
  gpd: string | null;
  classificacao_risco: string | null;
  pod_residual: string | null;
  fep_residual: string | null;
  gpd_residual: string | null;
  classificacao_residual: string | null;
  nivel_acoes: string | null;
  medidas_preventivas: string | null;
}

export interface ApreciacaoFichaLocal {
  nome: string;
  numero_ordem: number;
  setor: string | null;
  tipo: string | null;
  modelo: string | null;
  fabricante: string | null;
  serie: string | null;
  ano: string | null;
  capacidade: string | null;
  componentes_maquina: string[] | null;
  limite_uso: string | null;
  limite_espaco: string | null;
  limite_tempo: string | null;
  limite_produtividade: string | null;
  npe: string | null;
  sistemas_atual: string[] | null;
  sistemas_necessario: string[] | null;
  constatacoes_inspecao: string | null;
  parecer_tecnico: string | null;
  prioridade_manual: boolean;
  itens: ApreciacaoItemLocal[];
  riscos: ApreciacaoRiscoLocal[];
}

export interface ApreciacaoAcaoLocal {
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
  origem_label: string | null;
}

export interface ApreciacaoTemplateProps {
  apreciacao: {
    titulo: string | null;
    setor: string | null;
    cidade: string | null;
    responsavel: string | null;
    responsavel_empresa: string | null;
    data_apreciacao: string | null;
    risco_residual: string | null;
    observacoes_gerais: string | null;
    conclusao_tecnica: string | null;
    recomendacoes: string | null;
  };
  maquinaNome?: string;
  empresa?: Partial<Empresa> | null;
  fichas: ApreciacaoFichaLocal[];
  acoes: ApreciacaoAcaoLocal[];
  capitulos: TextoPadraoCapitulo[];
  valores: Record<string, string>;
  signatarios: Signatario[];
  folhaEmpresa: { razaoSocial: string; cnpj: string } | null;
  dataHoraAssinatura: string;
  identificadorDocumento: string;
}

const LARANJA = "#c2410c";

const SITUACAO_LABELS: Record<string, string> = {
  CONFORME: "Conforme",
  NAO_CONFORME: "Não conforme",
  NAO_APLICAVEL: "Não aplicável",
  PENDENTE: "Pendente",
};

const STYLE_BLOCK = `
* { box-sizing: border-box; }
${TP_STYLE}
.sec-titulo { font-size: 13pt; font-weight: 700; color: ${LARANJA}; border-bottom: 2px solid ${LARANJA}; padding-bottom: 3px; margin: 14pt 0 8pt; }
.cat-titulo { font-size: 10.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; color: #9a3412; border-bottom: 1px solid #fdba74; padding-bottom: 2px; margin: 10pt 0 6pt; }
.maq-titulo { font-size: 11.5pt; font-weight: 700; color: #fff; background: ${LARANJA}; border-radius: 5px; padding: 5px 10px; margin: 12pt 0 8pt; page-break-after: avoid; }
.maq-prio { font-size: 8px; font-weight: 700; background: #fde68a; color: #92400e; border-radius: 4px; padding: 1px 6px; margin-left: 8px; vertical-align: middle; }
.dados { width: 100%; border-collapse: collapse; font-size: 10.5pt; margin-bottom: 8pt; }
.dados td { border: 1px solid #e5e7eb; padding: 4px 8px; vertical-align: top; }
.dados .rot { width: 28%; font-size: 9px; font-weight: 700; text-transform: uppercase; color: #6b7280; }
.hrn { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin: 4pt 0 8pt; page-break-inside: avoid; }
.hrn th, .hrn td { border: 1px solid #e5e7eb; padding: 3px 6px; vertical-align: top; text-align: left; }
.hrn th { background: #fff7ed; color: #9a3412; font-weight: 700; font-size: 8.5pt; text-transform: uppercase; }
.hrn .cls { font-weight: 700; border-radius: 4px; padding: 1px 6px; font-size: 8.5pt; white-space: nowrap; }
.ap-item { border: 1px solid #d1d5db; border-radius: 6px; padding: 8px 10px; margin-bottom: 8px; page-break-inside: avoid; }
.ap-item .cab { display: flex; align-items: flex-start; gap: 8px; }
.ap-cod { font-family: monospace; font-size: 10px; font-weight: 700; border-radius: 4px; padding: 2px 6px; background: #f3f4f6; color: #4b5563; white-space: nowrap; }
.ap-cod.livre { background: #f3e8ff; color: #7e22ce; }
.sit { font-size: 9px; font-weight: 700; border: 1px solid; border-radius: 999px; padding: 2px 8px; white-space: nowrap; }
.risco { margin-top: 6px; border: 1px solid #fed7aa; background: #fff7ed; border-radius: 6px; padding: 6px 8px; font-size: 10pt; }
.risco .rot { font-size: 9px; font-weight: 700; text-transform: uppercase; color: #9a3412; margin: 0 0 2px; }
.campo { margin-top: 6px; }
.campo .rot { font-size: 9px; font-weight: 700; text-transform: uppercase; color: #6b7280; margin: 0; }
.campo .rot.rec { color: #b91c1c; }
.campo .val { font-size: 10pt; color: #111827; white-space: pre-wrap; margin: 2px 0 0; }
.fotos { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.fotos .f { width: 120px; }
.fotos img { width: 120px; height: 90px; object-fit: cover; border: 1px solid #d1d5db; border-radius: 4px; }
.fotos .leg { font-size: 8px; color: #6b7280; text-align: center; margin: 2px 0 0; line-height: 1.2; }
.acao { border: 1px solid #e5e7eb; border-radius: 6px; padding: 6px 8px; margin-bottom: 6px; page-break-inside: avoid; }
.acao .top { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.prio { font-size: 8px; font-weight: 700; border-radius: 4px; padding: 1px 5px; }
.acao .what { font-size: 10.5pt; font-weight: 600; color: #111827; }
.acao .meta { font-size: 9pt; color: #4b5563; margin: 3px 0 0; }
.stat { font-size: 8px; font-weight: 700; border: 1px solid; border-radius: 999px; padding: 1px 6px; }
`;

function corSituacao(s: string) {
  if (s === "CONFORME") return { bg: "#d1fae5", fg: "#047857", bd: "#6ee7b7" };
  if (s === "NAO_CONFORME") return { bg: "#fee2e2", fg: "#b91c1c", bd: "#fca5a5" };
  if (s === "NAO_APLICAVEL") return { bg: "#f3f4f6", fg: "#374151", bd: "#d1d5db" };
  return { bg: "#fef3c7", fg: "#b45309", bd: "#fcd34d" };
}

function corPrioridade(p: string) {
  if (p === "Critica") return { bg: "#fee2e2", fg: "#b91c1c" };
  if (p === "Alta") return { bg: "#ffedd5", fg: "#c2410c" };
  if (p === "Media") return { bg: "#fef3c7", fg: "#b45309" };
  return { bg: "#d1fae5", fg: "#047857" };
}

function corStatusAcao(s: string) {
  if (s === "Concluida") return { bg: "#d1fae5", fg: "#047857", bd: "#6ee7b7" };
  if (s === "Em Andamento") return { bg: "#dbeafe", fg: "#1d4ed8", bd: "#93c5fd" };
  if (s === "Cancelada") return { bg: "#f3f4f6", fg: "#6b7280", bd: "#d1d5db" };
  return { bg: "#fef3c7", fg: "#b45309", bd: "#fcd34d" };
}

function corClasseHrn(c: string | null) {
  if (c === "ALTO") return { bg: "#fee2e2", fg: "#b91c1c" };
  if (c === "MEDIO") return { bg: "#fef3c7", fg: "#b45309" };
  if (c === "BAIXO") return { bg: "#d1fae5", fg: "#047857" };
  if (c === "DESPREZIVEL") return { bg: "#f3f4f6", fg: "#4b5563" };
  return { bg: "#f3f4f6", fg: "#6b7280" };
}

const lbl = (map: Record<string, string>, v: string | null) =>
  v ? map[v] ?? v : "—";

function ItemBloco({ item }: { item: ApreciacaoItemLocal }) {
  const cs = corSituacao(item.situacao);
  const ehLivre = item.item_origem === "LIVRE";
  const temRisco =
    item.situacao === "NAO_CONFORME" &&
    (item.probabilidade || item.severidade || item.nivel_risco_calculado);
  return (
    <div className="ap-item">
      <div className="cab">
        <span className={`ap-cod ${ehLivre ? "livre" : ""}`}>{item.item_codigo}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "#111827" }}>
            {item.item_titulo}{ehLivre ? " · Livre" : ""}
          </p>
          {item.item_descricao && (
            <p style={{ margin: "2px 0 0", fontSize: 10, color: "#4b5563" }}>{item.item_descricao}</p>
          )}
        </div>
        <span className="sit" style={{ background: cs.bg, color: cs.fg, borderColor: cs.bd }}>
          {SITUACAO_LABELS[item.situacao] ?? item.situacao}
        </span>
      </div>

      {temRisco && (
        <div className="risco">
          <p className="rot">Avaliação de risco</p>
          <span>Probabilidade: <strong>{item.probabilidade || "—"}</strong> · Severidade: <strong>{item.severidade || "—"}</strong>{item.nivel_risco_calculado ? <> · Nível: <strong>{item.nivel_risco_calculado}</strong></> : null}</span>
        </div>
      )}

      {item.foto_urls.length > 0 && (
        <div className="fotos">
          {item.foto_urls.map((url, i) => (
            <div key={`${url}-${i}`} className="f">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Foto ${item.item_codigo}`} />
              {item.foto_legendas?.[i] ? <p className="leg">{item.foto_legendas[i]}</p> : null}
            </div>
          ))}
        </div>
      )}

      {item.observacao && (
        <div className="campo">
          <p className="rot">Observação técnica</p>
          <p className="val">{item.observacao}</p>
        </div>
      )}
      {item.recomendacao && (
        <div className="campo">
          <p className="rot rec">Recomendação / ação corretiva</p>
          <p className="val">{item.recomendacao}</p>
        </div>
      )}
    </div>
  );
}

function ChecklistGrupos({ itens }: { itens: ApreciacaoItemLocal[] }) {
  const grupos = CATEGORIAS_NR12_ORDEM.map((cat) => ({
    categoria: cat as CategoriaNR12,
    label: CATEGORIAS_NR12_LABELS[cat as CategoriaNR12],
    itens: itens.filter((i) => i.item_categoria === cat),
  })).filter((g) => g.itens.length > 0);

  if (grupos.length === 0) {
    return <p style={{ fontSize: 10, color: "#6b7280" }}>Sem itens de checklist.</p>;
  }
  return (
    <>
      {grupos.map((g) => (
        <div key={g.categoria}>
          <p className="cat-titulo">{g.label} ({g.itens.length})</p>
          {g.itens.map((item) => (
            <ItemBloco key={item.id_item} item={item} />
          ))}
        </div>
      ))}
    </>
  );
}

function IdentificacaoMaquina({ f }: { f: ApreciacaoFichaLocal }) {
  const linhas: [string, string | null][] = [
    ["Tipo", f.tipo],
    ["Modelo", f.modelo],
    ["Fabricante", f.fabricante],
    ["Nº de série", f.serie],
    ["Ano", f.ano],
    ["Capacidade", f.capacidade],
  ].filter(([, v]) => v) as [string, string][];
  const componentes = f.componentes_maquina?.length ? f.componentes_maquina.join(", ") : null;
  const limites = [
    f.limite_uso && `Uso: ${f.limite_uso}`,
    f.limite_espaco && `Espaço: ${f.limite_espaco}`,
    f.limite_tempo && `Tempo: ${f.limite_tempo}`,
    f.limite_produtividade && `Produtividade: ${f.limite_produtividade}`,
  ].filter(Boolean).join(" · ");
  const sisAtual = f.sistemas_atual?.length ? f.sistemas_atual.join(", ") : null;
  const sisNec = f.sistemas_necessario?.length ? f.sistemas_necessario.join(", ") : null;

  if (
    linhas.length === 0 && !componentes && !limites && !sisAtual && !sisNec &&
    !f.npe && !f.constatacoes_inspecao
  ) {
    return null;
  }
  return (
    <table className="dados">
      <tbody>
        {linhas.map(([rot, val]) => (
          <tr key={rot}>
            <td className="rot">{rot}</td>
            <td>{val}</td>
          </tr>
        ))}
        {componentes && (
          <tr><td className="rot">Componentes (NR-12)</td><td>{componentes}</td></tr>
        )}
        {limites && (
          <tr><td className="rot">Limites</td><td>{limites}</td></tr>
        )}
        {f.npe && (
          <tr><td className="rot">Pessoas expostas</td><td>{lbl(NPE_HRN_LABELS, f.npe)}</td></tr>
        )}
        {sisAtual && (
          <tr><td className="rot">Sistemas atuais</td><td>{sisAtual}</td></tr>
        )}
        {sisNec && (
          <tr><td className="rot">Sistemas necessários</td><td>{sisNec}</td></tr>
        )}
        {f.constatacoes_inspecao && (
          <tr><td className="rot">Constatações</td><td style={{ whiteSpace: "pre-wrap" }}>{f.constatacoes_inspecao}</td></tr>
        )}
      </tbody>
    </table>
  );
}

function HrnTable({ riscos }: { riscos: ApreciacaoRiscoLocal[] }) {
  if (riscos.length === 0) return null;
  return (
    <table className="hrn">
      <thead>
        <tr>
          <th>Perigo</th>
          <th>POD × FEP × GPD</th>
          <th>Inicial</th>
          <th>Residual</th>
          <th>Medidas</th>
        </tr>
      </thead>
      <tbody>
        {riscos.map((r, i) => {
          const ci = corClasseHrn(r.classificacao_risco);
          const cr = corClasseHrn(r.classificacao_residual);
          return (
            <tr key={i}>
              <td>
                <strong>{r.tipo_perigo}</strong>
                {r.potenciais_consequencias ? (
                  <div style={{ color: "#6b7280", fontSize: "8.5pt" }}>{r.potenciais_consequencias}</div>
                ) : null}
              </td>
              <td>
                {lbl(POD_HRN_LABELS, r.pod)} × {lbl(FEP_HRN_LABELS, r.fep)} × {lbl(GPD_HRN_LABELS, r.gpd)}
              </td>
              <td>
                {r.classificacao_risco ? (
                  <span className="cls" style={{ background: ci.bg, color: ci.fg }}>
                    {CLASSIFICACAO_HRN_LABELS[r.classificacao_risco as keyof typeof CLASSIFICACAO_HRN_LABELS] ?? r.classificacao_risco}
                  </span>
                ) : "—"}
              </td>
              <td>
                {r.classificacao_residual ? (
                  <span className="cls" style={{ background: cr.bg, color: cr.fg }}>
                    {CLASSIFICACAO_HRN_LABELS[r.classificacao_residual as keyof typeof CLASSIFICACAO_HRN_LABELS] ?? r.classificacao_residual}
                  </span>
                ) : "—"}
              </td>
              <td style={{ whiteSpace: "pre-wrap", fontSize: "8.5pt" }}>{r.medidas_preventivas || "—"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function MaquinasSection({ fichas, titulo }: { fichas: ApreciacaoFichaLocal[]; titulo: string }) {
  const totalItens = fichas.reduce((s, f) => s + f.itens.length, 0);
  return (
    <div>
      <p className="sec-titulo">{titulo} ({fichas.length} máquina{fichas.length === 1 ? "" : "s"}, {totalItens} itens)</p>
      {fichas.map((f, idx) => (
        <div
          key={idx}
          style={idx > 0 ? { pageBreakBefore: "always" } : undefined}
        >
          <p className="maq-titulo">
            Máquina {f.numero_ordem}: {f.nome}
            {f.setor ? ` — ${f.setor}` : ""}
            {f.prioridade_manual ? <span className="maq-prio">PRIORIDADE</span> : null}
          </p>
          <IdentificacaoMaquina f={f} />
          {f.riscos.length > 0 && (
            <>
              <p className="cat-titulo">Análise de Riscos — HRN</p>
              <HrnTable riscos={f.riscos} />
            </>
          )}
          <ChecklistGrupos itens={f.itens} />
          {f.parecer_tecnico && (
            <div className="campo">
              <p className="rot">Parecer técnico da máquina</p>
              <p className="val">{f.parecer_tecnico}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function PlanoAcaoSection({ acoes, titulo }: { acoes: ApreciacaoAcaoLocal[]; titulo: string }) {
  return (
    <div>
      <p className="sec-titulo">{titulo} ({acoes.length})</p>
      {acoes.length === 0 && (
        <p style={{ fontSize: 10.5, color: "#6b7280" }}>Nenhuma ação cadastrada.</p>
      )}
      {acoes.map((a) => {
        const cp = corPrioridade(a.prioridade);
        const cst = corStatusAcao(a.status);
        const prazo = a.when_prazo ? new Date(a.when_prazo + "T00:00").toLocaleDateString("pt-BR") : null;
        const detalhes = [
          a.why_justificativa && `Por quê: ${a.why_justificativa}`,
          a.how_metodo && `Como: ${a.how_metodo}`,
          a.where_local && `Onde: ${a.where_local}`,
          a.who_responsavel && `Quem: ${a.who_responsavel}`,
          prazo && `Quando: ${prazo}`,
          a.how_much_custo && `Quanto: ${a.how_much_custo}`,
        ].filter(Boolean);
        return (
          <div key={a.id_acao} className="acao">
            <div className="top">
              <span className="prio" style={{ background: cp.bg, color: cp.fg }}>{a.prioridade}</span>
              <span className="what" style={{ flex: 1 }}>{a.what_acao}</span>
              <span className="stat" style={{ background: cst.bg, color: cst.fg, borderColor: cst.bd }}>{a.status}</span>
            </div>
            {a.origem_label && <p className="meta">Origem: {a.origem_label}</p>}
            {detalhes.length > 0 && <p className="meta">{detalhes.join(" · ")}</p>}
          </div>
        );
      })}
    </div>
  );
}

export default function ApreciacaoTemplate({
  apreciacao,
  empresa,
  fichas,
  acoes,
  capitulos,
  valores,
  signatarios,
  folhaEmpresa,
  dataHoraAssinatura,
  identificadorDocumento,
}: ApreciacaoTemplateProps) {
  // Título cadastrado de cada seção fixa (p/ cabeçalho numerado no corpo).
  const tituloPorSlug: Record<string, string> = {};
  for (const c of capitulos) if (c.slug_fixo) tituloPorSlug[c.slug_fixo] = c.titulo;

  // Máquinas com risco residual MÉDIO+ ou marcadas como prioridade (conclusão).
  const maquinasCriticas = fichas.filter(
    (f) =>
      f.prioridade_manual ||
      f.riscos.some((r) => {
        const c = r.classificacao_residual || r.classificacao_risco;
        return c === "ALTO" || c === "MEDIO";
      }),
  );

  // Conclusão Técnica renderiza quando há parecer/recomendações OU máquinas críticas.
  const temConclusao = !!(
    apreciacao.conclusao_tecnica ||
    apreciacao.recomendacoes ||
    maquinasCriticas.length > 0
  );

  // Um capítulo só entra no Sumário/numeração se renderiza seção numerada.
  function renderizaNumerado(c: TextoPadraoCapitulo): boolean {
    if (c.ativo === false) return false;
    const ehCapa = !!c.bg_imagem_url || (c.titulo ?? "").trim().toLowerCase() === "capa";
    if (ehCapa) return false;
    if (c.tipo !== "fixo") return true;
    switch (c.slug_fixo) {
      case "identificacao_empresa": return true;
      case "apreciacao_checklist":  return true;
      case "apreciacao_risco":      return temConclusao; // só numera se há conteúdo
      case "apreciacao_plano":      return true;
      case "apreciacao_assinatura": return true;
      // sumário não numera; apreciacao_identificacao não renderiza seção própria
      // (os dados da máquina ficam no cabeçalho fixo do topo).
      default:                      return false;
    }
  }

  const { numPorSlug, numPorId } = numerarCapitulos(capitulos, renderizaNumerado);

  // Títulos do sumário — só capítulos que viram seção numerada (mesmo predicado).
  const sumarioTitulos = [...capitulos]
    .filter((c) => c.ativo !== false)
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
    .filter((c) => renderizaNumerado(c))
    .map((c) =>
      c.tipo === "fixo" ? c.titulo : substituirVariaveisTexto(c.titulo, valores),
    )
    .filter((t) => t && t.trim());

  const temAssinaturaFixo = capitulos.some(
    (c) => c.tipo === "fixo" && c.slug_fixo === "apreciacao_assinatura" && c.ativo !== false,
  );

  const folhaNode = (
    <FolhaAssinaturas
      signatarios={signatarios}
      empresa={folhaEmpresa}
      dataHoraAssinatura={dataHoraAssinatura}
      identificadorDocumento={identificadorDocumento}
      quebraAntes={false}
      numero={numPorSlug["apreciacao_assinatura"]}
    />
  );

  // Seção "checklist" agora itera as MÁQUINAS (identificação + HRN + checklist).
  const maquinasNode = (
    <MaquinasSection
      fichas={fichas}
      titulo={numLabel(numPorSlug["apreciacao_checklist"], tituloPorSlug["apreciacao_checklist"] ?? "Avaliação por Máquina (NR-12)")}
    />
  );
  const conclusaoNode = temConclusao ? (
    <div>
      <p className="sec-titulo">{numLabel(numPorSlug["apreciacao_risco"], tituloPorSlug["apreciacao_risco"] ?? "Conclusão Técnica")}</p>
      {maquinasCriticas.length > 0 && (
        <div className="campo">
          <p className="rot">Máquinas com risco residual relevante (Médio ou superior) ou prioridade</p>
          <p className="val">
            {maquinasCriticas
              .map((f) => `Máquina ${f.numero_ordem}: ${f.nome}${f.prioridade_manual ? " (prioridade)" : ""}`)
              .join("\n")}
          </p>
        </div>
      )}
      {apreciacao.conclusao_tecnica && (
        <div className="campo"><p className="rot">Parecer técnico</p><p className="val">{apreciacao.conclusao_tecnica}</p></div>
      )}
      {apreciacao.recomendacoes && (
        <div className="campo"><p className="rot">Recomendações finais</p><p className="val">{apreciacao.recomendacoes}</p></div>
      )}
    </div>
  ) : null;
  const planoNode = (
    <PlanoAcaoSection
      acoes={acoes}
      titulo={numLabel(numPorSlug["apreciacao_plano"], tituloPorSlug["apreciacao_plano"] ?? "Plano de Ação")}
    />
  );

  function renderSecaoApreciacao(slug: string): React.ReactNode {
    switch (slug) {
      case "identificacao_empresa": return <SecaoIdentificacaoEmpresa empresa={empresa} numero={numPorSlug["identificacao_empresa"]} />;
      case "sumario":               return <SecaoSumario titulos={sumarioTitulos} />;
      case "apreciacao_checklist":  return maquinasNode;
      case "apreciacao_risco":      return conclusaoNode;
      case "apreciacao_plano":      return planoNode;
      case "apreciacao_assinatura": return folhaNode;
      default:                      return null; // apreciacao_identificacao (dados no cabeçalho)
    }
  }

  const corpo = temSecoesSistema(capitulos)
    ? renderUnificado(capitulos, valores, renderSecaoApreciacao, { numPorId })
    : (
      <>
        {renderEditaveis(capitulos, valores, "inicio")}
        {maquinasNode}
        {conclusaoNode}
        {planoNode}
        {renderEditaveis(capitulos, valores, "fim")}
      </>
    );

  return (
    <>
      {/* eslint-disable-next-line react/no-danger */}
      <style dangerouslySetInnerHTML={{ __html: STYLE_BLOCK }} />

      {apreciacao.observacoes_gerais && (
        <div className="campo" style={{ marginBottom: 8 }}>
          <p className="rot">Observações gerais</p>
          <p className="val">{apreciacao.observacoes_gerais}</p>
        </div>
      )}

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
