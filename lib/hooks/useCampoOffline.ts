"use client";

// Tempo de campo sem sinal (0.3.315, banco v365): guardar o evento no aparelho e enviar a fila quando a conexão
// voltar. As regras estão em lib/inspecoes/campo-offline.ts.

import { useEffect, useRef } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { SessaoDocumento } from "@/lib/inspecoes/sessoes";
import { CHAVE_CAMPO, CHAVE_FILA, aplicarNaTela, ehFalhaDeRede, lerFila, type EventoCampo } from "@/lib/inspecoes/campo-offline";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = () => createSupabaseBrowserClient() as any;

const ler = () => {
  try {
    return lerFila(window.localStorage.getItem(CHAVE_FILA));
  } catch {
    return [];
  }
};
const gravar = (fila: EventoCampo[]) => {
  try {
    window.localStorage.setItem(CHAVE_FILA, JSON.stringify(fila));
  } catch {
    /* sem armazenamento: o evento se perde, como sem a fila */
  }
};

/** Guarda o evento (sem sinal) e já mostra na tela; envia quando a conexão voltar. */
export function guardarEventoCampo(qc: QueryClient, ev: EventoCampo, eu: { id_usuario: string; nome: string }) {
  gravar([...ler(), ev]);
  qc.setQueryData<SessaoDocumento[]>([CHAVE_CAMPO, ev.idInspecao], (s) => aplicarNaTela(s ?? [], ev, eu));
  toast("Sem sinal: guardado no aparelho. O tempo de campo é enviado quando a conexão voltar.", { icon: "📶", id: "campo-offline" });
}

/** Há eventos de campo esperando a conexão. */
export function temFilaCampo(): boolean {
  return ler().length > 0;
}

async function enviar(ev: EventoCampo) {
  const { error } =
    ev.tipo === "iniciar"
      ? await sb().rpc("campo_sessao_iniciar", { p_id_inspecao: ev.idInspecao, p_origem: "BOTAO", p_quando: ev.quando })
      : await sb().rpc("campo_sessao_pausar", { p_id_inspecao: ev.idInspecao, p_motivo: ev.motivo ?? "PAUSA", p_quando: ev.quando });
  return error as { message?: string } | null;
}

/**
 * Envia a fila em ordem ao abrir a tela, quando a conexão volta e a cada 30 s. Erro de rede para e tenta depois;
 * erro do banco (ex.: inspeção concluída enquanto estava sem sinal) descarta o evento e avisa.
 */
export function useEnviarFilaCampo() {
  const qc = useQueryClient();
  const enviando = useRef(false);
  const qcRef = useRef(qc);
  qcRef.current = qc;
  useEffect(() => {
    const processar = async () => {
      if (enviando.current || !navigator.onLine) return;
      let fila = ler();
      if (!fila.length) return;
      enviando.current = true;
      let enviados = 0;
      try {
        while (fila.length) {
          const err = await enviar(fila[0]);
          if (err && ehFalhaDeRede(err, navigator.onLine)) break;
          if (err) toast.error(`Tempo de campo guardado não entrou: ${err.message ?? "erro"}`);
          else enviados++;
          fila = fila.slice(1);
          gravar(fila);
        }
      } finally {
        enviando.current = false;
        qcRef.current.invalidateQueries({ queryKey: [CHAVE_CAMPO] });
        if (enviados) toast.success(`Tempo de campo enviado (${enviados} registro${enviados > 1 ? "s" : ""} guardado${enviados > 1 ? "s" : ""} sem sinal).`);
      }
    };
    processar();
    window.addEventListener("online", processar);
    const t = setInterval(processar, 30_000);
    return () => {
      window.removeEventListener("online", processar);
      clearInterval(t);
    };
  }, []);
}
