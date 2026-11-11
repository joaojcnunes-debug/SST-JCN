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
| Testes | `node --test` + tsx (`npm test`; ~900 testes em `lib/**/*.test.ts`). `test-setup.ts` carrega o `fake-indexeddb` e um `window` mínimo para a fila offline (`lib/offline/*`) rodar no Node |

Alias de import: `@/*` → raiz.

### 1.2 Estrutura de pastas

- `app/layout.tsx` — fonte Inter, `lang="pt-BR"`; script inline aplica tema (`localStorage.tema`) e menu recolhido (`sidebar-mini`) antes da pintura; `Providers`, barra de progresso, banner de atualização.
- `app/page.tsx` → redireciona para `/inicio`.
- **Route groups** (`app/(grupo)` não aparece na URL):

| Grupo | Rotas |
|---|---|
| `(public)` | `/login`, `/privacidade`, `/termos` (Política de Privacidade e Termos de Serviço, abertas sem login — usadas na tela de consentimento do Google; `components/legal/PaginaLegal.tsx`) |
| `(hub)` | `/inicio`, `/visao-geral`, `/modulos`, `/validades`, `/gestao` |
| `(admin)` | `/usuarios`, `/funcoes`, `/config`, `/pdfs-gerados`, `/lixeira`, `/auditoria`, `/presenca`, `/portal-sst` |
| `(app)` | Módulo **Painel SST**: `/dashboard`, `/inspecoes`, `/relatorios`, `/certificados`, `/riscos-psicossociais`, `/aep-psicossocial`, `/acoes`, `/texto-padrao` |
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

- Roda em tudo, menos estáticos, imagens, `manifest.webmanifest` e `sw.js`. Públicos: `/login`, `/f/`, `/privacidade`, `/termos` e as APIs sem sessão da Gestão (`/api/gestao/form` — formulário e anexos —, `/api/gestao/ics` e `/api/gestao/google/webhook`), que conferem o próprio token.
- Sem URL/chave do Supabase configuradas: `/api/*` → 500 JSON; resto → `/login`.
- Valida a sessão com `@supabase/ssr` (`auth.getUser()`). Sem usuário: `/api/*` → **401 JSON** `{ok:false, error:"Sessao expirada. Entre de novo."}`; páginas → `/login?next=<rota>`.
- Não checa perfil nem módulo (isso é feito nos hooks e na RLS).

### 1.6 Clientes Supabase (`lib/supabase/client.ts`)

- `createSupabaseBrowserClient()` (navegador), `createSupabaseServerClient(cookies)` (rotas/Server Components), `createSupabaseServiceClient({email, origem})` (service role; envia `X-Painel-Ator`/`X-Painel-Origem` para a auditoria registrar quem agiu).
- `fetchAllRows()` pagina de 1000 em 1000 (teto do PostgREST).
- Tabelas fora do tipo `Database` são acessadas com cliente `as any` (padrão do projeto).

### 1.7 Convenções

- **IDs** gerados no cliente: `gerarId("EMP")` → `EMP-XXXXXXXX` (8 hex). Essencial para a fila offline ser idempotente.
- **Tema (0.3.194, Etapa 0.1 do `docs/plano-skin-viva-jcn.md`):** as cores da marca são os tokens `--color-marca-*`:
  - primary `#0ea5e9`, accent `#0284c7`, dark `#0369a1`;
  - light `#e0f2fe`, border `#bae6fd`, deep `#0b1e33`.
- **0.3.201 (0.final):** as classes `verde-*` foram renomeadas para `marca-*` em todo o código, e os nomes antigos saíram do tema. Não use mais `verde-primary` e afins.
- **Porte para o Painel SST:** o Painel continua com `verde-*`. Ao gerar um MD do JCN para o Painel, troque `marca-*` por `verde-*` no patch.
- O menu lateral (SidebarShell e Gestão) usa o degradê `#0369a1 → #0b1e33 → #071526`.
- A topbar dos módulos usa `#0369a1 → #0284c7`. O manifest usa `theme_color` `#0369a1`.
- Verde só onde é **significado** (concluído, em dia, risco baixo, sucesso, assinado, confirmar ✓). O verde do Excel fica nos botões de planilha. A varredura por módulo segue o plano: a 0.2 (0.3.195) cobriu Questionários e DRPS; a 0.3 (0.3.196) a AEP e a AET; a 0.4 (0.3.197) Conformidade e Não conformidade (lá o verde de "conforme/encerrada/baixa" fica); a 0.5 (0.3.198) Inspeções e os componentes de tela (`ListaReordenavel`, `AssinaturaRelatorio`); a 0.6 (0.3.199) Apreciação de Máquinas, Químicos e Equipamentos; a 0.7 (0.3.200) Frota, EPI, Escala, Gestão e o resto (botão de atualização do app inclusive); com o verde de marca trocado por `sky-*` (o mesmo azul de `marca-primary`).
- **Documentos (0.3.202, Etapa 0b):** títulos de capítulo e seção em azul-marinho `#0c4a6e` com sublinhado `#0ea5e9`.
  - Faixas de cabeçalho de tabela em `#e0f2fe` e células de rótulo em `#f0f9ff`.
  - Valem para os templates de PDF (`components/pdf/templates/*`, inclusive `TP_STYLE`), os componentes `*Print` e os laudos na tela (`sky-700/800/900`).
  - Variáveis: `--tiptap-heading` e `--psi-*` (claro e escuro).
  - Verde só de significado: Conforme, Baixo, Concluída, Trivial e as zonas da AET.
  - Os PDFs já emitidos não mudam.
- Modo escuro por CSS vars.
- Mensagens e comentários do código em português; regras em `lib/` têm testes.
- **Dicas em Inspeções, lote 7.1 (0.3.210, Etapa 7 do plano-skin-viva):** `lib/dicas/riscos.ts` (30 campos do `RiscoForm`) e `lib/dicas/inspecoes.ts` (5 campos da Nova inspeção), testadas em `lib/dicas/inspecoes.test.ts`.
  - O `Field` do RiscoForm aceita `dica`. Os rótulos soltos usam `CampoLabel`, com `extra` para o asterisco e o "(cor NR-09)", e o título "Fonte Geradora" usa `Dica`.
  - A triagem e as perguntas personalizadas ficam sem dica, porque já têm explicação na tela.
  - **Lote 7.2 (0.3.211):** `lib/dicas/inspecao-editor.ts`, com cerca de 55 campos, cobre Setor, Cargo, EPI/EPC, Extintor, Treinamento, Máquinas, Responsáveis, Complemento e Foto.
    - Os rótulos ficam no `<label>` de sempre, com o nome dentro de `<Dica>`; o `Field` do SetorForm aceita `dica`.
    - Ficam sem dica os campos já explicados na tela (setores, cargos e riscos aplicáveis do Treinamento; a lista de equipamentos do EPI), "Fotos"/"Arquivo" e os botões Sim/Não da NR-12.
- **Adicionar supervisor no Padrão Semanal (0.3.232, sem banco):** o botão "Adicionar supervisor" (só para quem edita a escala) abre o `SupervisorModal` (`components/escala/SupervisorModal.tsx`), o mesmo cadastro pela conta do painel da aba Supervisores, que passou a usar o componente. Aberto pelo Padrão Semanal, o modal também lista os inativos com "Trazer de volta", porque eles não aparecem na grade e a conta deles não entra na lista. A nova linha nasce sem dias definidos.
- **Correções nas configurações do Psicossocial e da Escala (0.3.231, sem banco), achadas na auditoria das dicas:**
  - **Agravos e Medidas recomendadas:** `opcoesDoCatalogo` (`lib/drps/catalogo-opcoes.ts`, testado) só cai na base fixa quando a tabela não tem nenhuma linha. Todos desativados dão lista vazia na Análise do DRPS e na do QPS. O subtítulo das duas telas cita as duas análises.
  - **Ações do plano:** excluir um "O Quê" apaga os "Como" em cascata (FK da v111), mas a Lixeira guarda só o O Quê. O aviso diz quantos "Como" vão junto e que não voltam pela Lixeira. Os catálogos continuam editáveis por quem edita (decisão do João).
  - **Supervisores:** o texto diz a verdade: nome e função são copiados da conta ao salvar; para atualizar, escolher a conta de novo e salvar.
  - **Unidades:** a cor padrão `#0ea5e9` é azul-claro (o texto dizia verde). A grade mensal e o padrão semanal buscam o nome em todas as unidades: dia gravado numa unidade desativada mostra "Nome (inativa)", não "removida".
  - **Regras:** a ajuda de "quem tem o dia definido" diz que folga, férias, atestado e feriado municipal contam. A de "Nenhum dia sem supervisor" diz que um dia com todos de folga ou férias passa como OK (a regra não mudou).
  - **Padrão semanal:** "Limpar o dia" usa a data de "Passa a valer em", que agora começa na data de "Padrão vigente em". O padrão termina na véspera dessa data, a mesma régua de salvar (`fimAoLimpar` em `lib/escala/vigencia.ts`, testado). Recusa sem mexer em nada quando o padrão começa nessa data ou depois (o CHECK da v190 não aceita fim antes do início) ou já termina antes dela. Desde a 0.3.252, se "Padrão vigente em" está no passado (só consulta), "Passa a valer em" começa em hoje, para abrir a célula e salvar não regravar o histórico (correção do Painel).
- **Correções das configurações da AET e da Biblioteca da AEP (0.3.230, sem banco), achadas na auditoria das dicas 7.10b:**
  - **QPS da AET:** a `ordem` de cada pergunta é a chave das respostas (`pergunta_ordem`) e não muda mais ao salvar. Pergunta nova recebe a maior ordem conhecida + 1, contando a maior já respondida em `aet_laudo_qps_respostas`; excluir deixa buraco (`lib/aet/ordem-perguntas.ts`, testado). Antes era `ordem: i + 1`.
  - **Checklist OWAS:** "Restaurar padrões" pede confirmação, apaga só as linhas das perguntas padrão (`SLUGS_CHECKLIST_PADRAO`) e faz upsert do campo de seleção; as perguntas criadas ficam. Excluir pergunta criada avisa que os laudos que a responderam passam a mostrar o código.
  - **Trabalho predominante:** a prévia do laudo e o PDF leem o rótulo de `aet_owas_select_campos` (`rotuloSelectOwas` em `lib/aet/checklist.ts`), com o padrão do código como reserva. `OWAS_SELECTS_PADRAO` mudou para esse arquivo puro.
  - **Config. OWAS:** número repetido nas opções de uma categoria impede salvar e fica marcado em vermelho (`lib/aet/owas-opcoes.ts`). "Rich text" virou "Texto livre, escrito em cada setor". Saiu o código morto `SLUG_TO_FIELD` dos Perfis OWAS.
  - **Config. 13 Fatores:** Perigos típicos, Possíveis danos, as quatro colunas do Plano e Mín./Máx./Nível PGR do Semáforo ficaram só leitura, com aviso; o Prazo padrão do Semáforo segue editável. A aba Plano perdeu o Salvar.
    - "Restaurar padrão" de Categorias e QPS pede confirmação. As quatro abas ficam montadas, então trocar de aba não perde o que não foi salvo. O hover dos botões azuis é o `marca-accent`.
  - **Biblioteca psicossocial da AEP:** editar o texto de uma opção mostra aviso e pede confirmação (o texto muda em todo setor e laudo que a marcou). Renomear opção das listas comuns leva junto o padrão dos fatores que usavam o texto antigo (`fatoresComPadrao`, testado). Excluir usa o `confirmar` do projeto.
  - **Fora:** trocar a categoria ou a lógica de uma pergunta QPS já respondida continua mudando os laudos antigos; os valores antigos de Mín./Máx. no banco não foram regravados.
- **Correções da Gestão (0.3.227 + banco v319, aplicada em 04/11/2026), achadas na auditoria das dicas:**
  - **Comentário:** o nível "ver e comentar" comenta (`nivelPodeComentar`). Excluir comentário continua só para quem edita.
  - **Responsável pela lista e em massa:** cria o vínculo (`useSalvarVinculados` com `manterSeguidoresAtuais`); o texto `responsavel` segue espelhado pelo trigger. Nome sem usuário é recusado.
    - **v319:** quem edita a lista vincula ou desvincula qualquer membro da Gestão (Admin ou `gestao_membros` ativo). Antes só o gestor vinculava outra pessoa.
  - **Caixa de entrada:** a aprovação sem aprovador só aparece para gestor ou quem edita aquela lista, a mesma regra da v315.
  - **Salvar a tarefa:** envia só os campos personalizados que mudaram, mesclados com o `campos` atual do banco.
  - **Status pela lista:** usa a trava de dependências e grava o histórico, como a janela. O helper fica em `lib/gestao/alteracao-tarefa.ts`, testado.
  - **Erros do banco:** os RAISE sem acento são traduzidos em `lib/errors.ts`.
  - **Automações:** o rótulo virou "Notificar todos os vinculados (sino e e-mail)". Os números gravam ao sair do campo.
  - **Modelos:** trocar o slug mostra quantas automações usam o código antigo.
  - **Telas menores:**
    - "Visível ao cliente" saiu da tela de campos;
    - `Nome`/`AcoesBtn` do GestaoSidebar saíram do render;
    - a etiqueta do modelo de tarefa entra também ao sair do campo;
    - o nome da equipe exige 2 letras;
    - o formulário sem responsável por e-mail grava `responsavel_padrao` nulo e a rota não usa nome antigo.
  - **Fora:** arrastar um cartão no quadro agrupado por responsável ainda grava só o texto.
- **Dicas nas configurações dos módulos, lotes 7.10b e 7.10c (0.3.226):** `lib/dicas/config.ts` ganhou Config. OWAS, Config. 13 Fatores e Biblioteca psicossocial da AEP; `lib/dicas/escala.ts` cobre a Configuração da Escala (Unidades, Supervisores, Feriados, Regras) e o Padrão semanal.
  - Nos 13 Fatores, as dicas dizem quando o valor só fica na tela: Perigos típicos, Possíveis danos e as colunas do Plano são gravados e nada os lê; Mín., Máx. e Nível PGR do Semáforo só saem no formulário em branco (a zona usa faixas fixas).
  - Ficam sem dica Perfis OWAS e os catálogos do Psicossocial (Agravos, Medidas, Ações do plano): só caixas com placeholder.
  - Achados para o PR de correções: salvar as perguntas QPS da AET renumera todas (as respostas são ligadas ao número); "Restaurar padrões" do checklist OWAS apaga as perguntas criadas na tela; o trabalho predominante editado na Config. OWAS não chega ao laudo nem ao PDF. Corrigidos na 0.3.230.
- **Dicas nas Configurações, lote 7.10a (0.3.225):** `lib/dicas/config.ts` cobre Usuários, Funções, Tipos de risco, Catálogo e Triagem, Perguntas customizadas, Matrizes, Portal SST e o editor de capítulo do Texto padrão (orientação, início, posição e imagem de capa).
  - O `Field` de Usuários aceita `dica` e deixa o asterisco fora do sublinhado. Ficam sem dica os campos já explicados na tela (senha, função, perfil, unidades, assinatura, certificado, Listas, Logo) e os que só têm placeholder.
  - Os lotes 7.10b (configurações da AET e Biblioteca da AEP) e 7.10c (catálogos do Psicossocial e Escala) vêm depois.
- **Dicas na Gestão, lote 7.9b (0.3.222):** `DICAS_GESTAO_AUTOMACAO` e `DICAS_GESTAO_ACESSOS` em `lib/dicas/gestao.ts` cobrem as automações (Ativa, Quando, de/para, prazos, condição, ações, agenda, SLA, rodízio, vínculos) e os acessos (quem, copiar de, mesmas equipes, onde, motivo, equipes).
  - Os campos de ação que só têm placeholder ficam sem dica (responsável, mensagem, aprovador, título, assunto).
- **Dicas na Gestão, lote 7.9a (0.3.221):** `lib/dicas/gestao.ts` cobre a janela da tarefa, a configuração e o formulário público, os modelos de checklist e as opções de campo.
  - O 7.9b (automações e acessos) usa o mesmo arquivo.
  - Campos só com placeholder ficam sem dica (comentário, motivo da aprovação, responsável da subtarefa, texto/opções/ajuda da pergunta).
  - **Achados para o PR de correções da Gestão:**
    - o nível "ver e comentar" não comenta;
    - "Definir responsável" (automação, lista e massa) grava só o texto;
    - aprovação sem aprovador aparece a quem não pode decidir;
    - salvar a tarefa sobrescreve campos mudados por automação;
    - o status pela lista pula dependências e histórico;
    - erros do banco sem acento;
    - "Notificar (sino)" também manda e-mail;
    - `visivel_cliente` nunca é lido;
    - os números da automação voltam enquanto se digita;
    - trocar o slug do modelo quebra automações;
    - renomear espaço/pasta perde o texto;
    - renomear etiqueta desliga as tarefas antigas;
    - `responsavel_padrao` antigo do formulário;
    - a etiqueta do modelo só entra com Enter;
    - a equipe aceita nome vazio.
- **Correções da Apreciação de Máquinas (0.3.220, banco v318), achadas na auditoria das dicas:**
  - **Máquina ativa:** o editor só aceita um `fichaAtivaId` que seja do laudo aberto; sem seleção válida, abre na 1ª máquina. O store é global e guardava a máquina do laudo anterior.
  - **Identificação da máquina:** só recarrega quando muda a máquina. Foto enviada/removida e salvar no painel apagavam o que não estava salvo.
  - **Item livre:** nasce na máquina aberta (`id_ficha`), e o LIVRE-N é contado no laudo todo.
  - **Laudo todo:** gerar ações, o parecer da IA, o Sugerir risco residual e os totais dos textos padrão usam todas as máquinas.
  - **Risco HRN:** num risco já lançado, mudar POD, FEP ou GPD não sobrescreve a classificação gravada; o "usar sugerida" continua.
  - **Textos e acentos:**
    - o texto das medidas antigas foi corrigido;
    - prioridade e status do Plano de Adequação aparecem com acento na tela e no PDF;
    - "não conformes" no lugar de NAO_CONFORME.
  - **PDF:**
    - a ficha de cada máquina mostra Componentes, Limites, NPE e Sistemas de segurança (atual × necessário), cada um só quando preenchido;
    - a Notificação SIT/MTE sai junto da Identificação da empresa;
    - `{{risco_residual}}` sai com rótulo.
  - **Nova:** grava o título "Apreciação de Máquinas NR-12" e a cidade/UF do cadastro da empresa.
  - **Ficaram de fora:**
    - NPE do risco e Nível das ações continuam só gravados;
    - Observações gerais podem sair antes da capa (não confirmado no PDF gerado).
- **Dicas na Apreciação de Máquinas, lote 7.8 (0.3.219):** `lib/dicas/apreciacao.ts`, com cerca de 60 campos.
  - **Helpers que aceitam `dica`:** o `Campo` (Nova, editor e PlanoAcaoTable). Os Limites e a ficha da máquina (`CAMPOS_FICHA`) recebem a dica pela própria lista.
  - **Neutras de propósito:** Notificação SIT, Limites, NPE, Sistemas, NPE do risco e Nível das ações. Hoje são gravados e não saem no PDF; o PR de correções decide.
  - **Achados para o PR de correções:**
    - a máquina selecionada fica num store global e passa de um laudo para outro (o risco novo pode ir para a máquina errada);
    - salvar ou enviar foto da máquina apaga a identificação não salva;
    - o item livre é criado sem `id_ficha`;
    - gerar ações, o parecer da IA e o Sugerir risco residual usam só a máquina aberta;
    - num risco já lançado, mudar POD, FEP ou GPD sobrescreve a classificação gravada;
    - `{{risco_residual}}` sai cru;
    - textos sem acento;
    - a Nova grava título, setor e cidade nulos;
    - o texto das medidas antigas contradiz o PDF;
    - `notificacao_sit` nunca é impressa.
- **Correções DRPS/QPS (0.3.218, banco v317), achadas nas auditorias das dicas:**
  - **DRPS, data de conclusão:** o gatilho `trg_drps_stamp_data_conclusao` (v317) grava a data na 1ª vez que o relatório vira CONCLUIDO, por qualquer caminho.
    - Os 2 concluídos sem data foram acertados: DRPS-225D2095 com 25/09/2026, a data do histórico; DRPS-A45EFF4D com 09/06/2026, a data de elaboração, por decisão do João.
  - **DRPS, Análise:** com edições não salvas, os editores dos setores e a barra de metadados não remontam quando o relatório recarrega (gravar a conclusão ou o alinhamento recarregava e apagava tudo).
    - Agravos e medidas comparam com o catálogo, não com a lista fixa, e não duplicam mais.
    - A impressão mostra a Conclusão Geral como HTML (`HtmlConteudoAssinado`), e não as tags.
  - **DRPS, Monitoramento:** o campo Responsável tem `key` com o setor e não grava mais no setor errado.
  - **DRPS e QPS:**
    - "Concluído" aparece com acento nas telas e nos PDFs; o valor gravado continua "Concluido".
    - Trocar o ano do Plano anual com alterações não salvas pede confirmação.
    - A capa (`CapaEditor`) recebe as variáveis do módulo (`VARIAVEIS_POR_MODULO`), então a do QPS mostra as do QPS.
  - **QPS, Respondentes:** importar, adicionar e remover só aparecem para quem pode editar (`useCanEdit`).
  - **QPS, Resultados:** a tela passou a SÓ MOSTRAR.
    - O clique gravava em `qps_probabilidades`, a mesma tabela da Análise e do laudo; o ajuste agora fica só na Análise.
    - A "Análise das Dimensões Críticas" saiu: gravava `observacoes_dimensoes`, que nada lia, e nunca foi preenchida. A coluna ficou no banco.
  - **QPS, outros:**
    - a IA da conclusão recebe o CRP;
    - a pendência "Fontes geradoras" aponta para a Análise;
    - corrigidos os textos do Plano de ação, das Instruções e do Novo DRPS.
  - **Ficaram de fora (menores):**
    - o PDF do DRPS ainda imprime "CRP" fixo;
    - a Nova aplicação do QPS não tem `useRequireCreate`;
    - a permissão é diferente entre as telas da aplicação;
    - o aviso do Resumo do DRPS;
    - a capa travada ainda aceita arrastar as caixas.
- **Dicas no QPS, lote 7.7 (0.3.217):** `lib/dicas/qps.ts`, com cerca de 40 campos.
  - **Telas cobertas:** Nova aplicação, Aplicação (o `InfoCard` aceita `dica`), Análise, Monitoramento, 5W2H (o `Campo` aceita `dica`), Respondentes e Tipos. Plano anual e Revisão usam os textos do DRPS.
  - **5W2H:** a dica avisa que só sai no laudo se o capítulo for ligado no Texto Padrão (desligado na v243).
  - **Achados para o PR de correções DRPS/QPS:**
    - Respondentes e Resultados sem controle de permissão;
    - a tela Resultados grava em `qps_probabilidades`, a mesma que o laudo usa, e contradiz o texto da Análise;
    - `observacoes_dimensoes` nunca é lido;
    - a Nova aplicação não tem `useRequireCreate`;
    - a permissão é diferente entre as telas da aplicação;
    - o texto do 5W2H diz que vai para o laudo;
    - a pendência "Fontes geradoras" aponta para Tipos;
    - o placeholder de Instruções fala em "respondente";
    - a IA da conclusão recebe `crp: null`.
- **Dicas no DRPS, lote 7.6 (0.3.216):** `lib/dicas/drps.ts`, com cerca de 35 campos.
  - **Telas cobertas:** Novo, Metadados (o `Field` aceita `dica`), barra do Dashboard e da Análise, Análise (Fontes e Conclusão do setor), Dados, Conclusão geral, Plano anual, 5W2H (o `Campo` aceita `dica`), Monitoramento, Revisão e Capa (`DICAS_CAPA`).
  - **Neutras de propósito:** as dicas de Status e Registro, porque a data de conclusão e a sigla do registro no PDF entram no PR de correções do DRPS/QPS.
  - **Achados para esse PR:**
    - concluir pelo menu de status não grava a data da capa (os 2 DRPS concluídos do JCN estão sem data);
    - na Análise, gravar a conclusão ou o alinhamento recarrega e perde edições não salvas;
    - o Responsável do Monitoramento usa `defaultValue` e `key={t.idx}` e grava no setor errado;
    - agravos e medidas do catálogo voltam como texto livre;
    - o PDF imprime sempre "CRP";
    - "Concluido" sem acento;
    - trocar o ano do plano descarta o que não foi salvo;
    - a capa do QPS usa as variáveis do DRPS;
    - o texto do Novo DRPS contradiz o código;
    - a impressão da Análise mostra tags HTML;
    - a capa travada ainda aceita arrastar as caixas.
