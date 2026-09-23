# Spec — Recebimentos por unidade (botão de aceite com alerta)

Status: aprovada na conversa, aguardando aval do texto para implementar
Escopo: módulo `inventario_maquinas` (route group `app/(inventario-maquinas)`)
Base lida: branch `cutover/2026-06-26`, pós-merge `42eaaa7` (v136)
Substitui: `spec-transferencia-modal.md` (proposta de modal de envio — descartada)

---

## 1. Objetivo

O botão que hoje fica no topo da Visão geral e leva à tela de transferência muda de
função: passa a ser o **ponto de recebimento de cada unidade**. Ganha um alerta quando há
transferência endereçada a você naquela unidade e, ao ser clicado, abre um mini modal com
as transferências pendentes que estão chegando ali — onde o destinatário aceita/assina e os
demais apenas visualizam.

Em paralelo, a seção "Unidades" da sidebar deixa de listar unidades sem inventário
(resolve o "Conselheiro").

**O que NÃO muda:** a tela `/inventario-maquinas/transferencia` continua existindo, o item
"Transferência" continua na sidebar, e o fluxo de envio/aceite/assinatura/RPCs do v136 fica
intacto. Esta spec **reempacota** a caixa de aceite; não reescreve regra de negócio, não
toca migration nem RPC.

---

## 2. Decisões travadas (da conversa)

| Tema | Decisão |
|---|---|
| Modal de envio | **Descartado.** Envio segue na tela, acessível pela sidebar. |
| Quem aceita | **Só o destinatário nomeado** (ou admin). Regra do v136 mantida, sem migration. |
| Alerta (badge) | **Só para o destinatário.** Quem não é endereçado não vê contador. |
| Visão do modal | **Informativa.** Outros usuários da unidade veem as transferências chegando, mas sem botão de ação — só o destinatário assina. |
| Onde fica o botão | **Só nas unidades** (quando há `?unidade=` ativo). **Removido da Visão geral** sem unidade. |
| Nome do botão | **"Recebimentos".** |
| Conselheiro | Seção "Unidades" lista só unidades **com equipamento**. Sem migration, sem apagar cadastro. |

---

## 3. A regra que molda tudo (contexto, não é para mudar)

O aceite é **por pessoa, não por unidade**. Está na RPC, não na tela:

```sql
-- v136:231-233 (transferencia_aceitar)
if lower(coalesce(t.para_usuario_email,'')) <> me and not public.caller_eh_admin() then
  raise exception 'Só o destinatário selecionado (ou um admin) pode aceitar esta transferência';
end if;
```

E a visibilidade também já está resolvida no banco — a RLS deixa qualquer pessoa da unidade
de origem ou destino **ver** a transferência (é isso que viabiliza a "visão informativa"):

```sql
-- v136:171-178 (transferencias_sel)
public.caller_eh_admin()
or lower(coalesce(para_usuario_email,'')) = lower(auth.jwt() ->> 'email')  -- destinatário
or de_id_unidade   = any(public.caller_unidades())                        -- origem
or para_id_unidade = any(public.caller_unidades())                        -- destino
or (de_id_unidade is null and para_id_unidade is null)                    -- legado
```

Consequência de projeto que o produto assume: numa unidade, **ver** é de todos; **aceitar** é
de um. O alerta segue o "aceitar" (só o destinatário), o modal segue o "ver" (todos). É essa
assimetria que a mensagem "Aguardando aceite de Fulano" torna legível — ver 5.3.

---

## 4. Mudança 1 — O botão "Recebimentos"

Arquivo: `app/(inventario-maquinas)/inventario-maquinas/page.tsx`

### 4.1 Hoje

```tsx
// page.tsx:173-178 — sempre visível, é um Link para a tela de envio
<Link href="/inventario-maquinas/transferencia" className="...">
  <ArrowLeftRight className="size-4" /> Transferência
</Link>
```

### 4.2 Depois

- **Aparece só quando há unidade selecionada** (`unidadeFiltro` truthy). Sem unidade, nada
  no lugar. `unidadeFiltro` já é calculado em `page.tsx:67` a partir de `?unidade=`.
- Vira `<button onClick={() => setRecebimentosAberto(true)}>`, com o mesmo visual do botão
  atual (mesmas classes), rótulo **"Recebimentos"**, ícone `Inbox` (já usado no módulo).
- Recebe um **badge com o contador** quando há pendências endereçadas a mim naquela unidade.
- **Sem gate de `podeTransferir`.** Aceitar não exige o módulo `transferencias` (a RPC só
  checa destinatário/admin). Quem tem algo a receber recebe, tenha ou não o módulo de envio.

