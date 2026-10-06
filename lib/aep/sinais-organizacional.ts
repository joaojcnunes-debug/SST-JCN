import type { AepChecklistOrganizacional } from "@/lib/supabase/types";

/**
 * Sinais observáveis de cada fator de Ergonomia Organizacional da triagem AEP.
 *
 * Fonte: lista do RT de 2026-10-06 — **5 sinais em cada um dos 13 fatores**
 * (65 no total), que substituiu a de 2026-08-06 (95 sinais, de 5 a 11 por
 * fator). Com o mesmo número de sinais em todo fator, a probabilidade da
 * matriz AIHA passou a ser 1 sinal = 1 nível (ver aiha-organizacional.ts).
 *
 * Os sinais só aparecem quando o fator é marcado **Sim**.
 *
 * ⚠️ **`key` é o que fica gravado no banco** (dentro de `aep_relatorios.setores`,
 * que é jsonb). Renomear uma chave apaga a resposta de quem já respondeu —
 * mudar `label` é livre, mudar `key` não é. Na troca de 2026-10-06 as chaves
 * de mesmo sentido foram mantidas (ex.: o sinal que juntou "tom agressivo" e
 * "brincadeiras constrangedoras" ficou com `tom_agressivo`); chave que saiu do
 * catálogo é descartada na leitura (`normalizarSetor` em useAep.ts) e não
 * conta para a matriz (`sinaisValidos`).
 *
 * ⚠️ Esta é a **fonte única**: tela de triagem, laudo, formulário em branco,
 * template do PDF e página da Matriz AIHA leem daqui.
 *
 * Correção de digitação: "Interrompimento" → "Interrupção".
 */