- **Correções AET/AEP (0.3.215), achadas nas auditorias das dicas:**
  - **AET, Setores × Análise:** as duas gravam o jsonb `setores`. Agora, ao salvar, a tela busca a versão do banco (`setoresAtuaisDoBanco`) e aplica só o que ELA mudou desde que carregou (`lib/aet/mesclar-setores.ts`, testado). Campo mudado na tela vale o da tela, e o resto vem do banco. Setores criados ou apagados respeitam as duas telas. A ordem é a da tela. Sem rede, grava o local, como antes. O auto-save do arrasto da AET usa a mesma mescla.
  - **AET, permissão:** o Visualizador não edita a tela Psicossocial nem, na tela Setores, o bloco QPS, o F13, a escala e os "Salvar Fxx". Esses blocos ficam num `<fieldset disabled>` e o editor de texto usa `readOnly`.
  - **AET, laudo:** o `dirty` passa a comparar a validade, então o Gerar Laudo pede para salvar quando ela mudou.
  - **AET, Plano de Ação:** prioridade e status aparecem com acento (Média, Crítica, Concluída). O valor gravado não muda.
  - **AET, aba Dados:** as Seções 2–12 saíram, porque `textos_secoes` não era lido por nada. No lugar fica um aviso com link para `/aet/texto-padrao`. Não havia laudo de AET gravado.
  - **AEP, arrasto:** grava só a ORDEM, sobre a versão salva (`reordenarComo`, testado). Edições não salvas esperam o Salvar, com a trava do N/I e a auditoria da origem da evidência.
  - **AEP, validações:** setor sem nome não salva, e a aba Dados não salva sem responsável.
  - **AEP, troca de responsável:** trocar o profissional zera o registro quando o novo não tem um, na Nova análise e na aba Dados.
  - **AEP, exclusão e texto:** excluir setor pede confirmação. O texto "a observação aparece ao marcar Sim" foi corrigido, porque ela aparece sempre.
  - **AEP, endereço:** o `endereco_empresa` editado na análise sai na Identificação, tanto no PDF (`SecaoIdentificacaoEmpresa`, prop `enderecoDocumento`) quanto na prévia (`EmpresaInfoPanel`). Vazio, vale o do cadastro. Os outros laudos não passam a prop e continuam iguais.
- **Dicas na AEP, lote 7.5 (0.3.214):** `lib/dicas/aep.ts`, com cerca de 40 campos, cobre Nova análise, Dados, Checklist de gestão e Setores.
- **Ocultar setor (0.3.260, do Painel 0.3.863):** cada setor da AEP tem o botão **Ocultar** (marca `oculto` no jsonb `setores`). O setor oculto sai da tela de edição (fica em "Setores ocultos", com Desocultar), do laudo, do PDF, das listas e dos painéis (Sinalização, Comercial, Conciliação), e não conta nos alertas nem na indicação de AET. Os dados ficam guardados. A leitura padrão (`normalizarRelatorio`) exclui os ocultos; só o editor lê a lista completa (`normalizarRelatorioCompleto`), e a ordem (`reinserirVisiveis`) e o Salvar gravam a lista inteira, com os ocultos (`lib/aep/setores-ocultos.ts`, testado). Ocultar e desocultar salvam na hora e registram na auditoria; como a ordem, gravam a versão **salva** com a marca trocada, e as edições ainda não salvas esperam o Salvar. O PDF já assinado não muda até ser assinado de novo.
  - O Inventário de risco acha a dica pelo rótulo da linha (`DICA_INVENTARIO`, a partir de `ROTULO_TOPICO`).
  - Origem e Evidência do checklist de gestão não têm rótulo na tela, por isso ficaram sem dica.
  - **Problemas achados, corrigidos na 0.3.215, exceto "Respondido com" (fica como registro interno, por decisão do João):**
    - Arrastar um setor grava o array inteiro, com edições não salvas, e pula a trava do N/I e a auditoria da origem da evidência.
    - A Identificação do PDF usa o endereço do cadastro, e não o `endereco_empresa` editado na AEP.
    - "Respondido com" não é lido em lugar nenhum; Origem e Evidência vão só para a auditoria.
    - "Setor *" não é validado e a aba Dados salva sem responsável.
    - Trocar o responsável pode manter o registro do anterior.
    - A tela diz que a observação "aparece ao marcar Sim", mas ela aparece sempre.
    - Excluir setor não pede confirmação.
- **Dicas na AET, lote 7.4 (0.3.213):** `lib/dicas/aet.ts`, com cerca de 50 campos, cobre Novo laudo, Dados, QPS (Setores e Psicossocial), Setores, Fatores, Análise e Plano de Ação.
  - **Helpers que aceitam `dica`:** `InputField` (Dados), `TextInput`/`TagInput` (Setores) e `Campo` (PlanoAcaoTable). As colunas da tabela de riscos e os títulos "Fotos do Setor" e "Considerações Finais" também têm dica.
  - **Problemas achados na auditoria, todos corrigidos na 0.3.215** (veja "Correções AET/AEP" abaixo):
    - As Seções 2–12 da aba Dados gravam em `textos_secoes`, mas nada lê esse campo: o laudo e o PDF usam os capítulos de Texto padrão.
    - Um Visualizador consegue editar na tela Psicossocial (sem `useCanEdit`) e, na tela Setores, no bloco QPS, no F13 e nos "Salvar Fxx".
    - O "Gerar Laudo" não considera a validade alterada e não salva (o `dirty` do laudo não compara `dataValidade`).
    - As prioridades do Plano de Ação estão sem acento ("Media", "Critica").
    - Setores e Análise gravam o jsonb `setores` inteiro: a última tela a salvar sobrescreve a outra.
- **Dicas no módulo EPI, lote 7.3 (0.3.212):** `lib/dicas/epi.ts`, com 28 campos de Catálogo, Estoque, Entregas, Colaboradores, Transferências e Assinatura.
  - **Achados registrados (sem mudança de regra):**
    - O "Ajuste" do estoque soma ao saldo como a Entrada, porque a `v_epi_saldo` o conta positivo e a quantidade não aceita negativo. Para tirar do saldo, use Saída.
    - "Colaborador ativo" só muda a etiqueta: o inativo continua na lista da entrega.
- **Encantamento (0.3.208, Etapa 6 do plano-skin-viva):**
  - **Comemoração** (`components/ui/Comemoracao.tsx`): `comemorar()` dispara um evento, e o `<Comemoracao />`, montado em `lib/providers.tsx` ao lado do Toaster, desenha 14 peças de confete perto do aviso de sucesso, por cerca de 1,2 s.
    - **Chamada em:** Inspeção concluída, Documento concluído (emitido), Apreciação finalizada, Relatório de Conformidade finalizado, Relatório de Não Conformidade finalizado, e as duas formas de assinar PDF (`AssinarPdfModal`, `BotaoAssinarPdf`).
    - **Restrições:** não desenha com `prefers-reduced-motion` e fica fora da impressão.
  - **Profundidade** (`.tilt-3d`): inclinação de cerca de 1,5°, só com mouse (`hover: hover` e `pointer: fine`). Está nos cartões da Visão geral (totais, saúde, dias sem acidente, pulso e radar), além do hub de Módulos, Relatórios, Dashboard e Químicos.
    - O `.reveal-up` passou de `both` para `backwards`; o `both` prendia o `transform` e anulava o hover.
  - **Modo escuro:** bloco "(e)" no `globals.css` com hovers pastel, divisórias (`divide-*`), bordas slate e 300, anéis (`ring-*`) e `text-gray-200/300`. A receita é `color-mix` ancorado no tema, que o `.force-light` desfaz.
  - **Reduzir movimento:** uma rede de segurança global para animações e transições, exceto `animate-spin`.
  - **Sobras de verde:** contorno de foco dos campos, sombras de `.card`, `.glass` e `.tilt-3d`, esqueleto, `.text-gradient` e `.glass-dark`. Tudo passou para azul, marinho ou neutro.
- **Partes vivas da Visão geral (0.3.207, Etapa 5 do plano-skin-viva):** três blocos novos na `VisaoGeralView`, fora da impressão.
  - **Radar de vencimentos** (`components/visao-geral/RadarVencimentos.tsx`): SVG com anéis por urgência, com os vencidos no centro, depois até 30 dias e 31 a 60 dias.
    - Cada documento é um ponto que leva ao `href` do vencimento; o texto aparece ao passar o mouse.
    - Os vencidos pulsam (`.radar-pulsa`).
    - Ao lado fica o contador de riscos altos (`useRiscosAltos`: `riscos` com nível Alto ou Muito Alto em inspeções não deletadas, sob a RLS), que leva a `/inspecoes`.
  - **Empresas por situação** (`PainelEmpresas.tsx`): fica no lugar do mapa até haver mais empresas.
    - Um ponto por empresa, agrupado por "município/UF", na cor da pior situação: vencido, vence em até 60 dias, em dia ou sem documento com validade.
    - A conta está em `lib/visao-geral/empresasSituacao.ts`, testada. As cidades com pior situação vêm primeiro.
  - **Acontecendo agora** (`AcontecendoAgora.tsx` + `useFeedVisaoGeral`): substitui a "Atividade recente".
  - **0.3.261 (do Painel, ajustes do nosso MD da Visão geral):** o feed busca só os últimos **14 dias** (`FEED_JANELA_DIAS`) e, para Técnico com empresas vinculadas, só as empresas dele; o contador de riscos altos usa o mesmo filtro de vínculo. Os dois cortam a varredura da trilha que a RLS faz linha a linha. O feed não mostra toast quando falha (`meta: { silent: true }`; a tela já tem o aviso). A lista do Painel de empresas tem altura máxima (420 px) com rolagem.
    - Mostra os 15 últimos eventos de `auditoria_eventos` ligados a um documento (`doc_id`), sob a RLS, e busca de novo a cada 30 s.
    - O texto vem de `descreverEvento`/`quemGravou`; o link vai ao documento.
    - O que chega depois da 1ª carga entra com `.feed-novo`.
  - **Movimento:** `.feed-novo`, `.ponto-ao-vivo` e `.radar-pulsa` no `globals.css`, todos parados com `prefers-reduced-motion`.
- **Pulso de segurança (0.3.206, Etapa 4 do plano-skin-viva):** nota de 0 a 100 no cabeçalho da Visão geral, só para a equipe e não no portal do cliente.
  - **Fórmula** (`lib/visao-geral/pulso.ts`, testada): 70% × (documentos válidos ÷ documentos com validade) + 30% × (ações 5W2H abertas no prazo ÷ abertas).
    - Válidos são os em dia mais os a vencer. Os documentos sem validade ficam fora da conta.
    - Sem ação aberta, a parte das ações vale 100. Sem documento com validade, não há nota ("—").
    - Ação fechada é a que tem status começando por "conclu" ou "cancel".
  - **Faixas:** 85 ou mais Em dia, de 60 a 84 Atenção, abaixo de 60 Crítico.
  - **Composição:** aparece no título, numa Dica.
  - **Linha de batimento:** SVG com `.pulso-onda`, parado com `prefers-reduced-motion`.
  - **Dados:** a saúde dos documentos (a mesma do anel) e `useAcoesPulso` (status e prazo das ações, sob a RLS).
- **Visão geral em blocos (0.3.205, Etapa 3 do plano-skin-viva):** `VisaoGeralView`, usada por `/visao-geral` e `/inicio`.
  - **"O que exige ação agora":** os vencidos, dos mais atrasados para os menos, e os que vencem em até 30 dias. Mostra no máximo 6, cada um com Resolver, que leva ao `href` do vencimento.
  - **Saúde dos documentos:** o anel.
  - **Dias sem acidente com afastamento:** `lib/visao-geral/diasSemAcidente.ts`, testado. A data vem de `useUltimoAcidenteAfastamento`: último `investigacoes_acidente` com `houve_afastamento`, sob a RLS e com o vínculo do técnico. Sem registro, mostra "Nenhum acidente com afastamento registrado".
  - **Totais:** Empresas, Inspeções e Laudos, com `AnimatedNumber`.
  - **Mudanças de 03/11:** o cartão e a lista por Unidade saíram, porque o JCN tem 1 unidade. O menu desta tela passou do verde `#0f3d28` para o marinho `#0b1e33`.
- **Casca inset (0.3.204, Etapa 2 do plano-skin-viva):** em tela md+, a raiz dos layouts (`.casca`) é marinho `#071526`.
  - **Folha:** o `div` do conteúdo (`.casca-folha`) encosta no topo e na borda direita, sem cantos arredondados, com sombra junto ao menu e `overflow: clip`, que mantém a topbar sticky.
    - Na 0.3.209 saíram a margem de 8px e os cantos de 18px: a faixa marinho em volta parecia uma moldura preta.
  - **Largura:** a folha usa `margin-left: var(--sidebar-w)` no lugar do `padding-left` e acompanha o menu recolhido (`--sidebar-w-mini`). A Gestão não recolhe.
  - **Onde vale:** em 21 layouts de módulo e na Gestão. Celular e impressão ficam iguais, porque as regras valem só em `@media screen` md+.
  - **Fundo:** `.app-aurora` claro e `--color-app-bg` deixaram o verde (`#eef3f8` / `#f3f6f9`).
- **Dicas nos campos (0.3.203, Etapa 1 do plano-skin-viva):** `components/ui/Dica.tsx`.
  - **Rótulo:** `<CampoLabel dica={...}>Nome</CampoLabel>` deixa o nome com sublinhado pontilhado. Passar o mouse ou chegar com Tab abre a caixa depois de cerca de 300 ms; o toque abre na hora.
  - **Caixa:** fica acima do rótulo, ou abaixo se faltar espaço. Vai para o `<body>` (portal), fecha com Esc (sem fechar a janela), usa `role="tooltip"`, não sai na impressão e não anima com `motion-reduce`.
  - **Textos:** centralizados em `lib/dicas/<modulo>.ts`. O teste limita cada um a 140 caracteres e exige frase terminada.
  - **Piloto:** cadastro de Empresas, com 28 campos.

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
| `comercial` | Comercial – Oportunidades de venda (v267; ligado para os Admins) |

A **Gestão (kanban)** não é um módulo de `modulos_permitidos`: o acesso vem do cadastro de membros (`gestao_membros`).

### 3.2 Hub

- `/inicio` e `/visao-geral` (`VisaoGeralView`): unidades clicáveis (definem a unidade ativa), pendências por módulo, atividade recente, vencimentos e validade de laudos (vencido / vence em 60 dias / em dia), gráficos. Link para `/validades`.
- `/modulos`: cartões dos módulos permitidos, agrupados em Segurança do Trabalho, NR — Fatores Psicossociais e JCN Sistema Interno, ordenados por pendências. Cartões extras: Comercial (quem tem o módulo), Gestão Gerencial, PDFs (Admin), Presença, Gestão JCN (membros), Sistema (Admin). O aviso "Sem módulos liberados" só aparece quando não há nem cartão de categoria nem cartão extra (desde a 0.3.251; antes os extras não contavam, e quem só tinha o Comercial ou a Gestão via o aviso). O cartão Empresa, que todo interno vê, não conta.

### 3.3 Layout dos módulos

- `SidebarShell` (`components/layout/SidebarShell.tsx`): título, seções de itens (`{href, label, icon, variant}`), rodapé fixo (Voltar, Início, Módulos, Empresas, Sair). 220 px, recolhível; gaveta no celular.
- `ModuleTopbar`: recolher menu, breadcrumb, chip da unidade ativa, chip de pendências offline, avatar com perfil.
  - **0.3.258 (do Painel 0.3.896/0.3.897):** a foto/sigla de quem está logado virou **menu** (`MenuDaFoto`): nome e e-mail, **Notificações** (com a contagem de não lidas) e **Sair** (`useSair`). Abre num portal (position fixed), por cima de tudo, e fecha ao rolar. Também na Visão geral, ao lado do sino. (No Painel o menu tem as OS da T.I, que são só da Chabra.)
- **Ajuda (0.3.258, do Painel 0.3.880):** os guias de ajuda ocupam toda a largura ao lado do menu, e o **Exportar PDF** (`ImprimirTopicos`) abre a lista dos tópicos da própria página (blocos dentro de `data-ajuda-topicos`) e imprime só os marcados. Vale para AEP, AET, Químicos, Apreciação, Conformidade, Não Conformidade, Equipamentos, Escala, Frota, DRPS e Questionários.
- **Várias fotos de uma vez (0.3.258, do Painel 0.3.882):** nos campos que guardam mais de uma foto, dá para selecionar várias imagens de uma vez (`lib/fotos/lote.ts`, testado; `BotoesFotosCampo`, `FotoSlots`). Nas Fotos da inspeção cada imagem vira uma foto, com a mesma categoria, setor e legenda; nos campos com limite entra o que couber e o sistema avisa quantas ficaram de fora. Em Conformidade e RNC, Tirar foto abre a câmera e Escolher fotos seleciona várias. Os hooks de Apreciação, Fichas de máquina, Conformidade e RNC gravam a lista numa gravação só.
- Cada módulo tem seu `layout.tsx` com `useAuth()` + `useRequireModule()` + menu próprio. O Painel SST usa `components/layout/Sidebar.tsx`: Principal (Dashboard, Inspeções, Relatórios, Certificados, Riscos Psicossociais — os dois últimos ocultos para Cliente), Ações, Configuração.

---

## 4. Área administrativa (Sistema)

Menu: Usuários, Funções, Configurações, PDFs Gerados, Lixeira, Auditoria, Presença. Admin vê tudo; quem tem `ve_presenca_auditoria` vê só Presença e Auditoria.
- **Correções das Configurações do Sistema (0.3.229)**, achadas na auditoria das dicas, com as decisões do João de 04/11:
  - **Listas auxiliares:** o formulário de risco passa a usar as listas da aba (`lib/riscos/listas.ts`, testado); lista vazia volta às fixas e o valor já gravado no risco continua como opção. Renomear item não perde mais o foco.
  - **/config:** saiu a trava própria da página, que expulsava o Admin enquanto o usuário carregava (o layout já trava desde a 0.3.224).
  - **Certificado A1:** o .pfx antigo só sai do armazenamento depois do Salvar (`DELETE /api/cert/upload`, que não apaga arquivo ainda usado por alguma conta). Trocar ou remover o arquivo limpa validade e titular; "Verificar validade" pede para salvar antes quando o arquivo é novo.
  - **Registro na folha de assinaturas:** cargo de outra área sai como "Reg.", não mais "CRP" (`linhaRegistroAssinatura`, testado).
  - **Funções:** "Aplicar padrão" grava todas as contas numa instrução só (tudo ou nada) e confere quantas mudaram. Ajuda do nível Admin corrigida: a área Sistema exige o perfil Admin.
  - **Tipos de risco e Triagens:** os modais reiniciam a cada abertura. Renomear um tipo leva o nome novo para `riscos.tipo_risco`; tipo do sistema não muda de nome.
  - **Matrizes:** reabrir usa o lookup salvo (o ajuste manual de célula não se perde mais). Renomear probabilidade/severidade leva o nome novo para os riscos (da matriz, ou sem matriz quando ela é a ativa) e para os itens da Apreciação da matriz (`lib/riscos/renomear.ts`, testado; troca entre linhas não é levada e avisa).
  - **Perguntas customizadas:** o PGR imprime o texto da pergunta, não a chave (`usePerguntasTexto`). Chave nova não repete a de nenhuma pergunta, do tipo ou do modelo.
  - **Portal SST:** link no menu da área Sistema; prazo em dd/mm/aaaa aqui e no portal do cliente.
  - **Textos:** perfis com acento ("Técnico"), permissões do Visualizador e certificado de acordo com o código, sem jargão (hardcoded, dropdown, RiscoForm, lib/utils.ts, "pra").
- **Banco (0.3.228, v320):** a tabela `usuarios` só aceita escrita de Admin. Antes, uma policy aberta deixava qualquer conta logada alterar qualquer usuário. O Portal do cliente › Meu perfil troca nome e cargo pela RPC `usuario_atualizar_meu_perfil`. A `funcoes_painel` já era só Admin.
- **Trava por endereço (0.3.224):** o layout só desenha a tela para Admin (ou para a gerência em Presença e Auditoria). Enquanto o usuário carrega, e para quem não tem acesso, aparece "Verificando acesso" até o redirecionamento. Antes, a tela era desenhada e as consultas dela disparavam até o redirecionamento.
- **Configuração dos módulos (0.3.224):** `components/layout/TravaRota.tsx` com as listas de `lib/acesso/rotas-protegidas.ts` fecha por endereço, para quem não supervisiona, as telas que o menu já escondia: AET (Texto padrão, Config. OWAS, Perfis OWAS, Config. 13 Fatores), AEP (Texto padrão), Químicos (Base de referência) e QPS (Tipos e Perguntas, Metodologia, Texto padrão). Quem abre pelo endereço recebe o aviso e volta à raiz do módulo.
  - Ficaram como estão as telas de configuração que o menu mostra a todos (Texto padrão de Químicos, Psicossocial, Conformidade, Não Conformidade e Apreciação; catálogos do Psicossocial).

### 4.1 Usuários (`/usuarios`)

- Formulário: nome, e-mail, senha; **função** (obrigatória ao criar, aplica os padrões); cargo; CPF/CRP/CRM/MTE; perfil; flags; empresas vinculadas (Técnico: várias; Cliente: 1); unidades (≥1); módulos; papel na Gestão; imagem de assinatura (bucket `fotos`); certificado A1/A3 (upload do .pfx em `/api/cert/upload`, bucket privado `certificados`; "Verificar" em `/api/cert/validar` lê validade e titular — a senha nunca é gravada).
- **0.3.190 (do Painel SST, v0.3.849):** o acesso à Gestão é uma caixa dentro de "Acesso aos módulos". As colunas Unidades × Setores (v294) saíram desta tela e ficam só em Gestão › Membros e acessos.
- O campo "Nova senha" usa `autocomplete="new-password"` (o navegador não autopreenche).
- **0.3.253 (banco v333, do Painel 0.3.901 + MD 0.3.906) — permissões por módulo e por tela:** "Acesso aos módulos" virou a grade `GradePermissoesModulos`: cada grupo (Segurança do Trabalho, NR — Fatores Psicossociais, JCN Sistema Interno) abre e fecha, e cada módulo tem **Visualizar, Criar, Editar e Excluir** ("Permitir/Bloquear todas" por grupo e "Permitir/Bloquear tudo"). "Empresas e Validades" tem linha própria (`geral`). O bloco antigo de três caixas gerais saiu.
  - **Criar/Editar/Excluir por módulo:** gravados em `usuarios.permissoes_modulos` (jsonb). Conta com a coluna NULL (todas as antigas) segue as chaves gerais `pode_criar/editar/excluir` em todo lugar, como antes. Ao salvar, as chaves gerais continuam gravadas como "pode em algum módulo" (`flagsGerais`). Os hooks `useCanCreate/useCanEdit/useCanDelete` descobrem o módulo pelo endereço (`MODULO_DA_ROTA`, testado contra o disco). Regras em `lib/acesso/permissoes-modulo.ts`. A 2ª etapa do Painel (v346, o banco conferir a grade) **não** foi trazida: aqui a grade só muda a tela.
  - **Visualizar por tela:** a seta ao lado do módulo abre as telas dele (`TELAS_DO_MODULO` em `lib/acesso/telas-modulo.ts`, testado: toda tela tem página), cada uma com o seu Visualizar, e o módulo mostra "N de M telas". Guardado em `usuarios.telas_bloqueadas` (as telas que a pessoa **não** vê; NULL = todas). Tela bloqueada some do menu (`SidebarShell`), o cartão da Sinalização Psicossocial some do hub, e a entrada pelo endereço volta para a primeira tela liberada do módulo (`useRequireModule`). A rota é da tela de prefixo mais longo. A última tela liberada não se desmarca; liberar o módulo libera as telas. Admin vê tudo. Criar/Editar/Excluir seguem o módulo.
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
`registros_excluidos` guarda o snapshot (`dados` jsonb) antes de excluir. `excluirComLixeira()`: grava snapshot → DELETE (com `.select()`) → se falhar **ou não apagar nenhuma linha com o registro ainda existindo** (RLS barrando sem erro), apaga o snapshot e mostra erro → auditoria. Antes (até 2026-10-05) o DELETE barrado por RLS mostrava "excluída" e deixava fantasma na Lixeira. Soft delete (`DELETADO/DELETADA`) registra o status anterior. Restaurar: re-INSERT (hard) ou volta o status (soft).

