-- v71: campos estruturados de endereço, contato e dados cadastrais da empresa,
-- preenchidos automaticamente pela busca por CNPJ na Receita Federal (BrasilAPI).
-- Capital social NÃO é armazenado (irrelevante para o trabalho de SST).
alter table public.empresas
  add column if not exists logradouro          text,
  add column if not exists numero              text,
  add column if not exists complemento         text,
  add column if not exists bairro              text,
  add column if not exists municipio           text,
  add column if not exists uf                  text,
  add column if not exists cep                 text,
  add column if not exists telefone            text,
  add column if not exists email               text,
  add column if not exists cnae_principal      text,
  add column if not exists cnae_descricao      text,
  add column if not exists situacao_cadastral  text,
  add column if not exists porte               text;
