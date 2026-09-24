// Leitor do modo -raw com maquina de estados, para cobrir as entradas em que
// a descricao quebra em varias linhas e o GR fica isolado no fim.
// Depois compara com o modo -layout: dois motores independentes.
//
// Uso: node conferir-anexo1.js <nr4-raw.txt> <anexo1-layout.json> <saida.json>
//
// Sai com codigo 1 se os dois metodos discordarem em qualquer ponto — e o que
// impede um artefato de leitura virar dado normativo errado.
const fs = require("fs");
const path = require("path");

const [, , ARQ_RAW, ARQ_LAYOUT, SAIDA] = process.argv;
if (!ARQ_RAW || !ARQ_LAYOUT || !SAIDA) {
  console.error("uso: node conferir-anexo1.js <nr4-raw.txt> <anexo1-layout.json> <saida.json>");
  process.exit(2);
}

const raw = fs.readFileSync(ARQ_RAW, "utf8").split(/\r?\n/);
const ini = raw.findIndex((l) => /^\s*ANEXO I\s*$/.test(l));
const fim = raw.findIndex((l) => /cnae\.ibge\.gov\.br/.test(l));
const corpo = raw.slice(ini, fim).map((l) => l.trim());

// Rodape/cabecalho que se intercalam no meio da tabela.
const RUIDO = (l) =>
  !l ||
  /^Este texto não substitui/i.test(l) ||
  /^Códigos\s+Denominação\s+GR$/i.test(l) ||
  /^ANEXO/i.test(l) ||
  /^RELAÇÃO DA CLASSIFICAÇÃO/i.test(l) ||
  /^2\.0\), COM CORRESPONDENTE/i.test(l) ||
  /^\d{1,3}$/.test(l) === false && false;

const COMPLETA = /^(\d{2}\.\d{2}-\d)\s+(.+?)\s+([1-4])$/;
const SO_CODIGO = /^(\d{2}\.\d{2}-\d)\s*(.*)$/;
const SO_GR = /^([1-4])$/;

const itens = new Map();
const problemas = [];

let i = 0;
while (i < corpo.length) {
  const l = corpo[i];
  if (RUIDO(l)) { i++; continue; }

  const c = l.match(COMPLETA);
  if (c) {
    itens.set(c[1].replace(/\D/g, ""), {
      grau: Number(c[3]),
      denom: c[2].replace(/\s+/g, " ").trim(),
    });
    i++;
    continue;
  }

  const s = l.match(SO_CODIGO);
  if (s) {
    const cod = s[1].replace(/\D/g, "");
    const partes = s[2] ? [s[2]] : [];
    let j = i + 1;
    let grau = null;
    while (j < corpo.length) {
      const n = corpo[j];
      if (RUIDO(n)) { j++; continue; }
      // Achou o proximo codigo antes do GR -> entrada sem grau, e problema.
      if (SO_CODIGO.test(n) && !SO_GR.test(n)) break;
      const g = n.match(SO_GR);
      if (g) { grau = Number(g[1]); j++; break; }
      partes.push(n);
      j++;
    }
    if (grau === null) {
      problemas.push({ cod, contexto: partes.join(" ").slice(0, 80) });
    } else {
      itens.set(cod, { grau, denom: partes.join(" ").replace(/\s+/g, " ").trim() });
    }
    i = j;
    continue;
  }
  i++;
}

const doLayout = new Map(
  JSON.parse(fs.readFileSync(ARQ_LAYOUT, "utf8")).map((x) => [
    x.cnae_classe,
    x.grau_risco,
  ]),
);

const soRaw = [...itens.keys()].filter((k) => !doLayout.has(k));
const soLayout = [...doLayout.keys()].filter((k) => !itens.has(k));
const divergentes = [...doLayout.keys()]
  .filter((k) => itens.has(k) && itens.get(k).grau !== doLayout.get(k))
  .map((k) => ({ cnae: k, layout: doLayout.get(k), raw: itens.get(k).grau }));

console.log("modo -layout:      " + doLayout.size);
console.log("modo -raw:         " + itens.size);
console.log("so no -raw:        " + soRaw.length + (soRaw.length ? " " + soRaw.join(",") : ""));
console.log("so no -layout:     " + soLayout.length + (soLayout.length ? " " + soLayout.join(",") : ""));
console.log("GRAU DIVERGENTE:   " + divergentes.length);
divergentes.forEach((d) => console.log("   " + d.cnae + ": layout=" + d.layout + " raw=" + d.raw));
console.log("sem GR encontrado: " + problemas.length);
problemas.forEach((p) => console.log("   " + p.cod + " | " + p.contexto));

if (soRaw.length || soLayout.length || divergentes.length || problemas.length) {
  console.log("\n*** AINDA HA DISCORDANCIA — NAO USAR ***");
  process.exit(1);
}

const final = [...itens.keys()].sort().map((cod) => ({
  cnae_classe: cod,
  grau_risco: itens.get(cod).grau,
  denominacao: itens.get(cod).denom,
}));
fs.writeFileSync(SAIDA, JSON.stringify(final, null, 1));
console.log("\nDOIS METODOS INDEPENDENTES CONCORDAM nos " + final.length + " mapeamentos.");
console.log("gravado " + path.basename(SAIDA));
