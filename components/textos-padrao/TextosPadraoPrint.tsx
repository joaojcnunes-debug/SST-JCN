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
        .textos-padrao-capitulo {
          margin-bottom: 22px;
          page-break-after: always;
        }
        .textos-padrao-capitulo:last-child {
          page-break-after: ${posicao === "antes" ? "always" : "auto"};
        }
        .textos-padrao-capitulo--capa {
          position: relative;
          margin: 0;
          padding: 0;
          height: calc(297mm - 2.8cm - 1mm);
          min-height: calc(297mm - 2.8cm - 1mm);
          max-height: calc(297mm - 2.8cm - 1mm);
          overflow: hidden;
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
        .textos-padrao-capitulo-titulo {
          font-size: 14px;
          font-weight: 700;
          color: #1e4d28;
          border-bottom: 2px solid #006B54;
          padding-bottom: 4px;
          margin-bottom: 8px;
        }
        .textos-padrao-capitulo-conteudo {
          font-size: 11px;
          color: #1f2937;
          line-height: 1.55;
        }
        .textos-padrao-capitulo-conteudo p { margin: 0 0 8px 0; }
        .textos-padrao-capitulo-conteudo h1 { font-size: 16px; font-weight: 700; color: #1e4d28; margin: 12px 0 6px; }
        .textos-padrao-capitulo-conteudo h2 { font-size: 14px; font-weight: 700; color: #1e4d28; margin: 10px 0 6px; }
        .textos-padrao-capitulo-conteudo h3 { font-size: 12px; font-weight: 700; color: #1e4d28; margin: 8px 0 4px; }
        .textos-padrao-capitulo-conteudo ul,
        .textos-padrao-capitulo-conteudo ol { margin: 0 0 8px 20px; padding: 0; }
        .textos-padrao-capitulo-conteudo li { margin: 2px 0; }
        .textos-padrao-capitulo-conteudo a { color: #006B54; text-decoration: underline; }
        .textos-padrao-capitulo-conteudo img {
          max-width: 100%;
          height: auto;
          border-radius: 4px;
          margin: 8px 0;
        }
        .textos-padrao-capitulo-conteudo table {
          border-collapse: collapse;
          width: 100%;
          margin: 8px 0;
          font-size: 10px;
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
        const conteudoSubstituido = substituirVariaveis(c.conteudo, valores);
        const tituloSubstituido = substituirVariaveisTexto(c.titulo, valores);
        return (
          <article
            key={c.id_capitulo}
            className={
              ehCapa
                ? "textos-padrao-capitulo textos-padrao-capitulo--capa"
                : "textos-padrao-capitulo"
            }
          >
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
