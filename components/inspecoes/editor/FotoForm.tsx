"use client";

import Dica from "@/components/ui/Dica";
import { DICAS_FOTO } from "@/lib/dicas/inspecao-editor";
import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { gravar } from "@/lib/offline/gravar";
import { operacaoPendenteQueCria } from "@/lib/offline/operacoes";
import type { InspecaoFull } from "@/lib/hooks/useInspecao";
import { gerarId } from "@/lib/utils";
import { fotosEnviadas } from "@/lib/fotos/lote";
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
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (open) {
      setCategoria((foto?.categoria as CategoriaFoto) ?? "Geral");
      setIdSetor(foto?.id_setor ?? "");
      setLegenda(foto?.legenda ?? "");
      setFiles([]);
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
        return { resultado, linhas: [{ ...foto, ...payload } as Foto] };
      }

      if (files.length === 0) throw new Error("Selecione ao menos uma imagem");

      setProgress(20);
      // Cada imagem vira uma foto, todas com a mesma categoria, setor e legenda.
      const novas = files.map((file) => {
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `${idEmpresa}/${idInspecao}/${gerarId("FT")}.${ext}`;
        const { data: pub } = supabase.storage.from("fotos").getPublicUrl(path);
        return {
          blob: file,
          caminho: path,
          linha: {
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
          },
        };
      });

      // A foto pode ser de um setor cadastrado agora, ainda na fila.
      const criadorDoSetor = idSetor
        ? await operacaoPendenteQueCria("setores", "id_setor", idSetor)
        : null;

      setProgress(70);
      const resultado = await gravar({
        tabela: "fotos",
        tipo: "insert",
        linhas: novas.map((n) => n.linha),
        filtro: null,
        modulo: "inspecoes",
        id_documento: idInspecao,
        imagens: novas.map(({ blob, caminho }) => ({ blob, caminho })),
        depende_de: criadorDoSetor ? [criadorDoSetor] : undefined,
      });
      setProgress(100);
      return { resultado, linhas: novas.map((n) => n.linha) as unknown as Foto[] };
    },
    onSuccess: ({ resultado, linhas }) => {
      if (resultado.destino === "SERVIDOR") {
        qc.invalidateQueries({ queryKey: ["inspecao", idInspecao] });
        toast.success(isEdit ? "Foto atualizada" : fotosEnviadas(linhas.length));
      } else {
        // Sem rede não há o que revalidar: a lista da tela é atualizada à mão.
        qc.setQueryData<InspecaoFull>(["inspecao", idInspecao], (antigo) => {
          if (!antigo) return antigo;
          return {
            ...antigo,
            fotos: isEdit
              ? antigo.fotos.map((f) => (f.id_foto === linhas[0].id_foto ? linhas[0] : f))
              : [...antigo.fotos, ...linhas],
          };
        });
        toast.success(
          isEdit ? "Alteração guardada no aparelho" : linhas.length === 1 ? "Foto guardada no aparelho" : `${linhas.length} fotos guardadas no aparelho`,
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
      title={isEdit ? "Editar Foto" : "Enviar Fotos"}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {!isEdit && (
          <div>
            <label className={lblCls}>Imagens *</label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-marca-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-marca-accent"
            />
            {files.length > 0 && (
              <p className="mt-1 text-xs text-gray-500">
                {files.length === 1
                  ? `${files[0].name} · ${(files[0].size / 1024).toFixed(0)} KB`
                  : `${files.length} imagens selecionadas · categoria, setor e legenda valem para todas`}
              </p>
            )}
          </div>
        )}
        <div>
          <label className={lblCls}><Dica texto={DICAS_FOTO.categoria}>Categoria</Dica></label>
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
          <label className={lblCls}><Dica texto={DICAS_FOTO.setor}>Setor de destino</Dica></label>
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
          <label className={lblCls}><Dica texto={DICAS_FOTO.legenda}>Legenda</Dica></label>
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
                className="h-full bg-marca-primary transition-all"
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
            disabled={mutation.isPending || (!isEdit && files.length === 0)}
            className="rounded-md bg-marca-primary px-4 py-2 text-sm font-semibold text-white hover:bg-marca-accent disabled:opacity-60"
          >
            {mutation.isPending ? "Enviando..." : isEdit ? "Salvar" : "Enviar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const inputCls =
  "mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-marca-primary focus:outline-none focus:ring-2 focus:ring-marca-primary/30";
const lblCls = "text-sm font-medium text-gray-700";
