/**
 * AEP/AET da empresa na aba da inspeção (0.3.307, 19/11/2026 — pedido do João: "às vezes a AEP e a AET são feitas
 * separadas e não ficam disponíveis na inspeção"). Quando a inspeção não tem laudo próprio, a aba lista os laudos da
 * mesma empresa — do mesmo cadastro ou de outro cadastro com o MESMO CNPJ — para consultar ou trazer para a inspeção.
 * Funções puras; a busca e a gravação estão em lib/hooks/useErgonomiaInspecao.ts.
 */

export interface LaudoDaEmpresa {
  id_relatorio: string;
  id_empresa: string;
  id_inspecao: string | null;
  status: string | null;
  data_elaboracao: string | null;
  responsavel_elaboracao: string | null;
  created_at: string | null;
}

/** Onde o laudo está hoje, visto desta inspeção. */
export type VinculoAtual = "sem_inspecao" | "outra_inspecao" | "outro_cadastro";

/** Só os dígitos do CNPJ ("" sem CNPJ). */
export function digitosCnpj(cnpj: string | null | undefined): string {
  return (cnpj ?? "").replace(/\D/g, "");
}

/** As duas grafias em que o CNPJ pode estar gravado: só dígitos e com máscara 00.000.000/0000-00. */
export function grafiasCnpj(cnpj: string | null | undefined): string[] {
  const d = digitosCnpj(cnpj);
  if (d.length !== 14) return d ? [d] : [];
  const mascara = `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  return [d, mascara];
}

export function vinculoAtual(laudo: Pick<LaudoDaEmpresa, "id_empresa" | "id_inspecao">, idEmpresa: string): VinculoAtual {
  if (laudo.id_empresa !== idEmpresa) return "outro_cadastro";
  return laudo.id_inspecao ? "outra_inspecao" : "sem_inspecao";
}

/**
 * Os laudos que a aba oferece: todos menos o desta inspeção (que a aba já abre), do mais novo para o mais antigo
 * (data do laudo; sem data, a de criação).
 */
export function laudosParaOferecer(laudos: readonly LaudoDaEmpresa[], idInspecao: string): LaudoDaEmpresa[] {
  const quando = (l: LaudoDaEmpresa) => l.data_elaboracao ?? l.created_at ?? "";
  return laudos
    .filter((l) => l.id_inspecao !== idInspecao)
    .sort((a, b) => quando(b).localeCompare(quando(a)));
}
