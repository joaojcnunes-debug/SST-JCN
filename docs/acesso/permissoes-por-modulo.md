# Permissões por módulo (Visualizar, Criar, Editar, Excluir)

> **No SST JCN (0.3.253, 10/11/2026):** trazido do Painel SST. A migração daqui é a **v333**
> (`supabase/historico/v333_usuarios_permissoes_modulos_telas.sql`), que junta a v345 (grade) e a v347 (Visualizar por
> tela) do Painel. A **2ª etapa (v346, o banco conferir a grade em 116 tabelas) não foi trazida**: no JCN a grade só muda
> a tela. Não há o módulo Laboratório. O texto abaixo é o do Painel, com os números de lá.

Pedido do usuário (09/11/2026): no cadastro de usuário, cada grupo de módulos abre e fecha como no SGG, e cada
módulo tem Visualizar, Criar, Editar e Excluir para marcar. "O funcionário só vai poder fazer o que estiver marcado."

Decisões do usuário:
- **3 grupos + Gestão**: Segurança do Trabalho (10), NR — Fatores Psicossociais (2) e JCN Sistema Interno (7),
  os mesmos de `CATEGORIAS_MODULO`. A Gestão JCN continua só com o acesso (as permissões dela ficam em
  Gestão › Membros e acessos, por quadro).
- **Em 2 etapas**: 1ª, a tela e os botões; 2ª, o banco recusar por módulo.
- **Contas atuais ficam com o que já têm**.

## Como funciona (1ª etapa — v0.3.901 + migration v345)

| O quê | Onde |
|---|---|
| Visualizar | `usuarios.modulos_permitidos`, como sempre (`useRequireModule` no layout de cada módulo e a RLS de leitura) |
| Criar/Editar/Excluir | `usuarios.permissoes_modulos` (jsonb): `{ "<modulo>": { criar, editar, excluir } }` |
| Empresas e Validades | a entrada `geral` da mesma coluna (as únicas telas fora dos módulos que consultam essas permissões; a Gestão tem regra própria por quadro) |
| Conta antiga (coluna NULL) | as chaves gerais `pode_criar`/`pode_editar`/`pode_excluir` valem em todos os módulos que ela vê e em Empresas/Validades |
| Conta salva no cadastro novo | só o que está marcado; módulo visto sem entrada não tem nenhuma das três |
| Admin | cria, edita e exclui em todo módulo que vê (os hooks contornam a grade, como antes) |
| Chaves gerais | gravadas como "pode em algum lugar" (`geral` + módulos que vê); são o que as funções do banco que as leem consultam |

- Regras puras e testes: `lib/acesso/permissoes-modulo.ts` e `.test.ts` (inclui a conferência de `MODULO_DA_ROTA`
  contra as pastas de `app/`: pasta nova num grupo de módulo sem entrada quebra o teste).
- As telas não mudaram uma a uma: `useCanCreate`, `useCanEdit`, `useCanDelete`, `useRequireCreate`,
  `useRequireEdit`, `useRequireQuimicos` e `usePodeEditarLinhaDaUnidade` (`lib/hooks/useUsuario.ts`) descobrem o
  módulo pelo endereço (`useModuloAtual` → `MODULO_DA_ROTA`). Todas as leituras das chaves gerais passavam por esses
  hooks (medido em 09/11: nenhuma leitura direta fora deles, da Gestão e do cadastro).
- Tela: `components/usuarios/GradePermissoesModulos.tsx`. Marcar Criar/Editar/Excluir marca o Visualizar junto;
  tirar o Visualizar limpa os três; a caixa do nome marca ou tira as quatro; Permitir todas/Bloquear todas por grupo
  e no topo. Transferências é só a entrada (poder transferir entre bases): sem Criar/Editar/Excluir.
- Sistema › Funções › "Aplicar padrão" volta a coluna a NULL: a conta passa a valer o padrão da função em todos os
  módulos.
- As caixas gerais "Pode criar / Pode editar / Pode excluir" saíram do cadastro (a grade substitui).

**Ninguém perde acesso** (pedido do usuário ao publicar): a coluna nasce NULL para todos, e NULL dá exatamente a
regra antiga (teste "conta antiga" percorre perfis × chaves × módulos). Salvar uma conta no cadastro novo sem mexer
na grade grava o mesmo que ela tinha (teste "salvar sem mexer", inclusive conta sem módulo nenhum). A linha
"Empresas e Validades" existe para isso: sem ela, tirar o Editar de todos os módulos tiraria em silêncio a edição de
Empresas e Validades, que liam a chave geral.

Medido em 09/11 (cópia da produção): 29 Técnicos ativos, todos com `pode_editar`; 30 Visualizadores; 6 Admins.
Por isso o lápis das telas por unidade (`usePodeEditarLinhaDaUnidade`), que passou a exigir o Editar do módulo, não
some para ninguém no dia da troca.

## O que a 1ª etapa NÃO faz

O banco ainda não confere por módulo. A RLS de escrita dos módulos usa `caller_pode_editar()`, que olha só o perfil
(Admin/Técnico), e 23 funções leem as chaves gerais (EPI, equipamentos, grupo de empresas, elaboração de documento,
laboratório…). Quem tem Editar em um módulo e não em outro não vê os botões no outro, mas uma chamada direta à API
ainda passaria.

## 2ª etapa (a fazer)

- Função `caller_pode_no_modulo(modulo, acao)` espelhando `podeNoModulo` (NULL → chaves gerais).
- Trocar a checagem nas policies de escrita de cada módulo e nas 23 funções, um módulo por vez, com teste em banco
  isolado (antes/depois) e rollback por módulo.

## Log

### [2026-11-09] 1ª etapa (v0.3.901 + v345)
- Migration testada em banco isolado (`painel_sst_teste_perm343`, cópia da produção): aplica 2x; técnico não grava a
  própria grade nem a de outro (0 linhas); admin grava; lista em vez de objeto é recusada; rollback tira a coluna e a
  reaplicação devolve.
- `npm test`: 1336 de 1339 (as 3 falhas são de `lib/psico-consolidacao`, sem o pacote `exceljs` no ambiente local,
  iguais sem a mudança). `tsc` sem erro novo. Renderização da grade fora do navegador conferida para Técnico, Admin e
  Visualizador.
