# Módulo "Gestão de EPI" — Guia de implementação

Documentação completa do que foi construído no **SST-JCN** para o card **Gestão de EPI**
(catálogo, estoque, NF-e, entregas, ficha PDF, assinatura biométrica e transferências),
pensada para **portar/refletir no Painel-SST (Chabra)**.

> **Base:** SST-JCN, versões v0.3.69 → v0.3.85, migrations **v121–v127**.
> **Regra Zero** seguida: descoberta antes de codar, fases com gate, arquivos completos,
> migrations idempotentes/reversíveis, tabelas de histórico/entrega/movimentação **append-only**.

---

## 0. Visão geral

- Card **"Gestão de EPI"** dentro da categoria **Segurança do Trabalho** no hub.
- **Acesso dual**: equipe interna (por unidade/e-mail) **e** cliente pelo **Portal** (isolado por empresa).
- **Escopo por fase**:
  1. Cadastro (colaboradores + catálogo ↔ C.A.) e estoque (movimentações append-only, saldo derivado).
  2. Importação de **NF-e** (XML) com dedup por chNFe e conferência item↔EPI.
  3. **Entrega física** + **Ficha PDF** (reaproveita o pipeline Puppeteer).
  4. **Assinatura do recebedor** (não-repúdio): desenho na tela **ou** biometria (digital).
  5. **Transferência entre empresas** (RPC atômica, só equipe interna).

**Diferença estética Painel-SST:** os componentes usam as classes `verde-primary`/`verde-accent`/
`verde-dark` — **as mesmas do Painel** (lá o hex é verde `#006B54`; no JCN é azul `#0ea5e9`).
Portar os componentes **como estão** já herda a marca verde do Painel automaticamente.

---

## 1. Banco de dados (migrations v121–v127)

Todas aplicadas via MCP `apply_migration` e registradas em `supabase/migrations/`.
No Painel, **renumere** para a sequência de migrations de lá.

### Convenções
- `empresas.id_empresa` é **TEXT** (ex.: `EMP-XXXXXXXX`) → todas as FKs `empresa_id text`.
- IDs client-gen via `gerarId("PREFIXO")` no front (formato `PREFIX-HEX8`) e `gen_random_uuid()::text` nas RPCs.
- Colunas de tempo: `criado_em timestamptz default now()`.
- **Append-only**: tabelas de movimentação/entrega/assinatura/transferência têm **apenas** políticas `SELECT` + `INSERT` (nunca `UPDATE`/`DELETE`). Estado ("assinada", "lançada") é **derivado** por existência de linha.

### v121 — Cadastro & Estoque
- `epi_colaboradores` (roster por empresa): `id, empresa_id, nome, cpf, matricula, cargo, setor, ativo, criado_por, criado_em, updated_at`. **CRUD** (SELECT/INSERT/UPDATE/DELETE).
- `epi_catalogo` (EPI ↔ C.A.): `id, empresa_id, nome, tipo('EPI'|'EPC'), ca_numero, ca_validade date, fabricante, descricao, unidade, estoque_minimo, foto_url, foto_path, ativo, criado_por, criado_em, updated_at`. **CRUD**.
- `epi_movimentacoes` (**append-only**): `id, empresa_id, id_catalogo FK, tipo('entrada'|'saida'|'ajuste') check, quantidade numeric check(>0), origem, ref_id, motivo, responsavel, criado_por, criado_em`.
- View `v_epi_saldo` **`with (security_invoker = true)`** — saldo = `SUM(entrada) - SUM(saida)` por `(empresa_id, id_catalogo)`.

### v122 — Importação NF-e
- `epi_importacoes_nfe` (**append-only**): `id, empresa_id, chnfe, fornecedor_cnpj, fornecedor_nome, numero_nf, data_emissao date, xml_nome, total_itens, itens_lancados, status, criado_por, criado_em`, com **`unique (empresa_id, chnfe)`** (dedup).
- `epi_importacoes_nfe_itens` (**append-only**): `id, id_importacao FK, empresa_id, cprod, xprod, ncm, unidade, quantidade, valor_unitario, id_catalogo FK, status_map, criado_em`.
- RPC **`epi_importar_nfe(p_empresa_id, p_chnfe, p_fornecedor_cnpj, p_fornecedor_nome, p_numero_nf, p_data_emissao date, p_xml_nome, p_itens jsonb) returns text`** — `SECURITY DEFINER`, atômica: valida permissão, valida chNFe (44 díg), dedup, cria itens novos no catálogo se marcado, insere cabeçalho com `itens_lancados` **pré-calculado (sem UPDATE)**, insere itens + dá `entrada` em `epi_movimentacoes` (`origem='nfe'`, `ref_id=chnfe`).

