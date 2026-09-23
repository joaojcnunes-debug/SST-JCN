// lib/gestao/import/runrun-mapa.ts — GESTAO-KANBAN-01-F4
//
// De-para FIXO Runrun.it -> Gestao JCN Consultoria. FUNCOES PURAS (zero rede, zero I/O): a ferramenta
// scripts/importar-runrun.ts faz o fetch/extracao dos cartoes e chama estas funcoes. Isolar
// aqui permite provar o mapeamento offline (runrun-mapa.test.ts) — a regra de negocio nao
// depende de credencial nem da API estar no ar.
//
// Tabela de referencia: §6 do briefing GESTAO-KANBAN-01.

// ── Tipos ──────────────────────────────────────────────────────────────────────

/** Prioridade da tarefa na Gestao (gestao_tarefas.prioridade). */
export type Prioridade = "Baixa" | "Media" | "Alta" | "Urgente";

/** Tipo de status por quadro (gestao_status.tipo). */
export type TipoStatus = "nao_iniciado" | "ativo" | "concluido";

export type PapelVinculo = "responsavel" | "seguidor";

export interface StatusMapeado {
  /** slug estavel referenciado por gestao_tarefas.status / gestao_status.slug */
  slug: string;
  /** rotulo legivel (nome original da etapa) */
  nome: string;
  tipo: TipoStatus;
}

export interface PrioridadeMapeada {
  prioridade: Prioridade;
  /** etiquetas que o tipo obriga a acrescentar (ex.: "Verificar com o Supervisor") */
  etiquetasExtra: string[];
}

/** Um alocado/seguidor do Runrun, ja com e-mail resolvido (ou nulo se a API nao trouxe). */
export interface AlocadoEntrada {
  email: string | null | undefined;
  nome?: string | null;
}

export interface VinculoResolvido {
  email: string;
  tipo: PapelVinculo;
}

export interface NaoCasado {
  nome: string | null;
  email: string | null;
  papelPretendido: PapelVinculo;
  motivo: "sem_email" | "sem_conta";
}

export interface VinculosResultado {
  vinculos: VinculoResolvido[];
  naoCasados: NaoCasado[];
}

// ── slug / normalizacao ──────────────────────────────────────────────────────────

