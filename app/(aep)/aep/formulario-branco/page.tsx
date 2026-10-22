"use client";

import { useState } from "react";
import {
  FbAssinatura,
  FbCaixa,
  FbCampo,
  FbCampos,
  FbLegenda,
  FbLinhas,
  FbLinhasVazias,
  FbOpcoes,
  FbSecao,
  FbSetor,
  FbTabela,
  FormularioBrancoShell,
} from "@/components/formulario-branco/primitivos";
import {
  ITENS_COGNITIVA,
  ITENS_FISICA,
  ITENS_ORGANIZACIONAL,
  LEGENDA_RESPOSTA,
  METODOS_COLETA,
  OPCOES_COM_NI,
  OPCOES_TRISTATE,
  ROTULO_RESPOSTA,
  type ItemChecklistAep,
} from "@/lib/aep/checklist-itens";
import {
  SINAIS_ORGANIZACIONAL,
  type SinalOrganizacional,
} from "@/lib/aep/sinais-organizacional";
import { MOTIVOS_NI, SINAIS_INIBICAO } from "@/lib/aep/coleta";
import { ROTEIRO_CAMPO, type RoteiroFator } from "@/lib/aep/roteiro-campo";
import type { RespostaChecklistAep } from "@/lib/supabase/types";

/**
 * Formulário em Branco do AEP — o questionário inteiro da análise, em papel,
 * para o técnico preencher à mão em campo e digitar no sistema depois.
 *
 * Espelha a tela de triagem (`/aep/[id]/setores`) e a de dados
 * (`/aep/[id]/dados`) lendo os MESMOS catálogos (`lib/aep/checklist-itens.ts`,
 * `lib/aep/sinais-organizacional.ts`, `lib/aep/roteiro-campo.ts`):
 * pergunta que muda lá muda aqui. Nada aqui grava nada.
 *
 * A Matriz de Riscos saiu do papel em 16/10/2026 (v0.3.746), como já tinha
 * saído da tela de Setores na v0.3.717.
 *
 * A regra da Ergonomia Organizacional vale no papel como na tela: ao marcar
 * SIM num fator, o técnico marca também os sinais observados daquele fator —
 * por isso cada fator organizacional traz o bloco de sinais logo abaixo.
 */

const LEGENDA_ORGANIZACIONAL = (["nao_aplica", "nao_identificado"] as RespostaChecklistAep[])
  .flatMap((opt) => {
    const l = LEGENDA_RESPOSTA[opt];
    return l ? [{ sigla: ROTULO_RESPOSTA[opt], titulo: l.titulo, texto: l.texto }] : [];
  });

// ─── Checklist (Física / Cognitiva / Organizacional) ─────────────────────────