### v123 — Entrega física + Ficha
- `epi_entregas` (**append-only**): `id, empresa_id, id_colaborador FK, data_entrega date, responsavel_entrega, observacao, total_itens, status, assinatura_recebedor, criado_por, criado_em`.
- `epi_entregas_itens` (**append-only**): `id, id_entrega FK, empresa_id, id_catalogo FK, nome_epi, ca_numero, quantidade check(>0), criado_em` (snapshot de nome/CA no momento da entrega).
- RPC **`epi_registrar_entrega(p_empresa_id, p_id_colaborador, p_data_entrega date, p_responsavel, p_observacao, p_itens jsonb) returns text`** — `SECURITY DEFINER`, atômica: valida permissão, valida colaborador∈empresa, **valida saldo de TODOS os itens antes de escrever** (soma `epi_movimentacoes`) → sem estoque negativo; grava ficha+itens e dá `saida` (`origem='entrega'`, `ref_id=id_entrega`).

### v124 — Assinatura (trilha de evidências)
- `epi_entrega_assinaturas` (**append-only**): `id, id_entrega FK, empresa_id, id_colaborador, assinante_nome, assinatura_png, pdf_sha256, user_agent, ip, assinado_em, criado_por, criado_em`.
- RPC **`epi_assinar_entrega(...)`** — `SECURITY DEFINER` **insert-only**: deriva empresa/colaborador da entrega, valida permissão, **captura o IP no servidor** via `current_setting('request.headers')` (o cliente não forja).

### v125 — Transferência entre empresas (só interno)
- `epi_transferencias` (**append-only**): `id, empresa_origem, empresa_destino, observacao, total_itens, criado_por, criado_em`.
- `epi_transferencias_itens` (**append-only**): `id, id_transferencia FK, empresa_origem, empresa_destino, id_catalogo_origem FK, id_catalogo_destino FK, nome_epi, quantidade, criado_em`.
- RPC **`epi_transferir(p_empresa_origem, p_empresa_destino, p_observacao, p_itens jsonb) returns text`** — `SECURITY DEFINER`, atômica: **só equipe interna**; valida saldo na origem, cria/mapeia item no destino, gera `saida` na origem + `entrada` no destino (`origem='transferencia'`).

### v127 — Assinatura biométrica (Fase 4B)
- `epi_entrega_assinaturas` += `metodo('canvas'|'digital')`, `finger_hash`, `device_info`, `qualidade`, `consentimento_em timestamptz`.
- RPC `epi_assinar_entrega` estendida para **10 args** (`... p_metodo default 'canvas', p_finger_hash, p_device_info, p_qualidade, p_consentimento boolean`): se `metodo='digital'` exige `finger_hash` **e** consentimento; se `canvas` exige `assinatura_png`.
- **LGPD:** guarda só o **hash SHA-256** da amostra; **nunca** a imagem/template da digital (templates não são determinísticos, o hash não permite rematch — proposital: minimização).

---

## 2. Modelo de permissão — RLS **DUAL** (⚠️ armadilha crítica)

> **Bug que custou caro:** as RLS/RPCs iniciais usavam **só** o padrão do Portal
> (`get_meu_perfil()`/`get_minhas_empresas()`), que casam o usuário por
> `id_usuario = auth.uid()`. A **equipe interna** tem `id_usuario` custom (ex.
> `USR_ADMIN_001`) e casa por **e-mail** (`auth.jwt()->>'email'`) via `caller_*`.
> Resultado: **usuário interno barrado em TUDO** ("Você não tem permissão para esta ação").

**Corrigido na v126** — políticas **duais** (o Painel tem as mesmas funções):

