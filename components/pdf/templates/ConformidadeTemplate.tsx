import React from "react";
import FolhaAssinaturas from "@/components/pdf/FolhaAssinaturas";
import type { Signatario } from "@/components/pdf/FolhaAssinaturas";
import { SecaoIdentificacaoEmpresa, SecaoSumario } from "@/components/pdf/SecoesComuns";
import { classeQuebraFixo, numerarCapitulos, numLabel, renderEditavelUm } from "@/components/pdf/templates/shared";
import type { Empresa } from "@/lib/supabase/types";
import type { TextoPadraoCapitulo } from "@/lib/textos-padrao/types";
import { substituirVariaveisTexto } from "@/lib/textos-padrao/variaveis";

export interface ConformidadeItemLocal {
  id_item: string;
  item_codigo: string;
  item_titulo: string;
  item_descricao: string | null;
  item_nr_origem: string | null;
  situacao: "CONFORME" | "NAO_APLICAVEL" | "PENDENTE" | string;
  observacao: string | null;
  foto_urls: string[];
}

export interface ConformidadeTemplateProps {
  relatorio: {
    nr_codigo: string | null;
    nr_titulo: string | null;
    setor: string | null;
    responsavel: string | null;
    responsavel_empresa: string | null;
    cidade: string | null;
    data_inspecao: string | null;
    observacoes_gerais: string | null;
  };
  empresa?: Partial<Empresa> | null;
  itens: ConformidadeItemLocal[];
  capitulos: TextoPadraoCapitulo[];
  valores: Record<string, string>;
  signatarios: Signatario[];
  folhaEmpresa: { razaoSocial: string; cnpj: string } | null;
  dataHoraAssinatura: string;
  identificadorDocumento: string;
}

const STYLE_BLOCK = `
* { box-sizing: border-box; }
.textos-padrao-capitulo--nova-pagina { page-break-before: always; }
.textos-padrao-capitulo--continua { page-break-before: auto; }
.tp-cap { margin-bottom: 16pt; }
.tp-cap h2 { font-size: 13pt; font-weight: 700; color: #0f766e; border-bottom: 2px solid #0f766e; padding-bottom: 3px; margin: 0 0 8pt; }
.tp-cap .corpo { font-size: 11pt; color: #1f2937; line-height: 1.5; text-align: justify; }
.tp-cap .corpo p { margin: 0 0 8pt; }
.tp-cap .corpo table { border-collapse: collapse; width: 100%; margin: 8pt 0; font-size: 10pt; }
.tp-cap .corpo th, .tp-cap .corpo td { border: 1px solid #999; padding: 4px 6px; }
.tp-capa { page: capa; position: relative; width: 210mm; height: 297mm; overflow: hidden; page-break-after: always; }
.tp-capa img.bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center; display: block; z-index: 0; }
.tp-capa .caixa { position: absolute; z-index: 1; white-space: pre-wrap; line-height: 1.3; }
.sec-titulo { font-size: 13pt; font-weight: 700; color: #0f766e; border-bottom: 2px solid #0f766e; padding-bottom: 3px; margin: 0 0 8pt; }
.item { border: 1px solid #d1d5db; border-radius: 6px; padding: 8px; margin-bottom: 8px; page-break-inside: avoid; }
.item .cab { display: flex; align-items: flex-start; gap: 8px; }
.badge { font-family: monospace; font-size: 10px; font-weight: 700; border-radius: 4px; padding: 2px 6px; white-space: nowrap; }
.status { font-size: 9px; font-weight: 700; border-radius: 999px; padding: 2px 8px; white-space: nowrap; }
.fotos { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 8px; }
.fotos img { height: 150px; width: 200px; object-fit: cover; border: 1px solid #d1d5db; border-radius: 6px; }
.obs { margin-top: 8px; font-size: 10pt; color: #111827; white-space: pre-wrap; }
.obs .rot { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #6b7280; }
`;

