"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Copy, ArrowRightLeft, Building2, Layers } from "lucide-react";
import Modal from "@/components/ui/Modal";
import EmpresaSelect from "@/components/empresas/EmpresaSelect";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { gerarId, cn } from "@/lib/utils";
import type {
  Cargo,
  EpiEpc,
  Inspecao,
  Risco,
  Setor,
} from "@/lib/supabase/types";

interface Props {
  open: boolean;
  onClose: () => void;
  setor: Setor | null;
  /** ID da empresa atual (filtra inspeções do mesmo escopo na cascata) */
  idEmpresaOrigem: string;
}

type Modo = "mesma_inspecao" | "outra_inspecao" | "outra_empresa";

/**
 * Copia um Setor pra:
 * - A MESMA inspeção, com outro nome (modo: mesma_inspecao) — é o caso de
 *   "Portaria" virar "Portaria noturna" ou "Pista" ganhar variação de altura,
 *   sem recadastrar tudo à mão. Foi o que faltava: a base tem 12 grafias
 *   diferentes de Portaria/Pista, incluindo "Pista - altuira" com typo.
 * - Outra inspeção da MESMA empresa (modo: outra_inspecao)
 * - Inspeção de OUTRA empresa (modo: outra_empresa, com cascata)
 *
 * Opções:
 * - Copiar cargos vinculados (default ON)
 * - Copiar treinamentos vinculados (default ON) — do setor e, quando os cargos
 *   também vão, os de cada cargo
 * - Copiar riscos vinculados (default OFF)
 * - Copiar EPIs/EPCs vinculados aos riscos (depende de copiar riscos)
 *
 * Mantém o mapeamento ID antigo → ID novo para que cargos referenciem
 * o setor novo, riscos referenciem cargo+setor novos, e EPIs referenciem
 * o risco novo.
 */
