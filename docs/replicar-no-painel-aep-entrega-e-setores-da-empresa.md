# Replicar no Painel SST: AEP entregue na Sinalização, inspeção no editor e setores/cargos da empresa

> **Como usar:** abra o Claude Code na pasta do **painel-sst** e diga:
> *"Siga o arquivo `replicar-no-painel-aep-entrega-e-setores-da-empresa.md`"*.
>
> Origem: JCN (`sst-jcn`), commits de 2026-10-05 posteriores ao `5801ced`, já em produção lá.
> **Tem 1 migration** (v265, Passo 2). O código está nas seções A a O.

## Pré-requisitos

Aplique antes, se o painel ainda não tiver:

1. `replicar-no-painel-aep-matriz-aiha.md`: a regra AIHA e a Sinalização por empresa.
2. `replicar-no-painel-aep-menu-painel-sst.md`: os componentes `SinalizacaoEmpresasLista` / `SinalizacaoEmpresaDetalhe`.
3. `replicar-no-painel-explicacao-matriz-aiha.md`: o componente `ExplicacaoMatrizAiha`.
4. `replicar-no-painel-aep-registrar-em-inspecao.md`: `useCriarAepNoModulo` e o campo **Registrar em inspeção** da Nova Análise.

## O que faz

### 1. Sinalização só com AEP entregue ao cliente

A Sinalização Psicossocial (módulo AEP) e a página **AEP** do Painel SST só
mostram AEPs **entregues ao cliente**, pelo hook novo `useAepsEntregues`:

| AEP | Entra na Sinalização quando | Data mostrada |
|---|---|---|
| **Com inspeção** | o documento da inspeção foi **concluído pelo associado** (`inspecoes.elaboracao_status = 'CONCLUIDO'`, inspeção não deletada). O status da AEP não conta. | `inspecoes.elaboracao_concluida_em` |
| **Sem inspeção** | a própria AEP está **Concluída** (= enviada ao cliente) em Dados / Conclusão | `aep_relatorios.concluido_em` (v265) |

Documento reaberto, ou AEP de volta a rascunho, sai da Sinalização. A lista
mostra "Entregue dd/mm/aaaa", e a página da empresa mostra "Entregue ao
cliente em … · INS-…".

### 2. Faixa de situação e troca de inspeção no editor

No topo de **Setores / Triagem** (também na aba AEP da inspeção) entra a faixa
`SituacaoSinalizacaoAep`:

- 🟡 sem inspeção e não concluída;
- 🔵 aguardando o documento da inspeção;
- 🟢 "Na Sinalização Psicossocial desde …".

O botão **Registrar em inspeção / Alterar inspeção** (`useAlterarInspecaoAep`)
oferece três opções:

- **Inspeção realizada:** as inspeções que já têm outra AEP ficam desabilitadas.
- **Criar nova inspeção:** inspeção em branco, próxima revisão.
- **Sem inspeção.**

Trocar a inspeção não mexe nos setores da AEP. Em **Dados / Conclusão**, um
texto explica que "Concluído = enviado ao cliente". Na Nova Análise AEP as 3
opções ficam disponíveis: inspeção realizada, nova inspeção ou sem inspeção.

### 3. Setores e cargos que a empresa já tem

O editor carrega o catálogo de setores e cargos das inspeções **não deletadas**
da empresa (`useCatalogoSetoresEmpresa` + `lib/aep/catalogo-setores.ts`). Nomes
iguais, sem diferenciar maiúscula, acento e espaço, viram um só, e os cargos
de cada setor são somados.

- O campo **Setor** sugere esses nomes (datalist). Digitar à mão continua valendo.
- O bloco **Cargos do setor** mostra os cargos cadastrados para aquele setor,
  para adicionar um a um ou com "Adicionar todos". O "+ Cargo" manual continua.
- O botão **Setores da empresa (N)** no cabeçalho adiciona de uma vez os
  setores que faltam, com descrição e cargos. Depois é só salvar.

### 4. Matriz AIHA no menu do módulo Sinalização Psicossocial

O menu do módulo ganha o item **Matriz AIHA** (`/sinalizacao-matriz-aiha`), com
a explicação sempre aberta. A rota fica fora de `/sinalizacao-psicossocial/`
para não acender o "Painel de Alertas" junto. O quadro sai de cima da lista
de empresas desse módulo; na página AEP do Painel SST ele continua.

## Passo 1: conferir o painel

| Usado pelo código | Conferir no painel |
|---|---|
| `aep_relatorios.id_inspecao` (FK para `inspecoes`) e `enviado_modulo_em` | vêm das abas AEP/AET na inspeção |
| `aep_relatorios.status` com CHECK `RASCUNHO`/`CONCLUIDO` | se o painel tiver outros status, ajuste o trigger da v265 |
| `inspecoes.elaboracao_status` (`CONCLUIDO`) e `elaboracao_concluida_em` (fluxo do documento / associados) | mesmos nomes; é o "Entregue" da lista de inspeções |
| `setores` e `cargos` com `id_empresa`, `id_inspecao` e FK para `inspecoes` (o `inspecoes!inner` depende dela) | mesmos nomes |
| `AepSetor` com `nome_setor`, `descricao_atividade`, `cargo`, `funcao`, `cargos` | mesmos campos |
| Layout do módulo Sinalização em `app/(sinalizacao-psicossocial)/layout.tsx` | se for outro arquivo, adicione o item lá |

## Passo 2: migration v265 (banco do painel)

Rode a seção **A** no **banco do painel**, nunca no do JCN. Ela adiciona
`aep_relatorios.concluido_em` e um trigger que grava a data ao passar para
`CONCLUIDO` e limpa ao voltar. As AEPs já concluídas recebem `updated_at`.

Rollback:

```sql
drop trigger if exists trg_aep_relatorios_concluido_em on public.aep_relatorios;
drop function if exists public.aep_relatorios_concluido_em();
alter table public.aep_relatorios drop column if exists concluido_em;
```

## Passo 3: código

