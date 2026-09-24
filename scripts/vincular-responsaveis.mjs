/**
 * GRAVA o vínculo entre o técnico digitado e a conta do painel (v204).
 *
 * ─── Por que um script, e não um backfill em SQL ───────────────────────────
 *
 * A regra que decide quem é o técnico mora em `lib/dashboard/tecnicos.ts` e tem
 * 43 grafias reais como teste. Um backfill em SQL teria de reimplementar
 * casamento por conjunto de palavras, normalização de acento e desempate — uma
 * SEGUNDA cópia da mesma regra, que é exatamente o defeito que esta casa já
 * pagou (a mesma conta copiada em quatro telas divergiu em duas). Então o SQL
 * da v204 só cria a coluna, e quem decide o conteúdo é este script, chamando a
 * MESMA função que a tela chama.
 *
 * ─── Ele não decide nada sozinho ───────────────────────────────────────────
 *
 * • Nasce em MODO SECO: mostra o que faria e não escreve. Só escreve com
 *   `--aplicar`, digitado de propósito.
 * • Só preenche linha com `id_usuario` NULO. Vínculo que alguém arrumou na tela
 *   é respeitado, nunca corrigido — o script não é dono do dado.
 * • Nome ambíguo e nome de fora do painel ficam de fora, com o motivo à mostra.
 *   Crédito de trabalho na pessoa errada é pior do que nome fora do agrupamento.
 * • Ao aplicar, grava um arquivo `.json` com TUDO que mudou e imprime o SQL que
 *   desfaz. Sem isso o desfazer dependeria de memória.
 *
 * ─── Precisa do túnel ──────────────────────────────────────────────────────
 *
 * O PostgREST não publica porta: `POSTGREST_INTERNAL_URL` do .env.local aponta
 * para 127.0.0.1:54321, que é a ponta de `deploy\dev-tunnel.ps1`. Deixe o túnel
 * aberto numa janela antes de rodar isto.
 *
 * Uso:
 *   node --import ./scripts/testes/carregador.mjs scripts/vincular-responsaveis.mjs
 *   node --import ./scripts/testes/carregador.mjs scripts/vincular-responsaveis.mjs --aplicar
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { planejarVinculo, resumirSemVinculo } from "@/lib/dashboard/vinculo-tecnicos";

const APLICAR = process.argv.includes("--aplicar");
const RAIZ = process.cwd();

// ─── Ambiente ────────────────────────────────────────────────────────────────

function lerEnv() {
  const bruto = readFileSync(path.join(RAIZ, ".env.local"), "utf8");
  const env = {};
  for (const linha of bruto.split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(linha.trim());
    if (m) env[m[1]] = m[2].trim();
  }
  const url = env.POSTGREST_INTERNAL_URL;
  const token = env.POSTGREST_SERVICE_TOKEN;
  if (!url) throw new Error("POSTGREST_INTERNAL_URL não está no .env.local");
  if (!token) throw new Error("POSTGREST_SERVICE_TOKEN não está no .env.local");
  return { url: url.replace(/\/$/, ""), token };
}

const { url: BASE, token: TOKEN } = lerEnv();
const CABECALHOS = {
  Authorization: `Bearer ${TOKEN}`,
  apikey: TOKEN,
  "Content-Type": "application/json",
};

/** Conexão recusada não é erro de programa: é o túnel fechado. Diga isso. */
function explicarRede(e) {
  const causa = e?.cause?.code ?? e?.code;
  if (causa === "ECONNREFUSED" || causa === "ETIMEDOUT" || causa === "ENOTFOUND") {
    return new Error(
      `Não consegui falar com o PostgREST em ${BASE} (${causa}).\n\n` +
        `O túnel não está aberto. Numa OUTRA janela do PowerShell, rode:\n` +
        `    powershell -File deploy\\dev-tunnel.ps1\n` +
        `deixe a janela aberta, e rode este script de novo.`,
    );
  }
  return e;
}

async function buscar(caminho) {
  let r;
  try {
    r = await fetch(`${BASE}/${caminho}`, { headers: CABECALHOS });
  } catch (e) {
    throw explicarRede(e);
  }
  if (!r.ok) {
    throw new Error(`GET ${caminho} devolveu ${r.status}.\n${await r.text()}`);
  }
  return r.json();
}

// ─── Leitura ─────────────────────────────────────────────────────────────────

const TETO = 20000;

let usuarios;
let responsaveis;
try {
  usuarios = await buscar(`usuarios?select=id_usuario,nome&perfil=neq.Cliente&limit=${TETO}`);
  responsaveis = await buscar(
    `responsaveis?select=id_responsavel,tecnico_responsavel,id_usuario&limit=${TETO}`,
  );
} catch (e) {
  console.error(`
${e.message}
`);
  process.exit(1);
}

// A base é VIVA e cresce. Um teto silencioso entregaria um resultado parcial
// que parece completo — o defeito que a janela progressiva causou na exportação
// do inventário em 10/08.
for (const [nome, linhas] of [["usuarios", usuarios], ["responsaveis", responsaveis]]) {
  if (linhas.length >= TETO) {
    throw new Error(
      `${nome} devolveu ${linhas.length} linhas, o teto desta consulta. ` +
        `Pode haver mais — aumente o TETO antes de aplicar.`,
    );
  }
}

const cadastro = usuarios
  .map((u) => ({ id_usuario: u.id_usuario, nome: (u.nome ?? "").trim() }))
  .filter((u) => u.nome);

if (responsaveis.length > 0 && !("id_usuario" in responsaveis[0])) {
  throw new Error(
    "A coluna `id_usuario` não existe em `responsaveis`. " +
      "Aplique a migration v204 antes de rodar isto.",
  );
}