### 4.6 Auditoria (`/auditoria`)
- `auditoria_eventos`: gatilhos em todas as tabelas de `auditoria_tabelas` (tabela nova liga sozinha). Grava quem, quando, tabela, registro, módulo, empresa, ação (criou/editou/excluiu) e, na edição, só os campos alterados (com diff de jsonb de 1 nível); segredos e imagens mascarados; busca textual sem acento.
- Legado: `document_audit_logs` (histórico por documento; assinatura de PDF grava `assinou_pdf`).
- Tela com filtros (período, e-mail, módulo, ação, empresa, tabela, registro, campo, texto) e paginação por cursor.

**0.3.193 (do Painel SST, banco v316):**
- **Botão Histórico** (`components/auditoria/BotaoHistoricoDocumento.tsx`), nos 13 documentos com tela própria: inspeção, empresa, AEP, AET, DRPS, QPS, Conformidade, Não conformidade, Apreciação NR-12, Químicos, Investigação, Equipamento e Veículo.
  - Mostra a linha do tempo do documento e dos itens dele, com o antes e o depois de cada campo (`DetalheEvento`, que a Auditoria também usa).
  - Vê quem consegue abrir o documento.
- **Exportar XLSX** na Auditoria (`lib/auditoria/exportar-xlsx.ts`): leva todos os eventos dos filtros, até 20.000, nas abas Eventos e Campos alterados.

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

**IA da AEP (Parecer Técnico Preliminar e Recomendações, 2026-10-05):** o prompt de `gerar-parecer-aep-ia` incorpora as três premissas do RT — AEP é triagem preliminar e não substitui a AET; DRPS/Questionário é complementar (percepção dos trabalhadores); resultados dependem das observações e devem ser revistos quando as condições mudarem (NR-01, inventário). O editor envia também os **fatores organizacionais com nível AIHA, probabilidade × severidade e sinais**, e o **Necessita AET** do setor: o parecer cita os níveis, indica AET só quando o setor tem indicação e o DRPS/Questionário como complemento; não lista ações (ficam nas Recomendações, que classificam em imediatas/preventivas/estruturais e não repetem o diagnóstico). max_tokens 2000.

**Modelos de IA (0.3.234, 05/11/2026):** o Groq retirou os modelos llama, kimi e qwen antigos. Texto: `openai/gpt-oss-20b`, `openai/gpt-oss-120b` e, de reserva, `qwen/qwen3.8-27b` (com `reasoning_effort: "none"`). Visão (foto): só `qwen/qwen3.8-27b`; os modelos gpt-oss não aceitam imagem. Conferir em `GET /openai/v1/models` quando uma função der 404 de modelo.

Edge functions (Supabase): `gerar-conclusao-drps-ia` (DRPS e QPS), `gerar-parecer-aep-ia`, `gerar-analise-setor-aet-ia`, `gerar-consideracoes-aet-ia`, `gerar-observacao-psi-ia`, `gerar-acao-ia`, `analisar-maquina-ia`, `gerar-observacao-conformidade-ia`, `gerar-obs-gerais-conformidade-ia`, `gerar-treinamentos-inspecao-ia`, `extrair-campos-fispq`, `analisar-quimico-ia`, `gerar-parecer-apreciacao-ia`, `analisar-foto-apreciacao-ia`, `gestao-ia`. Texto: o Groq retirou o `llama-3.1-8b-instant` em 2026-10 (as funções passaram a dar 502); desde então todas as funções de IA de texto (as edge functions acima e as duas rotas Next de AET) tentam uma lista de modelos em ordem (`llama-3.3-70b-versatile`, `openai/gpt-oss-20b`, `openai/gpt-oss-120b`, `llama-4-scout`, `qwen3-32b`, `kimi-k2`) e pulam para o próximo quando um falha (param só em 401); se todos falham, devolvem 502 com o motivo de cada modelo. `max_tokens` mínimo de 1500, porque os `gpt-oss` raciocinam antes de responder. Em 2026-10-02, na conta Groq atual, só os `openai/gpt-oss-*` respondiam — os outros davam 404. A visão também tenta uma lista: `analisar-maquina-ia` (`llama-4-maverick`, `qwen3.6`, `qwen2.5-vl`, `llama-4-scout`) e, desde v0.3.148, `/api/maquina/analisar-foto` (`qwen3.8-27b`, `llama-4-maverick`, `qwen3.6-27b`). **Limite do Groq (429), desde v0.3.148:** o cliente do Supabase (`createSupabaseBrowserClient`) lê a resposta de erro das edge functions e, quando o motivo foi o limite, troca o erro genérico por "Limite de uso da IA atingido. Tente de novo em N segundos" (`lib/ia/limite-groq.ts`, código `limite_ia`, que o `mensagemErro` mostra); as telas de IA mostram essa frase. Rotas Next com IA: `/api/gerar-analise-setor-aet-ia`, `/api/gerar-intro-capitulo-aet-ia`, `/api/maquina/analisar-foto` (visão). Todo texto gerado passa por revisão humana (`RevisaoIAModal`).

### 5.7 E-mail
Só a edge function `welcome-email` (Resend). Sem `RESEND_API_KEY` responde `{sent:false}`.

### 5.8 Google Agenda (Gestão)
OAuth (`/api/gestao/google/connect` → `callback`, refresh token cifrado com `GESTAO_GOOGLE_ENC_KEY`; o consent pede também o perfil para a foto), sincronização da fila `gestao_google_fila` (`/sync`, disparada ao abrir `/gestao` e depois de cada gravação; aceita também `Authorization: Bearer GESTAO_CRON_TOKEN`, mas no JCN não há agendador chamando), webhook do Google (`/webhook`), feed `.ics` (`/api/gestao/ics`) e formulário público (`/api/gestao/form` + `/f/[token]`).
- **Níveis de acesso claros (v0.3.162, banco v304, 2026-10-28):** em Membros e acessos (pessoas e equipes) o nível é escolhido pelo que a pessoa **vê** (todas as tarefas do quadro / só as próprias — vinculada ou que criou) e pelo que **faz** (só ver / ver e comentar / ver e editar): seis níveis em `lib/gestao/niveis.ts` (`SeletorNivel`, `LegendaNiveis`). Antes, "Visualizador total" era o nível máximo (editava tudo) e "Pode editar" via menos que ele; não havia "vê todas, só lê" — agora há (`view_all`) e "vê todas e comenta" (`comment_all`). Conceder não vem com nível pré-marcado. Os acessos existentes continuam iguais. Em Usuários, marcar um setor da Gestão dá "Todas as tarefas · ver e editar" (o aviso diz isso).
- **Membros e acessos reorganizado (v0.3.163, banco v305, 2026-10-28):** cinco abas. **Dar acesso:** várias pessoas de uma vez (`acessos/PessoasPicker`: busca sem acento, filtro por perfil, "Marcar as N da busca") × **espaço, pasta ou lista** (`acessos/RecursoPicker`: árvore com busca; marcar espaço/pasta vale para as listas de dentro, inclusive as criadas depois; listas cobertas aparecem "incluída") × nível; **copiar acessos de outra pessoa** (os diretos — sem restritivo e sem tarefa — e, opcional, as mesmas equipes; `planoCopia` em `lib/gestao/acessos.ts`); regras atuais agrupadas por recurso com busca, selo "teto" no restritivo. **Por pessoa / Por lista:** o nível que vale de fato (RPC `gestao_acessos_efetivos`) e de onde vem, marcando a regra que manda, o teto e a que ficou sem efeito (lista > pasta > espaço) e as unidades da pessoa; o botão **Compartilhar** da barra da lista abre em Por lista, com "Dar acesso a esta lista". **Equipes:** várias pessoas de uma vez e acesso por espaço/pasta/lista. **Histórico:** `gestao_acesso_log` (300 mais recentes, busca). O **motivo** é pedido na hora de confirmar (`acessos/MotivoDialog`, com sugestões e o último lembrado), não mais num campo que travava o modal. Quadro pessoal (Meu Quadro) não aparece para conceder (antes aparecia: `useQuadros` não traz `dono_email`; o modal usa `useQuadrosAcesso`). Gravação em `acessos/useGravarAcessos` (mesmas RPCs logadas, um toast no fim).
- **Membros e acessos só por equipe (v0.3.266, do Painel 0.3.910, pedido do João em 10/11/2026: "quero igual do painel"):** saíram as abas **Dar acesso** e **Por lista**, que davam acesso direto à pessoa em paralelo às equipes (e o acesso direto segurava quem saía da equipe). O modal abre em **Equipes** (Equipes, Por pessoa, Histórico). O **Compartilhar** da lista abre em Equipes com a lista já marcada em "Dar acesso" (`EquipesTab.recursosIniciais`) e um aviso de qual lista é. `acessos/AbaPessoas.tsx` apagado. Banco sem mudança: os acessos diretos que já existem continuam valendo e aparecem em "Por pessoa" como "Direto na lista…" (dali dá para tirar).
- **Membros e acessos no menu lateral (v0.3.168, 2026-10-28):** o botão saiu da barra da lista e virou item do menu lateral da Gestão, logo abaixo de Colaboradores (`GestaoSidebar`, prop `onAcessos`; só gestor, como antes). Abre o mesmo `MembrosModal`, sem lista em foco. O **Compartilhar** da barra da lista continua lá (abre o modal em Por lista).
- **Desde v0.3.142:** card **Google Agenda** no Meu Espaço (status, Desconectar — `/api/gestao/google/status` e `/disconnect`); ao conectar, as tarefas abertas com prazo vão para a agenda; tarefa com hora vira evento com hora; evento criado pela pessoa na agenda principal vira tarefa no Meu Quadro, com os convidados como responsáveis (`lib/gestao/google/inbound.ts`); foto da conta no lugar das iniciais (`AvatarPessoa`).
- **E-mail dos avisos:** o `/sync` também envia os avisos pendentes (`lib/gestao/avisos-email.ts`). Desde v0.3.147, o JCN (sem domínio próprio) envia pelo **Gmail** via SMTP com senha de app: `GMAIL_USER`, `GMAIL_APP_PASSWORD` e, opcional, `EMAIL_REMETENTE_NOME` na Vercel (`nodemailer`; ~500 e-mails/dia). Sem Gmail, usa o Resend (`RESEND_API_KEY`, `FROM_EMAIL`). Sem nenhum dos dois, os avisos ficam só no sino. Os e-mails saem quando alguém abre ou grava na Gestão.
- **Anexos do formulário público:** o arquivo sobe direto para o Storage (bucket `anexos`, `gestao/<tarefa>/…`) por URL assinada — `/api/gestao/form/anexo` com `acao: "preparar"` e depois `"confirmar"` —, porque a Vercel não aceita corpo de requisição acima de 4,5 MB. Até 10 arquivos de 50 MB; o ticket (HMAC com `SUPABASE_SERVICE_ROLE_KEY`, 30 min) amarra o envio à tarefa que acabou de ser aberta.

### 5.9 Outras APIs
`/api/cnpj/[cnpj]` (BrasilAPI com fallback publica.cnpj.ws), `/api/frota/cep/[cep]`, `/api/sgg/enviar-riscos`, `/api/equipamentos/biometria/verificar`, `/api/dimensionamento/sincronizar`.

---

## 6. Empresas e unidades

- **Empresa** (`empresas`, `EMP-…`): nome, razão social, fantasia; CNPJ/CPF/CEI/CAEPF/CNO; grau de risco (1–4) com origem `NORMA`/`MANUAL`; status; endereço completo; telefone, e-mail; CNAE principal e descrição; situação cadastral; porte; `id_unidade`; `tipo_estabelecimento` (`CLIENTE`/`TERCEIROS` + `id_empresa_contratante`); referência, locais de emergência, dados adicionais; vínculo SGG.
- **CNPJ:** `/api/cnpj/[cnpj]` preenche endereço, CNAE e porte.
- **Grau de risco NR-4:** `cnae_grau_risco` (Anexo I) + `lib/nr4/grau-risco.ts` (subclasse de 7 dígitos → classe de 5); sugerido automaticamente; obrigatório exceto para TERCEIROS.
- Detecção de duplicatas (CNPJ/nome), importação em lote CSV/XLSX, lista com filtro de unidade e busca tolerante (acha também pelo nome fantasia, que aparece abaixo do nome quando é diferente). A lista monta os cards em **janela progressiva** (`useListaProgressiva`) e sem uma consulta por card; o card inteiro é clicável e abre a ficha. Trocar a **unidade** de uma empresa lista quem fez inspeções nela e perderia o acesso (`lib/empresas/perda-de-acesso.ts`) e só salva depois de confirmar.
- Detalhe `/empresas/[id]`: Visão geral, Dados cadastrais, **Documentos & Laudos** (desde v0.3.139: TODOS os documentos da empresa em sequência de data — Inspeção, Conformidade, Não Conformidade, AEP, AET, DRPS, Questionários, Químicos, Apreciação NR-12, Investigação —, inclusive sem PDF, com aviso dos módulos sem permissão e PDFs avulsos recolhidos; `lib/hooks/useDocumentosEmpresa.ts` + `DocumentosEmpresaLista`), Inspeções; relatório da empresa. A antiga aba "Registros por módulo" saiu (coberta pela lista).
- **Grupos de empresas (v278, 2026-10-07; replicado do painel v282):** empresas com mais de um CNPJ ficam juntas num grupo — uma **matriz** e as **filiais** (`empresa_grupos`; `empresas.id_grupo` + `papel_grupo` MATRIZ/FILIAL, os dois juntos; desde a v283 o grupo aceita **várias matrizes** — ex.: condomínios da mesma administradora —, Tornar matriz não rebaixa as outras e cada matriz tem Tornar filial). O campo Grupo, no cadastro e no filtro, aceita digitação (`GrupoSelect` sobre `components/ui/SelectBusca.tsx`). Tela **Empresas › Grupos** (`/empresas/grupos`): lista, abrir grupo, Tornar matriz, Remover do grupo, Adicionar empresa, Novo/editar/excluir grupo (excluir só desfaz o grupo) e **sugestões pela raiz do CNPJ** (8 primeiros dígitos, 2+ CNPJs diferentes; ordem 0001 sugerida como matriz). Cadastro da empresa: bloco **Grupo de empresas** (`CampoGrupoEmpresa`) com Matriz/Filial e sugestão pela raiz do CNPJ. Selo "Grupo X · Matriz/Filial" no cartão e no cabeçalho da empresa. **Busca pelo nome do grupo** no `EmpresaSelect`, na tela Empresas (filtro por grupo, `?grupo=ID`) e nas listas com busca (AEP, Comercial, Sinalização, Psicossocial, QPS, Validades, Investigação, Conformidade/Não Conformidade, Apreciação); listas simples de empresa viraram `EmpresaSelect`. Empresa de outra unidade aparece no grupo sem acesso (RPC `empresa_grupos_membros()` com `visivel`). Criar/editar: `caller_pode_editar()` (Admin/Técnico). Código: `lib/empresas/grupos.ts` (com testes), `lib/hooks/useGruposEmpresas.ts`.
- **Unidades** (bases JCN) em Configurações › Unidades.

---

## 7. Módulos de SST

**Comum a todos:** IDs `PREFIXO-XXXXXXXX` (AEP e AET usam uuid); capítulos do laudo em `textos_padrao` (AEP e AET também têm `aep_textos_padrao`/`aet_textos_padrao`); capítulos **fixos** (gerados pelo sistema, identificados por `slug_fixo`, ex.: `sumario`, `identificacao_empresa`, `sst_corpo`) intercalados com os editáveis pela `ordem`; PDF no servidor (`/api/pdf/<modulo>/[id]`); assinatura digital; "Levar para o campo"; lixeira; `data_validade` alimenta os alertas de vencimento; **a IA só sugere** — um modal permite aceitar, editar ou rejeitar antes de gravar.

### 7.1 Painel SST / Inspeções (`app/(app)`)

**Propósito:** inspeção de campo de SST (NR-01/PGR) — setores, cargos, riscos, EPIs, fotos, PAE, treinamentos, extintores, máquinas, AEP/AET. Gera o Relatório de Inspeção e o PGR; depois o administrativo elabora o documento no SGG.

**Dashboard (`/dashboard`):** KPIs (Empresas Ativas, Total de Inspeções, Em Andamento, Concluídas, Rascunhos — todos excluem `tipo_criacao='RENOVACAO'`); gráficos: **Inspeções realizadas por TST** por mês, por status, documentos concluídos pelo ADM por mês, documentos por situação (Aguardando campo / Pendentes / Atribuídos / Em elaboração / Concluídos), empresas associadas por mês e por pessoa; situação por colaborador; atividade recente. Regras em `lib/dashboard/inspecoes.ts`, `documentos.ts` e `associacoes-empresas.ts`; consultas compartilhadas em `lib/hooks/useDashboardFontes.ts`. **Desde v0.3.149 (26/10/2026):**
- **Inspeções realizadas por TST** (`/dashboard/inspecoes-concluidas`): cada inspeção conta para o **técnico que foi a campo** (aba Responsáveis, vínculo `id_usuario`; dupla conta para os dois), mesmo que outra pessoa tenha clicado em Concluir, no **mês da 1ª conclusão** (`inspecoes.primeira_conclusao_em`, v295, travada no banco). Reabrir e concluir de novo não muda o mês nem a pessoa; o aviso de reabertura mostra quem reabriu, quando, se concluiu de novo e a **lista de campos alterados** (antes → depois) da inspeção e das abas, lida da auditoria (`dashboard_reaberturas`). Sem técnico registrado, conta para quem abriu ("sem registro") e os supervisores (Admin ou nível Aprovação, `useIsSupervisor`) veem a **nota para os supervisores**, onde escolhe o técnico de cada uma (grava em `responsaveis` pela função `dashboard_definir_tecnico`, que confere o supervisor no banco, não duplica e não oferece conta desativada). **v297:** os técnicos da aba no momento da 1ª conclusão ficam travados (`primeira_conclusao_tecnicos`) — quem reabre e se inclui na aba não leva o crédito; vazio = sem registro, e aí vale a aba atual (onde a nota grava). A lista de alterações da reabertura cobre todas as abas da inspeção (inclusive cargos, EPI/EPC, complementos, PAE, treinamentos e plano de ação), dá nome ao item incluído/excluído e não conta a ida para a Lixeira como reabertura. Em documentos associados, a associação excluída depois continua contando no mês em que aconteceu (auditoria). Na página da pessoa, inspeções batem pelo nome exato da barra e, em associados, "todos os meses" mostra também o número do gráfico (empresa conta 1 vez por mês). **Filtro por unidade (v0.3.152):** as telas de inspeções, documentos concluídos, documentos associados e a página da pessoa têm o seletor "Unidade" no topo (`useFiltroUnidadeDashboard` + `FiltroUnidade`). Começa na unidade ativa, vale para as quatro telas enquanto se navega entre elas (não muda a unidade ativa do sistema) e recorta pela empresa de cada linha (`empresas.id_unidade`); as réguas não mudam.
- **Documentos concluídos (ADM)** (`/dashboard/documentos-emitidos`): mesma regra — mês e responsável da 1ª conclusão do documento (`primeira_elaboracao_em/_por`), aviso de reabertura com as mudanças.
- **Documentos associados** (`/dashboard/por-associados`): por mês, **quantas empresas** foram associadas a cada pessoa (por ela ou por outra pessoa), sem acumular; documento assumido pelo botão entra no mês em que foi assumido (auditoria, `dashboard_assuncoes`). Gráfico **Por pessoa — acumulado** (soma dos meses até o mês escolhido). O card e o donut do dashboard usam a mesma conta.
- **Página da pessoa** (`/dashboard/pessoa?fonte=inspecoes|documentos|associados&nome=`): clicar no nome em qualquer gráfico "por pessoa" abre as **empresas em que ela atuou** pela régua daquele gráfico, em todos os meses, com filtro de mês e as inspeções/documentos de cada empresa.
**Documentos por Situação** segue a regra da lista (`situacaoDocumento`): Pendentes · **Atribuídos** (tem associado, ninguém começou) · Em elaboração (início de verdade) · Concluídos — desde 0.3.172 (v309); antes associado contava como Assumido. Contagens paginadas (`fetchAllRows`), sem o teto de 1000 linhas. `/relatorios` → relatório da empresa.
**Revisão da tela principal (v0.3.173, 28/10/2026)** — pedido: o Dashboard tem que representar de fato o que acontece com cada colaborador e com as empresas:
- **Unidade:** o seletor "Unidade" (`useFiltroUnidadeDashboard` + `FiltroUnidade`) também está na tela principal e vale para **todos** os cartões (KPIs, gráficos, donuts, Situação por colaborador e Atividade recente) — antes a principal somava todas as unidades e o detalhe abria na unidade ativa. `useInspecoesPorMes(naUnidade?)` recorta pelo `id_empresa` (a tela Início continua com todas).
- **KPIs** contados de uma única consulta (`inspecoes` com as colunas calculadas, paginada), sem renovação; Empresas Ativas = `status='Ativo'` na unidade. Cada cartão abre a lista de Inspeções já filtrada (`?status=` e `?unidade=`). O aviso de Em Andamento só aparece quando há inspeção **parada há mais de 30 dias** (`dias_espera`, `LIMITE_PARADA`) e diz quantas — antes acendia sempre.
- **Documentos por Situação** ganhou a fatia **Aguardando campo**: documento com associado cuja inspeção ainda não foi concluída em campo (não dá para começar). **Atribuídos** só conta com a inspeção já CONCLUIDA (`porSituacao` em `lib/dashboard/documentos.ts`).
- Os cartões de associação foram renomeados para **Empresas Associadas por Mês** e **Empresas por Associado** (contam empresas desde 26/10; o título dizia "Documentos").
- **Situação por colaborador** (novo, `lib/dashboard/colaboradores.ts`): uma linha por pessoa com Campo aberto (Rascunho/Em andamento, crédito por `tecnicosCreditados`), Parado +30d, Doc. não iniciado (atribuído, inspeção concluída), Em elaboração (responsável, senão os associados), Entregues no mês (1ª conclusão, mesmo número do gráfico ADM), Críticas/urgentes (`prioridade_efetiva`) e Prazo vencido — cada inspeção conta uma vez por pessoa; "Sem responsável" não entra. Ordem: críticas, prazo vencido, total aberto. Para supervisores, o nome abre `/inspecoes/minhas?pessoa=<id>`.
- **Atividade recente:** as 8 inspeções **alteradas por último** (`updated_at`; antes pela data da visita), na unidade; colunas Técnico de campo (`tecnicos_campo`; sem ninguém na aba, quem abriu "(sem registro)"), Documento (`situacaoDocumento` com os associados — antes só o responsável, quase sempre "—"), Status, Visita e Alterada; renovação marcada com etiqueta.
- **Atualizar** recarrega todas as consultas da tela (`CHAVES_DASHBOARD`), não só os KPIs.

**Lista (`/inspecoes`):** pílulas Todos · Rascunho · Em Andamento · Concluídas · Associados · **Não associados**, com **seleção múltipla** (status somam; Associados/Não associados cruzam com eles; linha "Mostrando" com o que está marcado; `lib/inspecoes/pilulas.ts`); filtros empresa, técnico, associado, unidade, período. O período usa a **data de conclusão** para as concluídas (e a da visita para as demais). O filtro **Técnico** procura quem foi a campo (`tecnicos_busca`, sem acento; sem ninguém na aba, quem lançou); a coluna Responsável mostra "campo: X" quando é outra pessoa; coluna **Status Assoc.** (Concluído com data / Em elaboração com quem / Pendente). Trocar o técnico responsável exige supervisor.
**Filtros e prioridade (v0.3.164–0.3.165, banco v306+v307, 2026-10-28):** os filtros da lista ficam **no endereço** (`lib/inspecoes/filtros-url.ts`: recarregar não perde, o link pode ser mandado; `?empresa=` continua valendo). Busca por ID ou nome da empresa; Técnico e Associado em **lista de nomes**; **Só as minhas** (onde a pessoa foi a campo ou está no documento — RPC `inspecoes_atribuidas`); **Período** com atalhos (Hoje, 7/30 dias, Este mês, Mês passado, Personalizado); pílulas **Documento** (Pendente / Em elaboração / Entregue — a coluna Status Assoc., agora filtrável pela coluna calculada `situacao_documento`) e **Prioridade** (Crítica/Urgente/Média/Baixa, pela efetiva); **Mais filtros** (Unidade, tempo de espera); etiquetas dos filtros ligados com "×" e "limpar todos"; ordenar por prioridade, espera e prazo. Coluna **Prioridade** depois de Rev.: `PrioridadeCelula` (seletor na própria linha, gravado por `gravar` — funciona sem sinal) + `PrioridadeCalculada` (selo "calculada" quando ela passa a marcada, com o porquê no balão; "Aberta há N dias"/"Documento aguardando há N dias"; botão do prazo). No cabeçalho da inspeção, `PrioridadeSelo` só mostra. **Prioridade (escala igual à do painel v308, 0.3.165/v307):** BAIXA/MEDIA/GRAVE/CRITICA, rótulos Baixa/Média/**Urgente**/Crítica; quem edita a inspeção (`useCanEdit`) marca prioridade e prazo — sem restrição de supervisor, como no painel. A calculada: prazo vencido, documento vencido ou espera > 45 d = Crítica; prazo ≤ 3 d, validade ≤ 30 d ou espera > 30 d = Urgente; prazo ≤ 7 d ou espera > 15 d = Média; senão Baixa — vale a maior entre marcada e calculada. Admin edita os associados pela linha (`ModalEditarAssociados`, igual ao painel). **Espera:** inspeção aberta conta desde a visita; concluída com documento não entregue, desde a conclusão. **Minhas inspeções** (`/inspecoes/minhas`, item no menu): o técnico vê as inspeções em que foi a campo e o associado os documentos em que está, abertas e mais urgentes primeiro; cartões Abertas, Críticas e urgentes, Prazo vencido, Esperando +15 dias e Concluídas/Entregues no mês (clicáveis); filtros de prioridade, espera, período, busca e ordem (no endereço); supervisor escolhe a pessoa. Regras em `lib/inspecoes/prioridade.ts` (espelho dos limites do banco, com teste).

