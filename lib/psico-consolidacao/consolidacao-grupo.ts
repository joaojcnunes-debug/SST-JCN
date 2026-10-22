// Consolidação Psicossocial de Grupo — tudo o que a tela calcula, numa função só,
// para o SERVIDOR (PDF ao cliente, fase 6). Relê os dados com o client de quem pede
// (RLS) e roda o mesmo motor da tela: o PDF sai igual ao que está na tela.

import type { MembroGrupo, EmpresaGrupo, PapelEconomico, PsicoSetorCanonico, PsicoSetorDepara } from "@/lib/supabase/types";
import { carregarFontesDoGrupo, type FontesDoGrupo } from "./carregar-grupo";
import { montarEntrada, type EntradaMontada } from "./entrada";
import type { PsicoFator, PsicoFatorDepara } from "./fatores";
import { documentosPadrao } from "./fontes";
import { consolidar, type ResultadoMotor } from "./motor";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = any;

export interface GlossarioItem {
  sigla: string;
  significado: string;
  explicacao: string | null;
  ordem: number;
}

/** Nome de cada empresa; duas com o mesmo nome (MPR 0001-49 e 0002-20) ganham o fim do CNPJ. */
export function nomesDasEmpresas(membros: Pick<MembroGrupo, "id_empresa" | "nome_empresa" | "cnpj">[]): (id: string) => string {
  const repetidos = new Set(membros.map((x) => x.nome_empresa).filter((n, i, todos) => todos.indexOf(n) !== i));
  const m = new Map(
    membros.map((x) => {
      const cnpj = (x.cnpj ?? "").replace(/\D/g, "");
      const fim = repetidos.has(x.nome_empresa) && cnpj.length === 14 ? ` (${cnpj.slice(8, 12)}-${cnpj.slice(12)})` : "";
      return [x.id_empresa, x.nome_empresa + fim];
    }),
  );
  return (id: string) => m.get(id) ?? id;
}

export interface ConsolidacaoCompleta {
  grupo: EmpresaGrupo;
  membros: MembroGrupo[];
  fontes: FontesDoGrupo;
  usados: Set<string>;
  montada: EntradaMontada;
  resultado: ResultadoMotor;
  nomeEmpresa: (id: string) => string;
  /** Nome curto de cada fator do catálogo (cabeçalho das tabelas). */
  nomeCurto: (id: string) => string;
  glossario: GlossarioItem[];
}

const erro = (r: { error: { message?: string } | null }) => {
  if (r.error) throw new Error(r.error.message ?? "Falha ao ler a consolidação");
};

/**
 * @param documentos ids dos documentos escolhidos na tela; vazio/ausente = os padrão
 *   (o mais recente de cada empresa em cada origem).
 */