export default function CopiarSetorModal({
  open,
  onClose,
  setor,
  idEmpresaOrigem,
}: Props) {
  const qc = useQueryClient();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [modo, setModo] = useState<Modo>("mesma_inspecao");
  const [nomeNovo, setNomeNovo] = useState("");
  const [idEmpresaDestino, setIdEmpresaDestino] = useState<string | null>(null);
  const [idInspecaoDestino, setIdInspecaoDestino] = useState<string | null>(
    null
  );
  const [copiarCargos, setCopiarCargos] = useState(true);
  const [copiarTreinamentos, setCopiarTreinamentos] = useState(true);
  const [copiarRiscos, setCopiarRiscos] = useState(false);
  const [copiarEpis, setCopiarEpis] = useState(false);

  useEffect(() => {
    if (open) {
      setModo("mesma_inspecao");
      // Nasce com o nome de origem: quem duplica edita para "Portaria noturna".
      setNomeNovo(setor?.setor_ghe ?? "");
      setIdEmpresaDestino(null);
      setIdInspecaoDestino(null);
      setCopiarCargos(true);
      setCopiarTreinamentos(true);
      setCopiarRiscos(false);
      setCopiarEpis(false);
    }
  }, [open, setor]);

  // Inspeções para o select destino. Nos modos da mesma empresa é a empresa de
  // origem; no modo "outra_empresa" é a empresa escolhida.
  const idEmpresaQuery =
    modo === "outra_empresa" ? idEmpresaDestino : idEmpresaOrigem;

  const { data: inspecoesDestino = [] } = useQuery({
    queryKey: ["copiar-setor-inspecoes", idEmpresaQuery],
    enabled: !!idEmpresaQuery,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inspecoes")
        .select("*")
        .eq("id_empresa", idEmpresaQuery!)
        .neq("status", "DELETADA")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Inspecao[];
    },
  });

  // Filtra a inspeção atual quando estamos em "outra_inspecao"
  const inspecoesParaSelect =
    modo === "outra_inspecao"
      ? inspecoesDestino.filter((i) => i.id_inspecao !== setor?.id_inspecao)
      : inspecoesDestino;

  const copiar = useMutation({
    mutationFn: async () => {
      if (!setor) throw new Error("Setor não selecionado");

      // Duplicar em lugar: destino é a própria inspeção do setor de origem.
      const inspecaoFinal =
        modo === "mesma_inspecao" ? setor.id_inspecao : idInspecaoDestino;
      if (!inspecaoFinal) throw new Error("Selecione a inspeção destino");

      const idEmpresaFinal =
        modo === "outra_empresa" ? idEmpresaDestino : idEmpresaOrigem;
      if (!idEmpresaFinal)
        throw new Error("Empresa de destino inválida");

      const nome = nomeNovo.trim();
      if (!nome) throw new Error("Dê um nome ao setor novo");

      // 1) Cria novo setor com o nome escolhido e o resto igual ao de origem
      const novoIdSetor = gerarId("SET");
      const novoSetor: Partial<Setor> = {
        id_setor: novoIdSetor,
        id_inspecao: inspecaoFinal,
        id_empresa: idEmpresaFinal,
        setor_ghe: nome,
        descricao: setor.descricao,
        conformidade: setor.conformidade,
        nao_conformidade: setor.nao_conformidade,
      };

      const { error: errSetor } = await supabase
        .from("setores")
        .insert(novoSetor as never);
      if (errSetor) throw errSetor;

      // Mapas pra resolver IDs antigos → novos
      const mapaCargo = new Map<string, string>();
      const mapaRisco = new Map<string, string>();

      // 2) Cargos (opcional)
      if (copiarCargos) {
        const { data: cargosOrigem } = await supabase
          .from("cargos")
          .select("*")
          .eq("id_setor", setor.id_setor);
        const lista = (cargosOrigem ?? []) as unknown as Cargo[];

        if (lista.length > 0) {
          const novosCargos = lista.map((c) => {
            const novoId = gerarId("CGO");
            mapaCargo.set(c.id_cargo, novoId);
            return {
              id_cargo: novoId,
              id_inspecao: inspecaoFinal,
              id_empresa: idEmpresaFinal,
              id_setor: novoIdSetor,
              cargo: c.cargo,
              descricao: c.descricao,
            };
          });
          const { error: errCgo } = await supabase
            .from("cargos")
            .insert(novosCargos as never);
          if (errCgo) throw errCgo;
        }
      }

      // 2b) Treinamentos — tabelas de ligação puras (id_treinamento + id_alvo).
      // Sem isso o setor duplicado nasce sem nenhum treinamento vinculado, que
      // é justamente parte da configuração que se quer preservar.
      if (copiarTreinamentos) {
        const { data: treinoSetor } = await supabase
          .from("treinamentos_setor")
          .select("id_treinamento")
          .eq("id_setor", setor.id_setor);
        const listaSetor = (treinoSetor ?? []) as { id_treinamento: string }[];
        if (listaSetor.length > 0) {
          const { error: errTS } = await supabase
            .from("treinamentos_setor")
            .insert(
              listaSetor.map((t) => ({
                id_treinamento: t.id_treinamento,
                id_setor: novoIdSetor,
              })) as never,
            );
          if (errTS) throw errTS;
        }

        // Os do cargo só fazem sentido se os cargos vieram junto.
        if (mapaCargo.size > 0) {
          const { data: treinoCargo } = await supabase
            .from("treinamentos_cargo")
            .select("id_treinamento, id_cargo")
            .in("id_cargo", [...mapaCargo.keys()]);
          const listaCargo = (treinoCargo ?? []) as {
            id_treinamento: string;
            id_cargo: string;
          }[];
          const novos = listaCargo
            .map((t) => {
              const novoIdCargo = mapaCargo.get(t.id_cargo);
              return novoIdCargo
                ? { id_treinamento: t.id_treinamento, id_cargo: novoIdCargo }
                : null;
            })
            .filter((t): t is NonNullable<typeof t> => t !== null);
          if (novos.length > 0) {
            const { error: errTC } = await supabase
              .from("treinamentos_cargo")
              .insert(novos as never);
            if (errTC) throw errTC;
          }
        }
      }

      // 3) Riscos (opcional)
      if (copiarRiscos) {
        const { data: riscosOrigem } = await supabase
          .from("riscos")
          .select("*")
          .eq("id_setor", setor.id_setor);
        const lista = (riscosOrigem ?? []) as unknown as Risco[];

        if (lista.length > 0) {
          const novosRiscos = lista.map((r) => {
            const novoId = gerarId("RSC");
            mapaRisco.set(r.id_risco, novoId);
            return {
              ...r,
              id_risco: novoId,
              id_inspecao: inspecaoFinal,
              id_empresa: idEmpresaFinal,
              id_setor: novoIdSetor,
              // Mantém o cargo apenas se também copiamos cargos
              id_cargo:
                copiarCargos && r.id_cargo
                  ? mapaCargo.get(r.id_cargo) ?? null
                  : null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
          });
          const { error: errRsc } = await supabase
            .from("riscos")
            .insert(novosRiscos as never);
          if (errRsc) throw errRsc;
        }

        // 4) EPIs/EPCs (só se também copiamos riscos)
        if (copiarEpis && lista.length > 0) {
          const idsRiscoOrigem = lista.map((r) => r.id_risco);
          const { data: episOrigem } = await supabase
            .from("epi_epc")
            .select("*")
            .in("id_risco", idsRiscoOrigem);
          const epis = (episOrigem ?? []) as unknown as EpiEpc[];

          if (epis.length > 0) {
            const novosEpis = epis
              .map((e) => {
                const novoIdRisco = mapaRisco.get(e.id_risco);
                if (!novoIdRisco) return null;
                return {
                  id_protecao: gerarId("EPI"),
                  id_risco: novoIdRisco,
                  id_inspecao: inspecaoFinal,
                  id_empresa: idEmpresaFinal,
                  id_setor: novoIdSetor,
                  tipo: e.tipo,
                  descricao: e.descricao,
                  ca: e.ca,
                  recomendado: e.recomendado,
                };
              })
              .filter((e): e is NonNullable<typeof e> => e !== null);

            if (novosEpis.length > 0) {
              const { error: errEpi } = await supabase
                .from("epi_epc")
                .insert(novosEpis as never);
              if (errEpi) throw errEpi;
            }
          }
        }
      }

      return inspecaoFinal;
    },
    onSuccess: (inspecaoFinal) => {
      qc.invalidateQueries({ queryKey: ["inspecao", setor?.id_inspecao] });
      if (inspecaoFinal !== setor?.id_inspecao) {
        qc.invalidateQueries({ queryKey: ["inspecao", inspecaoFinal] });
      }
      toast.success(
        modo === "mesma_inspecao" ? "Setor duplicado" : "Setor copiado",
      );
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const temNome = !!nomeNovo.trim();
  const podeConfirmar =
    modo === "mesma_inspecao"
      ? temNome
      : modo === "outra_inspecao"
        ? temNome && !!idInspecaoDestino
        : temNome && !!idEmpresaDestino && !!idInspecaoDestino;

  // Duplicar no mesmo laudo mantendo o nome cria dois setores homônimos — que é
  // exatamente a bagunça que esta tela existe para evitar. Avisa, não bloqueia.
  const nomeRepetido =
    modo === "mesma_inspecao"
    && temNome
    && nomeNovo.trim().toLowerCase() === (setor?.setor_ghe ?? "").trim().toLowerCase();

  return (
    <Modal open={open} onClose={onClose} title="Duplicar / Copiar Setor" size="lg">
      {setor && (
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              Setor de origem
            </p>
            <div className="mt-1 flex items-center gap-2">
              <Layers className="size-4 text-verde-primary" />
              <span className="font-medium text-gray-900">
                {setor.setor_ghe}
              </span>
            </div>
            {setor.descricao && (
              <p className="mt-1 text-xs text-gray-600">{setor.descricao}</p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                setModo("mesma_inspecao");
                setIdInspecaoDestino(null);
              }}
              className={cn(
                "rounded-lg border-2 p-3 text-left transition-colors",
                modo === "mesma_inspecao"
                  ? "border-verde-primary bg-verde-light"
                  : "border-gray-200 bg-white hover:border-gray-300"
              )}
            >
              <Copy className="size-5 text-verde-primary" />
              <p className="mt-1 text-sm font-semibold text-gray-900">
                Duplicar aqui
              </p>
              <p className="text-xs text-gray-600">Neste mesmo laudo</p>
            </button>
            <button
              type="button"
              onClick={() => {
                setModo("outra_inspecao");
                setIdInspecaoDestino(null);
              }}
              className={cn(
                "rounded-lg border-2 p-3 text-left transition-colors",
                modo === "outra_inspecao"
                  ? "border-verde-primary bg-verde-light"
                  : "border-gray-200 bg-white hover:border-gray-300"
              )}
            >
              <ArrowRightLeft className="size-5 text-verde-primary" />
              <p className="mt-1 text-sm font-semibold text-gray-900">
                Mesma empresa
              </p>
              <p className="text-xs text-gray-600">
                Outra inspeção desta empresa
              </p>
            </button>
            <button
              type="button"
              onClick={() => {
                setModo("outra_empresa");
                setIdInspecaoDestino(null);
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
              <p className="text-xs text-gray-600">Empresa → Inspeção</p>
            </button>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">
              Nome do setor novo *
            </label>
            <input
              type="text"
              value={nomeNovo}
              onChange={(e) => setNomeNovo(e.target.value)}
              placeholder="Ex.: Portaria noturna"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
            />
            {nomeRepetido && (
              <p className="mt-1 text-xs text-amber-warning">
                Vai ficar com o mesmo nome do original — dois setores
                &ldquo;{setor.setor_ghe}&rdquo; neste laudo. Ajuste para algo
                como &ldquo;{setor.setor_ghe} noturna&rdquo;.
              </p>
            )}
          </div>

          {modo === "outra_empresa" && (
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
                  }}
                  placeholder="Buscar empresa..."
                  modulo="sst"
                />
              </div>
            </div>
          )}

          {(modo === "outra_inspecao" ||
            (modo === "outra_empresa" && idEmpresaDestino)) && (
            <div>
              <label className="text-sm font-medium text-gray-700">
                Inspeção destino *
              </label>
              <select
                value={idInspecaoDestino ?? ""}
                onChange={(e) => setIdInspecaoDestino(e.target.value || null)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
              >
                <option value="">Selecione...</option>
                {inspecoesParaSelect.map((i) => (
                  <option key={i.id_inspecao} value={i.id_inspecao}>
                    Rev. {i.revisao} — {i.id_inspecao} ({i.status})
                  </option>
                ))}
              </select>
              {inspecoesParaSelect.length === 0 && (
                <p className="mt-1 text-xs text-amber-warning">
                  {modo === "outra_inspecao"
                    ? "Não há outras inspeções nesta empresa. Crie uma antes de copiar."
                    : "Esta empresa não tem inspeções."}
                </p>
              )}
            </div>
          )}

          {/* Opções de cópia */}
          <div className="space-y-1.5 rounded-md border border-gray-200 bg-white p-3">
            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-gray-700">
              O que copiar junto
            </p>
            <label className="flex cursor-pointer items-start gap-2 px-2 py-1 hover:bg-gray-50">
              <input
                type="checkbox"
                checked={copiarCargos}
                onChange={(e) => setCopiarCargos(e.target.checked)}
                className="mt-0.5 rounded border-gray-300 text-verde-primary focus:ring-verde-primary/30"
              />
              <span className="text-sm">
                <span className="font-medium text-gray-900">
                  Cargos do setor
                </span>
                <span className="block text-xs text-gray-600">
                  Replica os cargos com nome e descrição
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 px-2 py-1 hover:bg-gray-50">
              <input
                type="checkbox"
                checked={copiarTreinamentos}
                onChange={(e) => setCopiarTreinamentos(e.target.checked)}
                className="mt-0.5 rounded border-gray-300 text-verde-primary focus:ring-verde-primary/30"
              />
              <span className="text-sm">
                <span className="font-medium text-gray-900">
                  Treinamentos vinculados
                </span>
                <span className="block text-xs text-gray-600">
                  Os do setor e, se os cargos vierem junto, os de cada cargo
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 px-2 py-1 hover:bg-gray-50">
              <input
                type="checkbox"
                checked={copiarRiscos}
                onChange={(e) => {
                  setCopiarRiscos(e.target.checked);
                  if (!e.target.checked) setCopiarEpis(false);
                }}
                className="mt-0.5 rounded border-gray-300 text-verde-primary focus:ring-verde-primary/30"
              />
              <span className="text-sm">
                <span className="font-medium text-gray-900">
                  Riscos do setor
                </span>
                <span className="block text-xs text-gray-600">
                  Inclui prob/sev/nível, medidas, perguntas customizadas e
                  matriz vinculada
                </span>
              </span>
            </label>
            <label
              className={cn(
                "flex items-start gap-2 px-2 py-1",
                copiarRiscos
                  ? "cursor-pointer hover:bg-gray-50"
                  : "cursor-not-allowed opacity-50"
              )}
            >
              <input
                type="checkbox"
                checked={copiarEpis}
                onChange={(e) => setCopiarEpis(e.target.checked)}
                disabled={!copiarRiscos}
                className="mt-0.5 rounded border-gray-300 text-verde-primary focus:ring-verde-primary/30"
              />
              <span className="text-sm">
                <span className="font-medium text-gray-900">
                  EPIs e EPCs vinculados
                </span>
                <span className="block text-xs text-gray-600">
                  Só disponível se copiar riscos. Replica todos os EPIs/EPCs
                  (Utilizados e Recomendados)
                </span>
              </span>
            </label>
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
              type="button"
              onClick={() => copiar.mutate()}
              disabled={!podeConfirmar || copiar.isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-60"
            >
              <Copy className="size-4" />
              {copiar.isPending
                ? modo === "mesma_inspecao"
                  ? "Duplicando..."
                  : "Copiando..."
                : modo === "mesma_inspecao"
                  ? "Duplicar Setor"
                  : "Copiar Setor"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
