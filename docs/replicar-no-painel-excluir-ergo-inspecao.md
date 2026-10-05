# Replicar no Painel SST: excluir AEP/AET pela aba da inspeção

> **Como usar:** abra o Claude Code na pasta do **painel-sst** e diga:
> *"Siga o arquivo `replicar-no-painel-excluir-ergo-inspecao.md`"*.
>
> Origem: JCN (`sst-jcn`), commit `9ea9657` de 2026-10-05, já em produção lá.
> **Sem migration.**

## O problema

A AEP/AET preenchida dentro da inspeção (v259) só aparece na lista do módulo
depois de "Enviar para o módulo" (`enviado_modulo_em`). Antes disso, o único
lugar onde ela aparece é a aba da inspeção — que não tinha como excluí-la.
Um rascunho esquecido ali ficava impossível de apagar pela tela (e ainda
contava como "em andamento" no Comercial).

## O que faz

- Na faixa do topo da aba **AEP**/**AET** da inspeção, ao lado de "Laudo /
  Imprimir" e "Enviar para o módulo", entra o botão vermelho **"Excluir"**.
- Só aparece para quem edita (`!readOnly`) e pede confirmação; o texto avisa
  quando o laudo já foi enviado (sai do módulo também, é o mesmo registro).
- Exclui com `excluirComLixeiraPorId` (vai para a **Lixeira**, restaurável),
  igual a `useExcluirAet`/`useExcluirAep` do módulo.
- Invalida `["ergo-inspecao", tipo, idInspecao]`, `[tipo-relatorios]`,
  `[home-stats-tipo]` e `["comercial-dados"]`; a aba volta a oferecer
  "Iniciar AEP/AET desta inspeção".

## Passo 1: conferir o painel

| Usado | Conferir no painel |
|---|---|
| `lib/hooks/useErgonomiaInspecao.ts` com `tabela()`, `ROTULO_ERGO` e query `["ergo-inspecao", tipo, idInspecao]` | mesmos nomes (v259) |
| `excluirComLixeiraPorId` em `lib/hooks/useLixeira.ts` | mesma assinatura (`tabela`, `chave`, `id`, `modulo`) |
| `components/inspecoes/editor/tabs/ErgonomiaTab.tsx` com `confirmar`/`ConfirmHost` | o botão entra depois de "Enviar para o módulo" |
| `["comercial-dados"]` | só se o painel já tiver o módulo Comercial; senão, tire essa linha |

## Passo 2: código

### A: diff de `lib/hooks/useErgonomiaInspecao.ts`

```diff
@@ -16,6 +16,7 @@ import { setorVazioAep } from "@/lib/hooks/useAep";
 import { setorVazio as setorVazioAet } from "@/lib/hooks/useAet";
 import { montarEnderecoEmpresa } from "@/lib/textos-padrao/variaveis";
 import { gerarId } from "@/lib/utils";
+import { excluirComLixeiraPorId } from "@/lib/hooks/useLixeira";
 import type { Cargo, Empresa, InspecaoMaquina, Setor } from "@/lib/supabase/types";
 
 export type TipoErgo = "aep" | "aet";
@@ -342,3 +343,25 @@ export function useEnviarLaudoErgoModulo(tipo: TipoErgo) {
     onError: (e: Error) => toast.error(e.message || "Falha ao enviar para o módulo"),
   });
 }
+
+/**
+ * Exclui a AEP/AET da inspeção (vai para a Lixeira, como no módulo). Antes
+ * de enviada ela não aparece na lista do módulo, então o único lugar para
+ * apagá-la é a própria aba da inspeção (2026-10-05).
+ */
+export function useExcluirLaudoErgo(tipo: TipoErgo) {
+  const qc = useQueryClient();
+  return useMutation({
+    mutationFn: async (args: { idRelatorio: string; idInspecao: string }) => {
+      await excluirComLixeiraPorId({ tabela: tabela(tipo), chave: "id_relatorio", id: args.idRelatorio, modulo: tipo });
+    },
+    onSuccess: (_d, args) => {
+      qc.invalidateQueries({ queryKey: ["ergo-inspecao", tipo, args.idInspecao] });
+      qc.invalidateQueries({ queryKey: [`${tipo}-relatorios`] });
+      qc.invalidateQueries({ queryKey: [`home-stats-${tipo}`] });
+      qc.invalidateQueries({ queryKey: ["comercial-dados"] });
+      toast.success(`${ROTULO_ERGO[tipo]} excluída — está na Lixeira`);
+    },
+    onError: (e: Error) => toast.error(e.message || "Falha ao excluir"),
+  });
+}
```

### B: diff de `components/inspecoes/editor/tabs/ErgonomiaTab.tsx`

```diff
@@ -2,15 +2,16 @@
 
 // Abas AEP e AET da inspeção (v259). O conteúdo é o editor do próprio módulo
 // — mesmo laudo, mesmas telas — e o botão "Enviar para o módulo" o libera nas
