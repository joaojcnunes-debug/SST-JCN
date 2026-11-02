/**
 * Cópia da Ergonomia (AEP e AET) junto com a inspeção — complemento de
 * lib/inspecoes/copiar.ts.
 *
 * O laudo é UMA linha em aep_relatorios / aet_relatorios ligada à inspeção por
 * `id_inspecao` (os setores do laudo vivem no JSON `setores`, com ids próprios
 * que não apontam para os setores da inspeção). A AET ainda tem duas filhas,
 * presas ao laudo e ao id do setor DENTRO do JSON: aet_acoes (plano de ação) e
 * aet_laudo_qps_respostas (as respostas que o avaliador marca nos 13 fatores).
 * Como o JSON vai inteiro, os ids de setor continuam valendo e só o
 * `id_relatorio` (e o `id_acao`) mudam.
 *
 * O laudo copiado é um laudo NOVO: volta a Rascunho, sem conclusão, validade nem
 * liberação comercial, com a data de hoje, o endereço da empresa destino e já
 * cadastrado no módulo (como o "Iniciar" da aba faz desde 05/10).
 */

import { montarEnderecoEmpresa } from "@/lib/textos-padrao/variaveis";
import type { Empresa } from "@/lib/supabase/types";

type Linha = Record<string, unknown>;

export interface OrigemErgonomia {
  aep: Linha | null;
  aet: Linha | null;
  aetAcoes: Linha[];
  aetQps: Linha[];
}

export interface ParametrosErgonomia {
  idInspecao: string;
  idEmpresa: string;
  enderecoEmpresa: string;
  usuarioId: string | null;
  agora: string;
  gerarId: (prefixo: string) => string;
  gerarUuid: () => string;
}

export interface LinhasErgonomia {
  aep_relatorios: Linha[];
  aet_relatorios: Linha[];
  aet_acoes: Linha[];
  aet_laudo_qps_respostas: Linha[];
}

/** Campos do andamento do laudo que NÃO passam para a cópia. */
const ZERAR = ["concluido_em", "liberado_comercial_em", "liberado_comercial_por", "data_validade"] as const;

function laudoNovo(l: Linha, p: ParametrosErgonomia, id: string): Linha {
  const novo: Linha = {
    ...l,
    id_relatorio: id,
    id_empresa: p.idEmpresa,
    id_inspecao: p.idInspecao,
    status: "RASCUNHO",
    data_elaboracao: p.agora.slice(0, 10),
    endereco_empresa: p.enderecoEmpresa,
    enviado_modulo_em: p.agora,
    usuario: p.usuarioId,
    created_at: p.agora,
    updated_at: p.agora,
  };
  for (const c of ZERAR) if (c in l) novo[c] = null;
  return novo;
}

export function montarCopiaErgonomia(o: OrigemErgonomia, p: ParametrosErgonomia): LinhasErgonomia {
  const idAet = o.aet ? p.gerarUuid() : null;
  return {
    aep_relatorios: o.aep ? [laudoNovo(o.aep, p, p.gerarUuid())] : [],
    aet_relatorios: o.aet ? [laudoNovo(o.aet, p, idAet!)] : [],
    aet_acoes: idAet
      ? o.aetAcoes.map((a) => ({
          ...a,
          id_acao: p.gerarId("AAC"),
          id_relatorio: idAet,
          created_at: p.agora,
          updated_at: p.agora,
        }))
      : [],
    aet_laudo_qps_respostas: idAet
      ? o.aetQps.map((r) => ({ ...r, id_relatorio: idAet, updated_at: p.agora }))
      : [],
  };
}

// O cliente tipado não conhece todas as colunas da v262.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cliente = any;

/**
 * Lê a AEP/AET da inspeção de origem e grava as cópias na nova.
 *
 * Não derruba a cópia da inspeção: quem não tem acesso ao módulo AEP/AET (RLS
 * `rls_modulo_ok`) não enxerga nem grava o laudo. Devolve o que copiou e, se
 * algo falhou, a mensagem para avisar a pessoa.
 */
export async function copiarErgonomia(
  sb: Cliente,
  args: { idOrigem: string; idInspecao: string; idEmpresa: string; gerarId: (p: string) => string },
): Promise<{ copiados: string[]; erro: string | null }> {
  const copiados: string[] = [];
  try {
    const [aep, aet] = await Promise.all([
      sb.from("aep_relatorios").select("*").eq("id_inspecao", args.idOrigem).maybeSingle(),
      sb.from("aet_relatorios").select("*").eq("id_inspecao", args.idOrigem).maybeSingle(),
    ]);
    if (aep.error) throw aep.error;
    if (aet.error) throw aet.error;
    if (!aep.data && !aet.data) return { copiados, erro: null };

    const idAet = (aet.data as Linha | null)?.id_relatorio as string | undefined;
    const [acoes, qps, emp, auth] = await Promise.all([
      idAet ? sb.from("aet_acoes").select("*").eq("id_relatorio", idAet) : { data: [] },
      idAet ? sb.from("aet_laudo_qps_respostas").select("*").eq("id_relatorio", idAet) : { data: [] },
      sb.from("empresas").select("*").eq("id_empresa", args.idEmpresa).maybeSingle(),
      sb.auth.getUser(),
    ]);
    if (acoes.error) throw acoes.error;
    if (qps.error) throw qps.error;

    const linhas = montarCopiaErgonomia(
      {
        aep: (aep.data as Linha | null) ?? null,
        aet: (aet.data as Linha | null) ?? null,
        aetAcoes: (acoes.data ?? []) as Linha[],
        aetQps: (qps.data ?? []) as Linha[],
      },
      {
        idInspecao: args.idInspecao,
        idEmpresa: args.idEmpresa,
        enderecoEmpresa: montarEnderecoEmpresa((emp?.data as Empresa | null) ?? null),
        usuarioId: auth?.data?.user?.id ?? null,
        agora: new Date().toISOString(),
        gerarId: args.gerarId,
        gerarUuid: () => crypto.randomUUID(),
      },
    );

    for (const [tabela, xs] of Object.entries(linhas) as [string, Linha[]][]) {
      if (xs.length === 0) continue;
      const { error } = await sb.from(tabela).insert(xs);
      if (error) throw error;
      if (tabela === "aep_relatorios") copiados.push("AEP");
      if (tabela === "aet_relatorios") copiados.push("AET");
    }
    return { copiados, erro: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : (e as { message?: string })?.message ?? String(e);
    return { copiados, erro: msg };
  }
}
