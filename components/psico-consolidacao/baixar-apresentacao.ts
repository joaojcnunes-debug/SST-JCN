"use client";

// Baixa a apresentação (.pptx) no navegador: carrega glossário e fundos, monta com o
// resultado do motor (da tela ou de uma versão registrada) e grava COMPRIMIDO.

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { GlossarioItem } from "@/lib/psico-consolidacao/consolidacao-grupo";
import type { ResultadoMotor } from "@/lib/psico-consolidacao/motor";

const slug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export async function baixarApresentacao(p: {
  grupo: string;
  nomeEmpresa: (id: string) => string;
  nomeFator: (id: string) => string;
  nomeCurto: (id: string) => string;
  /** Resultado da tela; sem ele, `idExecucao` é obrigatório (lê a foto gravada). */
  r?: ResultadoMotor;
  registro?: { id: string; em: string };
}) {
  const sb = createSupabaseBrowserClient();
  let r = p.r;
  if (!r) {
    if (!p.registro) throw new Error("Nada para apresentar.");
    const { data, error } = await sb
      .from("psico_consolidacao_execucoes" as never)
      .select("resultado")
      .eq("id_execucao", p.registro.id)
      .maybeSingle();
    if (error) throw error;
    r = (data as { resultado?: ResultadoMotor } | null)?.resultado;
    if (!r) throw new Error("Registro não encontrado.");
  }
  const [glo, { montarApresentacao, carregarFundos }] = await Promise.all([
    sb.from("psico_glossario" as never).select("sigla, significado, explicacao, ordem").order("ordem"),
    import("@/lib/psico-consolidacao/apresentacao"),
  ]);
  if (glo.error) throw glo.error;
  const pptx = await montarApresentacao({
    grupo: p.grupo,
    r,
    nomeEmpresa: p.nomeEmpresa,
    nomeFator: p.nomeFator,
    nomeCurto: p.nomeCurto,
    glossario: (glo.data ?? []) as unknown as GlossarioItem[],
    registro: p.registro,
    fundos: await carregarFundos(),
    geradoEm: new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }),
  });
  const nome = `consolidacao-psicossocial-${p.registro ? `${p.registro.id.toLowerCase()}-` : ""}${slug(p.grupo)}`;
  await pptx.writeFile({ fileName: `${nome}.pptx`, compression: true });
}
