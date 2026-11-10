import type { ModuloPermitido, Usuario } from "@/lib/supabase/types";

/**
 * Visualizar POR TELA (pedido de 10/11/2026): no cadastro de usuário, cada módulo abre e mostra as telas dele, e
 * cada tela tem o seu Visualizar. Tela desmarcada some do menu, o cartão dela (Sinalização) some do hub e a entrada
 * direta pelo endereço volta para outra tela do módulo.
 *
 *  - Guardado em `usuarios.telas_bloqueadas` (text[], v347): a lista das telas que a pessoa NÃO vê. NULL ou vazia =
 *    vê todas as telas dos módulos que tem (todas as contas antigas). Guardar o bloqueio, e não a liberação, faz uma
 *    tela nova aparecer para todo mundo que já tem o módulo, sem migração.
 *  - Só o Visualizar é por tela. Criar, Editar e Excluir continuam por módulo (`permissoes-modulo.ts`): o banco
 *    confere por tabela (v346) e cada tabela é de um módulo, não de uma tela.
 *  - Admin vê todas as telas, como vê todo módulo que tem.
 *  - Uma rota é da tela de prefixo mais longo: `/inspecoes/minhas/...` é "Minhas inspeções", não "Inspeções"; as
 *    páginas de um registro (`/aep/<id>/laudo`) são da tela da lista (`/aep`).
 *  - Fora do catálogo: Ajuda, Início, os atalhos de "Nova/Novo" (seguem a tela da lista, e criar é o Criar do
 *    módulo) e as telas de Administração. Módulo de uma tela só (EPI, Investigação, Transferências) não abre.
 *
 * Módulo **puro** (sem React/Next), testado em `telas-modulo.test.ts`.
 */

export interface TelaModulo {
  /** A rota principal da tela; é também o que se guarda em `telas_bloqueadas`. */
  id: string;
  rotulo: string;
  /** Outras rotas que são desta tela (a Matriz AIHA da Sinalização). */
  rotasExtras?: string[];
  /** A tela tem cartão próprio no hub (/modulos): bloqueada, o cartão some. */
  cardProprio?: boolean;
}

const SINALIZACAO: TelaModulo = {
  id: "/sinalizacao-psicossocial",
  rotulo: "Sinalização Psicossocial",
  rotasExtras: ["/sinalizacao-matriz-aiha"],
  cardProprio: true,
};

const t = (id: string, rotulo: string): TelaModulo => ({ id, rotulo });