| Seção | Arquivo | O quê |
|---|---|---|
| A | `supabase/historico/v265_aep_concluido_em.sql` | migration |
| B, C | `lib/aep/catalogo-setores.ts` + teste | **novo**: catálogo de setores/cargos |
| D | `lib/aep/sinalizacao.ts` | data da entrega e inspeção na avaliação |
| E | `lib/hooks/useAep.ts` | `useAepsEntregues`, `useSituacaoSinalizacaoAep`, `useCatalogoSetoresEmpresa` |
| F | `lib/hooks/useErgonomiaInspecao.ts` | `useAlterarInspecaoAep` |
| G | `components/aep/SituacaoSinalizacaoAep.tsx` | **novo**: faixa + troca de inspeção |
| H | `components/aep/AepSetoresEditor.tsx` | faixa, sugestões de setor/cargos, botão Setores da empresa |
| I | `components/aep/AepDadosEditor.tsx` | texto "Concluído = enviado ao cliente" |
| J, K | `SinalizacaoEmpresasLista.tsx`, `SinalizacaoEmpresaDetalhe.tsx` | usam `useAepsEntregues` e mostram a entrega |
| L | `app/(aep)/aep/novo/page.tsx` | 3 opções de inspeção |
| M, N, O | módulo Sinalização: layout, lista e página Matriz AIHA | menu |

Os diffs são contra o estado depois do MD
`replicar-no-painel-aep-registrar-em-inspecao.md`. Se o painel tiver
diferenças locais nesses arquivos, aplique a intenção de cada trecho.

### A: `supabase/historico/v265_aep_concluido_em.sql` (novo, completo)

```sql
-- v265 (2026-10-05): data em que a AEP foi concluída (= enviada ao cliente).
-- Usada pela Sinalização Psicossocial para AEP SEM inspeção. Preenchida por
-- trigger ao passar para CONCLUIDO; volta a NULL se a AEP voltar a rascunho.
-- Já aplicada via MCP. Rollback: scripts/sql/v265_rollback_aep_concluido_em.sql
alter table public.aep_relatorios add column if not exists concluido_em timestamptz;

update public.aep_relatorios set concluido_em = coalesce(updated_at, created_at)
 where status = 'CONCLUIDO' and concluido_em is null;

create or replace function public.aep_relatorios_concluido_em()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'CONCLUIDO' and (tg_op = 'INSERT' or old.status is distinct from 'CONCLUIDO') then
    new.concluido_em := now();
  elsif new.status <> 'CONCLUIDO' then
    new.concluido_em := null;
  end if;
  return new;
end $$;

drop trigger if exists trg_aep_relatorios_concluido_em on public.aep_relatorios;
create trigger trg_aep_relatorios_concluido_em
  before insert or update of status on public.aep_relatorios
  for each row execute function public.aep_relatorios_concluido_em();
```

### B: `lib/aep/catalogo-setores.ts` (novo, completo)

```ts
// Catálogo de setores e cargos que a empresa JÁ TEM no sistema (2026-10-05),
// para o editor da AEP sugerir: vem dos setores/cargos das inspeções da empresa
// (não deletadas). Nomes repetidos entre inspeções viram um só, sem diferenciar
// maiúsculas, acentos e espaços; os cargos de cada setor são somados.

export interface CargoCatalogo {
  cargo: string;
  descricao: string;
}

export interface SetorCatalogo {
  nome: string;
  descricao: string;
  cargos: CargoCatalogo[];
}

/** "  Produção  " e "PRODUCAO" viram a mesma chave. */
export function chaveNome(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function montarCatalogoSetores(
  setores: { id_setor: string; setor_ghe: string | null; descricao: string | null }[],
  cargos: { id_setor: string | null; cargo: string | null; descricao: string | null }[],
): SetorCatalogo[] {
  const nomePorId = new Map<string, string>();
  const porChave = new Map<string, SetorCatalogo & { _cargos: Map<string, CargoCatalogo> }>();

  for (const s of setores) {
    const nome = (s.setor_ghe ?? "").replace(/\s+/g, " ").trim();
    const k = chaveNome(nome);
    if (!k) continue;
    nomePorId.set(s.id_setor, k);
    const atual = porChave.get(k);
    if (!atual) {
      porChave.set(k, { nome, descricao: (s.descricao ?? "").trim(), cargos: [], _cargos: new Map() });
    } else if (!atual.descricao && s.descricao?.trim()) {
      atual.descricao = s.descricao.trim();
    }
  }

  for (const c of cargos) {
    const k = c.id_setor ? nomePorId.get(c.id_setor) : undefined;
    const alvo = k ? porChave.get(k) : undefined;
    const cargo = (c.cargo ?? "").replace(/\s+/g, " ").trim();
    if (!alvo || !cargo) continue;
    const kc = chaveNome(cargo);
    const ja = alvo._cargos.get(kc);
    if (!ja) alvo._cargos.set(kc, { cargo, descricao: (c.descricao ?? "").trim() });
    else if (!ja.descricao && c.descricao?.trim()) ja.descricao = c.descricao.trim();
  }

  return [...porChave.values()]
    .map(({ _cargos, ...s }) => ({
      ...s,
      cargos: [..._cargos.values()].sort((a, b) => a.cargo.localeCompare(b.cargo, "pt-BR")),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
```

### C: `lib/aep/catalogo-setores.test.ts` (novo, completo)

```ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { chaveNome, montarCatalogoSetores } from "./catalogo-setores";

test("nome igual com acento/maiúscula/espaço vira um setor só, com os cargos somados", () => {
  const cat = montarCatalogoSetores(
    [
      { id_setor: "S1", setor_ghe: "Produção", descricao: null },
      { id_setor: "S2", setor_ghe: "  PRODUCAO ", descricao: "Linha de montagem" },
      { id_setor: "S3", setor_ghe: "Administrativo", descricao: "Escritório" },
      { id_setor: "S4", setor_ghe: "", descricao: null },
    ],
    [
      { id_setor: "S1", cargo: "Operador", descricao: "" },
      { id_setor: "S2", cargo: "operador", descricao: "Opera a prensa" },
      { id_setor: "S2", cargo: "Líder", descricao: null },
      { id_setor: "S3", cargo: "Auxiliar", descricao: null },
      { id_setor: "S9", cargo: "Fantasma", descricao: null },
    ],
  );
  assert.deepEqual(cat.map((s) => s.nome), ["Administrativo", "Produção"]);
  const prod = cat[1];
  assert.equal(prod.descricao, "Linha de montagem");
  assert.deepEqual(prod.cargos, [
    { cargo: "Líder", descricao: "" },
    { cargo: "Operador", descricao: "Opera a prensa" },
  ]);
});

test("chaveNome", () => {
  assert.equal(chaveNome("  Produção   Geral "), "producao geral");
  assert.equal(chaveNome(null), "");
});
```

### D: diff de `lib/aep/sinalizacao.ts`

