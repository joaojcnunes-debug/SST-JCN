"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Building2, CalendarRange, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";
import { useUnidades, useCriarUnidade } from "@/lib/hooks/useUnidades";

/**
 * Gestão Gerencial → Escalas e Substituições (Fase 1: só navegação).
 * Lista as unidades já cadastradas (reusa a entidade `unidades`, v75) e permite
 * cadastrar novas. Selecionar uma unidade leva ao controle de escalas dela.
 */
export default function GestaoGerencialPage() {
  const { data: unidades = [], isLoading } = useUnidades();
  const criar = useCriarUnidade();
  const [novo, setNovo] = useState("");

  function add() {
    const v = novo.trim();
    if (!v) return;
    if (unidades.some((u) => u.nome.toLowerCase() === v.toLowerCase())) {
      toast.error("Já existe uma unidade com esse nome");
      return;
    }
    criar.mutate(v, { onSuccess: () => setNovo("") });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Escalas e Substituições</h1>
        <p className="mt-1 text-sm text-gray-600">
          Selecione uma unidade para gerenciar profissionais, escala padrão, ausências e substituições.
        </p>
      </div>

      {/* Cadastrar nova unidade */}
      <div className="flex gap-2">
        <input
          type="text"
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Cadastrar nova unidade (ex.: Teresópolis, Guapimirim)…"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-verde-primary focus:outline-none focus:ring-1 focus:ring-verde-primary/30"
        />
        <button
          type="button"
          onClick={add}
          disabled={criar.isPending}
          className="inline-flex items-center gap-1.5 rounded-md bg-verde-primary px-3 py-2 text-sm font-semibold text-white hover:bg-verde-accent disabled:opacity-60"
        >
          <Plus className="size-4" /> Adicionar
        </button>
      </div>

      {/* Unidades (clicáveis) */}
      {isLoading ? (
        <p className="text-sm text-gray-500">Carregando…</p>
      ) : unidades.length === 0 ? (
        <p className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
          Nenhuma unidade cadastrada. Cadastre a primeira acima.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {unidades.map((u) => (
            <li key={u.id_unidade}>
              <Link
                href={`/gestao-gerencial/${u.id_unidade}`}
                className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 transition hover:border-verde-primary hover:shadow-sm"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-verde-light text-verde-primary">
                  <Building2 className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-gray-900">{u.nome}</p>
                  <p className="flex items-center gap-1 text-xs text-gray-500">
                    <CalendarRange className="size-3" /> Escalas e substituições
                  </p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-gray-400" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
