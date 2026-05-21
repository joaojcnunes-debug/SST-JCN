"use client";

import { use } from "react";
import { Loader2, Printer, Save } from "lucide-react";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import {
  useAetRelatorio,
  useSalvarAet,
  useAetTextoPadrao,
  useAetChecklistPerguntas,
  useAetOwasConfig,
  CHECKLIST_PERGUNTAS_PADRAO,
  SLUG_TO_DEFAULT_IMAGE,
  SLUG_TO_OWAS_FIELD,
} from "@/lib/hooks/useAet";
import { useCanEdit } from "@/lib/hooks/useUsuario";
import RichTextEditor from "@/components/drps/RichTextEditor";
import { cn } from "@/lib/utils";
import type {
  AetSetor,
  AetTextoPadraoCapitulo,
  AetChecklistPergunta,
  AetOwasCategoria,
  ClassificacaoRiscoAET,
} from "@/lib/supabase/types";
import type { CaixaTexto } from "@/lib/drps/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const CLASS_COLOR: Record<ClassificacaoRiscoAET, string> = {
  Trivial: "bg-green-100 text-green-800",
  "De Atenção": "bg-yellow-100 text-yellow-800",
  Moderado: "bg-orange-100 text-orange-800",
  Alto: "bg-red-100 text-red-800",
  Crítico: "bg-red-200 text-red-900",
};

const OWAS_ROWS: {
  label: string;
  field: keyof Pick<AetSetor["owas"], "posturas_costas" | "posturas_bracos" | "posturas_pernas" | "esforco">;
  opcoes: Record<number, string>;
}[] = [
  {
    label: "Costas",
    field: "posturas_costas",
    opcoes: { 1: "1 – Ereta", 2: "2 – Inclinada", 3: "3 – Ereta e Torcida", 4: "4 – Inclinada e Torcida" },
  },
  {
    label: "Braços",
    field: "posturas_bracos",
    opcoes: {
      1: "1 – Os dois braços abaixo dos ombros",
      2: "2 – Um braço no nível ou acima dos ombros",
      3: "3 – Ambos braços no nível ou acima dos ombros",
    },
  },
  {
    label: "Pernas",
    field: "posturas_pernas",
    opcoes: {
      1: "1 – Sentado",
      2: "2 – De pé, ambas as pernas esticadas",
      3: "3 – De pé, peso em uma perna",
      4: "4 – De pé / agachado, ambos joelhos",
      5: "5 – De pé / agachado, um joelho",
      6: "6 – Ajoelhado",
      7: "7 – Andando ou se movendo",
    },
  },
  {
    label: "Esforço",
    field: "esforco",
    opcoes: { 1: "1 – Carga ≤ 10 kg", 2: "2 – Carga > 10 kg e ≤ 20 kg", 3: "3 – Carga > 20 kg" },
  },
];

