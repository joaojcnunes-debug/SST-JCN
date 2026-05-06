---
title: Painel SST Chabra
aliases: [Painel SST, SST Chabra, painel-sst, painel-sst-chabra]
tags:
  - projeto/painel-sst
  - chabra
  - nextjs
  - supabase
  - sst
  - tipo/sistema-interno
status: produção
created: 2026-05-06
updated: 2026-05-06
versao_atual: V3
licenca: interno
---

# Painel SST Chabra

> Sistema interno da Chabra pra gestão de inspeções de Segurança e Saúde do Trabalho. Substitui um sistema anterior em Google Apps Script. Em produção desde **2026-05-06**.

## Sumário

- [[#Acesso e links rápidos|Acesso e links rápidos]]
- [[#Stack técnica|Stack técnica]]
- [[#Por que essas escolhas (decisões arquiteturais)|Decisões arquiteturais]]
- [[#História de versões|Histórico de versões V1 → V2 → V3]]
- [[#Estrutura de pastas|Estrutura de pastas]]
- [[#Banco de dados (Supabase)|Banco de dados]]
- [[#Cálculo do nível de risco|Cálculo do nível de risco]]
- [[#Controle de acesso (RBAC)|RBAC]]
- [[#Fluxos críticos|Fluxos críticos]]
- [[#Gotchas e armadilhas conhecidas|Gotchas]]
- [[#Operação|Operação (deploy, secrets, manutenção)]]
- [[#Como um agente deve trabalhar neste projeto|Guia pra agentes futuros]]

---

## Acesso e links rápidos

| Recurso | URL / Caminho |
|---|---|
| Produção | https://painel-sst-chabra.vercel.app |
| Código (GitHub) | https://github.com/joaojefferson-hash/Painel-SST--Chabra |
| Banco/Auth/Storage (Supabase) | https://supabase.com/dashboard/project/vifatwpfqhhantordxlq |
| Código local | `C:\Users\PC\painel-sst` |
| Admin de teste | `joao.jefferson@chabra.com.br` |
| Project ref Supabase | `vifatwpfqhhantordxlq` (us-east-2 Ohio, free tier `t4g.nano`) |
| Bucket Storage | `fotos` (público) |

---

## Stack técnica

- **[[Next.js 15]]** com App Router + TypeScript strict
- **[[Tailwind CSS v4]]** — cores Chabra via `@theme` em `app/globals.css` (sem `tailwind.config.ts`!)
- **[[Supabase]]** — Postgres + Auth (email/senha) + Storage + Edge Functions (Deno)
- **[[TanStack Query v5]]** — cache de servidor, staleTime 2-10min conforme volatilidade
- **[[Zustand]]** — estado do usuário logado com `persist` middleware (localStorage)
- **react-hot-toast** — notificações verde/vermelho com cores Chabra
- **lucide-react** — ícones
- **date-fns** com locale `ptBR`
- Deploy: **[[Vercel]]** com auto-deploy via push em `main` (~2 min)

### Cores da marca Chabra

```css
--verde-primary:  #006B54;   /* topbar, botões primários */
--verde-accent:   #00835A;   /* hover */
--verde-dark:     #1e4d28;   /* sidebar */
--verde-light:    #e8f5e9;   /* backgrounds suaves */
--verde-border:   #c8e6c9;
--red-alert:      #D32F2F;   /* perigo */
--amber-warning:  #d97706;   /* moderado */
```

Layout: sidebar 220px verde-dark + topbar 54px verde-primary + conteúdo `#f0f7f0`.

---

## Por que essas escolhas (decisões arquiteturais)

### Por que Supabase em vez de Apps Script / planilhas?
- Tipo seguro (Postgres + tipos TS gerados)
- Auth pronto (signInWithPassword)
- Storage pronto (uploads de fotos)
- Edge Functions pra side effects (e-mail boas-vindas)
- Free tier suficiente até 500MB DB + 1GB storage

### Por que Next.js 15 App Router?
- SSR + auth via middleware no edge
- File-based routing
- Vercel deploy free
- O `(app)` group folder isola rotas autenticadas do `(public)/login`

### Por que Tailwind v4 sem config TS?
- Configuração via `@theme` no CSS é mais simples
- Hot reload é instantâneo
- Cores customizadas (`bg-verde-primary`) funcionam direto pelas vars `--color-*`

### Por que Zustand em vez de Context/Redux?
- 1 hook, persist embutido em localStorage
- Estado do usuário logado precisa sobreviver a reload
- Componentes que não usam o store não re-renderizam

### Por que TanStack Query?
- Cache automático com invalidação por queryKey
- Loading/error states sem boilerplate
- `optimistic updates` ao salvar
- TTL diferente por tipo: empresas 10min, riscos 2min

### Por que matrizes editáveis (V3) em vez de fórmula fixa?
- A fórmula SGG hardcoded ficou muito rígida quando o usuário pediu pra usar matrizes diferentes (ABNT NBR 14280, William Fine, etc.)
- Solução: tabela `matrizes_risco` com `lookup JSONB[iP][iS] = nivel`, função `calcularNivelComMatriz(prob, sev, matriz)`
- Apenas UMA matriz fica ativa por vez (índice parcial único no Postgres)

### Por que `senha_hash` foi mantido nullable e não é usado?
- A spec do cliente pediu, mas Supabase Auth já gerencia hash em `auth.users`
- Duplicar criaria risco de divergência → coluna existe mas o login continua via Supabase Auth
- ⚠ Se um dia precisar usar (ex: SSO custom), revisar primeiro

### Por que IDs formato `PREFIX-XXXXXXXX`?
- TEXT em vez de UUID porque o Apps Script original já usava prefixos legíveis
- 8 chars hex maiúsculo via `crypto.getRandomValues` (10 bilhões de combinações)
- Prefixos: `EMP-`, `INS-`, `SET-`, `CGO-`, `RSC-`, `EPI-`, `FOTO-`, `RSP-`, `CMP-`, `USR-`, `MTZ-`, `PRG-`

---

## História de versões

| Versão | Foco | Data | Commit |
|---|---|---|---|
| **V1** | Setup inicial: 10 telas, schema básico, primeira spec | 2026-05-06 | `61f839d` |
| **V2** | Probabilidades/Severidades novas, IAPAT, Multi-setor, Complementos, Cópia p/ empresa, Relatório consolidado, Edge Function email | 2026-05-06 | `f3cdfb6` |
| **V3** | Matrizes editáveis (N×M), Tipos custom, Perguntas customizáveis, Relatório PGR/NR-1 | 2026-05-06 | `00cae46` |

### Diferenças críticas V1 → V2

- Probabilidades: 5 níveis novos (`Improvável...Frequente`)
- Severidades: passou de 5 → **4 níveis** (`Insignificante...Catastrófico`) ⚠
- Tipos de risco: 7 → 9 (acrescenta IAPAT Complexidade Laboral + Alto Risco)
- Status `DELETADA` (soft delete) — sempre filtrar `i.status !== 'DELETADA'` nas listas
- Inspeções concluídas continuam editáveis (V1 bloqueava)
- Multi-setor: 1 risco com N setores → cria N riscos automaticamente

### Diferenças V2 → V3

- Tipos de risco viraram **dados** (tabela `tipos_risco`), não mais constante TypeScript
- Probabilidades/Severidades viram **labels da matriz ativa**
- Perguntas customizadas: tabela `perguntas_tipo_risco` + coluna `riscos.respostas_custom JSONB`
- Editor visual de matrizes N×M com lookup table
- Relatório PGR/NR-1 (`/inspecoes/[id]/pgr`) em formato Inventário de Riscos

---

## Estrutura de pastas

```
painel-sst/
├── app/
│   ├── (public)/login/page.tsx           ← gradiente verde, signInWithPassword
│   └── (app)/                             ← group autenticado (auth guard via middleware)
│       ├── layout.tsx                     ← sidebar + topbar + sync user Zustand
│       ├── dashboard/                     ← 4 stats + ações + recentes
│       ├── empresas/
│       │   ├── page.tsx                   ← grid + modal
│       │   ├── [id]/page.tsx              ← detalhe + lista inspeções
│       │   └── [id]/relatorio/page.tsx    ← consolidado por empresa
│       ├── inspecoes/
│       │   ├── page.tsx                   ← lista filtrável
│       │   ├── nova/page.tsx              ← wizard 3 passos
│       │   └── [id]/
│       │       ├── page.tsx               ← editor com 8 abas
│       │       ├── relatorio/page.tsx     ← relatório resumido (print)
│       │       └── pgr/page.tsx           ← PGR/Inventário NR-1 (V3)
│       ├── usuarios/page.tsx              ← admin only
│       └── config/page.tsx                ← admin only, 9 abas
├── components/
│   ├── layout/                            ← Sidebar, Topbar
│   ├── ui/                                ← Modal, ConfirmDialog, Badge, LoadingSkeleton, Pagination
│   ├── empresas/                          ← Card, Form, Select (searchable)
│   ├── inspecoes/
│   │   ├── StatusBadge, InspecaoRow
│   │   └── editor/
│   │       ├── SetorMultiSelect, RiscoForm, ComplementoForm, ...
│   │       └── tabs/                      ← 1 arquivo por aba
│   ├── riscos/                            ← NivelBadge, RiscoRow, MatrizRisco
│   └── config/                            ← TiposRiscoTab, PerguntasTab, MatrizesTab (V3)
├── lib/
│   ├── supabase/
│   │   ├── client.ts                      ← createBrowserClient + createServerClient
│   │   └── types.ts                       ← Database type + interfaces
│   ├── hooks/                             ← useEmpresas, useInspecao, useUsuario, useConfiguracoes, useV3
│   ├── utils.ts                           ← cn, fmtData, gerarId, PROBABILIDADES, SEVERIDADES (legados)
│   ├── constants.ts                       ← TIPOS_RISCO (default), NIVEL_CONFIG, listas defaults
│   ├── calc.ts                            ← calcularNivelComMatriz (V3)
│   ├── store.ts                           ← Zustand persistente
│   └── providers.tsx                      ← QueryClient + Toaster
├── middleware.ts                          ← redirect /login se sem session
├── supabase/
│   ├── schema.sql                         ← schema V1 (idempotente)
│   └── functions/welcome-email/           ← Edge Function (Deno) — deploy manual
└── docs/
    └── painel-sst-chabra.md               ← este arquivo
```

---

## Banco de dados (Supabase)

11 tabelas + bucket `fotos`. Todas com RLS habilitado (`auth read X` + `auth write X`).

### Tabelas principais

| Tabela | Propósito | Notas |
|---|---|---|
| `empresas` | Cadastro de empresas | `grau_risco` 1-4 (NR-04) |
| `inspecoes` | Documentos de inspeção | Status: `RASCUNHO/EM_ANDAMENTO/CONCLUIDA/DELETADA` |
| `setores` | Setores/GHE de uma inspeção | Cascade delete via inspeção |
| `cargos` | Cargos por setor | Cascade delete via setor |
| `riscos` | Riscos identificados | 30+ campos, `respostas_custom JSONB` (V3) |
| `epi_epc` | EPIs/EPCs vinculados a riscos | `tipo: EPI \| EPC` |
| `fotos` | Registro fotográfico | URL no Storage `fotos/{empresa}/{inspecao}/{rand}.jpg` |
| `responsaveis` | Técnico SST + recepcionado por | |
| `complementos` | Procedimentos/treinamentos extras (V2) | |
| `usuarios` | Perfil interno | `senha_hash` existe mas não é usado (Supabase Auth gerencia) |
| `configuracoes` | Listas auxiliares editáveis (V2) | Key `JSONB` |
| `tipos_risco` | Tipos editáveis (V3) | `sistema=true` protege seeds |
| `perguntas_tipo_risco` | Perguntas custom por tipo (V3) | |
| `matrizes_risco` | Matrizes N×M (V3) | Apenas 1 ativa via constraint UNIQUE parcial |

### Schema completo

Em [`supabase/schema.sql`](file:///C:/Users/PC/painel-sst/supabase/schema.sql) (V1) + migrações V2/V3 aplicadas manualmente.

### Como aplicar migração nova

1. Editar `supabase/schema.sql` com `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...`
2. Rodar manualmente em https://supabase.com/dashboard/project/vifatwpfqhhantordxlq/sql/new
3. **NUNCA usar `CREATE POLICY IF NOT EXISTS`** — não existe em Postgres! Use `DROP POLICY IF EXISTS ... ; CREATE POLICY ...`

---

## Cálculo do nível de risco

### V3 (atual): `calcularNivelComMatriz(prob, sev, matriz)`

```typescript
// lib/calc.ts
export function calcularNivelComMatriz(prob, sev, matriz): NivelRisco {
  if (!matriz || !prob || !sev) return "Baixo";
  const iP = matriz.probabilidades.indexOf(prob);
  const iS = matriz.severidades.indexOf(sev);
  if (iP < 0 || iS < 0) return "Baixo";
  return matriz.lookup[iP]?.[iS] as NivelRisco ?? "Baixo";
}
```

A matriz vem do banco via hook `useMatrizAtiva()`. Apenas uma matriz fica ativa por vez (índice parcial UNIQUE no Postgres). Editor visual em `/config → Matrizes de Risco` permite N×M com seletor de nível por célula.

### Níveis disponíveis (constantes)

```typescript
NIVEIS_RISCO = ['Trivial', 'Baixo', 'Moderado', 'Alto', 'Muito Alto']

NIVEL_CONFIG = {
  Trivial:     { cor: '#16a34a', bg: '#dcfce7', borda: '#86efac' },
  Baixo:       { cor: '#65a30d', bg: '#ecfccb', borda: '#bef264' },
  Moderado:    { cor: '#d97706', bg: '#fef3c7', borda: '#fcd34d' },
  Alto:        { cor: '#dc2626', bg: '#fee2e2', borda: '#fca5a5' },
  'Muito Alto': { cor: '#be185d', bg: '#fce7f3', borda: '#f9a8d4' },
}
```

---

## Controle de acesso (RBAC)

3 perfis em `usuarios.perfil`:

| Funcionalidade | Admin | Técnico | Visualizador |
|---|---|---|---|
| Ver todas as telas | ✅ | ✅ | ✅ |
| Criar/editar inspeções | ✅ | ✅ | ❌ |
| Editar inspeção concluída | ✅ | ✅ | ❌ |
| Gerenciar usuários | ✅ | ❌ | ❌ |
| Configurações | ✅ | ❌ | ❌ |
| Filtro por empresa | ❌ | ✅ | ❌ |

**Filtro por empresa para Técnico:** se `usuarios.empresas_vinculadas[]` não estiver vazio, o Técnico vê apenas essas empresas. Vazio = todas.

Implementação: [`lib/hooks/useUsuario.ts`](file:///C:/Users/PC/painel-sst/lib/hooks/useUsuario.ts) (`useCanEdit`, `useIsAdmin`) + filtros nos hooks `useEmpresas`/`useInspecoesByEmpresa`.

⚠ **A RLS do Supabase é permissiva** (`USING (true)`) — o filtro está apenas no código cliente. Em produção real refinar policies por user.

---

## Fluxos críticos

### Multi-setor no novo risco (V2+)

Quando o usuário marca **N setores** em um risco novo:

1. `RiscoForm` cria N riscos no banco com mesmos dados, cada um com seu `id_setor`
2. Toast: `"3 risco(s) criado(s), um por setor ✓"`

Quando edita risco existente com setores adicionais:
- Atualiza o original com `ids_setores[0]`
- Cria N-1 riscos novos pros setores extras (clones com mesmo conteúdo)

Ver [`components/inspecoes/editor/RiscoForm.tsx`](file:///C:/Users/PC/painel-sst/components/inspecoes/editor/RiscoForm.tsx) `mutationFn`.

### Cópia de inspeção entre empresas

`CopiarParaEmpresaModal` cria uma nova inspeção mantendo o mapeamento de IDs:
- `mapaSetor: Map<idAntigo, idNovo>`
- `mapaCargo: Map<idAntigo, idNovo>`  
- `mapaRisco: Map<idAntigo, idNovo>`

Reutiliza esses mapas pra criar EPIs/Fotos com `id_setor` e `id_risco` corretos.

### Wizard de Nova Inspeção (3 tipos)

1. **Em Branco** — apenas cria a inspeção
2. **Nova Revisão** — copia setores/cargos/riscos da inspeção base (mesma empresa). `revisao = max(rev anterior) + 1`
3. **Cópia de Outra Empresa** (V2) — escolhe empresa origem + inspeção origem + opções granulares

### Auth guard

- `middleware.ts` faz `supabase.auth.getUser()` em toda rota não-pública. Sem usuário → redirect `/login?next=...`
- `(app)/layout.tsx` (client) também faz uma checagem extra e popula o Zustand store com perfil completo
- `Sidebar` + `Topbar` leem do Zustand (sem hook que dispara request a cada render)

---

## Gotchas e armadilhas conhecidas

> Coleção de "pegadinhas" descobertas durante o desenvolvimento. Salve isso. Vai aparecer de novo.

### `CREATE POLICY IF NOT EXISTS` não existe em Postgres
- Apenas `CREATE TABLE/INDEX IF NOT EXISTS`. Pra policies, use:
  ```sql
  DROP POLICY IF EXISTS "name" ON table;
  CREATE POLICY "name" ON table FOR ... ;
  ```

### Supabase-js v2 + `Insert: Partial<T>` infere `never`
- Bug conhecido com tipos genéricos. Soluções tentadas e descartadas:
  - ❌ Reescrever tipos sem Partial → quebra outros usos
  - ✅ **Cast `payload as never`** no momento do insert/update
- Padrão usado em todo o código:
  ```typescript
  const { error } = await supabase.from("X").insert(row as never);
  ```
- Não tente "limpar" esses casts — são intencionais.

### Database type precisa de `Relationships: []`
- Sem isso, supabase-js infere `data: never`:
  ```typescript
  type TableShape<T> = {
    Row: T;
    Insert: Partial<T>;
    Update: Partial<T>;
    Relationships: [];  // ← necessário
  };
  ```

### Google Translate quebra Supabase Studio
- O dashboard do Supabase é um app React; o Translate modifica o DOM em runtime e o React perde sincronia
- Sintoma: "Erro de aplicação: ocorreu uma exceção no lado do cliente"
- Solução: clicar no ícone do Tradutor na barra do Chrome → "Mostrar original"

### `useSearchParams` em Next 15 precisa de `<Suspense>`
- Páginas client component que usam `useSearchParams` quebram o build estático
- Padrão: extrair em componente filho e wrappar:
  ```tsx
  export default function Page() {
    return <Suspense fallback={null}><Inner /></Suspense>;
  }
  ```

### `tsconfig.json` deve excluir `supabase/functions`
- Edge Functions usam Deno (`Deno.env.get`) que não existe em Node
- Sem `exclude: ["supabase/functions/**"]`, o `next build` falha com `Cannot find name 'Deno'`

### `as const` em listas literais bloqueia atribuição de `string`
- `PROBABILIDADES = [...] as const` faz cada elemento virar literal type
- Em forms, `setForm({ probabilidade: e.target.value })` falha porque `string` não é `'Exposição moderada' | ...`
- Solução: cast `[2] as string` ou tipar o estado como `string` explicitamente

### Vercel: `npm install` falha com ECONNRESET
- Erro transitório de rede, não é problema do código
- Solução: clicar **Redeploy** (sem cache). Geralmente o segundo deploy funciona.

### Tailwind v4 sem `tailwind.config.ts`
- Cores customizadas vão em `app/globals.css`:
  ```css
  @theme {
    --color-verde-primary: #006B54;
  }
  ```
- A classe `bg-verde-primary` é gerada automaticamente da var `--color-*`
- **Não criar `tailwind.config.ts`** — não é mais usado

### Múltiplos lockfiles → warning no Vercel
- Se houver outro `package-lock.json` em diretório-pai (caso `C:\Users\PC` ser repo git), Next escolhe o errado
- Solução: `outputFileTracingRoot: path.join(__dirname)` em `next.config.ts`

### Status "Insalubre" no Supabase em PT-BR
- Tradução automática **errada** de "Healthy". Está saudável, ignore.

### Edge Function `welcome-email` não está deployada por padrão
- O código existe em `supabase/functions/welcome-email/index.ts`
- Pra ativar:
  ```bash
  supabase login
  supabase link --project-ref vifatwpfqhhantordxlq
  supabase secrets set RESEND_API_KEY=re_xxxxx
  supabase secrets set APP_URL=https://painel-sst-chabra.vercel.app
  supabase functions deploy welcome-email --no-verify-jwt
  ```
- Sem isso, criação de usuário ainda funciona, só não envia e-mail (silenciosamente)

---

## Operação

### Rodar local

```bash
cd C:\Users\PC\painel-sst
npm install
npm run dev      # localhost:3000 (ou 3001/3002 se porta ocupada)
```

`.env.local` já está preenchido com URL + ANON_KEY do Supabase de produção (cuidado ao alterar dados via dev local).

### Deploy

Auto via push em `main`. Vercel rebuilda em ~2 min. Sem comando manual.

### Adicionar nova migração SQL

1. Criar `migration_v{N}.sql` (ou apenas anexar em `schema.sql`)
2. SQL Editor do Supabase: https://supabase.com/dashboard/project/vifatwpfqhhantordxlq/sql/new
3. Cola, **Run**, confirmar quando avisar de "operações destrutivas"
4. Atualizar `lib/supabase/types.ts` com tipo novo se for nova tabela
5. `npm run build` local antes do push

### Cadastrar novo usuário Admin

```sql
-- 1. Cria em Authentication → Users → Create new user (com Auto Confirm User)
-- 2. SQL Editor:
INSERT INTO public.usuarios (id_usuario, nome, email, perfil, ativo_sistema)
VALUES ('USR-XXXXXXXX', 'Nome', 'email@chabra.com.br', 'Admin', true);
```

Pra Técnico: trocar perfil pra `'Tecnico'` e adicionar `empresas_vinculadas TEXT[]`.

### Backups
- Supabase free faz backup automático diário
- Manual: Supabase Dashboard → Settings → Database → Database backups

---

## Como um agente deve trabalhar neste projeto

> Pra Claude/agentes que abrirem este repo no futuro.

1. **Leia primeiro a memória persistente:** `.claude/projects/.../memory/project_painel_sst.md`. Tem URL de produção, gotchas e contexto que esta wiki repete mas a memória é a fonte canônica do agente.

2. **Antes de mexer:** confirme se está em V3 lendo `package.json` e checando se existem as tabelas `tipos_risco`, `matrizes_risco`, `perguntas_tipo_risco`. Se não, alinhe com o usuário antes.

3. **Não invente fórmula nova de cálculo de risco.** Use sempre `calcularNivelComMatriz` em [`lib/calc.ts`](file:///C:/Users/PC/painel-sst/lib/calc.ts) carregando matriz via `useMatrizAtiva()`. A fórmula antiga `calcularNivelRisco` em `lib/utils.ts` é legado pra V1/V2 e deve ser evitada.

4. **Não tente substituir os casts `as never`** nos inserts/updates do Supabase. Eles são intencionais — ver [[#Gotchas e armadilhas conhecidas]].

5. **Nunca crie `tailwind.config.ts`.** As cores vão em `@theme` no `globals.css`.

6. **Sempre rode `npx tsc --noEmit` antes de declarar pronto.** O typecheck pega 90% dos bugs.

7. **Antes de mudar schema do banco**, tente a alteração ser idempotente (`ADD COLUMN IF NOT EXISTS`, `DROP POLICY IF EXISTS`).

8. **Os projetos `chabra-gestao/` e `chabra-gestao-v2/` em `C:\Users\PC\` são tentativas anteriores com Prisma.** NÃO edite eles ao trabalhar no painel-sst.

9. **Se for adicionar uma feature nova, considere primeiro:**
   - Cabe em `/config` como configuração editável? (preferível)
   - Ou precisa de mudança de schema?
   - Ou é só client-side?

10. **Confirme com o usuário antes de:**
    - Migrar schema (não é reversível em produção)
    - Trocar dependências grandes (TanStack, Supabase, Tailwind)
    - Apagar arquivos
    - Refatorar > 5 arquivos de uma vez

---

## Próximos passos sugeridos (backlog)

- [ ] Deploy da Edge Function `welcome-email` com Resend (opcional — instruções em [[#Edge Function welcome-email...]])
- [ ] Domínio custom `sst.chabra.com.br` em vez de `vercel.app`
- [ ] Refinar RLS por usuário (atualmente é permissiva)
- [ ] Cadastro em massa de empresas via CSV
- [ ] Dashboard de KPIs (riscos por nível ao longo do tempo)
- [ ] Mobile-first review (sidebar drawer já existe, mas algumas telas precisam revisão)
- [ ] Modo escuro

---

## Glossário

- **GHE** — Grupo Homogêneo de Exposição. No sistema, sinônimo de Setor.
- **NR-01** — Norma Regulamentadora 01 (Disposições gerais e GRO)
- **NR-04** — Norma Regulamentadora 04 (SESMT) — define grau de risco da empresa 1-4
- **PGR** — Programa de Gerenciamento de Riscos. Documento gerado em `/inspecoes/[id]/pgr`
- **GRO** — Gerenciamento de Riscos Ocupacionais. Estrutura prevista em NR-01
- **SGG** — Sistema/metodologia de classificação de risco usado na fórmula `calcularNivelRisco` original. Substituído por matrizes editáveis na V3.
- **SST** — Segurança e Saúde do Trabalho
- **CA** — Certificado de Aprovação (para EPIs)
- **EPI/EPC** — Equipamento de Proteção Individual / Coletiva
- **IAPAT** — Avaliação para tipos especiais (Complexidade Laboral, Impactos de Alto Risco)
- **FDS** — Ficha de Dados de Segurança (química)
- **CAS** — Chemical Abstracts Service (número químico)

---

## Notas relacionadas (criar conforme precisar)

- [[Next.js 15]]
- [[Supabase]]
- [[Tailwind CSS v4]]
- [[TanStack Query v5]]
- [[Zustand]]
- [[Vercel]]
- [[NR-01]]
- [[NR-04]]
- [[PGR]]
- [[Chabra]]