```diff
@@ -4,6 +4,10 @@
 // da empresa com cada AEP e, dentro dela, os SETORES com os fatores
 // organizacionais marcados "Sim" (nível na matriz AIHA, probabilidade,
 // severidade e sinais observados). Sem link para o editor da AEP, de propósito.
+//
+// 2026-10-05: só entram AEPs ENTREGUES ao cliente — registradas numa inspeção
+// cujo documento o associado concluiu (`useAepsEntregues`). A data mostrada é
+// a da entrega (`entregue_em`); sem ela, cai na data de elaboração.
 
 import { ITENS_ORGANIZACIONAL } from "@/lib/aep/checklist-itens";
 import { rotulosDosSinais } from "@/lib/aep/sinais-organizacional";
@@ -32,7 +36,9 @@ export interface SetorSinalizado {
 
 export interface AvaliacaoSinalizada {
   idRelatorio: string;
+  /** Data da entrega ao cliente; sem ela, a data de elaboração. */
   data: string | null;
+  idInspecao: string | null;
   responsavel: string | null;
   status: string;
   setores: SetorSinalizado[];
@@ -58,7 +64,10 @@ export function piorNivel(niveis: (string | null | undefined)[]): string | null
   return pior;
 }
 
-export function montarSinalizacao(relatorios: AepRelatorio[]): EmpresaSinalizada[] {
+/** AEP com a data em que o documento da inspeção foi entregue ao cliente. */
+export type AepEntregue = AepRelatorio & { entregue_em?: string | null };
+
+export function montarSinalizacao(relatorios: AepEntregue[]): EmpresaSinalizada[] {
   const porEmpresa = new Map<string, EmpresaSinalizada>();
 
   for (const rel of relatorios) {
@@ -108,7 +117,8 @@ export function montarSinalizacao(relatorios: AepRelatorio[]): EmpresaSinalizada
     }
     alvo.avaliacoes.push({
       idRelatorio: rel.id_relatorio,
-      data: rel.data_elaboracao,
+      data: rel.entregue_em ?? rel.data_elaboracao,
+      idInspecao: (rel as { id_inspecao?: string | null }).id_inspecao ?? null,
       responsavel: rel.responsavel_elaboracao || null,
       status: rel.status,
       setores,
```

### E: diff de `lib/hooks/useAep.ts`

```diff
@@ -1,5 +1,6 @@
 "use client";
 
+import { montarCatalogoSetores } from "@/lib/aep/catalogo-setores";
 import { contagemParaAet } from "@/lib/aep/aiha-organizacional";
 import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
 import toast from "react-hot-toast";
@@ -281,6 +282,138 @@ export function useAepRelatorios(empresaId?: string | null) {
   });
 }
 
+/**
+ * AEPs ENTREGUES ao cliente (2026-10-05) — as que vão para a Sinalização
+ * Psicossocial e para a página AEP do Painel SST:
+ *   • COM inspeção: o documento da inspeção foi concluído pelo associado
+ *     (`inspecoes.elaboracao_status = 'CONCLUIDO'`, o "Entregue" da lista de
+ *     inspeções); data = `elaboracao_concluida_em`. O status da AEP não conta.
+ *   • SEM inspeção: a própria AEP está Concluída (= enviada ao cliente);
+ *     data = `concluido_em` (v265).
+ * Documento reaberto / AEP de volta a rascunho sai da Sinalização.
+ */
+export function useAepsEntregues(empresaId?: string | null) {
+  const user = useUserStore((s) => s.user);
+  return useQuery({
+    queryKey: ["aep-entregues", empresaId ?? "todos"],
+    queryFn: async () => {
+      const supabase = createSupabaseBrowserClient();
+      let q = supabase
+        .from("aep_relatorios")
+        .select(
+          "*, empresas(nome_empresa, cnpj), inspecoes!inner(id_inspecao, status, elaboracao_status, elaboracao_concluida_em)"
+        )
+        .eq("inspecoes.elaboracao_status", "CONCLUIDO")
+        .neq("inspecoes.status", "DELETADA")
+        .neq("status", "DELETADO")
+        .order("created_at", { ascending: false });
+      if (empresaId) {
+        q = q.eq("id_empresa", empresaId);
+      } else if (user?.perfil === "Tecnico" && user.empresas_vinculadas?.length) {
+        q = q.in("id_empresa", user.empresas_vinculadas);
+      }
+      let q2 = supabase
+        .from("aep_relatorios")
+        .select("*, empresas(nome_empresa, cnpj)")
+        .is("id_inspecao", null)
+        .eq("status", "CONCLUIDO")
+        .order("created_at", { ascending: false });
+      if (empresaId) {
+        q2 = q2.eq("id_empresa", empresaId);
+      } else if (user?.perfil === "Tecnico" && user.empresas_vinculadas?.length) {
+        q2 = q2.in("id_empresa", user.empresas_vinculadas);
+      }
+      const [comInsp, semInsp] = await Promise.all([q, q2]);
+      if (comInsp.error) throw comInsp.error;
+      if (semInsp.error) throw semInsp.error;
+      return [
+        ...(comInsp.data ?? []).map((r) => {
+          const insp = (r as { inspecoes?: { elaboracao_concluida_em?: string | null } | null }).inspecoes;
+          return { ...normalizarRelatorio(r), entregue_em: insp?.elaboracao_concluida_em ?? null };
+        }),
+        ...(semInsp.data ?? []).map((r) => ({
+          ...normalizarRelatorio(r),
+          entregue_em: (r as { concluido_em?: string | null }).concluido_em ?? null,
+        })),
+      ];
+    },
+    enabled: !!user,
+  });
+}
+
+/**
+ * Em que pé a AEP está em relação à Sinalização Psicossocial — para a faixa
+ * do editor explicar por que ela aparece ou não.
+ */
+export function useSituacaoSinalizacaoAep(idRelatorio: string) {
+  return useQuery({
+    queryKey: ["aep-situacao-sinalizacao", idRelatorio],
+    enabled: !!idRelatorio,
+    queryFn: async () => {
+      const supabase = createSupabaseBrowserClient();
+      const { data, error } = await supabase
+        .from("aep_relatorios")
+        .select("id_empresa, id_inspecao, status, concluido_em, inspecoes(id_inspecao, status, elaboracao_status, elaboracao_concluida_em)")
+        .eq("id_relatorio", idRelatorio)
+        .maybeSingle();
+      if (error) throw error;
+      const r = data as {
+        id_empresa: string;
+        id_inspecao: string | null;
+        status: string;
+        concluido_em: string | null;
+        inspecoes: {
+          id_inspecao: string;
+          status: string;
+          elaboracao_status: string | null;
+          elaboracao_concluida_em: string | null;
+        } | null;
+      } | null;
+      return {
+        idEmpresa: r?.id_empresa ?? null,
+        idInspecao: r?.id_inspecao ?? null,
+        entregue: r?.id_inspecao
+          ? r?.inspecoes?.elaboracao_status === "CONCLUIDO" && r?.inspecoes?.status !== "DELETADA"
+          : r?.status === "CONCLUIDO",
+        entregueEm: r?.id_inspecao ? (r?.inspecoes?.elaboracao_concluida_em ?? null) : (r?.concluido_em ?? null),
+      };
+    },
+  });
+}
+
+/**
+ * Setores e cargos que a empresa já tem no sistema (das inspeções não
+ * deletadas), para o editor da AEP sugerir — ver `montarCatalogoSetores`.
+ */
+export function useCatalogoSetoresEmpresa(idEmpresa: string | null | undefined) {
+  return useQuery({
+    queryKey: ["catalogo-setores-empresa", idEmpresa],
+    enabled: !!idEmpresa,
+    staleTime: 5 * 60 * 1000,
+    queryFn: async () => {
+      const supabase = createSupabaseBrowserClient();
+      const [s, c] = await Promise.all([
+        supabase
+          .from("setores")
+          .select("id_setor, setor_ghe, descricao, inspecoes!inner(status)")
+          .eq("id_empresa", idEmpresa!)
+          .neq("inspecoes.status", "DELETADA"),
+        supabase
+          .from("cargos")
+          .select("id_setor, cargo, descricao, inspecoes!inner(status)")
+          .eq("id_empresa", idEmpresa!)
+          .neq("inspecoes.status", "DELETADA"),
+      ]);
+      if (s.error) throw s.error;
+      if (c.error) throw c.error;
+      return montarCatalogoSetores(
+        (s.data ?? []) as unknown as { id_setor: string; setor_ghe: string | null; descricao: string | null }[],
+        (c.data ?? []) as unknown as { id_setor: string | null; cargo: string | null; descricao: string | null }[],
+      );
+    },
+  });
+}
+
 const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 
 export function useAepRelatorio(id: string) {
```

