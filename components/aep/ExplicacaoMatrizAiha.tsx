"use client";

// Explicação técnica e normativa da matriz de risco AIHA aplicada aos fatores
// da Ergonomia Organizacional da AEP (página AEP do Painel SST, 2026-10-05).
// Aparece também na Ajuda e na Sinalização do módulo AEP. A matriz, as faixas e as severidades padrão são lidas do sistema (matriz
// ativa + SEVERIDADE_PADRAO_IDX), para o texto nunca divergir do cálculo.

import { useState } from "react";
import { BookOpen, ChevronDown } from "lucide-react";
import { useMatrizAtiva } from "@/lib/hooks/useV3";
import { calcularNivelComMatriz } from "@/lib/calc";
import { NIVEL_CONFIG } from "@/lib/constants";
import { ITENS_ORGANIZACIONAL } from "@/lib/aep/checklist-itens";
import { SEVERIDADE_PADRAO_IDX, type FatorOrganizacional } from "@/lib/aep/aiha-organizacional";
import { SINAIS_ORGANIZACIONAL } from "@/lib/aep/sinais-organizacional";
import type { NivelRisco } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

function Selo({ nivel }: { nivel: string }) {
  const cfg = NIVEL_CONFIG[nivel as NivelRisco];
  return (
    <span
      className="inline-block rounded-full border px-2 py-0.5 text-xs font-semibold"
      style={cfg ? { color: cfg.cor, backgroundColor: cfg.bg, borderColor: cfg.borda } : undefined}
    >
      {nivel}
    </span>
  );
}