/** Remove acentos, baixa caixa, troca separadores por hifen, colapsa. Deterministico. */
export function slugify(bruto: string | null | undefined): string {
  return (bruto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // tira diacriticos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // qualquer nao-alfanumerico -> hifen
    .replace(/^-+|-+$/g, ""); // apara pontas
}

/** Normaliza uma tag (unidade) do Runrun para etiqueta da Gestao. Ex.: "Nova Friburgo" -> "nova-friburgo". */
export function normalizarEtiqueta(tag: string | null | undefined): string {
  return slugify(tag);
}

/** Normaliza a lista de tags: slug + remove vazias + dedupe preservando ordem. */
export function normalizarEtiquetas(tags: (string | null | undefined)[]): string[] {
  const vistas = new Set<string>();
  const saida: string[] = [];
  for (const t of tags) {
    const s = normalizarEtiqueta(t);
    if (s && !vistas.has(s)) {
      vistas.add(s);
      saida.push(s);
    }
  }
  return saida;
}

// ── Tipo (Runrun) -> prioridade (Gestao) ──────────────────────────────────────────
//
// §6: Critico/Emergencia -> Urgente; Medio -> Media; Baixo -> Baixa;
//     "Verificar com o Supervisor" -> Alta + etiqueta `verificar-supervisor`.
//     Sem tipo / desconhecido -> Media (default do schema v86).

export const ETIQUETA_VERIFICAR_SUPERVISOR = "verificar-supervisor";

export function tipoParaPrioridade(tipo: string | null | undefined): PrioridadeMapeada {
  const s = slugify(tipo);
  switch (s) {
    case "critico":
    case "emergencia":
      return { prioridade: "Urgente", etiquetasExtra: [] };
    case "medio":
      return { prioridade: "Media", etiquetasExtra: [] };
    case "baixo":
      return { prioridade: "Baixa", etiquetasExtra: [] };
    case "verificar-com-o-supervisor":
      return { prioridade: "Alta", etiquetasExtra: [ETIQUETA_VERIFICAR_SUPERVISOR] };
    default:
      // tipo ausente ou fora do catalogo conhecido -> prioridade default, sem etiqueta.
      return { prioridade: "Media", etiquetasExtra: [] };
  }
}

// ── Etapa (Runrun) -> status por quadro (Gestao) ──────────────────────────────────
//
// §6: Concluida/Inativas(/Inadimplentes) = concluido; "Empresas Novas" = nao_iniciado;
//     demais = ativo. O slug e derivado do nome da etapa (estavel).

export function etapaParaStatus(etapaNome: string | null | undefined): StatusMapeado {
  const nome = (etapaNome ?? "").trim();
  const slug = slugify(nome);
  return { slug, nome, tipo: classificarTipoEtapa(slug) };
}

function classificarTipoEtapa(slug: string): TipoStatus {
  // fechadas -> concluido. Cobre "Concluida"/"Concluido"/"Concluidas"/"Concluidos"
  // (singular/plural, masc/fem) sem pegar "Concluir ..." (que nao comeca por "concluid").
  if (/^concluid/.test(slug)) return "concluido";
  if (slug.startsWith("inativas") || slug.startsWith("inativos")) return "concluido";
  if (slug.startsWith("inadimplentes")) return "concluido";
  if (slug === "inativas-inadimplentes") return "concluido";
  // ponta de entrada -> nao_iniciado
  if (slug === "empresas-novas") return "nao_iniciado";
  return "ativo";
}

// ── Alocados/seguidores (Runrun) -> vinculados (Gestao) ────────────────────────────
//
// §6: 1o alocado -> vinculo `responsavel`; demais alocados -> `seguidor`; seguidores do
//     Runrun -> `seguidor`. Casamento por e-mail (minusculo) contra o cadastro do painel;
//     nao-casados vao para gestao_import_log (aqui: lista `naoCasados`).
//
// contasPorEmail deve conter e-mails ja em minusculas. Dedupe: um e-mail que aparece como
// responsavel E seguidor fica so como responsavel (o papel mais forte vence).

export function resolverVinculos(
  alocados: AlocadoEntrada[],
  seguidores: AlocadoEntrada[],
  contasPorEmail: Set<string>,
): VinculosResultado {
  const vinculos: VinculoResolvido[] = [];
  const naoCasados: NaoCasado[] = [];
  const jaColocado = new Map<string, PapelVinculo>(); // email -> papel ja gravado

  const considerar = (entrada: AlocadoEntrada, papel: PapelVinculo) => {
    const email = (entrada.email ?? "").trim().toLowerCase();
    const nome = entrada.nome ?? null;
    if (!email) {
      naoCasados.push({ nome, email: null, papelPretendido: papel, motivo: "sem_email" });
      return;
    }
    if (!contasPorEmail.has(email)) {
      naoCasados.push({ nome, email, papelPretendido: papel, motivo: "sem_conta" });
      return;
    }
    const existente = jaColocado.get(email);
    if (existente === "responsavel") return; // ja tem o papel mais forte
    if (existente === "seguidor") {
      if (papel === "responsavel") {
        // promove: troca o seguidor por responsavel
        const i = vinculos.findIndex((v) => v.email === email && v.tipo === "seguidor");
        if (i >= 0) vinculos.splice(i, 1);
        vinculos.push({ email, tipo: "responsavel" });
        jaColocado.set(email, "responsavel");
      }
      return; // seguidor duplicado: ignora
    }
    vinculos.push({ email, tipo: papel });
    jaColocado.set(email, papel);
  };

  // 1o alocado = responsavel; demais = seguidor.
  alocados.forEach((a, i) => considerar(a, i === 0 ? "responsavel" : "seguidor"));
  // seguidores explicitos = seguidor.
  seguidores.forEach((s) => considerar(s, "seguidor"));

  return { vinculos, naoCasados };
}

// ── Descricao HTML (Runrun) -> texto/markdown (Gestao) ─────────────────────────────
//
// Conversao conservadora, sem dependencia externa: quebra de <br>/<p>/<div>, listas <li> em
// "- ", links <a href> em [texto](url), e strip do resto + decode das entidades comuns.

export function htmlParaTexto(html: string | null | undefined): string {
  if (!html) return "";
  let t = html;

  // links: <a href="url">texto</a> -> [texto](url)
  t = t.replace(
    /<a\b[^>]*?href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_m, href: string, texto: string) => {
      const rotulo = tirarTags(texto).trim();
      return rotulo ? `[${rotulo}](${href})` : href;
    },
  );

  // itens de lista -> "- "
  t = t.replace(/<li\b[^>]*>/gi, "\n- ");
  t = t.replace(/<\/li>/gi, "");

  // quebras de bloco -> \n
  t = t.replace(/<br\s*\/?>/gi, "\n");
  t = t.replace(/<\/(p|div|h[1-6]|tr)>/gi, "\n");
  t = t.replace(/<(p|div|h[1-6]|ul|ol|tr)\b[^>]*>/gi, "\n");

  t = tirarTags(t);
  t = decodificarEntidades(t);

  // normaliza espacos em branco: no maximo 1 linha em branco, sem espacos nas pontas de linha.
  t = t
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/g, "").replace(/^[ \t]+/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return t;
}

