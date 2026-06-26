"use client";

import { useState } from "react";
import { Lock, ShieldCheck, Loader2, ExternalLink, FileCheck2 } from "lucide-react";
import {
  usePdfCongelado,
  useCongelarPdf,
  type RegistrarPdfOpts,
} from "@/lib/hooks/usePdfsGerados";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

interface Props {
  modulo: string;
  idReferencia: string;
  /** Rota vetorial que gera o PDF base (já com anexos). */
  apiPdfUrl: string;
  /** Metadados do documento gravados em pdfs_gerados (modulo é passado à parte). */
  opts: Omit<RegistrarPdfOpts, "modulo">;
}

/**
 * Painel de governança do PDF (Fase 4): aprova/congela a versão atual e mostra
 * a versão congelada vigente (com hash). A assinatura opera sobre o arquivo
 * congelado — ver `baseCongeladaUrl` em BotaoAssinarPdf.
 */
export default function PainelCongelamentoPdf({
  modulo,
  idReferencia,
  apiPdfUrl,
  opts,
}: Props) {
  const { data: congelado } = usePdfCongelado(modulo, idReferencia);
  const congelar = useCongelarPdf();
  const [confirmar, setConfirmar] = useState(false);

  const jaCongelado = !!congelado;

  return (
    <div className="print:hidden rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-indigo-700" />
          <h3 className="text-sm font-semibold text-gray-900">Documento — governança</h3>
          {jaCongelado ? (
            <span className="inline-flex items-center gap-1 rounded bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
              <Lock className="size-3" /> Congelado v{congelado!.versao}
            </span>
          ) : (
            <span className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
              Rascunho
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setConfirmar(true)}
          disabled={congelar.isPending}
          className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {congelar.isPending ? <Loader2 className="size-4 animate-spin" /> : <FileCheck2 className="size-4" />}
          {jaCongelado ? "Congelar nova versão" : "Aprovar e congelar"}
        </button>
      </div>

      {jaCongelado ? (
        <div className="mt-2 space-y-0.5 text-xs text-gray-600">
          <p>
            Versão <strong>{congelado!.versao}</strong> congelada
            {congelado!.congelado_em
              ? ` em ${new Date(congelado!.congelado_em).toLocaleString("pt-BR")}`
              : ""}
            {congelado!.congelado_por ? ` por ${congelado!.congelado_por}` : ""}.
          </p>
          {congelado!.hash_sha256 && (
            <p className="font-mono text-[11px] text-gray-500">
              SHA-256: {congelado!.hash_sha256.slice(0, 32)}…
            </p>
          )}
          {congelado!.pdf_url && (
            <a
              href={congelado!.pdf_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-indigo-700 hover:underline"
            >
              <ExternalLink className="size-3" /> Ver PDF base congelado
            </a>
          )}
          <p className="text-[11px] italic text-gray-500">
            A assinatura A1 é aplicada sobre este arquivo imutável.
            {congelado!.versao > 1 && " Versões anteriores foram marcadas como substituídas."}
          </p>
        </div>
      ) : (
        <p className="mt-2 text-xs text-gray-500">
          Ao aprovar, o PDF atual (com anexos) é gerado, congelado e recebe um hash.
          A partir daí a assinatura usa exatamente esse arquivo. Editar o laudo depois
          exige congelar uma nova versão.
        </p>
      )}

      <ConfirmDialog
        open={confirmar}
        title={jaCongelado ? "Congelar nova versão?" : "Aprovar e congelar este laudo?"}
        description="O PDF atual (incluindo anexos) será gerado e congelado com um hash de integridade. Edições posteriores exigirão uma nova versão."
        loading={congelar.isPending}
        onConfirm={() =>
          congelar.mutate(
            { apiPdfUrl, ...opts, idRelatorio: idReferencia, modulo },
            { onSuccess: () => setConfirmar(false) },
          )
        }
        onCancel={() => setConfirmar(false)}
      />
    </div>
  );
}
