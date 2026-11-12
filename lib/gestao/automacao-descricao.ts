// 11/11/2026 — automação em português simples, para a janela de Automações (resumo da regra recolhida e
// a linha de cada ação) e para a página Automações (todas as regras de todos os quadros).
// Regras puras: recebem a regra e os nomes (etapas, quadros, campos, modelos, pessoas) e devolvem texto.
// Nada aqui decide se a regra roda — isso é do motor (gestao_automacao_run / gestao_automacao_cond_teste).

export interface GatilhoInfo { value: string; label: string; grupo: string }

/** Gatilhos do "Quando". Os de subtarefa (11/11) espelham os de Tarefa, Pessoas e Datas, disparando pela subtarefa. */
export const GATILHOS: GatilhoInfo[] = [
  { value: "tarefa_criada", label: "Quando a tarefa é criada", grupo: "Tarefa" },
  { value: "status_muda", label: "Quando o status muda", grupo: "Tarefa" },
  { value: "prioridade_muda", label: "Quando a prioridade muda", grupo: "Tarefa" },
  { value: "campo_muda", label: "Quando um campo muda", grupo: "Tarefa" },
  { value: "etiqueta_adicionada", label: "Quando uma etiqueta é adicionada", grupo: "Tarefa" },
  { value: "tarefa_movida_quadro", label: "Quando a tarefa muda de quadro", grupo: "Tarefa" },
  { value: "responsavel_adicionado", label: "Quando um responsável é adicionado", grupo: "Pessoas" },
  { value: "comentario_adicionado", label: "Quando alguém comenta", grupo: "Pessoas" },
  { value: "tarefa_aprovada", label: "Quando a tarefa é aprovada", grupo: "Pessoas" },
  { value: "tarefa_rejeitada", label: "Quando a aprovação é recusada", grupo: "Pessoas" },
  { value: "prazo_proximo", label: "Quando o prazo se aproxima", grupo: "Datas" },
  { value: "prazo_vencido", label: "Quando o prazo vence (atrasada)", grupo: "Datas" },
  { value: "data_inicio_chega", label: "Quando a data de início chega", grupo: "Datas" },
  { value: "subtarefa_criada", label: "Quando uma subtarefa é criada", grupo: "Subtarefa · tarefa" },
  { value: "subtarefa_concluida", label: "Quando uma subtarefa é concluída", grupo: "Subtarefa · tarefa" },
  { value: "subtarefa_reaberta", label: "Quando uma subtarefa é reaberta", grupo: "Subtarefa · tarefa" },
  { value: "subtarefa_etapa_muda", label: "Quando a etapa da subtarefa muda", grupo: "Subtarefa · tarefa" },
  { value: "subtarefa_renomeada", label: "Quando a subtarefa é renomeada", grupo: "Subtarefa · tarefa" },
  { value: "subtarefa_responsavel_adicionado", label: "Quando um responsável é colocado na subtarefa", grupo: "Subtarefa · pessoas" },
  { value: "subtarefa_responsavel_removido", label: "Quando o responsável da subtarefa é trocado ou retirado", grupo: "Subtarefa · pessoas" },
  { value: "subtarefa_entrega_proxima", label: "Quando a entrega desejada da subtarefa se aproxima", grupo: "Subtarefa · datas" },
  { value: "subtarefa_entrega_vencida", label: "Quando a entrega desejada da subtarefa vence", grupo: "Subtarefa · datas" },
  { value: "subtarefa_inicio_chega", label: "Quando o início desejado da subtarefa chega", grupo: "Subtarefa · datas" },
  { value: "agendado", label: "Em um horário (agenda)", grupo: "Tempo e cobrança" },
  { value: "tarefa_parada", label: "Quando a tarefa fica parada (SLA)", grupo: "Tempo e cobrança" },
  { value: "dependencia_liberada", label: "Quando as tarefas que bloqueiam são concluídas", grupo: "Tempo e cobrança" },
  { value: "manual", label: "Quando alguém clica no botão ⚡ (manual)", grupo: "Botão" },
  { value: "sst_inspecao_concluida", label: "Quando uma inspeção é concluída (1ª vez)", grupo: "SST" },
  { value: "sst_documento_concluido", label: "Quando um documento é concluído (1ª vez)", grupo: "SST" },
  { value: "sst_vencimento", label: "Quando um documento ou extintor vai vencer", grupo: "SST" },
];
export const GRUPOS_GATILHO = [...new Set(GATILHOS.map((g) => g.grupo))];