function tirarTags(s: string): string {
  return s.replace(/<[^>]+>/g, "");
}

function decodificarEntidades(s: string): string {
  const mapa: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&#039;": "'",
    "&apos;": "'",
    "&nbsp;": " ",
  };
  return s
    .replace(/&(amp|lt|gt|quot|apos|nbsp|#39|#039);/g, (m) => mapa[m] ?? m)
    .replace(/&#(\d+);/g, (_m, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex: string) => String.fromCodePoint(parseInt(hex, 16)));
}

// ── Campos personalizados (Runrun custom fields) -> gestao_tarefas.campos (jsonb) ───
//   GESTAO-KANBAN-02-GE4
//
// O motor v2 (GE2) e a UI (components/gestao/CampoInput.tsx) leem gestao_tarefas.campos: um
// jsonb chaveado pelo ID (uuid) do campo em gestao_campos DO QUADRO da tarefa:
//     { "<uuid Produtos>": ["PGR","PCMSO"], "<uuid Tipo de Cliente>": "Mensal" }
// tipo "multi"  -> valor ARRAY de strings (set: sem repetir, ordem estavel -> idempotente);
// tipo "selecao"/"single"/outro -> valor STRING (a 1a opcao casada).
// Os valores gravados sao a opcao CANONICA (verbatim de gestao_campos.opcoes) — casada por
// igualdade e, se falhar, por normalizacao (acento/caixa/separador). Valor que nao casa NENHUMA
// opcao NAO entra no jsonb: entra em `naoMapeados` para o gestao_import_log (nao quebra o import).
// R1 (revisor-seguranca): valor e SEMPRE uma string do catalogo (ou o cru vindo da API, so no log)
// — nunca HTML; CampoInput renderiza como texto (chip/dropdown).
//
// Shape da API do Runrun (v1.0) — ASSUMIDO e DEFENSIVO (esta funcao nao ve rede nem credencial):
// a tarefa expoe os personalizados num ARRAY (chave `custom_fields`/`task_custom_fields`/
// `custom_field_values` — resolvida no script). Cada entrada varia por conta/versao, entao:
//   • nome do campo: procurado em name|title|custom_field_title|custom_field_name|label|field_name
//     (inclusive aninhado em `custom_field`/`field`).
//   • valor(es): procurados em value|values|value_name|selected|custom_field_value|
//     custom_field_values|option|options — aceita escalar (string/number), array de strings,
//     ou objeto/array de objetos {value|name|title|label|text|value_name}.
//   • multi como N entradas do MESMO campo (uma por valor) OU 1 entrada com array: ambos suportados
//     (os valores do mesmo campo sao UNIDOS antes de casar).
// Se a API so trouxer id numerico da opcao (sem texto), o valor sai vazio -> o script reporta
// (nao inventa): a chave nao e gravada e cai em `naoMapeados`.

/** Definicao de um campo personalizado do quadro-alvo (linha de gestao_campos). */
export interface CampoDef {
  /** uuid — a CHAVE do valor em gestao_tarefas.campos (jsonb). */
  id: string;
  /** nome legivel: casa com o nome do campo no Runrun por normalizacao ("Produtos"). */
  nome: string;
  /** "multi" -> array; qualquer outro ("selecao"/"single"/...) -> string. */
  tipo: string;
  /** valores canonicos aceitos (verbatim), ex.: ["PGR","PCMSO","Somente PCSMO"]. */
  opcoes: string[];
}

/** Entrada crua de custom field vinda da API do Runrun. Chaves toleradas por defesa. */
export type RunrunCampoBruto = Record<string, unknown>;

export interface CampoNaoMapeado {
  /** nome do campo Runrun (ou null se a entrada nem nome tinha). */
  campo: string | null;
  /** valor cru sem match (ou null). */
  valor: string | null;
  motivo: "campo_sem_def" | "opcao_sem_match" | "single_valor_extra";
}

export interface CamposMapeados {
  /** {id_campo(uuid): valor} pronto para MERGE em gestao_tarefas.campos. */
  campos: Record<string, string | string[]>;
  /** o que nao casou — para o operador conferir no gestao_import_log. */
  naoMapeados: CampoNaoMapeado[];
}

const CHAVES_NOME_CAMPO = [
  "name",
  "title",
  "custom_field_title",
  "custom_field_name",
  "label",
  "field_name",
];
const CHAVES_VALOR_CAMPO = [
  "value",
  "values",
  "value_name",
  "selected",
  "custom_field_value",
  "custom_field_values",
  "option",
  "options",
];
const CHAVES_VALOR_OBJ = ["value", "name", "title", "label", "text", "value_name"];

function acharString(o: Record<string, unknown>, chaves: string[]): string | null {
  for (const k of chaves) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return null;
}

/** Nome do campo Runrun (direto ou aninhado em custom_field/field). */
export function extrairNomeCampo(bruto: RunrunCampoBruto): string | null {
  const direto = acharString(bruto, CHAVES_NOME_CAMPO);
  if (direto) return direto;
  for (const nk of ["custom_field", "field"]) {
    const o = bruto[nk];
    if (o && typeof o === "object" && !Array.isArray(o)) {
      const s = acharString(o as Record<string, unknown>, CHAVES_NOME_CAMPO);
      if (s) return s;
    }
  }
  return null;
}

/** Valores (strings) de uma entrada de custom field — escalar, array, ou objetos. */
export function extrairValores(bruto: RunrunCampoBruto): string[] {
  const out: string[] = [];
  const push = (x: unknown): void => {
    if (typeof x === "string") {
      if (x.trim()) out.push(x.trim());
      return;
    }
    if (typeof x === "number" && Number.isFinite(x)) {
      out.push(String(x));
      return;
    }
    if (x && typeof x === "object" && !Array.isArray(x)) {
      const s = acharString(x as Record<string, unknown>, CHAVES_VALOR_OBJ);
      if (s) out.push(s);
    }
  };
  for (const k of CHAVES_VALOR_CAMPO) {
    const v = bruto[k];
    if (v == null) continue;
    if (Array.isArray(v)) v.forEach(push);
    else push(v);
  }
  return out;
}

/** true para tipos que gravam ARRAY (multipla escolha). */
export function ehCampoMulti(tipo: string | null | undefined): boolean {
  const s = slugify(tipo);
  return (
    s === "multi" ||
    s === "multipla" ||
    s === "multiplo" ||
    s === "multiple" ||
    s === "multiselect" ||
    s === "multi-select" ||
    s === "list-multiple" ||
    s === "list"
  );
}

/** Casa um valor cru contra as opcoes do campo: igualdade verbatim, senao normalizada. */
export function casarOpcao(valor: string | null | undefined, opcoes: string[]): string | null {
  const alvo = (valor ?? "").trim();
  if (!alvo) return null;
  const exato = opcoes.find((o) => o === alvo);
  if (exato !== undefined) return exato;
  const s = slugify(alvo);
  if (!s) return null;
  const norm = opcoes.find((o) => slugify(o) === s);
  return norm ?? null;
}

/**
 * De-para PURO dos campos personalizados de UMA tarefa Runrun -> {id_campo(uuid): valor} para
 * merge em gestao_tarefas.campos. multi -> array (set); selecao/single -> string. Campo sem
 * definicao no quadro e opcao fora do catalogo NAO quebram: vao para `naoMapeados`.
 */
export function mapearCamposTarefa(
  brutos: RunrunCampoBruto[] | null | undefined,
  defs: CampoDef[],
): CamposMapeados {
  const campos: Record<string, string | string[]> = {};
  const naoMapeados: CampoNaoMapeado[] = [];
  const lista = Array.isArray(brutos) ? brutos : [];

  // defs por nome normalizado (primeira vence, se houver colisao).
  const defPorSlug = new Map<string, CampoDef>();
  for (const d of defs) {
    const s = slugify(d.nome);
    if (s && !defPorSlug.has(s)) defPorSlug.set(s, d);
  }

  // agrupa os valores crus por def (une entradas multiplas do mesmo campo).
  const porDef = new Map<string, { def: CampoDef; crus: string[] }>();
  for (const entrada of lista) {
    if (!entrada || typeof entrada !== "object" || Array.isArray(entrada)) continue;
    const nome = extrairNomeCampo(entrada);
    if (!nome) continue; // entrada sem nome de campo -> ruido da API, ignora
    const valores = extrairValores(entrada);
    const def = defPorSlug.get(slugify(nome));
    if (!def) {
      if (valores.length === 0) {
        naoMapeados.push({ campo: nome, valor: null, motivo: "campo_sem_def" });
      } else {
        for (const v of valores) naoMapeados.push({ campo: nome, valor: v, motivo: "campo_sem_def" });
      }
      continue;
    }
    const acc = porDef.get(def.id) ?? { def, crus: [] };
    acc.crus.push(...valores);
    porDef.set(def.id, acc);
  }

  // resolve cada def contra o catalogo de opcoes.
  for (const { def, crus } of porDef.values()) {
    const casados: string[] = [];
    const vistos = new Set<string>();
    for (const cru of crus) {
      const canon = casarOpcao(cru, def.opcoes);
      if (canon === null) {
        naoMapeados.push({ campo: def.nome, valor: cru, motivo: "opcao_sem_match" });
        continue;
      }
      if (!vistos.has(canon)) {
        vistos.add(canon);
        casados.push(canon);
      }
    }
    if (casados.length === 0) continue; // nada casou -> nao grava chave (merge nao apaga nada)
    if (ehCampoMulti(def.tipo)) {
      campos[def.id] = casados; // array (set, ordem estavel)
    } else {
      campos[def.id] = casados[0]; // single -> 1a opcao casada
      for (const extra of casados.slice(1)) {
        naoMapeados.push({ campo: def.nome, valor: extra, motivo: "single_valor_extra" });
      }
    }
  }

  return { campos, naoMapeados };
}
