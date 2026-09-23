import { buscar, type ResultadoBusca } from "./texto";

/** O mínimo que a busca precisa de uma empresa — serve ao tipo `Empresa` e a projeções. */
export interface EmpresaBuscavel {
  nome_empresa: string;
  razao_social?: string | null;
  nome_fantasia?: string | null;
  cnpj?: string | null;
  cpf?: string | null;
  cei?: string | null;
  caepf?: string | null;
  cno?: string | null;
}

/**
 * Busca de empresa usada pela tela Empresas, pelo `EmpresaSelect` (24 telas) e
 * pelo vínculo em Usuários. Nome, razão social e nome fantasia por texto;
 * CNPJ/CPF/CEI/CAEPF/CNO só pelos dígitos, com ou sem máscara.
 */
export function buscarEmpresas<T extends EmpresaBuscavel>(
  empresas: T[],
  consulta: string,
): ResultadoBusca<T> {
  return buscar(
    empresas,
    consulta,
    (e) => [e.nome_empresa, e.razao_social, e.nome_fantasia],
    { codigos: (e) => [e.cnpj, e.cpf, e.cei, e.caepf, e.cno] },
  );
}