/** As telas de cada módulo, na ordem do menu dele. A Sinalização aparece na AEP e no DRPS: é a mesma tela. */
export const TELAS_DO_MODULO: Partial<Record<ModuloPermitido, TelaModulo[]>> = {
  painel: [
    t("/dashboard", "Dashboard"),
    t("/inspecoes", "Inspeções"),
    t("/inspecoes/minhas", "Minhas inspeções"),
    t("/relatorios", "Relatórios"),
    t("/certificados", "Certificados"),
    t("/riscos-psicossociais", "Riscos Psicossociais"),
    t("/aep-psicossocial", "AEP"),
    t("/inspecoes/ficha", "Ficha em Branco"),
    t("/acoes", "Plano de Ação"),
    t("/texto-padrao", "Texto Padrão"),
    t("/acoes/texto-padrao", "Texto Padrão — Plano de Ação"),
  ],
  conformidade: [
    t("/relatorio-conformidade", "Visão geral"),
    t("/relatorio-conformidade/historico", "Histórico"),
    t("/relatorio-conformidade/texto-padrao", "Texto Padrão"),
  ],
  nao_conformidade: [
    t("/relatorio-nao-conformidade", "Visão geral"),
    t("/relatorio-nao-conformidade/historico", "Histórico"),
    t("/relatorio-nao-conformidade/texto-padrao", "Texto Padrão"),
  ],
  apreciacao_maquinas: [
    t("/apreciacao-maquinas", "Visão geral"),
    t("/apreciacao-maquinas/relacao-maquinas", "Relação de Máquinas"),
    t("/apreciacao-maquinas/texto-padrao", "Texto Padrão"),
  ],
  analise_quimicos: [
    t("/analise-quimicos", "Visão geral"),
    t("/analise-quimicos/historico", "Histórico"),
    t("/analise-quimicos/base", "Base de referência"),
    t("/analise-quimicos/texto-padrao", "Texto Padrão"),
  ],
  aet: [
    t("/aet/dashboard", "Dashboard"),
    t("/aet", "Laudos"),
    t("/aet/formulario-branco", "Formulário em Branco"),
    t("/aet/texto-padrao", "Texto Padrão"),
    t("/aet/owas-config", "Config. OWAS"),
    t("/aet/perfis-owas", "Perfis OWAS"),
    t("/aet/13fatores-config", "Config. 13 Fatores"),
  ],
  aep: [
    t("/aep/dashboard", "Dashboard"),
    t("/aep", "Análises"),
    t("/aep/formulario-branco", "Formulário em Branco"),
    SINALIZACAO,
    t("/aep/matriz-aiha", "Matriz AIHA"),
    t("/aep/biblioteca", "Biblioteca psicossocial"),
    t("/aep/texto-padrao", "Texto Padrão"),
  ],
  consolidacao_psicossocial: [
    t("/consolidacao-grupo", "Grupos de empresas"),
    t("/consolidacao-grupo/por-empresa", "Por empresa"),
    t("/consolidacao-grupo/conciliacao", "Conciliação DRPS/QPS × AEP"),
    t("/consolidacao-grupo/vendas", "Vendas"),
    t("/consolidacao-grupo/intervencoes", "Intervenções"),
  ],
  psicossocial: [
    t("/psicossocial/dashboard-geral", "Dashboard Geral"),
    t("/psicossocial", "Relatórios DRPS"),
    t("/psicossocial/empresas", "Empresas"),
    SINALIZACAO,
    t("/psicossocial/agravos", "Possíveis Agravos"),
    t("/psicossocial/medidas-recomendadas", "Medidas Recomendadas"),
    t("/psicossocial/acoes-plano", "Plano de Ação"),
    t("/psicossocial/texto-padrao", "Texto Padrão"),
    t("/psicossocial/metodologia", "Metodologia Aplicada"),
    t("/psicossocial/criterios", "Critérios de Probabilidade"),
  ],
  questionarios_psicossociais: [
    t("/questionarios-psicossociais/resumo", "Resumo"),
    t("/questionarios-psicossociais", "Aplicações"),
    t("/questionarios-psicossociais/tipos", "Tipos e Perguntas"),
    t("/questionarios-psicossociais/como-funciona", "Metodologia"),
    t("/questionarios-psicossociais/texto-padrao", "Texto Padrão (laudo)"),
  ],
  gestao_gerencial: [
    t("/gestao-gerencial", "Início"),
    t("/gestao-gerencial/unidades", "Unidades"),
  ],
  comercial: [
    t("/comercial", "Oportunidades"),
    t("/comercial-matriz-aiha", "Matriz AIHA"),
  ],
  dimensionamento: [
    t("/dimensionamento", "Headcount"),
    t("/dimensionamento/unidades", "Unidades"),
    t("/dimensionamento/empresas", "Empresas por Unidade"),
    t("/dimensionamento/colaboradores", "Colaboradores"),
    t("/dimensionamento/funcoes", "Funções"),
    t("/dimensionamento/calendario", "Calendário"),
    t("/dimensionamento/historico", "Histórico"),
  ],
  equipamentos: [
    t("/equipamentos", "Visão geral"),
    t("/equipamentos/movimentacao", "Movimentação"),
  ],
  frota: [
    t("/frota/painel", "Painel"),
    t("/frota", "Veículos"),
    t("/frota/movimentacoes", "Movimentação"),
  ],
  escala_supervisores: [
    t("/escala", "Grade mensal"),
    t("/escala/padrao", "Padrão semanal"),
    t("/escala/conferencia", "Conferência"),
    t("/escala/calendario", "Calendário"),
    t("/escala/relatorios", "Relatórios"),
    t("/escala/configuracao", "Configuração"),
  ],
};

type ComTelas = Pick<Usuario, "perfil" | "modulos_permitidos" | "telas_bloqueadas">;

const caminho = (href: string) => href.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
const casa = (rota: string, alvo: string) => alvo === rota || alvo.startsWith(`${rota}/`);