### F: diff de `lib/hooks/useErgonomiaInspecao.ts`

```diff
@@ -241,6 +241,71 @@ export function useCriarAepNoModulo() {
   });
 }
 
+/**
+ * Troca a inspeção de uma AEP JÁ EXISTENTE (editor da AEP, 2026-10-05):
+ * registrar numa inspeção realizada, numa inspeção nova em branco, ou deixar
+ * sem inspeção. Os setores da AEP não mudam — ela já tem o próprio conteúdo.
+ */
+export function useAlterarInspecaoAep() {
+  const qc = useQueryClient();
+  const user = useUserStore((s) => s.user);
+  return useMutation({
+    mutationFn: async (args: {
+      idRelatorio: string;
+      idEmpresa: string;
+      vinculo: VinculoInspecao;
+      id_inspecao?: string | null;
+      revisao_nova?: number;
+    }) => {
+      const sb = db();
+      const agora = new Date().toISOString();
+      let idInspecao: string | null = null;
+      if (args.vinculo === "existente") {
+        if (!args.id_inspecao) throw new Error("Selecione a inspeção.");
+        idInspecao = args.id_inspecao;
+      } else if (args.vinculo === "nova") {
+        idInspecao = gerarId("INS");
+        const { error } = await sb.from("inspecoes").insert({
+          id_inspecao: idInspecao,
+          id_empresa: args.idEmpresa,
+          data_inspecao: agora.slice(0, 10),
+          status: "EM_ANDAMENTO",
+          revisao: args.revisao_nova ?? 1,
+          responsavel: user?.nome ?? null,
+          observacoes: "Criada a partir do módulo AEP.",
+          tipo_criacao: "BRANCO",
+          id_inspecao_base: null,
+          usuario: user?.email ?? null,
+          created_at: agora,
+          updated_at: agora,
+        });
+        if (error) throw error;
+      }
+      // Com inspeção: marca como enviada ao módulo (a AEP já está no módulo).
+      const patch: Record<string, unknown> = { id_inspecao: idInspecao, updated_at: agora };
+      if (idInspecao) patch.enviado_modulo_em = agora;
+      const { error } = await sb.from("aep_relatorios").update(patch).eq("id_relatorio", args.idRelatorio);
+      if (error) {
+        if (String(error.code) === "23505") throw new Error("Esta inspeção já tem uma AEP. Escolha outra inspeção.");
+        throw error;
+      }
+      return idInspecao;
+    },
+    onSuccess: (idInspecao, args) => {
+      qc.invalidateQueries({ queryKey: ["aep-situacao-sinalizacao", args.idRelatorio] });
+      qc.invalidateQueries({ queryKey: ["aep-relatorios"] });
+      qc.invalidateQueries({ queryKey: ["aep-entregues"] });
+      qc.invalidateQueries({ queryKey: ["inspecoes", args.idEmpresa] });
+      qc.invalidateQueries({ queryKey: ["aeps-com-inspecao", args.idEmpresa] });
+      qc.invalidateQueries({ queryKey: ["ergo-inspecao", "aep"] });
+      toast.success(
+        idInspecao ? `AEP registrada na inspeção ${idInspecao}` : "AEP desvinculada da inspeção"
+      );
+    },
+    onError: (e: Error) => toast.error(e.message || "Falha ao alterar a inspeção da AEP"),
+  });
+}
+
 /** Inspeções da empresa que já têm AEP (uma inspeção só pode ter uma). */
 export function useInspecoesComAep(idEmpresa: string | null) {
   return useQuery({
```

### G: `components/aep/SituacaoSinalizacaoAep.tsx` (novo, completo)

