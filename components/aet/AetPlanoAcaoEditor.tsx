"use client";

import { EditorSkeleton } from "@/components/ui/PageSkeletons";
import PlanoAcaoTable from "@/components/aet/PlanoAcaoTable";
import { useAetRelatorio } from "@/lib/hooks/useAet";
import { useEmpresa } from "@/lib/hooks/useEmpresas";
import { useCanEdit } from "@/lib/hooks/useUsuario";
import { fmtData } from "@/lib/utils";

// Plano de Ação 5W2H do laudo AET (v207). As ações vivem com o laudo e saem
// impressas no capítulo "Plano de Ação (5W2H)" — só quando existe pelo menos
// uma. Quem decide a posição do capítulo é AET › Texto Padrão. O botão
// "Enviar para o Plano de Ação do PGR" (v208) copia as ações para o plano
// central da empresa — a NR-17 (17.3.6 "b") manda incorporá-las lá.
export default function AetPlanoAcaoPage({ idRelatorio }: { idRelatorio: string }) {
  const { data: rel, isLoading } = useAetRelatorio(idRelatorio);
  const { data: empresa } = useEmpresa(rel?.id_empresa ?? null);
  const canEdit = useCanEdit();

  if (isLoading || !rel) return <EditorSkeleton />;

  // Como o laudo é citado nas observações da cópia no plano central. O AET
  // não tem título: id curto + data de elaboração, se houver.
  const shortId = rel.id_relatorio.replace(/-/g, "").slice(0, 8);
  const data = rel.data_elaboracao ? fmtData(rel.data_elaboracao) : "";
  const referencia = `AET ${shortId}${data ? ` de ${data}` : ""}`;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Plano de Ação (5W2H)</h1>
        <p className="mt-1 text-xs text-gray-500">
          Uma linha por ação, agrupadas pelos setores do laudo. As recomendações que você escreveu em
          cada setor ficam à mão como referência — e é delas que o assistente de IA parte. O plano só
          entra no laudo impresso quando tem pelo menos uma ação. Quando estiver pronto, envie as ações
          para o Plano de Ação do PGR da empresa (NR-17, item 17.3.6, alínea &quot;b&quot;).
        </p>
      </div>

      <PlanoAcaoTable
        idRelatorio={idRelatorio}
        idEmpresa={rel.id_empresa}
        referencia={referencia}
        setores={rel.setores ?? []}
        empresa={empresa ? { nome_empresa: empresa.nome_empresa, cnpj: empresa.cnpj } : null}
        readOnly={!canEdit}
      />
    </div>
  );
}
