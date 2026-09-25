# Painel SST — JCN Consultoria: especificação completa do sistema

> **Para que serve este documento:** descrever o sistema inteiro (módulos,
> telas, regras de negócio, banco de dados, integrações e infraestrutura) com
> detalhe suficiente para **recriá-lo do zero** ou para orientar quem for dar
> manutenção. O código-fonte está no GitHub (`joaojcnunes-debug/SST-JCN`); os
> caminhos citados aqui são relativos à raiz do repositório.
>
> **Como é mantido:** a cada atualização que entra na branch `main`, uma
> automação do GitHub (`.github/workflows/documentacao-email.yml`) junta este
> texto com o que mudou, a lista atual de telas, APIs e migrations e a
> estrutura do banco (`docs/SISTEMA-BANCO.md`) e envia por e-mail.
>
> **Nenhum segredo aparece aqui** — só os nomes das variáveis de ambiente.

## Sumário

1. Visão geral e arquitetura
2. Autenticação, perfis e permissões
3. Registro de módulos, hub e layout
4. Área administrativa (Sistema)
5. Recursos transversais (offline, PDF, assinatura, textos padrão, storage, busca, IA, e-mail, Google Agenda)
6. Empresas e unidades
7. Módulos de SST (Painel SST/Inspeções, Conformidade, RNC, Apreciação de Máquinas, Químicos, AEP, AET, Investigação de Acidente)
8. Módulos psicossociais (DRPS, QPS, Riscos Psicossociais)
9. Módulos de gestão e operação (Gestão/kanban, SGG, Escala, Dimensionamento, Frota, Equipamentos, EPI, Transferências)
10. Como recriar o sistema do zero (roteiro)
11. Pontos de atenção conhecidos

Anexos gerados automaticamente a cada envio: A (o que mudou), B (telas), C (rotas de API), D (migrations) e o apêndice do banco de dados.

---

## 1. Visão geral e arquitetura

**O que é:** plataforma web interna da JCN Consultoria (Segurança e Saúde do
Trabalho) com ~17 módulos: inspeções e laudos de SST, psicossocial (DRPS/QPS),
ergonomia (AEP/AET), máquinas NR-12, químicos, investigação de acidentes,
gestão de tarefas, escalas, frota, equipamentos, EPI e dimensionamento de
equipe. Tem um portal para o cliente final.

É um fork do "painel-sst" (versão self-hosted com MinIO) equalizado para o
**Supabase gerenciado** e publicado na **Vercel**. Versão atual: `0.3.136`.

### 1.1 Stack (package.json, Node >= 20.9)

