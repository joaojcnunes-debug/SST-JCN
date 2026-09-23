/**
 * Banco de provas do PDF do Resumo da Escala (Fase 8).
 *
 * Gera o PDF de verdade, com o MESMO template e as MESMAS margens da rota,
 * sem servidor, sem banco e sem tocar em produção. Existe porque build limpo
 * não diz nada sobre PDF: o template pode compilar e mesmo assim sair com a
 * tabela partida ao meio, coluna estourando a folha ou página em branco.
 *
 * Uso:
 *   node scripts/prova-pdf-escala.mjs [saida.pdf]
 *
 * ── DUAS DECISÕES QUE ESTE ARQUIVO PRECISOU TOMAR ──────────────────────────
 *
 * 1. **Não usa `scripts/testes/carregador.mjs`.** Aquele gancho de resolução
 *    serve para teste de lógica pura; ao entrar a cadeia CJS do puppeteer
 *    (`ws/lib/stream.js` fazendo `require("./websocket")`) ele devolve uma URL
 *    `file://` que o `require` não aceita, e a prova morre antes de começar.
 *
 * 2. **Não importa `lib/pdf/gerar-pdf.ts`** — chama o Chrome direto com as
 *    mesmas margens. O `gerarPdf` já é exercitado por dez laudos em produção;
 *    o que esta prova precisa exercitar é o TEMPLATE novo. Se um dia as opções
 *    de `gerarPdf` mudarem, esta cópia precisa acompanhar — está aqui e não lá
 *    de propósito, para a prova não arrastar meia aplicação junto.
 *
 * Os números são os REAIS do Resumo Anual da planilha da Chabra, para o que se
 * vê na folha ser o que a equipe reconhece.
 */

import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SUPERVISORES = [
  "João Jefferson",
  "Phelipe Klein",
  "Julianna Affonso",
  "Amanda Fernandez",
  "Thaynara Menez",
];

const POR_UNIDADE = [
  ["Campos", [0, 0, 0, 0, 0], 0],
  ["Conselheiro", [0, 0, 0, 0, 0], 0],
  ["Guapimirim", [0, 0, 0, 0, 0], 0],
  ["Nova Friburgo", [0, 1, 0, 0, 0], 1],
  ["Petrópolis", [0, 0, 0, 0, 0], 0],
  ["Piabetá", [0, 0, 0, 0, 0], 0],
  ["Teresópolis", [247, 99, 100, 101, 96], 643],
];

const POR_MES = [
  ["janeiro", 21], ["fevereiro", 18], ["março", 22], ["abril", 19],
  ["maio", 20], ["junho", 21], ["julho", 23], ["agosto", 21],
  ["setembro", 21], ["outubro", 21], ["novembro", 19], ["dezembro", 22],
];

const saida = path.resolve(process.argv[2] ?? "scratchpad/prova-escala.pdf");

/**
 * O Node não lê `.tsx`. Em vez de acrescentar dependência só para esta prova,
 * transpilo com o TypeScript que já está no projeto — e o arquivo transpilado
 * nasce DENTRO de `scripts/`, porque ele importa "react/jsx-runtime" e o Node
 * resolve `node_modules` subindo a partir da pasta do próprio arquivo.
 */
async function carregarTemplate() {
  const { default: ts } = await import("typescript");
  const origem = path.resolve("components/pdf/templates/EscalaResumoTemplate.tsx");
  const js = ts.transpileModule(fsSync.readFileSync(origem, "utf8"), {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  const destino = path.resolve("scripts/.template-transpilado.mjs");
  await fs.writeFile(destino, js, "utf8");
  try {
    return (await import(pathToFileURL(destino).href)).default;
  } finally {
    await fs.rm(destino, { force: true });
  }
}

const [{ default: React }, { renderToStaticMarkup }, Template] = await Promise.all([
  import("react"),
  import("react-dom/server"),
  carregarTemplate(),
]);

const tabelas = [
  {
    titulo: "Dias por unidade",
    nota: "Um dia em mais de uma unidade conta em cada uma delas.",
    primeiraColuna: "Unidade",
    linhas: POR_UNIDADE.map(([rotulo, valores, total]) => ({ rotulo, valores, total })),
    totais: [247, 100, 100, 101, 96],
    totalGeral: 644,
  },
  {
    titulo: "Dias com escala definida, por mês",
    nota: "Conta o dia uma vez, com unidade ou situação — menos o feriado, que a planilha também não contava.",
    primeiraColuna: "Mês",
    linhas: POR_MES.map(([rotulo, n]) => ({
      rotulo,
      valores: [n, n, n, n, n],
      total: n * 5,
    })),
    totais: [248, 248, 248, 248, 248],
    totalGeral: 1240,
  },
];

const bodyHtml = renderToStaticMarkup(
  React.createElement(Template, {
    periodo: "2026",
    supervisores: SUPERVISORES,
    tabelas,
    situacoes: [
      { situacao: "Home office", dias: 531 },
      { situacao: "Feriado", dias: 65 },
    ],
    geradoEm: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
    logoUrl: null,
  })
);

const styleMatch = bodyHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/);
const headStyle = styleMatch ? styleMatch[1] : "";
const semStyle = bodyHtml.replace(/<style[^>]*>[\s\S]*?<\/style>/, "");
const fullHtml = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8" /><title>Escala de Supervisores — 2026</title>
<style>${headStyle}</style></head>
<body style="margin:0;padding:0;background:#fff;font-family:Calibri,Arial,Helvetica,sans-serif;color:#111827;">
${semStyle}
</body></html>`;

const { default: puppeteer } = await import("puppeteer");
const browser = await puppeteer.launch({ headless: true, channel: "chrome" });
const page = await browser.newPage();
await page.setContent(fullHtml, { waitUntil: "networkidle0" });
const pdf = Buffer.from(
  await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "14mm", bottom: "14mm", left: "12mm", right: "12mm" },
  })
);

/**
 * O PNG ao lado do PDF existe porque contar páginas não prova nada sobre o que
 * está NELAS. Sem um rasterizador instalado (poppler), esta é a forma de
 * alguém — pessoa ou modelo — realmente OLHAR o resultado.
 *
 * A largura é a área útil da folha: A4 tem 210 mm, menos 12 mm de cada margem,
 * dão 186 mm — 703 px a 96 dpi. Com `emulateMediaType("print")` valem as mesmas
 * regras de impressão que o PDF usou, inclusive as de quebra.
 */
await page.emulateMediaType("print");
await page.setViewport({ width: 703, height: 1000, deviceScaleFactor: 2 });
const png = saida.replace(/\.pdf$/i, ".png");
await page.screenshot({ path: png, fullPage: true });

await browser.close();

await fs.mkdir(path.dirname(saida), { recursive: true });
await fs.writeFile(saida, pdf);

// Contagem de páginas sem dependência: cada página é um objeto `/Type /Page`
// (o `[^s]` evita casar com `/Type /Pages`, que é o nó-raiz da árvore).
const paginas = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;

console.log(`PDF gerado: ${saida}`);
console.log(`  tamanho: ${(pdf.length / 1024).toFixed(1)} kB`);
console.log(`  páginas: ${paginas}`);
console.log(`  espelho: ${png}`);
