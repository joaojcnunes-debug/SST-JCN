"use client";

import { Fragment, useState } from "react";
import {
  FbAssinatura,
  FbCaixa,
  FbCampo,
  FbCampos,
  FbLinhas,
  FbLinhasVazias,
  FbOpcoes,
  FbSecao,
  FbSetor,
  FbTabela,
  FormularioBrancoShell,
} from "@/components/formulario-branco/primitivos";
import {
  CHECKLIST_PERGUNTAS_PADRAO,
  FATORES_DEFAULT,
  OWAS_CATEGORIAS_PADRAO,
  OWAS_SELECTS_PADRAO,
  PERGUNTAS_DEFAULT,
  SEMAFORO_DEFAULT,
  SLUG_TO_OWAS_FIELD,
  useAet13FatoresConfig,
  useAet13FatoresPerguntas,
  useAet13FatoresSemaforo,
  useAetChecklistPerguntas,
  useAetOwasConfig,
  useAetOwasSelects,
} from "@/lib/hooks/useAet";
import { algumaVisivel, perguntaOculta } from "@/lib/aet/checklist";
import type {
  Aet13FatorConfig,
  Aet13FatorPergunta,
  Aet13FatorSemaforo,
  AetChecklistPergunta,
  AetOwasCategoria,
  AetOwasSelectCampo,
  ClassificacaoRiscoAET,
  TipoRiscoAET,
} from "@/lib/supabase/types";

/**
 * Formulário em Branco do AET — o questionário inteiro do laudo, em papel,
 * para o técnico preencher à mão em campo e digitar no sistema depois.
 *
 * Lê as perguntas pelos MESMOS hooks da tela de setores (`/aet/[id]/setores`):
 * checklist com as perguntas editadas/adicionadas/excluídas em "Config. OWAS",
 * categorias e opções do OWAS, os 13 fatores e suas perguntas de "Config. 13
 * Fatores" e o semáforo. O que o Admin muda na configuração muda aqui na
 * próxima abertura. Nada aqui grava nada.
 */

// ─── Catálogos que a tela de setores mantém locais ───────────────────────────
// Espelho de app/(aet)/aet/[idRelatorio]/setores/page.tsx — o formulário tem
// que oferecer as mesmas opções que a tela.

const TIPOS_RISCO: TipoRiscoAET[] = ["Acidentes", "Ergonômico", "Físico", "Químico", "Biológico"];
const CLASSIFICACOES: ClassificacaoRiscoAET[] = ["Trivial", "De Atenção", "Moderado", "Alto", "Crítico"];

const FORMAS_COLETA = [
  "Presencial — papel",
  "Presencial — tablet/digital",
  "Híbrido (parte presencial, parte digital)",
];

const ESCALA = [1, 2, 3, 4, 5] as const;
const ESCALA_LABEL: Record<number, string> = {
  1: "Nunca", 2: "Raramente", 3: "Às vezes", 4: "Frequentemente", 5: "Sempre",
};

const RESPOSTAS_CHECKLIST = ["Sim", "Não", "N/A"];

/** Slugs que a tela desenha à mão; o resto do checklist é pergunta adicionada. */
const SLUGS_PADRAO = new Set<string>([
  ...CHECKLIST_PERGUNTAS_PADRAO.map((p) => p.slug),
  "trabalho_predominante",
]);

const FOTOS_MAX = 6;

// ─── Checklist "Postura / Organização do Trabalho" ───────────────────────────

function LinhaTristate({ label }: { label: string }) {
  return (
    <tr>
      <td>{label}</td>
      {RESPOSTAS_CHECKLIST.map((r) => (
        <td key={r} className="fb-check"><FbCaixa /></td>
      ))}
    </tr>
  );
}

function LinhaSubsecao({ titulo }: { titulo: string }) {
  return (
    <tr>
      <td colSpan={RESPOSTAS_CHECKLIST.length + 1} style={{ background: "#eef7f2", color: "#1e4d28", fontWeight: 700, fontSize: "8.5px", textTransform: "uppercase", letterSpacing: ".04em" }}>
        {titulo}
      </td>
    </tr>
  );
}

