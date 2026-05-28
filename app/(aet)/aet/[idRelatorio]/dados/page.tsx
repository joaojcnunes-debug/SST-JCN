"use client";

import { use, useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import toast from "react-hot-toast";
import { useAetRelatorio, useSalvarAet } from "@/lib/hooks/useAet";
import ProfissionalSelect from "@/components/ui/ProfissionalSelect";
import { useEmpresa } from "@/lib/hooks/useEmpresas";
import { useCanEdit } from "@/lib/hooks/useUsuario";
import RichTextEditor from "@/components/drps/RichTextEditor";

// ─── Seções com texto padrão ──────────────────────────────────────────────────

const SECOES: { key: string; titulo: string; defaultHtml: string }[] = [
  {
    key: "sec_2",
    titulo: "2 – Introdução Geral",
    defaultHtml:
      "<p>A ergonomia estuda a adaptação do trabalho ao homem. Envolve tanto o ambiente físico como os aspectos organizacionais e cognitivos. A ergonomia abrange atividades de planejamento e projeto, que ocorre antes do trabalho ser realizado, e aqueles de controle e avaliação, que ocorrem durante e após o trabalho.</p>" +
      "<p>A mesma pode ser ainda caracterizada como a ocupação de pessoas qualificadas em grupos de pesquisa e formação que atuam em equipes de projeto e consultoria para responder às demandas acerca da atividade de trabalho na sociedade mediante metodologias de análises e projeto de bases científicas e devidamente inseridas num universo normativo e contratual.</p>",
  },
  {
    key: "sec_3",
    titulo: "3 – Objetivo",
    defaultHtml:
      "<p>Este estudo tem como objetivo avaliar os postos de trabalho da empresa especificada, promovendo análise ergonômica das atividades e funções, sendo adotados métodos de análise aplicados para fins ergonômicos.</p>" +
      "<p><strong>BASE LEGAL:</strong> Portaria 3.214/78 do Ministério do Trabalho – NR-17</p>",
  },
  {
    key: "sec_4",
    titulo: "4 – Metodologia",
    defaultHtml:
      "<p>Durante o trabalho realizado, foram avaliadas todas as funções conforme sugerido pela Metodologia da AET, excluindo-se a metodologia por amostragem, uma vez que cada função de trabalho caracteriza um desenvolvimento laboral de forma diferenciada.</p>" +
      "<p>A AET tem por finalidade transformar as condições de trabalho e adaptar às características psicofisiológicas dos trabalhadores, buscando conciliar dois universos: saúde e produtividade.</p>" +
      "<p>A metodologia da AET utiliza-se de observações da situação de trabalho, análise da tarefa, entrevistas e verbalizações com os diferentes níveis hierárquicos, buscando compreender em detalhes as atividades nas suas diferentes dimensões (física, cognitiva, mental e social).</p>",
  },
  {
    key: "sec_5",
    titulo: "5 – Levantamento, Transporte e Descarga Individual de Materiais",
    defaultHtml:
      "<p>Deverão ser executados de forma que o esforço físico realizado pelo trabalhador seja compatível com sua capacidade de força e não comprometa a sua saúde ou sua segurança.</p>" +
      "<p>Para manipulações ocasionais, não repetitivas, o limite de 25 quilos para homens e 15 quilos para mulheres é sugerido por vários autores, desde que observadas boas práticas para a manipulação.</p>",
  },
  {
    key: "sec_6",
    titulo: "6 – Mobiliário dos Postos de Trabalho",
    defaultHtml:
      "<p>A análise ergonômica do trabalho leva em consideração que:</p>" +
      "<ul><li>Sempre que possível o trabalho deve ser executado na posição sentada;</li>" +
      "<li>O mobiliário deve prover condições para que o trabalho seja executado dentro da zona de conforto dos segmentos corporais;</li>" +
      "<li>Os comandos sejam de fácil acionamento;</li>" +
      "<li>Os assentos sejam adequados.</li></ul>",
  },
  {
    key: "sec_7",
    titulo: "7 – Equipamentos dos Postos de Trabalho",
    defaultHtml:
      "<p>A análise ergonômica do trabalho leva em consideração que o mobiliário/equipamentos devem prover condições para que o trabalho seja executado dentro da zona de conforto dos segmentos corporais, em boa condição postural e livre de reflexos.</p>",
  },
  {
    key: "sec_8",
    titulo: "8 – Condições Ambientais de Trabalho",
    defaultHtml:
      "<p>O estudo da exposição ocupacional dos trabalhadores aos agentes ambientais está contemplado no Programa de Gerenciamento de Riscos – PGR da empresa.</p>",
  },
  {
    key: "sec_11",
    titulo: "11 – Organização do Trabalho",
    defaultHtml:
      "<p>Na análise foram levados em consideração os seguintes aspectos:</p>" +
      "<ul><li>As normas de produção;</li><li>O modo operatório;</li><li>A exigência de tempo;</li>" +
      "<li>A determinação do conteúdo de tempo;</li><li>O ritmo de trabalho;</li>" +
      "<li>O conteúdo das tarefas;</li><li>Horário de trabalho.</li></ul>",
  },
  {
    key: "sec_12",
    titulo: "12 – Ferramentas Biomecânicas Aplicadas",
    defaultHtml:
      "<p>Método OWAS: O Método OWAS (Ovako Working Posture Analysing System) foi desenvolvido na Finlândia por Karhu, Kansi e Kuorinka, entre 1974 e 1978, juntamente com o Instituto Finlandês de Saúde Ocupacional, objetivando gerar informações para melhorar os métodos de trabalho pela identificação de posturas corporais prejudiciais durante a realização das atividades.</p>",
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AetDadosPage({
  params,
}: {
  params: Promise<{ idRelatorio: string }>;
}) {
  const { idRelatorio } = use(params);
  const { data: rel, isLoading } = useAetRelatorio(idRelatorio);
  const { data: empresa } = useEmpresa(rel?.id_empresa ?? null);
  const salvar = useSalvarAet();
  const canEdit = useCanEdit();

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-gray-400" />
      </div>
    );
  }

  function salvarSecao(key: string, html: string) {
    const textos_secoes = { ...(rel?.textos_secoes ?? {}), [key]: html };
    salvar.mutate(
      { id: idRelatorio, patch: { textos_secoes } },
      {
        onSuccess: () => toast.success("Texto salvo"),
        onError: (e: Error) => toast.error(e.message),
      }
    );
  }

  function salvarCaracterizacao(patch: {
    responsavel_elaboracao: string;
    titulo_profissional: string;
    registro_profissional: string;
    data_elaboracao: string;
    status: "RASCUNHO" | "CONCLUIDO";
  }) {
    salvar.mutate(
      { id: idRelatorio, patch },
      {
        onSuccess: () => toast.success("Dados salvos"),
        onError: (e: Error) => toast.error(e.message),
      }
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-lg font-semibold text-gray-900">Dados Gerais</h1>

      {/* Seção 1 – Caracterização */}
      <CaracterizacaoCard
        rel={rel}
        empresa={empresa}
        canEdit={canEdit}
        salvando={salvar.isPending}
        onSalvar={salvarCaracterizacao}
      />

      {/* Seções 2–12 editáveis */}
      {SECOES.map((s) => (
        <SecaoCard
          key={s.key}
          titulo={s.titulo}
          valor={rel?.textos_secoes?.[s.key] ?? s.defaultHtml}
          canEdit={canEdit}
          salvando={salvar.isPending}
          onSalvar={(html) => salvarSecao(s.key, html)}
        />
      ))}
    </div>
  );
}

// ─── Card Caracterização ──────────────────────────────────────────────────────

function CaracterizacaoCard({
  rel,
  empresa,
  canEdit,
  salvando,
  onSalvar,
}: {
  rel: import("@/lib/supabase/types").AetRelatorio | undefined;
  empresa: { nome_empresa: string; cnpj: string | null } | null | undefined;
  canEdit: boolean;
  salvando: boolean;
  onSalvar: (patch: {
    responsavel_elaboracao: string;
    titulo_profissional: string;
    registro_profissional: string;
    data_elaboracao: string;
    status: "RASCUNHO" | "CONCLUIDO";
  }) => void;
}) {
  const [form, setForm] = useState({
    responsavel_elaboracao: rel?.responsavel_elaboracao ?? "",
    titulo_profissional: rel?.titulo_profissional ?? "",
    registro_profissional: rel?.registro_profissional ?? "",
    data_elaboracao: rel?.data_elaboracao ?? "",
    status: (rel?.status ?? "RASCUNHO") as "RASCUNHO" | "CONCLUIDO",
  });
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!rel) return;
    setForm({
      responsavel_elaboracao: rel.responsavel_elaboracao,
      titulo_profissional: rel.titulo_profissional,
      registro_profissional: rel.registro_profissional,
      data_elaboracao: rel.data_elaboracao ?? "",
      status: rel.status,
    });
    setDirty(false);
  }, [rel?.id_relatorio]);

  function set(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setDirty(true);
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700">
          1 – Caracterização da Empresa
        </h2>
        {canEdit && (
          <button
            type="button"
            onClick={() => { onSalvar(form); setDirty(false); }}
            disabled={!dirty || salvando}
            className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-3 py-2 text-xs font-semibold text-white hover:bg-verde-accent disabled:opacity-50"
          >
            {salvando ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            Salvar
          </button>
        )}
      </div>

      {/* Bloco Configuração */}
      <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-gray-500">
          Configuração
        </p>

        {/* Campos somente-leitura */}
        <div className="mb-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <ReadRow label="Razão Social" value={empresa?.nome_empresa ?? rel?.empresas?.nome_empresa ?? "—"} />
          <ReadRow label="CNPJ" value={empresa?.cnpj ?? rel?.empresas?.cnpj ?? "—"} />
        </div>

        {/* Campos editáveis */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Responsável pela Elaboração
            </label>
            <ProfissionalSelect
              value={form.responsavel_elaboracao}
              onChange={(nome, cargo) => { set("responsavel_elaboracao", nome); set("titulo_profissional", cargo ?? ""); }}
              className={!canEdit ? "pointer-events-none opacity-60" : ""}
            />
          </div>
          <InputField
            label="Título Profissional"
            value={form.titulo_profissional}
            disabled={!canEdit}
            onChange={(v) => set("titulo_profissional", v)}
          />
          <InputField
            label="Registro Profissional"
            value={form.registro_profissional}
            disabled={!canEdit}
            onChange={(v) => set("registro_profissional", v)}
          />
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Data de Elaboração
            </label>
            <input
              type="date"
              value={form.data_elaboracao}
              disabled={!canEdit}
              onChange={(e) => set("data_elaboracao", e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-verde-primary focus:outline-none disabled:bg-gray-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Status
            </label>
            <select
              value={form.status}
              disabled={!canEdit}
              onChange={(e) => set("status", e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-verde-primary focus:outline-none disabled:bg-gray-100"
            >
              <option value="RASCUNHO">Rascunho</option>
              <option value="CONCLUIDO">Concluído</option>
            </select>
          </div>
        </div>
      </div>

      {/* Pré-visualização */}
      <div className="mt-4">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
          Pré-visualização — como aparece no laudo
        </p>
        {/* Mesmo container do laudo/page.tsx */}
        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">

          {/* Cabeçalho — igual ao laudo */}
          <div className="mb-8 flex items-start justify-between border-b pb-4">
            <div className="text-xs text-gray-500">Chabra Saúde e Segurança do Trabalho</div>
          </div>

          {/* Capa — igual ao laudo */}
          <div className="mb-10 space-y-3 text-center">
            <p className="text-sm font-bold">LAUDO DE AVALIAÇÃO ERGONÔMICA</p>
            <p className="text-sm font-bold">AET – ANÁLISE ERGONÔMICA DO TRABALHO</p>
            <p className="text-xs text-gray-600">Portaria 3.214/78 - Norma Regulamentadora - 17</p>
            <div className="mt-6 space-y-1 text-sm">
              <p><strong>EMPRESA:</strong> {empresa?.nome_empresa ?? rel?.empresas?.nome_empresa ?? "—"}</p>
              <p><strong>CNPJ:</strong> {empresa?.cnpj ?? rel?.empresas?.cnpj ?? "—"}</p>
              <p><strong>DATA:</strong> {form.data_elaboracao ? new Date(form.data_elaboracao + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</p>
            </div>
          </div>

          {/* 1 – Caracterização — igual ao laudo */}
          <div className="mb-6">
            <h2 className="mb-2 text-xs font-bold uppercase text-gray-800">
              1 – CARACTERIZAÇÃO DA EMPRESA AVALIADA
            </h2>
            <table className="w-full border-collapse text-xs">
              <tbody>
                {(
                  [
                    ["Razão Social", empresa?.nome_empresa ?? rel?.empresas?.nome_empresa ?? "—"],
                    ["CNPJ", empresa?.cnpj ?? rel?.empresas?.cnpj ?? "—"],
                    ["Responsável pela Elaboração", form.responsavel_elaboracao || "—"],
                    ["Título Profissional", form.titulo_profissional || "—"],
                    ["Registro Profissional", form.registro_profissional || "—"],
                    ["Data da elaboração", form.data_elaboracao ? new Date(form.data_elaboracao + "T00:00:00").toLocaleDateString("pt-BR") : "—"],
                  ] as [string, string][]
                ).map(([k, v]) => (
                  <tr key={k} className="border border-gray-300">
                    <td className="w-48 bg-gray-50 px-2 py-1 font-semibold">{k}:</td>
                    <td className="px-2 py-1">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Assinatura — igual ao laudo */}
          <div className="mt-10 space-y-2 text-center text-xs text-gray-600">
            <div className="mt-6 flex justify-center">
              <div className="text-center">
                <div className="mx-auto mb-1 w-56 border-t border-gray-400" />
                <p>Assinatura do responsável da Empresa</p>
              </div>
            </div>
            <div className="mt-6">
              <p className="font-semibold">{form.responsavel_elaboracao || "—"}</p>
              {form.titulo_profissional && <p>{form.titulo_profissional}</p>}
              {form.registro_profissional && <p>Registro: {form.registro_profissional}</p>}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Card Seção editável ──────────────────────────────────────────────────────

function SecaoCard({
  titulo,
  valor,
  canEdit,
  salvando,
  onSalvar,
}: {
  titulo: string;
  valor: string;
  canEdit: boolean;
  salvando: boolean;
  onSalvar: (html: string) => void;
}) {
  const [html, setHtml] = useState(valor);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setHtml(valor);
    setDirty(false);
  }, [valor]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700">
          {titulo}
        </h2>
        {canEdit && (
          <button
            type="button"
            onClick={() => { onSalvar(html); setDirty(false); }}
            disabled={!dirty || salvando}
            className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-3 py-2 text-xs font-semibold text-white hover:bg-verde-accent disabled:opacity-50"
          >
            {salvando ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            Salvar
          </button>
        )}
      </div>
      <RichTextEditor
        value={html}
        onChange={(v) => { setHtml(v); setDirty(true); }}
        readOnly={!canEdit}
        uploadPathPrefix="aet-textos"
        placeholder="Conteúdo da seção..."
      />
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ReadRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="w-28 shrink-0 font-medium text-gray-500">{label}:</span>
      <span className="text-gray-900">{value || "—"}</span>
    </div>
  );
}

function InputField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">
        {label}
      </label>
      <input
        type="text"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-verde-primary focus:outline-none disabled:bg-gray-100"
      />
    </div>
  );
}
