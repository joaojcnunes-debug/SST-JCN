/**
 * Dicas de preenchimento da Escala (Etapa 7, lote 7.10c, do docs/plano-skin-viva-jcn.md):
 * Configuração (Unidades, Supervisores, Feriados, Regras) e o Padrão semanal. Mesmas regras de
 * lib/dicas/empresas.ts; cada afirmação conferida em lib/escala. Aprovadas pelo João em 04/11/2026.
 */
const FERIADO_GERAL = "Feriado nacional ou estadual não entra na conta.";

export const DICAS_ESCALA_UNIDADE = {
  municipio: "Liga o feriado municipal à unidade. Escreva igual ao do feriado: maiúsculas e espaços nas pontas não importam.",
  na_escala: "Desmarcada, a unidade some da grade, do padrão semanal, das regras e dos relatórios. Continua no cadastro do painel.",
} as const;

export const DICAS_ESCALA_SUPERVISOR = {
  ordem: "Posição da linha nas telas da escala. Menor vem primeiro; empate vai pelo nome.",
  ativo: "Desmarcado, sai do padrão semanal e da geração dos meses. Os dias já gravados continuam na grade.",
} as const;

export const DICAS_ESCALA_FERIADO = {
  tipo: "Feriado e ponto facultativo bloqueiam o dia do mesmo jeito na geração da grade. Muda só a cor no calendário.",
  descricao: "Nome do feriado. Nacional e estadual aparecem na coluna Feriado da grade; todos aparecem no calendário anual.",
  abrangencia: "Nacional e Estadual param todos. Municipal só para quem está escalado em unidade daquele município.",
} as const;

export const DICAS_ESCALA_REGRA = {
  tipo: "O que a conferência verifica. Trocar o tipo zera os parâmetros; depois de criada, a regra não muda de tipo.",
  descricao: "Só o nome mostrado na conferência. Mudar este texto não muda o que a regra verifica.",
  minimo: `Quantos supervisores cada dia com expediente precisa ter. ${FERIADO_GERAL}`,
  contar: "A primeira opção conta qualquer dia preenchido, até folga, férias e atestado. A segunda só quem está em unidade.",
  supervisor: "Quem precisa estar em unidade nos dias marcados. A lista mostra só supervisores ativos.",
  dias_juntos: "Mínimo de dias com expediente em que os dois ficam na mesma unidade. Feriado nacional ou estadual não conta.",
} as const;

export const DICAS_ESCALA_PADRAO = {
  situacao: "Dia fora de unidade. Conta como dia definido na conferência, nunca como presença em unidade.",
} as const;
