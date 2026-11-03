/**
 * Dicas de preenchimento do cadastro de Empresas (Etapa 1 do docs/plano-skin-viva-jcn.md).
 *
 * Uma frase curta e prática por campo, no imperativo. Sem inventar exigência legal: só cite a
 * NR quando houver certeza. Revisadas pelo João em 03/11/2026. O teste (empresas.test.ts) barra
 * texto vazio ou longo demais para a caixa da dica.
 */
export const DICAS_EMPRESA = {
  tipo_cadastro:
    "Escolha \"Empresa cliente\" para quem contrata a JCN. Use a outra opção para o local de outra empresa onde o serviço é feito.",
  empresa_contratante: "A empresa cliente que contratou o serviço neste local de terceiros.",
  nome: "Nome curto que aparece nas listas e telas do sistema. Pode ser o nome fantasia.",
  cnpj: "Digite os 14 números e use a busca para trazer os dados da Receita Federal.",
  razao_social: "Nome oficial da empresa, igual ao do cartão CNPJ.",
  nome_fantasia: "Nome comercial, se for diferente da razão social.",
  cpf: "Use quando o empregador é pessoa física, sem CNPJ.",
  cei: "Matrícula CEI antiga (obra ou empregador pessoa física). Preencha só se a empresa ainda a usa.",
  caepf: "Cadastro de empregador pessoa física, como produtor rural ou profissional que tem empregados.",
  cno: "Cadastro Nacional de Obras, para obras de construção civil.",
  unidade: "Unidade da JCN que atende esta empresa. Define quem da equipe vê o cadastro.",
  endereco: "Endereço do local onde o trabalho é feito. Sai nos laudos.",
  cep: "Os 8 números do CEP.",
  uf: "Sigla do estado, com 2 letras.",
  contato: "Contato principal da empresa para assuntos de SST.",
  cnae: "Código da atividade principal, como está no cartão CNPJ (7 dígitos). Define o grau de risco.",
  atividade_principal: "Descrição da atividade do CNAE principal. Vem da busca do CNPJ.",
  situacao_cadastral: "Situação na Receita Federal (ativa, baixada…). Vem da busca do CNPJ.",
  porte: "Porte na Receita (ME, EPP ou demais). Vem da busca do CNPJ.",
  ponto_referencia: "Algo que ajude a achar o local: perto de quê, qual portão, qual galpão.",
  locais_emergencia: "Hospitais, UPAs e bombeiros mais próximos, com telefone, para consulta da equipe.",
  dados_adicionais: "Outras informações úteis que não cabem nos campos acima.",
  grau_risco: "Grau de 1 a 4 da NR-4, pelo CNAE principal. O sistema sugere o grau da norma.",
  status: "Marque Inativa quando a empresa deixar de ser atendida. O histórico fica guardado.",
  observacao: "Anotações internas da equipe sobre esta empresa.",
} as const satisfies Record<string, string>;

/** Limite de caracteres que cabe bem na caixa (~260px, 2–3 linhas). */
export const DICA_MAX_CARACTERES = 140;
