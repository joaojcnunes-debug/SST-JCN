"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, ShieldCheck, FileText } from "lucide-react";
import toast from "react-hot-toast";
import EpiModal, { inputCls, labelCls } from "./EpiModal";
import SignatureCanvas, { type SignatureCanvasHandle } from "./SignatureCanvas";
import { useAssinarEntrega, sha256Hex } from "@/lib/hooks/useEpi";

/**
 * Coleta a assinatura biométrica do recebedor (Fase 4). Ao abrir, baixa o PDF
 * exato da ficha e calcula o SHA-256 — o hash daquilo que o colaborador está
 * consentindo. A confirmação registra imagem manuscrita + hash + user-agent/IP
 * na trilha append-only.
 */
export default function EpiAssinaturaModal({
  open,
  onClose,
  entregaId,
  empresaId,
  colaboradorNome,
}: {
  open: boolean;
  onClose: () => void;
  entregaId: string;
  empresaId: string;
  colaboradorNome: string;
}) {
  const assinar = useAssinarEntrega();
  const sigRef = useRef<SignatureCanvasHandle | null>(null);
  const [nome, setNome] = useState(colaboradorNome);
  const [hash, setHash] = useState<string | null>(null);
  const [carregandoHash, setCarregandoHash] = useState(false);
  const [erroHash, setErroHash] = useState<string | null>(null);
  const [vazio, setVazio] = useState(true);

  useEffect(() => {
    if (!open) return;
    setNome(colaboradorNome);
    setHash(null);
    setErroHash(null);
    setCarregandoHash(true);
    let cancelado = false;
    (async () => {
      try {
        const res = await fetch(`/api/pdf/epi-entrega/${entregaId}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Falha ao carregar a ficha");
        const buf = await res.arrayBuffer();
        const h = await sha256Hex(buf);
        if (!cancelado) setHash(h);
      } catch (e) {
        if (!cancelado)
          setErroHash(
            e instanceof Error ? e.message : "Falha ao carregar a ficha",
          );
      } finally {
        if (!cancelado) setCarregandoHash(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [open, entregaId, colaboradorNome]);

  if (!open) return null;

  function confirmar() {
    const png = sigRef.current?.getDataUrl();
    if (!png) {
      toast.error("Assine no quadro antes de confirmar.");
      return;
    }
    if (!nome.trim()) {
      toast.error("Informe o nome de quem está assinando.");
      return;
    }
    if (!hash) {
      toast.error("Aguarde o carregamento da ficha.");
      return;
    }
    assinar.mutate(
      {
        empresa_id: empresaId,
        id_entrega: entregaId,
        assinante_nome: nome.trim(),
        assinatura_png: png,
        pdf_sha256: hash,
      },
      { onSuccess: () => onClose() },
    );
  }

  return (
    <EpiModal titulo="Coletar assinatura do recebedor" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-start gap-2 rounded-lg border border-sky-100 bg-sky-50 p-3 text-xs text-sky-900">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-verde-primary" />
          <p>
            A assinatura é vinculada de forma imutável ao documento (hash
            SHA-256), com data/hora e origem registradas. Ao assinar, o
            colaborador declara o recebimento dos EPIs desta ficha.
          </p>
        </div>

        <div>
          <label className={labelCls}>Nome de quem assina</label>
          <input
            className={inputCls}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
        </div>

        <div>
          <label className={labelCls}>Assinatura</label>
          <SignatureCanvas ref={sigRef} onChange={setVazio} />
        </div>

        <div className="flex items-center gap-1.5 rounded-md bg-gray-50 px-3 py-2 text-[11px] text-gray-500">
          <FileText className="size-3.5 shrink-0" />
          {carregandoHash ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="size-3 animate-spin" /> calculando impressão do
              documento…
            </span>
          ) : erroHash ? (
            <span className="text-red-600">{erroHash}</span>
          ) : hash ? (
            <span className="font-mono">
              SHA-256 {hash.slice(0, 24)}…
            </span>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={assinar.isPending || vazio || !hash}
            className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-4 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-50"
          >
            {assinar.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Registrando…
              </>
            ) : (
              <>
                <ShieldCheck className="size-4" /> Confirmar assinatura
              </>
            )}
          </button>
        </div>
      </div>
    </EpiModal>
  );
}
