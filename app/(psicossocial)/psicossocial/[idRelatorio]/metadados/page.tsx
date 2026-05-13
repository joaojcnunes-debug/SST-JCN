"use client";

import { useEffect, useState, use } from "react";
import { Save } from "lucide-react";
import {
  useDrpsRelatorio,
  useDrpsSalvarRelatorio,
} from "@/lib/hooks/useDrps";
import type { StatusRelatorio } from "@/lib/drps/types";

interface Form {
  status: StatusRelatorio;
  data_elaboracao: string;
  responsavel_tecnico: string;
  crp: string;
  funcoes: string;
  qtd_trabalhadores: string;
  qtd_homens: string;
  qtd_mulheres: string;
  agravos_saude_mental: string;
  medidas_existentes: string;
}

const EMPTY: Form = {
  status: "EM_ANDAMENTO",
  data_elaboracao: "",
  responsavel_tecnico: "",
  crp: "",
  funcoes: "",
  qtd_trabalhadores: "",
  qtd_homens: "",
  qtd_mulheres: "",
  agravos_saude_mental: "",
  medidas_existentes: "",
};

const STATUS_OPCOES: { v: StatusRelatorio; t: string }[] = [
  { v: "RASCUNHO", t: "Rascunho" },
  { v: "EM_ANDAMENTO", t: "Em andamento" },
  { v: "CONCLUIDO", t: "Concluído" },
];

export default function MetadadosPage({
  params,
}: {
  params: Promise<{ idRelatorio: string }>;
}) {
  const { idRelatorio } = use(params);
  const { data: relatorio, isLoading } = useDrpsRelatorio(idRelatorio);
  const salvar = useDrpsSalvarRelatorio();

  const [form, setForm] = useState<Form>(EMPTY);

  useEffect(() => {
    if (isLoading || !relatorio) return;
    setForm({
      status: relatorio.status,
      data_elaboracao: relatorio.data_elaboracao ?? "",
      responsavel_tecnico: relatorio.responsavel_tecnico ?? "",
      crp: relatorio.crp ?? "",
      funcoes: relatorio.funcoes ?? "",
      qtd_trabalhadores: relatorio.qtd_trabalhadores?.toString() ?? "",
      qtd_homens: relatorio.qtd_homens?.toString() ?? "",
      qtd_mulheres: relatorio.qtd_mulheres?.toString() ?? "",
      agravos_saude_mental: relatorio.agravos_saude_mental ?? "",
      medidas_existentes: relatorio.medidas_existentes ?? "",
    });
  }, [relatorio, isLoading]);

  function onSubmit() {
    if (!relatorio) return;
    salvar.mutate({
      id_relatorio: idRelatorio,
      id_empresa: relatorio.id_empresa,
      status: form.status,
      data_elaboracao: form.data_elaboracao || null,
      responsavel_tecnico: form.responsavel_tecnico.trim() || null,
      crp: form.crp.trim() || null,
      funcoes: form.funcoes.trim() || null,
      qtd_trabalhadores: form.qtd_trabalhadores
        ? parseInt(form.qtd_trabalhadores)
        : null,
      qtd_homens: form.qtd_homens ? parseInt(form.qtd_homens) : null,
      qtd_mulheres: form.qtd_mulheres ? parseInt(form.qtd_mulheres) : null,
      agravos_saude_mental: form.agravos_saude_mental.trim() || null,
      medidas_existentes: form.medidas_existentes.trim() || null,
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">
          Metadados do Relatório DRPS
        </h1>
        <p className="text-sm text-gray-600">
          Informações que aparecem no relatório formal de Análise e
          Avaliação. {relatorio && <>Rev. {relatorio.revisao}.</>}
        </p>
      </div>

      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <Section titulo="Status do Relatório">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Status">
              <select
                value={form.status}
                onChange={(e) =>
                  setForm({
                    ...form,
                    status: e.target.value as StatusRelatorio,
                  })
                }
                className={inputCls}
              >
                {STATUS_OPCOES.map((s) => (
                  <option key={s.v} value={s.v}>
                    {s.t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Data da elaboração">
              <input
                type="date"
                value={form.data_elaboracao}
                onChange={(e) =>
                  setForm({ ...form, data_elaboracao: e.target.value })
                }
                className={inputCls}
              />
            </Field>
          </div>
        </Section>

        <Section titulo="Responsável Técnico">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Nome do responsável técnico (Psicólogo)">
              <input
                type="text"
                value={form.responsavel_tecnico}
                onChange={(e) =>
                  setForm({ ...form, responsavel_tecnico: e.target.value })
                }
                className={inputCls}
              />
            </Field>
            <Field label="CRP">
              <input
                type="text"
                value={form.crp}
                onChange={(e) => setForm({ ...form, crp: e.target.value })}
                className={inputCls}
              />
            </Field>
          </div>
        </Section>

        <Section titulo="Quadro de Pessoal">
          <Field label="Funções avaliadas">
            <input
              type="text"
              value={form.funcoes}
              onChange={(e) => setForm({ ...form, funcoes: e.target.value })}
              className={inputCls}
            />
          </Field>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <Field label="Qtd. total">
              <input
                type="number"
                min={0}
                value={form.qtd_trabalhadores}
                onChange={(e) =>
                  setForm({ ...form, qtd_trabalhadores: e.target.value })
                }
                className={inputCls}
              />
            </Field>
            <Field label="Homens">
              <input
                type="number"
                min={0}
                value={form.qtd_homens}
                onChange={(e) =>
                  setForm({ ...form, qtd_homens: e.target.value })
                }
                className={inputCls}
              />
            </Field>
            <Field label="Mulheres">
              <input
                type="number"
                min={0}
                value={form.qtd_mulheres}
                onChange={(e) =>
                  setForm({ ...form, qtd_mulheres: e.target.value })
                }
                className={inputCls}
              />
            </Field>
          </div>
        </Section>

        <Section titulo="Diagnóstico Descritivo">
          <Field label="Possíveis agravos à saúde mental">
            <textarea
              value={form.agravos_saude_mental}
              onChange={(e) =>
                setForm({ ...form, agravos_saude_mental: e.target.value })
              }
              rows={4}
              className={inputCls}
            />
          </Field>
          <div className="mt-3">
            <Field label="Medidas de controle já existentes">
              <textarea
                value={form.medidas_existentes}
                onChange={(e) =>
                  setForm({ ...form, medidas_existentes: e.target.value })
                }
                rows={4}
                className={inputCls}
              />
            </Field>
          </div>
        </Section>

        <div className="flex justify-end border-t border-gray-200 pt-4">
          <button
            type="button"
            onClick={onSubmit}
            disabled={salvar.isPending || !relatorio}
            className="inline-flex items-center gap-2 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-verde-accent disabled:opacity-60"
          >
            <Save className="size-4" />
            {salvar.isPending ? "Salvando..." : "Salvar Metadados"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
        {titulo}
      </h2>
      {children}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  "mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30";
