# Replicar no Painel SST: AEP/AET da inspeção — excluir e já nascer no módulo

> **Como usar:** abra o Claude Code na pasta do **painel-sst** e diga:
> *"Siga o arquivo `replicar-no-painel-excluir-ergo-inspecao.md`"*.
>
> Origem: JCN (`sst-jcn`), commits `9ea9657` (Excluir) e `4c9c4e2` (já nasce no módulo) de 2026-10-05, já em produção lá.
> **Sem migration** (só um `update` opcional de dados, no Passo 2).

## O problema

A AEP/AET preenchida dentro da inspeção (v259) só aparece na lista do módulo
depois de "Enviar para o módulo" (`enviado_modulo_em`). Antes disso, o único
lugar onde ela aparece é a aba da inspeção — que não tinha como excluí-la.
Um rascunho esquecido ali ficava impossível de apagar pela tela (e ainda
contava como "em andamento" no Comercial).

## O que faz

### 1. Botão "Excluir"

- Na faixa do topo da aba **AEP**/**AET** da inspeção, ao lado de "Laudo /
  Imprimir" e "Enviar para o módulo", entra o botão vermelho **"Excluir"**.
- Só aparece para quem edita (`!readOnly`) e pede confirmação; o texto avisa
  quando o laudo já foi enviado (sai do módulo também, é o mesmo registro).
- Exclui com `excluirComLixeiraPorId` (vai para a **Lixeira**, restaurável),
  igual a `useExcluirAet`/`useExcluirAep` do módulo.
- Invalida `["ergo-inspecao", tipo, idInspecao]`, `[tipo-relatorios]`,
  `[home-stats-tipo]` e `["comercial-dados"]`; a aba volta a oferecer
  "Iniciar AEP/AET desta inspeção".

### 2. Já nasce cadastrada no módulo

- Ao clicar em **"Iniciar AEP/AET desta inspeção"**, o laudo é criado com
  `enviado_modulo_em` preenchido: aparece **na hora** na lista do módulo
  AEP/AET (e nas contagens), sem precisar de "Enviar para o módulo".
- O botão "Enviar para o módulo" continua no código só para laudo **antigo**
  que ficou com `enviado_modulo_em` nulo.
- O texto da tela vazia passa a dizer que a AEP/AET "já fica cadastrada no
  módulo — é o mesmo laudo nos dois lugares".
- **Sinalização e Comercial não mudam:** a AEP continua só entrando na
  Sinalização quando entregue ao cliente, e no Comercial quando liberada.

## Passo 1: conferir o painel

| Usado | Conferir no painel |
|---|---|
| `lib/hooks/useErgonomiaInspecao.ts` com `tabela()`, `ROTULO_ERGO` e query `["ergo-inspecao", tipo, idInspecao]` | mesmos nomes (v259) |
| `excluirComLixeiraPorId` em `lib/hooks/useLixeira.ts` | mesma assinatura (`tabela`, `chave`, `id`, `modulo`) |
| `components/inspecoes/editor/tabs/ErgonomiaTab.tsx` com `confirmar`/`ConfirmHost` | o botão entra depois de "Enviar para o módulo" |
| `["comercial-dados"]` | só se o painel já tiver o módulo Comercial; senão, tire essa linha |

## Passo 2: laudos antigos (opcional, banco do painel)

Para cadastrar no módulo os laudos que hoje estão "Só nesta inspeção", confira
primeiro e depois rode **no banco do painel** (nunca no do JCN):

```sql
select 'aep' t, id_relatorio, id_empresa, id_inspecao, status from aep_relatorios where id_inspecao is not null and enviado_modulo_em is null
union all select 'aet', id_relatorio, id_empresa, id_inspecao, status from aet_relatorios where id_inspecao is not null and enviado_modulo_em is null;

update aep_relatorios set enviado_modulo_em = now() where id_inspecao is not null and enviado_modulo_em is null;
update aet_relatorios set enviado_modulo_em = now() where id_inspecao is not null and enviado_modulo_em is null;
```

Anote os `id_relatorio` antes; para desfazer, volte `enviado_modulo_em` a `null` só neles.

## Passo 3: código

Aplique primeiro A e B (Excluir) e depois C e D (já nasce no módulo).

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

### C: diff de `lib/hooks/useErgonomiaInspecao.ts` (já nasce no módulo)

```diff
@@ -4,9 +4,10 @@
 //
 // O laudo nasce na tabela do próprio módulo (aep_relatorios / aet_relatorios)
 // com `id_inspecao`, e as abas da inspeção usam os MESMOS editores do módulo.
-// Enquanto `enviado_modulo_em` for NULL, o laudo só aparece na inspeção; o
-// botão "Enviar para o módulo" o libera nas listas do AEP/AET. É o mesmo
-// registro dos dois lados — editar em um reflete no outro na hora.
+// Desde 2026-10-05 o laudo já nasce com `enviado_modulo_em` preenchido, ou
+// seja, cadastrado na lista do módulo AEP/AET. Laudo antigo com NULL só
+// aparece na inspeção até "Enviar para o módulo". É o mesmo registro dos dois
+// lados — editar em um reflete no outro na hora.
 
 import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
 import toast from "react-hot-toast";
@@ -120,6 +121,8 @@ export function useIniciarLaudoErgo(tipo: TipoErgo) {
         status: "RASCUNHO",
         setores: setoresIniciais(tipo, args.setores, args.cargos, args.maquinas),
         usuario: auth?.user?.id ?? null,
+        // Já cadastrada no módulo (2026-10-05): aparece na lista do AEP/AET.
+        enviado_modulo_em: new Date().toISOString(),
       };
       if (tipo === "aet") linha.consideracoes_finais = "";
       const { data, error } = await sb.from(tabela(tipo)).insert(linha).select("id_relatorio").single();
@@ -133,7 +136,10 @@ export function useIniciarLaudoErgo(tipo: TipoErgo) {
     },
     onSuccess: (_d, args) => {
       qc.invalidateQueries({ queryKey: ["ergo-inspecao", tipo, args.idInspecao] });
-      toast.success(`${ROTULO_ERGO[tipo]} iniciada com os setores e cargos da inspeção`);
+      qc.invalidateQueries({ queryKey: [`${tipo}-relatorios`] });
+      qc.invalidateQueries({ queryKey: [`home-stats-${tipo}`] });
+      qc.invalidateQueries({ queryKey: ["comercial-dados"] });
+      toast.success(`${ROTULO_ERGO[tipo]} iniciada com os setores e cargos da inspeção e já cadastrada no módulo ${ROTULO_ERGO[tipo]}`);
     },
     onError: (e: Error) => toast.error(e.message || `Falha ao iniciar a ${ROTULO_ERGO[tipo]}`),
   });
```

### D: diff de `components/inspecoes/editor/tabs/ErgonomiaTab.tsx` (já nasce no módulo)

```diff
@@ -1,8 +1,9 @@
 "use client";
 
 // Abas AEP e AET da inspeção (v259). O conteúdo é o editor do próprio módulo
-// — mesmo laudo, mesmas telas — e o botão "Enviar para o módulo" o libera nas
-// listas do AEP/AET; "Excluir" manda o laudo para a Lixeira. Ver `lib/hooks/useErgonomiaInspecao.ts`.
+// — mesmo laudo, mesmas telas. Ao iniciar, o laudo já fica cadastrado no
+// módulo AEP/AET (2026-10-05); "Enviar para o módulo" só aparece para laudo
+// antigo que ficou só na inspeção. "Excluir" manda o laudo para a Lixeira. Ver `lib/hooks/useErgonomiaInspecao.ts`.
 
 import { useState } from "react";
 import Link from "next/link";
@@ -76,8 +77,8 @@ export default function ErgonomiaTab({ tipo, idInspecao, idEmpresa, empresa, set
         <p className="mt-1 text-sm text-gray-500">
           Preencha a {rotulo} completa aqui, durante a inspeção. Ela já começa com{" "}
           <strong>{setores.length} setor{setores.length !== 1 ? "es" : ""}</strong> e{" "}
-          <strong>{cargos.length} cargo{cargos.length !== 1 ? "s" : ""}</strong> desta inspeção. Quando terminar,
-          use &quot;Enviar para o módulo {rotulo}&quot; para ela aparecer no módulo.
+          <strong>{cargos.length} cargo{cargos.length !== 1 ? "s" : ""}</strong> desta inspeção e já fica cadastrada
+          no módulo {rotulo} — é o mesmo laudo nos dois lugares.
         </p>
         {readOnly ? (
           <p className="mt-4 text-xs text-gray-400">Seu perfil não pode iniciar a {rotulo}.</p>
@@ -159,7 +160,7 @@ export default function ErgonomiaTab({ tipo, idInspecao, idEmpresa, empresa, set
                 const ok = await confirmar({
                   title: `Excluir a ${rotulo} desta inspeção?`,
                   description: enviado
-                    ? `A ${rotulo} sai desta inspeção e também do módulo ${rotulo} (é o mesmo laudo). Ela vai para a Lixeira e pode ser restaurada.`
+                    ? `A ${rotulo} sai desta inspeção e também do módulo ${rotulo} (é o mesmo laudo). Ela vai para a Lixeira e pode ser restaurada; depois, a aba volta a oferecer "Iniciar ${rotulo}".`
                     : `A ${rotulo} vai para a Lixeira e pode ser restaurada. Depois, a aba volta a oferecer "Iniciar ${rotulo}".`,
                   confirmLabel: "Excluir",
                   variant: "danger",
```

## Passo 4: verificar

1. `npx tsc --noEmit -p .` e `npx next build` sem erros.
2. Numa inspeção com AET em rascunho (aba AET, selo "Só nesta inspeção"), clique em **Excluir** → confirme → toast "AET excluída — está na Lixeira"; a aba volta a "Iniciar AET desta inspeção".
3. Na **Lixeira**, o laudo aparece (módulo `aet`) e pode ser restaurado.
4. Com perfil só de leitura, o botão não aparece.
5. Repita na aba **AEP**.
6. Numa inspeção sem AET, clique em **"Iniciar AET desta inspeção"** → toast "…já cadastrada no módulo AET"; a faixa mostra "No módulo AET desde …" e a AET aparece na lista do módulo AET. Repita com a AEP.
7. Publique pelo fluxo de release do painel (versão, changelog, "Novidades").
