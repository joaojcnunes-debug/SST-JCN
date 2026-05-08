"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Copy, ArrowRightLeft, Building2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import EmpresaSelect from "@/components/empresas/EmpresaSelect";
import NivelBadge from "@/components/riscos/NivelBadge";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { gerarId, cn, parseMedidas } from "@/lib/utils";
import { useTipoIcone } from "@/lib/hooks/useV3";
import type {
  Cargo,
  EpiEpc,
  Inspecao,
  NivelRisco,
  Risco,
  Setor,
} from "@/lib/supabase/types";

interface Props {
  open: boolean;
  onClose: () => void;
  risco: Risco | null;
  /**
   * Setores da inspeção atual (pra modo "Mesmo setor / mesma inspeção").
   * Cargos pra preencher select condicional.
   */
  setoresAtual: Setor[];
  cargosAtual: Cargo[];
}

type Modo = "mesma_inspecao" | "outra_empresa";

/**
 * Copia um Risco existente pra:
 * - Outro setor da MESMA inspeção (modo: mesma_inspecao)
 * - Setor de OUTRA empresa (modo: outra_empresa, com cascata empresa → inspeção → setor)
 *
 * Opcionalmente copia também os EPIs/EPCs vinculados ao risco origem,
 * preservando todos os campos (tipo, descrição, CA, recomendado).
 */
