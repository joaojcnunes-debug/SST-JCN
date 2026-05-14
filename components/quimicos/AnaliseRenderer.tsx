"use client";

import { Fragment } from "react";

/**
 * Renderiza o texto da análise (depois de remover o bloco
 * ---CONCLUSAO_RAPIDA---) com suporte a:
 *  - Títulos numerados "1. IDENTIFICAÇÃO..." → h3 destacado
 *  - Tabelas markdown "| col | col |" → <table>
 *  - Listas "- item" → <ul><li>
 *  - Alertas com "⚠️" → caixa amarela
 *  - Negrito **texto** → <strong>
 *
 * Sem dependência de markdown lib — implementação leve, customizada pra
 * formato esperado do prompt.
 */

function cleanText(raw: string): string {
  return raw
    .replace(/---CONCLUSAO_RAPIDA---[\s\S]*?---FIM_CONCLUSAO---/g, "")
    .trim();
}

function renderInline(line: string): React.ReactNode {
  // Negrito **texto**
  const parts = line.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold">
          {p.slice(2, -2)}
        </strong>
      );
    }
    return <Fragment key={i}>{p}</Fragment>;
  });
}

interface Block {
  type: "h3" | "p" | "alert" | "ul" | "table";
  // Para h3/p/alert
  content?: string;
  // Para ul
  items?: string[];
  // Para table
  rows?: string[][];
}

function parseBlocks(text: string): Block[] {
  const lines = text.split("\n");
  const blocks: Block[] = [];

  let i = 0;
  while (i < lines.length) {
    const linha = lines[i];
    const trimmed = linha.trim();

    // Linha vazia
    if (!trimmed) {
      i++;
      continue;
    }

    // Título numerado: "1. IDENTIFICAÇÃO ..." (1 a 99) ou
    // títulos em caixa alta com hash: "## TITULO"
    if (/^#{1,3}\s+/.test(trimmed)) {
      blocks.push({ type: "h3", content: trimmed.replace(/^#{1,3}\s+/, "") });
      i++;
      continue;
    }
    if (/^\d{1,2}\.\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(trimmed)) {
      blocks.push({ type: "h3", content: trimmed });
      i++;
      continue;
    }

    // Alerta com ⚠️
    if (trimmed.includes("⚠️") || trimmed.startsWith("⚠")) {
      blocks.push({ type: "alert", content: trimmed });
      i++;
      continue;
    }

    // Tabela markdown (linha começa com "|")
    if (trimmed.startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const cells = lines[i]
          .trim()
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((c) => c.trim());
        // Pular linha separadora "|---|---|"
        if (!cells.every((c) => /^-+:?$|^:?-+:?$/.test(c))) {
          rows.push(cells);
        }
        i++;
      }
      if (rows.length > 0) blocks.push({ type: "table", rows });
      continue;
    }

    // Lista "- item" ou "* item"
    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ""));
        i++;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    // Parágrafo normal — agrupa linhas até linha vazia
    const paragraphLines = [trimmed];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith("|") &&
      !lines[i].trim().startsWith("-") &&
      !/^\d{1,2}\.\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(lines[i].trim()) &&
      !/^#{1,3}\s+/.test(lines[i].trim()) &&
      !lines[i].includes("⚠️")
    ) {
      paragraphLines.push(lines[i].trim());
      i++;
    }
    blocks.push({ type: "p", content: paragraphLines.join(" ") });
  }

  return blocks;
}

export default function AnaliseRenderer({ texto }: { texto: string }) {
  const limpo = cleanText(texto);
  const blocks = parseBlocks(limpo);

  return (
    <article className="prose-quimico space-y-3">
      {blocks.map((b, idx) => {
        if (b.type === "h3") {
          return (
            <h3
              key={idx}
              className="mt-6 border-b-2 border-verde-primary pb-1 text-base font-bold text-verde-primary"
            >
              {renderInline(b.content ?? "")}
            </h3>
          );
        }
        if (b.type === "alert") {
          return (
            <div
              key={idx}
              className="rounded-lg border-l-4 border-amber-400 bg-amber-50 p-3 text-sm text-amber-900"
            >
              {renderInline(b.content ?? "")}
            </div>
          );
        }
        if (b.type === "ul") {
          return (
            <ul key={idx} className="list-disc space-y-1 pl-6 text-sm">
              {(b.items ?? []).map((it, j) => (
                <li key={j}>{renderInline(it)}</li>
              ))}
            </ul>
          );
        }
        if (b.type === "table") {
          const rows = b.rows ?? [];
          if (rows.length === 0) return null;
          const [header, ...body] = rows;
          return (
            <div key={idx} className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    {header.map((h, j) => (
                      <th
                        key={j}
                        className="border border-verde-border bg-verde-primary px-2 py-1.5 text-left text-xs font-bold uppercase tracking-wider text-white"
                      >
                        {renderInline(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {body.map((row, k) => (
                    <tr key={k} className={k % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      {row.map((cell, j) => (
                        <td
                          key={j}
                          className="border border-gray-200 px-2 py-1.5 text-sm text-gray-800"
                        >
                          {renderInline(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        return (
          <p key={idx} className="text-sm leading-relaxed text-gray-800">
            {renderInline(b.content ?? "")}
          </p>
        );
      })}
    </article>
  );
}
