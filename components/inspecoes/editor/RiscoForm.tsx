"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import NivelBadge from "@/components/riscos/NivelBadge";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { gerarId, calcularNivelRisco, PROBABILIDADES, SEVERIDADES } from "@/lib/utils";
import { TIPOS_RISCO, TIPO_ICONE } from "@/lib/constants";
import type { Cargo, Risco, Setor, TipoRisco } from "@/lib/supabase/types";

interface Props {
  open: boolean;
  onClose: () => void;
  idInspecao: string;
  idEmpresa: string;
  setores: Setor[];
  cargos: Cargo[];
  risco?: Risco | null;
}

export default function RiscoForm({
  open,
  onClose,
  idInspecao,
  idEmpresa,
  setores,
  cargos,
  risco,
}: Props) {
  const qc = useQueryClient();
  const isEdit = !!risco;

  const [form, setForm] = useState({
    tipo_risco: "Físico" as TipoRisco,
    agente: "",
    fonte_geradora: "",
    id_setor: "",
    id_cargo: "",
    probabilidade: PROBABILIDADES[2] as string,
    severidade: SEVERIDADES[2] as string,
    medio_propagacao: "",
    situacao: "",
    tempo_exposicao: "",
    tecnica_utilizada: "",
    concentracao_exposicao: "",
    limite_tolerancia: "",
    insalubridade: "",
    periculosidade: "",
    numero_cas: "",
    via_absorcao: "",
    tipo_agente_biologico: "",
    fator_ergonomico: "",
    fator_psicossocial: "",
    medidas_adotadas: "",
    medidas_recomendadas: "",
    observacoes_risco: "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        tipo_risco: (risco?.tipo_risco as TipoRisco) ?? "Físico",
        agente: risco?.agente ?? "",
        fonte_geradora: risco?.fonte_geradora ?? "",
        id_setor: risco?.id_setor ?? setores[0]?.id_setor ?? "",
        id_cargo: risco?.id_cargo ?? "",
        probabilidade: risco?.probabilidade ?? PROBABILIDADES[2],
        severidade: risco?.severidade ?? SEVERIDADES[2],
        medio_propagacao: risco?.medio_propagacao ?? "",
        situacao: risco?.situacao ?? "",
        tempo_exposicao: risco?.tempo_exposicao ?? "",
        tecnica_utilizada: risco?.tecnica_utilizada ?? "",
        concentracao_exposicao: risco?.concentracao_exposicao ?? "",
        limite_tolerancia: risco?.limite_tolerancia ?? "",
        insalubridade: risco?.insalubridade ?? "",
        periculosidade: risco?.periculosidade ?? "",
        numero_cas: risco?.numero_cas ?? "",
        via_absorcao: risco?.via_absorcao ?? "",
        tipo_agente_biologico: risco?.tipo_agente_biologico ?? "",
        fator_ergonomico: risco?.fator_ergonomico ?? "",
        fator_psicossocial: risco?.fator_psicossocial ?? "",
        medidas_adotadas: risco?.medidas_adotadas ?? "",
        medidas_recomendadas: risco?.medidas_recomendadas ?? "",
        observacoes_risco: risco?.observacoes_risco ?? "",
      });
    }
  }, [open, risco, setores]);

  const cargosDoSetor = useMemo(
    () => cargos.filter((c) => c.id_setor === form.id_setor),
    [cargos, form.id_setor]
  );

  const nivel = calcularNivelRisco(form.probabilidade, form.severidade);

  const mutation = useMutation({
    mutationFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const payload: Partial<Risco> = {
        tipo_risco: form.tipo_risco,
        agente: form.agente.trim() || null,
        fonte_geradora: form.fonte_geradora.trim() || null,
        id_setor: form.id_setor || null,
        id_cargo: form.id_cargo || null,
        probabilidade: form.probabilidade,
        severidade: form.severidade,
        nivel_risco: nivel,
        medio_propagacao: form.medio_propagacao.trim() || null,
        situacao: form.situacao.trim() || null,
        tempo_exposicao: form.tempo_exposicao.trim() || null,
        tecnica_utilizada: form.tecnica_utilizada.trim() || null,
        concentracao_exposicao: form.concentracao_exposicao.trim() || null,
        limite_tolerancia: form.limite_tolerancia.trim() || null,
        insalubridade: form.insalubridade.trim() || null,
        periculosidade: form.periculosidade.trim() || null,
        numero_cas: form.numero_cas.trim() || null,
        via_absorcao: form.via_absorcao.trim() || null,
        tipo_agente_biologico: form.tipo_agente_biologico.trim() || null,
        fator_ergonomico: form.fator_ergonomico.trim() || null,
        fator_psicossocial: form.fator_psicossocial.trim() || null,
        medidas_adotadas: form.medidas_adotadas.trim() || null,
        medidas_recomendadas: form.medidas_recomendadas.trim() || null,
        observacoes_risco: form.observacoes_risco.trim() || null,
      };

      if (isEdit && risco) {
        const { error } = await supabase
          .from("riscos")
          .update(payload as never)
          .eq("id_risco", risco.id_risco);
        if (error) throw error;
      } else {
        const row = {
          id_risco: gerarId("RSC"),
          id_inspecao: idInspecao,
          id_empresa: idEmpresa,
          ...payload,
        };
        const { error } = await supabase.from("riscos").insert(row as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inspecao", idInspecao] });
      toast.success(isEdit ? "Risco atualizado" : "Risco adicionado");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.agente.trim()) {
      toast.error("Agente é obrigatório");
      return;
    }
    mutation.mutate();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar Risco" : "Novo Risco"}
      size="xl"
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <section className="grid gap-3 md:grid-cols-2">
          <div>
            <label className={lblCls}>Tipo de Risco *</label>
            <select
              value={form.tipo_risco}
              onChange={(e) =>
                setForm({ ...form, tipo_risco: e.target.value as TipoRisco })
              }
              className={inputCls}
            >
              {TIPOS_RISCO.map((t) => (
                <option key={t} value={t}>
                  {TIPO_ICONE[t] ?? "•"} {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={lblCls}>Agente *</label>
            <input
              type="text"
              value={form.agente}
              onChange={(e) => setForm({ ...form, agente: e.target.value })}
              className={inputCls}
              required
              placeholder="Ex: Ruído contínuo, Cloreto de sódio..."
            />
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-2">
          <div>
            <label className={lblCls}>Setor</label>
            <select
              value={form.id_setor}
              onChange={(e) =>
                setForm({ ...form, id_setor: e.target.value, id_cargo: "" })
              }
              className={inputCls}
            >
              <option value="">—</option>
              {setores.map((s) => (
                <option key={s.id_setor} value={s.id_setor}>
                  {s.setor_ghe}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={lblCls}>Cargo</label>
            <select
              value={form.id_cargo}
              onChange={(e) => setForm({ ...form, id_cargo: e.target.value })}
              className={inputCls}
              disabled={!form.id_setor}
            >
              <option value="">—</option>
              {cargosDoSetor.map((c) => (
                <option key={c.id_cargo} value={c.id_cargo}>
                  {c.cargo}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section>
          <label className={lblCls}>Fonte Geradora</label>
          <input
            type="text"
            value={form.fonte_geradora}
            onChange={(e) =>
              setForm({ ...form, fonte_geradora: e.target.value })
            }
            className={inputCls}
          />
        </section>

        <section className="rounded-lg bg-gray-50 p-4">
          <div className="grid gap-3 md:grid-cols-3 md:items-end">
            <div>
              <label className={lblCls}>Probabilidade</label>
              <select
                value={form.probabilidade}
                onChange={(e) =>
                  setForm({ ...form, probabilidade: e.target.value })
                }
                className={inputCls}
              >
                {PROBABILIDADES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={lblCls}>Severidade / Efeito</label>
              <select
                value={form.severidade}
                onChange={(e) =>
                  setForm({ ...form, severidade: e.target.value })
                }
                className={inputCls}
              >
                {SEVERIDADES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={lblCls}>Nível Calculado</label>
              <div className="mt-1 flex h-[38px] items-center">
                <NivelBadge nivel={nivel} />
              </div>
            </div>
          </div>
        </section>

        {/* Campos específicos por tipo */}
        {form.tipo_risco === "Físico" && (
          <SubGrid title="Detalhes — Físico">
            <Field label="Técnica utilizada">
              <input
                value={form.tecnica_utilizada}
                onChange={(e) =>
                  setForm({ ...form, tecnica_utilizada: e.target.value })
                }
                className={inputCls}
              />
            </Field>
            <Field label="Nível medido / Concentração">
              <input
                value={form.concentracao_exposicao}
                onChange={(e) =>
                  setForm({
                    ...form,
                    concentracao_exposicao: e.target.value,
                  })
                }
                className={inputCls}
              />
            </Field>
            <Field label="Limite de Tolerância (LT)">
              <input
                value={form.limite_tolerancia}
                onChange={(e) =>
                  setForm({ ...form, limite_tolerancia: e.target.value })
                }
                className={inputCls}
              />
            </Field>
          </SubGrid>
        )}

        {form.tipo_risco === "Químico" && (
          <SubGrid title="Detalhes — Químico">
            <Field label="Número CAS">
              <input
                value={form.numero_cas}
                onChange={(e) => setForm({ ...form, numero_cas: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Via de absorção">
              <input
                value={form.via_absorcao}
                onChange={(e) =>
                  setForm({ ...form, via_absorcao: e.target.value })
                }
                className={inputCls}
              />
            </Field>
            <Field label="Concentração / Exposição">
              <input
                value={form.concentracao_exposicao}
                onChange={(e) =>
                  setForm({
                    ...form,
                    concentracao_exposicao: e.target.value,
                  })
                }
                className={inputCls}
              />
            </Field>
          </SubGrid>
        )}

        {form.tipo_risco === "Biológico" && (
          <SubGrid title="Detalhes — Biológico">
            <Field label="Tipo de agente biológico">
              <input
                value={form.tipo_agente_biologico}
                onChange={(e) =>
                  setForm({ ...form, tipo_agente_biologico: e.target.value })
                }
                className={inputCls}
              />
            </Field>
          </SubGrid>
        )}

        {form.tipo_risco === "Ergonômico" && (
          <SubGrid title="Detalhes — Ergonômico">
            <Field label="Fator ergonômico">
              <input
                value={form.fator_ergonomico}
                onChange={(e) =>
                  setForm({ ...form, fator_ergonomico: e.target.value })
                }
                className={inputCls}
              />
            </Field>
          </SubGrid>
        )}

        {form.tipo_risco === "Psicossocial" && (
          <SubGrid title="Detalhes — Psicossocial">
            <Field label="Fator psicossocial">
              <input
                value={form.fator_psicossocial}
                onChange={(e) =>
                  setForm({ ...form, fator_psicossocial: e.target.value })
                }
                className={inputCls}
              />
            </Field>
          </SubGrid>
        )}

        <section className="grid gap-3 md:grid-cols-2">
          <Field label="Tempo de Exposição">
            <input
              value={form.tempo_exposicao}
              onChange={(e) =>
                setForm({ ...form, tempo_exposicao: e.target.value })
              }
              className={inputCls}
            />
          </Field>
          <Field label="Meio de Propagação">
            <input
              value={form.medio_propagacao}
              onChange={(e) =>
                setForm({ ...form, medio_propagacao: e.target.value })
              }
              className={inputCls}
            />
          </Field>
        </section>

        <Field label="Medidas Já Adotadas">
          <textarea
            value={form.medidas_adotadas}
            onChange={(e) =>
              setForm({ ...form, medidas_adotadas: e.target.value })
            }
            rows={3}
            className={inputCls}
          />
        </Field>
        <Field label="Medidas Recomendadas">
          <textarea
            value={form.medidas_recomendadas}
            onChange={(e) =>
              setForm({ ...form, medidas_recomendadas: e.target.value })
            }
            rows={3}
            className={inputCls}
          />
        </Field>
        <Field label="Observações">
          <textarea
            value={form.observacoes_risco}
            onChange={(e) =>
              setForm({ ...form, observacoes_risco: e.target.value })
            }
            rows={2}
            className={inputCls}
          />
        </Field>

        <div className="flex justify-end gap-2 border-t border-gray-200 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-60"
          >
            {mutation.isPending ? "Salvando..." : isEdit ? "Salvar" : "Adicionar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const inputCls =
  "mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30";
const lblCls = "text-sm font-medium text-gray-700";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={lblCls}>{label}</label>
      {children}
    </div>
  );
}

function SubGrid({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
        {title}
      </p>
      <div className="grid gap-3 rounded-lg border border-gray-200 bg-white p-3 md:grid-cols-3">
        {children}
      </div>
    </section>
  );
}
