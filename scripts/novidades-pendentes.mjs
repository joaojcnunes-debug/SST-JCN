/**
 * TRIAGEM DE NOVIDADES — quais versões subiram sem nota, e quais delas
 * provavelmente merecem uma.
 *
 * POR QUE ISTO EXISTE. A regra do catálogo ("a nota entra no mesmo commit da
 * mudança") depende de disciplina, e nada avisava quem esquecia. A v0.3.562
 * subiu sem nota e ninguém notou até alguém perguntar. Este script é o aviso
 * que faltava.
 *
 * 🔑 O QUE ELE NÃO FAZ, E É DE PROPÓSITO: ele NÃO decide, e NÃO escreve a nota.
 * A régua do projeto é "entra o que a pessoa perceberia sozinha", e ela não se
 * deduz do diff. O par que prova isso está no topo do catálogo:
 *
 *   • renomear um card para "Inspeções" — 1 linha — ENTRA
 *   • reescrever a exclusão de foto pelo servidor — 6 arquivos — NÃO ENTRA
 *
 * Tamanho e lugar do diff não têm relação com o tamanho da mudança para quem
 * usa. Um classificador automático acertaria o segundo caso e erraria o
 * primeiro, e nota errada na cara de 55 pessoas é pior do que nota faltando.
 * Então aqui é TRIAGEM: separa o que nem precisa ser olhado do que precisa de
 * um humano dizer sim ou não.
 *
 * Uso:  node scripts/novidades-pendentes.mjs [versao-inicial]
 *       node scripts/novidades-pendentes.mjs 0.3.560     (padrão: onde o
 *                                                         catálogo começa)
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DESDE = process.argv[2] ?? "0.3.560";

const git = (cmd) => execSync(`git ${cmd}`, { cwd: RAIZ, encoding: "utf8" }).trim();

/**
 * Caminhos que a pessoa NÃO vê mudar. Migration, teste, script, tipo e infra
 * podem virar o projeto do avesso sem alterar um pixel na tela dela.
 */
const INVISIVEIS = [
  /^supabase\/migrations\//,
  /^scripts\//,
  /^deploy\//,
  /\.test\.tsx?$/,
  /^lib\/supabase\/types\.ts$/,
  /^package(-lock)?\.json$/,
  /^\.github\//,
  /^\.forgejo\//,
  /^Dockerfile/,
  /^docker-compose/,
  /^README/,
  /^lib\/novidades\//, // a própria nota não é a mudança
];

/** Caminhos que quase sempre são tela. Não prova nada — só levanta a mão. */
const VISIVEIS = [/^app\/.*\/page\.tsx$/, /^app\/.*\/layout\.tsx$/, /^components\//];

const invisivel = (f) => INVISIVEIS.some((r) => r.test(f));
const visivel = (f) => VISIVEIS.some((r) => r.test(f));

// ─── 1. As versões que o catálogo já cobre ───────────────────────────────────

const catalogo = fs.readFileSync(path.join(RAIZ, "lib/novidades/catalogo.ts"), "utf8");
const cobertas = new Set([...catalogo.matchAll(/"(\d+\.\d+\.\d+)"/g)].map((m) => m[1]));

// ─── 2. Toda versão que já existiu, com o commit que a carimbou ──────────────

const commits = git('log --format=%H --reverse -- package.json').split("\n").filter(Boolean);

const versoes = [];
let anterior = null;
for (const sha of commits) {
  let v;
  try {
    v = JSON.parse(git(`show ${sha}:package.json`)).version;
  } catch {
    continue;
  }
  if (v !== anterior) {
    versoes.push({ v, sha });
    anterior = v;
  }
}

const ordem = (v) => v.split(".").map(Number).reduce((a, n) => a * 10000 + n, 0);
const daFaixa = versoes.filter((x) => ordem(x.v) >= ordem(DESDE));

/**
 * 🪤 O ALCANCE DE CADA VERSÃO VAI DO BUMP ANTERIOR ATÉ ESTE, e não só o commit
 * do bump. O projeto separa `feat(...)` de `chore: vX` em dois commits — olhar
 * só o commit do bump mostraria `package.json` sozinho e o script diria "só
 * bastidor" para praticamente tudo, que é justamente o erro que ele existe para
 * evitar. Pego rodando o próprio script contra a v0.3.555.
 */
const anteriorDe = new Map();
for (let i = 0; i < versoes.length; i++) {
  anteriorDe.set(versoes[i].v, i > 0 ? versoes[i - 1].sha : `${versoes[i].sha}~1`);
}

// ─── 3. O relatório ──────────────────────────────────────────────────────────

console.log(`\nTriagem de novidades — da ${DESDE} para frente\n${"=".repeat(52)}\n`);

let pendentes = 0;
for (const { v, sha } of daFaixa) {
  if (cobertas.has(v)) continue;
  pendentes++;

  const base = anteriorDe.get(v);
  const assuntos = git(`log --format=%s ${base}..${sha}`).split("\n").filter(Boolean);
  const arquivos = [
    ...new Set(git(`diff --name-only ${base}..${sha}`).split("\n").filter(Boolean)),
  ];

  const naTela = arquivos.filter((f) => visivel(f) && !invisivel(f));
  const bastidor = arquivos.filter((f) => !visivel(f) || invisivel(f));

  console.log(`v${v}  SEM NOTA`);
  assuntos.filter((a) => !/^chore: v\d/.test(a)).forEach((a) => console.log(`  ${a}`));
  if (naTela.length) {
    console.log(`  🔎 mexeu em tela (${naTela.length}) — alguém precisa decidir:`);
    naTela.slice(0, 8).forEach((f) => console.log(`     ${f}`));
    if (naTela.length > 8) console.log(`     ... e mais ${naTela.length - 8}`);
  } else {
    console.log(`  ✔ só bastidor (${bastidor.length} arquivos) — provavelmente não é nota`);
  }
  console.log("");
}

if (pendentes === 0) {
  console.log("Nenhuma versão sem nota. O catálogo está em dia.\n");
} else {
  console.log(`${"=".repeat(52)}`);
  console.log(`${pendentes} versão(ões) sem nota.`);
  console.log(`A pergunta para cada uma é SEMPRE a mesma, e é humana:`);
  console.log(`  "a pessoa perceberia isso sozinha, sem ninguém contar?"`);
  console.log(`Se sim, a nota entra em lib/novidades/catalogo.ts.\n`);
}
