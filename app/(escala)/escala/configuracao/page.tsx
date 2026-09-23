"use client";

import { useState } from "react";
import { Building2, CalendarOff, Eye, ShieldCheck, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfirmHost } from "@/components/ui/confirm";
import { usePodeEditarEscala } from "@/lib/hooks/useEscalaCadastro";
import UnidadesTab from "@/components/escala/UnidadesTab";
import SupervisoresTab from "@/components/escala/SupervisoresTab";
import FeriadosTab from "@/components/escala/FeriadosTab";
import RegrasTab from "@/components/escala/RegrasTab";

/**
 * Tela de configuração da Escala de Supervisores (Fase 3).
 *
 * As três abas são o que a grade mensal (F5) vai precisar ter pronto antes de
 * conseguir gerar um mês: sem unidade com cor não há como pintar a grade, sem
 * supervisor não há linha, e sem feriado o gerador escala gente em dia parado.
 *
 * Uma tela com abas, e não três itens de menu: são cadastros pequenos, feitos
 * uma vez e revisitados juntos. Três entradas no menu dariam ao módulo um menu
 * maior que o próprio módulo.
 */

type Aba = "unidades" | "supervisores" | "feriados" | "regras";

const ABAS: { id: Aba; label: string; icone: typeof Building2 }[] = [
  { id: "unidades", label: "Unidades", icone: Building2 },
  { id: "supervisores", label: "Supervisores", icone: Users },
  { id: "feriados", label: "Feriados", icone: CalendarOff },
  { id: "regras", label: "Regras", icone: ShieldCheck },
];

export default function ConfiguracaoEscalaPage() {
  const [aba, setAba] = useState<Aba>("unidades");
  const podeEditar = usePodeEditarEscala();

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">
          Configuração da Escala
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Unidades, supervisores, feriados e as regras da conferência. É o que a grade
          mensal usa para se montar.
        </p>
      </header>

      <div className="flex gap-0 overflow-x-auto border-b border-gray-200">
        {ABAS.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setAba(a.id)}
            className={cn(
              "inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm",
              aba === a.id
                ? "border-[#0891B2] font-semibold text-[#0E7490]"
                : "border-transparent text-gray-500 hover:text-gray-800"
            )}
          >
            <a.icone className="size-4" />
            {a.label}
          </button>
        ))}
      </div>

      {/* Sem isto a tela ficaria só "sem botões", e a pessoa procuraria o que
          não existe. O texto diz a regra REAL — a do banco, que olha o perfil e
          ignora o flag `pode_editar` do cadastro. */}
      {!podeEditar && (
        <div className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
          <Eye className="mt-0.5 size-4 shrink-0" />
          <span>
            <strong>Modo leitura.</strong> Você consegue ver toda a configuração, mas só{" "}
            <strong>Admin</strong> e <strong>Técnico</strong> podem alterar a escala — é o
            próprio banco que decide isso, pelo seu perfil.
          </span>
        </div>
      )}

      {aba === "unidades" && <UnidadesTab />}
      {aba === "supervisores" && <SupervisoresTab />}
      {aba === "feriados" && <FeriadosTab />}
      {aba === "regras" && <RegrasTab />}

      {/* `confirmar()` cai para o window.confirm nativo se este host não estiver
          montado — e o nativo trava a aba. Montado aqui, não na moldura, porque
          é esta tela que exclui feriado. */}
      <ConfirmHost />
    </div>
  );
}