/** Gatilhos que pedem "quantos dias antes" (0 = no dia). */
export const GATILHOS_COM_DIAS = new Set(["prazo_proximo", "data_inicio_chega", "subtarefa_entrega_proxima", "subtarefa_inicio_chega"]);
/** Padrão de dias quando a regra não diz (mesmo do motor). */
export const DIAS_PADRAO: Record<string, string> = { prazo_proximo: "3", subtarefa_entrega_proxima: "3", data_inicio_chega: "0", subtarefa_inicio_chega: "0" };
export const ehGatilhoSubtarefa = (g: string) => g.startsWith("subtarefa_");

export interface Nomes {
  /** slug → nome das etapas do quadro da regra */
  etapas?: Record<string, string>;
  /** id → nome dos quadros */
  quadros?: Record<string, string>;
  /** id do quadro → (slug → nome) das etapas dele, para "criar/mover para outro quadro" */
  etapasDeQuadro?: Record<string, Record<string, string>>;
  /** id → nome dos campos */
  campos?: Record<string, string>;
  /** slug → título dos modelos de subtarefa */
  modelos?: Record<string, string>;
  /** e-mail → nome da pessoa */
  pessoas?: Record<string, string>;
}

export interface CondMin { all?: ClausulaMin[]; any?: ClausulaMin[]; de?: string; para?: string; dias_antes?: string; [k: string]: unknown }
export interface ClausulaMin { campo?: string; op?: string; valor?: unknown }
export interface AcaoDesc {
  tipo?: string; valor?: string; campo_id?: string; emails?: string[]; vinculo_tipo?: string;
  id_quadro_destino?: string; status_destino?: string; modelo_slug?: string; responsavel_email?: string;
  texto?: string; assunto?: string; para?: string; dias?: string; quantidade?: string; unidade?: string;
  modo?: string; aprovador_email?: string; titulo_template?: string; condicao?: CondMin;
}
export interface RegraDesc { gatilho: string; condicao?: CondMin | null; acoes: AcaoDesc[] }

const lista = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} e ${xs[xs.length - 1]}`);
const listaOu = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} ou ${xs[xs.length - 1]}`);
const aspas = (s: string) => `"${s}"`;
const valores = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(String) : typeof v === "string" ? v.split(",").map((x) => x.trim()).filter(Boolean) : v == null ? [] : [String(v)];

export function nomeEtapa(slug: string | undefined, n: Nomes, idQuadro?: string): string {
  if (!slug) return "";
  const m = idQuadro ? n.etapasDeQuadro?.[idQuadro] : n.etapas;
  return m?.[slug] ?? n.etapas?.[slug] ?? slug;
}
export const nomePessoa = (email: string | undefined, n: Nomes) => (email ? n.pessoas?.[email.toLowerCase()] ?? email : "");
const nomeQuadro = (id: string | undefined, n: Nomes) => (!id ? "" : id === "@unidade" ? "o quadro da unidade do cartão" : n.quadros?.[id] ?? id);

/** A 1ª etapa de um quadro (quando a ação não escolhe etapa, o motor usa a de menor ordem). */
export function primeiraEtapa(idQuadro: string | undefined, n: Nomes): string {
  if (!idQuadro || idQuadro === "@unidade") return "";
  const m = n.etapasDeQuadro?.[idQuadro];
  const primeiro = m ? Object.values(m)[0] : undefined;
  return primeiro ?? "";
}

