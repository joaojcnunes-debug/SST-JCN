"use client";

// "Acontecendo agora" (Etapa 5 do docs/plano-skin-viva-jcn.md): os últimos eventos da trilha de
// auditoria ligados a documentos, atualizando a cada 30 s. O que chega depois da 1ª carga entra
// com uma animação curta (parada com "reduzir movimento"). Clicar abre o documento.

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2 } from "lucide-react";
import { useFeedVisaoGeral, FEED_INTERVALO_MS, type EventoFeed } from "@/lib/hooks/useFeedVisaoGeral";
import { useUsuarios } from "@/lib/hooks/useGestao";
import { useAtividadeContexto } from "@/lib/hooks/useAtividadeContexto";
import { descreverEvento, quemGravou, rotaDoRegistro } from "@/lib/auditoria/eventos";
import type { AuditoriaEvento } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

const COR_ACAO: Record<string, string> = { criou: "bg-emerald-500", editou: "bg-marca-primary", excluiu: "bg-red-500" };

function quando(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR });
  } catch {
    return "";
  }
}

export default function AcontecendoAgora() {
  const { data: eventos = [], isLoading, isError } = useFeedVisaoGeral();
  const { data: usuarios = [] } = useUsuarios();
  const { data: ctx } = useAtividadeContexto();
  const nomes = useMemo(() => new Map(usuarios.map((u) => [u.email.toLowerCase(), u.nome])), [usuarios]);

  // Ids já mostrados: o que aparecer depois da 1ª carga é "novo" e entra animado.
  const vistos = useRef<Set<number> | null>(null);
  const novos = useMemo(() => {
    if (!vistos.current) return new Set<number>();
    return new Set(eventos.filter((e) => !vistos.current!.has(e.id)).map((e) => e.id));
  }, [eventos]);
  useEffect(() => {
    if (!isLoading) vistos.current = new Set(eventos.map((e) => e.id));
  }, [eventos, isLoading]);

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <span className="relative flex size-2" aria-hidden="true">
          <span className="ponto-ao-vivo absolute inline-flex size-full rounded-full bg-emerald-400" />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
        </span>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Acontecendo agora</p>
        <span className="text-[11px] text-gray-400">· atualiza a cada {FEED_INTERVALO_MS / 1000} s</span>
      </div>
      <div className="divide-y divide-gray-100 overflow-hidden dark:divide-white/10 rounded-xl border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex items-center gap-2 p-4 text-sm text-gray-400">
            <Loader2 className="size-4 animate-spin" /> Carregando…
          </div>
        ) : isError ? (
          <p className="p-4 text-sm text-gray-400">Não foi possível carregar a atividade agora.</p>
        ) : eventos.length === 0 ? (
          <p className="p-4 text-sm text-gray-400">Nenhuma movimentação recente nos documentos.</p>
        ) : (
          eventos.map((e) => <LinhaFeed key={e.id} e={e} nomes={nomes} empresa={e.id_empresa ? ctx?.nomePorEmpresa.get(e.id_empresa) : undefined} novo={novos.has(e.id)} />)
        )}
      </div>
    </section>
  );
}

function LinhaFeed({
  e,
  nomes,
  empresa,
  novo,
}: {
  e: EventoFeed;
  nomes: ReadonlyMap<string, string>;
  empresa?: string | null;
  novo: boolean;
}) {
  const ev = { ...e, antes: null, depois: null } as AuditoriaEvento;
  const href =
    (e.doc_tabela && e.doc_id && rotaDoRegistro({ tabela: e.doc_tabela, registro_id: e.doc_id, antes: null, depois: null })) ||
    rotaDoRegistro(ev) ||
    "#";
  const quem = quemGravou(e, nomes);
  return (
    <Link href={href} className={cn("flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-gray-50", novo && "feed-novo")}>
      <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", COR_ACAO[e.acao] ?? "bg-gray-300")} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-gray-800">
          <span className="font-medium">{quem}</span> <span className="text-gray-600">{descreverEvento(ev).replace(/^./, (c) => c.toLowerCase())}</span>
        </p>
        <p className="truncate text-xs text-gray-400">{empresa ?? "—"}</p>
      </div>
      <span className="mt-0.5 shrink-0 text-xs text-gray-400">{quando(e.ocorrido_em)}</span>
    </Link>
  );
}