function ChecklistPostura({
  perguntas,
  selects,
}: {
  perguntas: AetChecklistPergunta[];
  selects: AetOwasSelectCampo[];
}) {
  const label = (slug: string) =>
    perguntas.find((p) => p.slug === slug)?.label ??
    CHECKLIST_PERGUNTAS_PADRAO.find((p) => p.slug === slug)?.label ?? "";
  const oculta = (slug: string) => perguntaOculta(perguntas, slug);
  const customDaSecao = (secao: string) =>
    perguntas
      .filter((p) => p.secao === secao && !SLUGS_PADRAO.has(p.slug) && p.tipo === "tristate")
      .filter((p) => p.oculta !== true);
  const secaoTemLinha = (slugs: string[], secao: string) =>
    algumaVisivel(perguntas, slugs) || customDaSecao(secao).length > 0;

  const predominante = selects.find((s) => s.slug === "trabalho_predominante") ?? OWAS_SELECTS_PADRAO[0];

  return (
    <FbTabela>
      <thead>
        <tr>
          <th>Pergunta</th>
          {RESPOSTAS_CHECKLIST.map((r) => (
            <th key={r} className="fb-check">{r}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        <LinhaSubsecao titulo="Postura" />
        {!oculta("levantamento_acima_limite") && <LinhaTristate label={label("levantamento_acima_limite")} />}
        <tr>
          <td colSpan={RESPOSTAS_CHECKLIST.length + 1}>
            <div>{predominante.label}</div>
            <FbOpcoes opcoes={predominante.opcoes} />
          </td>
        </tr>
        {!oculta("pausas_descanso") && <LinhaTristate label={label("pausas_descanso")} />}
        {!oculta("uso_cadeira") && <LinhaTristate label={label("uso_cadeira")} />}
        {!oculta("cadeira_adequada") && <LinhaTristate label={label("cadeira_adequada")} />}
        {!oculta("monitor") && <LinhaTristate label={label("monitor")} />}
        {customDaSecao("Postura").map((p) => (
          <LinhaTristate key={p.slug} label={p.label} />
        ))}

        {secaoTemLinha(["exigencia_levantamento"], "Exigência de Tempo") && (
          <>
            <LinhaSubsecao titulo="Exigência de Tempo" />
            {!oculta("exigencia_levantamento") && <LinhaTristate label={label("exigencia_levantamento")} />}
            {customDaSecao("Exigência de Tempo").map((p) => (
              <LinhaTristate key={p.slug} label={p.label} />
            ))}
          </>
        )}

        {secaoTemLinha(["ritmo_por_demanda"], "Ritmo de Trabalho") && (
          <>
            <LinhaSubsecao titulo="Ritmo de Trabalho" />
            {!oculta("ritmo_por_demanda") && <LinhaTristate label={label("ritmo_por_demanda")} />}
            {customDaSecao("Ritmo de Trabalho").map((p) => (
              <LinhaTristate key={p.slug} label={p.label} />
            ))}
          </>
        )}

        {secaoTemLinha(["pausas_formais", "rodizios_sistematizados"], "Adoção de Rodízios - Ergonômico") && (
          <>
            <LinhaSubsecao titulo="Adoção de Rodízios — Ergonômico" />
            {!oculta("pausas_formais") && <LinhaTristate label={label("pausas_formais")} />}
            {!oculta("rodizios_sistematizados") && <LinhaTristate label={label("rodizios_sistematizados")} />}
            {customDaSecao("Adoção de Rodízios - Ergonômico").map((p) => (
              <LinhaTristate key={p.slug} label={p.label} />
            ))}
          </>
        )}

        {!oculta("organizacao_trabalho") && (
          <>
            <LinhaSubsecao titulo="Organização do Trabalho" />
            <tr>
              <td colSpan={RESPOSTAS_CHECKLIST.length + 1} style={{ color: "#374151" }}>
                {label("organizacao_trabalho")}
              </td>
            </tr>
          </>
        )}
      </tbody>
    </FbTabela>
  );
}

// ─── OWAS ─────────────────────────────────────────────────────────────────────

function OwasBlocos({ categorias }: { categorias: AetOwasCategoria[] }) {
  const visiveis = categorias.filter((c) => SLUG_TO_OWAS_FIELD[c.slug]);
  return (
    <div className="fb-bloco" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 14px" }}>
      {visiveis.map((cat) => (
        <div key={cat.id} className="fb-avoid">
          <div className="fb-campo-label" style={{ marginBottom: 2 }}>{cat.titulo}</div>
          <div style={{ display: "grid", gap: 1 }}>
            {cat.opcoes.map((o) => (
              <FbCaixa key={o.value} label={o.label} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── 13 Fatores Psicossociais ─────────────────────────────────────────────────

function FatoresPsi({
  fatores,
  perguntas,
  semaforo,
}: {
  fatores: Aet13FatorConfig[];
  perguntas: Aet13FatorPergunta[];
  semaforo: Aet13FatorSemaforo[];
}) {
  return (
    <>
      {fatores.map((fator) => {
        const isF13 = fator.codigo === "F13";
        const doFator = perguntas
          .filter((p) => p.codigo_fator === fator.codigo)
          .sort((a, b) => a.ordem - b.ordem);
        return (
          <Fragment key={fator.codigo}>
            <div className="fb-sub">{fator.codigo} — {fator.nome}</div>
            {doFator.length > 0 && (
              <FbTabela>
                <thead>
                  <tr>
                    <th>Pergunta</th>
                    {ESCALA.map((v) => (
                      <th key={v} className="fb-check" style={{ width: 52 }}>
                        {v}
                        <span className="fb-th-opcoes">{ESCALA_LABEL[v]}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {doFator.map((p) => (
                    <tr key={p.id}>
                      <td>{p.texto}</td>
                      {ESCALA.map((v) => (
                        <td key={v} className="fb-check"><FbCaixa /></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </FbTabela>
            )}
            <div className="fb-bloco fb-avoid">
              {isF13 ? (
                <FbOpcoes titulo="Classificação (baseada no PGR)" opcoes={semaforo.map((z) => z.label)} />
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 4 }}>
                  <FbCampo label="Média calculada" />
                  <FbCampo label="Zona" />
                </div>
              )}
              <FbLinhas n={2} label="Observação / Análise" />
            </div>
          </Fragment>
        );
      })}
    </>
  );
}

function SemaforoLegenda({ semaforo }: { semaforo: Aet13FatorSemaforo[] }) {
  const faixa = (z: Aet13FatorSemaforo) => {
    if (z.min_score != null && z.max_score != null) return `${z.min_score.toFixed(2)} a ${z.max_score.toFixed(2)}`;
    if (z.min_score != null) return `≥ ${z.min_score.toFixed(2)}`;
    if (z.max_score != null) return `≤ ${z.max_score.toFixed(2)}`;
    return "—";
  };
  return (
    <FbTabela>
      <thead>
        <tr>
          <th>Zona</th>
          <th>Média do fator</th>
          <th>Nível PGR</th>
          <th>Prazo</th>
        </tr>
      </thead>
      <tbody>
        {semaforo.map((z) => (
          <tr key={z.id}>
            <td style={{ background: z.cor_fundo, color: z.cor_texto, fontWeight: 700 }}>{z.label}</td>
            <td>{faixa(z)}</td>
            <td>{z.nivel_pgr}</td>
            <td>{z.prazo_texto}</td>
          </tr>
        ))}
      </tbody>
    </FbTabela>
  );
}

// ─── Bloco de um setor ────────────────────────────────────────────────────────

function BlocoSetor({
  indice,
  total,
  checklist,
  selects,
  owas,
  fatores,
  perguntasPsi,
  semaforo,
}: {
  indice: number;
  total: number;
  checklist: AetChecklistPergunta[];
  selects: AetOwasSelectCampo[];
  owas: AetOwasCategoria[];
  fatores: Aet13FatorConfig[];
  perguntasPsi: Aet13FatorPergunta[];
  semaforo: Aet13FatorSemaforo[];
}) {
  return (
    <FbSetor indice={indice} total={total}>
      <FbSecao numero={3} titulo="Identificação do setor">
        <FbCampos colunas={2}>
          <FbCampo label="Nome do setor" />
          <FbCampo label="Função" />
          <FbCampo label="Máquinas e equipamentos" span={2} />
        </FbCampos>
        <div className="fb-bloco" style={{ borderTop: 0 }}>
          <FbLinhas n={3} label="Descrição geral da atividade" />
        </div>

        <div className="fb-sub">Cargos do setor</div>
        <FbTabela>
          <thead>
            <tr>
              <th style={{ width: "28%" }}>Cargo</th>
              <th>Descrição</th>
              <th style={{ width: 60 }}>Qtd</th>
            </tr>
          </thead>
          <tbody>
            <FbLinhasVazias n={4} colunas={3} />
          </tbody>
        </FbTabela>
      </FbSecao>

      <FbSecao numero={4} titulo="Agentes / Riscos (Seção 9)">
        <FbTabela>
          <thead>
            <tr>
              <th style={{ width: "13%" }}>
                Tipo
                <span className="fb-th-opcoes">{TIPOS_RISCO.join(" · ")}</span>
              </th>
              <th>Risco</th>
              <th style={{ width: "11%" }}>Intensidade / Concentração</th>
              <th style={{ width: "12%" }}>Técnica / Metodologia</th>
              <th style={{ width: "9%" }}>EPI CA</th>
              <th style={{ width: "10%" }}>EPI eficaz</th>
              <th style={{ width: "14%" }}>
                Classificação
                <span className="fb-th-opcoes">{CLASSIFICACOES.join(" · ")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <FbLinhasVazias n={6} colunas={7} altura={26} />
          </tbody>
        </FbTabela>
      </FbSecao>

      <FbSecao numero={5} titulo={`Fotos do setor (máx. ${FOTOS_MAX})`} nota="Anote a referência de cada foto tirada em campo (nome do arquivo / número) e a legenda.">
        <FbTabela>
          <thead>
            <tr>
              <th style={{ width: 40 }}>Nº</th>
              <th style={{ width: "30%" }}>Referência da foto</th>
              <th>Legenda / o que mostra</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: FOTOS_MAX }, (_, i) => (
              <tr key={i}>
                <td className="fb-check">{i + 1}</td>
                <td style={{ height: 22 }} />
                <td />
              </tr>
            ))}
          </tbody>
        </FbTabela>
      </FbSecao>

      <FbSecao numero={6} titulo="OWAS — Análise de Posturas (Seção 13)" nota="Marque todas as posturas e faixas de esforço observadas no ciclo de trabalho (pode haver mais de uma por categoria).">
        <OwasBlocos categorias={owas} />
      </FbSecao>

      <FbSecao numero={7} titulo="Postura / Organização do Trabalho">
        <ChecklistPostura perguntas={checklist} selects={selects} />
      </FbSecao>

      <FbSecao numero={8} titulo="Parecer, Recomendações e Demais Condições">
        <div className="fb-bloco">
          <FbLinhas n={5} label="Parecer técnico" />
          <div style={{ height: 6 }} />
          <FbLinhas n={5} label="Recomendações" />
          <div style={{ height: 6 }} />
          <FbLinhas n={4} label="Demais condições avaliadas" />
        </div>
      </FbSecao>

      {fatores.length > 0 && (
        <FbSecao
          numero={9}
          titulo="13 Fatores Psicossociais (QPS)"
          nota={
            <>
              Para cada pergunta, marque a frequência de 1 (Nunca) a 5 (Sempre). A média e a zona de cada fator são
              calculadas pelo sistema ao digitar — o F13 é o único classificado à mão, pela zona do PGR.
            </>
          }
        >
          <FatoresPsi fatores={fatores} perguntas={perguntasPsi} semaforo={semaforo} />
        </FbSecao>
      )}
    </FbSetor>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function AetFormularioBrancoPage() {
  const [nSetores, setNSetores] = useState(1);

  const { data: checklistData } = useAetChecklistPerguntas();
  const { data: selectsData } = useAetOwasSelects();
  const { data: owasData } = useAetOwasConfig();
  const { data: fatoresData } = useAet13FatoresConfig();
  const { data: perguntasPsiData } = useAet13FatoresPerguntas();
  const { data: semaforoData } = useAet13FatoresSemaforo();

  const checklist = checklistData ?? CHECKLIST_PERGUNTAS_PADRAO;
  const selects = selectsData ?? OWAS_SELECTS_PADRAO;
  const owas = owasData ?? OWAS_CATEGORIAS_PADRAO;
  const fatores = fatoresData ?? FATORES_DEFAULT;
  const perguntasPsi =
    perguntasPsiData ??
    (PERGUNTAS_DEFAULT.map((p, i) => ({ ...p, id: String(i) })) as Aet13FatorPergunta[]);
  const semaforo = semaforoData ?? SEMAFORO_DEFAULT;

  return (
    <FormularioBrancoShell
      sigla="AET"
      titulo="Análise Ergonômica do Trabalho — Formulário em Branco"
      descricao="Versão impressa do questionário completo do laudo AET (dados gerais, aplicação do QPS, identificação do setor, agentes / riscos, fotos, OWAS, checklist de postura e organização, parecer e os 13 fatores psicossociais) para preenchimento manual em campo. As perguntas são as mesmas configuradas no sistema; cada setor sai em página própria."
      nSetores={nSetores}
      onNSetoresChange={setNSetores}
    >
      <FbSecao numero={1} titulo="Dados Gerais">
        <FbCampos colunas={2}>
          <FbCampo label="Razão social" />
          <FbCampo label="CNPJ" />
          <FbCampo label="Endereço da empresa" span={2} />
          <FbCampo label="Responsável pela elaboração" />
          <FbCampo label="Título profissional" />
          <FbCampo label="Registro profissional" />
          <FbCampo label="Data de elaboração" />
          <FbCampo label="Validade do documento" />
          <FbCampo label="Nº de setores avaliados" />
        </FbCampos>
      </FbSecao>

      <FbSecao numero={2} titulo="Dados da Aplicação QPS">
        <FbCampos colunas={2}>
          <FbCampo label="N.º de respondentes" />
          <FbCampo label="Total elegível" />
          <FbCampo label="Período — início" />
          <FbCampo label="Período — fim" />
          <FbCampo label="Técnico aplicador" span={2} />
        </FbCampos>
        <div className="fb-bloco" style={{ borderTop: 0 }}>
          <FbOpcoes titulo="Forma de coleta" opcoes={FORMAS_COLETA} />
          <FbLinhas n={3} label="Observação geral" />
        </div>
      </FbSecao>

      <FbSecao titulo="Como preencher">
        <div className="fb-bloco fb-avoid">
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: "9.5px", lineHeight: 1.45 }}>
            <li>Use um bloco de setor (seções 3 a 9) para cada setor avaliado. Imprima quantos precisar.</li>
            <li>Nos agentes / riscos, escreva o tipo e a classificação com os nomes listados no cabeçalho da tabela.</li>
            <li>No OWAS, marque todas as posturas observadas no ciclo — é seleção múltipla por categoria.</li>
            <li>No checklist, marque <strong>uma</strong> resposta por pergunta: Sim, Não ou N/A.</li>
            <li>
              No QPS, cada pergunta recebe uma frequência de 1 a 5. O sistema calcula a média e enquadra a zona pelo semáforo
              abaixo; anote a média só se quiser conferir em campo.
            </li>
          </ul>
        </div>
        <div className="fb-sub">Semáforo dos 13 fatores</div>
        <SemaforoLegenda semaforo={semaforo} />
      </FbSecao>

      {Array.from({ length: nSetores }, (_, i) => (
        <BlocoSetor
          key={i}
          indice={i + 1}
          total={nSetores}
          checklist={checklist}
          selects={selects}
          owas={owas}
          fatores={fatores}
          perguntasPsi={perguntasPsi}
          semaforo={semaforo}
        />
      ))}

      <FbSecao numero={10} titulo="Considerações Finais" className="fb-setor">
        <div className="fb-bloco">
          <FbLinhas n={10} />
        </div>
        <FbAssinatura papel="Responsável pela elaboração" />
      </FbSecao>
    </FormularioBrancoShell>
  );
}