const SLUGS_PADRAO = new Set([
  "levantamento_acima_limite", "trabalho_predominante", "pausas_descanso",
  "uso_cadeira", "cadeira_adequada", "monitor", "organizacao_trabalho",
  "exigencia_levantamento", "ritmo_por_demanda", "pausas_formais", "rodizios_sistematizados",
]);

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AetLaudoPage({
  params,
}: {
  params: Promise<{ idRelatorio: string }>;
}) {
  const { idRelatorio } = use(params);
  const { data: rel, isLoading } = useAetRelatorio(idRelatorio);
  const salvar = useSalvarAet();
  const canEdit = useCanEdit();
  const [consideracoes, setConsideracoes] = useState("");

  const { data: capitulos = [] } = useAetTextoPadrao();
  const { data: checklistPerguntas = [] } = useAetChecklistPerguntas();
  const { data: owasConfig = [] } = useAetOwasConfig();

  useEffect(() => {
    if (rel) setConsideracoes(rel.consideracoes_finais ?? "");
  }, [rel]);

  function handleSaveConsideracoes() {
    salvar.mutate(
      { id: idRelatorio, patch: { consideracoes_finais: consideracoes } },
      {
        onSuccess: () => toast.success("Considerações salvas"),
        onError: (e: Error) => toast.error(e.message),
      }
    );
  }

  if (isLoading || !rel) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const dataFormatada = rel.data_elaboracao
    ? new Date(rel.data_elaboracao + "T00:00:00").toLocaleDateString("pt-BR")
    : "—";
  const empresa = rel.empresas;

  const capitulosInicio = capitulos.filter((c) => !c.posicao_pdf || c.posicao_pdf === "inicio");
  const capitulosAposSumario = capitulos.filter((c) => c.posicao_pdf === "apos_sumario");
  const capitulosAposSetores = capitulos.filter((c) => c.posicao_pdf === "apos_setores");

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-lg font-semibold text-gray-900">Laudo / Imprimir</h1>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent"
        >
          <Printer className="size-4" /> Imprimir
        </button>
      </div>

      {/* ═══ DOCUMENTO ═══ */}
      <div
        id="laudo-aet"
        className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none"
      >
        {/* Topo */}
        <div className="mb-6 flex items-center justify-between border-b border-gray-300 pb-3">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
            Chabra Saúde e Segurança do Trabalho
          </span>
          <span className="text-[10px] text-gray-400">{dataFormatada}</span>
        </div>

        {/* Capa */}
        <div className="mb-10 space-y-2 text-center">
          <p className="text-base font-bold uppercase tracking-widest text-gray-800">
            Laudo de Avaliação Ergonômica
          </p>
          <p className="text-sm font-bold uppercase tracking-wider text-gray-700">
            AET — Análise Ergonômica do Trabalho
          </p>
          <p className="text-[10px] text-gray-500">
            Portaria 3.214/78 — Norma Regulamentadora n.º 17
          </p>
        </div>

        {/* Capítulos inicio */}
        {capitulosInicio.map((cap) => (
          <CapituloLaudo key={cap.id_capitulo} cap={cap} />
        ))}

        {/* Capítulos apos_sumario ou fallback 2–8 */}
        {capitulosAposSumario.length > 0 ? (
          capitulosAposSumario.map((cap) => <CapituloLaudo key={cap.id_capitulo} cap={cap} />)
        ) : (
          <>
            <Section num="2" title="Introdução Geral">
              <p className="text-xs leading-relaxed text-gray-700">
                A ergonomia estuda a adaptação do trabalho ao homem. Envolve tanto o ambiente físico como os aspectos
                organizacionais e cognitivos. A ergonomia abrange atividades de planejamento e projeto, que ocorre antes
                do trabalho ser realizado, e aqueles de controle e avaliação, que ocorrem durante e após o trabalho.
              </p>
            </Section>
            <Section num="3" title="Objetivo">
              <p className="text-xs leading-relaxed text-gray-700">
                Este estudo tem como objetivo avaliar os postos de trabalho da empresa especificada, promovendo análise
                ergonômica das atividades e funções, sendo adotados métodos de análise aplicados para fins ergonômicos.
              </p>
              <p className="text-xs font-semibold text-gray-700">
                BASE LEGAL: Portaria 3.214/78 do Ministério do Trabalho – NR-17
              </p>
            </Section>
            <Section num="4" title="Metodologia">
              <p className="text-xs leading-relaxed text-gray-700">
                Durante o trabalho realizado, foram avaliadas todas as funções conforme sugerido pela Metodologia da
                AET. A metodologia utiliza-se de observações da situação de trabalho, análise da tarefa, entrevistas e
                verbalizações com os diferentes níveis hierárquicos, buscando compreender em detalhes as atividades nas
                suas diferentes dimensões (física, cognitiva, mental e social).
              </p>
            </Section>
            <Section num="5" title="Levantamento, Transporte e Descarga Individual de Materiais">
              <p className="text-xs leading-relaxed text-gray-700">
                Deverão ser executados de forma que o esforço físico realizado pelo trabalhador seja compatível com sua
                capacidade de força e não comprometa a sua saúde ou segurança. Para manipulações ocasionais, o limite
                de 25 kg para homens e 15 kg para mulheres é sugerido, desde que observadas boas práticas para a
                manipulação.
              </p>
            </Section>
            <Section num="6" title="Mobiliário dos Postos de Trabalho">
              <ul className="ml-4 list-disc space-y-0.5 text-xs text-gray-700">
                <li>Sempre que possível o trabalho deve ser executado na posição sentada;</li>
                <li>O mobiliário deve prover condições dentro da zona de conforto dos segmentos corporais;</li>
                <li>Os comandos sejam de fácil acionamento;</li>
                <li>Os assentos sejam adequados.</li>
              </ul>
            </Section>
            <Section num="7" title="Equipamentos dos Postos de Trabalho">
              <p className="text-xs leading-relaxed text-gray-700">
                O mobiliário/equipamentos devem prover condições para que o trabalho seja executado dentro da zona de
                conforto dos segmentos corporais, em boa condição postural e livre de reflexos.
              </p>
            </Section>
            <Section num="8" title="Condições Ambientais de Trabalho">
              <p className="text-xs leading-relaxed text-gray-700">
                O estudo da exposição ocupacional dos trabalhadores aos agentes ambientais está contemplado no Programa
                de Gerenciamento de Riscos – PGR da empresa.
              </p>
            </Section>
          </>
        )}

        {/* ── Seção 9 — Agentes por setor ── */}
        {rel.setores.length > 0 && (
          <Section num="9" title="Agentes Ambientais para as Áreas Operacionais">
            <div className="space-y-5">
              {rel.setores.map((setor, idx) => (
                <SetorRiscosBlock key={setor.id} setor={setor} idx={idx} />
              ))}
            </div>
          </Section>
        )}

        {/* ── Seção 13 — Análise por setor ── */}
        {rel.setores.length > 0 && (
          <Section num="13" title="Análises Ergonômicas do Trabalho">
            <div className="space-y-8">
              {rel.setores.map((setor, idx) => (
                <SetorAnaliseBlock
                  key={setor.id}
                  setor={setor}
                  idx={idx}
                  checklistPerguntas={checklistPerguntas}
                  owasConfig={owasConfig}
                />
              ))}
            </div>
          </Section>
        )}

        {/* Capítulos apos_setores ou fallback 10–12 */}
        {capitulosAposSetores.length > 0 ? (
          capitulosAposSetores.map((cap) => <CapituloLaudo key={cap.id_capitulo} cap={cap} />)
        ) : (
          <>
            <Section num="10" title="Conforto em Áreas Administrativas">
              <p className="text-xs leading-relaxed text-gray-700">
                A temperatura efetiva foi avaliada utilizando um termo higrômetro eletrônico. Foram considerados os
                limites: temperatura efetiva entre 20 a 23 ºC (NR-17, item 17.5.2.1.b), velocidade do ar não superior
                a 0,75 m/s (item 17.5.2.1.c) e umidade relativa mínima de 40% (item 17.5.2.1.d).
              </p>
            </Section>
            <Section num="11" title="Organização do Trabalho">
              <p className="mb-1 text-xs text-gray-700">Na análise foram levados em consideração:</p>
              <ul className="ml-4 list-[lower-alpha] space-y-0.5 text-xs text-gray-700">
                {[
                  "as normas de produção",
                  "o modo operatório",
                  "a exigência de tempo",
                  "a determinação do conteúdo de tempo",
                  "o ritmo de trabalho",
                  "o conteúdo das tarefas",
                  "horário de trabalho",
                ].map((item) => (
                  <li key={item}>{item};</li>
                ))}
              </ul>
            </Section>
            <Section num="12" title="Ferramentas Biomecânicas Aplicadas">
              <p className="text-xs leading-relaxed text-gray-700">
                <strong>Método OWAS</strong> (Ovako Working Posture Analysing System) — desenvolvido na Finlândia por
                Karhu, Kansi e Kuorinka (1974–1978), juntamente com o Instituto Finlandês de Saúde Ocupacional.
                Objetiva gerar informações para melhorar os métodos de trabalho por meio da identificação de posturas
                corporais prejudiciais durante a realização das atividades.
              </p>
            </Section>
          </>
        )}

        {/* ── Seção 14 — Considerações Finais ── */}
        <Section num="14" title="Considerações Finais">
          <div className="print:hidden">
            <RichTextEditor
              value={consideracoes}
              onChange={setConsideracoes}
              readOnly={!canEdit}
              uploadPathPrefix="aet-consideracoes"
              placeholder="Considerações finais do laudo AET..."
            />
            {canEdit && (
              <button
                type="button"
                onClick={handleSaveConsideracoes}
                disabled={salvar.isPending}
                className="mt-2 inline-flex items-center gap-1 rounded-md bg-verde-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-verde-accent disabled:opacity-50"
              >
                {salvar.isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
                Salvar
              </button>
            )}
          </div>
          <div
            className="tiptap-conteudo prose prose-sm hidden max-w-none text-xs leading-relaxed text-gray-700 print:block"
            dangerouslySetInnerHTML={{
              __html:
                consideracoes ||
                "<p>A preocupação dos setores avaliados em obter para seus colaboradores o conhecimento ergonômico e investir em qualidade de trabalho é fundamental para a busca por melhor produtividade com saúde e qualidade no trabalho.</p>",
            }}
          />
        </Section>

        {/* Assinatura */}
        <div className="mt-14 border-t border-gray-200 pt-8">
          <div className="flex items-start justify-around gap-8 text-center text-xs text-gray-600">
            <div className="flex-1">
              <div className="mx-auto mb-2 w-56 border-t border-gray-400" />
              <p className="text-gray-600">Assinatura do Responsável pela Empresa</p>
            </div>
            <div className="flex-1">
              <div className="mx-auto mb-2 w-56 border-t border-gray-400" />
              <p className="font-semibold text-gray-800">{rel.responsavel_elaboracao || "Responsável Técnico"}</p>
              {rel.titulo_profissional && <p className="text-gray-600">{rel.titulo_profissional}</p>}
              {rel.registro_profissional && (
                <p className="text-gray-500">Registro: {rel.registro_profissional}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Layout helpers ───────────────────────────────────────────────────────────

function Section({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <div className="mb-3 border-b-2 border-gray-700 pb-1">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-700">
          {num ? `${num} — ${title}` : title}
        </h2>
      </div>
      <div>{children}</div>
    </div>
  );
}

function RichBlock({ html }: { html: string }) {
  return (
    <div
      className="prose prose-xs max-w-none text-xs leading-relaxed text-gray-700 [&_a]:text-gray-700 [&_a]:no-underline [&_p]:my-1"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function CapituloLaudo({ cap }: { cap: AetTextoPadraoCapitulo }) {
  if (cap.bg_imagem_url) {
    return (
      <div
        className="relative mb-6 overflow-hidden rounded-lg border border-gray-200 print:break-before-page print:rounded-none print:border-0"
        style={{
          backgroundImage: `url(${cap.bg_imagem_url})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          minHeight: "480px",
        }}
      >
        {(cap.caixas_texto ?? []).map((caixa: CaixaTexto) => (
          <div
            key={caixa.id}
            style={{
              position: "absolute",
              left: `${caixa.x}%`,
              top: `${caixa.y}%`,
              width: `${caixa.w ?? 40}%`,
              fontSize: `${caixa.fontSize ?? 14}px`,
              fontWeight: caixa.bold ? "bold" : "normal",
              color: caixa.color ?? "#ffffff",
              textAlign: caixa.align ?? "left",
              whiteSpace: "pre-wrap",
            }}
          >
            {caixa.conteudo}
          </div>
        ))}
      </div>
    );
  }
  return (
    <Section num="" title={cap.titulo}>
      {cap.conteudo && <RichBlock html={cap.conteudo} />}
    </Section>
  );
}

// ─── Seção 9 — Agentes Ambientais ────────────────────────────────────────────

function SetorRiscosBlock({ setor, idx }: { setor: AetSetor; idx: number }) {
  return (
    <div className="overflow-hidden rounded border border-gray-300">
      {/* Header */}
      <div className="bg-gray-700 px-4 py-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-white">
          Setor {idx + 1}: {setor.nome_setor || "—"}
        </p>
        {setor.cargos.length > 0 && (
          <p className="text-[10px] text-gray-300">
            {setor.cargos.map((c) => c.nome).filter(Boolean).join(" · ")}
          </p>
        )}
      </div>

      {/* Info do setor */}
      <table className="w-full border-collapse text-xs">
        <tbody>
          {setor.maquinas_equipamentos && (
            <tr className="border-b border-gray-100">
              <td className="w-44 bg-gray-50 px-3 py-1.5 font-semibold text-gray-600">
                Máquinas e Equipamentos
              </td>
              <td className="px-3 py-1.5 text-gray-700">
                {setor.maquinas_equipamentos.split("\n").filter(Boolean).join(" · ")}
              </td>
            </tr>
          )}
          {setor.descricao_atividade && (
            <tr className="border-b border-gray-100">
              <td className="w-44 bg-gray-50 px-3 py-1.5 font-semibold text-gray-600">
                Descrição da Atividade
              </td>
              <td className="px-3 py-1.5 text-gray-700">{setor.descricao_atividade}</td>
            </tr>
          )}
          {setor.cargos
            .filter((c) => c.descricao)
            .map((cargo, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="w-44 bg-gray-50 px-3 py-1.5 font-semibold text-gray-600">{cargo.nome}</td>
                <td className="px-3 py-1.5 text-gray-700">{cargo.descricao}</td>
              </tr>
            ))}
        </tbody>
      </table>

      {/* Tabela de riscos */}
      {setor.riscos.length > 0 && (
        <table className="w-full border-collapse border-t border-gray-200 text-xs">
          <thead>
            <tr className="bg-gray-100">
              {[
                "Tipo",
                "Agente / Risco",
                "Intensidade / Conc.",
                "Técnica / Metodologia",
                "EPI (CA)",
                "EPI Eficaz",
                "Classificação",
              ].map((h) => (
                <th
                  key={h}
                  className="border border-gray-200 px-2 py-1.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-600"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {setor.riscos.map((r) => (
              <tr key={r.id} className="even:bg-gray-50">
                <td className="border border-gray-100 px-2 py-1 text-gray-700">{r.tipo}</td>
                <td className="border border-gray-100 px-2 py-1 text-gray-700">{r.risco}</td>
                <td className="border border-gray-100 px-2 py-1 text-gray-700">{r.intensidade_concentracao}</td>
                <td className="border border-gray-100 px-2 py-1 text-gray-700">{r.tecnica_metodologia}</td>
                <td className="border border-gray-100 px-2 py-1 text-gray-700">{r.epi_ca}</td>
                <td className="border border-gray-100 px-2 py-1 text-gray-700">{r.epi_eficaz}</td>
                <td
                  className={cn(
                    "border border-gray-100 px-2 py-1 text-center text-[10px] font-bold",
                    CLASS_COLOR[r.classificacao_risco]
                  )}
                >
                  {r.classificacao_risco}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {setor.riscos.length === 0 && (
        <p className="px-3 py-2 text-xs italic text-gray-400">Nenhum agente / risco identificado neste setor.</p>
      )}
    </div>
  );
}

// ─── Seção 13 — Análise Ergonômica ───────────────────────────────────────────

function SetorAnaliseBlock({
  setor,
  idx,
  checklistPerguntas,
  owasConfig,
}: {
  setor: AetSetor;
  idx: number;
  checklistPerguntas: AetChecklistPergunta[];
  owasConfig: AetOwasCategoria[];
}) {
  const { owas, checklist } = setor;

  const pergunta = (slug: string) =>
    checklistPerguntas.find((p) => p.slug === slug)?.label ??
    CHECKLIST_PERGUNTAS_PADRAO.find((p) => p.slug === slug)?.label ??
    slug;

  const temOwas =
    owasConfig.length > 0
      ? owasConfig.some((cat) => {
          const field = SLUG_TO_OWAS_FIELD[cat.slug];
          return field && (owas[field] ?? []).length > 0;
        })
      : OWAS_ROWS.some((r) => (owas[r.field] ?? []).length > 0);

  const customExtras = Object.entries(setor.respostas_extras ?? {}).filter(
    ([slug]) => !SLUGS_PADRAO.has(slug)
  );

  const extrasDeSecao = (secao: string) =>
    customExtras.filter(
      ([slug]) => checklistPerguntas.find((p) => p.slug === slug)?.secao === secao
    );

  const extrasAdocao = customExtras.filter(([slug]) =>
    (checklistPerguntas.find((p) => p.slug === slug)?.secao ?? "").startsWith("Adoção")
  );

  const extrasSemSecao = customExtras.filter(([slug]) => {
    const secao = checklistPerguntas.find((p) => p.slug === slug)?.secao ?? "";
    return (
      secao !== "Postura" &&
      secao !== "Exigência de Tempo" &&
      secao !== "Ritmo de Trabalho" &&
      !secao.startsWith("Adoção") &&
      secao !== "Organização do Trabalho"
    );
  });

  return (
    <div className="overflow-hidden rounded border border-gray-300">
      {/* Header */}
      <div className="bg-gray-700 px-4 py-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-white">
          Setor {idx + 1}: {setor.nome_setor || "—"}
        </p>
        {setor.cargos.length > 0 && (
          <p className="text-[10px] text-gray-300">
            {setor.cargos.map((c) => c.nome).filter(Boolean).join(" · ")}
          </p>
        )}
      </div>

      <div className="divide-y divide-gray-100">

        {/* Descrição geral + cargos */}
        {(setor.descricao_atividade || setor.cargos.some((c) => c.descricao)) && (
          <div className="px-4 py-3">
            {setor.descricao_atividade && (
              <p className="mb-1 text-xs" style={{ color: "#374151" }}>
                <strong style={{ color: "#1f2937" }}>Atividade geral:</strong>{" "}
                {setor.descricao_atividade}
              </p>
            )}
            {setor.cargos
              .filter((c) => c.descricao)
              .map((cargo, i) => (
                <p key={i} className="text-xs" style={{ color: "#374151" }}>
                  <strong style={{ color: "#1f2937" }}>{cargo.nome}:</strong> {cargo.descricao}
                </p>
              ))}
          </div>
        )}

        {/* OWAS — cards idênticos ao setores/page.tsx */}
        {temOwas && (
          <div className="px-4 py-3">
            <p
              className="mb-2 text-[10px] font-bold uppercase tracking-wider"
              style={{ color: "#9ca3af" }}
            >
              OWAS — Análise de Posturas
            </p>
            <div className="grid grid-cols-2 gap-3">
              {owasConfig.map((cat) => {
                const field = SLUG_TO_OWAS_FIELD[cat.slug];
                if (!field) return null;
                const selected = (owas[field] ?? []) as number[];
                const imageSrc = cat.imagem_url ?? SLUG_TO_DEFAULT_IMAGE[cat.slug];
                return (
                  <div key={cat.id} className="rounded-md border border-gray-200 bg-gray-50 p-3">
                    <h4
                      className="mb-2 text-[11px] font-bold uppercase tracking-wider"
                      style={{ color: "#6b7280" }}
                    >
                      {cat.titulo}
                    </h4>
                    <div className="flex gap-3">
                      <div className="flex-1 space-y-1.5">
                        {cat.opcoes.map((opt) => {
                          const checked = selected.includes(opt.value);
                          return (
                            <div key={opt.value} className="flex items-start gap-2">
                              <span
                                className={cn(
                                  "mt-0.5 inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border",
                                  checked
                                    ? "border-gray-700 bg-gray-700"
                                    : "border-gray-300 bg-white"
                                )}
                              >
                                {checked && (
                                  <svg
                                    viewBox="0 0 10 8"
                                    className="h-2 w-2"
                                    fill="none"
                                    stroke="white"
                                    strokeWidth="1.8"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <path d="M1 4l2.5 2.5L9 1" />
                                  </svg>
                                )}
                              </span>
                              <span
                                className="text-xs leading-snug"
                                style={{ color: checked ? "#111827" : "#9ca3af" }}
                              >
                                {opt.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      {imageSrc && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <div className="w-32 shrink-0 self-start">
                          <img
                            src={imageSrc}
                            alt={`Referência OWAS: ${cat.titulo}`}
                            className="h-auto w-full rounded border border-gray-200"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Checklist — layout idêntico ao da página de setores */}
        <div className="px-4 py-3">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-2.5">
            <p
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: "#6b7280" }}
            >
              Checklist Ergonômico
            </p>

            {/* Postura */}
            <CheckSep title="Postura" />
            <CheckRow label={pergunta("levantamento_acima_limite")} value={checklist.levantamento_acima_limite} />
            <CheckSelect label={pergunta("trabalho_predominante")} value={checklist.trabalho_predominante} />
            <CheckRow label={pergunta("pausas_descanso")} value={checklist.pausas_descanso} />
            <CheckRow label={pergunta("uso_cadeira")} value={checklist.uso_cadeira} />
            <CheckRow label={pergunta("cadeira_adequada")} value={checklist.cadeira_adequada} />
            <CheckRow label={pergunta("monitor")} value={checklist.monitor} />
            {extrasDeSecao("Postura").map(([slug, val]) => (
              <CheckRow
                key={slug}
                label={checklistPerguntas.find((p) => p.slug === slug)?.label ?? slug}
                value={val}
              />
            ))}

            {/* Exigência de Tempo */}
            <CheckSep title="Exigência de Tempo" />
            <CheckRow label={pergunta("exigencia_levantamento")} value={checklist.exigencia_levantamento} />
            {extrasDeSecao("Exigência de Tempo").map(([slug, val]) => (
              <CheckRow
                key={slug}
                label={checklistPerguntas.find((p) => p.slug === slug)?.label ?? slug}
                value={val}
              />
            ))}

            {/* Ritmo de Trabalho */}
            <CheckSep title="Ritmo de Trabalho" />
            <CheckRow label={pergunta("ritmo_por_demanda")} value={checklist.ritmo_por_demanda} />
            {extrasDeSecao("Ritmo de Trabalho").map(([slug, val]) => (
              <CheckRow
                key={slug}
                label={checklistPerguntas.find((p) => p.slug === slug)?.label ?? slug}
                value={val}
              />
            ))}

            {/* Adoção de Rodízios */}
            <CheckSep title="Adoção de Rodízios — Ergonômico" />
            <CheckRow label={pergunta("pausas_formais")} value={checklist.pausas_formais} />
            <CheckRow label={pergunta("rodizios_sistematizados")} value={checklist.rodizios_sistematizados} />
            {extrasAdocao.map(([slug, val]) => (
              <CheckRow
                key={slug}
                label={checklistPerguntas.find((p) => p.slug === slug)?.label ?? slug}
                value={val}
              />
            ))}

            {/* Organização do Trabalho */}
            <CheckSep title="Organização do Trabalho" />
            <p className="text-xs italic leading-relaxed" style={{ color: "#4b5563" }}>
              {pergunta("organizacao_trabalho")}
            </p>

            {/* Perguntas adicionais */}
            {extrasSemSecao.length > 0 && (
              <>
                <CheckSep title="Perguntas Adicionais" />
                {extrasSemSecao.map(([slug, val]) => (
                  <CheckRow
                    key={slug}
                    label={checklistPerguntas.find((p) => p.slug === slug)?.label ?? slug}
                    value={val}
                  />
                ))}
              </>
            )}
          </div>
        </div>

        {/* Fotos */}
        {(setor.fotos ?? []).length > 0 && (
          <div className="px-4 py-3">
            <p
              className="mb-2 text-[10px] font-bold uppercase tracking-wider"
              style={{ color: "#9ca3af" }}
            >
              Registros Fotográficos
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(setor.fotos ?? []).slice(0, 6).map((url, i) => (
                <div
                  key={i}
                  className="relative aspect-video overflow-hidden rounded-md border border-gray-200"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Foto ${i + 1}`}
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute bottom-1 left-1 rounded bg-black/40 px-1 text-[10px] text-white">
                    {i + 1}/{(setor.fotos ?? []).length}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Parecer Técnico */}
        {setor.parecer_tecnico && (
          <div className="px-4 py-3">
            <p
              className="mb-1.5 text-[10px] font-bold uppercase tracking-wider"
              style={{ color: "#9ca3af" }}
            >
              Parecer Técnico
            </p>
            <RichBlock html={setor.parecer_tecnico} />
          </div>
        )}

        {/* Recomendações */}
        {setor.recomendacoes && (
          <div className="px-4 py-3">
            <p
              className="mb-1.5 text-[10px] font-bold uppercase tracking-wider"
              style={{ color: "#9ca3af" }}
            >
              Recomendações
            </p>
            <RichBlock html={setor.recomendacoes} />
          </div>
        )}

        {/* Demais Condições */}
        {setor.demais_condicoes && (
          <div className="px-4 py-3">
            <p
              className="mb-1.5 text-[10px] font-bold uppercase tracking-wider"
              style={{ color: "#9ca3af" }}
            >
              Demais Condições Avaliadas
            </p>
            <RichBlock html={setor.demais_condicoes} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Checklist row helpers (layout idêntico ao setores/page.tsx) ──────────────

function CheckSep({ title }: { title: string }) {
  return (
    <div className="border-t border-gray-200 pt-2.5 first:border-t-0 first:pt-0">
      <p
        className="mb-1.5 text-[10px] font-bold uppercase tracking-wider"
        style={{ color: "#9ca3af" }}
      >
        {title}
      </p>
    </div>
  );
}

function CheckRow({ label, value }: { label: string; value: string }) {
  const isSim = value === "sim";
  const isNa = value === "nao_aplica";
  const texto = isSim ? "Sim" : isNa ? "N/A" : "Não";
  return (
    <div className="flex items-center gap-2">
      <span className="flex-1 text-xs leading-snug" style={{ color: "#374151" }}>
        {label}
      </span>
      <span
        className={cn(
          "shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold",
          isSim
            ? "bg-gray-800 text-white"
            : "bg-white ring-1 ring-gray-200"
        )}
        style={!isSim ? { color: "#9ca3af" } : undefined}
      >
        {texto}
      </span>
    </div>
  );
}

function CheckSelect({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex-1 text-xs leading-snug" style={{ color: "#374151" }}>
        {label}
      </span>
      <span
        className="shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold bg-gray-800 text-white"
      >
        {value || "—"}
      </span>
    </div>
  );
}
