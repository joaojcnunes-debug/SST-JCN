"use client";

import { useEffect, useState, use } from "react";
import { Loader2, Save } from "lucide-react";
import toast from "react-hot-toast";
import { useAetRelatorio, useSalvarAet } from "@/lib/hooks/useAet";
import { useCanEdit } from "@/lib/hooks/useUsuario";
import { useEmpresa } from "@/lib/hooks/useEmpresas";

export default function AetDadosPage({
  params,
}: {
  params: Promise<{ idRelatorio: string }>;
}) {
  const { idRelatorio } = use(params);
  const { data: rel, isLoading } = useAetRelatorio(idRelatorio);
  const salvar = useSalvarAet();
  const canEdit = useCanEdit();
  const { data: empresa } = useEmpresa(rel?.id_empresa ?? null);

  const [form, setForm] = useState({
    responsavel_elaboracao: "",
    titulo_profissional: "",
    registro_profissional: "",
    data_elaboracao: "",
    status: "RASCUNHO" as "RASCUNHO" | "CONCLUIDO",
  });

  useEffect(() => {
    if (!rel) return;
    setForm({
      responsavel_elaboracao: rel.responsavel_elaboracao,
      titulo_profissional: rel.titulo_profissional,
      registro_profissional: rel.registro_profissional,
      data_elaboracao: rel.data_elaboracao ?? "",
      status: rel.status,
    });
  }, [rel]);

  function handleChange(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleSave() {
    salvar.mutate(
      { id: idRelatorio, patch: form },
      {
        onSuccess: () => toast.success("Dados salvos"),
        onError: (e: Error) => toast.error(e.message),
      }
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Dados Gerais</h1>
        {canEdit && (
          <button
            type="button"
            onClick={handleSave}
            disabled={salvar.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-50"
          >
            {salvar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Salvar
          </button>
        )}
      </div>

      {/* 1 – Caracterização */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700">
          1 – Caracterização da Empresa
        </h2>
        <div className="grid grid-cols-1 gap-3 text-sm">
          <Row label="Razão Social" value={empresa?.nome_empresa ?? rel?.empresas?.nome_empresa ?? "—"} />
          <Row label="CNPJ" value={empresa?.cnpj ?? rel?.empresas?.cnpj ?? "—"} />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field
            label="Responsável pela Elaboração"
            value={form.responsavel_elaboracao}
            disabled={!canEdit}
            onChange={(v) => handleChange("responsavel_elaboracao", v)}
          />
          <Field
            label="Título Profissional"
            value={form.titulo_profissional}
            disabled={!canEdit}
            onChange={(v) => handleChange("titulo_profissional", v)}
          />
          <Field
            label="Registro Profissional"
            value={form.registro_profissional}
            disabled={!canEdit}
            onChange={(v) => handleChange("registro_profissional", v)}
          />
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Data de Elaboração
            </label>
            <input
              type="date"
              value={form.data_elaboracao}
              disabled={!canEdit}
              onChange={(e) => handleChange("data_elaboracao", e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-verde-primary focus:outline-none disabled:bg-gray-50"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Status</label>
          <select
            value={form.status}
            disabled={!canEdit}
            onChange={(e) => handleChange("status", e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-verde-primary focus:outline-none disabled:bg-gray-50"
          >
            <option value="RASCUNHO">Rascunho</option>
            <option value="CONCLUIDO">Concluído</option>
          </select>
        </div>
      </section>

      {/* Seções estáticas do laudo */}
      {SECOES_ESTATICAS.map((s) => (
        <section key={s.titulo} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-gray-700">
            {s.titulo}
          </h2>
          <div className="space-y-2 text-sm leading-relaxed text-gray-700">
            {s.paragrafos.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            {s.lista && (
              <ul className="ml-4 list-disc space-y-1 text-sm text-gray-700">
                {s.lista.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="w-36 shrink-0 font-medium text-gray-600">{label}:</span>
      <span className="text-gray-900">{value || "—"}</span>
    </div>
  );
}

function Field({
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
      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      <input
        type="text"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-verde-primary focus:outline-none disabled:bg-gray-50"
      />
    </div>
  );
}

const SECOES_ESTATICAS = [
  {
    titulo: "2 – Introdução Geral",
    paragrafos: [
      "A ergonomia estuda a adaptação do trabalho ao homem. Envolve tanto o ambiente físico como os aspectos organizacionais e cognitivos. A ergonomia abrange atividades de planejamento e projeto, que ocorre antes do trabalho ser realizado, e aqueles de controle e avaliação, que ocorrem durante e após o trabalho.",
      "A mesma pode ser ainda caracterizada como a ocupação de pessoas qualificadas em grupos de pesquisa e formação que atuam em equipes de projeto e consultoria para responder às demandas acerca da atividade de trabalho na sociedade mediante metodologias de análises e projeto de bases científicas e devidamente inseridas num universo normativo e contratual.",
    ],
  },
  {
    titulo: "3 – Objetivo",
    paragrafos: [
      "Este estudo tem como objetivo avaliar os postos de trabalho da empresa especificada, promovendo análise ergonômica das atividades e funções, sendo adotados métodos de análise aplicados para fins ergonômicos.",
      "BASE LEGAL: Portaria 3.214/78 do Ministério do Trabalho – NR-17",
    ],
  },
  {
    titulo: "4 – Metodologia",
    paragrafos: [
      "Durante o trabalho realizado, foram avaliadas todas as funções conforme sugerido pela Metodologia da AET, excluindo-se a metodologia por amostragem, uma vez que cada função de trabalho caracteriza um desenvolvimento laboral de forma diferenciada.",
      "A AET tem por finalidade transformar as condições de trabalho e adaptar às características psicofisiológicas dos trabalhadores, buscando conciliar dois universos: saúde e produtividade.",
      "A metodologia da AET utiliza-se de observações da situação de trabalho, análise da tarefa, entrevistas e verbalizações com os diferentes níveis hierárquicos, buscando compreender em detalhes as atividades nas suas diferentes dimensões (física, cognitiva, mental e social).",
    ],
  },
  {
    titulo: "5 – Levantamento, Transporte e Descarga Individual de Materiais",
    paragrafos: [
      "Deverão ser executados de forma que o esforço físico realizado pelo trabalhador seja compatível com sua capacidade de força e não comprometa a sua saúde ou sua segurança.",
      "Para manipulações ocasionais, não repetitivas, o limite de 25 quilos para homens e 15 quilos para mulheres é sugerido por vários autores, desde que observadas boas práticas para a manipulação.",
    ],
  },
  {
    titulo: "6 – Mobiliário dos Postos de Trabalho",
    paragrafos: ["A análise ergonômica do trabalho leva em consideração que:"],
    lista: [
      "Sempre que possível o trabalho deve ser executado na posição sentada;",
      "O mobiliário deve prover condições para que o trabalho seja executado dentro da zona de conforto dos segmentos corporais;",
      "Os comandos sejam de fácil acionamento;",
      "Os assentos sejam adequados.",
    ],
  },
  {
    titulo: "7 – Equipamentos dos Postos de Trabalho",
    paragrafos: [
      "A análise ergonômica do trabalho leva em consideração que o mobiliário/equipamentos devem prover condições para que o trabalho seja executado dentro da zona de conforto dos segmentos corporais, em boa condição postural e livre de reflexos.",
    ],
  },
  {
    titulo: "8 – Condições Ambientais de Trabalho",
    paragrafos: [
      "O estudo da exposição ocupacional dos trabalhadores aos agentes ambientais está contemplado no Programa de Gerenciamento de Riscos – PGR da empresa.",
    ],
  },
  {
    titulo: "11 – Organização do Trabalho",
    paragrafos: ["Na análise foram levados em consideração os seguintes aspectos:"],
    lista: [
      "As normas de produção;",
      "O modo operatório;",
      "A exigência de tempo;",
      "A determinação do conteúdo de tempo;",
      "O ritmo de trabalho;",
      "O conteúdo das tarefas;",
      "Horário de trabalho.",
    ],
  },
  {
    titulo: "12 – Ferramentas Biomecânicas Aplicadas",
    paragrafos: [
      "Método OWAS: O Método OWAS (Ovako Working Posture Analysing System) foi desenvolvido na Finlândia por Karhu, Kansi e Kuorinka, entre 1974 e 1978, juntamente com o Instituto Finlandês de Saúde Ocupacional, objetivando gerar informações para melhorar os métodos de trabalho pela identificação de posturas corporais prejudiciais durante a realização das atividades.",
    ],
  },
];
