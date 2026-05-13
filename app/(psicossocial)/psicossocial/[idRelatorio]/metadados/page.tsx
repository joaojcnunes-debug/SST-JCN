"use client";

import { useEffect, useMemo, useState, use } from "react";
import { Save, Plus, X } from "lucide-react";
import {
  useDrpsRelatorio,
  useDrpsSalvarRelatorio,
} from "@/lib/hooks/useDrps";
import { AGRAVOS_OPCOES, MEDIDAS_EXISTENTES_OPCOES } from "@/lib/drps/topicos";
import type { StatusRelatorio } from "@/lib/drps/types";

interface Form {
  status: StatusRelatorio;
  data_elaboracao: string;
  responsavel_tecnico: string;
  crp: string;
  qtd_homens: string;
  qtd_mulheres: string;
  agravos_selecionados: string[];
  agravos_extras: string[];
  medidas_selecionadas: string[];
  medidas_extras: string[];
}

const EMPTY: Form = {
  status: "EM_ANDAMENTO",
  data_elaboracao: "",
  responsavel_tecnico: "",
  crp: "",
  qtd_homens: "",
  qtd_mulheres: "",
  agravos_selecionados: [],
  agravos_extras: [],
  medidas_selecionadas: [],
  medidas_extras: [],
};

const STATUS_OPCOES: { v: StatusRelatorio; t: string }[] = [
  { v: "RASCUNHO", t: "Rascunho" },
  { v: "EM_ANDAMENTO", t: "Em andamento" },
  { v: "CONCLUIDO", t: "Concluído" },
];

/**
 * Separa um texto multi-linha em itens predefinidos (entre os que constam em
 * `opcoes`) e itens extras (digitados manualmente).
 */
function parseMultiSelect(
  texto: string | null,
  opcoes: string[]
): { selecionados: string[]; extras: string[] } {
  if (!texto) return { selecionados: [], extras: [] };
  const itens = texto
    .split("\n")
    .map((s) => s.replace(/^[•\-\s]+/, "").trim())
    .filter((s) => s.length > 0);
  const selecionados: string[] = [];
  const extras: string[] = [];
  for (const item of itens) {
    if (opcoes.includes(item)) selecionados.push(item);
    else extras.push(item);
  }
  return { selecionados, extras };
}

function serializeMultiSelect(
  selecionados: string[],
  extras: string[]
): string | null {
  const all = [...selecionados, ...extras.filter((e) => e.trim().length > 0)];
  if (all.length === 0) return null;
  return all.map((s) => `• ${s}`).join("\n");
}

