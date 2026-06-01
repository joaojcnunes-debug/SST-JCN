"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import FotoSlots, { uploadFotoSlots, type FotoSlot } from "@/components/ui/FotoSlots";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { gerarId } from "@/lib/utils";
import { useTipoIcone } from "@/lib/hooks/useV3";
import type { EpiEpc, Risco, Setor } from "@/lib/supabase/types";

interface Props {
  open: boolean;
  onClose: () => void;
  idInspecao: string;
  idEmpresa: string;
  setores: Setor[];
  riscos: Risco[];
  epi?: EpiEpc | null;
}

function buildSlots(urls: string[], paths: string[]): (FotoSlot | null)[] {
  const base: (FotoSlot | null)[] = [null, null, null, null];
  urls.forEach((url, i) => {
    if (i < 4) base[i] = { type: "existing", url, path: paths[i] ?? "" };
  });
  return base;
}

export default function EpiForm({
  open,
  onClose,
  idInspecao,
  idEmpresa,
  setores,
  riscos,
  epi,
}: Props) {
  const qc = useQueryClient();
  const iconeDe = useTipoIcone();
  const isEdit = !!epi;

  // Setor filtro — afeta só a lista de riscos exibida, não é persistido
  const [idSetorFiltro, setIdSetorFiltro] = useState<string>("");

  const [form, setForm] = useState({
    id_risco: "",
    tipo: "EPI" as "EPI" | "EPC",
    descricao: "",
    ca: "",
    recomendado: "Sim" as "Sim" | "Não",
  });
  const [slots, setSlots] = useState<(FotoSlot | null)[]>([null, null, null, null]);

  useEffect(() => {
    if (!open) return;
    // Inicializa o setor filtro a partir do risco vinculado (ou do EPI)
    const riscoDoEpi = riscos.find((r) => r.id_risco === epi?.id_risco);
    setIdSetorFiltro(riscoDoEpi?.id_setor ?? epi?.id_setor ?? "");
    setForm({
      id_risco: epi?.id_risco ?? "",
      tipo: (epi?.tipo as "EPI" | "EPC") ?? "EPI",
      descricao: epi?.descricao ?? "",
      ca: epi?.ca ?? "",
      recomendado: (epi?.recomendado as "Sim" | "Não") ?? "Sim",
    });
    setSlots(buildSlots(epi?.fotos_urls ?? [], epi?.fotos_storage_paths ?? []));
  }, [open, epi, riscos]);

  // Riscos filtrados pelo setor selecionado
  const riscosFiltrados = useMemo(
    () =>
      idSetorFiltro
        ? riscos.filter((r) => r.id_setor === idSetorFiltro)
        : riscos,
    [riscos, idSetorFiltro],
  );

  // Quando muda o setor, limpa o risco se ele não pertence ao novo setor
  function handleSetorChange(novoSetor: string) {
    setIdSetorFiltro(novoSetor);
    const riscoAtual = riscos.find((r) => r.id_risco === form.id_risco);
    if (novoSetor && riscoAtual?.id_setor !== novoSetor) {
      setForm((f) => ({ ...f, id_risco: "" }));
    }
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const r = riscos.find((x) => x.id_risco === form.id_risco);
      const idProtecao = epi?.id_protecao ?? gerarId("EPI");

      const { urls, paths } = await uploadFotoSlots(
        supabase,
        slots,
        epi?.fotos_storage_paths ?? [],
        "fotos",
        `epi_epc/${idEmpresa}/${idInspecao}`,
        gerarId,
      );

      const payload = {
        id_risco: form.id_risco,
        tipo: form.tipo,
        descricao: form.descricao.trim(),
        ca: form.ca.trim() || null,
        recomendado: form.recomendado,
        id_setor: r?.id_setor ?? null,
        fotos_urls: urls,
        fotos_storage_paths: paths,
      };

      if (isEdit && epi) {
        const { error } = await supabase
          .from("epi_epc")
          .update(payload as never)
          .eq("id_protecao", epi.id_protecao);
        if (error) throw error;
      } else {
        const row = {
          id_protecao: idProtecao,
          id_inspecao: idInspecao,
          id_empresa: idEmpresa,
          ...payload,
        };
        const { error } = await supabase.from("epi_epc").insert(row as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inspecao", idInspecao] });
      toast.success(isEdit ? "Atualizado" : "Adicionado");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.descricao.trim()) {
      toast.error("Descrição é obrigatória");
      return;
    }
    if (!form.id_risco) {
      toast.error("Vincule a um risco");
      return;
    }
    mutation.mutate();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar Proteção" : "Adicionar EPI/EPC"}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {/* 1. Setor — filtra os riscos abaixo */}
        <div>
          <label className={lblCls}>Setor</label>
          <select
            value={idSetorFiltro}
            onChange={(e) => handleSetorChange(e.target.value)}
            className={inputCls}
          >
            <option value="">— Todos os setores —</option>
            {setores.map((s) => (
              <option key={s.id_setor} value={s.id_setor}>
                {s.setor_ghe}
              </option>
            ))}
          </select>
          {idSetorFiltro && riscosFiltrados.length === 0 && (
            <p className="mt-1 text-xs text-amber-700">
              Nenhum risco cadastrado para este setor.
            </p>
          )}
        </div>

        {/* 2. Risco vinculado — filtrado pelo setor */}
        <div>
          <label className={lblCls}>
            Risco vinculado *
            {idSetorFiltro && riscosFiltrados.length > 0 && (
              <span className="ml-1 text-xs font-normal text-gray-500">
                ({riscosFiltrados.length} risco{riscosFiltrados.length !== 1 ? "s" : ""} neste setor)
              </span>
            )}
          </label>
          <select
            value={form.id_risco}
            onChange={(e) => setForm({ ...form, id_risco: e.target.value })}
            className={inputCls}
            required
          >
            <option value="">Selecione...</option>
            {riscosFiltrados.map((r) => (
              <option key={r.id_risco} value={r.id_risco}>
                {iconeDe(r.tipo_risco)} {r.tipo_risco} —{" "}
                {r.agente ?? r.id_risco}
              </option>
            ))}
          </select>
        </div>

        {/* 3. Tipo + Recomendado */}
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className={lblCls}>Tipo</label>
            <select
              value={form.tipo}
              onChange={(e) =>
                setForm({ ...form, tipo: e.target.value as "EPI" | "EPC" })
              }
              className={inputCls}
            >
              <option value="EPI">EPI</option>
              <option value="EPC">EPC</option>
            </select>
          </div>
          <div>
            <label className={lblCls}>Recomendado</label>
            <select
              value={form.recomendado}
              onChange={(e) =>
                setForm({
                  ...form,
                  recomendado: e.target.value as "Sim" | "Não",
                })
              }
              className={inputCls}
            >
              <option value="Sim">Sim</option>
              <option value="Não">Não</option>
            </select>
          </div>
        </div>

        {/* 4. Descrição */}
        <div>
          <label className={lblCls}>Descrição *</label>
          <input
            type="text"
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            className={inputCls}
            required
          />
        </div>

        {/* 5. CA */}
        <div>
          <label className={lblCls}>Certificado de Aprovação (CA)</label>
          <input
            type="text"
            value={form.ca}
            onChange={(e) => setForm({ ...form, ca: e.target.value })}
            className={inputCls}
          />
        </div>

        {/* 6. Fotos — até 4 */}
        <div>
          <label className={lblCls}>
            Fotos{" "}
            <span className="text-xs font-normal text-gray-500">(até 4)</span>
          </label>
          <div className="mt-1">
            <FotoSlots slots={slots} onChange={setSlots} max={4} />
          </div>
        </div>

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
              : "Adicionar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const inputCls =
  "mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30";
const lblCls = "text-sm font-medium text-gray-700";
