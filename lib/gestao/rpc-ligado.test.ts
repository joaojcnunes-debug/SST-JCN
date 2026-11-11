/**
 * 11/11/2026: "Não foi possível salvar os vinculados" ao criar tarefa. useSalvarVinculados e useDecidirAprovacao
 * guardavam `sb.rpc` numa variável e chamavam `rpc(...)` solta: o método perde o cliente (`this`) e quebra com
 * "Cannot read properties of undefined (reading 'rest')" antes de chegar ao banco. Este teste impede o padrão de voltar.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ARQUIVOS = ["lib/hooks/useGestao.ts"];

test("deve ligar o rpc ao cliente quando o guarda numa variável (sem `}).rpc;` solto)", () => {
  for (const rel of ARQUIVOS) {
    const src = readFileSync(join(process.cwd(), rel), "utf8");
    const soltos = src.split(/\r?\n/).filter((l) => /\)\.rpc;\s*$/.test(l));
    assert.deepEqual(soltos, [], `${rel}: use .rpc.bind(sb)`);
  }
});
