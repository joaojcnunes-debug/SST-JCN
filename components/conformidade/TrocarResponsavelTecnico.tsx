"use client";

import { useState } from "react";
import { Loader2, UserCog } from "lucide-react";
import toast from "react-hot-toast";
import ProfissionalSelect from "@/components/ui/ProfissionalSelect";
import { useAtualizarRelatorioConformidade } from "@/lib/hooks/useRelatoriosConformidade";
import { mensagemErro } from "@/lib/errors";

/**
 * Responsável técnico (JCN Consultoria) do Relatório de Conformidade, com botão
 * "Trocar" sempre à mão para quem pode editar — inclusive com o relatório
 * FINALIZADO. Antes a troca só existia em "Editar dados do cabeçalho", que
 * some ao finalizar, e a tela do laudo (onde se assina) não tinha a opção:
 * o supervisor ficava preso ao técnico que abriu o relatório.
 *
 * O nome vai para a folha de assinaturas, o carimbo e o signatário sugerido.
 * PDF já congelado/assinado guarda o nome antigo — por isso o aviso.
 */
export default function TrocarResponsavelTecnico({
  idRelatorio,
  responsavel,
  podeEditar,
  pdfFechado = false,
  className,
}: {
  idRelatorio: string;
  responsavel: string | null;
  podeEditar: boolean;
  /** Já existe PDF congelado ou assinado deste relatório. */
  pdfFechado?: boolean;
  className?: string;
}) {
  const atualizar = useAtualizarRelatorioConformidade();
  const [aberto, setAberto] = useState(false);

  function salvar(nome: string) {
    const novo = nome.trim() || null;
    if (novo === (responsavel ?? null)) { setAberto(false); return; }
    atualizar.mutate(
      { id_relatorio: idRelatorio, responsavel: novo },
      {
        onSuccess: () => {
          toast.success(novo ? `Responsável técnico: ${novo}` : "Responsável técnico removido");
          setAberto(false);
        },
        onError: (e: Error) => toast.error(mensagemErro(e, "Falha ao trocar o responsável")),
      },
    );
  }

  return (
    <div className={className}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
        Responsável técnico (JCN Consultoria)
      </p>
      {!aberto ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-gray-900">{responsavel || "—"}</p>
          {podeEditar && (
            <button
              type="button"
              onClick={() => setAberto(true)}
              className="inline-flex items-center gap-1 rounded-md border border-teal-300 bg-white px-2 py-0.5 text-xs font-semibold text-teal-700 hover:bg-teal-50 print:hidden"
            >
              <UserCog className="size-3" /> Trocar
            </button>
          )}
        </div>
      ) : (
        <div className="mt-1 space-y-1.5 print:hidden">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <ProfissionalSelect value={responsavel ?? ""} onChange={(nome) => salvar(nome)} />
            </div>
            {atualizar.isPending && <Loader2 className="size-4 animate-spin text-teal-700" />}
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
          {pdfFechado && (
            <p className="text-xs text-amber-700">
              Este relatório já tem PDF congelado ou assinado com o nome anterior. Depois de
              trocar, use <strong>Congelar nova versão</strong> e assine de novo no laudo.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