**Visões e complexidade (v0.3.166, banco v308, 2026-10-28):** a busca por ID/empresa do topo da lista saiu (a empresa se escolhe no seletor; um `?q=` antigo ainda filtra e aparece como etiqueta). Abas de **visão** (`?visao=`): **Todas** (tudo), **Técnicos (campo)** — Técnico, pílulas de Status (Rascunho/Em andamento/Concluídas), "Só as minhas" só pelo campo — e **Associados (documento)** — Associado, pílulas Associados/Não associados e Pendente/Em elaboração/Entregue, "Só as minhas" só pelo documento. Trocar de visão limpa os filtros que a nova visão esconde (`trocarVisao` em `filtros-url.ts`); empresa, unidade, período, prioridade, complexidade, espera e ordem valem nas três. As pílulas ficam num cartão, em grupos com título (Status · Documento · Prioridade · Complexidade). Coluna **Complexidade** logo depois de Prioridade (`ComplexidadeCelula`, mesma mecânica: seletor na linha por quem edita, `gravar`): Baixa/Média/Alta/Muito alta (`lib/inspecoes/complexidade.ts`), manual, com filtro e contagem; aparece também no cartão de Minhas inspeções (0.3.169: a fila virou tabela com a linha de títulos no topo — Prioridade · Complexidade · Empresa · Status · Espera · Ações —, como a lista de Inspeções; no lugar do nome em cima de cada seletor da 0.3.167). **0.3.170:** o filtro "Situação" (Só as abertas / Todas) virou **Status** (Todos · Rascunho · Em Andamento · Concluídas, `?status=`), como na lista; sem status marcado a fila mostra tudo, as que esperam primeiro (ordem por prioridade). Os cartões limpam status e período; "Concluídas no mês" marca Concluídas. **0.3.171:** nas duas telas, Status, Documento (seções Associação e Situação do documento), Prioridade e Complexidade viraram **listas suspensas com caixinhas** (`components/ui/FiltroSuspenso.tsx`), no visual do select de Tempo de espera, com a contagem em cada opção na lista; continuam aceitando várias opções e os mesmos parâmetros no endereço; marcar todas as opções de Status ou de Associação equivale a não filtrar. **0.3.172 (banco v309) — Atribuído × Em elaboração:** ter associado não é mais "em elaboração" (revê a regra de 22/09). Situação do documento: Pendente · **Atribuído** (tem associado, ninguém começou; coluna Status Assoc. "Atribuído · Fulano · não iniciado", âmbar) · Em elaboração · Entregue — em `lib/inspecoes/documento.ts` (`ATRIBUIDO`), na coluna calculada `situacao_documento`, no filtro Documento da lista e no donut do Dashboard. O início é carimbado (`elaboracao_iniciada_em/_por`, `elaboracao_inicio_origem`) pelo botão "Iniciar elaboração" (card Documento do relatório — para quem já está associado; quem não está continua com "Assumir elaboração (eu)" — e botão "Iniciar" na linha de Minhas inspeções › Como associado) ou, sozinho, pela 1ª edição do associado no documento com a inspeção já concluída em campo (gatilho na auditoria; origem AUTOMATICO, "(1ª edição)" na tela). "Liberar" volta a Atribuído. Minhas inspeções › Como associado: filtro Documento (Atribuído/Em elaboração/Entregue, `?doc=`), "Atribuído há N dias, não iniciado" (`atribuido_em`) e "Iniciado em dd/mm" na coluna Espera. **Minhas inspeções:** cada filtro com o título em cima; a busca é só pelo nome da empresa.

**Coluna Ações fixa (v0.3.179, 2026-10-30, sem banco):** a coluna Ações da lista fica presa à direita (`sticky`, `ACOES_FIXAS` em `components/inspecoes/InspecaoRow.tsx`; o cabeçalho usa a mesma), com fundo opaco e uma sombra leve à esquerda. Com nome de empresa longo, zoom no navegador ou tela de notebook, a tabela rola de lado e os botões Editar / Relatório / Excluir continuam à vista. As células passaram de `px-4` para `px-3`, e com isso a tabela cabe sem rolagem em mais telas.

**Ações só de supervisor; associado inicia antes de abrir (v0.3.180, 2026-10-30, sem banco):**
- **Lista de Inspeções:**
  - a coluna Ações (Editar, Relatório, Excluir; `comAcoes` em `InspecaoRow`) e a troca de prioridade, complexidade e prazo (`podeEditarPrioridade`) só aparecem para supervisor/admin (`useIsSupervisor`: perfil Admin ou nível Aprovação/Admin);
  - técnicos e associados só consultam a lista e trabalham por Minhas inspeções.
- **Documento (relatório `/inspecoes/[id]/relatorio` e Versão PGR `/inspecoes/[id]/pgr`):**
  - quem está associado à inspeção e não é supervisor/admin, com `elaboracao_status` PENDENTE (o "Atribuído"), vê o aviso "Inicie a elaboração para abrir o documento" com o botão ▶ Iniciar, no lugar do documento (`components/inspecoes/AguardandoInicio.tsx`, regra em `lib/inspecoes/inicio.ts`, testada);
  - Iniciar usa o mesmo RPC `set_elaboracao_documento` de Minhas inspeções, e o documento abre na hora.
- **Minhas inspeções:** para o associado, "Abrir documento" só aparece depois do Iniciar.
- **Editor da inspeção** (`/inspecoes/[id]`): não foi bloqueado.
- **0.3.182 (banco v311) — apontamento de tempo do documento:** o Iniciar virou controle de tempo trabalhado, só no documento (associados).
  - **0.3.252 (banco v332):** o **responsável** pelo documento também inicia e retoma, mesmo sem linha de associado (a mesma regra da fila Minhas inspeções). Antes recebia "so quem esta associado ao documento aponta tempo nele". `estaNoDocumento` e `ehResponsavelDocumento` em `lib/inspecoes/inicio.ts` (testados); `useAguardandoInicio` recebe o responsável. As linhas de associado que faltam não são criadas, para não mover documentos antigos no gráfico por mês. Correção trazida do Painel (0.3.883).
  - **0.3.255 (do Painel 0.3.872):** com o documento em elaboração, **qualquer associado conclui** (`podeConcluirDocumento`, testado), mesmo com outra pessoa como responsável; o **Liberar** segue só com o responsável e o supervisor. Atribuído e ainda não iniciado ganha o botão **Iniciar elaboração** no card. Na **1ª conclusão**, o associado que clicou vira o responsável e leva o documento (`responsavelAoConcluir`); reabrir e concluir de novo volta o nome da 1ª conclusão (`primeira_elaboracao_por`, v295), e o supervisor fora do documento não leva o crédito. Quem tem a marca **Ver relatório na lista** não conclui por estar associado.
  - **0.3.255 (banco v334, do Painel 0.3.862):** marca por pessoa em Sistema › Usuários, **"Mostrar o botão Ver relatório na lista"** (`usuarios.ve_relatorio_lista`, só na edição): a lista de Inspeções mostra só o Ver relatório (sem Editar) e o relatório tira Assumir elaboração e Associar-me (`acoesDaLista`/`soConsultaDocumento` em `lib/inspecoes/acoes-lista.ts`, testado). Só muda a tela.
  - **0.3.255 (do Painel 0.3.887):** abrir um documento ou o editor pela lista de Inspeções ou por Minhas inspeções leva o endereço da lista com os filtros (`?volta=`), e lá aparece **Voltar para Inspeções** / Minhas inspeções, como você deixou (`lib/inspecoes/volta.ts`, `voltaSegura` impede sair do sistema; `useVoltaInspecao` guarda por inspeção no sessionStorage).
  - **0.3.259 (banco v337):** `pdfs_assinados.tipo_assinatura` passou a existir no banco (o código já usava): o relatório não dá mais erro ao ler a assinatura, e **assinar com a imagem do técnico** volta a gravar. `usePdfAssinado` usa `maybeSingle` (documento sem assinatura não gera erro).
  - **Sessões:** Iniciar/Retomar abre uma sessão da pessoa (`documento_sessoes`); Pausar fecha com motivo (Pausa, Aguardando cliente, Aguardando informação do técnico, Outra prioridade, Fim do expediente). Uma sessão aberta por pessoa: iniciar outro documento fecha a anterior.
  - **Pausa automática:** depois de 30 min sem atividade, a sessão fecha no horário da última atividade. O relatório, a Versão PGR e o editor avisam a atividade (`useAtividadeSessao`: mouse, teclado, rolagem e toque, no máximo a cada 2 min). Concluir ou liberar o documento fecha as sessões dele.
  - **Contas** (`lib/inspecoes/sessoes.ts`, testada):
    - **trabalhado** = soma das sessões (pessoa-hora), também por pessoa;
    - **aguardando cliente** = do fim da pausa "Aguardando cliente" até o próximo início no documento, ou até agora; fica fora do trabalhado.
  - **Telas:**
    - **Minhas inspeções:** na aba associado, ▶ Iniciar/Retomar abre o documento já contando, e há o cronômetro com Pausar; a coluna Espera mostra "Trabalhado …" e "Aguardando cliente há …"; o topo mostra "Hoje: … apontadas".
    - **Relatório:** o card Documento (SGG) tem o mesmo controle e os totais por pessoa; "Assumir elaboração (eu)" associa e já inicia a sessão.
  - **Bloqueio (regra nova):** o associado (não supervisor) só abre o relatório e a Versão PGR com a **própria sessão correndo**. Sem ela, vê o aviso com Iniciar/Retomar (`lib/inspecoes/inicio.ts`). O documento entregue abre para leitura.
- **0.3.188 — Liberar/Concluir param o cronômetro na hora:** o banco já fechava as sessões (gatilho, motivo LIBERADO/CONCLUIDO), mas `useSalvarElaboracao` não recarregava as sessões, e o painel seguia "Seu tempo está correndo" por até 1 min. Agora ele recarrega as sessões e as listas de inspeções.
- **0.3.187 — painel compacto e janelinha no canto:**
  - **Mais baixo:** faixa de `py-3` com cronômetro `text-2xl` e indicadores em uma linha. Linha do tempo, por pessoa e sessões ficam em **Detalhes**, que abre e fecha.
  - **"Levar para o canto"** (ícone na faixa): vira uma **janelinha flutuante** com:
    - ponto e ícone pela situação, cronômetro, Pausar (variante mini) ou Iniciar/Retomar e voltar ao documento;
    - posição inicial a 124px do topo, à direita, abaixo dos botões da página;
    - **arrastável** pelo ícone e pelo cronômetro;
    - no card fica uma linha fina "Tempo do documento no canto da tela · … · Mostrar aqui".
  - **Automático:** com o painel no lugar, a janelinha aparece quando o **meu** tempo está correndo e o painel saiu da tela (IntersectionObserver).
  - O modo, a posição e o Detalhes aberto ficam no `localStorage` (`jcn.painelTempo.*`).
- **0.3.186 — painel de tempo:** o card Documento (SGG) do relatório ganhou o `PainelTempoDocumento` (`components/inspecoes/PainelTempoDocumento.tsx`), que mostra:
  - **faixa colorida pela situação:**
    - verde: o meu tempo correndo, com cronômetro HH:MM:SS que anda a cada segundo só enquanto há sessão aberta;
    - azul: outra pessoa trabalhando;
    - âmbar: aguardando cliente, com o tempo desde a pausa;
    - cinza: pausado ou não iniciado;
    - índigo: entregue, com o total trabalhado;
    - Iniciar/Retomar ou Pausar com motivo, na própria faixa;
  - **indicadores:** trabalhado, você hoje, aguardando cliente, sessões · pessoas;
  - **linha do tempo:** do primeiro início até agora ou até a entrega; as sessões ficam na cor de cada pessoa e as esperas do cliente, em listras âmbar (`esperasDoCliente`, `fmtCronometro` em `lib/inspecoes/sessoes.ts`, testadas);
  - barras por pessoa e a lista de sessões, com Corrigir.

  O controle saiu do cabeçalho do card; Assumir, Concluir, Liberar, Desfazer e Reabrir continuam lá.
- **0.3.185 (banco v314) — conclusão por engano:**
  - **Confirmação:** "Concluir (emitido e enviado)" pede confirmação antes (`confirmar`, `ConfirmHost` no relatório).
  - **Desfazer conclusão:** fica 10 min no card para **quem concluiu**, com "até HH:MM". O documento volta a Em elaboração, o tempo da pessoa é reaberto e, se era a primeira conclusão, ele deixa de contar como emitido no mês.
  - **Depois dos 10 min:** só o Reabrir do supervisor, que não mexe na primeira conclusão.
- **0.3.184 (banco v313):** pausar ou concluir com uma sessão já parada há 30 min fecha essa sessão na última atividade (INATIVIDADE), sem contar até "agora".
- **0.3.183 (banco v312) — correção e indicadores:**
  - **Correção pelo supervisor:** no card Documento (SGG), "Sessões de trabalho (N)" lista cada sessão (pessoa, início, fim, duração, motivo, selo "corrigida" com o histórico no título). O supervisor/admin corrige início e fim com justificativa (`ListaSessoes`/`CorrigirSessaoModal`, RPC `documento_sessao_corrigir`). O antes fica em `documento_sessoes_correcoes`.
  - **Dashboard › Tempo nos documentos** (`/dashboard/tempo-documentos`): só supervisão. Link "Tempo nos documentos" em Situação por colaborador. Filtro de unidade. As contas estão em `lib/dashboard/tempo-documentos.ts`, testadas. A página mostra:
    - **trabalhando agora:** quem está com o cronômetro correndo;
    - **parados:** documentos em elaboração sem ninguém há 3 dias ou mais, com "aguardando cliente" marcado;
    - **horas por mês:** últimos 12 meses; a sessão entra no mês em que começou; clicar num mês filtra as pessoas;
    - **horas por pessoa:** com o número de documentos;
    - **média por complexidade dos documentos entregues:** trabalhado, aguardando cliente e do início à entrega.
- **0.3.181:** o botão **Nova Inspeção** aparece também em Minhas inspeções (ao lado de "Ver a fila de"), com a mesma regra da lista (`useCanCreate`, `pode_criar`), porque técnicos e associados trabalham dali.

**Nova (`/inspecoes/nova`):** empresa + tipo: `BRANCO`, `REVISAO` (copia inspeção da mesma empresa), `COPIA_EMPRESA` (copia de outra empresa), `RENOVACAO` (registro administrativo; não conta nos gráficos). Revisão = maior revisão da empresa + 1. A cópia escolhe o que levar (setores, cargos, riscos, EPIs, responsáveis, fotos) e remapeia os IDs. "Quem vai a campo" cria `responsaveis` (com `id_usuario`): o técnico é **escolhido do cadastro** (busca por nome); offline, a aba Responsáveis aceita nome digitado. Nasce `EM_ANDAMENTO`. `/inspecoes/ficha` gera a **Ficha de Inspeção** em branco para imprimir, com dois leques: **Mostrar** (seções na tela) e **Gerar PDF** (seções na impressão, independente da tela) — `FichaSecoesLeque`.

**Copiar p/ Empresa (botão do editor, `CopiarParaEmpresaModal`):** cria uma inspeção `COPIA_EMPRESA` em outra empresa com o que for marcado. **Desde 0.3.189 a nova inspeção fica com a data de hoje** (`hojeSP()`), e não a da origem; antes ela nascia "aberta há N dias" e caía no mês errado dos gráficos. Na Nova inspeção a data é a que a pessoa escolhe.

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
11. **AEP** e 12. **AET** (v259): o laudo nasce em `aep_relatorios`/`aet_relatorios` com `id_inspecao`, já com os setores, cargos (e máquinas, na AET) da inspeção; usa os **mesmos editores dos módulos** (extraídos para `components/aep` e `components/aet`); desde 2026-10-05 o laudo **já nasce cadastrado no módulo** (`enviado_modulo_em` preenchido ao iniciar) e aparece na lista do AEP/AET na hora; laudo antigo com `enviado_modulo_em` nulo fica fora das listas até **"Enviar para o módulo"**. É o mesmo registro nos dois lados. O botão **"Excluir"** da aba (só quem edita, com confirmação) manda o laudo para a Lixeira. Abas só para quem tem o módulo.
13. **Complementos** (`complementos`): Procedimento, Ordem de Serviço, Treinamento, Inspeção Periódica, Sinalização, Documento, Outro.
14. **Observações** (`inspecoes.observacoes`).

Cabeçalho do editor: links Relatório, PGR e Ficha; dados da empresa; quadro **Documentos da empresa** (DRPS, QPS, AEP, AET por fase — Em andamento, Concluído, Enviado ao cliente; visível a todos); Levar para o campo; Concluir, Reabrir (supervisor ou criador), renovação; **Copiar para empresa**.

**Largura:** a tela de preenchimento da inspeção (`/inspecoes/INS-…`) usa a largura toda da janela (2026-10-05, `TELA_LARGA` em `app/(app)/layout.tsx`); as demais telas do Painel SST continuam limitadas a 1400px.

**Relatório de Inspeção (`/inspecoes/[id]/relatorio`):** capítulos editáveis antes/depois de `sst_corpo` (padrão: Introdução, Metodologia, Considerações Finais). Corpo: identificação da empresa; resumo por nível e categoria, com o quadro **Documentos da empresa** (DRPS, QPS, AEP e AET por status, o mesmo da página da inspeção) no fim do Resumo Geral; bloco **por setor** (conformidades, fotos, cargos, riscos por tipo com NHO-08 e EPIs, treinamentos, extintores, máquinas); itens gerais; observações; PAE; responsáveis. Card **Documento (SGG)**: fluxo de elaboração + associados + envio de riscos ao SGG. Não tem rota `/api/pdf` — usa captura da página (`BotaoGerarPdf`) e pode ser assinado.

**PGR (`/inspecoes/[id]/pgr`):** Resumo quantitativo; Inventário de riscos (Setor → Cargo → Tipo); Detalhamento por risco; Plano de ação (riscos com medidas recomendadas); Responsáveis; PAE; Observações.

**Tabela `inspecoes`:** empresa, data, status (`RASCUNHO | EM_ANDAMENTO | CONCLUIDA | DELETADA`; concluir grava `concluida_em`), revisão, responsável, observações, `tipo_criacao` (`BRANCO | REVISAO | COPIA_EMPRESA | RENOVACAO`), `id_inspecao_base`, usuário, validade, **elaboração** (`elaboracao_status`: PENDENTE → EM_ELABORACAO → CONCLUIDO, com responsável e data; `inspecao_associados`).

**Cálculo de risco (atual):** `calcularNivelComMatriz(prob, sev, matriz)` (`lib/calc.ts`) sobre `matrizes_risco` (probabilidades, severidades, `lookup[iP][iS]`, pesos, faixas, ativa). Com pesos e faixas: `score = peso_prob × peso_sev` → nível pela faixa (padrão: Trivial 0; Baixo 1–2; Moderado 3–6; Alto 7–10; Muito Alto ≥11); sem pesos usa o `lookup`. Matriz **ativa: AIHA 5×5** (probabilidade: Não há exposição … Exposição elevadíssima; severidade: Pouca importância, Preocupantes, Severos, Irreversíveis, Ameaça). Cada risco pode ter sua própria matriz. (Legado: `calcularNivelRisco` 5×4 em `lib/utils.ts`.)

**Risco → Plano de Ação** (`lib/acoes/de-risco.ts`): só Alto (prioridade Alta) e Muito Alto (Crítica); "o quê" = medidas recomendadas; "por quê" = tipo, agente, nível, prob/sev, fonte; "onde" = setor.

**Plano de Ação central (`/acoes`, `acoes_5w2h`):** what, why, where, when (date), who, how, how much, status (Pendente, Em Andamento, Concluida, Cancelada), prioridade (Baixa, Media, Alta, Critica), origens (`id_risco_origem`, `id_apreciacao_item/acao`, `id_aet_acao`). Agrupado por empresa e prazo; PDF por empresa (`/api/pdf/plano-acao/[idEmpresa]`); IA `gerar-acao-ia`.

**Certificados (`/certificados`, `certificados_treinamento`):** certificados de treinamento emitidos aos trabalhadores — empresa, trabalhador, CPF, setor, cargo, NR, treinamento, carga horária, datas, validade, número, instrutor, **emitido por** (conta + nome gravado). Quadro "Por emissor", cartões (total, no mês, vencem em 30 dias, vencidos), filtros. Escrita só Admin/Técnico (RLS). Oculto para Cliente.

**Riscos Psicossociais:** ver 8.3.

**Lote do Painel SST (0.3.190):**
- "Mais recentes" e "Mais antigas" ordenam por `data_inspecao` (a data da visita) e desempatam por `created_at`. Vale para `useInspecoesPaginadas` e para a fila de Minhas inspeções.
- `TreinamentoForm` guarda os vinculados numa ref, e o formulário não zera quando a inspeção recarrega.
- Assinar PDF A1 e Assinar com imagem aplicam `perfilPodeAssinarPorOutro`: quem assina só por si vê só o próprio nome e é avisado antes se não tem certificado.

**Lote do Painel SST (0.3.191):**
- **Cópia completa** (`lib/inspecoes/copiar.ts`, testada): a Nova inspeção (cópia/revisão) e o Copiar p/ Empresa usam `montarCopia`/`gravarCopia`.
  - Cada linha vai inteira e só os ids e vínculos são remapeados.
  - Levam setores, cargos, riscos, EPI, treinamentos (com as ligações por setor, cargo e risco), complementos, PAE, extintores, máquinas, responsáveis e fotos.
  - A opção Ergonomia (`lib/inspecoes/copiar-ergonomia.ts`) copia a AEP/AET como Rascunho, com o plano de ação e as respostas QPS da AET.
- **EPI/EPC:** o lançamento pode ir para vários setores de uma vez (`EpiForm`). A aba EPIs fica agrupada por setor e risco, com filtro de setor.
- **Associar-me:** fica no card Documento (SGG), para quem não é supervisor e só até o documento ser entregue.
- **Menu lateral:** a largura é ajustável (`SidebarAlca`, `--sidebar-w`, `useSidebarMini.largura` de 180 a 420px). Vale também para a Gestão.

### 7.2 Relatório de Conformidade (`/relatorio-conformidade`)

Empresa + NR do catálogo (`lib/conformidade/checklists.ts`: NR-01, 05, 06, 07, 09, 10, 12, 17, 20, 23, 24 — 21 perguntas em 5 grupos —, 26, 35) ou "LIVRE". Tópico pode ser **ocultado do PDF** (`oculto`, v284: fica no relatório, sai do PDF/laudo e do resumo). Botão **Trocar** responsável técnico (vale finalizado e no laudo). Fotos saem **inteiras** no PDF (altura fixa, largura da foto). Itens **copiados** para `relatorios_conformidade_itens` (situação `CONFORME | NAO_APLICAVEL | PENDENTE`, observação, fotos até 8 MB, itens de outra NR ou livres). Relatório `RASCUNHO → FINALIZADO` (finalizado = somente leitura). **Avaliação % = (Conformes + N/A) / total × 100.** IA para observações. Laudo: Introdução, Fundamentação Legal, itens por NR, resultado %, Considerações Finais, assinaturas (Responsável Técnico e Responsável da Empresa).

