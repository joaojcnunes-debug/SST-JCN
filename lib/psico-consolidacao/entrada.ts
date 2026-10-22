// Consolidação Psicossocial de Grupo — das linhas dos documentos para a entrada do
// motor (fase 5). Cada linha ganha o setor PADRONIZADO do grupo (o confirmado na aba
// Setores; sem confirmação, a sugestão) e o fator do catálogo (aba Fatores). Linha
// sem fator correspondente ou de fator que o grupo deixou de fora não entra.
//
// Função pura, sem banco: a tela chama com o que já carregou.

import { ITENS_ORGANIZACIONAL } from "@/lib/aep/checklist-itens";
import type { PsicoSetorCanonico, PsicoSetorDepara } from "@/lib/supabase/types";
import { resolverFator, type PsicoFator, type PsicoFatorDepara } from "./fatores";
import type { LinhaFonte, PendenciaFonte } from "./fontes";
import type { EntradaMotor, ItemMotor } from "./motor";
import { sugerirSetorCanonico } from "./setores";

const ROTULO_AEP = new Map(ITENS_ORGANIZACIONAL.map((i) => [i.key as string, i.label]));

export interface MontarEntrada {
  linhas: LinhaFonte[];
  pendencias: PendenciaFonte[];
  empresas: Array<{ idEmpresa: string; nome: string; papel: string | null }>;
  fatores: PsicoFator[];
  fatorDepara: PsicoFatorDepara[];
  ignorados: string[];
  canonicos: PsicoSetorCanonico[];
  setorDepara: PsicoSetorDepara[];
  aepIncluirTrivialBaixo: boolean;
}

export interface EntradaMontada {
  entrada: EntradaMotor;
  /** Nomes de setor (empresa × origem × nome) ainda sem padronização confirmada. */
  setoresSemConfirmacao: number;
  /** Linhas que ficaram fora por não terem fator correspondente. */
  linhasSemFator: number;
}

export function montarEntrada(p: MontarEntrada): EntradaMontada {
  const nomeCanonico = new Map(p.canonicos.map((c) => [c.id_setor_canonico, c.nome]));
  const confirmado = new Map<string, string>();
  for (const d of p.setorDepara) {
    const nome = d.confirmado_em && d.id_setor_canonico ? nomeCanonico.get(d.id_setor_canonico) : undefined;
    if (nome) confirmado.set(`${d.id_empresa}|${d.origem}|${d.setor_original}`, nome);
  }
  const semConfirmacao = new Set<string>();
  const setorDe = (idEmpresa: string, origem: string, original: string) => {
    const k = `${idEmpresa}|${origem}|${original}`;
    const c = confirmado.get(k);
    if (c) return c;
    semConfirmacao.add(k);
    return sugerirSetorCanonico(original);
  };

  const considerados = p.fatores.filter((f) => f.ativo !== false && !p.ignorados.includes(f.id_fator));
  const cacheFator = new Map<string, string | null>();
  const fatorDe = (origem: LinhaFonte["origem"], nome: string) => {
    const k = `${origem}|${nome}`;
    if (!cacheFator.has(k)) cacheFator.set(k, resolverFator(origem, nome, p.fatores, p.fatorDepara).id_fator);
    return cacheFator.get(k)!;
  };

  let linhasSemFator = 0;
  const itens: ItemMotor[] = [];
  for (const l of p.linhas) {
    const idFator = fatorDe(l.origem, l.fatorOriginal);
    if (!idFator) {
      linhasSemFator++;
      continue;
    }
    itens.push({
      idEmpresa: l.idEmpresa,
      origem: l.origem,
      setorOriginal: l.setorOriginal,
      setor: setorDe(l.idEmpresa, l.origem, l.setorOriginal),
      idFator,
      nivel: l.nivel,
      sinais: l.sinais,
      semSinal: l.semSinal,
      nivelAiha: l.nivelAiha,
      confianca: l.confianca,
      respondentes: l.respondentes,
      probabilidadeInformada: l.probabilidadeInformada,
      idDocumento: l.idDocumento,
    });
  }

  const setoresSemTransito = p.canonicos.filter((c) => !c.transita).map((c) => c.nome);
  const pendencias = p.pendencias.map((x) => ({
    idEmpresa: x.idEmpresa,
    origem: x.origem,
    setorOriginal: x.setorOriginal,
    fator: x.origem === "AEP" ? ROTULO_AEP.get(x.fatorOriginal) ?? x.fatorOriginal : x.fatorOriginal,
    tipo: x.tipo,
  }));

  return {
    entrada: {
      itens,
      empresas: p.empresas,
      fatores: considerados.map((f) => ({ id_fator: f.id_fator, nome: f.nome, ordem: f.ordem })),
      setoresSemTransito,
      pendencias,
      aepIncluirTrivialBaixo: p.aepIncluirTrivialBaixo,
    },
    setoresSemConfirmacao: semConfirmacao.size,
    linhasSemFator,
  };
}
