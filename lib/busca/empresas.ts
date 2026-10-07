import { buscar, type ResultadoBusca } from "./texto";

/** O mínimo que a busca precisa de uma empresa — serve ao tipo `Empresa` e a projeções. */
export interface EmpresaBuscavel {
  id_empresa?: string;
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
 * pelo vínculo em Usuários. Nome, razão social, nome fantasia e — quando a tela
 * passa `grupoDe` — o nome do GRUPO (v278) por texto; CNPJ/CPF/CEI/CAEPF/CNO só
 * pelos dígitos, com ou sem máscara. Digitar o nome do grupo traz todas as
 * empresas dele.
 */
export function buscarEmpresas<T extends EmpresaBuscavel>(
  empresas: T[],
  consulta: string,
  opts?: { grupoDe?: (e: T) => string | null | undefined },
): ResultadoBusca<T> {
  const grupoDe = opts?.grupoDe;
  return buscar(
    empresas,
    consulta,
    (e) => [e.nome_empresa, e.razao_social, e.nome_fantasia, grupoDe?.(e)],
    { codigos: (e) => [e.cnpj, e.cpf, e.cei, e.caepf, e.cno] },
  );
}