### 7.3 Relatório de Não Conformidade — RNC (`/relatorio-nao-conformidade`)

`relatorios_nao_conformidade` (título, setor, NR opcional…) + itens (descrição, norma violada, **criticidade** ALTA/MEDIA/BAIXA, causa raiz, ação corretiva, prazo, responsável, **tratativa** ABERTA → EM_TRATAMENTO → ENCERRADA, fotos). "Inserir do checklist da NR" cria a NC já preenchida. Resumo por criticidade. Laudo: Introdução, Metodologia, descrição das NCs, plano (ações, responsáveis, prazos), Considerações Finais, assinaturas.

### 7.4 Apreciação de Máquinas NR-12 (`/apreciacao-maquinas`)

- **Nova:** empresa, responsáveis, data, notificação SIT — **importa automaticamente** as máquinas da inspeção da empresa como **fichas**, agrupadas por setor.
- `apreciacoes_maquinas` (laudo: conclusão técnica, recomendações, risco residual, componentes, limites de uso/espaço/tempo, NPE, sistemas de segurança atuais e necessários, incluir checklist no PDF, validade), `apreciacao_fichas_maquina` (uma por máquina: identificação, componentes — 12 opções, sistemas de segurança — 10 opções, constatações, parecer, operadores, fotos), `apreciacoes_maquinas_itens` (checklist por ficha: **38 itens NR-12** em 11 categorias — Portaria 916/2019; situação `CONFORME | NAO_CONFORME | NAO_APLICAVEL | PENDENTE`; prob/sev/nível pela matriz), `apreciacao_riscos_hrn`, `apreciacao_perigos_catalogo` (pré-preenche perigos), `apreciacao_acoes` (5W2H). Inventário em `/relacao-maquinas` (`inventario_maquinas`).
- **Método HRN (ISO/TR 14121-2):** POD (Muito Provável 4, Provável 3, Improvável 2, Remota 1) × FEP (Diariamente 4, Semanalmente 3, Mensalmente 2, Anualmente 1) × GPD (Catastrófica 4, Grave 3, Moderada 2, Baixa 1) = **HRN 1–64**; classificação sugerida ≤8 Desprezível, ≤18 Baixo, ≤36 Médio, >36 Alto (o técnico pode alterar); risco residual pela mesma régua; NPE só informativo; categoria de segurança NBR 14153 (B, 1–4).
- Só finaliza sem itens pendentes. "Gerar plano" cria ações para os itens não conformes (prioridade pelo nível); pode enviar ao Plano de Ação central.
- **Laudo:** capa, sumário, identificação, Introdução, Fundamentação Legal, Objetivo/Base normativa/Método, Relação de máquinas, **Apreciação por máquina** (Setor → Máquina, 4.1, 4.2… com identificação, foto, operadores, constatações, tabela perigo → risco inicial → medidas de engenharia/administrativas → risco residual, parecer; checklist opcional), Conclusão Geral, Plano de Ação NR-12, Considerações Finais, assinatura. IA de parecer e de análise de foto.

**0.3.191:**
- A Relação de Máquinas lê `inspecao_maquinas`, da inspeção mais recente de cada empresa (`lib/hooks/useRelacaoMaquinas.ts`). É só leitura, e cada linha abre a aba Máquinas.
- O cadastro avulso, o `ImportarMaquinasInspecaoModal` e o "Enviar p/ Apreciação NR-12" saíram.
- `inventario_maquinas` continua no banco, só para o vínculo legado do laudo (`useMaquina`).

### 7.5 Análise de Químicos (`/analise-quimicos`)

- `analises_quimicos`: produto, CAS, fórmula, forma física, concentração, modo (PDF da FISPQ ou Manual), condições de uso (atividade, frequência, duração, ventilação, névoa/vapor, EPIs), **conclusão rápida** (insalubridade NR-15 com grau/anexo/fundamentação, aposentadoria especial, Decreto 3048, código GFIP, eSocial tab. 24, óleo mineral, carcinogênico, periculosidade NR-16, EPIs/EPCs, medidas, emergência, medição, metodologia, limite de exposição, resumo), origem `template` ou `ia`.
- `base_referencia_quimicos` (e cópia estática `lib/quimicos/base_referencia.ts`): agente, CAS, LT mg/m³ e ppm, grau NR-15, teto, pele, eSocial, IARC, inflamável, cancerígeno, TLV ACGIH, Decreto 3048, GFIP, anexo.
- **Fluxo:** FISPQ em PDF → parser (`lib/fispq/parser.ts`) → revisão → CAS casados com a base; IA completa campos faltantes. Lookup por CAS e depois por nome; em misturas, **pior caso** (pior grau NR-15 e IARC). **Tudo na base → conclusão por template, sem IA** (`lib/quimicos/gerarTemplate.ts`); algum componente fora da base → IA `analisar-quimico-ia`.
- **Laudo:** identificação do agente, condições de uso, insalubridade NR-15, periculosidade NR-16, previdenciário, carcinogenicidade, óleo mineral, medidas de controle, emergência, medição, parecer técnico, quadro decisório, assinatura.

**0.3.190:** o parser da FISPQ (`lib/fispq/parser.ts`) junta acentos soltos de PDFs em LaTeX e aceita o rótulo "Nome da substância ou mistura (nome comercial)". A análise ganhou o botão **Laudo / PDF** no topo.

**0.3.254 (trazido do Painel 0.3.873, 0.3.875 e 0.3.876):** a leitura da FISPQ ficou mais completa e mais segura.
- **Ingredientes sem CAS** com nome sigiloso ("Segredo industrial 1: < 5,0%") entram na composição, com o sinal da concentração. Sem CAS, só entra nome sigiloso, para não tomar "Solubilidade em água: 73%" por ingrediente.
- **CAS escrito com espaços** ("16961 - 83 - 4") é aceito quando o dígito verificador confere, e a faixa "10% - 40%" fica inteira.
- As colunas gravadas (`nome_quimico`, `numero_cas`…) guardam a **posição** de cada componente ("—" na célula vazia), e a tela, o laudo e o PDF remontam pela posição (`colunaComposicaoParaExibir`). Assim o CAS não vai parar na linha de outro ingrediente. Análises já gravadas não mudam.
- **Laudo do próprio sistema** enviado como FISPQ é recusado (`ehLaudoDoPainel`), e **PDF escaneado** sem texto é avisado no envio (`pdfSemTexto`; as marcas "=== Página N ===" não contam).
- A edge function `extrair-campos-fispq` não chama a IA sem texto e o prompt não tem mais exemplos de nome (a IA devolvia "Solvente XYZ").

### 7.6 AEP — Análise Ergonômica Preliminar (`/aep`)

- `aep_relatorios` (uuid): empresa, status (`RASCUNHO | CONCLUIDO`), **`setores` jsonb**, responsável, título e registro profissional, datas, endereço, conclusão, `id_inspecao`, `enviado_modulo_em`.
- **Setor:** nome, unidade, GHE, cargo, função, jornada, expostos, descrição da atividade, método de coleta, trabalhadores consultados, cargos (cargo, descrição, quantidade), riscos (tipo, risco, classificação — Trivial, De Atenção, Moderado, Alto, Crítico — medida preventiva), **checklist física** (9 itens: postura, repetitividade, levantamento de carga, mobiliário, esforço físico, iluminação, ruído, vibração, desconforto térmico), **cognitiva** (5 itens), **organizacional** (13 fatores psicossociais, com **5 sinais cada — 65 no total**, lista do RT de 2026-10-06, em `lib/aep/sinais-organizacional.ts`; chave antiga que saiu do catálogo é descartada na leitura e não conta para a matriz), observações, parecer (IA), recomendações, **necessita AET**.
- **Ergonomia Organizacional na matriz AIHA** (`lib/aep/aiha-organizacional.ts`, com testes): cada fator marcado **Sim** recebe Probabilidade × Severidade da **matriz de risco ativa** (a mesma da inspeção, hoje AIHA 5×5) e o nível pela mesma conta (`calcularNivelComMatriz`: peso_prob × peso_sev → faixa). **Sem sinal observado marcado:** fica "Não há exposição" × "Pouca importância" (campos travados) e o resultado é o da matriz para eles — **Trivial** (0×0), que não conta para a AET. A partir do 1º sinal, **probabilidade sugerida = 1 sinal por nível** (2026-10-06): 1 sinal → "Exposição a níveis baixos", 2 → moderada, 3 → elevada, 4 ou 5 → elevadíssima (antes era pela proporção: até 1/3, 2/3, acima); e **severidade padrão por fator** (índice AIHA: Assédio e Eventos traumáticos = Irreversíveis; Falta de suporte, Baixo controle, Justiça, Sobrecarga, Maus relacionamentos = Severos; demais = Preocupantes). O técnico pode trocar as duas (fica marcado como manual; "usar sugerida/padrão" volta). Gravado no setor em `aiha_organizacional` `{fator: {probabilidade, severidade, nivel, prob_manual, sev_manual}}` e recalculado pelo editor a cada mudança (e ao abrir, se a matriz mudou). Aparece no laudo/PDF da AEP e na **Sinalização Psicossocial** (chips coloridos pelo nível, ordenados do mais grave; contador de fatores Alto/Muito Alto).
- **Biblioteca como base de opções (2026-10-06, v276; `lib/aep/biblioteca.ts`, `lib/aep/inventario.ts`, com testes):** cada tópico do inventário de risco é uma **lista de opções** em `psi_biblioteca_itens` — por fator: perigo, fonte geradora (com código), evidência, descrição do risco, danos à saúde, medida de controle, sugestão inicial e ação; **comuns a todos os fatores**: meio de propagação, situação e tempo de exposição (padrão de cada fator em `psi_biblioteca_fatores`). `padrao` = vem marcada. Seed com tudo o que a biblioteca já tinha. **Quem inclui:** Admin direto (ativo); técnico **sugere** (pendente) e o Admin **aprova ou recusa** na fila "Sugestões pendentes" da página `/aep/biblioteca`, que mostra por fator cada tópico (Admin edita texto/código, marca padrão, exclui; todos podem sugerir) e as listas comuns com a tabela de padrões por fator (página na largura toda, um tópico embaixo do outro). No inventário do fator, cada tópico é um **campo de seleção múltipla com criação** (`MultiSelectCriavel`, 2026-10-06): as escolhidas ficam como etiquetas no campo, ao clicar abre a lista da biblioteca para marcar várias, digitar filtra e texto que não existe vira item manual no mesmo campo (Enter ou "Incluir «texto»"); o campo **Evidências é só leitura**: mostra os sinais observados marcados acima (em vermelho, contam na matriz) e o que já estava salvo; itens automáticos do checklist de gestão aparecem como etiquetas fixas. Cada item manual tem "salvar na biblioteca" (Admin: vira opção marcada) ou "sugerir" (técnico). Seleção em `setor.inventario[fator] = {sel: {tópico: ids}, extra: {tópico: textos}}` (tópico sem seleção = padrão; opção excluída/recusada some sozinha; fontes legadas por código ainda valem). Sinais do catálogo seguem contando na matriz; evidências da biblioteca e manuais não. **Medidas de controle recomendadas (v277):** tópico próprio (`medida_recomendada`), separado das existentes — seed com as mesmas medidas de referência, não marcadas; entra no inventário (coluna nova na planilha, depois de "existentes"), no laudo/PDF e na IA (somadas às ações permitidas). No editor, o nome de cada fator fica em **negrito**, os títulos das linhas do inventário também, e o inventário tem botão **Recolher/Expandir**.
- **Layout da Triagem Ergonômica (2026-10-06):** os blocos Física, Cognitiva e Organizacional ficam um embaixo do outro, cada um na largura toda, com os itens em colunas (Física e Cognitiva até 3); na **Organizacional, um fator embaixo do outro na largura toda** — prop `colunasItens` de `ChecklistBloco`. Ordem de cada fator organizacional: título → **Roteiro de campo (aberto)** → **Origem da evidência** (se Sim) → observação → sinais → matriz AIHA → inventário. Cada fator "Sim" mostra, por último, o quadro **"Inventário de risco" EDITÁVEL** (2026-10-06: cada tópico é selecionável — fontes da biblioteca, sinais do catálogo, sugestões e ações — e aceita texto/itens manuais; textos em branco voltam ao padrão da biblioteca; ajustes em `setor.inventario[fator]` (`InventarioFator`, `normalizarInventario`), aplicados por `detalhesDoSetor` e por isso iguais no laudo, PDF, planilha e IA; evidência manual não conta para a matriz; as fontes geradoras saíram do bloco de origem e ficam só no inventário) (aberto, as mesmas colunas do inventário exportado: perigo, fontes geradoras, evidências, meio de propagação, situação, tempo de exposição, medidas existentes, descrição, danos, probabilidade × severidade → nível, confiança, sugestões e ações), montado por `detalhesDoSetor` (biblioteca + checklist de gestão + sinais + matriz + origem).
- **Menos dependência de entrevistas — Fase 1 (2026-10-06, `lib/aep/coleta.ts` e `lib/aep/roteiro-campo.ts`, com testes):** (1) **motivo do N/I** obrigatório em cada fator organizacional N/I (`setor.motivo_ni`: Receio dos trabalhadores em se manifestar / Trabalhadores ausentes / Atividade não observada / Outro com texto) — o Salvar recusa N/I sem motivo; N/I continua fora da matriz e do Necessita AET; no laudo/PDF vira o quadro **"Limitações da avaliação"**; (2) **condições da coleta** no bloco Participação dos trabalhadores (`setor.condicoes_coleta`: abordados, participantes ≤ abordados, recusas/evasivas só em número, liderança presente, 4 sinais de inibição, observação) — no laudo/PDF vira a linha "Condições da coleta" com frase agregada; com sinal de inibição o editor **sugere** (não marca) os sinais "Falta de abertura para escuta" e "Ambiente de tensão ou silêncio excessivo" no Assédio e recomenda instrumento anônimo; (3) **roteiro de campo** por fator (perguntas indiretas + o que observar), recolhido no editor e impresso no Formulário em Branco (que ganhou também Condições da coleta e o motivo do N/I); (4) **DRPS por receio** (`DRPS_POR_RECEIO`): `recomendaQuestionario` recomenda DRPS/Questionário também quando algum setor tem N/I por receio ou sinal de inibição — vale para o aviso do editor, a Sinalização e o Comercial; (5) a **IA** recebe limitações, condições da coleta e o receio, e registra a limitação e o DRPS como complemento. Tudo no jsonb `setores`, sem migration; os dois normalizadores (`useAep.ts` e `/api/pdf/aep`) conhecem os campos novos.
- **Menos dependência de entrevistas — Fase 2 (2026-10-06, v272; `lib/aep/checklist-gestao.ts`, `lib/aep/evidencia.ts`, `lib/aep/biblioteca.ts`, `lib/aep/inventario.ts`, com testes):** (1) **Biblioteca psicossocial** (`psi_biblioteca_fatores`, chave = fator do sistema; seed do Anexo A: descrição do risco, danos à saúde, 87 fontes geradoras codificadas "1.1…13.7", meio de propagação, situação e tempo de exposição padrão, medidas a verificar, sugestões iniciais e ações) — única para o sistema (sem empresa; preparada para DRPS/QPS), leitura para todos, **edição só Admin** em `/aep/biblioteca` (menu AEP › Biblioteca psicossocial); (2) **Checklist de gestão** (`aep_relatorios.checklist_gestao`, uma vez por AEP, `/aep/[id]/gestao` e sub-aba da inspeção): 26 itens G01–G26 mapeados aos fatores, resposta Existe evidenciado / Existe sem evidência / Não existe / N/A, origem (documento, entrevista com gestor/RH, observação) e evidência em texto; "Não existe" e "Sem evidência" = **fonte geradora** dos fatores mapeados; "Evidenciado" = **medida de controle existente**; não muda a matriz; salvar registra na auditoria; (3) **Origem da evidência por FATOR** (decisão do usuário; `setor.origem_evidencia`: observação direta, relato individual, relato em grupo, documental, questionário anônimo) → **confiança** Baixa (1 tipo) / Média (2) / Alta (3+), lacuna de gestão conta como documental; aparece no editor, no laudo/PDF e na Sinalização (uso interno); mudanças vão para a auditoria ao salvar; (4) **Fontes geradoras** do fator: lacunas de gestão aparecem sozinhas e o técnico marca outras da biblioteca (`setor.fontes_geradoras`); (5) **Laudo/PDF**: bloco "Fatores psicossociais identificados — detalhamento" por setor (descrição, danos, fontes, medidas existentes, origem e confiança); (6) **Inventário psicossocial** (botões "Inventário (Excel)" e "CSV" no laudo): uma linha por setor × fator Sim, colunas Setor | GHE | Perigo | Fontes geradoras | Evidências (sinais) | Meio de propagação | Situação | Tempo de exposição | Medidas de controle existentes | Descrição do risco | Danos à saúde | Probabilidade | Severidade | Nível AIHA | Confiança | Sugestões iniciais | Ações, para lançamento no SGG; (7) **IA** recebe fontes, medidas, origem, confiança e a lista de sugestões/ações da biblioteca, e só escolhe ações dessa lista (além de AET, DRPS e revisão); com confiança Baixa registra a limitação. Matriz AIHA, Necessita AET, Sinalização e Comercial continuam lendo os mesmos valores.
- **Regra `calcNecessitaAet` (sugestão de AET):** **só** os fatores da Ergonomia Organizacional na matriz AIHA contam — pelo menos 1 fator Alto ou Muito Alto, **ou** pelo menos 2 Moderados. A lista "Matriz de Riscos" do setor **não** entra no critério (desde 2026-10-02); saiu do editor em 2026-10-07 (nenhuma AEP tinha riscos lançados); o laudo/PDF só mostram a tabela se um setor antigo tiver riscos gravados. No escalonamento do laudo, cada setor mostra o maior nível AIHA organizacional. Considerações automáticas quando vazias (`lib/aep/consideracoes.ts`).
- Telas: lista, dashboard, novo, formulário em branco (sem a Matriz de Riscos; botão para imprimir só a Triagem Ergonômica), Setores/Triagem, Dados/Conclusão, Laudo. A IA do Parecer/Recomendações recebe `recomenda_questionario` decidido pelo sistema (`recomendaQuestionarioSetor`: regra da AEP ou fator Sim Alto/Muito Alto no setor) e um lembrete do campo no fim do pedido (edge function `gerar-parecer-aep-ia` v8). Laudo: identificação, sumário, capítulos, escalonamento para AET, triagem por setor, considerações, assinatura.

### 7.7 AET — Análise Ergonômica do Trabalho (`/aet`)

- `aet_relatorios` (uuid): empresa, datas, responsável, status (`RASCUNHO | CONCLUIDO`), **`setores` jsonb**, considerações finais, **`textos_secoes`** (Introdução, Objetivo, Metodologia, Levantamento/Transporte de Materiais, Mobiliário, Equipamentos, Condições Ambientais, Organização do Trabalho, Ferramentas Biomecânicas), endereço, validade, `id_inspecao`, `enviado_modulo_em`.
- **Setor:** nome, função, máquinas/equipamentos, cargos, descrição, riscos (tipo, risco, intensidade, técnica, EPI/CA, eficácia, classificação), **OWAS** (costas 1–4, braços 1–3, pernas 1–7, esforço 1–3 — seleção múltipla; imagens de referência em `/owas/*.svg` ou personalizadas), checklist ergonômico (levantamento, posturas forçadas, trabalho em pé/sentado, pausas, cadeira, monitor, ritmo, rodízios…), perguntas extras, fotos (até 6), parecer, recomendações.
- **13 fatores psicossociais** (`aet_13fatores_config`/`_perguntas`/`_semaforo`, respostas 1–5 por setor em `aet_laudo_qps_respostas`): média do fator = média de (6 − nota) nas perguntas diretas e da própria nota nas invertidas, com 2 casas; **zona** ≥4,0 verde, ≥3,0 amarela, ≥2,0 laranja, <2,0 vermelha (`lib/aet/consolidar-psi.ts`); observação por fator (IA).
- **Plano de ação** (`aet_acoes`, 5W2H por setor), envio opcional ao Plano central. No PDF o Plano de Ação sai em **folha deitada** e os 4 capítulos fixos aceitam introdução editável (`aceitaIntro`). O PDF lê a mesma lista de perguntas padrão do checklist que a tela (`lib/aet/checklist.ts`). A IA da observação psicossocial sabe que nota alta = condição boa (edge function `gerar-observacao-psi-ia` v3).
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
- Trigger `fn_drps_carimbo_envio`: ao virar `ENVIADO_CLIENTE`, preenche `data_envio_cliente`. Laudo: Agravos e Medidas saem **justificados**, um parágrafo por item, com botões de alinhar (esquerda/centro/direita/justificar) por setor e por unidade (`alinhamentos_por_setor`, `alinhamentos_por_unidade_setor`, v286); plano 5W2H na folha deitada. `data_conclusao` é gravada pela tela ao Concluir. Excluir = soft delete (`DELETADO`) + lixeira.

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

**IA:** edge function `gerar-conclusao-drps-ia` (Groq, lista de modelos com fallback — ver 5.6; temperatura 0,5, até 1500 tokens, JSON `{conclusao}`): por setor 2–5 parágrafos (140–360 palavras); consolidado 2–4 parágrafos (120–320). Recebe empresa, setor, responsável, CRP, tópicos (nome, fonte, gravidade, probabilidade, matriz), agravos, medidas e o texto atual (para refinar).

**Plano de Ação 5W2H:** "O quê" do catálogo `drps_acao_oque`, "Como" com múltipla escolha dos `drps_acao_como` filhos.

**Gestão (`lib/drps/gestao.ts`):** plano anual de 13 programas × 12 meses; monitoramento por setor × tópico com recomendação por nível (Baixo: trimestral/12 meses; Médio: bimestral/9 meses; Alto: mensal/6 meses; Crítico: intervenção imediata e reavaliação em 90 dias); revisão com 5 ações obrigatórias e equipe de 9 papéis; **saúde geral** = média de %medidas, %monitoramento e %revisão.

**Laudo PDF** (`GET /api/pdf/drps/[id]`, `DrpsTemplate`): capítulos de `textos_padrao` (módulo `psicossocial`) + capítulos fixos por slug: `identificacao_empresa`, `sumario`, `drps_caracterizacao`, `drps_analise_setor`, `drps_conclusao`, `drps_plano_medidas`, `drps_plano_acao_5w2h`, `drps_revisao`, `drps_assinatura` (folha de assinaturas do psicólogo, CRP). Capa por imagem de fundo com caixas de texto posicionadas. Numeração a partir do sumário. Identificador `DRPS-{ano}-{8 caracteres}`. Variáveis em `lib/drps/variaveis.ts`.

**Colunas da Sinalização (2026-10-05):** cada empresa da lista mostra, da AEP entregue mais recente: **DRPS/Questionário** (Necessário quando a AEP tem 3+ alertas organizacionais ou, desde 2026-10-06, N/I por receio de manifestação / sinal de inibição na coleta — `recomendaQuestionario`, mesma regra do aviso do editor), **AET** (algum setor com Necessita AET), **Realizada por** (`responsavel_elaboracao`) e **Enviada por** (associado que concluiu o documento da inspeção, `inspecoes.elaboracao_responsavel`; "Sem inspeção" quando não há). A página da empresa repete isso em cada AEP. Embaixo do "Necessário/Não" do DRPS/Questionário aparece o que a empresa **já tem** (`useSituacaoQuestionarioEmpresas` + `situacaoQuestionario`: "DRPS/Questionário concluído", "… em andamento" ou "Nenhum feito"; concluído/enviado vence andamento, DRPS antes do QPS). Cada empresa mostra também **Unidade** (`empresas.id_unidade` → `unidades.nome`, a "Região" do SGG) e **Região** (município/UF do cadastro); a busca procura por esses campos e a página da empresa os mostra no cadastro. **Tela (2026-10-05):** cada empresa é um cartão — linha 1 com nome, CNPJ, unidade · região e o selo do nível; linha 2 com blocos em destaque (DRPS/Questionário com a situação, AET, Realizada por, Enviada por, Alertas, Setores, Entregue em; DRPS pendente e AET necessária ficam em âmbar). No topo, 4 contadores clicáveis (Empresas sinalizadas, Nível Alto/Muito Alto, DRPS/Questionário pendente = necessário e sem nenhum concluído, AET necessária). Embaixo da busca, filtros: Unidade, Nível AIHA, DRPS/Questionário (necessário / pendente / não), AET, Entrega (com/sem inspeção), Realizada por, Enviada por, com contagem "N de M" e "Limpar filtros". Regra em `lib/aep/sinalizacao-filtros.ts` (testada). **Leitura do DRPS/Questionário (2026-10-05, `leituraQuestionario` em `lib/aep/sinalizacao.ts`, testada):** em vez de "Necessário" + "DRPS concluído" (que confundia), o bloco mostra — não recomendado: "Não"; recomendado e nada feito: "Necessário · Nenhum DRPS/Questionário feito"; em andamento: "Necessário · DRPS em andamento desde dd/mm"; **concluído antes da AEP**: "**Revisão recomendada** · DRPS concluído em dd/mm/aaaa, antes da AEP de dd/mm/aaaa"; concluído na data da AEP ou depois: "**Atendido**". Data do DRPS = envio ao cliente > conclusão > elaboração > edição; do QPS = elaboração > edição. "Pendente" (filtro e contador) inclui a revisão. Na página da empresa, cada AEP abre com um **cabeçalho em destaque** (selo do maior nível e blocos Entregue ao cliente · Inspeção · Realizada por · Enviada por · DRPS/Questionário · AET, os necessários em âmbar) e cada setor mostra um **resumo colorido pelo nível** (nº de fatores · maior nível).

