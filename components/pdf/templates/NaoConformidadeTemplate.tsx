import React from "react";
import FolhaAssinaturas from "@/components/pdf/FolhaAssinaturas";
import type { Signatario } from "@/components/pdf/FolhaAssinaturas";
import { SecaoIdentificacaoEmpresa, SecaoSumario } from "@/components/pdf/SecoesComuns";
import type { Empresa } from "@/lib/supabase/types";
import type { TextoPadraoCapitulo } from "@/lib/textos-padrao/types";
import { substituirVariaveisTexto } from "@/lib/textos-padrao/variaveis";
import { TP_STYLE, renderEditaveis, temSecoesSistema, renderUnificado, numerarCapitulos, numLabel } from "./shared";

export interface NaoConformidadeItemLocal {
  id_item: string;
  descricao: string;
  norma_violada: string | null;
  criticidade: "ALTA" | "MEDIA" | "BAIXA" | string;
  causa_raiz: string | null;
  acao_corretiva: string | null;
  prazo: string | null;
  responsavel_tratativa: string | null;
  status_tratativa: "ABERTA" | "EM_TRATAMENTO" | "ENCERRADA" | string;
  foto_urls: string[];
}

export interface NaoConformidadeTemplateProps {
  relatorio: {
    titulo: string;
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
  itens: NaoConformidadeItemLocal[];
  capitulos: TextoPadraoCapitulo[];
  valores: Record<string, string>;
  signatarios: Signatario[];
  folhaEmpresa: { razaoSocial: string; cnpj: string } | null;
  dataHoraAssinatura: string;
  identificadorDocumento: string;
}

const STYLE_BLOCK = `
* { box-sizing: border-box; }
${TP_STYLE}
.sec-titulo { font-size: 13pt; font-weight: 700; color: #b91c1c; border-bottom: 2px solid #b91c1c; padding-bottom: 3px; margin: 0 0 8pt; }
.nc { border: 1px solid #d1d5db; border-radius: 6px; padding: 10px; margin-bottom: 10px; page-break-inside: avoid; }
.nc-alta { border-color: #fca5a5; background: #fef2f2; }
.nc-media { border-color: #fcd34d; background: #fffbeb; }
.nc-baixa { border-color: #6ee7b7; background: #ecfdf5; }
.nc .cab { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.nc-num { font-family: monospace; font-size: 10px; font-weight: 700; border-radius: 4px; padding: 2px 6px; background: #fee2e2; color: #991b1b; }
.crit { font-size: 9px; font-weight: 700; border-radius: 999px; padding: 2px 8px; }
.status { font-size: 9px; font-weight: 700; border-radius: 999px; padding: 2px 8px; background: #f3f4f6; color: #374151; }
.prazo { font-size: 9px; font-weight: 600; border-radius: 999px; padding: 2px 8px; background: #f3f4f6; color: #374151; }
.campo { margin-top: 8px; }
.campo .rot { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #6b7280; margin: 0; }
.campo .val { font-size: 10pt; color: #111827; white-space: pre-wrap; margin: 2px 0 0; }
.fotos { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 8px; }
.fotos img { height: 150px; width: 200px; object-fit: cover; border: 1px solid #d1d5db; border-radius: 6px; }
`;

function corCriticidade(c: string) {
  if (c === "ALTA") return { bg: "#fee2e2", fg: "#991b1b", cls: "nc-alta", label: "ALTA" };
  if (c === "BAIXA") return { bg: "#d1fae5", fg: "#065f46", cls: "nc-baixa", label: "BAIXA" };
  return { bg: "#fef3c7", fg: "#92400e", cls: "nc-media", label: "MÉDIA" };
}

function labelStatus(s: string) {
  if (s === "ENCERRADA") return "Encerrada";
  if (s === "EM_TRATAMENTO") return "Em tratamento";
  return "Aberta";
}

function ResumoCards({ itens }: { itens: NaoConformidadeItemLocal[] }) {
  const alta = itens.filter((i) => i.criticidade === "ALTA").length;
  const media = itens.filter((i) => i.criticidade === "MEDIA").length;
  const baixa = itens.filter((i) => i.criticidade === "BAIXA").length;
  const card = (label: string, valor: number, bg: string, fg: string) => (
    <div style={{ flex: 1, border: `1px solid ${fg}33`, background: bg, borderRadius: 8, padding: 8, textAlign: "center" }}>
      <p style={{ margin: 0, fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: fg }}>{label}</p>
      <p style={{ margin: "2px 0 0", fontSize: 20, fontWeight: 700, color: fg }}>{valor}</p>
    </div>
  );
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
      {card("Total de NCs", itens.length, "#fef2f2", "#b91c1c")}
      {card("Criticidade ALTA", alta, "#fef2f2", "#b91c1c")}
      {card("Criticidade MÉDIA", media, "#fffbeb", "#b45309")}
      {card("Criticidade BAIXA", baixa, "#ecfdf5", "#047857")}
    </div>
  );
}

