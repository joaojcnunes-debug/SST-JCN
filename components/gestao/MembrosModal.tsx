"use client";

import { useEffect, useState } from "react";
import { History, ShieldCheck, UserSearch, Users } from "lucide-react";
import Modal from "@/components/ui/Modal";
import EquipesTab from "@/components/gestao/EquipesTab";
import { LegendaNiveis } from "@/components/gestao/SeletorNivel";
import AbaEfetivo from "@/components/gestao/acessos/AbaEfetivo";
import AbaHistorico from "@/components/gestao/acessos/AbaHistorico";
import { useMotivo } from "@/components/gestao/acessos/MotivoDialog";
import { useDadosAcessos } from "@/components/gestao/acessos/useDadosAcessos";
import { useGravarAcessos } from "@/components/gestao/acessos/useGravarAcessos";
import { chaveRecurso } from "@/lib/gestao/acessos";
import { cn } from "@/lib/utils";

type Aba = "equipes" | "por_pessoa" | "historico";

const ABAS: { id: Aba; label: string; icon: typeof Users }[] = [
  { id: "equipes", label: "Equipes", icon: Users },
  { id: "por_pessoa", label: "Por pessoa", icon: UserSearch },
  { id: "historico", label: "Histórico", icon: History },
];

/**
 * Membros e acessos da Gestão (v227+; reorganizado na v305). Só gestor abre.
 * - Equipes: o acesso é dado à equipe e herdado por quem entra nela.
 * - Por pessoa: o acesso que vale DE FATO e de onde vem (RPC gestao_acessos_efetivos);
 *   tirar de uma lista ou da Gestão.
 * - Histórico: gestao_acesso_log.
 * v0.3.910: saíram "Dar acesso" e "Por lista" (davam acesso direto à pessoa, em paralelo às
 * equipes, e o acesso direto segurava quem saía da equipe). O "Compartilhar" da lista abre em
 * Equipes, com a lista já marcada. Os acessos diretos antigos continuam valendo e aparecem em
 * "Por pessoa" como "Direto na lista…".
 * O motivo é pedido na hora de confirmar cada alteração (o banco exige ≥ 5 e grava no log).
 */
export default function MembrosModal({
  open,
  onClose,
  quadroFoco,
}: {
  open: boolean;
  onClose: () => void;
  /** Botão Compartilhar: abre em Equipes com esta lista já marcada em "Dar acesso". */
  quadroFoco?: string | null;
}) {
  const d = useDadosAcessos(open);
  const { pedirMotivo, dialogo } = useMotivo();
  const { executar, gravando } = useGravarAcessos();
  const [aba, setAba] = useState<Aba>("equipes");

  useEffect(() => {
    if (open) setAba("equipes");
  }, [open, quadroFoco]);

  return (
    <Modal open={open} onClose={onClose} title="Membros e acessos da Gestão" size="xl">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1 border-b border-gray-200">
          {ABAS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setAba(a.id)}
              className={cn(
                "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-sm font-medium",
                aba === a.id ? "border-marca-primary text-marca-primary" : "border-transparent text-gray-500 hover:text-gray-700",
              )}
            >
              <a.icon className="size-4" /> {a.label}
            </button>
          ))}
        </div>

        {aba === "equipes" && <LegendaNiveis />}

        {aba === "equipes" && (
          <EquipesTab
            key={quadroFoco ?? ""}
            d={d}
            recursosIniciais={quadroFoco ? [chaveRecurso("list", quadroFoco)] : undefined}
            pedirMotivo={pedirMotivo}
            executar={executar}
            gravando={gravando}
          />
        )}
        {aba === "por_pessoa" && <AbaEfetivo d={d} modo="pessoa" pedirMotivo={pedirMotivo} executar={executar} gravando={gravando} />}
        {aba === "historico" && <AbaHistorico d={d} />}

        <p className="flex items-center gap-1 text-[11px] text-gray-400">
          <ShieldCheck className="size-3.5" /> Administradores (perfil Admin) veem tudo e não precisam de acesso. Toda alteração pede um motivo e fica no Histórico.
        </p>
      </div>
      {dialogo}
    </Modal>
  );
}
