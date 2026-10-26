"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { UserPlus } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { gerarId } from "@/lib/utils";
import { mensagemErro } from "@/lib/errors";
import { nomeDaEmpresa, type ContaDoPainel, type InspecaoConcluida } from "@/lib/hooks/useDashboardFontes";

/**
 * Nota para os supervisores (pedido de 26/10/2026): inspeção concluída SEM técnico na aba
 * Responsáveis conta para quem a abriu, marcada "sem registro". Aqui o supervisor escolhe quem foi
 * a campo; a escolha vira uma linha em `responsaveis` (com o vínculo `id_usuario`, v204) e a
 * inspeção passa a contar para esse técnico.
 */
export default function NotaSemTecnico({
  inspecoes,
  contas,
}: {
  inspecoes: readonly InspecaoConcluida[];
  contas: readonly ContaDoPainel[];
}) {
  const qc = useQueryClient();
  const [aberta, setAberta] = useState(false);
  const [escolha, setEscolha] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState<string | null>(null);
  if (inspecoes.length === 0) return null;

  const tecnicos = [...contas]
    .filter((c) => c.perfil !== "Cliente")
    .sort((a, b) => (a.perfil === "Tecnico" ? 0 : 1) - (b.perfil === "Tecnico" ? 0 : 1) || a.nome.localeCompare(b.nome, "pt-BR"));

  async function salvar(i: InspecaoConcluida) {
    const id = escolha[i.id_inspecao];
    const conta = contas.find((c) => c.id_usuario === id);
    if (!conta) return;
    setSalvando(i.id_inspecao);
    try {
      const sb = createSupabaseBrowserClient();
      const { error } = await sb.from("responsaveis").insert({
        id_responsavel: gerarId("RSP"),
        id_inspecao: i.id_inspecao,
        id_empresa: i.id_empresa ?? null,
        tecnico_responsavel: conta.nome,
        id_usuario: conta.id_usuario,
        data_hora: new Date().toISOString(),
      } as never);
      if (error) throw error;
      toast.success(`${conta.nome} registrado como técnico da inspeção.`);
      qc.invalidateQueries({ queryKey: ["dashboard-tecnicos-de-campo"] });
    } catch (e) {
      toast.error(mensagemErro(e, "Não foi possível registrar o técnico."));
    } finally {
      setSalvando(null);
    }
  }

  return (
    <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p>
          <strong>Nota para os supervisores:</strong> {inspecoes.length} inspeç{inspecoes.length !== 1 ? "ões concluídas não têm" : "ão concluída não tem"}{" "}
          técnico registrado na aba Responsáveis e {inspecoes.length !== 1 ? "contam" : "conta"} para quem abriu (&quot;sem registro&quot;).
          Selecione quem foi a campo.
        </p>
        <button
          type="button"
          onClick={() => setAberta((v) => !v)}
          className="inline-flex items-center gap-1 rounded-md border border-sky-300 bg-white px-2 py-1 font-medium text-sky-800 hover:bg-sky-100"
        >
          <UserPlus className="size-3.5" /> {aberta ? "Fechar" : "Definir técnicos"}
        </button>
      </div>
      {aberta && (
        <ul className="mt-2 space-y-1">
          {inspecoes.map((i) => (
            <li key={i.id_inspecao} className="flex flex-wrap items-center gap-2 rounded-md bg-white/80 px-2 py-1.5">
              <Link href={`/inspecoes/${i.id_inspecao}`} className="min-w-[12rem] flex-1 font-medium text-gray-800 hover:underline">
                {nomeDaEmpresa(i.empresas)}
                <span className="ml-1 font-normal text-gray-500">
                  · visita {i.data_inspecao ? i.data_inspecao.split("-").reverse().join("/") : "—"} · aberta por {i.responsavel || "—"}
                </span>
              </Link>
              <select
                value={escolha[i.id_inspecao] ?? ""}
                onChange={(e) => setEscolha((s) => ({ ...s, [i.id_inspecao]: e.target.value }))}
                className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-800"
                aria-label="Técnico que foi a campo"
              >
                <option value="">Técnico que foi a campo…</option>
                {tecnicos.map((c) => (
                  <option key={c.id_usuario} value={c.id_usuario}>
                    {c.nome}
                    {c.perfil !== "Tecnico" ? ` (${c.perfil})` : ""}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!escolha[i.id_inspecao] || salvando === i.id_inspecao}
                onClick={() => salvar(i)}
                className="rounded-md bg-sky-600 px-2 py-1 font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
              >
                {salvando === i.id_inspecao ? "Salvando…" : "Salvar"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