```tsx
{unidadeFiltro && (
  <button
    type="button"
    onClick={() => setRecebimentosAberto(true)}
    className="relative inline-flex items-center gap-1.5 rounded-md border border-blue-300 bg-white px-3 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-50"
  >
    <Inbox className="size-4" /> Recebimentos
    {meusPendentesNaUnidade > 0 && (
      <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
        {meusPendentesNaUnidade}
      </span>
    )}
  </button>
)}
```

### 4.3 O contador (alerta) — só o que é meu

`page.tsx` passa a usar `useTransferencias()` (já existe, é o hook da tela de envio) e
`useCurrentUser()`. O contador é client-side sobre dado que já chega:

```ts
const { data: transferencias = [] } = useTransferencias();
const meuEmail = (user?.email ?? "").toLowerCase();

const meusPendentesNaUnidade = useMemo(
  () => transferencias.filter((t) =>
    t.status === "pendente" &&
    t.para_id_unidade === unidadeFiltro &&
    (t.para_usuario_email ?? "").toLowerCase() === meuEmail   // ← só MEU: o alerta nunca mente
  ).length,
  [transferencias, unidadeFiltro, meuEmail],
);
```

Nota: aqui **não** entra `isAdmin ||`. Diferente da caixa original (`transferencia/page.tsx:138`),
o admin não deve ver o badge de todo mundo aceso em cada unidade — viraria ruído permanente.
Admin continua podendo aceitar (a RPC permite), mas o alerta visual é do destinatário.

---

## 5. Mudança 2 — O mini modal de Recebimentos

Componente novo: `components/inventario-maquinas/RecebimentosModal.tsx`
Construído sobre `components/ui/Modal.tsx` (`size="lg"`), reaproveitando portal, ESC, focus
trap e scroll-lock.

```ts
interface RecebimentosModalProps {
  open: boolean;
  onClose: () => void;
  idUnidade: string;        // = unidadeFiltro
  nomeUnidade: string | null;  // = nomeUnidadeFiltro (page.tsx:68)
}
```

### 5.1 O que lista

Todas as transferências **pendentes com destino a esta unidade** — não só as minhas:

```ts
const pendentesDaUnidade = transferencias.filter(
  (t) => t.status === "pendente" && t.para_id_unidade === idUnidade,
);
```

A RLS já garante que só chega aqui o que o usuário pode ver (seção 3). Ordenar por
`data_hora` desc (o hook já traz assim).

Estado vazio: "Nenhuma transferência chegando para {nomeUnidade} no momento."

### 5.2 Conteúdo de cada item

Portado da caixa "Aguardando seu aceite" (`transferencia/page.tsx:216-248`), com a lógica de
ação condicionada ao destinatário:

- Nome do equipamento + identificadores (código, tag, modelo).
- Trajeto: `origem → {nomeUnidade}`.
- Quem enviou (`responsavel_nome`) e, quando houver, quem transporta (`transportado_por`).

### 5.3 A parte informativa (o pedido desta rodada)

O bloco de ações muda conforme quem abre:

```tsx
const souODestinatario = (t.para_usuario_email ?? "").toLowerCase() === meuEmail;

{souODestinatario ? (
  // Destinatário: as ações reais, idênticas às de hoje
  <div className="flex shrink-0 gap-2">
    <button onClick={() => setAssinando(t)} className="...bg-emerald-600...">
      <Check className="size-4" /> Aceitar e assinar
    </button>
    <button onClick={() => handleRecusar(t)} className="...border-red-300...">
      <Ban className="size-4" /> Recusar
    </button>
  </div>
) : (
  // Demais usuários da unidade: só leitura, com o motivo de não poder agir
  <span className="shrink-0 rounded-md bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
    Aguardando aceite de {t.para_usuario_nome ?? "destinatário"}
  </span>
)}
```

É esta linha — **"Aguardando aceite de {nome}"** — a mensagem que você pediu. Ela responde
de antemão ao "por que não consigo aceitar isto?": porque foi endereçado a outra pessoa. O
admin é exceção silenciosa: como a RPC o deixa aceitar, ele também vê os botões de ação
(tratar `souODestinatario || isAdmin` no lado das ações).

### 5.4 Ações — reaproveitamento puro

Nenhum fluxo novo. As mesmas funções e hooks da tela de envio:

| Ação | Reaproveita | Efeito |
|---|---|---|
| Aceitar e assinar | abre `AssinaturaAceiteModal` → `useAceitarTransferencia` → RPC `transferencia_aceitar` | move o equipamento e grava a assinatura |
| Recusar | `useRecusarTransferencia` → RPC `transferencia_recusar` | equipamento fica na origem |