-// listas do AEP/AET. Ver `lib/hooks/useErgonomiaInspecao.ts`.
+// listas do AEP/AET; "Excluir" manda o laudo para a Lixeira. Ver `lib/hooks/useErgonomiaInspecao.ts`.
 
 import { useState } from "react";
 import Link from "next/link";
-import { CheckCircle2, ExternalLink, Printer, Send, Sparkles } from "lucide-react";
+import { CheckCircle2, ExternalLink, Printer, Send, Sparkles, Trash2 } from "lucide-react";
 import {
   NOME_ERGO,
   ROTULO_ERGO,
   useEnviarLaudoErgoModulo,
+  useExcluirLaudoErgo,
   useIniciarLaudoErgo,
   useLaudoErgoDaInspecao,
   type TipoErgo,
@@ -57,6 +58,7 @@ export default function ErgonomiaTab({ tipo, idInspecao, idEmpresa, empresa, set
   const { data: laudo, isLoading } = useLaudoErgoDaInspecao(tipo, idInspecao);
   const iniciar = useIniciarLaudoErgo(tipo);
   const enviar = useEnviarLaudoErgoModulo(tipo);
+  const excluir = useExcluirLaudoErgo(tipo);
   const [sub, setSub] = useState(SUBABAS[tipo][0].key);
   const rotulo = ROTULO_ERGO[tipo];
 
@@ -149,6 +151,26 @@ export default function ErgonomiaTab({ tipo, idInspecao, idEmpresa, empresa, set
               </button>
             )
           )}
+          {!readOnly && (
+            <button
+              type="button"
+              disabled={excluir.isPending}
+              onClick={async () => {
+                const ok = await confirmar({
+                  title: `Excluir a ${rotulo} desta inspeção?`,
+                  description: enviado
+                    ? `A ${rotulo} sai desta inspeção e também do módulo ${rotulo} (é o mesmo laudo). Ela vai para a Lixeira e pode ser restaurada.`
+                    : `A ${rotulo} vai para a Lixeira e pode ser restaurada. Depois, a aba volta a oferecer "Iniciar ${rotulo}".`,
+                  confirmLabel: "Excluir",
+                  variant: "danger",
+                });
+                if (ok) excluir.mutate({ idRelatorio: laudo.id_relatorio, idInspecao });
+              }}
+              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
+            >
+              <Trash2 className="size-3.5" /> {excluir.isPending ? "Excluindo..." : "Excluir"}
+            </button>
+          )}
         </div>
       </div>
 
```

## Passo 3: verificar

1. `npx tsc --noEmit -p .` e `npx next build` sem erros.
2. Numa inspeção com AET em rascunho (aba AET, selo "Só nesta inspeção"), clique em **Excluir** → confirme → toast "AET excluída — está na Lixeira"; a aba volta a "Iniciar AET desta inspeção".
3. Na **Lixeira**, o laudo aparece (módulo `aet`) e pode ser restaurado.
4. Com perfil só de leitura, o botão não aparece.
5. Repita na aba **AEP**.
6. Publique pelo fluxo de release do painel (versão, changelog, "Novidades").