function Titulo({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 mt-5 text-sm font-bold text-gray-900 first:mt-0">{children}</h3>;
}

const th = "border border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500";
const td = "border border-gray-200 px-3 py-2 align-top text-sm text-gray-700";

export default function ExplicacaoMatrizAiha({ abertoInicial = false }: { abertoInicial?: boolean }) {
  const [aberto, setAberto] = useState(abertoInicial);
  const { data: matriz } = useMatrizAtiva();

  const probs = matriz?.probabilidades ?? [];
  const sevs = matriz?.severidades ?? [];
  const rotuloProb = (i: number) => probs[Math.min(i, probs.length - 1)] ?? "—";

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left"
        aria-expanded={aberto}
      >
        <BookOpen className="size-5 shrink-0 text-verde-primary" />
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-gray-900">Entenda a matriz de risco AIHA na Ergonomia Organizacional</div>
          <div className="text-xs text-gray-500">
            Fundamentação técnica e normativa de como o nível de cada fator psicossocial é calculado.
          </div>
        </div>
        <ChevronDown className={cn("size-4 shrink-0 text-gray-400 transition-transform", aberto && "rotate-180")} />
      </button>

      {aberto && (
        <div className="border-t border-gray-100 px-5 py-5 text-sm leading-relaxed text-gray-700">
          <Titulo>1. O que é a matriz AIHA</Titulo>
          <p>
            É a matriz qualitativa de avaliação de riscos difundida pela <strong>AIHA — American Industrial Hygiene
            Association</strong> na metodologia <em>A Strategy for Assessing and Managing Occupational Exposures</em>.
            O nível de risco resulta da combinação de duas dimensões, cada uma graduada em 5 níveis com peso de 0 a 4:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong>Probabilidade</strong> (grau de exposição): de “{probs[0] ?? "Não há exposição"}” a “
              {probs[probs.length - 1] ?? "Exposição elevadíssima"}”.
            </li>
            <li>
              <strong>Severidade</strong> (gravidade do efeito à saúde): de “{sevs[0] ?? "Pouca importância"}” a “
              {sevs[sevs.length - 1] ?? "Ameaça"}”.
            </li>
          </ul>
          <p className="mt-2">
            <strong>Nível de risco = peso da probabilidade × peso da severidade</strong>. O produto (0 a 16) é enquadrado
            nas faixas da matriz. Na Ergonomia Organizacional, a “exposição” é a presença dos{" "}
            <strong>sinais observados</strong> de cada fator e a “severidade” é a gravidade potencial do agravo à saúde
            mental que o fator pode causar.
          </p>

          <Titulo>2. Fundamentação normativa</Titulo>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong>NR-01, item 1.5.3.1.4</strong> (redação da Portaria MTE nº 1.419/2024): o Gerenciamento de Riscos
              Ocupacionais (GRO) deve abranger os riscos relacionados aos fatores ergonômicos,{" "}
              <strong>incluindo os fatores de risco psicossociais relacionados ao trabalho</strong>.
            </li>
            <li>
              <strong>NR-01, item 1.5.4.4.2</strong>: para cada risco deve ser indicado o nível de risco ocupacional,{" "}
              <strong>determinado pela combinação da severidade</strong> das possíveis lesões ou agravos à saúde{" "}
              <strong>com a probabilidade</strong> de sua ocorrência — exatamente a lógica da matriz.
            </li>
            <li>
              <strong>NR-01, item 1.5.4.4.3</strong>: a organização seleciona as ferramentas e técnicas de avaliação
              adequadas ao risco; a matriz AIHA é a ferramenta adotada pela JCN, a mesma usada no inventário de riscos
              da inspeção.
            </li>
            <li>
              <strong>NR-17, item 17.3.1 e 17.3.1.1</strong>: a Avaliação Ergonômica Preliminar (AEP) pode ser feita por
              abordagens qualitativas, semiquantitativas, quantitativas ou combinadas — a matriz é uma abordagem
              semiquantitativa.
            </li>
            <li>
              <strong>NR-17, item 17.3.2</strong>: a Análise Ergonômica do Trabalho (AET) deve ser realizada quando a
              AEP indicar necessidade de avaliação mais aprofundada — base do critério “Necessita AET” (item 3.6).
            </li>
            <li>
              Referências técnicas complementares: <strong>Guia de Informações sobre os Fatores de Riscos
              Psicossociais Relacionados ao Trabalho (MTE)</strong>, <strong>ISO 45003:2021</strong> (saúde e
              segurança psicológica no trabalho) e <strong>ISO 31000</strong> (gestão de riscos).
            </li>
          </ul>

          <Titulo>3. Como o sistema aplica a matriz</Titulo>
          <p>
            <strong>3.1 Fator marcado “Sim”.</strong> Só os fatores apontados na triagem entram na matriz; para cada um
            o técnico marca os sinais observados.
          </p>
          <p className="mt-2">
            <strong>3.2 Sem sinal marcado.</strong> O fator fica nos níveis mais baixos da matriz (“
            {probs[0] ?? "Não há exposição"}” × “{sevs[0] ?? "Pouca importância"}”), com resultado{" "}
            <Selo nivel="Trivial" />. Sem evidência registrada não há como graduar a exposição.
          </p>
          <p className="mt-2">
            <strong>3.3 Probabilidade sugerida</strong> pela proporção de sinais marcados sobre o total de sinais do
            fator (quanto mais evidências, maior a exposição):
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse">
              <thead>
                <tr>
                  <th className={th}>Sinais marcados</th>
                  <th className={th}>Probabilidade</th>
                  <th className={th}>Peso</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Nenhum", 0],
                  ["Até 1/3 dos sinais", 2],
                  ["Acima de 1/3 até 2/3", 3],
                  ["Acima de 2/3", 4],
                ].map(([faixa, idx]) => (
                  <tr key={faixa as string}>
                    <td className={td}>{faixa}</td>
                    <td className={td}>{rotuloProb(idx as number)}</td>
                    <td className={td}>{matriz?.pesos_prob?.[idx as number] ?? idx}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Com o 1º sinal a probabilidade já parte do nível intermediário: um sinal psicossocial observado em campo
            indica exposição real, não apenas eventual.
          </p>

          <p className="mt-3">
            <strong>3.4 Severidade padrão por fator</strong>, definida pela gravidade potencial do agravo à saúde mental
            (ex.: assédio e eventos traumáticos podem gerar dano duradouro):
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse">
              <thead>
                <tr>
                  <th className={th}>Fator organizacional</th>
                  <th className={th}>Sinais</th>
                  <th className={th}>Severidade padrão</th>
                </tr>
              </thead>
              <tbody>
                {[...ITENS_ORGANIZACIONAL]
                  .sort(
                    (a, b) =>
                      (SEVERIDADE_PADRAO_IDX[b.key as FatorOrganizacional] ?? 1) -
                      (SEVERIDADE_PADRAO_IDX[a.key as FatorOrganizacional] ?? 1),
                  )
                  .map((f) => {
                    const idx = SEVERIDADE_PADRAO_IDX[f.key as FatorOrganizacional] ?? 1;
                    return (
                      <tr key={f.key}>
                        <td className={td}>{f.label}</td>
                        <td className={td}>{SINAIS_ORGANIZACIONAL[f.key as FatorOrganizacional]?.length ?? 0}</td>
                        <td className={td}>
                          {sevs[idx] ?? "—"} <span className="text-xs text-gray-400">(peso {matriz?.pesos_sev?.[idx] ?? idx})</span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          <p className="mt-3">
            <strong>3.5 Julgamento do técnico.</strong> Probabilidade e severidade são sugestões: o profissional pode
            alterá-las com base no que observou. A alteração fica registrada como manual e pode voltar à sugestão a
            qualquer momento.
          </p>
          <p className="mt-2">
            <strong>3.6 Necessita AET.</strong> O setor recebe a indicação de AET completa (NR-17, 17.3.2) quando há{" "}
            <strong>1 fator organizacional</strong> <Selo nivel="Alto" /> ou <Selo nivel="Muito Alto" />, ou{" "}
            <strong>2 ou mais fatores</strong> <Selo nivel="Moderado" />.
          </p>

          <Titulo>4. Matriz ativa no sistema</Titulo>
          {!matriz ? (
            <p className="text-gray-500">Matriz de risco não carregada.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse">
                  <thead>
                    <tr>
                      <th className={th}>Probabilidade ↓ / Severidade →</th>
                      {sevs.map((s, j) => (
                        <th key={s} className={th}>
                          {s} <span className="normal-case text-gray-400">({matriz.pesos_sev?.[j] ?? j})</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {probs.map((p, i) => (
                      <tr key={p}>
                        <td className={cn(td, "font-medium")}>
                          {p} <span className="text-xs text-gray-400">({matriz.pesos_prob?.[i] ?? i})</span>
                        </td>
                        {sevs.map((s, j) => {
                          const nivel = calcularNivelComMatriz(p, s, matriz);
                          const cfg = NIVEL_CONFIG[nivel];
                          const score =
                            matriz.pesos_prob && matriz.pesos_sev ? matriz.pesos_prob[i] * matriz.pesos_sev[j] : null;
                          return (
                            <td
                              key={s}
                              className="border border-gray-200 px-2 py-2 text-center text-xs font-semibold"
                              style={cfg ? { color: cfg.cor, backgroundColor: cfg.bg } : undefined}
                            >
                              {nivel}
                              {score != null && <div className="font-normal opacity-80">{score}</div>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {matriz.faixas && matriz.faixas.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {matriz.faixas.map((f) => (
                    <span key={f.nivel} className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                      <Selo nivel={f.nivel} />
                      {f.min === f.max ? f.min : f.max >= 100 ? `≥ ${f.min}` : `${f.min}–${f.max}`}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}

          <Titulo>5. Limites da avaliação</Titulo>
          <p>
            A AEP é uma <strong>triagem preliminar</strong>: o nível AIHA prioriza fatores e setores, mas não substitui a
            AET nem a avaliação com instrumento validado aplicado aos trabalhadores (DRPS / Questionário
            Psicossocial). O resultado depende da qualidade das observações registradas e deve ser revisto sempre que
            as condições de trabalho mudarem (NR-01, revisão do inventário de riscos).
          </p>
        </div>
      )}
    </div>
  );
}
