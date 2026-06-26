import React from "react";
import type { TextoPadraoCapitulo } from "@/lib/textos-padrao/types";
import {
  substituirVariaveis,
  substituirVariaveisTexto,
} from "@/lib/textos-padrao/variaveis";

/**
 * Estilos e helpers compartilhados pelos templates Puppeteer dos módulos que
 * usam o modelo simples de Texto Padrão por posição ("inicio" / "fim") — sem
 * ordenação unificada. Mantém o mesmo visual dos capítulos editáveis aprovado
 * no template de Conformidade.
 */

/** Bloco de estilos para capítulos editáveis de Texto Padrão. */
export const TP_STYLE = `
.tp-cap { margin-bottom: 16pt; page-break-inside: auto; }
.tp-cap h2 { font-size: 13pt; font-weight: 700; color: #0f766e; border-bottom: 2px solid #0f766e; padding-bottom: 3px; margin: 0 0 8pt; }
.tp-cap .corpo { font-size: 11pt; color: #1f2937; line-height: 1.5; text-align: justify; }
.tp-cap .corpo p { margin: 0 0 8pt; }
.tp-cap .corpo h1 { font-size: 14pt; font-weight: 700; color: #1e4d28; margin: 14pt 0 6pt; }
.tp-cap .corpo h2 { font-size: 13pt; font-weight: 700; color: #1e4d28; margin: 12pt 0 6pt; }
.tp-cap .corpo h3 { font-size: 12pt; font-weight: 700; color: #1e4d28; margin: 10pt 0 4pt; }
.tp-cap .corpo ul, .tp-cap .corpo ol { margin: 0 0 8pt 1.25cm; padding: 0; }
.tp-cap .corpo li { margin: 2pt 0; }
.tp-cap .corpo a { color: #0ea5e9; text-decoration: underline; }
.tp-cap .corpo img { max-width: 100%; height: auto; border-radius: 4px; margin: 6pt 0; }
.tp-cap .corpo table { border-collapse: collapse; width: 100%; margin: 8pt 0; font-size: 10pt; }
.tp-cap .corpo th, .tp-cap .corpo td { border: 1px solid #999; padding: 4px 6px; vertical-align: top; }
.tp-cap .corpo th { background: #d4edda; color: #1e4d28; font-weight: 700; text-align: left; }
.tp-capa { page: capa; position: relative; width: 210mm; height: 297mm; overflow: hidden; page-break-after: always; }
.tp-capa img.bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center; display: block; z-index: 0; }
.tp-capa .caixa { position: absolute; z-index: 1; white-space: pre-wrap; line-height: 1.3; }
.textos-padrao-capitulo--nova-pagina { page-break-before: always; }
.textos-padrao-capitulo--continua { page-break-before: auto; }
`;

/**
 * Classe de quebra de página para uma SEÇÃO DO SISTEMA (fixo), conforme o
 * `quebra_pagina` marcado no editor. Retorna undefined quando NÃO marcado —
 * preservando o fluxo atual (não muda laudos já existentes).
 */
export function classeQuebraFixo(c: TextoPadraoCapitulo): string | undefined {
  if (c.quebra_pagina === "continua") return "textos-padrao-capitulo--continua";
  if (c.quebra_pagina === "nova") return "textos-padrao-capitulo--nova-pagina";
  return undefined;
}

/** Filtra/ordena os capítulos editáveis de uma posição (mesma regra do print). */
export function editaveisPorPosicao(
  capitulos: TextoPadraoCapitulo[],
  posicao: string,
): TextoPadraoCapitulo[] {
  return capitulos
    .filter((c) => c.tipo !== "fixo" && c.ativo !== false)
    .filter((c) => (c.posicao_pdf ?? "inicio") === posicao)
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
}

/** Renderiza UM capítulo editável (título + HTML, ou capa). */
export function renderEditavelUm(
  c: TextoPadraoCapitulo,
  valores: Record<string, string>,
): React.ReactNode {
  // É capa quando tem imagem de fundo OU o título é "capa". Capas não mostram
  // cabeçalho de título; sem imagem, fica como placeholder (até subir a arte).
  const ehCapa =
    !!c.bg_imagem_url || (c.titulo ?? "").trim().toLowerCase() === "capa";
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
              textAlign: cx.align ?? "left",
            }}
          >
            {substituirVariaveisTexto(cx.conteudo, valores)}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div key={c.id_capitulo} className="tp-cap">
      <h2>{substituirVariaveisTexto(c.titulo, valores)}</h2>
      <div
        className="corpo"
        dangerouslySetInnerHTML={{ __html: substituirVariaveis(c.conteudo, valores) }}
      />
    </div>
  );
}

