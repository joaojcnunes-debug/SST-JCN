# Painel SST — Chabra

Sistema interno de gestão de inspeções de Segurança e Saúde do Trabalho.

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS v4 (cores Chabra em `app/globals.css` via `@theme`)
- Supabase (Postgres, Auth, Storage)
- TanStack Query (cache de servidor)
- Zustand (estado do usuário logado, persistido em `localStorage`)
- react-hot-toast, lucide-react, date-fns (pt-BR)

## Setup local

### 1. Variáveis de ambiente

Edite `.env.local` e preencha com as chaves do seu projeto Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

### 2. Banco de dados

No painel Supabase → **SQL Editor**, cole e execute o conteúdo de `supabase/schema.sql`. Isso cria:

- 9 tabelas (`empresas`, `inspecoes`, `setores`, `cargos`, `riscos`, `epi_epc`, `fotos`, `responsaveis`, `usuarios`)
- Índices úteis
- Row Level Security básica (acesso para usuários autenticados)
- Bucket público `fotos` no Storage

### 3. Primeiro usuário admin

1. Em **Authentication → Users**, clique em "Add user" → "Create new user"
   - email + senha de sua escolha
   - Marque "Auto Confirm User" para evitar e-mail de confirmação em testes
2. Em **SQL Editor**, rode (trocando o e-mail pelo que você criou):

   ```sql
   INSERT INTO public.usuarios (id_usuario, nome, email, perfil, ativo_sistema)
   VALUES ('USR_ADMIN', 'Administrador', 'admin@chabra.com.br', 'Admin', true);
   ```

### 4. Rodar o projeto

```bash
npm install
npm run dev
```

Abra http://localhost:3000 — você será redirecionado para `/login`.

## Estrutura

```
app/
  (public)/login          ← tela de login (gradiente verde)
  (app)/
    layout.tsx            ← sidebar + topbar + auth guard
    dashboard             ← 4 cards de stats + inspeções recentes
    empresas              ← grid + formulário
    empresas/[id]         ← detalhe + lista de inspeções
    inspecoes             ← lista filtrável por empresa
    inspecoes/nova        ← wizard 3 passos
    inspecoes/[id]        ← editor com 7 abas
    inspecoes/[id]/relatorio
    usuarios              ← admin
    config                ← admin (matriz, listas, níveis)
components/
  layout/                 ← Sidebar, Topbar
  ui/                     ← Modal, ConfirmDialog, Badge, LoadingSkeleton
  empresas/               ← EmpresaCard, EmpresaForm, EmpresaSelect
  inspecoes/
    StatusBadge, InspecaoRow
    editor/               ← formulários (Setor, Cargo, Risco, Epi, Foto, Responsavel)
    editor/tabs/          ← uma por aba do editor
  riscos/                 ← NivelBadge, MatrizRisco
lib/
  supabase/               ← clients (browser/server) + types
  hooks/                  ← useEmpresas, useInspecao, useUsuario
  utils.ts                ← cn, fmtData, calcularNivelRisco, gerarId, PROBABILIDADES, SEVERIDADES
  constants.ts            ← NIVEL_CONFIG, CATEGORIAS_FOTO, listas defaults (tipos de risco em DB)
  store.ts                ← Zustand (usuário logado)
  providers.tsx           ← QueryClient + Toaster
middleware.ts             ← redireciona para /login se não autenticado
supabase/schema.sql       ← schema completo do banco
```

## Regras de negócio

### Cálculo de nível de risco (SGG)

Em `lib/utils.ts`. Listas em ordem crescente de peso (índice = peso). Score = peso(prob) × peso(severidade), com regras de pontuação para classificar em **Trivial, Baixo, Moderado, Alto, Muito Alto**.

### Perfis

- **Admin** — acesso total, vê tudo, gerencia usuários e configurações
- **Tecnico** — cria/edita inspeções; se tiver `empresas_vinculadas` preenchido, vê só essas empresas
- **Visualizador** — apenas leitura

### Foto upload

Vai para `fotos/{id_empresa}/{id_inspecao}/{rand}.{ext}` no bucket `fotos`. URL pública é gravada na tabela `fotos.arquivo_foto`.

## Deploy no Vercel

1. Suba para um repo Git
2. No Vercel: **Import Project** → seleciona o repo
3. Em **Environment Variables**, adicione `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy

## Troubleshooting

- **"Invalid login credentials"** — usuário existe no Supabase Auth mas não na tabela `usuarios` (ou senha errada). Confira ambos.
- **"Login válido, mas usuário não cadastrado"** — falta o INSERT na tabela `usuarios` para esse e-mail.
- **Foto sobe mas não aparece** — confirme que o bucket `fotos` é **público** no Supabase Storage.
- **Build erro de tipo no insert/update** — é a tipagem genérica do supabase-js v2 com `Partial<>`. Use `payload as never` no ponto da chamada (padrão já aplicado nos arquivos).
