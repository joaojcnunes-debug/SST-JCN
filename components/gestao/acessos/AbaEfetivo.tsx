"use client";

import { useMemo, useState } from "react";
import { Loader2, MapPin, UserPlus } from "lucide-react";
import AvatarPessoa from "@/components/gestao/AvatarPessoa";
import { useAcessosEfetivos } from "@/lib/hooks/useGestaoAcesso";
import { chaveRecurso, descreverOrigem, origensComEfeito, type NoEspaco } from "@/lib/gestao/acessos";
import { rotuloNivel, nivelVeTodas } from "@/lib/gestao/niveis";
import { cn } from "@/lib/utils";
import type { DadosAcessos } from "./useDadosAcessos";

const COR_EFEITO = {
  vale: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  teto: "bg-amber-50 text-amber-800 ring-amber-200",
  sem_efeito: "bg-gray-50 text-gray-400 line-through ring-gray-200",
} as const;
const DICA_EFEITO = {
  vale: "É esta regra que define o nível",
  teto: "Restritivo: limita o nível (teto)",
  sem_efeito: "Sem efeito aqui: há regra mais específica (lista > pasta > espaço)",
} as const;

function listasDaArvore(arv: NoEspaco[]) {
  const out: { id: string; caminho: string }[] = [];
  for (const e of arv) {
    const pre = e.id === "__sem_espaco__" ? "" : `${e.nome} › `;
    for (const p of e.pastas) for (const l of p.listas) out.push({ id: l.id, caminho: `${pre}${p.nome} › ${l.nome}` });
    for (const l of e.listas) out.push({ id: l.id, caminho: `${pre}${l.nome}` });
  }
  return out;
}

/**
 * O acesso que vale DE FATO (v305, RPC gestao_acessos_efetivos): por pessoa (o que ela acessa)
 * ou por lista (quem acessa — o "Compartilhar" da lista abre aqui). Cada linha mostra o nível
 * efetivo e as regras que levaram a ele, marcando a que manda, a que é teto e a que ficou sem
 * efeito por haver outra mais específica.
 */
export default function AbaEfetivo({
  d,
  modo,
  quadroInicial,
  onDarAcesso,
}: {
  d: DadosAcessos;
  modo: "pessoa" | "lista";
  quadroInicial?: string | null;
  onDarAcesso: (idQuadro: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [quadro, setQuadro] = useState(quadroInicial ?? "");
  const listas = useMemo(() => listasDaArvore(d.arvore), [d.arvore]);
  const caminhoLista = useMemo(() => new Map(listas.map((l) => [l.id, l.caminho])), [listas]);
  const q = useAcessosEfetivos(modo === "pessoa" ? { email } : { idQuadro: quadro });
  const linhas = q.data ?? [];
  const unidades = linhas[0]?.unidades;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {modo === "pessoa" ? (
          <select value={email} onChange={(e) => setEmail(e.target.value)} className="min-w-[260px] flex-1 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm">
            <option value="">Escolha a pessoa…</option>
            {d.usuarios.map((u) => (
              <option key={u.email} value={u.email}>{u.nome} ({u.email})</option>
            ))}
          </select>
        ) : (
          <>
            <select value={quadro} onChange={(e) => setQuadro(e.target.value)} className="min-w-[260px] flex-1 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm">
              <option value="">Escolha a lista…</option>
              {listas.map((l) => (
                <option key={l.id} value={l.id}>{l.caminho}</option>
              ))}
            </select>
            {quadro && (
              <button type="button" onClick={() => onDarAcesso(quadro)} className="inline-flex items-center gap-1 rounded-md border border-verde-primary px-2.5 py-1.5 text-sm font-medium text-verde-primary hover:bg-verde-light">
                <UserPlus className="size-4" /> Dar acesso a esta lista
              </button>
            )}
          </>
        )}
      </div>

      <p className="text-[11px] text-gray-500">
        Nível que vale de fato, calculado pelo banco. Regras: <span className="rounded bg-emerald-50 px-1 text-emerald-800">define o nível</span>{" "}
        <span className="rounded bg-amber-50 px-1 text-amber-800">teto (restritivo)</span>{" "}
        <span className="rounded bg-gray-50 px-1 text-gray-400 line-through">sem efeito</span> — a regra da lista vale mais que a da pasta, e a da pasta mais que a do espaço.
      </p>

      {modo === "pessoa" && email && unidades && unidades.length > 0 && (
        <p className="flex items-center gap-1 rounded-md bg-sky-50 px-2 py-1 text-xs text-sky-800">
          <MapPin className="size-3.5" /> Vê só as tarefas das unidades: {unidades.join(", ")} (e as sem unidade), mesmo nos níveis &quot;todas as tarefas&quot;.
        </p>
      )}

      {q.isLoading && (modo === "pessoa" ? email : quadro) ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500"><Loader2 className="size-4 animate-spin" /> Calculando…</div>
      ) : q.isError ? (
        <p className="py-6 text-center text-sm text-red-600">Não foi possível calcular os acessos.</p>
      ) : (modo === "pessoa" ? email : quadro) && linhas.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">{modo === "pessoa" ? "Esta pessoa não acessa nenhuma lista." : "Ninguém além dos administradores acessa esta lista."}</p>
      ) : (
        <div className="max-h-[26rem] space-y-1 overflow-auto">
          {linhas.map((l) => {
            const origens = origensComEfeito(l.origens ?? []);
            return (
              <div key={`${l.email}:${l.id_quadro}`} className="flex flex-wrap items-start gap-2 rounded-md border border-gray-100 px-2 py-1.5">
                {modo === "lista" && <AvatarPessoa nome={l.nome ?? l.email} className="size-7 text-[10px]" />}
                <div className="min-w-[180px] flex-1">
                  <p className="text-sm font-medium text-gray-800">{modo === "pessoa" ? (caminhoLista.get(l.id_quadro) ?? l.quadro) : (l.nome ?? l.email)}</p>
                  {modo === "lista" && <p className="text-[11px] text-gray-400">{l.email}</p>}
                  <div className="mt-1 flex flex-wrap gap-1">
                    {origens.map((o, i) => (
                      <span key={i} title={DICA_EFEITO[o.efeito]} className={cn("rounded px-1.5 py-0.5 text-[10px] ring-1", COR_EFEITO[o.efeito])}>
                        {descreverOrigem(o)}{o.nivel && o.tipo !== "gestor" ? ` · ${rotuloNivel(o.nivel)}` : ""}
                      </span>
                    ))}
                  </div>
                </div>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", nivelVeTodas(l.nivel) ? "bg-verde-light text-verde-primary" : "bg-gray-100 text-gray-700")}>
                  {rotuloNivel(l.nivel)}
                </span>
              </div>
            );
          })}
        </div>
      )}
      {modo === "lista" && quadro && !d.indice.has(chaveRecurso("list", quadro)) && (
        <p className="text-[11px] text-gray-400">Lista pessoal (Meu Quadro): o acesso é do dono e do supervisor da equipe dele.</p>
      )}
    </div>
  );
}
