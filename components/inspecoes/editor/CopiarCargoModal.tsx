"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Copy, ArrowRightLeft, Building2, Briefcase } from "lucide-react";
import Modal from "@/components/ui/Modal";
import EmpresaSelect from "@/components/empresas/EmpresaSelect";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { gerarId, cn } from "@/lib/utils";
import type { Cargo, Inspecao, Setor } from "@/lib/supabase/types";

interface Props {
  open: boolean;
  onClose: () => void;
  cargo: Cargo | null;
  /** Setores da inspeção atual (modo "mesma inspeção" — exclui o setor de origem). */
  setoresAtual: Setor[];
}

type Modo = "mesma_inspecao" | "outra_empresa";

export default function CopiarCargoModal({
  open,
  onClose,
  cargo,
  setoresAtual,
}: Props) {
  const qc = useQueryClient();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [modo, setModo] = useState<Modo>("mesma_inspecao");
  const [idEmpresaDestino, setIdEmpresaDestino] = useState<string | null>(null);
  const [idInspecaoDestino, setIdInspecaoDestino] = useState<string | null>(
    null
  );
  const [idSetorDestino, setIdSetorDestino] = useState<string>("");

  useEffect(() => {
    if (open) {
      setModo("mesma_inspecao");
      setIdEmpresaDestino(null);
      setIdInspecaoDestino(null);
      setIdSetorDestino("");
    }
  }, [open]);

  // Modo outra_empresa: cascata empresa → inspeção → setor
  const { data: inspecoesDestino = [] } = useQuery({
    queryKey: ["copiar-cargo-inspecoes", idEmpresaDestino],
    enabled: modo === "outra_empresa" && !!idEmpresaDestino,
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

  const { data: setoresDestino = [] } = useQuery({
    queryKey: ["copiar-cargo-setores", idInspecaoDestino],
    enabled: modo === "outra_empresa" && !!idInspecaoDestino,
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

  const setoresParaSelect =
    modo === "mesma_inspecao"
      ? setoresAtual.filter((s) => s.id_setor !== cargo?.id_setor)
      : setoresDestino;

  const copiar = useMutation({
    mutationFn: async () => {
      if (!cargo) throw new Error("Cargo não selecionado");
      if (!idSetorDestino) throw new Error("Selecione o setor destino");

      const idInspecaoFinal =
        modo === "mesma_inspecao" ? cargo.id_inspecao : idInspecaoDestino;
      const idEmpresaFinal =
        modo === "mesma_inspecao" ? cargo.id_empresa : idEmpresaDestino;

      if (!idInspecaoFinal || !idEmpresaFinal)
        throw new Error("Inspeção/empresa de destino inválida");

      const novo = {
        id_cargo: gerarId("CGO"),
        id_inspecao: idInspecaoFinal,
        id_empresa: idEmpresaFinal,
        id_setor: idSetorDestino,
        cargo: cargo.cargo,
        descricao: cargo.descricao,
      };

      const { error } = await supabase.from("cargos").insert(novo as never);
      if (error) throw error;

      return idInspecaoFinal;
    },
    onSuccess: (idInspecaoFinal) => {
      qc.invalidateQueries({ queryKey: ["inspecao", cargo?.id_inspecao] });
      if (idInspecaoFinal !== cargo?.id_inspecao) {
        qc.invalidateQueries({ queryKey: ["inspecao", idInspecaoFinal] });
      }
      toast.success("Cargo copiado");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const podeConfirmar =
    modo === "mesma_inspecao"
      ? !!idSetorDestino
      : !!idEmpresaDestino && !!idInspecaoDestino && !!idSetorDestino;

  return (
    <Modal open={open} onClose={onClose} title="Copiar Cargo" size="lg">
      {cargo && (
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              Cargo de origem
            </p>
            <div className="mt-1 flex items-center gap-2">
              <Briefcase className="size-4 text-verde-primary" />
              <span className="font-medium text-gray-900">{cargo.cargo}</span>
            </div>
            {cargo.descricao && (
              <p className="mt-1 text-xs text-gray-600">{cargo.descricao}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setModo("mesma_inspecao");
                setIdSetorDestino("");
              }}
              className={cn(
                "rounded-lg border-2 p-3 text-left transition-colors",
                modo === "mesma_inspecao"
                  ? "border-verde-primary bg-verde-light"
                  : "border-gray-200 bg-white hover:border-gray-300"
              )}
            >
              <ArrowRightLeft className="size-5 text-verde-primary" />
              <p className="mt-1 text-sm font-semibold text-gray-900">
                Mesma inspeção
              </p>
              <p className="text-xs text-gray-600">Outro setor desta inspeção</p>
            </button>
            <button
              type="button"
              onClick={() => {
                setModo("outra_empresa");
                setIdSetorDestino("");
              }}
              className={cn(
                "rounded-lg border-2 p-3 text-left transition-colors",
                modo === "outra_empresa"
                  ? "border-verde-primary bg-verde-light"
                  : "border-gray-200 bg-white hover:border-gray-300"
              )}
            >
              <Building2 className="size-5 text-verde-primary" />
              <p className="mt-1 text-sm font-semibold text-gray-900">
                Outra empresa
              </p>
              <p className="text-xs text-gray-600">Empresa → Inspeção → Setor</p>
            </button>
          </div>

          {modo === "outra_empresa" && (
            <>
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Empresa destino *
                </label>
                <div className="mt-1">
                  <EmpresaSelect
                    value={idEmpresaDestino}
                    onChange={(id) => {
                      setIdEmpresaDestino(id);
                      setIdInspecaoDestino(null);
                      setIdSetorDestino("");
                    }}
                    placeholder="Buscar empresa..."
                    modulo="sst"
                  />
                </div>
              </div>

              {idEmpresaDestino && (
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Inspeção destino *
                  </label>
                  <select
                    value={idInspecaoDestino ?? ""}
                    onChange={(e) => {
                      setIdInspecaoDestino(e.target.value || null);
                      setIdSetorDestino("");
                    }}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
                  >
                    <option value="">Selecione...</option>
                    {inspecoesDestino.map((i) => (
                      <option key={i.id_inspecao} value={i.id_inspecao}>
                        Rev. {i.revisao} — {i.id_inspecao} ({i.status})
                      </option>
                    ))}
                  </select>
                  {inspecoesDestino.length === 0 && (
                    <p className="mt-1 text-xs text-amber-warning">
                      Esta empresa não tem inspeções.
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {(modo === "mesma_inspecao" ||
            (modo === "outra_empresa" && idInspecaoDestino)) && (
            <div>
              <label className="text-sm font-medium text-gray-700">
                Setor destino *
              </label>
              <select
                value={idSetorDestino}
                onChange={(e) => setIdSetorDestino(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
              >
                <option value="">Selecione...</option>
                {setoresParaSelect.map((s) => (
                  <option key={s.id_setor} value={s.id_setor}>
                    {s.setor_ghe}
                  </option>
                ))}
              </select>
              {setoresParaSelect.length === 0 && (
                <p className="mt-1 text-xs text-amber-warning">
                  {modo === "mesma_inspecao"
                    ? "Não há outros setores nesta inspeção."
                    : "Esta inspeção não tem setores."}
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
              {copiar.isPending ? "Copiando..." : "Copiar Cargo"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
