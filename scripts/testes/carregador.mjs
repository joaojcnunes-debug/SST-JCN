/**
 * Faz o `node --test` entender os imports do projeto.
 *
 * Duas coisas que o Node não resolve sozinho e que o Next resolve por nós:
 *
 *  • `@/lib/...` — atalho do `tsconfig.json`, que o Node desconhece;
 *  • `./db` sem extensão — o TypeScript aceita, o ESM do Node exige `.ts`.
 *
 * Sem isto seria preciso um empacotador só para rodar teste de lógica pura, o
 * que é peça a mais no pipeline de um projeto que já empacota para Electron e
 * para Docker. Vinte linhas aqui evitam uma dependência lá.
 */

import { registerHooks } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Tenta os sufixos que o TypeScript deixa implícitos. */
function resolverArquivo(base) {
  for (const sufixo of [".ts", ".tsx", ".mjs", ".js", "/index.ts", ""]) {
    const alvo = base + sufixo;
    if (existsSync(alvo) && !alvo.endsWith("/")) return alvo;
  }
  return null;
}

registerHooks({
  resolve(especificador, contexto, proximo) {
    if (especificador.startsWith("@/")) {
      const achado = resolverArquivo(path.join(raiz, especificador.slice(2)));
      if (achado) return proximo(pathToFileURL(achado).href, contexto);
    }

    if (especificador.startsWith(".") && !path.extname(especificador)) {
      const daOrigem = contexto.parentURL
        ? path.dirname(fileURLToPath(contexto.parentURL))
        : raiz;
      const achado = resolverArquivo(path.resolve(daOrigem, especificador));
      if (achado) return proximo(pathToFileURL(achado).href, contexto);
    }

    return proximo(especificador, contexto);
  },
});