/** Todas as telas do catálogo, sem repetir (a Sinalização está em dois módulos). */
export const TODAS_AS_TELAS: TelaModulo[] = [
  ...new Map(Object.values(TELAS_DO_MODULO).flat().map((x) => [x.id, x])).values(),
];

/** A tela de uma rota (a de prefixo mais longo), ou null se a rota não é de nenhuma tela do catálogo. */
export function telaDaRota(href: string): TelaModulo | null {
  const alvo = caminho(href);
  let melhor: TelaModulo | null = null;
  let tamanho = -1;
  for (const tela of TODAS_AS_TELAS) {
    for (const rota of [tela.id, ...(tela.rotasExtras ?? [])]) {
      if (casa(rota, alvo) && rota.length > tamanho) {
        melhor = tela;
        tamanho = rota.length;
      }
    }
  }
  return melhor;
}

/** A conta não vê esta tela (pelo id)? Admin vê todas. */
export function telaBloqueada(user: ComTelas | null | undefined, idTela: string): boolean {
  if (!user || user.perfil === "Admin") return false;
  return (user.telas_bloqueadas ?? []).includes(idTela);
}

/** A rota é de uma tela que a conta não vê? Rota fora do catálogo nunca é bloqueada aqui. */
export function rotaBloqueada(user: ComTelas | null | undefined, href: string): boolean {
  const tela = telaDaRota(href);
  return !!tela && telaBloqueada(user, tela.id);
}

/**
 * Para onde mandar quem entrou numa tela que não vê: a primeira tela liberada do mesmo módulo, ou null (sem nenhuma,
 * volta ao hub). `modulos` = os módulos do layout (a Sinalização é de AEP ou DRPS).
 */
export function primeiraTelaLiberada(
  user: ComTelas | null | undefined,
  modulos: readonly ModuloPermitido[],
): string | null {
  const permitidos = user?.modulos_permitidos ?? [];
  for (const m of modulos) {
    if (!permitidos.includes(m)) continue;
    const livre = (TELAS_DO_MODULO[m] ?? []).find((x) => !telaBloqueada(user, x.id));
    if (livre) return livre.id;
  }
  return null;
}

/**
 * O cartão do hub some? Cartão de tela própria (Sinalização): some se a tela estiver bloqueada. Cartão do módulo
 * (a rota principal): só some se TODAS as telas do módulo estiverem bloqueadas — com alguma liberada, entrar leva
 * a ela.
 */
export function cartaoBloqueado(user: ComTelas | null | undefined, modulo: ModuloPermitido, href: string): boolean {
  const tela = telaDaRota(href);
  if (!tela) return false;
  if (tela.cardProprio) return telaBloqueada(user, tela.id);
  const telas = (TELAS_DO_MODULO[modulo] ?? []).filter((x) => !x.cardProprio);
  return telas.length > 0 && telas.every((x) => telaBloqueada(user, x.id));
}

// ─── Cadastro ────────────────────────────────────────────────────────────────

/** Liga ou desliga o Visualizar de telas: devolve a nova lista de bloqueadas, sem repetir, na ordem do catálogo. */
export function marcarTelas(bloqueadas: readonly string[], ids: readonly string[], ver: boolean): string[] {
  const set = new Set(bloqueadas);
  for (const id of ids) {
    if (ver) set.delete(id);
    else set.add(id);
  }
  const ordem = TODAS_AS_TELAS.map((x) => x.id);
  return [...set].sort((a, b) => (ordem.indexOf(a) + 1 || 1e6) - (ordem.indexOf(b) + 1 || 1e6));
}

/** Os ids das telas de uma lista de módulos (para "Permitir todas" liberar as telas junto). */
export function telasDosModulos(modulos: readonly string[]): string[] {
  return [...new Set(modulos.flatMap((m) => (TELAS_DO_MODULO[m as ModuloPermitido] ?? []).map((x) => x.id)))];
}

/**
 * O que gravar: só as telas de módulos que a conta vê e que existem no catálogo; lista vazia vira null (vê tudo).
 * Uma tela compartilhada (Sinalização) fica se a conta vê algum dos módulos dela.
 */
export function telasParaGravar(modulos: readonly string[], bloqueadas: readonly string[]): string[] | null {
  const validas = new Set(telasDosModulos(modulos));
  const lista = marcarTelas([], bloqueadas.filter((id) => validas.has(id)), false);
  return lista.length ? lista : null;
}