```tsx
"use client";

// Faixa do editor da AEP (2026-10-05): diz se a AEP já está na Sinalização
// Psicossocial e, se não, o que falta. Com inspeção, aparece quando o
// documento da inspeção é concluído pelo associado; sem inspeção, quando a
// própria AEP é marcada Concluída (= enviada ao cliente) em Dados / Conclusão.
// O botão "Alterar inspeção" registra a AEP numa inspeção realizada, numa
// inspeção nova em branco, ou a deixa sem inspeção.

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, Info, Link2 } from "lucide-react";
import { useSituacaoSinalizacaoAep } from "@/lib/hooks/useAep";
import { useInspecoesByEmpresa } from "@/lib/hooks/useInspecao";
import {
  useAlterarInspecaoAep,
  useInspecoesComAep,
  type VinculoInspecao,
} from "@/lib/hooks/useErgonomiaInspecao";
import { cn, fmtData } from "@/lib/utils";

function AlterarInspecao({
  idRelatorio,
  idEmpresa,
  idInspecaoAtual,
  onFechar,
}: {
  idRelatorio: string;
  idEmpresa: string;
  idInspecaoAtual: string | null;
  onFechar: () => void;
}) {
  const [vinculo, setVinculo] = useState<VinculoInspecao>("existente");
  const [idInspecao, setIdInspecao] = useState(idInspecaoAtual ?? "");
  const { data: inspecoes = [] } = useInspecoesByEmpresa(idEmpresa);
  const { data: comAep } = useInspecoesComAep(idEmpresa);
  const alterar = useAlterarInspecaoAep();
  const ativas = useMemo(() => inspecoes.filter((i) => i.status !== "DELETADA"), [inspecoes]);
  const proximaRevisao = useMemo(() => Math.max(0, ...inspecoes.map((i) => i.revisao ?? 0)) + 1, [inspecoes]);

  const opcoes: [VinculoInspecao, string, string][] = [
    ["existente", "Inspeção realizada", "Escolher uma inspeção da empresa"],
    ["nova", "Criar nova inspeção", `Inspeção em branco, Rev. ${proximaRevisao}`],
    ["nenhum", "Sem inspeção", "Sinalização ao concluir a AEP"],
  ];

  const podeSalvar =
    !alterar.isPending &&
    (vinculo === "existente" ? !!idInspecao && idInspecao !== idInspecaoAtual : vinculo === "nova" || !!idInspecaoAtual);

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-gray-200 bg-white p-3 text-gray-700">
      <div className="grid gap-2 sm:grid-cols-3">
        {opcoes.map(([v, rotulo, dica]) => (
          <button
            key={v}
            type="button"
            onClick={() => setVinculo(v)}
            className={cn(
              "rounded-lg border px-3 py-2 text-left text-sm",
              vinculo === v
                ? "border-emerald-500 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500"
                : "border-gray-300 hover:bg-gray-50"
            )}
          >
            <div className="font-medium">{rotulo}</div>
            <div className="text-[11px] text-gray-500">{dica}</div>
          </button>
        ))}
      </div>

      {vinculo === "existente" &&
        (ativas.length === 0 ? (
          <p className="text-[11px] text-amber-700">Esta empresa não tem inspeção. Escolha &quot;Criar nova inspeção&quot;.</p>
        ) : (
          <select
            value={idInspecao}
            onChange={(e) => setIdInspecao(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="">Selecione a inspeção...</option>
            {ativas.map((i) => {
              const atual = i.id_inspecao === idInspecaoAtual;
              const ocupada = !atual && (comAep?.has(i.id_inspecao) ?? false);
              return (
                <option key={i.id_inspecao} value={i.id_inspecao} disabled={ocupada}>
                  {i.id_inspecao} · Rev. {i.revisao ?? 0} · {fmtData(i.data_inspecao)}
                  {i.status === "CONCLUIDA" ? " · Concluída" : i.status === "RASCUNHO" ? " · Rascunho" : " · Em andamento"}
                  {atual ? " · atual" : ocupada ? " · já tem AEP" : ""}
                </option>
              );
            })}
          </select>
        ))}
      {vinculo === "nenhum" && (
        <p className="text-[11px] text-amber-700">
          Sem inspeção, a AEP aparece na Sinalização Psicossocial quando for marcada como Concluída (enviada ao
          cliente) em Dados / Conclusão.
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onFechar} className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100">
          Cancelar
        </button>
        <button
          type="button"
          disabled={!podeSalvar}
          onClick={() =>
            alterar.mutate(
              {
                idRelatorio,
                idEmpresa,
                vinculo,
                id_inspecao: vinculo === "existente" ? idInspecao : null,
                revisao_nova: proximaRevisao,
              },
              { onSuccess: onFechar }
            )
          }
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {alterar.isPending ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </div>
  );
}

export default function SituacaoSinalizacaoAep({ idRelatorio }: { idRelatorio: string }) {
  const { data } = useSituacaoSinalizacaoAep(idRelatorio);
  const [editando, setEditando] = useState(false);
  if (!data) return null;

  const link = data.idInspecao ? (
    <Link href={`/inspecoes/${data.idInspecao}`} className="font-semibold underline">
      {data.idInspecao}
    </Link>
  ) : null;

  const [cls, Icone, texto] = !data.idInspecao
    ? data.entregue
      ? ([
          "border-emerald-200 bg-emerald-50 text-emerald-800",
          CheckCircle2,
          <>
            <strong>Na Sinalização Psicossocial</strong>
            {data.entregueEm ? ` desde ${fmtData(data.entregueEm)}` : ""}: AEP sem inspeção, concluída (enviada ao
            cliente).
          </>,
        ] as const)
      : ([
          "border-amber-200 bg-amber-50 text-amber-800",
          Info,
          <>
            AEP sem inspeção. Aparece na <strong>Sinalização Psicossocial</strong> quando for marcada como{" "}
            <strong>Concluída</strong> (enviada ao cliente) em Dados / Conclusão.
          </>,
        ] as const)
    : data.entregue
      ? ([
          "border-emerald-200 bg-emerald-50 text-emerald-800",
          CheckCircle2,
          <>
            <strong>Na Sinalização Psicossocial</strong>
            {data.entregueEm ? ` desde ${fmtData(data.entregueEm)}` : ""}: o documento da inspeção {link} foi entregue
            ao cliente.
          </>,
        ] as const)
      : ([
          "border-sky-200 bg-sky-50 text-sky-800",
          Clock,
          <>
            Registrada na inspeção {link}. Aparece na <strong>Sinalização Psicossocial</strong> quando o documento dessa
            inspeção for concluído pelo associado (entregue ao cliente).
          </>,
        ] as const);

  return (
    <div className={cn("rounded-lg border px-3 py-2 text-xs", cls)}>
      <div className="flex items-start gap-2">
        <Icone className="mt-0.5 size-4 shrink-0" />
        <span className="flex-1">{texto}</span>
        {data.idEmpresa && !editando && (
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-current/30 bg-white/70 px-2 py-1 font-semibold hover:bg-white"
          >
            <Link2 className="size-3.5" />
            {data.idInspecao ? "Alterar inspeção" : "Registrar em inspeção"}
          </button>
        )}
      </div>
      {editando && data.idEmpresa && (
        <AlterarInspecao
          idRelatorio={idRelatorio}
          idEmpresa={data.idEmpresa}
          idInspecaoAtual={data.idInspecao}
          onFechar={() => setEditando(false)}
        />
      )}
    </div>
  );
}
```

