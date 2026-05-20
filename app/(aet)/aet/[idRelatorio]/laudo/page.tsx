"use client";

import { use } from "react";
import { Loader2, Printer, Save } from "lucide-react";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { useAetRelatorio, useSalvarAet } from "@/lib/hooks/useAet";
import { useCanEdit } from "@/lib/hooks/useUsuario";
import RichTextEditor from "@/components/drps/RichTextEditor";
import { cn } from "@/lib/utils";
import type { AetSetor, ClassificacaoRiscoAET } from "@/lib/supabase/types";

const CLASS_COLOR: Record<ClassificacaoRiscoAET, string> = {
  Trivial: "bg-green-100 text-green-800",
  "De Atenção": "bg-yellow-100 text-yellow-800",
  Moderado: "bg-orange-100 text-orange-800",
  Alto: "bg-red-100 text-red-800",
  Crítico: "bg-red-200 text-red-900",
};

const OWAS_COSTAS: Record<number, string> = {
  1: "Ereta", 2: "Inclinada", 3: "Ereta e Torcida", 4: "Inclinada e Torcida",
};
const OWAS_BRACOS: Record<number, string> = {
  1: "Os dois braços abaixo dos ombros",
  2: "Um braço no nível ou acima dos ombros",
  3: "Ambos braços no nível ou acima dos ombros",
};
const OWAS_PERNAS: Record<number, string> = {
  1: "Sentado", 2: "De pé com ambas as pernas esticadas",
  3: "De pé com peso de uma perna", 4: "De pé/agachado ambos joelhos",
  5: "De pé/agachado um joelho", 6: "Ajoelhado", 7: "Andando ou se movendo",
};
const OWAS_ESFORCO: Record<number, string> = {
  1: "Carga ≤ 10 kg", 2: "Carga > 10 kg e ≤ 20 kg", 3: "Carga > 20 kg",
};

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
  const cidade = "";

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {/* Toolbar - não imprime */}
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

      {/* ═══ LAUDO IMPRIMÍVEL ═══ */}
      <div id="laudo-aet" className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">

        {/* Cabeçalho */}
        <div className="mb-8 flex items-start justify-between border-b pb-4 print:mb-6">
          <div className="text-xs text-gray-500">Chabra Saúde e Segurança do Trabalho</div>
        </div>

        {/* Capa */}
        <div className="mb-10 text-center space-y-3">
          <p className="text-sm font-bold">LAUDO DE AVALIAÇÃO ERGONÔMICA</p>
          <p className="text-sm font-bold">AET – ANÁLISE ERGONÔMICA DO TRABALHO</p>
          <p className="text-xs text-gray-600">Portaria 3.214/78 - Norma Regulamentadora - 17</p>
          <div className="mt-6 space-y-1 text-sm">
            <p><strong>EMPRESA:</strong> {empresa?.nome_empresa ?? "—"}</p>
            <p><strong>CNPJ:</strong> {empresa?.cnpj ?? "—"}</p>
            {rel.setores.length > 0 && (
              <p><strong>SETOR(ES):</strong> {rel.setores.map((s) => s.nome_setor).filter(Boolean).join(", ") || "—"}</p>
            )}
            <p><strong>DATA:</strong> {dataFormatada}</p>
          </div>
        </div>

        {/* 1 – Caracterização */}
        <Section num="1" title="CARACTERIZAÇÃO DA EMPRESA AVALIADA">
          <table className="w-full text-xs border-collapse">
            <tbody>
              {[
                ["Razão Social", empresa?.nome_empresa ?? "—"],
                ["CNPJ", empresa?.cnpj ?? "—"],
                ["CNPJ", empresa?.cnpj ?? rel.empresas?.cnpj ?? "—"],
                ["Responsável pela Elaboração", rel.responsavel_elaboracao || "—"],
                ["Título Profissional", rel.titulo_profissional || "—"],
                ["Registro Profissional", rel.registro_profissional || "—"],
                ["Data da elaboração", dataFormatada],
              ].map(([k, v]) => (
                <tr key={k} className="border border-gray-300">
                  <td className="px-2 py-1 font-semibold w-48 bg-gray-50">{k}:</td>
                  <td className="px-2 py-1">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section num="2" title="INTRODUÇÃO GERAL">
          <p className="text-xs leading-relaxed text-gray-700">
            A ergonomia estuda a adaptação do trabalho ao homem. Envolve tanto o ambiente físico como os aspectos organizacionais e cognitivos. A ergonomia abrange atividades de planejamento e projeto, que ocorre antes do trabalho ser realizado, e aqueles de controle e avaliação, que ocorrem durante e após o trabalho.
          </p>
        </Section>

        <Section num="3" title="OBJETIVO">
          <p className="text-xs leading-relaxed text-gray-700">
            Este estudo tem como objetivo avaliar os postos de trabalho da empresa especificada, promovendo análise ergonômica das atividades e funções, sendo adotados métodos de análise aplicados para fins ergonômicos.
          </p>
          <p className="mt-1 text-xs font-medium text-gray-700">BASE LEGAL: Portaria 3.214/78 do Ministério do Trabalho – NR-17</p>
        </Section>

        <Section num="4" title="METODOLOGIA">
          <p className="text-xs leading-relaxed text-gray-700">
            Durante o trabalho realizado, foram avaliadas todas as funções conforme sugerido pela Metodologia da AET. A metodologia da AET utiliza-se de observações da situação de trabalho, análise da tarefa, entrevistas e verbalizações com os diferentes níveis hierárquicos, buscando compreender em detalhes as atividades nas suas diferentes dimensões (física, cognitiva, mental e social).
          </p>
        </Section>

        <Section num="5" title="LEVANTAMENTO, TRANSPORTE E DESCARGA INDIVIDUAL DE MATERIAIS">
          <p className="text-xs leading-relaxed text-gray-700">
            Deverão ser executados de forma que o esforço físico realizado pelo trabalhador seja compatível com sua capacidade de força. Para manipulações ocasionais, o limite de 25 quilos para homens e 15 quilos para mulheres é sugerido, desde que observadas boas práticas para a manipulação.
          </p>
        </Section>

        <Section num="6" title="MOBILIÁRIO DOS POSTOS DE TRABALHO">
          <ul className="ml-4 list-disc text-xs text-gray-700 space-y-0.5">
            <li>Sempre que possível o trabalho deve ser executado na posição sentada;</li>
            <li>O mobiliário deve prover condições dentro da zona de conforto dos segmentos corporais;</li>
            <li>Os comandos sejam de fácil acionamento;</li>
            <li>Os assentos sejam adequados.</li>
          </ul>
        </Section>

        <Section num="7" title="EQUIPAMENTOS DOS POSTOS DE TRABALHO">
          <p className="text-xs leading-relaxed text-gray-700">
            O mobiliário/equipamentos devem prover condições para que o trabalho seja executado dentro da zona de conforto dos segmentos corporais, em boa condição postural e livre de reflexos.
          </p>
        </Section>

        <Section num="8" title="CONDIÇÕES AMBIENTAIS DE TRABALHO">
          <p className="text-xs leading-relaxed text-gray-700">
            O estudo da exposição ocupacional dos trabalhadores aos agentes ambientais está contemplado no Programa de Gerenciamento de Riscos – PGR da empresa.
          </p>
        </Section>

        {/* 9 – Agentes por setor */}
        {rel.setores.length > 0 && (
          <Section num="9" title="AGENTES AMBIENTAIS PARA AS ÁREAS OPERACIONAIS">
            {rel.setores.map((setor) => (
              <SetorRiscosBlock key={setor.id} setor={setor} />
            ))}
          </Section>
        )}

        <Section num="10" title="CONFORTO EM ÁREAS ADMINISTRATIVAS">
          <p className="text-xs leading-relaxed text-gray-700">
            A temperatura efetiva foi avaliada utilizando um termo higrômetro eletrônico. Foi considerado o limite do índice de temperatura efetiva entre 20 a 23 ºC (item 17.5.2.1.b da NR-17). A velocidade do ar não deve ser superior a 0,75 m/s (item 17.5.2.1.c) e a umidade relativa mínima de 40% (item 17.5.2.1.d).
          </p>
        </Section>

        <Section num="11" title="ORGANIZAÇÃO DO TRABALHO">
          <ul className="ml-4 list-[lower-alpha] text-xs text-gray-700 space-y-0.5">
            {["as normas de produção", "o modo operatório", "a exigência de tempo", "a determinação do conteúdo de tempo", "o ritmo de trabalho", "o conteúdo das tarefas", "horário de trabalho"].map((item) => (
              <li key={item}>{item};</li>
            ))}
          </ul>
        </Section>

        <Section num="12" title="FERRAMENTAS BIOMECÂNICAS APLICADAS">
          <p className="text-xs leading-relaxed text-gray-700">
            <strong>Método OWAS:</strong> O Método OWAS (Ovako Working Posture Analysing System) foi desenvolvido na Finlândia por Karhu, Kansi e Kuorinka, entre 1974 e 1978, juntamente com o Instituto Finlandês de Saúde Ocupacional, objetivando gerar informações para melhorar os métodos de trabalho pela identificação de posturas corporais prejudiciais durante a realização das atividades.
          </p>
        </Section>

        {/* 13 – Análise por setor */}
        {rel.setores.length > 0 && (
          <Section num="13" title="ANÁLISES ERGONÔMICAS DO TRABALHO">
            {rel.setores.map((setor, idx) => (
              <SetorAnaliseBlock key={setor.id} setor={setor} idx={idx} />
            ))}
          </Section>
        )}

        {/* 14 – Considerações Finais */}
        <Section num="14" title="CONSIDERAÇÕES FINAIS">
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
                className="mt-2 inline-flex items-center gap-1 rounded-md bg-verde-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-verde-accent"
              >
                {salvar.isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
                Salvar
              </button>
            )}
          </div>
          <div
            className="tiptap-conteudo prose prose-sm hidden max-w-none text-xs leading-relaxed text-gray-700 print:block"
            dangerouslySetInnerHTML={{
              __html: consideracoes || "<p>A preocupação dos setores avaliados em obter para seus colaboradores o conhecimento ergonômico e estar investindo em qualidade de trabalho é fundamental para a busca por melhor produtividade com saúde e qualidade no trabalho.</p>",
            }}
          />
        </Section>

        {/* Assinatura */}
        <div className="mt-10 space-y-2 text-center text-xs text-gray-600">
          {cidade && <p>{cidade}, {dataFormatada}</p>}
          <div className="mt-6 flex justify-center">
            <div className="text-center">
              <div className="mx-auto mb-1 w-56 border-t border-gray-400" />
              <p>Assinatura do responsável da Empresa</p>
            </div>
          </div>
          <div className="mt-6">
            <p className="font-semibold">{rel.responsavel_elaboracao || "—"}</p>
            {rel.titulo_profissional && <p>{rel.titulo_profissional}</p>}
            {rel.registro_profissional && <p>Registro: {rel.registro_profissional}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({
  num,
  title,
  children,
}: {
  num: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <h2 className="mb-2 text-xs font-bold uppercase text-gray-800">
        {num} – {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function SetorRiscosBlock({ setor }: { setor: AetSetor }) {
  if (setor.riscos.length === 0) return null;
  return (
    <div className="mb-4">
      <table className="mb-1 w-full text-xs border-collapse border border-gray-300">
        <tbody>
          <tr className="border border-gray-300">
            <td className="px-2 py-1 font-semibold bg-gray-50 w-36">Setor:</td>
            <td className="px-2 py-1">{setor.nome_setor || "—"}</td>
          </tr>
          {setor.maquinas_equipamentos && (
            <tr className="border border-gray-300">
              <td className="px-2 py-1 font-semibold bg-gray-50">Máquinas e Equipamentos:</td>
              <td className="px-2 py-1">{setor.maquinas_equipamentos.split("\n").filter(Boolean).join(", ")}</td>
            </tr>
          )}
          {setor.cargos.length > 0 && (
            <tr className="border border-gray-300">
              <td className="px-2 py-1 font-semibold bg-gray-50">Cargos:</td>
              <td className="px-2 py-1">{setor.cargos.map((c) => c.nome).filter(Boolean).join(", ")}</td>
            </tr>
          )}
          {setor.descricao_atividade && (
            <tr className="border border-gray-300">
              <td className="px-2 py-1 font-semibold bg-gray-50">Descrição da Atividade:</td>
              <td className="px-2 py-1">{setor.descricao_atividade}</td>
            </tr>
          )}
        </tbody>
      </table>
      <table className="w-full text-xs border-collapse border border-gray-300">
        <thead className="bg-gray-100">
          <tr>
            {["Tipo", "Risco", "Intensidade/Concentração", "Técnica/Metodologia", "EPI CA", "EPI Eficaz", "Classificação"].map((h) => (
              <th key={h} className="border border-gray-300 px-2 py-1 text-left font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {setor.riscos.map((r) => (
            <tr key={r.id}>
              <td className="border border-gray-300 px-2 py-1">{r.tipo}</td>
              <td className="border border-gray-300 px-2 py-1">{r.risco}</td>
              <td className="border border-gray-300 px-2 py-1">{r.intensidade_concentracao}</td>
              <td className="border border-gray-300 px-2 py-1">{r.tecnica_metodologia}</td>
              <td className="border border-gray-300 px-2 py-1">{r.epi_ca}</td>
              <td className="border border-gray-300 px-2 py-1">{r.epi_eficaz}</td>
              <td className={cn("border border-gray-300 px-2 py-1 font-medium", CLASS_COLOR[r.classificacao_risco])}>
                {r.classificacao_risco}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SetorAnaliseBlock({ setor, idx }: { setor: AetSetor; idx: number }) {
  const { owas, checklist } = setor;

  return (
    <div className="mb-6 border border-gray-300 rounded">
      <div className="bg-gray-100 px-3 py-2 text-xs font-bold uppercase">
        Setor {idx + 1}: {setor.nome_setor || "—"}
        {setor.cargos.length > 0 && (
          <span className="font-normal"> — {setor.cargos.map((c) => c.nome).filter(Boolean).join(", ")}</span>
        )}
      </div>
      {/* Descrição por cargo */}
      {setor.cargos.filter((c) => c.descricao).map((cargo, cidx) => (
        <p key={cidx} className="border-t border-gray-100 px-3 py-1 text-xs text-gray-700">
          <strong>{cargo.nome}:</strong> {cargo.descricao}
        </p>
      ))}
      {setor.descricao_atividade && (
        <p className="border-t border-gray-100 px-3 py-1 text-xs text-gray-700">
          <strong>Descrição Geral:</strong> {setor.descricao_atividade}
        </p>
      )}

      {/* OWAS */}
      <div className="grid grid-cols-2 gap-2 p-3 text-xs">
        <OwasRow label="Postura das Costas" values={owas.posturas_costas} map={OWAS_COSTAS} />
        <OwasRow label="Postura dos Braços" values={owas.posturas_bracos} map={OWAS_BRACOS} />
        <OwasRow label="Postura das Pernas" values={owas.posturas_pernas} map={OWAS_PERNAS} />
        <OwasRow label="Esforço" values={owas.esforco} map={OWAS_ESFORCO} />
      </div>

      {/* Checklist */}
      <table className="w-full text-xs border-t border-gray-200">
        <tbody>
          <ChecklistRow label="Levantamento acima do limite recomendado?" value={checklist.levantamento_acima_limite} />
          <tr><td colSpan={2} className="px-3 py-1 border-t border-gray-100">
            <span className="font-medium">Posturas forçadas:</span> {checklist.posturas_forcadas_tipo}
          </td></tr>
          <tr><td colSpan={2} className="px-3 py-1 border-t border-gray-100">
            <span className="font-medium">Trabalho predominante:</span> {checklist.trabalho_predominante}
          </td></tr>
          <ChecklistRow label="Pausas para descanso ou cadeiras semi-sentado?" value={checklist.pausas_descanso} />
          <ChecklistRow label="Uso de cadeira disponível?" value={checklist.uso_cadeira} />
          <ChecklistRow label="Cadeira adequada (giratória, ajustável)?" value={checklist.cadeira_adequada} />
          <ChecklistRow label="Monitor com regulagem?" value={checklist.monitor} />
          <ChecklistRow label="Levantamento acima do limite na exigência de tempo?" value={checklist.exigencia_levantamento} />
          <ChecklistRow label="Ritmo determinado pela demanda?" value={checklist.ritmo_por_demanda} />
          <ChecklistRow label="Pausas formais durante o ciclo?" value={checklist.pausas_formais} />
          <ChecklistRow label="Rodízios sistematizados?" value={checklist.rodizios_sistematizados} />
        </tbody>
      </table>

      {/* Parecer */}
      {setor.parecer_tecnico && (
        <div className="border-t border-gray-200 p-3">
          <p className="mb-1 text-xs font-bold uppercase text-gray-600">Recomendações</p>
          <div
            className="tiptap-conteudo prose prose-sm max-w-none text-xs text-gray-700"
            dangerouslySetInnerHTML={{ __html: setor.parecer_tecnico }}
          />
        </div>
      )}
    </div>
  );
}

function OwasRow({ label, values, map }: { label: string; values: number[]; map: Record<number, string> }) {
  if (values.length === 0) return null;
  return (
    <div>
      <p className="font-semibold text-gray-600">{label}:</p>
      <ul className="ml-2 list-disc">
        {values.map((v) => <li key={v}>{map[v] ?? v}</li>)}
      </ul>
    </div>
  );
}

function ChecklistRow({ label, value }: { label: string; value: string }) {
  const texto = value === "sim" ? "Sim" : value === "nao_aplica" ? "Não se Aplica" : "Não";
  const cor = value === "sim" ? "text-green-700" : value === "nao_aplica" ? "text-gray-500" : "text-red-700";
  return (
    <tr className="border-t border-gray-100">
      <td className="px-3 py-1 text-gray-700">{label}</td>
      <td className={`px-3 py-1 font-semibold ${cor}`}>{texto}</td>
    </tr>
  );
}
