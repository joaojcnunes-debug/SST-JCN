"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Renderiza a lista em JANELA CRESCENTE em vez de montar tudo de uma vez.
 *
 * POR QUE ISTO EXISTE (medido em 2026-08-10, inventário com 150 itens):
 * a tela montava as 150 linhas juntas. `loading="lazy"` economiza o DOWNLOAD da
 * foto fora da vista, mas NÃO economiza a montagem: cada card vira um componente
 * React e dispara `useSignedUrl`, que é uma consulta React Query por imagem.
 * Eram ~150 assinaturas criptográficas disparadas no mesmo instante em que a
 * página abre — e é isso que faz a tela demorar a APARECER, mesmo depois de o
 * tráfego já ter sido cortado.
 *
 * Com a janela, só o que está por perto é montado (~24 em vez de 150), e o resto
 * entra conforme a pessoa rola. Cai junto o número de assinaturas, de componentes
 * e de elementos na página.
 *
 * Escolhi janela crescente em vez de virtualização de verdade porque não há
 * biblioteca de virtualização no projeto, e o custo aqui é a MONTAGEM INICIAL,
 * não manter montado o que já passou. Virtualização real resolveria os dois, ao
 * preço de uma dependência nova e de mexer na altura de cada linha.
 *
 * @param itens  lista JÁ filtrada. Trocar de filtro devolve a janela ao começo.
 * @param passo  quantos entram por vez (padrão 24 = 8 fileiras de 3 colunas).
 */
export function useListaProgressiva<T>(itens: T[], passo = 24) {
  const [limite, setLimite] = useState(passo);
  const sentinela = useRef<HTMLDivElement | null>(null);

  // Filtro/busca mudou → recomeça do topo. `itens` vem de um useMemo nas telas,
  // então a identidade só muda quando o conteúdo muda de verdade.
  useEffect(() => {
    setLimite(passo);
  }, [itens, passo]);

  useEffect(() => {
    if (limite >= itens.length) return; // já mostra tudo: nada a observar
    const alvo = sentinela.current;
    if (!alvo) return;

    // Navegador sem IntersectionObserver: mostra tudo em vez de esconder itens.
    // Degradar para "lento" é aceitável; degradar para "sumiu" não é.
    if (typeof IntersectionObserver === "undefined") {
      setLimite(itens.length);
      return;
    }

    // O observador é recriado a cada aumento de `limite` de propósito: um
    // observador novo dispara de imediato se o alvo já estiver visível. Sem
    // isso, uma tela alta pararia de carregar depois da primeira leva, porque
    // não haveria nova "entrada em cena" para observar.
    const obs = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          setLimite((l) => Math.min(l + passo, itens.length));
        }
      },
      { rootMargin: "400px" } // começa a montar antes de aparecer, não em cima
    );
    obs.observe(alvo);
    return () => obs.disconnect();
  }, [limite, itens.length, passo]);

  // Ctrl+P com a janela pela metade imprimiria 24 de 150 sem avisar ninguém.
  useEffect(() => {
    const abrirTudo = () => setLimite(itens.length);
    window.addEventListener("beforeprint", abrirTudo);
    return () => window.removeEventListener("beforeprint", abrirTudo);
  }, [itens.length]);

  const visiveis = useMemo(() => itens.slice(0, limite), [itens, limite]);

  return {
    visiveis,
    sentinela,
    restantes: Math.max(0, itens.length - visiveis.length),
    mostrandoTudo: visiveis.length >= itens.length,
    /** Escape manual — usado pelo botão "mostrar todos". */
    mostrarTudo: () => setLimite(itens.length),
  };
}
