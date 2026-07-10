"use client";

import { useMemo, useState } from "react";
import { UserCheck, Plus, Check, AlertTriangle, Loader2, X } from "lucide-react";
import { useGGSubstituicaoMut, useTodosProfissionais } from "@/lib/hooks/useGestaoGerencial";

export interface ChosenInfo { id: string; nome: string | null }

/**
 * Chips de substitutos de um slot (data+turno+ausente). Clicar num sugerido GRAVA
 * a escolha; clicar no escolhido remove. "Adicionar do cadastro" permite escolher
 * qualquer profissional do cadastro, mesmo fora da lista sugerida.
 */
export default function SlotSubstitutos({
  idUnidade, data, idTurno, idAusente, sugeridos, chosen, podeEditar,
}: {
  idUnidade: string;
  data: string;
  idTurno: string;
  idAusente: string;
  sugeridos: { id: string; nome: string }[];
  chosen: ChosenInfo | null;
  podeEditar: boolean;
}) {
  const { setSub, removerSub } = useGGSubstituicaoMut();
  const todos = useTodosProfissionais();
  const [addOpen, setAddOpen] = useState(false);
  const pending = setSub.isPending || removerSub.isPending;

  const assign = (id: string) =>
    setSub.mutate({ id_unidade: idUnidade, data, id_turno: idTurno, id_ausente: idAusente, id_substituto: id }, { onSuccess: () => setAddOpen(false) });
  const clear = () =>
    removerSub.mutate({ id_unidade: idUnidade, data, id_turno: idTurno, id_ausente: idAusente });

  // o escolhido pode não estar entre os sugeridos (veio do cadastro) → mostra à parte
  const escolhidoForaDaLista = chosen && !sugeridos.some((s) => s.id === chosen.id);

  // opções do "adicionar do cadastro": todos, menos os já sugeridos e o próprio ausente
  const opcoesCadastro = useMemo(() => {
    const excl = new Set<string>([idAusente, ...sugeridos.map((s) => s.id)]);
    if (chosen) excl.add(chosen.id);
    return (todos.data ?? []).filter((p) => p.ativo && !excl.has(p.id));
  }, [todos.data, sugeridos, chosen, idAusente]);

  const semNada = sugeridos.length === 0 && !chosen;

  return (
    <div className="space-y-1.5">
      {semNada ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-amber-700">
          <span className="inline-flex items-center gap-1.5"><AlertTriangle className="size-4 shrink-0" /> Nenhum substituto disponível.</span>
          {podeEditar && <BotaoAdicionar open={addOpen} setOpen={setAddOpen} opcoes={opcoesCadastro} onPick={assign} />}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-gray-500">{chosen ? "Substituto:" : "Sugeridos:"}</span>

          {escolhidoForaDaLista && chosen && (
            <ChipEscolhido nome={chosen.nome ?? "—"} onClear={clear} podeEditar={podeEditar} pending={pending} />
          )}

          {sugeridos.map((s) => {
            const escolhido = chosen?.id === s.id;
            return escolhido ? (
              <ChipEscolhido key={s.id} nome={s.nome} onClear={clear} podeEditar={podeEditar} pending={pending} />
            ) : (
              <button
                key={s.id}
                type="button"
                disabled={!podeEditar || pending}
                onClick={() => assign(s.id)}
                className={`inline-flex items-center gap-1 rounded-md border border-verde-primary/30 bg-verde-primary/5 px-2 py-0.5 text-xs font-medium text-verde-primary transition-colors ${podeEditar ? "hover:border-verde-primary hover:bg-verde-primary/10 cursor-pointer" : "cursor-default"} disabled:opacity-60`}
                title={podeEditar ? "Definir como substituto deste dia" : undefined}
              >
                <UserCheck className="size-3.5" /> {s.nome}
              </button>
            );
          })}

          {podeEditar && <BotaoAdicionar open={addOpen} setOpen={setAddOpen} opcoes={opcoesCadastro} onPick={assign} />}
          {pending && <Loader2 className="size-3.5 animate-spin text-verde-primary" />}
        </div>
      )}
    </div>
  );
}

function ChipEscolhido({ nome, onClear, podeEditar, pending }: { nome: string; onClear: () => void; podeEditar: boolean; pending: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-verde-primary bg-verde-primary px-2 py-0.5 text-xs font-semibold text-white">
      <Check className="size-3.5" /> {nome}
      {podeEditar && (
        <button type="button" onClick={onClear} disabled={pending} className="ml-0.5 rounded hover:bg-white/20" title="Remover substituto escolhido">
          <X className="size-3" />
        </button>
      )}
    </span>
  );
}

function BotaoAdicionar({
  open, setOpen, opcoes, onPick,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  opcoes: { id: string; nome: string }[];
  onPick: (id: string) => void;
}) {
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md border border-dashed border-gray-300 px-2 py-0.5 text-xs font-medium text-gray-500 hover:border-verde-primary hover:text-verde-primary"
      >
        <Plus className="size-3.5" /> Adicionar do cadastro
      </button>
    );
  }
  return (
    <select
      autoFocus
      defaultValue=""
      onChange={(e) => e.target.value && onPick(e.target.value)}
      onBlur={() => setOpen(false)}
      className="rounded-md border border-gray-300 px-2 py-0.5 text-xs focus:border-verde-primary focus:outline-none"
    >
      <option value="">Selecione um profissional…</option>
      {opcoes.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
    </select>
  );
}
