# Replicar no Painel SST: exclusão da AEP e AEP fora dos produtos do Comercial

> **Como usar:** abra o Claude Code na pasta do **painel-sst** e diga:
> *"Siga o arquivo `replicar-no-painel-aep-exclusao-e-comercial.md`"*.
>
> Origem: JCN (`sst-jcn`), commits `5d17796` (exclusão, v271) e `9fd95d5` (Comercial) de 2026-10-05, já em produção lá.
> **Tem 1 migration** (v271, Passo 2) — rode só se o painel tiver o mesmo defeito (Passo 1).

## O que faz

### 1. Excluir AEP não apagava (v271 + Lixeira)

- **Sintoma:** clicar em excluir uma AEP mostrava "AEP excluída", mas o card
  continuava na lista; cada tentativa deixava uma cópia "fantasma" na Lixeira.
- **Causa:** as policies `admin pode excluir aep_relatorios` (DELETE) e
  `admin pode gerir aep_textos_padrao` (ALL) comparavam
  `usuarios.id_usuario` (ex.: `USR_ADMIN_001`) com `auth.uid()` (UUID) —
  nunca batia. O DELETE apagava 0 linhas **sem erro**.
- **Correção no banco:** as duas policies passam a usar `caller_eh_admin()`.
- **Correção no código (vale para todas as exclusões):** `excluirComLixeira`
  faz o DELETE com `.select()`; se nenhuma linha foi apagada **e o registro
  ainda existe**, desfaz o snapshot e mostra "Sem permissão para excluir este
  registro (nada foi apagado)". Se a tabela não deixar ler o registro, conta
  como apagado (para não perder a cópia de recuperação).

### 2. AEP não é produto do Comercial

- A AEP só **indica** serviços (AET, DRPS/Questionário).
- O risco ergonômico da inspeção **não** gera mais oportunidade "AEP", e o
  filtro **Produto** não lista AEP.

## Passo 1: conferir o painel

Rode no **banco do painel** (nunca no do JCN):

```sql
-- policies com a comparação quebrada
select c.relname, p.polname, pg_get_expr(p.polqual, p.polrelid)
  from pg_policy p join pg_class c on c.oid = p.polrelid
 where pg_get_expr(p.polqual, p.polrelid) ilike '%id_usuario = (auth.uid())%';
-- função usada na correção
select proname from pg_proc where proname = 'caller_eh_admin';
-- fantasmas: snapshot na Lixeira de AEP que continua viva
select r.id, r.registro_id, r.excluido_em from registros_excluidos r
 where r.tabela = 'aep_relatorios'
   and exists (select 1 from aep_relatorios a where a.id_relatorio::text = r.registro_id);
```

| Resultado | O que fazer |
|---|---|
| A 1ª consulta lista `aep_relatorios` / `aep_textos_padrao` | rode o Passo 2 |
| Lista **outras** tabelas | corrija do mesmo jeito (`using (public.caller_eh_admin())`) |
| `caller_eh_admin` não existe | use a função de "é admin" do painel (que compara o **e-mail** do JWT com `usuarios.email`) |
| A 3ª consulta lista fantasmas | o Passo 2 apaga esses snapshots |
| Nada listado | pule o Passo 2; aplique só o código |

## Passo 2: migration v271 (banco do painel)

```sql
drop policy if exists "admin pode excluir aep_relatorios" on public.aep_relatorios;
create policy "admin pode excluir aep_relatorios" on public.aep_relatorios
  for delete to authenticated using (public.caller_eh_admin());

drop policy if exists "admin pode gerir aep_textos_padrao" on public.aep_textos_padrao;
create policy "admin pode gerir aep_textos_padrao" on public.aep_textos_padrao
  for all to authenticated using (public.caller_eh_admin()) with check (public.caller_eh_admin());

-- Snapshots fantasmas (o registro continua vivo). No JCN era só um id;
-- aqui, genérico:
delete from public.registros_excluidos r
 where r.tabela = 'aep_relatorios'
   and exists (select 1 from public.aep_relatorios a where a.id_relatorio::text = r.registro_id);
```

Rollback (volta as policies antigas, que não funcionavam):

```sql
-- Rollback da v271 (volta as policies antigas, que não funcionavam).
drop policy if exists "admin pode excluir aep_relatorios" on public.aep_relatorios;
create policy "admin pode excluir aep_relatorios" on public.aep_relatorios for delete
  using (exists (select 1 from public.usuarios where usuarios.id_usuario = (auth.uid())::text and usuarios.perfil = 'Admin'));
drop policy if exists "admin pode gerir aep_textos_padrao" on public.aep_textos_padrao;
create policy "admin pode gerir aep_textos_padrao" on public.aep_textos_padrao for all
  using (exists (select 1 from public.usuarios where usuarios.id_usuario = (auth.uid())::text and usuarios.perfil = 'Admin'));
```