`AssinaturaAceiteModal` (`SignatureCanvas`) sai de `transferencia/page.tsx:507-569` para
`components/inventario-maquinas/AssinaturaAceiteModal.tsx`, para ser usado nos dois lugares
(a tela e este modal) sem duplicar. Ao migrar, apoiá-lo em `ui/Modal.tsx` em vez do
`fixed inset-0` cru — ganha ESC/foco/portal, que importam mais aqui por ser o passo com peso
legal. Comportamento inalterado.

### 5.5 Aninhamento de modais

"Aceitar e assinar" abre o `AssinaturaAceiteModal` **por cima** do `RecebimentosModal` (dois
`z-50`). Opções: subir o de assinatura para `z-[60]`, ou fechar o de recebimentos ao abrir o
de assinatura e reabrir no cancelamento. Prefiro o `z-[60]` — menos troca de estado, o
contexto da lista continua visível atrás.

### 5.6 `window.prompt` da recusa

A recusa hoje usa `window.prompt` para o motivo (`transferencia/page.tsx:146`). Dentro de um
modal isso fica pior (diálogo nativo sobre `role="dialog"`). Trocar por um campo inline ou um
`ConfirmDialog` com `<textarea>`. O motivo é opcional na RPC (`transferencia_recusar(p_id, p_motivo)`),
então um textarea vazio é válido.

---

## 6. Mudança 3 — Botão fora da Visão geral

Você pediu para o botão existir **só nas unidades**. A condicional `unidadeFiltro &&` da
seção 4.2 já entrega isso: sem unidade selecionada, o botão não renderiza. A Visão geral
"Todas" fica limpa; o botão aparece ao entrar numa unidade.

Efeito colateral a confirmar: hoje o botão do topo é a **única** entrada para a tela de envio
a partir da Visão geral (`page.tsx:173`). Removendo-o de lá, o envio passa a ser acessado
**só pela sidebar** (item "Transferência", que continua). Isso está alinhado com "manter a
transferência na sidebar" — só registro que a Visão geral deixa de ter atalho de envio.

---

## 7. Mudança 4 — Excluir só o Conselho + remover a aba "Equipamentos"

Arquivo: `app/(inventario-maquinas)/layout.tsx` (+ seletor de destino em `transferencia/page.tsx`)

**Revisão (2026-07-17, após v0.3.465):** a decisão anterior ("só unidades com inventário")
foi trocada. O usuário quer **todas as unidades visíveis, mesmo sem equipamento** — só o
cadastro **"Conselho/Conselheiro"** (uma unidade que não é base real de equipamentos) fica de
fora. E a aba **"Equipamentos"** sai da sidebar.

### 7.1 Regra

- Sidebar "Unidades": lista **todas** as unidades do usuário, **exceto** as que casam com o
  nome Conselho/Conselheiro. Some o filtro por inventário.
- Sidebar "Inventário": o item **"Equipamentos"** é removido — todo equipamento já aparece na
  Visão geral (filtro "Equipamentos") ou dentro de cada unidade.

Exclusão por nome (assumida a contragosto do "não hardcodar", mas foi o pedido explícito),
robusta às duas grafias e a acentos/espaço:

```ts
// layout.tsx (topo)
const ehConselho = (nome: string | null) => /^conselh/i.test((nome ?? "").trim());
// ...
const unidadesVisiveis = (isAdmin
  ? unidades
  : unidades.filter((u) => idsDoUsuario.has(u.id_unidade))
).filter((u) => !ehConselho(u.nome));
```

Não precisa mais de `useInventarioMaquinas` no layout (revertido).

### 7.2 Seletor de destino

Mesma exclusão, sem o filtro por inventário — **bases vazias voltam a ser destinos válidos**
(some a antiga restrição "não transfere para base vazia"; só o Conselho fica fora):

```ts
// transferencia/page.tsx
const unidadesDestino = useMemo(
  () => unidades.filter((u) => !/^conselh/i.test((u.nome ?? "").trim())),
  [unidades],
);
// o <select> itera unidadesDestino (mantendo o exclui-base-atual)
```

### 7.3 Ripple da remoção de "Equipamentos"

- Import `Package` sai do `layout.tsx`.
- O back-link "← Equipamentos" da tela de transferência (`transferencia/page.tsx`) passa a
  apontar para `/inventario-maquinas` (Visão geral), com o texto "Inventário".
