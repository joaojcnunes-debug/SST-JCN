"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import FotoSlots, { uploadFotoSlots, type FotoSlot } from "@/components/ui/FotoSlots";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { gerarId, cn } from "@/lib/utils";
import type { Extintor, Setor } from "@/lib/supabase/types";
import {
  NAO_CONFORMIDADES_EXTINTOR,
  type SituacaoExtintor,
} from "@/lib/inspecoes/extintores";

interface Props {
  open: boolean;
  onClose: () => void;
  idInspecao: string;
  idEmpresa: string;
  editing: Extintor | null;
  setores: Setor[];
}

const TIPOS_AGENTE = [
  "Pó Químico Seco ABC",
  "Pó Químico Seco BC",
  "CO₂ (Dióxido de Carbono)",
  "Água Pressurizada",
  "Espuma Mecânica",
  "Pó Específico para Metais (D)",
];

const CAPACIDADES = [
  "1 kg", "2 kg", "4 kg", "6 kg", "9 kg", "12 kg",
  "2 L", "5 L", "9 L", "10 L", "12 L",
];

function buildSlots(urls: string[], paths: string[]): (FotoSlot | null)[] {
  const base: (FotoSlot | null)[] = [null, null, null, null];
  urls.forEach((url, i) => {
    if (i < 4) base[i] = { type: "existing", url, path: paths[i] ?? "" };
  });
  return base;
}