**Filtros da lista de Análises e do Dashboard AEP (2026-10-05, `components/aep/FiltrosListaAep.tsx` + `lib/aep/filtros-lista.ts`, testada):** busca por empresa/CNPJ/responsável, Status, AET (requer/não), Nível AIHA organizacional (maior nível entre os fatores; "Alto ou Muito Alto"), Inspeção (registrada/sem), Realizada por e período de elaboração (de/até), com "N de M análises" e "Limpar filtros". Somam-se ao seletor de empresa e à unidade ativa do topo. No Dashboard os cartões contam com todos os filtros menos o de status, e clicar num cartão de status liga/desliga esse filtro.

**Status da AEP (v266, 2026-10-05):** Rascunho → **Em andamento** → Concluído (= enviado ao cliente), escolhidos em Dados / Conclusão (`STATUS_LABEL_AEP`, `STATUS_COR_AEP`, `STATUS_ORDEM_AEP` em `useAep.ts`). O Dashboard AEP mostra cartões Análises · Rascunho · Em andamento · Concluídas · Requer AET · Riscos; clicar num cartão de status filtra a lista (de novo, limpa). O quadro Documentos da empresa já conta Em andamento.

**Setores e cargos da empresa no editor da AEP (2026-10-05):** o editor (Setores / Triagem) carrega o catálogo de setores e cargos que a empresa já tem nas inspeções não deletadas (`useCatalogoSetoresEmpresa` + `lib/aep/catalogo-setores.ts`, nomes iguais sem diferenciar maiúscula/acento/espaço viram um só). O campo **Setor** sugere esses nomes (datalist, digitação livre continua); no bloco **Cargos do setor** aparecem os cargos cadastrados para aquele setor (um a um ou "Adicionar todos"); o botão **Setores da empresa (N)** no cabeçalho adiciona de uma vez os setores que faltam, com descrição e cargos. "+ Cargo" manual continua.

**Nova Análise AEP — registrar em inspeção** (`/aep/novo`, 2026-10-05): depois de escolher a empresa, o campo **Registrar em inspeção** tem 2 opções obrigatórias (o *Não vincular* saiu na regra de entrega): *Inspeção realizada* (lista as inspeções da empresa, menos as deletadas; as que já têm AEP aparecem desabilitadas — uma inspeção só tem uma AEP; a AEP nasce com os setores e cargos dela) e *Criar nova inspeção* (cria uma inspeção em branco `tipo_criacao=BRANCO`, próxima revisão da empresa, data = data de elaboração). Com vínculo, a AEP grava `id_inspecao` e já nasce com `enviado_modulo_em` (aparece no módulo e na aba AEP da inspeção). Hook `useCriarAepNoModulo` em `lib/hooks/useErgonomiaInspecao.ts`.

**Regra de entrega (2026-10-05):** a Sinalização Psicossocial e a página AEP do Painel SST só mostram AEPs **entregues ao cliente** (hook `useAepsEntregues`): **com inspeção**, quando o documento da inspeção foi concluído pelo associado (`inspecoes.elaboracao_status = CONCLUIDO`, inspeção não deletada; data = `elaboracao_concluida_em`; o status da AEP não conta); **sem inspeção**, quando a própria AEP está **Concluída** (= enviada ao cliente; data = `aep_relatorios.concluido_em`, v265, preenchida por trigger). Documento reaberto / AEP de volta a rascunho sai. Na Nova Análise AEP o registro em inspeção é opcional: inspeção realizada, nova ou sem inspeção. O editor da AEP (Setores / Triagem) mostra uma faixa (`SituacaoSinalizacaoAep`) com a situação: sem inspeção, aguardando a entrega ou na Sinalização desde a data. A faixa tem o botão **Registrar em inspeção / Alterar inspeção** (`useAlterarInspecaoAep`): inspeção realizada (as que já têm outra AEP ficam desabilitadas), criar nova inspeção em branco, ou deixar **sem inspeção**; os setores da AEP não mudam. O módulo Sinalização Psicossocial tem a página **Matriz AIHA** no menu (`/sinalizacao-matriz-aiha`) com a explicação, que saiu de cima da lista de empresas dele.

**Sinalização psicossocial** (`/sinalizacao-psicossocial`, `lib/aep/sinalizacao.ts`): mesmo formato da página Riscos Psicossociais — lista das **empresas** com fatores organizacionais "Sim" nas AEPs (busca; maior nível AIHA; nº de alertas e setores; data da última AEP; ordenada do mais grave) → `/sinalizacao-psicossocial/[idEmpresa]`: dados cadastrais e, por AEP, um setor embaixo do outro com a tabela **Fator de risco · Resultado final (AIHA) · Probabilidade · Severidade · Sinais observados**. Sem link para o editor da AEP. A mesma tela também está no menu do **Painel SST** como **AEP** (`/aep-psicossocial` e `/aep-psicossocial/[idEmpresa]`, logo abaixo de Riscos Psicossociais); as duas rotas usam `components/aep/SinalizacaoEmpresasLista.tsx` e `SinalizacaoEmpresaDetalhe.tsx`. No módulo AEP há a página própria **Matriz AIHA** (`/aep/matriz-aiha`, menu lateral, sempre aberta) e o Texto Padrão da AEP tem o capítulo editável **"Avaliação dos Fatores Psicossociais — Matriz de Risco AIHA"** (ordem 2, logo após a Metodologia; `scripts/sql/aep_capitulo_matriz_aiha.sql`), que leva a mesma explicação para o laudo/PDF — por ser texto editável, não acompanha sozinho mudanças na matriz. Em `/aep-psicossocial`, em `/sinalizacao-psicossocial` e na Ajuda da AEP (`/aep/ajuda`, logo após Ergonomia Organizacional; aberto na impressão) aparece o quadro recolhível **"Entenda a matriz de risco AIHA na Ergonomia Organizacional"** (`components/aep/ExplicacaoMatrizAiha.tsx`): o que é a matriz AIHA; fundamentação (NR-01 1.5.3.1.4, 1.5.4.4.2, 1.5.4.4.3; NR-17 17.3.1/17.3.1.1/17.3.2; Guia MTE, ISO 45003, ISO 31000); como o sistema aplica (sem sinal = Trivial, probabilidade pela proporção de sinais, severidade padrão por fator, ajuste manual, critério de AET); a matriz ativa desenhada a partir de `matrizes_risco` com as faixas; e os limites da triagem. Tabelas lidas do sistema (matriz ativa, `SEVERIDADE_PADRAO_IDX`), então acompanham qualquer mudança.

### 8.2 QPS — Questionários Psicossociais (`app/(questionarios-psicossociais)`)

Questionários **configuráveis** (tipos → categorias → perguntas) cujo resultado usa a **mesma régua do DRPS**. No laudo o instrumento se chama **"QPS — Questionários Psicossociais"** (era QAP até v0.3.140). Laudo igual ao DRPS: sumário com a página de cada seção, capa com a **data da conclusão** (`data_conclusao`, gatilho da v285; ao reconcluir a tela pergunta manter ou hoje), período da coleta pelo carimbo do Forms (`qps_respondentes.data_carimbo`; sem ele, Período Início/Fim editável), setores na mesma folha quando cabem, agravos/medidas em parágrafos justificados, tabela larga e 5W2H na folha deitada, CRP do psicólogo vindo do cadastro (`lib/qps/crp.ts`). Importação ignora coluna extra de identificação antes das perguntas. Análise carrega agravos/medidas de cada setor quando o setor aparece e grava o texto ainda não confirmado. Salvar a aplicação verifica a contagem (0 linhas = erro `nao_gravou`); Responsável é escolhido da equipe (`ResponsavelSelect`). Resumo sem a etapa Plano de ação.

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
- Regra: nunca leva para as telas de Análise. Cálculo pelas mesmas funções das telas de Análise (`lib/riscos-psicossociais/carregar.ts`, usado pelo hook e pelas rotas de PDF). Oculto para Cliente.
- **Exportar Excel e PDF** por empresa, em Riscos Psicossociais e na página AEP do Painel SST (`lib/psicossocial/exportar-xlsx.ts`, `/api/pdf/riscos-psicossociais/[idEmpresa]`, `/api/pdf/aep-psicossocial/[idEmpresa]`, template `PsicossocialEmpresaTemplate`). O normalizador da AEP mora em `lib/aep/normalizar-relatorio.ts` e as consultas da Sinalização em `lib/aep/sinalizacao-dados.ts`, para o servidor usar também.

### 8.4 Consolidação Psicossocial de Grupo (`/consolidacao-grupo`, módulo `consolidacao_psicossocial`)

Replicado do painel (v0.3.757–766) em 22/10/2026. Junta a AEP e o DRPS/Questionário **concluídos** das empresas de um grupo (Empresas › Grupos) para que o risco de um setor conste no mesmo setor de todas as empresas. Só lê os documentos; nada neles muda.
- **Abas:** Fontes (documentos por empresa e papel econômico SPE/Executora/Incorporadora/Outra), Setores (nome padronizado sugerido — `lib/psico-consolidacao/setores.ts` — confirmado pelo técnico; `transita` tira o setor da harmonização), Fatores (catálogo de 13 + de-para AEP/DRPS/QPS; fatores ignorados por grupo), Comparativo AEP, Visões, Confronto AEP × DRPS, Harmonização, Sim/Não e Validação.
- **Motor** (`lib/psico-consolidacao/motor.ts`, regras puras, testado): régua Crítico > Alto > Médio > Identificado; perfil por setor comum, lacunas (Incluir / Revisar nível), confronto (Convergente, Divergente, Só AEP, Só DRPS) e alertas (probabilidade não informada, sem base).
- **Exportar:** 3 planilhas coloridas com fórmulas (`exceljs`), relatório ao cliente em PDF deitado (`/api/pdf/consolidacao-grupo/[idGrupo]`, `?execucao=PCX-…` para uma versão registrada) e apresentação .pptx (`pptxgenjs`, fundos em `public/apresentacao/` com a marca JCN).
- **Validação:** "Registrar consolidação" grava uma foto imutável (execução + itens; só depois de todos os setores confirmados); a validação do cliente por empresa (Validado / Com ressalva) também é imutável — a mais recente vale. A **lista para o PGR** sai por empresa validada (setor, fator, agente, nível, ação); nada é lançado sozinho.
- **Acesso:** ninguém começa com o módulo; o Admin libera em Usuários. Perfil Cliente não vê nada (`psico_caller_interno()`).
- **Consolidação por empresa (`/consolidacao-grupo/por-empresa`, v0.3.159–161, 2026-10-27; banco v303):** item **Por empresa** no menu do módulo. Funciona **igual à de grupo** (todas as abas: Fontes, Setores, Fatores, Comparativo AEP, Visões, Confronto, Harmonização, Sim/Não e Validação; planilhas, apresentação e PDF ao cliente), com empresas escolhidas na hora. A seleção é salva com um nome ("Nova consolidação": nome + `components/empresas/EmpresasMultiSelect.tsx`, com a busca do EmpresaSelect e "Marcar as N da busca"; depois "Editar empresas" e "Excluir") como uma linha de `empresa_grupos` do tipo CONSOLIDACAO, com as empresas em `empresas_consolidacao` — não mexe no grupo de nenhuma empresa e não aparece nas listas de grupos. Tudo o que é gravado (setores padronizados, fatores ignorados, registros, validações) fica no `id_grupo` dela. As abas ficam em `components/psico-consolidacao/PainelConsolidacao.tsx`, usado pelas duas páginas (a de grupo só escolhe o grupo); `FiltrosAnalise` é componente próprio; `BarraExportar` aceita `rotulo`. No servidor (PDF/registro), `carregarConsolidacao`/`carregarRegistro` leem as empresas da consolidação por `psico_consolidacao_membros`. A última consolidação aberta fica no navegador.
- **Conciliação DRPS/QPS × AEP (`/consolidacao-grupo/conciliacao`, v0.3.174, 2026-10-29; sem banco):** item no menu do módulo, abaixo de Por empresa. Lista **toda empresa** com AEP concluída ou DRPS/QPS concluído/enviado (não precisa de grupo; `carregarFontesConciliacao` em `lib/psico-consolidacao/carregar-conciliacao.ts`, as mesmas funções de `fontes.ts` + os setores avaliados de cada AEP), com a data do documento de cada origem (o mais recente, `documentosPadrao`), quantos cruzamentos setor × fator convergem e as divergências por classe; filtros Com divergência / Falta documento e busca. O detalhe (`/consolidacao-grupo/conciliacao/[idEmpresa]`) mostra setor × fator com o nível da AEP (AIHA gravado e sinais; N/I marcado), do DRPS e do QPS (com respondentes) e a classe de **DRPS × AEP** e **QPS × AEP** em colunas próprias; abre nas divergências, troca o documento de cada origem (ou "Não usar") e lista os setores que só aparecem numa fonte. Régua em `lib/psico-consolidacao/conciliacao.ts` (`conciliarEmpresa`, testada): escala comum de 4 degraus — questionário Baixo 1 · Médio 2 · Alto 3 · Crítico 4; AIHA Trivial/Baixo 1 · Moderado 2 · Alto 3 · Muito Alto 4. O questionário aponta a partir de Médio; a AEP com o fator "Sim" e AIHA a partir de Moderado ("Sim" sem AIHA aponta sem nível). Os dois apontam com até 1 degrau de diferença = **Convergente**; 2+ = **Nível divergente**; só um = **Só questionário** / **Só AEP**; nenhum = **Sem indicação**; setor ausente numa das fontes = **Sem par**. Setores casados pelo nome sugerido (`sugerirSetorCanonico`, sem a confirmação do grupo) e fatores pelo catálogo/de-para (`resolverFator`); setor repetido vale o pior. Só lê. **0.3.175:** o nome mostrado é o do documento em caixa de título com o acento dele (`tituloComAcento`; a sugestão só renomeia quando junta setores); a empresa com os dois documentos e nenhum setor em comum aparece como "Nenhum setor em comum — confira os nomes" (filtro "Não dá para conciliar"), em vez de "0 · nenhuma"; o item do menu fica destacado sozinho e a trilha diz "Conciliação DRPS/QPS × AEP". **0.3.176 (banco v310) — NR-01 e NR-17:** (1) **parecer por cruzamento** setor × fator × questionário (`psico_conciliacao_pareceres`, `ParecerModal`): Confirmar no inventário do PGR · Aprofundar com AET (NR-17) · Descartar (justificativa obrigatória); guarda a classe e os documentos do momento — se a classe mudar (documento trocado/editado) o parecer fica "a rever"; Confirmar/AET podem criar a ação 5W2H (`acaoDoParecer`, em `acoes_5w2h`, sem prazo/responsável, prioridade pelo maior degrau, observação "Origem: Consolidação › Conciliação DRPS/QPS × AEP"); quem/quando por gatilho. Situação (`situacaoParecer`): pendente (divergência sem parecer), sem ação, a rever, em dia. (2) **Ligar setores** por empresa (`psico_conciliacao_setor_depara`, `LigacaoSetores`): chave sugerida → chave do setor da AEP (vale só na conciliação), com **sugestão de pares** (`sugerirPares`/`semelhancaSetor`: palavras em comum, siglas SAC/RH/DP/TI/ADM expandidas) e desfazer. (3) **Representatividade**: respondentes do setor × `qtd_expostos` da AEP (somados nas variantes); baixa com menos de 3 respondentes ou adesão < 50% (`MIN_RESPONDENTES`, `ADESAO_MINIMA`) — aviso, não muda a classe. (4) **Sugere AET** (NR-17, 17.3.2) em Nível divergente e em Só questionário com Alto/Crítico; o "necessita AET" da AEP aparece no setor. (5) **Prioridade** (`prioridadeDe`): peso da classe, maior degrau, expostos, × 0,6 com baixa representatividade — a tabela abre "Mais importantes primeiro" (ou por setor); botão "O que falta resolver". (6) **Fechar a conciliação** (`psico_conciliacao_fechamentos`, append-only, `FechamentosConciliacao`): só com toda divergência com parecer em dia; foto com documentos, régua (`REGUA`), totais, contagem e itens (`itensDoFechamento`); histórico expansível. (7) Seção "Como comparamos" (método). Lista: colunas Pareceres (sem parecer / a rever / sem ação / Em dia) e Fechada em, filtro "Falta parecer ou ação". Escreve qualquer pessoa que edita e enxerga a empresa (RLS `caller_pode_editar` + `caller_pode_ver_empresa`). **0.3.177:** as confirmações (remover parecer, desfazer ligação) usam o diálogo do sistema (`ConfirmHost` montado no detalhe) e não o do navegador; "3 sinais" (era "3 sinalis"). **0.3.178 (sem banco):** (1) **PDF de cada conciliação fechada** (`/api/pdf/conciliacao/[idEmpresa]?fechamento=PCF-…`, `components/pdf/templates/ConciliacaoTemplate.tsx`, A4 retrato via `responderPdf`), botão "PDF" em Conciliações fechadas: identificação da empresa, registro/data/quem fechou, documentos comparados, método (com a régua gravada), resumo por classe e por decisão, cruzamentos com parecer agrupados por setor e a ação 5W2H de cada um (o quê, responsável, prazo, situação de hoje), limitações. Sai da foto gravada (nada é recalculado); só a situação das ações é a do dia. (2) **Alertas de revisão** (`alertasRevisao`, testada): documento usado com 24 meses ou mais (`MESES_REVISAO`, NR-01 1.5.4.4.6), AEP × questionário com 12 meses ou mais de diferença (`MESES_DISTANCIA`) e documento mais recente que os do último fechamento ("Fechar de novo"). No detalhe, caixa "Revisão" no topo (idade e distância dos documentos escolhidos; fechamento contra os mais recentes); na lista, coluna Revisão e filtro "Precisa revisar" (a lista passa a ler os `documentos` dos fechamentos).
- Testes: os que dependem do caso real anonimizado do painel (`lib/psico-consolidacao/__fixtures__/`) ficam pulados enquanto o arquivo não estiver no repositório.

---

## 9. Módulos de gestão e operação

### 9.1 Gestão — kanban (`/gestao`, `components/gestao/*`, `lib/hooks/useGestao.ts`)

Gerenciador de tarefas (estilo ClickUp/Runrun.it). Hierarquia **Espaço › Pasta › Quadro › Tarefa › Subtarefa**. Vistas quadro, lista, calendário, timeline; agrupar por status, responsável, prioridade ou etiqueta; filtros salvos; ações em massa; Meu Espaço, Meu Quadro pessoal, Caixa de Entrada (aprovações e notificações), Painel, Colaboradores e Equipes.

- **Tabelas:** `gestao_quadros` (status padrão A_FAZER, EM_ANDAMENTO, EM_REVISAO, CONCLUIDO criados por trigger), `gestao_status` (personalizável; tipo `nao_iniciado | ativo | concluido`), `gestao_tarefas` (`TRF-…`: título, descrição, status, responsável, datas, prioridade Baixa/Media/Alta/Urgente, etiquetas, pontos, campos custom, recorrência), `gestao_subtarefas`, `gestao_tarefa_vinculados` (responsável/seguidor), `gestao_dependencias` (sem ciclos), `gestao_comentarios` (@menções), `gestao_anexos`, `gestao_tempo`, `gestao_tarefa_historico`, `gestao_campos`, `gestao_etiquetas`, `gestao_subtarefa_modelos`.
- **Acesso:** `gestao_membros` (owner/admin/membro), `gestao_acessos` por espaço/pasta/lista/tarefa com níveis view < comment < edit < full (concessão mais específica vence; restritiva impõe teto), equipes com supervisor, quadro pessoal (dono full, supervisor edit). Mudanças registradas com motivo.
- **Automações** (`gestao_automacoes`): gatilhos (status muda, tarefa criada, prazo próximo, prazo vencido, subtarefa concluída, tarefa movida, tarefa aprovada), condições E/OU, ações (mover status, definir responsável/prioridade/campo, mover se subtarefas completas, vincular pessoas, mover/criar tarefa em outro quadro, notificar, solicitar aprovação, criar subtarefas de modelo); anti-loop; automação incompleta não fica ativa (v291). **pg_cron:** um job diário, `gestao-diario`, às 07:05 de Brasília, chama `gestao_rotina_diaria()` (recorrência — inclusive as repetições atrasadas, com responsáveis e seguidores —, avisos de prazo e automações de prazo; trava de 1x/dia).
- **Automações v298 (Pacote A):** cada regra tem **várias ações em ordem** (subir/descer/remover) e cada ação pode ter o seu **"só se…"** (condição E/OU), que faz o se/senão. Gatilhos novos: prioridade muda, campo muda, etiqueta adicionada, responsável adicionado, comentário (o da própria automação não dispara). Ações novas: comentar, enviar e-mail (responsáveis, vinculados e endereços extras, com assunto e mensagem), definir prazo relativo (hoje/prazo/início/criação + N dias, corridos ou úteis), adicionar/remover etiqueta, concluir, duplicar. Variáveis nos textos (`{titulo}`, `{responsavel}`, `{prazo}`, `{status}`, `{prioridade}`, `{quadro}`, `{data}`, `{comentario}`, `{etiqueta}`, `{novo_responsavel}`). Condições novas (responsável, título, origem — formulário/recorrência/automação/manual —, prazo, dia da semana, campo alterado, etiqueta nova, comentário) e operadores vazio/não vazio/não contém; E/OU vale também para os gatilhos de prazo. Aba **Histórico** no modal: cada execução com o resultado de cada ação (rodou/pulou/falhou e por quê).
- **Automações v299 (Pacote B — tempo e cobrança):** gatilho **agenda** (todo dia, dias úteis, dias da semana escolhidos ou dia X/último dia do mês, a partir de HH:MM) que age em cada tarefa do quadro que casar a condição ou **cria uma tarefa de um modelo** (título/descrição com `{data}`, prioridade, prazo em dias corridos/úteis, etiquetas, responsáveis); **tarefa parada / SLA** (N horas ou dias sem atividade ou no mesmo status; cobra uma vez por entrada; `{dias_parada}`); **data de início chega** (no dia ou N dias antes); **dependências liberadas** (a última tarefa que bloqueia foi concluída; `{bloqueadora}`); ação **aguardar** N horas/dias (as ações seguintes rodam depois, cada uma com o seu "só se…"). Tudo roda no servidor a cada 10 minutos.
- **Automações v300 (Pacote C — produtividade):** ação **atribuir em rodízio ou por menor carga** (lista de pessoas; opcional substituir os responsáveis); gatilho **manual** — as automações manuais ativas aparecem no menu ⚡ do rodapé da tarefa e da barra de ações em massa; **receitas prontas** no modal (avisar ao concluir, prazo padrão de 3 dias úteis, e-mail na véspera, atrasada vira Urgente, cobrar parada há 3 dias, pedir aprovação na revisão, comentário "urgente", dependências liberadas, pauta semanal, lembrete em 2 dias, rodízio, botão "marcar urgente") — montadas com os status do quadro (`lib/gestao/receitas-automacao.ts`), nascem desligadas para revisão.
- **Automações v301 (Pacote D — integração com o SST):** gatilhos **inspeção concluída (1ª vez)**, **documento concluído (1ª vez)** e **documento ou extintor vencendo em N dias**. A regra fica num quadro da Gestão e, a cada evento, cria nele uma tarefa do modelo (título/descrição com `{empresa}`, `{unidade}`, `{tecnico}`, `{data_inspecao}`, `{validade}`, `{dias_para_vencer}`, `{item}`, `{responsavel_elaboracao}`), ligada à inspeção, e roda as ações. Uma vez por evento (reabrir e concluir de novo não repete). Condições por empresa, unidade, técnico e tipo de item. Receitas prontas: elaboração após a inspeção, recarga de extintor (30 dias), renovação de documento (60 dias).
- **Automações v302 (paridade com o painel):** "Criar tarefa em outro quadro" escolhe a etapa no destino, os responsáveis da tarefa nova e pode mandar para o **quadro da unidade** da tarefa; "Mover para outro quadro" também escolhe a etapa numa lista. Gatilho **"Quando a aprovação é recusada"** na lista (o banco já o disparava).
- **Desde v0.3.142 (replicado do painel v0.3.744–790):** vários responsáveis por tarefa; avisos criados pelo banco (inclusão, status, comentário, @menção, tarefa nova no quadro, vence hoje) no sino e por e-mail; **acesso por unidade** (Usuários › Acesso ao módulo Gestão, colunas Unidades e Setores; sem unidade marcada = vê tudo); hora de início/fim; **subtarefa abre a janela completa** (duplo clique cria a tarefa filha, sincronizada com a linha); Agenda no Meu Espaço, calendário do Meu Quadro com outros quadros, Mostrar/Agrupar nas listas, Painel como visão da lista; formulário público com anexos e múltipla escolha em lista fechada; formulários das outras listas para o gestor.
- **0.3.252 (trazido do Painel 0.3.860–0.3.887):** a Gestão abre sempre no **Meu Espaço** (link direto `?quadro=`/`?tarefa=` continua abrindo o quadro); abrir uma tarefa pelo Meu Espaço abre a janela por cima, sem sair dele. Escolher outro **status** na janela de uma tarefa existente grava na hora e o cartão muda de coluna (`mudarStatus`, atualização otimista em `useSalvarTarefa`, desfeita se der erro; o Salvar compara com `statusSalvo` para não registrar a mudança duas vezes). Tarefa, várias tarefas (ação em massa) e lista excluídas **somem na hora** de todas as listas carregadas (quadros, Meu Espaço, Agenda) e voltam se der erro (`tirarTarefasDasListas`). A caixa da descrição da tarefa tem 8 linhas e pode ser esticada. Formulário público: 768 px de largura (era 512) e a letra digitada aparece no modo escuro (`.force-light` define `color`).
- **0.3.272 (banco v343, do Painel 0.3.923 itens 13 e 14) — modelos de tarefa e atalhos de teclado:**
  - **Modelos de tarefa** (Configurar › Modelos de tarefa, antes "Modelos de checklist"): cada modelo guarda descrição, checklist, subtarefas, prioridade, etiquetas e prazo em dias (corridos ou úteis). Na Nova tarefa, **Usar modelo** preenche só o que está vazio e soma as listas (`lib/gestao/modelos.ts`, `aplicarModelo`).
  - **Atalhos** (`lib/gestao/atalhos.ts`, `AtalhoPopover`, `AtalhosAjuda`): com o mouse sobre um cartão, Espaço entra/sai como responsável, D muda o prazo, L marca etiquetas e Enter abre; no quadro, N cria tarefa, / vai para a busca e ? mostra a lista. Ctrl+Enter salva a janela da tarefa. Nada dispara digitando, com janela aberta, nem no Meu Espaço, Caixa de entrada, Colaboradores ou Agenda.