export default function MetadadosPage({
  params,
}: {
  params: Promise<{ idRelatorio: string }>;
}) {
  const { idRelatorio } = use(params);
  const { data: relatorio, isLoading } = useDrpsRelatorio(idRelatorio);
  const salvar = useDrpsSalvarRelatorio();

  const [form, setForm] = useState<Form>(EMPTY);
  const [novoAgravo, setNovoAgravo] = useState("");
  const [novaMedida, setNovaMedida] = useState("");

  useEffect(() => {
    if (isLoading || !relatorio) return;
    const agravos = parseMultiSelect(
      relatorio.agravos_saude_mental,
      AGRAVOS_OPCOES
    );
    const medidas = parseMultiSelect(
      relatorio.medidas_existentes,
      MEDIDAS_EXISTENTES_OPCOES
    );
    setForm({
      status: relatorio.status,
      data_elaboracao: relatorio.data_elaboracao ?? "",
      responsavel_tecnico: relatorio.responsavel_tecnico ?? "",
      crp: relatorio.crp ?? "",
      qtd_homens: relatorio.qtd_homens?.toString() ?? "",
      qtd_mulheres: relatorio.qtd_mulheres?.toString() ?? "",
      agravos_selecionados: agravos.selecionados,
      agravos_extras: agravos.extras,
      medidas_selecionadas: medidas.selecionados,
      medidas_extras: medidas.extras,
    });
  }, [relatorio, isLoading]);

  function toggleAgravo(item: string) {
    setForm((f) => ({
      ...f,
      agravos_selecionados: f.agravos_selecionados.includes(item)
        ? f.agravos_selecionados.filter((a) => a !== item)
        : [...f.agravos_selecionados, item],
    }));
  }

  function toggleMedida(item: string) {
    setForm((f) => ({
      ...f,
      medidas_selecionadas: f.medidas_selecionadas.includes(item)
        ? f.medidas_selecionadas.filter((a) => a !== item)
        : [...f.medidas_selecionadas, item],
    }));
  }

  function adicionarAgravo() {
    const v = novoAgravo.trim();
    if (!v) return;
    setForm((f) => ({ ...f, agravos_extras: [...f.agravos_extras, v] }));
    setNovoAgravo("");
  }

  function removerAgravoExtra(idx: number) {
    setForm((f) => ({
      ...f,
      agravos_extras: f.agravos_extras.filter((_, i) => i !== idx),
    }));
  }

  function adicionarMedida() {
    const v = novaMedida.trim();
    if (!v) return;
    setForm((f) => ({ ...f, medidas_extras: [...f.medidas_extras, v] }));
    setNovaMedida("");
  }

  function removerMedidaExtra(idx: number) {
    setForm((f) => ({
      ...f,
      medidas_extras: f.medidas_extras.filter((_, i) => i !== idx),
    }));
  }

  const totalAgravos = useMemo(
    () => form.agravos_selecionados.length + form.agravos_extras.length,
    [form.agravos_selecionados, form.agravos_extras]
  );

  const totalMedidas = useMemo(
    () => form.medidas_selecionadas.length + form.medidas_extras.length,
    [form.medidas_selecionadas, form.medidas_extras]
  );

  function onSubmit() {
    if (!relatorio) return;
    salvar.mutate({
      id_relatorio: idRelatorio,
      id_empresa: relatorio.id_empresa,
      status: form.status,
      data_elaboracao: form.data_elaboracao || null,
      responsavel_tecnico: form.responsavel_tecnico.trim() || null,
      crp: form.crp.trim() || null,
      qtd_homens: form.qtd_homens ? parseInt(form.qtd_homens) : null,
      qtd_mulheres: form.qtd_mulheres ? parseInt(form.qtd_mulheres) : null,
      agravos_saude_mental: serializeMultiSelect(
        form.agravos_selecionados,
        form.agravos_extras
      ),
      medidas_existentes: serializeMultiSelect(
        form.medidas_selecionadas,
        form.medidas_extras
      ),
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
          <div className="mb-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] text-blue-900">
            As <strong>Funções</strong> e a <strong>Quantidade de Trabalhadores
            na Função</strong> são calculadas automaticamente a partir dos
            respondentes importados (por setor). Aqui você só informa a
            distribuição opcional entre Homens / Mulheres.
          </div>
          <div className="grid gap-3 md:grid-cols-2">
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

        <Section
          titulo={`Possíveis Agravos à Saúde Mental (${totalAgravos} selecionado${totalAgravos === 1 ? "" : "s"})`}
        >
          <p className="mb-2 text-[11px] italic text-gray-500">
            Marque os agravos aplicáveis e adicione outros manualmente, se
            necessário.
          </p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {AGRAVOS_OPCOES.map((opt) => (
              <label
                key={opt}
                className="flex cursor-pointer items-start gap-2 rounded px-2 py-1 hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={form.agravos_selecionados.includes(opt)}
                  onChange={() => toggleAgravo(opt)}
                  className="mt-0.5 rounded border-gray-300 text-verde-primary focus:ring-verde-primary/30"
                />
                <span className="text-sm text-gray-800">{opt}</span>
              </label>
            ))}
          </div>

          {form.agravos_extras.length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                Adicionados manualmente
              </p>
              {form.agravos_extras.map((e, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded bg-amber-50 px-2 py-1"
                >
                  <span className="flex-1 text-sm text-gray-800">{e}</span>
                  <button
                    type="button"
                    onClick={() => removerAgravoExtra(i)}
                    className="text-gray-400 hover:text-red-600"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={novoAgravo}
              onChange={(e) => setNovoAgravo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && adicionarAgravo()}
              placeholder="Adicionar outro agravo..."
              className={inputCls + " flex-1"}
            />
            <button
              type="button"
              onClick={adicionarAgravo}
              disabled={!novoAgravo.trim()}
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <Plus className="size-4" /> Adicionar
            </button>
          </div>
        </Section>

        <Section
          titulo={`Medidas de Controle Existentes (${totalMedidas} selecionada${totalMedidas === 1 ? "" : "s"})`}
        >
          <p className="mb-2 text-[11px] italic text-gray-500">
            Marque as medidas que a empresa já adota e adicione outras
            manualmente, se necessário.
          </p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {MEDIDAS_EXISTENTES_OPCOES.map((opt) => (
              <label
                key={opt}
                className="flex cursor-pointer items-start gap-2 rounded px-2 py-1 hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={form.medidas_selecionadas.includes(opt)}
                  onChange={() => toggleMedida(opt)}
                  className="mt-0.5 rounded border-gray-300 text-verde-primary focus:ring-verde-primary/30"
                />
                <span className="text-sm text-gray-800">{opt}</span>
              </label>
            ))}
          </div>

          {form.medidas_extras.length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                Adicionadas manualmente
              </p>
              {form.medidas_extras.map((e, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded bg-amber-50 px-2 py-1"
                >
                  <span className="flex-1 text-sm text-gray-800">{e}</span>
                  <button
                    type="button"
                    onClick={() => removerMedidaExtra(i)}
                    className="text-gray-400 hover:text-red-600"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={novaMedida}
              onChange={(e) => setNovaMedida(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && adicionarMedida()}
              placeholder="Adicionar outra medida..."
              className={inputCls + " flex-1"}
            />
            <button
              type="button"
              onClick={adicionarMedida}
              disabled={!novaMedida.trim()}
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <Plus className="size-4" /> Adicionar
            </button>
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
