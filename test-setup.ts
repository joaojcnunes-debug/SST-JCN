// Preparo do ambiente de teste (node:test).
//
// O runner roda em Node, sem DOM. lib/offline/* precisa de três coisas:
//
//  1. IndexedDB — vem do fake-indexeddb.
//  2. `window` — o guard em lib/offline/db.ts é
//     `typeof window !== "undefined" && typeof indexedDB !== "undefined"`.
//     Ele existe para o código não tentar abrir banco no servidor; no teste
//     precisamos fingir o navegador.
//  3. dispatchEvent/addEventListener — a fila offline avisa a interface por
//     evento quando algo entra ou sobe. Sem isso a gravação até acontece, mas
//     estoura na hora de notificar.
//
// Não é um DOM de mentira: é o mínimo para o código de fila rodar fora do
// navegador. Um EventTarget de verdade sustenta os eventos.
import "fake-indexeddb/auto";

// Acesso sem tipo de propósito: o lib do DOM declara `window` como
// `Window & typeof globalThis`, e o apelido aqui não é uma Window de verdade
// nem precisa ser. Tipar isso exigiria fingir uma interface inteira.
const g = globalThis as unknown as Record<string, unknown>;

if (typeof g.window === "undefined") {
  const alvo = new EventTarget();
  g.dispatchEvent ??= alvo.dispatchEvent.bind(alvo);
  g.addEventListener ??= alvo.addEventListener.bind(alvo);
  g.removeEventListener ??= alvo.removeEventListener.bind(alvo);
  g.window = g;
}
