import type {
  AepChecklistCognitiva,
  AepChecklistFisica,
  AepChecklistOrganizacional,
  RespostaChecklistAep,
} from "@/lib/supabase/types";

/**
 * Catálogo da triagem ergonômica do AEP: os itens dos três checklists, as
 * respostas que cada bloco aceita e os métodos de coleta da NR-1.
 *
 * Fonte única para a tela de triagem (`app/(aep)/aep/[id]/setores`) e para o
 * Formulário em Branco (`app/(aep)/aep/formulario-branco`), que imprime o mesmo
 * questionário para preenchimento manual em campo. Antes estas listas viviam
 * dentro da página de setores — o formulário impresso ia nascer como terceira
 * cópia e sair de sincronia na primeira pergunta editada.
 *
 * Módulo PURO (sem "use client", sem hook): pode ser lido de qualquer lado.
 *
 * ⚠️ `key` é o que fica gravado em `aep_relatorios.setores` (jsonb). Mudar
 * `label` é livre; mudar `key` apaga a resposta de quem já respondeu.
 */

export interface ItemChecklistAep<K extends string = string> {
  key: K;
  label: string;
}

export const ITENS_FISICA: ItemChecklistAep<keyof AepChecklistFisica>[] = [
  { key: "postura",             label: "Posturas inadequadas / forçadas" },
  { key: "repetitividade",      label: "Movimentos repetitivos" },
  { key: "levantamento_carga",  label: "Levantamento / transporte de cargas" },
  { key: "mobiliario",          label: "Mobiliário inadequado" },
  { key: "esforco_fisico",      label: "Esforço físico elevado" },
  { key: "iluminacao",          label: "Iluminação inadequada" },
  { key: "ruido",               label: "Ruído / ambiente sonoro adverso" },
  { key: "vibracao",            label: "Vibração (corpo inteiro / mãos e braços)" },
  { key: "desconforto_termico", label: "Desconforto térmico" },
];

export const ITENS_COGNITIVA: ItemChecklistAep<keyof AepChecklistCognitiva>[] = [
  { key: "atencao_continua",    label: "Atenção contínua / concentração elevada" },
  { key: "sobrecarga_mental",   label: "Sobrecarga mental / complexidade da tarefa" },
  { key: "pressao_psicologica", label: "Pressão psicológica / cobrança excessiva" },
  { key: "excesso_informacoes", label: "Excesso de informações simultâneas" },
  { key: "ritmo_mental",        label: "Ritmo mental acelerado" },
];

export const ITENS_ORGANIZACIONAL: ItemChecklistAep<keyof AepChecklistOrganizacional>[] = [
  { key: "assedio",               label: "Assédio de qualquer natureza no trabalho" },
  { key: "falta_suporte",         label: "Falta de suporte / apoio no trabalho" },
  { key: "gestao_mudancas",       label: "Má gestão de mudanças organizacionais" },
  { key: "clareza_papel",         label: "Baixa clareza de papel / função" },
  { key: "recompensas",           label: "Baixas recompensas e reconhecimento" },
  { key: "baixo_controle",        label: "Baixo controle no trabalho / Falta de autonomia" },
  { key: "justica_organizacional",label: "Baixa justiça organizacional" },
  { key: "eventos_traumaticos",   label: "Eventos violentos ou traumáticos" },
  { key: "subcarga",              label: "Baixa demanda no trabalho (Subcarga)" },
  { key: "sobrecarga",            label: "Excesso de demandas no trabalho (Sobrecarga)" },
  { key: "maus_relacionamentos",  label: "Maus relacionamentos no local de trabalho" },
  { key: "comunicacao_dificil",   label: "Trabalho em condições de difícil comunicação" },
  { key: "trabalho_remoto",       label: "Trabalho remoto e isolado" },
];

// ─── Respostas ────────────────────────────────────────────────────────────────
// A física e a cognitiva seguem com três respostas. Só a Ergonomia
// Organizacional recebe a quarta — "N/I, não identificável" (pedido de
// 18/08/2026): o fator que o técnico não conseguiu verificar em campo não é
// "ausente" nem "não se aplica", e virar "Não" mentia no laudo.

export const OPCOES_TRISTATE: RespostaChecklistAep[] = ["sim", "nao", "nao_aplica"];
export const OPCOES_COM_NI: RespostaChecklistAep[] = ["sim", "nao", "nao_aplica", "nao_identificado"];

export const ROTULO_RESPOSTA: Record<RespostaChecklistAep, string> = {
  sim: "Sim",
  nao: "Não",
  nao_aplica: "N/A",
  nao_identificado: "N/I",
};

export const AJUDA_RESPOSTA: Record<RespostaChecklistAep, string> = {
  sim: "Fator de risco identificado",
  nao: "Fator avaliado e ausente",
  nao_aplica: "Não aplicável — quando o fator de risco não se aplica",
  nao_identificado:
    "Não identificável — quando não for possível verificar se há ou não aquele fator de risco",
};

export const LEGENDA_RESPOSTA: Partial<Record<RespostaChecklistAep, { titulo: string; texto: string }>> = {
  nao_aplica: { titulo: "Não aplicável", texto: "quando o fator de risco não se aplica" },
  nao_identificado: {
    titulo: "Não identificável",
    texto: "quando não for possível verificar se há ou não aquele fator de risco",
  },
};

// ─── Participação dos trabalhadores (NR-1) ────────────────────────────────────

export const METODOS_COLETA = [
  "Observação direta",
  "Entrevista com trabalhadores",
  "Entrevista com gestores",
  "Análise documental",
  "Questionário aplicado",
];
