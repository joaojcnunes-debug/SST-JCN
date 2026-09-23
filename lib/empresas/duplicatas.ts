import { normalizarTexto, somenteDigitos } from "@/lib/busca/texto";

/** O mínimo que a detecção precisa de uma empresa já cadastrada. */
export interface EmpresaComparavel {
  id_empresa: string;
  nome_empresa: string;
  cnpj?: string | null;
  cpf?: string | null;
  id_unidade?: string | null;
}

export interface Duplicatas<T> {
  /** Mesmo CNPJ (14 dígitos) ou mesmo CPF (11) — é a MESMA empresa. */
  mesmoCodigo: T[];
  /** Mesmo nome (sem acento/caixa/pontuação), código diferente — pode ser filial. */
  mesmoNome: T[];
  /** Nome contém ou está contido no digitado — só para a pessoa olhar. */
  parecidas: T[];
}

/**
 * Detecta, ANTES de gravar, se a empresa que a pessoa está cadastrando já
 * existe. Nasceu em 21/09/2026 da medição: 21 grupos com CNPJ idêntico (69
 * empresas), uma delas cadastrada 29 vezes — a pessoa não via a que acabava de
 * criar (escondida pela Unidade ativa) e cadastrava de novo.
 *
 * `ignorarId` = a própria empresa em edição, que não é duplicata de si mesma.
 */
export function detectarDuplicatas<T extends EmpresaComparavel>(
  empresas: T[],
  dados: { nome: string; cnpj?: string | null; cpf?: string | null; ignorarId?: string | null },
  limiteParecidas = 3,
): Duplicatas<T> {
  const outras = empresas.filter((e) => e.id_empresa !== dados.ignorarId);
  const cnpj = somenteDigitos(dados.cnpj);
  const cpf = somenteDigitos(dados.cpf);
  const nome = normalizarTexto(dados.nome);

  const mesmoCodigo = outras.filter(
    (e) =>
      (cnpj.length === 14 && somenteDigitos(e.cnpj) === cnpj) ||
      (cpf.length === 11 && somenteDigitos(e.cpf) === cpf),
  );
  const jaListada = new Set(mesmoCodigo.map((e) => e.id_empresa));

  // Nome curto demais compara com tudo ("LTDA", "ME"); abaixo de 5 letras não opina.
  if (nome.length < 5) return { mesmoCodigo, mesmoNome: [], parecidas: [] };

  const mesmoNome = outras.filter(
    (e) => !jaListada.has(e.id_empresa) && normalizarTexto(e.nome_empresa) === nome,
  );
  for (const e of mesmoNome) jaListada.add(e.id_empresa);

  const parecidas = outras
    .filter((e) => {
      if (jaListada.has(e.id_empresa)) return false;
      const n = normalizarTexto(e.nome_empresa);
      return n.length >= 5 && (n.includes(nome) || nome.includes(n));
    })
    .slice(0, limiteParecidas);

  return { mesmoCodigo, mesmoNome, parecidas };
}