## Passo 3: código

| Seção | Arquivo | O quê |
|---|---|---|
| A | `lib/hooks/useLixeira.ts` | DELETE que não apagou nada vira erro |
| B | `lib/comercial/oportunidades.ts` | AEP sai de `Produto`, `PRODUTOS`, `NOME_PRODUTO` e da inspeção |
| C | `lib/comercial/oportunidades.test.ts` | testes ajustados |
| D | `app/(comercial)/comercial/page.tsx` | textos sem AEP como produto |

Se o painel ainda não tiver o módulo Comercial, aplique só A.

### A: diff de `lib/hooks/useLixeira.ts`

```diff
@@ -102,7 +102,21 @@ export async function excluirComLixeira(args: ExcluirComLixeiraArgs): Promise<vo
     .single();
   if (snapErr) throw snapErr;
 
-  const { error: delErr } = await supabase.from(args.tabela).delete().eq(args.chave, args.id);
+  // `.select()` devolve as linhas apagadas: RLS que barra o DELETE não dá
+  // erro, só apaga 0 linhas — e a tela dizia "excluída" sem apagar nada,
+  // deixando um snapshot fantasma na Lixeira (AEP, 2026-10-05, v271).
+  const { data: apagadas, error: delErr0 } = await supabase
+    .from(args.tabela)
+    .delete()
+    .eq(args.chave, args.id)
+    .select(args.chave);
+  let delErr: Error | null = delErr0;
+  if (!delErr && (apagadas ?? []).length === 0) {
+    // Só acusa se o registro continua lá (tabela sem SELECT devolveria 0 mesmo
+    // apagando — aí desfazer o snapshot perderia a cópia de recuperação).
+    const { data: ainda } = await supabase.from(args.tabela).select(args.chave).eq(args.chave, args.id).maybeSingle();
+    if (ainda) delErr = new Error("Sem permissão para excluir este registro (nada foi apagado). Fale com um administrador.");
+  }
   if (delErr) {
     const idSnapshot = (snap as { id?: string } | null)?.id;
     if (idSnapshot) {
```

### B: diff de `lib/comercial/oportunidades.ts`

```diff
@@ -39,14 +39,13 @@ export type Produto =
   | "Apreciação NR-12"
   | "Medição quantitativa"
   | "Análise de Químicos"
-  | "AEP"
   | "Treinamentos NR";
 export type Origem = "AEP" | "Inspeção";
 
-/** Ordem de exibição dos produtos. */
+/** Ordem de exibição dos produtos. A AEP não é produto do Comercial (2026-10-05):
+ * ela só INDICA serviços (AET, DRPS/Questionário). */
 export const PRODUTOS: Produto[] = [
   "AET",
-  "AEP",
   "DRPS/Questionário",
   "Apreciação NR-12",
   "Medição quantitativa",
@@ -56,7 +55,6 @@ export const PRODUTOS: Produto[] = [
 
 export const NOME_PRODUTO: Record<Produto, string> = {
   AET: "AET – Análise Ergonômica do Trabalho",
-  AEP: "AEP – Análise Ergonômica Preliminar",
   "DRPS/Questionário": "DRPS / Questionário Psicossocial",
   "Apreciação NR-12": "Apreciação de Máquinas (NR-12)",
   "Medição quantitativa": "Avaliação quantitativa (medição)",
@@ -360,10 +358,6 @@ export function montarComercial(
         const r = avaliar(["QUIMICOS"], [dataInsp]);
         add("Análise de Químicos", r.situacao, "Inspeção", [...insp.quimicos, ...r.nota]);
       }
-      if (insp.ergonomicos > 0) {
-        const r = avaliar(["AEP"], [dataInsp]);
-        add("AEP", r.situacao, "Inspeção", [`${insp.ergonomicos} risco(s) ergonômico(s) na inspeção`, ...r.nota]);
-      }
       if (insp.psicossociais > 0) {
         add("DRPS/Questionário", quest.situacao, "Inspeção", [
           `${insp.psicossociais} risco(s) psicossocial(is) na inspeção`,
```

### C: diff de `lib/comercial/oportunidades.test.ts`