/** "Empresas Novas de Guapimirim" — rótulo da opção "sem etapa escolhida" no destino. */
export function rotuloPrimeiraEtapa(idQuadro: string | undefined, nomePrimeira: string | undefined, n: Nomes): string {
  if (idQuadro === "@unidade") return nomePrimeira ? `${nomePrimeira} (1ª etapa do quadro da unidade)` : "1ª etapa do quadro da unidade";
  const q = nomeQuadro(idQuadro, n);
  if (!nomePrimeira) return q ? `1ª etapa de ${q}` : "1ª etapa";
  return q ? `${nomePrimeira} de ${q}` : nomePrimeira;
}

// ── Quando ──────────────────────────────────────────────────────────────────────────────
export function descreverGatilho(r: RegraDesc, n: Nomes = {}): string {
  const c = r.condicao ?? {};
  const dias = String(c.dias_antes ?? DIAS_PADRAO[r.gatilho] ?? "");
  switch (r.gatilho) {
    case "status_muda": {
      const para = c.para ? nomeEtapa(c.para, n) : "";
      const de = c.de ? nomeEtapa(c.de, n) : "";
      if (para && de) return `Quando o cartão sai de ${aspas(de)} e entra em ${aspas(para)}`;
      if (para) return `Quando o cartão entra em ${aspas(para)}`;
      if (de) return `Quando o cartão sai de ${aspas(de)}`;
      return "Quando o cartão muda de etapa";
    }
    case "tarefa_criada": return "Quando um cartão é criado";
    case "prazo_proximo": return `Quando faltam ${dias || "3"} dia(s) para o prazo do cartão`;
    case "prazo_vencido": return "Quando o prazo do cartão vence";
    case "data_inicio_chega": return dias && dias !== "0" ? `Quando faltam ${dias} dia(s) para a data de início do cartão` : "Quando chega a data de início do cartão";
    case "subtarefa_entrega_proxima": return `Quando faltam ${dias || "3"} dia(s) para a entrega desejada de uma subtarefa`;
    case "subtarefa_inicio_chega": return dias && dias !== "0" ? `Quando faltam ${dias} dia(s) para o início desejado de uma subtarefa` : "Quando chega o início desejado de uma subtarefa";
    default: {
      const g = GATILHOS.find((x) => x.value === r.gatilho);
      const cartao: Record<string, string> = {
        tarefa_aprovada: "Quando o cartão é aprovado",
        tarefa_movida_quadro: "Quando o cartão muda de quadro",
        tarefa_parada: "Quando o cartão fica parado (SLA)",
        prioridade_muda: "Quando a prioridade do cartão muda",
        campo_muda: "Quando um campo do cartão muda",
        etiqueta_adicionada: "Quando uma etiqueta é posta no cartão",
        responsavel_adicionado: "Quando um responsável é colocado no cartão",
        comentario_adicionado: "Quando alguém comenta no cartão",
      };
      return cartao[r.gatilho] ?? g?.label ?? r.gatilho;
    }
  }
}

// ── Se ──────────────────────────────────────────────────────────────────────────────────
export function descreverClausula(cl: ClausulaMin, n: Nomes = {}): string {
  const campo = cl.campo ?? "";
  const op = (cl.op ?? "=").toLowerCase();
  const vs = valores(cl.valor);
  if (op === "vazio") return `${rotuloCampo(campo, n)} está vazio`;
  if (op === "nao_vazio") return `${rotuloCampo(campo, n)} está preenchido`;
  const etapa = campo === "status" || campo === "status_para" || campo === "status_de" || campo === "subtarefa_etapa";
  const ehEtiqueta = campo === "etiqueta";
  const fmt = (v: string) => (etapa && campo !== "subtarefa_etapa" ? aspas(nomeEtapa(v, n)) : ehEtiqueta ? v : aspas(v));
  const alvo = vs.map(fmt);
  switch (campo) {
    case "status_para":
      return op === "!=" ? `o cartão não entrou em ${listaOu(alvo)}` : `o cartão entrou em ${listaOu(alvo)}`;
    case "status_de":
      return `o cartão saiu de ${listaOu(alvo)}`;
    case "status":
      return op === "!=" ? `o cartão não está em ${listaOu(alvo)}` : `o cartão está em ${listaOu(alvo)}`;
    case "etiqueta":
      if (op === "nao_contem" || op === "!=") return `não tem a etiqueta ${listaOu(alvo)}`;
      return `tem a etiqueta ${listaOu(alvo)}`;
    default: {
      const rot = rotuloCampo(campo, n);
      if (op === "nao_contem") return `${rot} não contém ${listaOu(alvo)}`;
      if (op === "contains") return `${rot} contém ${listaOu(alvo)}`;
      if (op === "in") return `${rot} é ${listaOu(alvo)}`;
      if (op === "!=") return `${rot} não é ${listaOu(alvo)}`;
      return `${rot} é ${listaOu(alvo)}`;
    }
  }
}

