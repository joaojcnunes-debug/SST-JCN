"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import DrpsFiltro from "@/components/drps/DrpsFiltro";
import { useDrpsStore } from "@/lib/drps/store";
import {
  useDrpsEmpresaConfig,
  useDrpsSalvarEmpresaConfig,
} from "@/lib/hooks/useDrps";

interface Form {
  responsavel_tecnico: string;
  crp: string;
  data_elaboracao: string;
  funcoes: string;
  qtd_trabalhadores: string;
  qtd_homens: string;
  qtd_mulheres: string;
  agravos_saude_mental: string;
  medidas_existentes: string;
}

const EMPTY: Form = {
  responsavel_tecnico: "",
  crp: "",
  data_elaboracao: "",
  funcoes: "",
  qtd_trabalhadores: "",
  qtd_homens: "",
  qtd_mulheres: "",
  agravos_saude_mental: "",
  medidas_existentes: "",
};

export default function DrpsEmpresaPage() {
  const idEmpresa = useDrpsStore((s) => s.idEmpresa);
  const { data: config, isLoading } = useDrpsEmpresaConfig(idEmpresa);
  const salvar = useDrpsSalvarEmpresaConfig();

  const [form, setForm] = useState<Form>(EMPTY);

  useEffect(() => {
    if (!idEmpresa) {
      setForm(EMPTY);
      return;
    }
    if (config) {
      setForm({
        responsavel_tecnico: config.responsavel_tecnico ?? "",
        crp: config.crp ?? "",
        data_elaboracao: config.data_elaboracao ?? "",
        funcoes: config.funcoes ?? "",
        qtd_trabalhadores: config.qtd_trabalhadores?.toString() ?? "",
        qtd_homens: config.qtd_homens?.toString() ?? "",
        qtd_mulheres: config.qtd_mulheres?.toString() ?? "",
        agravos_saude_mental: config.agravos_saude_mental ?? "",
        medidas_existentes: config.medidas_existentes ?? "",
      });
    } else if (!isLoading) {
      setForm(EMPTY);
    }
  }, [config, idEmpresa, isLoading]);

  function onSubmit() {
    if (!idEmpresa) return;
    salvar.mutate({
      id_empresa: idEmpresa,
      responsavel_tecnico: form.responsavel_tecnico.trim() || null,
      crp: form.crp.trim() || null,
      data_elaboracao: form.data_elaboracao || null,
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
          Configurações DRPS da Empresa
        </h1>
        <p className="text-sm text-gray-600">
          Metadados que aparecem no relatório formal de Análise e Avaliação.
        </p>
      </div>

      <DrpsFiltro />

      {!idEmpresa ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Selecione uma empresa.
        </div>
      ) : (
        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <Section titulo="Responsável Técnico">
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Nome do responsável técnico">
                <input
                  type="text"
                  value={form.responsavel_tecnico}
                  onChange={(e) =>
                    setForm({ ...form, responsavel_tecnico: e.target.value })
                  }
                  className={inputCls}
                  placeholder="Ex: Maria da Silva"
                />
              </Field>
              <Field label="CRP">
                <input
                  type="text"
                  value={form.crp}
                  onChange={(e) => setForm({ ...form, crp: e.target.value })}
                  className={inputCls}
                  placeholder="Ex: 06/12345"
                />
              </Field>
              <Field label="Data de elaboração">
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

          <Section titulo="Quadro de Pessoal">
            <Field label="Funções avaliadas">
              <input
                type="text"
                value={form.funcoes}
                onChange={(e) => setForm({ ...form, funcoes: e.target.value })}
                className={inputCls}
                placeholder="Lista resumida das funções/cargos"
              />
            </Field>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <Field label="Qtd. total de trabalhadores">
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
                placeholder="Descreva os possíveis agravos identificados (ansiedade, burnout, etc)"
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
                  placeholder="Programas, treinamentos, canais já implementados"
                />
              </Field>
            </div>
          </Section>

          <div className="flex justify-end border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={onSubmit}
              disabled={salvar.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-verde-accent disabled:opacity-60"
            >
              <Save className="size-4" />
              {salvar.isPending ? "Salvando..." : "Salvar Configurações"}
            </button>
          </div>
        </div>
      )}
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
