"use client";

// Baixa a "Lista para lançar no PGR" de uma versão registrada (fase 8): lê a foto e os
// itens gravados e monta a planilha só com as empresas que o cliente validou.

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { fetchAllRows } from "@/lib/supabase/fetchAllRows";
import type { ResultadoMotor } from "@/lib/psico-consolidacao/motor";
import type { Decisao } from "@/lib/psico-consolidacao/registro";

const slug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export async function baixarLancamento(p: {
  grupo: string;
  idExecucao: string;
  empresas: string[];
  validacao: Map<string, Decisao>;
  nomeEmpresa: (id: string) => string;
  nomeFator: (id: string) => string;
}) {
  const sb = createSupabaseBrowserClient();
  const [ex, itens] = await Promise.all([
    sb.from("psico_consolidacao_execucoes" as never).select("resultado").eq("id_execucao", p.idExecucao).maybeSingle(),
    fetchAllRows<{ id_empresa: string; setor_canonico: string | null; setor_original: string }>((de, ate) =>
      sb
        .from("psico_consolidacao_itens" as never)
        .select("id_empresa, setor_canonico, setor_original")
        .eq("id_execucao", p.idExecucao)
        .order("id_item")
        .range(de, ate),
    ),
  ]);
  if (ex.error) throw ex.error;
  const r = (ex.data as { resultado?: ResultadoMotor } | null)?.resultado;
  if (!r) throw new Error("Registro não encontrado.");

  const { linhasLancamento, planilhaLancamento } = await import("@/lib/psico-consolidacao/lancamento-pgr");
  const { baixarXlsx } = await import("@/lib/psico-consolidacao/exportar-xlsx");
  const linhas = linhasLancamento({ r, itens, validacao: p.validacao, nomeEmpresa: p.nomeEmpresa });
  const buf = await planilhaLancamento({
    grupo: p.grupo,
    idExecucao: p.idExecucao,
    linhas,
    nomeEmpresa: p.nomeEmpresa,
    nomeFator: p.nomeFator,
    pendentes: p.empresas.filter((e) => !p.validacao.has(e)),
  });
  baixarXlsx(buf, `lancamento-pgr-${p.idExecucao.toLowerCase()}-${slug(p.grupo)}.xlsx`);
}
