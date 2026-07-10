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
import { agentDisponivel, verificarDigital } from "@/lib/epi/biometricAgent";

type Metodo = "digital" | "canvas";

/**
 * Coleta a assinatura do recebedor. Baixa o PDF exato da ficha e calcula o
 * SHA-256 (o que está sendo consentido). Métodos: DIGITAL ou DESENHO.
 *
 * Fase 4D — se o colaborador tem biometria CADASTRADA (`colaboradorTemplate`) e
 * o companion local está ativo, a digital é VERIFICADA 1:1 (confronta identidade);
 * só assina se der match. Sem template, cai para captura simples (via SDK web).
 */
export default function EpiAssinaturaModal({
  open,
  onClose,
  entregaId,
  empresaId,
  colaboradorNome,
  colaboradorTemplate,
}: {
  open: boolean;
  onClose: () => void;
  entregaId: string;
  empresaId: string;
  colaboradorNome: string;
  colaboradorTemplate?: string | null;
}) {
  const assinar = useAssinarEntrega();
  const sigRef = useRef<SignatureCanvasHandle | null>(null);
  const modoVerificacao = !!colaboradorTemplate;

  const [nome, setNome] = useState(colaboradorNome);
  const [hash, setHash] = useState<string | null>(null);
  const [carregandoHash, setCarregandoHash] = useState(false);
  const [erroHash, setErroHash] = useState<string | null>(null);

  const [metodo, setMetodo] = useState<Metodo>("canvas");
  const [leitorOk, setLeitorOk] = useState<boolean | null>(null);
  const [agenteOk, setAgenteOk] = useState<boolean | null>(null);
  const [consentimento, setConsentimento] = useState(false);
  const [capturando, setCapturando] = useState(false);
  const [captura, setCaptura] = useState<CapturaDigital | null>(null);
  const [verificado, setVerificado] = useState(false);
  const [matchScore, setMatchScore] = useState<number | null>(null);
  const [erroDigital, setErroDigital] = useState<string | null>(null);
  const [vazio, setVazio] = useState(true);

  // Digital só é possível se: cadastrado -> precisa do agente; senão -> SDK web.
  const digitalPossivel = modoVerificacao
    ? agenteOk === true
    : leitorOk === true;

  useEffect(() => {
    if (!open) return;
    setNome(colaboradorNome);
    setHash(null);
    setErroHash(null);
    setConsentimento(false);
    setCaptura(null);
    setVerificado(false);
    setMatchScore(null);
    setErroDigital(null);
    setLeitorOk(null);
    setAgenteOk(null);
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
      const [ag, web] = await Promise.all([agentDisponivel(), leitorDisponivel()]);
      if (cancelado) return;
      setAgenteOk(ag);
      setLeitorOk(web);
      const possivel = colaboradorTemplate ? ag : web;
      setMetodo(possivel ? "digital" : "canvas");
    })();

    return () => {
      cancelado = true;
    };
  }, [open, entregaId, colaboradorNome, colaboradorTemplate]);

  if (!open) return null;

  async function lerDigital() {
    if (!consentimento) {
      toast.error("Aceite o termo de consentimento antes de coletar a digital.");
      return;
    }
    setErroDigital(null);
    setCapturando(true);
    try {
      if (colaboradorTemplate) {
        // Verificação 1:1 contra o cadastro.
        const v = await verificarDigital(colaboradorTemplate);
        if (!v.match) {
          setCaptura(null);
          setVerificado(false);
          setMatchScore(v.score);
          setErroDigital(
            "A digital NÃO confere com o cadastro deste colaborador. Assinatura bloqueada.",
          );
          toast.error("Digital não confere com o colaborador");
          return;
        }
        setCaptura({
          fingerHash: v.finger_hash ?? "",
          device: v.device ?? "U.are.U",
          qualidade: v.quality,
        });
        setVerificado(true);
        setMatchScore(v.score);
        toast.success("Identidade verificada");
      } else {
        // Sem cadastro: captura simples (SDK web).
        const cap = await capturarDigital();
        setCaptura(cap);
        setVerificado(false);
        setMatchScore(null);
        toast.success("Digital capturada");
      }
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
      if (modoVerificacao && !verificado) {
        toast.error("A digital precisa ser verificada com sucesso.");
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
          verificado,
          match_score: matchScore,
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
    (metodo === "digital"
      ? !captura || !consentimento || (modoVerificacao && !verificado)
      : vazio);

  return (
    <EpiModal titulo="Assinatura do recebedor" onClose={onClose}>
      <div className="space-y-4">
        {/* Seletor de método */}
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 text-sm font-medium">
          <button
            type="button"
            onClick={() => setMetodo("digital")}
            disabled={digitalPossivel === false}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 ${
              metodo === "digital"
                ? "bg-verde-primary text-white"
                : "text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent"
            }`}
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

        {/* Avisos de disponibilidade */}
        {modoVerificacao && agenteOk === false && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-900">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            Este colaborador tem <strong>biometria cadastrada</strong>, mas o
            agente de biometria não está ativo neste PC — não é possível
            verificar. Instale/abra o “EpiBiometricAgent” ou use a assinatura
            desenhada.
          </div>
        )}
        {!modoVerificacao && leitorOk === false && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-900">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            Leitor de digital não detectado. Use a assinatura desenhada. (Cadastre
            a biometria do colaborador para habilitar a verificação de
            identidade.)
          </div>
        )}
        {modoVerificacao && agenteOk !== false && (
          <div className="flex items-start gap-2 rounded-lg border border-sky-100 bg-sky-50 p-2.5 text-[11px] text-sky-900">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-verde-primary" />
            Colaborador com biometria cadastrada — a digital será{" "}
            <strong>conferida com o cadastro</strong> antes de assinar.
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
                Autorizo a leitura da minha impressão digital para{" "}
                {modoVerificacao ? "confirmar minha identidade e " : ""}assinar
                esta ficha de entrega de EPI. A imagem da digital{" "}
                <strong>não é armazenada</strong> nesta etapa — apenas um código
                de verificação (hash) irreversível, conforme a LGPD.
              </span>
            </label>

            <button
              type="button"
              onClick={lerDigital}
              disabled={capturando || !consentimento || digitalPossivel === false}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-sky-300 bg-white px-4 py-3 text-sm font-semibold text-verde-accent hover:bg-sky-50 disabled:opacity-50"
            >
              {capturando ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Encoste o dedo no
                  leitor…
                </>
              ) : captura ? (
                <>
                  <CheckCircle2 className="size-4 text-green-600" />{" "}
                  {modoVerificacao ? "Verificar de novo" : "Ler de novo"}
                </>
              ) : (
                <>
                  <Fingerprint className="size-4" />{" "}
                  {modoVerificacao ? "Verificar digital" : "Ler digital"}
                </>
              )}
            </button>

            {captura && verificado && (
              <p className="flex items-center gap-1.5 text-[11px] font-medium text-green-700">
                <ShieldCheck className="size-3.5" /> Identidade verificada
                {matchScore != null ? ` (score ${matchScore})` : ""}.
              </p>
            )}
            {captura && !verificado && (
              <p className="flex items-center gap-1.5 text-[11px] text-green-700">
                <CheckCircle2 className="size-3.5" /> Digital capturada (hash{" "}
                {captura.fingerHash.slice(0, 16)}…).
              </p>
            )}
            {erroDigital && (
              <p className="text-[11px] font-medium text-red-600">{erroDigital}</p>
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
