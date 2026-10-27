"use client";

// Segurança do Trabalho › Consolidação Psicossocial de Grupo (v295; módulo próprio desde 19/10 —
// antes era Psicossocial › Consolidação de Grupo) — fases 3 a 8: as fontes, a padronização
// e as análises (comparativo AEP, visões, confronto, harmonização, Sim/Não).
//
// Um grupo econômico (empresa_grupos, v282) tem várias empresas e os trabalhadores
// transitam entre elas: o risco psicossocial de um setor numa empresa precisa constar
// no mesmo setor das outras. Esta tela junta a AEP e o DRPS/QPS já concluídos das
// empresas do grupo e padroniza os nomes de setor e de fator. As abas e as análises
// ficam em `PainelConsolidacao`, que a página Por empresa (v303) também usa.
//
// Só LÊ a AEP e o DRPS/QPS — nada desses módulos é alterado aqui.

import { useMemo, useState } from "react";
import { Network } from "lucide-react";
import GrupoSelect from "@/components/empresas/GrupoSelect";
import PainelConsolidacao from "@/components/psico-consolidacao/PainelConsolidacao";
import { useGruposEmpresas } from "@/lib/hooks/useGruposEmpresas";

export default function ConsolidacaoGrupoPage() {
  const { grupos, membrosPorGrupo, isLoading: carregandoGrupos } = useGruposEmpresas();
  const [idGrupo, setIdGrupo] = useState("");

  const grupo = grupos.find((g) => g.id_grupo === idGrupo) ?? null;
  const membros = useMemo(() => membrosPorGrupo.get(idGrupo) ?? [], [membrosPorGrupo, idGrupo]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
          <Network className="size-5 text-indigo-600" />
          Consolidação de Grupo
        </h1>
        <p className="mt-0.5 max-w-3xl text-sm text-gray-500">
          Junta a AEP e o DRPS/Questionário concluídos das empresas de um grupo econômico e padroniza os setores e os
          fatores, para que o risco achado num setor conste no mesmo setor de todas as empresas do grupo.
        </p>
      </div>

      <div className="max-w-md">
        <GrupoSelect value={idGrupo} onChange={setIdGrupo} title="Grupo de empresas" />
        {!carregandoGrupos && grupos.length === 0 && (
          <p className="mt-1 text-xs text-gray-500">
            Nenhum grupo cadastrado. Crie em Empresas › Grupos.
          </p>
        )}
      </div>

      {grupo && <PainelConsolidacao grupo={grupo} membros={membros} />}
    </div>
  );
}
