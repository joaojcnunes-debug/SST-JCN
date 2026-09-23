"use client";

import { useCallback, useEffect, useState } from "react";
import { espacoDisponivel, offlineDisponivel } from "@/lib/offline/db";
import {
  aoMudarOperacoes,
  listarOperacoes,
  listarProntasParaEnviar,
  MAX_TENTATIVAS,
  type OperacaoOffline,
} from "@/lib/offline/operacoes";
import { sincronizarInspecoes } from "@/lib/offline/sincronizar";

/**
 * Trava da rodada de abertura, uma por carregamento da página.
 *
 * Fora do React de propósito: `ModuleTopbar` monta este hook nos 19 layouts, e
 * um estado interno reiniciaria a cada troca de módulo — o técnico dispararia
 * uma rodada de envio a cada clique no menu.
 */
let jaTentouNesteCarregamento = false;

/**
 * O que a inspeção deixou guardado no aparelho.
 *
 * Irmão de `useFilaOffline`, e pela mesma razão dele não usa react-query: aquilo
 * é cache de SERVIDOR, e aqui a fonte da verdade é o IndexedDB local, que muda
 * por evento (voltou a rede, terminou um envio) e não por requisição.
 * `aoMudarOperacoes` já é o canal de invalidação.
 */
export function useOperacoesOffline() {
  const [operacoes, setOperacoes] = useState<OperacaoOffline[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [espaco, setEspaco] = useState<{ usado: number; total: number } | null>(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [online, setOnline] = useState(true);

  /**
   * A sessão do Cloudflare Access caiu no último envio.
   *
   * Não é um status da operação, e sim o resultado da última rodada — a operação
   * continua PENDENTE e íntegra. Guardar isso à parte é o que permite a tela
   * dizer "nada foi perdido, entre de novo" em vez de deixar o técnico achar que
   * o banco recusou o trabalho dele.
   */
  const [precisaReautenticar, setPrecisaReautenticar] = useState(false);

  const recarregar = useCallback(async () => {
    if (!offlineDisponivel()) {
      setCarregando(false);
      return;
    }
    try {
      const [lista, esp] = await Promise.all([listarOperacoes(), espacoDisponivel()]);
      setOperacoes(lista);
      setEspaco(esp);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void recarregar();
    return aoMudarOperacoes(() => void recarregar());
  }, [recarregar]);

  const enviarAgora = useCallback(async () => {
    setSincronizando(true);
    try {
      const resumo = await sincronizarInspecoes();
      setPrecisaReautenticar(resumo.motivoParada === "REAUTENTICAR");
      return resumo;
    } finally {
      setSincronizando(false);
      await recarregar();
    }
  }, [recarregar]);

  // Voltou a rede: tenta subir sozinho. É o gatilho que faz a promessa do
  // offline se cumprir sem o técnico precisar lembrar de nada.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setOnline(navigator.onLine);
    const aoVoltar = () => {
      setOnline(true);
      void enviarAgora();
    };
    const aoCair = () => setOnline(false);
    window.addEventListener("online", aoVoltar);
    window.addEventListener("offline", aoCair);
    return () => {
      window.removeEventListener("online", aoVoltar);
      window.removeEventListener("offline", aoCair);
    };
  }, [enviarAgora]);

  /**
   * Abriu o app já com rede e com coisa na fila: sobe agora.
   *
   * O evento `online` do efeito acima só dispara na TRANSIÇÃO sem rede → com
   * rede. O caso mais comum do campo não é esse: o técnico captura sem sinal, o
   * Android mata o app durante a viagem, e ele reabre já conectado na base —
   * nenhuma transição acontece, e o evento nunca vem.
   *
   * Sem este efeito, o trabalho ficaria parado no aparelho até alguém abrir a
   * tela de pendências e apertar o botão, que é exatamente o que o offline
   * existe para evitar.
   */
  useEffect(() => {
    if (jaTentouNesteCarregamento) return;
    if (typeof window === "undefined" || !navigator.onLine) return;
    if (!offlineDisponivel()) return;

    // Marca antes do await: dois layouts montando no mesmo quadro pediriam a
    // mesma rodada duas vezes.
    jaTentouNesteCarregamento = true;

    void (async () => {
      // Fila vazia é o caso normal de quem nunca saiu a campo. Não vale acordar
      // o motor — e nem piscar o "enviando" na barra de quem não tem pendência.
      if ((await listarProntasParaEnviar()).length === 0) return;
      await enviarAgora();
    })();
  }, [enviarAgora]);

  /**
   * Travada = pendente, mas esperando outra operação que foi recusada.
   *
   * Merece seção própria porque a causa não está nela: o técnico não vai
   * entender por que o risco não sobe até ver que o setor novo é que foi
   * recusado. Misturar com "aguardando" esconderia a única informação útil.
   */
  const enviadas = operacoes.filter((o) => o.status === "ENVIADA");
  const idsEnviadas = new Set(enviadas.map((o) => o.id));
  const recusadas = operacoes.filter((o) => o.status === "RECUSADA");

  const pendentes = operacoes.filter((o) => o.status === "PENDENTE");
  const travadas = pendentes.filter((o) => !o.depende_de.every((d) => idsEnviadas.has(d)));
  const aguardando = pendentes.filter((o) => o.depende_de.every((d) => idsEnviadas.has(d)));

  return {
    operacoes,
    aguardando,
    travadas,
    recusadas,
    enviadas,
    /** O número do aviso: o que exige atenção, sem contar o que já subiu. */
    naoResolvidas: aguardando.length + travadas.length + recusadas.length,
    carregando,
    sincronizando,
    online,
    espaco,
    precisaReautenticar,
    enviarAgora,
    recarregar,
    MAX_TENTATIVAS,
  };
}
