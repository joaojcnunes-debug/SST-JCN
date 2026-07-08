"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Eraser } from "lucide-react";

export interface SignatureCanvasHandle {
  /** PNG data URL da assinatura, ou null se vazia. */
  getDataUrl: () => string | null;
  clear: () => void;
  isEmpty: () => boolean;
}

/**
 * Canvas de assinatura manuscrita — sem dependências externas. Suporta mouse e
 * toque (pointer events), alta densidade (devicePixelRatio) e limpeza. O traço
 * é capturado como imagem PNG para a trilha de evidências (Fase 4).
 */
const SignatureCanvas = forwardRef<
  SignatureCanvasHandle,
  { onChange?: (vazio: boolean) => void; className?: string }
>(function SignatureCanvas({ onChange, className }, ref) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const desenhando = useRef(false);
  const ultimo = useRef<{ x: number; y: number } | null>(null);
  const [vazio, setVazio] = useState(true);

  // (re)configura o contexto respeitando o tamanho de layout e o DPR.
  function configurar() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111827";
    ctxRef.current = ctx;
  }

  useEffect(() => {
    configurar();
    const onResize = () => {
      // redimensionar limpa o canvas (aceitável: assinatura é feita de uma vez)
      configurar();
      setVazio(true);
      onChange?.(true);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    desenhando.current = true;
    ultimo.current = pos(e);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!desenhando.current || !ctxRef.current) return;
    e.preventDefault();
    const p = pos(e);
    const ctx = ctxRef.current;
    ctx.beginPath();
    ctx.moveTo(ultimo.current!.x, ultimo.current!.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ultimo.current = p;
    if (vazio) {
      setVazio(false);
      onChange?.(false);
    }
  }

  function end(e: React.PointerEvent<HTMLCanvasElement>) {
    desenhando.current = false;
    ultimo.current = null;
    try {
      canvasRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignora */
    }
  }

  function limpar() {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setVazio(true);
    onChange?.(true);
  }

  useImperativeHandle(ref, () => ({
    getDataUrl: () =>
      vazio || !canvasRef.current ? null : canvasRef.current.toDataURL("image/png"),
    clear: limpar,
    isEmpty: () => vazio,
  }));

  return (
    <div className={className}>
      <div className="relative overflow-hidden rounded-lg border-2 border-dashed border-gray-300 bg-white">
        <canvas
          ref={canvasRef}
          className="block h-40 w-full cursor-crosshair touch-none"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
        />
        {vazio && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-gray-300">
            Assine aqui
          </span>
        )}
      </div>
      <div className="mt-1.5 flex justify-end">
        <button
          type="button"
          onClick={limpar}
          className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700"
        >
          <Eraser className="size-3.5" /> Limpar
        </button>
      </div>
    </div>
  );
});

export default SignatureCanvas;