function corStatus(s: string) {
  if (s === "CONFORME") return { bg: "#d1fae5", fg: "#047857", label: "CONFORME" };
  if (s === "NAO_APLICAVEL") return { bg: "#f3f4f6", fg: "#374151", label: "N/A" };
  return { bg: "#fef3c7", fg: "#b45309", label: "PENDENTE" };
}

function ResumoCards({ itens }: { itens: ConformidadeItemLocal[] }) {
  const total = itens.length;
  const conformes = itens.filter((i) => i.situacao === "CONFORME").length;
  const na = itens.filter((i) => i.situacao === "NAO_APLICAVEL").length;
  const pend = itens.filter((i) => i.situacao === "PENDENTE").length;
  const avaliados = total - na;
  const pct = avaliados > 0 ? Math.round((conformes / avaliados) * 100) : 0;
  const card = (label: string, valor: string, bg: string, fg: string) => (
    <div style={{ flex: 1, border: `1px solid ${fg}33`, background: bg, borderRadius: 8, padding: 8, textAlign: "center" }}>
      <p style={{ margin: 0, fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: fg }}>{label}</p>
      <p style={{ margin: "2px 0 0", fontSize: 20, fontWeight: 700, color: fg }}>{valor}</p>
    </div>
  );
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
      {card("Conformes", String(conformes), "#ecfdf5", "#047857")}
      {card("Não aplicáveis", String(na), "#f9fafb", "#374151")}
      {card("Pendentes", String(pend), "#fffbeb", "#b45309")}
      {card("Avaliação", `${pct}%`, "#f0fdfa", "#0f766e")}
    </div>
  );
}

function ItensSection({ itens, obsGerais, titulo }: { itens: ConformidadeItemLocal[]; obsGerais: string | null; titulo: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <p className="sec-titulo">{titulo} ({itens.length})</p>
      {itens.map((item) => {
        const st = corStatus(item.situacao);
        return (
          <div key={item.id_item} className="item">
            <div className="cab">
              <span className="badge" style={{ background: "#ccfbf1", color: "#115e59" }}>{item.item_codigo}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "#111827" }}>
                  {item.item_titulo}
                  {item.item_nr_origem && item.item_nr_origem !== "LIVRE" ? ` · ${item.item_nr_origem}` : item.item_nr_origem === "LIVRE" ? " · Livre" : ""}
                </p>
                {item.item_descricao && (
                  <p style={{ margin: "2px 0 0", fontSize: 10, color: "#4b5563" }}>{item.item_descricao}</p>
                )}
              </div>
              <span className="status" style={{ background: st.bg, color: st.fg }}>{st.label}</span>
            </div>
            {item.foto_urls.length > 0 && (
              <div className="fotos">
                {item.foto_urls.map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={`${url}-${i}`} src={url} alt={`Foto ${item.item_codigo}`} />
                ))}
              </div>
            )}
            {item.observacao && (
              <div className="obs">
                <p className="rot" style={{ margin: 0 }}>Observação</p>
                <p style={{ margin: "2px 0 0" }}>{item.observacao}</p>
              </div>
            )}
          </div>
        );
      })}
      {obsGerais && (
        <div style={{ marginTop: 12, border: "1px solid #e5e7eb", borderRadius: 8, padding: 10 }}>
          <p style={{ margin: 0, fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: "#6b7280" }}>Observações Gerais</p>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: "#111827", whiteSpace: "pre-wrap" }}>{obsGerais}</p>
        </div>
      )}
    </div>
  );
}

