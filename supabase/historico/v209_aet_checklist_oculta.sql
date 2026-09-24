-- v209 — AET: pergunta do checklist pode ser EXCLUÍDA de verdade
--
-- PEDIDO (11/09/2026)
--   A tela "Config. OWAS › Checklist" tem lixeira em toda pergunta, mas nas 11
--   perguntas PADRÃO ela era promessa falsa: essas 11 são linhas escritas à mão
--   em três lugares (tela de análise, prévia do laudo e template do PDF), e
--   apagar a linha da tabela só devolvia o texto original. Ele pediu para
--   passar a excluir de verdade.
--
-- ⚠️ SCHEMA REAL — conferido lendo o banco em 11/09, NÃO o repo
--   `aet_checklist_perguntas` **não é criada por migration nenhuma** (nasceu
--   fora do versionamento; só aparece na v74, das permissões). O que existe:
--
--       slug   text  PRIMARY KEY
--       label  text  not null
--       secao  text  not null
--
--   Nada mais. Foi por gravar uma 4ª coluna (`tipo`, que só existe no tipo
--   TypeScript) que TODO Salvar desta tela respondia
--   `PGRST204 Could not find the 'tipo' column` — corrigido na v0.3.585.
--
-- O QUE ESTA MIGRATION FAZ
--   Uma coluna: `oculta boolean not null default false`.
--
--   POR QUE COLUNA, e não "linha ausente = excluída": a tabela guarda apenas o
--   que foi ALTERADO, e a leitura MESCLA com o padrão do código (lib/aet/
--   checklist.ts). Nesse desenho, ausência já significa "usa o padrão". Usar a
--   ausência para dois sentidos faria uma gravação parcial — uma linha que não
--   entrou — sumir com a pergunta de TODOS os laudos, em silêncio, inclusive
--   dos assinados. Marca explícita falha de forma visível; ausência, não.
--
--   Também por isso a exclusão é REVERSÍVEL: a tela mostra a pergunta oculta
--   apagada e permite reativar. Config global que muda documento não pode ser
--   de mão única.
--
-- IMPACTO NO DADO
--   Nenhum. `default false` = tudo continua visível; as 11 perguntas padrão
--   seguem aparecendo até alguém excluir uma. A tabela tem **0 linhas** hoje
--   (medido em 11/09), então nem há linha para reescrever.
--
-- APÓS APLICAR: recarregar o schema do PostgREST, senão a coluna nova não
-- existe para a API e o app volta a ver `PGRST204` — desta vez em `oculta`:
--   notify pgrst, 'reload schema';
--
-- DESFAZER
--   alter table public.aet_checklist_perguntas drop column if exists oculta;

begin;

alter table public.aet_checklist_perguntas
  add column if not exists oculta boolean not null default false;

comment on column public.aet_checklist_perguntas.oculta is
  'Pergunta excluída pela tela de configuração: some da tela de análise, da prévia e do PDF. Reversível (a tela permite reativar). v209.';

commit;

notify pgrst, 'reload schema';
