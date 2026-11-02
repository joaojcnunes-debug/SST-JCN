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
import { hojeSP } from "@/lib/inspecoes/prioridade";
import {
  ITENS_COPIA,
  OPCOES_COPIA_PADRAO,
  gravarCopia,
  montarCopia,
  type OpcoesCopia,
} from "@/lib/inspecoes/copiar";
import { copiarErgonomia } from "@/lib/inspecoes/copiar-ergonomia";

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
  const [opt, setOpt] = useState<OpcoesCopia>(OPCOES_COPIA_PADRAO);

  useEffect(() => {
    if (open) {
      setDestinoId(null);
      setOpt(OPCOES_COPIA_PADRAO);
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
        // 30/10: a cópia é trabalho de hoje — a data da origem fazia a nova inspeção nascer
        // "aberta há 113 dias" e entrar no mês errado dos gráficos.
        data_inspecao: hojeSP(),
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

      // Tudo o que foi marcado, com todas as colunas (ver lib/inspecoes/copiar.ts).
      const linhas = montarCopia(full, {
        idInspecao: novaInspId,
        idEmpresa: destinoId,
        opcoes: opt,
        usuarioEmail: user?.email ?? null,
        agora: new Date().toISOString(),
        gerarId,
        gerarUuid: () => crypto.randomUUID(),
      });
      await gravarCopia(supabase, linhas);

      if (opt.ergonomia) {
        const ergo = await copiarErgonomia(supabase, {
          idOrigem: idInspecao,
          idInspecao: novaInspId,
          idEmpresa: destinoId,
          gerarId,
        });
        if (ergo.erro) {
          toast.error(`Inspeção copiada, mas a Ergonomia (AEP/AET) não: ${ergo.erro}`, { duration: 8000 });
        }
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
          selecionados desta inspeção. A nova inspeção fica com a data de
          hoje ({hojeSP().split("-").reverse().join("/")}), não a da inspeção
          de origem.
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
            {ITENS_COPIA.map(({ chave, rotulo, precisa }) => (
              <Checkbox
                key={chave}
                label={rotulo}
                checked={opt[chave] && (!precisa || opt[precisa])}
                disabled={!!precisa && !opt[precisa]}
                onChange={(v) => setOpt({ ...opt, [chave]: v })}
              />
            ))}
          </div>
          {!opt.setores && (
            <p className="mt-1 text-xs text-amber-warning">
              ⚠ Sem copiar setores, os cargos ficam de fora e os demais itens
              copiados ficam sem setor.
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
