"use client";

import { useCallback, useEffect, useState } from "react";
import {
  espacoDisponivel,
  listarSaidas,
  offlineDisponivel,
  type SaidaOffline,
} from "@/lib/offline/db";
import { aoMudarFila, sincronizar, sincronizarSeOnline } from "@/lib/offline/fila";

/**
 * O que está guardado no aparelho e ainda não chegou ao painel.
 *
 * Não usa react-query de propósito: react-query é cache de SERVIDOR, e isto é o
 * contrário — a fonte da verdade é o IndexedDB local, que muda por eventos
 * (voltou a rede, terminou um envio) e não por requisição. O `aoMudarFila` já é
 * o canal de invalidação.
 */
export function useFilaOffline() {
  const [saidas, setSaidas] = useState<SaidaOffline[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [espaco, setEspaco] = useState<{ usado: number; total: number } | null>(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [online, setOnline] = useState(true);

  const recarregar = useCallback(async () => {
    if (!offlineDisponivel()) {
      setCarregando(false);
      return;
    }
    try {
      const [lista, esp] = await Promise.all([listarSaidas(), espacoDisponivel()]);
      setSaidas(lista);
      setEspaco(esp);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void recarregar();
    return aoMudarFila(() => void recarregar());
  }, [recarregar]);

  // Voltou a rede: tenta subir sozinho. É o gatilho que faz a promessa do
  // offline se cumprir sem o técnico precisar lembrar de nada.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setOnline(navigator.onLine);
    const aoVoltar = () => {
      setOnline(true);
      void sincronizarSeOnline();
    };
    const aoCair = () => setOnline(false);
    window.addEventListener("online", aoVoltar);
    window.addEventListener("offline", aoCair);
    return () => {
      window.removeEventListener("online", aoVoltar);
      window.removeEventListener("offline", aoCair);
    };
  }, []);

  /** O botão manual. `forcar` reinclui as recusadas, que a rodada automática não toca. */
  const enviarAgora = useCallback(async () => {
    setSincronizando(true);
    try {
      return await sincronizar({ forcar: true });
    } finally {
      setSincronizando(false);
      await recarregar();
    }
  }, [recarregar]);

  const aguardando = saidas.filter(
    (s) => s.status === "PENDENTE" || s.status === "ENVIANDO" || s.status === "REAUTENTICAR"
  );
  const rascunhos = saidas.filter((s) => s.status === "RASCUNHO");
  const recusadas = saidas.filter((s) => s.status === "RECUSADO");
  const enviadas = saidas.filter((s) => s.status === "ENVIADO");

  return {
    saidas,
    aguardando,
    rascunhos,
    recusadas,
    enviadas,
    /** O número do aviso: o que exige atenção, sem contar o que já subiu. */
    naoResolvidas: aguardando.length + rascunhos.length + recusadas.length,
    carregando,
    sincronizando,
    online,
    espaco,
    enviarAgora,
    recarregar,
  };
}
