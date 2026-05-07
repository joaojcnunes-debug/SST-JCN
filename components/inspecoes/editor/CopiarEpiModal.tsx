"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Copy } from "lucide-react";
import Modal from "@/components/ui/Modal";
import EmpresaSelect from "@/components/empresas/EmpresaSelect";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { gerarId } from "@/lib/utils";
import { TIPO_ICONE } from "@/lib/constants";
import type {
  EpiEpc,
  Inspecao,
  Risco,
  Setor,
} from "@/lib/supabase/types";

interface Props {
  open: boolean;
  onClose: () => void;
  epi: EpiEpc | null;
}

/**
 * Copia um EPI/EPC pra outra empresa, vinculando a:
 * Empresa destino → Inspeção destino → Setor destino → Risco destino.
 *
 * O EPI/EPC sempre é vinculado a um Risco (FK), então o usuário precisa
 * escolher um Risco existente na inspeção/setor de destino.
 */
export default function CopiarEpiModal({ open, onClose, epi }: Props) {
  const qc = useQueryClient();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [idEmpresaDestino, setIdEmpresaDestino] = useState<string | null>(null);
  const [idInspecaoDestino, setIdInspecaoDestino] = useState<string | null>(
    null
  );
  const [idSetorDestino, setIdSetorDestino] = useState<string>("");
  const [idRiscoDestino, setIdRiscoDestino] = useState<string>("");

  // Reset ao abrir
  useEffect(() => {
    if (open) {
      setIdEmpresaDestino(null);
      setIdInspecaoDestino(null);
      setIdSetorDestino("");
      setIdRiscoDestino("");
    }
  }, [open]);

  // Inspeções da empresa destino
  const { data: inspecoes = [] } = useQuery({
    queryKey: ["copiar-epi-inspecoes", idEmpresaDestino],
    enabled: !!idEmpresaDestino,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inspecoes")
        .select("*")
        .eq("id_empresa", idEmpresaDestino!)
        .neq("status", "DELETADA")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Inspecao[];
    },
  });

  // Setores da inspeção destino
  const { data: setores = [] } = useQuery({
    queryKey: ["copiar-epi-setores", idInspecaoDestino],
    enabled: !!idInspecaoDestino,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("setores")
        .select("*")
        .eq("id_inspecao", idInspecaoDestino!)
        .order("setor_ghe");
      if (error) throw error;
      return (data ?? []) as unknown as Setor[];
    },
  });

  // Riscos do setor destino
  const { data: riscos = [] } = useQuery({
    queryKey: ["copiar-epi-riscos", idInspecaoDestino, idSetorDestino],
    enabled: !!idInspecaoDestino && !!idSetorDestino,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("riscos")
        .select("*")
        .eq("id_inspecao", idInspecaoDestino!)
        .eq("id_setor", idSetorDestino);
      if (error) throw error;
      return (data ?? []) as unknown as Risco[];
    },
  });

  const copiar = useMutation({
    mutationFn: async () => {
      if (!epi) throw new Error("EPI não selecionado");
      if (!idEmpresaDestino) throw new Error("Selecione a empresa destino");
      if (!idInspecaoDestino) throw new Error("Selecione a inspeção destino");
      if (!idSetorDestino) throw new Error("Selecione o setor destino");
      if (!idRiscoDestino) throw new Error("Selecione o risco destino");

      const novo = {
        id_protecao: gerarId("EPI"),
        id_risco: idRiscoDestino,
        id_inspecao: idInspecaoDestino,
        id_empresa: idEmpresaDestino,
        id_setor: idSetorDestino,
        tipo: epi.tipo,
        descricao: epi.descricao,
        ca: epi.ca,
        recomendado: epi.recomendado,
      };

      const { error } = await supabase
        .from("epi_epc")
        .insert(novo as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inspecao", idInspecaoDestino] });
      toast.success("EPI/EPC copiado");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const podeConfirmar =
    !!idEmpresaDestino &&
    !!idInspecaoDestino &&
    !!idSetorDestino &&
    !!idRiscoDestino;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Copiar ${epi?.tipo ?? "EPI/EPC"} para outra empresa`}
      size="lg"
    >
      {epi && (
        <div className="space-y-4">
          {/* Resumo do que será copiado */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Item de origem
            </p>
            <p className="mt-1 font-medium text-gray-900">
              <span className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-xs font-bold mr-2">
                {epi.tipo}
              </span>
              {epi.descricao}
            </p>
            <p className="text-xs text-gray-600">
              CA: {epi.ca ?? "—"} · Recomendado: {epi.recomendado ?? "—"}
            </p>
          </div>

          {/* 4 selects em cascata */}
          <div>
            <label className="text-sm font-medium text-gray-700">
              1. Empresa destino *
            </label>
            <div className="mt-1">
              <EmpresaSelect
                value={idEmpresaDestino}
                onChange={(id) => {
                  setIdEmpresaDestino(id);
                  setIdInspecaoDestino(null);
                  setIdSetorDestino("");
                  setIdRiscoDestino("");
                }}
                placeholder="Buscar empresa..."
              />
            </div>
          </div>

          {idEmpresaDestino && (
            <div>
              <label className="text-sm font-medium text-gray-700">
                2. Inspeção destino *
              </label>
              <select
                value={idInspecaoDestino ?? ""}
                onChange={(e) => {
                  setIdInspecaoDestino(e.target.value || null);
                  setIdSetorDestino("");
                  setIdRiscoDestino("");
                }}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
              >
                <option value="">Selecione...</option>
                {inspecoes.map((i) => (
                  <option key={i.id_inspecao} value={i.id_inspecao}>
                    Rev. {i.revisao} — {i.id_inspecao} ({i.status})
                  </option>
                ))}
              </select>
              {inspecoes.length === 0 && (
                <p className="mt-1 text-xs text-amber-warning">
                  Esta empresa não tem inspeções. Crie uma antes de copiar.
                </p>
              )}
            </div>
          )}

          {idInspecaoDestino && (
            <div>
              <label className="text-sm font-medium text-gray-700">
                3. Setor destino *
              </label>
              <select
                value={idSetorDestino}
                onChange={(e) => {
                  setIdSetorDestino(e.target.value);
                  setIdRiscoDestino("");
                }}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
              >
                <option value="">Selecione...</option>
                {setores.map((s) => (
                  <option key={s.id_setor} value={s.id_setor}>
                    {s.setor_ghe}
                  </option>
                ))}
              </select>
              {setores.length === 0 && (
                <p className="mt-1 text-xs text-amber-warning">
                  Esta inspeção não tem setores. Cadastre antes de copiar.
                </p>
              )}
            </div>
          )}

          {idSetorDestino && (
            <div>
              <label className="text-sm font-medium text-gray-700">
                4. Risco destino *
              </label>
              <p className="text-xs text-gray-500">
                EPIs/EPCs precisam estar vinculados a um risco. Escolha qual
                risco do setor receberá esta proteção.
              </p>
              <select
                value={idRiscoDestino}
                onChange={(e) => setIdRiscoDestino(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
              >
                <option value="">Selecione...</option>
                {riscos.map((r) => (
                  <option key={r.id_risco} value={r.id_risco}>
                    {TIPO_ICONE[r.tipo_risco as keyof typeof TIPO_ICONE] ?? "•"}{" "}
                    {r.tipo_risco} — {r.agente ?? "(sem agente)"}
                  </option>
                ))}
              </select>
              {riscos.length === 0 && (
                <p className="mt-1 text-xs text-amber-warning">
                  Este setor ainda não tem riscos. Cadastre um risco antes de
                  copiar este EPI.
                </p>
              )}
            </div>
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
              type="button"
              onClick={() => copiar.mutate()}
              disabled={!podeConfirmar || copiar.isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-60"
            >
              <Copy className="size-4" />
              {copiar.isPending ? "Copiando..." : "Copiar EPI/EPC"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
