# Replicar no Painel SST: AEP — botão "Liberar para o Comercial" aparece ao concluir

> **Como usar:** abra o Claude Code na pasta do **painel-sst** e diga:
> *"Siga o arquivo `replicar-no-painel-aep-liberar-comercial.md`"*.
>
> Origem: JCN (`sst-jcn`), commit `78d1ffa` (PR #92), de 2026-10-07, já em produção lá.
> **Sem migration. Sem edge function.** Só front-end, 2 arquivos.

## O problema

Uma AEP **sem inspeção** marcada como **Concluída** em Dados / Conclusão não
chegava às Oportunidades do Comercial.

A regra continua a mesma (v270): a AEP só entra no Comercial depois de
**entregue** e **liberada** pelo botão **"Liberar para o Comercial"**, que fica na
faixa do topo do editor (Setores / Triagem).

O que falhava era a faixa. A query dela (`aep-situacao-sinalizacao`) usava o
cache global de 5 minutos e não era invalidada quando o status era salvo. Depois
de concluir, a faixa continuava dizendo "aparece quando for marcada como
Concluída" e **não mostrava o botão de liberar**.

## O que muda

1. A query da faixa passa a usar `staleTime: 0`.
2. `useSalvarAep` invalida `["aep-situacao-sinalizacao", id]` ao salvar.
3. O texto da AEP sem inspeção lembra de liberar para o Comercial depois de
   concluir.

## Passo 1: conferir o painel

| Usado | Conferir |
|---|---|
| `useSituacaoSinalizacaoAep` e `useSalvarAep` em `lib/hooks/useAep.ts` | mesmos nomes; a queryKey da faixa é `["aep-situacao-sinalizacao", idRelatorio]` |
| `components/aep/SituacaoSinalizacaoAep.tsx` com `LiberacaoComercial` (v270) | a liberação para o Comercial já existe no painel |
| `staleTime` global em `lib/providers.tsx` | se for maior que 0, o problema existe lá também |

Se o painel ainda não tem a liberação para o Comercial (v270), replique-a
antes. Sem ela, este ajuste não se aplica.

## Passo 2: código

### `lib/hooks/useAep.ts`

```diff
@@ export function useSituacaoSinalizacaoAep(idRelatorio: string) {
   return useQuery({
     queryKey: ["aep-situacao-sinalizacao", idRelatorio],
     enabled: !!idRelatorio,
+    // Sem o cache de 5 min global: depende do status, que muda em outra tela.
+    staleTime: 0,
     queryFn: async () => {
@@ export function useSalvarAep() {
       qc.invalidateQueries({ queryKey: ["aep-relatorio", id] });
       qc.invalidateQueries({ queryKey: ["aep-relatorios"] });
+      // Status mudou (ex.: Concluído) → a faixa da Sinalização/Comercial
+      // precisa mostrar "Liberar para o Comercial" na hora.
+      qc.invalidateQueries({ queryKey: ["aep-situacao-sinalizacao", id] });
       toast.success("Salvo com sucesso!");
```

### `components/aep/SituacaoSinalizacaoAep.tsx`

```diff
           <>
             AEP sem inspeção. Aparece na <strong>Sinalização Psicossocial</strong> quando for marcada como{" "}
-            <strong>Concluída</strong> (enviada ao cliente) em Dados / Conclusão.
+            <strong>Concluída</strong> (enviada ao cliente) em Dados / Conclusão. Depois de concluída, use{" "}
+            <strong>Liberar para o Comercial</strong> aqui para ela entrar nas Oportunidades.
           </>,
```

## Passo 3: verificar

1. `npx tsc --noEmit -p .` sem erros.
2. Numa AEP **sem inspeção**, em rascunho ou em andamento:
   - abra Setores / Triagem;
   - a faixa amarela lembra de liberar para o Comercial.
3. Faça a conclusão:
   - vá a **Dados / Conclusão**, marque **Concluído** e salve;
   - volte a Setores / Triagem **sem recarregar a página**;
   - a faixa fica verde, com a linha **Comercial** e o botão
     **"Liberar para o Comercial"**.
4. Clique em liberar e abra o módulo Comercial:
   - a empresa aparece com a **AET** (se algum setor tem "Necessita AET");
   - aparece também o **DRPS/Questionário** (se houver fatores organizacionais).
5. Publique pelo fluxo de release do painel (versão, changelog, "Novidades").