export default function ConformidadeTemplate({
  relatorio,
  empresa,
  itens,
  capitulos,
  valores,
  signatarios,
  folhaEmpresa,
  dataHoraAssinatura,
  identificadorDocumento,
}: ConformidadeTemplateProps) {
  const blocos = [...capitulos]
    .filter((c) => c.ativo !== false)
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

  // Título cadastrado de cada seção fixa (p/ cabeçalho numerado no corpo).
  const tituloPorSlug: Record<string, string> = {};
  for (const c of capitulos) if (c.slug_fixo) tituloPorSlug[c.slug_fixo] = c.titulo;

  // Um capítulo só entra no Sumário/numeração se renderiza seção numerada.
  function renderizaNumerado(c: TextoPadraoCapitulo): boolean {
    if (c.ativo === false) return false;
    const ehCapa = !!c.bg_imagem_url || (c.titulo ?? "").trim().toLowerCase() === "capa";
    if (ehCapa) return false;
    if (c.tipo !== "fixo") return true;
    switch (c.slug_fixo) {
      case "identificacao_empresa":   return true;
      case "conformidade_resultado":  return true;
      case "conformidade_itens":      return true;
      case "conformidade_assinatura": return true;
      // sumário não numera.
      default:                        return false;
    }
  }

  const { numPorSlug, numPorId } = numerarCapitulos(capitulos, renderizaNumerado);

  // Títulos do sumário — só capítulos que viram seção numerada (mesmo predicado).
  const sumarioTitulos = blocos
    .filter((c) => renderizaNumerado(c))
    .map((c) =>
      c.tipo === "fixo" ? c.titulo : substituirVariaveisTexto(c.titulo, valores),
    )
    .filter((t) => t && t.trim());

  const temAssinaturaFixo = capitulos.some(
    (c) => c.tipo === "fixo" && c.slug_fixo === "conformidade_assinatura" && c.ativo !== false,
  );

  const secoes: Record<string, React.ReactNode> = {
    identificacao_empresa: <SecaoIdentificacaoEmpresa empresa={empresa} numero={numPorSlug["identificacao_empresa"]} />,
    sumario: <SecaoSumario titulos={sumarioTitulos} />,
    // ResumoCards não tem cabeçalho próprio → envolve num cabeçalho numerado.
    conformidade_resultado: (
      <div className="tp-cap">
        <h2>{numLabel(numPorSlug["conformidade_resultado"], tituloPorSlug["conformidade_resultado"] ?? "Resultado da Avaliação")}</h2>
        <ResumoCards itens={itens} />
      </div>
    ),
    conformidade_itens: (
      <ItensSection
        itens={itens}
        obsGerais={relatorio.observacoes_gerais}
        titulo={numLabel(numPorSlug["conformidade_itens"], tituloPorSlug["conformidade_itens"] ?? "Itens do Checklist")}
      />
    ),
    conformidade_assinatura: (
      <FolhaAssinaturas
        signatarios={signatarios}
        empresa={folhaEmpresa}
        dataHoraAssinatura={dataHoraAssinatura}
        identificadorDocumento={identificadorDocumento}
        quebraAntes={false}
        numero={numPorSlug["conformidade_assinatura"]}
      />
    ),
  };

  function renderBloco(c: TextoPadraoCapitulo) {
    if (c.tipo === "fixo") {
      const s = secoes[c.slug_fixo ?? ""];
      return s ? (
        <div key={c.id_capitulo} className={classeQuebraFixo(c)} data-slug={c.slug_fixo ?? undefined}>{s}</div>
      ) : null;
    }
    // Editável: usa o render compartilhado (igual aos demais laudos) — desenha a
    // CAPA (bg_imagem_url + caixas) full-bleed, ou título + conteúdo. O número do
    // sumário vai prefixado no título (a capa não é numerada → sem prefixo).
    const cNum = numPorId[c.id_capitulo]
      ? { ...c, titulo: `${numPorId[c.id_capitulo]}. ${c.titulo}` }
      : c;
    return renderEditavelUm(cNum, valores);
  }

  return (
    <>
      {/* eslint-disable-next-line react/no-danger */}
      <style dangerouslySetInnerHTML={{ __html: STYLE_BLOCK }} />

      {blocos.map((c) => renderBloco(c))}

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