function rotuloCampo(campo: string, n: Nomes): string {
  if (campo.startsWith("campo:")) return n.campos?.[campo.slice(6)] ?? "o campo";
  const m: Record<string, string> = {
    subtarefa: "o nome da subtarefa", subtarefa_texto: "o nome da subtarefa", subtarefa_etapa: "a etapa da subtarefa",
    subtarefa_tipo: "o tipo da subtarefa", prioridade: "a prioridade", prioridade_de: "a prioridade anterior", quadro: "o quadro",
    responsavel: "o responsável", responsavel_email: "o responsável", titulo: "o título", origem: "a origem",
    dia_semana: "o dia da semana", prazo_estado: "o prazo", campo_alterado: "o campo alterado", etiqueta_nova: "a etiqueta nova",
    comentario: "o comentário", comentario_texto: "o comentário", empresa: "a empresa", unidade: "a unidade", tecnico: "o técnico", fonte: "a fonte",
  };
  return m[campo] ?? campo;
}

export function descreverCondicao(c: CondMin | null | undefined, n: Nomes = {}): string {
  if (!c) return "";
  const all = (c.all ?? []).map((x) => descreverClausula(x, n)).filter(Boolean);
  const any = (c.any ?? []).map((x) => descreverClausula(x, n)).filter(Boolean);
  const partes: string[] = [];
  if (all.length) partes.push(lista(all));
  if (any.length) partes.push(any.length === 1 ? any[0] : `(${listaOu(any)})`);
  return partes.join(" e ");
}

