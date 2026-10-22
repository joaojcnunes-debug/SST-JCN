// Leitura das AEPs ENTREGUES e da situação do DRPS/Questionário por empresa —
// as duas consultas da Sinalização / página AEP do Painel SST. Recebem o client
// do Supabase para servir aos dois lados: o hook (navegador) e a rota do PDF
// (servidor, com a RLS de quem pede). A regra de "entregue" está no hook
// `useAepsEntregues` (lib/hooks/useAep.ts).

import { normalizarRelatorio } from "@/lib/aep/normalizar-relatorio";
import { situacaoQuestionario, type AepEntregue, type SituacaoQuestionario } from "@/lib/aep/sinalizacao";

// aep_relatorios entra no `Database`, drps_*/qps_* não — o client vai sem tipo.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = any;

export async function buscarAepsEntregues(
  sb: Sb,
  { idEmpresa, empresasVinculadas }: { idEmpresa?: string | null; empresasVinculadas?: string[] | null } = {}
): Promise<AepEntregue[]> {
  let q = sb
    .from("aep_relatorios")
    .select(
      "*, empresas(nome_empresa, cnpj, municipio, uf, id_unidade), inspecoes!inner(id_inspecao, status, elaboracao_status, elaboracao_concluida_em, elaboracao_responsavel)"
    )
    .eq("inspecoes.elaboracao_status", "CONCLUIDO")
    .neq("inspecoes.status", "DELETADA")
    .neq("status", "DELETADO")
    .order("created_at", { ascending: false });
  if (idEmpresa) {
    q = q.eq("id_empresa", idEmpresa);
  } else if (empresasVinculadas?.length) {
    q = q.in("id_empresa", empresasVinculadas);
  }
  let q2 = sb
    .from("aep_relatorios")
    .select("*, empresas(nome_empresa, cnpj, municipio, uf, id_unidade)")
    .is("id_inspecao", null)
    .eq("status", "CONCLUIDO")
    .order("created_at", { ascending: false });
  if (idEmpresa) {
    q2 = q2.eq("id_empresa", idEmpresa);
  } else if (empresasVinculadas?.length) {
    q2 = q2.in("id_empresa", empresasVinculadas);
  }
  const [comInsp, semInsp] = await Promise.all([q, q2]);
  if (comInsp.error) throw comInsp.error;
  if (semInsp.error) throw semInsp.error;
  return [
    ...((comInsp.data ?? []) as unknown[]).map((r) => {
      const insp = (
        r as {
          inspecoes?: { elaboracao_concluida_em?: string | null; elaboracao_responsavel?: string | null } | null;
        }
      ).inspecoes;
      return {
        ...normalizarRelatorio(r),
        entregue_em: insp?.elaboracao_concluida_em ?? null,
        enviado_por: insp?.elaboracao_responsavel ?? null,
      } as AepEntregue;
    }),
    ...((semInsp.data ?? []) as unknown[]).map(
      (r) =>
        ({
          ...normalizarRelatorio(r),
          entregue_em: (r as { concluido_em?: string | null }).concluido_em ?? null,
          enviado_por: null,
        }) as AepEntregue
    ),
  ];
}

export async function buscarSituacaoQuestionario(sb: Sb, ids: string[]): Promise<Record<string, SituacaoQuestionario>> {
  const [d, q] = await Promise.all([
    // No JCN o drps_relatorios tem `data_envio_cliente` (o painel não tem).
    sb
      .from("drps_relatorios")
      .select("id_empresa, status, data_envio_cliente, data_conclusao, data_elaboracao, updated_at")
      .in("id_empresa", ids),
    sb.from("qps_aplicacoes").select("id_empresa, status, data_conclusao, data_elaboracao, atualizado_em").in("id_empresa", ids),
  ]);
  if (d.error) throw d.error;
  if (q.error) throw q.error;
  type Linha = { id_empresa: string; status: string | null; [k: string]: string | null };
  // Data do documento: envio ao cliente > conclusão > elaboração > última edição.
  const dataDrps = (r: Linha) => r.data_envio_cliente ?? r.data_conclusao ?? r.data_elaboracao ?? r.updated_at ?? null;
  const dataQps = (r: Linha) => r.data_conclusao ?? r.data_elaboracao ?? r.atualizado_em ?? null;
  const out: Record<string, SituacaoQuestionario> = {};
  for (const id of ids) {
    out[id] = situacaoQuestionario(
      ((d.data ?? []) as Linha[]).filter((r) => r.id_empresa === id).map((r) => ({ status: r.status, data: dataDrps(r) })),
      ((q.data ?? []) as Linha[]).filter((r) => r.id_empresa === id).map((r) => ({ status: r.status, data: dataQps(r) })),
    );
  }
  return out;
}
