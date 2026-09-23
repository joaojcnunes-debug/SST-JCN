"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { avisoRevisao, type ResumoTrava } from "@/lib/sistema/avisoRevisaoTrava";

/**
 * Lembrete ATIVO da revisão da trava por módulo (v236, modo LOG).
 *
 * Combinado com ele em 22/09: *"podemos já deixar o caminho estruturado e
 * assim que o dia chegar você traz novamente essa questão; consegue marcar
 * para que não deixemos passar?"*
 *
 * O card em Sistema › Funções já mostra a data, mas é PASSIVO — só vê quem
 * abre aquela tela. Este aviso mora no Início (a tela aberta todo dia) e
 * aparece sozinho na semana da data, sem sumir depois que ela passa. Some
 * quando a trava sai do modo LOG (decisão tomada) ou se a data for adiada —
 * os dois vêm de `rls_modulo_config`, nada cravado no código.
 *
 * Quem vê: só quem a RPC deixa ler (`caller_ve_presenca()` — Admin, TI,
 * Gerente, Supervisora do administrativo). Para os outros a RPC volta vazia e
 * o componente não desenha nada.
 *
 * A REGRA (quando aparece, o que escreve) mora em `lib/sistema/
 * avisoRevisaoTrava.ts` e tem teste — aqui fica só o desenho.
 */
export default function AvisoRevisaoTrava() {
  const { data } = useQuery({
    queryKey: ["rls_modulo", "aviso-revisao"],
    staleTime: 60 * 60 * 1000, // 1 h: é lembrete de data, não medidor
    retry: false,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.rpc("rls_modulo_resumo" as never);
      if (error) return null; // sem permissão para ver: não é erro de tela
      const r = (Array.isArray(data) ? data[0] : data) as ResumoTrava | undefined;
      return r ?? null;
    },
  });

  const aviso = avisoRevisao(data);
  if (!aviso.mostrar || !data) return null;

  return (
    <div className="reveal-up mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm shadow-sm">
      <Lock className="h-4 w-4 shrink-0 text-amber-700" />
      <strong className="text-amber-900">
        Trava por módulo: revisão {aviso.venceu ? "venceu" : "marcada para"} {aviso.quando}
      </strong>
      <span className="text-amber-800">
        Está em modo LOG desde {new Date(data.desde).toLocaleDateString("pt-BR")} — anota quem
        leria módulo que não tem, sem barrar. Já são {data.tentativas}{" "}
        {data.tentativas === 1 ? "tentativa" : "tentativas"} de {data.contas}{" "}
        {data.contas === 1 ? "conta" : "contas"}.
      </span>
      <Link
        href="/funcoes"
        className="rounded-md bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-700"
      >
        Ver a lista e decidir →
      </Link>
    </div>
  );
}
