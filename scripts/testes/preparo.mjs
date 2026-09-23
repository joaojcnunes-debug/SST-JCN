/**
 * Ambiente mínimo de navegador para os testes da fila offline.
 *
 * O código de `lib/offline/*` foi escrito para rodar no navegador e se protege
 * disso o tempo todo — `offlineDisponivel()` devolve false quando não há
 * `window` nem `indexedDB`, justamente para não quebrar no SSR do Next. Sem
 * estes dois enxertos, todo teste passaria por engano: as funções sairiam pela
 * porta dos fundos sem tocar em nada.
 */

import "fake-indexeddb/auto";

// `offlineDisponivel()` exige as duas coisas. O `indexedDB` veio do import
// acima; o `window` é só a marca de "estou num navegador".
globalThis.window ??= globalThis;

// A fila fala com a tela por evento. Um alvo de eventos de verdade evita
// espalhar `if (typeof window)` pelos testes.
if (typeof globalThis.window.addEventListener !== "function") {
  const alvo = new EventTarget();
  globalThis.window.addEventListener = alvo.addEventListener.bind(alvo);
  globalThis.window.removeEventListener = alvo.removeEventListener.bind(alvo);
  globalThis.window.dispatchEvent = alvo.dispatchEvent.bind(alvo);
}