- **Leitura (SELECT):** `public.epi_caller_interno() OR empresa_id = any(public.get_minhas_empresas())`
- **Escrita (INSERT/UPDATE):** `public.caller_pode_editar() OR empresa_id = any(public.get_minhas_empresas())`
- **Delete:** `public.caller_eh_admin() OR empresa_id = any(public.get_minhas_empresas())`
- **Interno-only (transferência):** `public.caller_pode_editar()`

Helper novo:
```sql
create or replace function public.epi_caller_interno()
  returns boolean language sql stable security definer set search_path=public as $$
  select exists (select 1 from public.usuarios
    where lower(email) = lower(auth.jwt() ->> 'email') and ativo_sistema = true);
$$;
```

**Nas RPCs**: usar `public.caller_pode_editar()` / `public.get_minhas_empresas()` e
`v_email := auth.jwt() ->> 'email'` como autor (o lookup por `id_usuario=auth.uid()` volta nulo p/ interno).

> **Ao portar:** já nascer com o modelo dual. `caller_pode_editar()`/`caller_eh_admin()`
> existem no Painel; `get_meu_perfil()`/`get_minhas_empresas()` são do Portal (v64+).

---

## 3. Frontend (Next.js 15, App Router)

### Dados
- `lib/epi/types.ts` — tipos: `EpiColaborador`, `EpiCatalogoItem`, `EpiMovimentacao`, `EpiSaldo`, `EpiImportacaoNfe`/`EpiNfeParsed`/`EpiNfeItemParsed`, `EpiEntrega`/`EpiEntregaItem`, `EpiEntregaAssinatura` (+ `metodo/finger_hash/...`), `EpiTransferencia`/`EpiTransferenciaItem`.
- `lib/epi/store.ts` — Zustand `useEpiStore` (empresa selecionada no contexto interno).
- `lib/epi/nfe.ts` — **parser de NF-e** via `DOMParser` (por `localName`, aceita `nfeProc` ou `NFe` cru): extrai `chNFe` (de `infNFe@Id`), emit CNPJ/xNome, ide nNF/dhEmi, itens `det/prod` (cProd/xProd/NCM/uCom/qCom/vUnCom).
- `lib/hooks/useEpi.ts` — todos os hooks TanStack Query: colaboradores, catálogo, movimentações, saldo (Map), importações NF-e, entregas, assinaturas, transferências. Helper `emailAtual()` = `useUserStore.getState().user?.email`. IDs via `gerarId("COL"|"EPI"|"MOV")`. RPCs via `supabase.rpc(...)`.

### Componentes (`components/epi/`)
- `EpiGestao.tsx` — **shell com abas** (Catálogo, Estoque, NF-e, Entregas, **Transferências**, Colaboradores). Props: `empresaId`, `canEdit`, `contexto?: "interno"|"cliente"`. Filtra abas por `soEdicao`/`soInterno`. **Reutilizado** pelos 2 públicos.
- `EpiModal.tsx` — casca de modal + exporta `inputCls`/`labelCls`.
- `EpiCatalogoTab.tsx` — CRUD do catálogo + badges C.A. vencido/vencendo + alerta saldo<mínimo.
- `EpiEstoqueTab.tsx` — registrar movimentação + saldo + histórico.
- `EpiColaboradoresTab.tsx` — CRUD do roster.
- `EpiNfeTab.tsx` — upload XML → parse → **conferência item↔EPI** (criar novo / vincular existente / ignorar) → confirmar → RPC + histórico. Só `canEdit`.
- `EpiEntregasTab.tsx` — form (colaborador + data + linhas de item com **saldo exibido/validado no cliente**) → RPC; histórico com botão **Ficha** (PDF) e **Assinar**; badge "Assinada".
- `EpiTransferenciasTab.tsx` — **só interno**: destino via `EmpresaSelect`, itens de origem com saldo, mapear/criar no destino, histórico saída/entrada.
- `SignatureCanvas.tsx` — **canvas de assinatura sem dependência** (pointer/touch + devicePixelRatio), exporta `getDataUrl()/clear()/isEmpty()`.
- `EpiAssinaturaModal.tsx` — baixa a ficha, calcula **SHA-256 (WebCrypto)** do PDF exato, alterna **Digital/Desenhar**, termo de **consentimento LGPD**, detecta o leitor, chama a RPC.