/** Quem costuma revelar o sinal (etiqueta em vez de sujar o texto). */
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
    { key: "tom_agressivo", label: "Tom agressivo, irônico, humilhante e/ou brincadeiras constrangedoras" },
    { key: "sem_escuta", label: "Falta de abertura para escuta" },
    { key: "cobranca_publico", label: "Cobranças em público" },
    { key: "tensao_silencio", label: "Ambiente de tensão ou silêncio excessivo" },
    { key: "naturalizacao", label: "Naturalização de gritos, pressão ou desrespeito (“aqui sempre foi assim”)" },
  ],
  falta_suporte: [
    { key: "lider_ausente", label: "Líder ausente ou pouco acessível no dia a dia" },
    { key: "rh_inacessivel", label: "RH apenas burocrático, mas inacessível" },
    { key: "sem_direcionamento", label: "Pouca interação e/ou ausência de direcionamento técnico" },
    { key: "dificuldade_levar_problemas", label: "Dificuldade de levar problemas e questões para a liderança" },
    { key: "erros_punidos", label: "Erros sendo punidos, mas não trabalhados" },
  ],
  gestao_mudancas: [
    { key: "comunicacao_informal", label: "Comunicação informal das mudanças (boatos e conversas informais)" },
    { key: "instabilidade", label: "Comentários sobre instabilidade" },
    { key: "inseguranca_funcao", label: "Insegurança sobre a função" },
    { key: "improviso", label: "Sensação de improviso na gestão" },
    { key: "duvidas_retrabalho", label: "Relatos de dúvidas e retrabalho" },
  ],
  clareza_papel: [
    { key: "varias_orientacoes", label: "Colaborador recebe orientações de mais de uma pessoa" },
    { key: "quem_manda", label: "Dúvidas sobre “quem manda”" },
    { key: "sem_padrao_comunicacao", label: "Falta de padrão na comunicação" },
    { key: "instrucoes_vagas", label: "Instruções vagas ou incompletas (ou informações que não chegam a todos)" },
    { key: "instrucoes_diferentes", label: "Instruções diferentes para uma mesma atividade" },
  ],
  recompensas: [
    { key: "sem_plano_carreira", label: "Falta de plano de carreira e possibilidade de crescimento" },
    { key: "indiferenca_resultados", label: "Indiferença com relação a resultados (ausência de conversas de desenvolvimento, feedback somente quando há erro)" },
    { key: "desmotivacao", label: "Desmotivação aparente" },
    { key: "sem_retorno_desempenho", label: "Ausência de retorno sobre desempenho" },
    { key: "cobranca_sem_reconhecimento", label: "Cobrança intensa por resultado, sem reconhecimento por esforço" },
  ],
  baixo_controle: [
    { key: "pouca_iniciativa", label: "Pouca margem para iniciativa" },
    { key: "controle_constante", label: "Muito controle em cima das atividades (controle detalhado e constante, revisões excessivas)" },
    { key: "falta_confianca", label: "Falta de confiança explícita ou implícita" },
    { key: "decisoes_concentradas", label: "Decisões concentradas em poucas pessoas" },
    { key: "equipe_nao_resolve", label: "Dificuldade da equipe em resolver problemas sozinha e/ou medo de errar e evitação de iniciativa (“melhor perguntar tudo”)" },
  ],
  justica_organizacional: [
    { key: "decisoes_opacas", label: "Colaboradores não sabem como as decisões são tomadas" },
    { key: "comentarios_preferencias", label: "Comentários informais sobre preferências" },
    { key: "decisoes_pessoais", label: "Decisões percebidas como pessoais, não técnicas", fonte: "tecnico" },
    { key: "descredito_lideranca", label: "Desmotivação ou descrédito na liderança e/ou comentários sobre injustiça ou favoritismo", fonte: "colaborador" },
    { key: "conflitos_interpessoais", label: "Conflitos interpessoais" },
  ],
  eventos_traumaticos: [
    { key: "contato_publico", label: "Atividades com contato com o público (especialmente situações de conflito)" },
    { key: "area_risco_violencia", label: "Trabalho em áreas com risco de violência" },
    { key: "sem_protocolos", label: "Falta de protocolos de segurança" },
    { key: "sem_treinamento_risco", label: "Falta de treinamento para lidar com situações de risco" },
    { key: "historico_incidentes", label: "Histórico de incidentes (mesmo que informais)" },
  ],
  subcarga: [
    { key: "periodos_sem_atividade", label: "Períodos frequentes sem atividades" },
    { key: "sem_desafios", label: "Falta de desafios compatíveis com a função (profissionais qualificados realizando tarefas simples ou repetitivas)" },
    { key: "concentracao_tarefas", label: "Concentração de demandas" },
    { key: "sem_o_que_fazer", label: "Conversas sobre “não ter o que fazer”" },
    { key: "monotonia", label: "Baixa exigência cognitiva, monotonia" },
  ],
  sobrecarga: [
    { key: "atividades_simultaneas", label: "Acúmulo de atividades simultâneas e/ou funções" },
    { key: "urgencia_permanente", label: "Clima laboral onde se percebe sensação de urgência permanente" },
    { key: "equipe_reduzida", label: "Equipe reduzida para o volume de trabalho" },
    { key: "metas_dificeis", label: "Metas percebidas como difíceis de atingir" },
    { key: "cansaco_irritabilidade", label: "Cansaço aparente, irritabilidade, dificuldade de concentração" },
  ],
  maus_relacionamentos: [
    { key: "resistencia_equipe", label: "Resistência ao trabalho em equipe e à colaboração" },
    { key: "conflitos_ignorados", label: "Conflitos ignorados ou minimizados" },
    { key: "evitacao_colegas", label: "Evitação entre colegas" },
    { key: "falta_respeito", label: "Falta de respeito em interações" },
    { key: "comunicacao_indireta", label: "Comunicação indireta (recados, indiretas…)" },
  ],
  comunicacao_dificil: [
    { key: "erros_frequentes", label: "Erros frequentes" },
    { key: "sem_referencia", label: "Colaboradores sem referência de quem procurar" },
    { key: "informacoes_divergentes", label: "Informações divergentes entre pessoas" },
    { key: "dependencia_informal", label: "Dependência de comunicação informal e/ou ausência de canais formais de comunicação" },
    { key: "paradas_por_falta_info", label: "Interrupção das atividades por falta de informação" },
  ],
  trabalho_remoto: [
    { key: "baixo_pertencimento", label: "Baixo senso de pertencimento" },
    { key: "equipe_desconectada", label: "Equipe pouco conectada" },
    { key: "sem_integracao", label: "Falta de ações de integração" },
    { key: "falta_alinhamento", label: "Falta de alinhamento nas informações" },
    { key: "mensagens_objetivas", label: "Comunicação restrita a mensagens objetivas (sem troca real)" },
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

/** Só as chaves que ainda existem no catálogo do fator (descarta as antigas). */
export function sinaisValidos(fator: string, marcados: readonly string[] | undefined): string[] {
  const doFator = SINAIS_ORGANIZACIONAL[fator as keyof AepChecklistOrganizacional];
  if (!doFator || !marcados?.length) return [];
  return marcados.filter((k) => doFator.some((s) => s.key === k));
}