// ── Então ───────────────────────────────────────────────────────────────────────────────
export function descreverAcao(a: AcaoDesc, n: Nomes = {}): string {
  const pessoas = (a.emails ?? []).map((e) => nomePessoa(e, n));
  let t: string;
  switch (a.tipo) {
    case "mover_status": t = `Move o cartão para ${aspas(nomeEtapa(a.valor, n))}`; break;
    case "mover_status_se_completo": t = `Se todas as subtarefas estiverem concluídas, move o cartão para ${aspas(nomeEtapa(a.valor, n))}`; break;
    case "concluir": t = "Conclui o cartão"; break;
    case "definir_responsavel": t = `Define ${a.valor ? nomePessoa(a.valor, n) : "o responsável"} como responsável`; break;
    case "definir_prioridade": t = `Muda a prioridade para ${a.valor ?? "?"}`; break;
    case "definir_prazo": t = `Põe o prazo em ${a.dias ?? "?"} dia(s)`; break;
    case "definir_campo": t = `Preenche ${n.campos?.[a.campo_id ?? ""] ?? "um campo"}${a.valor ? ` com ${aspas(a.valor)}` : ""}`; break;
    case "adicionar_etiqueta": t = `Põe a etiqueta ${a.valor ?? "?"}`; break;
    case "remover_etiqueta": t = `Tira a etiqueta ${a.valor ?? "?"}`; break;
    case "criar_subtarefas_modelo": {
      const m = n.modelos?.[a.modelo_slug ?? ""] ?? a.modelo_slug ?? "?";
      t = `Cria as subtarefas do modelo ${aspas(m)}${a.responsavel_email ? `, com ${nomePessoa(a.responsavel_email, n)} como responsável` : ""}`;
      break;
    }
    case "adicionar_vinculados": {
      const papel = a.vinculo_tipo === "seguidor" ? (pessoas.length > 1 ? "seguidores" : "seguidor(a)") : (pessoas.length > 1 ? "responsáveis" : "responsável");
      t = pessoas.length ? `Coloca ${lista(pessoas)} como ${papel}` : `Coloca pessoas como ${papel}`;
      break;
    }
    case "atribuir_rodizio": t = `Distribui ${a.modo === "menor_carga" ? "para quem tem menos cartões" : "em rodízio"} entre ${lista(pessoas) || "?"}`; break;
    case "solicitar_aprovacao": t = `Pede aprovação${a.aprovador_email ? ` de ${nomePessoa(a.aprovador_email, n)}` : " (qualquer gestor)"}`; break;
    case "notificar": t = "Avisa todos os vinculados ao cartão (sino)"; break;
    case "enviar_email": {
      const quem = a.para === "vinculados" ? "os vinculados" : a.para === "responsaveis" ? "os responsáveis" : lista(pessoas) || "?";
      t = `Envia aviso (sino e e-mail) para ${quem}${a.assunto ? `: ${aspas(a.assunto)}` : ""}`;
      break;
    }
    case "comentar": t = `Comenta no cartão${a.texto ? `: ${aspas(a.texto.length > 80 ? `${a.texto.slice(0, 77)}…` : a.texto)}` : ""}`; break;
    case "mover_tarefa_quadro":
    case "criar_tarefa_quadro": {
      const q = a.id_quadro_destino;
      const etapa = a.status_destino ? nomeEtapa(a.status_destino, n, q) : primeiraEtapa(q, n);
      const onde = q === "@unidade" ? `no quadro da unidade do cartão${etapa ? `, em ${aspas(etapa)}` : ""}` : `em ${aspas(etapa ? `${etapa} de ${nomeQuadro(q, n)}` : nomeQuadro(q, n))}`;
      const resp = pessoas.length ? `, com ${lista(pessoas)}` : "";
      t = a.tipo === "criar_tarefa_quadro" ? `Cria um cartão ${onde}${resp}` : `Move o cartão para ${onde.replace(/^em /, "")}`;
      break;
    }
    case "duplicar_tarefa": t = "Duplica o cartão"; break;
    case "aguardar": t = `Espera ${a.quantidade ?? "?"} ${a.unidade === "horas" ? "hora(s)" : "dia(s)"} e segue com as próximas ações`; break;
    default: t = a.tipo ? `Ação ${a.tipo}` : "Ação sem tipo (incompleta)";
  }
  const cond = descreverCondicao(a.condicao, n);
  return cond ? `${t} — só se ${cond}` : t;
}

/** Frase da regra inteira: "Quando …, se …: faz A; faz B." */
export function descreverRegra(r: RegraDesc, n: Nomes = {}): string {
  const quando = descreverGatilho(r, n);
  const se = descreverCondicao(r.condicao, n);
  const acoes = r.acoes.map((a) => descreverAcao(a, n));
  const entao = acoes.length ? acoes.map((x) => x.charAt(0).toLowerCase() + x.slice(1)).join("; ") : "ainda não faz nada (sem ações)";
  return `${quando}${se ? `, se ${se}` : ""}: ${entao}.`;
}

/** Nome curto para quem lê: tira prefixos técnicos ("[SST-Esteira] Teresópolis · 2. ") quando o nome é antigo. */
export function nomeLegivel(nome: string, nomeQuadroDaRegra?: string): string {
  let s = nome.replace(/^\[[^\]]+\]\s*/, "");
  if (nomeQuadroDaRegra) {
    const q = nomeQuadroDaRegra.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const ini = s.split(" · ")[0];
    if (ini && ini.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase() === q) s = s.slice(ini.length + 3);
  }
  return s.replace(/^\d+[a-z]?\.\s*/, "").trim() || nome;
}
