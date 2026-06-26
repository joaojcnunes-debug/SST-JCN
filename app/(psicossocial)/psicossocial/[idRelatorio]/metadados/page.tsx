"use client";

import { useEffect, useState, use } from "react";
import ProfissionalSelect from "@/components/ui/ProfissionalSelect";
import { detectRegistroTipo } from "@/lib/registro-profissional";
import { Save } from "lucide-react";
import {
  useDrpsRelatorio,
  useDrpsSalvarRelatorio,
} from "@/lib/hooks/useDrps";
import { useCanEdit } from "@/lib/hooks/useUsuario";
import type { StatusRelatorio } from "@/lib/drps/types";

interface Form {
  status: StatusRelatorio;
  data_elaboracao: string;
  data_validade: string;
  responsavel_tecnico: string;
  crp: string;
  cargo_responsavel: string | null;
}

const EMPTY: Form = {
  status: "EM_ANDAMENTO",
  data_elaboracao: "",
  data_validade: "",
  responsavel_tecnico: "",
  crp: "",
  cargo_responsavel: null,
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
  const canEdit = useCanEdit();
  const { data: relatorio, isLoading } = useDrpsRelatorio(idRelatorio);
  const salvar = useDrpsSalvarRelatorio();

  const [form, setForm] = useState<Form>(EMPTY);

  useEffect(() => {
    if (isLoading || !relatorio) return;
    setForm({
      status: relatorio.status,
      data_elaboracao: relatorio.data_elaboracao ?? "",
      data_validade: relatorio.data_validade ?? "",
      responsavel_tecnico: relatorio.responsavel_tecnico ?? "",
      crp: relatorio.crp ?? "",
      cargo_responsavel: null,
    });
  }, [relatorio, isLoading]);

  function onSubmit() {
    if (!relatorio) return;
    salvar.mutate({
      id_relatorio: idRelatorio,
      id_empresa: relatorio.id_empresa,
      status: form.status,
      data_elaboracao: form.data_elaboracao || null,
      data_validade: form.data_validade || null,
      responsavel_tecnico: form.responsavel_tecnico.trim() || null,
      crp: form.crp.trim() || null,
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">
          Metadados do Relatório DRPS
        </h1>
        <p className="text-sm text-gray-600">
          Status, data e responsável técnico. Agravos e medidas de controle são
          editados diretamente na aba <strong>Análise e Avaliação</strong>.
          {relatorio && <> Rev. {relatorio.revisao}.</>}
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
                disabled={!canEdit}
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
                disabled={!canEdit}
                className={inputCls}
              />
            </Field>
            <Field label="Validade do documento">
              <input
                type="date"
                value={form.data_validade}
                onChange={(e) =>
                  setForm({ ...form, data_validade: e.target.value })
                }
                disabled={!canEdit}
                className={inputCls}
              />
            </Field>
          </div>
        </Section>

        <Section titulo="Responsável Técnico">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Nome do responsável técnico">
              <ProfissionalSelect
                value={form.responsavel_tecnico}
                onChange={(nome, cargo, _cert, registro) => setForm({
                  ...form,
                  responsavel_tecnico: nome,
                  cargo_responsavel: cargo,
                  crp: registro ?? form.crp,
                })}
                onMatchFound={({ cargo, registro }) => setForm((f) => ({
                  ...f,
                  cargo_responsavel: cargo,
                  crp: registro ?? f.crp,
                }))}
                className={!canEdit ? "pointer-events-none opacity-60" : ""}
              />
            </Field>
            <Field label={detectRegistroTipo(form.cargo_responsavel).label}>
              <input
                type="text"
                value={form.crp}
                onChange={(e) => setForm({ ...form, crp: e.target.value })}
                disabled={!canEdit}
                placeholder={detectRegistroTipo(form.cargo_responsavel).placeholder}
                className={inputCls}
              />
            </Field>
          </div>
        </Section>

        <div className="flex justify-end border-t border-gray-200 pt-4">
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canEdit || salvar.isPending || !relatorio}
            className="inline-flex items-center gap-2 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-verde-accent disabled:cursor-not-allowed disabled:opacity-60"
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
