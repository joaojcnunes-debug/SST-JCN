"use client";

import { useEffect, useState } from "react";
import { Save, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { gravar } from "@/lib/offline/gravar";
import type { InspecaoFull } from "@/lib/hooks/useInspecao";

interface Props {
  idInspecao: string;
  observacoes: string | null;
  readOnly?: boolean;
}

export default function ObservacoesTab({
  idInspecao,
  observacoes,
  readOnly,
}: Props) {
  const qc = useQueryClient();
  const [text, setText] = useState(observacoes ?? "");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setText(observacoes ?? "");
    setDirty(false);
  }, [observacoes]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        observacoes: text || null,
        updated_at: new Date().toISOString(),
      };
      const resultado = await gravar({
        tabela: "inspecoes",
        tipo: "update",
        linhas: payload,
        filtro: { id_inspecao: idInspecao },
        modulo: "inspecoes",
        id_documento: idInspecao,
      });
      return { resultado, payload };
    },
    onSuccess: ({ resultado, payload }) => {
      setDirty(false);

      if (resultado.destino === "SERVIDOR") {
        qc.invalidateQueries({ queryKey: ["inspecao", idInspecao] });
        toast.success("Observações salvas");
      } else {
        // A observação vive na própria linha da inspeção, e não numa lista —
        // por isso o patch aqui é em `inspecao`, e não num filtro de array.
        qc.setQueryData<InspecaoFull>(["inspecao", idInspecao], (antigo) =>
          antigo ? { ...antigo, inspecao: { ...antigo.inspecao, ...payload } } : antigo,
        );
        toast.success("Observações guardadas no aparelho", { icon: "📵" });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setDirty(true);
        }}
        onBlur={() => {
          if (dirty && !readOnly) save.mutate();
        }}
        readOnly={readOnly}
        rows={14}
        placeholder="Observações gerais da inspeção..."
        className="w-full rounded-xl border border-gray-300 bg-white p-4 text-sm shadow-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
      />
      {!readOnly && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">
            Salvamento automático ao sair do campo.
          </p>
          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={!dirty || save.isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-verde-accent disabled:opacity-50"
          >
            {save.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Salvar agora
          </button>
        </div>
      )}
    </div>
  );
}