function ChecklistTabela({
  titulo,
  itens,
  opcoes,
  sinais,
  roteiro,
}: {
  titulo: string;
  itens: ItemChecklistAep[];
  opcoes: RespostaChecklistAep[];
  /** Só a Organizacional passa: sinais por fator, impressos sob cada linha. */
  sinais?: Record<string, SinalOrganizacional[]>;
  /** Só a Organizacional passa: roteiro de campo e motivo do N/I (2026-10-06). */
  roteiro?: Record<string, RoteiroFator>;
}) {
  const colunas = opcoes.length + 2;
  return (
    <FbTabela>
      <thead>
        <tr>
          <th>{titulo}</th>
          {opcoes.map((o) => (
            <th key={o} className="fb-check">{ROTULO_RESPOSTA[o]}</th>
          ))}
          <th className="fb-obs">Observação de campo</th>
        </tr>
      </thead>
      {/* Um tbody por fator: na impressão, a linha do fator e o bloco de sinais
          dele viram uma unidade que não quebra de página no meio. */}
      {itens.map((item) => {
        const doFator = sinais?.[item.key];
        const rot = roteiro?.[item.key];
        return (
          <tbody key={item.key} className="fb-avoid">
            <tr>
              <td>{item.label}</td>
              {opcoes.map((o) => (
                <td key={o} className="fb-check"><FbCaixa /></td>
              ))}
              <td className="fb-obs" />
            </tr>
            {doFator && doFator.length > 0 && (
              <tr>
                <td colSpan={colunas} className="fb-sinais">
                  <div className="fb-sinais-titulo">
                    Se SIM — marque os sinais observados ({doFator.length})
                  </div>
                  <div className="fb-sinais-grid">
                    {doFator.map((s) => (
                      <FbCaixa
                        key={s.key}
                        label={s.label}
                        etiqueta={
                          s.fonte === "colaborador" ? "colaborador" : s.fonte === "tecnico" ? "técnico" : undefined
                        }
                      />
                    ))}
                  </div>
                </td>
              </tr>
            )}
            {rot && (
              <tr>
                <td colSpan={colunas} className="fb-roteiro">
                  <div className="fb-roteiro-col">
                    <span className="fb-roteiro-titulo">Pergunte (indireto):</span> {rot.perguntas.join(" · ")}
                  </div>
                  <div className="fb-roteiro-col">
                    <span className="fb-roteiro-titulo">Observe:</span> {rot.observar.join(" · ")}
                  </div>
                  <div className="fb-roteiro-col">
                    <span className="fb-roteiro-titulo">Se N/I, motivo:</span>{" "}
                    {MOTIVOS_NI.map((m) => (
                      <FbCaixa key={m.key} label={m.key === "outro" ? "Outro: ________________" : m.label} />
                    ))}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        );
      })}
    </FbTabela>
  );
}

// ─── Seção 3 — Triagem Ergonômica ────────────────────────────────────────────

function SecaoTriagem() {
  return (
    <FbSecao
      numero={3}
      titulo="Triagem Ergonômica"
      nota={
        <>
          Marque uma resposta por fator. Ao marcar <strong>Sim</strong>, registre o que foi observado na coluna de observação
          — e, na Ergonomia Organizacional, marque também os <strong>sinais observados</strong> daquele fator.
        </>
      }
    >
      <ChecklistTabela titulo="Ergonomia Física" itens={ITENS_FISICA} opcoes={OPCOES_TRISTATE} />
      <div style={{ height: 8 }} />
      <ChecklistTabela titulo="Ergonomia Cognitiva" itens={ITENS_COGNITIVA} opcoes={OPCOES_TRISTATE} />
      <div style={{ height: 8 }} />
      <ChecklistTabela
        titulo="Ergonomia Organizacional"
        itens={ITENS_ORGANIZACIONAL}
        opcoes={OPCOES_COM_NI}
        sinais={SINAIS_ORGANIZACIONAL}
        roteiro={ROTEIRO_CAMPO}
      />
      <FbLegenda itens={LEGENDA_ORGANIZACIONAL} />
    </FbSecao>
  );
}

/**
 * Modo "Só a Triagem": o técnico leva para o campo apenas a seção 3, um bloco
 * por setor, com o mínimo para saber de que empresa é cada folha.
 */
function BlocoSoTriagem({ indice, total }: { indice: number; total: number }) {
  return (
    <FbSetor indice={indice} total={total} className={indice === 1 ? "fb-sem-quebra" : undefined}>
      <FbCampos colunas={3}>
        <FbCampo label="Empresa" />
        <FbCampo label="Técnico" />
        <FbCampo label="Data" />
      </FbCampos>
      <SecaoTriagem />
    </FbSetor>
  );
}

// ─── Bloco de um setor ────────────────────────────────────────────────────────

function BlocoSetor({ indice, total }: { indice: number; total: number }) {
  return (
    <FbSetor indice={indice} total={total}>
      <FbSecao numero={2} titulo="Identificação do setor">
        <FbCampos colunas={3}>
          <FbCampo label="Setor *" />
          <FbCampo label="Unidade" />
          <FbCampo label="GHE" />
          <FbCampo label="Jornada" />
          <FbCampo label="Qtd. expostos" />
        </FbCampos>

        <div className="fb-sub">Cargos do setor</div>
        <FbTabela>
          <thead>
            <tr>
              <th style={{ width: "28%" }}>Cargo</th>
              <th>Descrição da atividade do cargo</th>
              <th style={{ width: 60 }}>Qtd</th>
            </tr>
          </thead>
          <tbody>
            <FbLinhasVazias n={4} colunas={3} />
          </tbody>
        </FbTabela>

        <div className="fb-sub">Participação dos trabalhadores — NR-1</div>
        <div className="fb-bloco">
          <FbOpcoes titulo="Método de coleta" opcoes={METODOS_COLETA} />
          <FbCampo label="Trabalhadores consultados" />
        </div>

        <div className="fb-sub">Condições da coleta</div>
        <div className="fb-bloco fb-avoid">
          <FbCampos colunas={3}>
            <FbCampo label="Trabalhadores abordados" />
            <FbCampo label="Participaram" />
            <FbCampo label="Recusas / respostas evasivas (só o número)" />
          </FbCampos>
          <div className="fb-opcoes">
            <span className="fb-campo-label" style={{ marginRight: 6 }}>Liderança presente durante a coleta?</span>
            <FbCaixa label="Sim" />
            <FbCaixa label="Não" />
          </div>
          <FbOpcoes titulo="Sinais de inibição" opcoes={SINAIS_INIBICAO.map((s) => s.label)} />
          <FbCampo label="Observações sobre a coleta" />
        </div>
      </FbSecao>

      <SecaoTriagem />

      <FbSecao numero={4} titulo="Indicador de AET">
        <div className="fb-bloco fb-avoid">
          <div className="fb-opcoes">
            <span className="fb-campo-label" style={{ marginRight: 6 }}>Este setor requer elaboração de AET completa?</span>
            <FbCaixa label="Sim" />
            <FbCaixa label="Não" />
          </div>
          <p className="fb-nota">
            Marque <strong>Sim</strong> quando algum fator da Ergonomia Organizacional ficar Alto ou Muito Alto na matriz
            AIHA, ou dois ou mais fatores ficarem Moderados — é o critério que o sistema aplica sozinho ao digitar.
          </p>
        </div>
      </FbSecao>

      <FbSecao numero={5} titulo="Parecer Técnico Preliminar">
        <div className="fb-bloco">
          <p className="fb-nota" style={{ marginBottom: 3 }}>
            Descreva as condições de trabalho, práticas de gestão e fatores organizacionais observados que podem estar gerando
            risco. Foque nas condições e processos — não em características individuais dos trabalhadores.
          </p>
          <FbLinhas n={6} />
        </div>
      </FbSecao>

      <FbSecao numero={6} titulo="Recomendações">
        <div className="fb-bloco">
          <p className="fb-nota" style={{ marginBottom: 3 }}>Recomendações ergonômicas preliminares para o setor.</p>
          <FbLinhas n={6} />
        </div>
      </FbSecao>
    </FbSetor>
  );
}

// ─── Seletor: tudo × só a triagem ────────────────────────────────────────────

type ModoImpressao = "tudo" | "triagem";

const MODOS: { valor: ModoImpressao; label: string }[] = [
  { valor: "tudo", label: "Formulário completo" },
  { valor: "triagem", label: "Só a Triagem (item 3)" },
];

function SeletorModo({ modo, onChange }: { modo: ModoImpressao; onChange: (m: ModoImpressao) => void }) {
  return (
    <div role="radiogroup" aria-label="O que imprimir" className="flex rounded-lg border border-gray-200 bg-white p-0.5">
      {MODOS.map((m) => (
        <button
          key={m.valor}
          type="button"
          role="radio"
          aria-checked={modo === m.valor}
          onClick={() => onChange(m.valor)}
          className={
            modo === m.valor
              ? "rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white"
              : "rounded-md px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
          }
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function AepFormularioBrancoPage() {
  const [nSetores, setNSetores] = useState(1);
  const [modo, setModo] = useState<ModoImpressao>("tudo");

  return (
    <FormularioBrancoShell
      sigla="AEP"
      titulo="Análise Ergonômica Preliminar — Formulário em Branco"
      descricao="Versão impressa do questionário completo da AEP (dados da análise, identificação do setor, triagem física / cognitiva / organizacional com os sinais observados, indicador de AET, parecer e recomendações) para preenchimento manual em campo. Cada setor sai em página própria."
      nSetores={nSetores}
      onNSetoresChange={setNSetores}
      controles={<SeletorModo modo={modo} onChange={setModo} />}
    >
      {modo === "triagem" ? (
        Array.from({ length: nSetores }, (_, i) => (
          <BlocoSoTriagem key={i} indice={i + 1} total={nSetores} />
        ))
      ) : (
        <>
          <FbSecao numero={1} titulo="Dados da Análise">
            <FbCampos colunas={2}>
              <FbCampo label="Empresa *" />
              <FbCampo label="CNPJ" />
              <FbCampo label="Endereço da empresa" span={2} />
              <FbCampo label="Responsável pela elaboração *" />
              <FbCampo label="Título profissional" />
              <FbCampo label="Registro profissional (CREA / CRQ / CFT)" />
              <FbCampo label="Data de elaboração" />
              <FbCampo label="Validade do documento" />
              <FbCampo label="Nº de setores avaliados" />
            </FbCampos>
          </FbSecao>

          <FbSecao titulo="Como preencher">
            <div className="fb-bloco fb-avoid">
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: "9.5px", lineHeight: 1.45 }}>
                <li>Use um bloco de setor (seções 2 a 6) para cada setor / função avaliada. Imprima quantos precisar.</li>
                <li>
                  Nos checklists, marque <strong>uma</strong> resposta por fator: <strong>Sim</strong> = fator de risco identificado;{" "}
                  <strong>Não</strong> = fator avaliado e ausente; <strong>N/A</strong> = não se aplica;{" "}
                  <strong>N/I</strong> (só na Organizacional) = não foi possível verificar em campo — marque também o{" "}
                  <strong>motivo</strong> (obrigatório no sistema).
                </li>
                <li>
                  Cada fator organizacional traz um <strong>roteiro de campo</strong>: perguntas indiretas e o que observar, para
                  sustentar a triagem mesmo quando os trabalhadores não se manifestam.
                </li>
                <li>
                  Na <strong>Ergonomia Organizacional</strong>, todo fator marcado <strong>Sim</strong> pede os sinais observados —
                  marque quantos couberem; eles entram no laudo como o motivo do apontamento.
                </li>
              </ul>
            </div>
          </FbSecao>

          {Array.from({ length: nSetores }, (_, i) => (
            <BlocoSetor key={i} indice={i + 1} total={nSetores} />
          ))}

          <FbSecao numero={7} titulo="Considerações finais" className="fb-setor">
            <div className="fb-bloco">
              <p className="fb-nota" style={{ marginBottom: 3 }}>Conclusões gerais, encaminhamentos, observações.</p>
              <FbLinhas n={10} />
            </div>
            <FbAssinatura papel="Responsável pela elaboração" />
          </FbSecao>
        </>
      )}
    </FormularioBrancoShell>
  );
}
