"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Plus, Trash2, Upload } from "lucide-react";
import Modal from "@/components/ui/Modal";
import NivelBadge from "@/components/riscos/NivelBadge";
import SetorMultiSelect from "./SetorMultiSelect";
import MeiosPropagacaoMultiSelect from "./MeiosPropagacaoMultiSelect";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { gerarId } from "@/lib/utils";
import { calcularNivelComMatriz } from "@/lib/calc";
import {
  useMatrizAtiva,
  useMatrizes,
  useTiposRisco,
  usePerguntasPorTipo,
} from "@/lib/hooks/useV3";
import {
  TIPO_ICONE,
  AGENTES_SUGERIDOS,
  PERGUNTAS_QUIMICAS,
  FATORES_ERGONOMICOS,
  FATORES_PSICOSSOCIAIS,
  MEIOS_PROPAGACAO_DEFAULT,
  SITUACOES_DEFAULT,
  TEMPOS_EXPOSICAO_DEFAULT,
  TECNICAS_DEFAULT,
} from "@/lib/constants";
import type {
  Cargo,
  EpiEpc,
  Risco,
  Setor,
  TipoRisco,
} from "@/lib/supabase/types";

interface Props {
  open: boolean;
  onClose: () => void;
  idInspecao: string;
  idEmpresa: string;
  setores: Setor[];
  cargos: Cargo[];
  risco?: Risco | null;
}

interface FormState {
  tipo_risco: string;
  id_matriz: string;
  agente: string;
  fonte_geradora: string;
  ids_setores: string[];
  id_cargo: string;
  probabilidade: string;
  severidade: string;
  meio_propagacao: string[];
  situacao: string;
  tempo_exposicao: string;
  tecnica_utilizada: string;
  concentracao_exposicao: string;
  limite_tolerancia: string;
  insalubridade: string;
  periculosidade: string;
  numero_cas: string;
  via_absorcao: string;
  tipo_agente_biologico: string;
  fator_ergonomico: string;
  fator_psicossocial: string;
  pontuacao_iapat: string;
  fisico_necessita_medicao: string;
  fisico_qual_medicao: string;
  fisico_motivo_medicao: string;
  quim_q1: string;
  quim_q2: string;
  quim_q3: string;
  quim_q4: string;
  quim_q5: string;
  quim_q6: string;
  uso_processo: string;
  foto_quim_url: string;
  medidas_adotadas: string;
  medidas_recomendadas: string;
  observacoes_risco: string;
  respostas_custom: Record<string, string>;
}