| Área | Tecnologia |
|---|---|
| Base | Next.js 15.5 (App Router), React 19.1, TypeScript 5 |
| Backend | Supabase (Postgres + Auth + Storage + Edge Functions): `@supabase/supabase-js` 2.105, `@supabase/ssr` 0.10 |
| Estado/dados | TanStack React Query 5 (staleTime 5 min, gcTime 10 min, retry 1, sem refetch no foco), Zustand 5 |
| Estilo | Tailwind CSS 4 (`@theme` em `app/globals.css`), lucide-react, react-hot-toast, clsx + tailwind-merge |
| Gráficos | Recharts 3 |
| Editor rico | TipTap 3 (starter-kit, table, image, link, align, underline) |
| PDF (servidor) | puppeteer-core + `@sparticuz/chromium` na Vercel; pdf-lib |
| PDF (cliente) | jspdf, html-to-image, pdfjs-dist |
| Assinatura digital | @signpdf/*, node-forge, pkijs, asn1js (PAdES ICP-Brasil) |
| Planilhas/docs | xlsx 0.18.5, docx 9 |
| Datas | date-fns 4 |
| Biometria | @digitalpersona/websdk + devices (agente nativo C# em `native/EpiBiometricAgent`, HTTP 127.0.0.1:52182) |
| Testes | `node --test` + tsx (`npm test`; ~700 testes em `lib/**/*.test.ts`) |

Alias de import: `@/*` → raiz.

### 1.2 Estrutura de pastas

- `app/layout.tsx` — fonte Inter, `lang="pt-BR"`; script inline aplica tema (`localStorage.tema`) e menu recolhido (`sidebar-mini`) antes da pintura; `Providers`, barra de progresso, banner de atualização.
- `app/page.tsx` → redireciona para `/inicio`.
- **Route groups** (`app/(grupo)` não aparece na URL):

| Grupo | Rotas |
|---|---|
| `(public)` | `/login` |
| `(hub)` | `/inicio`, `/visao-geral`, `/modulos`, `/validades`, `/gestao` |
| `(admin)` | `/usuarios`, `/funcoes`, `/config`, `/pdfs-gerados`, `/lixeira`, `/auditoria`, `/presenca`, `/portal-sst` |
| `(app)` | Módulo **Painel SST**: `/dashboard`, `/inspecoes`, `/relatorios`, `/certificados`, `/riscos-psicossociais`, `/acoes`, `/texto-padrao` |
| `(empresas)` | `/empresas`, `/empresas/[id]`, `/empresas/[id]/relatorio` |
| `(cliente)` | `/portal-cliente/*` (Server Component exige perfil Cliente) |
| um grupo por módulo | `(aep)`, `(aet)`, `(analise-quimicos)`, `(apreciacao-maquinas)`, `(conformidade)` → `/relatorio-conformidade`, `(nao-conformidade)` → `/relatorio-nao-conformidade`, `(dimensionamento)`, `(epi)`, `(equipamentos)`, `(escala)`, `(frota)`, `(gestao-gerencial)`, `(investigacao-acidente)`, `(pendencias)`, `(psicossocial)`, `(questionarios-psicossociais)`, `(sinalizacao-psicossocial)` |
| `app/f/[token]` | formulário público da Gestão |
| `app/api/*` | rotas de servidor (PDF, assinatura, usuários, CNPJ, IA, Google, SGG…) |

- `lib/` — ~100 hooks (`lib/hooks`), cliente e tipos do Supabase (`lib/supabase`, tipos escritos à mão em `types.ts`), regras de cada módulo (`lib/drps`, `lib/qps`, `lib/aet`…), offline, PDF, textos padrão, busca, auditoria, presença, novidades, NR-4.
- `components/` — layout, ui, templates de PDF (`components/pdf/templates`), formulários por módulo.
- `supabase/` — `functions/` (19 edge functions), `historico/` (migrations já aplicadas, `vNNN_*.sql`), `fila/` (não aplicadas), `config.toml`. `supabase/migrations/` fica **vazio de propósito** (ver 11).
- `scripts/sql/` — rollbacks e scripts avulsos. `pdf-service/` — serviço externo opcional de PDF (Express + puppeteer, HMAC). `public/sw.js` — service worker.

### 1.3 Build e deploy

- **Vercel**, deploy automático a cada push na `main` (integração Git). Previews por branch **não** recebem as variáveis (estão só em Production).
- O app Electron foi removido em 24/09/2026 (commit `aa38ec6`); sobram resíduos inativos na web (ver 11).
- Rotas de PDF: `runtime = "nodejs"`, `maxDuration = 60`.
- `next.config.ts`: `NEXT_PUBLIC_APP_VERSION` (do package.json) e `NEXT_PUBLIC_BUILD_ID` (SHA do commit); `serverExternalPackages` para chromium/puppeteer; `transpilePackages: ["xlsx"]`; redirect `/produtividade` → `/dimensionamento`; imagens de `*.supabase.co`; webpack externals `WebSdk`.
- Supabase Auth › URL Configuration: Site URL = domínio de produção; Redirect URLs incluem `https://*.vercel.app`.

### 1.4 Variáveis de ambiente (nomes apenas)

**Obrigatórias:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
**Recomendada:** `SUPABASE_SERVICE_ROLE_KEY` — rotas de serviço (assinatura de PDF, certificado, registro de PDF, sign-image, Gestão pública/Google). Sem ela, `/api/usuarios/*` usa as funções do banco (4.1) e as demais rotas de serviço falham.

**Opcionais (cada uma liga um recurso):**

| Variável | Recurso |
|---|---|
| `GROQ_API_KEY` | IA nas rotas Next (análise de setor AET, intro de capítulo AET, análise de foto de máquina) |
| `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`, `GESTAO_GOOGLE_ENC_KEY` | Google Agenda da Gestão |
| `SGG_WEBHOOK_SOCKET`, `SGG_WEBHOOK_HMAC_SECRET`, `MESTRES_POSTGREST_URL` | envio de riscos ao SGG |
| `CHABRA_API_BASE`, `CHABRA_JWT`, `CHABRA_CF_ID`, `CHABRA_CF_SECRET` | sincronização do Dimensionamento |
| `EPI_MATCHER_URL` | verificação biométrica |
| `PDF_SERVICE_URL`, `PDF_SERVICE_SECRET` | serviço externo de PDF |
| `PDF_IMG_BASE_URL`, `AUTH_INTERNAL_URL` | origem para imagens/chamadas internas na geração de PDF |
| `PDF_USE_SPARTICUZ` | força o Chromium serverless fora da Vercel |

**Edge functions (secrets do Supabase):** `GROQ_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `FROM_EMAIL`, `APP_URL`.

**Automação de documentação (secrets do GitHub):** `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `EMAIL_DESTINOS`.

### 1.5 Middleware (`middleware.ts`)

- Roda em tudo, menos estáticos, imagens, `manifest.webmanifest` e `sw.js`. Públicos: `/login` e `/f/`.
- Sem URL/chave do Supabase configuradas: `/api/*` → 500 JSON; resto → `/login`.
- Valida a sessão com `@supabase/ssr` (`auth.getUser()`). Sem usuário: `/api/*` → **401 JSON** `{ok:false, error:"Sessao expirada. Entre de novo."}`; páginas → `/login?next=<rota>`.
- Não checa perfil nem módulo (isso é feito nos hooks e na RLS).

### 1.6 Clientes Supabase (`lib/supabase/client.ts`)

- `createSupabaseBrowserClient()` (navegador), `createSupabaseServerClient(cookies)` (rotas/Server Components), `createSupabaseServiceClient({email, origem})` (service role; envia `X-Painel-Ator`/`X-Painel-Origem` para a auditoria registrar quem agiu).
- `fetchAllRows()` pagina de 1000 em 1000 (teto do PostgREST).
- Tabelas fora do tipo `Database` são acessadas com cliente `as any` (padrão do projeto).

### 1.7 Convenções

- **IDs** gerados no cliente: `gerarId("EMP")` → `EMP-XXXXXXXX` (8 hex). Essencial para a fila offline ser idempotente.
- Tema: nomes de cor legados — `verde-primary` hoje é azul `#0ea5e9`; topbar dos módulos em gradiente verde `#006B54 → #00795e`; modo escuro por CSS vars.
- Mensagens e comentários do código em português; regras em `lib/` têm testes.

---

## 2. Autenticação, perfis e permissões

### 2.1 Login (`app/(public)/login/page.tsx`)

1. `signInWithPassword` (e-mail em minúsculas). "Invalid login credentials" → "Email ou senha incorretos".
2. Busca `usuarios` pelo e-mail: não achou → "não cadastrado" + `signOut`; `ativo_sistema = false` → "inativo" + `signOut`.
3. Redireciona para `?next=` (se começar com `/`), senão `/portal-cliente/inicio` (Cliente) ou `/inicio`.
4. Logo vem de `configuracoes.logo_url` (fallback `/logo-jcn.svg`). Não há "esqueci a senha": o Admin troca a senha em Usuários.

### 2.2 Sessão no cliente

- `useAuth()` (todo layout protegido): valida a sessão, carrega o perfil completo de `usuarios` (inclui `funcoes_painel(ve_presenca_auditoria)`), manda Cliente para o portal, escuta `onAuthStateChange` e liga o ping de presença.
- Stores Zustand (`lib/store.ts`): `useUserStore` (não persiste), `useUnidadeAtiva` (localStorage), `useSidebarMini`, `useTema`.

### 2.3 Usuário (`usuarios`)

Campos principais: `id_usuario` (`USR-…`), `nome`, `email`, `cargo`, `perfil`, `ativo_sistema`, `empresas_vinculadas[]`, `unidades[]`, `modulos_permitidos[]`, `funcao`, `nivel`, `pode_criar/editar/excluir`, `pode_escrever_quimicos`, `pode_enviar_sgg`, `concedido_por/em`, assinatura (`assinatura_url`, `mostrar_assinatura_imagem`), certificado (`tipo_certificado` A1/A3, `certificado_pfx_path`, `certificado_validade`, `certificado_titular`), registro profissional (`cpf`, `crp`, `crm`, `registro_mte`).

### 2.4 Perfil, nível e função

- **Perfil** (decide a escrita no banco): `Admin | Tecnico | Visualizador | Cliente`. `caller_pode_editar()` = Admin ou Tecnico ativo; Visualizador só lê; Cliente só usa o portal.
- **Nível** (decide o que a tela libera): `Consulta | Operacao | Aprovacao | Admin`. **Supervisor** = perfil Admin ou nível Aprovacao/Admin — reabre documento de outro, troca responsável, abre as configurações dos módulos.
- **Função** (`funcoes_painel`): padrão aplicado ao criar a conta (perfil, nível, flags, módulos, unidades "da base"/"todas", `ve_presenca_auditoria`). 10 funções semeadas: Técnico de campo, Administrativo, Psicossocial, Supervisor dos técnicos, Engenheiro, Supervisora do administrativo, Gerente, TI, RH, Comercial. `cargos_painel` é uma lista fixa de cargos.

### 2.5 Permissões na tela (`lib/hooks/useUsuario.ts`)

`useCanEdit` (Admin ou `pode_editar`), `useCanCreate`, `useCanDelete`, `useIsAdmin`, `useIsSupervisor`, `useVePresencaAuditoria`, guardas `useRequireCreate/Edit/Admin`, `usePodeQuimicos`, `usePodeEnviarSgg`.

### 2.6 Acesso por módulo

- **Na tela:** `useRequireModule("<modulo>")` em cada layout — sem o módulo em `modulos_permitidos` → toast e volta para `/modulos`. Registra a abertura (`modulo_abrir` → `modulo_aberturas`, 1× por dia).
- **No banco:** policy RESTRITIVA `rls_modulo_ok(modulo, tabela)` nas tabelas de 14 módulos. Modo em `rls_modulo_config` (`log` = só anota em `rls_modulo_log`; `trava` = bloqueia). **Hoje está em `log`.**

### 2.7 Unidades e escopo por empresa

- `unidades` (`UNI-…`) = bases da JCN. `empresas.id_unidade` (sem unidade = visível a todos). `usuarios.unidades[]` (não-Admin sem unidade não vê nenhuma empresa).
- RLS: leitura `caller_pode_ver_empresa(id_empresa)`; escrita `caller_pode_editar()` + ver a empresa (29 tabelas).
- `empresas_vinculadas`: filtra empresas para Técnico (vazio = todas); Cliente tem exatamente 1.
- "Unidade ativa": escolhida na Visão Geral, filtra as listas dos módulos (`useUnidadeFiltro`).

### 2.8 Portal do cliente (`/portal-cliente/*`)

Início, Documentos, Pendências, Não Conformidades, Plano de Ação, EPI, Solicitações, Meu Perfil. Tabelas `portal_documentos_cliente`, `portal_pendencias_cliente`, `portal_solicitacoes_cliente`, `portal_comentarios`, `portal_anexos` (bucket `portal-anexos`). Do lado interno, `/portal-sst` administra o portal e `LiberarParaPortalBtn` libera documentos.

---

## 3. Registro de módulos, hub e layout

### 3.1 Módulos (`TODOS_MODULOS` em `lib/supabase/types.ts`)

| Chave | Módulo |
|---|---|
| `painel` | Painel SST (inspeções) |
| `psicossocial` | DRPS – Diagnóstico de Riscos Psicossociais |
| `conformidade` | Relatório de Conformidade |
| `nao_conformidade` | Relatório de Não Conformidade |
| `apreciacao_maquinas` | Apreciação de Máquinas |
| `analise_quimicos` | Análise de Químicos |
| `aet` | AET – Análise Ergonômica do Trabalho |
| `aep` | AEP – Análise Ergonômica Preliminar |
| `questionarios_psicossociais` | Questionários Psicossociais (QPS) |
| `investigacao_acidente` | Investigação de Acidente de Trabalho |
| `gestao_gerencial` | Gestão Gerencial (SGG) |
| `epi` | Gestão de EPI |
| `transferencias` | Transferência de Equipamentos entre Bases |
| `equipamentos` | Equipamentos (patrimônio interno) |
| `frota` | Frota – Checklist de Veículos |
| `escala_supervisores` | Escala de Supervisores |
| `dimensionamento` | Dimensionamento de Quadro |

A **Gestão (kanban)** não é um módulo de `modulos_permitidos`: o acesso vem do cadastro de membros (`gestao_membros`).

### 3.2 Hub

- `/inicio` e `/visao-geral` (`VisaoGeralView`): unidades clicáveis (definem a unidade ativa), pendências por módulo, atividade recente, vencimentos e validade de laudos (vencido / vence em 60 dias / em dia), gráficos. Link para `/validades`.
- `/modulos`: cartões dos módulos permitidos, agrupados em Segurança do Trabalho, NR — Fatores Psicossociais e JCN Sistema Interno, ordenados por pendências. Cartões extras: Gestão Gerencial, PDFs (Admin), Presença, Gestão JCN (membros), Sistema (Admin).

### 3.3 Layout dos módulos

- `SidebarShell` (`components/layout/SidebarShell.tsx`): título, seções de itens (`{href, label, icon, variant}`), rodapé fixo (Voltar, Início, Módulos, Empresas, Sair). 220 px, recolhível; gaveta no celular.
- `ModuleTopbar`: recolher menu, breadcrumb, chip da unidade ativa, chip de pendências offline, avatar com perfil.
- Cada módulo tem seu `layout.tsx` com `useAuth()` + `useRequireModule()` + menu próprio. O Painel SST usa `components/layout/Sidebar.tsx`: Principal (Dashboard, Inspeções, Relatórios, Certificados, Riscos Psicossociais — os dois últimos ocultos para Cliente), Ações, Configuração.

---

## 4. Área administrativa (Sistema)

Menu: Usuários, Funções, Configurações, PDFs Gerados, Lixeira, Auditoria, Presença. Admin vê tudo; quem tem `ve_presenca_auditoria` vê só Presença e Auditoria.

### 4.1 Usuários (`/usuarios`)

- Formulário: nome, e-mail, senha; **função** (obrigatória ao criar, aplica os padrões); cargo; CPF/CRP/CRM/MTE; perfil; flags; empresas vinculadas (Técnico: várias; Cliente: 1); unidades (≥1); módulos; papel na Gestão; imagem de assinatura (bucket `fotos`); certificado A1/A3 (upload do .pfx em `/api/cert/upload`, bucket privado `certificados`; "Verificar" em `/api/cert/validar` lê validade e titular — a senha nunca é gravada).
- O campo "Nova senha" usa `autocomplete="new-password"` (o navegador não autopreenche).
- **Criar** `POST /api/usuarios/criar` · **Credenciais** `POST /api/usuarios/credenciais` · **Excluir** `POST /api/usuarios/excluir` — só Admin, respostas `{ok, error}`:
  - Com `SUPABASE_SERVICE_ROLE_KEY`: Admin API do Auth (`createUser` com e-mail confirmado + INSERT, desfeito se falhar; `updateUserById`; `deleteUser`).
  - Sem a chave (situação atual da Vercel): funções SECURITY DEFINER `criar_usuario_admin` (+ UPDATE do resto do perfil; desfaz com `excluir_usuario_admin` se falhar), `redefinir_senha_admin`, `atualizar_email_admin`, `excluir_usuario_admin`. **A função de criar grava `''` nas colunas de token de `auth.users`** (NULL quebra o login: "Database error querying schema").
  - Trocar a **própria** senha usa `supabase.auth.updateUser` direto, sem rota.
- Após criar, chama a edge function `welcome-email` (Resend; opcional).

### 4.2 Funções (`/funcoes`)
CRUD de `funcoes_painel`, contas por função, lista de cargos, painel da trava por módulo (`rls_modulo_resumo`, `rls_modulo_por_tela`, `rls_modulo_log`).

### 4.3 Configurações (`/config`)
Abas: Matrizes de Risco, Tipos de Risco, Perguntas Customizadas, Matriz Padrão, Listas Auxiliares, Probabilidade & Severidade (legado), Níveis, Logo, Assinatura da Empresa, Textos Padrão, Unidades. Tabela `configuracoes` (chave/valor jsonb): `probabilidades` (Improvável, Remoto, Ocasional, Provável, Frequente), `severidades` (Insignificante, Marginal, Crítico, Catastrófico), `meios_propagacao`, `situacoes`, `tempos_exposicao`, `tecnicas`, `logo_url`, `assinatura_empresa_url`.

### 4.4 PDFs Gerados (`/pdfs-gerados`)
Lista `pdfs_gerados` (status `gerado`/`congelado`, versão, sha256, arquivo no bucket privado `pdfs-gerados`) e `pdfs_assinados`.

### 4.5 Lixeira (`/lixeira`)
`registros_excluidos` guarda o snapshot (`dados` jsonb) antes de excluir. `excluirComLixeira()`: grava snapshot → DELETE → se falhar, apaga o snapshot → auditoria. Soft delete (`DELETADO/DELETADA`) registra o status anterior. Restaurar: re-INSERT (hard) ou volta o status (soft).

### 4.6 Auditoria (`/auditoria`)
- `auditoria_eventos`: gatilhos em todas as tabelas de `auditoria_tabelas` (tabela nova liga sozinha). Grava quem, quando, tabela, registro, módulo, empresa, ação (criou/editou/excluiu) e, na edição, só os campos alterados (com diff de jsonb de 1 nível); segredos e imagens mascarados; busca textual sem acento.
- Legado: `document_audit_logs` (histórico por documento; assinatura de PDF grava `assinou_pdf`).
- Tela com filtros (período, e-mail, módulo, ação, empresa, tabela, registro, campo, texto) e paginação por cursor.

### 4.7 Presença (`/presenca`)
Ping a cada 60 s (aba visível, atividade nos últimos 5 min, online, uma aba por vez, exceto Cliente) → `presenca_ping` grava blocos de 5 min em `presenca_pings`. Ativo ≤ 5 min, ausente ≤ 30 min, fora > 30 min. Admin pode encerrar a sessão de alguém (`presenca_encerrar_sessao`). Retenção 180 dias (limpeza disparada pelo navegador do Admin).

### 4.8 Novidades
Catálogo no código (`lib/novidades/catalogo.ts`) + avisos no banco (`novidades_avisos`) + lidos (`novidades_vistas`). Exibidas nas páginas de Ajuda de cada módulo.

---

## 5. Recursos transversais

### 5.1 Offline — "Levar para o campo" (`lib/offline/*`)

- IndexedDB `painel-sst-offline` (v4): `documentos` (cópia do documento levado), `operacoes` (fila de escrita), `imagens` (blobs), `saidas` e `veiculos` (Frota).
- Botão **Levar para o campo** grava o pacote já carregado da tela (inspeções, apreciação, conformidade, NC, equipamentos, AEP, AET).
- `gravar(pedido)` é a porta única de escrita: sem rede → enfileira; com rede → tenta; falha de rede → enfileira e devolve sucesso; outro erro → propaga.
- Fila: insert/update/delete/upsert, status `PENDENTE | ENVIADA | RECUSADA`, até 5 tentativas; envio sequencial, imagens antes da linha, PK duplicada conta como sucesso. `/pendencias` lista o que está no aparelho; chip na topbar.
- Service worker (`public/sw.js`) só faz a casca abrir offline. Rascunhos locais (`useRascunho`, 1 h, restauração manual).

### 5.2 Geração de PDF

- **Servidor** (`app/api/pdf/<modulo>/[id]`): aep, aet, analise-quimicos, apreciacao, conformidade, drps, epi-entrega, equipamento-termo, escala-resumo, investigacao-acidente, nao-conformidade, plano-acao, qps, transferencias; mais `registrar` e `token`. Fluxo: sessão por cookie → dados sob RLS → assina URLs de mídia → `renderToStaticMarkup(<Template/>)` (`components/pdf/templates/*`, folha de assinaturas em `components/pdf/FolhaAssinaturas.tsx`) → `gerarPdf()` (`lib/pdf/gerar-pdf.ts`: puppeteer-core + @sparticuz/chromium na Vercel; margens 20/20/15/15 mm; numeração de páginas via pdf-lib) → anexos → `application/pdf`.
- **Cliente:** `lib/gerarPdfBase.ts` (html-to-image + jsPDF, força tema claro). `BotaoGerarPdf` prefere a rota do servidor. `useRegistrarPdf` → `/api/pdf/registrar` grava em `pdfs-gerados` + `pdfs_gerados`.
- **Congelamento:** versão imutável (sha256, `status='congelado'`) como base da assinatura.
- **Assinatura A1** (`POST /api/sign-pdf`): lê o .pfx do signatário (bucket `certificados`, service role), valida senha e validade, assina **PAdES ICP-Brasil** (`lib/pdf/assinar-pdf-pades.ts`), grava em `pdfs-assinados/<tabela>/<docId>.pdf`, `pdfs_assinados` e auditoria. Assinar por outro exige Admin/Técnico. **A3 só aparece como selo** (sem assinatura real).
- **Assinatura por imagem** (`/api/sign-image`): registra `tipo_assinatura='imagem'`.

### 5.3 Textos padrão (`textos_padrao`)

Capítulos por módulo (`sst`, `conformidade`, `nao_conformidade`, `analise_quimicos`, `apreciacao_maquinas`, `aep`, `aet`, `psicossocial`, `plano_acao`, `qps`): título, conteúdo HTML (TipTap), imagem de fundo (capa), caixas de texto posicionadas, orientação, quebra de página, **posição no PDF** (`inicio`, `apos_sumario`, `apos_setores`, `apos_conclusao`, `apos_medidas`, `fim`), fixo/editável, bloqueado, obrigatório. Versões em `textos_padrao_versoes`. Variáveis `{{chave}}` substituídas na montagem (empresa: nome, razão social, CNPJ/CPF/CEI/CAEPF/CNO, endereço, município, UF, CEP, telefone, e-mail, CNAE, porte; datas; responsável; campos por módulo) — `lib/textos-padrao/variaveis*.ts`.

### 5.4 Storage

Buckets: `fotos` (público), `anexos` (público), `certificados` (privado, só Admin), `pdfs-gerados` (privado), `pdfs-assinados` (privado), `portal-anexos` (privado), `atualizacoes`/`updates` (legado). `lib/storage/signed-url.ts` resolve path/URL pública/assinada (`StorageImg`, `useSignedUrl`).

### 5.5 Busca tolerante (`lib/busca/texto.ts`)

Ignora acento, caixa, pontuação e ordem das palavras; aceita prefixo; tolera erros de digitação (Damerau-Levenshtein: 1 erro a partir de 4 letras, 2 a partir de 7); códigos comparados pelos dígitos; sem resultado exato devolve os mais parecidos (`aproximado: true`). Variantes `buscarEmpresas`, `buscarAcoes`.

### 5.6 IA (Groq)

Edge functions (Supabase): `gerar-conclusao-drps-ia` (DRPS e QPS), `gerar-parecer-aep-ia`, `gerar-analise-setor-aet-ia`, `gerar-consideracoes-aet-ia`, `gerar-observacao-psi-ia`, `gerar-acao-ia`, `analisar-maquina-ia`, `gerar-observacao-conformidade-ia`, `gerar-obs-gerais-conformidade-ia`, `gerar-treinamentos-inspecao-ia`, `extrair-campos-fispq`, `analisar-quimico-ia`, `gerar-parecer-apreciacao-ia`, `analisar-foto-apreciacao-ia`, `gestao-ia`. Texto: `llama-3.1-8b-instant`. Rotas Next com IA: `/api/gerar-analise-setor-aet-ia`, `/api/gerar-intro-capitulo-aet-ia`, `/api/maquina/analisar-foto` (visão). Todo texto gerado passa por revisão humana (`RevisaoIAModal`).

### 5.7 E-mail
Só a edge function `welcome-email` (Resend). Sem `RESEND_API_KEY` responde `{sent:false}`.

### 5.8 Google Agenda (Gestão)
OAuth (`/api/gestao/google/connect` → `callback`, refresh token cifrado com `GESTAO_GOOGLE_ENC_KEY`), sincronização da fila `gestao_google_fila` (`/sync`, disparada ao abrir `/gestao`), webhook do Google (`/webhook`), feed `.ics` (`/api/gestao/ics`) e formulário público (`/api/gestao/form` + `/f/[token]`).

### 5.9 Outras APIs
`/api/cnpj/[cnpj]` (BrasilAPI com fallback publica.cnpj.ws), `/api/frota/cep/[cep]`, `/api/sgg/enviar-riscos`, `/api/equipamentos/biometria/verificar`, `/api/dimensionamento/sincronizar`.

---

## 6. Empresas e unidades

- **Empresa** (`empresas`, `EMP-…`): nome, razão social, fantasia; CNPJ/CPF/CEI/CAEPF/CNO; grau de risco (1–4) com origem `NORMA`/`MANUAL`; status; endereço completo; telefone, e-mail; CNAE principal e descrição; situação cadastral; porte; `id_unidade`; `tipo_estabelecimento` (`CLIENTE`/`TERCEIROS` + `id_empresa_contratante`); referência, locais de emergência, dados adicionais; vínculo SGG.
- **CNPJ:** `/api/cnpj/[cnpj]` preenche endereço, CNAE e porte.
- **Grau de risco NR-4:** `cnae_grau_risco` (Anexo I) + `lib/nr4/grau-risco.ts` (subclasse de 7 dígitos → classe de 5); sugerido automaticamente; obrigatório exceto para TERCEIROS.
- Detecção de duplicatas (CNPJ/nome), importação em lote CSV/XLSX, lista com filtro de unidade e busca tolerante.
- Detalhe `/empresas/[id]`: Visão geral, Dados cadastrais, Registros por módulo, Documentos & Laudos (quadro DRPS/QPS/AEP/AET), Inspeções; relatório da empresa.
- **Unidades** (bases JCN) em Configurações › Unidades.

---

## 7. Módulos de SST

**Comum a todos:** IDs `PREFIXO-XXXXXXXX` (AEP e AET usam uuid); capítulos do laudo em `textos_padrao` (AEP e AET também têm `aep_textos_padrao`/`aet_textos_padrao`); capítulos **fixos** (gerados pelo sistema, identificados por `slug_fixo`, ex.: `sumario`, `identificacao_empresa`, `sst_corpo`) intercalados com os editáveis pela `ordem`; PDF no servidor (`/api/pdf/<modulo>/[id]`); assinatura digital; "Levar para o campo"; lixeira; `data_validade` alimenta os alertas de vencimento; **a IA só sugere** — um modal permite aceitar, editar ou rejeitar antes de gravar.

### 7.1 Painel SST / Inspeções (`app/(app)`)

**Propósito:** inspeção de campo de SST (NR-01/PGR) — setores, cargos, riscos, EPIs, fotos, PAE, treinamentos, extintores, máquinas, AEP/AET. Gera o Relatório de Inspeção e o PGR; depois o administrativo elabora o documento no SGG.

**Dashboard (`/dashboard`):** KPIs (Empresas Ativas, Total de Inspeções, Em Andamento, Concluídas, Rascunhos — todos excluem `tipo_criacao='RENOVACAO'`); gráficos: inspeções concluídas por mês (`concluida_em`), por status, documentos concluídos pelo ADM por mês, documentos por situação (Pendentes / Assumidos / Concluídos), documentos associados por mês e por associado; atividade recente. Regras em `lib/dashboard/inspecoes.ts` e `documentos.ts`. Subpáginas: `/dashboard/inspecoes-concluidas` (produção por técnico — crédito para quem está na aba Responsáveis; com 2 técnicos cada um recebe a inspeção inteira; sem registro, quem abriu), `/dashboard/documentos-emitidos`, `/dashboard/por-associados`. `/relatorios` → relatório da empresa.

**Lista (`/inspecoes`):** pílulas Todos · Rascunho · Em Andamento · Concluídas · Associados; filtros empresa, técnico, associado, unidade, período. Trocar o técnico responsável exige supervisor.

**Nova (`/inspecoes/nova`):** empresa + tipo: `BRANCO`, `REVISAO` (copia inspeção da mesma empresa), `COPIA_EMPRESA` (copia de outra empresa), `RENOVACAO` (registro administrativo; não conta nos gráficos). Revisão = maior revisão da empresa + 1. A cópia escolhe o que levar (setores, cargos, riscos, EPIs, responsáveis, fotos) e remapeia os IDs. "Quem vai a campo" cria `responsaveis` (com `id_usuario` quando casa com uma conta). Nasce `EM_ANDAMENTO`. `/inspecoes/ficha` gera a **Ficha de Inspeção** em branco para imprimir.

**Editor (`/inspecoes/[id]`, aba na URL `?aba=`):**
1. **Setores** (`setores`): setor/GHE, descrição, conformidades, não conformidades.
2. **Cargos** (`cargos`): setor, cargo, descrição.
3. **Riscos** (`riscos`, `RiscoForm.tsx`): cascata **Tipo** (`tipos_risco`) → **Triagem** (`triagens_*`) → **Modelos/kits** (`modelos_risco` + itens e perguntas) + catálogo livre que aprende (`itens_catalogo_tipo`). Multi-setor: **1 risco por (modelo × setor)**. Tipos: Acidente, Ergonômico, Físico, Químico, Biológico, Psicossocial, Ambiental, IAPAT. Campos: agente, fonte geradora, probabilidade, severidade, nível, matriz, situação, tempo de exposição, técnica, concentração, limite de tolerância, insalubridade, periculosidade, CAS, via de absorção, meios de propagação; Físico (necessita medição/qual/motivo); Químico com pré-classificação **NHO-08** (6 perguntas) e foto da FDS; medidas adotadas e recomendadas (lista JSON); respostas de perguntas personalizadas; 4 blocos de EPI/EPC (utilizado/recomendado). Botão envia riscos **Alto e Muito Alto** ao Plano de Ação.
4. **EPIs/EPCs** (`epi_epc`): risco, tipo, descrição, CA, recomendado, fotos.
5. **Fotos** (`fotos`): categorias Setor, EPI, EPC, Máquinas e Equipamentos, Produto Químico, Kit de Primeiros Socorros, Extintor, Geral; legenda; setor. Bucket `fotos`.
6. **Responsáveis** (`responsaveis`): técnico, conta, recepcionado por, cargo, data/hora.
7. **PAE** (`pae_contatos`): árvore hierárquica de contatos de emergência (até 8 níveis).
8. **Treinamentos** (`treinamentos_nr` + vínculos N:N com setor, cargo e risco): NR, título, descrição, carga horária, periodicidade (Inicial, Periódico, Reciclagem anual/bienal, Eventual); IA sugere por setor.
9. **Extintores** (`extintores`): agente, capacidade, identificação, localização, validade, situação (Conforme / Não conforme / Não avaliado) com causas (críticas: Vencido, Danificado, Lacre violado, Obstruído; não críticas: Sinalização inadequada, A vencer em 3 meses, Fora da altura, Sem inspeção periódica). CHECK no banco garante coerência.
10. **Máquinas** (`inspecao_maquinas` + `inspecao_maquinas_setores`): identificação, dados técnicos, proteções e dispositivos (booleans), grau de risco, parecer da IA, operadores, fotos; IA de visão sugere campos; **"Enviar p/ Apreciação NR-12"** copia para `inventario_maquinas` sem duplicar.
11. **AEP** e 12. **AET** (v259): o laudo nasce em `aep_relatorios`/`aet_relatorios` com `id_inspecao`, já com os setores, cargos (e máquinas, na AET) da inspeção; usa os **mesmos editores dos módulos** (extraídos para `components/aep` e `components/aet`); até clicar em **"Enviar para o módulo"** (`enviado_modulo_em`), fica fora das listas do módulo; é o mesmo registro nos dois lados. Abas só para quem tem o módulo.
13. **Complementos** (`complementos`): Procedimento, Ordem de Serviço, Treinamento, Inspeção Periódica, Sinalização, Documento, Outro.
14. **Observações** (`inspecoes.observacoes`).

Cabeçalho do editor: links Relatório, PGR e Ficha; dados da empresa; quadro **Documentos da empresa** (DRPS, QPS, AEP, AET por fase — Em andamento, Concluído, Enviado ao cliente; visível a todos); Levar para o campo; Concluir, Reabrir (supervisor ou criador), renovação; **Copiar para empresa**.

**Relatório de Inspeção (`/inspecoes/[id]/relatorio`):** capítulos editáveis antes/depois de `sst_corpo` (padrão: Introdução, Metodologia, Considerações Finais). Corpo: identificação da empresa; resumo por nível e categoria; bloco **por setor** (conformidades, fotos, cargos, riscos por tipo com NHO-08 e EPIs, treinamentos, extintores, máquinas); itens gerais; observações; PAE; responsáveis. Card **Documento (SGG)**: fluxo de elaboração + associados + envio de riscos ao SGG. Não tem rota `/api/pdf` — usa captura da página (`BotaoGerarPdf`) e pode ser assinado.

**PGR (`/inspecoes/[id]/pgr`):** Resumo quantitativo; Inventário de riscos (Setor → Cargo → Tipo); Detalhamento por risco; Plano de ação (riscos com medidas recomendadas); Responsáveis; PAE; Observações.

**Tabela `inspecoes`:** empresa, data, status (`RASCUNHO | EM_ANDAMENTO | CONCLUIDA | DELETADA`; concluir grava `concluida_em`), revisão, responsável, observações, `tipo_criacao` (`BRANCO | REVISAO | COPIA_EMPRESA | RENOVACAO`), `id_inspecao_base`, usuário, validade, **elaboração** (`elaboracao_status`: PENDENTE → EM_ELABORACAO → CONCLUIDO, com responsável e data; `inspecao_associados`).

**Cálculo de risco (atual):** `calcularNivelComMatriz(prob, sev, matriz)` (`lib/calc.ts`) sobre `matrizes_risco` (probabilidades, severidades, `lookup[iP][iS]`, pesos, faixas, ativa). Com pesos e faixas: `score = peso_prob × peso_sev` → nível pela faixa (padrão: Trivial 0; Baixo 1–2; Moderado 3–6; Alto 7–10; Muito Alto ≥11); sem pesos usa o `lookup`. Matriz **ativa: AIHA 5×5** (probabilidade: Não há exposição … Exposição elevadíssima; severidade: Pouca importância, Preocupantes, Severos, Irreversíveis, Ameaça). Cada risco pode ter sua própria matriz. (Legado: `calcularNivelRisco` 5×4 em `lib/utils.ts`.)

**Risco → Plano de Ação** (`lib/acoes/de-risco.ts`): só Alto (prioridade Alta) e Muito Alto (Crítica); "o quê" = medidas recomendadas; "por quê" = tipo, agente, nível, prob/sev, fonte; "onde" = setor.

**Plano de Ação central (`/acoes`, `acoes_5w2h`):** what, why, where, when (date), who, how, how much, status (Pendente, Em Andamento, Concluida, Cancelada), prioridade (Baixa, Media, Alta, Critica), origens (`id_risco_origem`, `id_apreciacao_item/acao`, `id_aet_acao`). Agrupado por empresa e prazo; PDF por empresa (`/api/pdf/plano-acao/[idEmpresa]`); IA `gerar-acao-ia`.

**Certificados (`/certificados`, `certificados_treinamento`):** certificados de treinamento emitidos aos trabalhadores — empresa, trabalhador, CPF, setor, cargo, NR, treinamento, carga horária, datas, validade, número, instrutor, **emitido por** (conta + nome gravado). Quadro "Por emissor", cartões (total, no mês, vencem em 30 dias, vencidos), filtros. Escrita só Admin/Técnico (RLS). Oculto para Cliente.

**Riscos Psicossociais:** ver 8.3.

### 7.2 Relatório de Conformidade (`/relatorio-conformidade`)

Empresa + NR do catálogo (`lib/conformidade/checklists.ts`: NR-01, 05, 06, 07, 09, 10, 12, 17, 20, 23, 24, 26, 35) ou "LIVRE". Itens **copiados** para `relatorios_conformidade_itens` (situação `CONFORME | NAO_APLICAVEL | PENDENTE`, observação, fotos até 8 MB, itens de outra NR ou livres). Relatório `RASCUNHO → FINALIZADO` (finalizado = somente leitura). **Avaliação % = (Conformes + N/A) / total × 100.** IA para observações. Laudo: Introdução, Fundamentação Legal, itens por NR, resultado %, Considerações Finais, assinaturas (Responsável Técnico e Responsável da Empresa).

### 7.3 Relatório de Não Conformidade — RNC (`/relatorio-nao-conformidade`)

`relatorios_nao_conformidade` (título, setor, NR opcional…) + itens (descrição, norma violada, **criticidade** ALTA/MEDIA/BAIXA, causa raiz, ação corretiva, prazo, responsável, **tratativa** ABERTA → EM_TRATAMENTO → ENCERRADA, fotos). "Inserir do checklist da NR" cria a NC já preenchida. Resumo por criticidade. Laudo: Introdução, Metodologia, descrição das NCs, plano (ações, responsáveis, prazos), Considerações Finais, assinaturas.

### 7.4 Apreciação de Máquinas NR-12 (`/apreciacao-maquinas`)

- **Nova:** empresa, responsáveis, data, notificação SIT — **importa automaticamente** as máquinas da inspeção da empresa como **fichas**, agrupadas por setor.
- `apreciacoes_maquinas` (laudo: conclusão técnica, recomendações, risco residual, componentes, limites de uso/espaço/tempo, NPE, sistemas de segurança atuais e necessários, incluir checklist no PDF, validade), `apreciacao_fichas_maquina` (uma por máquina: identificação, componentes — 12 opções, sistemas de segurança — 10 opções, constatações, parecer, operadores, fotos), `apreciacoes_maquinas_itens` (checklist por ficha: **38 itens NR-12** em 11 categorias — Portaria 916/2019; situação `CONFORME | NAO_CONFORME | NAO_APLICAVEL | PENDENTE`; prob/sev/nível pela matriz), `apreciacao_riscos_hrn`, `apreciacao_perigos_catalogo` (pré-preenche perigos), `apreciacao_acoes` (5W2H). Inventário em `/relacao-maquinas` (`inventario_maquinas`).
- **Método HRN (ISO/TR 14121-2):** POD (Muito Provável 4, Provável 3, Improvável 2, Remota 1) × FEP (Diariamente 4, Semanalmente 3, Mensalmente 2, Anualmente 1) × GPD (Catastrófica 4, Grave 3, Moderada 2, Baixa 1) = **HRN 1–64**; classificação sugerida ≤8 Desprezível, ≤18 Baixo, ≤36 Médio, >36 Alto (o técnico pode alterar); risco residual pela mesma régua; NPE só informativo; categoria de segurança NBR 14153 (B, 1–4).
- Só finaliza sem itens pendentes. "Gerar plano" cria ações para os itens não conformes (prioridade pelo nível); pode enviar ao Plano de Ação central.
- **Laudo:** capa, sumário, identificação, Introdução, Fundamentação Legal, Objetivo/Base normativa/Método, Relação de máquinas, **Apreciação por máquina** (Setor → Máquina, 4.1, 4.2… com identificação, foto, operadores, constatações, tabela perigo → risco inicial → medidas de engenharia/administrativas → risco residual, parecer; checklist opcional), Conclusão Geral, Plano de Ação NR-12, Considerações Finais, assinatura. IA de parecer e de análise de foto.

### 7.5 Análise de Químicos (`/analise-quimicos`)

- `analises_quimicos`: produto, CAS, fórmula, forma física, concentração, modo (PDF da FISPQ ou Manual), condições de uso (atividade, frequência, duração, ventilação, névoa/vapor, EPIs), **conclusão rápida** (insalubridade NR-15 com grau/anexo/fundamentação, aposentadoria especial, Decreto 3048, código GFIP, eSocial tab. 24, óleo mineral, carcinogênico, periculosidade NR-16, EPIs/EPCs, medidas, emergência, medição, metodologia, limite de exposição, resumo), origem `template` ou `ia`.
- `base_referencia_quimicos` (e cópia estática `lib/quimicos/base_referencia.ts`): agente, CAS, LT mg/m³ e ppm, grau NR-15, teto, pele, eSocial, IARC, inflamável, cancerígeno, TLV ACGIH, Decreto 3048, GFIP, anexo.
- **Fluxo:** FISPQ em PDF → parser (`lib/fispq/parser.ts`) → revisão → CAS casados com a base; IA completa campos faltantes. Lookup por CAS e depois por nome; em misturas, **pior caso** (pior grau NR-15 e IARC). **Tudo na base → conclusão por template, sem IA** (`lib/quimicos/gerarTemplate.ts`); algum componente fora da base → IA `analisar-quimico-ia`.
- **Laudo:** identificação do agente, condições de uso, insalubridade NR-15, periculosidade NR-16, previdenciário, carcinogenicidade, óleo mineral, medidas de controle, emergência, medição, parecer técnico, quadro decisório, assinatura.

### 7.6 AEP — Análise Ergonômica Preliminar (`/aep`)

- `aep_relatorios` (uuid): empresa, status (`RASCUNHO | CONCLUIDO`), **`setores` jsonb**, responsável, título e registro profissional, datas, endereço, conclusão, `id_inspecao`, `enviado_modulo_em`.
- **Setor:** nome, unidade, GHE, cargo, função, jornada, expostos, descrição da atividade, método de coleta, trabalhadores consultados, cargos (cargo, descrição, quantidade), riscos (tipo, risco, classificação — Trivial, De Atenção, Moderado, Alto, Crítico — medida preventiva), **checklist física** (9 itens: postura, repetitividade, levantamento de carga, mobiliário, esforço físico, iluminação, ruído, vibração, desconforto térmico), **cognitiva** (5 itens), **organizacional** (13 fatores psicossociais, com 95 sinais em `lib/aep/sinais-organizacional.ts`), observações, parecer (IA), recomendações, **necessita AET**.
- **Regra `calcNecessitaAet`:** pelo menos 1 risco Alto ou Crítico, **ou** pelo menos 2 Moderados. Considerações automáticas quando vazias (`lib/aep/consideracoes.ts`).
- Telas: lista, dashboard, novo, formulário em branco, Setores/Triagem, Dados/Conclusão, Laudo. Laudo: identificação, sumário, capítulos, escalonamento para AET, triagem por setor, considerações, assinatura.

### 7.7 AET — Análise Ergonômica do Trabalho (`/aet`)

- `aet_relatorios` (uuid): empresa, datas, responsável, status (`RASCUNHO | CONCLUIDO`), **`setores` jsonb**, considerações finais, **`textos_secoes`** (Introdução, Objetivo, Metodologia, Levantamento/Transporte de Materiais, Mobiliário, Equipamentos, Condições Ambientais, Organização do Trabalho, Ferramentas Biomecânicas), endereço, validade, `id_inspecao`, `enviado_modulo_em`.
- **Setor:** nome, função, máquinas/equipamentos, cargos, descrição, riscos (tipo, risco, intensidade, técnica, EPI/CA, eficácia, classificação), **OWAS** (costas 1–4, braços 1–3, pernas 1–7, esforço 1–3 — seleção múltipla; imagens de referência em `/owas/*.svg` ou personalizadas), checklist ergonômico (levantamento, posturas forçadas, trabalho em pé/sentado, pausas, cadeira, monitor, ritmo, rodízios…), perguntas extras, fotos (até 6), parecer, recomendações.
- **13 fatores psicossociais** (`aet_13fatores_config`/`_perguntas`/`_semaforo`, respostas 1–5 por setor em `aet_laudo_qps_respostas`): média do fator = média de (6 − nota) nas perguntas diretas e da própria nota nas invertidas, com 2 casas; **zona** ≥4,0 verde, ≥3,0 amarela, ≥2,0 laranja, <2,0 vermelha (`lib/aet/consolidar-psi.ts`); observação por fator (IA).
- **Plano de ação** (`aet_acoes`, 5W2H por setor), envio opcional ao Plano central.
- Configuração: OWAS, perfis de posturas, 13 fatores, checklist (só as alterações vão ao banco), textos padrão.
- **Laudo:** identificação, sumário, seções, agentes ambientais, análise ergonômica (OWAS, biomecânica, checklist), psicossocial (se avaliado), plano de ação, considerações finais, assinatura. IAs: análise do setor, introdução de capítulo, considerações.

### 7.8 Investigação de Acidente (`/investigacao-acidente`)

- `investigacoes_acidente` — dados gerais (data, hora, local, setores, CAT, nº de acidentados); **acidentado** (nome, cargo/funções, CPF, PIS, dados pessoais, CBO, tempos de função/empresa, jornada); **acidente** (tipo TÍPICO/TRAJETO/DOENÇA, afastamento e dias, gravidade LEVE/GRAVE/FATAL, descrição, agente causador, **partes do corpo em mapa frente/costas**, natureza da lesão, CID, consequências, fatores); testemunhas, pessoas envolvidas (organograma), organização do trabalho, atividade no momento, relatos; mídia (croqui, mapa de riscos, fotos antes/momento/atual/depois, vídeos); **análise** (causas imediatas e básicas, **5 Porquês** — até 5, **Ishikawa 6M** — Método, Máquina, Mão de obra, Material, Medição, Meio ambiente — fatores contribuintes sim/não/parcial/N/A, laudos externos, equipe e consultores); medidas recomendadas, conclusão, medidas adotadas, cronogramas; controle (responsável legal, status `RASCUNHO | CONCLUIDA | DELETADA`, validade).
- `investigacao_acoes` (5W2H próprio).
- PDF: dados, acidentado com mapa corporal, descrição, testemunhas e envolvidos, análise de causas, medidas, cronograma e plano.


---

## 8. Módulos psicossociais

### 8.1 DRPS — Diagnóstico de Riscos Psicossociais (`app/(psicossocial)`)

**Propósito:** diagnóstico NR-01 a partir de um questionário de **50 perguntas** (modelo "NR_01_50P_Atual_13F", aplicado via Google Forms). Resultado: matriz **Gravidade × Probabilidade** por setor (e opcionalmente por unidade do cliente) e laudo PDF assinado pelo psicólogo (CRP).

**Telas globais:** lista por empresa; `novo` (empresa, data, responsável, CRP; revisão = maior revisão da empresa, inclusive excluídas, + 1; nasce `EM_ANDAMENTO`); `dashboard-geral` (kanban de 4 colunas: Rascunhos, Em andamento, Concluídos, Enviados para clientes — arrastar muda o status); `empresas` (empresas com DRPS ou QPS); catálogos `agravos` (`drps_agravos`), `medidas-recomendadas` (`drps_medidas_recomendadas`), `acoes-plano` (`drps_acao_oque` → `drps_acao_como`); `texto-padrao`; `metodologia`; `criterios` (guia de probabilidade: Frequência, Histórico, Recursos × Baixa/Média/Alta).

**Telas por relatório** (`/psicossocial/[idRelatorio]/…`): `dashboard`, `dados` (importação), `escala` (50 perguntas: média bruta, corrigida, gravidade), `resumo` (**edita a probabilidade**), `analise`, `conclusao-geral`, `plano-acao` (5W2H), `gestao`, `medidas` (plano anual), `monitoramento`, `revisao`, `laudo`, `metadados`. Filtro global de Setor e Unidade (`components/drps/DrpsFiltro.tsx`, persistido).

**Tabelas:**
- `drps_relatorios` (`DRPS-XXXXXXXX`): empresa, revisão, **status** (`RASCUNHO | EM_ANDAMENTO | CONCLUIDO | ENVIADO_CLIENTE | DELETADO`), datas (elaboração, validade, conclusão, envio ao cliente), responsável técnico, CRP, funções, quantidades; jsonb por setor: `agravos_por_setor`, `medidas_por_setor`, `conclusoes_por_setor`, `fontes_por_setor`; jsonb por unidade: `*_por_unidade_setor`; `conclusao_geral` (HTML).
- `drps_respondentes`: setor, cargo, `unidade_trabalho`, `respostas int[]` (10–90, múltiplo de 10), `data_carimbo`, `lote_importacao`.
- `drps_probabilidades` (relatório, setor, tópico → 1..3) e `drps_probabilidades_unidade` (override por unidade).
- `drps_plano_medidas` (por ano: `{ação: {meses: bool[12], responsavel}}`), `drps_monitoramento` (setor × tópico; status Pendente/Em Andamento/Concluido/Cancelado), `drps_revisao` (checklist, equipe, anotações), `drps_plano_acao_5w2h` (ação, justificativa, onde, prazo, responsável, como, quanto custa, status).
- `psi_fontes_geradoras` (catálogo de fontes geradoras digitadas, DRPS e QPS).
- Trigger `fn_drps_carimbo_envio`: ao virar `ENVIADO_CLIENTE`, preenche `data_envio_cliente`. `data_conclusao` é gravada pela tela ao Concluir. Excluir = soft delete (`DELETADO`) + lixeira.

**Questionário (`lib/drps/topicos.ts`):** 13 tópicos, 50 perguntas em blocos de 5,5,4,4,3,4,4,3,4,4,3,4,3. Escala 0 Nunca · 1 Raramente · 2 Ocasionalmente · 3 Frequentemente · 4 Sempre. Cada pergunta é `direta` ou `invertida`; cada tópico tem uma fonte geradora padrão.

| # | Tópico | Perguntas invertidas |
|---|---|---|
| 01 | Assédio de qualquer natureza no trabalho | 2, 3, 5 |
| 02 | Falta de suporte/apoio no trabalho | todas |
| 03 | Má gestão de mudanças organizacionais | 2, 4 |
| 04 | Baixa clareza de papel/função | todas |
| 05 | Baixas recompensas e reconhecimento | 1, 2 |
| 06 | Baixo controle no trabalho / falta de autonomia | 1, 2 |
| 07 | Baixa justiça organizacional | 1, 2, 3 |
| 08 | Eventos violentos ou traumáticos | — |
| 09 | Baixa demanda (subcarga) | — |
| 10 | Excesso de demandas (sobrecarga) | 4 |
| 11 | Maus relacionamentos no local de trabalho | 3 |
| 12 | Trabalho em condições de difícil comunicação | 4 |
| 13 | Trabalho remoto e isolado | 3 |

**Importação (`parsearTexto`, `lib/drps/calculos.ts`):** aceita colar ou arquivo CSV/TSV/TXT; CSV RFC 4180; separador detectado (tab, `,`, `;`, `|` e variantes); cabeçalho detectado ("carimbo", "timestamp", "qual o seu setor"…); **as respostas são sempre as últimas 50 colunas**; setor/cargo/unidade achados pelo cabeçalho (sem cabeçalho: setor = coluna 1, cargo = coluna 2); linha sem setor é rejeitada; vazio = 0; valores limitados a 0..4; data aceita dd/mm/aaaa, serial do Excel ou ISO. Cada importação tem um `lote_importacao`.

**Cálculos (`lib/drps/calculos.ts`):**
- Pontuação corrigida da pergunta: média das respostas → **arredonda para cima antes de inverter**: `corrigida = invertida ? 4 − ceil(média) : ceil(média)` (n=0 → 0, sem inverter).
- Gravidade da pergunta: ≥3 Alta (3), 2 Média (2), ≤1 Baixa (1).
- Gravidade do tópico: média das gravidades das perguntas; ≤1,66 Baixa, ≤2,32 Média, >2,32 Alta.
- Probabilidade: 1/2/3 informada pelo psicólogo por setor e tópico (padrão 1).
- **Matriz 3×3:**

| Gravidade \ Probabilidade | 1 Baixa | 2 Média | 3 Alta |
|---|---|---|---|
| 1 Baixa | Baixo | Baixo | Médio |
| 2 Média | Baixo | Médio | Alto |
| 3 Alta | Médio | Alto | Crítico |

Cores: Baixo #27ae60, Médio #f39c12, Alto #e74c3c, Crítico #1a1a2e.
- **Cascata unidade › setor** (`lib/drps/blocos.ts`): a probabilidade da unidade herda a do setor e sobrepõe só os tópicos ajustados; textos da unidade valem se preenchidos, senão os do setor; só entram unidades e setores com respondentes.
- **Conclusão Geral:** por tópico, pior matriz entre os setores (Crítico > Alto > Médio > Baixo) e contagem por nível.

**Análise (`analise/page.tsx`):** barra de metadados; um bloco por setor (ou unidade › setor) com identificação, tabela de 13 fatores (Fator · **Fontes geradoras** · Gravidade · Probabilidade · Matriz), **Possíveis agravos à saúde mental** e **Medidas de controle recomendadas** (lista de múltipla escolha do catálogo + itens digitados; gravados como `"• item\n• item"`), conclusão do setor (editor rico + "Gerar com IA").
- **Fontes geradoras (v262):** por setor e tópico, múltipla escolha entre as fontes padrão do tópico (texto separado por `;`/`,`) e o catálogo `psi_fontes_geradoras`; fonte nova digitada entra no catálogo para todos os relatórios; sem escolha salva, vale o texto padrão; impresso como `"a; b; c."` (`lib/psicossocial/fontes.ts`, com testes).

**IA:** edge function `gerar-conclusao-drps-ia` (Groq `llama-3.1-8b-instant`, temperatura 0,5, até 1200 tokens, JSON `{conclusao}`): por setor 2–5 parágrafos (140–360 palavras); consolidado 2–4 parágrafos (120–320). Recebe empresa, setor, responsável, CRP, tópicos (nome, fonte, gravidade, probabilidade, matriz), agravos, medidas e o texto atual (para refinar).

**Plano de Ação 5W2H:** "O quê" do catálogo `drps_acao_oque`, "Como" com múltipla escolha dos `drps_acao_como` filhos.

**Gestão (`lib/drps/gestao.ts`):** plano anual de 13 programas × 12 meses; monitoramento por setor × tópico com recomendação por nível (Baixo: trimestral/12 meses; Médio: bimestral/9 meses; Alto: mensal/6 meses; Crítico: intervenção imediata e reavaliação em 90 dias); revisão com 5 ações obrigatórias e equipe de 9 papéis; **saúde geral** = média de %medidas, %monitoramento e %revisão.

**Laudo PDF** (`GET /api/pdf/drps/[id]`, `DrpsTemplate`): capítulos de `textos_padrao` (módulo `psicossocial`) + capítulos fixos por slug: `identificacao_empresa`, `sumario`, `drps_caracterizacao`, `drps_analise_setor`, `drps_conclusao`, `drps_plano_medidas`, `drps_plano_acao_5w2h`, `drps_revisao`, `drps_assinatura` (folha de assinaturas do psicólogo, CRP). Capa por imagem de fundo com caixas de texto posicionadas. Numeração a partir do sumário. Identificador `DRPS-{ano}-{8 caracteres}`. Variáveis em `lib/drps/variaveis.ts`.

**Sinalização psicossocial** (`/sinalizacao-psicossocial`): lê o checklist organizacional das **AEPs** (13 chaves equivalentes aos tópicos) e lista setores com alertas (≥5 vermelho, ≥3 laranja, senão amarelo).

### 8.2 QPS — Questionários Psicossociais (`app/(questionarios-psicossociais)`)

Questionários **configuráveis** (tipos → categorias → perguntas) cujo resultado usa a **mesma régua do DRPS**. No laudo o instrumento se chama "QAP — Questionário de Avaliação Psicossocial".

**Telas:** `resumo` (carteira inteira com kanban de status, alertas de aplicações paradas ≥30 dias, riscos, dimensões críticas, taxa de participação); lista por empresa; `nova` (empresa, tipo, título, responsável, CRP, unidade do cliente, período, trabalhadores previstos); `tipos` (CRUD; importação Excel — uma aba por tipo: A categoria, B pergunta, C lógica, D+ alternativas; exportação Word/Excel). Por aplicação: resumo, `respondentes` (CSV do Forms, manual, modelo), `resultados` (matriz legada), `analise` (régua DRPS), `plano-acao`, `gestao`, `medidas`, `monitoramento`, `revisao`, `laudo`.

**Tabelas:** `qps_tipos` (escala min/max), `qps_categorias` (ordem, `fonte_geradora`), `qps_perguntas` (lógica, `opcoes` = alternativas próprias ≥2), `qps_aplicacoes` (status igual ao DRPS; jsonb por setor `agravos/medidas/conclusoes/fontes_por_setor`, chave `"*"` = consolidado), `qps_respondentes` (`respostas` = `{id_pergunta: valor}`), `qps_probabilidades` (setor `"*"` = aplicação inteira), `qps_plano_acao_5w2h`, `qps_plano_medidas`, `qps_monitoramento`, `qps_revisao`.

**Importação CSV:** Carimbo | Setor | Cargo (opcional) | respostas na ordem das perguntas. Pergunta com alternativas: grava a **posição** (1-based) da alternativa, comparando o texto normalizado. Sem alternativas: número dentro da escala.

**Régua do DRPS (`lib/qps/gravidade.ts`):** faixa da pergunta = 1..n (alternativas) ou escala do tipo; `media04 = (média − min)/(max − min) × 4`; corrigida e gravidade como no DRPS; gravidade da categoria só com perguntas respondidas (sem resposta → sem base, não vira "Baixa"); probabilidade = ajuste do setor > geral `"*"` > 1; matriz 3×3 do DRPS.

**Matriz legada (Resultados/Resumo, `lib/qps/matriz.ts`):** score % por categoria; <34 → prob. 1, <67 → 2, senão 3; severidade fixa 3; nível BAIXO/MODERADO/ALTO.

**Etapa (`lib/qps/etapa.ts`):** CONCLUIDO/ENVIADO → Concluído; sem respondentes → Coleta; com plano → Plano; senão → Análise.

**Análise e laudo:** mesma estrutura do DRPS (consolidado + um bloco por setor, fontes geradoras v262, agravos, medidas, conclusão com a mesma IA). Laudo montado por `lib/qps/laudo.ts` (usado pela tela e pelo PDF), `GET /api/pdf/qps/[id]`, `QpsTemplate`, slugs `qps_caracterizacao`, `qps_analise_setor`, `qps_conclusao`, `qps_plano_medidas`, `qps_plano_acao_5w2h`, `qps_revisao`, `qps_assinatura`.

### 8.3 Riscos Psicossociais (visão consolidada no Painel SST)

- `/riscos-psicossociais`: lista das empresas com DRPS ou QPS **concluído ou enviado ao cliente**.
- `/riscos-psicossociais/[idEmpresa]`: dados cadastrais da empresa e, por avaliação, um bloco por **setor** (um abaixo do outro) com a tabela **Risco · Resultado final · Fonte geradora · Medidas de controle recomendadas · Possíveis agravos à saúde mental** (medidas e agravos em célula única por setor).
- Regra: nunca leva para as telas de Análise. Cálculo pelas mesmas funções das telas de Análise (`lib/hooks/useRiscosPsicossociais.ts`). Oculto para Cliente.

---

## 9. Módulos de gestão e operação

### 9.1 Gestão — kanban (`/gestao`, `components/gestao/*`, `lib/hooks/useGestao.ts`)

Gerenciador de tarefas (estilo ClickUp/Runrun.it). Hierarquia **Espaço › Pasta › Quadro › Tarefa › Subtarefa**. Vistas quadro, lista, calendário, timeline; agrupar por status, responsável, prioridade ou etiqueta; filtros salvos; ações em massa; Meu Espaço, Meu Quadro pessoal, Caixa de Entrada (aprovações e notificações), Painel, Colaboradores e Equipes.

- **Tabelas:** `gestao_quadros` (status padrão A_FAZER, EM_ANDAMENTO, EM_REVISAO, CONCLUIDO criados por trigger), `gestao_status` (personalizável; tipo `nao_iniciado | ativo | concluido`), `gestao_tarefas` (`TRF-…`: título, descrição, status, responsável, datas, prioridade Baixa/Media/Alta/Urgente, etiquetas, pontos, campos custom, recorrência), `gestao_subtarefas`, `gestao_tarefa_vinculados` (responsável/seguidor), `gestao_dependencias` (sem ciclos), `gestao_comentarios` (@menções), `gestao_anexos`, `gestao_tempo`, `gestao_tarefa_historico`, `gestao_campos`, `gestao_etiquetas`, `gestao_subtarefa_modelos`.
- **Acesso:** `gestao_membros` (owner/admin/membro), `gestao_acessos` por espaço/pasta/lista/tarefa com níveis view < comment < edit < full (concessão mais específica vence; restritiva impõe teto), equipes com supervisor, quadro pessoal (dono full, supervisor edit). Mudanças registradas com motivo.
- **Automações** (`gestao_automacoes`): gatilhos (status muda, tarefa criada, prazo próximo, prazo vencido, subtarefa concluída, tarefa movida, tarefa aprovada), condições E/OU, ações (mover status, definir responsável/prioridade/campo, mover se subtarefas completas, vincular pessoas, mover/criar tarefa em outro quadro, notificar, solicitar aprovação, criar subtarefas de modelo); anti-loop; jobs **pg_cron** diários às 06:05 (recorrência e avisos de prazo) e 06:15 (automações de prazo).
- **Aprovações** (`gestao_aprovacoes`), **formulários públicos** (`gestao_formularios`, `/f/[token]`, cria tarefa), **agenda** (feed ICS e Google Agenda — ver 5.8), **IA** (`gestao-ia`: sugere subtarefas e descrição).
- **Importação do Runrun.it:** scripts `scripts/importar-runrun*.ts` com mapeamentos testados em `lib/gestao/import/*`.

### 9.2 SGG — envio de riscos ao sistema externo

`POST /api/sgg/enviar-riscos` (botão na inspeção). Exige Admin ou `pode_enviar_sgg`; empresa com `sgg_base_sgg` e `sgg_id`. Resolve setor e cargos nos dados-mestres (`MESTRES_POSTGREST_URL`) pelo nome exato do setor; um envio por setor; converte probabilidade/severidade para a escala AIHA 5×5 (`lib/sgg/mapa-aiha.ts`); envia por socket unix com HMAC; registra em `sgg_envios` (pendente, enviado, erro, duplicado, indeterminado).

### 9.3 Gestão Gerencial (`/gestao-gerencial`, tabelas `gg_*`)

Por unidade: profissionais, categorias, turnos, **escala padrão** (dia da semana × turno: trabalha/disponível), ausências (folga, férias, atestado, falta, in loco) e substituições. RPC `gg_sugerir_substitutos` (disponíveis no mesmo turno, mesma categoria, ativos, sem ausência e sem conflito) e `gg_projecao_mensal`.

### 9.4 Escala de Supervisores (`/escala`, `lib/escala/*`)

Grade mensal, padrão semanal, conferência, calendário anual, relatórios e configuração (supervisores, unidades com cor e município, feriados, regras). Situações: Visita ao cliente, Home office, Folga, Férias, Treinamento, Atestado, Feriado. **Geração mensal** idempotente (`gerarMes`): não altera dias manuais, ignora fim de semana, feriado vira "Feriado" (municipal só para quem está naquele município). **Regras de conferência:** mínimo de supervisores por dia, nenhum dia sem supervisor, sede coberta, âncora em dias fixos, par na mesma unidade. Exportação XLSX e PDF (`/api/pdf/escala-resumo`).

### 9.5 Dimensionamento (`/dimensionamento`, motor `lib/dimensionamento/calculo.js`, 84 testes)

Headcount por unidade e função. `precisa = Σ clientes que vencem no mês × peso do porte` (P 1,0 · M 1,5 · G 2,0); `produção = produção/dia × dias úteis × fração alocada × presença × ramp-up`; `consegue = Σ produção × ocupação-alvo`; `sobra = consegue − precisa`; status déficit/atenção (<10%)/ok; faltam/sobram/ideal em pessoas; custo. Tabelas `dim_*` (unidades, funções, colaboradores com alocação ≤100%, demanda mensal, parâmetros, histórico por trigger). Sincronização com a API externa (`/api/dimensionamento/sincronizar`).

### 9.6 Frota (`/frota`, `lib/frota/*`)

Veículos (tipo, status, km que só sobe), **saída com checklist** em 5 passos (veículo → condutor e km → **4 fotos obrigatórias** frente/laterais/traseira → avarias → destino e rotas; funciona offline), retorno (km e data ≥ saída), abastecimentos, manutenções (próxima revisão por data/km), sinistros, lotação por base. Painel com situação (Fora, Manutenção, Disponível, Inativo) e alertas (viagem > 3 dias, rascunho parado > 1 dia, revisão em ≤30 dias/≤1000 km). Fotos redimensionadas no navegador (320 px e 1600 px).

### 9.7 Equipamentos (`/equipamentos`, patrimônio interno por base)

Equipamentos individuais (status Operante, Manutenção, Inativa, Baixada, Reserva — só muda pela RPC, com motivo e histórico), catálogo com estoque mínimo, **razão de estoque** (`equipamentos_movimentacoes`, saldo pela view `v_equipamentos_saldo`), entrada manual ou por **NF-e (XML)**, ajuste com motivo, transferência entre bases (aceite com assinatura), **retirada/entrega** a colaborador (termo PDF com hash, assinatura em tela ou **biometria** com matcher externo — até 5 tentativas), devolução (íntegro/avariado/inservível). Todas as regras nas RPCs `equipamento_*`/`equip_entrega_*`.

### 9.8 EPI (`/epi`, por empresa cliente)

Catálogo EPI/EPC (CA e validade), estoque (movimentações, saldo `v_epi_saldo`), importação de NF-e, **entrega** ao colaborador com baixa de saldo (`epi_registrar_entrega`), assinatura em tela ou **biometria local** (DigitalPersona U.are.U 4500 via agente em 127.0.0.1:52182; template apagado quando o colaborador é inativado), transferência entre empresas, ficha de entrega em PDF. Também visível no portal do cliente.

### 9.9 Transferências e inventário

`transferencias`: máquina do inventário NR-12 ou material por quantidade; status pendente/aceita/recusada/cancelada; só o destinatário (ou admin) aceita, com assinatura; recusa/cancelamento exigem motivo. `inventario_maquinas` (categorias Máquinas e Medição). PDF da lista em `/api/pdf/transferencias`.

---

## 10. Como recriar o sistema do zero (roteiro)

1. **Infraestrutura:** criar um projeto Supabase (Postgres + Auth + Storage) e um projeto na Vercel ligado ao repositório. Configurar as variáveis da seção 1.4 (no mínimo URL, chave pública e, de preferência, a service role). Em Auth › URL Configuration, apontar o Site URL e as Redirect URLs.
2. **Banco:** recriar as tabelas do apêndice do banco. As definições originais estão em `supabase/historico/vNNN_*.sql`, **em ordem numérica** (não há linha de base única — ver 11). Para um banco novo, o caminho mais seguro é gerar um dump de schema do projeto atual (`supabase db dump --schema public`) e aplicá-lo, em vez de reexecutar as ~260 migrations. Recriar: funções `caller_*`/`rls_modulo_ok`/RPCs (apêndice), RLS de todas as tabelas, triggers de auditoria, buckets de storage (5.4), jobs pg_cron da Gestão (9.1) e os dados de configuração (funções do painel, matrizes de risco, tipos de risco/triagens/modelos, catálogos NR-12 e de químicos, textos padrão, OWAS, 13 fatores, unidades).
3. **Edge functions:** publicar `supabase/functions/*` e configurar os secrets (GROQ_API_KEY, RESEND_API_KEY…).
4. **Aplicação:** `npm install`, `npm run build`, `npm test`. Next.js 15 App Router com os route groups da seção 1.2; um `layout.tsx` por módulo com `useAuth()` + `useRequireModule()`.
5. **Primeiro acesso:** criar o primeiro usuário Admin (no painel do Supabase Auth + linha em `usuarios` com perfil `Admin`, `ativo_sistema = true`, unidades e módulos), cadastrar unidades e empresas.
6. **Dados:** migrar os dados das tabelas (exportar/importar por tabela, respeitando as chaves estrangeiras) e os arquivos dos buckets.
7. **Conferir:** login; abrir cada módulo; gerar um PDF de cada tipo; assinar um PDF com certificado A1; testar o modo offline ("Levar para o campo").

---

## 11. Pontos de atenção conhecidos

- **Migrations:** `supabase/migrations/` está vazio de propósito (a integração Supabase↔GitHub aplicaria tudo de novo). Aplicadas: `supabase/historico/`; não aplicadas: `supabase/fila/` (com README explicando cada uma). Não há linha de base: o schema completo só existe no banco. Ver `docs/supabase-migrations-e-git.md`.
- **Rotas chamadas que não existem:** `/api/health` (checagem de conexão offline) e `POST /api/pdf/congelar` (congelamento de PDF).
- **Middleware** libera só `/login` e `/f/`: `/api/gestao/form`, `/api/gestao/ics` e o webhook do Google respondem 401 sem sessão.
- **Chromium na Vercel:** só a rota `/api/pdf/aep/[id]` tem `outputFileTracingIncludes`; as demais rotas de PDF podem precisar do mesmo ajuste.
- **Sem `SUPABASE_SERVICE_ROLE_KEY` na Vercel:** usuários funcionam pelas funções do banco; assinatura digital, registro de PDF, sign-image e rotas públicas da Gestão dependem da chave.
- **Certificado A3** só aparece como selo (não assina). `pode_enviar_sgg` não tem tela (UPDATE manual).
- **Trava por módulo** no banco em modo `log` (não bloqueia).
- **Resíduos do Electron** inativos na web: auto-login/salvar credenciais, botão de atualização, aba "Atualização" em Configurações.
- **QPS tem duas réguas:** Resultados/Resumo usam a matriz legada; Análise/Laudo/Riscos Psicossociais usam a régua do DRPS.
- **DRPS:** o PDF usa o plano de medidas do ano corrente; `drps_texto_padrao` é legado (o PDF lê `textos_padrao`); `drps_monitoramento_unidade` e `exibir_sem_analise` não são usados.
- **Apreciação HRN:** a v146 (medidas de engenharia/administrativas separadas) está na fila, não aplicada no banco do JCN.
- **IA:** todas as funções usam Groq `llama-3.1-8b-instant`; o modelo de visão de uma delas foi descontinuado pelo Groq.
- **Repositório público:** o código e os SQL estão públicos no GitHub; segredos ficam só na Vercel/Supabase/GitHub Secrets.