### Rotas / integração
- Route group `app/(epi)/` (layout com `useRequireModule("epi")` + sidebar) + `app/(epi)/epi/page.tsx` (EmpresaSelect + `<EpiGestao contexto="interno">`) + `/epi/ajuda`.
- Portal: `components/portal-cliente/EpiCliente.tsx` (`<EpiGestao contexto="cliente" canEdit>`, empresa = `empresas_vinculadas[0]`) + `app/(cliente)/portal-cliente/epi/page.tsx` + item **EPI** no NAV do `PortalClienteLayout`.
- Registro do módulo: `lib/supabase/types.ts` (`ModuloPermitido` += `"epi"`, `TODOS_MODULOS`, `ROTULO_MODULO`). Card no hub em `app/(hub)/inicio/page.tsx` (ícone `HardHat`, categoria "seguranca"). Habilitar `"epi"` em `modulos_permitidos` do usuário (o `useRequireModule` checa mesmo para Admin).

---

## 4. Ficha em PDF (reaproveita o pipeline vetorial)

- Template server-side: `components/pdf/templates/EpiFichaEntregaTemplate.tsx` — **sem "use client"**, só estilos inline, compatível com `renderToStaticMarkup`. 1 página: identificação do colaborador, tabela de itens com **C.A.**, **termo de responsabilidade NR-06 / art. 158 CLT**, área de assinatura **centralizada**, carimbos.
- Rota: `app/api/pdf/epi-entrega/[id]/route.ts` — `runtime="nodejs"`; autentica via `createSupabaseServerClient(cookieStore)` (**RLS aplica**), busca entrega + itens + colaborador + empresa + logo (`configuracoes.chave='logo_url'`) + assinatura mais recente → `renderToStaticMarkup(Template)` → extrai `<style>` → `gerarPdf(fullHtml)` (Puppeteer + `@sparticuz/chromium`) → devolve `application/pdf`.
- Botão: `<BotaoGerarPdf apiPdfUrl={`/api/pdf/epi-entrega/${id}`} />` (mesmo componente dos outros laudos). No contexto interno passa `tabelaNome="epi_entregas"` + `docId` para habilitar a **selagem PAdES A1** (via `/api/sign-pdf`, que é **table-agnostic**: salva `pdfs-assinados/{tabela}/{docId}.pdf` + upsert `pdfs_assinados`).

---

## 5. Assinatura biométrica / não-repúdio

### Camadas de validade legal
1. **Assinatura eletrônica (Nível 1 — pronto):** biometria/desenho do recebedor + **hash SHA-256 do PDF** + trilha imutável (quem/quando/hash/IP/consentimento). Válida pela **Lei 14.063/2020 + MP 2.200-2/2001** (citadas no carimbo do PDF).
2. **Assinatura qualificada (Nível 2 — opcional):** **selo PAdES A1 ICP-Brasil** por cima (reaproveita `api/sign-pdf`), validável no ITI. Exige um **certificado A1 (.pfx)** cadastrado.

### Leitor de digital — HID DigitalPersona U.are.U 4500
Navegador **não** acessa o leitor USB direto — precisa de um **agente local** em `localhost`.

**Caminho WEB (o que funcionou):** usar o agente **DpHost** que o sistema **SGG** já roda
(`wss://127.0.0.1:52181`), pelo SDK `@digitalpersona/devices` — **sem instalar nada novo**.
Armadilhas resolvidas (todas no `sst-jcn`):
- **Certificado:** o DpHost serve TLS com CA "DigitalPersona Local client Certificate Authority" (Crossmatch), que precisa estar no **Trusted Root** do Windows (o Chrome/Edge confiam). Reiniciar o navegador se o cert for novo.
- **`WebSdk`/`async` globais:** o `@digitalpersona/websdk` foi feito para `<script>` e usa `WebSdk` e `async` como **globais** — **empacotar pelo webpack quebra** (ReferenceError / `async.waterfall` de undefined; ProvidePlugin não injeta `async`). **Solução final:** servir `public/vendor/websdk.client.ui.min.js` (autocontido, já traz o async), carregar via **`<script>`** (seta `window.WebSdk`) e tratar **`WebSdk` como `externals`** no `next.config` (nos 2 bundles). Ver `lib/epi/digitalPersona.ts` → `garantirGlobaisWebSdk()`.