```diff
@@ -79,7 +79,7 @@ test("AEP: AET só pela ergonomia física entra; sem indicação não entra", ()
   assert.equal(r[0].expostosAet, 5);
 });
 
-test("Inspeção: NR-12, medição, químicos, AEP, psicossocial e treinamentos", () => {
+test("Inspeção: NR-12, medição, químicos, psicossocial e treinamentos (AEP não é produto)", () => {
   const [c] = montarComercial(
     [],
     [
@@ -99,16 +99,15 @@ test("Inspeção: NR-12, medição, químicos, AEP, psicossocial e treinamentos"
     [{ id_empresa: "E1", nr: "NR 6" }],
   );
   assert.deepEqual(produtos(c), [
-    ["AEP", "aberta"],
     ["DRPS/Questionário", "aberta"],
     ["Apreciação NR-12", "andamento"],
     ["Medição quantitativa", "aberta"],
     ["Análise de Químicos", "realizada"],
     ["Treinamentos NR", "andamento"],
   ]);
-  assert.deepEqual(c.oportunidades[2].detalhes, ["Serra (grau alto) · necessita adequação"]);
-  assert.deepEqual(c.oportunidades[3].detalhes, ["Dosimetria · Produção"]);
-  assert.match(c.oportunidades[5].detalhes[0], /certificado emitido/);
+  assert.deepEqual(c.oportunidades[1].detalhes, ["Serra (grau alto) · necessita adequação"]);
+  assert.deepEqual(c.oportunidades[2].detalhes, ["Dosimetria · Produção"]);
+  assert.match(c.oportunidades[4].detalhes[0], /certificado emitido/);
   assert.equal(c.inspecao?.idInspecao, "INS-E1");
   assert.equal(c.temAep, false);
 });
@@ -156,7 +155,7 @@ test("DRPS concluído antes da AEP vira revisão recomendada; depois, realizada"
   assert.match(drps?.detalhes.join(" ") ?? "", /DRPS concluído em 30\/06\/2026, antes da indicação de 05\/10\/2026/);
 });
 
-test("revisão também para AET, AEP, Apreciação NR-12 e Químicos concluídos antes da indicação", () => {
+test("revisão também para AET, Apreciação NR-12 e Químicos concluídos antes da indicação", () => {
   const [c] = montarComercial(
     [aep("A1", "E1", [setorSoFisico])],
     [
@@ -170,7 +169,7 @@ test("revisão também para AET, AEP, Apreciação NR-12 e Químicos concluídos
   const s = Object.fromEntries(c.oportunidades.map((o) => [o.produto, o.situacao]));
   assert.equal(s["AET"], "revisao");
   assert.equal(s["Apreciação NR-12"], "revisao");
-  assert.equal(s["AEP"], "revisao");
+  assert.equal(s["AEP"], undefined);
   assert.equal(s["Análise de Químicos"], "realizada");
   const nr12 = c.oportunidades.find((o) => o.produto === "Apreciação NR-12");
   assert.match(nr12?.detalhes.join(" ") ?? "", /Apreciação de Máquinas concluído em 01\/02\/2026, antes da indicação de 03\/10\/2026/);
```

### D: diff de `app/(comercial)/comercial/page.tsx`

```diff
@@ -2,7 +2,7 @@
 
 // Comercial › Oportunidades (2026-10-05). Para quem vende: cada empresa com
 // serviços indicados pela AEP entregue (AET, DRPS/Questionário) ou pela última
-// inspeção concluída (Apreciação NR-12, medição, químicos, AEP, DRPS,
+// inspeção concluída (Apreciação NR-12, medição, químicos, DRPS,
 // treinamentos), com a situação (aberta / em andamento / realizada), o que
 // justifica cada uma e o contato da empresa. Regra em lib/comercial/oportunidades.ts.
 
@@ -143,7 +143,7 @@ export default function ComercialPage() {
             Só entram inspeções e AEPs <strong>liberadas para o Comercial</strong> pela equipe. Serviços que a JCN já
             identificou no cliente e que a empresa ainda não contratou: pela{" "}
             <strong>AEP entregue</strong> (AET e DRPS/Questionário) e pela <strong>última inspeção concluída</strong>{" "}
-            (Apreciação NR-12, medição quantitativa, Análise de Químicos, AEP, DRPS/Questionário e treinamentos NR).
+            (Apreciação NR-12, medição quantitativa, Análise de Químicos, DRPS/Questionário e treinamentos NR).
           </p>
         </div>
         <button
```

## Passo 4: verificar

1. `npm test`, `npx tsc --noEmit -p .` e `npx next build` sem erros.
2. Como **Admin**, exclua uma AEP de teste no módulo AEP: o card some e ela aparece **uma vez** na Lixeira; restaurar funciona.
3. Como **não Admin**, tente excluir uma AEP: aparece "Sem permissão para excluir este registro (nada foi apagado)…" e nada vai para a Lixeira.
4. Comercial: o filtro **Produto** não tem AEP; uma inspeção com risco ergonômico não gera card "AEP". AET e DRPS continuam "Indicada por: AEP".
5. Publique pelo fluxo de release do painel (versão, changelog, "Novidades").
