"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, ImagePlus, Loader2, Trash2, X } from "lucide-react";
import StorageImg from "@/components/ui/StorageImg";
import {
  POR_PAGINA,
  useEnviarFotosGaleria,
  useGaleriaPagina,
  useGaleriaTotal,
  useRemoverFotoGaleria,
} from "@/lib/hooks/useFrotaGaleria";
import type { FrotaVeiculoFoto } from "@/lib/frota/tipos";
import { formatarBytes } from "@/lib/frota/fotos";

/**
 * Galeria do veículo — sem limite de quantidade, com paginação de 24.
 *
 * A grade lê SÓ a miniatura (320 px). A vista (1600 px) só é baixada quando
 * alguém abre a foto. Sem essa separação, uma galeria de 200 fotos baixaria
 * centenas de MB para desenhar quadradinhos.
 */

export default function GaleriaFotos({ idVeiculo }: { idVeiculo: string }) {
  const [pagina, setPagina] = useState(0);
  const [aberta, setAberta] = useState<FrotaVeiculoFoto | null>(null);
  const [progresso, setProgresso] = useState<{ feitas: number; total: number } | null>(null);

  const { data: total = 0 } = useGaleriaTotal(idVeiculo);
  const { data: fotos = [], isLoading } = useGaleriaPagina(idVeiculo, pagina);
  const enviar = useEnviarFotosGaleria();
  const remover = useRemoverFotoGaleria();

  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  async function aoEscolher(files: FileList | null) {
    if (!files || files.length === 0) return;
    const lista = Array.from(files);
    setProgresso({ feitas: 0, total: lista.length });
    try {
      await enviar.mutateAsync({
        id_veiculo: idVeiculo,
        files: lista,
        onProgresso: (feitas, t) => setProgresso({ feitas, total: t }),
      });
      setPagina(0);
    } finally {
      setProgresso(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-500">
          {total} {total === 1 ? "foto" : "fotos"}
          {paginas > 1 && (
            <span className="text-gray-400">
              {" · "}página {pagina + 1} de {paginas}
            </span>
          )}
        </p>

        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          {progresso ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
          {progresso ? `Enviando ${progresso.feitas}/${progresso.total}…` : "Adicionar fotos"}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={!!progresso}
            onChange={(e) => aoEscolher(e.target.files)}
          />
        </label>
      </div>

      {isLoading ? (
        <p className="py-10 text-center text-sm text-gray-500">Carregando…</p>
      ) : fotos.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white py-14 text-center">
          <ImagePlus className="mx-auto size-7 text-gray-300" />
          <p className="mt-2 text-sm font-medium text-gray-700">Nenhuma foto ainda</p>
          <p className="mt-1 text-sm text-gray-500">
            Sem limite de quantidade — envie quantas precisar, de uma vez.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {fotos.map((foto) => (
            <li key={foto.id_foto} className="group relative">
              <button
                type="button"
                onClick={() => setAberta(foto)}
                className="block w-full overflow-hidden rounded-md border border-gray-200 bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
              >
                <StorageImg
                  stored={foto.thumb_path}
                  alt={foto.legenda ?? "Foto do veículo"}
                  className="aspect-[4/3] w-full object-cover transition-transform group-hover:scale-[1.02]"
                />
              </button>

              {foto.legenda && (
                <p className="mt-1 truncate text-xs text-gray-500" title={foto.legenda}>
                  {foto.legenda}
                </p>
              )}

              <button
                type="button"
                onClick={() => {
                  if (confirm("Remover esta foto? A ação não vai para a lixeira.")) {
                    remover.mutate({ id_foto: foto.id_foto, id_veiculo: idVeiculo });
                  }
                }}
                aria-label="Remover foto"
                className="absolute right-1.5 top-1.5 rounded-md bg-white/90 p-1 text-gray-500 opacity-0 shadow-sm transition-opacity hover:text-red-600 focus-visible:opacity-100 group-hover:opacity-100"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {paginas > 1 && (
        <div className="flex items-center justify-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => setPagina((p) => Math.max(0, p - 1))}
            disabled={pagina === 0}
            className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          >
            <ChevronLeft className="size-4" />
            Anterior
          </button>
          <span className="text-sm tabular-nums text-gray-500">
            {pagina + 1} / {paginas}
          </span>
          <button
            type="button"
            onClick={() => setPagina((p) => Math.min(paginas - 1, p + 1))}
            disabled={pagina >= paginas - 1}
            className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          >
            Próxima
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}

      {/* Visualizador: só aqui a vista de 1600 px é baixada. */}
      {aberta && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Foto do veículo"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setAberta(null)}
        >
          <button
            type="button"
            onClick={() => setAberta(null)}
            aria-label="Fechar"
            className="absolute right-4 top-4 rounded-md bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <X className="size-5" />
          </button>
          <div className="max-h-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <StorageImg
              stored={aberta.vista_path}
              alt={aberta.legenda ?? "Foto do veículo"}
              className="max-h-[80vh] w-auto rounded-lg object-contain"
            />
            <p className="mt-2 text-center text-sm text-white/80">
              {aberta.legenda ?? "Sem legenda"}
              {aberta.largura && aberta.altura && (
                <span className="text-white/50">
                  {" · "}
                  {aberta.largura}×{aberta.altura}
                  {aberta.bytes ? ` · ${formatarBytes(aberta.bytes)}` : ""}
                </span>
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