/** Renderiza os capítulos editáveis de uma posição (título + HTML, ou capa). */
export function renderEditaveis(
  capitulos: TextoPadraoCapitulo[],
  valores: Record<string, string>,
  posicao: string,
): React.ReactNode {
  const caps = editaveisPorPosicao(capitulos, posicao);
  if (caps.length === 0) return null;
  return caps.map((c) => renderEditavelUm(c, valores));
}

/** True se há seções do sistema (tipo fixo) cadastradas — ativa o modo unificado. */
export function temSecoesSistema(capitulos: TextoPadraoCapitulo[]): boolean {
  return capitulos.some((c) => c.tipo === "fixo");
}

/** Prefixa "N. " a um texto quando há número. */
export const numLabel = (num: number | undefined, txt: string): string =>
  num ? `${num}. ${txt}` : txt;

/**
 * Numera os capítulos (na ordem do laudo) que passam no predicado `renderiza`,
 * para casar Sumário ↔ corpo sem fantasmas/lacunas. Devolve mapas por slug
 * (seções do sistema) e por id (editáveis).
 */
export function numerarCapitulos(
  capitulos: TextoPadraoCapitulo[],
  renderiza: (c: TextoPadraoCapitulo) => boolean,
): { numPorSlug: Record<string, number>; numPorId: Record<string, number> } {
  const numPorSlug: Record<string, number> = {};
  const numPorId: Record<string, number> = {};
  const ord = [...capitulos]
    .filter((c) => c.ativo !== false)
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  let n = 0;
  for (const c of ord) {
    if (!renderiza(c)) continue;
    n += 1;
    if (c.tipo === "fixo" && c.slug_fixo) numPorSlug[c.slug_fixo] = n;
    numPorId[c.id_capitulo] = n;
  }
  return { numPorSlug, numPorId };
}

/**
 * Renderiza o corpo do laudo como lista única por `ordem` (editáveis + seções
 * do sistema intercalados). `renderSecao` mapeia cada slug_fixo ao seu nó.
 * Use só quando temSecoesSistema()===true; senão mantenha o layout legado.
 */
export function renderUnificado(
  capitulos: TextoPadraoCapitulo[],
  valores: Record<string, string>,
  renderSecao: (slug: string) => React.ReactNode,
  opts?: { numPorId?: Record<string, number> },
): React.ReactNode {
  const numPorId = opts?.numPorId;
  return [...capitulos]
    .filter((c) => c.ativo !== false)
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
    .map((c) =>
      c.tipo === "fixo" ? (
        <div
          key={c.id_capitulo}
          className={classeQuebraFixo(c)}
          data-slug={c.slug_fixo ?? undefined}
        >
          {renderSecao(c.slug_fixo ?? "")}
        </div>
      ) : (
        <React.Fragment key={c.id_capitulo}>
          {renderEditavelUm(
            numPorId?.[c.id_capitulo]
              ? { ...c, titulo: `${numPorId[c.id_capitulo]}. ${c.titulo}` }
              : c,
            valores,
          )}
        </React.Fragment>
      ),
    );
}

/** Cabeçalho padrão dos laudos (faixa colorida + grid de dados). */
export function CabecalhoLaudo({
  cor,
  rotulo,
  titulo,
  linhas,
}: {
  cor: string;
  rotulo: string;
  titulo: string;
  linhas: Array<[string, string]>;
}) {
  return (
    <div style={{ marginBottom: 24, borderBottom: `3px solid ${cor}`, paddingBottom: 16 }}>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: cor }}>
        {rotulo}
      </p>
      <h1 style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 700, color: "#111827" }}>{titulo}</h1>
      <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 16px", fontSize: 11, color: "#374151" }}>
        {linhas.map(([k, v], i) => (
          <span key={i}><strong>{k}:</strong> {v || "—"}</span>
        ))}
      </div>
    </div>
  );
}