export default function CopiarRiscoModal({
  open,
  onClose,
  risco,
  setoresAtual,
  cargosAtual,
}: Props) {
  const qc = useQueryClient();
  const iconeDe = useTipoIcone();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [modo, setModo] = useState<Modo>("mesma_inspecao");
  const [idEmpresaDestino, setIdEmpresaDestino] = useState<string | null>(null);
  const [idInspecaoDestino, setIdInspecaoDestino] = useState<string | null>(
    null
  );
  const [idSetorDestino, setIdSetorDestino] = useState<string>("");
  const [idCargoDestino, setIdCargoDestino] = useState<string>("");
  const [copiarEpis, setCopiarEpis] = useState(true);

  // Reset ao abrir
  useEffect(() => {
    if (open) {
      setModo("mesma_inspecao");
      setIdEmpresaDestino(null);
      setIdInspecaoDestino(null);
      setIdSetorDestino("");
      setIdCargoDestino("");
      setCopiarEpis(true);
    }
  }, [open]);

  // Inspeções da empresa destino (modo outra_empresa)
  const { data: inspecoesDestino = [] } = useQuery({
    queryKey: ["copiar-risco-inspecoes", idEmpresaDestino],
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

  // Setores da inspeção destino (modo outra_empresa)
  const { data: setoresDestino = [] } = useQuery({
    queryKey: ["copiar-risco-setores", idInspecaoDestino],
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

  // Cargos do setor destino (modo outra_empresa)
  const { data: cargosDestino = [] } = useQuery({
    queryKey: ["copiar-risco-cargos", idInspecaoDestino, idSetorDestino],
    enabled:
      modo === "outra_empresa" && !!idInspecaoDestino && !!idSetorDestino,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cargos")
        .select("*")
        .eq("id_inspecao", idInspecaoDestino!)
        .eq("id_setor", idSetorDestino);
      if (error) throw error;
      return (data ?? []) as unknown as Cargo[];
    },
  });

  // Listas usadas pelo render (depende do modo)
  const setoresParaSelect =
    modo === "mesma_inspecao"
      ? setoresAtual.filter((s) => s.id_setor !== risco?.id_setor)
      : setoresDestino;

  const cargosParaSelect =
    modo === "mesma_inspecao"
      ? cargosAtual.filter((c) => c.id_setor === idSetorDestino)
      : cargosDestino;

  const copiar = useMutation({
    mutationFn: async () => {
      if (!risco) throw new Error("Risco não selecionado");
      if (!idSetorDestino) throw new Error("Selecione o setor destino");

      const idInspecaoFinal =
        modo === "mesma_inspecao" ? risco.id_inspecao : idInspecaoDestino;
      const idEmpresaFinal =
        modo === "mesma_inspecao" ? risco.id_empresa : idEmpresaDestino;

      if (!idInspecaoFinal || !idEmpresaFinal)
        throw new Error("Inspeção/empresa de destino inválida");

      // 1) Cria novo risco com todos os dados clonados
      const novoIdRisco = gerarId("RSC");
      const novoRisco: Partial<Risco> = {
        ...risco,
        id_risco: novoIdRisco,
        id_inspecao: idInspecaoFinal,
        id_empresa: idEmpresaFinal,
        id_setor: idSetorDestino,
        id_cargo: idCargoDestino || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error: errRisco } = await supabase
        .from("riscos")
        .insert(novoRisco as never);
      if (errRisco) throw errRisco;

      // 2) Opcionalmente copia EPIs/EPCs vinculados
      if (copiarEpis) {
        const { data: episOrigem, error: errLer } = await supabase
          .from("epi_epc")
          .select("*")
          .eq("id_risco", risco.id_risco);
        if (errLer) throw errLer;

        const lista = (episOrigem ?? []) as unknown as EpiEpc[];
        if (lista.length > 0) {
          const novos = lista.map((e) => ({
            id_protecao: gerarId("EPI"),
            id_risco: novoIdRisco,
            id_inspecao: idInspecaoFinal,
            id_empresa: idEmpresaFinal,
            id_setor: idSetorDestino,
            tipo: e.tipo,
            descricao: e.descricao,
            ca: e.ca,
            recomendado: e.recomendado,
          }));
          const { error: errIns } = await supabase
            .from("epi_epc")
            .insert(novos as never);
          if (errIns) throw errIns;
        }
      }

      return idInspecaoFinal;
    },
    onSuccess: (idInspecaoFinal) => {
      qc.invalidateQueries({ queryKey: ["inspecao", risco?.id_inspecao] });
      if (idInspecaoFinal !== risco?.id_inspecao) {
        qc.invalidateQueries({ queryKey: ["inspecao", idInspecaoFinal] });
      }
      toast.success("Risco copiado");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const podeConfirmar =
    modo === "mesma_inspecao"
      ? !!idSetorDestino
      : !!idEmpresaDestino && !!idInspecaoDestino && !!idSetorDestino;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Copiar Risco"
      size="lg"
    >
      {risco && (
        <div className="space-y-4">
          {/* Resumo da origem */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              Risco de origem
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-base">{iconeDe(risco.tipo_risco)}</span>
              <span className="font-medium text-gray-900">
                {risco.tipo_risco} · {risco.agente ?? "—"}
              </span>
              <NivelBadge
                nivel={(risco.nivel_risco as NivelRisco) ?? "Baixo"}
              />
            </div>
            <p className="mt-1 text-xs text-gray-600">
              {parseMedidas(risco.fonte_geradora).join("; ") || "Sem fonte geradora"} ·{" "}
              {risco.probabilidade ?? "—"} / {risco.severidade ?? "—"}
            </p>
          </div>

          {/* Toggle do modo */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setModo("mesma_inspecao");
                setIdSetorDestino("");
                setIdCargoDestino("");
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
              <p className="text-xs text-gray-600">
                Copia para outro setor desta inspeção
              </p>
            </button>
            <button
              type="button"
              onClick={() => {
                setModo("outra_empresa");
                setIdSetorDestino("");
                setIdCargoDestino("");
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
              <p className="text-xs text-gray-600">
                Empresa → Inspeção → Setor
              </p>
            </button>
          </div>

          {/* Cascata de selects */}
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
                      setIdCargoDestino("");
                    }}
                    placeholder="Buscar empresa..."
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
                      setIdCargoDestino("");
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

          {((modo === "mesma_inspecao") ||
            (modo === "outra_empresa" && idInspecaoDestino)) && (
            <div>
              <label className="text-sm font-medium text-gray-700">
                Setor destino *
              </label>
              <select
                value={idSetorDestino}
                onChange={(e) => {
                  setIdSetorDestino(e.target.value);
                  setIdCargoDestino("");
                }}
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
                    ? "Não há outros setores nesta inspeção. Cadastre um setor antes."
                    : "Esta inspeção não tem setores cadastrados."}
                </p>
              )}
            </div>
          )}

          {idSetorDestino && cargosParaSelect.length > 0 && (
            <div>
              <label className="text-sm font-medium text-gray-700">
                Cargo destino (opcional)
              </label>
              <select
                value={idCargoDestino}
                onChange={(e) => setIdCargoDestino(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
              >
                <option value="">— sem cargo específico —</option>
                {cargosParaSelect.map((c) => (
                  <option key={c.id_cargo} value={c.id_cargo}>
                    {c.cargo}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Toggle copiar EPIs */}
          <label className="flex cursor-pointer items-start gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 hover:bg-gray-50">
            <input
              type="checkbox"
              checked={copiarEpis}
              onChange={(e) => setCopiarEpis(e.target.checked)}
              className="mt-0.5 rounded border-gray-300 text-verde-primary focus:ring-verde-primary/30"
            />
            <span className="text-sm">
              <span className="font-medium text-gray-900">
                Copiar EPIs e EPCs vinculados
              </span>
              <span className="block text-xs text-gray-600">
                Replica todos os EPIs/EPCs (Utilizados e Recomendados) que
                estão associados a este risco no destino.
              </span>
            </span>
          </label>

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
              {copiar.isPending ? "Copiando..." : "Copiar Risco"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
