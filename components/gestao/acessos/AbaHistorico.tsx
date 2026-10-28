"use client";

import { useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { useLogAcessos } from "@/lib/hooks/useGestaoAcesso";
import { ROTULO_TIPO, type TipoRecurso } from "@/lib/gestao/acessos";
import { rotuloNivel } from "@/lib/gestao/niveis";
import type { DadosAcessos } from "./useDadosAcessos";

const ACAO: Record<string, string> = {
  concedeu: "Concedeu",
  revogou: "Revogou",
  alterou_nivel: "Alterou o nível",
  convidou: "Liberou a Gestão",
  removeu: "Removeu",
  alterou_papel: "Alterou o papel",
  alterou_unidades: "Alterou as unidades",
};
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Histórico das alterações de acesso (gestao_acesso_log, v305): quem, para quem, onde, de → para, motivo. */
export default function AbaHistorico({ d }: { d: DadosAcessos }) {
  const { data = [], isLoading, isError } = useLogAcessos(300);
  const [busca, setBusca] = useState("");
  const nome = (email: string | null) => {
    if (!email) return "—";
    if (email.startsWith("equipe:")) return `Equipe ${email.slice(7)}`;
    return d.nomePorEmail.get(email.toLowerCase()) ?? email;
  };
  const linhas = useMemo(() => {
    const q = norm(busca.trim());
    return data
      .map((l) => {
        const recurso = l.recurso_tipo && l.recurso_tipo !== "task" ? d.recursoDe(l.recurso_tipo, l.recurso_id) : null;
        const onde =
          l.recurso_tipo === "task" ? `Tarefa ${l.recurso_id}`
          : recurso && l.recurso_id ? `${ROTULO_TIPO[l.recurso_tipo as TipoRecurso] ?? ""} ${recurso.caminho}`
          : "Módulo Gestão";
        return { ...l, ator: nome(l.ator_email), alvo: nome(l.alvo_email), onde };
      })
      .filter((l) => !q || norm(`${l.ator} ${l.alvo} ${l.onde} ${l.motivo ?? ""}`).includes(q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, busca, d]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Filtrar por pessoa, lista ou motivo…" className="w-full rounded-md border border-gray-200 py-1 pl-7 pr-2 text-sm focus:border-verde-primary focus:outline-none" />
      </div>
      <p className="text-[11px] text-gray-400">As 300 alterações mais recentes. Só gestores veem este histórico.</p>
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500"><Loader2 className="size-4 animate-spin" /> Carregando…</div>
      ) : isError ? (
        <p className="py-6 text-center text-sm text-red-600">Não foi possível ler o histórico.</p>
      ) : linhas.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">Nenhuma alteração{busca ? " com esse filtro" : ""}.</p>
      ) : (
        <div className="max-h-[26rem] overflow-auto rounded-md border border-gray-100">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-50 text-left text-[10px] uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-2 py-1.5">Quando</th>
                <th className="px-2 py-1.5">Quem fez</th>
                <th className="px-2 py-1.5">Ação</th>
                <th className="px-2 py-1.5">Para quem / onde</th>
                <th className="px-2 py-1.5">Nível</th>
                <th className="px-2 py-1.5">Motivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {linhas.map((l) => (
                <tr key={l.id} className="align-top">
                  <td className="whitespace-nowrap px-2 py-1.5 text-gray-500">{new Date(l.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</td>
                  <td className="px-2 py-1.5 text-gray-700">{l.ator}</td>
                  <td className="px-2 py-1.5 text-gray-700">{ACAO[l.acao] ?? l.acao}</td>
                  <td className="px-2 py-1.5">
                    <p className="font-medium text-gray-800">{l.alvo}</p>
                    <p className="text-gray-500">{l.onde}</p>
                  </td>
                  <td className="px-2 py-1.5 text-gray-600">
                    {l.nivel_anterior ? rotuloNivel(l.nivel_anterior) : "—"} → {l.nivel_novo ? rotuloNivel(l.nivel_novo) : "sem acesso"}
                  </td>
                  <td className="px-2 py-1.5 text-gray-600">{l.motivo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