### H: diff de `components/aep/AepSetoresEditor.tsx`

```diff
@@ -1,5 +1,7 @@
 "use client";
 
+import { chaveNome, type CargoCatalogo, type SetorCatalogo } from "@/lib/aep/catalogo-setores";
+import SituacaoSinalizacaoAep from "@/components/aep/SituacaoSinalizacaoAep";
 import { EditorSkeleton } from "@/components/ui/PageSkeletons";
 
 import { useEffect, useRef, useState } from "react";
@@ -24,6 +26,7 @@ import {
   CLASS_COLOR_AEP,
   TIPOS_RISCO_AEP,
   CLASSIFICACOES_AEP,
+  useCatalogoSetoresEmpresa,
 } from "@/lib/hooks/useAep";
 import { useCanEdit } from "@/lib/hooks/useUsuario";
 import {
@@ -458,6 +461,11 @@ export default function AepSetoresPage({ idRelatorio }: { idRelatorio: string })
   const [statusOrdem, setStatusOrdem] = useState<StatusOrdemSalva>("parado");
   // Matriz de risco ativa (a mesma da inspeção) — classifica a Ergonomia Organizacional.
   const { data: matriz } = useMatrizAtiva();
+  // Setores e cargos que a empresa já tem no sistema (das inspeções) — o
+  // editor sugere, e o técnico continua podendo digitar à mão (2026-10-05).
+  const { data: catalogo = [] } = useCatalogoSetoresEmpresa(
+    (rel as { id_empresa?: string } | undefined)?.id_empresa ?? null
+  );
 
   /** Recalcula a matriz AIHA dos fatores organizacionais e o "Necessita AET". */
   function comAiha(s: AepSetor): AepSetor {
@@ -528,6 +536,46 @@ export default function AepSetoresPage({ idRelatorio }: { idRelatorio: string })
     habilitado: canEdit,
   });
 
+  /** Setores do catálogo que ainda não estão nesta AEP. */
+  const setoresFaltando = catalogo.filter(
+    (c) => !setores.some((s) => chaveNome(s.nome_setor) === chaveNome(c.nome))
+  );
+
+  function cargosDoCatalogo(lista: CargoCatalogo[]): AepCargoSetor[] {
+    return lista.map((c) => ({ id: crypto.randomUUID(), cargo: c.cargo, descricao: c.descricao, quantidade: 0 }));
+  }
+
+  function importarSetores(lista: SetorCatalogo[]) {
+    if (lista.length === 0) return;
+    const novos = lista.map((c) => {
+      const cargos = cargosDoCatalogo(c.cargos);
+      return {
+        ...setorVazioAep(),
+        nome_setor: c.nome,
+        descricao_atividade: c.descricao,
+        cargos,
+        cargo: cargos.map((x) => x.cargo).join(", "),
+        funcao: cargos.map((x) => x.cargo).join(", "),
+      } as AepSetor;
+    });
+    setSetores((s) => [...s, ...novos]);
+    setAbertos((prev) => new Set([...prev, ...novos.map((n) => n.id)]));
+    toast.success(
+      `${novos.length} setor${novos.length !== 1 ? "es" : ""} da empresa adicionado${novos.length !== 1 ? "s" : ""} — salve para gravar.`
+    );
+  }
+
+  function addCargosCatalogo(setorId: string, lista: CargoCatalogo[]) {
+    const setor = setores.find((s) => s.id === setorId);
+    if (!setor || lista.length === 0) return;
+    const novos = [...(setor.cargos ?? []), ...cargosDoCatalogo(lista)];
+    updateSetor(setorId, {
+      cargos: novos,
+      funcao: novos.map((c) => c.cargo).filter(Boolean).join(", "),
+      trabalhadores_consultados: buildTrabalhadores(novos),
+    });
+  }
+
   function addSetor() {
     const novo = setorVazioAep();
     setSetores((s) => [...s, novo]);
@@ -663,6 +711,13 @@ export default function AepSetoresPage({ idRelatorio }: { idRelatorio: string })
 
   return (
     <div className="space-y-5" {...reordenar.propsContainer()}>
+      <SituacaoSinalizacaoAep idRelatorio={idRelatorio} />
+      {/* Sugestões do campo Setor: setores que a empresa já tem no sistema. */}
+      <datalist id="aep-setores-empresa">
+        {catalogo.map((c) => (
+          <option key={c.nome} value={c.nome} />
+        ))}
+      </datalist>
       <div className="flex flex-wrap items-center justify-between gap-3">
         <div>
           <h1 className="text-lg font-bold text-gray-900">Setores / Triagem Ergonômica</h1>
@@ -672,7 +727,17 @@ export default function AepSetoresPage({ idRelatorio }: { idRelatorio: string })
           </div>
         </div>
         {canEdit && (
-          <div className="flex gap-2">
+          <div className="flex flex-wrap gap-2">
+            {setoresFaltando.length > 0 && (
+              <button
+                type="button"
+                onClick={() => importarSetores(setoresFaltando)}
+                title={setoresFaltando.map((c) => c.nome).join(", ")}
+                className="inline-flex items-center gap-1.5 rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-100"
+              >
+                <Plus className="size-4" /> Setores da empresa ({setoresFaltando.length})
+              </button>
+            )}
             <button
               type="button"
               onClick={addSetor}
@@ -795,6 +860,7 @@ export default function AepSetoresPage({ idRelatorio }: { idRelatorio: string })
                         <input
                           type="text"
                           disabled={!canEdit}
+                          list={key === "nome_setor" && catalogo.length > 0 ? "aep-setores-empresa" : undefined}
                           value={(setor as unknown as Record<string, unknown>)[key] as string ?? ""}
                           onChange={(e) => updateSetor(setor.id, { [key]: e.target.value })}
                           placeholder={placeholder}
@@ -830,6 +896,45 @@ export default function AepSetoresPage({ idRelatorio }: { idRelatorio: string })
                         </button>
                       )}
                     </div>
+                    {(() => {
+                      if (!canEdit) return null;
+                      const doCatalogo = catalogo.find((c) => chaveNome(c.nome) === chaveNome(setor.nome_setor));
+                      const sugestoes = (doCatalogo?.cargos ?? []).filter(
+                        (c) => !(setor.cargos ?? []).some((x) => chaveNome(x.cargo) === chaveNome(c.cargo))
+                      );
+                      if (sugestoes.length === 0) return null;
+                      return (
+                        <div className="mb-2 rounded-md border border-sky-100 bg-sky-50/60 px-2 py-1.5">
+                          <div className="mb-1 flex items-center justify-between gap-2">
+                            <span className="text-[11px] text-sky-800">
+                              Cargos cadastrados para &quot;{doCatalogo?.nome}&quot; na empresa:
+                            </span>
+                            {sugestoes.length > 1 && (
+                              <button
+                                type="button"
+                                onClick={() => addCargosCatalogo(setor.id, sugestoes)}
+                                className="text-[11px] font-semibold text-sky-700 underline"
+                              >
+                                Adicionar todos
+                              </button>
+                            )}
+                          </div>
+                          <div className="flex flex-wrap gap-1">
+                            {sugestoes.map((c) => (
+                              <button
+                                key={c.cargo}
+                                type="button"
+                                onClick={() => addCargosCatalogo(setor.id, [c])}
+                                title={c.descricao || undefined}
+                                className="inline-flex items-center gap-0.5 rounded-full border border-sky-200 bg-white px-2 py-0.5 text-[11px] text-sky-800 hover:bg-sky-100"
+                              >
+                                <Plus className="size-3" /> {c.cargo}
+                              </button>
+                            ))}
+                          </div>
+                        </div>
+                      );
+                    })()}
                     {(setor.cargos ?? []).length === 0 ? (
                       <p className="text-xs text-gray-400 italic">Nenhum cargo adicionado.</p>
                     ) : (
```

