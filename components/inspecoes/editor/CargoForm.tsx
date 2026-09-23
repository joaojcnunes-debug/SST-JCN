"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import AvisoRascunho from "@/components/ui/AvisoRascunho";
import { useRascunho } from "@/lib/hooks/useRascunho";
import { gravar } from "@/lib/offline/gravar";
import { operacaoPendenteQueCria } from "@/lib/offline/operacoes";
import type { InspecaoFull } from "@/lib/hooks/useInspecao";
import { gerarId } from "@/lib/utils";
import type { Cargo, Setor } from "@/lib/supabase/types";

interface Props {
  open: boolean;
  onClose: () => void;
  idInspecao: string;
  idEmpresa: string;
  idSetor: string;
  setores?: Setor[];
  cargo?: Cargo | null;
}

export default function CargoForm({
  open,
  onClose,
  idInspecao,
  idEmpresa,
  idSetor,
  setores = [],
  cargo,
}: Props) {
  const qc = useQueryClient();
  const isEdit = !!cargo;
  const [form, setForm] = useState({
    cargo: "",
    descricao: "",
    id_setor: idSetor,
  });

  useEffect(() => {
    if (open) {
      setForm({
        cargo: cargo?.cargo ?? "",
        descricao: cargo?.descricao ?? "",
        id_setor: cargo?.id_setor ?? idSetor,
      });
    }
  }, [open, cargo, idSetor]);

  // Rascunho contra queda de luz — só ao adicionar; nada volta sem clique.
  const rascunho = useRascunho(`cargo:${idInspecao}`, form, {
    ativo: open && !isEdit,
  });

  /**
   * Mesmo caminho do SetorForm, com uma diferença: o cargo aponta para um setor,
   * e esse setor pode ter sido criado offline e ainda estar na fila. Por isso a
   * consulta a `operacaoPendenteQueCria` — sem ela, um setor recusado faria o
   * cargo ser recusado junto, e o técnico procuraria o defeito no cargo.
   */
  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        cargo: form.cargo.trim(),
        descricao: form.descricao.trim() || null,
        id_setor: form.id_setor,
      };

      const criadorDoSetor = await operacaoPendenteQueCria(
        "setores",
        "id_setor",
        form.id_setor
      );
      const depende_de = criadorDoSetor ? [criadorDoSetor] : undefined;

      if (isEdit && cargo) {
        const resultado = await gravar({
          tabela: "cargos",
          tipo: "update",
          linhas: payload,
          filtro: { id_cargo: cargo.id_cargo },
          modulo: "inspecoes",
          id_documento: idInspecao,
          depende_de,
        });
        return { resultado, linha: { ...cargo, ...payload } as Cargo };
      }

      const row = {
        id_cargo: gerarId("CGO"),
        id_inspecao: idInspecao,
        id_empresa: idEmpresa,
        ...payload,
      };
      const resultado = await gravar({
        tabela: "cargos",
        tipo: "insert",
        linhas: [row],
        filtro: null,
        modulo: "inspecoes",
        id_documento: idInspecao,
        depende_de,
      });
      return { resultado, linha: row as unknown as Cargo };
    },
    onSuccess: ({ resultado, linha }) => {
      rascunho.limpar();

      if (resultado.destino === "SERVIDOR") {
        qc.invalidateQueries({ queryKey: ["inspecao", idInspecao] });
        toast.success(isEdit ? "Cargo atualizado" : "Cargo adicionado");
      } else {
        // Sem rede não há o que revalidar: a lista da tela é atualizada à mão.
        qc.setQueryData<InspecaoFull>(["inspecao", idInspecao], (antigo) => {
          if (!antigo) return antigo;
          return {
            ...antigo,
            cargos: isEdit
              ? antigo.cargos.map((c) => (c.id_cargo === linha.id_cargo ? linha : c))
              : [...antigo.cargos, linha],
          };
        });
        toast.success(
          isEdit ? "Alteração guardada no aparelho" : "Cargo guardado no aparelho",
          { icon: "📵" }
        );
      }

      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.cargo.trim()) {
      toast.error("Nome do cargo é obrigatório");
      return;
    }
    mutation.mutate();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar Cargo" : "Novo Cargo"}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {rascunho.pendente && (
          <AvisoRascunho
            idadeMin={rascunho.pendente.idadeMin}
            onRecuperar={() => {
              const v = rascunho.recuperar();
              if (v) setForm(v);
            }}
            onDescartar={rascunho.descartar}
          />
        )}
        {setores.length > 0 && (
          <div>
            <label className="text-sm font-medium text-gray-700">Setor</label>
            <select
              value={form.id_setor}
              onChange={(e) => setForm({ ...form, id_setor: e.target.value })}
              className={inputCls}
            >
              {setores.map((s) => (
                <option key={s.id_setor} value={s.id_setor}>
                  {s.setor_ghe}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="text-sm font-medium text-gray-700">Cargo *</label>
          <input
            type="text"
            value={form.cargo}
            onChange={(e) => setForm({ ...form, cargo: e.target.value })}
            className={inputCls}
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700">Descrição</label>
          <textarea
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            rows={3}
            className={inputCls}
          />
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
            {mutation.isPending ? "Salvando..." : isEdit ? "Salvar" : "Adicionar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const inputCls =
  "mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30";
