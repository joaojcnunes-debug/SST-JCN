"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Users, CalendarRange, Settings2, CalendarOff, UserCheck } from "lucide-react";
import { useUnidades } from "@/lib/hooks/useUnidades";
import ProfissionaisTab from "@/components/gestao-gerencial/ProfissionaisTab";
import EscalaTab from "@/components/gestao-gerencial/EscalaTab";
import ConfigTab from "@/components/gestao-gerencial/ConfigTab";
import AusenciasTab from "@/components/gestao-gerencial/AusenciasTab";
import SubstituicoesTab from "@/components/gestao-gerencial/SubstituicoesTab";

type Aba = "profissionais" | "escala" | "ausencias" | "substituicoes" | "config";

const ABAS: { id: Aba; label: string; icon: typeof Users }[] = [
  { id: "profissionais", label: "Profissionais", icon: Users },
  { id: "escala", label: "Escala padrão", icon: CalendarRange },
  { id: "ausencias", label: "Ausências", icon: CalendarOff },
  { id: "substituicoes", label: "Substituições", icon: UserCheck },
  { id: "config", label: "Configuração", icon: Settings2 },
];

/** Controle de escalas de UMA unidade: equipe, escala padrão semanal e config (categorias/turnos). */
export default function UnidadeEscalasPage() {
  const { idUnidade } = useParams<{ idUnidade: string }>();
  const { data: unidades = [] } = useUnidades();
  const unidade = unidades.find((u) => u.id_unidade === idUnidade);
  const [aba, setAba] = useState<Aba>("profissionais");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/gestao-gerencial" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft className="size-4" /> Unidades
      </Link>

      <div>
        <h1 className="text-xl font-bold text-gray-900">{unidade?.nome ?? "Unidade"}</h1>
        <p className="mt-1 text-sm text-gray-600">Escalas e Substituições</p>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {ABAS.map((a) => {
          const Icon = a.icon;
          const ativo = aba === a.id;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => setAba(a.id)}
              className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                ativo
                  ? "border-verde-primary text-verde-primary"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-800"
              }`}
            >
              <Icon className="size-4" /> {a.label}
            </button>
          );
        })}
      </div>

      {aba === "profissionais" && <ProfissionaisTab idUnidade={idUnidade} />}
      {aba === "escala" && <EscalaTab idUnidade={idUnidade} />}
      {aba === "ausencias" && <AusenciasTab idUnidade={idUnidade} />}
      {aba === "substituicoes" && <SubstituicoesTab idUnidade={idUnidade} />}
      {aba === "config" && <ConfigTab idUnidade={idUnidade} />}
    </div>
  );
}
