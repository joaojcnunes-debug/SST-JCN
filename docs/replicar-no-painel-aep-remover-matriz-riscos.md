# Replicar no Painel SST: AEP — remover a "Matriz de Riscos" do editor de setores

> **Como usar:** abra o Claude Code na pasta do **painel-sst** e diga:
> *"Siga o arquivo `replicar-no-painel-aep-remover-matriz-riscos.md`"*.
>
> Origem: JCN (`sst-jcn`), commit `dc83352` (PR #95), de 2026-10-07, já em produção lá.
> **Sem migration. Sem edge function.** Só front-end, 1 arquivo.

## O que faz

- Em **Setores / Triagem**, cada setor perde a seção **"Matriz de Riscos"**:
  - a lista manual de riscos;
  - o botão "+ Risco".
- Depois da Triagem Ergonômica vem direto o aviso de AET e o Parecer /
  Recomendações.
- Saem também as funções `addRisco`, `updateRisco` e `removeRisco` e os imports
  que ficaram sem uso.

**O que NÃO muda:**
- **Banco:** o campo `setor.riscos` continua no jsonb e os normalizadores
  continuam lendo.
- **Laudo e PDF:** mostram a tabela de riscos só quando o setor tem riscos
  gravados (`setor.riscos.length > 0`). Assim, AEP antiga com riscos continua
  saindo igual.
- **Indicação de AET (`calcNecessitaAet`):** já não usava essa lista, só a
  matriz AIHA dos fatores organizacionais.
- **Dashboard e lista de AEPs:** a contagem de riscos continua. Sem lançamentos
  novos, ela fica em 0.

## Passo 1: conferir o painel

1. Rode no **banco do painel** (nunca no do JCN) para saber se há riscos lançados:

```sql
select count(distinct a.id_relatorio) as aeps_com_riscos
  from aep_relatorios a, jsonb_array_elements(a.setores) s
 where jsonb_array_length(coalesce(s->'riscos', '[]')) > 0;
```

   Se der mais que 0, esses riscos **continuam no laudo/PDF**. Só não serão mais
   editáveis. Avise o usuário antes de seguir.
2. Em `components/aep/AepSetoresEditor.tsx`, confirme:
   - que existe a seção `{/* ── Matriz de Riscos ── */}`, logo antes de
     `{/* ── Indicador AET ── */}`;
   - que existem as funções `addRisco`, `updateRisco` e `removeRisco`.

## Passo 2: código

### `components/aep/AepSetoresEditor.tsx`

Os números de linha do painel podem diferir. Aplique pelo conteúdo:
1. remova a seção inteira da Matriz de Riscos;
2. remova as três funções;
3. remova os imports que o lint acusar como não usados.

```diff
@@ -56,11 +56,7 @@ import {
   useAepRelatorio,
   useSalvarAep,
   setorVazioAep,
-  riscoVazioAep,
   calcNecessitaAet,
-  CLASS_COLOR_AEP,
-  TIPOS_RISCO_AEP,
-  CLASSIFICACOES_AEP,
   useCatalogoSetoresEmpresa,
 } from "@/lib/hooks/useAep";
 import { useCanEdit } from "@/lib/hooks/useUsuario";
@@ -105,15 +101,12 @@ import {
 import type {
   AepCargoSetor,
   AepSetor,
-  AepRisco,
   AepChecklistFisica,
   AepChecklistCognitiva,
   AepChecklistOrganizacional,
-  ClassificacaoRiscoAET,
   MatrizRisco,
   RespostaChecklist,
   RespostaChecklistAep,
-  TipoRiscoAET,
 } from "@/lib/supabase/types";
 
 // ─── Catálogo das respostas ───────────────────────────────────────────────────
@@ -1349,27 +1342,6 @@ export default function AepSetoresPage({ idRelatorio }: { idRelatorio: string })
     );
   }
 
-  function addRisco(setorId: string) {
-    const novo = riscoVazioAep();
-    updateSetor(setorId, {
-      riscos: [...(setores.find((s) => s.id === setorId)?.riscos ?? []), novo],
-    });
-  }
-
-  function updateRisco(setorId: string, riscoId: string, patch: Partial<AepRisco>) {
-    const setor = setores.find((s) => s.id === setorId);
-    if (!setor) return;
-    updateSetor(setorId, {
-      riscos: setor.riscos.map((r) => (r.id === riscoId ? { ...r, ...patch } : r)),
-    });
-  }
-
-  function removeRisco(setorId: string, riscoId: string) {
-    const setor = setores.find((s) => s.id === setorId);
-    if (!setor) return;
-    updateSetor(setorId, { riscos: setor.riscos.filter((r) => r.id !== riscoId) });
-  }
-
   function buildTrabalhadores(cargos: AepCargoSetor[]): string {
     return cargos
       .filter((c) => c.cargo)
@@ -2007,80 +1979,6 @@ export default function AepSetoresPage({ idRelatorio }: { idRelatorio: string })
                   </div>
                 </section>
 
-                {/* ── Matriz de Riscos ──────────────────────────────── */}
-                <section>
-                  <div className="mb-3 flex items-center justify-between">
-                    <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
-                      Matriz de Riscos
-                    </h3>
-                    {canEdit && (
-                      <button
-                        type="button"
-                        onClick={() => addRisco(setor.id)}
-                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
-                      >
-                        <Plus className="size-3" /> Risco
-                      </button>
-                    )}
-                  </div>
-
-                  {setor.riscos.length === 0 ? (
-                    <p className="text-xs text-gray-400 italic">Nenhum risco identificado.</p>
-                  ) : (
-                    <div className="space-y-2">
-                      {setor.riscos.map((risco) => (
-                        <div key={risco.id} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 rounded-lg border border-gray-100 bg-gray-50 p-2 sm:grid-cols-[140px_1fr_160px_180px_auto]">
-                          <select
-                            disabled={!canEdit}
-                            value={risco.tipo}
-                            onChange={(e) => updateRisco(setor.id, risco.id, { tipo: e.target.value as TipoRiscoAET })}
-                            className="rounded border border-gray-200 bg-white px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none disabled:bg-gray-50"
-                          >
-                            {TIPOS_RISCO_AEP.map((t) => (
-                              <option key={t}>{t}</option>
-                            ))}
-                          </select>
-                          <input
-                            disabled={!canEdit}
-                            type="text"
-                            value={risco.risco}
-                            onChange={(e) => updateRisco(setor.id, risco.id, { risco: e.target.value })}
-                            placeholder="Agente / risco"
-                            className="rounded border border-gray-200 bg-white px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none disabled:bg-gray-50"
-                          />
-                          <select
-                            disabled={!canEdit}
-                            value={risco.classificacao_risco}
-                            onChange={(e) => updateRisco(setor.id, risco.id, { classificacao_risco: e.target.value as ClassificacaoRiscoAET })}
-                            className={`rounded border px-2 py-1 text-xs font-semibold focus:outline-none disabled:bg-gray-50 ${CLASS_COLOR_AEP[risco.classificacao_risco]}`}
-                          >
-                            {CLASSIFICACOES_AEP.map((c) => (
-                              <option key={c}>{c}</option>
-                            ))}
-                          </select>
-                          <input
-                            disabled={!canEdit}
-                            type="text"
-                            value={risco.medida_preventiva}
-                            onChange={(e) => updateRisco(setor.id, risco.id, { medida_preventiva: e.target.value })}
-                            placeholder="Medida preventiva"
-                            className="rounded border border-gray-200 bg-white px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none disabled:bg-gray-50"
-                          />
-                          {canEdit && (
-                            <button
-                              type="button"
-                              onClick={() => removeRisco(setor.id, risco.id)}
-                              className="rounded p-1 text-gray-400 hover:text-red-500"
-                            >
-                              <Trash2 className="size-3.5" />
-                            </button>
-                          )}
-                        </div>
-                      ))}
-                    </div>
-                  )}
-                </section>
-
                 {/* ── Indicador AET ─────────────────────────────────── */}
                 {setor.necessita_aet && (
                   <div className="flex items-start gap-2 rounded-xl border border-orange-200 bg-orange-50 p-3">
```

## Passo 3: verificar

1. `npx tsc --noEmit -p .` e `npm test` sem erros. O `eslint` do arquivo não deve
   acusar import sem uso.
2. Abra uma AEP em Setores / Triagem:
   - a seção "Matriz de Riscos" não aparece mais;
   - depois da triagem vem o aviso de AET (se houver) e o Parecer /
     Recomendações.
3. Gere o laudo/PDF de uma AEP:
   - sem riscos gravados, nenhuma tabela de riscos;
   - com riscos antigos (se houver), a tabela continua.
4. Publique pelo fluxo de release do painel (versão, changelog, "Novidades").