- A **rota** `/inventario-maquinas/equipamentos` **não é removida** — continua funcionando por
  URL, apenas deixa de ter item de menu. (O usuário pediu só a aba.)

### 7.4 O que continua igual

- O **cadastro** de Conselho permanece na tabela `unidades`. Outros módulos, intactos.
- Nenhuma migration.

---

## 8. Navegação e estados após a mudança

| Superfície | Antes | Depois |
|---|---|---|
| Sidebar → Inventário | Visão geral, Equipamentos, Transferência, Ajuda | Visão geral, Transferência, Ajuda (**Equipamentos removido**) |
| Sidebar → Unidades | uma por unidade (inclui Conselheiro) | todas **exceto Conselho/Conselheiro** |
| Visão geral, sem unidade | botão "Transferência" → tela de envio | **sem botão** |
| Visão geral, com `?unidade=` | mesmo botão de envio | botão **"Recebimentos"** + badge (se meu) |
| Clique em "Recebimentos" | — | mini modal: pendentes chegando à unidade |
| Aceitar/assinar/recusar | na tela `/transferencia` | **também** no mini modal (mesmas RPCs) |
| Tela `/transferencia` | 3 seções | **igual** |

### 8.1 Estados a cuidar

- **Badge zera ao aceitar/recusar.** Os hooks já invalidam `["transferencias"]` no sucesso
  (`useTransferencias.ts:274, 292`); o contador recalcula sozinho. Nada a fazer.
- **Modal aberto, nada mais pendente.** Se o usuário aceita o último item, a lista esvazia —
  mostrar o estado vazio em vez de fechar o modal na cara dele. Fechar só no clique.
- **Não-destinatário sem nada para ver.** Se um usuário abre "Recebimentos" e todas as
  pendentes são de outros, ele vê a lista com "Aguardando aceite de …" em todas, nenhuma
  acionável. Correto e informativo — é o ponto do modal informativo.
- **Trocar de unidade.** `idUnidade`/`nomeUnidade` são capturados na abertura; como a sidebar
  fica atrás do backdrop, não há troca com o modal aberto. Resetar `assinando` no `onClose`.

---

## 9. Ordem de implementação

1. Extrair `AssinaturaAceiteModal` para arquivo próprio sobre `ui/Modal.tsx`. Isolado.
2. Criar `RecebimentosModal.tsx` (lista pendente da unidade + visão informativa + ações do
   destinatário), reusando os hooks de aceite/recusa.
3. Em `page.tsx`: trocar o `<Link>` do topo pelo `<button>` "Recebimentos" condicional a
   `unidadeFiltro`, com badge; fiar `useTransferencias` + `useCurrentUser`.
4. Trocar o `window.prompt` da recusa por campo inline / `ConfirmDialog` com textarea.
5. Em `layout.tsx`: filtrar a seção "Unidades" por inventário (`unidadesComInventario`).
6. Passar o olho na Ajuda: incluir a nota "Recebimentos por unidade" quando/for oportuno
   (opcional nesta rodada — a spec de tutorial anterior não vale mais).

Passos 1–4 são aditivos: a tela `/transferencia` continua funcionando o tempo todo. Nada
quebra no meio do caminho.

---

## 10. Débitos que continuam de pé (fora do escopo, do v136)

Vistos ao ler o módulo; **não** endereçados aqui, mas relevantes porque o mini modal também
gera comprovante indireto e usa a mesma trilha de aceite:

1. **O PDF não imprime status nem assinatura** (`TransferenciasTemplate.tsx`, pré-v136).
   Comprovante de recusada é indistinguível de aceita.
2. **`pdf_sha256` e `assinatura_ip` nunca são gravados** — a RPC aceita
   (`v136:212-218`), o hook não envia (`useTransferencias.ts:265-270`). A migration invoca a
   Lei 14.063/2020 sobre o hash do documento, e o hash não é salvo.
3. **Código morto:** `useRegistrarTransferencia` (`useTransferencias.ts:88-156`), fluxo antigo
   sem aceite. Sem importadores.
4. **RPC `transferencia_abrir` sem front** (`v136:192-209`). A trava "item aberto por Fulano"
   existe no banco e nunca é chamada — se dois abrirem o mesmo item no novo modal, não há o
   aviso que o banco previu.
5. **Base editável direto no cadastro** (`MaquinaForm.tsx`), contornando o aceite inteiro.

Recomendo os itens 1 e 2 antes de divulgar o novo fluxo — o mini modal facilita aceitar, e
mais aceites significam mais comprovantes emitidos por um template que ainda omite o status.
