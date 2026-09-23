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
import { CLASSIFICACOES_AEP, TIPOS_RISCO_AEP } from "@/lib/hooks/useAep";
import type { RespostaChecklistAep } from "@/lib/supabase/types";

/**
 * Formulário em Branco do AEP — o questionário inteiro da análise, em papel,
 * para o técnico preencher à mão em campo e digitar no sistema depois.
 *
 * Espelha a tela de triagem (`/aep/[id]/setores`) e a de dados
 * (`/aep/[id]/dados`) lendo os MESMOS catálogos (`lib/aep/checklist-itens.ts`,
 * `lib/aep/sinais-organizacional.ts`, `TIPOS_RISCO_AEP`, `CLASSIFICACOES_AEP`):
 * pergunta que muda lá muda aqui. Nada aqui grava nada.
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
}: {
  titulo: string;
  itens: ItemChecklistAep[];
  opcoes: RespostaChecklistAep[];
  /** Só a Organizacional passa: sinais por fator, impressos sob cada linha. */
  sinais?: Record<string, SinalOrganizacional[]>;
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
          </tbody>
        );
      })}
    </FbTabela>
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
      </FbSecao>

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
        />
        <FbLegenda itens={LEGENDA_ORGANIZACIONAL} />
      </FbSecao>

      <FbSecao numero={4} titulo="Matriz de Riscos">
        <FbTabela>
          <thead>
            <tr>
              <th style={{ width: "18%" }}>
                Tipo
                <span className="fb-th-opcoes">{TIPOS_RISCO_AEP.join(" · ")}</span>
              </th>
              <th>Agente / risco</th>
              <th style={{ width: "18%" }}>
                Classificação
                <span className="fb-th-opcoes">{CLASSIFICACOES_AEP.join(" · ")}</span>
              </th>
              <th style={{ width: "30%" }}>Medida preventiva</th>
            </tr>
          </thead>
          <tbody>
            <FbLinhasVazias n={5} colunas={4} altura={26} />
          </tbody>
        </FbTabela>
      </FbSecao>

      <FbSecao numero={5} titulo="Indicador de AET">
        <div className="fb-bloco fb-avoid">
          <div className="fb-opcoes">
            <span className="fb-campo-label" style={{ marginRight: 6 }}>Este setor requer elaboração de AET completa?</span>
            <FbCaixa label="Sim" />
            <FbCaixa label="Não" />
          </div>
          <p className="fb-nota">
            Marque <strong>Sim</strong> quando houver risco classificado como Alto ou Crítico, ou dois ou mais riscos Moderados
            — é o critério que o sistema aplica sozinho ao digitar a matriz.
          </p>
        </div>
      </FbSecao>

      <FbSecao numero={6} titulo="Parecer Técnico Preliminar">
        <div className="fb-bloco">
          <p className="fb-nota" style={{ marginBottom: 3 }}>
            Descreva as condições de trabalho, práticas de gestão e fatores organizacionais observados que podem estar gerando
            risco. Foque nas condições e processos — não em características individuais dos trabalhadores.
          </p>
          <FbLinhas n={6} />
        </div>
      </FbSecao>

      <FbSecao numero={7} titulo="Recomendações">
        <div className="fb-bloco">
          <p className="fb-nota" style={{ marginBottom: 3 }}>Recomendações ergonômicas preliminares para o setor.</p>
          <FbLinhas n={6} />
        </div>
      </FbSecao>
    </FbSetor>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function AepFormularioBrancoPage() {
  const [nSetores, setNSetores] = useState(1);

  return (
    <FormularioBrancoShell
      sigla="AEP"
      titulo="Análise Ergonômica Preliminar — Formulário em Branco"
      descricao="Versão impressa do questionário completo da AEP (dados da análise, identificação do setor, triagem física / cognitiva / organizacional com os sinais observados, matriz de riscos, parecer e recomendações) para preenchimento manual em campo. Cada setor sai em página própria."
      nSetores={nSetores}
      onNSetoresChange={setNSetores}
    >
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
            <li>Use um bloco de setor (seções 2 a 7) para cada setor / função avaliada. Imprima quantos precisar.</li>
            <li>
              Nos checklists, marque <strong>uma</strong> resposta por fator: <strong>Sim</strong> = fator de risco identificado;{" "}
              <strong>Não</strong> = fator avaliado e ausente; <strong>N/A</strong> = não se aplica;{" "}
              <strong>N/I</strong> (só na Organizacional) = não foi possível verificar em campo.
            </li>
            <li>
              Na <strong>Ergonomia Organizacional</strong>, todo fator marcado <strong>Sim</strong> pede os sinais observados —
              marque quantos couberem; eles entram no laudo como o motivo do apontamento.
            </li>
            <li>Na matriz de riscos, escreva o tipo e a classificação com os nomes listados no cabeçalho da tabela.</li>
          </ul>
        </div>
      </FbSecao>

      {Array.from({ length: nSetores }, (_, i) => (
        <BlocoSetor key={i} indice={i + 1} total={nSetores} />
      ))}

      <FbSecao numero={8} titulo="Considerações finais" className="fb-setor">
        <div className="fb-bloco">
          <p className="fb-nota" style={{ marginBottom: 3 }}>Conclusões gerais, encaminhamentos, observações.</p>
          <FbLinhas n={10} />
        </div>
        <FbAssinatura papel="Responsável pela elaboração" />
      </FbSecao>
    </FormularioBrancoShell>
  );
}
