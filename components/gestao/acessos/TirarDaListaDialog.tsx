"use client";

import { useEffect, useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import Modal from "@/components/ui/Modal";
import type { NoEspaco, OrigemAcesso, TipoRecurso } from "@/lib/gestao/acessos";
import type { DadosAcessos } from "./useDadosAcessos";
import type { Passo } from "./useGravarAcessos";

export interface AlvoTirar {
  email: string;
  nome: string;
  idQuadro: string;
  caminho: string;
  origens: OrigemAcesso[];
}

interface Opcao { chave: string; rotulo: string; detalhe?: string; passos: Passo[]; daLista: boolean }

/** Espaço e pasta onde a lista está (o acesso dado neles vale para ela). */
function ancestrais(arv: NoEspaco[], idQuadro: string): { tipo: TipoRecurso; id: string; nome: string }[] {
  for (const e of arv) {
    const esp = e.id === "__sem_espaco__" ? [] : [{ tipo: "space" as const, id: e.id, nome: e.nome }];
    if (e.listas.some((l) => l.id === idQuadro)) return esp;
    for (const p of e.pastas) if (p.listas.some((l) => l.id === idQuadro)) return [...esp, { tipo: "folder" as const, id: p.id, nome: p.nome }];
  }
  return [];
}

/**
 * "Tirar desta lista" (v0.3.851): mostra DE ONDE vem o acesso da pessoa à lista e deixa escolher o
 * que tirar. O acesso direto na lista vem marcado; o que vem de pasta, espaço ou equipe aparece
 * com a consequência (perde as outras listas / tudo da equipe), desmarcado. Restritivo (teto) não
 * entra: tirá-lo AUMENTARIA o acesso.
 */
export default function TirarDaListaDialog({
  d,
  alvo,
  onClose,
  onConfirmar,
}: {
  d: DadosAcessos;
  alvo: AlvoTirar | null;
  onClose: () => void;
  onConfirmar: (passos: Passo[], resumo: string) => void;
}) {
  const opcoes = useMemo<Opcao[]>(() => {
    if (!alvo) return [];
    const email = alvo.email.toLowerCase();
    const onde = [{ tipo: "list" as const, id: alvo.idQuadro, nome: alvo.caminho }, ...ancestrais(d.arvore, alvo.idQuadro)];
    const cobre = (tipo: string | null | undefined, id: string | null | undefined) => onde.some((o) => o.tipo === tipo && o.id === id);
    const out: Opcao[] = [];

    for (const a of d.acessos) {
      if (a.id_equipe || a.restritivo || (a.usuario_email ?? "").toLowerCase() !== email || !cobre(a.recurso_tipo, a.recurso_id)) continue;
      const tipo = a.recurso_tipo as TipoRecurso;
      const r = d.recursoDe(tipo, a.recurso_id);
      out.push({
        chave: `g:${a.id}`,
        rotulo: tipo === "list" ? "Acesso direto nesta lista" : `Acesso direto ${tipo === "folder" ? "na pasta" : "no espaço"} ${r.nome}`,
        detalhe: tipo === "list" ? undefined : `Perde também as outras listas ${tipo === "folder" ? "desta pasta" : "deste espaço"}.`,
        passos: [{ op: "pessoa", email: alvo.email, tipo, id: a.recurso_id!, nivel: null }],
        daLista: tipo === "list",
      });
    }

    const equipesDela = d.equipeMembros.filter((m) => m.usuario_email.toLowerCase() === email).map((m) => m.id_equipe);
    for (const idEq of equipesDela) {
      const grantsEq = d.acessos.filter((a) => a.id_equipe === idEq && !a.restritivo);
      if (!grantsEq.some((a) => cobre(a.recurso_tipo, a.recurso_id))) continue;
      const outros = grantsEq.filter((a) => !(a.recurso_tipo === "list" && a.recurso_id === alvo.idQuadro)).map((a) => d.recursoDe(a.recurso_tipo, a.recurso_id).nome);
      out.push({
        chave: `e:${idEq}`,
        rotulo: `Sair da equipe ${d.nomeEquipe.get(idEq) ?? "?"}`,
        detalhe: outros.length ? `Perde tudo o que vem da equipe, inclusive: ${outros.join(", ")}.` : "Perde o que vem da equipe.",
        passos: [{ op: "sair_equipe", id_equipe: idEq, email: alvo.email }],
        daLista: false,
      });
    }
    return out;
  }, [alvo, d]);

  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  useEffect(() => {
    setMarcadas(new Set(opcoes.filter((o) => o.daLista).map((o) => o.chave)));
  }, [opcoes]);

  if (!alvo) return null;
  const ehGestor = alvo.origens.some((o) => o.tipo === "gestor");
  const ficam = opcoes.filter((o) => !marcadas.has(o.chave));
  const escolhidas = opcoes.filter((o) => marcadas.has(o.chave));
  const alternar = (k: string) => setMarcadas((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  return (
    <Modal open={!!alvo} onClose={onClose} title="Tirar desta lista" size="sm">
      <div className="space-y-3">
        <p className="text-sm text-gray-600">
          <span className="font-medium text-gray-800">{alvo.nome}</span> em <span className="font-medium text-gray-800">{alvo.caminho}</span>
        </p>

        {ehGestor && (
          <p className="flex items-start gap-1.5 rounded-md bg-sky-50 px-2 py-1.5 text-xs text-sky-800">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0" /> É administrador da Gestão: continua vendo todas as listas. Para tirar de vez, use &quot;Tirar da Gestão&quot; em Por pessoa.
          </p>
        )}

        {opcoes.length === 0 ? (
          !ehGestor && <p className="text-sm text-gray-500">Não há acesso direto nem de equipe para tirar aqui.</p>
        ) : (
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500">De onde vem o acesso — marque o que tirar</p>
            {opcoes.map((o) => (
              <label key={o.chave} className="flex cursor-pointer items-start gap-2 rounded-md border border-gray-200 px-2 py-1.5 text-sm hover:bg-gray-50">
                <input type="checkbox" checked={marcadas.has(o.chave)} onChange={() => alternar(o.chave)} className="mt-0.5 size-3.5 rounded border-gray-300 text-verde-primary" />
                <span className="min-w-0 flex-1">
                  <span className="text-gray-800">{o.rotulo}</span>
                  {o.detalhe && <span className="block text-[11px] text-amber-700">{o.detalhe}</span>}
                </span>
              </label>
            ))}
          </div>
        )}

        {escolhidas.length > 0 && !ehGestor && (
          <p className="text-xs text-gray-600">
            {ficam.length === 0
              ? "Depois disso, a pessoa deixa de ver esta lista."
              : `Ainda continua com acesso por: ${ficam.map((o) => o.rotulo.replace(/^Sair da equipe /, "equipe ").replace(/^Acesso direto /, "")).join("; ")}.`}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
            Cancelar
          </button>
          <button
            type="button"
            disabled={escolhidas.length === 0}
            onClick={() => onConfirmar(escolhidas.flatMap((o) => o.passos), `${alvo.nome} — ${alvo.caminho}: ${escolhidas.map((o) => o.rotulo.charAt(0).toLowerCase() + o.rotulo.slice(1)).join("; ")}.`)}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            Tirar
          </button>
        </div>
      </div>
    </Modal>
  );
}