export async function carregarConsolidacao(
  sb: Sb,
  idGrupo: string,
  opcoes: { documentos?: string[] | null; incluirTrivialBaixo?: boolean } = {},
): Promise<ConsolidacaoCompleta | null> {
  const [g, m, cat, dep, can, sdp, glo] = await Promise.all([
    sb.from("empresa_grupos").select("*").eq("id_grupo", idGrupo).maybeSingle(),
    sb.rpc("empresa_grupos_membros"),
    sb.from("psico_fatores").select("*").order("ordem"),
    sb.from("psico_fator_depara").select("*"),
    sb.from("psico_setor_canonico").select("*").eq("id_grupo", idGrupo),
    sb.from("psico_setor_depara").select("*").eq("id_grupo", idGrupo),
    sb.from("psico_glossario").select("sigla, significado, explicacao, ordem").order("ordem"),
  ]);
  for (const r of [g, m, cat, dep, can, sdp, glo]) erro(r);
  if (!g.data) return null;

  const membros = ((m.data ?? []) as MembroGrupo[]).filter((x) => x.id_grupo === idGrupo);
  const ids = membros.filter((x) => x.visivel).map((x) => x.id_empresa);
  const [fontes, pap] = await Promise.all([
    carregarFontesDoGrupo(sb, ids),
    ids.length
      ? sb.from("empresas").select("id_empresa, papel_economico").in("id_empresa", ids)
      : Promise.resolve({ data: [], error: null }),
  ]);
  erro(pap);
  const papel = new Map(
    ((pap.data ?? []) as Array<{ id_empresa: string; papel_economico: PapelEconomico | null }>).map((x) => [x.id_empresa, x.papel_economico]),
  );

  const usados = opcoes.documentos?.length
    ? new Set(opcoes.documentos.filter((d) => fontes.documentos.some((x) => x.id === d)))
    : documentosPadrao(fontes.documentos);
  const linhas = fontes.linhas.filter((l) => usados.has(l.idDocumento));
  const comLinha = new Set(linhas.map((l) => l.idEmpresa));
  const nomeEmpresa = nomesDasEmpresas(membros);
  const fatores = (cat.data ?? []) as PsicoFator[];
  const grupo = g.data as EmpresaGrupo;

  const montada = montarEntrada({
    linhas,
    pendencias: fontes.pendencias.filter((p) => usados.has(p.idDocumento)),
    empresas: membros
      .filter((x) => x.visivel && (comLinha.has(x.id_empresa) || papel.get(x.id_empresa)))
      .map((x) => ({ idEmpresa: x.id_empresa, nome: nomeEmpresa(x.id_empresa), papel: papel.get(x.id_empresa) ?? null })),
    fatores,
    fatorDepara: (dep.data ?? []) as PsicoFatorDepara[],
    ignorados: grupo.psico_fatores_ignorados ?? [],
    canonicos: (can.data ?? []) as PsicoSetorCanonico[],
    setorDepara: (sdp.data ?? []) as PsicoSetorDepara[],
    aepIncluirTrivialBaixo: opcoes.incluirTrivialBaixo ?? true,
  });
  const curto = new Map(fatores.map((f) => [f.id_fator, f.nome_curto || f.nome]));

  return {
    grupo,
    membros,
    fontes,
    usados,
    montada,
    resultado: consolidar(montada.entrada),
    nomeEmpresa,
    nomeCurto: (id: string) => curto.get(id) ?? id,
    glossario: (glo.data ?? []) as GlossarioItem[],
  };
}

export interface RegistroCompleto {
  grupo: EmpresaGrupo;
  membros: MembroGrupo[];
  resultado: ResultadoMotor;
  fontes: Array<{ id: string; origem: string; id_empresa: string; data: string | null; titulo: string }>;
  criadoEm: string;
  nomeEmpresa: (id: string) => string;
  nomeCurto: (id: string) => string;
  glossario: GlossarioItem[];
}

/** Um registro da fase 7 como foi gravado (a foto do motor), para o PDF daquela versão. */
export async function carregarRegistro(sb: Sb, idGrupo: string, idExecucao: string): Promise<RegistroCompleto | null> {
  const [g, m, cat, glo, ex] = await Promise.all([
    sb.from("empresa_grupos").select("*").eq("id_grupo", idGrupo).maybeSingle(),
    sb.rpc("empresa_grupos_membros"),
    sb.from("psico_fatores").select("id_fator, nome, nome_curto"),
    sb.from("psico_glossario").select("sigla, significado, explicacao, ordem").order("ordem"),
    sb
      .from("psico_consolidacao_execucoes")
      .select("criado_em, fontes, resultado")
      .eq("id_execucao", idExecucao)
      .eq("id_grupo", idGrupo)
      .maybeSingle(),
  ]);
  for (const r of [g, m, cat, glo, ex]) erro(r);
  if (!g.data || !ex.data) return null;
  const membros = ((m.data ?? []) as MembroGrupo[]).filter((x) => x.id_grupo === idGrupo);
  const curto = new Map(((cat.data ?? []) as PsicoFator[]).map((f) => [f.id_fator, f.nome_curto || f.nome]));
  return {
    grupo: g.data as EmpresaGrupo,
    membros,
    resultado: ex.data.resultado as ResultadoMotor,
    fontes: ex.data.fontes ?? [],
    criadoEm: ex.data.criado_em,
    nomeEmpresa: nomesDasEmpresas(membros),
    nomeCurto: (id: string) => curto.get(id) ?? id,
    glossario: (glo.data ?? []) as GlossarioItem[],
  };
}
