"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Copy as CopyIcon, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import EmpresaSelect from "@/components/empresas/EmpresaSelect";
import { useInspecao } from "@/lib/hooks/useInspecao";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { gerarId } from "@/lib/utils";
import { useUserStore } from "@/lib/store";
import type { Cargo, Risco, Setor } from "@/lib/supabase/types";

interface Props {
  open: boolean;
  onClose: () => void;
  idInspecao: string;
  idEmpresaOrigem: string;
}

export default function CopiarParaEmpresaModal({
  open,
  onClose,
  idInspecao,
  idEmpresaOrigem,
}: Props) {
  const qc = useQueryClient();
  const router = useRouter();
  const user = useUserStore((s) => s.user);
  const { data: full } = useInspecao(open ? idInspecao : null);

  const [destinoId, setDestinoId] = useState<string | null>(null);
  const [opt, setOpt] = useState({
    setores: true,
    cargos: true,
    riscos: true,
    epis: true,
    responsaveis: false,
    fotos: false,
  });

  useEffect(() => {
    if (open) {
      setDestinoId(null);
      setOpt({
        setores: true,
        cargos: true,
        riscos: true,
        epis: true,
        responsaveis: false,
        fotos: false,
      });
    }
  }, [open]);

  const copiar = useMutation({
    mutationFn: async () => {
      if (!destinoId) throw new Error("Selecione a empresa destino");
      if (destinoId === idEmpresaOrigem)
        throw new Error("Selecione uma empresa diferente da origem");
      if (!full) throw new Error("Dados da inspeção ainda carregando");

      const supabase = createSupabaseBrowserClient();
      const novaInspId = gerarId("INS");

      const novaInsp = {
        id_inspecao: novaInspId,
        id_empresa: destinoId,
        data_inspecao: full.inspecao.data_inspecao,
        status: "EM_ANDAMENTO" as const,
        revisao: 1,
        responsavel: user?.nome ?? null,
        observacoes: full.inspecao.observacoes,
        tipo_criacao: "COPIA_EMPRESA" as const,
        id_inspecao_base: idInspecao,
        usuario: user?.email ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const { error: errInsp } = await supabase
        .from("inspecoes")
        .insert(novaInsp as never);
      if (errInsp) throw errInsp;

      const mapaSetor = new Map<string, string>();
      const mapaCargo = new Map<string, string>();
      const mapaRisco = new Map<string, string>();

      if (opt.setores && full.setores.length > 0) {
        const novos = full.setores.map<Partial<Setor>>((s) => {
          const novoId = gerarId("SET");
          mapaSetor.set(s.id_setor, novoId);
          return {
            id_setor: novoId,
            id_inspecao: novaInspId,
            id_empresa: destinoId,
            setor_ghe: s.setor_ghe,
            descricao: s.descricao,
            conformidade: s.conformidade,
            nao_conformidade: s.nao_conformidade,
          };
        });
        const { error } = await supabase.from("setores").insert(novos as never);
        if (error) throw error;
      }

      if (opt.cargos && opt.setores && full.cargos.length > 0) {
        const novos = full.cargos.map<Partial<Cargo>>((c) => {
          const novoId = gerarId("CGO");
          mapaCargo.set(c.id_cargo, novoId);
          return {
            id_cargo: novoId,
            id_inspecao: novaInspId,
            id_empresa: destinoId,
            id_setor: mapaSetor.get(c.id_setor) ?? c.id_setor,
            cargo: c.cargo,
            descricao: c.descricao,
          };
        });
        const { error } = await supabase.from("cargos").insert(novos as never);
        if (error) throw error;
      }

      if (opt.riscos && full.riscos.length > 0) {
        const novos = full.riscos.map<Partial<Risco>>((r) => {
          const novoId = gerarId("RSC");
          mapaRisco.set(r.id_risco, novoId);
          return {
            ...r,
            id_risco: novoId,
            id_inspecao: novaInspId,
            id_empresa: destinoId,
            id_setor: r.id_setor
              ? mapaSetor.get(r.id_setor) ?? r.id_setor
              : null,
            id_cargo: r.id_cargo
              ? mapaCargo.get(r.id_cargo) ?? r.id_cargo
              : null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        });
        const { error } = await supabase.from("riscos").insert(novos as never);
        if (error) throw error;
      }

      if (opt.epis && opt.riscos && full.epis.length > 0) {
        const novos = full.epis.map((e) => ({
          id_protecao: gerarId("EPI"),
          id_risco: mapaRisco.get(e.id_risco) ?? e.id_risco,
          id_inspecao: novaInspId,
          id_empresa: destinoId,
          id_setor: e.id_setor
            ? mapaSetor.get(e.id_setor) ?? e.id_setor
            : null,
          tipo: e.tipo,
          descricao: e.descricao,
          ca: e.ca,
          recomendado: e.recomendado,
        }));
        const { error } = await supabase
          .from("epi_epc")
          .insert(novos as never);
        if (error) throw error;
      }

      if (opt.responsaveis && full.responsaveis.length > 0) {
        const novos = full.responsaveis.map((r) => ({
          id_responsavel: gerarId("RSP"),
          id_inspecao: novaInspId,
          id_empresa: destinoId,
          tecnico_responsavel: r.tecnico_responsavel,
          recepcionado_por: r.recepcionado_por,
          cargo: r.cargo,
          data_hora: r.data_hora,
        }));
        const { error } = await supabase
          .from("responsaveis")
          .insert(novos as never);
        if (error) throw error;
      }

      // Fotos: clona apenas o registro com mesma URL pública (compartilhada).
      if (opt.fotos && full.fotos.length > 0) {
        const novos = full.fotos.map((f) => ({
          id_foto: gerarId("FOTO"),
          id_inspecao: novaInspId,
          id_empresa: destinoId,
          id_setor: f.id_setor
            ? mapaSetor.get(f.id_setor) ?? f.id_setor
            : null,
          categoria: f.categoria,
          legenda: f.legenda,
          arquivo_foto: f.arquivo_foto,
          storage_path: f.storage_path,
          data_upload: new Date().toISOString(),
          usuario: user?.email ?? null,
        }));
        const { error } = await supabase.from("fotos").insert(novos as never);
        if (error) throw error;
      }

      return novaInspId;
    },
    onSuccess: (novoId) => {
      qc.invalidateQueries({ queryKey: ["inspecoes"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["dashboard-recentes"] });
      toast.success("Inspeção copiada com sucesso");
      onClose();
      router.push(`/inspecoes/${novoId}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Copiar para outra empresa"
      size="lg"
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Cria uma nova inspeção em outra empresa, copiando os dados
          selecionados desta inspeção.
        </p>

        <div>
          <label className="text-sm font-medium text-gray-700">
            Empresa destino *
          </label>
          <EmpresaSelect
            value={destinoId}
            onChange={setDestinoId}
            placeholder="Selecione a empresa destino..."
            modulo="sst"
          />
          {destinoId === idEmpresaOrigem && (
            <p className="mt-1 text-xs text-red-alert">
              Empresa destino não pode ser a mesma da origem.
            </p>
          )}
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">O que copiar</p>
          <div className="grid grid-cols-2 gap-2 rounded-lg border border-gray-200 bg-white p-3">
            <Checkbox
              label="Setores"
              checked={opt.setores}
              onChange={(v) => setOpt({ ...opt, setores: v })}
            />
            <Checkbox
              label="Cargos"
              checked={opt.cargos}
              disabled={!opt.setores}
              onChange={(v) => setOpt({ ...opt, cargos: v })}
            />
            <Checkbox
              label="Riscos"
              checked={opt.riscos}
              onChange={(v) => setOpt({ ...opt, riscos: v })}
            />
            <Checkbox
              label="EPIs/EPCs"
              checked={opt.epis}
              disabled={!opt.riscos}
              onChange={(v) => setOpt({ ...opt, epis: v })}
            />
            <Checkbox
              label="Responsáveis"
              checked={opt.responsaveis}
              onChange={(v) => setOpt({ ...opt, responsaveis: v })}
            />
            <Checkbox
              label="Fotos (referência URL)"
              checked={opt.fotos}
              onChange={(v) => setOpt({ ...opt, fotos: v })}
            />
          </div>
          {!opt.setores && (
            <p className="mt-1 text-xs text-amber-warning">
              ⚠ Sem copiar setores, cargos e fotos vinculadas a setor não terão
              referência válida.
            </p>
          )}
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
            disabled={!destinoId || copiar.isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-60"
          >
            {copiar.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CopyIcon className="size-4" />
            )}
            Copiar agora
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-gray-50 ${
        disabled ? "opacity-50" : "cursor-pointer"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-gray-300 text-verde-primary focus:ring-verde-primary/30"
      />
      <span>{label}</span>
    </label>
  );
}