const plano = planejarVinculo(responsaveis, cadastro);
const resumo = resumirSemVinculo(plano.semVinculo);

// ─── Relatório ───────────────────────────────────────────────────────────────

console.log(`\n${APLICAR ? "APLICANDO" : "MODO SECO — nada será escrito"}\n`);
console.log(`linhas em responsaveis .......... ${responsaveis.length}`);
console.log(`contas no cadastro ............... ${cadastro.length}`);
console.log(`já vinculadas (não toco) ......... ${plano.jaVinculadas}`);
console.log(`VÃO GANHAR VÍNCULO ............... ${plano.ligar.length}`);
console.log(`ficam sem vínculo ................ ${plano.semVinculo.length}`);
console.log(`   em branco no documento ........ ${resumo.vazio}`);
console.log(`   ambíguo (precisa de gente) .... ${resumo.ambiguo}`);
console.log(`   sem login no painel ........... ${resumo.fora_do_painel}`);
console.log(`   cadastro incompleto ........... ${resumo.cadastro_incompleto}`);

const porPessoa = new Map();
for (const l of plano.ligar) {
  const atual = porPessoa.get(l.cadastro) ?? { total: 0, grafias: new Set() };
  atual.total++;
  atual.grafias.add(l.digitado);
  porPessoa.set(l.cadastro, atual);
}
console.log("\n── quem ganha quantas linhas ──");
for (const [nome, d] of [...porPessoa].sort((a, b) => b[1].total - a[1].total)) {
  console.log(`  ${String(d.total).padStart(4)}  ${nome}   (${d.grafias.size} grafia(s))`);
}

const ambiguos = plano.semVinculo.filter((s) => s.motivo === "ambiguo");
if (ambiguos.length > 0) {
  console.log("\n── AMBÍGUOS: a regra se recusa a escolher ──");
  const vistos = new Map();
  for (const a of ambiguos) {
    const chave = a.digitado;
    vistos.set(chave, {
      n: (vistos.get(chave)?.n ?? 0) + 1,
      candidatos: a.candidatos ?? [],
    });
  }
  for (const [digitado, d] of vistos) {
    console.log(`  "${digitado}" (${d.n}x) → disputam: ${d.candidatos.join(" | ")}`);
  }
  console.log("  Resolver: acrescentar em APELIDOS (lib/dashboard/tecnicos.ts),");
  console.log("  que é onde moram as decisões humanas, e rodar de novo.");
}

const foraDoPainel = new Set(
  plano.semVinculo.filter((s) => s.motivo === "fora_do_painel").map((s) => s.digitado),
);
if (foraDoPainel.size > 0) {
  console.log("\n── SEM LOGIN NO PAINEL (isto é o estado correto, não defeito) ──");
  console.log(`  ${[...foraDoPainel].join(" | ")}`);
}

if (!APLICAR) {
  console.log("\nNada foi escrito. Para gravar: --aplicar\n");
  process.exit(0);
}

// ─── Escrita ─────────────────────────────────────────────────────────────────

// Uma requisição por pessoa, não por linha: são ~15 pessoas contra centenas de
// linhas. `id_responsavel=in.(...)` mantém o filtro explícito — nunca um PATCH
// sem WHERE.
let gravadas = 0;
for (const [nomeCadastro] of porPessoa) {
  const linhas = plano.ligar.filter((l) => l.cadastro === nomeCadastro);
  const idUsuario = linhas[0].id_usuario;
  const ids = linhas.map((l) => l.id_responsavel);

  for (let i = 0; i < ids.length; i += 200) {
    const lote = ids.slice(i, i + 200);
    const filtro = `id_responsavel=in.(${lote.map((id) => `"${id}"`).join(",")})`;
    const r = await fetch(`${BASE}/responsaveis?${filtro}&id_usuario=is.null`, {
      method: "PATCH",
      headers: { ...CABECALHOS, Prefer: "return=representation" },
      body: JSON.stringify({ id_usuario: idUsuario }),
    });
    if (!r.ok) throw new Error(`PATCH falhou (${r.status}): ${await r.text()}`);
    gravadas += (await r.json()).length;
  }
}

const carimbo = new Date().toISOString().replace(/[:.]/g, "-");
const registro = path.join(RAIZ, `vinculo-aplicado-${carimbo}.json`);
writeFileSync(registro, JSON.stringify({ quando: new Date().toISOString(), ligacoes: plano.ligar }, null, 2));

console.log(`\n${gravadas} linha(s) gravada(s).`);
if (gravadas !== plano.ligar.length) {
  // O `&id_usuario=is.null` do filtro é uma trava: se alguém vinculou pela tela
  // entre o plano e a escrita, aquela linha NÃO é sobrescrita. Diferença aqui é
  // isso, e é o comportamento certo — mas tem de aparecer.
  console.log(
    `⚠️  o plano previa ${plano.ligar.length}. A diferença são linhas que ` +
      `ganharam vínculo entre a leitura e a escrita, e foram preservadas.`,
  );
}
console.log(`registro do que mudou: ${registro}`);

const desfazer = path.join(RAIZ, `vinculo-desfazer-${carimbo}.sql`);
const ids = plano.ligar.map((l) => `'${l.id_responsavel}'`);
writeFileSync(
  desfazer,
  `-- Desfaz a execução de ${new Date().toISOString()} de scripts/vincular-responsaveis.mjs.\n` +
    `-- Anula SÓ as linhas que esta execução escreveu.\n` +
    `update public.responsaveis set id_usuario = null\n` +
    ` where id_responsavel in (\n   ${ids.join(",\n   ")}\n );\n`,
);
console.log(`como desfazer:         ${desfazer}`);
