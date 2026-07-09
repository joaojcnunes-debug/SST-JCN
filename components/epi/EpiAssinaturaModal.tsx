"use client";

import { useEffect, useRef, useState } from "react";
import {
  Loader2,
  ShieldCheck,
  FileText,
  Fingerprint,
  PenLine,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import toast from "react-hot-toast";
import EpiModal, { inputCls, labelCls } from "./EpiModal";
import SignatureCanvas, { type SignatureCanvasHandle } from "./SignatureCanvas";
import { useAssinarEntrega, sha256Hex } from "@/lib/hooks/useEpi";
import {
  leitorDisponivel,
  capturarDigital,
  type CapturaDigital,
} from "@/lib/epi/digitalPersona";

type Metodo = "digital" | "canvas";

/**
 * Coleta a assinatura do recebedor (Fase 4/4B). Ao abrir, baixa o PDF exato da
 * ficha e calcula o SHA-256 — o hash daquilo que o colaborador está consentindo.
 * Dois métodos: DIGITAL (leitor 4500 — captura → hash → descarta, exige
 * consentimento LGPD) ou DESENHO na tela (fallback). Ambos gravam a evidência na
 * trilha append-only com hash do PDF + user-agent/IP.
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

  const [metodo, setMetodo] = useState<Metodo>("canvas");
  const [leitorOk, setLeitorOk] = useState<boolean | null>(null);
  const [consentimento, setConsentimento] = useState(false);
  const [capturando, setCapturando] = useState(false);
  const [captura, setCaptura] = useState<CapturaDigital | null>(null);
  const [erroDigital, setErroDigital] = useState<string | null>(null);
  const [vazio, setVazio] = useState(true);

  useEffect(() => {
    if (!open) return;
    setNome(colaboradorNome);
    setHash(null);
    setErroHash(null);
    setConsentimento(false);
    setCaptura(null);
    setErroDigital(null);
    setLeitorOk(null);
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
          setErroHash(e instanceof Error ? e.message : "Falha ao carregar a ficha");
      } finally {
        if (!cancelado) setCarregandoHash(false);
      }
    })();

    (async () => {
      const ok = await leitorDisponivel();
      if (!cancelado) {
        setLeitorOk(ok);
        setMetodo(ok ? "digital" : "canvas");
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [open, entregaId, colaboradorNome]);

  if (!open) return null;

  async function lerDigital() {
    if (!consentimento) {
      toast.error("Aceite o termo de consentimento antes de coletar a digital.");
      return;
    }
    setErroDigital(null);
    setCapturando(true);
    try {
      const cap = await capturarDigital();
      setCaptura(cap);
      toast.success("Digital capturada");
    } catch (e) {
      setCaptura(null);
      setErroDigital(e instanceof Error ? e.message : "Falha ao ler a digital");
    } finally {
      setCapturando(false);
    }
  }

  function confirmar() {
    if (!nome.trim()) {
      toast.error("Informe o nome de quem está assinando.");
      return;
    }
    if (!hash) {
      toast.error("Aguarde o carregamento da ficha.");
      return;
    }

    if (metodo === "digital") {
      if (!consentimento) {
        toast.error("O consentimento LGPD é obrigatório para a digital.");
        return;
      }
      if (!captura) {
        toast.error("Colete a digital antes de confirmar.");
        return;
      }
      assinar.mutate(
        {
          empresa_id: empresaId,
          id_entrega: entregaId,
          assinante_nome: nome.trim(),
          metodo: "digital",
          assinatura_png: null,
          pdf_sha256: hash,
          finger_hash: captura.fingerHash,
          device_info: captura.device,
          qualidade: captura.qualidade,
          consentimento: true,
        },
        { onSuccess: () => onClose() },
      );
      return;
    }

    // canvas
    const png = sigRef.current?.getDataUrl();
    if (!png) {
      toast.error("Assine no quadro antes de confirmar.");
      return;
    }
    assinar.mutate(
      {
        empresa_id: empresaId,
        id_entrega: entregaId,
        assinante_nome: nome.trim(),
        metodo: "canvas",
        assinatura_png: png,
        pdf_sha256: hash,
      },
      { onSuccess: () => onClose() },
    );
  }

  const confirmarDesabilitado =
    assinar.isPending ||
    !hash ||
    (metodo === "digital" ? !captura || !consentimento : vazio);

  return (
    <EpiModal titulo="Assinatura do recebedor" onClose={onClose}>
      <div className="space-y-4">
        {/* Seletor de método */}
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 text-sm font-medium">
          <button
            type="button"
            onClick={() => setMetodo("digital")}
            disabled={leitorOk === false}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 ${
              metodo === "digital"
                ? "bg-verde-primary text-white"
                : "text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent"
            }`}
            title={
              leitorOk === false ? "Nenhum leitor de digital detectado" : undefined
            }
          >
            <Fingerprint className="size-4" /> Digital
          </button>
          <button
            type="button"
            onClick={() => setMetodo("canvas")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 ${
              metodo === "canvas"
                ? "bg-verde-primary text-white"
                : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            <PenLine className="size-4" /> Desenhar
          </button>
        </div>

        {leitorOk === false && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-900">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            Leitor de digital não detectado. Instale o “HID Authentication Device
            Client” e conecte o leitor, ou use a assinatura desenhada.
          </div>
        )}

        <div>
          <label className={labelCls}>Nome de quem assina</label>
          <input
            className={inputCls}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
        </div>

        {/* Método DIGITAL */}
        {metodo === "digital" && (
          <div className="space-y-3">
            <label className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-[11px] leading-relaxed text-gray-600">
              <input
                type="checkbox"
                checked={consentimento}
                onChange={(e) => setConsentimento(e.target.checked)}
                className="mt-0.5 size-3.5 shrink-0"
              />
              <span>
                Autorizo a coleta da minha impressão digital exclusivamente para
                assinar esta ficha de entrega de EPI. Estou ciente de que a imagem
                e o gabarito da digital <strong>não são armazenados</strong> —
                apenas um código de verificação (hash) irreversível, conforme a
                LGPD.
              </span>
            </label>

            <button
              type="button"
              onClick={lerDigital}
              disabled={capturando || !consentimento}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-sky-300 bg-white px-4 py-3 text-sm font-semibold text-verde-accent hover:bg-sky-50 disabled:opacity-50"
            >
              {capturando ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Encoste o dedo no
                  leitor…
                </>
              ) : captura ? (
                <>
                  <CheckCircle2 className="size-4 text-green-600" /> Digital
                  capturada — ler de novo
                </>
              ) : (
                <>
                  <Fingerprint className="size-4" /> Ler digital
                </>
              )}
            </button>

            {captura && (
              <p className="flex items-center gap-1.5 text-[11px] text-green-700">
                <CheckCircle2 className="size-3.5" /> Evidência gerada (hash{" "}
                {captura.fingerHash.slice(0, 16)}…). A biometria foi descartada.
              </p>
            )}
            {erroDigital && (
              <p className="text-[11px] text-red-600">{erroDigital}</p>
            )}
          </div>
        )}

        {/* Método DESENHO */}
        {metodo === "canvas" && (
          <div>
            <label className={labelCls}>Assinatura</label>
            <SignatureCanvas ref={sigRef} onChange={setVazio} />
          </div>
        )}

        {/* Impressão do documento */}
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
            <span className="font-mono">SHA-256 {hash.slice(0, 24)}…</span>
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
            disabled={confirmarDesabilitado}
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