export default function ExtintorForm({
  open,
  onClose,
  idInspecao,
  idEmpresa,
  editing,
  setores,
}: Props) {
  const qc = useQueryClient();

  const [idSetor, setIdSetor] = useState<string>("");
  const [tipoAgente, setTipoAgente] = useState("");
  const [capacidade, setCapacidade] = useState("");
  const [numeroIdentificacao, setNumeroIdentificacao] = useState("");
  const [localizacao, setLocalizacao] = useState("");
  const [dataValidade, setDataValidade] = useState("");
  // v158: `status` (texto livre) virou situação + lista de não conformidades.
  const [situacao, setSituacao] = useState<"" | SituacaoExtintor>("");
  const [naoConformidades, setNaoConformidades] = useState<string[]>([]);
  const [outraCausa, setOutraCausa] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [ordem, setOrdem] = useState(99);
  const [slots, setSlots] = useState<(FotoSlot | null)[]>([null, null, null, null]);

  useEffect(() => {
    if (!open) return;
    setIdSetor(editing?.id_setor ?? "");
    setTipoAgente(editing?.tipo_agente ?? "");
    setCapacidade(editing?.capacidade ?? "");
    setNumeroIdentificacao(editing?.numero_identificacao ?? "");
    setLocalizacao(editing?.localizacao ?? "");
    setDataValidade(editing?.data_validade ?? "");
    setSituacao(
      editing?.situacao === "CONFORME" || editing?.situacao === "NAO_CONFORME"
        ? editing.situacao
        : "",
    );
    setNaoConformidades(editing?.nao_conformidades ?? []);
    setOutraCausa("");
    setObservacoes(editing?.observacoes ?? "");
    setOrdem(editing?.ordem ?? 99);
    setSlots(
      buildSlots(editing?.fotos_urls ?? [], editing?.fotos_storage_paths ?? []),
    );
  }, [open, editing]);

  // A causa digitada só vale se não repetir uma já marcada.
  const causasFinais = [
    ...naoConformidades,
    ...(outraCausa.trim() && !naoConformidades.includes(outraCausa.trim())
      ? [outraCausa.trim()]
      : []),
  ];

  function alternarCausa(valor: string) {
    setNaoConformidades((atual) =>
      atual.includes(valor)
        ? atual.filter((c) => c !== valor)
        : [...atual, valor],
    );
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!tipoAgente.trim()) throw new Error("Tipo de agente é obrigatório");
      if (situacao === "NAO_CONFORME" && causasFinais.length === 0) {
        throw new Error("Marque ao menos uma não conformidade");
      }

      const supabase = createSupabaseBrowserClient();
      const idExtintor = editing?.id_extintor ?? gerarId("EXT");

      const { urls, paths } = await uploadFotoSlots(
        supabase,
        slots,
        editing?.fotos_storage_paths ?? [],
        "fotos",
        `extintores/${idEmpresa}/${idInspecao}`,
        gerarId,
      );

      const payload = {
        id_extintor: idExtintor,
        id_inspecao: idInspecao,
        id_empresa: idEmpresa,
        id_setor: idSetor || null,
        tipo_agente: tipoAgente.trim(),
        capacidade: capacidade.trim() || null,
        numero_identificacao: numeroIdentificacao.trim() || null,
        localizacao: localizacao.trim() || null,
        data_validade: dataValidade || null,
        // `status` NÃO entra no payload: congelado na v158 como trilha do que
        // havia antes. Escrever aqui recriaria as duas fontes de verdade.
        situacao: situacao || null,
        // Causas só fazem sentido em NAO_CONFORME — senão fica "conforme, mas
        // vencido" no banco.
        nao_conformidades: situacao === "NAO_CONFORME" ? causasFinais : [],
        observacoes: observacoes.trim() || null,
        fotos_urls: urls,
        fotos_storage_paths: paths,
        ordem,
        ativo: editing?.ativo ?? true,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("extintores")
        .upsert(payload as never, { onConflict: "id_extintor" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inspecao", idInspecao] });
      toast.success(editing ? "Extintor atualizado" : "Extintor cadastrado");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Editar Extintor" : "Novo Extintor"}
      size="lg"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {/* Setor */}
        <div>
          <label className={lblCls}>Setor</label>
          <select
            value={idSetor}
            onChange={(e) => setIdSetor(e.target.value)}
            className={inputCls}
          >
            <option value="">— Geral / sem setor específico —</option>
            {setores.map((s) => (
              <option key={s.id_setor} value={s.id_setor}>
                {s.setor_ghe}
              </option>
            ))}
          </select>
        </div>

        {/* Tipo + Capacidade */}
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className={lblCls}>Tipo de agente extintor *</label>
            <input
              type="text"
              list="tipos-agente"
              value={tipoAgente}
              onChange={(e) => setTipoAgente(e.target.value)}
              required
              placeholder="Ex: Pó Químico Seco ABC"
              className={inputCls}
            />
            <datalist id="tipos-agente">
              {TIPOS_AGENTE.map((t) => <option key={t} value={t} />)}
            </datalist>
          </div>
          <div>
            <label className={lblCls}>Capacidade</label>
            <input
              type="text"
              list="capacidades"
              value={capacidade}
              onChange={(e) => setCapacidade(e.target.value)}
              placeholder="Ex: 4 kg, 9 L"
              className={inputCls}
            />
            <datalist id="capacidades">
              {CAPACIDADES.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
        </div>

        {/* Nº identificação + Localização */}
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className={lblCls}>Nº de identificação / Patrimônio</label>
            <input
              type="text"
              value={numeroIdentificacao}
              onChange={(e) => setNumeroIdentificacao(e.target.value)}
              placeholder="Ex: EXT-001"
              className={inputCls}
            />
          </div>
          <div>
            <label className={lblCls}>Localização no setor</label>
            <input
              type="text"
              value={localizacao}
              onChange={(e) => setLocalizacao(e.target.value)}
              placeholder="Ex: Próximo à saída de emergência"
              className={inputCls}
            />
          </div>
        </div>

        {/* Validade + Status + Ordem */}
        <div className="grid gap-3 md:grid-cols-[160px_1fr_100px]">
          <div>
            <label className={lblCls}>Validade do agente</label>
            <input
              type="date"
              value={dataValidade}
              onChange={(e) => setDataValidade(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={lblCls}>Situação</label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {(
                [
                  ["CONFORME", "Conforme"],
                  ["NAO_CONFORME", "Não conforme"],
                  ["", "Não avaliado"],
                ] as const
              ).map(([valor, rotulo]) => (
                <button
                  key={rotulo}
                  type="button"
                  onClick={() => {
                    setSituacao(valor);
                    if (valor !== "NAO_CONFORME") {
                      setNaoConformidades([]);
                      setOutraCausa("");
                    }
                  }}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                    situacao === valor
                      ? valor === "CONFORME"
                        ? "border-green-300 bg-green-50 text-green-800"
                        : valor === "NAO_CONFORME"
                          ? "border-red-300 bg-red-50 text-red-700"
                          : "border-gray-300 bg-gray-100 text-gray-700"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300",
                  )}
                >
                  {rotulo}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={lblCls}>Ordem</label>
            <input
              type="number"
              value={ordem}
              onChange={(e) => setOrdem(Number(e.target.value) || 0)}
              className={inputCls}
            />
          </div>
        </div>

        {/* Não conformidades — só quando o extintor foi marcado como tal */}
        {situacao === "NAO_CONFORME" && (
          <div className="rounded-md border border-red-200 bg-red-50/40 p-3">
            <p className="text-xs font-bold uppercase tracking-wider text-red-800">
              Não conformidades — marque quantas houver
            </p>
            <div className="mt-2 grid gap-1 sm:grid-cols-2">
              {NAO_CONFORMIDADES_EXTINTOR.map((nc) => (
                <label
                  key={nc.valor}
                  className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-white/70"
                >
                  <input
                    type="checkbox"
                    checked={naoConformidades.includes(nc.valor)}
                    onChange={() => alternarCausa(nc.valor)}
                    className="rounded border-gray-300 text-red-600 focus:ring-red-500/30"
                  />
                  <span className="text-sm text-gray-900">
                    {nc.valor}
                    {nc.critico && (
                      <span className="ml-1 text-[10px] font-bold uppercase text-red-600">
                        crítico
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>

            {/* Causas antigas digitadas à mão continuam marcáveis */}
            {naoConformidades
              .filter(
                (c) => !NAO_CONFORMIDADES_EXTINTOR.some((n) => n.valor === c),
              )
              .map((c) => (
                <label
                  key={c}
                  className="mt-1 flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-white/70"
                >
                  <input
                    type="checkbox"
                    checked
                    onChange={() => alternarCausa(c)}
                    className="rounded border-gray-300 text-red-600 focus:ring-red-500/30"
                  />
                  <span className="text-sm text-gray-900">{c}</span>
                </label>
              ))}

            <div className="mt-2">
              <label className={lblCls}>Outra não conformidade</label>
              <input
                type="text"
                value={outraCausa}
                onChange={(e) => setOutraCausa(e.target.value)}
                placeholder="Descreva, se não estiver na lista acima"
                className={inputCls}
              />
            </div>

            {causasFinais.length === 0 && (
              <p className="mt-2 text-xs text-red-700">
                Marque ao menos uma não conformidade, ou volte a situação para
                Conforme / Não avaliado.
              </p>
            )}
          </div>
        )}

        {/* Observações */}
        <div>
          <label className={lblCls}>Observações</label>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={2}
            placeholder="Observações sobre o extintor (opcional)"
            className={inputCls}
          />
        </div>

        {/* Fotos — até 4 */}
        <div>
          <label className={lblCls}>
            Fotos{" "}
            <span className="text-xs font-normal text-gray-500">
              (até 4)
            </span>
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
            disabled={save.isPending}
            className="rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-60"
          >
            {save.isPending ? "Salvando..." : editing ? "Salvar" : "Criar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const inputCls =
  "mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30";
const lblCls = "text-sm font-medium text-gray-700";
