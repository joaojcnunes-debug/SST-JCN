"use client";

import { useTextosPadrao } from "@/lib/hooks/useTextosPadrao";
import type { ModuloTextoPadrao } from "@/lib/textos-padrao/types";
import {
  substituirVariaveis,
  substituirVariaveisTexto,
} from "@/lib/textos-padrao/variaveis";

interface Props {
  modulo: ModuloTextoPadrao;
  /** Mapa chave → valor de variável (`{{empresa_nome}}` etc) já preenchido. */
  valores: Record<string, string>;
  /** Posição lógica no relatório — só pra page-break inteligente. */
  posicao?: "antes" | "depois";
}

/**
 * Renderiza os capítulos de Texto Padrão (cadastrados em /<modulo>/texto-padrao)
 * embutidos no relatório imprimível. Aparece **só no print** — em tela fica
 * oculto pra não atrapalhar a edição da página principal.
 *
 * Cada capítulo:
 *  - Sem `bg_imagem_url` → fluxo normal (título + conteúdo HTML)
 *  - Com `bg_imagem_url` → capa full-page com imagem de fundo e caixas
 *    posicionáveis (mesma estrutura do DRPS).
 */
export default function TextosPadraoPrint({
  modulo,
  valores,
  posicao = "antes",
}: Props) {
  const { data: capitulos = [] } = useTextosPadrao(modulo);

  if (capitulos.length === 0) return null;

  return (
    <section className="textos-padrao-capitulos hidden print:block">
      <style>{`
        /* === Padrão ABNT NBR 14724 ===
           - Papel: A4 (210 x 297 mm)
           - Margens: 3cm superior + 3cm esquerda, 2cm inferior + 2cm direita
           - Fonte: 12pt (corpo), 1.5 entrelinhas, texto justificado
        */
        @page textopadrao-retrato {
          size: A4 portrait;
          margin: 3cm 2cm 2cm 3cm;
        }
        @page textopadrao-paisagem {
          size: A4 landscape;
          margin: 2cm 3cm 3cm 2cm;
        }
        .textos-padrao-capitulo {
          margin-bottom: 22px;
          page-break-after: always;
          page-break-inside: auto;
        }
        .textos-padrao-capitulo--retrato { page: textopadrao-retrato; }
        .textos-padrao-capitulo--paisagem { page: textopadrao-paisagem; }
        .textos-padrao-capitulo:last-child {
          page-break-after: ${posicao === "antes" ? "always" : "auto"};
        }
        /* Capa full-page: respeita orientação do @page named */
        .textos-padrao-capitulo--capa {
          position: relative;
          margin: -3cm -2cm -2cm -3cm;
          padding: 0;
          height: 297mm;
          width: 210mm;
          overflow: hidden;
        }
        .textos-padrao-capitulo--paisagem.textos-padrao-capitulo--capa {
          margin: -2cm -3cm -3cm -2cm;
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
        .textos-padrao-capitulo--capa .textos-padrao-capitulo-titulo {
          display: none;
        }
        .textos-padrao-capitulo--capa .textos-padrao-caixa-texto {
          position: absolute;
          z-index: 1;
        }
        /* Tipografia ABNT */
        .textos-padrao-capitulo-titulo {
          font-size: 14pt;
          font-weight: 700;
          color: #1e4d28;
          border-bottom: 2px solid #006B54;
          padding-bottom: 4px;
          margin-bottom: 12pt;
        }
        .textos-padrao-capitulo-conteudo {
          font-size: 12pt;
          color: #1f2937;
          line-height: 1.5;
          text-align: justify;
        }
        .textos-padrao-capitulo-conteudo p {
          margin: 0 0 12pt 0;
          text-indent: 1.25cm;
          text-align: justify;
        }
        .textos-padrao-capitulo-conteudo h1 { font-size: 14pt; font-weight: 700; color: #1e4d28; margin: 18pt 0 6pt; }
        .textos-padrao-capitulo-conteudo h2 { font-size: 13pt; font-weight: 700; color: #1e4d28; margin: 14pt 0 6pt; }
        .textos-padrao-capitulo-conteudo h3 { font-size: 12pt; font-weight: 700; color: #1e4d28; margin: 12pt 0 4pt; }
        .textos-padrao-capitulo-conteudo ul,
        .textos-padrao-capitulo-conteudo ol { margin: 0 0 12pt 1.25cm; padding: 0; }
        .textos-padrao-capitulo-conteudo li { margin: 2pt 0; }
        .textos-padrao-capitulo-conteudo a { color: #006B54; text-decoration: underline; }
        .textos-padrao-capitulo-conteudo img {
          max-width: 100%;
          height: auto;
          border-radius: 4px;
          margin: 8pt 0;
        }
        .textos-padrao-capitulo-conteudo table {
          border-collapse: collapse;
          width: 100%;
          margin: 12pt 0;
          font-size: 10pt;
        }
        .textos-padrao-capitulo-conteudo th,
        .textos-padrao-capitulo-conteudo td {
          border: 1px solid #999;
          padding: 5px 7px;
          vertical-align: top;
        }
        .textos-padrao-capitulo-conteudo th {
          background: #d4edda;
          color: #1e4d28;
          font-weight: 700;
          text-align: left;
        }
      `}</style>

      {capitulos.map((c) => {
        const ehCapa = !!c.bg_imagem_url;
        const orientacao = c.orientacao ?? "retrato";
        const conteudoSubstituido = substituirVariaveis(c.conteudo, valores);
        const tituloSubstituido = substituirVariaveisTexto(c.titulo, valores);
        const classes = [
          "textos-padrao-capitulo",
          orientacao === "paisagem"
            ? "textos-padrao-capitulo--paisagem"
            : "textos-padrao-capitulo--retrato",
          ehCapa ? "textos-padrao-capitulo--capa" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <article key={c.id_capitulo} className={classes}>
            {ehCapa && c.bg_imagem_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={c.bg_imagem_url}
                alt=""
                className="textos-padrao-capitulo-bg-img"
              />
            )}
            {!ehCapa && (
              <h2 className="textos-padrao-capitulo-titulo">
                {tituloSubstituido}
              </h2>
            )}
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
                    textAlign: cx.align ?? "left",
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.3,
                  }}
                >
                  {substituirVariaveisTexto(cx.conteudo, valores)}
                </div>
              ))
            ) : !ehCapa ? (
              <div
                className="textos-padrao-capitulo-conteudo"
                dangerouslySetInnerHTML={{ __html: conteudoSubstituido }}
              />
            ) : null}
          </article>
        );
      })}
    </section>
  );
}
