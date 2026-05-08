"use client";

import { useEffect, useState } from "react";
import { useTiposRisco } from "@/lib/hooks/useV3";
import PerguntasDoTipo from "./PerguntasDoTipo";

export default function PerguntasTab() {
  const { data: tipos = [] } = useTiposRisco();
  const [tipoSel, setTipoSel] = useState<string>("");

  // Auto-seleciona o primeiro tipo ao carregar.
  useEffect(() => {
    if (!tipoSel && tipos.length > 0) setTipoSel(tipos[0].id_tipo);
  }, [tipos, tipoSel]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Adicione perguntas customizadas que aparecerão no formulário de risco
        quando o usuário escolher esse tipo. As respostas são gravadas no risco
        e aparecem no relatório PGR.
      </p>

      <div>
        <label className="text-sm font-medium text-gray-700">
          Tipo de Risco
        </label>
        <select
          value={tipoSel}
          onChange={(e) => setTipoSel(e.target.value)}
          className="mt-1 w-full max-w-md rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-2 focus:ring-verde-primary/30"
        >
          {tipos.map((t) => (
            <option key={t.id_tipo} value={t.id_tipo}>
              {t.icone ?? "•"} {t.nome}
            </option>
          ))}
        </select>
      </div>

      {tipoSel && <PerguntasDoTipo idTipo={tipoSel} />}
    </div>
  );
}
