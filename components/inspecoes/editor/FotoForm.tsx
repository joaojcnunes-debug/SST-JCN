"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { gravar } from "@/lib/offline/gravar";
import { operacaoPendenteQueCria } from "@/lib/offline/operacoes";
import type { InspecaoFull } from "@/lib/hooks/useInspecao";
import { gerarId } from "@/lib/utils";
import { CATEGORIAS_FOTO } from "@/lib/constants";
import type { CategoriaFoto, Foto, Setor } from "@/lib/supabase/types";
import { useUserStore } from "@/lib/store";

interface Props {
  open: boolean;
  onClose: () => void;
  idInspecao: string;
  idEmpresa: string;
  setores: Setor[];
  foto?: Foto | null;
}

export default function FotoForm({
  open,
  onClose,
  idInspecao,
  idEmpresa,
  setores,
  foto,
}: Props) {
  const qc = useQueryClient();
  const user = useUserStore((s) => s.user);
  const isEdit = !!foto;

  const [categoria, setCategoria] = useState<CategoriaFoto>("Geral");
  const [idSetor, setIdSetor] = useState<string>("");
  const [legenda, setLegenda] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (open) {
      setCategoria((foto?.categoria as CategoriaFoto) ?? "Geral");
      setIdSetor(foto?.id_setor ?? "");
      setLegenda(foto?.legenda ?? "");
      setFile(null);
      setProgress(0);
    }
  }, [open, foto]);

  /**
   * O primeiro formulário da inspeção que leva ARQUIVO para o offline.
   *
   * O que torna isso possível sem rede: `getPublicUrl` é montagem de string, não
   * chamada de rede. Então a URL final da foto é conhecida no momento da
   * captura, e a linha pode ser gravada já apontando para o lugar certo — o
   * arquivo chega depois, no mesmo caminho, quando a fila subir.
   *
   * A foto é guardada como saiu da câmera, sem redução. É o mesmo que o caminho
   * online sempre fez, e manter igual evita que a mesma inspeção acabe com fotos
   * nítidas e fotos reduzidas conforme o técnico tinha sinal ou não. O custo é
   * espaço no aparelho — ver a nota em `docs/inspecoes/TESTE-OFFLINE.md`.
   */
  const mutation = useMutation({
    mutationFn: async () => {
      const supabase = createSupabaseBrowserClient();

      if (isEdit && foto) {
        const payload = {
          categoria,
          id_setor: idSetor || null,
          legenda: legenda.trim() || null,
        };
        const resultado = await gravar({
          tabela: "fotos",
          tipo: "update",
          linhas: payload,
          filtro: { id_foto: foto.id_foto },
          modulo: "inspecoes",
          id_documento: idInspecao,
        });
        return { resultado, linha: { ...foto, ...payload } as Foto };
      }

      if (!file) throw new Error("Selecione um arquivo");

      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${idEmpresa}/${idInspecao}/${gerarId("FT")}.${ext}`;

      setProgress(20);
      const { data: pub } = supabase.storage.from("fotos").getPublicUrl(path);

      const insertRow = {
        id_foto: gerarId("FOTO"),
        id_inspecao: idInspecao,
        id_empresa: idEmpresa,
        id_setor: idSetor || null,
        categoria,
        legenda: legenda.trim() || null,
        arquivo_foto: pub.publicUrl,
        storage_path: path,
        data_upload: new Date().toISOString(),
        usuario: user?.email ?? null,
      };

      // A foto pode ser de um setor cadastrado agora, ainda na fila.
      const criadorDoSetor = idSetor
        ? await operacaoPendenteQueCria("setores", "id_setor", idSetor)
        : null;

      setProgress(70);
      const resultado = await gravar({
        tabela: "fotos",
        tipo: "insert",
        linhas: [insertRow],
        filtro: null,
        modulo: "inspecoes",
        id_documento: idInspecao,
        imagens: [{ blob: file, caminho: path }],
        depende_de: criadorDoSetor ? [criadorDoSetor] : undefined,
      });
      setProgress(100);
      return { resultado, linha: insertRow as unknown as Foto };
    },
    onSuccess: ({ resultado, linha }) => {
      if (resultado.destino === "SERVIDOR") {
        qc.invalidateQueries({ queryKey: ["inspecao", idInspecao] });
        toast.success(isEdit ? "Foto atualizada" : "Foto enviada");
      } else {
        // Sem rede não há o que revalidar: a lista da tela é atualizada à mão.
        qc.setQueryData<InspecaoFull>(["inspecao", idInspecao], (antigo) => {
          if (!antigo) return antigo;
          return {
            ...antigo,
            fotos: isEdit
              ? antigo.fotos.map((f) => (f.id_foto === linha.id_foto ? linha : f))
              : [...antigo.fotos, linha],
          };
        });
        toast.success(
          isEdit ? "Alteração guardada no aparelho" : "Foto guardada no aparelho",
          { icon: "📵" }
        );
      }

      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar Foto" : "Enviar Foto"}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {!isEdit && (
          <div>
            <label className={lblCls}>Arquivo *</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-verde-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-verde-accent"
            />
            {file && (
              <p className="mt-1 text-xs text-gray-500">
                {file.name} · {(file.size / 1024).toFixed(0)} KB
              </p>
            )}
          </div>
        )}
        <div>
          <label className={lblCls}>Categoria</label>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as CategoriaFoto)}
            className={inputCls}
          >
            {CATEGORIAS_FOTO.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={lblCls}>Setor de destino</label>
          <select
            value={idSetor}
            onChange={(e) => setIdSetor(e.target.value)}
            className={inputCls}
          >
            <option value="">— Sem setor específico —</option>
            {setores.map((s) => (
              <option key={s.id_setor} value={s.id_setor}>
                {s.setor_ghe}
              </option>
            ))}
          </select>
          {setores.length === 0 && (
            <p className="mt-1 text-xs text-amber-700">
              Nenhum setor cadastrado nesta inspeção — cadastre na aba Setores
              para vincular a foto.
            </p>
          )}
        </div>
        <div>
          <label className={lblCls}>Legenda</label>
          <input
            type="text"
            value={legenda}
            onChange={(e) => setLegenda(e.target.value)}
            className={inputCls}
            placeholder="Descrição da foto"
          />
        </div>

        {mutation.isPending && (
          <div>
            <p className="text-xs text-gray-500">Enviando... {progress}%</p>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full bg-verde-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
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
            type="submit"
            disabled={mutation.isPending || (!isEdit && !file)}
            className="rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-60"
          >
            {mutation.isPending ? "Enviando..." : isEdit ? "Salvar" : "Enviar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const inputCls =
  "mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30";
const lblCls = "text-sm font-medium text-gray-700";