- **0.3.271 (do Painel 0.3.928, 0.3.930, 0.3.931 e 0.3.935, sem banco) — Mostrar no Filtros, contagem das subtarefas e "Criada por" do formulário:**
  - **Mostrar** (Só tarefas / Só subtarefas / Tarefas e subtarefas) passa a ser um filtro (`FiltrosGestao.mostrar`): fica no topo do botão Filtros e na lateral do calendário, entra no Limpar, na contagem e nos filtros salvos (os antigos abrem com Só tarefas). O seletor da barra saiu.
  - **Contagem** (`lib/gestao/contagem-concluidas.ts`): no Painel da lista, fechar uma subtarefa conta 1 tarefa feita e a tarefa-mãe também conta quando fecha; o crédito vai para o responsável da subtarefa (sem ele, para o da mãe). Total e Concluídas incluem as subtarefas mesmo com Mostrar = Tarefas, e entra o gráfico Concluídas por pessoa.
  - **Formulário**: quem envia logado fica em `origem.enviado_por` (o e-mail da sessão, nunca o digitado) e vira o "Criada por" do cartão (filtro e topo da janela); sem login, "Formulário: <título>". O `created_by` continua sendo o responsável fixo do formulário (acesso e avisos não mudam). A rota `/api/gestao/form` lê a sessão em todo formulário, e o form mostra "Enviando como".
- **0.3.270 — Agenda vazia sem ninguém marcado:** ao desmarcar todas as pessoas ("Limpar"), o calendário continuava mostrando as atividades de quem estava marcado antes (a busca guardava o resultado anterior enquanto não havia nada novo a buscar). Agora fica vazio, com o aviso. Vale também para o "Calendário de: Equipe" da lista quando a equipe não tem membros visíveis (`useAgendaDe` e `useTarefasDeResponsaveis` só guardam o resultado anterior enquanto há alguém para buscar).
  - **Correção (11/11/2026): "Não foi possível salvar os vinculados" ao criar tarefa com responsável.** `useSalvarVinculados` e `useDecidirAprovacao` guardavam `sb.rpc` numa variável e chamavam `rpc(...)` solta; o método perdia o cliente e quebrava ("reading 'rest'") antes de chegar ao banco. Agora é `.rpc.bind(sb)`; o teste `lib/gestao/rpc-ligado.test.ts` impede o padrão de voltar. O defeito veio da cópia do Painel e só aparecia quando havia alguém para vincular (a Nova tarefa já vem com quem cria como responsável) ou ao decidir uma aprovação.
- **0.3.269 (banco v342, do Painel 0.3.908) — Região e Produtos em toda tarefa:** pedido do João em 10/11/2026 ("quero os dois campos").
  - No painel de campos da tarefa (não na janela de subtarefa), logo abaixo da Prioridade: **Região** (as 6 unidades; grava a etiqueta da unidade, `lib/gestao/regiao-produtos.ts`) e **Produtos** (lista suspensa com busca, `ListaSuspensaMultipla`, gravando o campo Produtos da lista Comercial; nas outras listas as opções vêm de `gestao_produtos_catalogo`, `useProdutosCatalogo`).
  - Testes novos do módulo Gestão (`lib/gestao/cobertura-gestao.test.ts`, 33): linkTarefa, fmtPrazo, fmtMeta, isoLocal, minutos/horaDe, cobreDia e cruzaPeriodo — as funções da Gestão que ainda não tinham teste.
- **0.3.268 (banco v341, do Painel 0.3.920) — requisitos da coluna, estimativa, prazo de atendimento, automações na tarefa e comentário atribuído:**
  - **Requisitos para entrar na coluna** (Status do quadro): "checklist completo" e/ou "ter anexo". Quem move à mão sem cumprir recebe o aviso do que falta; o Admin pode forçar (fica no Histórico). Automações nunca são barradas.
  - **Tempo estimado** na tarefa (horas e minutos), com a barra gasto × estimado; **Iniciar** no cabeçalho; tempo em cada coluna no Histórico e "Nesta coluna há X" abaixo do Status (`lib/gestao/tempo-etapas.ts`, testado).
  - **Prazo de atendimento** por quadro (botão **Prazo** na barra da lista, só gestor; `SlaConfigModal`): metas de 1ª resposta e resolução por prioridade, em horário comercial; selo no cartão, linha no painel da tarefa e avisos de 75% e de estouro pelo agendador (`lib/gestao/sla.ts`, testado). No JCN nenhum quadro vem ligado.
  - **Automações que rodaram na tarefa** no Histórico.
  - **Comentário atribuído:** ao comentar, "Atribuir a…" uma pessoa; ela recebe aviso e o comentário fica pendente até alguém marcar Resolver (quem recebeu ou quem edita o quadro); "Comentários para você resolver" na Caixa de entrada.
- **0.3.267 (banco v339 e v340, do Painel 0.3.909, 0.3.914 e 0.3.915) — janela da tarefa em duas colunas, checklist e datas com atalhos:**
  - **Duas colunas, como no Runrun (0.3.909):** à esquerda, título, número/autoria (com **Copiar link**) e as abas (Descrição, Subtarefas, Checklist, Comentários, Anexos, Histórico, Dependências), cada coluna com a própria rolagem; à direita, o **painel de campos**, um por linha, com o campo vazio como "Adicionar". A seta ao lado das abas esconde o painel. Quem só lê vê a descrição como texto. No JCN o painel tem a **Empresa** (v338) e as **dicas** de cada campo (Etapa 7.9a) continuam no rótulo da linha. Região e Produtos e a trava da OS da T.I (do Painel) não vieram.
  - **Checklist (0.3.914, v339):** aba Checklist e linha no painel; itens simples de marcar, sem responsável; grava na hora; na Nova tarefa fica em rascunho até criar; colar uma lista cria um item por linha (`ChecklistTarefa`). Quem marcou e quando vêm do login (gatilho).
  - **Datas num campo só (0.3.914):** Início e Término com atalhos Hoje, Amanhã, +3 dias, Próx. semana e hora opcional; "atrasada" em vermelho (`CampoData`, `lib/gestao/datas-rapidas.ts`, testado). Janela maior (`Modal` ganhou os tamanhos 2xl e 3xl).
  - **Um aviso por subtarefa (0.3.915, v340):** atribuir várias subtarefas à mesma pessoa de uma vez gera um aviso para cada uma.
  - `linkTarefa` foi para `lib/gestao/link-tarefa.ts` (puro): `avisos-email.ts` carrega o nodemailer e não pode ir para o navegador.
- **0.3.265 (do Painel 0.3.912, 0.3.916, 0.3.917, 0.3.918 e 0.3.919, sem banco):**
  - **Criar na coluna:** "+ Adicionar tarefa" no pé de cada coluna do quadro e do Meu Quadro (`NovaTarefaRapida`): Enter cria com o título e a caixa fica aberta para a próxima; Esc fecha. Na Nova tarefa, **Criar outra** (depois de criar, limpa título, descrição e subtarefas e mantém o resto).
  - **Menu da foto:** as chaves No sistema / Por e-mail e a Google Agenda saíram do topo do Meu Espaço para o menu da foto (`PreferenciasAvisoMenu`, `GoogleAgendaMenu`). No Meu Espaço fica só o alerta de autorização do Google expirada. Sem a configuração do Google no servidor, o menu avisa em vez de ficar carregando.
  - **Vínculos:** ao criar, a janela só adiciona (não tira quem a automação de tarefa_criada vinculou); ao editar, só sai quem a janela carregou e a pessoa tirou (`useSalvarVinculados` com `somenteAdicionar` e `base`).
  - **Aprovar na tarefa:** a aprovação pendente aparece na janela da tarefa (`AprovacaoNaTarefa`), com Aprovar e Recusar para a aprovadora ou quem edita o quadro; ao decidir, a janela fecha. Na Caixa de entrada, o gestor vê todas as aprovações pendentes.
  - **Colunas:** sem escolha da pessoa, mostram do mais recente para o mais antigo ("Criada em"); a ordem de arrastar continua como "Ordem do quadro" no menu da coluna.
  - **Inspeções:** o técnico vê o "Ver relatório" na lista (só a consulta, sem Editar/Excluir), sem precisar da marca `ve_relatorio_lista` (`acoesDaLista`).
- **0.3.264 (banco v338, do Painel 0.3.923 / v354, só a empresa) — empresa na tarefa e na Agenda:**
  - Campo **Empresa** na janela da tarefa (não na da subtarefa), com a busca do cadastro e o atalho para a ficha. Sem empresa, aparece a **sugestão pelo CNPJ ou pelo nome no título** (a pessoa clica e salva; nada é ligado sozinho). A mudança entra no Histórico.
  - O cartão do quadro mostra a empresa (ícone de prédio). A ficha da empresa ganhou a aba **Tarefas** (as tarefas da Gestão ligadas a ela que a pessoa vê).
  - **Agenda:** cada atividade mostra a empresa antes do título ("Empresa · título"); a subtarefa usa a empresa da tarefa-mãe e, sem empresa, leva o título da mãe ("título · mãe"). Regra em `lib/gestao/agenda.ts` (testada).
  - Correção da Agenda: abrindo a página direto, a pessoa logada é marcada quando o login termina de carregar.
- **0.3.263 — página Agenda (pedido de 10/11/2026: "os técnicos e as pessoas saberem as atividades de cada dia"):**
  - Item **Agenda** no menu da Gestão, abaixo do Meu Espaço (`AgendaView`). Abre na agenda de quem está logado; a coluna da esquerda escolhe uma ou várias pessoas (busca, "Só eu", "Limpar") e, para quem vê os membros, uma equipe inteira.
  - Mostra, no calendário novo (Mês, Semana, Dia, Agenda), as **tarefas e as subtarefas** com data em que as pessoas escolhidas são **responsáveis**, em todas as listas que eu vejo (`useAgendaDe`; a RLS decide). Por decisão do João, por ora todos podem abrir a agenda de todos.
  - Subtarefa = a filha aberta em janela própria (v292), com o responsável sincronizado. Aparece com **↳** e, na dica, "Subtarefa de <tarefa-mãe>". Subtarefa nunca aberta não tem data e não aparece.
  - Filtro **Mostrar: Tudo / Tarefas / Subtarefas**. Na Agenda não se arrasta: a data muda abrindo a tarefa, e a janela confere a permissão da lista. A janela relê a tarefa do banco (o calendário troca o texto do responsável só para desenhar).
  - Motivo: no Runrun a mesma atividade era cadastrada duas vezes (quadro SST com a visita como subtarefa e quadro Agenda com o serviço) para dar a visão por pessoa e por dia.
- **0.3.262 (trazido do Painel 0.3.921 e 0.3.922) — calendário como o do Runrun:**
  - Visões **Mês, Semana, Dia e Agenda** (lista do mês dia a dia), com Hoje, setas e contador de tarefas do período. A semana começa na segunda.
  - Tarefa de vários dias vira barra. Na Semana e no Dia, as de um dia com hora vão para a grade de horários (lado a lado quando se sobrepõem), com a linha da hora atual.
  - Dica ao passar o mouse; cor por prioridade, status ou situação; "Mostrar" responsáveis, horário e lista (guardado no navegador).
  - Arrastar muda o dia (e, na grade, a hora), mantendo a duração. Clicar num dia ou horário vazio abre a tarefa nova já com a data (`TarefaModal.inicial`).
  - **Lateral de filtros** (botão Filtros abre e fecha) com **"Calendário de": esta lista, uma pessoa ou uma equipe.** Pessoa ou equipe = as tarefas com data no período em que alguém é **responsável**, em todas as listas que eu vejo (`useTarefasDeResponsaveis`; a RLS decide). A opção Equipe só aparece para quem vê os membros.
  - **Filtros novos**, em todas as visões e nos filtros salvos: equipe do responsável, seguidor, criada por, situação, região, produtos e prazo amanhã / este mês / período. Regras em `lib/gestao/filtros.ts` e `lib/gestao/calendario.ts` (testados); `lib/gestao/regiao-produtos.ts` só com as regras puras (a v348 do Painel, catálogo de Produtos fora do Comercial, não veio). Filtro salvo antigo é completado com o vazio (`comPadrao`).
  - Ainda não entram as subtarefas (as filhas abertas pela subtarefa ficam fora, como nas outras vistas).
- **0.3.256 (trazido do Painel 0.3.859, 0.3.861 e 0.3.877) — janela da tarefa com abas:** abas fixas no topo — **Detalhes, Subtarefas, Comentários, Anexos, Histórico e Dependências** (tarefa nova só tem Detalhes e Subtarefas; a janela de uma subtarefa não tem Subtarefas nem Dependências). A coluna da direita (`TarefaSidebar`) saiu.
  - **Comentários** em aba própria (`ComentariosTarefa`): a caixa aparece também para o nível "ver e comentar"; excluir só para quem edita.
  - **Histórico** junta `gestao_tarefa_historico` (arrasto no quadro) e `gestao_atividades` (responsável, tempo…), sem repetir o mesmo evento dentro de 2 minutos.
  - **Campos personalizados** e os que vieram do cartão de origem (só leitura) ficam na grade de Detalhes, junto de Prioridade e Status.
  - **Tempo:** sem aba própria. **Iniciar/Parar** no rodapé, ao lado do Salvar (`BotaoTempo`); o total numa linha no início de Detalhes, que abre o lançamento manual e os apontamentos (`RegistroTempo`). No Histórico, tempo iniciado, parado, lançado e **excluído** aparece na hora, com o nome (registros antigos gravaram o e-mail), e a parada automática ao iniciar em outra tarefa também.
  - **Subtarefas:** a que tem comentários na janela dela mostra um **balão** com o número (`useComentariosDasSubtarefas`); o clique abre a subtarefa.
  - Mantido do JCN: dicas nos rótulos, "ver e comentar", tarefa nova no Meu Quadro com o dono como responsável, gravar só os campos alterados, status gravado na hora.
- **0.3.257 (banco v335 e v336, trazido do Painel 0.3.869 e 0.3.870) — avisos da Gestão:**
  - **Menu "…" de cada coluna do quadro:** "Habilitar/Desativar notificações" avisa (sino e e-mail, tipo `etapa`) quando uma tarefa **entra** na coluna, movida ou criada nela (`gestao_etapa_avisos`, RPCs `gestao_etapa_aviso_alternar`/`gestao_etapas_avisadas`; o aviso vive em `gestao_aviso_status_trg` e `gestao_aviso_quadro_trg`). Só avisa quem vê todas as tarefas do quadro e a unidade, nunca a filha de subtarefa, sem repetir para vinculado ou membro já avisado. A coluna que você segue mostra um sino. **"Ordenar por"**: Início desejado, Entrega desejada, Criada em, Cliente, Projeto, Tipo e Título (clicar de novo inverte; Cliente/Projeto só aparecem quando o quadro tem esses dados). A ordenação é só de quem olha (localStorage por quadro e agrupamento; regras em `lib/gestao/ordenar-coluna.ts`, testado).
  - **Meu Espaço › Notificações:** duas chaves, "No sistema" (sino) e "Por e-mail" (`gestao_aviso_preferencias`, RPCs `gestao_minhas_preferencias_aviso`/`gestao_salvar_preferencias_aviso`). O gatilho BEFORE INSERT `gestao_notificacao_preferencia_trg` aplica a escolha do destinatário a todo aviso: os dois desligados não grava; e-mail desligado grava `canal='in_app'` e `email_enviado=true` (a rotina de e-mail pula); sino desligado grava `canal='email'`, que o sino não lista. Sem escolha, tudo como antes.
- **Formulários públicos (0.3.258, do Painel 0.3.867 e 0.3.886):** pergunta de texto ou e-mail pode ter **"preencher com o login"** (`preencher: usuario_nome | usuario_email`): quem está logado no sistema não vê a pergunta e o formulário mostra "Enviando como …"; o GET de `/api/gestao/form` lê a sessão e responde com `Cache-Control: private, no-store`, e o POST troca essas respostas pelas da sessão (só usuário interno ativo; o nome vem do cadastro, nunca do navegador). Sem login, as perguntas aparecem como antes. Pergunta de seleção múltipla pode aparecer como **caixas de seleção** (todas as opções à vista, "Marcar todas"). Regras em `lib/gestao/formularios.ts` (testado).
- **Meu Quadro (v0.3.146):** tarefa criada no Meu Quadro nasce com o dono como responsável (gatilho v294 + a janela da tarefa já vem preenchida), para entrar na Google Agenda e no Meu Espaço.
- **Aprovações** (`gestao_aprovacoes`), **formulários públicos** (`gestao_formularios`, `/f/[token]`, cria tarefa), **agenda** (feed ICS e Google Agenda — ver 5.8), **IA** (`gestao-ia`: sugere subtarefas e descrição).
- **Importação do Runrun.it:** scripts `scripts/importar-runrun*.ts` com mapeamentos testados em `lib/gestao/import/*`.

**0.3.190 (do Painel SST):**
- O menu lateral pesquisa as listas pelo nome da lista, da pasta ou do espaço (`lib/busca/texto`).
- O campo multi separa NRs e Outros, com busca, e mostra o que está marcado mesmo fora da lista.
- Anexos e tempo dos cartões são buscados em lotes (`emLotes`), sem o erro 431 nos quadros grandes.
- A janela de Automações usa o `Modal` `size="quadrado"`.
- O Esc do `FiltroSuspenso` fecha só a lista aberta.

**0.3.192 (do Painel SST, banco v315):**
- **Membros e acessos:** busca e "tirar da lista" nas abas Por pessoa e Por lista (`BuscaUnica`, `TirarDaListaDialog`).
- **Automações:**
  - a aba **Funcionários por produto** (`ProdutoResponsaveisAba`) liga o funcionário aos produtos de cada quadro;
  - a ação "subtarefas do modelo" tem **Responsável** opcional;
  - a regra que fica incompleta mostra "Pausada desde…" e volta sozinha ao completar.
- **Tarefa:** mostra só para leitura os campos que vieram de outro quadro (`useCamposDeOrigem`). Os campos de múltipla escolha ocupam a linha toda, e a tarefa nova já abre os campos.
- **Minhas tarefas e Agenda:** usam `gestao_minhas_tarefas()`, que também traz as tarefas em que a pessoa é responsável de subtarefa aberta.
- **Aprovação:** recusar cria a subtarefa de correção.

### 9.2 SGG — envio de riscos ao sistema externo

`POST /api/sgg/enviar-riscos` (botão na inspeção). Exige Admin ou `pode_enviar_sgg`; empresa com `sgg_base_sgg` e `sgg_id`. Resolve setor e cargos nos dados-mestres (`MESTRES_POSTGREST_URL`) pelo nome exato do setor; um envio por setor; converte probabilidade/severidade para a escala AIHA 5×5 (`lib/sgg/mapa-aiha.ts`); envia por socket unix com HMAC; registra em `sgg_envios` (pendente, enviado, erro, duplicado, indeterminado).

### 9.3 Gestão Gerencial (`/gestao-gerencial`, tabelas `gg_*`)

Por unidade: profissionais, categorias, turnos, **escala padrão** (dia da semana × turno: trabalha/disponível), ausências (folga, férias, atestado, falta, in loco) e substituições. RPC `gg_sugerir_substitutos` (disponíveis no mesmo turno, mesma categoria, ativos, sem ausência e sem conflito) e `gg_projecao_mensal`.

### 9.4 Escala de Supervisores (`/escala`, `lib/escala/*`)

Grade mensal, padrão semanal, conferência, calendário anual, relatórios e configuração (supervisores, unidades com cor e município, feriados, regras). Situações: Visita ao cliente, Home office, Folga, Férias, Treinamento, Atestado, Feriado. **Geração mensal** idempotente (`gerarMes`): não altera dias manuais, ignora fim de semana, feriado vira "Feriado" (municipal só para quem está naquele município). **Regras de conferência:** mínimo de supervisores por dia, nenhum dia sem supervisor, sede coberta, âncora em dias fixos, par na mesma unidade. Exportação XLSX e PDF (`/api/pdf/escala-resumo`).

### 9.5 Dimensionamento (`/dimensionamento`, motor `lib/dimensionamento/calculo.js`, 84 testes)

**Quem acessa (v263, `lib/dimensionamento/permissoes.ts` + funções do banco `dim_papel`/`dim_pode_ver`/`dim_pode_editar`):** Admin faz tudo; **Gerente** (função "Gerente") vê Headcount, Cadastros e Histórico, sem criar/editar/excluir; **Supervisores** (funções "Supervisor dos técnicos" e "Supervisora do administrativo") veem só os **Cadastros** (Unidades, Empresas por Unidade, Colaboradores, Funções, Calendário) com criar/editar/excluir — sem Headcount e sem Histórico (trava de tela; os dados vêm das mesmas tabelas); sincronizar com a API externa é só do Admin. A conta também precisa do módulo `dimensionamento` liberado (padrão das três funções desde a v264). RLS: `dim_ler` (SELECT, `dim_pode_ver()`) e `dim_gravar` (ALL, `dim_pode_editar()`) em cada tabela `dim_*`.

Headcount por unidade e função. `precisa = Σ clientes que vencem no mês × peso do porte` (P 1,0 · M 1,5 · G 2,0); `produção = produção/dia × dias úteis × fração alocada × presença × ramp-up`; `consegue = Σ produção × ocupação-alvo`; `sobra = consegue − precisa`; status déficit/atenção (<10%)/ok; faltam/sobram/ideal em pessoas; custo. Tabelas `dim_*` (unidades, funções, colaboradores com alocação ≤100%, demanda mensal, parâmetros, histórico por trigger). Sincronização com a API externa (`/api/dimensionamento/sincronizar`).