function emptyForm(): FormState {
  return {
    tipo_risco: "Físico",
    id_matriz: "",
    agente: "",
    fonte_geradora: "",
    ids_setores: [],
    id_cargo: "",
    probabilidade: "Ocasional",
    severidade: "Marginal",
    meio_propagacao: [],
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
    pontuacao_iapat: "",
    fisico_necessita_medicao: "",
    fisico_qual_medicao: "",
    fisico_motivo_medicao: "",
    quim_q1: "",
    quim_q2: "",
    quim_q3: "",
    quim_q4: "",
    quim_q5: "",
    quim_q6: "",
    uso_processo: "",
    foto_quim_url: "",
    medidas_adotadas: "",
    medidas_recomendadas: "",
    observacoes_risco: "",
    respostas_custom: {},
  };
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
  const [form, setForm] = useState<FormState>(emptyForm);

  // V3: matriz, tipos e perguntas vêm do banco (admin edita pela UI).
  const { data: matrizAtiva } = useMatrizAtiva();
  const { data: matrizes = [] } = useMatrizes();
  const { data: tiposCustom = [] } = useTiposRisco();
  const { data: perguntasCustom = [] } = usePerguntasPorTipo(
    // O id_tipo é o slug correspondente ao nome — busca no array.
    tiposCustom.find((t) => t.nome === form.tipo_risco)?.id_tipo
  );

  // V3.1: cada risco pode ter sua própria matriz. Se não tiver,
  // cai no fallback global (matriz ativa).
  const matrizSelecionada = useMemo(() => {
    if (form.id_matriz) {
      return matrizes.find((m) => m.id_matriz === form.id_matriz) ?? null;
    }
    return matrizAtiva ?? null;
  }, [form.id_matriz, matrizes, matrizAtiva]);

  // Listas dinâmicas vindas da matriz SELECIONADA (não mais da ativa global).
  const probsLista = matrizSelecionada?.probabilidades ?? [
    "Improvável",
    "Remoto",
    "Ocasional",
    "Provável",
    "Frequente",
  ];
  const sevsLista = matrizSelecionada?.severidades ?? [
    "Insignificante",
    "Marginal",
    "Crítico",
    "Catastrófico",
  ];

  useEffect(() => {
    if (!open) return;
    if (risco) {
      setForm({
        tipo_risco: risco.tipo_risco ?? "Físico",
        id_matriz: risco.id_matriz ?? "",
        agente: risco.agente ?? "",
        fonte_geradora: risco.fonte_geradora ?? "",
        ids_setores: risco.id_setor ? [risco.id_setor] : [],
        id_cargo: risco.id_cargo ?? "",
        probabilidade: risco.probabilidade ?? probsLista[Math.floor(probsLista.length / 2)] ?? "",
        severidade: risco.severidade ?? sevsLista[Math.floor(sevsLista.length / 2)] ?? "",
        meio_propagacao: risco.meio_propagacao ?? [],
        situacao: risco.situacao ?? "",
        tempo_exposicao: risco.tempo_exposicao ?? "",
        tecnica_utilizada: risco.tecnica_utilizada ?? "",
        concentracao_exposicao: risco.concentracao_exposicao ?? "",
        limite_tolerancia: risco.limite_tolerancia ?? "",
        insalubridade: risco.insalubridade ?? "",
        periculosidade: risco.periculosidade ?? "",
        numero_cas: risco.numero_cas ?? "",
        via_absorcao: risco.via_absorcao ?? "",
        tipo_agente_biologico: risco.tipo_agente_biologico ?? "",
        fator_ergonomico: risco.fator_ergonomico ?? "",
        fator_psicossocial: risco.fator_psicossocial ?? "",
        pontuacao_iapat: risco.pontuacao_iapat ?? "",
        fisico_necessita_medicao: risco.fisico_necessita_medicao ?? "",
        fisico_qual_medicao: risco.fisico_qual_medicao ?? "",
        fisico_motivo_medicao: risco.fisico_motivo_medicao ?? "",
        quim_q1: risco.quim_q1 ?? "",
        quim_q2: risco.quim_q2 ?? "",
        quim_q3: risco.quim_q3 ?? "",
        quim_q4: risco.quim_q4 ?? "",
        quim_q5: risco.quim_q5 ?? "",
        quim_q6: risco.quim_q6 ?? "",
        uso_processo: risco.uso_processo ?? "",
        foto_quim_url: risco.foto_quim_url ?? "",
        medidas_adotadas: risco.medidas_adotadas ?? "",
        medidas_recomendadas: risco.medidas_recomendadas ?? "",
        observacoes_risco: risco.observacoes_risco ?? "",
        respostas_custom: (risco.respostas_custom ?? {}) as Record<
          string,
          string
        >,
      });
    } else {
      setForm(emptyForm());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, risco]);

  const cargosDoSetor = useMemo(() => {
    const primSetor = form.ids_setores[0];
    if (!primSetor) return [];
    return cargos.filter((c) => c.id_setor === primSetor);
  }, [cargos, form.ids_setores]);

  const nivel = calcularNivelComMatriz(
    form.probabilidade,
    form.severidade,
    matrizSelecionada
  );

  const isFisico = form.tipo_risco === "Físico";
  const isQuimico = form.tipo_risco === "Químico";
  const isBiologico = form.tipo_risco === "Biológico";
  const isErgo = form.tipo_risco === "Ergonômico";
  const isPsico = form.tipo_risco === "Psicossocial";
  const isIapat = form.tipo_risco.startsWith("IAPAT");

  const mutation = useMutation({
    mutationFn: async () => {
      const supabase = createSupabaseBrowserClient();

      const baseRisco: Partial<Risco> = {
        tipo_risco: form.tipo_risco as TipoRisco,
        id_matriz: form.id_matriz || matrizAtiva?.id_matriz || null,
        agente: form.agente.trim() || null,
        fonte_geradora: form.fonte_geradora.trim() || null,
        id_cargo: form.id_cargo || null,
        probabilidade: form.probabilidade,
        severidade: form.severidade,
        nivel_risco: nivel,
        meio_propagacao: form.meio_propagacao.length > 0 ? form.meio_propagacao : null,
        situacao: form.situacao || null,
        tempo_exposicao: form.tempo_exposicao || null,
        tecnica_utilizada: form.tecnica_utilizada || null,
        concentracao_exposicao: form.concentracao_exposicao.trim() || null,
        limite_tolerancia: form.limite_tolerancia.trim() || null,
        insalubridade: form.insalubridade.trim() || null,
        periculosidade: form.periculosidade.trim() || null,
        numero_cas: form.numero_cas.trim() || null,
        via_absorcao: form.via_absorcao.trim() || null,
        tipo_agente_biologico: form.tipo_agente_biologico.trim() || null,
        fator_ergonomico: form.fator_ergonomico.trim() || null,
        fator_psicossocial: form.fator_psicossocial.trim() || null,
        pontuacao_iapat: form.pontuacao_iapat.trim() || null,
        fisico_necessita_medicao: form.fisico_necessita_medicao || null,
        fisico_qual_medicao: form.fisico_qual_medicao.trim() || null,
        fisico_motivo_medicao: form.fisico_motivo_medicao.trim() || null,
        quim_q1: form.quim_q1 || null,
        quim_q2: form.quim_q2 || null,
        quim_q3: form.quim_q3 || null,
        quim_q4: form.quim_q4 || null,
        quim_q5: form.quim_q5 || null,
        quim_q6: form.quim_q6 || null,
        uso_processo: form.uso_processo.trim() || null,
        foto_quim_url: form.foto_quim_url || null,
        medidas_adotadas: form.medidas_adotadas.trim() || null,
        medidas_recomendadas: form.medidas_recomendadas.trim() || null,
        observacoes_risco: form.observacoes_risco.trim() || null,
        respostas_custom:
          Object.keys(form.respostas_custom).length > 0
            ? form.respostas_custom
            : null,
        updated_at: new Date().toISOString(),
      };

      if (isEdit && risco) {
        // Atualiza o risco original com o primeiro setor.
        const primeiroSetor = form.ids_setores[0] || null;
        const { error: errUpdate } = await supabase
          .from("riscos")
          .update({ ...baseRisco, id_setor: primeiroSetor } as never)
          .eq("id_risco", risco.id_risco);
        if (errUpdate) throw errUpdate;

        // Setores adicionais → cria riscos novos clonados.
        const extras = form.ids_setores.slice(1);
        if (extras.length > 0) {
          const novos = extras.map((idSetor) => ({
            ...baseRisco,
            id_risco: gerarId("RSC"),
            id_inspecao: idInspecao,
            id_empresa: idEmpresa,
            id_setor: idSetor,
            created_at: new Date().toISOString(),
          }));
          const { error: errExtra } = await supabase
            .from("riscos")
            .insert(novos as never);
          if (errExtra) throw errExtra;
        }
        return { criados: 1, extras: extras.length };
      }

      // Criação nova: 1 risco por setor selecionado (mín. 1).
      const setoresParaCriar =
        form.ids_setores.length > 0 ? form.ids_setores : [null];
      const novos = setoresParaCriar.map((idSetor) => ({
        ...baseRisco,
        id_risco: gerarId("RSC"),
        id_inspecao: idInspecao,
        id_empresa: idEmpresa,
        id_setor: idSetor,
        created_at: new Date().toISOString(),
      }));

      const { error } = await supabase.from("riscos").insert(novos as never);
      if (error) throw error;
      return { criados: novos.length, extras: 0 };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["inspecao", idInspecao] });
      const total = res.criados + res.extras;
      if (total > 1) {
        toast.success(`${total} risco(s) criado(s), um por setor ✓`);
      } else {
        toast.success(isEdit ? "Risco atualizado" : "Risco adicionado");
      }
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.agente.trim()) {
      toast.error("Informe o agente do risco");
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
        {/* Linha 1: Tipo + Setores */}
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className={lblCls}>Tipo de Risco *</label>
            <select
              value={form.tipo_risco}
              onChange={(e) =>
                setForm({ ...form, tipo_risco: e.target.value })
              }
              className={inputCls}
            >
              {tiposCustom.map((t) => (
                <option key={t.id_tipo} value={t.nome}>
                  {t.icone ?? "•"} {t.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={lblCls}>Setor(es) / GHE</label>
            <SetorMultiSelect
              setores={setores}
              value={form.ids_setores}
              onChange={(ids) =>
                setForm({ ...form, ids_setores: ids, id_cargo: "" })
              }
            />
          </div>
        </div>

        {/* Linha 2: Agente + Fonte */}
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className={lblCls}>Agente / Risco *</label>
            <input
              list="agentes-sugeridos"
              type="text"
              value={form.agente}
              onChange={(e) => setForm({ ...form, agente: e.target.value })}
              className={inputCls}
              required
              placeholder="Ex: Ruído contínuo, Cloreto de sódio..."
            />
            <datalist id="agentes-sugeridos">
              {(
                (AGENTES_SUGERIDOS as Record<string, string[]>)[
                  form.tipo_risco
                ] ?? []
              ).map((s: string) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div>
            <label className={lblCls}>Fonte Geradora</label>
            <input
              type="text"
              value={form.fonte_geradora}
              onChange={(e) =>
                setForm({ ...form, fonte_geradora: e.target.value })
              }
              className={inputCls}
            />
          </div>
        </div>

        {/* Cargo (opcional, baseado no 1º setor) */}
        {cargosDoSetor.length > 0 && (
          <div>
            <label className={lblCls}>Cargo (opcional)</label>
            <select
              value={form.id_cargo}
              onChange={(e) => setForm({ ...form, id_cargo: e.target.value })}
              className={inputCls}
            >
              <option value="">— Aplica a todos os cargos do setor —</option>
              {cargosDoSetor.map((c) => (
                <option key={c.id_cargo} value={c.id_cargo}>
                  {c.cargo}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Caracterização da exposição */}
        <SubGrid title="Caracterização da Exposição">
          <Field label="Meio de Propagação">
            <MeiosPropagacaoMultiSelect
              options={MEIOS_PROPAGACAO_DEFAULT}
              value={form.meio_propagacao}
              onChange={(meios) =>
                setForm({ ...form, meio_propagacao: meios })
              }
            />
          </Field>
          <Field label="Situação">
            <select
              value={form.situacao}
              onChange={(e) => setForm({ ...form, situacao: e.target.value })}
              className={inputCls}
            >
              <option value="">—</option>
              {SITUACOES_DEFAULT.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tempo de Exposição">
            <select
              value={form.tempo_exposicao}
              onChange={(e) =>
                setForm({ ...form, tempo_exposicao: e.target.value })
              }
              className={inputCls}
            >
              <option value="">—</option>
              {TEMPOS_EXPOSICAO_DEFAULT.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Técnica Utilizada">
            <select
              value={form.tecnica_utilizada}
              onChange={(e) =>
                setForm({ ...form, tecnica_utilizada: e.target.value })
              }
              className={inputCls}
            >
              <option value="">—</option>
              {TECNICAS_DEFAULT.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
        </SubGrid>

        {/* Avaliação (matriz) */}
        <section className="rounded-lg bg-gray-50 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Avaliação (Matriz de Risco)
            </p>
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-medium text-gray-600">
                Matriz:
              </label>
              <select
                value={form.id_matriz}
                onChange={(e) => {
                  const novaId = e.target.value;
                  const nova = matrizes.find((m) => m.id_matriz === novaId);
                  // Reseta prob/sev se não existirem na nova matriz.
                  setForm((f) => ({
                    ...f,
                    id_matriz: novaId,
                    probabilidade:
                      nova?.probabilidades.includes(f.probabilidade)
                        ? f.probabilidade
                        : nova?.probabilidades[
                            Math.floor(nova.probabilidades.length / 2)
                          ] ?? f.probabilidade,
                    severidade: nova?.severidades.includes(f.severidade)
                      ? f.severidade
                      : nova?.severidades[
                          Math.floor(nova.severidades.length / 2)
                        ] ?? f.severidade,
                  }));
                }}
                className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary/30"
              >
                <option value="">
                  Padrão (ativa: {matrizAtiva?.nome ?? "—"})
                </option>
                {matrizes.map((m) => (
                  <option key={m.id_matriz} value={m.id_matriz}>
                    {m.nome}
                    {m.ativa ? " ⭐" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3 md:items-end">
            <Field label="Probabilidade">
              <select
                value={form.probabilidade}
                onChange={(e) =>
                  setForm({ ...form, probabilidade: e.target.value })
                }
                className={inputCls}
              >
                {probsLista.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Severidade">
              <select
                value={form.severidade}
                onChange={(e) =>
                  setForm({ ...form, severidade: e.target.value })
                }
                className={inputCls}
              >
                {sevsLista.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Nível Calculado">
              <div className="mt-1 flex h-[38px] items-center">
                <NivelBadge nivel={nivel} />
              </div>
            </Field>
          </div>
        </section>

        {/* Perguntas Customizadas (V3) — definidas pelo Admin em /config */}
        {perguntasCustom.length > 0 && (
          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Perguntas — {form.tipo_risco}
            </p>
            <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-3">
              {perguntasCustom.map((p) => {
                const valor = form.respostas_custom[p.chave] ?? "";
                const setVal = (v: string) =>
                  setForm({
                    ...form,
                    respostas_custom: {
                      ...form.respostas_custom,
                      [p.chave]: v,
                    },
                  });
                return (
                  <div
                    key={p.id_pergunta}
                    className={
                      p.input_type === "select"
                        ? "grid grid-cols-[1fr_auto] items-center gap-3"
                        : "space-y-1"
                    }
                  >
                    <label className="text-sm text-gray-700">
                      {p.texto}
                      {p.obrigatoria && (
                        <span className="ml-1 text-red-alert">*</span>
                      )}
                    </label>
                    {p.input_type === "select" ? (
                      <select
                        value={valor}
                        onChange={(e) => setVal(e.target.value)}
                        className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary/30"
                      >
                        <option value="">—</option>
                        {p.opcoes.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    ) : p.input_type === "textarea" ? (
                      <textarea
                        value={valor}
                        onChange={(e) => setVal(e.target.value)}
                        rows={2}
                        className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary/30"
                      />
                    ) : (
                      <input
                        type="text"
                        value={valor}
                        onChange={(e) => setVal(e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary/30"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Específico FÍSICO */}
        {isFisico && (
          <SubGrid title="Detalhes — Físico">
            <Field label="Necessita medição?">
              <select
                value={form.fisico_necessita_medicao}
                onChange={(e) =>
                  setForm({
                    ...form,
                    fisico_necessita_medicao: e.target.value,
                  })
                }
                className={inputCls}
              >
                <option value="">—</option>
                <option value="Sim">Sim</option>
                <option value="Não">Não</option>
                <option value="N/A">N/A</option>
              </select>
            </Field>
            <Field label="Qual medição">
              <input
                value={form.fisico_qual_medicao}
                onChange={(e) =>
                  setForm({ ...form, fisico_qual_medicao: e.target.value })
                }
                className={inputCls}
              />
            </Field>
            <Field label="Motivo">
              <input
                value={form.fisico_motivo_medicao}
                onChange={(e) =>
                  setForm({ ...form, fisico_motivo_medicao: e.target.value })
                }
                className={inputCls}
              />
            </Field>
            <Field label="Concentração / Nível medido">
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
            <Field label="Insalubridade (NR-15)">
              <input
                value={form.insalubridade}
                onChange={(e) =>
                  setForm({ ...form, insalubridade: e.target.value })
                }
                className={inputCls}
                placeholder="Grau ou %"
              />
            </Field>
          </SubGrid>
        )}

        {/* Específico QUÍMICO */}
        {isQuimico && (
          <>
            <SubGrid title="Detalhes — Químico">
              <Field label="Número CAS">
                <input
                  value={form.numero_cas}
                  onChange={(e) =>
                    setForm({ ...form, numero_cas: e.target.value })
                  }
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
              <Field label="Uso / Processo">
                <input
                  value={form.uso_processo}
                  onChange={(e) =>
                    setForm({ ...form, uso_processo: e.target.value })
                  }
                  className={inputCls}
                />
              </Field>
              <Field label="Periculosidade (NR-16)">
                <input
                  value={form.periculosidade}
                  onChange={(e) =>
                    setForm({ ...form, periculosidade: e.target.value })
                  }
                  className={inputCls}
                />
              </Field>
            </SubGrid>

            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Avaliação Qualitativa
              </p>
              <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-3">
                {PERGUNTAS_QUIMICAS.map((q) => (
                  <div
                    key={q.id}
                    className="grid grid-cols-[1fr_auto] items-center gap-3"
                  >
                    <span className="text-sm text-gray-700">{q.texto}</span>
                    <select
                      value={form[q.id as keyof FormState] as string}
                      onChange={(e) =>
                        setForm({ ...form, [q.id]: e.target.value })
                      }
                      className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary/30"
                    >
                      <option value="">—</option>
                      <option value="Sim">Sim</option>
                      <option value="Não">Não</option>
                      <option value="Parcial">Parcial</option>
                      <option value="N/A">N/A</option>
                    </select>
                  </div>
                ))}
              </div>
            </section>

            <FotoQuimUpload
              value={form.foto_quim_url}
              idInspecao={idInspecao}
              idEmpresa={idEmpresa}
              onChange={(url) => setForm({ ...form, foto_quim_url: url })}
            />
          </>
        )}

        {/* Específico BIOLÓGICO */}
        {isBiologico && (
          <SubGrid title="Detalhes — Biológico">
            <Field label="Tipo de agente biológico">
              <input
                value={form.tipo_agente_biologico}
                onChange={(e) =>
                  setForm({ ...form, tipo_agente_biologico: e.target.value })
                }
                className={inputCls}
                placeholder="Ex: Vírus, Bactéria, Fungo..."
              />
            </Field>
          </SubGrid>
        )}

        {/* Específico ERGONÔMICO */}
        {isErgo && (
          <SubGrid title="Detalhes — Ergonômico">
            <Field label="Fator ergonômico">
              <input
                list="fatores-ergo"
                value={form.fator_ergonomico}
                onChange={(e) =>
                  setForm({ ...form, fator_ergonomico: e.target.value })
                }
                className={inputCls}
              />
              <datalist id="fatores-ergo">
                {FATORES_ERGONOMICOS.map((f) => (
                  <option key={f} value={f} />
                ))}
              </datalist>
            </Field>
          </SubGrid>
        )}

        {/* Específico PSICOSSOCIAL */}
        {isPsico && (
          <SubGrid title="Detalhes — Psicossocial">
            <Field label="Fator psicossocial">
              <input
                list="fatores-psico"
                value={form.fator_psicossocial}
                onChange={(e) =>
                  setForm({ ...form, fator_psicossocial: e.target.value })
                }
                className={inputCls}
              />
              <datalist id="fatores-psico">
                {FATORES_PSICOSSOCIAIS.map((f) => (
                  <option key={f} value={f} />
                ))}
              </datalist>
            </Field>
          </SubGrid>
        )}

        {/* IAPAT */}
        {isIapat && (
          <SubGrid title="Detalhes — IAPAT">
            <Field label="Pontuação IAPAT">
              <input
                value={form.pontuacao_iapat}
                onChange={(e) =>
                  setForm({ ...form, pontuacao_iapat: e.target.value })
                }
                className={inputCls}
                placeholder="Pontuação ou nota IAPAT"
              />
            </Field>
          </SubGrid>
        )}

        {/* Medidas + observações */}
        <Field label="Medidas Já Adotadas">
          <textarea
            value={form.medidas_adotadas}
            onChange={(e) =>
              setForm({ ...form, medidas_adotadas: e.target.value })
            }
            rows={2}
            className={inputCls}
          />
        </Field>
        <Field label="Medidas Recomendadas">
          <textarea
            value={form.medidas_recomendadas}
            onChange={(e) =>
              setForm({ ...form, medidas_recomendadas: e.target.value })
            }
            rows={2}
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

        {/* EPIs/EPCs inline (só editing) */}
        {isEdit && risco && (
          <EpiInline
            idRisco={risco.id_risco}
            idInspecao={idInspecao}
            idEmpresa={idEmpresa}
            idSetor={risco.id_setor}
          />
        )}

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
            {mutation.isPending
              ? "Salvando..."
              : isEdit
              ? "Salvar"
              : `💾 Adicionar ${
                  form.ids_setores.length > 1
                    ? `(${form.ids_setores.length} riscos)`
                    : ""
                }`}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// =============================================================
// SUBCOMPONENTE: Upload de Foto Química (FDS)
// =============================================================

function FotoQuimUpload({
  value,
  idInspecao,
  idEmpresa,
  onChange,
}: {
  value: string;
  idInspecao: string;
  idEmpresa: string;
  onChange: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${idEmpresa}/${idInspecao}/quim_${gerarId("FDS")}.${ext}`;
      const { error } = await supabase.storage
        .from("fotos")
        .upload(path, file, { upsert: false });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("fotos").getPublicUrl(path);
      onChange(pub.publicUrl);
      toast.success("Foto FDS enviada");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao enviar foto";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <label className={lblCls}>Foto da FDS / Rótulo (opcional)</label>
      <div className="mt-1 flex items-center gap-3">
        {value && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt="FDS"
            className="size-16 rounded-md border border-gray-200 object-cover"
          />
        )}
        <label
          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50 ${
            uploading ? "opacity-50" : ""
          }`}
        >
          <Upload className="size-4" />
          {uploading ? "Enviando..." : value ? "Trocar foto" : "Enviar foto"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={handleFile}
          />
        </label>
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-xs text-red-alert hover:underline"
          >
            Remover
          </button>
        )}
      </div>
    </div>
  );
}

// =============================================================
// SUBCOMPONENTE: EPI/EPC inline (só aparece editing)
// =============================================================

function EpiInline({
  idRisco,
  idInspecao,
  idEmpresa,
  idSetor,
}: {
  idRisco: string;
  idInspecao: string;
  idEmpresa: string;
  idSetor: string | null;
}) {
  const qc = useQueryClient();
  const [novo, setNovo] = useState({
    tipo: "EPI" as "EPI" | "EPC",
    descricao: "",
    ca: "",
    recomendado: "Sim" as "Sim" | "Não",
  });

  const { data: lista = [], isLoading } = useQuery({
    queryKey: ["epi-risco", idRisco],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("epi_epc")
        .select("*")
        .eq("id_risco", idRisco);
      if (error) throw error;
      return (data ?? []) as unknown as EpiEpc[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!novo.descricao.trim()) throw new Error("Descrição obrigatória");
      const supabase = createSupabaseBrowserClient();
      const row = {
        id_protecao: gerarId("EPI"),
        id_risco: idRisco,
        id_inspecao: idInspecao,
        id_empresa: idEmpresa,
        id_setor: idSetor,
        tipo: novo.tipo,
        descricao: novo.descricao.trim(),
        ca: novo.ca.trim() || null,
        recomendado: novo.recomendado,
      };
      const { error } = await supabase.from("epi_epc").insert(row as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["epi-risco", idRisco] });
      qc.invalidateQueries({ queryKey: ["inspecao", idInspecao] });
      setNovo({ tipo: "EPI", descricao: "", ca: "", recomendado: "Sim" });
      toast.success("Adicionado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("epi_epc")
        .delete()
        .eq("id_protecao", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["epi-risco", idRisco] });
      qc.invalidateQueries({ queryKey: ["inspecao", idInspecao] });
      toast.success("Removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
        EPIs e EPCs vinculados a este risco
      </p>
      <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-3">
        {isLoading ? (
          <p className="text-sm text-gray-500">Carregando...</p>
        ) : lista.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum EPI/EPC vinculado.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {lista.map((e) => (
              <li
                key={e.id_protecao}
                className="flex items-center justify-between py-1.5"
              >
                <div className="flex items-center gap-2 text-sm">
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-700">
                    {e.tipo}
                  </span>
                  <span className="font-medium text-gray-900">
                    {e.descricao}
                  </span>
                  {e.ca && (
                    <span className="text-xs text-gray-500">CA: {e.ca}</span>
                  )}
                  {e.recomendado && (
                    <span className="text-xs text-gray-500">
                      · {e.recomendado}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => del.mutate(e.id_protecao)}
                  className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-alert"
                  title="Remover"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="grid grid-cols-[80px_1fr_120px_90px_auto] items-center gap-2 border-t border-gray-100 pt-2">
          <select
            value={novo.tipo}
            onChange={(ev) =>
              setNovo({ ...novo, tipo: ev.target.value as "EPI" | "EPC" })
            }
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="EPI">EPI</option>
            <option value="EPC">EPC</option>
          </select>
          <input
            type="text"
            value={novo.descricao}
            onChange={(ev) => setNovo({ ...novo, descricao: ev.target.value })}
            placeholder="Descrição"
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
          <input
            type="text"
            value={novo.ca}
            onChange={(ev) => setNovo({ ...novo, ca: ev.target.value })}
            placeholder="CA"
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
          <select
            value={novo.recomendado}
            onChange={(ev) =>
              setNovo({
                ...novo,
                recomendado: ev.target.value as "Sim" | "Não",
              })
            }
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="Sim">Sim</option>
            <option value="Não">Não</option>
          </select>
          <button
            type="button"
            onClick={() => add.mutate()}
            disabled={add.isPending}
            className="inline-flex items-center gap-1 rounded-md bg-verde-primary px-2.5 py-1.5 text-xs font-medium text-white hover:bg-verde-accent disabled:opacity-50"
          >
            <Plus className="size-3.5" /> Add
          </button>
        </div>
      </div>
    </section>
  );
}

// =============================================================
// Estilos compartilhados
// =============================================================

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
