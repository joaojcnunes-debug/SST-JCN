-- Desfaz a v350 (Gestão: tela Produtos). Os nomes já trocados (lista, formulários, cartões, automações) FICAM como
-- estão; só deixa de existir a tela, o apelido automático e as funções.
begin;
drop trigger if exists gestao_produtos_apelido on public.gestao_tarefas;
drop function if exists public.gestao_produto_excluir(text);
drop function if exists public.gestao_produto_renomear(text, text);
drop function if exists public.gestao_produto_criar(text);
drop function if exists public.gestao_produtos_listar();
drop function if exists public.gestao_produtos_apelido_trg();
drop function if exists public.gestao_produtos_nos_formularios(text, text, text);
drop function if exists public.gestao_produto_trocar_condicao(jsonb, text, text);
drop function if exists public.gestao_produto_trocar_lista(jsonb, text, text);
drop function if exists public.gestao_produtos_arr(jsonb);
drop function if exists public.gestao_produto_nome(text);
drop function if exists public.gestao_produtos_gestor();
drop function if exists public.gestao_produtos_norm(text);
drop table if exists public.gestao_produtos_apelidos;
notify pgrst, 'reload schema';
commit;
