/**
 * Monta o PLANO do vínculo a partir do dump do runner, sem banco.
 *
 * POR QUE ISTO EXISTE. `scripts/vincular-responsaveis.mjs` fala com o PostgREST
 * pelo túnel — e o túnel não existe desta máquina. O runner do Forgejo consegue
 * ler o banco e imprime as grafias e o cadastro no log; este script recebe esse
 * texto colado e roda A MESMA regra (`planejarVinculo` → `canonicalizarTecnico`)
 * em cima dele.
 *
 * O resultado é idêntico ao do modo seco: quem liga em quem, e o que fica de
 * fora com o motivo. A diferença é que aqui a unidade é a GRAFIA, não a linha —
 * o dump vem agrupado. Isso é uma vantagem para o passo seguinte: o UPDATE pode
 * ser por `tecnico_responsavel = '<grafia>'`, 44 comandos em vez de 536.
 *
 * Uso: node --import ./scripts/testes/carregador.mjs \
 *        scripts/testes/plano-vinculo-do-dump.mjs <arquivo-do-dump>
 */

import { readFileSync } from "node:fs";
import { planejarVinculo, resumirSemVinculo } from "@/lib/dashboard/vinculo-tecnicos";

const arquivo = process.argv[2];
if (!arquivo) {
  console.error("uso: ... plano-vinculo-do-dump.mjs <arquivo-do-dump>");
  process.exit(1);
}

const bruto = readFileSync(arquivo, "utf8");

// O log do CI carimba cada linha com o instante. Tirar antes de qualquer coisa.
const linhas = bruto
  .split(/\r?\n/)
  .map((l) => l.replace(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z\s*/, "").trim())
  .filter(Boolean);

const grafias = [];
const cadastro = [];
let secao = null;

for (const l of linhas) {
  if (l.startsWith("== GRAFIAS")) { secao = "grafias"; continue; }
  if (l.startsWith("== CADASTRO")) { secao = "cadastro"; continue; }
  if (l.startsWith("==") || l.startsWith("#")) { secao = null; continue; }
  if (!secao) continue;

  const partes = l.split("|");
  if (secao === "grafias") {
    const [texto, n] = partes;
    // `(nulo)` é como o SQL imprimiu o campo em branco. Devolver ao que ele é,
    // senão a regra trataria a string literal "(nulo)" como um nome.
    grafias.push({ texto: texto === "(nulo)" ? null : texto, linhas: Number(n) });
  } else {
    const [id, nome] = partes;
    if (id && nome) cadastro.push({ id_usuario: id, nome });
  }
}

// Uma "linha" por grafia: o plano decide por texto, então agrupar não muda o
// veredito — só a contagem, que eu recomponho depois.
const plano = planejarVinculo(
  grafias.map((g, i) => ({
    id_responsavel: `GRAFIA-${i}`,
    tecnico_responsavel: g.texto,
    id_usuario: null,
  })),
  cadastro,
);

const qtd = new Map(grafias.map((g, i) => [`GRAFIA-${i}`, g.linhas]));
const total = grafias.reduce((s, g) => s + g.linhas, 0);

const somaLigadas = plano.ligar.reduce((s, l) => s + (qtd.get(l.id_responsavel) ?? 0), 0);
const resumo = resumirSemVinculo(plano.semVinculo);

console.log(`\ngrafias distintas ......... ${grafias.length}`);
console.log(`linhas no total ........... ${total}`);
console.log(`contas no cadastro ........ ${cadastro.length}`);
console.log(`\nGRAFIAS QUE LIGAM ......... ${plano.ligar.length}  (${somaLigadas} linhas)`);
console.log(`grafias que ficam de fora . ${plano.semVinculo.length}`);
for (const [motivo, n] of Object.entries(resumo)) {
  if (n > 0) {
    const linhasMotivo = plano.semVinculo
      .filter((s) => s.motivo === motivo)
      .reduce((s, x) => s + (qtd.get(x.id_responsavel) ?? 0), 0);
    console.log(`   ${motivo.padEnd(20)} ${n} grafia(s), ${linhasMotivo} linha(s)`);
  }
}

const porPessoa = new Map();
for (const l of plano.ligar) {
  const a = porPessoa.get(l.cadastro) ?? { linhas: 0, grafias: [], apelido: false };
  a.linhas += qtd.get(l.id_responsavel) ?? 0;
  a.grafias.push(l.digitado);
  if (l.porApelido) a.apelido = true;
  porPessoa.set(l.cadastro, a);
}

console.log("\n── QUEM GANHA QUANTAS LINHAS ──");
for (const [nome, d] of [...porPessoa].sort((a, b) => b[1].linhas - a[1].linhas)) {
  console.log(
    `${String(d.linhas).padStart(4)}  ${nome}${d.apelido ? "  [apelido]" : ""}\n` +
      `      ${d.grafias.length} grafia(s): ${d.grafias.join(" · ")}`,
  );
}

if (plano.semVinculo.length > 0) {
  console.log("\n── FICAM DE FORA ──");
  for (const s of plano.semVinculo) {
    const n = qtd.get(s.id_responsavel) ?? 0;
    const cands = s.candidatos?.length ? `  → disputam: ${s.candidatos.join(" | ")}` : "";
    console.log(`${String(n).padStart(4)}  "${s.digitado}"  [${s.motivo}]${cands}`);
  }
}

// ─── O SQL, gerado a partir do que a REGRA decidiu ──────────────────────────
// Isto não é a regra reescrita em SQL: é o RESULTADO dela transportado. Cada
// comando cita a grafia exata, e o `id_usuario is null` impede sobrescrever
// vínculo que alguém tenha feito à mão nesse meio tempo.
console.log("\n── SQL (não rode ainda) ──");
for (const l of plano.ligar) {
  const g = l.digitado.replace(/'/g, "''");
  console.log(
    `update public.responsaveis set id_usuario='${l.id_usuario}' ` +
      `where tecnico_responsavel='${g}' and id_usuario is null;`,
  );
}
