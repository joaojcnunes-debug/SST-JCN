// Extrai o Anexo I da NR-4 (CNAE classe -> grau de risco) do texto do PDF
// oficial. Nada e descartado em silencio: toda linha que parece um CNAE e nao
// casa com o padrao vai para `suspeitas` e e mostrada no relatorio.
const fs = require("fs");

const txt = fs.readFileSync(process.argv[2], "utf8");
const linhas = txt.split(/\r?\n/);

// Delimita o Anexo I: do cabecalho ate a nota do IBGE que fecha a tabela.
const ini = linhas.findIndex((l) => /^\s*ANEXO I\s*$/.test(l));
const fim = linhas.findIndex((l) => /cnae\.ibge\.gov\.br/.test(l));
if (ini < 0 || fim < 0 || fim <= ini) {
  console.error("ERRO: nao achei os limites do Anexo I");
  process.exit(1);
}
const corpo = linhas.slice(ini, fim);

// 01.11-3 Cultivo de cereais                                     3
const RE_CLASSE = /^\s*(\d{2}\.\d{2}-\d)\s+(.+?)\s+([1-4])\s*$/;
// Qualquer coisa que comece com o formato de classe, para conferir cobertura.
const RE_PARECE = /^\s*\d{2}\.\d{2}-\d/;

const itens = [];
const suspeitas = [];
for (let i = 0; i < corpo.length; i++) {
  const l = corpo[i];
  if (!l.trim()) continue;
  const m = l.match(RE_CLASSE);
  if (m) {
    const [, codigo, denom, gr] = m;
    itens.push({
      cnae_classe: codigo.replace(/\D/g, ""), // 01.11-3 -> 01113
      codigo_formatado: codigo,
      denominacao: denom.replace(/\s+/g, " ").trim(),
      grau_risco: Number(gr),
    });
  } else if (RE_PARECE.test(l)) {
    suspeitas.push({ linha: ini + i + 1, texto: l.trimEnd() });
  }
}

// ---- conferencias -------------------------------------------------------
const porGrau = { 1: 0, 2: 0, 3: 0, 4: 0 };
itens.forEach((i) => porGrau[i.grau_risco]++);

const vistos = new Map();
const duplicados = [];
for (const i of itens) {
  if (vistos.has(i.cnae_classe)) {
    const ant = vistos.get(i.cnae_classe);
    if (ant.grau_risco !== i.grau_risco) {
      duplicados.push({ ...i, conflito_com: ant.grau_risco });
    }
  } else vistos.set(i.cnae_classe, i);
}

const tamanhoErrado = itens.filter((i) => i.cnae_classe.length !== 5);

console.log("itens extraidos:        " + itens.length);
console.log("codigos unicos:         " + vistos.size);
console.log("por grau:               1=" + porGrau[1] + "  2=" + porGrau[2] + "  3=" + porGrau[3] + "  4=" + porGrau[4]);
console.log("codigo != 5 digitos:    " + tamanhoErrado.length);
console.log("duplicados conflitantes:" + duplicados.length);
console.log("linhas suspeitas:       " + suspeitas.length);
if (suspeitas.length) {
  console.log("--- suspeitas (nao entraram) ---");
  suspeitas.slice(0, 20).forEach((s) => console.log("  L" + s.linha + ": " + s.texto));
}
if (duplicados.length) {
  console.log("--- duplicados conflitantes ---");
  duplicados.forEach((d) => console.log("  " + d.codigo_formatado + " gr=" + d.grau_risco + " vs " + d.conflito_com));
}

fs.writeFileSync(process.argv[3], JSON.stringify([...vistos.values()], null, 1));
console.log("\ngravado em " + process.argv[3]);