### I: diff de `components/aep/AepDadosEditor.tsx`

```diff
@@ -133,6 +133,10 @@ export default function AepDadosPage({ idRelatorio, embutido = false }: { idRela
               </button>
             ))}
           </div>
+          <p className="mt-1 text-[11px] text-gray-500">
+            Concluído = enviado ao cliente. AEP sem inspeção entra na Sinalização Psicossocial ao ser concluída; com
+            inspeção, quando o documento da inspeção for concluído pelo associado.
+          </p>
         </div>
 
         {/* Responsável */}
```

### J: diff de `components/aep/SinalizacaoEmpresasLista.tsx`

```diff
@@ -10,7 +10,7 @@
 import { useMemo, useState, type ReactNode } from "react";
 import Link from "next/link";
 import { Brain, Building2, ChevronRight, Search } from "lucide-react";
-import { useAepRelatorios } from "@/lib/hooks/useAep";
+import { useAepsEntregues } from "@/lib/hooks/useAep";
 import { montarSinalizacao } from "@/lib/aep/sinalizacao";
 import SeloNivelAiha from "@/components/aep/SeloNivelAiha";
 import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
@@ -30,7 +30,7 @@ export default function SinalizacaoEmpresasLista({
   /** Bloco opcional entre o cabeçalho e a busca (ex.: explicação da matriz). */
   extra?: ReactNode;
 }) {
-  const { data: relatorios = [], isLoading, error } = useAepRelatorios(null);
+  const { data: relatorios = [], isLoading, error } = useAepsEntregues(null);
   const [busca, setBusca] = useState("");
 
   const empresas = useMemo(() => montarSinalizacao(relatorios), [relatorios]);
@@ -47,8 +47,8 @@ export default function SinalizacaoEmpresasLista({
           {titulo}
         </h1>
         <p className="text-sm text-gray-500">
-          Empresas com fatores organizacionais identificados nas triagens AEP, com o nível na matriz AIHA. Clique na
-          empresa para ver os fatores por setor.
+          Empresas com fatores organizacionais identificados nas AEPs já entregues ao cliente (documento da inspeção
+          concluído pelo associado), com o nível na matriz AIHA. Clique na empresa para ver os fatores por setor.
         </p>
       </div>
 
@@ -74,7 +74,7 @@ export default function SinalizacaoEmpresasLista({
         </p>
       ) : filtradas.length === 0 ? (
         <p className="rounded-2xl border border-gray-100 bg-white p-10 text-center text-sm text-gray-500 shadow-sm">
-          {empresas.length === 0 ? "Nenhum fator psicossocial sinalizado nas análises AEP." : "Nenhuma empresa encontrada."}
+          {empresas.length === 0 ? "Nenhum fator psicossocial sinalizado em AEP entregue ao cliente." : "Nenhuma empresa encontrada."}
         </p>
       ) : (
         <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
@@ -100,7 +100,7 @@ export default function SinalizacaoEmpresasLista({
                     {e.totalSetores} setor{e.totalSetores !== 1 ? "es" : ""}
                   </div>
                   <div className="hidden w-28 text-right text-xs text-gray-500 md:block">
-                    {e.ultimaData ? `AEP ${fmtData(e.ultimaData)}` : ""}
+                    {e.ultimaData ? `Entregue ${fmtData(e.ultimaData)}` : ""}
                   </div>
                   <ChevronRight className="size-4 shrink-0 text-gray-400" />
                 </Link>
```

### K: diff de `components/aep/SinalizacaoEmpresaDetalhe.tsx`

```diff
@@ -11,7 +11,7 @@ import { useMemo } from "react";
 import Link from "next/link";
 import { useQuery } from "@tanstack/react-query";
 import { ArrowLeft, Building2, Layers } from "lucide-react";
-import { useAepRelatorios } from "@/lib/hooks/useAep";
+import { useAepsEntregues } from "@/lib/hooks/useAep";
 import { montarSinalizacao } from "@/lib/aep/sinalizacao";
 import SeloNivelAiha from "@/components/aep/SeloNivelAiha";
 import { createSupabaseBrowserClient } from "@/lib/supabase/client";
@@ -55,7 +55,7 @@ export default function SinalizacaoEmpresaDetalhe({
   idEmpresa: string;
   basePath: string;
 }) {
-  const { data: relatorios = [], isLoading } = useAepRelatorios(idEmpresa);
+  const { data: relatorios = [], isLoading } = useAepsEntregues(idEmpresa);
   const sinal = useMemo(() => montarSinalizacao(relatorios)[0] ?? null, [relatorios]);
 
   const { data: cadastro } = useQuery({
@@ -123,7 +123,7 @@ export default function SinalizacaoEmpresaDetalhe({
         <LoadingSkeleton rows={6} />
       ) : !sinal ? (
         <p className="rounded-2xl border border-gray-100 bg-white p-10 text-center text-sm text-gray-500 shadow-sm">
-          Esta empresa não tem fator psicossocial sinalizado nas análises AEP.
+          Esta empresa não tem fator psicossocial sinalizado em AEP entregue ao cliente.
         </p>
       ) : (
         sinal.avaliacoes.map((a) => (
@@ -132,8 +132,8 @@ export default function SinalizacaoEmpresaDetalhe({
               <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">AEP</span>
               <h2 className="text-base font-semibold text-gray-900">Análise Ergonômica Preliminar</h2>
               <span className="text-xs text-gray-500">
-                {STATUS_ROTULO[a.status] ?? a.status}
-                {a.data ? ` · ${fmtData(a.data)}` : ""}
+                {a.data ? `Entregue ao cliente em ${fmtData(a.data)}` : STATUS_ROTULO[a.status] ?? a.status}
+                {a.idInspecao ? ` · ${a.idInspecao}` : ""}
                 {a.responsavel ? ` · ${a.responsavel}` : ""}
               </span>
             </div>
```