function ItensSection({ itens }: { itens: NaoConformidadeItemLocal[] }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <p className="sec-titulo">Não Conformidades ({itens.length})</p>
      {itens.length === 0 && (
        <p style={{ fontSize: 11, color: "#6b7280" }}>Nenhuma NC registrada neste relatório.</p>
      )}
      {itens.map((item, idx) => {
        const cc = corCriticidade(item.criticidade);
        return (
          <div key={item.id_item} className={`nc ${cc.cls}`}>
            <div className="cab">
              <span className="nc-num">NC #{idx + 1}</span>
              <span className="crit" style={{ background: cc.bg, color: cc.fg }}>{cc.label}</span>
              <span className="status">{labelStatus(item.status_tratativa)}</span>
              {item.prazo && (
                <span className="prazo">Prazo: {new Date(item.prazo + "T00:00").toLocaleDateString("pt-BR")}</span>
              )}
            </div>
            <div className="campo">
              <p className="rot">Descrição da não conformidade</p>
              <p className="val">{item.descricao}</p>
            </div>
            {item.norma_violada && (
              <div className="campo">
                <p className="rot">Norma violada</p>
                <p className="val">{item.norma_violada}</p>
              </div>
            )}
            {item.causa_raiz && (
              <div className="campo">
                <p className="rot">Causa raiz</p>
                <p className="val">{item.causa_raiz}</p>
              </div>
            )}
            {item.acao_corretiva && (
              <div className="campo">
                <p className="rot">Ação corretiva proposta</p>
                <p className="val">{item.acao_corretiva}</p>
              </div>
            )}
            {item.responsavel_tratativa && (
              <div className="campo">
                <p className="rot">Responsável pela tratativa</p>
                <p className="val">{item.responsavel_tratativa}</p>
              </div>
            )}
            {item.foto_urls.length > 0 && (
              <div className="fotos">
                {item.foto_urls.map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={`${url}-${i}`} src={url} alt={`Evidência NC #${idx + 1}`} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function NaoConformidadeTemplate({
  relatorio,
  empresa,
  itens,
  capitulos,
  valores,
  signatarios,
  folhaEmpresa,
  dataHoraAssinatura,
  identificadorDocumento,
}: NaoConformidadeTemplateProps) {
  // Blocos ordenados (mesma regra usada por renderUnificado) p/ montar o sumário.
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
      case "identificacao_empresa": return true;
      case "nc_descricao":          return true;
      case "nc_assinatura":         return true;
      // sumário não numera; nc_plano não renderiza seção própria (ações vão por item)
      default:                      return false;
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
    (c) => c.tipo === "fixo" && c.slug_fixo === "nc_assinatura" && c.ativo !== false,
  );

  // Folha de assinaturas: quando há capítulo "nc_assinatura", renderiza na posição
  // dele (numerada, quebra controlada pelo wrapper); senão, cai no fim (fallback).
  const folhaNode = (
    <FolhaAssinaturas
      signatarios={signatarios}
      empresa={folhaEmpresa}
      dataHoraAssinatura={dataHoraAssinatura}
      identificadorDocumento={identificadorDocumento}
      quebraAntes={false}
      numero={numPorSlug["nc_assinatura"]}
    />
  );

  // Seção do sistema "Não Conformidades" (resumo + itens + observações gerais).
  const descricaoNode = (
    <>
      <ResumoCards itens={itens} />
      <ItensSection itens={itens} />
      {relatorio.observacoes_gerais && (
        <div style={{ marginBottom: 16, border: "1px solid #e5e7eb", borderRadius: 8, padding: 10 }}>
          <p style={{ margin: 0, fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: "#6b7280" }}>Observações Gerais</p>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: "#111827", whiteSpace: "pre-wrap" }}>{relatorio.observacoes_gerais}</p>
        </div>
      )}
    </>
  );

  function renderSecaoNC(slug: string): React.ReactNode {
    switch (slug) {
      case "identificacao_empresa": return <SecaoIdentificacaoEmpresa empresa={empresa} numero={numPorSlug["identificacao_empresa"]} />;
      case "sumario":               return <SecaoSumario titulos={sumarioTitulos} />;
      case "nc_descricao":          return (
        <div className="tp-cap">
          <h2>{numLabel(numPorSlug["nc_descricao"], tituloPorSlug["nc_descricao"] ?? "Descrição da Não Conformidade")}</h2>
          {descricaoNode}
        </div>
      );
      case "nc_assinatura":         return folhaNode;
      default:                      return null; // nc_plano (ações ficam por item)
    }
  }

  const corpo = temSecoesSistema(capitulos)
    ? renderUnificado(capitulos, valores, renderSecaoNC, { numPorId })
    : (
      <>
        {renderEditaveis(capitulos, valores, "inicio")}
        {descricaoNode}
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