**Desligados no quadro necessário (v0.3.158, 2026-10-27):** quem tem data de desligamento dentro do mês escolhido continua contando na produção desse mês (pela presença), mas o **déficit** do "Quadro necessário para eliminar em N meses" desconta só a **equipe que continua** depois do mês (`quadroFica`, função `ficaAposMes` no motor): desligado até o último dia do mês = 0; admitido no meio do mês = inteiro dali em diante. Antes o déficit descontava o quadro do mês (com o desligado ainda valendo a presença parcial) e pedia gente de menos. Na tela: selo "saiu em dd/mm" na equipe, aviso no texto, coluna **Equipe que continua** na tabela do quadro necessário e "X continuam depois de <mês>" no cartão Equipe atual.

**0.3.190:** a linha do gráfico "Quadro necessário em cada prazo" é `quadroFica` (a equipe que continua), não `quadroAtual`.

### 9.9 Comercial (`/comercial`, regra `lib/comercial/oportunidades.ts`, testada)

**Setores da máquina (0.3.252, banco v331):** a Apreciação NR-12 passa a ler os setores da máquina pela ligação da v160 (`inspecao_maquinas_setores`), como o resto do sistema; `maquinas[].setores` é uma lista. A v330 lia `inspecao_maquinas.id_setor`, que ficou congelado: máquina cadastrada depois da v160 saía como "Setor não informado" e a de vários setores mostrava só um. Correção trazida do Painel (0.3.900).

**Coluna Setor (0.3.248, banco v330):** a tabela de serviços ganhou a coluna **Setor**, depois de Serviço, com um setor por linha (`Oportunidade.setoresIndicados`, juntados sem repetir por `juntarSetores`). De onde vem: AET, os setores com "Necessita AET" da AEP e os riscos que a Conciliação mandou aprofundar; DRPS/Questionário, os setores com fator organizacional na última AEP e os setores dos riscos psicossociais da inspeção (`psicossociais_setores`); Apreciação NR-12, o setor de cada máquina (`maquinas[].setor`); Medição, o setor de cada medição; Químicos, os setores dos riscos químicos (`quimicos_setores`); Treinamentos NR, **"Empresa toda"** (`SETOR_EMPRESA_TODA`), porque o treinamento é cadastrado na inspeção sem setor. Item sem setor no cadastro aparece como **"Setor não informado"**; os dois ficam em itálico cinza, no fim da lista.

**Venda por intervenção (0.3.247, banco v329):** a tabela das intervenções psicossociais ganhou as colunas **Situação** e **Venda**: cada intervenção tem o seu "Marcar como vendido" e o seu Desfazer (quem registrou ou Admin). A venda guarda o `id_item` da intervenção (`comercial_vendas.id_item`; vazio = serviço inteiro, como antes). A situação do serviço só vira **Vendida** quando todas as intervenções foram vendidas (`aplicarVendas`); com isso ele sai do filtro "a vender". As intervenções ficam só na tabela própria: a linha "Intervenções psicossociais" saiu da tabela de serviços (os selos da empresa e os contadores continuam contando o serviço). Na tabela delas, Setor e Risco ficam numa célula só (`rowSpan`, `contarSeguidas`) para as linhas do mesmo grupo. Uma venda antiga do serviço inteiro continua valendo: desde a 0.3.249 ela aparece numa faixa no topo da tabela das intervenções ("Vendida como serviço inteiro", com quem vendeu e o **Desfazer**, para quem registrou ou Admin), e cada intervenção mostra "Coberta pela venda do serviço inteiro (acima)". Desfeita, cada linha volta a ter o seu "Marcar como vendido". Antes da 0.3.249 essa venda não tinha onde ser desfeita, porque o Desfazer ficava na linha do serviço que saiu da tabela de cima. Em Consolidação › Vendas, a venda de uma intervenção mostra o nome dela embaixo do serviço, e o detalhe traz só essa linha.

**Títulos em 2 níveis (0.3.247):** nas duas tabelas, uma faixa acima dos títulos agrupa as colunas: "O que indicamos" / "Indicado na Conciliação" (azul) e **Comercial** (âmbar), que cobre Situação e Venda. Essas duas colunas têm fundo âmbar leve nas linhas e as mesmas larguras nas duas tabelas, e por isso ficam alinhadas. Os títulos estão em caixa alta, com linha mais grossa embaixo, e cada um mostra a explicação da coluna ao passar o mouse (ícone ⓘ). Componentes `FaixaGrupos` e `Titulo` em `app/(comercial)/comercial/page.tsx`.

**Lista de empresas (0.3.246):** a tela mostra primeiro as empresas, recolhidas, cada uma com os serviços em selos na cor da situação, o nível AIHA e quantos estão a vender (desde a 0.3.250 cada empresa é um cartão separado, com espaço entre eles e sombra maior quando aberto); "Abrir todas" e "Recolher todas" ficam ao lado da contagem. Ao abrir, vêm o contato, a AEP e a inspeção usadas e uma tabela com um serviço por linha: Serviço, **Origem** (selos Inspeção, AEP e Conciliação, com a inspeção e a data quando vem dela), O que justifica, Situação e Venda. Em "O que justifica" o nome de cada item fica em negrito (o que vem antes de " – ", " (", " · " ou ": "), as observações (documento antigo, rascunho parado) viram nota em cinza, a AET mostra os rótulos Setores e Aprofundar (Conciliação). As intervenções psicossociais ficam com um resumo na linha ("5 intervenções em 2 riscos") e uma tabela própria embaixo (`TabelaIntervencoes`): Setor, Risco, Intervenção, Modalidade, Responsável e Prazo, com setor e risco uma vez por grupo; os campos vêm separados em `Oportunidade.intervencoes` (`LinhaIntervencaoOferta`, montado em `visaoDoVendedor`, testado). As duas tabelas têm linhas verticais entre as colunas. O parecer da equipe e quem fez e liberou ficam embaixo. O que vem abaixo sobre "cartão" vale para essa tabela.

Módulo `comercial` (card próprio **"Comercial" na tela principal de Módulos**, ao lado de Empresas, com o número de oportunidades em aberto; 2026-10-05) para o time de vendas: transforma as **AEPs entregues ao cliente** (mesma regra da Sinalização) em **oportunidades** de serviço vendido à parte — **AET** (algum setor com Necessita AET, inclusive só por ergonomia física/cognitiva) e **DRPS/Questionário Psicossocial** (3+ alertas organizacionais). Situação de cada uma pelo que a empresa já tem: **aberta** (nenhum documento do serviço), **em andamento** (AET/DRPS/QPS em rascunho ou andamento), **realizada** (concluído/enviado). Base: a AEP entregue mais recente da empresa. **Pela inspeção (v268, 2026-10-05):** a última inspeção **CONCLUÍDA** (status `CONCLUIDA`) de cada empresa também gera oportunidades — **Apreciação NR-12** (máquina com "Necessita adequação NR-12" ou grau Alto/Crítico; situação pela Apreciação de Máquinas), **Medição quantitativa** (risco físico com "Necessita medição"; sem módulo, fica sempre aberta), **Análise de Químicos** (risco químico; realizada se a empresa já tem análise), **DRPS/Questionário** (risco psicossocial; junta com o da AEP numa só oportunidade, com as duas origens) e **Treinamentos NR** (treinamentos da aba Treinamentos; realizada quando toda NR indicada já tem certificado emitido para a empresa, andamento quando só parte tem — NR comparada pelo número). Situação **revisão recomendada** (v269): documento já existente concluído **antes** da indicação mais nova — vale para **AET** (antes da AEP entregue), **DRPS/Questionário** (antes da AEP ou da inspeção), **Apreciação NR-12** e **Análise de Químicos** (antes da inspeção concluída); o detalhe traz "X concluído em dd/mm/aaaa, antes da indicação de dd/mm/aaaa". **Rascunho esquecido (2026-10-05, `rascunhoAntigo`):** documento em rascunho/andamento cuja última edição é anterior à indicação **não conta** como "em andamento" — a oportunidade fica aberta, com o aviso "Há N rascunho(s) de X parado(s) desde dd/mm, antes da indicação de dd/mm". Medição quantitativa (sem módulo) e Treinamentos (por certificado) não entram — a tela abre em **"A vender" (aberta + revisão)**, e o card da tela Módulos conta "N oportunidades a vender". **A AEP não é produto do Comercial** (2026-10-05): ela só indica AET e DRPS/Questionário; o risco ergonômico da inspeção não gera oportunidade e o filtro Produto não lista AEP. Cada oportunidade mostra "Indicada por: AEP / Inspeção" e os itens que a justificam (setores, máquinas, agentes, treinamentos). A tela ganhou o contador "Oportunidades em aberto" e chips com as abertas por produto; o CSV leva origem e detalhes.

Tela **Oportunidades**: contadores (AET em aberto, trabalhadores expostos nos setores AET em aberto — base do orçamento, DRPS/Questionário em aberto, em andamento), filtros (produto, situação — padrão "aberta" —, unidade, nível AIHA, busca por empresa/CNPJ/unidade/município), cartão por empresa com CNPJ, unidade · região, telefone e e-mail clicáveis, nível AIHA, data da entrega, um bloco por oportunidade (setores indicados com expostos) e quem realizou/enviou a AEP; **Exportar (Excel)** gera CSV com uma linha por oportunidade. Menu também com **Matriz AIHA** (`/comercial-matriz-aiha`).

**Dados:** RPC `comercial_dados()` (v267, SECURITY DEFINER, só leitura) — confere se quem chama é Admin ou tem `comercial` em `modulos_permitidos` (senão erro 42501) e devolve as AEPs entregues (com empresa e contato) e o status de AET/DRPS/QPS por empresa. Assim o comercial não precisa dos módulos AEP/AET/DRPS (que têm `rls_modulo`). Os demais usuários recebem o módulo por Sistema › Usuários. Na janela do usuário (desde v0.3.148), o **Acesso aos módulos** vem separado nas três categorias da tela Módulos (`CATEGORIAS_MODULO` em `lib/supabase/types.ts`, com teste que garante cada módulo uma vez), com **Marcar/Desmarcar todos** e **marcar categoria**.

**Campos livres nas intervenções (0.3.240, banco v327, 2026-11-06):** na etapa Intervenções, Intervenção, Modalidade e Responsável são listas com tudo o que já existe e, no fim, "+ Inserir novo", que troca o campo por um de digitar (Enter ou sair do campo grava; Esc desiste; o Responsável abre com o texto atual, para ajustar). O valor novo fica na linha e entra no catálogo: intervenção nova vira um item, com a modalidade e o responsável já preenchidos na linha; modalidade ou responsável novo entra na lista da intervenção daquela linha. Escolher um valor que já existe só muda a linha. Grafia igual, sem olhar maiúsculas, reaproveita o que existe (`acharNaLista`, `acharIntervencao`). Nenhum campo espera a intervenção ser escolhida: na linha nova, Modalidade, Responsável e Prazo ficam guardados e vão junto ao escolher a intervenção. A linha só é gravada com a intervenção, que é obrigatória. Sem intervenção do catálogo na linha (excluída, por exemplo), o valor fica só nela. A página Intervenções passa a marcar modalidades e responsáveis numa lista aberta, com campo para inserir; as opções são as de partida (EAD, Presencial, Ao vivo) mais tudo o que está no catálogo (`opcoesDoCatalogo`). O primeiro responsável marcado é o que vem preenchido na Conciliação.

**Documento único (0.3.239, banco v326, 2026-11-06):** a empresa só com AEP, só com DRPS, só com QPS ou com DRPS e QPS sem AEP (ou que marcou "Não usar" até sobrar um lado) não fica mais presa em "Falta a AEP". `conciliarEmpresa` devolve `fonteUnica` e, nesse caso, o que o documento aponta (questionário a partir de Médio; AEP com "Sim" e AIHA a partir de Moderado) é classificado como **Fonte única**; o resto é Sem indicação, ou Sem par no setor que só existe no outro questionário. Fonte única conta como divergência: pede parecer antes de fechar. Só com a AEP, a coluna de parecer é a própria AEP (`questionario = 'AEP'`, liberado pela v326), e a sugestão de AET é a marcada no setor da AEP. Na tela, a primeira etapa se chama Avaliar, somem a coluna do lado que falta e a ligação de setores, e o restante é igual: Fechar, Intervenções, Liberar para o Comercial. A foto grava `resumo.fonte_unica`, e esse fechamento **não oferece o PDF**, que descreve uma comparação com a AEP (a mudança do PDF depende de aprovação). Se o outro documento chegar depois, os pareceres ficam "a rever" e o aviso de fechar de novo aparece. A empresa com os dois lados e nenhum setor em comum continua pedindo a ligação de setores. Na lista, a linha mostra "Só DRPS: N apontado(s)", e o filtro passou de "Não dá para conciliar" a "Sem comparação".

**Etapa da Conciliação (0.3.238, banco v325, 2026-11-06):** a liberação saiu da tela própria e virou etapa da tela da empresa em `/consolidacao-grupo/conciliacao/[idEmpresa]`, com a faixa Comparar › Fechar › Intervenções › Liberar para o Comercial (`components/psico-consolidacao/LiberarParaComercial.tsx`). Os endereços `/consolidacao-grupo/liberar-comercial` redirecionam para lá, e o item saiu do menu. **O tempo cobre o trabalho inteiro:** sem a sessão própria aberta, nada se altera na tela (parecer, ligação de setores, fechar, intervenções, parecer para o Comercial); nos pareceres e nas ligações a trava é da tela, porque a RLS deles não olha a sessão. Depois de liberado, é só leitura e o tempo para. **Retirar do Comercial** (motivo, `comercial_reabrir`): ajusta intervenção ou parecer sem criar fechamento. **Reabrir conciliação** (motivo, `comercial_reabrir_conciliacao`): a análise mudou; também reabre o atendimento, numa operação só, e não exige Iniciar. Com a conciliação fechada, Fechar some até reabrir. A lista ganhou a coluna **Comercial** (`situacaoComercial`: Falta fechar, Reaberta, Sem risco confirmado, Para liberar, Em andamento, Liberado, Fechada de novo) e os filtros Para liberar e Liberadas. O texto abaixo descreve as regras, que seguem valendo; onde diz lista, abas ou atendimento, leia a tela da Conciliação.

**Liberar para o Comercial (0.3.233, refeita na 0.3.235; banco v321 e v322; 2026-11-05):** `/consolidacao-grupo/liberar-comercial`, no menu da **Consolidação** para quem pode liberar (`usePodeLiberarServicos`; no banco `comercial_pode_liberar()`: Admin, ou Técnico com `consolidacao_psicossocial`). Quem libera **não precisa do módulo Comercial**: `comercial_dados()` também aceita quem tem a Consolidação. Mostra **só o que a Conciliação identificou**; a liberação da inspeção e da AEP (abaixo) não passa por aqui e continua indo direto às Oportunidades. Regra pura em `lib/comercial/liberacao.ts` (testada).

- **Lista:** as empresas cuja **última conciliação fechada** tem ao menos um risco, nas abas Para atender, Em andamento e Concluídos, com a data do fechamento e o tempo. Risco é o parecer **Confirmar** ou **Aprofundar com AET** da foto do fechamento (`psico_conciliacao_fechamentos.itens`), um por setor × fator; descartado e sem parecer ficam de fora. Concluído cuja conciliação foi fechada de novo volta para Para atender, pedindo reabertura.
- **Atendimento (`[idEmpresa]`, um por empresa, `comercial_atendimentos`):** Iniciar/Pausar com o `PainelTempoDocumento` da inspeção (`fonte="comercial"`, tabela `comercial_sessoes`, pausa sozinha com 30 min parado, sem correção pelo supervisor e sem pg_cron: quem inicia ou avisa atividade fecha as paradas). As sessões são separadas das do documento da inspeção. Sem a sessão própria aberta, nada se altera, e as funções do banco conferem.
- **Tabela de intervenções por risco:** Risco, Intervenção (do catálogo), Modalidade, Responsável e Prazo em dias, todos editáveis e gravados a cada alteração; "Adicionar intervenção" põe mais de uma por risco (`comercial_atendimento_intervencoes`, com o nome gravado, então excluir do catálogo não apaga o que já foi indicado). Escolher a intervenção preenche a primeira modalidade e o responsável do catálogo. Intervenção de risco que saiu da conciliação fechada de novo fica marcada, para a pessoa decidir. Desde a 0.3.244 Setor e Risco são colunas separadas; o nome do setor aparece só no primeiro risco dele (os riscos vêm ordenados por setor e fator). A 0.3.243 tinha posto os rótulos "Setor:" e "Risco:" na mesma célula.
- **Catálogo:** `/consolidacao-grupo/intervencoes` (`comercial_intervencoes`), semeado com as 16 da planilha do setor; quem libera altera, insere e exclui. Desde a 0.3.241 cada coluna se edita na própria linha (`useAtualizarIntervencaoNaLinha`, que grava só o campo mexido): nome e observação viram campo ao clicar, e Modalidades e Responsável são listas suspensas para marcar, desmarcar ou inserir, gravando na hora; no Responsável, a estrela escolhe o primeiro da lista, que é o que a Conciliação traz preenchido. O Editar continua para ativar ou desativar. Desde a 0.3.242 (banco v328) o título de cada coluna é uma lista suspensa (`ListaDaColuna`) com todos os tópicos dela e o uso de cada um: em Intervenção, inserir cria a linha (`useCriarIntervencaoNoCatalogo`); em Modalidades e Responsável, o tópico inserido fica em `comercial_intervencao_topicos` e aparece nas linhas e na Conciliação mesmo antes de entrar em alguma intervenção (`opcoesDoCatalogo` soma as três de partida, o catálogo e esses tópicos). Só o tópico guardado e sem uso sai pelo X.
- **Parecer:** obrigatório para concluir; "Sugerir com IA" chama a edge function `gerar-parecer-comercial-ia` (Groq), que recebe os riscos, as intervenções e o rascunho, só usa esses fatos e devolve texto para a pessoa conferir.
- **Concluir e reabrir:** concluir fecha as sessões e manda ao vendedor a oportunidade "Intervenções psicossociais", os riscos que pediram AET (somados à AET da AEP, se houver) e o parecer no cartão. Reabrir pede motivo e tira esses itens até concluir de novo. Histórico em `comercial_atendimento_eventos`, com o parecer de cada conclusão.
- **Reabrir a conciliação e filtro no banco (0.3.237, banco v324):** em Conciliações fechadas, **Reabrir** pede motivo e grava em `psico_conciliacao_reaberturas`; a foto do fechamento e o PDF não mudam. Com a última reaberta, a empresa sai desta lista, o atendimento fica sem edição e o vendedor deixa de ver as intervenções, os riscos que pediram AET e o parecer; fechar de novo cria outra foto. Antes, o `comercial_dados` entregava ao navegador do vendedor atendimentos em andamento, rascunhos de parecer e intervenções não concluídas, e só a tela escondia. Agora quem não libera recebe do banco só o que está concluído, com conciliação fechada, e a foto vai reduzida aos riscos e aos campos usados.
- **Registro da venda (0.3.236, banco v323):** em Oportunidades, cada serviço a vender tem "Marcar como vendido", com observação opcional (`comercial_vendas`, um por empresa × serviço). Ele vira a situação **Vendida**, fora do "a vender"; se o documento já está em andamento ou feito, a situação dele continua valendo e a venda aparece junto. Quem tem o módulo Comercial registra; quem registrou ou um Admin desfaz. `/consolidacao-grupo/vendas` lista as vendas para quem está na Consolidação, só leitura. **O aviso é por essa tela:** não há sino nem e-mail, porque o sino atual é só da Gestão. Desde a 0.3.245 cada venda abre embaixo o que foi vendido (`useVendasComercial` cruza a venda com a oportunidade de `visaoDoVendedor`): em Intervenções psicossociais, a tabela Setor × Risco × Intervenção × Modalidade × Responsável × Prazo e o parecer da equipe; nos demais serviços, os itens da oportunidade e os setores para AET. O detalhe é o de agora: se a oportunidade saiu da tela do vendedor (reabertura), a tela avisa.

**Liberação para o Comercial (v270, 2026-10-05):** nada vai para o Comercial sem validação da equipe. A inspeção **concluída** ganha no topo o botão **"Liberar para o Comercial"** (e, liberada, o selo "No Comercial desde dd/mm · Fulano" + **"Retirar do Comercial"**); a AEP tem o mesmo par na faixa do editor (Setores / Triagem), disponível depois de **entregue ao cliente**. Quem pode: quem edita o documento (`useCanEdit`). Grava `liberado_comercial_em/_por` em `inspecoes` e `aep_relatorios` (`components/comercial/LiberacaoComercial.tsx`). **Reabrir a inspeção** (sair de CONCLUIDA) ou voltar a AEP sem inspeção de Concluída para outro status **retira sozinho** (trigger `fn_retira_do_comercial`). A RPC `comercial_dados()` só usa AEPs liberadas e a última inspeção concluída **liberada** de cada empresa; os cartões do Comercial mostram quem liberou e quando. A faixa da AEP não usa cache e é recarregada ao salvar o status (2026-10-07): ao marcar Concluída, o botão "Liberar para o Comercial" aparece na hora.

### 9.6 Frota (`/frota`, `lib/frota/*`)

Veículos (tipo, status, km que só sobe), **saída com checklist** em 5 passos (veículo → condutor e km → **4 fotos obrigatórias** frente/laterais/traseira → avarias → destino e rotas; funciona offline), retorno (km e data ≥ saída), abastecimentos, manutenções (próxima revisão por data/km), sinistros, lotação por base. Painel com situação (Fora, Manutenção, Disponível, Inativo) e alertas (viagem > 3 dias, rascunho parado > 1 dia, revisão em ≤30 dias/≤1000 km). Fotos redimensionadas no navegador (320 px e 1600 px).

### 9.7 Equipamentos (`/equipamentos`, patrimônio interno por base)

Equipamentos individuais (status Operante, Manutenção, Inativa, Baixada, Reserva — só muda pela RPC, com motivo e histórico), catálogo com estoque mínimo, **razão de estoque** (`equipamentos_movimentacoes`, saldo pela view `v_equipamentos_saldo`), entrada manual ou por **NF-e (XML)**, ajuste com motivo, transferência entre bases (aceite com assinatura), **retirada/entrega** a colaborador (termo PDF com hash, assinatura em tela ou **biometria** com matcher externo — até 5 tentativas), devolução (íntegro/avariado/inservível; item por quantidade grava as séries informadas — v279). Todas as regras nas RPCs `equipamento_*`/`equip_entrega_*`.

**Segurança (v280, SEC-EQP-01, replicado do painel v269):** as 13 RPCs do módulo (equipamentos, transferências e `epi_assinar_entrega`) só executam para usuário logado (`authenticated`); `equipamento_estornar_transferencia` não tem grant e só roda chamada por recusar/cancelar. A razão de estoque (`equipamentos_movimentacoes`) só é gravada pelas RPCs. Em `transferencias`, o único INSERT direto permitido é o da transferência individual (pendente, do equipamento que está na base de origem, de quem registra), nas 31 colunas do formulário; aceitar/recusar recusam sessão sem e-mail.

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
- **Dimensionamento:** o papel (Gerente/Supervisor) vem do **nome da função** (`usuarios.funcao`); renomear essas funções em Sistema › Funções tira o acesso — ajustar `lib/dimensionamento/permissoes.ts` e `dim_papel()` juntos.
- **Resíduos do Electron** inativos na web: auto-login/salvar credenciais, botão de atualização, aba "Atualização" em Configurações.
- **QPS tem duas réguas:** Resultados/Resumo usam a matriz legada; Análise/Laudo/Riscos Psicossociais usam a régua do DRPS.
- **DRPS:** o PDF usa o plano de medidas do ano corrente; `drps_texto_padrao` é legado (o PDF lê `textos_padrao`); `drps_monitoramento_unidade` e `exibir_sem_analise` não são usados.
- **Apreciação HRN:** a v146 (medidas de engenharia/administrativas separadas) está na fila, não aplicada no banco do JCN.
- **IA:** todas as funções de texto usam a lista de modelos Groq com fallback (ver 5.6) desde que o `llama-3.1-8b-instant` foi retirado em 2026-10; o modelo de visão de uma delas foi descontinuado pelo Groq.
- **Repositório público:** o código e os SQL estão públicos no GitHub; segredos ficam só na Vercel/Supabase/GitHub Secrets.