### L: diff de `app/(aep)/aep/novo/page.tsx`

```diff
@@ -27,9 +27,11 @@ export default function AepNovoPage() {
   const [registro, setRegistro] = useState("");
   const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
 
-  // Onde a AEP fica registrada (2026-10-05): solta no módulo, numa inspeção
-  // já realizada ou numa inspeção nova criada agora.
-  const [vinculo, setVinculo] = useState<VinculoInspecao>("nenhum");
+  // Onde a AEP fica registrada (2026-10-05): numa inspeção já realizada, numa
+  // inspeção nova criada agora, ou sem inspeção. Com inspeção, a AEP chega à
+  // Sinalização Psicossocial quando o documento da inspeção é concluído pelo
+  // associado; sem inspeção, quando a própria AEP é marcada Concluída.
+  const [vinculo, setVinculo] = useState<VinculoInspecao>("existente");
   const [idInspecao, setIdInspecao] = useState("");
   const { data: inspecoes = [] } = useInspecoesByEmpresa(empresaId);
   const { data: comAep } = useInspecoesComAep(empresaId);
@@ -183,9 +185,9 @@ export default function AepNovoPage() {
             <div className="grid gap-2 sm:grid-cols-3">
               {(
                 [
-                  ["nenhum", "Não vincular", "AEP só no módulo"],
                   ["existente", "Inspeção realizada", "Usa os setores e cargos dela"],
                   ["nova", "Criar nova inspeção", `Inspeção em branco, Rev. ${proximaRevisao}`],
+                  ["nenhum", "Sem inspeção", "AEP só no módulo"],
                 ] as [VinculoInspecao, string, string][]
               ).map(([v, rotulo, dica]) => (
                 <button
@@ -235,6 +237,11 @@ export default function AepNovoPage() {
                 </p>
               </div>
             )}
+            <p className="mt-2 text-[11px] text-gray-500">
+              {vinculo === "nenhum"
+                ? "Sem inspeção, a AEP aparece na Sinalização Psicossocial quando for marcada como Concluída (enviada ao cliente)."
+                : "A AEP aparece na Sinalização Psicossocial quando o documento da inspeção for concluído pelo associado (entregue ao cliente)."}
+            </p>
             {vinculo === "nova" && (
               <p className="mt-2 text-[11px] text-gray-500">
                 Será criada a inspeção em branco Rev. {proximaRevisao} desta empresa, com a data de elaboração acima, e
```

### M: diff de `app/(sinalizacao-psicossocial)/layout.tsx`

```diff
@@ -1,7 +1,7 @@
 "use client";
 
 import { type ReactNode } from "react";
-import { Brain, Home } from "lucide-react";
+import { Brain, Grid3x3, Home } from "lucide-react";
 import SidebarShell, { type NavSection } from "@/components/layout/SidebarShell";
 import ModuleTopbar from "@/components/layout/ModuleTopbar";
 import { useAuth } from "@/lib/hooks/useAuth";
@@ -12,6 +12,7 @@ const SECTIONS: NavSection[] = [
     label: "Sinalização Psicossocial",
     items: [
       { href: "/sinalizacao-psicossocial", label: "Painel de Alertas", icon: Brain },
+      { href: "/sinalizacao-matriz-aiha", label: "Matriz AIHA", icon: Grid3x3 },
     ],
   },
   {
```

### N: `app/(sinalizacao-psicossocial)/sinalizacao-psicossocial/page.tsx` (completo)

```tsx
"use client";

// Sinalização de Fatores Psicossociais (módulo AEP) — lista de empresas. A
// explicação da matriz AIHA fica na página Matriz AIHA do menu lateral.

import SinalizacaoEmpresasLista from "@/components/aep/SinalizacaoEmpresasLista";

export default function SinalizacaoPsicossocialPage() {
  return <SinalizacaoEmpresasLista basePath="/sinalizacao-psicossocial" />;
}
```

### O: `app/(sinalizacao-psicossocial)/sinalizacao-matriz-aiha/page.tsx` (novo, completo)

```tsx
"use client";

// Matriz AIHA no menu do módulo Sinalização Psicossocial (2026-10-05): a
// explicação técnica e normativa em página própria, sempre aberta. Rota fora
// de /sinalizacao-psicossocial/ para não acender o "Painel de Alertas" junto.

import ExplicacaoMatrizAiha from "@/components/aep/ExplicacaoMatrizAiha";

export default function SinalizacaoMatrizAihaPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <ExplicacaoMatrizAiha fixo />
    </div>
  );
}
```

## Passo 4: verificar

1. Rode `npm test` (os testes de `catalogo-setores` e `sinalizacao` passam), `npx tsc --noEmit -p .` e `npx next build`; todos devem terminar sem erros.
2. **Com inspeção:**
   - crie uma AEP registrada numa inspeção e marque fatores organizacionais;
   - a faixa fica azul e a empresa não aparece na Sinalização;
   - conclua o documento da inspeção como associado: a faixa fica verde e a empresa aparece com "Entregue dd/mm".
3. **Sem inspeção:**
   - a faixa fica amarela;
   - marque **Concluído** em Dados / Conclusão: a AEP aparece na Sinalização;
   - volte para Rascunho: ela sai.
4. **Alterar inspeção:** troque para outra inspeção, para uma nova e para "sem inspeção". Os setores da AEP não mudam, e inspeções que já têm AEP aparecem desabilitadas.
5. **Setores da empresa:**
   - numa empresa com inspeções, o campo Setor sugere os nomes;
   - os cargos do setor aparecem como sugestão;
   - o botão "Setores da empresa (N)" adiciona os que faltam;
   - digitação manual continua funcionando.
6. Menu do módulo Sinalização: **Matriz AIHA** abre a explicação e só ela fica destacada no menu.
7. Publique pelo fluxo de release do painel (versão, changelog, "Novidades").
