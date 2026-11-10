"use client";

import { useRef, type ChangeEvent } from "react";
import { Camera, Images, Loader2 } from "lucide-react";

const BOTAO =
  "inline-flex items-center gap-1.5 rounded-md border border-sky-300 bg-white px-2.5 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-50 disabled:opacity-50";

/**
 * Câmera e galeria separadas: com `capture`, o celular abre a câmera e só devolve uma foto;
 * sem ele, deixa escolher várias. Onde há mouse a câmera não se aplica, então fica só a escolha.
 */
export default function BotoesFotosCampo({
  quantidade,
  enviando,
  limiteAtingido,
  tituloLimite,
  onArquivos,
}: {
  quantidade: number;
  enviando: boolean;
  limiteAtingido: boolean;
  tituloLimite: string;
  onArquivos: (arquivos: File[]) => void;
}) {
  const camera = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);
  const bloqueado = enviando || limiteAtingido;

  function escolher(e: ChangeEvent<HTMLInputElement>) {
    const arquivos = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (arquivos.length > 0) onArquivos(arquivos);
  }

  return (
    <>
      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={escolher} />
      <input ref={galeria} type="file" accept="image/*" multiple className="hidden" onChange={escolher} />
      <button
        type="button"
        onClick={() => camera.current?.click()}
        disabled={bloqueado}
        className={`${BOTAO} [@media(pointer:fine)]:hidden`}
        title={limiteAtingido ? tituloLimite : "Tirar foto"}
      >
        <Camera className="size-4" />
        Tirar foto
      </button>
      <button
        type="button"
        onClick={() => galeria.current?.click()}
        disabled={bloqueado}
        className={BOTAO}
        title={limiteAtingido ? tituloLimite : "Escolher uma ou mais fotos"}
      >
        {enviando ? <Loader2 className="size-4 animate-spin" /> : <Images className="size-4" />}
        {quantidade > 0 ? `Escolher fotos (${quantidade})` : "Escolher fotos"}
      </button>
    </>
  );
}
