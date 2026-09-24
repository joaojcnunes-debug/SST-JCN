import type { AepChecklistOrganizacional } from "@/lib/supabase/types";

/**
 * Sinais observáveis de cada fator de Ergonomia Organizacional da triagem AEP.
 *
 * Fonte: "Medidas de controle" (documento do RT, versão completa recebida em
 * 2026-08-06). São 95 sinais distribuídos nos 13 fatores que já existiam no
 * checklist — o documento não acrescenta fatores, acrescenta o que olhar dentro
 * de cada um.
 *
 * Comportamento decidido pelo usuário: os sinais só aparecem quando o fator é
 * marcado **Sim**. Assim a tela não incha, os 127 laudos existentes não mudam em
 * nada, e o laudo passa a registrar POR QUE o fator foi apontado.
 *
 * ⚠️ **`key` é o que fica gravado no banco** (dentro de `aep_relatorios.setores`,
 * que é jsonb). Renomear uma chave apaga a resposta de quem já respondeu —
 * mudar `label` é livre, mudar `key` não é.
 *
 * ⚠️ Esta é a **fonte única**: tela de triagem, laudo e template do PDF leem
 * daqui. Não copiar a lista para dentro de componente (o checklist dos 13
 * fatores já sofre disso — a lista de rótulos está duplicada em 3 arquivos).
 *
 * Erros de digitação do documento original foram corrigidos aqui, sem mudar o
 * sentido: constragedoras→constrangedoras, "mais de uma pessoas"→"mais de uma
 * pessoa", cresciemento→crescimento, prmoções→promoções, Comentarios→Comentários,
 * descrétido→descrédito, Substituiçôes→Substituições, Dependencia→Dependência,
 * "mensagem objetivas"→"mensagens objetivas", perterncimento→pertencimento.
 */

/** Quem costuma revelar o sinal. O documento marca alguns como "- Colaborador"
 *  e um como "(visão do técnico(a))"; virou etiqueta em vez de sujar o texto. */
export type FonteSinal = "colaborador" | "tecnico";

export interface SinalOrganizacional {
  key: string;
  label: string;
  fonte?: FonteSinal;
}

export const SINAIS_ORGANIZACIONAL: Record<
  keyof AepChecklistOrganizacional,
  SinalOrganizacional[]