**Caminho DESKTOP (plano B, Electron):** helper nativo C# `native/EpiFingerprint/EpiFingerprint.cs`
usando o **DPUruNet.dll** do RTE (captura → FMD → SHA-256 → **descarta** → JSON no stdout).
⚠️ **GOTCHA:** capturar em **`DP_PRIORITY_EXCLUSIVE`** — no cooperativo o DpHost do SGG segura o
leitor e dá `DP_QUALITY_TIMED_OUT`. Integração: `electron/main.ts` (ipc `epi:ler-digital`/`epi:leitor-check`),
`preload.ts`, `types/electron.d.ts`, `electron-builder.yml` (extraResources empacota EXE+DLL).

### Wrapper `lib/epi/digitalPersona.ts`
`leitorDisponivel()` e `capturarDigital()` **preferem o helper Electron** (se `window.electronAPI.epiLerDigital`),
senão usam o **SDK web** (`@digitalpersona/devices`) via agente local; degradam com fallback para o **desenho**.

### Carimbo do PDF (estilo do SGG)
Quando `metodo='digital'`: ícone de digital (SVG) + **"Assinado biometricamente"** + data/hora + **Cód.**
(12 primeiros do `finger_hash`). Abaixo, centralizado, o **nome** + "Assinatura do colaborador (recebedor)".
Bloco detalhado de não-repúdio: hash do documento, hash biométrico, IP, consentimento e base legal.

---

## 6. Gotchas gerais (checklist ao portar)

- **RLS dual** desde o início (seção 2). É o erro nº 1.
- **Append-only**: nada de UPDATE nas tabelas de movimentação/entrega/assinatura/transferência; derive estado.
- **`empresa_id` é TEXT** (`EMP-...`) — no `EmpresaSelect`, o valor é `id_empresa`, **não** o CNPJ mostrado.
- **RPCs**: autor via `auth.jwt()->>'email'`; permissão via `caller_pode_editar()`/`get_minhas_empresas()`.
- **Version bump**: sempre bumpar `package.json` em todo commit (o app desktop só atualiza com bump).
- **Layout**: não usar `w-full` (do `inputCls`) junto com `w-20` no mesmo input — conflita e colapsa o select; use um wrapper com largura fixa (`<div className="w-20 shrink-0">`).
- **Cache/Service Worker**: o `[ServiceWorkerPingScript]` do console costuma ser de **extensão** (MOTE), não do app. Compare o **hash do chunk** local vs carregado para saber se é cache.
- **CRLF**: arquivos do projeto usam CRLF; scripts de edição precisam normalizar EOL.
- **PDF template**: sem "use client", só estilos inline, `renderToStaticMarkup`.
- **Biometria (LGPD)**: só guardar **hash** da amostra, nunca imagem/template; registrar consentimento.

---

## 7. Arquivos-chave (mapa rápido)

```
supabase/migrations/v121..v127_*.sql       # tabelas + RPCs + RLS (renumerar no Painel)
lib/epi/types.ts | store.ts | nfe.ts | digitalPersona.ts
lib/hooks/useEpi.ts
components/epi/EpiGestao.tsx | EpiModal.tsx | Epi*Tab.tsx
components/epi/SignatureCanvas.tsx | EpiAssinaturaModal.tsx
components/pdf/templates/EpiFichaEntregaTemplate.tsx
app/api/pdf/epi-entrega/[id]/route.ts
app/(epi)/layout.tsx | app/(epi)/epi/page.tsx | .../ajuda
components/portal-cliente/EpiCliente.tsx | app/(cliente)/portal-cliente/epi/page.tsx
components/portal-cliente/PortalClienteLayout.tsx   # + item de NAV "EPI"
lib/supabase/types.ts | app/(hub)/inicio/page.tsx    # registro do módulo + card
public/vendor/websdk.client.ui.min.js | next.config.ts  # WebSdk external (digital web)
native/EpiFingerprint/EpiFingerprint.cs | electron/main.ts | preload.ts | electron-builder.yml  # digital desktop
```

---

*Gerado a partir da implementação real do SST-JCN (v0.3.85). Ajuste marca/estética e a
numeração de migrations ao trazer para o Painel-SST.*
