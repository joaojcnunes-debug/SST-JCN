"use client";

import { useEffect, useState } from "react";
import { History, ListChecks, ShieldCheck, UserPlus, UserSearch, Users } from "lucide-react";
import Modal from "@/components/ui/Modal";
import EquipesTab from "@/components/gestao/EquipesTab";
import { LegendaNiveis } from "@/components/gestao/SeletorNivel";
import AbaPessoas from "@/components/gestao/acessos/AbaPessoas";
import AbaEfetivo from "@/components/gestao/acessos/AbaEfetivo";
import AbaHistorico from "@/components/gestao/acessos/AbaHistorico";
import { useMotivo } from "@/components/gestao/acessos/MotivoDialog";
import { useDadosAcessos } from "@/components/gestao/acessos/useDadosAcessos";
import { useGravarAcessos } from "@/components/gestao/acessos/useGravarAcessos";
import { chaveRecurso } from "@/lib/gestao/acessos";
import { cn } from "@/lib/utils";

type Aba = "pessoas" | "por_pessoa" | "por_lista" | "equipes" | "historico";

const ABAS: { id: Aba; label: string; icon: typeof Users }[] = [
  { id: "pessoas", label: "Dar acesso", icon: UserPlus },
  { id: "por_pessoa", label: "Por pessoa", icon: UserSearch },
  { id: "por_lista", label: "Por lista", icon: ListChecks },
  { id: "equipes", label: "Equipes", icon: Users },
  { id: "historico", label: "Histórico", icon: History },
];

/**
 * Membros e acessos da Gestão (v227+; reorganizado na v305). Só gestor abre.
 * - Dar acesso: várias pessoas × espaço/pasta/lista × nível; copiar acessos de outra pessoa;
 *   as regras atuais agrupadas por recurso.
 * - Por pessoa / Por lista: o acesso que vale DE FATO e de onde vem (RPC gestao_acessos_efetivos).
 *   O botão "Compartilhar" da lista abre aqui, em "Por lista".
 * - Equipes: acesso herdado por quem entra na equipe.
 * - Histórico: gestao_acesso_log.
 * O motivo é pedido na hora de confirmar cada alteração (o banco exige ≥ 5 e grava no log).
 */
export default function MembrosModal({
  open,
  onClose,
  quadroFoco,
}: {
  open: boolean;
  onClose: () => void;
  /** Abre em "Por lista" com esta lista (botão Compartilhar). */
  quadroFoco?: string | null;
}) {
  const d = useDadosAcessos(open);
  const { pedirMotivo, dialogo } = useMotivo();
  const { executar, gravando } = useGravarAcessos();
  const [aba, setAba] = useState<Aba>("pessoas");
  const [recursosIniciais, setRecursosIniciais] = useState<string[] | undefined>(undefined);
  const [chaveDarAcesso, setChaveDarAcesso] = useState(0);

  useEffect(() => {
    if (!open) return;
    setAba(quadroFoco ? "por_lista" : "pessoas");
    setRecursosIniciais(undefined);
  }, [open, quadroFoco]);

  const darAcessoNaLista = (idQuadro: string) => {
    setRecursosIniciais([chaveRecurso("list", idQuadro)]);
    setChaveDarAcesso((k) => k + 1); // remonta a aba com a lista já marcada
    setAba("pessoas");
  };

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
                aba === a.id ? "border-verde-primary text-verde-primary" : "border-transparent text-gray-500 hover:text-gray-700",
              )}
            >
              <a.icon className="size-4" /> {a.label}
            </button>
          ))}
        </div>

        {(aba === "pessoas" || aba === "equipes") && <LegendaNiveis />}

        {aba === "pessoas" && (
          <AbaPessoas key={chaveDarAcesso} d={d} recursosIniciais={recursosIniciais} pedirMotivo={pedirMotivo} executar={executar} gravando={gravando} />
        )}
        {aba === "por_pessoa" && <AbaEfetivo d={d} modo="pessoa" onDarAcesso={darAcessoNaLista} />}
        {aba === "por_lista" && <AbaEfetivo key={quadroFoco ?? ""} d={d} modo="lista" quadroInicial={quadroFoco} onDarAcesso={darAcessoNaLista} />}
        {aba === "equipes" && <EquipesTab d={d} pedirMotivo={pedirMotivo} executar={executar} gravando={gravando} />}
        {aba === "historico" && <AbaHistorico d={d} />}

        <p className="flex items-center gap-1 text-[11px] text-gray-400">
          <ShieldCheck className="size-3.5" /> Administradores (perfil Admin) veem tudo e não precisam de acesso. Toda alteração pede um motivo e fica no Histórico.
        </p>
      </div>
      {dialogo}
    </Modal>
  );
}