> = {
  assedio: [
    { key: "tom_agressivo", label: "Tom agressivo, irônico ou humilhante" },
    { key: "cobranca_publico", label: "Cobranças em público" },
    { key: "sem_escuta", label: "Falta de abertura para escuta" },
    { key: "tensao_silencio", label: "Ambiente de tensão ou silêncio excessivo" },
    { key: "brincadeiras", label: "Brincadeiras constrangedoras" },
    { key: "naturalizacao", label: "Naturalização de gritos, pressão ou desrespeito (“aqui sempre foi assim”)", fonte: "colaborador" },
  ],
  falta_suporte: [
    { key: "lider_ausente", label: "Líder ausente ou pouco acessível no dia a dia" },
    { key: "dificuldade_levar_problemas", label: "Dificuldade de levar problemas e questões para a liderança" },
    { key: "metas_sem_orientacao", label: "Metas estabelecidas sem orientação de como atingir" },
    { key: "sem_direcionamento", label: "Ausência de direcionamento técnico" },
    { key: "erros_punidos", label: "Erros sendo punidos, mas não trabalhados" },
    { key: "pouca_integracao", label: "Pouca integração" },
    { key: "rh_inacessivel", label: "RH apenas burocrático, mas inacessível" },
  ],
  gestao_mudancas: [
    { key: "comunicacao_informal", label: "Comunicação informal das mudanças (boatos e conversas informais)" },
    { key: "improviso", label: "Sensação de improviso na gestão" },
    { key: "instabilidade", label: "Comentários sobre instabilidade" },
    { key: "duvidas_retrabalho", label: "Relatos de dúvidas e retrabalho" },
    { key: "inseguranca_funcao", label: "Insegurança sobre função", fonte: "colaborador" },
  ],
  clareza_papel: [
    { key: "varias_orientacoes", label: "Colaborador recebe orientação de mais de uma pessoa" },
    { key: "instrucoes_diferentes", label: "Instruções diferentes para a mesma atividade" },
    { key: "quem_manda", label: "Dúvidas sobre “quem manda”" },
    { key: "informacao_nao_chega", label: "Informações que não chegam a todos" },
    { key: "sem_padrao_comunicacao", label: "Falta de padrão na comunicação" },
    { key: "instrucoes_vagas", label: "Instruções vagas ou incompletas" },
  ],
  recompensas: [
    { key: "sem_retorno_desempenho", label: "Colaboradores não recebem retorno sobre desempenho" },
    { key: "feedback_so_erro", label: "Feedback só acontece quando há erro" },
    { key: "sem_conversas_desenvolvimento", label: "Ausência de conversas de desenvolvimento" },
    { key: "sem_valorizacao", label: "Falta de valorização de melhorias, dedicação ou qualidade" },
    { key: "cobranca_sem_reconhecimento", label: "Cobrança intensa por resultado, sem reconhecimento do esforço" },
    { key: "desmotivacao", label: "Desmotivação aparente", fonte: "colaborador" },
    { key: "indiferenca_resultados", label: "Indiferença em relação aos resultados", fonte: "colaborador" },
    { key: "sem_plano_carreira", label: "Falta de plano de carreira e possibilidade de crescimento" },
  ],
  baixo_controle: [
    { key: "autorizacao_decisoes_simples", label: "Colaborador precisa pedir autorização para decisões simples" },
    { key: "baixa_liberdade", label: "Baixa liberdade para organizar o próprio trabalho" },
    { key: "pouca_iniciativa", label: "Pouca margem para iniciativa" },
    { key: "controle_constante", label: "Controle detalhado e constante" },
    { key: "revisoes_excessivas", label: "Revisões excessivas de tarefas simples" },
    { key: "falta_confianca", label: "Falta de confiança explícita ou implícita" },
    { key: "decisoes_concentradas", label: "Decisões concentradas em poucas pessoas" },
    { key: "falta_delegacao", label: "Falta de delegação" },
    { key: "equipe_nao_resolve", label: "Dificuldade da equipe em resolver problemas sem escalar" },
    { key: "medo_errar", label: "Medo de errar e/ou evitação de iniciativa (ex.: “melhor perguntar tudo”)", fonte: "colaborador" },
  ],
  justica_organizacional: [
    { key: "decisoes_opacas", label: "Colaboradores não sabem como as decisões são tomadas" },
    { key: "sem_clareza_promocoes", label: "Falta de clareza sobre promoções, mudanças ou benefícios" },
    { key: "comentarios_preferencias", label: "Comentários informais sobre preferências" },
    { key: "decisoes_pessoais", label: "Decisões percebidas como pessoais, não técnicas", fonte: "tecnico" },
    { key: "descredito_lideranca", label: "Desmotivação ou descrédito na liderança", fonte: "colaborador" },
    { key: "injustica_favoritismo", label: "Comentários sobre injustiça ou favoritismo", fonte: "colaborador" },
    { key: "conflitos_interpessoais", label: "Conflitos interpessoais" },
  ],
  eventos_traumaticos: [
    { key: "contato_publico", label: "Atividades com contato com o público (especialmente situações de conflito)" },
    { key: "area_risco_violencia", label: "Trabalho em áreas com risco de violência" },
    { key: "trabalho_isolado", label: "Trabalho isolado ou em horários vulneráveis" },
    { key: "historico_incidentes", label: "Histórico de incidentes (mesmo que informais)" },
    { key: "sem_protocolos", label: "Falta de protocolos de segurança" },
    { key: "sem_treinamento_risco", label: "Falta de treinamento para lidar com situações de risco" },
  ],
  subcarga: [
    { key: "periodos_sem_atividade", label: "Períodos frequentes sem atividade" },
    { key: "aguardando_tarefas", label: "Colaborador aguardando tarefas por longos períodos" },
    { key: "sem_desafios", label: "Falta de desafios compatíveis com a função" },
    { key: "qualificado_tarefa_simples", label: "Profissionais qualificados realizando tarefas simples ou repetitivas" },
    { key: "baixo_aproveitamento", label: "Baixo aproveitamento de habilidades técnicas" },
    { key: "concentracao_tarefas", label: "Concentração de tarefas" },
    { key: "monotonia", label: "Baixa exigência cognitiva, monotonia" },
    { key: "sem_o_que_fazer", label: "Conversas sobre “não ter o que fazer”" },
  ],
  sobrecarga: [
    { key: "atividades_simultaneas", label: "Acúmulo de atividades simultâneas" },
    { key: "urgencia_permanente", label: "Clima laboral onde se percebe sensação de urgência permanente" },
    { key: "sem_pausas", label: "Falta de pausas adequadas" },
    { key: "horas_extras", label: "Horas extras frequentes" },
    { key: "nao_encerra_no_tempo", label: "Dificuldade em encerrar as atividades no tempo previsto" },
    { key: "equipe_reduzida", label: "Equipe reduzida para o volume de trabalho" },
    { key: "acumulo_funcoes", label: "Acúmulo de funções" },
    { key: "substituicoes_nao_realizadas", label: "Substituições não realizadas" },
    { key: "falta_recursos", label: "Falta de recursos para cumprir exigências" },
    { key: "metas_dificeis", label: "Metas percebidas como difíceis de atingir" },
    { key: "cansaco_irritabilidade", label: "Cansaço aparente, irritabilidade, dificuldade de concentração" },
  ],
  maus_relacionamentos: [
    { key: "falta_respeito", label: "Falta de respeito em interações" },
    { key: "comunicacao_indireta", label: "Comunicação indireta (recados, indiretas…)" },
    { key: "clima_desconforto", label: "Clima de desconforto" },
    { key: "evitacao_colegas", label: "Evitação entre colegas" },
    { key: "conflitos_ignorados", label: "Conflitos ignorados ou minimizados" },
    { key: "falta_mediacao", label: "Falta de mediação" },
    { key: "resistencia_equipe", label: "Resistência ao trabalho em equipe e à colaboração" },
    { key: "individualismo", label: "Individualismo excessivo" },
    { key: "desconfianca", label: "Clima de desconfiança" },
  ],
  comunicacao_dificil: [
    { key: "dependencia_informal", label: "Dependência de comunicação informal (recados, terceiros)" },
    { key: "sem_canais_formais", label: "Ausência de canais formais de comunicação" },
    { key: "informacoes_divergentes", label: "Informações divergentes entre pessoas" },
    { key: "sem_padronizacao", label: "Falta de padronização na comunicação" },
    { key: "sem_referencia", label: "Colaboradores sem referência de quem procurar" },
    { key: "erros_frequentes", label: "Erros frequentes" },
    { key: "paradas_por_falta_info", label: "Paradas nas atividades por falta de informação" },
  ],
  trabalho_remoto: [
    { key: "mensagens_objetivas", label: "Comunicação restrita a mensagens objetivas (sem troca real)" },
    { key: "falta_alinhamento", label: "Falta de alinhamento nas informações" },
    { key: "sem_integracao", label: "Falta de ações de integração" },
    { key: "equipe_desconectada", label: "Equipe pouco conectada" },
    { key: "baixo_pertencimento", label: "Baixo senso de pertencimento" },
  ],
};

/** Sinais marcados por fator: `{ assedio: ["tom_agressivo", ...] }`. */
export type SinaisSelecionados = Record<string, string[]>;

/** Rótulos dos sinais marcados de um fator, na ordem do documento. */
export function rotulosDosSinais(
  fator: keyof AepChecklistOrganizacional,
  selecionados: SinaisSelecionados | undefined,
): string[] {
  const marcados = selecionados?.[fator];
  if (!marcados?.length) return [];
  const doFator = SINAIS_ORGANIZACIONAL[fator] ?? [];
  // Percorre o catálogo (não o que foi marcado) para manter a ordem do documento
  // e descartar sozinho qualquer chave que tenha saído da lista.
  return doFator.filter((s) => marcados.includes(s.key)).map((s) => s.label);
}
